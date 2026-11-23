import { ArtifactArchetype, ArtifactDetail, ArtifactKind, RUNE_SETS, RuneDetail } from '../types';
import {
  CODES_SOUS_PROPRIETES,
  artifactSubKinds,
  artifactSubOrder,
  isArtifactSub,
  runeEfficiency,
  valeurArtefactPropre,
} from './effects';
import { runePotential } from './runeOptim';
import { formatExport, formatReconnu } from './formatsExport';

// OBJECTIFS DU COMPTE : combien de runes et d'artéfacts de qualité le joueur
// vise, par set et par emplacement, et où en est son compte.
// Voir docs/02-app/compte/feat-objectifs.md.
//
// ⚠️ Le seuil d'une rune est TOUJOURS une efficience, quel que soit le choix
// Efficience / Score SW de l'affichage : les objectifs s'écrivent en
// pourcentages, et un même seuil ne peut pas valoir dans les deux mesures.

// Une case d'objectif : le seuil à atteindre (efficience en %, ou vitesse) et
// le nombre de pièces visées.
export interface CibleCase {
  seuil: number;
  quantite: number;
}

// Un set et ses cases, une par emplacement de son bloc (6 pour l'efficience,
// 5 pour la vitesse : `EMPLACEMENTS_VITESSE`).
export interface ObjectifSet {
  set: string;
  cases: CibleCase[];
}

// Un palier d'efficience (« Base », « Premium »…). ⚠️ `nom` absent = le nom
// par défaut de son rang, dans la langue affichée : un nom écrit en dur dans la
// donnée resterait en français pour un joueur anglais.
export interface Palier {
  nom?: string;
  // Le « si max » du palier : meule et gemme au maximum héroïque, ou au maximum
  // légendaire. Absent = héroïque.
  potentiel?: Potentiel;
  sets: ObjectifSet[];
}

export type Potentiel = 'heroique' | 'legendaire';
export const POTENTIELS: Potentiel[] = ['heroique', 'legendaire'];

export type CleArtefact = 'fire' | 'water' | 'wind' | 'light' | 'dark' | ArtifactArchetype;

// ARTÉFACTS : pas d'efficience — elle mesure la qualité des rolls, pas
// l'utilité des lignes, et ne dit rien de ce qu'un artéfact apporte. On compte
// les artéfacts qui portent UNE secondaire donnée à une valeur donnée au moins.
//
// Un tableau : une sorte (Attribut ou Type), un filtre de principale (0 =
// toutes), et des lignes. Une ligne : une secondaire (code com2us, 200-411),
// sa valeur minimale, et la quantité visée par colonne — chaque élément
// (Attribut) ou chaque style (Type), dans l'ordre de `COLONNES_ARTEFACT`.
export type SorteArtefact = 'attribut' | 'type';
export type FiltrePrincipale = 0 | 100 | 101 | 102;
export const FILTRES_PRINCIPALE: FiltrePrincipale[] = [0, 100, 101, 102];

export interface LigneArtefact {
  effet: number;
  seuil: number;
  quantites: number[];
}

export interface TableauArtefact {
  principale: FiltrePrincipale;
  lignes: LigneArtefact[];
}

export interface ObjectifsCompte {
  paliers: Palier[];
  vitesse: ObjectifSet[];
  artefacts: Record<SorteArtefact, TableauArtefact[]>;
}

export const EMPLACEMENTS = [1, 2, 3, 4, 5, 6] as const;
// ⚠️ Sans l'emplacement 2 : il porte la vitesse en PRINCIPALE, qu'aucune
// secondaire ne peut égaler.
export const EMPLACEMENTS_VITESSE = [1, 3, 4, 5, 6] as const;
export const ELEMENTS_ARTEFACT: CleArtefact[] = ['fire', 'water', 'wind', 'light', 'dark'];
export const STYLES_ARTEFACT: CleArtefact[] = ['attack', 'defense', 'hp', 'support'];
export const COLONNES_ARTEFACT: Record<SorteArtefact, CleArtefact[]> = { attribut: ELEMENTS_ARTEFACT, type: STYLES_ARTEFACT };
const KIND: Record<SorteArtefact, ArtifactKind> = { attribut: 'element', type: 'archetype' };

// Les secondaires qu'une sorte peut porter, dans l'ordre de la recherche du jeu.
export function effetsArtefact(sorte: SorteArtefact): number[] {
  return CODES_SOUS_PROPRIETES.filter((c) => artifactSubKinds(c).includes(KIND[sorte])).sort(
    (a, b) => artifactSubOrder(a) - artifactSubOrder(b)
  );
}

export const TABLEAUX_ARTEFACT_MAX = 12;
export const LIGNES_ARTEFACT_MAX = 30;

// Le joker : il complète n'importe quel set, donc il n'en remplit aucun. Il a
// sa propre colonne et ne s'objective pas.
const INTANGIBLE = 'intangible';
export const SETS_OBJECTIFS: string[] = RUNE_SETS.map((s) => s.key).filter((k) => k !== INTANGIBLE);

export const PALIERS_MAX = 5;
export const BORNES = {
  efficience: { min: 0, max: 200 },
  vitesse: { min: 0, max: 99 },
  quantite: { min: 0, max: 999 },
  // Une secondaire d'artéfact, en valeur absolue (« -22 % » s'écrit 22).
  sousPropriete: { min: 0, max: 100 },
} as const;

// Les défauts : un palier « Base » à 100 %, un « Premium » à 110 % avec moins
// de runes visées ; la vitesse à 28 (29 en Swift) ; les artéfacts par
// secondaire (`ARTEFACTS_DEFAUT`).
//
// Quantités par emplacement : [set, Base, Premium]. Premium vise moins de
// runes, de meilleure qualité.
const QUANTITES_DEFAUT: [string, number, number][] = [
  ['violent', 20, 8],
  ['will', 12, 6],
  ['despair', 12, 6],
  ['shield', 12, 6],
  ['destroy', 6, 3],
  ['nemesis', 6, 3],
  ['seal', 2, 2],
];
const VITESSE_DEFAUT: [string, number, number][] = [
  ['despair', 28, 2],
  ['swift', 29, 3],
  ['violent', 28, 3],
  ['will', 28, 3],
];

const cases = (n: number, seuil: number, quantite: number): CibleCase[] =>
  Array.from({ length: n }, () => ({ seuil, quantite }));

const palierDefaut = (seuil: number, potentiel: Potentiel, rang: 0 | 1): Palier => ({
  potentiel,
  sets: QUANTITES_DEFAUT.map(([set, base, premium]) => ({
    set,
    cases: cases(EMPLACEMENTS.length, seuil, rang === 0 ? base : premium),
  })),
});

// Artéfacts d'attribut : dégâts infligés à chaque élément (300-304, dans
// l'ordre de `ELEMENTS_ARTEFACT`) au moins +18 %, et dégâts reçus de chaque
// élément (305-309) au moins -22 %.
const INFLIGES = [300, 301, 302, 303, 304];
const RECUS = [305, 306, 307, 308, 309];
// L'élément que chacun bat : un artéfact de cet élément-là gagne à réduire les
// dégâts de celui-ci, d'où une pièce de plus visée.
const BAT: Record<string, CleArtefact> = { water: 'fire', fire: 'wind', wind: 'water', light: 'dark', dark: 'light' };
const partout = (q: number) => ELEMENTS_ARTEFACT.map(() => q);
const tableauInfliges = (principale: FiltrePrincipale, q: number): TableauArtefact => ({
  principale,
  lignes: INFLIGES.map((effet) => ({ effet, seuil: 18, quantites: partout(q) })),
});
const tableauRecus = (principale: FiltrePrincipale): TableauArtefact => ({
  principale,
  lignes: RECUS.map((effet, r) => ({
    effet,
    seuil: 22,
    quantites: ELEMENTS_ARTEFACT.map((c) => (BAT[ELEMENTS_ARTEFACT[r]] === c ? 3 : 2)),
  })),
});

// Artéfacts de type : [secondaire, valeur minimale], puis la quantité visée par
// style (Attaque, Défense, PV, Support) pour chaque principale.
const TYPE_DEFAUT: [number, number, Record<100 | 101 | 102, number[]>][] = [
  [407, 22, { 100: [1, 2, 2, 2], 101: [0, 0, 0, 0], 102: [0, 2, 2, 2] }], // [Comp.1] Précision
  [408, 22, { 100: [1, 2, 2, 2], 101: [0, 0, 0, 0], 102: [0, 2, 2, 2] }], // [Comp.2] Précision
  [409, 22, { 100: [1, 2, 2, 2], 101: [0, 0, 0, 0], 102: [0, 2, 2, 2] }], // [Comp.3] Précision
  [214, 14, { 100: [1, 2, 2, 2], 101: [0, 0, 0, 0], 102: [0, 1, 1, 1] }], // Dgts CRIT reçus
  [206, 22, { 100: [1, 1, 2, 2], 101: [1, 1, 1, 1], 102: [1, 1, 1, 1] }], // Effet aug. VIT
  [400, 22, { 100: [1, 1, 1, 1], 101: [2, 0, 1, 1], 102: [0, 1, 1, 1] }], // [Comp.1] Dgts CRIT
  [401, 22, { 100: [1, 1, 1, 1], 101: [2, 0, 1, 2], 102: [0, 1, 1, 1] }], // [Comp.2] Dgts CRIT
  [402, 22, { 100: [1, 1, 1, 1], 101: [2, 0, 1, 2], 102: [0, 1, 1, 1] }], // [Comp.3] Dgts CRIT
  [404, 22, { 100: [1, 1, 1, 2], 101: [1, 0, 1, 1], 102: [0, 1, 1, 1] }], // [Comp.1] Soins
  [405, 22, { 100: [1, 1, 2, 2], 101: [1, 0, 1, 1], 102: [0, 1, 1, 1] }], // [Comp.2] Soins
  [406, 22, { 100: [1, 1, 2, 2], 101: [1, 0, 1, 1], 102: [0, 1, 1, 1] }], // [Comp.3] Soins
];
const tableauType = (principale: 100 | 101 | 102): TableauArtefact => ({
  principale,
  lignes: TYPE_DEFAUT.map(([effet, seuil, q]) => ({ effet, seuil, quantites: [...q[principale]] })),
});

export const ARTEFACTS_DEFAUT: ObjectifsCompte['artefacts'] = {
  attribut: [
    tableauInfliges(0, 2),
    tableauInfliges(100, 1),
    tableauInfliges(101, 2),
    tableauInfliges(102, 1),
    tableauRecus(0),
    tableauRecus(100),
    tableauRecus(102),
  ],
  type: [
    tableauType(100),
    tableauType(101),
    tableauType(102),
    // Effet renforcement ATQ, sur les artéfacts d'ATQ.
    { principale: 101, lignes: [{ effet: 204, seuil: 15, quantites: [1, 0, 1, 1] }] },
  ],
};

// « Premium » : meule et gemme légendaires, ce qu'on met sur les meilleures
// runes ; « Base » : héroïques.
export const OBJECTIFS_DEFAUT: ObjectifsCompte = {
  paliers: [palierDefaut(100, 'heroique', 0), palierDefaut(110, 'legendaire', 1)],
  vitesse: VITESSE_DEFAUT.map(([set, s, q]) => ({ set, cases: cases(EMPLACEMENTS_VITESSE.length, s, q) })),
  artefacts: ARTEFACTS_DEFAUT,
};

// ─── Lecture ───────────────────────────────────────────────────────────────

// Pourquoi une valeur n'a pas été lue : le fichier n'est pas un fichier
// d'objectifs, ou il en est un mais mal formé. Le texte vient du dictionnaire.
export type RaisonRefus = 'format' | 'contenu';
export type Lecture = { ok: true; objectifs: ObjectifsCompte } | { ok: false; raison: RaisonRefus };

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const entierBorne = (v: unknown, b: { min: number; max: number }): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= b.min && v <= b.max ? v : null;

function lireCases(v: unknown, n: number, seuil: { min: number; max: number }): CibleCase[] | null {
  if (!Array.isArray(v) || v.length !== n) return null;
  const sortie: CibleCase[] = [];
  for (const c of v) {
    if (!estObjet(c)) return null;
    const s = entierBorne(c.seuil, seuil);
    const q = entierBorne(c.quantite, BORNES.quantite);
    if (s === null || q === null || !Number.isInteger(q)) return null;
    sortie.push({ seuil: s, quantite: q });
  }
  return sortie;
}

// Les sets d'un bloc : un set inconnu, l'Intangible ou un doublon rendent le
// bloc illisible — ils ne se devinent pas.
function lireSets(v: unknown, n: number, seuil: { min: number; max: number }): ObjectifSet[] | null {
  if (!Array.isArray(v)) return null;
  const vus = new Set<string>();
  const sortie: ObjectifSet[] = [];
  for (const o of v) {
    if (!estObjet(o) || typeof o.set !== 'string' || !SETS_OBJECTIFS.includes(o.set) || vus.has(o.set)) return null;
    const c = lireCases(o.cases, n, seuil);
    if (!c) return null;
    vus.add(o.set);
    sortie.push({ set: o.set, cases: c });
  }
  return sortie;
}

// Les tableaux d'une sorte d'artéfact : une secondaire que la sorte ne peut pas
// porter, une principale inconnue ou un nombre de colonnes faux rendent le
// tout illisible.
function lireArtefacts(v: unknown, sorte: SorteArtefact): TableauArtefact[] | null {
  if (!Array.isArray(v) || v.length > TABLEAUX_ARTEFACT_MAX) return null;
  const n = COLONNES_ARTEFACT[sorte].length;
  const sortie: TableauArtefact[] = [];
  for (const t of v) {
    if (!estObjet(t) || !FILTRES_PRINCIPALE.includes(t.principale as FiltrePrincipale)) return null;
    if (!Array.isArray(t.lignes) || t.lignes.length > LIGNES_ARTEFACT_MAX) return null;
    const lignes: LigneArtefact[] = [];
    for (const l of t.lignes) {
      if (!estObjet(l) || typeof l.effet !== 'number' || !isArtifactSub(l.effet)) return null;
      if (!artifactSubKinds(l.effet).includes(KIND[sorte])) return null;
      const seuil = entierBorne(l.seuil, BORNES.sousPropriete);
      if (seuil === null || !Array.isArray(l.quantites) || l.quantites.length !== n) return null;
      const quantites: number[] = [];
      for (const q of l.quantites) {
        const lu = entierBorne(q, BORNES.quantite);
        if (lu === null || !Number.isInteger(lu)) return null;
        quantites.push(lu);
      }
      lignes.push({ effet: l.effet, seuil, quantites });
    }
    sortie.push({ principale: t.principale as FiltrePrincipale, lignes });
  }
  return sortie;
}

// Les objectifs eux-mêmes, sans enveloppe de fichier. ⚠️ Tout ou rien : une
// partie lisible et une autre non ne donnent pas un mélange de valeurs lues et
// de défauts, qui ne serait ni ce que le joueur a écrit ni ce que l'app propose.
export function lireObjectifs(v: unknown): ObjectifsCompte | null {
  if (!estObjet(v) || !Array.isArray(v.paliers) || v.paliers.length > PALIERS_MAX) return null;
  const paliers: Palier[] = [];
  for (const p of v.paliers) {
    if (!estObjet(p)) return null;
    if (p.nom !== undefined && typeof p.nom !== 'string') return null;
    if (p.potentiel !== undefined && !POTENTIELS.includes(p.potentiel as Potentiel)) return null;
    const sets = lireSets(p.sets, EMPLACEMENTS.length, BORNES.efficience);
    if (!sets) return null;
    const nom = typeof p.nom === 'string' ? p.nom.trim() : '';
    paliers.push({
      ...(nom ? { nom } : {}),
      ...(p.potentiel !== undefined ? { potentiel: p.potentiel as Potentiel } : {}),
      sets,
    });
  }
  const vitesse = lireSets(v.vitesse, EMPLACEMENTS_VITESSE.length, BORNES.vitesse);
  if (!vitesse || !estObjet(v.artefacts)) return null;
  const attribut = lireArtefacts(v.artefacts.attribut, 'attribut');
  const type = lireArtefacts(v.artefacts.type, 'type');
  if (!attribut || !type) return null;
  return { paliers, vitesse, artefacts: { attribut, type } };
}

// Relit la valeur du stockage (ou d'une session) : illisible → les défauts.
export function lireObjectifsStockes(brut: string | null): ObjectifsCompte {
  if (brut === null) return OBJECTIFS_DEFAUT;
  try {
    return lireObjectifs(JSON.parse(brut)) ?? OBJECTIFS_DEFAUT;
  } catch {
    return OBJECTIFS_DEFAUT;
  }
}

export const FORMAT_OBJECTIFS = 'objectifs-compte';
const VERSION_FICHIER = 1;

export function fichierObjectifs(o: ObjectifsCompte): string {
  return JSON.stringify({ format: formatExport(FORMAT_OBJECTIFS), version: VERSION_FICHIER, objectifs: o }, null, 2);
}

export function lireFichierObjectifs(texte: string): Lecture {
  let v: unknown;
  try {
    v = JSON.parse(texte);
  } catch {
    return { ok: false, raison: 'format' };
  }
  if (!estObjet(v) || !formatReconnu(v.format, FORMAT_OBJECTIFS)) return { ok: false, raison: 'format' };
  if (v.version !== VERSION_FICHIER) return { ok: false, raison: 'contenu' };
  const objectifs = lireObjectifs(v.objectifs);
  return objectifs ? { ok: true, objectifs } : { ok: false, raison: 'contenu' };
}

// ─── Calcul ────────────────────────────────────────────────────────────────

// Une ligne d'un tableau : un emplacement (runes) ou une principale (artéfacts).
export interface LigneProfondeur {
  cle: number;
  seuil: number;
  vise: number;
  actuel: number;
  // Runes seulement : le même compte si chaque rune était poussée au maximum du
  // potentiel du palier (`Palier.potentiel`). Vitesse : la plus rapide de la
  // case (absente si aucune).
  siMax?: number;
  plusRapide?: number;
  // Les pièces Intangibles qui passent le même seuil : affichées, jamais
  // comptées dans le score (une même pièce compléterait tous les sets à la fois).
  intangible: number;
}

export interface TableauProfondeur {
  cle: string;
  lignes: LigneProfondeur[];
  vise: number;
  compte: number; // Σ min(actuel, visé)
  score: number | null; // compte / visé, null si rien n'est visé
  compteMax?: number;
  scoreMax?: number | null;
  // Artéfacts : les Intangibles qui portent la secondaire, hors colonnes et
  // hors score.
  intangible?: number;
}

export interface BlocProfondeur {
  tableaux: TableauProfondeur[];
  // Score de chaque emplacement (ou principale), tous sets confondus.
  parLigne: { cle: number; score: number | null }[];
  global: number | null;
}

const ratio = (compte: number, vise: number): number | null => (vise > 0 ? compte / vise : null);

// Le NIVEAU d'un score, de 0 (rouge) à 4 (vert) : moins de 30 %, moins de 50 %,
// moins de 70 %, moins de 100 %, puis l'objectif atteint. Il colore les
// cartes du résumé et le score des fiches (tokens `niveau-0` à `niveau-4`).
// Pas de score, pas de niveau.
export type Niveau = 0 | 1 | 2 | 3 | 4;
export function niveauScore(score: number | null): Niveau | null {
  if (score === null) return null;
  if (score >= 1) return 4;
  if (score >= 0.7) return 3;
  if (score >= 0.5) return 2;
  if (score >= 0.3) return 1;
  return 0;
}

// Le niveau d'une CASE comptée : vide (0), entamée (2), atteinte tout juste
// (3), dépassée (4). Rien de visé : neutre.
export function niveauCase(compte: number, vise: number): Niveau | null {
  if (vise <= 0) return null;
  if (compte > vise) return 4;
  if (compte === vise) return 3;
  return compte > 0 ? 2 : 0;
}

// ⚠️ Plafonné CASE PAR CASE : un surplus à l'emplacement 2 ne comble pas un
// manque à l'emplacement 4 — ce sont deux runes différentes à aller chercher.
function tableau(cle: string, lignes: LigneProfondeur[], avecMax: boolean): TableauProfondeur {
  let vise = 0;
  let compte = 0;
  let compteMax = 0;
  for (const l of lignes) {
    vise += l.vise;
    compte += Math.min(l.actuel, l.vise);
    if (l.siMax !== undefined) compteMax += Math.min(l.siMax, l.vise);
  }
  const t: TableauProfondeur = { cle, lignes, vise, compte, score: ratio(compte, vise) };
  if (avecMax) {
    t.compteMax = compteMax;
    t.scoreMax = ratio(compteMax, vise);
  }
  return t;
}

// Scores par ligne et global : le RAPPORT DES TOTAUX, pas la moyenne des
// pourcentages. Un set dont on vise 20 runes pèse plus qu'un set dont on en vise
// 2 : c'est la part des runes visées qu'on possède, toutes confondues.
function bloc(tableaux: TableauProfondeur[], cles: readonly number[]): BlocProfondeur {
  const parLigne = cles.map((cle) => {
    let vise = 0;
    let compte = 0;
    for (const t of tableaux) {
      const l = t.lignes.find((x) => x.cle === cle);
      if (!l) continue;
      vise += l.vise;
      compte += Math.min(l.actuel, l.vise);
    }
    return { cle, score: ratio(compte, vise) };
  });
  const vise = tableaux.reduce((n, t) => n + t.vise, 0);
  const compte = tableaux.reduce((n, t) => n + t.compte, 0);
  return { tableaux, parLigne, global: ratio(compte, vise) };
}

// L'efficience actuelle et les deux « si max » de chaque rune, calculés UNE
// fois pour tous les paliers : meule et gemme au maximum héroïque, ou au
// maximum légendaire.
//
// ⚠️ Les gemmes comme l'onglet Optimisation, « regemme différent » éteint
// (`gemmeExistanteSeule`, runeOptim.ts) : une gemme déjà posée se relance au
// maximum sur SA stat, une rune vierge n'en reçoit pas. Créditer chaque rune
// vierge de la meilleure gemme compterait des runes que le joueur n'a pas.
//
// ⚠️ `max(actuelle, potentiel)` : un scénario ramène chaque meule et gemme à
// SON maximum, et une rune déjà mieux meulée ou mieux gemmée (au héroïque, pour
// le scénario légendaire) « perdrait » sa place. Meuler ne fait jamais baisser
// une rune en jeu.
export interface RuneMesuree {
  rune: RuneDetail;
  eff: number;
  effMax: Record<Potentiel, number>;
}

export function mesurerRunes(runes: readonly RuneDetail[]): RuneMesuree[] {
  return runes.map((rune) => {
    const eff = runeEfficiency(rune);
    const p = runePotential(rune, true, 'eff', true, undefined, false, true);
    return { rune, eff, effMax: { heroique: Math.max(eff, p.heroEff), legendaire: Math.max(eff, p.legendEff) } };
  });
}

// Runes rangées par set puis par emplacement, pour ne parcourir que la case.
function parSetEtEmplacement<T extends { rune: RuneDetail }>(runes: readonly T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of runes) {
    const k = `${r.rune.set}:${r.rune.slot}`;
    const l = m.get(k);
    if (l) l.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export function profondeurPalier(palier: Palier, mesurees: readonly RuneMesuree[]): BlocProfondeur {
  const cases = parSetEtEmplacement(mesurees);
  const potentiel = palier.potentiel ?? 'heroique';
  const tableaux = palier.sets.map((o) =>
    tableau(
      o.set,
      EMPLACEMENTS.map((emp, i) => {
        const { seuil, quantite } = o.cases[i];
        const ici = cases.get(`${o.set}:${emp}`) ?? [];
        return {
          cle: emp,
          seuil,
          vise: quantite,
          actuel: ici.filter((r) => r.eff >= seuil).length,
          siMax: ici.filter((r) => r.effMax[potentiel] >= seuil).length,
          intangible: (cases.get(`${INTANGIBLE}:${emp}`) ?? []).filter((r) => r.eff >= seuil).length,
        };
      }),
      true
    )
  );
  return bloc(tableaux, EMPLACEMENTS);
}

// La vitesse en SECONDAIRE : substats (meule comprise) et innée.
export function vitesseSecondaire(rune: RuneDetail): number {
  let v = 0;
  if (rune.innate?.code === 8) v += rune.innate.value;
  for (const s of rune.subs) if (s.code === 8) v += s.value;
  return v;
}

export function profondeurVitesse(objectifs: readonly ObjectifSet[], runes: readonly RuneDetail[]): BlocProfondeur {
  const cases = parSetEtEmplacement(runes.map((rune) => ({ rune, vit: vitesseSecondaire(rune) })));
  const tableaux = objectifs.map((o) =>
    tableau(
      o.set,
      EMPLACEMENTS_VITESSE.map((emp, i) => {
        const { seuil, quantite } = o.cases[i];
        const ici = cases.get(`${o.set}:${emp}`) ?? [];
        const plusRapide = ici.reduce((m, r) => Math.max(m, r.vit), 0);
        const ligne: LigneProfondeur = {
          cle: emp,
          seuil,
          vise: quantite,
          actuel: ici.filter((r) => r.vit >= seuil).length,
          intangible: (cases.get(`${INTANGIBLE}:${emp}`) ?? []).filter((r) => r.vit >= seuil).length,
        };
        if (plusRapide > 0) ligne.plusRapide = plusRapide;
        return ligne;
      }),
      false
    )
  );
  return bloc(tableaux, EMPLACEMENTS_VITESSE);
}

// Un tableau d'artéfacts : une fiche par secondaire (sa `cle` est son rang dans
// le tableau, une même secondaire pouvant revenir à deux valeurs), une colonne
// par élément ou par style (`cle` = son rang dans `COLONNES_ARTEFACT`).
//
// ⚠️ Les Intangibles n'ont ni élément ni style : ils se comptent par ligne
// (`TableauProfondeur.intangible`), pas par colonne, et jamais dans le score.
export function profondeurArtefacts(
  objectif: TableauArtefact,
  artefacts: readonly ArtifactDetail[],
  sorte: SorteArtefact
): BlocProfondeur {
  const colonnes = COLONNES_ARTEFACT[sorte];
  const ici = artefacts.filter(
    (a) => a.kind === KIND[sorte] && (objectif.principale === 0 || a.main.code === objectif.principale)
  );
  const tableaux = objectif.lignes.map((l, i) => {
    // La valeur NETTOYÉE (`valeurArtefactPropre`) : le jeu accumule les rolls en
    // virgule flottante, et un bruit sous la valeur affichée manquerait le seuil.
    const ok = (a: ArtifactDetail) => a.subs.some((s) => s.code === l.effet && valeurArtefactPropre(s.value) >= l.seuil);
    const t = tableau(
      String(i),
      colonnes.map((c, j) => ({
        cle: j,
        seuil: l.seuil,
        vise: l.quantites[j],
        actuel: ici.filter((a) => !a.intangible && (a.element ?? a.archetype) === c && ok(a)).length,
        intangible: 0,
      })),
      false
    );
    t.intangible = ici.filter((a) => a.intangible && ok(a)).length;
    return t;
  });
  return bloc(
    tableaux,
    colonnes.map((_, j) => j)
  );
}
