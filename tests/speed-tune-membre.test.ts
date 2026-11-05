// Le speed tune vu de l'Optimizer (src/lib/speedTuneMembre.ts) : adaptateur
// d'un équipement, lignes de l'équipe, verdict, écarts, recalcul et
// restauration, détachement.
// Spec : docs/02-app/optimizer/feat-contrainte-speed-tune.md.
import { isDeepStrictEqual } from 'node:util';
import type { ArtifactDetail, GearSet, Monster, RuneDetail } from '../src/types';
import type { DonneesKit } from '../src/lib/speedTuneAuto';
import { ligneVierge, type Ligne } from '../src/lib/speedTuneLignes';
import { combatSousPlan, planDepuisSpeedTune, type PlanSpeedTune } from '../src/lib/planSpeedTune';
import type { SpeedTuneEquipe } from '../src/lib/speedTuneEquipe';
import type { ExclusionSelector } from '../src/lib/optimizerExclusion';
import { computeStats } from '../src/lib/stats';
import {
  autresPour, avecRattachement, bornesDuMembre, criteresDetaches, ecartsDuPlan, entreesDuGear, gearDuBuildValide,
  ligneModifiee, lignesDeLEquipe, recalculerPlan, restaurerLigne, validationTient, verdictEquipe, type BuildDuMembre,
} from '../src/lib/speedTuneMembre';
import { egal, ok, titre } from './outils';

const monstre = (id: number, spd: number): Monster =>
  ({ id, com2usId: id, name: `M${id}`, element: 'wind', stats: { speed: spd } }) as unknown as Monster;
const A = monstre(9101, 105), B = monstre(9102, 100), C = monstre(9103, 102), E = monstre(9104, 110);
const bestiaire = new Map([A, B, C, E].map((m) => [m.id, m] as const));
const d: DonneesKit = { kits: new Map(), sorts: new Map(), passifs: new Map() };
const sa: ExclusionSelector = { source: 'box', unitKey: 'a' };
const sb: ExclusionSelector = { source: 'box', unitKey: 'b' };
const sc: ExclusionSelector = { source: 'box', unitKey: 'c' };

function plan(): PlanSpeedTune {
  const lignes: Ligne[] = [
    { ...ligneVierge(A, 'allie'), runeSpeed: 120 }, { ...ligneVierge(B, 'allie'), runeSpeed: 100, artefactBuff: 4 },
    { ...ligneVierge(C, 'allie'), runeSpeed: 80 }, { ...ligneVierge(E, 'ennemi'), runeSpeed: 60 },
  ];
  const r = planDepuisSpeedTune(lignes, { allie: null, ennemi: null }, {}, ['allie:9101', 'allie:9102', 'allie:9103'], d);
  if (!('plan' in r)) throw new Error(JSON.stringify(r.refus));
  return r.plan;
}
function speedTune(): SpeedTuneEquipe {
  return { plan: plan(), membres: [
    { uid: 'allie:9101', selector: sa, attache: true, repli: { vitesseMin: 225, effet206: 0 } },
    { uid: 'allie:9102', selector: sb, attache: true, repli: { vitesseMin: 200, effet206: 4 } },
    { uid: 'allie:9103', selector: sc, attache: false, repli: { vitesseMin: 182, effet206: 0 } },
  ] };
}
const rune = (id: number, slot: number, set: string, spd: number): RuneDetail =>
  ({ id, slot, set, rank: 6, rarity: 5, level: 15, main: { code: slot === 2 ? 8 : 1, value: slot === 2 ? spd : 100 },
    subs: slot === 2 ? [] : [{ code: 8, value: spd, grind: 0 }] });
const art = (id: number, kind: 'element' | 'archetype', v206: number): ArtifactDetail =>
  ({ id, kind, element: 'wind', archetype: 'attack', rarity: 5, level: 15, main: { code: 100, value: 100 }, subs: [{ code: 206, value: v206 }] });
const gear = (base: number, set: string, spd: number, arts: ArtifactDetail[] = []): GearSet => ({
  base: { hp: 1000, atk: 100, def: 100, spd: base, cr: 15, cd: 50, res: 15, acc: 0 },
  runes: [1, 2, 3, 4, 5, 6].map((s) => rune(s, s, set, spd)), artifacts: arts,
});

export function testSpeedTuneMembreAdaptateur() {
  titre('Speed tune · adaptateur d’un équipement');
  const g = gear(100, 'swift', 10, [art(1, 'element', 3), art(2, 'archetype', 5)]);
  const e = entreesDuGear(g), fiche = computeStats(g).find((s) => s.key === 'spd')!.total;
  egal(e, { runeSpeed: fiche - 100, swift: true, sets: ['swift'], artefactBuff: 8 }, 'fiche de computeStats, Rapidité activée, 206 sommé sur la paire');
  egal(entreesDuGear(gear(100, 'will', 10)).swift, false, 'sans Rapidité : Swift faux');
  const runes = new Map(g.runes.map((r) => [r.id, r] as const)), arts = new Map(g.artifacts.map((a) => [a.id, a] as const));
  ok(isDeepStrictEqual(gearDuBuildValide(g.base, [1, 2, 3, 4, 5, 6], [1, 2], runes, arts), g), 'build complet : exploitable');
  egal(gearDuBuildValide(g.base, [1, 2, 3, 4, 5, 7], [1, 2], runes, arts), null, 'rune vendue : inexploitable');
  egal(gearDuBuildValide(g.base, [1, 2, 3, 4, 5, 6], [1, 9], runes, arts), null, 'artéfact absent : inexploitable');
  ok(gearDuBuildValide(g.base, [1, 2, 3, 4, 5, 6], [0, 0], runes, arts) !== null, 'aucun artéfact : exploitable');
}

export function testSpeedTuneMembreLignes() {
  titre('Speed tune · lignes de l’équipe, verdict, validation');
  const st = speedTune(), p = st.plan!;
  const builds = new Map<string, BuildDuMembre>([['box:a', { entrees: { runeSpeed: 120, swift: false, sets: [], artefactBuff: 0 } }], ['box:b', 'inexploitable']]);
  const buildDe = (s: ExclusionSelector) => builds.get(`${s.source}:${(s as { unitKey: string }).unitKey}`) ?? null;
  const lignes = lignesDeLEquipe(st, p, [sa, sb], buildDe);
  egal(lignes.map((l) => l.origine), ['build', 'inexploitable', 'sans-membre'], 'build validé, build non exploitable, membre retiré');
  egal([...autresPour(lignes, 'allie:9102').keys()], ['allie:9101'], 'autres lignes : les builds exploitables seulement');
  egal(verdictEquipe(p, d, bestiaire, lignes), { etat: 'incomplet', tient: true, lignes: ['allie:9102'] }, 'ligne sans build exploitable : incomplet');
  const complet = lignesDeLEquipe(st, p, [sa, sb, sc], (s) => ({ entrees: { runeSpeed: s === sa ? 120 : s === sb ? 100 : 80, swift: false, sets: [], artefactBuff: s === sb ? 4 : 0 } }));
  egal(verdictEquipe(p, d, bestiaire, complet), { etat: 'tenu' }, 'tous les builds aux valeurs du plan : tenu');
  const casse = verdictEquipe(p, d, bestiaire, complet.map((l) => (l.uid === 'allie:9103' ? { ...l, entrees: { ...l.entrees!, runeSpeed: 200 } } : l)));
  ok(casse.etat === 'casse' && casse.probleme !== null, 'un build trop rapide : cassé, premier allié en défaut nommé');
  ok(validationTient(p, d, bestiaire, complet, 'allie:9103', { runeSpeed: 80, swift: false, sets: [], artefactBuff: 0 }), 'valider aux valeurs du plan : tenu');
  ok(!validationTient(p, d, bestiaire, complet, 'allie:9103', { runeSpeed: 200, swift: false, sets: [], artefactBuff: 0 }), 'valider plus vite que le premier : cassé');
}

export function testSpeedTuneMembreEcarts() {
  titre('Speed tune · écarts, recalcul, restauration');
  const st = speedTune(), p = st.plan!;
  const porte = { runeSpeed: 104, swift: false, sets: ['violent'], artefactBuff: 6 };
  const lignes = lignesDeLEquipe(st, p, [sa, sb, sc], (s) => (s === sb ? 'inexploitable' : null));
  const ecarts = ecartsDuPlan(p, d, bestiaire, lignes, (s) => (s === sa ? porte : s === sc ? { runeSpeed: 80, swift: false, sets: p.lignes[2]!.sets, artefactBuff: 0 } : porte));
  egal(ecarts.map((e) => [e.uid, e.source]), [['allie:9101', 'equipement']], 'écart sur l’équipement porté ; ni ligne identique ni build inexploitable');
  const [e] = ecarts;
  egal([e!.combatPlan, e!.artePlan, e!.arteOptimizer], [combatSousPlan(p, d, bestiaire, 'allie:9101'), 0, 6], 'valeurs du plan et de l’Optimizer');
  const apres = recalculerPlan(st, d, bestiaire, ecarts);
  egal(combatSousPlan(apres.plan!, d, bestiaire, 'allie:9101'), e!.combatOptimizer, 'après « Recalculer », le plateau donne exactement la valeur affichée');
  egal(apres.membres[0]!.repli, { vitesseMin: 105 + 104, effet206: 6 }, 'les valeurs de repli suivent le recalcul');
  ok(ligneModifiee(apres.plan!, 'allie:9101') && !ligneModifiee(apres.plan!, 'allie:9102'), 'la ligne recalculée est marquée modifiée');
  ok(apres.plan!.origine === p.origine, 'l’origine du speed tuning ne bouge pas');
  const rendu = restaurerLigne(apres, d, bestiaire, 'allie:9101');
  ok(isDeepStrictEqual(rendu.plan!.lignes, p.lignes), '« Restaurer » rend exactement les entrées d’origine');
  egal(rendu.membres[0]!.repli, { vitesseMin: 225, effet206: 0 }, 'et les valeurs de repli d’origine');
}

export function testSpeedTuneMembreBornesEtDetachement() {
  titre('Speed tune · bornes du balayage, détacher et rattacher');
  const pool = [rune(1, 1, 'swift', 10), rune(2, 1, 'swift', 25), rune(3, 2, 'swift', 42), rune(4, 4, 'will', 7)];
  egal(bornesDuMembre(100, pool, false, 30), { ficheMax: { sansSwift: 174, swift: 199 }, etatsSwift: [false, true], arteMax: 30 },
    'meilleure VIT par emplacement, bonus Rapidité dans l’état Swift seul');
  egal(bornesDuMembre(101, [], true, -1).etatsSwift, [true], 'Rapidité imposée : un seul état');
  egal(bornesDuMembre(101, [], true, -1).ficheMax.swift, 101 + 26, 'bonus plat Rapidité arrondi au supérieur');
  const st = speedTune();
  const detache = avecRattachement(st, 'allie:9101', false);
  egal(detache.membres.map((m) => m.attache), [false, true, false], 'détacher ne touche que son lien');
  ok(detache.plan === st.plan, 'le plan reste sur l’équipe');
  egal(criteresDetaches(st.membres[1]!), { vitesseMin: 200, verrou206: 4 }, 'repli : VIT minimum et verrou positif');
  egal(criteresDetaches(st.membres[0]!), { vitesseMin: 225, verrou206: null }, 'repli : aucun verrou à 0');
}
