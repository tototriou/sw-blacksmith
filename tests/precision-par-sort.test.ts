// La précision minimale PAR SORT (src/lib/precisionParSort.ts) : le minimum
// de Précision porté sur un ou plusieurs sorts, ligne « [Comp.N] Aug.
// Précision » de l'artéfact de type comprise.
//
// Référence de contrôle (`algo-verify`) : un balayage BRUT de toutes les
// paires de la vue complète (`candidatsParSorte` des deux sortes, emplacement
// vide compris, sans préfiltre ni dominance), contrainte de paire, conditions
// et précision de chaque sort jugées à la main. La résolution (chemin de
// l'app) rend le même verdict et, hors régime `aucun`, la meilleure note du
// balayage ; calcul exhaustif et confirmation sans note sont d'accord. Le
// relâchement que voient les runes (`exigencePrecisionParSort`) ne rejette
// jamais un build que le balayage brut juge faisable.
//
// Pools à graine fixe : runes tirées avec le set Précision (auras propres),
// inventaire où les lignes 407–409 sont fréquentes, minimums tirés autour de
// la Précision des builds.

import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
import { ArtifactArchetype, ArtifactDetail, ArtifactKind, BaseStats, ElementKey, RelicDetail, RuneDetail } from '../src/types';
import { ARTIFACT_SUB_MAX, artifactPairAllowed } from '../src/lib/artifacts';
import { artifactSubKinds } from '../src/lib/effects';
import { computeStats } from '../src/lib/stats';
import { BuildRequirement, precisionJugee, respecteConditionsAvecRelique } from '../src/lib/runeBuildOptim';
import { RelicContext, resoudreContexteRelique } from '../src/lib/relicOptim';
import { RegimeArtefacts } from '../src/lib/artifactEvaluation';
import { candidatsParSorte } from '../src/lib/artifactOptim';
import { parametresArtefactsFiche } from '../src/lib/artifactFiche';
import { EntreeResolution, entreeResolutionDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { confirmerEquipementDuBuild } from '../src/lib/resolutionRapide';
import { resoudreEquipementDuBuildExhaustif } from '../src/lib/resolutionExhaustive';
import { aurasPropresDesRunes, DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { ResultatArtefacts, signatureReglages } from '../src/lib/artifactQueue';
import {
  CODE_PRECISION_SORT,
  SortPrecision,
  bonusPrecisionMax,
  codesPrecisionParSort,
  exigencePrecisionParSort,
  lignesPrecisionDuBuild,
  normaliserSortsPrecision,
  precisionDuSort,
  sortsPrecisionActifs,
  sortsPrecisionDisponibles,
} from '../src/lib/precisionParSort';
import { buildOptimizerRecipe, parseOptimizerRecipe, type OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { exigenceDeLaRecette } from '../scripts/lib/recipeToSearchParams';
import { fr } from '../src/i18n/fr';
import { mulberry32, randomRune } from '../scripts/lib/randomPool';
import { egal, ok, titre } from './outils';

const PORTEUR = { element: 'fire' as ElementKey, archetype: 'attack' as ArtifactArchetype };
const BASE: BaseStats = { hp: 9000, atk: 650, def: 550, spd: 101, cr: 15, cd: 50, res: 15, acc: 0 };
const EXCLUSIVE = { setup: DEFAULT_DAMAGE_SETUP, element: null };
const SETS = ['violent', 'accuracy', 'accuracy', 'focus', 'will', 'fight'];
const CODES_PRE = [407, 408, 409];

// Inventaire éligible : sur le type, une ligne de précision de sort sur la
// plupart des pièces ATQ et DEF (parfois deux), de 1 au plafond ; quelques
// Intangibles.
function inventaire(rng: () => number, parSorte: number): ArtifactDetail[] {
  const codesDe = (kind: ArtifactKind) =>
    Object.keys(ARTIFACT_SUB_MAX).map(Number).filter((c) => !CODES_PRE.includes(c) && artifactSubKinds(c).includes(kind));
  const pieces: ArtifactDetail[] = [];
  let id = 7000;
  for (const kind of ['element', 'archetype'] as ArtifactKind[]) {
    const codes = codesDe(kind);
    for (let i = 0; i < parSorte; i++) {
      const choisis = new Set<number>();
      // Les PV seulement sur le type : la pièce PV et la pièce de précision s'y disputent l'emplacement.
      const mainCode = kind === 'element' ? [101, 102][Math.floor(rng() * 2)]! : [100, 101, 102][Math.floor(rng() * 3)]!;
      // Les lignes de précision hors des pièces PV : un minimum de PV serré
      // oppose alors la pièce qui tient le sort à celle qui tient les PV.
      if (kind === 'archetype' && mainCode !== 100) {
        if (rng() < 0.6) choisis.add(CODES_PRE[Math.floor(rng() * 3)]!);
        if (rng() < 0.3) choisis.add(CODES_PRE[Math.floor(rng() * 3)]!);
      }
      while (choisis.size < 4) choisis.add(codes[Math.floor(rng() * codes.length)]!);
      const valeurs = mainCode === 100 ? [900, 1200, 1500] : [60, 80, 100];
      pieces.push({
        id: id++, kind, ...(kind === 'element' ? { element: 'fire' as const } : { archetype: 'attack' as const }),
        level: 15, rarity: 5, main: { code: mainCode, value: valeurs[Math.floor(rng() * 3)]! },
        subs: [...choisis].map((code) => ({
          code,
          value: CODES_PRE.includes(code) ? 1 + Math.floor(rng() * ARTIFACT_SUB_MAX[code]!) : Math.max(1, Math.round(rng() * ARTIFACT_SUB_MAX[code]! * 10) / 10),
        })),
        ...(rng() < 0.15 ? { intangible: true } : {}),
      });
    }
  }
  return pieces;
}

function reliques(rng: () => number, n: number): RelicDetail[] {
  return Array.from({ length: n }, (_, i) => ({
    id: 300 + i * 7,
    upgrade: 9,
    main: { code: ([100, 101, 102] as const)[Math.floor(rng() * 3)]!, value: 8 + Math.floor(rng() * 7) },
    unique: { type: [1, 2, 3, 16][Math.floor(rng() * 4)]!, tranche: 1000, percent: 1 + Math.floor(rng() * 3) },
  }));
}

const build = (rng: () => number, id0: number): RuneDetail[] => [1, 2, 3, 4, 5, 6].map((slot) => randomRune(id0 + slot, slot, rng, SETS));
const total = (runes: RuneDetail[], k: string) => computeStats({ base: BASE, runes, artifacts: [] }).find((s) => s.key === k)!.total;

interface Scenario {
  nom: string;
  regime: RegimeArtefacts;
  intention: 'recherche' | 'equipped' | null;
  artefacts: 'libre' | 'type-fige' | 'sans-optimisation';
  auras: boolean;
}
const SCENARIOS: Scenario[] = [];
for (const regime of ['aucun', 'atk', 'ehp'] as RegimeArtefacts[])
  for (const intention of ['recherche', 'equipped', null] as const)
    for (const artefacts of ['libre', 'type-fige', 'sans-optimisation'] as const)
      for (const auras of [false, true])
        SCENARIOS.push({ nom: `${regime} · relique ${intention ?? 'sans contexte'} · ${artefacts}${auras ? ' · auras' : ''}`, regime, intention, artefacts, auras });

type Issue = { r: ResultatArtefacts } | { erreur: string };
function resoudre(f: () => ResultatArtefacts): Issue {
  try {
    return { r: f() };
  } catch (e) {
    return { erreur: `${(e as Error).name} ${(e as Error).message}` };
  }
}

// Le balayage brut. `exacte` : la condition saisie (minimum sur chaque sort),
// jugée à la main ; `relache` : l'exigence des runes, qui doit aussi passer
// pour qu'un build arrive à la résolution.
function brut(e: EntreeResolution, exacte: BuildRequirement, sorts: SortPrecision[], min: number) {
  const recherche = e.relicContext?.mode === 'recherche';
  const reliquesEssayees = recherche ? e.relicContext!.eligibles : [e.gear.relic];
  const propres = aurasPropresDesRunes(e.gear.runes);
  const pre = precisionJugee(computeStats(e.gear), exacte, propres);
  // Les autres conditions : la Précision, elle, porte sur les sorts.
  const autres: BuildRequirement = { ...exacte, minStats: Object.fromEntries(Object.entries(exacte.minStats).filter(([k]) => k !== 'acc')) };
  let meilleure = -Infinity;
  let faisable = false;
  for (const relique of reliquesEssayees) {
    const p = e.faireParams(relique);
    const avecVide = (l: (ArtifactDetail | null)[]) => [null, ...l.filter((a) => a != null)];
    for (const el of avecVide(candidatsParSorte(p, 'element')))
      for (const ar of avecVide(candidatsParSorte(p, 'archetype'))) {
        if (!artifactPairAllowed(el, ar)) continue;
        const paire = [el, ar].filter((a): a is ArtifactDetail => a != null);
        if (!sorts.every((s) => precisionDuSort(pre, paire, s) >= min - 1e-6)) continue;
        if (!respecteConditionsAvecRelique({ ...e.gear, artifacts: paire }, relique, autres).respecte) continue;
        faisable = true;
        meilleure = Math.max(meilleure, p.evaluer(paire));
      }
  }
  return { faisable, meilleure };
}

export default function testPrecisionParSort() {
  titre('Précision par sort — les fonctions pures');
  {
    const piece = (id: number, lignes: [number, number][]): ArtifactDetail => ({
      id, kind: 'archetype', archetype: 'attack', level: 15, rarity: 5, main: { code: 101, value: 100 },
      subs: lignes.map(([code, value]) => ({ code, value })),
    });
    const a = piece(1, [[407, 20], [409, 5]]);
    const b = piece(2, [[409, 18]]);
    egal(bonusPrecisionMax([1], [null, a, b]), 20, 'un sort : la meilleure ligne de ce sort');
    egal(bonusPrecisionMax([1, 3], [null, a, b]), 5, 'deux sorts : la meilleure pièce pour les DEUX à la fois (jamais 20 + 18)');
    egal(bonusPrecisionMax([2], [null, a, b]), 0, 'aucune pièce ne porte la ligne : aucun relâchement');
    egal(normaliserSortsPrecision([3, 1, 3, 4, 0]), [1, 3], 'sorts normalisés : triés, sans doublon, S1–S3 seulement');
    egal(codesPrecisionParSort([3, 1]), [407, 409], 'codes des lignes : 407 à 409');
    egal(sortsPrecisionActifs([1, 3], {}), [], 'sans minimum de Précision : aucun sort en jeu');
    egal(sortsPrecisionActifs([3, 1], { acc: 85 }), [1, 3], 'avec minimum : les sorts cochés');
    egal(sortsPrecisionDisponibles(null), [1, 2, 3], 'fiche inconnue : les trois sorts');
    egal(sortsPrecisionDisponibles([{ slot: 1, passif: false }, { slot: 2, passif: true }, { slot: 3, passif: false }]), [1, 3], 'un passif ne se lance pas');

    const req: BuildRequirement = { sets: [], minStats: { acc: 85, hp: 20000 }, maxStats: { acc: 100 } };
    ok(exigencePrecisionParSort(req, [], [a]) === req, 'aucun sort coché : la même exigence');
    ok(exigencePrecisionParSort({ ...req, minStats: { hp: 1 } }, [1], [a]).precisionParSort === undefined, 'sans minimum de Précision : rien de dérivé');
    egal(exigencePrecisionParSort(req, [3, 1], [null, a, b]),
      { sets: [], minStats: { acc: 80, hp: 20000 }, maxStats: { acc: 100 }, precisionParSort: { sorts: [1, 3], min: 85 } },
      'runes : minimum relâché du meilleur bonus commun, maximum inchangé, condition exacte portée');
    egal(exigencePrecisionParSort({ sets: [], minStats: { acc: 15 } }, [1], [a]).minStats, {}, 'relâché sous zéro : plus de minimum pour les runes');

    const memo = new Map();
    const p = { sorts: [1, 3] as SortPrecision[], min: 85 };
    egal(lignesPrecisionDuBuild(p, 90), [], 'fiche déjà au-dessus : rien à exiger de la paire');
    const l = lignesPrecisionDuBuild(p, 70, memo);
    egal(l, [{ code: 407, plages: [{ min: 15, max: Infinity }] }, { code: 409, plages: [{ min: 15, max: Infinity }] }], 'chaque sort : l’écart à combler');
    ok(lignesPrecisionDuBuild(p, 70, memo) === l, '… même objet pour le même écart (mémoires de la file)');
    egal(CODE_PRECISION_SORT, { 1: 407, 2: 408, 3: 409 }, 'codes du jeu');
  }

  titre('Précision par sort à la résolution — contre un balayage brut');
  let compares = 0;
  let conformes = 0;
  let tenusParLaLigne = 0;
  let relachementFaux = 0;
  const ecarts: string[] = [];
  SCENARIOS.forEach((sc, iScenario) => {
    const rng = mulberry32(4200 + iScenario);
    const inv = inventaire(rng, 8);
    const reliquesInv = reliques(rng, 3);
    const portee = reliquesInv[0]!;
    const builds = Array.from({ length: 20 }, (_, i) => build(rng, 100 * i));
    const sorts = normaliserSortsPrecision(rng() < 0.5 ? [1 + Math.floor(rng() * 3)] : [1, 3]);
    const pres = builds.map((b) => total(b, 'acc')).sort((x, y) => x - y);
    const min = pres[Math.floor(pres.length * 0.5)]! + 10;
    const centile = (k: string, q: number) => builds.map((b) => total(b, k)).sort((x, y) => x - y)[Math.floor(builds.length * q)]!;
    const exacte: BuildRequirement = {
      sets: [], minStats: { acc: min, hp: centile('hp', 0.35) }, maxStats: {},
      auraResPre: { res: 0, acc: sc.auras ? 8 : 0, compter: sc.auras },
    };
    const typePorte = inv.find((a) => a.kind === 'archetype' && a.subs.some((s) => CODES_PRE.includes(s.code)))!;
    const artifactParams = parametresArtefactsFiche({
      porteur: PORTEUR, inventaire: inv, reserves: new Set(), equipes: [typePorte],
      optimiserArtefacts: sc.artefacts !== 'sans-optimisation',
      principaleParSorte: sc.artefacts === 'type-fige' ? { archetype: 'equipped' } : {},
      lignesVerrouillees: [], damageSetup: DEFAULT_DAMAGE_SETUP, maxStats: {}, sortDegats: null, speedTune: null,
      sortsPrecision: sortsPrecisionActifs(sorts, exacte.minStats),
    });
    // Le producteur des runes, sur la même vue que l'écran.
    const requirement = exigencePrecisionParSort(exacte, sorts, candidatsParSorte(artifactParams, 'archetype'));
    const ctx: RelicContext | undefined = sc.intention
      ? resoudreContexteRelique({ mode: sc.intention, principale: 'libre', type: 'libre', seuil: 0 }, portee, reliquesInv)
      : undefined;
    const fiche = { base: BASE, runes: [], artifacts: [typePorte], relic: portee };
    const caches = nouveauxCachesResolution();
    builds.forEach((b, i) => {
      const entree = (avecCaches: boolean) => entreeResolutionDuBuild({
        fiche, runes: b, artifactParams, regime: sc.regime, degats: null, exclusive: EXCLUSIVE, requirement,
        relicContext: ctx, caches: avecCaches ? caches : null,
      });
      const e = entree(true);
      const attendu = brut(e, exacte, sorts, min);
      const lieu = `${sc.nom} · build ${i}`;
      // Le relâchement est sûr : un build faisable passe l'exigence des runes.
      const stats = computeStats({ ...e.gear, artifacts: [] });
      const passeRunes = (requirement.minStats.acc ?? 0) <= precisionJugee(stats, requirement, aurasPropresDesRunes(b));
      if (attendu.faisable && !passeRunes) relachementFaux++;
      if (!passeRunes) return; // la recherche de runes ne l'aurait pas transmis
      const app = resoudre(() => resoudreEquipementDuBuild(e));
      const exhaustif = resoudre(() => resoudreEquipementDuBuildExhaustif(entree(false)));
      compares++;
      if (!('r' in app) || !('r' in exhaustif)) {
        ecarts.push(`${lieu} : erreur ${JSON.stringify([app, exhaustif]).slice(0, 160)}`);
        return;
      }
      if (app.r.conforme !== attendu.faisable) ecarts.push(`${lieu} : conforme ${app.r.conforme}, balayage brut ${attendu.faisable}`);
      if (app.r.conforme !== exhaustif.r.conforme) ecarts.push(`${lieu} : app ≠ exhaustif sur le verdict`);
      if (app.r.conforme && !isDeepStrictEqual(app, exhaustif)) ecarts.push(`${lieu} : app ≠ exhaustif`);
      const confirmation = confirmerEquipementDuBuild(entree(true));
      if (confirmation.conforme !== app.r.conforme) ecarts.push(`${lieu} : confirmation ${confirmation.conforme} ≠ résolution ${app.r.conforme}`);
      if (app.r.conforme) {
        conformes++;
        const pre = precisionJugee(computeStats(e.gear), exacte, aurasPropresDesRunes(b));
        if (!sorts.every((s) => precisionDuSort(pre, app.r.artefacts, s) >= min - 1e-6)) ecarts.push(`${lieu} : paire retenue sous le minimum d’un sort`);
        if (pre < min) tenusParLaLigne++;
        if (sc.regime !== 'aucun' && app.r.paire!.score !== attendu.meilleure) {
          ecarts.push(`${lieu} : note ${app.r.paire!.score}, meilleure du balayage brut ${attendu.meilleure}`);
        }
      }
    });
  });
  egal(relachementFaux, 0, 'le minimum relâché des runes ne rejette aucun build faisable');
  egal(ecarts.slice(0, 8), [], `${compares} résolutions sur ${SCENARIOS.length} scénarios : verdict du balayage brut, meilleure note, app = exhaustif = confirmation, chaque sort tenu`);
  ok(conformes > 40, `des builds conformes (${conformes})`);
  ok(tenusParLaLigne >= 8, `des builds dont la fiche reste sous le minimum, tenus par la ligne du sort (${tenusParLaLigne})`);

  titre('Précision par sort — la pièce du sort contre la pièce des PV');
  {
    // Fiche à 70 de Précision, 85 exigés sur S1 : seule la pièce ATQ (407 à
    // 20) tient le sort, seule la pièce PV tient le minimum de PV. Le
    // relâchement laisse passer le build (85 − 20 = 65), la résolution le rejette.
    const runes = build(mulberry32(77), 0).map((r) => ({ ...r, subs: r.subs.filter((x) => x.code !== 12), main: r.main.code === 12 ? { code: 1, value: 100 } : r.main }));
    const sansPre = total(runes, 'acc');
    const runesPre = runes.map((r, i) => (i === 0 ? { ...r, subs: [...r.subs, { code: 12, value: 70 - sansPre }] } : r));
    const hp = total(runesPre, 'hp');
    const atq: ArtifactDetail = { id: 1, kind: 'archetype', archetype: 'attack', level: 15, rarity: 5, main: { code: 101, value: 100 }, subs: [{ code: 407, value: 20 }] };
    const pv: ArtifactDetail = { id: 2, kind: 'archetype', archetype: 'attack', level: 15, rarity: 5, main: { code: 100, value: 1500 }, subs: [] };
    const resoudreAvec = (minHp: number | undefined) => {
      const exacte: BuildRequirement = { sets: [], minStats: { acc: 85, ...(minHp ? { hp: minHp } : {}) }, auraResPre: { res: 0, acc: 0, compter: false } };
      const artifactParams = parametresArtefactsFiche({
        porteur: PORTEUR, inventaire: [atq, pv], reserves: new Set(), equipes: [], optimiserArtefacts: true, principaleParSorte: {},
        lignesVerrouillees: [], damageSetup: DEFAULT_DAMAGE_SETUP, maxStats: {}, sortDegats: null, speedTune: null, sortsPrecision: [1],
      });
      const requirement = exigencePrecisionParSort(exacte, [1], candidatsParSorte(artifactParams, 'archetype'));
      return { requirement, r: resoudreEquipementDuBuild(entreeResolutionDuBuild({
        fiche: { base: BASE, runes: [], artifacts: [] }, runes: runesPre, artifactParams, regime: 'aucun', degats: null,
        exclusive: EXCLUSIVE, requirement, relicContext: undefined, caches: null,
      })) };
    };
    egal(total(runesPre, 'acc'), 70, 'fiche à 70 de Précision');
    const seul = resoudreAvec(undefined);
    egal([seul.requirement.minStats.acc, seul.r.conforme, seul.r.artefacts.map((a) => a.id)], [65, true, [1]], 'sans minimum de PV : la pièce du sort, conforme');
    egal(resoudreAvec(hp + 1000).r.conforme, false, 'minimum de PV qui exige la pièce PV : rejeté par la précision du sort');
  }

  titre('Précision par sort — producteur, signature, recette et CLI');
  {
    const base = {
      porteur: PORTEUR, inventaire: [], reserves: new Set<number>(), equipes: [], optimiserArtefacts: true, principaleParSorte: {},
      lignesVerrouillees: [], damageSetup: DEFAULT_DAMAGE_SETUP, maxStats: {}, sortDegats: null, speedTune: null,
    };
    egal(parametresArtefactsFiche({ ...base, sortsPrecision: [1, 3] }).codesIncomparables, [407, 409], 'producteur : les lignes des sorts incomparables');
    ok(!('codesIncomparables' in parametresArtefactsFiche({ ...base, sortsPrecision: [] })), 'producteur sans sort : aucun champ ajouté');

    const sig = (requirement: BuildRequirement) => signatureReglages({
      monstreCom2usId: 1, damageSetup: DEFAULT_DAMAGE_SETUP, objective: 'aucun', ignoreArtifacts: false, principaleParSorte: {},
      lignesVerrouillees: [], relique: null, nbArtefacts: 3, empreinteRelique: null, requirement, artefactsReserves: [],
      piecesFigees: [], importDuCompte: 0, empreinteSpeedTune: null, runesMaxees: false,
    });
    const r1: BuildRequirement = { sets: [], minStats: { acc: 60 }, precisionParSort: { sorts: [1], min: 80 } };
    ok(sig(r1) !== sig({ ...r1, precisionParSort: { sorts: [3], min: 80 } }), 'signature : un autre sort, même relâchement, autre cache');
    egal(sig({ sets: [], minStats: { acc: 60 } }).includes('precision:'), false, 'signature sans précision par sort : celle d’avant');

    const recette = (r: Partial<OptimizerRecipe>) => buildOptimizerRecipe({
      monsterCom2usId: 14714, monsterName: 'test', requirement: { sets: [], minStats: { acc: 85 } }, objective: 'efficience',
      damageSetup: DEFAULT_DAMAGE_SETUP, metric: 'eff', slotFilterPreset: 'bas', exhaustiveSearch: false,
      excludeUsedRunes: false, excludeUsedScope: 'rta', excludedSelectors: [], ignoreArtifacts: false,
      artifactMainByKind: {}, relicMainChoice: 'equipped', ...r,
    });
    egal(parseOptimizerRecipe(JSON.stringify(recette({ sortsPrecision: [1, 3] })), fr).recipe?.sortsPrecision, [1, 3], 'recette : les sorts reviennent tels quels');
    egal(parseOptimizerRecipe(JSON.stringify(recette({})), fr).recipe?.sortsPrecision, undefined, 'recette sans eux : celle d’avant');
    const refusee = parseOptimizerRecipe(JSON.stringify({ ...recette({}), sortsPrecision: [4] }), fr);
    ok(refusee.recipe === null && !!refusee.error?.includes('sortsPrecision'), 'un sort hors S1–S3 : recette refusée, le champ nommé');

    const piece: ArtifactDetail = { id: 1, kind: 'archetype', archetype: 'attack', level: 15, rarity: 5, main: { code: 101, value: 100 }, subs: [{ code: 409, value: 20 }] };
    const cli = exigenceDeLaRecette(recette({ sortsPrecision: [3] }), [null, piece]);
    egal([cli.minStats.acc, cli.precisionParSort], [65, { sorts: [3], min: 85 }], 'CLI : le même relâchement que l’écran, la condition exacte portée');
    egal(exigenceDeLaRecette(recette({}), [null, piece]).precisionParSort, undefined, 'CLI sans sorts : l’exigence d’avant');
  }

  titre('Précision par sort — branchement de l’écran');
  {
    const src = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
    ok(src.includes('exigencePrecisionParSort(exigenceSpeedTune ?? requirementSansSpeedTune, sortsPrecision, piecesTypePrecision)'),
      'l’exigence envoyée au moteur passe par le producteur, sur les candidats du Type');
    ok(src.includes('sortsPrecision: sortsPrecisionEnJeu'), 'les paramètres de la paire reçoivent les sorts en jeu');
    egal((src.match(/sortsPrecision=\{sortsPrecision\}/g) ?? []).length, 2, 'les pastilles aux deux formats (téléphone et bureau)');
    ok(src.includes('...(sortsPrecision.length > 0 ? { sortsPrecision } : {})'), 'export de la recette : les sorts, omis s’il n’y en a pas');
    ok(src.includes('sortsPrecision: normaliserSortsPrecision(recipe.sortsPrecision ?? [])'), 'import de la recette : repli sur aucun sort');
  }
}
