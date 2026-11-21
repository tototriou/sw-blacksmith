// Les sources de « Mes équipes » : l'équipement d'un monstre ajouté et les
// imports d'équipes (docs/02-app/compte/feat-equipes.md).
//
// ⚠️ Ce qui casserait sans bruit : une copie de la Box choisie à la place
// d'un preset qui n'en dit rien, un import qui modifie l'équipement source,
// une source vide qui crée une équipe vide au lieu de dire pourquoi.

import { egal, ok, titre } from './outils';
import type { Monster, SiegeTeam } from '../src/types';
import { fr } from '../src/i18n/fr';
import { indexerInventaire } from '../src/lib/equipesEnregistrees';
import type { DeckEnregistreImporte } from '../src/lib/importAccount';
import {
  RANGEMENT_CONTENU_DECK, libelleDeckEnregistre, ordonnerSourcesPourOnglet, sourcesEquipementEspece, sourcesImportEquipes,
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
    siegeDefenseTeams: [deck('d1', ['1', '2', '99'])], siegeOffenseTeams: [deck('o1', [null, null, null])],
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
  const sources = sourcesImportEquipes(ctx, null, inv, 'rta', fr);
  egal(sources.map((x) => [x.groupe, x.libelle, x.raison]), [
    ['Défenses de siège', 'Défense 1', null], ['Offenses de siège', 'Offense 1', 'Aucun deck dans ton compte.'],
    ['Arène', 'Défense d’arène', null], ['Optimizer', 'Optimizer', 'Aucune liste dans l’Optimizer.'],
  ], 'une source par deck, une source vide dite avec sa raison');
  const cree = sources[0].creer('e1', uid, T0);
  ok(cree !== null, 'la défense crée une équipe');
  if (!cree) return;
  egal([cree.equipe.onglet, cree.equipe.nom, cree.equipe.monstres.map((m) => [m.com2usId, m.unitId, m.provenance])],
    ['guilde-defense', 'Défense 1', [[1001, null, 'siege-defense'], [1002, null, 'siege-defense']]], 'dans son onglet, le preset copié, sans unité');
  egal(cree.ignores, 1, 'un monstre inconnu est compté');
  egal(cree.equipe.leader, cree.equipe.monstres[0].uid, 'le slot 0 est le leader');
  cree.equipe.monstres[0].equipement!.runes[0].level = 0;
  egal(ctx.siegeDefenseTeams, avant, 'la source n’est jamais modifiée');
  const sansTete = sourcesImportEquipes({ ...ctx, siegeDefenseTeams: [deck('d2', [null, '2', '1'])] }, null, inv, 'rta', fr)[0].creer('e3', uid, T0);
  egal(sansTete?.equipe.leader, null, 'un slot 0 vide laisse l’équipe sans leader, le slot 1 n’en devient pas un');
  const arene = sources[2].creer('e2', uid, T0);
  egal(arene && [arene.equipe.onglet, arene.equipe.monstres[0].unitId], ['arene-defense', 11], 'un deck d’arène garde l’unité');
  egal(sourcesImportEquipes({ ...ctx, arenaDecks: null }, null, inv, 'rta', fr).find((x) => x.groupe === 'Arène')?.raison,
    fr.equipes.imports.reimporter, 'compte conservé sans ses decks d’arène : réimporter');
  egal(sourcesImportEquipes({ ...ctx, compte: false }, null, inv, 'rta', fr).find((x) => x.groupe === 'Arène')?.raison,
    fr.equipes.imports.sansCompte, 'sans compte : la raison le dit');
  const seul = sourcesImportEquipes({ ...ctx, siegeDefenseTeams: [deck('d3', ['1', '99', null])] }, null, inv, 'rta', fr)[0];
  egal(seul.raison, fr.equipes.imports.moinsDeDeux, 'une seule espèce connue : pas importable, une équipe a au moins deux monstres');
}

// Les premières sources sont celles de l'onglet ouvert (décision de l'utilisateur) :
// la même catégorie du même côté, puis l'autre côté, puis le reste dans l'ordre de base.
function testEquipesSourcesOrdreSelonOnglet() {
  titre('Mes équipes — les sources d’import suivent l’onglet ouvert');
  const base = ['siege-defense:d1', 'siege-defense:d2', 'siege-attaque:o1', 'arene:defense:0', 'arene:defense-serveur:0', 'arene:attaque:0', 'arene:attaque:1',
    'deck:guerre-guilde-offense:2:a', 'deck:labyrinthe-boss:7:b', 'deck:cairos:24:c', 'deck:tour-feu:13:d', 'deck:autre:99:e', 'optimizer:l:e']
    .map((cle) => ({ cle }));
  const ordre = (onglet: Parameters<typeof ordonnerSourcesPourOnglet>[1]) => ordonnerSourcesPourOnglet(base, onglet).map((x) => x.cle);
  const reste = (...premiers: string[]) => [...premiers, ...base.map((x) => x.cle).filter((c) => !premiers.includes(c))];
  egal(ordre('guilde-defense'), reste('siege-defense:d1', 'siege-defense:d2', 'siege-attaque:o1', 'deck:guerre-guilde-offense:2:a'),
    'combat de guilde — défense : défenses de siège, puis les offenses de siège et de guerre de guilde, puis le reste');
  egal(ordre('guilde-offense'), reste('siege-attaque:o1', 'deck:guerre-guilde-offense:2:a', 'siege-defense:d1', 'siege-defense:d2'),
    'combat de guilde — offense : les offenses d’abord, puis les défenses');
  egal(ordre('arene-offense'), reste('arene:attaque:0', 'arene:attaque:1', 'arene:defense:0', 'arene:defense-serveur:0'),
    'arène — offense : les offenses d’arène, les défenses d’arène, puis le reste');
  egal(ordre('arene-defense').slice(0, 4), ['arene:defense:0', 'arene:defense-serveur:0', 'arene:attaque:0', 'arene:attaque:1'], 'arène — défense : les défenses d’abord');
  egal(ordre('labyrinthe'), reste('deck:labyrinthe-boss:7:b'), 'labyrinthe : ses decks d’abord');
  egal(ordre('toa'), reste('deck:tour-feu:13:d'), 'ToA : les tours en font partie');
  egal(ordre('cairos'), reste('deck:cairos:24:c'), 'Cairos : ses decks d’abord');
  egal(ordre('rta'), base.map((x) => x.cle), 'RTA : l’ordre de base');
  const reel = sourcesImportEquipes(contexte(), null, inv, 'arene-defense', fr);
  egal(reel.map((x) => x.groupe), ['Arène', 'Défenses de siège', 'Offenses de siège', 'Optimizer'], 'appliqué aux sources réelles, chaque groupe d’un seul tenant');
}

// Les decks enregistrés de l'export, rangés dans les sept catégories.
function testEquipesSourcesDecksEnregistres() {
  titre('Mes équipes — les decks enregistrés du jeu');
  egal([...new Set(Object.values(RANGEMENT_CONTENU_DECK))].filter((r) => r !== null).sort(),
    ['arene-offense', 'cairos', 'guilde-offense', 'labyrinthe', 'passage-dimensions', 'toa'], 'chaque contenu a un rangement, jamais la RTA ni une défense');
  egal(RANGEMENT_CONTENU_DECK.autre, null, 'un contenu non relevé n’a pas de rangement fixe');
  const ctx = { ...contexte(), decksEnregistres: [
    deckJeu(22, 'siege-offense', [1001, 1002, 1003]), deckJeu(1, 'arene-offense', [1001, 1002]),
    deckJeu(13, 'tour-feu', [1002, 1001]),
    deckJeu(24, 'cairos', [null, 1001, 1002], { sousContenu: 'taniere-dragon', emplacement: 2 }),
    deckJeu(4, 'labyrinthe-normal', [1001, 1002, 1003], { categorie: 3 }),
    deckJeu(99, 'autre', [1001, 1002]),
    deckJeu(2, 'guerre-guilde-offense', [1001, 99999]),
  ] };
  const decks = sourcesImportEquipes(ctx, null, inv, 'rta', fr).filter((x) => x.cle.startsWith('deck:'));
  egal(decks.map((x) => [x.groupe, x.libelle]), [
    ['Combat de guilde', 'Guerre de guilde — offense · 1'], ['Labyrinthe', 'Labyrinthe — normal — catégorie 3 · 1'],
    ['RTA', 'Deck de type 99 · 1'], ['Cairos', 'Cairos — Tanière du dragon · 2'], ['ToA', 'Tour du feu · 1'],
  ], 'dans l’ordre des onglets ; siège et arène déjà sources ailleurs ; un type non relevé va dans l’onglet ouvert');
  egal(decks[0].raison, fr.equipes.imports.moinsDeDeux, 'un deck d’une seule espèce connue : pas importable');
  const cairos = decks[3].creer('e1', uid, T0);
  egal(cairos && [cairos.equipe.onglet, cairos.equipe.leader, cairos.equipe.monstres.map((m) => [m.com2usId, m.unitId, m.provenance])],
    ['cairos', null, [[1001, null, 'deck'], [1002, null, 'deck']]], 'rangé dans sa catégorie, sans unité ; une tête vide laisse l’équipe sans leader');
  egal(cairos?.equipe.contenuJeu, 'cairos', 'l’équipe garde le contenu du jeu de son deck, qui choisira le lead à l’export');
  egal(cairos?.equipe.monstres[0].equipement, equipementEx(1001), 'l’équipement du deck est copié');
  const tour = decks[4].creer('e2', uid, T0);
  egal(tour && [tour.equipe.onglet, tour.equipe.leader === tour.equipe.monstres[0].uid], ['toa', true], 'le slot 0 est le leader');
  egal(sourcesImportEquipes({ ...ctx, decksEnregistres: null }, null, inv, 'rta', fr).find((x) => x.cle === 'decks')?.raison,
    fr.equipes.imports.reimporter, 'compte conservé avant leur lecture : réimporter');
  egal(sourcesImportEquipes({ ...ctx, compte: false }, null, inv, 'rta', fr).find((x) => x.cle === 'decks')?.raison,
    fr.equipes.imports.sansCompte, 'sans compte : la raison le dit');
  egal(libelleDeckEnregistre(deckJeu(24, 'cairos', [1], { sousContenu: 'castel-geant', categorie: 5 }), fr), 'Cairos — Castel du Géant · 1',
    'le donjon l’emporte sur le numéro de catégorie');
}

export const verificationsEquipesSources: [string, () => void][] = [
  ['testEquipesSourcesOrdreSelonOnglet', testEquipesSourcesOrdreSelonOnglet],
  ['testEquipesSourcesEquipement', testEquipesSourcesEquipement],
  ['testEquipesSourcesImports', testEquipesSourcesImports],
  ['testEquipesSourcesDecksEnregistres', testEquipesSourcesDecksEnregistres],
];
