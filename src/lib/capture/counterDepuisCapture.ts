// Un counter de recommandation tiré d'une capture de l'écran de préparation
// d'un combat de siège : les trois attaquants deviennent le deck, la défense
// d'en face sa défense visée. La lecture est celle du bot Discord
// (ecranPreparation.ts) ; docs/02-app/siege/feat-recommandations/interactions.md,
// « Ajouter un counter ».
//
// ⚠️ **La VIT lue est ignorée** : une recommandation décrit des minimums de
// stats à viser, pas les vitesses d'un compte.

import { emptyRecoCounter, emptyRecoDeck, emptyRecoSlot, type RecoCounter, type RecoDeck } from '../../types';
import type { LectureEcran, MonstreLu } from './ecranPreparation';
import { ECART_DOUTE, SCORE_PORTRAIT_MIN } from './portraits';

// Un monstre reconnu. `autre` : le second candidat, quand il est presque aussi
// probable (même règle que le bot) — le monstre est alors à vérifier.
export interface MonstreReconnu {
  com2usId: number;
  autre: number | null;
}

// `offense` : trois places, toutes reconnues à la lecture ; `null` là où on
// l'a vidée dans l'aperçu. `defense` : trois places, `null` là où le portrait
// n'est pas reconnu ou a été vidé ; vide quand la capture ne montre pas de
// défense (recadrée sur les attaquants).
export interface CounterLu {
  offense: (MonstreReconnu | null)[];
  defense: (MonstreReconnu | null)[];
}

// `connu` : le monstre est-il dans les données chargées (un portrait de la
// banque peut ne plus y être).
function reconnaitre(m: MonstreLu, connu: (com2usId: number) => boolean): MonstreReconnu | null {
  const p = m.portrait;
  if (!p || p.meilleur.score < SCORE_PORTRAIT_MIN || !connu(p.meilleur.com2usId)) return null;
  const suivant = p.suivants[0];
  const autre = suivant && p.meilleur.score - suivant.score < ECART_DOUTE && connu(suivant.com2usId) ? suivant.com2usId : null;
  return { com2usId: p.meilleur.com2usId, autre };
}

// `null` : l'écran n'est pas reconnu — pas trois attaquants, ou l'un d'eux
// n'est pas un monstre connu (la règle du bot : sans les monstres, rien).
export function counterDepuisLecture(lecture: LectureEcran | null, connu: (com2usId: number) => boolean): CounterLu | null {
  if (!lecture || lecture.attaquants.length !== 3) return null;
  const offense = lecture.attaquants.map((a) => reconnaitre(a, connu));
  if (offense.some((m) => m === null)) return null;
  const defense = lecture.defense.map((d) => reconnaitre(d, connu));
  return {
    offense,
    defense: defense.some((m) => m !== null) ? defense : [],
  };
}

// Les monstres d'une défense lue, au format d'une défense visée ; `null` sans
// aucun monstre (rien lu, ou toutes les places vidées dans l'aperçu).
export function defenseLue(lu: CounterLu, nom: (com2usId: number) => string): RecoCounter['monsters'] | null {
  if (!lu.defense.some((m) => m !== null)) return null;
  return [0, 1, 2].map((i) => {
    const m = lu.defense[i];
    return m ? { com2usId: m.com2usId, name: nom(m.com2usId) } : { com2usId: null, name: '' };
  });
}

// Le deck à ajouter : les attaquants dans l'ordre de la capture (leader en
// premier), et `defense` comme défense visée quand il y en a une.
export function deckDepuisCounterLu(
  lu: CounterLu,
  nom: (com2usId: number) => string,
  defense: RecoCounter['monsters'] | null,
): RecoDeck {
  return {
    ...emptyRecoDeck(),
    slots: lu.offense.map((m) => (m ? { ...emptyRecoSlot(), com2usId: m.com2usId, name: nom(m.com2usId) } : emptyRecoSlot())),
    counters: defense ? [{ ...emptyRecoCounter(), monsters: defense.map((m) => ({ ...m })) }] : [],
  };
}

// Une place corrigée à la main dans l'aperçu : le monstre choisi, sûr
// (`com2usId` nul : la place vidée, par sa croix). La défense non lue prend
// ses trois places à la première correction.
export function corrigerMonstre(lu: CounterLu, cote: 'offense' | 'defense', i: number, com2usId: number | null): CounterLu {
  const choisi: MonstreReconnu | null = com2usId === null ? null : { com2usId, autre: null };
  if (cote === 'offense') return { ...lu, offense: lu.offense.map((m, k) => (k === i ? choisi : m)) };
  const defense = lu.defense.length ? lu.defense : [null, null, null];
  return { ...lu, defense: defense.map((m, k) => (k === i ? choisi : m)) };
}

// Combien de monstres lus sont à vérifier.
export function aVerifier(lu: CounterLu): number {
  return [...lu.offense, ...lu.defense].filter((m) => m?.autre != null).length;
}
