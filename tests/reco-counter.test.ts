// Recommandations — ajouter un counter depuis une équipe de « Mes équipes »
// (src/lib/recoFromSiege.ts) ; et la vue Défenses de toutes les
// recommandations, qui les accueille (src/lib/recoDefenses.ts). Depuis une
// capture : capture-counter.test.ts.

import { deckFromEquipeEnregistree, equipeProposable } from '../src/lib/recoFromSiege';
import { cleOffense, defensesDesRecos, ordonnerOffenses, type MonstresConnus, type OffenseDesRecos } from '../src/lib/recoDefenses';
import type { EquipeEnregistree } from '../src/lib/equipesEnregistrees';
import { emptyRecoSlot, type Reco, type RecoCounter, type RecoDeck } from '../src/types';
import { gearComposition, monstreComposition } from './import-composition-fixtures';
import { egal, ok, titre } from './outils';

export function testRecoCounterEquipe() {
  titre('Recommandations — un counter tiré d\'une équipe de « Mes équipes »');
  const mons = [1, 2, 3, 4].map(monstreComposition);
  const parCom2us = new Map(mons.map((m) => [m.com2usId!, m]));
  const m = (i: number, uid: string) => ({ uid, com2usId: 1000 + i, unitId: null, provenance: 'porte' as const, equipement: gearComposition(i) });
  const date = '2026-01-01T00:00:00.000Z';
  const equipe: EquipeEnregistree = { id: 'e', onglet: 'arene/offense', nom: 'Arène', note: '', monstres: [m(1, 'a'), m(2, 'b'), m(3, 'c'), m(4, 'd')], leader: 'c', creeLe: date, modifieLe: date };

  const deck = deckFromEquipeEnregistree(equipe, parCom2us);
  egal(deck.slots.map((s) => s.name), ['Monstre 3', 'Monstre 1', 'Monstre 2'], 'le leader en tête, puis l\'ordre de l\'équipe, trois au plus');
  egal(deck.slots.map((s) => s.stats.spd), [104, 102, 103], 'les stats du build reprises comme minimums');
  egal(deck.counters, [], 'aucune défense visée');
  egal(deckFromEquipeEnregistree({ ...equipe, leader: null, monstres: [m(2, 'b')] }, parCom2us).slots.map((s) => s.com2usId), [1002, null, null],
    'sans leader, un seul monstre : les places manquantes restent vides');
  egal(deckFromEquipeEnregistree({ ...equipe, leader: null, monstres: [m(9, 'z'), m(1, 'a')] }, parCom2us).slots.map((s) => s.com2usId), [null, 1001, null],
    'un monstre absent des données : sa place reste vide');

  ok(equipeProposable(equipe, parCom2us), 'une équipe d\'arène est proposée');
  ok(!equipeProposable({ ...equipe, onglet: 'rta' }, parCom2us), 'une prépa RTA ne l\'est pas');
  ok(!equipeProposable({ ...equipe, monstres: [m(9, 'z')] }, parCom2us), 'aucun monstre connu : pas proposée');
}

// La vue Défenses de toutes les recommandations.
const mo = (id: number) => ({ com2usId: id, name: `M${id}` });
const contre = (ids: number[], fiabilite?: number): RecoCounter => ({ monsters: ids.map(mo), note: '', ...(fiabilite !== undefined ? { fiabilite } : {}) });
const deckDe = (counters: RecoCounter[], id: number): RecoDeck => ({ name: '', note: '', slots: [{ ...emptyRecoSlot(), com2usId: id, name: `D${id}` }, emptyRecoSlot(), emptyRecoSlot()], counters });
const recoDe = (id: string, decks: RecoDeck[]): Reco => ({ id, origin: 'mine', name: id, author: '', note: '', decks });
const aucunLead: MonstresConnus = new Map();

export function testRecoDefensesDesRecos() {
  titre('Recommandations — les défenses visées, toutes recommandations confondues');
  const a = recoDe('a', [deckDe([contre([1, 2, 3], 3)], 10), deckDe([], 11)]);
  // ⚠️ Aucun lead connu : le premier monstre compte comme chef, l'ordre des
  // trois est donc celui de la défense (voir `cleEquipe`).
  const b = recoDe('b', [deckDe([contre([1, 2, 3]), contre([4, 5, 6], 5)], 20), deckDe([contre([1, 2, 3], 1)], 21)]);
  const v = defensesDesRecos([a, b], aucunLead);
  egal(v.defenses.map((d) => [d.monsters.map((x) => x.com2usId), d.offenses.length, d.recos]), [[[1, 2, 3], 3, 2], [[4, 5, 6], 1, 1]],
    'une défense UNE fois, toutes recommandations confondues, les plus jouées d\'abord');
  egal(defensesDesRecos([recoDe('c', [deckDe([contre([3, 2, 1])], 30)]), a], aucunLead).defenses.length, 2,
    'sans lead connu, un autre chef fait une autre défense');
  egal(v.defenses[0].offenses.map(cleOffense), ['a:0', 'b:0', 'b:1'], 'ses offenses : dans l\'ordre des recommandations, puis de leurs decks');
  egal(v.defenses[0].meilleure, 3, 'la meilleure fiabilité de ses offenses');
  egal(v.sansDefense, [{ recoId: 'a', deckIndex: 1 }], 'un deck sans défense visée reste atteignable');
  egal(defensesDesRecos([a, b], aucunLead, (reco) => reco.id === 'b').defenses[0].offenses.map(cleOffense), ['b:0', 'b:1'], 'filtre d\'une recherche');

  // L'ordre du volet : par reco, ou par fiabilité ; un ordre pris est TENU.
  const offenses: OffenseDesRecos[] = v.defenses[0].offenses;
  egal(ordonnerOffenses(offenses, 'fiabilite').map(cleOffense), ['a:0', 'b:1', 'b:0'], 'par fiabilité : 3, 1, non notée');
  const fige = ['b:1', 'a:0'];
  egal(ordonnerOffenses(offenses, 'fiabilite', fige).map(cleOffense), ['b:1', 'a:0', 'b:0'], 'ordre tenu : ce qui est nouveau vient après');
}
