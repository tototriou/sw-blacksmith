// Recommandations liées à un salon Discord (src/lib/recoDiscord.ts) : état,
// version reçue, synchronisation avec les salons (ajout, mise à jour, conflit,
// accès perdu), publication et conflit de publication, fusion à trois voies
// deck par deck, favoris, relecture du lien, et l'import de fichier qui ne
// touche jamais une recommandation liée.
// Modèle : docs/04-decisions/adr/un-salon-une-reco.md.

import {
  aChoisir, apresConflit, apresPublication, appliquerFusion, basculerFavori, delier, estModifiee, etatLien, fusionEnAttente,
  lireLien, ordonnerSalons, recevoirVersion, recoLiee, synchroniser, type SalonAccessible, type VersionValide,
} from '../src/lib/recoDiscord';
import { trouverCorrespondances } from '../src/lib/recoFusion';
import type { MonstresConnus } from '../src/lib/recoDefenses';
import type { Reco, RecoDeck, RecoPayload, VersionSalon } from '../src/types';
import { egal, ok, titre } from './outils';

const connus: MonstresConnus = new Map();
let n = 0;
const newId = () => `id${++n}`;

function deck(ids: number[], note = ''): RecoDeck {
  const slot = (id: number | undefined) => ({ com2usId: id ?? null, name: id ? `M${id}` : '', stats: {}, setOptions: [[]], artifacts: { element: [], archetype: [] } });
  return { name: '', note, slots: [0, 1, 2].map((i) => slot(ids[i])), counters: [] };
}
function payload(decks: RecoDeck[], extra: Partial<RecoPayload> = {}): RecoPayload {
  return { name: 'Défenses', author: 'Toto', note: '', decks, contributeurs: ['Toto'], source: 'discord:G:C1', ...extra };
}
const version = (messageId: string, p: RecoPayload): VersionValide => ({ messageId, date: `d${messageId}`, reco: p });
const salon = (salonId = 'C1', ecrire = true): SalonAccessible => ({ serveurId: 'G', salonId, nomServeur: 'Guilde', nomSalon: `blacksmith-reco-${salonId}`, ecrire });
const noms = (r: Reco) => r.decks.map((d) => d.slots.map((s) => s.com2usId ?? 0).join('-'));

export function testRecoDiscordEtat() {
  titre('Recos Discord — état d\'une recommandation liée');
  const r = recoLiee(salon(), version('m1', payload([deck([1, 2, 3])])), newId);
  egal([r.origin, etatLien(r), r.author, r.contributeurs], ['imported', 'a-jour', 'Toto', ['Toto']], 'nouvelle recommandation liée : importée, à jour, auteur du salon');
  // Relue du stockage, une possibilité de runage vide s'écrit [[]] ; décodée d'un fichier, []. Même contenu.
  const relue: Reco = { ...r, decks: [{ ...r.decks[0], slots: r.decks[0].slots.map((s) => ({ ...s, setOptions: [] })) }] };
  ok(!estModifiee(relue), 'même contenu sous une autre forme : pas modifiée');
  egal(etatLien({ ...r, note: 'à jouer en premier' }), 'modifiee', 'consignes changées : modifiée');
  egal(etatLien({ ...r, decks: [...r.decks, deck([4, 5, 6])] }), 'modifiee', 'deck ajouté : modifiée');
  egal(etatLien({ ...r, decks: [...r.decks, deck([])] }), 'a-jour', 'un deck vide ajouté ne compte pas : il n\'est jamais publié');
  egal(etatLien({ ...r, lien: { ...r.lien!, enAttente: version('m2', payload([])) } }), 'conflit', 'version en attente : conflit');
  egal(etatLien(delier(r)), null, 'déliée : plus d\'état, recommandation locale');
}

export function testRecoDiscordRecevoir() {
  titre('Recos Discord — une version reçue');
  const r = recoLiee(salon(), version('m1', payload([deck([1, 2, 3])])), newId);
  const v2 = version('m2', payload([deck([1, 2, 3]), deck([4, 5, 6])], { contributeurs: ['Toto', 'Lulu'] }));
  const a = recevoirVersion(r, salon('C1', false), version('m1', payload([deck([9, 9, 9])])));
  egal([noms(a), a.lien?.ecrire], [['1-2-3'], false], 'même message que la base : contenu inchangé, droit d\'écrire mis à jour');
  const b = recevoirVersion(r, salon(), v2);
  egal([noms(b), b.lien?.base.messageId, b.contributeurs, etatLien(b), b.id], [['1-2-3', '4-5-6'], 'm2', ['Toto', 'Lulu'], 'a-jour', r.id],
    'copie non modifiée : remplacée par la version, qui devient la base');
  const modifiee = { ...r, note: 'ma consigne' };
  const c = recevoirVersion(modifiee, salon(), v2);
  egal([c.note, noms(c), c.lien?.base.messageId, c.lien?.enAttente?.messageId, etatLien(c)], ['ma consigne', ['1-2-3'], 'm1', 'm2', 'conflit'],
    'copie modifiée : rien n\'est écrasé, la version attend la fusion');
  egal(recevoirVersion(c, salon(), v2).lien?.enAttente?.messageId, 'm2', 'la même version reçue deux fois : un seul conflit');
  const illisible: VersionSalon = { messageId: 'm3', date: 'd', reco: null };
  egal(noms(recevoirVersion(r, salon(), illisible)), ['1-2-3'], 'version illisible : rien ne change');
}

export function testRecoDiscordSynchro() {
  titre('Recos Discord — synchronisation avec les salons');
  const locale: Reco = { id: 'L', origin: 'mine', name: 'À moi', author: '', note: '', decks: [deck([7, 8, 9])] };
  const c1 = recoLiee(salon('C1'), version('m1', payload([deck([1, 2, 3])])), newId);
  const c2 = recoLiee(salon('C2'), version('m1', payload([deck([1, 2, 3])])), newId);
  const c3modifiee = { ...recoLiee(salon('C3'), version('m1', payload([deck([1, 2, 3])])), newId), note: 'pas publiée' };
  const versions = new Map<string, VersionSalon | null>([
    ['C1', version('m2', payload([deck([4, 5, 6])]))],
    ['C4', version('m9', payload([deck([1, 1, 1])]))],
    ['C5', { messageId: 'm5', date: 'd', reco: null }],
  ]);
  const { recos, bilan } = synchroniser([locale, c1, c2, c3modifiee], [salon('C1'), salon('C4'), salon('C5')], versions, newId);
  egal(recos.map((r) => r.lien?.salonId ?? r.id), ['L', 'C1', c3modifiee.id, 'C4'],
    'recommandation locale intacte ; C2 retirée (accès perdu) ; C3 détachée ; C4 ajoutée ; C5 sans version valide : rien');
  egal(noms(recos[1]), ['4-5-6'], 'C1 mise à jour');
  ok(!recos[2].lien && recos[2].note === 'pas publiée', 'accès perdu avec des modifications : elles restent, en recommandation locale');
  egal(bilan, { ajoutees: 1, misesAJour: 1, conflits: 0, retirees: 1, detachees: 1 }, 'bilan de la synchronisation');

  const deliee = delier(recos[1]);
  const apres = synchroniser([recos[0], deliee, recos[3]], [salon('C1'), salon('C4')], versions, newId);
  egal(apres.recos.filter((r) => r.lien?.salonId === 'C1').length, 1, 'une recommandation déliée reste locale, et le salon réapparaît aussitôt');
  egal(apres.recos.length, 4, 'la copie déliée est gardée à côté');
  const doublon = synchroniser([c1, { ...c1, id: 'bis' }], [salon('C1')], new Map(), newId);
  egal(doublon.recos.length, 1, 'deux liens vers le même salon : un seul est gardé');
  const enConflit = synchroniser([{ ...c1, note: 'à moi' }], [salon('C1')], versions, newId);
  egal([enConflit.bilan.conflits, etatLien(enConflit.recos[0])], [1, 'conflit'], 'version sur copie modifiée : comptée comme conflit');
}

export function testRecoDiscordPublication() {
  titre('Recos Discord — publication et conflit de publication');
  const r = { ...recoLiee(salon(), version('m1', payload([deck([1, 2, 3])])), newId), note: 'nouvelle consigne' };
  const publiee = apresPublication(r, version('m2', payload([deck([1, 2, 3])], { note: 'nouvelle consigne', contributeurs: ['Toto', 'Lulu'] })));
  egal([publiee.lien?.base.messageId, etatLien(publiee), publiee.contributeurs], ['m2', 'a-jour', ['Toto', 'Lulu']],
    'publiée : la version du service devient contenu et base');
  const refusee = apresConflit(r, version('m3', payload([deck([4, 5, 6])])));
  egal([refusee.note, refusee.lien?.enAttente?.messageId, etatLien(refusee)], ['nouvelle consigne', 'm3', 'conflit'], '409 : la version courante attend la fusion');
  const illisible = apresConflit(r, { messageId: 'm4', date: 'd4', reco: null });
  egal([illisible.lien?.base.messageId, illisible.lien?.enAttente, illisible.note], ['m4', undefined, 'nouvelle consigne'],
    '409 sur une version illisible : elle devient la base à citer, la copie se republie telle quelle');
}

export function testRecoDiscordFusion() {
  titre('Recos Discord — fusion à trois voies');
  const A = deck([1, 2, 3]), B = deck([4, 5, 6]), C = deck([7, 8, 9]);
  const base = payload([A, B, C], { name: 'Défenses', note: 'base' });
  const r0 = recoLiee(salon(), version('m1', base), newId);
  // Chez moi : A annoté, C retiré, D ajouté. Au salon : B annoté, E ajouté, nom changé.
  const mien: Reco = { ...r0, decks: [deck([1, 2, 3], 'mon A'), B, deck([10, 11, 12])] };
  const leur = payload([A, deck([4, 5, 6], 'leur B'), C, deck([13, 14, 15])], { name: 'Défenses S12', note: 'base', contributeurs: ['Toto', 'Lulu'] });
  const r = recevoirVersion(mien, salon(), version('m2', leur));
  const f = fusionEnAttente(r, connus)!;
  egal(aChoisir(f), { nom: false, consignes: false, decks: [] }, 'chaque changement d\'un seul côté passe seul : rien à choisir');
  const res = appliquerFusion(r, f, { decks: {} })!;
  egal([res.name, res.decks.map((d) => `${d.slots[0].com2usId}:${d.note}`)], ['Défenses S12', ['1:mon A', '4:leur B', '13:', '10:']],
    'A garde ma note, B la leur, C retiré chez moi (inchangé au salon) disparaît, E et D ajoutés ; ordre du salon puis mes ajouts');
  egal([res.lien?.base.messageId, res.lien?.enAttente, res.contributeurs, etatLien(res)], ['m2', undefined, ['Toto', 'Lulu'], 'modifiee'],
    'la version du salon devient la base ; la fusion reste à publier ; contributeurs du salon');

  // Le même deck changé des deux côtés, et le nom aussi.
  const mien2: Reco = { ...r0, name: 'Mes défenses', decks: [deck([1, 2, 3], 'note à moi'), B, C] };
  const leur2 = payload([deck([1, 2, 3], 'note du salon'), B], { name: 'Défenses du salon', note: 'base' });
  const r2 = recevoirVersion(mien2, salon(), version('m3', leur2));
  const f2 = fusionEnAttente(r2, connus)!;
  const choix2 = aChoisir(f2);
  const cleA = choix2.decks[0];
  ok(choix2.nom && !choix2.consignes && choix2.decks.length === 1 && f2.decks.find((d) => d.cle === cleA)?.mien?.note === 'note à moi',
    'deck et nom changés des deux côtés : à choisir, et seulement eux');
  ok(appliquerFusion(r2, f2, { nom: 'mien', decks: {} }) === null, 'un choix manque : rien n\'est appliqué');
  const garderLeMien = appliquerFusion(r2, f2, { nom: 'mien', decks: { [cleA]: 'mien' } })!;
  egal([garderLeMien.name, garderLeMien.decks.map((d) => d.note)], ['Mes défenses', ['note à moi', '']], 'choix « le mien » ; C, retiré au salon et inchangé chez moi, disparaît');
  const lesDeux = appliquerFusion(r2, f2, { nom: 'leur', decks: { [cleA]: 'les-deux' } })!;
  egal([lesDeux.name, lesDeux.decks.map((d) => d.note)], ['Défenses du salon', ['note à moi', 'note du salon', '']], 'choix « les deux » : les deux versions du deck');

  // Un deck dont l'équipe change : un deck retiré et un autre ajouté.
  const mien3: Reco = { ...r0, decks: [deck([1, 2, 99]), B, C] };
  const r3 = recevoirVersion(mien3, salon(), version('m4', payload([A, B, C, deck([20, 21, 22])])));
  const res3 = appliquerFusion(r3, fusionEnAttente(r3, connus)!, { decks: {} })!;
  egal(res3.decks.map((d) => d.slots.map((s) => s.com2usId).join('-')), ['4-5-6', '7-8-9', '20-21-22', '1-2-99'],
    'changer un monstre fait un autre deck : l\'ancien retiré, le nouveau ajouté');
  // Retiré d'un côté, modifié de l'autre : conflit.
  const r4 = recevoirVersion({ ...r0, decks: [deck([1, 2, 3], 'modifié'), B, C] }, salon(), version('m5', payload([B, C])));
  const f4 = fusionEnAttente(r4, connus)!;
  egal(f4.decks.filter((d) => d.resolu === undefined).map((d) => [d.mien?.note, d.leur]), [['modifié', null]], 'retiré au salon, modifié chez moi : à choisir');
  egal(appliquerFusion(r4, f4, { decks: { [aChoisir(f4).decks[0]]: 'leur' } })?.decks.length, 2, 'choix « celui du salon » : le deck reste retiré');
}

export function testRecoDiscordFavorisEtStockage() {
  titre('Recos Discord — favoris, relecture du lien, import de fichier');
  const salons = [salon('C1'), salon('C2'), salon('C3')];
  egal(ordonnerSalons(salons, ['C3']).map((s) => s.salonId), ['C3', 'C1', 'C2'], 'favoris d\'abord, puis les autres dans l\'ordre reçu');
  egal(basculerFavori(basculerFavori([], 'C2'), 'C2'), [], 'basculer deux fois : plus favori');
  egal(basculerFavori(['C1'], 'C2'), ['C1', 'C2'], 'un favori de plus');

  const r = recoLiee(salon(), version('m1', payload([deck([1, 2, 3])])), newId);
  const relu = lireLien(JSON.parse(JSON.stringify(r.lien)), (x) => (x ? (x as RecoPayload) : null));
  egal(relu, r.lien, 'un lien stocké se relit tel quel');
  egal(lireLien({ ...r.lien, salonId: 3 }, (x) => x as RecoPayload), undefined, 'un lien mal formé tombe : la recommandation reste, locale');
  egal(lireLien({ ...r.lien, base: { messageId: 'm' } }, () => null), undefined, 'sans base lisible : pas de lien');

  const locale: Reco = { id: 'L', origin: 'mine', name: 'Défenses', author: 'Toto', note: '', decks: [deck([1, 2, 3])], source: 'discord:G:C1' };
  const entrante = payload([deck([4, 5, 6])]);
  egal(trouverCorrespondances([r], [entrante]), [null], 'un fichier ne se fusionne jamais dans une recommandation liée, même de même source');
  egal(trouverCorrespondances([r, locale], [entrante])[0]?.id, 'L', 'une recommandation locale de même source reste une cible');
}
