// Les trois distributions de l'onglet Courbes (Mon compte → Runes) : valeur
// actuelle, potentiel héroïque, potentiel légendaire, chacune triée par valeur
// décroissante.
//
// ⚠️ Chaque distribution est triée SÉPARÉMENT : le rang N d'« Actuelle » et
// celui de « Potentiel Légend » ne désignent pas la même rune. Chacune
// transporte donc SA rune à côté de sa valeur (`runes[i]` vaut `effs[i]`) —
// c'est ce qui permet d'ouvrir, au clic sur un rang, la rune de chaque courbe.
//
// `runeARune` : l'autre lecture. Les potentiels suivent le classement
// d'« Actuelle » — au rang N, les trois courbes parlent de la MÊME rune, sa
// valeur d'aujourd'hui et ses deux potentiels. Les potentiels n'y sont donc
// plus triés : ils montrent, rune par rune, ce qu'il reste à gagner.
//
// ⚠️ Les potentiels des Courbes ne SIMULENT AUCUNE GEMME sur une rune qui n'en
// porte pas, et ne changent jamais la stat d'une gemme posée : seule une gemme
// déjà là peut être relancée vers son maximum (`gemmeExistanteSeule`,
// `regemLibre` éteint). Créditée de la meilleure gemme au jet maximal, chaque
// rune vierge passait devant des runes finies et la courbe héroïque devenait
// inatteignable. L'onglet Optimisation, lui, garde la gemme optimale : il
// répond à « que poser sur cette rune ? ».

import type { RuneDetail } from '../types';
import { runePotential, type OptimMetric, type RunePotential } from './runeOptim';

export interface Distribution {
  effs: number[];
  runes: RuneDetail[];
}

export interface DistributionsCourbes {
  cur: Distribution;
  hero: Distribution;
  legend: Distribution;
  // Valeur actuelle et potentiels de CHAQUE rune, pour la fiche ouverte au
  // clic : quelle que soit la courbe qui l'a désignée, on y lit les trois.
  potentiels: Map<RuneDetail, RunePotential>;
}

export function distributionsCourbes(
  runes: RuneDetail[],
  withGem: boolean,
  metric: OptimMetric,
  runeARune = false
): DistributionsCourbes {
  const pots = runes.map((r) => ({ rune: r, p: runePotential(r, withGem, metric, false, false, true) }));
  const parActuelle = [...pots].sort((a, b) => b.p.eff - a.p.eff);
  const classe = (val: (p: RunePotential) => number): Distribution => {
    const tri = runeARune ? parActuelle : [...pots].sort((a, b) => val(b.p) - val(a.p));
    return { effs: tri.map((t) => val(t.p)), runes: tri.map((t) => t.rune) };
  };
  return {
    cur: classe((p) => p.eff),
    hero: classe((p) => p.heroEff),
    legend: classe((p) => p.legendEff),
    potentiels: new Map(pots.map((t) => [t.rune, t.p])),
  };
}
