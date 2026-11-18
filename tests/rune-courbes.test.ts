// Onglet Courbes (Mon compte → Runes) : les trois distributions, la rune que
// chacune porte à chaque rang, et la gemme qu'elles simulent — ou non.
//
// ⚠️ Chaque courbe est triée de son côté : au même rang, elles ne désignent pas
// la même rune. Une rune meulée en légendaire tient le haut d'« Actuelle »,
// mais une rune pas encore meulée, créditée du jet maximal, peut la dépasser en
// potentiel héroïque. Le clic sur un rang ouvre la rune de CHAQUE courbe : sa
// rune doit donc être celle qui vaut la valeur tracée.

import { distributionsCourbes } from '../src/lib/runeCourbes';
import { runePotential } from '../src/lib/runeOptim';
import type { RuneDetail } from '../src/types';
import { egal, ok, titre } from './outils';

const rune = (id: number, subs: [number, number, number, boolean][]): RuneDetail => ({
  id,
  slot: 6,
  set: 'shield',
  rank: 6,
  rarity: 5,
  level: 15,
  main: { code: 11, value: 64 },
  innate: { code: 12, value: 5 },
  subs: subs.map(([code, total, grind, enchant]) => ({ code, value: total, grind, enchant })),
});

// Travaillée : meules légendaires, DEF% gemmée (base 12) — 118,5 %.
const travaillee = () =>
  rune(1, [
    [6, 21, 9, true],
    [4, 16, 9, false],
    [8, 26, 5, false],
    [2, 16, 9, false],
  ]);
// Pas encore meulée ni gemmée, de bons jets : 117,9 % aujourd'hui.
const brute = () =>
  rune(2, [
    [6, 20, 0, false],
    [4, 20, 0, false],
    [8, 24, 0, false],
    [2, 15, 0, false],
  ]);
// Vierge, avec une ligne faible (DC 4) qu'une gemme remplacerait.
const vierge = () =>
  rune(3, [
    [6, 15, 0, false],
    [4, 15, 0, false],
    [8, 20, 0, false],
    [10, 4, 0, false],
  ]);

export function testCourbesRunesParRang() {
  titre('Courbes de runes — chaque courbe porte la rune de son rang');
  const t = travaillee();
  const b = brute();
  const d = distributionsCourbes([b, t], true, 'eff');

  egal(d.cur.runes[0].id, 1, 'Actuelle : la rune travaillée en tête');
  egal(d.hero.runes[0].id, 2, 'Potentiel Héro : la rune pas encore meulée en tête — même rang, autre rune');
  ok(d.potentiels.get(t)!.eff > d.potentiels.get(t)!.heroEff, 'la rune travaillée dépasse son propre potentiel héroïque');

  for (const [nom, dist, val] of [
    ['Actuelle', d.cur, (r: RuneDetail) => d.potentiels.get(r)!.eff],
    ['Potentiel Héro', d.hero, (r: RuneDetail) => d.potentiels.get(r)!.heroEff],
    ['Potentiel Légend', d.legend, (r: RuneDetail) => d.potentiels.get(r)!.legendEff],
  ] as const) {
    egal(dist.runes.length, dist.effs.length, `${nom} : une rune par valeur`);
    ok(
      dist.runes.every((r, i) => val(r) === dist.effs[i]),
      `${nom} : la rune d’un rang vaut la valeur tracée à ce rang`
    );
    ok(
      dist.effs.every((e, i) => i === 0 || dist.effs[i - 1] >= e),
      `${nom} : triée par valeur décroissante`
    );
  }

  // La fiche lit les trois valeurs de SA rune, quelle que soit la courbe.
  const pb = d.potentiels.get(b)!;
  egal([pb.eff, pb.heroEff, pb.legendEff], [d.cur.effs[1], d.hero.effs[0], d.legend.effs[0]], 'fiche : actuelle et deux potentiels de la rune');
}

export function testCourbesRunesSansGemmeSimulee() {
  titre('Courbes de runes — aucune gemme simulée sur une rune qui n’en a pas');
  const v = vierge();
  const t = travaillee();
  const d = distributionsCourbes([v, t], true, 'eff');

  // L'Optimisation, elle, propose une gemme sur la rune vierge.
  ok(runePotential(v, true, 'eff').heroGem != null, 'Optimisation : une gemme est proposée sur la rune vierge');
  const pv = d.potentiels.get(v)!;
  egal([pv.heroGem, pv.legendGem], [null, null], 'Courbes : aucune gemme sur la rune vierge');
  egal(pv.heroEff, runePotential(v, false, 'eff').heroEff, 'Courbes : la rune vierge ne gagne que ses meules');

  // Une gemme posée se relance vers son max, sans changer de stat.
  const pt = d.potentiels.get(t)!;
  egal(pt.legendGem, 6, 'Courbes : la gemme DEF% posée est relancée (13 en légendaire), même stat');
  egal(pt.heroGem, null, 'Courbes : en héroïque (max 11), la gemme à 12 reste telle quelle');
}

export function testCourbesRunesRuneARune() {
  titre('Courbes de runes — lecture « rune à rune »');
  const d = distributionsCourbes([brute(), travaillee()], true, 'eff', true);
  ok(
    d.cur.runes.every((r, i) => d.hero.runes[i] === r && d.legend.runes[i] === r),
    'au même rang, les trois courbes désignent la même rune'
  );
  egal(d.cur.runes.map((r) => r.id), [1, 2], 'le classement est celui d’« Actuelle »');
  egal(
    d.hero.effs,
    d.cur.runes.map((r) => d.potentiels.get(r)!.heroEff),
    'Potentiel Héro : le potentiel de la rune du rang, sans retri'
  );
  ok(d.hero.effs[1] > d.hero.effs[0], 'les potentiels ne sont plus triés : la rune pas encore meulée, 2ᵉ, a le plus fort potentiel');
}
