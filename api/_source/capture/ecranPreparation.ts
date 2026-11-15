// L'écran de préparation d'un combat de siège (ou de son test) : à gauche les
// trois ATTAQUANTS, leader en premier, chacun avec sa VIT DE COMBAT écrite sous
// son portrait (lead et totem compris) ; à droite la défense, sans VIT.
//
// Les cartes se TROUVENT d'abord à leurs cadres (cartes.ts), quel que soit le
// format de l'écran ou le recadrage. Trois mises à l'échelle figées restent
// candidates, au cas où les cadres ne se trouvent pas : à la HAUTEUR (centré
// en largeur, relevé sur un téléphone 2556 × 1179), à la LARGEUR (centré en
// hauteur) et la FENÊTRE du jeu sur PC (Steam, relevée sur une capture de la
// fenêtre en 1417 × 784, barre de titre comprise). La lecture garde la
// disposition dont le premier portrait se reconnaît le mieux.

import { decouper, type Image } from './image';
import { lireNombre, type Gabarits, type NombreLu } from './chiffres';
import { variantes, type Banque, type Reconnaissance } from './portraits';
import { trouverCartes, type Rect } from './cartes';

export interface Disposition {
  nom: 'cadres' | 'hauteur' | 'largeur' | 'fenetre';
  // Le rectangle de la carte k (0, 1, 2 : les attaquants ; 3, 4, 5 : la défense).
  carte: (img: Image, k: number) => [number, number, number, number];
  // La zone de la VIT dans la carte, en fractions de son côté : x, y, largeur,
  // hauteur. Absente : celle du téléphone (ZONE_VIT).
  vitesse?: [number, number, number, number];
  // Le nombre de cartes de défense (3 par défaut) : moins sur une capture
  // recadrée sur les attaquants.
  defense?: number;
}

// La VIT : en bas à droite de la carte, après l'icône de vitesse.
const ZONE_VIT: [number, number, number, number] = [0.6, 0.78, 0.37, 0.18];
// ⚠️ Sur PC, plus basse et plus étroite : les chiffres n'y font que 9 pixels,
// et le bas du portrait, clair, qui entrait dans la zone du téléphone se
// mêlait à l'encre.
const ZONE_VIT_PC: [number, number, number, number] = [0.6, 0.83, 0.37, 0.13];
// Pour des cartes trouvées à leurs cadres, le format ne dit pas où est la VIT :
// les deux zones, et chacune élargie vers la gauche (un nombre qui commence
// plus tôt dans la carte ; l'icône de vitesse qui y entre n'est pas lue, voir
// `lireNombre`).
const ZONES_TROUVEES: [number, number, number, number][] = [ZONE_VIT, ZONE_VIT_PC, [0.45, 0.78, 0.52, 0.18], [0.45, 0.83, 0.52, 0.13]];

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
// La fenêtre PC, en fraction de la HAUTEUR comme la première (bord gauche
// depuis le centre, haut depuis le haut) : mesurées aux cadres des cartes,
// bleus pour les attaquants, dorés pour la défense.
const X_FENETRE = [-0.6473, -0.5057, -0.3629, 0.2328, 0.3756, 0.5185];
const Y_FENETRE = 0.2793;
const COTE_FENETRE = 0.1199;

export const DISPOSITIONS: Record<Exclude<Disposition['nom'], 'cadres'>, Disposition> = {
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
  fenetre: {
    nom: 'fenetre',
    vitesse: ZONE_VIT_PC,
    carte: (img, k) => {
      const h = img.hauteur;
      return [img.largeur / 2 + X_FENETRE[k] * h, Y_FENETRE * h, COTE_FENETRE * h, COTE_FENETRE * h];
    },
  },
};

export function zoneVitesse(img: Image, d: Disposition, k: number): Image | null {
  const [x, y, c] = d.carte(img, k);
  const [zx, zy, zl, zh] = d.vitesse ?? ZONE_VIT;
  return decouper(img, x + zx * c, y + zy * c, zl * c, zh * c);
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

// La disposition des cartes trouvées à leurs cadres. Sa zone de VIT n'est pas
// fixée : le format de l'écran ne dit pas si c'est un téléphone ou un PC.
function dispositionTrouvee(img: Image): Disposition | null {
  const cartes = trouverCartes(img);
  if (!cartes) return null;
  const rects: Rect[] = [...cartes.attaquants, ...cartes.defense];
  return { nom: 'cadres', carte: (_, k) => rects[k], defense: cartes.defense.length };
}

// Toutes les lectures possibles d'une capture, chacune avec une zone de VIT
// fixée : les cartes trouvées (dans les deux zones), puis les dispositions
// figées. Pour le relevé des gabarits de chiffres sur une vraie capture.
export function dispositionsPossibles(img: Image): Disposition[] {
  const trouvee = dispositionTrouvee(img);
  return [...(trouvee ? ZONES_TROUVEES.map((vitesse) => ({ ...trouvee, vitesse })) : []), ...Object.values(DISPOSITIONS)];
}

// L'avance de score donnée aux cartes trouvées sur les mises en page figées,
// et le score de leur premier portrait au-delà duquel on ne les compare pas
// (un portrait juste : 0,8 à 0,93).
const AVANTAGE_CADRES = 0.1;
const SCORE_CADRES_SUFFISANT = 0.6;

// Sous cette confiance, le nombre n'est pas une VIT : un bout de portrait ou de
// pastille découpé en « chiffres » (relevé : 0,14 à 0,20 pour ces faux nombres,
// 0,49 et plus pour une VIT juste).
export const CONFIANCE_VIT_PLANCHER = 0.35;

const plausible = (lu: NombreLu | null): NombreLu | null =>
  (lu && lu.valeur >= VIT_MIN && lu.valeur <= VIT_MAX && lu.confiance >= CONFIANCE_VIT_PLANCHER ? lu : null);

export function lireEcranPreparation(img: Image, banque: Banque, gabarits: Gabarits): LectureEcran {
  // Le premier attaquant départage les dispositions : une reconnaissance de
  // plus par disposition essayée. Les cartes trouvées à leurs cadres sont
  // MESURÉES : elles l'emportent, sauf si une mise en page figée reconnaît
  // nettement mieux le premier portrait (des cadres pris ailleurs).
  // Un premier portrait nettement reconnu dans les cartes trouvées suffit : les
  // mises en page figées ne sont pas essayées (trois reconnaissances de moins).
  const essayer = (d: Disposition) => ({ d, r: banque.reconnaitre(variantes(img, d.carte(img, 0))) });
  const trouvee = dispositionTrouvee(img);
  const essaiTrouve = trouvee ? essayer(trouvee) : null;
  const essais = essaiTrouve && (essaiTrouve.r?.meilleur.score ?? 0) >= SCORE_CADRES_SUFFISANT
    ? [essaiTrouve]
    : [...(essaiTrouve ? [essaiTrouve] : []), ...Object.values(DISPOSITIONS).map(essayer)];
  const score = (e: (typeof essais)[number]) => (e.r?.meilleur.score ?? -1) + (e.d.nom === 'cadres' ? AVANTAGE_CADRES : 0);
  essais.sort((a, b) => score(b) - score(a));
  const { d, r: premier } = essais[0];
  const monstre = (k: number): MonstreLu => {
    const rect = d.carte(img, k);
    return { rect, portrait: k === 0 ? premier : banque.reconnaitre(variantes(img, rect)) };
  };
  // Les VIT, dans chaque zone possible pour la disposition : on garde celle
  // qui en lit le plus de plausibles, puis la plus sûre.
  const zones = d.vitesse ? [d.vitesse] : d.nom === 'cadres' ? ZONES_TROUVEES : [ZONE_VIT];
  const lectures = zones.map((z) => [0, 1, 2].map((k) => {
    const zone = zoneVitesse(img, { ...d, vitesse: z }, k);
    return plausible(zone ? lireNombre(zone, gabarits) : null);
  }));
  const valeur = (l: (NombreLu | null)[]) => l.filter(Boolean).length * 10 + l.reduce((s, x) => s + (x?.confiance ?? 0), 0);
  const vitesses = lectures.reduce((a, b) => (valeur(b) > valeur(a) ? b : a));
  const attaquants = [0, 1, 2].map((k): AttaquantLu => ({ ...monstre(k), vitesse: vitesses[k] }));
  return { disposition: d.nom, attaquants, defense: [3, 4, 5].slice(0, d.defense ?? 3).map(monstre) };
}
