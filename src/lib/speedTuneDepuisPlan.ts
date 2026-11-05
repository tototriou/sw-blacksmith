// Régler le speed tune d'une équipe depuis l'Optimizer : l'état de l'outil
// rendu depuis un plan ou depuis les membres, et le plan appliqué à l'équipe.
// Calcul pur. Spec : docs/02-app/optimizer/feat-speed-tune-depuis-optimizer.md.
import type { Monster } from '../types';
import type { LeadInfo } from './speed';
import { analyseAutomatique, type ChoixSorts, type DonneesKit } from './speedTuneAuto';
import { ligneVierge, uidDe, type Leads, type Ligne } from './speedTuneLignes';
import { entreesDuPlan, planDepuisSpeedTune, planTient, type Bestiaire, type EntreesLigne, type PlanSpeedTune, type RefusPlan } from './planSpeedTune';
import { ligneModifiee } from './speedTuneMembre';
import { exclusionSelectorKey, type ExclusionSelector } from './optimizerExclusion';
import type { MembreLigne, SpeedTuneEquipe } from './speedTuneEquipe';
import type { EquipeOptimizer } from './optimizerMemberStorage';
import type { CriteresOptimizer } from './criteresOptimizer';
import { CODE_206 } from './contrainteSpeedTune';

// L'état de l'outil que la modale charge.
export interface EtatOutil {
  lignes: Ligne[];
  leads: Leads;
  choix: Required<ChoixSorts>;
  ordre: string[];
  // L'ordre voulu est-il rangé (figé) ?
  ordreRange: boolean;
}

export type RefusOuverture = { motif: 'monstre-introuvable'; monsterId: Monster['id'] };

const estReference = (uid: string) => uid.startsWith(uidDe('ennemi', 'ref:'));

// Les choix du plan, une ligne sans sort recevant « aucun sort » (chaîne vide),
// adversaire de référence compris :
// la projection (`deviner: false`) ne lui a rien prêté, l'outil ne doit pas lui
// prêter le sort de son kit.
export function choixExplicites(plan: PlanSpeedTune): Required<ChoixSorts> {
  const sort = { ...(plan.choix.sort ?? {}) };
  for (const l of plan.lignes) if (sort[l.uid] === undefined) sort[l.uid] = '';
  return { sort, sort2: { ...(plan.choix.sort2 ?? {}) }, cible: { ...(plan.choix.cible ?? {}) }, atbChoisi: { ...(plan.choix.atbChoisi ?? {}) } };
}

// Les lignes d'un plan, grilles comprises : les cases saisies comme saisies, et
// les cases automatiques de la PROJECTION du plan (`deviner: false`, saisies
// prioritaires), posées comme automatiques. L'outil rouvert donne ainsi le
// plateau du plan. ⚠️ `d` doit porter les kits de TOUTES les lignes.
export function etatDepuisPlan(plan: PlanSpeedTune, d: DonneesKit, monstres: Bestiaire): EtatOutil | RefusOuverture {
  for (const l of plan.lignes) if (!monstres.has(l.monsterId)) return { motif: 'monstre-introuvable', monsterId: l.monsterId };
  const choix = choixExplicites(plan);
  const saisiesAllies = new Map(plan.lignes.filter((l) => l.camp === 'allie').map((l) => [l.uid, { atb: l.atb, speed: l.speed }] as const));
  const { mods } = analyseAutomatique(entreesDuPlan(plan, monstres), 0, d, { choix, deviner: false, saisiesAllies });
  const lignes = plan.lignes.map((l): Ligne => {
    const monster = monstres.get(l.monsterId)!;
    const base: Ligne = {
      ...ligneVierge(monster, l.camp),
      uid: l.uid,
      runeSpeed: l.runeSpeed,
      swift: l.swift,
      ...(l.sets ? { sets: [...l.sets] } : {}),
      artefactBuff: l.artefactBuff,
      cumulsPassif: l.cumulsPassif,
      ...(l.passifActif !== undefined ? { passifActif: l.passifActif } : {}),
      ...(estReference(l.uid) ? { reference: true } : {}),
    };
    const m = mods.get(l.uid);
    if (m) return { ...base, ...m };
    // Sans écriture de l'analyse (adversaire) : ses cases saisies, rien d'automatique.
    return { ...base, atbMod: { ...l.atb }, speedMod: { ...l.speed }, casesAuto: { atb: {}, speed: {} } };
  });
  return { lignes, leads: { ...plan.leads }, choix, ordre: [...plan.ordre], ordreRange: true };
}

// Un membre de l'équipe pour « Ton équipe » : son monstre et ses entrées
// (build validé exploitable, sinon équipement porté complet ; `null` : à saisir).
export interface MembrePourOutil {
  monster: Monster;
  entrees: EntreesLigne | null;
}

// L'état sans plan : les membres dans l'ordre de l'équipe, le lead de l'équipe,
// aucun adversaire, l'ordre voulu libre (il suit les vitesses).
export function etatDepuisMembres(membres: readonly MembrePourOutil[], lead: LeadInfo | null): EtatOutil {
  const vus = new Set<string>();
  const lignes: Ligne[] = [];
  for (const { monster, entrees } of membres) {
    const l = ligneVierge(monster, 'allie');
    if (vus.has(l.uid)) continue;
    vus.add(l.uid);
    lignes.push(entrees
      ? { ...l, runeSpeed: entrees.runeSpeed, swift: entrees.swift, ...(entrees.sets ? { sets: [...entrees.sets] } : {}), artefactBuff: entrees.artefactBuff }
      : l);
  }
  return {
    lignes, leads: { allie: lead, ennemi: null }, choix: { sort: {}, sort2: {}, cible: {}, atbChoisi: {} },
    ordre: lignes.map((l) => l.uid), ordreRange: false,
  };
}

// L'outil ouvert depuis une équipe de l'Optimizer : son plan, ou l'état rendu
// depuis ses membres.
export type OuvertureOptimizer = { plan: PlanSpeedTune } | { etat: EtatOutil };

// L'ouverture d'une équipe : son plan s'il en a un (refusé si un monstre du plan
// manque au bestiaire : appliquer sans lui supprimerait sa ligne), sinon ses
// membres résolus, dans l'ordre de l'équipe, sous son lead de vitesse.
export function ouvertureDeLEquipe(
  equipe: Pick<EquipeOptimizer, 'members' | 'lead' | 'speedTune'>,
  membreDe: (s: ExclusionSelector) => MembrePourOutil | null,
  monstres: Bestiaire
): OuvertureOptimizer | RefusOuverture {
  const plan = equipe.speedTune?.plan;
  if (plan) {
    const manque = plan.lignes.find((l) => !monstres.has(l.monsterId));
    return manque ? { motif: 'monstre-introuvable', monsterId: manque.monsterId } : { plan };
  }
  const membres = equipe.members.map(membreDe).filter((m): m is MembrePourOutil => m !== null);
  const l = equipe.lead;
  return { etat: etatDepuisMembres(membres, l?.stat === 'Attack Speed' ? { amount: l.amount, area: l.area, element: l.element } : null) };
}

// « Appliquer » refuse tant qu'une vitesse de runes alliée manque : le plan
// compterait 0 (le constructeur, partagé avec l'export, ne la refuse pas).
export function vitesseManquante(lignes: readonly Ligne[]): Ligne | null {
  return lignes.find((l) => l.camp === 'allie' && !l.masque && l.runeSpeed == null) ?? null;
}

// « Appliquer à l'équipe », jugé : vitesse alliée manquante, refus du
// constructeur (le même que l'export), ou plan construit, avec un verdict qui
// peut différer de celui que l'écran affiche (cases automatiques d'avant un
// changement de vitesse) : l'écran demande alors confirmation.
export type Application =
  | { manque: Ligne }
  | { refus: RefusPlan }
  | { plan: PlanSpeedTune; verdictDifferent: boolean };

export function jugerApplication(
  lignes: readonly Ligne[], leads: Leads, choix: ChoixSorts, ordre: string[], d: DonneesKit, monstres: Bestiaire,
  verdictEcran: boolean
): Application {
  const manque = vitesseManquante(lignes);
  if (manque) return { manque };
  const r = planDepuisSpeedTune([...lignes], leads, choix, ordre, d);
  if ('refus' in r) return r;
  return { plan: r.plan, verdictDifferent: planTient(r.plan, d, monstres).ok !== verdictEcran };
}

// Le plan chargé porte-t-il une ligne recalculée, dont « Appliquer » remplace
// la valeur d'origine ?
export const perdOrigine = (plan: PlanSpeedTune | null | undefined): boolean =>
  !!plan && plan.lignes.some((l) => ligneModifiee(plan, l.uid));

// Un membre qui perd son lien alors qu'il était attaché : ses critères reçoivent
// ses valeurs de repli, comme par « Détacher ».
export interface RepliAPoser {
  selector: ExclusionSelector;
  vitesseMin: number | null;
  verrou206: number | null;
}

// Le nouveau plan appliqué à l'équipe : liens gardés (même uid, membre encore
// dans l'équipe), puis affectation des lignes sans lien par monstre, au plus un
// membre par ligne ; repli suivant la ligne ; liens des membres sans ligne
// retirés, avec leur repli à poser s'ils étaient attachés.
export function appliquerPlanALEquipe(
  ancien: SpeedTuneEquipe | undefined,
  plan: PlanSpeedTune,
  members: readonly ExclusionSelector[],
  monstreDe: (s: ExclusionSelector) => Monster['id'] | null,
  monstres: Bestiaire
): { st: SpeedTuneEquipe; replis: RepliAPoser[] } {
  const cles = new Set(members.map(exclusionSelectorKey));
  const allies = plan.lignes.filter((l) => l.camp === 'allie');
  const uidsAllies = new Set(allies.map((l) => l.uid));
  const garde: MembreLigne[] = [];
  const replis: RepliAPoser[] = [];
  for (const lien of ancien?.membres ?? []) {
    if (cles.has(exclusionSelectorKey(lien.selector)) && uidsAllies.has(lien.uid)) garde.push(lien);
    else if (lien.attache && cles.has(exclusionSelectorKey(lien.selector))) {
      replis.push({ selector: lien.selector, vitesseMin: lien.repli.vitesseMin, verrou206: lien.repli.effet206 > 0 ? lien.repli.effet206 : null });
    }
  }
  const liesUid = new Set(garde.map((m) => m.uid));
  const liesMembre = new Set(garde.map((m) => exclusionSelectorKey(m.selector)));
  const nouveaux: MembreLigne[] = [];
  for (const l of allies) {
    if (liesUid.has(l.uid)) continue;
    const s = members.find((x) => !liesMembre.has(exclusionSelectorKey(x)) && monstreDe(x) != null && uidDe('allie', String(monstreDe(x))) === l.uid);
    if (!s) continue;
    liesMembre.add(exclusionSelectorKey(s));
    nouveaux.push({ uid: l.uid, selector: s, attache: true, repli: { vitesseMin: null, effet206: 0 } });
  }
  const repliDe = (uid: string): MembreLigne['repli'] => {
    const l = allies.find((x) => x.uid === uid)!;
    const base = monstres.get(l.monsterId)?.stats.speed;
    return { vitesseMin: base == null ? null : base + l.runeSpeed, effet206: Math.max(0, l.artefactBuff) };
  };
  const membres = [...garde, ...nouveaux].map((m) => ({ ...m, repli: repliDe(m.uid) }));
  return { st: { plan, membres }, replis };
}

// Les critères mémorisés d'un membre, son repli posé : VIT minimum (retirée si
// vide) et verrou 206 (retiré si nul), les deux champs que le lien possédait.
export function criteresAvecRepli(c: CriteresOptimizer, r: Pick<RepliAPoser, 'vitesseMin' | 'verrou206'>): CriteresOptimizer {
  const minStats = { ...c.minStats };
  if (r.vitesseMin == null) delete minStats.spd; else minStats.spd = r.vitesseMin;
  const lignesVerrouillees = [...c.lignesVerrouillees.filter((l) => l.code !== CODE_206), ...(r.verrou206 ? [{ code: CODE_206, min: r.verrou206 }] : [])];
  return { ...c, minStats, lignesVerrouillees };
}
