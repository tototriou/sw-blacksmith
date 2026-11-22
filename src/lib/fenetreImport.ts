// La fenêtre d'import commune à Mes équipes et à l'Optimizer : ce qu'elle
// montre (une source, un contenu, une recherche), ce qu'on y choisit (des
// équipes, ou des monstres), et ce que le choix produit (des équipes
// enregistrées, des monstres, un import de l'Optimizer).
//
// Spec : docs/02-app/transverse/feat-fenetre-import.md. Tout est pur : la
// fenêtre (src/components/FenetreImport.tsx) et ses deux écrans n'appellent
// que ces fonctions.

import type { Monster } from '../types';
import type { Dictionnaire } from '../i18n/fr';
import { exclusionSelectorKey, type ExclusionSourceData } from './optimizerExclusion';
import type { ImportOptimizer, ProducteurImportOptimizer } from './importEquipes';
import { preparerExportEquipeOptimizer, preparerExportGroupeOptimizer } from './importEquipesEnregistrees';
import type { ImportEquipeCree, SourceFenetre, SourceImportEquipe } from './sourcesEquipesEnregistrees';
import {
  categorieDe, conflitsGroupe, creerEquipe, estPrepa, sousCategorieDe,
  type CategorieEquipes, type ConflitsGroupe, type EquipeEnregistree, type InventaireCompte, type MonstreEnregistre,
  type OngletEquipes, type SousCategorieEquipes, type TirerId,
} from './equipesEnregistrees';

/* --------------------------------------------------------------------------
 * Ce que la fenêtre montre
 * ----------------------------------------------------------------------- */

export interface FiltreFenetre {
  source: SourceFenetre;
  // `null` : tous les contenus.
  categorie: CategorieEquipes | null;
  // `null` : toute la catégorie.
  sous: SousCategorieEquipes | null;
  texte: string;
}

// Les sources rangées par contenu se filtrent par contenu ; les listes de
// l'Optimizer et les recommandations se lisent par liste ou par
// recommandation, qui ne désignent pas de contenu.
export const filtrableParContenu = (s: SourceFenetre): boolean => s === 'jeu' || s === 'equipes';

// Sans casse ni accents : « eclat » trouve « Éclat ».
const replier = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function correspondTexte(s: Pick<SourceImportEquipe, 'libelle' | 'monstres'>, texte: string): boolean {
  const q = replier(texte.trim());
  if (!q) return true;
  return replier(s.libelle).includes(q) || s.monstres.some((m) => replier(m.name).includes(q));
}

// Une source sans rangement (un compte manquant, une liste vide) dit pourquoi
// la source est vide : elle reste visible quel que soit le contenu.
function dansLeContenu(s: SourceImportEquipe, f: FiltreFenetre): boolean {
  if (!filtrableParContenu(f.source) || f.categorie === null || !s.rangement) return true;
  if (categorieDe(s.rangement) !== f.categorie) return false;
  return f.sous === null || sousCategorieDe(s.rangement) === f.sous;
}

export function sourcesVisibles(sources: readonly SourceImportEquipe[], f: FiltreFenetre): SourceImportEquipe[] {
  return sources.filter((s) => s.source === f.source && dansLeContenu(s, f) && correspondTexte(s, f.texte));
}

// Ce que chaque contenu propose d'importable dans la source : par catégorie
// (`arene`), par rangement (`arene/offense`) et en tout (`''`).
export function comptesParContenu(sources: readonly SourceImportEquipe[], source: SourceFenetre): Map<string, number> {
  const res = new Map<string, number>();
  const plus = (cle: string) => res.set(cle, (res.get(cle) ?? 0) + 1);
  for (const s of sources) {
    if (s.source !== source || s.raison !== null) continue;
    plus('');
    if (!s.rangement) continue;
    plus(categorieDe(s.rangement));
    if (sousCategorieDe(s.rangement)) plus(s.rangement);
  }
  return res;
}

// Les sources sous leur en-tête de section, et dans une section les équipes
// d'un même bloc (une liste, un groupe, les défenses de siège) à la suite.
export interface BlocFenetre { bloc: { cle: string; nom: string } | null; sources: SourceImportEquipe[] }
export interface SectionFenetre { groupe: string; blocs: BlocFenetre[] }
export function sectionsFenetre(visibles: readonly SourceImportEquipe[]): SectionFenetre[] {
  const sections: SectionFenetre[] = [];
  for (const s of visibles) {
    let section = sections[sections.length - 1];
    if (!section || section.groupe !== s.groupe) sections.push(section = { groupe: s.groupe, blocs: [] });
    const dernier = section.blocs[section.blocs.length - 1];
    const cle = s.bloc?.cle ?? null;
    if (dernier && (dernier.bloc?.cle ?? null) === cle && cle !== null) dernier.sources.push(s);
    else section.blocs.push({ bloc: s.bloc ?? null, sources: [s] });
  }
  return sections;
}

// Le contenu ouvert au départ : l'onglet de Mes équipes, avec sa catégorie ;
// tous les contenus depuis l'Optimizer.
export function filtreInitial(source: SourceFenetre, onglet: OngletEquipes | null): FiltreFenetre {
  return { source, categorie: onglet ? categorieDe(onglet) : null, sous: onglet ? sousCategorieDe(onglet) : null, texte: '' };
}

// La première source, dans l'ordre de l'écran, qui a de quoi importer ; la
// première tout court sinon.
export function sourceInitiale(sources: readonly SourceImportEquipe[], ordre: readonly SourceFenetre[]): SourceFenetre {
  return ordre.find((o) => sources.some((s) => s.source === o && s.raison === null)) ?? ordre[0];
}

/* --------------------------------------------------------------------------
 * Ce qu'on y choisit
 * ----------------------------------------------------------------------- */

// Un monstre d'une source : la source, et sa place parmi les monstres connus
// qu'elle montre.
export interface ChoixMonstre { cle: string; index: number }
// Des équipes OU des monstres, jamais les deux : choisir l'un vide l'autre.
export interface SelectionImport { equipes: string[]; monstres: ChoixMonstre[] }
export const SELECTION_VIDE: SelectionImport = { equipes: [], monstres: [] };

export const selectionVide = (s: SelectionImport): boolean => s.equipes.length === 0 && s.monstres.length === 0;
export const monstreChoisi = (s: SelectionImport, c: ChoixMonstre): boolean => s.monstres.some((x) => x.cle === c.cle && x.index === c.index);

export function basculerEquipe(s: SelectionImport, cle: string): SelectionImport {
  return { equipes: s.equipes.includes(cle) ? s.equipes.filter((x) => x !== cle) : [...s.equipes, cle], monstres: [] };
}

// Tout le bloc : coché s'il ne l'était pas entièrement, décoché sinon.
export function basculerBloc(s: SelectionImport, cles: readonly string[]): SelectionImport {
  const tous = cles.length > 0 && cles.every((c) => s.equipes.includes(c));
  return { equipes: tous ? s.equipes.filter((c) => !cles.includes(c)) : [...s.equipes, ...cles.filter((c) => !s.equipes.includes(c))], monstres: [] };
}

// `max` : la place qui reste (l'équipe ouverte de Mes équipes) ; au-delà, le
// geste n'ajoute rien.
export function basculerMonstre(s: SelectionImport, c: ChoixMonstre, max = Infinity): SelectionImport {
  if (monstreChoisi(s, c)) return { equipes: [], monstres: s.monstres.filter((x) => x.cle !== c.cle || x.index !== c.index) };
  if (s.monstres.length >= max) return { equipes: [], monstres: s.monstres };
  return { equipes: [], monstres: [...s.monstres, c] };
}

/* --------------------------------------------------------------------------
 * Ce que le choix produit
 * ----------------------------------------------------------------------- */

export interface EquipeChoisie { source: SourceImportEquipe; cree: ImportEquipeCree }

// Les équipes choisies, créées dans l'ordre du choix ; une source qui ne crée
// plus rien (elle a changé entre-temps) est laissée de côté.
export function creerEquipesChoisies(
  sources: readonly SourceImportEquipe[], cles: readonly string[], tirerId: TirerId, tirerUid: TirerId, maintenant: Date
): EquipeChoisie[] {
  return cles.flatMap((cle) => {
    const source = sources.find((s) => s.cle === cle && s.raison === null);
    const cree = source?.creer(tirerId(), tirerUid, maintenant);
    return source && cree ? [{ source, cree }] : [];
  });
}

// Les monstres choisis, dans l'ordre du choix, avec ce que leur source leur
// donne (exemplaire, équipement). La place `index` compte parmi les monstres
// connus de la source ; l'équipe créée garde le même ordre, on y prend la
// même occurrence de l'espèce.
export function monstresChoisis(
  sources: readonly SourceImportEquipe[], choix: readonly ChoixMonstre[], tirerUid: TirerId, maintenant: Date
): MonstreEnregistre[] {
  const crees = new Map<string, EquipeEnregistree | null>();
  const res: MonstreEnregistre[] = [];
  for (const c of choix) {
    const source = sources.find((s) => s.cle === c.cle);
    const espece = source?.monstres[c.index];
    if (!source || !espece || espece.com2usId == null) continue;
    if (!crees.has(c.cle)) crees.set(c.cle, source.creer(`choix:${c.cle}`, tirerUid, maintenant)?.equipe ?? null);
    const equipe = crees.get(c.cle);
    const rang = source.monstres.slice(0, c.index).filter((m) => m.com2usId === espece.com2usId).length;
    const m = equipe?.monstres.filter((x) => x.com2usId === espece.com2usId)[rang];
    if (m) res.push(m);
  }
  return res;
}

// La catégorie où les équipes choisies peuvent former un groupe : la même pour
// toutes, et pas l'onglet RTA (des prépas, sans groupe). `null` sinon.
export function categorieDuGroupe(equipes: readonly Pick<EquipeEnregistree, 'onglet'>[]): CategorieEquipes | null {
  if (equipes.length < 2) return null;
  const c = categorieDe(equipes[0].onglet);
  return !estPrepa(c) && equipes.every((e) => categorieDe(e.onglet) === c) ? c : null;
}

// Ce que les équipes choisies portent à la fois, comme dans un groupe de Mes
// équipes : à lire avant de les importer ensemble. Chaque équipe y est
// désignée par la clé de sa source.
export function conflitsSelection(
  sources: readonly SourceImportEquipe[], cles: readonly string[], monstreParCom2us: ReadonlyMap<number, Monster>
): ConflitsGroupe {
  if (cles.length < 2) return { pieces: [], especes: [] };
  let n = 0;
  const choisies = creerEquipesChoisies(sources, cles, () => cles[n++], tirerLocal('c'), new Date(0));
  return conflitsGroupe(choisies.map((c) => ({ ...c.cree.equipe, id: c.source.cle })), monstreParCom2us);
}

const tirerLocal = (prefixe: string): TirerId => { let n = 0; return () => `${prefixe}${++n}`; };

/* --------------------------------------------------------------------------
 * Vers l'Optimizer
 * ----------------------------------------------------------------------- */

// Les propositions réunies en une : une liste où tout se partage les runes.
// Un même membre proposé deux fois (un exemplaire dans deux sources) n'y
// entre qu'une fois ; les équipes le désignent par son sélecteur.
export function fusionnerImports(propositions: readonly ImportOptimizer[], nomListe: string): ImportOptimizer {
  const vus = new Set<string>();
  const buildsVus = new Set<string>();
  const res: ImportOptimizer = { nomListe, contenu: propositions[0]?.contenu ?? 'autre', membres: [], equipes: [], ignores: [], messages: [] };
  for (const p of propositions) {
    for (const m of p.membres) {
      const cle = exclusionSelectorKey(m.selector);
      if (!vus.has(cle)) { vus.add(cle); res.membres.push(m); }
    }
    res.equipes.push(...p.equipes);
    res.ignores.push(...p.ignores);
    res.messages.push(...p.messages);
    for (const b of p.buildsAValider ?? []) {
      const cle = exclusionSelectorKey(b.selector);
      if (buildsVus.has(cle)) continue;
      buildsVus.add(cle);
      (res.buildsAValider ??= []).push(b);
    }
  }
  return res;
}

// Le nom de la liste d'un import : celui de l'équipe ou du monstre seul, celui
// du bloc choisi en entier, sinon le premier choisi et combien d'autres.
function nomDuChoix(premier: string, autres: number, bloc: string | null, t: Dictionnaire): string {
  if (bloc) return bloc;
  return autres > 0 ? t.fenetreImport.nomSelection(premier, autres) : premier;
}

// Le bloc entier, et lui seul, quand le choix en est un.
function blocEntier(sources: readonly SourceImportEquipe[], cles: readonly string[]): string | null {
  const choisies = cles.map((c) => sources.find((s) => s.cle === c));
  const bloc = choisies[0]?.bloc;
  if (!bloc || choisies.some((s) => s?.bloc?.cle !== bloc.cle)) return null;
  const membres = sources.filter((s) => s.bloc?.cle === bloc.cle && s.raison === null);
  return membres.length === cles.length && membres.length > 1 ? bloc.nom : null;
}

// L'import de l'Optimizer pour le choix. Une équipe seule garde l'import de sa
// source (siège, prépa RTA, recommandation) ; plusieurs se réunissent en une
// liste, celles sans import propre passant comme un groupe de Mes équipes.
// Des monstres partent en membres seuls, sans équipe. `ongletDefaut` : le
// contenu de la liste quand le choix n'en désigne pas.
export function producteurChoix(
  sources: readonly SourceImportEquipe[], selection: SelectionImport, inv: InventaireCompte, ongletDefaut: OngletEquipes
): ProducteurImportOptimizer | null {
  if (selection.monstres.length) {
    const choix = selection.monstres;
    return (data, t) => {
      const monstres = monstresChoisis(sources, choix, tirerLocal('m'), new Date());
      const premiere = sources.find((s) => s.cle === choix[0].cle);
      const onglet = premiere?.rangement ?? ongletDefaut;
      const premier = premiere?.monstres[choix[0].index]?.name ?? '';
      const nom = nomDuChoix(premier, monstres.length - 1, null, t);
      const equipe: EquipeEnregistree = { ...creerEquipe('choix', onglet, nom, new Date()), monstres };
      // Des monstres seuls : des membres, sans équipe ni lead.
      return { ...preparerExportEquipeOptimizer(equipe, data, inv, t).proposition, equipes: [] };
    };
  }
  const cles = selection.equipes;
  if (!cles.length) return null;
  const choisies = cles.map((c) => sources.find((s) => s.cle === c)).filter((s): s is SourceImportEquipe => !!s && s.raison === null);
  if (!choisies.length) return null;
  if (choisies.length === 1 && choisies[0].produireOptimizer) return choisies[0].produireOptimizer;
  const bloc = blocEntier(sources, cles);
  return (data: ExclusionSourceData, t: Dictionnaire) => {
    const propositions: ImportOptimizer[] = [];
    const sansImport: EquipeEnregistree[] = [];
    // Dans l'ordre du choix : une équipe sans import propre attend les autres
    // pour partir avec elles, en une proposition de groupe.
    for (const s of choisies) {
      if (s.produireOptimizer) { propositions.push(s.produireOptimizer(data, t)); continue; }
      const cree = s.creer(`choix:${s.cle}`, tirerLocal(`u${sansImport.length}-`), new Date());
      if (cree) sansImport.push(cree.equipe);
    }
    if (sansImport.length) {
      propositions.push(preparerExportGroupeOptimizer('', sansImport, data, inv, t).proposition);
    }
    return fusionnerImports(propositions, nomDuChoix(choisies[0].libelle, choisies.length - 1, bloc, t));
  };
}
