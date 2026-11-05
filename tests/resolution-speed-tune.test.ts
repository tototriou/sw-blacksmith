// La contrainte de speed tune dans la résolution de l'équipement
// (src/lib/contrainteSpeedTune.ts, `entreeResolutionDuBuild`, relicQueue.ts) :
// la paire d'un build ne se choisit que parmi celles dont le cumul 206 tombe
// dans une classe de la zone admissible pour SA VIT de fiche et SON état de
// Swift, ses sets tenant la précondition des cumuls.
//
// Référence de contrôle (`algo-verify`) : un balayage BRUT de toutes les
// paires de la vue complète (`candidatsParSorte` des deux sortes, emplacement
// vide compris, sans aucun préfiltre ni dominance), contrainte de paire,
// verrous, conditions et zone jugés à la main. Verdict identique, et, hors
// régime `aucun`, la note retenue est la plus haute de ce balayage. La
// résolution rapide (chemin de l'app) rend aussi exactement le calcul
// exhaustif et la confirmation sans note le même verdict, comme sans
// contrainte (`testResolutionRapide`).
//
// Pools à graine fixe : runes tirées au hasard, une partie des builds forcés
// en Rapidité, inventaire où le 206 est fréquent et de valeurs variées, zones
// tirées autour des VIT de fiche des builds, sets admis tirés.

import { isDeepStrictEqual } from 'node:util';
import { ArtifactArchetype, ArtifactDetail, ArtifactKind, BaseStats, ElementKey, RelicDetail, RuneDetail } from '../src/types';
import { ARTIFACT_SUB_MAX, artifactPairAllowed } from '../src/lib/artifacts';
import { activeSets, artifactSubKinds } from '../src/lib/effects';
import { computeStats } from '../src/lib/stats';
import { BuildRequirement, respecteConditionsAvecRelique } from '../src/lib/runeBuildOptim';
import { RelicContext, resoudreContexteRelique } from '../src/lib/relicOptim';
import { RegimeArtefacts } from '../src/lib/artifactEvaluation';
import {
  ArtifactSearchParams,
  LigneVerrouillee,
  analyserPertinence,
  candidatsParSorte,
  paireRespecteLignes,
  preFiltrerCandidats,
} from '../src/lib/artifactOptim';
import { parametresArtefactsFiche } from '../src/lib/artifactFiche';
import { EntreeResolution, entreeResolutionDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { confirmerEquipementDuBuild } from '../src/lib/resolutionRapide';
import { resoudreEquipementDuBuildExhaustif } from '../src/lib/resolutionExhaustive';
import {
  CODE_206,
  ContrainteSpeedTune,
  SetsCumuls,
  ZoneMembre,
  dansZone,
  exigenceSousSpeedTune,
  lignesBorneesDuBuild,
  setsTenus,
} from '../src/lib/contrainteSpeedTune';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { ResultatArtefacts } from '../src/lib/artifactQueue';
import { mulberry32, randomRune, SETS_VARIES } from '../scripts/lib/randomPool';
import { egal, ok, titre } from './outils';

const PORTEUR = { element: 'fire' as ElementKey, archetype: 'attack' as ArtifactArchetype };
const BASE: BaseStats = { hp: 9000, atk: 650, def: 550, spd: 101, cr: 15, cd: 50, res: 15, acc: 0 };
const EXCLUSIVE = { setup: DEFAULT_DAMAGE_SETUP, element: null };

// Inventaire éligible : le 206 sur six pièces sur dix, de 1 au plafond d'une
// pièce, quelques Intangibles, principales variées.
function inventaire(rng: () => number, parSorte: number): ArtifactDetail[] {
  const codesDe = (kind: ArtifactKind) =>
    Object.keys(ARTIFACT_SUB_MAX).map(Number).filter((c) => c !== CODE_206 && artifactSubKinds(c).includes(kind));
  const pieces: ArtifactDetail[] = [];
  let id = 7000;
  for (const kind of ['element', 'archetype'] as ArtifactKind[]) {
    const codes = codesDe(kind);
    for (let i = 0; i < parSorte; i++) {
      const choisis = new Set<number>();
      if (rng() < 0.6) choisis.add(CODE_206);
      while (choisis.size < 4) choisis.add(codes[Math.floor(rng() * codes.length)]!);
      const mainCode = [100, 101, 102][Math.floor(rng() * 3)]!;
      const valeurs = mainCode === 100 ? [900, 1200, 1500] : [60, 80, 100];
      pieces.push({
        id: id++, kind, ...(kind === 'element' ? { element: 'fire' as const } : { archetype: 'attack' as const }),
        level: 15, rarity: 5, main: { code: mainCode, value: valeurs[Math.floor(rng() * 3)]! },
        subs: [...choisis].map((code) => ({
          code,
          value: code === CODE_206
            ? 1 + Math.floor(rng() * ARTIFACT_SUB_MAX[CODE_206]!)
            : Math.max(1, Math.round(rng() * ARTIFACT_SUB_MAX[code]! * 10) / 10),
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

// Un build sur trois forcé en Rapidité (quatre pièces), les autres au hasard :
// Volonté et Bouclier y tombent souvent.
function build(rng: () => number, id0: number): RuneDetail[] {
  const runes = [1, 2, 3, 4, 5, 6].map((slot) => randomRune(id0 + slot, slot, rng, SETS_VARIES));
  if (rng() < 0.34) for (let i = 0; i < 4; i++) runes[i] = { ...runes[i]!, set: 'swift' };
  return runes;
}

const ficheSpd = (runes: RuneDetail[]) => computeStats({ base: BASE, runes, artifacts: [] }).find((s) => s.key === 'spd')!.total;
const total = (runes: RuneDetail[], k: string) => computeStats({ base: BASE, runes, artifacts: [] }).find((s) => s.key === k)!.total;
const cumul206 = (arts: ArtifactDetail[]) =>
  arts.reduce((n, a) => n + a.subs.filter((s) => s.code === CODE_206).reduce((m, s) => m + s.value, 0), 0);

// Une zone tirée autour des VIT de fiche des builds : des classes qui
// partitionnent 0..12, et pour chacune quelques intervalles courts autour de
// fiches tirées. Les deux états de Swift, ou un seul.
function zone(rng: () => number, fiches: number[]): ZoneMembre {
  const bornes = [0];
  while (bornes[bornes.length - 1]! < 12) bornes.push(bornes[bornes.length - 1]! + 1 + Math.floor(rng() * 4));
  const etats = rng() < 0.2 ? [rng() < 0.5] : [false, true];
  return {
    uid: 'm', base: BASE.spd, axeArtefact: true,
    parSwift: etats.map((swift) => ({
      swift,
      classes: bornes.slice(0, -1).map((min, i) => {
        const intervalles: [number, number][] = [];
        for (const f of fiches) if (rng() < 0.35) intervalles.push([f - Math.floor(rng() * 3), f + Math.floor(rng() * 3)]);
        intervalles.sort((a, b) => a[0] - b[0]);
        return { arteMin: min, arteMax: Math.min(12, bornes[i + 1]! - 1), intervalles };
      }),
    })),
  };
}

function setsAdmisTires(rng: () => number): SetsCumuls[] {
  const out: SetsCumuls[] = [];
  for (const will of [false, true]) for (const shield of [false, true]) if (rng() < 0.75) out.push({ will, shield });
  return out.length ? out : [{ will: false, shield: false }];
}

interface Scenario {
  nom: string;
  regime: RegimeArtefacts;
  intention: 'recherche' | 'equipped' | 'off' | null;
  artefacts: 'libre' | 'fige' | 'verrous';
  maximums: boolean;
}

const SCENARIOS: Scenario[] = [];
for (const regime of ['aucun', 'atk', 'ehp'] as RegimeArtefacts[])
  for (const intention of ['recherche', 'equipped', null] as const)
    for (const artefacts of ['libre', 'fige', 'verrous'] as const)
      for (const maximums of [false, true])
        SCENARIOS.push({ nom: `${regime} · relique ${intention ?? 'sans contexte'} · ${artefacts}${maximums ? ' · maximums' : ''}`, regime, intention, artefacts, maximums });

type Issue = { r: ResultatArtefacts } | { erreur: string };
function resoudre(f: () => ResultatArtefacts): Issue {
  try {
    return { r: f() };
  } catch (e) {
    return { erreur: `${(e as Error).name} ${(e as Error).message}` };
  }
}

// Le balayage brut : toutes les paires de la vue complète, pour chaque relique
// qu'essaie la résolution, jugées sur tout à la main.
function brut(e: EntreeResolution, c: ContrainteSpeedTune, lignes: LigneVerrouillee[]) {
  const recherche = e.relicContext?.mode === 'recherche';
  const reliquesEssayees = recherche ? e.relicContext!.eligibles : [e.gear.relic];
  const fiche = ficheSpd(e.gear.runes);
  const sets = activeSets(e.gear.runes.map((r) => r.set));
  let meilleure = -Infinity;
  let faisable = false;
  for (const relique of reliquesEssayees) {
    const p = e.faireParams(relique);
    // L'emplacement vide toujours, comme le préfiltre le rajoute (même
    // sous « Comme équipé », où `candidatsParSorte` ne le rend pas).
    const avecVide = (l: (ArtifactDetail | null)[]) => [null, ...l.filter((a) => a != null)];
    const elements = avecVide(candidatsParSorte(p, 'element'));
    const archetypes = avecVide(candidatsParSorte(p, 'archetype'));
    for (const el of elements)
      for (const ar of archetypes) {
        if (!artifactPairAllowed(el, ar)) continue;
        const paire = [el, ar].filter((a): a is ArtifactDetail => a != null);
        if (!paireRespecteLignes(paire, lignes)) continue;
        if (!setsTenus(c, sets) || !dansZone(c.zone, fiche, sets.includes('swift'), cumul206(paire))) continue;
        const conditions = recherche
          ? respecteConditionsAvecRelique({ ...e.gear, artifacts: paire }, relique, e.requirement).respecte
          : !e.respecteConditions || e.respecteConditions(paire);
        if (!conditions) continue;
        faisable = true;
        meilleure = Math.max(meilleure, p.evaluer(paire));
      }
  }
  return { faisable, meilleure };
}

export default function testResolutionSpeedTune() {
  titre('Contrainte de speed tune à la résolution — la paire tient la zone, contre un balayage brut');
  let compares = 0;
  let conformes = 0;
  let rejetes = 0;
  let rejetesParLaZone = 0;
  const ecarts: string[] = [];
  SCENARIOS.forEach((sc, iScenario) => {
    const rng = mulberry32(9100 + iScenario);
    const inv = inventaire(rng, 7);
    const reliquesInv = reliques(rng, 4);
    const portee = reliquesInv[0]!;
    const builds = Array.from({ length: 16 }, (_, i) => build(rng, 100 * i));
    const contrainte: ContrainteSpeedTune = { version: 1, zone: zone(rng, builds.map(ficheSpd)), setsAdmis: setsAdmisTires(rng) };
    const mediane = (k: string) => builds.map((b) => total(b, k)).sort((a, b) => a - b)[Math.floor(builds.length / 2)]!;
    const requirement: BuildRequirement = {
      sets: [],
      minStats: { hp: Math.round(mediane('hp') * 0.97), atk: Math.round(mediane('atk') * 0.97) },
      maxStats: sc.maximums ? { atk: Math.round(mediane('atk') * 1.3) } : {},
      auraResPre: { res: 0, acc: 0, compter: true },
    };
    const element = inv.find((a) => a.kind === 'element')!;
    const lignes: LigneVerrouillee[] = sc.artefacts === 'verrous'
      ? [{ code: inv.find((a) => a.kind === 'archetype')!.subs.find((s) => s.code !== CODE_206)!.code, min: 1 }]
      : [];
    // Le producteur unique : il pose `codesIncomparables` et porte la contrainte.
    const artifactParams = parametresArtefactsFiche({
      porteur: PORTEUR, inventaire: inv, reserves: new Set(), equipes: [element], optimiserArtefacts: true,
      principaleParSorte: sc.artefacts === 'fige' ? { element: 'equipped' } : {},
      lignesVerrouillees: [...lignes, { code: CODE_206, min: 3 }],
      damageSetup: DEFAULT_DAMAGE_SETUP, maxStats: requirement.maxStats ?? {}, sortDegats: null, speedTune: contrainte,
    });
    const ctx: RelicContext | undefined = sc.intention
      ? resoudreContexteRelique({ mode: sc.intention, principale: 'libre', type: 'libre', seuil: 0 }, portee, reliquesInv)
      : undefined;
    const fiche = { base: BASE, runes: [], artifacts: [element], relic: portee };
    const caches = nouveauxCachesResolution();
    builds.forEach((b, i) => {
      const entree = (avecCaches: boolean) => entreeResolutionDuBuild({
        fiche, runes: b, artifactParams, regime: sc.regime, degats: null, exclusive: EXCLUSIVE, requirement,
        relicContext: ctx, caches: avecCaches ? caches : null,
      });
      const e = entree(true);
      const app = resoudre(() => resoudreEquipementDuBuild(e));
      const exhaustif = resoudre(() => resoudreEquipementDuBuildExhaustif(entree(false)));
      const attendu = brut(e, contrainte, lignes);
      compares++;
      const lieu = `${sc.nom} · build ${i}`;
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
        const s = activeSets(b.map((r) => r.set));
        if (!dansZone(contrainte.zone, ficheSpd(b), s.includes('swift'), cumul206(app.r.artefacts))) ecarts.push(`${lieu} : paire retenue hors zone`);
        if (sc.regime !== 'aucun' && app.r.paire!.score !== attendu.meilleure) {
          ecarts.push(`${lieu} : note ${app.r.paire!.score}, meilleure du balayage brut ${attendu.meilleure}`);
        }
      } else {
        rejetes++;
        // Rejeté par la zone seule : la même entrée sans contrainte est conforme.
        const libre = { ...artifactParams, speedTune: undefined, codesIncomparables: undefined };
        const sans = resoudreEquipementDuBuild(entreeResolutionDuBuild({
          fiche, runes: b, artifactParams: libre, regime: sc.regime, degats: null, exclusive: EXCLUSIVE, requirement, relicContext: ctx, caches: null,
        }));
        if (sans.conforme) rejetesParLaZone++;
      }
    });
  });
  egal(ecarts.slice(0, 8), [], `${compares} résolutions sur ${SCENARIOS.length} scénarios : verdict du balayage brut, meilleure note, app = exhaustif = confirmation, paire dans la zone`);
  ok(conformes > 40 && rejetes > 40, `des builds conformes (${conformes}) et rejetés (${rejetes})`);
  ok(rejetesParLaZone > 20, `des builds rejetés par la seule zone (${rejetesParLaZone}), conformes sans elle`);

  titre('Contrainte de speed tune — préfiltre, producteur et critères');
  {
    // Deux pièces identiques sauf le 206 : sans incomparabilité, la plus
    // faible est dominée (même principale, 206 non pertinent pour la note) ;
    // avec, les deux survivent — la paire qui tient la zone peut être la faible.
    const piece = (id: number, v: number): ArtifactDetail => ({
      id, kind: 'element', element: 'fire', level: 15, rarity: 5, main: { code: 101, value: 100 },
      subs: [{ code: CODE_206, value: v }, { code: 210, value: 3 }],
    });
    const faible = piece(1, 2);
    const forte = piece(2, 5);
    const p: ArtifactSearchParams = { porteur: PORTEUR, inventaire: [faible, forte], equipes: [], principaleParSorte: {}, evaluer: () => 1 };
    const pert = analyserPertinence(p);
    const sans = preFiltrerCandidats(candidatsParSorte(p, 'element'), 'element', [], pert);
    egal(sans.filter((a) => a != null).length, 1, 'sans code incomparable : une des deux pièces est dominée');
    const avec = preFiltrerCandidats(candidatsParSorte(p, 'element'), 'element', [], pert, undefined, false, [CODE_206]);
    egal(avec.filter((a) => a != null).map((a) => a!.id), [1, 2], '206 incomparable : les deux survivent');
  }
  {
    const c: ContrainteSpeedTune = {
      version: 1, setsAdmis: [{ will: false, shield: false }],
      zone: { uid: 'm', base: 101, axeArtefact: true, parSwift: [{ swift: false, classes: [{ arteMin: 0, arteMax: 4, intervalles: [[180, 190]] }, { arteMin: 5, arteMax: 12, intervalles: [[200, 210]] }] }] },
    };
    const base = {
      porteur: PORTEUR, inventaire: [], reserves: new Set<number>(), equipes: [], optimiserArtefacts: true, principaleParSorte: {},
      lignesVerrouillees: [{ code: CODE_206, min: 4 }, { code: 210, min: 2 }], damageSetup: DEFAULT_DAMAGE_SETUP, maxStats: {}, sortDegats: null,
    };
    const avec = parametresArtefactsFiche({ ...base, speedTune: c });
    egal([avec.codesIncomparables, avec.lignesVerrouillees, avec.speedTune === c], [[CODE_206], [{ code: 210, min: 2 }], true],
      'producteur : 206 incomparable, son verrou retiré, la contrainte portée');
    const sans = parametresArtefactsFiche({ ...base, speedTune: null });
    ok(!('codesIncomparables' in sans) && !('speedTune' in sans), 'producteur sans contrainte : aucun champ ajouté');
    egal(sans.lignesVerrouillees, base.lignesVerrouillees, '… et les verrous d’avant');

    const req: BuildRequirement = { sets: [], minStats: { spd: 230, atk: 900 }, maxStats: { spd: 205 } };
    egal(exigenceSousSpeedTune(req, c), { sets: [], minStats: { spd: 180, atk: 900 }, maxStats: { spd: 205 } },
      'critères : la VIT minimum devient le bas de l’enveloppe, la VIT maximum le plus serré des deux');
    egal(exigenceSousSpeedTune({ sets: [], minStats: {} }, c)?.maxStats, { spd: 210 }, '… sans maximum posé : le haut de l’enveloppe');
    egal(exigenceSousSpeedTune({ sets: [], minStats: {}, maxStats: { spd: 150 } }, c), null, '… maximum sous l’enveloppe : la recherche ne part pas');
    egal(exigenceSousSpeedTune(req, { ...c, setsAdmis: [] }), null, '… aucun set admis : la recherche ne part pas');

    const memo = new Map();
    const runes = (sets: string[]) => sets.map((set) => ({ set }));
    const b1 = lignesBorneesDuBuild(c, 185, runes(['violent', 'violent', 'violent', 'violent', 'focus', 'focus']).map((r) => r.set), memo);
    egal(b1, [{ code: CODE_206, plages: [{ min: 0, max: 4 }] }], 'bornes du build : la classe de sa fiche');
    ok(lignesBorneesDuBuild(c, 188, ['violent', 'violent', 'violent', 'violent', 'focus', 'focus'], memo) === b1, '… même objet pour les mêmes plages (mémoires de la file)');
    egal(lignesBorneesDuBuild(c, 185, ['will', 'will', 'violent', 'violent', 'violent', 'violent'])[0]!.plages, [], 'Volonté non admise : aucune plage');
    egal(lignesBorneesDuBuild(c, 185, ['swift', 'swift', 'swift', 'swift', 'focus', 'focus'])[0]!.plages, [], 'Rapidité : zone sans état Swift, aucune plage');
    egal(lignesBorneesDuBuild(c, 195, ['violent', 'violent', 'violent', 'violent', 'focus', 'focus'])[0]!.plages, [], 'fiche entre deux intervalles : aucune plage');

    // Une ligne bornée sans son code incomparable : une erreur, jamais un repli.
    const e = entreeResolutionDuBuild({
      fiche: { base: BASE, runes: [], artifacts: [] }, runes: build(mulberry32(3), 0),
      artifactParams: { porteur: PORTEUR, inventaire: [], equipes: [], principaleParSorte: {}, speedTune: c },
      regime: 'aucun', degats: null, exclusive: EXCLUSIVE, requirement: { sets: [], minStats: {} }, relicContext: undefined, caches: null,
    });
    const r = resoudre(() => resoudreEquipementDuBuild(e));
    ok('erreur' in r && r.erreur.includes('incomparable'), `contrainte sans code incomparable : la résolution lève (${JSON.stringify(r).slice(0, 120)})`);
  }
}
