// La simulation des runes maxées : trois réglages de RECHERCHE de
// l'Optimizer, chacun sa ligne dans « Options ». Activés, la recherche porte
// sur une copie de l'inventaire où chaque rune est poussée à ce qu'elle
// vaudrait une fois maxée :
//
// - **« Simuler +15 »** (`plus15`) : la principale d'une rune 6★ (antique
//   comprise) prend sa valeur à +15 (`MAINSTAT_MAX`), et son niveau passe à
//   15. Les substats ne bougent pas : les améliorations à venir tombent au
//   hasard, rien ne dit lesquelles. Une rune de moins de 6★ n'est pas montée
//   (aucune table de principale par étoile dans l'app) ;
// - **« Simuler max meules/gemmes »** (`meules`, runes NORMALES seulement) et
//   **« … antiques »** (`meulesAntiques`, runes antiques seulement), chacun
//   avec son grade, héroïque ou légendaire : TOUTE ligne meulable (PV, ATQ,
//   DEF, en plat ou en %, et VIT), meulée ou non, gemmée comprise, prend la
//   meule maximale de sa stat à ce grade ; une ligne déjà gemmée prend la
//   base de gemme maximale à ce grade (tables antiques pour une rune
//   antique). Aucune gemme n'est posée sur une rune qui n'en a pas, et la
//   stat d'une gemme ne change jamais. ⚠️ **Rien ne descend** (`Math.max`) :
//   en héroïque, une meule ou une gemme légendaire déjà posée reste telle
//   quelle.
//
// Les tables sont celles du potentiel de « Mon compte > Runes >
// Optimisation » (runeOptim.ts), jamais recopiées. La rune simulée garde son
// identifiant : réservation, verrous et exclusions la désignent comme la
// vraie. Elle porte `avantSimulation` (les valeurs réelles), lu par le détail
// de rune pour colorer ce qui a été simulé.
//
// Calcul pur, appliqué au pool AVANT le moteur : le moteur ne connaît que
// des runes, jamais ces réglages.

import type { RuneDetail } from '../types';
import { MAINSTAT_MAX } from './effects';
import { gemmeMax, meuleMax } from './runeOptim';

export type GradeMeules = 'hero' | 'legend';

/** Une ligne « Simuler max meules/gemmes » : son interrupteur et son grade. */
export interface SimulationMeules {
  actif: boolean;
  // Gardé même interrupteur éteint : le choix se prépare avant d'activer.
  grade: GradeMeules;
}

/** Les trois réglages de simulation, tels que l'écran et la recette les portent. */
export interface SimulationRunes {
  plus15: boolean;
  meules: SimulationMeules;
  meulesAntiques: SimulationMeules;
}

/** Le défaut : rien de simulé, grade légendaire préparé. */
export const SIMULATION_RUNES_AUCUNE: SimulationRunes = {
  plus15: false,
  meules: { actif: false, grade: 'legend' },
  meulesAntiques: { actif: false, grade: 'legend' },
};

/**
 * L'ancien interrupteur unique « Simuler +15 et max meules/gemmes »
 * (`simulerRunesMaxees`) traduit vers les trois lignes : activé, il valait
 * +15 et meules/gemmes légendaires sur toutes les runes, antiques comprises.
 */
export function simulationDepuisAncienReglage(simulerRunesMaxees: boolean): SimulationRunes {
  if (!simulerRunesMaxees) return SIMULATION_RUNES_AUCUNE;
  return {
    plus15: true,
    meules: { actif: true, grade: 'legend' },
    meulesAntiques: { actif: true, grade: 'legend' },
  };
}

/** Au moins une des trois lignes change le pool. */
export function simulationActive(s: SimulationRunes): boolean {
  return s.plus15 || s.meules.actif || s.meulesAntiques.actif;
}

/**
 * L'empreinte de ce que la simulation change, pour la signature du cache de
 * la file d'artéfacts (`signatureArtefacts`) : `null` quand rien n'est simulé.
 * Le grade d'une ligne éteinte n'y entre pas : il ne change aucune rune.
 */
export function empreinteSimulation(s: SimulationRunes): string | null {
  if (!simulationActive(s)) return null;
  return [
    s.plus15 ? 'p15' : '',
    s.meules.actif ? `n:${s.meules.grade}` : '',
    s.meulesAntiques.actif ? `a:${s.meulesAntiques.grade}` : '',
  ].join(',');
}

/** La rune telle qu'elle serait maxée ; la MÊME référence si rien ne change. */
export function runeMaxee(rune: RuneDetail, s: SimulationRunes): RuneDetail {
  const antique = rune.rank > 10;
  const sixEtoiles = rune.rank % 10 === 6;
  const principaleMax = s.plus15 && sixEtoiles ? MAINSTAT_MAX[rune.main.code] : undefined;
  const principale = principaleMax != null ? Math.max(rune.main.value, principaleMax) : rune.main.value;
  const niveau = s.plus15 && sixEtoiles ? Math.max(rune.level, 15) : rune.level;
  let change = principale !== rune.main.value || niveau !== rune.level;
  const ligne = antique ? s.meulesAntiques : s.meules;
  const subs = !ligne.actif ? rune.subs : rune.subs.map((sub) => {
    const meule = sub.grind ?? 0;
    let base = sub.value - meule;
    if (sub.enchant) base = Math.max(base, gemmeMax(sub.code, antique, ligne.grade) ?? base);
    const meuleMaxee = Math.max(meule, meuleMax(sub.code, antique, ligne.grade) ?? meule);
    if (base + meuleMaxee === sub.value && meuleMaxee === meule) return sub;
    change = true;
    return { ...sub, value: base + meuleMaxee, grind: meuleMaxee };
  });
  if (!change) return rune;
  return {
    ...rune,
    level: niveau,
    main: { ...rune.main, value: principale },
    subs,
    avantSimulation: {
      level: rune.level,
      main: rune.main.value,
      subs: rune.subs.map((sub) => ({ value: sub.value, grind: sub.grind ?? 0 })),
    },
  };
}

/**
 * Le pool de la recherche : le seul producteur, appelé par l'écran
 * (`handleSearch` et ce qui se calcule avant lui) et par le CLI
 * (`resolvePool`). Rien d'activé : le pool reçu tel quel (même référence).
 */
export function poolDeRecherche(pool: RuneDetail[], s: SimulationRunes): RuneDetail[] {
  return simulationActive(s) ? pool.map((r) => runeMaxee(r, s)) : pool;
}

/** Une valeur lue d'un fichier (session) a-t-elle la forme de `SimulationRunes` ? */
export function estSimulationRunes(v: unknown): v is SimulationRunes {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  const ligne = (l: unknown) => {
    if (typeof l !== 'object' || l === null) return false;
    const o = l as Record<string, unknown>;
    return typeof o.actif === 'boolean' && (o.grade === 'hero' || o.grade === 'legend');
  };
  return typeof s.plus15 === 'boolean' && ligne(s.meules) && ligne(s.meulesAntiques);
}
