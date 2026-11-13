// « Simuler +15 et max meules/gemmes » : un réglage de RECHERCHE de
// l'Optimizer. Activé, la recherche porte sur une copie de l'inventaire où
// chaque rune est poussée à ce qu'elle vaudrait une fois maxée :
//
// - **+15** : la principale d'une rune 6★ (antique comprise) prend sa valeur
//   à +15 (`MAINSTAT_MAX`), et son niveau passe à 15. Les substats ne
//   bougent pas : les améliorations à venir tombent au hasard, rien ne dit
//   lesquelles. Une rune de moins de 6★ n'est pas montée (aucune table de
//   principale par étoile dans l'app) ;
// - **meules et gemmes** : TOUTE ligne meulable (PV, ATQ, DEF, en plat ou en
//   %, et VIT), meulée ou non, gemmée comprise, prend la meule LÉGENDAIRE
//   maximale de sa stat ; une ligne déjà gemmée prend la base de gemme
//   légendaire maximale (tables antiques pour une rune antique). Aucune
//   gemme n'est posée sur une rune qui n'en a pas, et la stat d'une gemme
//   ne change jamais. Rien ne descend (`Math.max`).
//
// Les tables sont celles du potentiel de « Mon compte > Runes >
// Optimisation » (runeOptim.ts), jamais recopiées. La rune simulée garde son
// identifiant : réservation, verrous et exclusions la désignent comme la
// vraie. Elle porte `avantSimulation` (les valeurs réelles), lu par le détail
// de rune pour colorer ce qui a été simulé.
//
// Calcul pur, appliqué au pool AVANT le moteur : le moteur ne connaît que
// des runes, jamais ce réglage.

import type { RuneDetail } from '../types';
import { MAINSTAT_MAX } from './effects';
import { gemmeMaxLegendaire, meuleMaxLegendaire } from './runeOptim';

/** La rune telle qu'elle serait maxée ; la MÊME référence si rien ne change. */
export function runeMaxee(rune: RuneDetail): RuneDetail {
  const antique = rune.rank > 10;
  const sixEtoiles = rune.rank % 10 === 6;
  const principaleMax = sixEtoiles ? MAINSTAT_MAX[rune.main.code] : undefined;
  const principale = principaleMax != null ? Math.max(rune.main.value, principaleMax) : rune.main.value;
  const niveau = sixEtoiles ? Math.max(rune.level, 15) : rune.level;
  let change = principale !== rune.main.value || niveau !== rune.level;
  const subs = rune.subs.map((s) => {
    const meule = s.grind ?? 0;
    let base = s.value - meule;
    let meuleMaxee = meule;
    if (s.enchant) base = Math.max(base, gemmeMaxLegendaire(s.code, antique) ?? base);
    meuleMaxee = Math.max(meule, meuleMaxLegendaire(s.code, antique) ?? meule);
    if (base + meuleMaxee === s.value && meuleMaxee === meule) return s;
    change = true;
    return { ...s, value: base + meuleMaxee, grind: meuleMaxee };
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
      subs: rune.subs.map((s) => ({ value: s.value, grind: s.grind ?? 0 })),
    },
  };
}

/**
 * Le pool de la recherche : le seul producteur, appelé par l'écran
 * (`handleSearch` et ce qui se calcule avant lui) et par le CLI
 * (`resolvePool`). Désactivé, le pool reçu tel quel (même référence).
 */
export function poolDeRecherche(pool: RuneDetail[], simulerRunesMaxees: boolean): RuneDetail[] {
  return simulerRunesMaxees ? pool.map(runeMaxee) : pool;
}
