// L'écran de préparation d'un combat de siège (ou de son test) : à gauche les
// trois ATTAQUANTS, leader en premier, chacun avec sa VIT DE COMBAT écrite sous
// son portrait (lead et totem compris) ; à droite la défense, sans VIT.
//
// ⚠️ Le format de l'image ne compte pas : les cartes se TROUVENT à leurs
// cadres (cartes.ts), sur un téléphone, une tablette, une fenêtre PC avec ou
// sans barre de titre, ou une capture recadrée sur les trois attaquants. Sans
// trois cadres d'attaquant trouvés, l'écran n'est pas reconnu : aucune
// position n'est supposée.

import { decouper, type Image } from './image';
import { lireNombre, type Gabarits, type NombreLu } from './chiffres';
import { variantes, type Banque, type Reconnaissance } from './portraits';
import { trouverCartes, type Rect } from './cartes';

// Où chercher la VIT dans une carte, en fractions de sa largeur et de sa
// hauteur : x, y, largeur, hauteur. En bas à droite, après l'icône de vitesse,
// mais pas au même endroit selon l'écran : la zone du téléphone ; celle du PC,
// plus basse et plus étroite (des chiffres de 9 pixels, que le bas du
// portrait, clair, gênait) ; et chacune élargie vers la gauche, pour un nombre
// qui commence plus tôt (l'icône de vitesse qui y entre n'est pas lue, voir
// `lireNombre`). La zone qui lit le plus de VIT plausibles l'emporte.
export const ZONES_VIT: Rect[] = [
  [0.6, 0.78, 0.37, 0.18],
  [0.6, 0.83, 0.37, 0.13],
  [0.45, 0.78, 0.52, 0.18],
  [0.45, 0.83, 0.52, 0.13],
];

export function zoneVitesse(img: Image, [x, y, l, h]: Rect, [zx, zy, zl, zh]: Rect): Image | null {
  return decouper(img, x + zx * l, y + zy * h, zl * l, zh * h);
}

export interface MonstreLu {
  rect: Rect;
  portrait: Reconnaissance | null;
}
export interface AttaquantLu extends MonstreLu {
  vitesse: NombreLu | null;
}
export interface LectureEcran {
  attaquants: AttaquantLu[];
  defense: MonstreLu[];
}

// Une VIT de combat possible : au-delà, ce n'est pas une VIT (une capture d'un
// autre écran, un nombre mal découpé).
export const VIT_MIN = 50;
export const VIT_MAX = 450;

// Une VIT FAUSSE est pire qu'un refus, qui demande une capture plus grande :
// sous CONFIANCE_VIT_PLANCHER, la VIT n'est pas lue, ni sous
// CONFIANCE_VIT_SURE quand un de ses chiffres est presque à égalité avec un
// autre (MARGE_VIT_MIN). Relevé sur sept vraies captures, chacune lue avec
// des gabarits qui n'ont pas ses chiffres, réduites, agrandies et compressées :
// aucune lecture fausse ne passe ; les captures d'origine se lisent toutes.
export const CONFIANCE_VIT_PLANCHER = 0.65;
const CONFIANCE_VIT_SURE = 0.75;
const MARGE_VIT_MIN = 0.05;

const plausible = (lu: NombreLu | null): NombreLu | null =>
  (lu && lu.valeur >= VIT_MIN && lu.valeur <= VIT_MAX && lu.confiance >= CONFIANCE_VIT_PLANCHER
    && (lu.confiance >= CONFIANCE_VIT_SURE || lu.marge >= MARGE_VIT_MIN) ? lu : null);

// `null` : les trois cadres des attaquants ne sont pas dans l'image.
export function lireEcranPreparation(img: Image, banque: Banque, gabarits: Gabarits): LectureEcran | null {
  const cartes = trouverCartes(img);
  if (!cartes) return null;
  const monstre = (rect: Rect): MonstreLu => ({ rect, portrait: banque.reconnaitre(variantes(img, rect)) });
  const lectures = ZONES_VIT.map((z) => cartes.attaquants.map((rect) => {
    const zone = zoneVitesse(img, rect, z);
    return plausible(zone ? lireNombre(zone, gabarits) : null);
  }));
  const valeur = (l: (NombreLu | null)[]) => l.filter(Boolean).length * 10 + l.reduce((s, x) => s + (x?.confiance ?? 0), 0);
  const vitesses = lectures.reduce((a, b) => (valeur(b) > valeur(a) ? b : a));
  return {
    attaquants: cartes.attaquants.map((rect, k): AttaquantLu => ({ ...monstre(rect), vitesse: vitesses[k] })),
    defense: cartes.defense.map(monstre),
  };
}
