// L'écran de préparation d'un combat de siège (ou de son test) : à gauche les
// trois ATTAQUANTS, leader en premier, chacun avec sa VIT DE COMBAT écrite sous
// son portrait (lead et totem compris) ; à droite la défense, sans VIT.
//
// ⚠️ Ni le format de l'image ni la couleur des cadres ne comptent : les cartes
// se TROUVENT à leur contour (cartes.ts), sur un téléphone, une tablette, une
// fenêtre PC avec ou sans barre de titre, ou une capture recadrée sur les
// trois attaquants ; la VIT, dans la pastille trouvée de chaque carte. Sans
// trois carrés d'attaquant trouvés, l'écran n'est pas reconnu : aucune
// position n'est supposée.

import { decouper, type Image } from './image';
import { lireNombre, type Gabarits, type NombreLu } from './chiffres';
import { variantes, type Banque, type Reconnaissance } from './portraits';
import { trouverCartes, type Rect } from './cartes';

// La VIT est écrite en clair dans une PASTILLE sombre, en bas à droite de la
// carte, avec l'icône de vitesse à sa gauche. ⚠️ Sa place exacte varie selon
// l'écran (plus basse sur PC, plus haute sur une carte recadrée) : on la
// TROUVE dans la carte plutôt que de la supposer. Son bas : la plus basse
// rangée PLEINE (une longue suite sombre, jusqu'au bord droit de la carte, où
// la pastille s'appuie) au-dessus du cadre ; elle donne sa largeur. Les chiffres sont juste au-dessus, BLANCS : en remontant, les
// rangées qui portent du clair dans cette largeur ; la première qui n'en porte
// plus est le haut de la zone. ⚠️ Pas le noir : un portrait sombre qui touche
// la pastille la prolonge, à côté des chiffres comme au-dessus. Relevé : la
// pastille va de (30, 30, 27) à (50, 38, 17) ; les chiffres, blancs, ont leur
// plus faible composante au-dessus de 150 au cœur du trait, qu'aucune teinte
// vive d'un portrait n'atteint.
const SOMBRE = 60;
const CLAIR = 150;
const SUITE_PASTILLE = 0.25; // longueur d'une rangée pleine de la pastille, en largeur de carte (relevé : 0,5 à 0,6)
const HAUTEUR_PASTILLE_MAX = 0.3; // en hauteur de carte

export function pastilleVitesse(img: Image, [x, y, l, h]: Rect): Rect | null {
  const { largeur, rgba } = img;
  const x0 = Math.max(0, Math.round(x + 0.3 * l)), x1 = Math.min(largeur - 1, Math.round(x + l) - 1);
  const yHaut = Math.max(0, Math.round(y + 0.55 * h)), yBas = Math.min(img.hauteur - 1, Math.round(y + 0.97 * h));
  const sombre = (xx: number, yy: number) => {
    const i = (yy * largeur + xx) * 4;
    return Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) < SOMBRE;
  };
  const plusLongueSuite = (yy: number): [number, number] => {
    let meilleure: [number, number] = [0, -1], debut = -1;
    for (let xx = x0; xx <= x1 + 1; xx++) {
      if (xx <= x1 && sombre(xx, yy)) { if (debut < 0) debut = xx; continue; }
      if (debut >= 0 && xx - debut > meilleure[1] - meilleure[0] + 1) meilleure = [debut, xx - 1];
      debut = -1;
    }
    return meilleure;
  };
  // La pastille touche le bord droit de la carte : sa suite sombre y va.
  const pleine = (s: [number, number]) => s[1] - s[0] + 1 >= SUITE_PASTILLE * l && s[1] >= x + 0.9 * l;
  let bas = -1, gauche = x1, droite = x0;
  for (let yy = yBas; yy >= yHaut && bas < 0; yy--) {
    const s = plusLongueSuite(yy);
    if (pleine(s)) { bas = yy; [gauche, droite] = s; }
  }
  if (bas < 0) return null;
  // Un clair de chiffre est posé sur la pastille : du sombre à courte distance
  // de chaque côté (moins qu'une largeur de chiffre). Le blanc d'un portrait,
  // au coin arrondi de la pastille, est entouré de portrait.
  const portee = Math.max(3, Math.round(0.1 * l));
  const blanc = (xx: number, yy: number) => {
    const i = (yy * largeur + xx) * 4;
    return Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) >= CLAIR;
  };
  const surSombre = (xx: number, yy: number) => {
    let g = false, d = false;
    for (let k = 1; k <= portee && !g; k++) g = xx - k >= gauche && sombre(xx - k, yy);
    for (let k = 1; k <= portee && !d; k++) d = xx + k <= droite && sombre(xx + k, yy);
    return g && d;
  };
  const premierClair = (yy: number, jusque: number) => {
    for (let xx = gauche; xx <= jusque; xx++) if (blanc(xx, yy) && surSombre(xx, yy)) return xx;
    return -1;
  };
  const clair = (yy: number) => premierClair(yy, droite) >= 0;
  // Sans rangée vide au-dessus des chiffres avant la hauteur limite, la zone
  // s'arrête à cette limite. Aucun clair : pas de VIT dans la carte.
  let haut = -1, chiffres = false;
  for (let yy = bas - 1; yy >= Math.max(yHaut, bas - HAUTEUR_PASTILLE_MAX * h); yy--) {
    haut = yy;
    if (clair(yy)) chiffres = true;
    else if (chiffres) break;
  }
  if (!chiffres) return null;
  // À gauche, la zone part du premier clair (l'icône ou le premier chiffre),
  // avec une marge de fond : un portrait sombre qui prolonge la pastille y
  // mêlerait ses teintes au seuil d'encre.
  let premier = droite;
  for (let yy = haut; yy <= bas; yy++) {
    const p = premierClair(yy, premier - 1);
    if (p >= 0) premier = p;
  }
  const debut = Math.max(gauche, premier - Math.max(2, Math.round(0.3 * (bas - haut))));
  return [debut, haut, droite - debut + 1, bas - haut + 1];
}

export function zoneVitesse(img: Image, carte: Rect): Image | null {
  const p = pastilleVitesse(img, carte);
  return p ? decouper(img, ...p) : null;
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

// Une VIT de combat possible en siège, où l'on règle des vitesses : au-delà,
// ce n'est pas une VIT (une capture d'un autre écran, un nombre mal découpé,
// un chiffre perdu — « 66 » pour 314).
export const VIT_MIN = 100;
export const VIT_MAX = 450;

// Une VIT FAUSSE est pire qu'un refus, qui demande une capture plus grande :
// sous CONFIANCE_VIT_PLANCHER, la VIT n'est pas lue, ni quand un de ses
// chiffres est presque à égalité avec un autre (MARGE_VIT_MIN) sans que la
// lecture agrandie donne le même nombre. Relevé sur onze vraies captures,
// chacune lue avec des gabarits qui n'ont pas ses chiffres, réduites jusqu'à
// des chiffres de 5 pixels, agrandies et compressées : aucune lecture fausse
// ne passe ; les fausses avaient toutes un écart sous 0,04.
export const CONFIANCE_VIT_PLANCHER = 0.7;
const MARGE_VIT_MIN = 0.05;

const plausible = (lu: NombreLu | null): NombreLu | null =>
  (lu && lu.valeur >= VIT_MIN && lu.valeur <= VIT_MAX && lu.confiance >= CONFIANCE_VIT_PLANCHER
    && (lu.marge >= MARGE_VIT_MIN || lu.accord) ? lu : null);

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
