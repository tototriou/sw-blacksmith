// Tests de rendu — « Mes équipes » (docs/02-app/compte/feat-equipes.md), aux
// deux formats. Principe dans tests/rendu/outils-rendu.tsx : ce que la page
// dit et permet, jamais son apparence.

import type { Monster } from '../../src/types';
import EquipesSection, { ConfirmationCreation } from '../../src/components/account/equipes/EquipesSection';
import NouvelleEquipeModale from '../../src/components/account/equipes/NouvelleEquipeModale';
import DetailEquipe from '../../src/components/account/equipes/DetailEquipe';
import ModaleGroupe from '../../src/components/account/equipes/ModaleGroupe';
import ImportEquipeModale from '../../src/components/account/equipes/ImportEquipeModale';
import { ChoixEquipement } from '../../src/components/account/equipes/AjoutMonstreModale';
import type { EquipesEnregistreesApi } from '../../src/hooks/useEquipesEnregistrees';
import { creerEquipe, indexerInventaire, type EquipeEnregistree } from '../../src/lib/equipesEnregistrees';
import { sourcesEquipementEspece, sourcesImportEquipes, type ContexteSourcesEquipes } from '../../src/lib/sourcesEquipesEnregistrees';
import { fr } from '../../src/i18n/fr';
import { egal, ok, titre } from '../outils';
import { amorcerMemoire, reinitialiserSticky } from '../../src/hooks/useStickyState';
import { auTelephone, bouton, boutons, onglets, rendre, texteVisible, valeurs } from './outils-rendu';
import { equipementEx, monstreEx, runeEx } from '../equipes-enregistrees.test';

const T0 = new Date('2026-11-05T10:00:00Z');
function monstre(id: number): Monster {
  return { id, com2usId: 1000 + id, name: `Monstre ${id}`, element: 'fire', stars: 5, naturalStars: 5, secondAwaken: false,
    image: null, stats: { hp: 1, attack: 1, defense: 1, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 }, leaderSkill: null };
}
const MONSTRES = [1, 2, 3].map(monstre);
const ctx = (compte = true): ContexteSourcesEquipes => ({
  box: compte ? [{ key: '11', monster: MONSTRES[0], stars: 6, level: 40, gear: equipementEx(1) }] : [],
  siegeDefenseTeams: [], siegeOffenseTeams: [], rta: { sections: [], entries: {} }, arenaDecks: compte ? [] : null, decksEnregistres: compte ? [] : null, compte,
  monsterById: new Map(MONSTRES.map((m) => [String(m.id), m])),
  monsterByCom2us: new Map(MONSTRES.map((m) => [m.com2usId as number, m])),
});
// La rune 3 a changé depuis l'enregistrement.
const eq1 = equipementEx(1);
const INVENTAIRE = indexerInventaire(eq1.runes.map((r) => (r.id === 3 ? runeEx(3, 3, 99) : r)), eq1.artifacts, [eq1.relic!]);
const EQUIPES: EquipeEnregistree[] = [
  { ...creerEquipe('e1', 'arene/offense', 'Ma RTA', T0), note: 'contre Lushen', monstres: [monstreEx('a', 1001, 11), monstreEx('b', 1002, null, null)], leader: 'a' },
  { ...creerEquipe('e2', 'rta', 'Prépa saison', T0), monstres: [monstreEx('d', 1002, null, null), monstreEx('e', 1003, null, null)] },
  { ...creerEquipe('e3', 'cairos', 'Donjon', T0), monstres: [monstreEx('c', 1003, null, null), monstreEx('f', 1001, null, null)] },
];
const api = (equipes = EQUIPES, relecture: 'en-cours' | 'finie' = 'finie'): EquipesEnregistreesApi => ({
  equipes, relecture, illisibles: 0, signalements: [], clesReservees: new Set(), signaler: () => {}, appliquer: () => {}, remplacerTout: () => {},
});
const section = (o: { api?: EquipesEnregistreesApi; compte?: boolean; menuOuvert?: boolean } = {}) => (
  <EquipesSection api={o.api ?? api()} ctx={ctx(o.compte ?? true)} inventaire={o.compte === false ? null : INVENTAIRE}
    allMonsters={MONSTRES} optimizer={null} onImporterOptimizer={() => ({ listeCreee: null, membresImportes: 0, equipesCreees: 0, ignores: [], equipesNonCreees: [], messages: [] })}
    onEquipeCreee={() => {}} menuOuvert={o.menuOuvert ?? false} onFermerMenu={() => {}} />
);
const e = fr.equipes;

export function testRenduEquipesBureau() {
  titre('rendu · Mes équipes — ordinateur');
  const html = rendre(section());
  const t = texteVisible(html);
  egal(onglets(html).map((o) => [o.texte, o.ouvert]), [
    ['Arène 1', true], ['RTA 1', false], ['Combat de guilde 0', false], ['Cairos 1', false], ['Labyrinthe 0', false], ['Subjugation 0', false],
    ['Passage des dimensions 0', false], ['Rift 0', false], ['Temple du chaos 0', false], ['ToA 0', false],
  ], 'dix onglets dans l’ordre choisi, chacun avec son total, le premier ouvert');
  ok(t.includes('Ma RTA') && !t.includes('Prépa saison') && !t.includes('Donjon'), 'les cartes de l’onglet ouvert seulement');
  const filtre = html.slice(html.indexOf(`aria-label="${e.filtre.aria}"`));
  ok(filtre !== html, 'l’arène a son filtre de catégories');
  egal(boutons(filtre).slice(0, 5).map((b) => b.texte), ['Tout 1', 'Offense arène 1', 'Défense arène 0', 'Défense inter serveur 0', 'Arène dimensionnelle 0'],
    'le filtre : chaque catégorie de l’onglet avec son compte');
  ok(/Ma RTA\s*Offense arène/.test(t), 'sous « Tout », chaque carte dit sa catégorie');
  const telephone = auTelephone(() => rendre(section()));
  ok(telephone.includes(`aria-label="${e.filtre.aria}"`) && texteVisible(telephone).includes('Arène dimensionnelle (0)'), 'au téléphone, le filtre est un menu');
  ok(t.includes('contre Lushen'), 'la note sur la carte');
  ok(t.includes(e.carte.modifiees(1)), 'l’écart au compte : une pièce modifiée');
  for (const b of [e.nouvelle, e.importer, e.exporterFichier, e.importerFichier]) ok(bouton(html, b)?.desactive === false, `« ${b} » utilisable`);
  egal(boutons(html).map((b) => b.texte).filter((x) => [e.nouvelle, e.importer, e.groupes.creer, e.exporterFichier].includes(x)),
    [e.nouvelle, e.importer, e.groupes.creer, e.exporterFichier], '« Importer une équipe » entre « Nouvelle équipe » et « Nouveau groupe »');
  const menu = boutons(html).map((b) => b.texte);
  egal(menu.slice(menu.indexOf(e.carte.renommer), menu.indexOf(e.carte.renommer) + 2), [e.carte.renommer, e.carte.dupliquer],
    'le menu d’une carte : « Renommer » juste au-dessus de « Dupliquer »');
  ok(valeurs(html, 'placeholder').includes(e.recherche), 'la recherche par monstre');
  ok(!texteVisible(rendre(section({ compte: false }))).includes(e.carte.modifiees(1)), 'sans compte, aucun écart affiché');
  const vide = rendre(section({ api: api([], 'en-cours') }));
  ok(texteVisible(vide).includes(e.chargement), 'pendant la relecture, « Lecture des équipes enregistrées… »');
  egal(bouton(vide, e.importerFichier)?.desactive, true, 'et « Importer un fichier » attend la relecture');
  egal(bouton(vide, e.exporterFichier)?.desactive, true, 'rien à exporter sans équipe');
  ok(texteVisible(rendre(section({ api: api([EQUIPES[2]]) }))).includes(e.aucune), 'un onglet vide le dit');
}

export function testRenduEquipesTelephone() {
  titre('rendu · Mes équipes — téléphone');
  const ferme = auTelephone(() => rendre(section()));
  ok(bouton(ferme, e.nouvelle) !== undefined, '« Nouvelle équipe » sous la recherche');
  ok(bouton(ferme, e.importerFichier) === undefined, 'les fichiers et imports attendent le panneau Options');
  const ouvert = auTelephone(() => rendre(section({ menuOuvert: true })));
  ok(texteVisible(ouvert).includes(e.options), 'le panneau Options');
  for (const b of [e.importer, e.exporterFichier, e.importerFichier]) ok(bouton(ouvert, b) !== undefined, `« ${b} » dans le panneau`);
}

export function testRenduEquipesDetail() {
  titre('rendu · Mes équipes — détail d’une équipe');
  const html = rendre(<DetailEquipe equipe={EQUIPES[0]} onChanger={() => {}} monstreDe={(c) => MONSTRES.find((m) => m.com2usId === c)}
    box={ctx().box} inventaire={INVENTAIRE} onAjouter={() => {}} retour={null} menu={null} />);
  const t = texteVisible(html);
  ok(valeurs(html, 'value').includes('Ma RTA') && valeurs(html, 'value').includes('contre Lushen'), 'nom et note éditables');
  ok(t.includes(e.detail.rangement) && t.includes('Arène — Offense arène') && t.includes('Rift — Raid des mondes'), 'l’onglet et la catégorie se changent dans le détail, chaque onglet avec ses catégories');
  ok(t.includes(`${e.detail.provenance.porte} · ${e.detail.exemplaire['equipe-ainsi']}`), 'la provenance et ce que porte l’exemplaire');
  ok(t.includes(`${e.detail.rune(3)} : ${e.detail.etats.modifiee}`), 'la pièce modifiée nommée');
  egal(bouton(html, e.detail.minimum)?.desactive, true, 'à deux monstres, le retrait est refusé et l’infobulle dit pourquoi');
  ok(!texteVisible(html).includes(e.detail.brouillon), 'une équipe enregistrée n’est pas un brouillon');
  ok(bouton(html, e.detail.reprendre) === undefined, 'rien à reprendre : l’exemplaire porte déjà la copie');
  ok(!t.includes('Retirer la relique') && !t.includes('Remove the relic'), 'aucun retrait de relique sur la fiche');
  const autrement = [{ ...ctx().box[0], gear: equipementEx(2) }];
  const hAutrement = rendre(<DetailEquipe equipe={EQUIPES[0]} onChanger={() => {}} monstreDe={(c) => MONSTRES.find((m) => m.com2usId === c)}
    box={autrement} inventaire={INVENTAIRE} onAjouter={() => {}} retour={null} menu={null} />);
  ok(texteVisible(hAutrement).includes(e.detail.exemplaire['equipe-autrement']), 'l’exemplaire est équipé autrement');
  egal(bouton(hAutrement, e.detail.reprendre)?.title, e.detail.reprendreAide, 'reprendre l’équipement porté, son infobulle dit ce qu’il fait');
  egal(bouton(html, e.detail.ajouter)?.desactive, false, 'ajouter un monstre');
  // Une ligne par monstre au large : l'identité, puis stats, artéfacts, runes et relique.
  egal((html.match(/@4xl:grid-cols-subgrid/g) ?? []).length, EQUIPES[0].monstres.length, 'une ligne par monstre, sur les colonnes communes');
  // Les runes en cartes de la liste du compte, à droite de la relique : une
  // bande par monstre équipé, six cartes dans l'ordre des slots.
  const bandesRunes = (h: string) => (h.match(new RegExp(`aria-label="${e.detail.runes.replace(/'/g, '&#x27;')}"`, 'g')) ?? []).length;
  egal(bandesRunes(html), 1, 'une bande de runes pour le seul monstre équipé');
  egal((html.match(/role="listitem"/g) ?? []).length, 6, 'ses six runes en cartes');
  ok(!html.includes('rune-wheel.png'), 'sans roue de runes : les cartes la remplacent');
  const auDoigt = auTelephone(() => rendre(<DetailEquipe equipe={EQUIPES[0]} onChanger={() => {}} monstreDe={(c) => MONSTRES.find((m) => m.com2usId === c)}
    box={ctx().box} inventaire={INVENTAIRE} onAjouter={() => {}} retour={null} menu={null} />));
  ok(auDoigt.includes('rune-wheel.png') && !auDoigt.includes('role="listitem"'), 'au téléphone, la roue de runes et pas de cartes');
  // L'en-tête : le retour et le menu sur la ligne des champs, le nom écrit
  // seulement dans le sien.
  const avecEntete = rendre(<DetailEquipe equipe={EQUIPES[0]} onChanger={() => {}} monstreDe={(c) => MONSTRES.find((m) => m.com2usId === c)}
    box={ctx().box} inventaire={INVENTAIRE} onAjouter={() => {}} retour={<button type="button">retour</button>} menu={<button type="button">menu</button>} />);
  const [iRetour, iNom, iNote, iMenu] = ['>retour<', `value="Ma RTA"`, `value="contre Lushen"`, '>menu<'].map((x) => avecEntete.indexOf(x));
  ok(iRetour >= 0 && iRetour < iNom && iNom < iNote && iMenu > iRetour, 'retour, nom, note et menu dans l’en-tête');
  ok(!texteVisible(avecEntete).includes('Ma RTA'), 'le nom de l’équipe n’est pas répété en dur');
  const melange = { ...EQUIPES[0], monstres: [{ ...EQUIPES[0].monstres[0], equipement: { ...eq1, runes: [...eq1.runes].reverse() } }, EQUIPES[0].monstres[1]] };
  const hMelange = rendre(<DetailEquipe equipe={melange} onChanger={() => {}} monstreDe={(c) => MONSTRES.find((m) => m.com2usId === c)}
    box={ctx().box} inventaire={INVENTAIRE} onAjouter={() => {}} retour={null} menu={null} />);
  const listeRunes = (h: string) => h.slice(h.indexOf('role="list"'));
  egal(listeRunes(hMelange) === listeRunes(rendre(<DetailEquipe equipe={{ ...melange, monstres: [{ ...melange.monstres[0], equipement: eq1 }, melange.monstres[1]] }}
    onChanger={() => {}} monstreDe={(c) => MONSTRES.find((m) => m.com2usId === c)} box={ctx().box} inventaire={INVENTAIRE} onAjouter={() => {}} retour={null} menu={null} />)), true,
  'les cartes suivent l’ordre des slots, quel que soit celui de la copie');
  const plein = { ...EQUIPES[0], onglet: 'faille/raid' as const, monstres: [1, 2, 3, 4, 5, 6].map((k) => monstreEx(`m${k}`, 1002, null, null)) };
  const h2 = rendre(<DetailEquipe equipe={plein} onChanger={() => {}} monstreDe={() => undefined} box={[]} inventaire={null} onAjouter={() => {}} retour={null} menu={null} />);
  egal([bouton(h2, e.detail.ajouter)?.desactive, bouton(h2, e.detail.ajouter)?.title], [true, e.detail.complet], 'à 6 monstres, l’ajout est désactivé avec sa raison');
  ok(texteVisible(h2).includes(e.detail.sansCompte), 'sans compte, la comparaison est annoncée absente');
  egal(bouton(h2, e.detail.retirer('1002'))?.desactive, false, 'au-delà de deux monstres, le retrait est permis');
  const seul = { ...EQUIPES[0], monstres: [monstreEx('s', 1002, null, null)] };
  const h3 = rendre(<DetailEquipe equipe={seul} brouillon onChanger={() => {}} monstreDe={() => undefined} box={[]} inventaire={null} onAjouter={() => {}} retour={null} menu={null} />);
  ok(texteVisible(h3).includes(e.detail.brouillon), 'le brouillon de « Nouvelle équipe » dit quand il s’enregistre');
  egal(bouton(h3, e.detail.retirer('1002'))?.desactive, false, 'un brouillon se vide librement');
}

export function testRenduEquipesImports() {
  titre('rendu · Mes équipes — sources d’import');
  const sources = sourcesImportEquipes({ ...ctx(), arenaDecks: null }, null, INVENTAIRE, 'arene/offense', fr);
  const html = auTelephone(() => rendre(<ImportEquipeModale sources={sources} onChoisir={() => {}} onFermer={() => {}} />));
  const t = texteVisible(html);
  ok(t.includes(e.imports.titre), 'le titre de la modale');
  egal(bouton(html, e.imports.arene)?.desactive, true, 'une source sans contenu est désactivée');
  ok(t.includes(e.imports.reimporter), 'avec sa raison');
}

export function testRenduEquipesNouvelleNommee() {
  titre('rendu · Mes équipes — « Nouvelle équipe » demande son nom');
  const html = auTelephone(() => rendre(<NouvelleEquipeModale nomParDefaut={e.nomParDefaut(3)} onCreer={() => {}} onFermer={() => {}} />));
  const t = texteVisible(html);
  ok(t.includes(e.nouvelleFenetre.titre) && t.includes(e.nouvelleFenetre.nom), 'la fenêtre et son champ');
  ok(valeurs(html, 'value').includes(e.nomParDefaut(3)), 'le premier nom libre prérempli');
  ok(bouton(html, e.nouvelleFenetre.action)?.desactive === false, '« Créer » utilisable');
}

export function testRenduEquipesCreationOptimizer() {
  titre('rendu · Mes équipes — enregistrer une équipe de l’Optimizer');
  const creation = { equipe: { ...EQUIPES[0], nom: 'Liste — équipe 1', lienOptimizer: { listId: 'l', equipeId: 'q', correspondance: [] } },
    monstresChanges: 2, piecesChangees: 9, manquantes: [{ libelle: 'Monstre 1', type: 'rune' as const, id: 999 }],
    reliquesGardees: [], artefactsGardes: [], copiesAmbigues: [], retires: [] };
  // Une modale ne se rend qu'avec une fenêtre (auTelephone en fournit une), comme la modale des sources.
  {
    const html = auTelephone(() => rendre(<ConfirmationCreation creation={creation} onChanger={() => {}} onAnnuler={() => {}} onConfirmer={() => {}} />));
    const t = texteVisible(html);
    ok(t.includes(e.creation.message), 'ce que crée l’enregistrement, et qu’il restera lié');
    ok(t.includes(e.creation.nom) && valeurs(html, 'value').includes('Liste — équipe 1'), 'le nom se donne avant d’enregistrer, le nom proposé prérempli');
    ok(t.includes(e.creation.onglet) && t.includes('Arène — Offense arène') && !t.includes('Arène — RTA'), 'l’onglet et la catégorie se choisissent, l’onglet ouvert par défaut ; pas la RTA, qui garde des prépas');
    ok(t.includes(e.retour.manquante('Monstre 1', e.retour.pieces.rune, 999)), 'une pièce introuvable est nommée');
    ok(!t.includes(e.retour.resume(2, 9)), 'pas de résumé de changements : tout est nouveau');
    ok(bouton(html, e.creation.action)?.desactive === false, '« Enregistrer » utilisable');
    // Un paragraphe ne contient ni bloc ni liste : le sous-titre fait de blocs n'est pas un <p>.
    ok(!/<p(?:\s[^>]*)?>(?:(?!<\/p>).)*<(?:div|ul|p)[\s>]/s.test(html), 'aucun bloc dans un paragraphe');
  }
}

// « Ajouter un monstre », une fois l'espèce choisie : la rangée du choix
// d'exemplaire de l'Optimizer, avec les coéquipiers d'un deck.
export function testRenduEquipesAjoutExemplaire() {
  titre('rendu · Mes équipes — choisir l’exemplaire d’un monstre ajouté');
  const avecDeck: ContexteSourcesEquipes = { ...ctx(), siegeDefenseTeams: [{ id: 'd1', lead: 0, tickAlertDismissed: false,
    slots: ['2', '1', '3'].map((m, i) => ({ monsterId: m, runeSpeed: null, tick: 0, gear: equipementEx(10 * (i + 1)) })) }] };
  const sources = sourcesEquipementEspece(1001, avecDeck, fr);
  for (const telephone of [false, true]) {
    const html = (telephone ? auTelephone : (f: () => string) => f())(() => rendre(<ChoixEquipement espece={MONSTRES[0]} sources={sources} onChoisir={() => {}} />));
    const t = texteVisible(html);
    const deck = bouton(html, e.ajout.defense(1));
    ok(deck !== undefined && deck.desactive === false, `${telephone ? 'téléphone' : 'bureau'} : le deck se choisit`);
    ok(['Monstre 2', 'Monstre 3'].every((n) => deck?.texte.includes(n)), 'ses coéquipiers sont montrés dans son choix');
    ok(!!deck?.texte.includes(fr.optimizer.candidat.runes(6)), 'et ses runes, comme dans l’Optimizer');
    ok(t.includes(e.ajout.equipement), 'sous « Équipement »');
    ok(bouton(html, e.ajout.porte(40)) !== undefined && bouton(html, e.ajout.sansEquipement) !== undefined, 'la Box et « Sans équipement » restent');
  }
}

// Les groupes : des équipes de l'onglet jouées ensemble, sous un en-tête qui
// dit ce qu'elles portent à la fois et les exporte en une liste.
export function testRenduEquipesGroupes() {
  titre('rendu · Mes équipes — groupes d’équipes liées');
  const g = e.groupes;
  const groupe: EquipeEnregistree[] = [
    { ...creerEquipe('s', 'arene/offense', 'Équipe seule', T0), monstres: [monstreEx('c', 1002, null, null), monstreEx('d', 1003, null, null)] },
    { ...creerEquipe('g1', 'arene/defense', 'Équipe G1', T0), groupe: 'Raid A', monstres: [monstreEx('a', 1001, 11), monstreEx('b', 1002, null, null)] },
    { ...creerEquipe('g2', 'arene/dimensionnelle', 'Équipe G2', T0), groupe: 'Raid A', monstres: [monstreEx('e', 1001, 11), monstreEx('f', 1003, null, null)] },
  ];
  const html = rendre(section({ api: api(groupe) }));
  const t = texteVisible(html);
  ok(html.includes('aria-label="Raid A"') && t.includes(g.equipes(2)), 'l’en-tête du groupe, son nom et ses équipes');
  ok(t.includes(g.conflitsEspeces('Monstre 1')) && t.includes(g.conflitsPieces(9)), 'la même espèce et les pièces portées par deux équipes du groupe');
  const [iEnTete, i1, i2, iSans, iSeule] = ['aria-label="Raid A"', 'Équipe G1', 'Équipe G2', `aria-label="${g.sansGroupe}"`, 'Équipe seule'].map((x) => html.indexOf(x));
  ok(iEnTete < i1 && i1 < i2 && i2 < iSans && iSans < iSeule, 'le groupe d’abord, puis « Non groupées » au-dessus des autres équipes');
  ok(!rendre(section()).includes(`aria-label="${g.sansGroupe}"`), 'sans groupe dans l’onglet, pas d’en-tête « Non groupées »');
  egal([bouton(html, g.creer)?.desactive, bouton(html, g.modifier)?.desactive], [false, false], 'former un groupe et le modifier depuis la grille');
  egal(bouton(rendre(section({ api: api([EQUIPES[2]]) })), g.creer)?.desactive, true, 'rien à grouper dans un onglet vide');
  egal(bouton(html, g.exporter)?.desactive, false, 'le groupe s’exporte vers l’Optimizer');
  const sansCompte = rendre(section({ api: api(groupe), compte: false }));
  egal([bouton(sansCompte, g.exporter)?.desactive, bouton(sansCompte, g.exporter)?.title], [true, e.export.sansCompte], 'sans compte, l’export dit pourquoi il attend');
  ok(auTelephone(() => texteVisible(rendre(section({ api: api(groupe) })))).includes(g.equipes(2)), 'au téléphone, le même en-tête');
  const detail = rendre(<DetailEquipe equipe={groupe[0]} groupes={['Raid A', 'Raid B']} onChanger={() => {}} monstreDe={(c) => MONSTRES.find((m) => m.com2usId === c)}
    box={ctx().box} inventaire={INVENTAIRE} onAjouter={() => {}} retour={null} menu={null} />);
  const td = texteVisible(detail);
  ok([e.detail.groupe, g.aucun, 'Raid B', g.nouveau].every((x) => td.includes(x)), 'le détail choisit le groupe parmi ceux de l’onglet, ou en crée un');
  // Au téléphone : le portail de la `Modale` s'y rend en place (outils-rendu.tsx).
  const modale = (gr: string | null) => auTelephone(() => rendre(<ModaleGroupe equipes={groupe} groupe={gr} nomParDefaut="Groupe 1" autresGroupes={[]} onValider={() => {}} onFermer={() => {}} />));
  const edition = modale('Raid A');
  egal([(edition.match(/checked=""/g) ?? []).length, valeurs(edition, 'value').includes('Raid A')], [2, true], 'modifier : le nom et les équipes du groupe cochées');
  const avecSuppression = auTelephone(() => rendre(<ModaleGroupe equipes={groupe} groupe="Raid A" nomParDefaut="Groupe 1" autresGroupes={[]}
    onValider={() => {}} onSupprimer={() => {}} onFermer={() => {}} />));
  egal(bouton(avecSuppression, g.supprimer.action)?.desactive, false, 'un groupe modifié se supprime');
  ok(bouton(modale(null), g.supprimer.action) === undefined, 'rien à supprimer à la création');
  const creation = modale(null);
  ok(valeurs(creation, 'value').includes('Groupe 1') && texteVisible(creation).includes(g.edition.dansGroupe('Raid A')), 'former : « Groupe 1 », et l’équipe d’un autre groupe le dit');
  egal(bouton(creation, g.fenetre.action)?.title, g.edition.auMoinsUne, 'rien de coché : « Créer » attend une équipe');
}

// L'onglet RTA garde des prépas : « Nouvelle prépa », pas de groupe, une carte
// qui résume ses nombreux monstres, un détail sans leader ni rangement.
export function testRenduEquipesPrepa() {
  titre('rendu · Mes équipes — prépas RTA');
  const p = e.prepa;
  const prepa: EquipeEnregistree = { ...creerEquipe('p', 'rta', 'Prépa saison', T0),
    monstres: Array.from({ length: 15 }, (_, k) => monstreEx(`m${k}`, 1001 + (k % 3), null, null)) };
  // L'onglet ouvert se garde pour la session : on le pose avant de rendre.
  const avecOnglet = (f: () => string) => { amorcerMemoire({ 'equipes.categorie': 'rta' }); try { return f(); } finally { reinitialiserSticky('equipes.'); } };
  const html = avecOnglet(() => rendre(section({ api: api([prepa]) })));
  const t = texteVisible(html);
  ok(bouton(html, p.nouvelle) !== undefined && bouton(html, e.nouvelle) === undefined, '« Nouvelle prépa » à la place de « Nouvelle équipe »');
  ok(bouton(html, e.groupes.creer) === undefined, 'pas de groupe dans l’onglet RTA');
  ok(t.includes('Prépa saison') && t.includes(p.plus(3)), 'la carte montre douze monstres et le nombre des autres');
  ok(texteVisible(avecOnglet(() => rendre(section({ api: api([]) })))).includes(p.aucune), 'un onglet RTA vide dit d’où vient une prépa');
  const detail = rendre(<DetailEquipe equipe={prepa} onChanger={() => {}} monstreDe={(c) => MONSTRES.find((m) => m.com2usId === c)}
    box={[]} inventaire={null} onAjouter={() => {}} retour={null} menu={null} />);
  const td = texteVisible(detail);
  ok(!td.includes(e.detail.designerLeader) && !td.includes(e.detail.rangement) && !td.includes(e.detail.groupe), 'le détail : ni leader, ni rangement, ni groupe');
  egal(bouton(detail, e.detail.ajouter)?.desactive, false, 'une prépa grandit au-delà de six monstres');
}

// Le nombre de monstres par contenu : la carte et le détail le disent.
export function testRenduEquipesTaille() {
  titre('rendu · Mes équipes — monstres par équipe selon le contenu');
  const cinq: EquipeEnregistree = { ...creerEquipe('c', 'arene/offense', 'Cinq', T0), monstres: [1, 2, 3, 1, 2].map((k, i) => monstreEx(`m${i}`, 1000 + k, null, null)) };
  ok(texteVisible(rendre(section({ api: api([cinq]) }))).includes(e.carte.tropDeMonstres(5, 4)), 'la carte d’une équipe trop grande pour son contenu');
  const detail = (x: EquipeEnregistree) => rendre(<DetailEquipe equipe={x} onChanger={() => {}} monstreDe={(c) => MONSTRES.find((m) => m.com2usId === c)}
    box={[]} inventaire={null} onAjouter={() => {}} retour={null} menu={null} />);
  ok(texteVisible(detail(cinq)).includes(e.taille.trop(5, 'Arène — Offense arène', 4)), 'le détail dit la limite dépassée');
  const quatre = { ...cinq, monstres: cinq.monstres.slice(0, 4) };
  egal([bouton(detail(quatre), e.detail.ajouter)?.desactive, bouton(detail(quatre), e.detail.ajouter)?.title], [true, e.taille.max('Arène — Offense arène', 4)],
    'à la limite du contenu, l’ajout est refusé avec sa raison');
  ok(!texteVisible(detail(quatre)).includes(e.taille.trop(4, 'Arène — Offense arène', 4)), 'à la limite, pas d’alerte');
}

export const verificationsRenduEquipes: [string, () => void][] = [
  ['testRenduEquipesAjoutExemplaire', testRenduEquipesAjoutExemplaire],
  ['testRenduEquipesCreationOptimizer', testRenduEquipesCreationOptimizer],
  ['testRenduEquipesNouvelleNommee', testRenduEquipesNouvelleNommee],
  ['testRenduEquipesBureau', testRenduEquipesBureau],
  ['testRenduEquipesTelephone', testRenduEquipesTelephone],
  ['testRenduEquipesDetail', testRenduEquipesDetail],
  ['testRenduEquipesImports', testRenduEquipesImports],
  ['testRenduEquipesGroupes', testRenduEquipesGroupes],
  ['testRenduEquipesTaille', testRenduEquipesTaille],
  ['testRenduEquipesPrepa', testRenduEquipesPrepa],
];
