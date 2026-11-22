// LES ÉQUIPES ENREGISTRÉES de « Mes équipes » : modèle, validation à la
// relecture, comparaison au compte, opérations pures.
//
// Spec : docs/02-app/compte/feat-equipes.md. Une équipe garde une COPIE de son
// équipement : les identifiants servent à la comparaison au compte, jamais à
// relire l'équipement.

import type { ArtifactDetail, GearSet, Monster, RelicDetail, RuneDetail } from '../types';
import type { BoxItem } from './applyAccount';
import type { ContenuListeOptimizer } from './optimizerMemberStorage';
import type { ExclusionSelector } from './optimizerExclusion';
import type { PlanSpeedTune } from './planSpeedTune';
import type { RepliSpeedTune } from './speedTuneEquipe';
import { planSpeedTuneValide } from './speedTuneEquipe';
import { idCanoniqueCollab } from './monsterForms';
import type { Dictionnaire } from '../i18n/fr';
import { nomElement, nomSet } from '../i18n/jeu';

// Les ONGLETS, un par contenu du jeu, dans l'ordre choisi par l'utilisateur ;
// le premier est ouvert par défaut. Chacun a ses CATÉGORIES (un donjon, un
// mode, un côté), filtrables dans l'onglet ; la RTA et la ToA n'en ont pas.
// La RTA garde des PRÉPAS, pas des équipes (`estPrepa`).
export const CATEGORIES_EQUIPES = [
  'arene', 'rta', 'guilde', 'cairos', 'labyrinthe', 'subjugation', 'passage-dimensions', 'faille', 'temple-chaos', 'toa',
] as const;
export type CategorieEquipes = (typeof CATEGORIES_EQUIPES)[number];

export const SOUS_CATEGORIES_EQUIPES = {
  arene: ['offense', 'defense', 'defense-serveur', 'dimensionnelle'],
  rta: [],
  guilde: ['offense-siege', 'defense-siege', 'offense-gdg', 'defense-gdg'],
  cairos: ['geant', 'dragon', 'necropolis', 'royaume-spirituel', 'forteresse-acier', 'crypte-jugement'],
  labyrinthe: ['boss', 'normal', 'sauvetage', 'explosion', 'vitesse-limitee', 'temps-limite', 'temps-pause'],
  subjugation: ['eau', 'feu', 'vent', 'boss'],
  'passage-dimensions': ['karzhan', 'ellunia', 'lumel', 'khalderun', 'sacreon', 'inferas', 'raid'],
  faille: ['glace', 'orage', 'marecage', 'enflammee', 'radiance', 'raid'],
  'temple-chaos': ['eau', 'feu', 'vent', 'tenebres', 'lumiere'],
  toa: [],
} as const satisfies Record<CategorieEquipes, readonly string[]>;
export type SousCategorieDe<C extends CategorieEquipes> = (typeof SOUS_CATEGORIES_EQUIPES)[C][number];
export type SousCategorieEquipes = SousCategorieDe<CategorieEquipes>;

// Le RANGEMENT d'une équipe, son champ `onglet` : l'onglet seul (catégorie non
// choisie), ou l'onglet et sa catégorie, `cairos/geant`.
export type OngletEquipes = { [C in CategorieEquipes]: C | `${C}/${SousCategorieDe<C>}` }[CategorieEquipes];
export const ONGLETS_EQUIPES: readonly OngletEquipes[] = CATEGORIES_EQUIPES.flatMap((c) =>
  [c, ...SOUS_CATEGORIES_EQUIPES[c].map((x) => `${c}/${x}` as OngletEquipes)]);

export function categorieDe(onglet: OngletEquipes): CategorieEquipes {
  return onglet.split('/')[0] as CategorieEquipes;
}
export function sousCategorieDe(onglet: OngletEquipes): SousCategorieEquipes | null {
  return (onglet.split('/')[1] as SousCategorieEquipes | undefined) ?? null;
}
// `null` : l'onglet sans catégorie ; une catégorie d'un autre onglet est ignorée.
export function rangement(categorie: CategorieEquipes, sous: string | null): OngletEquipes {
  return sous !== null && (SOUS_CATEGORIES_EQUIPES[categorie] as readonly string[]).includes(sous)
    ? `${categorie}/${sous}` as OngletEquipes : categorie;
}

// Les rangements des versions de travail précédentes, relus dans les nouveaux.
// Sans équivalent sûr (l'ancien combat de guilde mêlait siège et guerre de
// guilde), l'onglet seul.
const ONGLETS_ANCIENS: Readonly<Record<string, OngletEquipes>> = {
  'siege-attaque': 'guilde/offense-siege', 'siege-defense': 'guilde/defense-siege',
  'guerre-guilde': 'guilde/offense-gdg', 'guerre-guilde-offense': 'guilde/offense-gdg', 'guerre-guilde-defense': 'guilde/defense-gdg',
  'guilde-offense': 'guilde', 'guilde-defense': 'guilde',
  'arene-attaque': 'arene/offense', 'arene-offense': 'arene/offense', 'arene-defense': 'arene/defense', 'arene/rta': 'rta',
  pve: 'cairos',
};

// Le contenu de la liste créée par l'export vers l'Optimizer : le lead qui
// agit dans l'onglet, d'après la règle relevée en jeu (`CONTENU_LEADS_JEU`) ;
// le même pour toutes ses catégories.
export const CONTENU_OPTIMIZER_ONGLET: Readonly<Record<CategorieEquipes, ContenuListeOptimizer>> = {
  arene: 'arene',
  rta: 'arene',
  guilde: 'guilde',
  cairos: 'donjon',
  labyrinthe: 'guilde',
  subjugation: 'guilde',
  'passage-dimensions': 'donjon',
  faille: 'donjon',
  'temple-chaos': 'autre',
  toa: 'autre',
};

export const PROVENANCES_EQUIPEMENT = [
  'porte', 'rta', 'siege-defense', 'siege-attaque', 'arene-defense', 'arene-attaque', 'deck', 'optimizer', 'aucun',
] as const;
export type ProvenanceEquipement = (typeof PROVENANCES_EQUIPEMENT)[number];

export const MONSTRES_MAX_EQUIPE = 6;

// Une PRÉPA RTA (l'onglet RTA, décision de l'utilisateur du 2026-11-22) : un
// ensemble de monstres, pas une équipe. Ni leader, ni speed tune, ni groupe ;
// un monstre suffit, et la borne haute n'est qu'un garde-fou de relecture.
export const MONSTRES_MAX_PREPA = 300;
export function estPrepa(onglet: OngletEquipes): boolean {
  return categorieDe(onglet) === 'rta';
}
// Ce qu'une prépa ne porte pas, retiré d'une équipe créée dans l'onglet RTA
// (depuis une équipe de l'Optimizer) ; une équipe d'un autre onglet est rendue telle quelle.
export function normaliserPrepa(e: EquipeEnregistree): EquipeEnregistree {
  if (!estPrepa(e.onglet)) return e;
  const { speedTune: _st, groupe: _g, lienOptimizer: _l, ...reste } = e;
  return { ...reste, leader: null };
}
// Le nombre de monstres qu'une équipe enregistrée doit avoir pour se relire.
export function bornesMonstres(onglet: OngletEquipes): { min: number; max: number } {
  return estPrepa(onglet) ? { min: 1, max: MONSTRES_MAX_PREPA } : { min: MONSTRES_MIN_EQUIPE, max: MONSTRES_MAX_EQUIPE };
}

// Le nombre de monstres d'une équipe dans le jeu, par contenu, relevé par
// l'utilisateur le 2026-11-22. Un onglet absent de la table n'a pas de règle
// relevée : la limite de l'app.
// ⚠️ Règle de jeu : ne pas compléter par ressemblance, demander le relevé.
const MONSTRES_MAX_CATEGORIE: Readonly<Partial<Record<CategorieEquipes, number>>> = {
  arene: 4, rta: MONSTRES_MAX_PREPA, guilde: 3, cairos: 5, labyrinthe: 5, subjugation: 5, 'passage-dimensions': 4, faille: 6, 'temple-chaos': 5, toa: 5,
};
const MONSTRES_MAX_RANGEMENT: Readonly<Partial<Record<OngletEquipes, number>>> = {
  'labyrinthe/sauvetage': 4, 'passage-dimensions/raid': 5,
};
// Sans catégorie choisie, la plus grande des limites de l'onglet : l'alerte ne
// vise qu'une équipe trop grande pour toutes ses catégories.
export function monstresMax(onglet: OngletEquipes): number {
  const c = categorieDe(onglet);
  const de = (o: OngletEquipes) => MONSTRES_MAX_RANGEMENT[o] ?? MONSTRES_MAX_CATEGORIE[c] ?? MONSTRES_MAX_EQUIPE;
  if (sousCategorieDe(onglet) !== null || SOUS_CATEGORIES_EQUIPES[c].length === 0) return de(onglet);
  return Math.max(...SOUS_CATEGORIES_EQUIPES[c].map((x) => de(rangement(c, x))));
}
// Trop de monstres pour le rangement : la carte et le détail le disent, un
// déplacement le demande avant.
export function tropDeMonstres(e: EquipeEnregistree, onglet: OngletEquipes = e.onglet): boolean {
  return e.monstres.length > monstresMax(onglet);
}
// Une équipe enregistrée en a au moins deux : « Nouvelle équipe » reste un
// brouillon, non enregistré, tant qu'elle n'en a pas deux.
export const MONSTRES_MIN_EQUIPE = 2;

export interface MonstreEnregistre {
  // Stable dans l'équipe : le leader et les lignes du speed tune le désignent.
  uid: string;
  com2usId: number;
  // L'unité du jeu, seulement quand la source la connaît (Box, membre Box).
  unitId: number | null;
  provenance: ProvenanceEquipement;
  equipement: GearSet | null;
}

export interface LienLigneEnregistre {
  uid: string; // la ligne alliée du plan
  monstre: string; // l'uid du monstre de l'équipe
  attache: boolean;
  repli: RepliSpeedTune;
}

export interface SpeedTuneEnregistre {
  plan: PlanSpeedTune | null;
  liens: LienLigneEnregistre[];
}

export interface CorrespondanceOptimizer {
  uid: string;
  selecteur: ExclusionSelector;
}

export interface LienOptimizerEquipe {
  listId: string;
  equipeId: string;
  correspondance: CorrespondanceOptimizer[];
}

export interface EquipeEnregistree {
  id: string;
  onglet: OngletEquipes;
  nom: string;
  note: string;
  monstres: MonstreEnregistre[];
  leader: string | null;
  speedTune?: SpeedTuneEnregistre;
  lienOptimizer?: LienOptimizerEquipe;
  // Le GROUPE : des équipes du même onglet jouées en même temps, qui se
  // partagent les runes (raid des mondes, temple du chaos, défense siège,
  // offense de guerre de guilde). Un nom, trimé ; absent hors groupe.
  groupe?: string;
  creeLe: string;
  modifieLe: string;
}

/* --------------------------------------------------------------------------
 * Validation à la relecture (stockage, fichier)
 * ----------------------------------------------------------------------- */

const objet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const texte = (v: unknown): v is string => typeof v === 'string';
const texteNonVide = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const nombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const entier = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));

function ligneEffet(v: unknown): boolean {
  return objet(v) && entier(v.code) && nombre(v.value)
    && (v.grind === undefined || nombre(v.grind)) && (v.enchant === undefined || typeof v.enchant === 'boolean');
}

function rune(v: unknown): v is RuneDetail {
  return objet(v) && entier(v.id) && entier(v.slot) && v.slot >= 1 && v.slot <= 6 && texte(v.set)
    && entier(v.rank) && entier(v.rarity) && entier(v.level) && ligneEffet(v.main)
    && (v.innate === undefined || ligneEffet(v.innate)) && Array.isArray(v.subs) && v.subs.every(ligneEffet);
}

function artefact(v: unknown): v is ArtifactDetail {
  return objet(v) && entier(v.id) && (v.kind === 'element' || v.kind === 'archetype')
    && entier(v.level) && entier(v.rarity) && ligneEffet(v.main) && Array.isArray(v.subs) && v.subs.every(ligneEffet);
}

function relique(v: unknown): v is RelicDetail {
  return objet(v) && entier(v.id) && entier(v.upgrade) && ligneEffet(v.main)
    && (v.unique === undefined || (objet(v.unique) && nombre(v.unique.type) && nombre(v.unique.tranche)));
}

function equipementValide(v: unknown): v is GearSet {
  if (!objet(v) || !objet(v.base)) return false;
  const b = v.base;
  if (!['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'].every((k) => nombre(b[k]))) return false;
  return Array.isArray(v.runes) && v.runes.every(rune) && Array.isArray(v.artifacts) && v.artifacts.every(artefact)
    && (v.relic === undefined || relique(v.relic));
}

export function selecteurExclusionValide(v: unknown): v is ExclusionSelector {
  if (!objet(v)) return false;
  switch (v.source) {
    case 'box': return texteNonVide(v.unitKey);
    case 'rta': return texteNonVide(v.monsterId);
    case 'siege-defense':
    case 'siege-offense': return texteNonVide(v.teamId) && entier(v.slotIndex) && v.slotIndex >= 0;
    case 'unowned': return texteNonVide(v.monsterId) && (v.copie === undefined || (entier(v.copie) && v.copie >= 0));
    default: return false;
  }
}

function monstre(v: unknown): v is MonstreEnregistre {
  return objet(v) && texteNonVide(v.uid) && entier(v.com2usId) && v.com2usId > 0
    && (v.unitId === null || (entier(v.unitId) && v.unitId > 0))
    && PROVENANCES_EQUIPEMENT.includes(v.provenance as ProvenanceEquipement)
    && (v.equipement === null || equipementValide(v.equipement));
}

export type SignalementEquipe = 'speedTuneIncomplet' | 'leaderRetire' | 'lienOptimizerRetire';

export interface LectureEquipe {
  equipe: EquipeEnregistree;
  signalements: SignalementEquipe[];
}

// `null` : l'équipe est illisible (elle va aux rejets, brute). Un speed tune,
// un leader ou un lien mal formés dégradent l'équipe, ils ne la rejettent pas.
// Un rangement d'avant les sept catégories se relit dans le sien
// (`ONGLETS_ANCIENS`).
export function lireEquipeEnregistree(brut: unknown): LectureEquipe | null {
  const ancien = objet(brut) && typeof brut.onglet === 'string' && Object.prototype.hasOwnProperty.call(ONGLETS_ANCIENS, brut.onglet)
    ? ONGLETS_ANCIENS[brut.onglet] : null;
  const v = ancien ? { ...(brut as Record<string, unknown>), onglet: ancien } : brut;
  if (!objet(v) || !texteNonVide(v.id) || !ONGLETS_EQUIPES.includes(v.onglet as OngletEquipes)
    || !texteNonVide(v.nom) || !texte(v.note) || !date(v.creeLe) || !date(v.modifieLe)
    || !Array.isArray(v.monstres) || !v.monstres.every(monstre)) return null;
  const bornes = bornesMonstres(v.onglet as OngletEquipes);
  if (v.monstres.length < bornes.min || v.monstres.length > bornes.max) return null;
  const prepa = estPrepa(v.onglet as OngletEquipes);
  const monstres = v.monstres as MonstreEnregistre[];
  const uids = new Set(monstres.map((m) => m.uid));
  if (uids.size !== monstres.length) return null;
  const signalements: SignalementEquipe[] = [];
  let leader: string | null = null;
  // Une prépa n'a pas de leader : celui d'une ancienne équipe RTA est oublié.
  if (!prepa && v.leader !== null && v.leader !== undefined) {
    if (texteNonVide(v.leader) && uids.has(v.leader)) leader = v.leader;
    else signalements.push('leaderRetire');
  }
  const equipe: EquipeEnregistree = {
    id: v.id, onglet: v.onglet as OngletEquipes, nom: v.nom, note: v.note,
    monstres: monstres.map(copierMonstre), leader, creeLe: v.creeLe, modifieLe: v.modifieLe,
  };
  if (!prepa && v.speedTune !== undefined) {
    const st = lireSpeedTune(v.speedTune, uids);
    if (st.incomplet) signalements.push('speedTuneIncomplet');
    if (st.valeur) equipe.speedTune = st.valeur;
  }
  if (v.lienOptimizer !== undefined) {
    const lien = lireLien(v.lienOptimizer);
    if (lien) equipe.lienOptimizer = lien;
    else signalements.push('lienOptimizerRetire');
  }
  if (typeof v.groupe === 'string' && v.groupe.trim()) equipe.groupe = v.groupe.trim();
  return { equipe, signalements };
}

function lireSpeedTune(v: unknown, uids: ReadonlySet<string>): { valeur: SpeedTuneEnregistre | null; incomplet: boolean } {
  if (!objet(v) || !Array.isArray(v.liens)) return { valeur: null, incomplet: true };
  let incomplet = false;
  const plan = planSpeedTuneValide(v.plan) ? v.plan : null;
  if (v.plan !== null && plan === null) incomplet = true;
  const allies = plan ? new Set(plan.lignes.filter((l) => l.camp === 'allie').map((l) => l.uid)) : null;
  const vusLigne = new Set<string>();
  const vusMonstre = new Set<string>();
  const liens: LienLigneEnregistre[] = [];
  for (const l of v.liens) {
    const valide = objet(l) && texteNonVide(l.uid) && texteNonVide(l.monstre) && uids.has(l.monstre)
      && (!allies || allies.has(l.uid)) && typeof l.attache === 'boolean' && objet(l.repli)
      && (l.repli.vitesseMin === null || (nombre(l.repli.vitesseMin) && l.repli.vitesseMin >= 0))
      && nombre(l.repli.effet206) && l.repli.effet206 >= 0
      && !vusLigne.has(l.uid) && !vusMonstre.has(l.monstre);
    if (!valide) { incomplet = true; continue; }
    const lien = l as { uid: string; monstre: string; attache: boolean; repli: RepliSpeedTune };
    vusLigne.add(lien.uid);
    vusMonstre.add(lien.monstre);
    liens.push({ uid: lien.uid, monstre: lien.monstre, attache: lien.attache,
      repli: { vitesseMin: lien.repli.vitesseMin, effet206: lien.repli.effet206 } });
  }
  return { valeur: { plan, liens }, incomplet };
}

function lireLien(v: unknown): LienOptimizerEquipe | null {
  if (!objet(v) || !texteNonVide(v.listId) || !texteNonVide(v.equipeId)
    || !Array.isArray(v.correspondance)) return null;
  const correspondance: CorrespondanceOptimizer[] = [];
  for (const c of v.correspondance) {
    if (!objet(c) || !texteNonVide(c.uid) || !selecteurExclusionValide(c.selecteur)) return null;
    correspondance.push({ uid: c.uid, selecteur: { ...c.selecteur } });
  }
  return { listId: v.listId, equipeId: v.equipeId, correspondance };
}

function copierMonstre(m: MonstreEnregistre): MonstreEnregistre {
  return { uid: m.uid, com2usId: m.com2usId, unitId: m.unitId, provenance: m.provenance,
    equipement: m.equipement === null ? null : structuredClone(m.equipement) };
}

/* --------------------------------------------------------------------------
 * Comparaison au compte
 * ----------------------------------------------------------------------- */

export type EtatPiece = 'identique' | 'modifiee' | 'disparue' | 'hors-compte';
export type TypePiece = 'rune' | 'artefact' | 'relique';

// Égalité champ à champ ; la seule exclusion est le marqueur de rune posé en
// jeu (`marker`), qui n'est pas une stat. Un champ ajouté aux types de pièce
// est comparé sans qu'on y pense.
export function comparerPiece(a: unknown, b: unknown): boolean {
  return egalProfond(sansMarqueur(a), sansMarqueur(b));
}

function sansMarqueur(v: unknown): unknown {
  if (!objet(v) || !('marker' in v)) return v;
  const { marker: _marker, ...reste } = v;
  return reste;
}

function egalProfond(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => egalProfond(x, b[i]));
  if (!objet(a) || !objet(b)) return false;
  // Une clé absente et une clé à `undefined` disent la même chose.
  const cles = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of cles) if (!egalProfond(a[k], b[k])) return false;
  return true;
}

export interface InventaireCompte {
  runes: ReadonlyMap<number, RuneDetail>;
  artefacts: ReadonlyMap<number, ArtifactDetail>;
  reliques: ReadonlyMap<number, RelicDetail>;
}

export function indexerInventaire(runes: readonly RuneDetail[], artefacts: readonly ArtifactDetail[], reliques: readonly RelicDetail[]): InventaireCompte {
  return {
    runes: new Map(runes.map((r) => [r.id, r])),
    artefacts: new Map(artefacts.map((a) => [a.id, a])),
    reliques: new Map(reliques.map((r) => [r.id, r])),
  };
}

export function etatPiece(type: TypePiece, piece: RuneDetail | ArtifactDetail | RelicDetail, inv: InventaireCompte): EtatPiece {
  if (!(piece.id > 0)) return 'hors-compte';
  const actuelle = type === 'rune' ? inv.runes.get(piece.id) : type === 'artefact' ? inv.artefacts.get(piece.id) : inv.reliques.get(piece.id);
  if (!actuelle) return 'disparue';
  return comparerPiece(piece, actuelle) ? 'identique' : 'modifiee';
}

export interface EtatsEquipement {
  runes: EtatPiece[];
  artefacts: EtatPiece[];
  relique: EtatPiece | null;
}

export function etatsEquipement(eq: GearSet, inv: InventaireCompte): EtatsEquipement {
  return {
    runes: eq.runes.map((r) => etatPiece('rune', r, inv)),
    artefacts: eq.artifacts.map((a) => etatPiece('artefact', a, inv)),
    relique: eq.relic ? etatPiece('relique', eq.relic, inv) : null,
  };
}

export type EtatExemplaire = 'equipe-ainsi' | 'equipe-autrement' | 'absent' | null;

// `null` : aucune ligne (exemplaire inconnu, ou monstre sans équipement).
export function etatExemplaire(m: MonstreEnregistre, box: readonly BoxItem[]): EtatExemplaire {
  if (m.unitId === null || m.equipement === null) return null;
  const item = box.find((b) => b.key === String(m.unitId));
  if (!item) return 'absent';
  return memeEquipement(m.equipement, item.gear) ? 'equipe-ainsi' : 'equipe-autrement';
}

function memePieces<T extends { id: number }>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const parId = new Map(b.map((p) => [p.id, p]));
  return a.every((p) => { const q = parId.get(p.id); return q !== undefined && comparerPiece(p, q); });
}

export function memeEquipement(a: GearSet, b: GearSet | undefined): boolean {
  if (!b) return a.runes.length === 0 && a.artifacts.length === 0 && !a.relic;
  if (!memePieces(a.runes, b.runes) || !memePieces(a.artifacts, b.artifacts)) return false;
  if (!a.relic || !b.relic) return !a.relic && !b.relic;
  return a.relic.id === b.relic.id && comparerPiece(a.relic, b.relic);
}

export interface ResumeEcarts {
  modifiees: number;
  disparues: number;
}

export function resumeEcarts(e: EquipeEnregistree, inv: InventaireCompte): ResumeEcarts {
  let modifiees = 0;
  let disparues = 0;
  for (const m of e.monstres) {
    if (!m.equipement) continue;
    const etats = etatsEquipement(m.equipement, inv);
    for (const x of [...etats.runes, ...etats.artefacts, ...(etats.relique ? [etats.relique] : [])]) {
      if (x === 'modifiee') modifiees++;
      else if (x === 'disparue') disparues++;
    }
  }
  return { modifiees, disparues };
}

/* --------------------------------------------------------------------------
 * Recherche et ordre
 * ----------------------------------------------------------------------- */

// Les équipes d'un onglet, filtrées par catégorie (`null` : toutes) et par
// monstres recherchés, les plus récemment modifiées d'abord.
// Une équipe est retenue si elle contient TOUS les monstres recherchés ; une
// collaboration et sa version SW comptent pour la même espèce.
export function equipesFiltrees(
  equipes: readonly EquipeEnregistree[], categorie: CategorieEquipes, sous: SousCategorieEquipes | null, recherche: readonly Monster[],
  monstreParCom2us: ReadonlyMap<number, Monster>
): EquipeEnregistree[] {
  const canon = (com2usId: number) => idCanoniqueCollab(com2usId, monstreParCom2us.get(com2usId)?.jumeauCollab);
  const voulus = recherche.filter((m) => m.com2usId != null).map((m) => idCanoniqueCollab(m.com2usId as number, m.jumeauCollab));
  return equipes
    .filter((e) => categorieDe(e.onglet) === categorie && (sous === null || sousCategorieDe(e.onglet) === sous))
    .filter((e) => { const ids = new Set(e.monstres.map((m) => canon(m.com2usId))); return voulus.every((v) => ids.has(v)); })
    .sort((a, b) => Date.parse(b.modifieLe) - Date.parse(a.modifieLe) || a.id.localeCompare(b.id));
}

// Le total de chaque rangement ; celui d'un onglet est la somme de ses
// catégories et de ses équipes sans catégorie.
export function compteParOnglet(equipes: readonly EquipeEnregistree[]): Record<OngletEquipes, number> {
  const c = Object.fromEntries(ONGLETS_EQUIPES.map((o) => [o, 0])) as Record<OngletEquipes, number>;
  for (const e of equipes) c[e.onglet]++;
  return c;
}
export function compteParCategorie(equipes: readonly EquipeEnregistree[]): Record<CategorieEquipes, number> {
  const c = Object.fromEntries(CATEGORIES_EQUIPES.map((o) => [o, 0])) as Record<CategorieEquipes, number>;
  for (const e of equipes) c[categorieDe(e.onglet)]++;
  return c;
}

/* --------------------------------------------------------------------------
 * Opérations
 * ----------------------------------------------------------------------- */

export type TirerId = () => string;

export function nomEquipeLibre(equipes: readonly EquipeEnregistree[], modele: (n: number) => string): string {
  const noms = new Set(equipes.map((e) => e.nom));
  for (let n = 1; ; n++) if (!noms.has(modele(n))) return modele(n);
}

export function creerEquipe(id: string, onglet: OngletEquipes, nom: string, maintenant: Date): EquipeEnregistree {
  const d = maintenant.toISOString();
  return { id, onglet, nom, note: '', monstres: [], leader: null, creeLe: d, modifieLe: d };
}

// Un geste sur le brouillon de « Nouvelle équipe » : il reste brouillon sous
// deux monstres, et devient l'équipe à enregistrer dès le deuxième.
export function gesteSurBrouillon(
  b: EquipeEnregistree, f: (e: EquipeEnregistree, maintenant: Date) => EquipeEnregistree, maintenant: Date
): { brouillon: EquipeEnregistree | null; aEnregistrer: EquipeEnregistree | null } {
  const suite = f(b, maintenant);
  return suite.monstres.length < bornesMonstres(suite.onglet).min ? { brouillon: suite, aEnregistrer: null } : { brouillon: null, aEnregistrer: suite };
}

const touchee = (e: EquipeEnregistree, maintenant: Date): EquipeEnregistree => ({ ...e, modifieLe: maintenant.toISOString() });

export function ajouterMonstre(e: EquipeEnregistree, m: MonstreEnregistre, maintenant: Date): EquipeEnregistree | null {
  // La limite du contenu, à la création comme ensuite.
  if (e.monstres.length >= monstresMax(e.onglet) || e.monstres.some((x) => x.uid === m.uid)) return null;
  return touchee({ ...e, monstres: [...e.monstres, m] }, maintenant);
}

// Retirer un monstre remet le leader à `null` s'il le désignait et retire ses
// liens de lignes : la ligne reste dans le plan, sans monstre.
export function retirerMonstre(e: EquipeEnregistree, uid: string, maintenant: Date): EquipeEnregistree {
  const suite: EquipeEnregistree = { ...e, monstres: e.monstres.filter((m) => m.uid !== uid), leader: e.leader === uid ? null : e.leader };
  if (e.speedTune) suite.speedTune = { ...e.speedTune, liens: e.speedTune.liens.filter((l) => l.monstre !== uid) };
  return touchee(suite, maintenant);
}

export function deplacerMonstre(e: EquipeEnregistree, uid: string, position: number, maintenant: Date): EquipeEnregistree {
  const i = e.monstres.findIndex((m) => m.uid === uid);
  if (i < 0) return e;
  const cible = Math.max(0, Math.min(e.monstres.length - 1, position));
  if (cible === i) return e;
  const monstres = [...e.monstres];
  const [m] = monstres.splice(i, 1);
  monstres.splice(cible, 0, m);
  return touchee({ ...e, monstres }, maintenant);
}

export function designerLeader(e: EquipeEnregistree, uid: string | null, maintenant: Date): EquipeEnregistree {
  if (estPrepa(e.onglet)) return e;
  if (uid !== null && !e.monstres.some((m) => m.uid === uid)) return e;
  return touchee({ ...e, leader: uid }, maintenant);
}

export function remplacerEquipement(
  e: EquipeEnregistree, uid: string, equipement: GearSet | null, provenance: ProvenanceEquipement, maintenant: Date
): EquipeEnregistree {
  return touchee({ ...e, monstres: e.monstres.map((m) => m.uid === uid
    ? { ...m, provenance, equipement: equipement === null ? null : structuredClone(equipement) } : m) }, maintenant);
}

export function modifierTextes(e: EquipeEnregistree, champs: { nom?: string; note?: string }, maintenant: Date): EquipeEnregistree {
  const nom = champs.nom !== undefined && champs.nom.trim() !== '' ? champs.nom.trim() : e.nom;
  const note = champs.note !== undefined ? champs.note.trim() : e.note;
  if (nom === e.nom && note === e.note) return e;
  return touchee({ ...e, nom, note }, maintenant);
}

// Un groupe ne sort pas de son onglet : changer d'onglet quitte le groupe.
// Une prépa et une équipe ne s'échangent pas : entre la RTA et un autre
// onglet, rien ne change (leader, speed tune et lien n'ont pas de sens dans
// une prépa ; une prépa peut dépasser six monstres).
export function deplacerVersOnglet(e: EquipeEnregistree, onglet: OngletEquipes, maintenant: Date): EquipeEnregistree {
  if (e.onglet === onglet || estPrepa(e.onglet) !== estPrepa(onglet)) return e;
  const { groupe, ...reste } = e;
  return touchee(groupe && categorieDe(onglet) === categorieDe(e.onglet) ? { ...reste, groupe, onglet } : { ...reste, onglet }, maintenant);
}

// Vide (après trim) : l'équipe quitte son groupe.
export function modifierGroupe(e: EquipeEnregistree, groupe: string, maintenant: Date): EquipeEnregistree {
  const nom = groupe.trim();
  if ((e.groupe ?? '') === nom) return e;
  const { groupe: _ancien, ...reste } = e;
  return touchee(nom ? { ...reste, groupe: nom } : reste, maintenant);
}

// Nouveaux `id` et `uid` ; le leader et les liens suivent la correspondance
// ancien → nouveau `uid`. Jamais de lien vers l'Optimizer : deux équipes ne
// mettent pas à jour la même liste. Jamais de groupe : la copie porterait les
// mêmes runes que l'original dans le même groupe.
export function dupliquerEquipe(e: EquipeEnregistree, id: string, nom: string, tirerUid: TirerId, maintenant: Date): EquipeEnregistree {
  const nouveaux = new Map(e.monstres.map((m) => [m.uid, tirerUid()]));
  const d = maintenant.toISOString();
  const copie: EquipeEnregistree = {
    id, onglet: e.onglet, nom, note: e.note,
    monstres: e.monstres.map((m) => ({ ...copierMonstre(m), uid: nouveaux.get(m.uid)! })),
    leader: e.leader === null ? null : nouveaux.get(e.leader) ?? null,
    creeLe: d, modifieLe: d,
  };
  if (e.speedTune) {
    copie.speedTune = {
      plan: e.speedTune.plan === null ? null : structuredClone(e.speedTune.plan),
      liens: e.speedTune.liens.filter((l) => nouveaux.has(l.monstre))
        .map((l) => ({ ...l, monstre: nouveaux.get(l.monstre)!, repli: { ...l.repli } })),
    };
  }
  return copie;
}

export function tireurIdentifiants(prefixe: string): TirerId {
  return () => `${prefixe}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* --------------------------------------------------------------------------
 * Relecture et écritures
 * ----------------------------------------------------------------------- */

// La relecture au démarrage s'applique SOUS les gestes déjà faits : pour un
// même `id`, l'état en mémoire gagne ; une équipe supprimée pendant la
// relecture ne revient pas.
export function fusionnerRelecture(
  memoire: readonly EquipeEnregistree[], relues: readonly EquipeEnregistree[], supprimees: ReadonlySet<string>
): EquipeEnregistree[] {
  const enMemoire = new Set(memoire.map((e) => e.id));
  return [...memoire, ...relues.filter((e) => !enMemoire.has(e.id) && !supprimees.has(e.id))];
}

// Ce qu'un changement d'état demande d'écrire : les équipes nouvelles ou
// changées (par référence : les opérations rendent un nouvel objet), et les
// identifiants disparus.
export function ecrituresEntre(
  avant: readonly EquipeEnregistree[], apres: readonly EquipeEnregistree[]
): { aEcrire: EquipeEnregistree[]; aSupprimer: string[] } {
  const anciens = new Map(avant.map((e) => [e.id, e]));
  const presents = new Set(apres.map((e) => e.id));
  return {
    aEcrire: apres.filter((e) => anciens.get(e.id) !== e),
    aSupprimer: avant.filter((e) => !presents.has(e.id)).map((e) => e.id),
  };
}

/* --------------------------------------------------------------------------
 * Libellés
 * ----------------------------------------------------------------------- */

export function libelleSousCategorie(categorie: CategorieEquipes, sous: SousCategorieEquipes, t: Dictionnaire): string {
  return (t.equipes.sousCategories[categorie] as Readonly<Record<string, string>>)[sous] ?? sous;
}
// « Cairos — Géant », ou l'onglet seul pour une équipe sans catégorie.
export function libelleRangement(onglet: OngletEquipes, t: Dictionnaire): string {
  const c = categorieDe(onglet);
  const s = sousCategorieDe(onglet);
  return t.equipes.rangement(t.equipes.categories[c], s ? libelleSousCategorie(c, s, t) : null);
}

/* --------------------------------------------------------------------------
 * Groupes
 * ----------------------------------------------------------------------- */

// Les groupes d'un onglet, par nom.
export function groupesDeLOnglet(equipes: readonly EquipeEnregistree[], categorie: CategorieEquipes): string[] {
  return [...new Set(equipes.filter((e) => categorieDe(e.onglet) === categorie && e.groupe).map((e) => e.groupe!))]
    .sort((a, b) => a.localeCompare(b));
}
export function equipesDuGroupe(equipes: readonly EquipeEnregistree[], categorie: CategorieEquipes, groupe: string): EquipeEnregistree[] {
  return equipes.filter((e) => categorieDe(e.onglet) === categorie && e.groupe === groupe);
}

// Les groupes d'abord, chacun d'un bloc, dans l'ordre de leur équipe la plus
// récente ; puis les équipes hors groupe. L'ordre reçu reste celui de chaque bloc.
export function regrouper(equipes: readonly EquipeEnregistree[]): EquipeEnregistree[] {
  const groupes = [...new Set(equipes.filter((e) => e.groupe).map((e) => e.groupe!))];
  return [...groupes.flatMap((g) => equipes.filter((e) => e.groupe === g)), ...equipes.filter((e) => !e.groupe)];
}

// « Groupe N », le premier nom libre parmi les groupes de l'onglet.
export function nomGroupeLibre(groupes: readonly string[], modele: (n: number) => string): string {
  for (let n = 1; ; n++) if (!groupes.includes(modele(n))) return modele(n);
}

// Forme ou modifie un groupe de l'onglet depuis la page : `nom` pour les
// équipes `ids` ; une équipe de l'`ancien` groupe hors de `ids` le quitte.
// Une équipe d'un autre groupe cochée change de groupe.
export function appliquerGroupe(
  equipes: readonly EquipeEnregistree[], categorie: CategorieEquipes, ancien: string | null, nom: string,
  ids: ReadonlySet<string>, maintenant: Date
): EquipeEnregistree[] {
  return equipes.map((e) => {
    if (categorieDe(e.onglet) !== categorie) return e;
    if (ids.has(e.id)) return modifierGroupe(e, nom, maintenant);
    return ancien !== null && e.groupe === ancien ? modifierGroupe(e, '', maintenant) : e;
  });
}

// Ce que deux équipes d'un groupe portent à la fois : une rune ou un artéfact
// (par son identifiant du jeu ; une pièce sans identifiant n'est jamais
// comptée), jamais la relique (règle relevée par l'utilisateur le
// 2026-11-22 : elle ne fait pas conflit entre équipes d'un groupe), ou
// une espèce, quel que soit l'exemplaire. Règle de jeu relevée par
// l'utilisateur le 2026-11-22 : dans un contenu où les équipes se jouent
// ensemble, une rune ne sert qu'à l'une d'elles, et une espèce ne s'y joue
// qu'une fois, même si le compte en a plusieurs exemplaires.
// Chaque conflit nomme ses éléments (demande de l'utilisateur) : la pièce et
// ceux qui la portent, l'espèce et ses équipes.
export type PieceEnConflit =
  | { type: 'rune'; piece: RuneDetail }
  | { type: 'artefact'; piece: ArtifactDetail };
export interface PorteurPiece { equipe: string; uid: string; com2usId: number } // `equipe` : son id
// Les pièces de mêmes porteurs, réunies : un monstre recopié dans deux équipes
// partage ses runes et ses artéfacts, et une ligne le dit au lieu de huit.
export interface ConflitPieces { porteurs: PorteurPiece[]; pieces: PieceEnConflit[] }
// `formes` : les `com2usId` rencontrés, une collaboration et sa version SW
// comptant pour la même espèce (décision de l'utilisateur, 2026-11-22).
export interface ConflitEspece { com2usId: number; formes: number[]; equipes: string[] } // `equipes` : les ids, dans l'ordre du groupe
// Dans l'ordre de leur première équipe.
export interface ConflitsGroupe { pieces: ConflitPieces[]; especes: ConflitEspece[] }
export function conflitsGroupe(equipes: readonly Pick<EquipeEnregistree, 'id' | 'monstres'>[], monstreParCom2us: ReadonlyMap<number, Monster> = new Map()): ConflitsGroupe {
  const piecesPortees = new Map<string, { piece: PieceEnConflit; porteurs: PorteurPiece[] }>();
  const porter = (cle: string, piece: PieceEnConflit, porteur: PorteurPiece) => {
    const vu = piecesPortees.get(cle);
    if (vu) vu.porteurs.push(porteur); else piecesPortees.set(cle, { piece, porteurs: [porteur] });
  };
  const especes = new Map<number, { formes: number[]; equipes: string[] }>();
  for (const e of equipes) {
    for (const m of e.monstres) {
      const p: PorteurPiece = { equipe: e.id, uid: m.uid, com2usId: m.com2usId };
      const eq = m.equipement;
      if (eq) {
        for (const r of eq.runes) if (r.id > 0) porter(`r${r.id}`, { type: 'rune', piece: r }, p);
        for (const a of eq.artifacts) if (a.id > 0) porter(`a${a.id}`, { type: 'artefact', piece: a }, p);
      }
      const canon = idCanoniqueCollab(m.com2usId, monstreParCom2us.get(m.com2usId)?.jumeauCollab);
      const vue = especes.get(canon) ?? { formes: [], equipes: [] };
      if (!vue.formes.includes(m.com2usId)) vue.formes.push(m.com2usId);
      if (!vue.equipes.includes(e.id)) vue.equipes.push(e.id);
      especes.set(canon, vue);
    }
  }
  // Une pièce compte quand deux équipes la portent ; deux monstres d'une même
  // équipe qui la portent ne sont pas un conflit de groupe.
  const parPorteurs = new Map<string, ConflitPieces>();
  for (const { piece, porteurs } of piecesPortees.values()) {
    if (new Set(porteurs.map((p) => p.equipe)).size < 2) continue;
    const cle = porteurs.map((p) => `${p.equipe}:${p.uid}`).join('|');
    const conflit = parPorteurs.get(cle);
    if (conflit) conflit.pieces.push(piece); else parPorteurs.set(cle, { porteurs, pieces: [piece] });
  }
  return {
    pieces: [...parPorteurs.values()],
    especes: [...especes].filter(([, v]) => v.equipes.length > 1).map(([com2usId, v]) => ({ com2usId, formes: v.formes, equipes: v.equipes })),
  };
}

// Le nombre de pièces portées par plusieurs équipes du groupe.
export function nombrePiecesEnConflit(c: ConflitsGroupe): number {
  return c.pieces.reduce((n, x) => n + x.pieces.length, 0);
}

// Une pièce dite par ce qui la distingue sur son porteur : le set et le slot
// d'une rune, la sorte et l'attribut ou le type d'un artéfact.
export function libellePieceEnConflit(p: PieceEnConflit, t: Dictionnaire): string {
  const c = t.equipes.groupes.piece;
  if (p.type === 'rune') return c.rune(nomSet(t.jeu, p.piece.set), p.piece.slot);
  const a = p.piece;
  const valeur = a.intangible ? nomSet(t.jeu, 'intangible')
    : a.kind === 'element' ? nomElement(t.jeu, a.element) : (t.jeu.archetypes as Record<string, string>)[a.archetype ?? ''] ?? '—';
  return c.artefact(t.jeu.sortesArtefact[a.kind], valeur);
}
