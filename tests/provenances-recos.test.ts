// Provenances de la page Recommandations (src/lib/provenancesRecos.ts) et
// client du service Discord (src/lib/discordClient.ts) : groupes de salons,
// ce que montre chaque provenance, état affiché, raisons de ne pas publier,
// salons de « Publier dans… » ; lecture de tous les salons et publication
// contre un service simulé.

import {
  bilanVide, etatAffiche, groupesSalons, provenanceValide, raisonPublier, recosDeProvenance, salonsDePublication, TOUTES,
} from '../src/lib/provenancesRecos';
import { lireTout, publier, retourDeConnexion, salonsAccessibles, type Recuperer, type Sources } from '../src/lib/discordClient';
import { recoLiee, type SalonAccessible } from '../src/lib/recoDiscord';
import type { Reco, RecoDeck, RecoPayload } from '../src/types';
import { egal, ok, titre } from './outils';

const deck = (ids: number[]): RecoDeck => ({
  name: '', note: '', counters: [],
  slots: [0, 1, 2].map((i) => ({ com2usId: ids[i] ?? null, name: ids[i] ? `M${ids[i]}` : '', stats: {}, setOptions: [[]], artifacts: { element: [], archetype: [] } })),
});
const contenu = (name: string): RecoPayload => ({ name, author: 'Toto', note: '', decks: [deck([1, 2, 3])] });
const salon = (serveurId: string, salonId: string, ecrire = true): SalonAccessible =>
  ({ serveurId, salonId, nomServeur: `Serveur ${serveurId}`, nomSalon: `blacksmith-reco-${salonId}`, ecrire });
const liee = (s: SalonAccessible, nom: string) => recoLiee(s, { messageId: `m-${s.salonId}`, date: 'd', reco: contenu(nom) }, () => `id-${s.salonId}`);
const locale = (id: string): Reco => ({ id, origin: 'mine', name: id, author: '', note: '', decks: [deck([4, 5, 6])] });

export function testProvenancesRecos() {
  titre('Recommandations — provenances, état affiché, publier');
  const a = liee(salon('G1', 'A'), 'Défenses');
  const b = { ...liee(salon('G1', 'B', false), 'Offs'), note: 'modifiée' };
  const c = liee(salon('G2', 'C'), 'Alliés');
  const recos = [locale('L1'), c, a, locale('L2'), b];
  const serveurs = [{ id: 'G1', nom: 'Ma guilde', icone: null, botAdmin: true, salons: [] }, { id: 'G9', nom: 'Vide', icone: null, botAdmin: false, salons: [] }];

  const g = groupesSalons(recos, serveurs, ['B']);
  egal(g.map((x) => [x.nom, x.botAdmin, x.salons.map((l) => l.salonId)]), [['Ma guilde', true, ['B', 'A']], ['Serveur G2', false, ['C']]],
    'un groupe par serveur, dans l\'ordre du service puis ceux connus hors connexion ; favoris d\'abord ; un serveur sans salon lié n\'apparaît pas');
  egal(g[0].salons.map((l) => [l.etat, l.favori]), [['modifiee', true], ['a-jour', false]], 'état et favori de chaque salon');

  egal(recosDeProvenance(recos, TOUTES, g).map((r) => r.id), ['L1', 'L2', b.id, a.id, c.id], '« Toutes » : cet appareil d\'abord, puis les salons dans l\'ordre de la colonne');
  egal(recosDeProvenance(recos, { type: 'appareil' }, g).map((r) => r.id), ['L1', 'L2'], '« Sur cet appareil » : les recommandations locales');
  egal(recosDeProvenance(recos, { type: 'salon', salonId: 'C' }, g).map((r) => r.id), [c.id], 'un salon : sa recommandation');
  egal(provenanceValide({ type: 'salon', salonId: 'Z' }, g), TOUTES, 'un salon disparu ramène à « Toutes »');

  egal(etatAffiche(liee(salon('G1', 'R', false), 'x')), 'lecture-seule', 'à jour sans droit d\'écrire : lecture seule');
  egal(etatAffiche(b), 'modifiee', 'modifiée, même en lecture seule');
  egal(etatAffiche(locale('L')), null, 'locale : pas d\'état');
  egal(raisonPublier(a, true), 'a-jour', 'à jour : rien à publier');
  egal(raisonPublier({ ...a, note: 'x' }, true), null, 'modifiée et connecté : publiable');
  egal(raisonPublier({ ...a, note: 'x' }, false), 'non-connecte', 'hors connexion : raison dite');
  egal(raisonPublier(b, true), 'lecture-seule', 'sans droit d\'écrire : raison dite');

  const pub = salonsDePublication([{ id: 'G1', nom: 'Ma guilde', icone: null, botAdmin: false, salons: [
    { id: 'A', nom: 'blacksmith-reco-A', ecrire: true }, { id: 'N', nom: 'blacksmith-reco-neuf', ecrire: true }, { id: 'B', nom: 'blacksmith-reco-B', ecrire: false },
  ] }], recos);
  egal(pub.map((s) => [s.salonId, s.ecrire, s.porte]), [['A', true, 'Défenses'], ['N', true, null], ['B', false, 'Offs']],
    '« Publier dans… » : chaque salon lisible, ce qu\'il porte, le droit d\'écrire');
  ok(bilanVide({ ajoutees: 0, misesAJour: 0, conflits: 0, retirees: 0, detachees: 0 }) && !bilanVide({ ajoutees: 1, misesAJour: 0, conflits: 0, retirees: 0, detachees: 0 }),
    'un bilan vide ne se notifie pas');
}

function service(reponses: Record<string, { statut: number; corps?: unknown }>): { recuperer: Recuperer; appels: string[] } {
  const appels: string[] = [];
  return {
    appels,
    recuperer: async (url, init) => {
      appels.push(`${init?.method ?? 'GET'} ${url}`);
      const r = reponses[url];
      if (!r) throw new Error('réseau');
      return new Response(r.corps === undefined ? null : JSON.stringify(r.corps), { status: r.statut });
    },
  };
}

export async function testClientDiscord() {
  titre('Recommandations — client du service Discord');
  const sources: Sources = { utilisateur: { id: 'U', nom: 'Toto' }, serveurs: [{ id: 'G', nom: 'Guilde', icone: null, botAdmin: false, salons: [
    { id: 'A', nom: 'blacksmith-reco-a', ecrire: true }, { id: 'B', nom: 'blacksmith-reco-b', ecrire: true }, { id: 'C', nom: 'blacksmith-reco-c', ecrire: false },
  ] }] };
  egal(salonsAccessibles(sources).map((s) => `${s.serveurId}/${s.salonId}/${s.ecrire}`), ['G/A/true', 'G/B/true', 'G/C/false'], 'les salons des sources, à plat');
  const v = { messageId: 'm', date: 'd', reco: contenu('R') };
  const s1 = service({ '/api/discord/tout': { statut: 200, corps: { ...sources, versions: { A: v, B: null } } } });
  const tout = await lireTout(s1.recuperer);
  ok(tout.ok, 'lecture de tous les salons');
  if (tout.ok) {
    egal(tout.valeur.salons.map((s) => `${s.salonId}/${s.ecrire}`), ['A/true', 'B/true', 'C/false'], 'les salons des sources, avec le droit d\'écrire');
    egal([tout.valeur.versions.get('A')?.messageId, tout.valeur.versions.get('B'), tout.valeur.versions.has('C')], ['m', null, false],
      'la version de chaque salon ; `null` pour un salon sans version');
  }
  egal(s1.appels, ['GET /api/discord/tout'], 'une seule requête pour tout lire');
  const s2 = service({ '/api/discord/tout': { statut: 401, corps: { connecte: false } } });
  egal(await lireTout(s2.recuperer), { ok: false, echec: 'non-connecte' }, 'session échue : non connecté');
  egal(await lireTout(service({ '/api/discord/tout': { statut: 503, corps: { erreur: 'limite' } } }).recuperer), { ok: false, echec: 'limite' },
    'Discord limite : « limite », à réessayer plus tard');
  egal(await lireTout(service({}).recuperer), { ok: false, echec: 'indisponible' }, 'réseau en panne : indisponible');

  const pub = (statut: number, corps?: unknown) => publier(service({ '/api/discord/publier': { statut, corps } }).recuperer, 'A', 'm', '{}');
  egal((await pub(201, { version: v })).type, 'publie', '201 : publiée');
  egal(await pub(409, { conflit: true, version: v }), { type: 'conflit', version: v }, '409 : conflit, avec la version courante');
  egal((await pub(400, { erreur: 'contenu' })).type, 'invalide', '400 : contenu refusé');
  egal((await pub(403, { acces: true })).type, 'refuse', '403 : droits');
  egal((await pub(401)).type, 'non-connecte', '401 : session échue');
  egal((await pub(500)).type, 'indisponible', '500 : service en panne');
  const s3 = service({ '/api/discord/publier': { statut: 201, corps: { version: v } } });
  await publier(s3.recuperer, 'A', null, '{"x":1}');
  egal(s3.appels, ['POST /api/discord/publier'], 'publier : une requête POST, même origine');

  egal([retourDeConnexion('?discord=refus'), retourDeConnexion('?discord=erreur&x=1'), retourDeConnexion(''), retourDeConnexion('?discord=autre')],
    ['refus', 'erreur', null, null], 'retour de l\'autorisation lu dans l\'adresse');
}
