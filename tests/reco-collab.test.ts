// Recommandations — une collaboration et sa version SW sont le même monstre.
//
// Satoru Gojo, c'est Werner : un deck qui demande l'un se joue avec l'autre,
// se retrouve en cherchant l'autre, et ne fait qu'une équipe avec l'autre. Le
// lien vient des données (`jumeauCollab`) ; ces vérifications figent son usage
// dans la confrontation, la recherche, l'identité d'une équipe et l'envoi d'un
// deck à l'Optimizer.

import { emptyRecoSlot, type Monster, type Reco, type RecoCounter, type RecoDeck } from '../src/types';
import { importerRecoOptimizer } from '../src/lib/importRecoOptimizer';
import { idCanoniqueCollab } from '../src/lib/monsterForms';
import type { ExclusionSourceData } from '../src/lib/optimizerExclusion';
import { collectOwnedBuilds, collectOwnedTeams, countCopiesByCom2us } from '../src/lib/ownedBuilds';
import { cleEquipe, vueDefenses, type MonstresConnus } from '../src/lib/recoDefenses';
import { fusionnerReco } from '../src/lib/recoFusion';
import { contexteConfrontationReco, deckCopies, matchDeck } from '../src/lib/recoMatch';
import { chercheMonstre } from '../src/lib/recoSearch';
import { fr } from '../src/i18n/fr';
import { monstreComposition, recommandationComposition, sourcesComposition } from './import-composition-fixtures';
import { egal, monstersJson, ok, titre } from './outils';

// Le monstre fictif 1 (`com2usId` 1001, possédé en box, en RTA et dans
// l'offense 1) reçoit un jumeau de collaboration 9 (`com2usId` 1009), que le
// joueur ne possède pas.
function sourcesAvecJumeau(): ExclusionSourceData {
  const data = sourcesComposition();
  const jumeler = (m: Monster) => {
    if (m.com2usId === 1001) m.jumeauCollab = 1009;
  };
  data.box.forEach((b) => jumeler(b.monster));
  data.monsterById.forEach(jumeler);
  data.monsterById.set('9', { ...monstreComposition(9), name: 'Collab 9', jumeauCollab: 1001 });
  return data;
}

function confrontation(deck: RecoDeck, data: ExclusionSourceData) {
  const args = { box: data.box, rta: Object.values(data.rtaEntries), defense: data.siegeDefenseTeams,
    offense: data.siegeOffenseTeams, monsterById: data.monsterById };
  return matchDeck(deck, contexteConfrontationReco(collectOwnedBuilds(args), collectOwnedTeams(args), countCopiesByCom2us(data.box)));
}

// La paire réelle de l'exemple, prise dans public/data/monsters.json.
const MONSTRES = monstersJson() as Monster[];
const GOJO = MONSTRES.find((m) => m.name === 'Satoru Gojo' && m.jumeauCollab != null)!;
const WERNER = MONSTRES.find((m) => m.com2usId === GOJO.jumeauCollab)!;
const CONNUS: MonstresConnus = new Map(MONSTRES.filter((m) => m.com2usId != null).map((m) => [m.com2usId!, m]));
const PAR_ID = new Map(MONSTRES.filter((m) => m.com2usId != null).map((m) => [m.com2usId!, m]));

export function testRecoCollabIdentifiant() {
  titre('Recommandations · collaboration : un identifiant pour la paire');
  egal(WERNER.name, 'Werner', 'données : le jumeau de Satoru Gojo est Werner');
  egal(WERNER.jumeauCollab, GOJO.com2usId, 'données : le lien va dans les deux sens');
  egal(idCanoniqueCollab(GOJO.com2usId!, GOJO.jumeauCollab), idCanoniqueCollab(WERNER.com2usId!, WERNER.jumeauCollab),
    'Gojo et Werner ont le même identifiant');
  egal(idCanoniqueCollab(1001, null), 1001, 'sans jumeau : le monstre garde le sien');
}

export function testRecoCollabConfrontation() {
  titre('Recommandations · collaboration : le deck se joue avec le jumeau possédé');
  const data = sourcesAvecJumeau();
  // L'offense 1 réunit 3, 1 et 2 ; le deck demande le jumeau 9 à la place de 1.
  const deck = recommandationComposition([9, 2, 3]);
  const match = confrontation(deck, data);
  ok(match.status !== 'missing', 'le jumeau possédé n’est pas un monstre indisponible');
  egal(match.team, 'Offense 1', 'l’offense qui réunit le jumeau est retenue');
  egal(match.slots[0].owned?.monster.com2usId, 1001, 'le build retenu est celui du monstre possédé');
  egal(match.copies, 1, 'un exemplaire en box : montable une fois');

  // Sans le lien, le même deck reste impossible : c'est bien lui qui joue.
  const sansLien = sourcesComposition();
  egal(confrontation(deck, sansLien).status, 'missing', 'sans jumeau déclaré : monstre indisponible');

  // Les exemplaires des deux faces s'additionnent.
  const deux = sourcesAvecJumeau();
  deux.box.push({ key: 'box-9', monster: deux.monsterById.get('9')!, stars: 6, level: 40, gear: deux.box[0].gear });
  egal(confrontation(recommandationComposition([1, 9, 2]), deux).copies, 1, 'Gojo et Werner dans le même deck : deux exemplaires pour un deck');
  egal(confrontation(recommandationComposition([1, null, null]), deux).copies, 2, 'un Werner et un Gojo : deux exemplaires du même monstre');
  egal(deckCopies(recommandationComposition([9, 2, 3]), new Map([[1001, 1], [1002, 1], [1003, 1]]), new Map([[1009, 1001]])), 1,
    'deckCopies range le slot sous l’identifiant commun');
}

export function testRecoCollabRecherche() {
  titre('Recommandations · collaboration : chercher l’une trouve l’autre');
  const slot = (m: Monster) => ({ com2usId: m.com2usId, name: m.name });
  const deck: RecoDeck = { name: '', note: '', slots: [{ ...emptyRecoSlot(), ...slot(GOJO) }],
    counters: [{ monsters: [slot(WERNER)], note: '' }] };
  const reco: Reco = { id: 'r', origin: 'mine', name: '', author: '', note: '', decks: [deck] };
  egal(chercheMonstre([reco], 'werner', 'offense', PAR_ID)?.[0]?.decks[0]?.slots, [0], 'chercher Werner trouve le deck qui joue Gojo');
  egal(chercheMonstre([reco], 'gojo', 'defense', PAR_ID)?.[0]?.decks[0]?.counters, [0], 'chercher Gojo trouve la défense qui porte Werner');
  egal(chercheMonstre([reco], 'chloe', 'all', PAR_ID), [], 'un autre nom ne trouve rien');
}

export function testRecoCollabEquipe() {
  titre('Recommandations · collaboration : la même équipe sous ses deux habillages');
  const autres = MONSTRES.filter((m) => m.com2usId != null && m.jumeauCollab == null && m.name !== '').slice(0, 2)
    .map((m) => ({ com2usId: m.com2usId, name: m.name }));
  const avec = (m: Monster) => [{ com2usId: m.com2usId, name: m.name }, ...autres];
  egal(cleEquipe(avec(GOJO), CONNUS), cleEquipe(avec(WERNER), CONNUS), 'Gojo ou Werner : même clé d’équipe');

  const def = (m: Monster): RecoCounter => ({ monsters: avec(m), note: '' });
  const deckAvec = (m: Monster, counters: RecoCounter[]): RecoDeck =>
    ({ name: '', note: '', counters, slots: avec(m).map((x) => ({ ...emptyRecoSlot(), ...x })) });
  const reco: Reco = { id: 'r', origin: 'mine', name: '', author: '', note: '', decks: [deckAvec(GOJO, [def(GOJO)]), deckAvec(WERNER, [def(WERNER)])] };
  egal(vueDefenses(reco, CONNUS).defenses.length, 1, 'vue Défense : une seule défense visée');

  const { reco: fusionnee, bilan } = fusionnerReco({ ...reco, decks: [deckAvec(GOJO, [])] },
    { name: '', author: '', note: '', decks: [deckAvec(WERNER, [def(WERNER)])] }, CONNUS);
  egal(fusionnee.decks.length, 1, 'fusion : le deck noté Werner complète celui noté Gojo');
  egal(bilan.defensesAjoutees, 1, 'fusion : il lui apporte sa défense');
}

export function testRecoCollabOptimizer() {
  titre('Recommandations · collaboration : l’envoi à l’Optimizer prend le jumeau possédé');
  const data = sourcesAvecJumeau();
  const p = importerRecoOptimizer(recommandationComposition([9, 2, 3]), data, fr);
  egal(p.membres.length, 3, 'les trois membres importés');
  egal(p.membres[0].com2usId, 1001, 'le membre est le monstre possédé');
  egal(p.membres[0].selector, { source: 'siege-offense', teamId: 'o1', slotIndex: 1 }, 'pris dans l’offense retenue par la confrontation');
  egal(p.ignores.length, 0, 'aucun monstre ignoré');

  // Hors de l'équipe retenue, le repli cherche aussi le jumeau.
  data.siegeOffenseTeams = [];
  const q = importerRecoOptimizer(recommandationComposition([9, 2, 3]), data, fr);
  egal(q.membres[0].com2usId, 1001, 'repli : un exemplaire du jumeau, pas le monstre non possédé');
}

export const verificationsRecoCollab: [string, () => void][] = [
  testRecoCollabIdentifiant, testRecoCollabConfrontation, testRecoCollabRecherche, testRecoCollabEquipe, testRecoCollabOptimizer,
].map((test) => [test.name, test]);
