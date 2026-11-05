// LE PLAN DE SPEED TUNE : un speed tune photographié pour l'Optimizer.
//
// Spec : docs/02-app/optimizer/feat-contrainte-speed-tune.md. Ce module est
// PUR : il reçoit les données de kits et le bestiaire, il ne lit rien d'autre.
//
// ⚠️ **Un seul plateau.** Le plateau d'un plan se construit par la projection
// en deux passes de l'analyse (`plateauAnalyse`, `deviner: false`), jamais par
// une copie de sa logique : à entrées inchangées, l'Optimizer juge ce que
// l'outil juge, case pour case.
//
// ⚠️ **Les cases d'un plan sont les cases SAISIES.** Ce que l'analyse écrit ne
// vaut qu'aux vitesses du moment ; rejoué ailleurs, chaque sort se repose là où
// son lanceur joue. La provenance vient de l'outil (`casesSaisies`).

import { Monster } from '../types';
import {
  ARTE_MAX,
  Camp,
  EffetSort,
  ModParTick,
  ProblemeOrdre,
  TuneMonstre,
  diagnostiquerSequence,
  litOccurrence,
} from './speedTune';
import {
  ChoixSorts,
  DonneesKit,
  EntreeAuto,
  ampliCamp,
  cumulsEquipe,
  cumulsEstimes,
  plateauAnalyse,
} from './speedTuneAuto';
import { pointsDeGain } from './speedTunePassif';
import { ClasseZone, ContrainteSpeedTune, SetsCumuls, ZoneMembre, ZoneSwift } from './contrainteSpeedTune';
import { Leads, Ligne, casesSaisies, leadPour, visibles } from './speedTuneLignes';

// Ce qu'un build change sur SA ligne : c'est tout ce que l'adaptateur écrit, et
// tout ce que « Recalculer » réécrit dans le plan.
export interface EntreesLigne {
  // Vitesse de runes au sens de l'outil : `fiche − base`, Swift à plat compris.
  runeSpeed: number;
  swift: boolean;
  // Sets activés (format `activeSets`). `undefined` = inconnus.
  sets?: string[];
  // Cumul 206 de la PAIRE, sans l'amplification de camp (la projection l'ajoute).
  artefactBuff: number;
}

export interface LignePlan extends EntreesLigne {
  uid: string;
  camp: Camp;
  monsterId: Monster['id'];
  // Cumuls de passif tels que l'écran les compte (`cumulsPassif ?? 0`).
  cumulsPassif: number;
  passifActif?: boolean;
  // Le lead que l'écran applique à CETTE ligne (lead du camp filtré par élément).
  lead: number;
  // Les cases SAISIES des deux grilles.
  atb: ModParTick;
  speed: ModParTick;
}

export interface PlanSpeedTune {
  version: 1;
  // Lignes VISIBLES des deux camps, dans l'ordre de l'écran : à barre et
  // vitesse égales, c'est cet ordre qui départage.
  lignes: LignePlan[];
  choix: ChoixSorts;
  ordre: string[];
  leads: Leads;
  // Entrées d'origine de chaque ligne alliée, pour « Restaurer ».
  origine: Record<string, EntreesLigne & { cumulsPassif: number }>;
  // Gain de passif EFFECTIF de référence, par ligne dont le gain dépend des
  // cumuls (voir `gainsDeReference`).
  referenceGains: Record<string, number>;
}

export type RefusPlan =
  | { motif: 'ordre-vide' }
  | { motif: 'ordre-incomplet'; manquants: string[] }
  | { motif: 'occurrences-inversees'; id: string }
  | { motif: 'provenance-inconnue'; uid: string }
  | { motif: 'membres-insuffisants' };

// ─── Construction ───────────────────────────────────────────────────────────

// Le plan d'un état de l'outil. Refusé (et l'export se fait alors sans plan)
// quand l'ordre est vide ou incomplet, quand il range une occurrence avant une
// occurrence de rang inférieur, ou qu'une case est de provenance inconnue.
export function planDepuisSpeedTune(
  lignes: Ligne[],
  leads: Leads,
  choix: ChoixSorts,
  ordre: string[],
  d: DonneesKit
): { plan: PlanSpeedTune } | { refus: RefusPlan } {
  const vues = visibles(lignes);
  const allies = vues.filter((l) => l.camp === 'allie');
  if (allies.length < 2) return { refus: { motif: 'membres-insuffisants' } };
  if (ordre.length === 0) return { refus: { motif: 'ordre-vide' } };
  const presents = new Set(ordre.map((c) => litOccurrence(c).id));
  const manquants = allies.map((l) => l.uid).filter((u) => !presents.has(u));
  if (manquants.length > 0) return { refus: { motif: 'ordre-incomplet', manquants } };
  const rangVu = new Map<string, number>();
  for (const cle of ordre) {
    const { id, n } = litOccurrence(cle);
    if ((rangVu.get(id) ?? 0) > n) return { refus: { motif: 'occurrences-inversees', id } };
    rangVu.set(id, n);
  }
  const lignesPlan: LignePlan[] = [];
  for (const l of vues) {
    const cases = casesSaisies(l);
    if (!cases) return { refus: { motif: 'provenance-inconnue', uid: l.uid } };
    lignesPlan.push({
      uid: l.uid,
      camp: l.camp,
      monsterId: l.monster.id,
      runeSpeed: l.runeSpeed ?? 0,
      swift: l.swift ?? false,
      sets: l.sets,
      artefactBuff: l.artefactBuff ?? 0,
      cumulsPassif: l.cumulsPassif ?? 0,
      passifActif: l.passifActif,
      lead: leadPour(l.camp === 'allie' ? leads.allie : leads.ennemi, l),
      atb: cases.atb,
      speed: cases.speed,
    });
  }
  const origine: PlanSpeedTune['origine'] = {};
  for (const l of lignesPlan) {
    if (l.camp !== 'allie') continue;
    origine[l.uid] = {
      runeSpeed: l.runeSpeed,
      swift: l.swift,
      sets: l.sets,
      artefactBuff: l.artefactBuff,
      cumulsPassif: l.cumulsPassif,
    };
  }
  const monstres = new Map(vues.map((l) => [l.monster.id, l.monster] as const));
  const sans: PlanSpeedTune = {
    version: 1,
    lignes: lignesPlan,
    choix: copieChoix(choix),
    ordre: [...ordre],
    leads: { allie: leads.allie, ennemi: leads.ennemi },
    origine,
    referenceGains: {},
  };
  return { plan: { ...sans, referenceGains: gainsDeReference(sans, d, monstres) } };
}

const copieChoix = (c: ChoixSorts): ChoixSorts => JSON.parse(JSON.stringify(c)) as ChoixSorts;

// ─── Adaptateur build → entrées ─────────────────────────────────────────────

// ⚠️ **UN SEUL adaptateur** : zone, builds validés des autres, validation et
// « Recalculer » passent tous par lui. Swift découle des sets ACTIVÉS — jamais
// un drapeau gardé à côté, qui finirait par les contredire.
export function entreesDeBuild(base: number, fiche: number, setsActifs: string[], cumul206: number): EntreesLigne {
  return {
    runeSpeed: fiche - base,
    swift: setsActifs.includes('swift'),
    sets: [...setsActifs],
    artefactBuff: cumul206,
  };
}

// ─── Projection ─────────────────────────────────────────────────────────────

export type Bestiaire = ReadonlyMap<Monster['id'], Monster>;

// Les entrées de l'analyse, les substitutions posées sur leurs lignes.
export function entreesDuPlan(
  plan: PlanSpeedTune,
  monstres: Bestiaire,
  substitutions?: ReadonlyMap<string, EntreesLigne>
): EntreeAuto[] {
  const out: EntreeAuto[] = [];
  for (const l of plan.lignes) {
    const monster = monstres.get(l.monsterId);
    if (!monster) continue;
    const s = substitutions?.get(l.uid);
    out.push({
      id: l.uid,
      monster,
      runeSpeed: s?.runeSpeed ?? l.runeSpeed,
      swift: s?.swift ?? l.swift,
      sets: s ? s.sets : l.sets,
      artefactBuff: s?.artefactBuff ?? l.artefactBuff,
      cumulsPassif: l.cumulsPassif,
      passifActif: l.passifActif,
      lead: l.lead,
      camp: l.camp,
      // Les adverses : leurs cases SAISIES seulement, l'analyse les lit en entrée.
      ...(l.camp === 'ennemi' ? { atbMod: l.atb, speedMod: l.speed } : {}),
    });
  }
  return out;
}

// Un PROJECTEUR : ce qui ne dépend pas des substitutions se prépare une fois
// (entrées de base, cases saisies des alliés) ; un balayage n'en change qu'une
// ligne à la fois.
export function projecteur(
  plan: PlanSpeedTune,
  d: DonneesKit,
  monstres: Bestiaire
): (substitutions?: ReadonlyMap<string, EntreesLigne>) => TuneMonstre[] {
  const saisiesAllies = new Map(
    plan.lignes.filter((l) => l.camp === 'allie').map((l) => [l.uid, { atb: l.atb, speed: l.speed }] as const)
  );
  const options = { choix: plan.choix, deviner: false, saisiesAllies };
  const base = entreesDuPlan(plan, monstres);
  return (substitutions) => {
    const entrees = substitutions?.size
      ? base.map((e) => {
          const s = substitutions.get(e.id);
          return s ? { ...e, runeSpeed: s.runeSpeed, swift: s.swift, sets: s.sets, artefactBuff: s.artefactBuff } : e;
        })
      : base;
    return plateauAnalyse(entrees, 0, d, options);
  };
}

export function plateauDuPlan(
  plan: PlanSpeedTune,
  d: DonneesKit,
  monstres: Bestiaire,
  substitutions?: ReadonlyMap<string, EntreesLigne>
): TuneMonstre[] {
  return projecteur(plan, d, monstres)(substitutions);
}

// Le speed tune tient-il ? L'ordre est complet et ses occurrences rangées par
// construction (`planDepuisSpeedTune`) : reste le verdict de l'écran.
export function planTient(
  plan: PlanSpeedTune,
  d: DonneesKit,
  monstres: Bestiaire,
  substitutions?: ReadonlyMap<string, EntreesLigne>
): { ok: boolean; probleme: ProblemeOrdre | null } {
  const diag = diagnostiquerSequence(plateauDuPlan(plan, d, monstres, substitutions), plan.ordre);
  return { ok: diag.ok, probleme: diag.problemes[0] ?? null };
}

// ─── Préconditions des cumuls ───────────────────────────────────────────────

// Le gain EFFECTIF de chaque ligne alliée dont le passif actif compte les
// cumuls, estimé (`cumulsEstimes` / `cumulsEquipe`) sur les sets des entrées.
function gainsEstimes(entrees: EntreeAuto[], d: DonneesKit): Record<string, number> {
  const allies = entrees.filter((e) => e.camp === 'allie');
  const out: Record<string, number> = {};
  for (const e of allies) {
    if (e.monster.com2usId == null || e.passifActif === false) continue;
    const p = (d.passifs.get(e.monster.com2usId) ?? []).find((x) => x.gain || x.amplifieBuff);
    if (!p?.gain?.parCumul) continue;
    const cumuls = p.gain.cumulEquipe ? cumulsEquipe(allies, d) : cumulsEstimes(e, allies, d);
    out[e.id] = pointsDeGain(p.gain, e.monster.stats.speed, cumuls);
  }
  return out;
}

export function gainsDeReference(plan: PlanSpeedTune, d: DonneesKit, monstres: Bestiaire): Record<string, number> {
  return gainsEstimes(entreesDuPlan(plan, monstres), d);
}

// Les cumuls du plan tiennent-ils dans ce CONTEXTE (toutes les substitutions à
// la fois : candidat ET builds validés des autres) ? Rend les lignes en défaut.
export function cumulsEnDefaut(
  plan: PlanSpeedTune,
  d: DonneesKit,
  monstres: Bestiaire,
  substitutions: ReadonlyMap<string, EntreesLigne>
): string[] {
  const actuels = gainsEstimes(entreesDuPlan(plan, monstres, substitutions), d);
  return Object.entries(plan.referenceGains)
    .filter(([uid, g]) => (actuels[uid] ?? 0) !== g)
    .map(([uid]) => uid);
}

// Le prédicat commun du filtre final, de la validation et du verdict d'équipe.
export function contexteTenu(
  plan: PlanSpeedTune,
  d: DonneesKit,
  monstres: Bestiaire,
  substitutions: ReadonlyMap<string, EntreesLigne>
): { ok: boolean; cumuls: string[]; probleme: ProblemeOrdre | null } {
  const cumuls = cumulsEnDefaut(plan, d, monstres, substitutions);
  if (cumuls.length > 0) return { ok: false, cumuls, probleme: null };
  const t = planTient(plan, d, monstres, substitutions);
  return { ok: t.ok, cumuls, probleme: t.probleme };
}

// ─── Zone ───────────────────────────────────────────────────────────────────

// Les valeurs de buff positives que le plan peut poser sur `uid` : buffs
// d'équipe et sur un allié des sorts écrits des AUTRES alliés (tous tours), ses
// propres buffs (sur soi, d'équipe, sur un allié qu'il peut se viser), et les
// cases de vitesse saisies sur sa ligne. Sans `uid`, tout ce que le plan pose.
export function buffsDuPlan(plan: PlanSpeedTune, d: DonneesKit, monstres: Bestiaire, uid?: string): number[] {
  const out = new Set<number>();
  const ajouter = (e: EffetSort | undefined, lanceur: string) => {
    const soi = uid == null || lanceur === uid;
    for (const v of [e?.buffEquipe, e?.buffAllie, soi ? e?.buffSoi : undefined]) if (v && v > 0) out.add(v);
  };
  const noms = new Map<string, string[]>();
  for (const [cle, nom] of [...Object.entries(plan.choix.sort ?? {}), ...Object.entries(plan.choix.sort2 ?? {})]) {
    if (!nom) continue;
    const { id } = litOccurrence(cle);
    noms.set(id, [...(noms.get(id) ?? []), nom]);
  }
  for (const l of plan.lignes) {
    if (uid == null || l.uid === uid) for (const v of Object.values(l.speed)) if (v > 0) out.add(v);
    if (l.camp !== 'allie') continue;
    const m = monstres.get(l.monsterId);
    const sorts = m?.com2usId != null ? (d.sorts.get(m.com2usId) ?? []) : [];
    for (const nom of noms.get(l.uid) ?? []) ajouter(sorts.find((s) => s.nom === nom)?.effet, l.uid);
  }
  return [...out].sort((a, b) => a - b);
}

// Les CLASSES d'artéfact : des valeurs de 206 qui donnent, pour chaque buff du
// plan, le même buff tronqué — calculé en entiers comme dans le moteur. Le
// buff tronqué croît avec le 206 : une classe est un intervalle.
export function classesArtefact(buffs: number[], ampli: number, max = ARTE_MAX): { min: number; max: number }[] {
  if (buffs.length === 0) return [{ min: 0, max }];
  const cle = (a: number) => buffs.map((b) => Math.floor((b * (100 + a + ampli)) / 100)).join(',');
  const out: { min: number; max: number }[] = [];
  let debut = 0;
  let courante = cle(0);
  for (let a = 1; a <= max; a++) {
    const k = cle(a);
    if (k === courante) continue;
    out.push({ min: debut, max: a - 1 });
    debut = a;
    courante = k;
  }
  out.push({ min: debut, max });
  return out;
}

export interface BornesZone {
  // Majorant de la VIT de fiche atteignable, par état de Swift (voir la spec).
  ficheMax: { swift: number; sansSwift: number };
  // Les états de Swift que la recherche du membre peut produire.
  etatsSwift: boolean[];
  // Le plus fort cumul 206 qu'une paire de l'inventaire peut porter (défaut
  // `ARTE_MAX`). Les classes couvrent 0..arteMax : au-delà, rien n'est garanti.
  arteMax?: number;
}

// La zone d'un membre, les autres lignes fixées (`autres` : leurs entrées
// retenues — build validé exploitable, sinon rien et le plan s'applique).
//
// ⚠️ **Balayage exhaustif, jamais une dichotomie** : l'ordre tenu n'est pas
// monotone en vitesse (un seul monstre agit par tick).
export function zoneMembre(
  plan: PlanSpeedTune,
  d: DonneesKit,
  monstres: Bestiaire,
  uid: string,
  autres: ReadonlyMap<string, EntreesLigne>,
  bornes: BornesZone
): ZoneMembre | null {
  const ligne = plan.lignes.find((l) => l.uid === uid && l.camp === 'allie');
  const monster = ligne ? monstres.get(ligne.monsterId) : undefined;
  if (!ligne || !monster) return null;
  const base = monster.stats.speed;
  if (base == null) return null;
  const buffs = buffsDuPlan(plan, d, monstres, uid);
  const ampli = ampliCamp(entreesDuPlan(plan, monstres).filter((e) => e.camp === 'allie'), d);
  const arteMax = Math.max(0, bornes.arteMax ?? ARTE_MAX);
  const classes = buffs.length === 0 ? [{ min: 0, max: arteMax }] : classesArtefact(buffs, ampli, arteMax);
  const subs = new Map(autres);
  const projeter = projecteur(plan, d, monstres);
  const parSwift: ZoneSwift[] = [];
  for (const swift of bornes.etatsSwift) {
    const haut = swift ? bornes.ficheMax.swift : bornes.ficheMax.sansSwift;
    const zc: ClasseZone[] = [];
    for (const c of classes) {
      const intervalles: [number, number][] = [];
      let debut: number | null = null;
      for (let fiche = base; fiche <= haut + 1; fiche++) {
        let tient = false;
        if (fiche <= haut) {
          subs.set(uid, { runeSpeed: fiche - base, swift, sets: ligne.sets, artefactBuff: c.min });
          tient = diagnostiquerSequence(projeter(subs), plan.ordre).ok;
        }
        if (tient && debut == null) debut = fiche;
        if (!tient && debut != null) {
          intervalles.push([debut, fiche - 1]);
          debut = null;
        }
      }
      zc.push({ arteMin: c.min, arteMax: c.max, intervalles });
    }
    parSwift.push({ swift, classes: zc });
  }
  return { uid, base, parSwift, axeArtefact: buffs.length > 0 };
}

// Les combinaisons Volonté × Bouclier du build de `uid` qui tiennent la
// précondition des cumuls, les autres lignes fixées par `autres`. Le
// candidat n'y change que ses sets : Volonté et Bouclier sont les seuls que
// lit l'estimation des cumuls (`cumulsEstimes`, `cumulsEquipe`).
export function setsAdmis(
  plan: PlanSpeedTune,
  d: DonneesKit,
  monstres: Bestiaire,
  uid: string,
  autres: ReadonlyMap<string, EntreesLigne>
): SetsCumuls[] {
  const ligne = plan.lignes.find((l) => l.uid === uid && l.camp === 'allie');
  if (!ligne) return [];
  const out: SetsCumuls[] = [];
  for (const will of [false, true])
    for (const shield of [false, true]) {
      const sets = [...(will ? ['will'] : []), ...(shield ? ['shield'] : [])];
      const subs = new Map(autres);
      subs.set(uid, { runeSpeed: ligne.runeSpeed, swift: ligne.swift, sets, artefactBuff: ligne.artefactBuff });
      if (cumulsEnDefaut(plan, d, monstres, subs).length === 0) out.push({ will, shield });
    }
  return out;
}

// La contrainte que la recherche de `uid` lit : sa zone et ses sets admis,
// contre les mêmes autres lignes. `null` : la ligne ou son monstre manque.
export function contrainteDuMembre(
  plan: PlanSpeedTune,
  d: DonneesKit,
  monstres: Bestiaire,
  uid: string,
  autres: ReadonlyMap<string, EntreesLigne>,
  bornes: BornesZone
): ContrainteSpeedTune | null {
  const zone = zoneMembre(plan, d, monstres, uid, autres, bornes);
  return zone ? { version: 1, zone, setsAdmis: setsAdmis(plan, d, monstres, uid, autres) } : null;
}

// La vitesse de combat d'une ligne sous le lead du plan, gain de passif compris
// (affichage, écarts) : celle que la projection donne, jamais recalculée à côté.
export function combatSousPlan(
  plan: PlanSpeedTune,
  d: DonneesKit,
  monstres: Bestiaire,
  uid: string,
  substitutions?: ReadonlyMap<string, EntreesLigne>
): number | null {
  return plateauDuPlan(plan, d, monstres, substitutions).find((m) => m.id === uid)?.combat ?? null;
}
