// L'écran de préparation d'un combat de siège (ou de son test) : à gauche les
// trois ATTAQUANTS, leader en premier, chacun avec sa VIT DE COMBAT écrite sous
// son portrait (lead et totem compris) ; à droite la défense, sans VIT.
//
// ⚠️ Ni le format de l'image, ni la taille des cartes, ni la couleur des
// cadres ne comptent : les cartes se TROUVENT à leur contour, et les
// attaquants sont celles qui portent une pastille de VIT (cartes.ts,
// pastille.ts). Sans trois attaquants trouvés, l'écran n'est pas reconnu :
// aucune position n'est supposée.

import type { Image } from './image';
import { lireNombre, type Gabarits, type NombreLu } from './chiffres';
import { variantes, type Banque, type Reconnaissance } from './portraits';
import { trouverCartes, type Rect } from './cartes';
import { zoneVitesse } from './pastille';

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

// Une VIT de combat possible en siège, où l'on règle des vitesses : au-delà,
// ce n'est pas une VIT (une capture d'un autre écran, un nombre mal découpé,
// un chiffre perdu — « 66 » pour 314).
export const VIT_MIN = 100;
export const VIT_MAX = 450;

// Une VIT FAUSSE est pire qu'un refus, qui demande une capture plus grande :
// sous CONFIANCE_VIT_PLANCHER, la VIT n'est pas lue, ni quand un de ses
// chiffres est presque à égalité avec un autre (MARGE_VIT_MIN) sans que la
// lecture agrandie donne le même nombre. ⚠️ Sous HAUTEUR_SURE pixels, l'écart
// ne suffit plus : un 9 et un 0 de 6 pixels ne diffèrent que de deux ou trois
// pixels. Relevé sur 17 vraies captures réduites jusqu'à des chiffres de 5
// pixels et compressées : à 5 et 6 pixels, sans accord des deux lectures, 69
// justes et 9 fausses (« 340 » pour 349, écart jusqu'à 0,07), aux écarts
// mêlés ; seul l'accord y vaut (34 justes, aucune fausse). À 7 pixels et plus,
// aucune fausse ne passe la règle de l'écart.
export const CONFIANCE_VIT_PLANCHER = 0.7;
const MARGE_VIT_MIN = 0.05;
const HAUTEUR_SURE = 7;

const plausible = (lu: NombreLu | null): NombreLu | null =>
  (lu && lu.valeur >= VIT_MIN && lu.valeur <= VIT_MAX && lu.confiance >= CONFIANCE_VIT_PLANCHER
    && (lu.accord || (lu.marge >= MARGE_VIT_MIN && lu.hauteur >= HAUTEUR_SURE)) ? lu : null);

// `null` : les trois cartes des attaquants ne sont pas dans l'image.
export function lireEcranPreparation(img: Image, banque: Banque, gabarits: Gabarits): LectureEcran | null {
  const cartes = trouverCartes(img);
  if (!cartes) return null;
  const monstre = (rect: Rect): MonstreLu => ({ rect, portrait: banque.reconnaitre(variantes(img, rect)) });
  const vitesse = (rect: Rect) => {
    const zone = zoneVitesse(img, rect);
    return plausible(zone ? lireNombre(zone, gabarits) : null);
  };
  return {
    attaquants: cartes.attaquants.map((rect): AttaquantLu => ({ ...monstre(rect), vitesse: vitesse(rect) })),
    defense: cartes.defense.map(monstre),
  };
}
