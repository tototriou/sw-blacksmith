// Précision minimale PAR SORT : le minimum de Précision de la grille, porté
// sur un ou plusieurs sorts (S1 à S3) plutôt que sur la stat. Un sort coché
// tient la condition quand la Précision de la fiche, telle que la jugent les
// conditions (auras RES/PRE comprises si elles comptent), plus la ligne
// « [Comp.N] Aug. Précision » de l'artéfact de type atteint le minimum.
// Spec : docs/02-app/optimizer/feat-precision-par-sort.md.
//
// ⚠️ **Deux étages, comme la contrainte de speed tune.** Les runes ne voient
// qu'un minimum de Précision RELÂCHÉ (`exigencePrecisionParSort`) : le
// minimum, moins le meilleur bonus qu'une seule pièce de type éligible
// apporte à TOUS les sorts cochés à la fois. Ce relâchement est sûr (jamais
// un build valide écarté) ; le couple exact se juge à la résolution, sur la
// vraie paire du build (`lignesPrecisionDuBuild`, lignes bornées).
import type { ArtifactDetail } from '../types';
import type { LigneBornee } from './artifactOptim';
import type { BuildRequirement } from './runeBuildOptim';

export type SortPrecision = 1 | 2 | 3;
export const SORTS_PRECISION: readonly SortPrecision[] = [1, 2, 3];

// Codes des lignes d'artéfact de type « [Comp.N] Aug. Précision » (artifacts.ts,
// `PROC`). Le jeu n'en connaît que pour les sorts 1 à 3.
export const CODE_PRECISION_SORT: Record<SortPrecision, number> = { 1: 407, 2: 408, 3: 409 };

// Tolérance des valeurs d'artéfact (celle des verrous, `EPSILON_VALEUR`).
const EPSILON = 1e-6;

export interface PrecisionParSort {
  sorts: SortPrecision[];
  // Le minimum saisi, sur la Précision du sort (fiche + ligne du sort).
  min: number;
}

// Les sorts cochés, ramenés à une liste triée sans doublon des seuls S1–S3.
export function normaliserSortsPrecision(sorts: readonly number[]): SortPrecision[] {
  return SORTS_PRECISION.filter((s) => sorts.includes(s));
}

// Les sorts que le monstre lance, parmi S1–S3 : une compétence active à cet
// emplacement. Un passif ne se lance pas, la ligne ne lui sert à rien.
// `null` (fiche absente ou en chargement) : les trois, rien n'est grisé à tort.
export function sortsPrecisionDisponibles(competences: readonly { slot: number | null; passif: boolean }[] | null): SortPrecision[] {
  if (!competences) return [...SORTS_PRECISION];
  return SORTS_PRECISION.filter((s) => competences.some((c) => c.slot === s && !c.passif));
}

// La valeur d'une ligne de précision de sort sur une pièce (0 sans la ligne).
function ligneSur(piece: ArtifactDetail | null, sort: SortPrecision): number {
  if (!piece) return 0;
  const code = CODE_PRECISION_SORT[sort];
  let total = 0;
  for (const sub of piece.subs) if (sub.code === code) total += sub.value;
  return total;
}

/**
 * Le meilleur bonus que l'une de ces pièces de type apporte À TOUS les sorts
 * cochés à la fois : max sur les pièces du min sur les sorts. Une pièce
 * n'est qu'un artéfact de type, et seuls ces artéfacts portent 407–409 : la
 * borne est exacte pour une pièce, plus serrée qu'un max par sort pris
 * séparément (qui supposerait deux pièces).
 *
 * `pieces` : les candidats de l'emplacement Type (`candidatsParSorte`, la vue
 * complète, réservations et principale imposée comprises), `null` compris.
 */
export function bonusPrecisionMax(sorts: readonly SortPrecision[], pieces: readonly (ArtifactDetail | null)[]): number {
  if (sorts.length === 0) return 0;
  let meilleur = 0;
  for (const p of pieces) {
    let v = Infinity;
    for (const s of sorts) v = Math.min(v, ligneSur(p, s));
    if (v > meilleur) meilleur = v;
  }
  return meilleur;
}

/**
 * Les conditions de la recherche de runes sous la précision par sort : le
 * minimum de Précision devient `min − bonusMax` (retiré s'il tombe à 0), et
 * la condition exacte voyage dans `precisionParSort` jusqu'à la résolution.
 *
 * Sans sort coché, ou sans minimum de Précision posé, l'exigence est rendue
 * TELLE QUELLE (même objet) : la recherche d'avant, champ pour champ.
 *
 * ⚠️ Le maximum de Précision reste une condition sur la stat, inchangé.
 */
export function exigencePrecisionParSort(
  requirement: BuildRequirement,
  sorts: readonly number[],
  piecesType: readonly (ArtifactDetail | null)[]
): BuildRequirement {
  const coches = normaliserSortsPrecision(sorts);
  const min = requirement.minStats.acc;
  if (coches.length === 0 || min == null || min <= 0) return requirement;
  const relache = min - bonusPrecisionMax(coches, piecesType);
  const minStats = { ...requirement.minStats };
  if (relache > 0) minStats.acc = relache;
  else delete minStats.acc;
  return { ...requirement, minStats, precisionParSort: { sorts: coches, min } };
}

// Les sorts réellement en jeu : cochés ET sous un minimum de Précision posé.
// Sans minimum, les pastilles cochées n'exigent rien.
export function sortsPrecisionActifs(sorts: readonly number[], minStats: { acc?: number }): SortPrecision[] {
  return (minStats.acc ?? 0) > 0 ? normaliserSortsPrecision(sorts) : [];
}

// Les codes à rendre incomparables pour la dominance des artéfacts : une
// pièce plus faible sur la note peut être la seule à tenir la ligne.
export function codesPrecisionParSort(sorts: readonly number[]): number[] {
  return normaliserSortsPrecision(sorts).map((s) => CODE_PRECISION_SORT[s]);
}

/**
 * Les lignes bornées que la paire d'UN build doit tenir : pour chaque sort
 * coché, la ligne du sort doit combler l'écart entre le minimum et la
 * Précision jugée du build (`preJugee`). Un sort déjà tenu par la fiche
 * n'exige rien. `memo` : un même ensemble d'exigences rend le même objet,
 * pour les mémoires de la file indexées par identité.
 */
export function lignesPrecisionDuBuild(
  p: PrecisionParSort,
  preJugee: number,
  memo?: Map<string, LigneBornee[]>
): LigneBornee[] {
  const besoin = p.min - preJugee;
  if (besoin <= EPSILON) return [];
  const cle = `pre:${p.sorts.join(',')}:${besoin}`;
  const connue = memo?.get(cle);
  if (connue) return connue;
  const out: LigneBornee[] = p.sorts.map((s) => ({ code: CODE_PRECISION_SORT[s], plages: [{ min: besoin, max: Infinity }] }));
  if (memo) {
    if (memo.size >= BORNE_MEMO_PRECISION) memo.clear();
    memo.set(cle, out);
  }
  return out;
}

export const BORNE_MEMO_PRECISION = 64;

// Le sort est-il tenu par ces stats et cette paire ? Pour l'affichage et les
// tests : la résolution passe par les lignes bornées.
export function precisionDuSort(preJugee: number, artefacts: readonly ArtifactDetail[], sort: SortPrecision): number {
  let bonus = 0;
  for (const a of artefacts) bonus += ligneSur(a, sort);
  return preJugee + bonus;
}
