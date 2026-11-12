// L'écran de préparation d'un combat de siège (ou de son test) : à gauche les
// trois ATTAQUANTS, leader en premier, chacun avec sa VIT DE COMBAT écrite sous
// son portrait (lead et totem compris) ; à droite la défense, sans VIT.
//
// L'interface du jeu est fixe : les cartes se placent par des proportions de
// l'écran. Deux mises à l'échelle possibles, faute de captures de toutes les
// tailles d'écran : à la HAUTEUR (centré en largeur, relevé sur un téléphone
// 2556 × 1179) et à la LARGEUR (centré en hauteur, pour un écran moins
// allongé). La lecture garde celle dont les portraits se reconnaissent le
// mieux.

import { decouper, type Image } from './image';
import { lireNombre, type Gabarits, type NombreLu } from './chiffres';
import { variantes, type Banque, type Reconnaissance } from './portraits';

export interface Disposition {
  nom: 'hauteur' | 'largeur';
  // Le rectangle de la carte k (0, 1, 2 : les attaquants ; 3, 4, 5 : la défense).
  carte: (img: Image, k: number) => [number, number, number, number];
}

// Bord gauche de chaque carte, en fraction de la HAUTEUR, depuis le centre de
// l'écran ; haut et côté de toutes les cartes.
const X_HAUTEUR = [-0.7371, -0.5564, -0.3749, 0.218, 0.3986, 0.5801];
const Y_HAUTEUR = 0.2578;
const COTE_HAUTEUR = 0.1535;
// Les mêmes, en fraction de la LARGEUR (bord gauche depuis la gauche, haut
// depuis le centre vertical).
const X_LARGEUR = [0.16, 0.2434, 0.3271, 0.6006, 0.6839, 0.7676];
const Y_LARGEUR = -0.1117;
const COTE_LARGEUR = 0.0708;

export const DISPOSITIONS: Record<Disposition['nom'], Disposition> = {
  hauteur: {
    nom: 'hauteur',
    carte: (img, k) => {
      const h = img.hauteur;
      return [img.largeur / 2 + X_HAUTEUR[k] * h, Y_HAUTEUR * h, COTE_HAUTEUR * h, COTE_HAUTEUR * h];
    },
  },
  largeur: {
    nom: 'largeur',
    carte: (img, k) => {
      const l = img.largeur;
      return [X_LARGEUR[k] * l, img.hauteur / 2 + Y_LARGEUR * l, COTE_LARGEUR * l, COTE_LARGEUR * l];
    },
  },
};

// La VIT : en bas à droite de la carte, après l'icône de vitesse.
export function zoneVitesse(img: Image, d: Disposition, k: number): Image | null {
  const [x, y, c] = d.carte(img, k);
  return decouper(img, x + 0.6 * c, y + 0.78 * c, 0.37 * c, 0.18 * c);
}

export interface MonstreLu {
  rect: [number, number, number, number];
  portrait: Reconnaissance | null;
}
export interface AttaquantLu extends MonstreLu {
  vitesse: NombreLu | null;
}
export interface LectureEcran {
  disposition: Disposition['nom'];
  attaquants: AttaquantLu[];
  defense: MonstreLu[];
}

// Une VIT de combat possible : au-delà, ce n'est pas une VIT (une capture d'un
// autre écran, un nombre mal découpé).
export const VIT_MIN = 50;
export const VIT_MAX = 450;

export function lireEcranPreparation(img: Image, banque: Banque, gabarits: Gabarits): LectureEcran {
  // Le premier attaquant départage les deux mises à l'échelle : une seule
  // reconnaissance de plus.
  const essais = Object.values(DISPOSITIONS).map((d) => ({ d, r: banque.reconnaitre(variantes(img, d.carte(img, 0))) }));
  essais.sort((a, b) => (b.r?.meilleur.score ?? -1) - (a.r?.meilleur.score ?? -1));
  const { d, r: premier } = essais[0];
  const monstre = (k: number): MonstreLu => {
    const rect = d.carte(img, k);
    return { rect, portrait: k === 0 ? premier : banque.reconnaitre(variantes(img, rect)) };
  };
  const attaquants = [0, 1, 2].map((k): AttaquantLu => {
    const zone = zoneVitesse(img, d, k);
    const lu = zone ? lireNombre(zone, gabarits) : null;
    const vitesse = lu && lu.valeur >= VIT_MIN && lu.valeur <= VIT_MAX ? lu : null;
    return { ...monstre(k), vitesse };
  });
  return { disposition: d.nom, attaquants, defense: [3, 4, 5].map(monstre) };
}
