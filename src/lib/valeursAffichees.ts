// Ce qu'une carte de résultat de l'Optimizer ÉCRIT d'une valeur, en nombre :
// la même expression sert l'affichage (carte, quasi-succès, mesure d'une
// rune) et les bornes des colonnes de résultats (filtresResultats.ts), pour
// qu'une carte qui affiche « 78.8% » passe une borne ≥ 78.8. Une seconde
// écriture de l'arrondi divergerait au premier changement de présentation.

import type { OptimMetric } from './runeOptim';
import { CAPPED_STATS, type StatKey } from './effects';
import { COLONNES_RESULTATS, type ColonneResultat } from './colonnesResultats';

/**
 * Le total qu'un panneau de stats écrit en mode « total » : borné à 100 %
 * pour Taux Crit, RES et Précision quand le dépassement est masqué (réglage
 * d'application, `useOvercapDisplay`), inchangé sinon. Un réglage
 * d'affichage : `computeStats` et les conditions gardent le total brut.
 */
export function displayedTotal(key: StatKey, total: number, showOvercap: boolean): number {
  if (!showOvercap && CAPPED_STATS.has(key)) return Math.min(total, 100);
  return total;
}

/** La mesure moyenne par rune d'un build : la mesure de ses six runes, divisée par six. */
export function moyenneParRune(total: number): number {
  return total / 6;
}

/**
 * Les chiffres qu'écrit l'écran d'une mesure de rune, sans son unité :
 * une décimale en efficience (« 140.2 »), un entier en score SW (la formule
 * du jeu arrondit).
 */
export function chiffresMesureRune(valeur: number, metric: OptimMetric): string {
  return metric === 'eff' ? valeur.toFixed(1) : String(Math.round(valeur));
}

/** L'entier qu'une carte écrit des PV effectifs et des dégâts réels, avant les séparateurs de milliers. */
export function entierAffiche(valeur: number): number {
  return Math.round(valeur);
}

/** Ce que la fiche affichée (« Exemplaire ») apporte aux colonnes des résultats. */
export interface MesuresDeLaFiche {
  // Les stats de la fiche (`computeStats`), en total.
  stats: readonly { key: StatKey; total: number }[];
  // La mesure de ses runes dans la mesure DES CARTES, ou `null` quand elle n'y est pas.
  mesureTotale: number | null;
  // La fiche notée comme un candidat (`scoreDeReference`), ou `null` sans valeur.
  pvEffectifs: number | null;
  degatsReels: number | null;
}

/**
 * Les onze valeurs de la fiche affichée, en total, prises comme celles d'un
 * build (même borne à 100 %, même moyenne par rune) : la ligne
 * de la fiche du tableau des résultats se lit contre les lignes qu'elle
 * surplombe. Les valeurs viennent des producteurs de « Comparer » : la ligne
 * et l'écart d'une carte disent le même chiffre.
 */
export function valeursDeLaFiche(fiche: MesuresDeLaFiche, showOvercap: boolean): Record<ColonneResultat, number | null> {
  const valeur = (c: ColonneResultat): number | null => {
    if (c === 'efficience') return fiche.mesureTotale === null ? null : moyenneParRune(fiche.mesureTotale);
    if (c === 'ehp') return fiche.pvEffectifs;
    if (c === 'degats_reels') return fiche.degatsReels;
    const ligne = fiche.stats.find((s) => s.key === c);
    return ligne ? displayedTotal(c, ligne.total, showOvercap) : null;
  };
  return Object.fromEntries(COLONNES_RESULTATS.map((c) => [c, valeur(c)])) as Record<ColonneResultat, number | null>;
}
