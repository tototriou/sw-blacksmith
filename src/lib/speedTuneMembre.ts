// LE SPEED TUNE VU DE L'OPTIMIZER : ce que l'écran lit d'un plan pour un
// membre et pour son équipe, en calcul pur.
//
// Spec : docs/02-app/optimizer/feat-contrainte-speed-tune.md, « Entrées d'un
// build », « Les autres lignes », « Écart entre le plan et l'Optimizer »,
// « Verdict d'équipe » et « Détacher et rattacher ». La zone elle-même se
// calcule ailleurs, hors du fil de l'interface (`contrainteDuMembre`).

import type { ArtifactDetail, GearSet, RuneDetail } from '../types';
import { activeSets, canAddSet } from './effects';
import { computeStats } from './stats';
import { CODE_AMPLI_VIT } from './damage';
import type { ProblemeOrdre } from './speedTune';
import { cumulsEstimes, type DonneesKit } from './speedTuneAuto';
import {
  combatSousPlan, contexteTenu, entreesDeBuild, entreesDuPlan, gainsDeReference,
  type Bestiaire, type BornesZone, type EntreesLigne, type PlanSpeedTune,
} from './planSpeedTune';
import type { MembreLigne, SpeedTuneEquipe } from './speedTuneEquipe';
import { exclusionSelectorKey, type ExclusionSelector } from './optimizerExclusion';
import type { ZoneMembre } from './contrainteSpeedTune';

const CODE_VIT = 8;

// ─── Entrées d'un équipement ────────────────────────────────────────────────

// L'ADAPTATEUR d'un équipement complet : VIT de fiche de `computeStats`, sets
// activés par les runes, cumul 206 de la paire.
export function entreesDuGear(gear: GearSet): EntreesLigne {
  const fiche = computeStats(gear).find((s) => s.key === 'spd')?.total ?? gear.base.spd;
  const cumul = gear.artifacts.reduce((n, a) => n + (a.subs.find((s) => s.code === CODE_AMPLI_VIT)?.value ?? 0), 0);
  return entreesDeBuild(gear.base.spd, fiche, activeSets(gear.runes.map((r) => r.set)), cumul);
}

// Le build validé d'un membre, s'il est EXPLOITABLE : ses six runes et ses
// artéfacts encore dans le compte. `null` : il ne l'est pas.
export function gearDuBuildValide(
  base: GearSet['base'],
  runeIds: readonly number[],
  artifactIds: readonly number[] | undefined,
  runeById: ReadonlyMap<number, RuneDetail>,
  artifactById: ReadonlyMap<number, ArtifactDetail>
): GearSet | null {
  const runes = runeIds.map((id) => runeById.get(id));
  const ids = (artifactIds ?? []).filter((id) => id > 0);
  const artifacts = ids.map((id) => artifactById.get(id));
  if (runes.length !== 6 || runes.some((r) => !r) || artifacts.some((a) => !a)) return null;
  return { base, runes: runes as RuneDetail[], artifacts: artifacts as ArtifactDetail[] };
}

// ─── Les lignes de l'équipe ─────────────────────────────────────────────────

// D'où viennent les entrées retenues pour une ligne alliée.
export type OrigineLigne = 'build' | 'plan' | 'inexploitable' | 'sans-membre';

export interface LigneEquipe {
  uid: string;
  // Le membre de la ligne, s'il est encore dans l'équipe.
  membre: ExclusionSelector | null;
  lien: MembreLigne | null;
  origine: OrigineLigne;
  // Les entrées du build validé exploitable ; `null` : le plan s'applique.
  entrees: EntreesLigne | null;
}

// Ce que l'écran sait d'un membre : son build validé (exploitable ou non), ou
// rien. `entrees` : son adaptateur.
export type BuildDuMembre = { entrees: EntreesLigne } | 'inexploitable' | null;

export function lignesDeLEquipe(
  st: SpeedTuneEquipe,
  plan: PlanSpeedTune,
  members: readonly ExclusionSelector[],
  buildDe: (selector: ExclusionSelector) => BuildDuMembre
): LigneEquipe[] {
  const cles = new Set(members.map(exclusionSelectorKey));
  return plan.lignes.filter((l) => l.camp === 'allie').map((l) => {
    const lien = st.membres.find((m) => m.uid === l.uid) ?? null;
    const membre = lien && cles.has(exclusionSelectorKey(lien.selector)) ? lien.selector : null;
    if (!membre) return { uid: l.uid, membre: null, lien, origine: 'sans-membre', entrees: null };
    const b = buildDe(membre);
    if (b === 'inexploitable') return { uid: l.uid, membre, lien, origine: 'inexploitable', entrees: null };
    if (b) return { uid: l.uid, membre, lien, origine: 'build', entrees: b.entrees };
    return { uid: l.uid, membre, lien, origine: 'plan', entrees: null };
  });
}

// Les substitutions des lignes autres que `uid` : leurs builds validés
// exploitables, le plan ailleurs.
export function autresPour(lignes: readonly LigneEquipe[], uid: string | null): Map<string, EntreesLigne> {
  return new Map(lignes.filter((l) => l.uid !== uid && l.entrees).map((l) => [l.uid, l.entrees!] as const));
}

// ─── Bornes du balayage ─────────────────────────────────────────────────────

const vitesseDeRune = (r: RuneDetail) =>
  [r.main, r.innate, ...r.subs].reduce((n, e) => n + (e && e.code === CODE_VIT ? e.value + (e.grind ?? 0) : 0), 0);

// Le majorant de VIT de fiche (`base + Σ meilleure VIT par emplacement +
// bonus plat Rapidité`, ce dernier dans l'état Swift seulement) : il peut
// surestimer, jamais sous-estimer. `etatsSwift` : ceux que le combo de la
// recherche peut former (`etatsSwiftDuCombo`).
export function bornesDuMembre(base: number, pool: readonly RuneDetail[], etatsSwift: readonly boolean[], arteMax: number): BornesZone {
  const parSlot = new Map<number, number>();
  for (const r of pool) parSlot.set(r.slot, Math.max(parSlot.get(r.slot) ?? 0, vitesseDeRune(r)));
  const sansSwift = base + [...parSlot.values()].reduce((a, b) => a + b, 0);
  return {
    ficheMax: { sansSwift, swift: sansSwift + Math.ceil(base * 0.25) },
    etatsSwift: [...etatsSwift],
    arteMax: Math.max(0, arteMax),
  };
}

// Les états de Rapidité qu'un combo de recherche (multiset `activeSets`) peut
// former : imposée, elle seule ; sinon formable par les runes libres tant
// qu'un set de 4 tient encore à côté du combo ; plus de place, jamais.
export function etatsSwiftDuCombo(comboSets: readonly string[]): boolean[] {
  if (comboSets.includes('swift')) return [true];
  return canAddSet([...comboSets], 'swift') ? [false, true] : [false];
}

// L'empreinte du contexte d'une zone : la zone se garde sous elle et se
// recalcule quand elle change (spec, « Calcul et cache »).
export function empreinteContexteZone(
  plan: PlanSpeedTune, uid: string, autres: ReadonlyMap<string, EntreesLigne>, bornes: BornesZone, idKits: string
): string {
  return JSON.stringify([plan, uid, [...autres].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)), bornes, idKits]);
}

// ─── Verdict d'équipe ───────────────────────────────────────────────────────

export type VerdictEquipe =
  | { etat: 'tenu' }
  | { etat: 'casse'; probleme: ProblemeOrdre | null; cumuls: string[] }
  | { etat: 'incomplet'; tient: boolean; lignes: string[] };

export function verdictEquipe(
  plan: PlanSpeedTune, d: DonneesKit, monstres: Bestiaire, lignes: readonly LigneEquipe[]
): VerdictEquipe {
  const ctx = contexteTenu(plan, d, monstres, autresPour(lignes, null));
  if (!ctx.ok) return { etat: 'casse', probleme: ctx.probleme, cumuls: ctx.cumuls };
  const sansBuild = lignes.filter((l) => l.membre && l.origine !== 'build').map((l) => l.uid);
  return sansBuild.length ? { etat: 'incomplet', tient: true, lignes: sansBuild } : { etat: 'tenu' };
}

// « Valider » juge le contexte tenu avec les entrées réelles du build et les
// valeurs actuelles des autres lignes, sans passer par la zone.
export function validationTient(
  plan: PlanSpeedTune, d: DonneesKit, monstres: Bestiaire, lignes: readonly LigneEquipe[], uid: string, entrees: EntreesLigne
): boolean {
  const subs = autresPour(lignes, uid);
  subs.set(uid, entrees);
  return contexteTenu(plan, d, monstres, subs).ok;
}

// ─── Écarts entre le plan et l'Optimizer ────────────────────────────────────

export interface EcartLigne {
  uid: string;
  // Vitesses de combat, toutes deux sous le lead du plan.
  combatPlan: number | null;
  combatOptimizer: number | null;
  artePlan: number;
  arteOptimizer: number;
  // D'où viennent les valeurs de l'Optimizer.
  source: 'build' | 'equipement';
  // Les entrées que « Recalculer » écrit dans le plan.
  entrees: EntreesLigne;
}

const memesEntrees = (a: EntreesLigne, b: EntreesLigne) =>
  a.runeSpeed === b.runeSpeed && a.swift === b.swift && a.artefactBuff === b.artefactBuff
  && JSON.stringify(a.sets ?? null) === JSON.stringify(b.sets ?? null);

// Les écarts d'une équipe : pour chaque ligne avec membre, les entrées de son
// build validé exploitable, sinon de l'équipement porté (`portees`), comparées
// à celles du plan. Un build validé non exploitable ne propose rien.
export function ecartsDuPlan(
  plan: PlanSpeedTune, d: DonneesKit, monstres: Bestiaire, lignes: readonly LigneEquipe[],
  portees: (selector: ExclusionSelector) => EntreesLigne | null
): EcartLigne[] {
  const out: EcartLigne[] = [];
  for (const l of lignes) {
    if (!l.membre || l.origine === 'inexploitable') continue;
    const entrees = l.origine === 'build' ? l.entrees : portees(l.membre);
    const ligne = plan.lignes.find((p) => p.uid === l.uid)!;
    if (!entrees || memesEntrees(entrees, ligne)) continue;
    // La vitesse annoncée est celle du plan que le clic écrira : des sets qui
    // changent un gain de passif décalent aussi les cumuls photographiés.
    const recalcule = ecrireEntrees({ plan, membres: [] }, d, monstres, new Map([[l.uid, entrees]])).plan!;
    out.push({
      uid: l.uid,
      combatPlan: combatSousPlan(plan, d, monstres, l.uid),
      combatOptimizer: combatSousPlan(recalcule, d, monstres, l.uid),
      artePlan: ligne.artefactBuff,
      arteOptimizer: entrees.artefactBuff,
      source: l.origine === 'build' ? 'build' : 'equipement',
      entrees,
    });
  }
  return out;
}

// ─── Recalculer et restaurer ────────────────────────────────────────────────

// Écrit des entrées dans les lignes du plan. Quand les sets changent un gain
// de passif estimé, les cumuls photographiés se décalent de la différence
// d'estimation et la référence suit (spec, « Cumuls de passif et sets »).
function ecrireEntrees(
  st: SpeedTuneEquipe, d: DonneesKit, monstres: Bestiaire, parUid: ReadonlyMap<string, EntreesLigne & { cumulsPassif?: number }>
): SpeedTuneEquipe {
  const plan = st.plan;
  if (!plan) return st;
  const allies = (p: PlanSpeedTune) => entreesDuPlan(p, monstres).filter((e) => e.camp === 'allie');
  const avant = allies(plan);
  const lignes = plan.lignes.map((l) => {
    const e = parUid.get(l.uid);
    return e ? { ...l, runeSpeed: e.runeSpeed, swift: e.swift, sets: e.sets, artefactBuff: e.artefactBuff,
      ...(e.cumulsPassif !== undefined ? { cumulsPassif: e.cumulsPassif } : {}) } : l;
  });
  const apresSets = allies({ ...plan, lignes });
  const decale = lignes.map((l) => {
    if (l.camp !== 'allie' || parUid.get(l.uid)?.cumulsPassif !== undefined) return l;
    const a = avant.find((x) => x.id === l.uid), b = apresSets.find((x) => x.id === l.uid);
    if (!a || !b) return l;
    const delta = cumulsEstimes(b, apresSets, d) - cumulsEstimes(a, avant, d);
    return delta ? { ...l, cumulsPassif: Math.max(0, l.cumulsPassif + delta) } : l;
  });
  const nouveau = { ...plan, lignes: decale };
  const referenceGains = gainsDeReference(nouveau, d, monstres);
  const membres = st.membres.map((m) => {
    const e = parUid.get(m.uid);
    if (!e) return m;
    const base = monstres.get(plan.lignes.find((l) => l.uid === m.uid)!.monsterId)?.stats.speed;
    return { ...m, repli: { vitesseMin: base == null ? m.repli.vitesseMin : base + e.runeSpeed, effet206: Math.max(0, e.artefactBuff) } };
  });
  return { plan: { ...nouveau, referenceGains }, membres };
}

// « Recalculer avec N » (une ligne) ou « avec les valeurs de l'Optimizer »
// (tous les écarts) : les entrées de l'adaptateur, jamais la vitesse affichée.
export function recalculerPlan(st: SpeedTuneEquipe, d: DonneesKit, monstres: Bestiaire, ecarts: readonly EcartLigne[]): SpeedTuneEquipe {
  return ecrireEntrees(st, d, monstres, new Map(ecarts.map((e) => [e.uid, e.entrees] as const)));
}

// « Restaurer » : les entrées d'origine du speed tuning, cumuls compris.
export function restaurerLigne(st: SpeedTuneEquipe, d: DonneesKit, monstres: Bestiaire, uid: string): SpeedTuneEquipe {
  const o = st.plan?.origine[uid];
  return o ? ecrireEntrees(st, d, monstres, new Map([[uid, o]])) : st;
}

// La ligne a-t-elle quitté ses entrées d'origine ?
export function ligneModifiee(plan: PlanSpeedTune, uid: string): boolean {
  const o = plan.origine[uid], l = plan.lignes.find((x) => x.uid === uid);
  return !!o && !!l && (!memesEntrees(o, l) || o.cumulsPassif !== l.cumulsPassif);
}

// ─── Détacher et rattacher ──────────────────────────────────────────────────

export function avecRattachement(st: SpeedTuneEquipe, uid: string, attache: boolean): SpeedTuneEquipe {
  return { ...st, membres: st.membres.map((m) => (m.uid === uid ? { ...m, attache } : m)) };
}

// Les deux champs des critères que le détachement pose : la VIT minimum de
// fiche (rien si non saisie) et le verrou 206, seulement s'il est positif.
export function criteresDetaches(lien: MembreLigne): { vitesseMin: number | null; verrou206: number | null } {
  return { vitesseMin: lien.repli.vitesseMin, verrou206: lien.repli.effet206 > 0 ? lien.repli.effet206 : null };
}

// ─── Affichage de la zone ───────────────────────────────────────────────────

export interface PlageAffichee {
  swift: boolean;
  arteMin: number;
  arteMax: number;
  ficheMin: number;
  ficheMax: number;
  // Vitesses de combat sous le lead du plan, gain de passif compris : celles
  // de la projection aux deux bouts de l'intervalle de fiche.
  combatMin: number | null;
  combatMax: number | null;
}

// La zone en clair : une ligne par intervalle des classes utiles, par état de
// Swift. Une classe sans intervalle ne s'affiche pas.
export function plagesAffichees(
  plan: PlanSpeedTune, d: DonneesKit, monstres: Bestiaire, zone: ZoneMembre, autres: ReadonlyMap<string, EntreesLigne>
): PlageAffichee[] {
  const ligne = plan.lignes.find((l) => l.uid === zone.uid);
  const combat = (fiche: number, swift: boolean, arte: number) => {
    const subs = new Map(autres);
    subs.set(zone.uid, { runeSpeed: fiche - zone.base, swift, sets: ligne?.sets, artefactBuff: arte });
    return combatSousPlan(plan, d, monstres, zone.uid, subs);
  };
  const out: PlageAffichee[] = [];
  for (const z of zone.parSwift)
    for (const c of z.classes)
      for (const [a, b] of c.intervalles)
        out.push({ swift: z.swift, arteMin: c.arteMin, arteMax: c.arteMax, ficheMin: a, ficheMax: b,
          combatMin: combat(a, z.swift, c.arteMin), combatMax: combat(b, z.swift, c.arteMin) });
  return out;
}
