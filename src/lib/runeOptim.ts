// Potentiel maximal d'une rune : meilleure gemme (parmi les stats grindables,
// sans doublon) PUIS grind au max sur tous les substats. Deux scénarios :
// héroïque et légendaire. Runes classiques et antiques ont leurs propres tables.
//
// Calcul pur (≤ 4 slots × 7 stats × O(4) par rune) — réutilisable dans un Web
// Worker pour les traitements lourds à venir.

import { EffectLine, RuneDetail } from '../types';
import { MAINSTAT_MAX, SUBSTAT_MAX, SCORE_MAX, runeEfficiency, runeScore } from './effects';

// Le potentiel se calcule dans la MESURE choisie (efficience ou score SW).
// Ce n'est pas qu'un changement d'unité : les stats plates n'ont pas le même
// poids dans les deux tables, donc la **meilleure gemme peut différer** — par
// exemple entre un ATQ plat et un ATQ%.
export type OptimMetric = 'eff' | 'score';

// ⚠️ **Le calcul ignore la réserve.** Potentiel, gemme choisie et plan sont
// ceux d'une réserve sans limite ; le filtre « Faisable avec ma réserve » ne
// fait que garder les runes dont tout le plan est en réserve (`planFaisable`
// dans crafts.ts). Un plan restreint à la réserve changeait le chiffre et la
// gemme proposée selon le sac : une rune passait pour moins bonne qu'elle
// n'est, et le plan affiché n'était plus celui qu'on viserait.

type Tbl = Record<number, number>;

// Grind max (valeur ajoutée) par code de substat. RES/Préci/TC/DCC non grindables.
const GRIND_HERO: Tbl = { 1: 450, 2: 7, 3: 22, 4: 7, 5: 22, 6: 7, 8: 4 };
const GRIND_LEGEND: Tbl = { 1: 550, 2: 10, 3: 30, 4: 10, 5: 30, 6: 10, 8: 5 };
const GRIND_HERO_ANC: Tbl = { 1: 510, 2: 9, 3: 26, 4: 9, 5: 26, 6: 9, 8: 5 };
const GRIND_LEGEND_ANC: Tbl = { 1: 610, 2: 12, 3: 34, 4: 12, 5: 34, 6: 12, 8: 6 };

// Valeur de base max d'une gemme (avant grind), par code de stat.
const GEM_HERO: Tbl = { 2: 11, 4: 11, 6: 11, 8: 8, 1: 420, 3: 30, 5: 30 };
const GEM_LEGEND: Tbl = { 2: 13, 4: 13, 6: 13, 8: 10, 1: 580, 3: 40, 5: 40 };
const GEM_HERO_ANC: Tbl = { 2: 13, 4: 13, 6: 13, 8: 9, 1: 480, 3: 34, 5: 34 };
const GEM_LEGEND_ANC: Tbl = { 2: 15, 4: 15, 6: 15, 8: 11, 1: 640, 3: 44, 5: 44 };

// Stats gemmables candidates (% d'abord, flats ensuite ; on maximise l'efficience).
const GEM_STATS = [2, 4, 6, 8, 1, 3, 5];

// Le plafond d'une meule (valeur ajoutée) et d'une gemme (base avant meule),
// héroïque ou légendaire, tables antiques pour une rune antique : les mêmes
// tables que le potentiel, lues par la simulation de l'Optimizer
// (runesMaxees.ts) pour qu'aucun autre fichier n'en garde une copie.
// `undefined` = stat sans meule (RES, Précision, Taux Crit, Dgts Crit) ou sans
// gemme connue.
export function meuleMax(code: number, antique: boolean, grade: 'hero' | 'legend'): number | undefined {
  if (grade === 'hero') return (antique ? GRIND_HERO_ANC : GRIND_HERO)[code];
  return (antique ? GRIND_LEGEND_ANC : GRIND_LEGEND)[code];
}
export function gemmeMax(code: number, antique: boolean, grade: 'hero' | 'legend'): number | undefined {
  if (grade === 'hero') return (antique ? GEM_HERO_ANC : GEM_HERO)[code];
  return (antique ? GEM_LEGEND_ANC : GEM_LEGEND)[code];
}

// La rune gagne-t-elle à recevoir CETTE gemme sur la ligne `index`, au jet max
// du grade de la gemme, suivie de la meule du grade donné (`null` = aucune
// meule) ? Sert au filtre « Faisable avec ma réserve » : une gemme héroïque en
// réserve compte pour un plan légendaire si elle améliore déjà la rune. ⚠️ Le
// regemme remet la meule du slot à zéro, d'où la meule rejouée et non gardée.
export function gemmeAmeliore(
  rune: RuneDetail,
  index: number,
  stat: number,
  gradeGemme: 'hero' | 'legend',
  gradeMeule: 'hero' | 'legend' | null,
  metric: OptimMetric
): boolean {
  const anc = rune.rank > 10;
  const max = gemmeMax(stat, anc, gradeGemme);
  const ligne = rune.subs[index];
  if (max == null || !ligne) return false;
  const base = stat === ligne.code ? Math.max(ligne.value - (ligne.grind ?? 0), max) : max;
  const meule = gradeMeule ? meuleMax(stat, anc, gradeMeule) ?? 0 : 0;
  const actuelles = rune.subs.map((s) => ({ code: s.code, total: s.value }));
  const avant = valueOf(rune.main, rune.innate, actuelles, metric);
  const apres = valueOf(
    rune.main,
    rune.innate,
    actuelles.map((s, j) => (j === index ? { code: stat, total: base + meule } : s)),
    metric
  );
  return apres > avant;
}

export interface RunePotential {
  eff: number; // valeur actuelle, dans la mesure demandée
  heroEff: number; // valeur max (gemme+grind) en héroïque
  legendEff: number; // valeur max (gemme+grind) en légendaire
  heroGain: number;
  legendGain: number;
  heroGem: number | null; // code de la stat à gemmer (null = pas de gemme conseillée)
  legendGem: number | null;
}

// Valeur d'une rune (substats modifiés, main + innée inchangés), dans la mesure
// demandée. Le score ne compte QUE les stats secondaires et ne divise pas par
// 2,8 ; l'efficience ajoute la principale plafonnée à 1. Voir effects.ts.
function valueOf(
  main: EffectLine,
  innate: EffectLine | undefined,
  subs: { code: number; total: number }[],
  metric: OptimMetric
): number {
  const table = metric === 'eff' ? SUBSTAT_MAX : SCORE_MAX;
  let ratio = 0;
  for (const s of subs) {
    const m = table[s.code];
    if (m) ratio += s.total / m;
  }
  if (innate) {
    const m = table[innate.code];
    if (m) ratio += innate.value / m;
  }
  if (metric === 'score') return ratio * 100;
  const mm = MAINSTAT_MAX[main.code];
  return (((mm ? Math.min(main.value / mm, 1) : 0) + ratio) / 2.8) * 100;
}

// Mise à l'échelle finale d'une valeur, selon la formule de la mesure :
//  - **score** → `round(… × 100)`, c'est un ENTIER (voir effects.ts) ;
//  - **efficience** → pourcentage, on garde la précision (affichée au dixième).
//
// L'arrondi n'intervient qu'ICI, en sortie : les comparaisons internes de
// `best()` travaillent en pleine précision, sinon deux gemmes séparées par un
// centième donneraient une égalité et le choix deviendrait arbitraire.
function out(value: number, metric: OptimMetric): number {
  return metric === 'score' ? Math.round(value) : value;
}

// Une gemme possible : la ligne remplacée (index dans `rune.subs`) et la stat
// posée.
export interface GemmeChoix {
  slot: number;
  code: number;
}

interface Best {
  eff: number;
  gemSlot: number; // index du substat remplacé par la gemme (-1 = pas de gemme)
  gemCode: number | null; // nouvelle stat gemmée
  // Toutes les gemmes qui atteignent `eff`, la retenue en tête (vide sans
  // gemme). ATQ% et DEF% ont les mêmes tables : à gain égal, c'est au joueur
  // de choisir celle qui va avec sa rune, pas au premier de `GEM_STATS`.
  gemmes: GemmeChoix[];
}

// Deux valeurs à moins de ça sont un même gain : les tables identiques (ATQ%,
// DEF%, PV%) donnent des flottants identiques, mais une somme dans un autre
// ordre peut différer au dernier bit.
const EGALITE = 1e-9;

// Meilleure valeur atteignable pour un scénario (table grind G, table gemme M).
// `withGem` = false → grind seul (on garde les stats actuelles, pas de gemme).
// Renvoie aussi le choix gagnant (slot + stat) pour reconstruire le plan.
// ⚠️ `noDowngrade` : ne JAMAIS reprendre à la baisse une meule déjà posée.
//
// Les deux lectures sont légitimes et répondent à des questions différentes :
//  - **sans** (défaut) — « que vaudrait cette rune si elle était née héroïque » :
//    une rune meulée en légendaire y perd, et ce gain négatif est l'information
//    (l'héroïque ne lui apporte rien) ;
//  - **avec** — « qu'est-ce que je peux encore lui ajouter, avec ce grade » :
//    on ne propose que les stats pas encore au max, donc aucun gain négatif.
//
// La seconde est celle du filtre « Faisable avec ma réserve » : on y regarde ce
// qu'on va **réellement poser**, et on ne pose jamais une meule qui dégrade. Elle
// ne dépend pas de la réserve : un grade, pas un sac.
//
// `regemLibre` : une rune DÉJÀ gemmée peut voir sa ligne gemmée passer à une
// autre stat.
//
// `gemmeExistanteSeule` : aucune gemme n'est SIMULÉE sur une rune qui n'en
// porte pas — seule une gemme déjà posée peut être relancée (même stat). C'est
// la lecture des Courbes : créditer chaque rune vierge de la meilleure gemme au
// jet maximal la faisait passer devant des runes finies.
//
// L'onglet Optimisation passe les deux selon « Autoriser un regemme
// différent » : éteint, `gemmeExistanteSeule` (une gemme posée se relance, une
// rune vierge n'en reçoit pas) ; allumé, `regemLibre` (toute gemme possible).
function best(
  rune: RuneDetail,
  G: Tbl,
  M: Tbl,
  withGem: boolean,
  metric: OptimMetric,
  noDowngrade = false,
  regemLibre = false,
  gemmeExistanteSeule = false
): Best {
  const subs = rune.subs.map((s) => ({
    code: s.code,
    base: s.value - (s.grind ?? 0), // base « sans grind »
    grind: s.grind ?? 0, // meule DÉJÀ posée, jamais reprise à la baisse
    enchant: !!s.enchant,
  }));
  const gtotal = (code: number, base: number, actuel: number) => {
    const cible = G[code] ?? 0;
    return base + (noDowngrade ? Math.max(actuel, cible) : cible);
  };
  // Meule du slot gemmé : le slot repart de zéro, la meule max se pose derrière.
  const gGem = (code: number) => G[code] ?? 0;

  // Scénario de référence : grind seul, aucune gemme.
  let bestEff = valueOf(
    rune.main,
    rune.innate,
    subs.map((s) => ({ code: s.code, total: gtotal(s.code, s.base, s.grind) })),
    metric
  );
  let gemmes: GemmeChoix[] = [];
  const sansGemme = { eff: bestEff, gemSlot: -1, gemCode: null, gemmes };

  if (!withGem) return sansGemme; // grind seul

  const gemmedIdx = subs.findIndex((s) => s.enchant);
  if (gemmeExistanteSeule && gemmedIdx < 0) return sansGemme;

  // Règles du jeu (relevées par l'utilisateur) : UNE seule ligne gemmée par
  // rune ; une rune vierge peut gemmer n'importe quelle ligne, une rune déjà
  // gemmée ne peut regemmer QUE sa ligne gemmée. Dans les deux cas, la gemme
  // prend une stat absente du reste de la rune — **y compris la propre stat de
  // la ligne** (ATQ% à 7 → gemme ATQ% à 13, ou « proc max » d'une gemme en
  // place). Retenu seulement si la valeur augmente.
  //
  // ⚠️ Rune DÉJÀ gemmée, par défaut : la stat gemmée reste FIXE. C'est un CHOIX
  // PRODUIT, pas une règle du jeu : le joueur a peut-être gemmé pour autre chose
  // que l'efficience, et on ne remet pas sa décision en cause. `regemLibre`
  // lève ce choix.
  const lignes = gemmedIdx >= 0 ? [gemmedIdx] : subs.map((_, j) => j);
  const figee = gemmedIdx >= 0 && !regemLibre;

  // Stats interdites selon l'emplacement : slot 1 → pas de DEF (5/6), slot 3 → pas d'ATQ (3/4).
  const forbidden = new Set<number>();
  if (rune.slot === 1) {
    forbidden.add(5);
    forbidden.add(6);
  } else if (rune.slot === 3) {
    forbidden.add(3);
    forbidden.add(4);
  }

  for (const slot of lignes) {
    for (const Y of GEM_STATS) {
      if (M[Y] == null) continue;
      if (figee && Y !== subs[slot].code) continue; // stat gemmée conservée
      if (forbidden.has(Y)) continue; // interdit sur cet emplacement
      if (Y === rune.main.code) continue;
      if (rune.innate && Y === rune.innate.code) continue;
      let dup = false;
      for (let j = 0; j < subs.length; j++) {
        if (j !== slot && subs[j].code === Y) {
          dup = true;
          break;
        }
      }
      if (dup) continue;

      // Même stat → jamais sous la base actuelle (un proc déjà au max reste au
      // max) ; autre stat → base max de gemme. Le slot regemmé repart d'une
      // meule à zéro : la meule précédente est perdue avec l'ancienne valeur.
      const base = Y === subs[slot].code ? Math.max(subs[slot].base, M[Y]) : M[Y];
      const newSubs = subs.map((s, j) =>
        j === slot
          ? { code: Y, total: base + gGem(Y) } // gemme + grind max
          : { code: s.code, total: gtotal(s.code, s.base, s.grind) }
      );
      const e = valueOf(rune.main, rune.innate, newSubs, metric);
      if (e > bestEff + EGALITE) {
        bestEff = e;
        gemmes = [{ slot, code: Y }];
      } else if (gemmes.length > 0 && Math.abs(e - bestEff) <= EGALITE) {
        gemmes.push({ slot, code: Y }); // même gain : un choix de plus
      }
    }
  }
  const retenue = gemmes[0];
  return { eff: bestEff, gemSlot: retenue?.slot ?? -1, gemCode: retenue?.code ?? null, gemmes };
}

export function runePotential(
  rune: RuneDetail,
  withGem = true,
  metric: OptimMetric = 'eff',
  noDowngrade = false,
  regemLibre = false,
  gemmeExistanteSeule = false
): RunePotential {
  const anc = rune.rank > 10;
  const eff = metric === 'eff' ? runeEfficiency(rune) : runeScore(rune);
  const h = best(
    rune,
    anc ? GRIND_HERO_ANC : GRIND_HERO,
    anc ? GEM_HERO_ANC : GEM_HERO,
    withGem,
    metric,
    noDowngrade,
    regemLibre,
    gemmeExistanteSeule
  );
  const l = best(
    rune,
    anc ? GRIND_LEGEND_ANC : GRIND_LEGEND,
    anc ? GEM_LEGEND_ANC : GEM_LEGEND,
    withGem,
    metric,
    noDowngrade,
    regemLibre,
    gemmeExistanteSeule
  );
  // Arrondi en sortie, puis gains calculés SUR LES VALEURS ARRONDIES : le gain
  // affiché est ainsi toujours exactement « potentiel − actuel » à l'écran.
  const heroEff = out(h.eff, metric);
  const legendEff = out(l.eff, metric);
  return {
    eff,
    heroEff,
    legendEff,
    heroGain: heroEff - eff,
    legendGain: legendEff - eff,
    heroGem: h.gemCode,
    legendGem: l.gemCode,
  };
}

/* --------------------------------------------------------------------------
 * Plan d'optimisation détaillé (pour « ce qu'il faut up » au clic sur une rune)
 * ----------------------------------------------------------------------- */

export interface PlanSub {
  code: number; // stat finale (après gemme éventuelle)
  fromCode: number; // stat actuelle du slot (= code sauf si gemmé)
  isGem: boolean; // ce slot est (re)gemmé dans le plan
  base: number; // valeur de base cible (hors grind)
  grind: number; // grind cible
  total: number; // base + grind
  curTotal: number; // valeur actuelle du slot
  curGrind: number; // grind actuel
  grindable: boolean;
}

export interface RunePlan {
  scenario: 'hero' | 'legend';
  eff: number; // valeur actuelle (dans la mesure demandée)
  targetEff: number; // valeur après plan
  gemCode: number | null; // stat à gemmer (null = pas de gemme)
  // Les gemmes au même gain que celle du plan, elle comprise et en tête de la
  // liste calculée (vide sans gemme). Plus d'une : le joueur choisit.
  gemmes: GemmeChoix[];
  subs: PlanSub[]; // aligné sur rune.subs (par index)
}

// Reconstruit le plan concret (gemme + grinds) pour un scénario donné.
// `choix` : une des `gemmes` au même gain, à la place de la première — ignoré
// s'il n'en fait pas partie (le gain annoncé ne bouge jamais).
export function runePlan(
  rune: RuneDetail,
  scenario: 'hero' | 'legend',
  withGem = true,
  metric: OptimMetric = 'eff',
  noDowngrade = false,
  regemLibre = false,
  gemmeExistanteSeule = false,
  choix?: GemmeChoix
): RunePlan {
  const anc = rune.rank > 10;
  const G =
    scenario === 'hero' ? (anc ? GRIND_HERO_ANC : GRIND_HERO) : anc ? GRIND_LEGEND_ANC : GRIND_LEGEND;
  const M = scenario === 'hero' ? (anc ? GEM_HERO_ANC : GEM_HERO) : anc ? GEM_LEGEND_ANC : GEM_LEGEND;

  const b = best(rune, G, M, withGem, metric, noDowngrade, regemLibre, gemmeExistanteSeule);
  const gemme = (choix && b.gemmes.find((g) => g.slot === choix.slot && g.code === choix.code)) ?? b.gemmes[0];
  const subs: PlanSub[] = rune.subs.map((s, j) => {
    const curGrind = s.grind ?? 0;
    const curBase = s.value - curGrind;
    if (gemme && j === gemme.slot) {
      const gmax = M[gemme.code] ?? 0;
      // Gemme de la MÊME stat (re-proc d'une rune gemmée, ou gemme de sa propre
      // stat sur une rune vierge) → base = max(base actuelle, gemMax) — `best` ne
      // la choisit que si gemMax l'emporte ; autre stat → base = gemMax.
      const base = gemme.code === s.code ? Math.max(curBase, gmax) : gmax;
      const grind = G[gemme.code] ?? 0;
      return {
        code: gemme.code,
        fromCode: s.code,
        isGem: true,
        base,
        grind,
        total: base + grind,
        curTotal: s.value,
        curGrind,
        grindable: true,
      };
    }
    // Même règle que `best`, sinon le plan affiché ne correspondrait pas au
    // potentiel annoncé au-dessus.
    const grindable = G[s.code] != null;
    const cible = grindable ? G[s.code] : curGrind;
    const grind = noDowngrade ? Math.max(curGrind, cible) : cible;
    return {
      code: s.code,
      fromCode: s.code,
      isGem: false,
      base: curBase,
      grind,
      total: curBase + grind,
      curTotal: s.value,
      curGrind,
      grindable,
    };
  });

  return {
    scenario,
    eff: metric === 'eff' ? runeEfficiency(rune) : runeScore(rune),
    targetEff: out(b.eff, metric),
    gemCode: gemme?.code ?? null,
    gemmes: b.gemmes,
    subs,
  };
}

// Consommables qu'un plan réclame — la liste à confronter à la réserve du
// compte (voir crafts.ts). Un plan sans changement ne réclame rien.
//
// ⚠️ Le slot GEMMÉ réclame aussi sa meule. Poser une gemme remet la meule du
// slot à zéro : le plan vise `base + grind max`, il faut donc regrinder derrière.
// Le comparer au grind ACTUEL laisserait croire qu'une rune déjà bien meulée sur
// ce slot n'a plus besoin de rien.
//
// ⚠️ Une seule entrée par stat gemmée/meulée, jamais de quantité : on applique
// une gemme par rune et une meule par substat. La question posée est
// « ai-je le bon consommable », pas « combien m'en faut-il ».
export function planNeeds(plan: RunePlan): { kind: 'grind' | 'gem'; stat: number }[] {
  const out: { kind: 'grind' | 'gem'; stat: number }[] = [];
  if (plan.gemCode != null) out.push({ kind: 'gem', stat: plan.gemCode });
  for (const s of plan.subs) {
    if (!s.grindable) continue;
    const depart = s.isGem ? 0 : s.curGrind;
    if (s.grind > depart) out.push({ kind: 'grind', stat: s.code });
  }
  return out;
}
