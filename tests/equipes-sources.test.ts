// Les sources de « Mes équipes » : l'équipement d'un monstre ajouté et les
// imports d'équipes (docs/02-app/compte/feat-equipes.md).
//
// ⚠️ Ce qui casserait sans bruit : une copie de la Box choisie à la place
// d'un preset qui n'en dit rien, un import qui modifie l'équipement source,
// une source vide qui crée une équipe vide au lieu de dire pourquoi.

import { egal, ok, titre } from './outils';
import type { Monster, SiegeTeam } from '../src/types';
import { fr } from '../src/i18n/fr';
import { indexerInventaire, sousCategorieDe, type OngletEquipes } from '../src/lib/equipesEnregistrees';
import type { DeckEnregistreImporte } from '../src/lib/importAccount';
import {
  RANGEMENT_CONTENU_DECK, RANGEMENT_SOUS_CONTENU_DECK, libelleDeckEnregistre, rangementDeck, ordonnerSourcesPourOnglet, sourcesEquipementEspece, sourcesImportEquipes,
  type ContexteSourcesEquipes,
} from '../src/lib/sourcesEquipesEnregistrees';
import { equipementEx } from './equipes-enregistrees.test';

const T0 = new Date('2026-11-05T10:00:00Z');
function monstre(id: number): Monster {
  return { id, com2usId: 1000 + id, name: `Monstre ${id}`, element: 'fire', stars: 5, naturalStars: 5, secondAwaken: false,
    image: null, stats: { hp: 1, attack: 1, defense: 1, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 }, leaderSkill: null };
}
const deck = (id: string, ids: (string | null)[]): SiegeTeam => ({ id, lead: 0, tickAlertDismissed: false,
  slots: ids.map((m, i) => ({ monsterId: m, runeSpeed: null, tick: 0, gear: equipementEx(10 * (i + 1)) })) });
const slotDeck = (com2usId: number) => ({ com2usId, flatRuneSpeed: 0, swift: false, sets: [], gear: equipementEx(com2usId) });
const deckJeu = (deckType: number, contenu: DeckEnregistreImporte['contenu'], ids: (number | null)[], extra: Partial<DeckEnregistreImporte> = {}): DeckEnregistreImporte =>
  ({ deckId: `${deckType}-${ids.join('-')}`, deckType, contenu, sousContenu: null, categorie: null, emplacement: 1,
    slots: ids.map((c) => (c === null ? null : slotDeck(c))), ...extra });
function contexte(): ContexteSourcesEquipes {
  const ms = [1, 2, 3].map(monstre);
  return {
    box: [{ key: '11', monster: ms[0], stars: 6, level: 40, gear: equipementEx(1) }, { key: '12', monster: ms[0], stars: 6, level: 35, gear: equipementEx(2) }],
    siegeDefenseTeams: [deck('d1', ['1', '2', '99'])], siegeOffenseTeams: [deck('o1', [null, null, null])], rta: { sections: [], entries: {} },
    arenaDecks: [{ cle: 'defense', rang: 0, slots: [{ unitId: 11, com2usId: 1001, gear: equipementEx(4) }, { unitId: 21, com2usId: 1002, gear: equipementEx(5) }] }],
    decksEnregistres: [],
    compte: true,
    monsterById: new Map(ms.map((m) => [String(m.id), m])),
    monsterByCom2us: new Map(ms.map((m) => [m.com2usId as number, m])),
  };
}
const inv = indexerInventaire([], [], []);
let n = 0;
const uid = () => `u${++n}`;

function testEquipesSourcesEquipement() {
  titre('Mes équipes — l’équipement d’un monstre ajouté');
  const s = sourcesEquipementEspece(1001, contexte(), fr);
  egal(s.map((x) => [x.libelle, x.provenance, x.unitId]), [
    ['Équipement porté (niveau 40)', 'porte', 11], ['Équipement porté (niveau 35)', 'porte', 12],
['Défense de siège 1', 'siege-defense', null],
    ['Défense d’arène', 'arene-defense', 11], ['Sans équipement', 'aucun', null],
  ], 'chaque exemplaire de la Box, les decks ; un deck de siège sans unité garde unitId null');
  egal(s.map((x) => x.equipe && [x.equipe.membres.map((m) => m?.name ?? null), x.equipe.position]), [
    undefined, undefined, [['Monstre 1', 'Monstre 2', null], 0], [['Monstre 1', 'Monstre 2'], 0], undefined,
  ], 'un deck dit ses coéquipiers et la place du monstre, une espèce inconnue reste une place vide');
  egal(sourcesEquipementEspece(1003, contexte(), fr).map((x) => x.provenance), ['aucun'], 'une espèce inconnue du compte : sans équipement seulement');
}

function testEquipesSourcesImports() {
  titre('Mes équipes — imports d’équipes');
  const ctx = contexte();
  const avant = structuredClone(ctx.siegeDefenseTeams);
  const sources = sourcesImportEquipes(ctx, null, inv, 'toa', fr);
  egal(sources.map((x) => [x.groupe, x.libelle, x.raison]), [
    ['Défenses de siège', 'Défense 1', null], ['Offenses de siège', 'Offense 1', 'Aucun deck dans ton compte.'],
    ['Arène', 'Défense d’arène', null], ['Decks du jeu', 'Prépa de la page RTA', 'La prépa de la page RTA est vide.'],
    ['Optimizer', 'Optimizer', 'Aucune liste dans l’Optimizer.'],
  ], 'une source par deck, une source vide dite avec sa raison');
  const cree = sources[0].creer('e1', uid, T0);
  ok(cree !== null, 'la défense crée une équipe');
  if (!cree) return;
  egal([cree.equipe.onglet, cree.equipe.nom, cree.equipe.monstres.map((m) => [m.com2usId, m.unitId, m.provenance])],
    ['guilde/defense-siege', 'Défense 1', [[1001, null, 'siege-defense'], [1002, null, 'siege-defense']]], 'dans son onglet, le preset copié, sans unité');
  egal(cree.ignores, 1, 'un monstre inconnu est compté');
  egal(cree.equipe.leader, cree.equipe.monstres[0].uid, 'le slot 0 est le leader');
  cree.equipe.monstres[0].equipement!.runes[0].level = 0;
  egal(ctx.siegeDefenseTeams, avant, 'la source n’est jamais modifiée');
  const sansTete = sourcesImportEquipes({ ...ctx, siegeDefenseTeams: [deck('d2', [null, '2', '1'])] }, null, inv, 'toa', fr)[0].creer('e3', uid, T0);
  egal(sansTete?.equipe.leader, null, 'un slot 0 vide laisse l’équipe sans leader, le slot 1 n’en devient pas un');
  const arene = sources[2].creer('e2', uid, T0);
  egal(arene && [arene.equipe.onglet, arene.equipe.monstres[0].unitId], ['arene/defense', 11], 'un deck d’arène garde l’unité, dans sa catégorie');
  egal(sourcesImportEquipes({ ...ctx, arenaDecks: null }, null, inv, 'toa', fr).find((x) => x.groupe === 'Arène')?.raison,
    fr.equipes.imports.reimporter, 'compte conservé sans ses decks d’arène : réimporter');
  egal(sourcesImportEquipes({ ...ctx, compte: false }, null, inv, 'toa', fr).find((x) => x.groupe === 'Arène')?.raison,
    fr.equipes.imports.sansCompte, 'sans compte : la raison le dit');
  const seul = sourcesImportEquipes({ ...ctx, siegeDefenseTeams: [deck('d3', ['1', '99', null])] }, null, inv, 'toa', fr)[0];
  egal(seul.raison, fr.equipes.imports.moinsDeDeux, 'une seule espèce connue : pas importable, une équipe a au moins deux monstres');
}

// Les premières sources sont celles de l'onglet ouvert (décision de l'utilisateur) :
// celles de la catégorie filtrée, puis celles de l'onglet, puis le reste dans l'ordre de base.
function testEquipesSourcesOrdreSelonOnglet() {
  titre('Mes équipes — les sources d’import suivent l’onglet ouvert');
  const base: { cle: string; rangement?: OngletEquipes }[] = [
    { cle: 'def1', rangement: 'guilde/defense-siege' }, { cle: 'def2', rangement: 'guilde/defense-siege' }, { cle: 'off1', rangement: 'guilde/offense-siege' },
    { cle: 'arDef', rangement: 'arene/defense' }, { cle: 'arServ', rangement: 'arene/defense-serveur' }, { cle: 'arOff', rangement: 'arene/offense' },
    { cle: 'gdg', rangement: 'guilde/offense-gdg' }, { cle: 'laby', rangement: 'labyrinthe/boss' }, { cle: 'geant', rangement: 'cairos/geant' },
    { cle: 'cairos', rangement: 'cairos' }, { cle: 'tour', rangement: 'toa' }, { cle: 'optimizer' },
  ];
  const ordre = (onglet: OngletEquipes) => ordonnerSourcesPourOnglet(base, onglet).map((x) => x.cle);
  const reste = (...premiers: string[]) => [...premiers, ...base.map((x) => x.cle).filter((c) => !premiers.includes(c))];
  egal(ordre('guilde/defense-siege'), reste('def1', 'def2', 'off1', 'gdg'), 'défense siège : les siennes, puis le reste de l’onglet, puis le reste');
  egal(ordre('guilde/offense-gdg'), reste('gdg', 'def1', 'def2', 'off1'), 'offense guerre de guilde : la sienne d’abord');
  egal(ordre('guilde'), reste('def1', 'def2', 'off1', 'gdg'), 'sous « Tout » : l’onglet d’abord, dans l’ordre de base');
  egal(ordre('arene/offense'), reste('arOff', 'arDef', 'arServ'), 'offense arène : les offenses, puis les défenses');
  egal(ordre('cairos/geant'), reste('geant', 'cairos'), 'Géant : ses decks, puis ceux de Cairos sans donjon');
  egal(ordre('toa'), reste('tour'), 'ToA : les tours en font partie');
  egal(ordre('subjugation'), base.map((x) => x.cle), 'un onglet sans source : l’ordre de base');
  const reel = sourcesImportEquipes(contexte(), null, inv, 'arene/defense', fr);
  egal(reel.map((x) => x.groupe), ['Arène', 'Défenses de siège', 'Offenses de siège', 'Decks du jeu', 'Optimizer'], 'appliqué aux sources réelles, chaque groupe d’un seul tenant');
}

// Les decks enregistrés de l'export, rangés dans les onglets et leurs catégories.
function testEquipesSourcesDecksEnregistres() {
  titre('Mes équipes — les decks enregistrés du jeu');
  egal(RANGEMENT_CONTENU_DECK.autre, null, 'un contenu non relevé n’a pas de rangement fixe');
  egal(Object.values(RANGEMENT_SOUS_CONTENU_DECK).filter((o) => sousCategorieDe(o) === null), [], 'chaque donjon a sa catégorie');
  egal([rangementDeck({ contenu: 'cairos', sousContenu: null }), rangementDeck({ contenu: 'raid-dimensionnel-2', sousContenu: null }),
    rangementDeck({ contenu: 'raid-mondes', sousContenu: null }), rangementDeck({ contenu: 'faille-mondes', sousContenu: 'bete-marecage' }),
    rangementDeck({ contenu: 'subjugation', sousContenu: 'subjugation-boss' }), rangementDeck({ contenu: 'labyrinthe-temps-pause', sousContenu: null })],
  ['cairos', 'passage-dimensions/raid', 'faille/raid', 'faille/marecage', 'subjugation/boss', 'labyrinthe/temps-pause'],
  'par le donjon, sinon par le contenu ; les trois phases du raid dimensionnel ensemble');
  const ctx = { ...contexte(), decksEnregistres: [
    deckJeu(22, 'siege-offense', [1001, 1002, 1003]), deckJeu(1, 'arene-offense', [1001, 1002]),
    deckJeu(13, 'tour-feu', [1002, 1001]),
    deckJeu(24, 'cairos', [null, 1001, 1002], { sousContenu: 'taniere-dragon', emplacement: 2 }),
    deckJeu(4, 'labyrinthe-normal', [1001, 1002, 1003], { categorie: 3 }),
    deckJeu(99, 'autre', [1001, 1002]),
    deckJeu(2, 'guerre-guilde-offense', [1001, 99999]),
  ] };
  const decks = sourcesImportEquipes(ctx, null, inv, 'arene/offense', fr).filter((x) => x.cle.startsWith('deck:'));
  egal(decks.map((x) => [x.groupe, x.libelle, x.rangement]), [
    ['Arène', 'Deck de type 99 · 1', 'arene/offense'], ['Combat de guilde', 'Guerre de guilde — offense · 1', 'guilde/offense-gdg'],
    ['Cairos', 'Cairos — Tanière du dragon · 2', 'cairos/dragon'], ['Labyrinthe', 'Labyrinthe — normal — catégorie 3 · 1', 'labyrinthe/normal'],
    ['ToA', 'Tour du feu · 1', 'toa'],
  ], 'dans l’ordre des onglets ; siège et arène déjà sources ailleurs ; un type non relevé va dans l’onglet ouvert');
  const autre = decks[0];
  ok(autre !== undefined, 'le type non relevé est importable');
  decks.splice(0, 1);
  egal(decks[0].raison, fr.equipes.imports.moinsDeDeux, 'un deck d’une seule espèce connue : pas importable');
  const cairos = decks[1].creer('e1', uid, T0);
  egal(cairos && [cairos.equipe.onglet, cairos.equipe.leader, cairos.equipe.monstres.map((m) => [m.com2usId, m.unitId, m.provenance])],
    ['cairos/dragon', null, [[1001, null, 'deck'], [1002, null, 'deck']]], 'rangée dans son donjon, sans unité ; une tête vide laisse l’équipe sans leader');
  egal(cairos?.equipe.monstres[0].equipement, equipementEx(1001), 'l’équipement du deck est copié');
  const tour = decks[3].creer('e2', uid, T0);
  egal(tour && [tour.equipe.onglet, tour.equipe.leader === tour.equipe.monstres[0].uid], ['toa', true], 'le slot 0 est le leader');
  egal(sourcesImportEquipes({ ...ctx, decksEnregistres: null }, null, inv, 'toa', fr).find((x) => x.cle === 'decks')?.raison,
    fr.equipes.imports.reimporter, 'compte conservé avant leur lecture : réimporter');
  egal(sourcesImportEquipes({ ...ctx, compte: false }, null, inv, 'toa', fr).find((x) => x.cle === 'decks')?.raison,
    fr.equipes.imports.sansCompte, 'sans compte : la raison le dit');
  egal(libelleDeckEnregistre(deckJeu(24, 'cairos', [1], { sousContenu: 'castel-geant', categorie: 5 }), fr), 'Cairos — Castel du Géant · 1',
    'le donjon l’emporte sur le numéro de catégorie');
}

// La prépa de la page RTA : une source « Decks du jeu » qui crée une prépa
// entière, et un équipement proposé à l'ajout d'un monstre.
function testEquipesSourcesPrepaRta() {
  titre('Mes équipes — la prépa de la page RTA');
  const ctx: ContexteSourcesEquipes = { ...contexte(), rta: { sections: ['violent', 'other'], entries: {
    '2': { monsterId: '2', section: 'other', runeSpeed: 20, gear: equipementEx(7) },
    '1': { monsterId: '1', section: 'violent', runeSpeed: 30, gear: equipementEx(6), unitId: 12 },
    '3': { monsterId: '3', section: 'unassigned', runeSpeed: null },
    '99': { monsterId: '99', section: 'violent', runeSpeed: null },
  } } };
  const src = sourcesImportEquipes(ctx, null, inv, 'rta', fr);
  egal([src[0].groupe, src[0].libelle, src[0].raison, src[0].rangement], ['Decks du jeu', 'Prépa de la page RTA', null, 'rta'],
    'dans l’onglet RTA, la prépa de la page RTA d’abord, avec les decks du jeu');
  const cree = src[0].creer('p1', uid, T0)!;
  egal([cree.equipe.onglet, cree.equipe.leader, cree.equipe.monstres.map((m) => [m.com2usId, m.unitId, m.provenance])],
    ['rta', null, [[1001, 12, 'rta'], [1002, null, 'rta'], [1003, null, 'aucun']]],
    'une prépa : les sections dans leur ordre, « Non classé » en dernier, l’exemplaire de chaque build');
  egal(cree.ignores, 1, 'une espèce inconnue est comptée');
  const vide = sourcesImportEquipes({ ...ctx, rta: { sections: [], entries: {} } }, null, inv, 'rta', fr)[0];
  egal(vide.raison, fr.equipes.imports.prepaVide, 'une prépa vide le dit');
  egal(sourcesEquipementEspece(1001, ctx, fr).map((x) => [x.libelle, x.provenance, x.unitId]).slice(2, 3), [['Prépa RTA', 'rta', 12]],
    'à l’ajout d’un monstre, son build de la prépa RTA, après la Box');
}

export const verificationsEquipesSources: [string, () => void][] = [
  ['testEquipesSourcesOrdreSelonOnglet', testEquipesSourcesOrdreSelonOnglet],
  ['testEquipesSourcesEquipement', testEquipesSourcesEquipement],
  ['testEquipesSourcesImports', testEquipesSourcesImports],
  ['testEquipesSourcesDecksEnregistres', testEquipesSourcesDecksEnregistres],
  ['testEquipesSourcesPrepaRta', testEquipesSourcesPrepaRta],
];
