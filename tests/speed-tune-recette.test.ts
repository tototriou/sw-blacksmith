// La contrainte de speed tune dans la recette : lecture validée, et le CLI
// qui la rejoue comme l'écran (exigence sous l'enveloppe de la zone, 206
// incomparable et sans verrou, résolution même sans optimisation des
// artéfacts). Spec : docs/02-app/optimizer/feat-contrainte-speed-tune.md.
import type { ArtifactDetail, RuneDetail } from '../src/types';
import { buildOptimizerRecipe, parseOptimizerRecipe, type OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { contrainteValide, type ContrainteSpeedTune } from '../src/lib/contrainteSpeedTune';
import { artefactsDuCli, exigenceDeLaRecette, resoudreEquipementCli, recipeToSearchParams } from '../scripts/lib/recipeToSearchParams';
import type { LoadedMonster } from '../scripts/lib/loadMonster';
import { egal, ok, titre } from './outils';
import { fr } from '../src/i18n/fr';

const LUSHEN = 13413;
const BASE = { hp: 10000, atk: 1000, def: 500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const contrainte = (): ContrainteSpeedTune => ({ version: 1, setsAdmis: [{ will: false, shield: false }], zone: {
  uid: 'allie:1', base: 100, axeArtefact: true,
  parSwift: [{ swift: false, classes: [{ arteMin: 0, arteMax: 4, intervalles: [[180, 190]] }, { arteMin: 5, arteMax: 9, intervalles: [[170, 175]] }] }],
} });
function recette(r: Partial<OptimizerRecipe>): OptimizerRecipe {
  return buildOptimizerRecipe({
    monsterCom2usId: LUSHEN, monsterName: 'Lushen (test)', requirement: { sets: [], minStats: {}, maxStats: { spd: 185 } }, objective: 'efficience',
    damageSetup: DEFAULT_DAMAGE_SETUP, metric: 'eff', slotFilterPreset: 'bas', exhaustiveSearch: false,
    excludeUsedRunes: false, excludeUsedScope: 'rta', excludedSelectors: [], ignoreArtifacts: false,
    artifactMainByKind: { element: 'libre', archetype: 'libre' }, relicMainChoice: 'equipped', lignesVerrouillees: [{ code: 206, min: 5 }, { code: 210, min: 2 }],
    ...r,
  });
}

export function testSpeedTuneRecetteLecture() {
  titre('Speed tune · la contrainte dans la recette, lecture validée');
  const avec = recette({ speedTune: contrainte() });
  const lu = parseOptimizerRecipe(JSON.stringify(avec), fr);
  egal(lu.recipe?.speedTune, contrainte(), 'une contrainte bien formée revient telle quelle');
  egal(parseOptimizerRecipe(JSON.stringify(recette({})), fr).recipe?.speedTune, undefined, 'sans elle, la recette est celle d’avant');
  const casses: [string, unknown][] = [
    ['version inconnue', { ...contrainte(), version: 2 }],
    ['intervalle à l’envers', { ...contrainte(), zone: { ...contrainte().zone, parSwift: [{ swift: false, classes: [{ arteMin: 0, arteMax: 4, intervalles: [[190, 180]] }] }] } }],
    ['classe à l’envers', { ...contrainte(), zone: { ...contrainte().zone, parSwift: [{ swift: false, classes: [{ arteMin: 5, arteMax: 4, intervalles: [] }] }] } }],
    ['sets admis malformés', { ...contrainte(), setsAdmis: [{ will: 1 }] }],
  ];
  for (const [nom, v] of casses) {
    ok(!contrainteValide(v), `${nom} : refusée par la garde`);
    const r = parseOptimizerRecipe(JSON.stringify({ ...recette({}), speedTune: v }), fr);
    ok(r.recipe === null && !!r.error?.includes('speedTune'), `${nom} : la recette est refusée, le champ nommé`);
  }
}

export function testSpeedTuneRecetteCli() {
  titre('Speed tune · le CLI rejoue la contrainte de la recette comme l’écran');
  const sans = exigenceDeLaRecette(recette({}));
  egal([sans.minStats.spd, sans.maxStats?.spd], [undefined, 185], 'sans contrainte : l’exigence d’avant');
  const avec = exigenceDeLaRecette(recette({ speedTune: contrainte() }));
  egal([avec.minStats.spd, avec.maxStats?.spd], [170, 185], 'sous contrainte : minimum de la zone, maximum le plus serré');
  let leve = false;
  try { exigenceDeLaRecette(recette({ speedTune: { ...contrainte(), setsAdmis: [] } })); } catch { leve = true; }
  ok(leve, 'aucun set admis : la recherche est refusée');

  const rune = (id: number, slot: number, spd: number): RuneDetail =>
    ({ id, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: slot === 2 ? 8 : 1, value: slot === 2 ? spd : 100 }, subs: [] });
  const art = (id: number, kind: 'element' | 'archetype', v206: number): ArtifactDetail =>
    ({ id, kind, ...(kind === 'element' ? { element: 'wind' as const } : { archetype: 'attack' as const }), level: 15, rarity: 5,
      main: { code: 100, value: 100 }, subs: [{ code: 206, value: v206 }] });
  const runes = [1, 2, 3, 4, 5, 6].map((s) => rune(100 + s, s, 80));
  const portees = [art(1, 'element', 3), art(2, 'archetype', 0)];
  const loaded: LoadedMonster = { unitId: 1, com2usId: LUSHEN, monsterName: 'Lushen (test)',
    gear: { base: BASE, runes, artifacts: portees }, allRunes: runes, allArtifacts: [...portees, art(3, 'element', 7)], allRelics: [] };
  const r = recette({ speedTune: contrainte() });
  const a = artefactsDuCli(r, loaded)!;
  egal([a.params.speedTune, a.params.codesIncomparables, a.params.lignesVerrouillees], [contrainte(), [206], [{ code: 210, min: 2 }]],
    'paramètres de paires : la contrainte portée, le 206 incomparable et son verrou retiré');
  const params = recipeToSearchParams(r, loaded);
  egal([params.requirement.minStats.spd, params.requirement.maxStats?.spd], [170, 185], 'l’exigence du moteur suit l’enveloppe');
  const ignore = recette({ speedTune: contrainte(), ignoreArtifacts: true, lignesVerrouillees: [] });
  const resoudre = resoudreEquipementCli(ignore, loaded, recipeToSearchParams(ignore, loaded));
  ok(resoudre !== null, 'artéfacts ignorés sous contrainte : la paire portée se juge encore');
  ok(resoudreEquipementCli(recette({ ignoreArtifacts: true }), loaded, recipeToSearchParams(recette({ ignoreArtifacts: true }), loaded)) === null,
    'artéfacts ignorés sans contrainte : aucune résolution, comme avant');
}
