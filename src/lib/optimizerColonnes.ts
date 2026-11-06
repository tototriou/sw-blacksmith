// Les configurations du bureau, calculées sur la largeur du conteneur
// (docs/02-app/optimizer/ecran/README.md). ⚠️ Les trois réglages sont
// TOUJOURS dans un seul groupe d'onglets (décision de l'utilisateur : trois
// colonnes de réglages faisaient trop à l'écran pour un utilisateur
// ordinaire), à côté de « Monstre » et des résultats. Quand la place le
// permet, le groupe passe à son cran large, la largeur de « Monstre », ses
// sections toujours l'une sous l'autre ; quand elle manque vraiment, l'objectif et les résultats
// deviennent un quatrième onglet du groupe, qui prend toute la largeur à côté
// de « Monstre » (décisions de l'utilisateur). L'onglet est local à l'écran,
// hors recette et hors recherche.
export type ColonneReglage = 'criteres' | 'artefacts' | 'complements';
export type OngletBureau = ColonneReglage | 'resultats';
export type ConfigurationBureau = 'groupe-large' | 'groupe' | 'quatre-onglets';

// Des places : le panneau retire 8 px, la gouttière en ajoute 10, soit
// 18 px entre panneaux (décision de l'utilisateur : des écarts plus
// serrés). La barre de défilement est dans le panneau, dont le cadre ne
// défile jamais : un panneau compte son contour (2), son rembourrage (2 × 8)
// et la barre (8) autour de son contenu ; `reglage` garde ainsi 294 px de
// contenu, et « Monstre » 358. Les résultats, sans place, prennent toute
// leur piste. `reglageLarge` : la place de « Monstre » (décision de
// l'utilisateur : les deux colonnes de même largeur).
export const LARGEURS_BUREAU = { monstre: 392, reglage: 328, reglageLarge: 392, resultats: 360, gouttiere: 10 } as const;
export const RETRAIT_PANNEAU = 8;
const L = LARGEURS_BUREAU;
const BASE = L.monstre + L.gouttiere + L.resultats;
export const SEUILS_BUREAU = {
  groupe: BASE + L.gouttiere + L.reglage,
  groupeLarge: BASE + L.gouttiere + L.reglageLarge,
} as const;

export interface DispositionBureau {
  configuration: ConfigurationBureau;
  groupe: OngletBureau[];
  // La place du groupe d'onglets à côté des résultats ; 0 quand les
  // résultats sont un onglet : le groupe prend alors toute la largeur.
  reglage: number;
}

// La largeur que les résultats demandent pour le tableau : sa largeur
// minimale (`SEUIL_TABLEAU_PX`, TableauResultats.tsx, 661) plus ce que la
// colonne ou l'onglet des résultats prennent autour de la zone : contour 2,
// rembourrage 2 × 8 et barre réservée de 8, dans le panneau
// (bureau/panneau.ts, `DEFILEMENT`).
export const RESULTATS_TABLEAU = 661 + 26;

const GROUPE: OngletBureau[] = ['criteres', 'artefacts', 'complements'];

// Du plus large au plus étroit.
const CONFIGURATIONS: { disposition: DispositionBureau; seuil: number }[] = [
  { disposition: { configuration: 'groupe-large', groupe: GROUPE, reglage: L.reglageLarge }, seuil: SEUILS_BUREAU.groupeLarge },
  { disposition: { configuration: 'groupe', groupe: GROUPE, reglage: L.reglage }, seuil: SEUILS_BUREAU.groupe },
  { disposition: { configuration: 'quatre-onglets', groupe: [...GROUPE, 'resultats'], reglage: 0 }, seuil: 0 },
];

// La largeur des résultats (leur colonne, ou leur onglet).
export function largeurResultats(largeur: number, configuration: ConfigurationBureau): number {
  const { reglage } = CONFIGURATIONS.find((x) => x.disposition.configuration === configuration)!.disposition;
  return largeur - L.monstre - L.gouttiere - (reglage ? reglage + L.gouttiere : 0);
}

// `tableau` (le réglage « Résultats de l'Optimizer », Paramètres) : la
// configuration la plus large qui laisse `RESULTATS_TABLEAU` aux résultats.
// Aucune ne le permet (trop étroit) : celle de la largeur seule, et les
// résultats en cartes.
export function configurationBureau(largeur: number, tableau = false): DispositionBureau {
  const possibles = CONFIGURATIONS.filter((c) => largeur >= c.seuil);
  if (tableau) {
    const pourTableau = possibles.find((c) => largeurResultats(largeur, c.disposition.configuration) >= RESULTATS_TABLEAU);
    if (pourTableau) return pourTableau.disposition;
  }
  return possibles[0].disposition;
}

// Un guidage ouvre son onglet ; sinon l'onglet précédent, ou le premier.
export function ongletOuvert(groupe: readonly OngletBureau[], precedent: OngletBureau | null, guidage: OngletBureau | null = null): OngletBureau | null {
  if (guidage && groupe.includes(guidage)) return guidage;
  return precedent && groupe.includes(precedent) ? precedent : groupe[0] ?? null;
}

export type AttenteResultats = 'sans-monstre' | 'sans-recherche' | 'sans-carte';
export function attenteResultats(monstre: boolean, resultatsPresents: boolean, statut: 'idle' | 'running' | 'done' | 'error' | 'refused'): AttenteResultats | null {
  if (!monstre) return 'sans-monstre';
  if (resultatsPresents) return null;
  return statut === 'idle' ? 'sans-recherche' : 'sans-carte';
}
