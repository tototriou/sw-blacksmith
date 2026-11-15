// Les six cartes de l'écran de préparation, TROUVÉES dans l'image plutôt que
// placées par des proportions : la mise en page dépend du format de l'écran,
// de la fenêtre PC (barre de titre ou non) et du recadrage de la capture, que
// des proportions figées ne couvrent pas toutes.
//
// Les cartes des attaquants ont un cadre BLEU vif, fin, posé sur le fond brun
// de l'écran ; celles de la défense, emplacements vides compris, un cadre DORÉ.
// Le bord haut d'un cadre est une ligne droite de la largeur de la carte, sans
// cadre au-dessus : on cherche trois de ces lignes, de même longueur, à la même
// hauteur et à pas régulier. La défense est sur la même ligne, au même pas ;
// sans cadre doré trouvé, elle est le symétrique des attaquants par rapport au
// centre de l'image (la mise en page du jeu l'est).

import type { Image } from './image';

export type Rect = [number, number, number, number]; // x, y, côté, côté

type Couleur = (r: number, v: number, b: number) => boolean;

// Seuils relevés sur une capture de la fenêtre PC : cadre bleu (98, 152, 254)
// à (63, 116, 216), doré (215, 168, 72), doré éteint d'un emplacement vide
// (143, 112, 47) ; fond (44, 31, 17).
const bleu: Couleur = (r, v, b) => b >= 150 && b - r >= 60 && b - v >= 35;
const dore: Couleur = (r, v, b) => r >= 110 && r - b >= 60 && v >= 0.6 * r && v <= 0.92 * r;

interface Trait { x0: number; x1: number; y: number; long: number }

// Les traits horizontaux qui ouvrent une zone de la couleur (rien de la
// couleur juste au-dessus) : bords hauts des cadres, et bruit des portraits.
// Deux rangées voisines se cumulent, pour un bord que l'anticrénelage fait
// chevaucher deux rangées ; un trou de deux pixels ne coupe pas un trait.
function traits(img: Image, couleur: Couleur, longMin: number): Trait[] {
  const { largeur: l, hauteur: h, rgba } = img;
  const dans = new Uint8Array(l * h);
  for (let i = 0; i < l * h; i++) dans[i] = couleur(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]) ? 1 : 0;
  const ouvre = (x: number, y: number) => dans[y * l + x] === 1 && (y === 0 || dans[(y - 1) * l + x] === 0);
  const res: Trait[] = [];
  for (let y = 0; y < h - 1; y++) {
    let debut = -1, fin = -1, ici = 0, dessous = 0;
    const clore = () => {
      // Le trait est à la rangée qui porte la plupart de ses pixels.
      if (debut >= 0 && fin - debut + 1 >= longMin) res.push({ x0: debut, x1: fin, y: dessous > ici ? y + 1 : y, long: fin - debut + 1 });
      debut = -1; ici = 0; dessous = 0;
    };
    for (let x = 0; x < l; x++) {
      const a = ouvre(x, y), b = ouvre(x, y + 1);
      if (a || b) {
        if (debut < 0 || x - fin > 3) { clore(); debut = x; }
        fin = x;
        if (a) ici++;
        if (b) dessous++;
      }
    }
    clore();
  }
  // Un même bord vu depuis deux rangées : un seul trait.
  return res.filter((t, i) => !res.slice(0, i).some((u) => Math.abs(u.y - t.y) <= 1 && Math.abs(u.x0 - t.x0) <= 2 && Math.abs(u.x1 - t.x1) <= 2));
}

const proches = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance;

// Le cadre à partir de son bord haut : bords gauche et droit cherchés à
// mi-hauteur (les coins arrondis raccourcissent le bord haut ; le bas de la
// carte porte l'icône du sort de lead et la pastille de VIT). ⚠️ La recherche
// s'arrête à mi-chemin de la carte voisine (`ecart` : entre deux bords hauts),
// sinon elle prend le cadre de la voisine pour le sien.
function cadre(img: Image, couleur: Couleur, t: Trait, ecart: number): Rect {
  const y = Math.min(img.hauteur - 1, Math.round(t.y + t.long / 2));
  const est = (x: number) => x >= 0 && x < img.largeur && couleur(img.rgba[(y * img.largeur + x) * 4], img.rgba[(y * img.largeur + x) * 4 + 1], img.rgba[(y * img.largeur + x) * 4 + 2]);
  const marge = Math.max(1, Math.floor(Math.min(t.long * 0.2, ecart / 2)));
  let gauche = t.x0, droite = t.x1;
  for (let x = t.x0 - marge; x <= t.x0 + 2; x++) if (est(x)) { gauche = x; break; }
  for (let x = t.x1 + marge; x >= t.x1 - 2; x--) if (est(x)) { droite = x; break; }
  return [gauche, t.y, droite - gauche + 1, droite - gauche + 1];
}

export interface CartesTrouvees { attaquants: Rect[]; defense: Rect[] }

export function trouverCartes(img: Image): CartesTrouvees | null {
  const longMin = Math.max(12, Math.round(0.03 * img.largeur));
  const bleus = traits(img, bleu, longMin).slice(0, 400);
  // Trois bords hauts : même longueur, même hauteur, pas régulier un peu plus
  // grand que la carte. Le plus grand trio l'emporte (les vignettes de la
  // liste des monstres, en bas, sont plus petites).
  let meilleur: Trait[] | null = null;
  for (const a of bleus) for (const b of bleus) {
    if (b.x0 <= a.x1 || !proches(b.y, a.y, 2 + 0.02 * a.long) || !proches(b.long, a.long, 2 + 0.1 * a.long)) continue;
    const pas = b.x0 - a.x0;
    if (pas < a.long * 1.0 || pas > a.long * 1.5) continue;
    for (const c of bleus) {
      if (!proches(c.y, a.y, 2 + 0.02 * a.long) || !proches(c.long, a.long, 2 + 0.1 * a.long)) continue;
      if (!proches(c.x0 - b.x0, pas, 2 + 0.05 * a.long)) continue;
      if (!meilleur || a.long > meilleur[0].long) meilleur = [a, b, c];
    }
  }
  if (!meilleur) return null;
  const ecart = meilleur[1].x0 - meilleur[0].x1;
  const attaquants = meilleur.map((t) => cadre(img, bleu, t, ecart));
  // Un même côté et une même hauteur pour les trois : celles de la première.
  const [, y, cote] = attaquants[0];
  const pas = (attaquants[2][0] - attaquants[0][0]) / 2;
  const alignes: Rect[] = attaquants.map((r, k) => [attaquants[0][0] + k * pas, y, cote, cote]);

  // La défense : le premier cadre doré de la même taille, à droite, sur la
  // même ligne ; sinon le symétrique des attaquants. ⚠️ Une capture recadrée
  // sur les seuls attaquants n'a pas de défense : le symétrique tomberait
  // sur eux, ou hors de l'image — aucune carte de défense alors.
  const finAttaque = alignes[2][0] + cote;
  const premierDore = traits(img, dore, longMin)
    .filter((t) => t.x0 > finAttaque && proches(t.y, meilleur![0].y, 2 + 0.03 * cote) && proches(t.long, meilleur![0].long, 2 + 0.15 * cote))
    .sort((p, q) => p.x0 - q.x0)[0];
  const x0Defense = premierDore ? cadre(img, dore, premierDore, ecart)[0] : img.largeur - finAttaque;
  const defense: Rect[] = [0, 1, 2]
    .map((k): Rect => [x0Defense + k * pas, y, cote, cote])
    .filter(([x]) => x >= finAttaque + pas - cote && x + cote <= img.largeur);
  return { attaquants: alignes, defense };
}
