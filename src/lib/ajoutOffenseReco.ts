// Une offense venue d'ailleurs, ajoutée à une recommandation en un geste :
//  - un combat gagné des statistiques de siège — les trois monstres de
//    l'attaque deviennent un deck, les trois de la défense battue sa défense
//    visée (docs/02-app/siege/statistiques.md, « Ajouter une offense à une
//    recommandation ») ;
//  - une équipe de Mes équipes — un deck pré-rempli de ses stats, sets et
//    artéfacts (`deckFromEquipeEnregistree`), sans défense visée
//    (docs/02-app/compte/feat-equipes.md, « Ajouter à une recommandation »).
// Calcul pur.
//
// ⚠️ **SUPPOSÉ : le premier monstre d'une équipe du journal est son leader.**
// Le deck garde l'ordre du combat (`view_battle_deck_info`), et le slot 0 d'un
// deck porte le lead — mais rien dans les données relevées n'établit quelle
// place du journal porte le leader (statistiques.md). La fenêtre d'ajout le
// dit. Si l'hypothèse est fausse, une offense déjà recommandée avec un autre
// chef ne se reconnaît pas (`cleEquipe`) : elle fait un deck de plus, sans
// rien perdre. (Une équipe de Mes équipes, elle, connaît son leader.)
//
// ⚠️ **Pas de doublon.** Une offense déjà dans la recommandation (même équipe,
// au sens de `cleEquipe`) n'y fait pas un second deck : la défense s'ajoute à
// ses défenses visées ; si elle y est déjà — ou s'il n'y a pas de défense à
// ajouter —, rien ne change.

import { emptyRecoDeck, emptyRecoSlot, type Reco, type RecoCounter, type RecoDeck } from '../types';
import { cleEquipe, type MonstresConnus } from './recoDefenses';
import type { AttaqueSiege } from './siegeStatistiques';

// Trois monstres, au format d'une défense visée.
export type TrioReco = RecoCounter['monsters'];

// Ce qu'on ajoute : l'offense (ses trois monstres, leader en tête), la défense
// qu'elle bat s'il y en a une, et le deck déjà constitué s'il y en a un (une
// équipe : ses stats, sets et artéfacts). Sans `deck`, les monstres seuls.
export interface OffenseAAjouter {
  offense: TrioReco;
  defense: TrioReco | null;
  deck?: RecoDeck;
}

// Pourquoi un combat ne s'ajoute pas : seule une VICTOIRE dit que l'offense
// bat la défense, et un deck se compose de monstres connus des données.
export type RaisonCombatNonAjoutable = 'defaite' | 'resultatInconnu' | 'monstresInconnus';

export function raisonNonAjoutable(x: AttaqueSiege, connu: (com2usId: number) => boolean): RaisonCombatNonAjoutable | null {
  if (x.victoire === false) return 'defaite';
  if (x.victoire !== true) return 'resultatInconnu';
  const m = x.monstres;
  if (!m || m.attaque.length !== 3 || m.defense.length !== 3 || ![...m.attaque, ...m.defense].every(connu)) return 'monstresInconnus';
  return null;
}

// Les trois monstres d'une équipe du journal, dans son ordre.
export const trioDe = (ids: readonly number[], nom: (com2usId: number) => string): TrioReco =>
  ids.map((com2usId) => ({ com2usId, name: nom(com2usId) }));

// Une équipe de Mes équipes, en offense à ajouter : son deck pré-rempli.
export const offenseDuDeck = (deck: RecoDeck): OffenseAAjouter => ({
  offense: deck.slots.map((s) => ({ com2usId: s.com2usId, name: s.name })),
  defense: null,
  deck,
});

// Ce que l'ajout fera dans une recommandation.
export type PlaceOffense =
  | { type: 'nouveauDeck' }
  | { type: 'nouvelleDefense'; deckIndex: number }
  | { type: 'dejaDedans'; deckIndex: number };

export function placeDeLOffense(reco: Reco, ajout: OffenseAAjouter, connus: MonstresConnus): PlaceOffense {
  const cleOffense = cleEquipe(ajout.offense, connus);
  const decks = reco.decks.flatMap((d, i) => (cleEquipe(d.slots, connus) === cleOffense ? [i] : []));
  if (!decks.length) return { type: 'nouveauDeck' };
  // Sans défense à ajouter : l'offense est déjà là, c'est tout.
  if (!ajout.defense) return { type: 'dejaDedans', deckIndex: decks[0] };
  // Deux decks de la même offense (des runages différents) : la défense est
  // déjà là si l'un d'eux la vise.
  const cleDefense = cleEquipe(ajout.defense, connus);
  const visant = decks.find((i) => reco.decks[i].counters.some((c) => cleEquipe(c.monsters, connus) === cleDefense));
  if (visant !== undefined) return { type: 'dejaDedans', deckIndex: visant };
  return { type: 'nouvelleDefense', deckIndex: decks[0] };
}

// Le deck vide d'une recommandation neuve (celui que pose `newReco`).
const deckVide = (d: RecoDeck) => !d.note && d.counters.length === 0 && d.slots.every((s) => s.com2usId == null && !s.name);

export function recoAvecOffense(reco: Reco, ajout: OffenseAAjouter, connus: MonstresConnus): Reco {
  const place = placeDeLOffense(reco, ajout, connus);
  if (place.type === 'dejaDedans') return reco;
  // Non notée : la fiabilité est un jugement de l'auteur, pas un taux de
  // victoire.
  const counter: RecoCounter | null = ajout.defense ? { monsters: ajout.defense.map((m) => ({ ...m })), note: '' } : null;
  if (place.type === 'nouvelleDefense') {
    return { ...reco, decks: reco.decks.map((d, i) => (i === place.deckIndex && counter ? { ...d, counters: [...d.counters, counter] } : d)) };
  }
  const base: RecoDeck = ajout.deck
    ? structuredClone(ajout.deck)
    : { ...emptyRecoDeck(), slots: ajout.offense.map((m) => ({ ...emptyRecoSlot(), com2usId: m.com2usId, name: m.name })) };
  const deck: RecoDeck = { ...base, counters: counter ? [...base.counters, counter] : base.counters };
  // Une recommandation neuve n'a qu'un deck vide : le nouveau prend sa place.
  const garder = reco.decks.length === 1 && deckVide(reco.decks[0]) ? [] : reco.decks;
  return { ...reco, decks: [...garder, deck] };
}
