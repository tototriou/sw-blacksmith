// Le top des artéfacts par propriété secondaire — la vue « Top 10 » de Mon
// compte › Artéfacts (docs/02-app/compte/feat-artefacts.md § Top 10).
//
// Pour un groupe d'artéfacts (un attribut ou un type, intangibles compris), chaque
// propriété portée devient une COLONNE : ses meilleures valeurs, triées. Les
// colonnes se rangent par FAMILLE (dégâts reçus d'abord, puis l'ordre de la
// recherche du jeu).
//
// ⚠️ **On classe la valeur brute de la ligne, propriété par propriété.** Deux
// propriétés n'ont pas d'échelle commune (docs/02-app/compte/feat-calcul-artefacts.md) :
// la vue ne compare jamais une colonne à une autre, seulement les artéfacts
// entre eux sur UNE propriété.

import { ArtifactArchetype, ArtifactDetail, ElementKey } from '../types';
import { CODES_SOUS_PROPRIETES, artifactSubKinds, artifactSubName, artifactSubOrder, isArtifactSub } from './effects';
// Titres et en-têtes dans la langue reçue (`t`) : les libellés du jeu qu'ils
// citent viennent du lexique de cette langue.
import type { Dictionnaire } from '../i18n/fr';
import { nomElement } from '../i18n/jeu';
import { artifactScore } from './artifacts';

// Le groupe montré : un attribut ou un type.
export type GroupeTop = Exclude<ElementKey, 'unknown'> | ArtifactArchetype;

const ELEMENTS_TOP: GroupeTop[] = ['water', 'fire', 'wind', 'light', 'dark'];

// Le nom d'un groupe vient du lexique du jeu (`nomElement`, `nomArchetype`).
export const GROUPES_TOP: { key: GroupeTop }[] = [
  { key: 'water' },
  { key: 'fire' },
  { key: 'wind' },
  { key: 'light' },
  { key: 'dark' },
  { key: 'attack' },
  { key: 'defense' },
  { key: 'hp' },
  { key: 'support' },
];

export const TAILLE_TOP = 10;

export const estGroupeElement = (g: GroupeTop): g is Exclude<ElementKey, 'unknown'> => ELEMENTS_TOP.includes(g);

// ⚠️ **Un intangible compte dans TOUS les groupes de sa sorte** : il se pose
// sur n'importe quel monstre, donc un intangible d'attribut est une pièce
// pour l'Eau comme pour le Feu. Son attribut ou son type lu ne veut rien dire
// (com2us envoie 98) : on ne s'en sert jamais.
export function dansGroupe(art: ArtifactDetail, groupe: GroupeTop): boolean {
  const groupeElement = estGroupeElement(groupe);
  if (art.intangible) return (art.kind === 'element') === groupeElement;
  return art.kind === 'element' ? art.element === groupe : art.archetype === groupe;
}

// Les familles de colonnes, dans l'ordre de la « Recherche détaillée de
// sous-propriétés » du jeu (`SUB_ORDER`, effects.ts) — sauf les dégâts
// reçus, passés devant (voir `FAMILLES`).
//
// ⚠️ **Le nom EN ENTIER dans le titre du tableau, le seul élément qui varie
// dans la colonne** : « Augmentation des dégâts infligés », puis « Feu »,
// « Eau »… Le jeu abrège ses libellés (« Aug. des dgts infl. au Feu ») faute
// de place sur sa fiche ; ici, le titre a la place, et répété dans cinq
// colonnes le nom noyait ce qui les distingue. Une colonne sans élément
// propre (`entete` absent) prend le nom complet de la propriété
// (`artifactSubName`), sur plusieurs lignes.
// Titres et en-têtes se lisent dans la langue de `t` : les familles portent
// une CLÉ (`artefactsCompte.familles`), les en-têtes une fonction du dictionnaire.
type Entete = (t: Dictionnaire) => string;
type CleFamille = keyof Dictionnaire['artefactsCompte']['familles'];
interface FamilleDef {
  titre: CleFamille;
  colonnes: { code: number; entete?: Entete }[];
}

const PAR_ELEMENT = (base: number) =>
  (['fire', 'water', 'wind', 'light', 'dark'] as const).map((el, i) => ({
    code: base + i,
    entete: (t: Dictionnaire) => nomElement(t.jeu, el),
  }));

const PAR_COMPETENCE = (base: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ code: base + i, entete: (t: Dictionnaire) => t.artefactsCompte.competence(String(i + 1)) }));

const stat = (cle: 'hp' | 'atk' | 'def' | 'spd'): Entete => (t) => t.jeu.stats[cle];

// ⚠️ **Les dégâts REÇUS d'abord**, puis les infligés — l'inverse de la
// recherche du jeu, à dessein : c'est la ligne qu'on cherche d'abord sur un
// artéfact d'attribut (choix de Thomas). Le reste suit l'ordre du jeu.
const FAMILLES: FamilleDef[] = [
  { titre: 'recus', colonnes: PAR_ELEMENT(305) },
  { titre: 'infliges', colonnes: PAR_ELEMENT(300) },
  {
    titre: 'critiques',
    colonnes: [
      ...PAR_COMPETENCE(400, 4),
      { code: 410, entete: (t) => t.artefactsCompte.competence('3/4') },
      { code: 411, entete: (t) => t.artefactsCompte.premiereAttaque },
    ],
  },
  { titre: 'soins', colonnes: PAR_COMPETENCE(404, 3) },
  { titre: 'precision', colonnes: PAR_COMPETENCE(407, 3) },
  {
    titre: 'renforcement',
    colonnes: [
      { code: 226, entete: (t) => `${t.jeu.stats.atk}/${t.jeu.stats.def}` },
      { code: 204, entete: stat('atk') },
      { code: 205, entete: stat('def') },
    ],
  },
  {
    titre: 'proportion',
    colonnes: [
      { code: 218, entete: stat('hp') },
      { code: 219, entete: stat('atk') },
      { code: 220, entete: stat('def') },
      { code: 221, entete: stat('spd') },
    ],
  },
  { titre: 'cible', colonnes: [{ code: 222 }, { code: 223 }, { code: 224 }] },
];

// Tout le reste tombe sous « Autres sous-propriétés », comme dans le jeu
// (`artefactsCompte.familles.autres`).

export interface CelluleTop {
  art: ArtifactDetail;
  valeur: number;
}

export interface ColonneTop {
  code: number;
  entete: string;
  // L'en-tête est l'élément qui varie (« Feu »), pas le nom complet : il
  // tient sur une ligne.
  court: boolean;
  cellules: CelluleTop[];
}

export interface FamilleTop {
  titre: string;
  colonnes: ColonneTop[];
}

// Les stats principales d'artéfact, dans l'ordre du jeu : 100 PV, 101 ATQ,
// 102 DEF.
export const PRINCIPALES = [100, 101, 102] as const;

// Un artéfact retenu par le filtre de stat principale : `null` = toutes,
// sinon les codes COCHÉS — une liste blanche, cumulable (PV et DEF ensemble).
export const dePrincipale = (art: ArtifactDetail, principales: readonly number[] | null): boolean =>
  principales === null || principales.includes(art.main.code);

// Les familles du groupe : TOUTES celles que sa sorte peut porter, avec
// toutes leurs colonnes, même vides.
//
// ⚠️ **Les tableaux ne bougent jamais d'un groupe ou d'un filtre à l'autre** :
// une colonne vide se lit (« je n'ai rien là »), alors qu'une colonne qui
// disparaît décale les autres et ne dit pas ce qui manque. Seules les
// propriétés IMPOSSIBLES pour la sorte sont écartées (`artifactSubKinds`) : un
// artéfact d'attribut ne porte jamais « Aug. des soins », ce tableau serait
// vide à jamais. Une colonne a donc de 0 à `taille` valeurs ; l'écran
// complète avec des cases vides.
//
// `principales` : ne garder que les artéfacts de ces stats principales — « mes
// réductions de dégâts reçus, sur des artéfacts PV ou DEF ». Vide : rien.
export function topParPropriete(
  artifacts: ArtifactDetail[],
  groupe: GroupeTop,
  t: Dictionnaire,
  principales: readonly number[] | null = null,
  taille = TAILLE_TOP
): FamilleTop[] {
  const parCode = new Map<number, CelluleTop[]>();
  for (const art of artifacts) {
    if (!dansGroupe(art, groupe) || !dePrincipale(art, principales)) continue;
    for (const s of art.subs) {
      if (!isArtifactSub(s.code)) continue;
      const liste = parCode.get(s.code) ?? [];
      liste.push({ art, valeur: s.value });
      parCode.set(s.code, liste);
    }
  }

  // ⚠️ Ex æquo départagés par le SCORE de l'artéfact, puis son identifiant :
  // deux « +20 % » se valent sur la colonne, mais le mieux tombé dans
  // l'ensemble passe devant — et l'ordre ne change pas d'un rendu à l'autre.
  const scores = new Map<ArtifactDetail, number>();
  const score = (a: ArtifactDetail) => {
    let s = scores.get(a);
    if (s === undefined) scores.set(a, (s = artifactScore(a)));
    return s;
  };
  const colonne = (code: number, entete?: Entete): ColonneTop => ({
    code,
    entete: entete ? entete(t) : artifactSubName(code, t.jeu),
    court: entete !== undefined,
    cellules: (parCode.get(code) ?? [])
      .sort((x, y) => y.valeur - x.valeur || score(y.art) - score(x.art) || x.art.id - y.art.id)
      .slice(0, taille),
  });

  const sorte = estGroupeElement(groupe) ? 'element' : 'archetype';
  const possible = (code: number) => artifactSubKinds(code).includes(sorte);
  const ranges = new Set<number>();
  const familles: FamilleTop[] = [];
  for (const f of FAMILLES) {
    const colonnes = f.colonnes.filter((c) => possible(c.code)).map((c) => colonne(c.code, c.entete));
    for (const c of f.colonnes) ranges.add(c.code);
    if (colonnes.length > 0) familles.push({ titre: t.artefactsCompte.familles[f.titre], colonnes });
  }
  const autres = CODES_SOUS_PROPRIETES
    .filter((code) => possible(code) && !ranges.has(code))
    .sort((a, b) => artifactSubOrder(a) - artifactSubOrder(b))
    .map((code) => colonne(code));
  if (autres.length > 0) familles.push({ titre: t.artefactsCompte.familles.autres, colonnes: autres });
  return familles;
}

// Le nombre d'artéfacts de chaque groupe — la pastille d'un groupe vide reste
// affichée, désactivée.
export function effectifsGroupes(artifacts: ArtifactDetail[]): Record<GroupeTop, number> {
  const n = Object.fromEntries(GROUPES_TOP.map((g) => [g.key, 0])) as Record<GroupeTop, number>;
  for (const art of artifacts) for (const g of GROUPES_TOP) if (dansGroupe(art, g.key)) n[g.key]++;
  return n;
}
