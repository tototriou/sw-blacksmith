// Les six cartes de l'écran de préparation, TROUVÉES dans l'image plutôt que
// placées par des proportions : la mise en page dépend du format de l'écran,
// de la fenêtre PC (barre de titre ou non) et du recadrage de la capture, que
// des proportions figées ne couvrent pas toutes.
//
// Une carte a un cadre fin posé sur le fond brun uni de l'écran. Sa COULEUR
// varie avec le contenu et l'origine de l'équipe (bleu vif d'un deck préréglé,
// doré d'un deck composé sur le moment, bronze sombre ailleurs, emplacements
// vides éteints) : ⚠️ on ne la suppose pas. Seul compte le bord du cadre, net
// sur le fond. Le bord haut d'une carte est un trait horizontal de contraste,
// de la largeur de la carte : on cherche trois de ces traits de même longueur,
// à la même hauteur et à pas régulier ; puis les bords gauche, droit et bas de
// chaque carte (une carte n'est pas forcément carrée). La défense est sur la
// même ligne, au même pas ; sans trio trouvé à droite, elle est le symétrique
// des attaquants par rapport au centre de l'image (la mise en page du jeu
// l'est).

import type { Image } from './image';

export type Rect = [number, number, number, number]; // x, y, largeur, hauteur

// Le contraste d'un bord : somme des écarts R, V, B entre deux pixels pris à
// deux pas l'un de l'autre (un bord anticrénelé s'étale sur deux pixels).
// Relevé : le cadre le plus terne vu, bronze (97, 72, 33) sur le fond
// (41, 27, 14), en donne 120 ; l'intérieur d'un fond ou d'un cadre, moins de 50.
const CONTRASTE_BORD = 60;

function ecart(rgba: Uint8Array, i: number, j: number): number {
  return Math.abs(rgba[i] - rgba[j]) + Math.abs(rgba[i + 1] - rgba[j + 1]) + Math.abs(rgba[i + 2] - rgba[j + 2]);
}

interface Trait { x0: number; x1: number; y: number; long: number }

// Les traits horizontaux de contraste (chaque pixel diffère de celui deux
// rangées au-dessus) : bords hauts et bas des cartes, et bruit des portraits.
// Deux rangées voisines se cumulent ; un trou de trois pixels ne coupe pas un
// trait. Un bord haut tombe sur la première rangée du cadre, un bord bas sur
// la première rangée du fond sous lui.
function traits(img: Image, longMin: number): Trait[] {
  const { largeur: l, hauteur: h, rgba } = img;
  const bord = new Uint8Array(l * h);
  for (let y = 1; y < h; y++) {
    const dessus = Math.max(0, y - 2);
    for (let x = 0; x < l; x++) bord[y * l + x] = ecart(rgba, (y * l + x) * 4, (dessus * l + x) * 4) >= CONTRASTE_BORD ? 1 : 0;
  }
  const res: Trait[] = [];
  for (let y = 0; y < h - 1; y++) {
    let debut = -1, fin = -1, ici = 0, dessous = 0;
    const clore = () => {
      // Le trait est à la rangée qui porte la plupart de ses pixels.
      if (debut >= 0 && fin - debut + 1 >= longMin) res.push({ x0: debut, x1: fin, y: dessous > ici ? y + 1 : y, long: fin - debut + 1 });
      debut = -1; ici = 0; dessous = 0;
    };
    for (let x = 0; x < l; x++) {
      const a = bord[y * l + x] === 1, b = bord[(y + 1) * l + x] === 1;
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

// Les bords gauche et droit de la carte, cherchés à mi-hauteur (les coins
// arrondis raccourcissent le bord haut ; le bas de la carte porte l'icône du
// sort de lead et la pastille de VIT) : le premier contraste en venant du fond.
// ⚠️ La recherche part de mi-chemin de la carte voisine (`ecart` : entre deux
// bords hauts), sinon elle prend le bord de la voisine pour le sien. Aucun
// bord à mi-hauteur : ce trait n'est pas le haut d'une carte (null).
function cotes(img: Image, t: Trait, ecart_: number): [number, number] | null {
  const { largeur: l, rgba } = img;
  const y = Math.min(img.hauteur - 1, Math.round(t.y + t.long * 0.4));
  const px = (x: number) => (y * l + Math.min(l - 1, Math.max(0, x))) * 4;
  const marge = Math.max(1, Math.floor(Math.min(t.long * 0.2, ecart_ / 2)));
  let gauche = -1, droite = -1;
  for (let x = Math.max(0, t.x0 - marge); x <= t.x0 + 2; x++) if (ecart(rgba, px(x), px(x - 2)) >= CONTRASTE_BORD) { gauche = x; break; }
  for (let x = Math.min(l - 1, t.x1 + marge); x >= t.x1 - 2; x--) if (ecart(rgba, px(x), px(x + 2)) >= CONTRASTE_BORD) { droite = x; break; }
  return gauche < 0 || droite < 0 ? null : [gauche, droite];
}

// Le bas de la carte : le bord bas, un trait de contraste sous elle, de presque
// toute sa largeur (l'icône du sort de lead peut en masquer un bout), à une
// distance de la moitié à 1,4 fois sa largeur. Le plus bas l'emporte : le bord
// intérieur du cadre est juste au-dessus. ⚠️ Une carte n'est pas forcément
// carrée : selon l'écran, elle est plus large que haute.
function bas(ts: Trait[], [x, y, largeur]: Rect): number | null {
  const sous = ts.filter((t) => t.y >= y + 0.5 * largeur && t.y <= y + 1.4 * largeur && t.long >= 0.4 * largeur
    && t.x0 >= x - 0.1 * largeur && t.x1 <= x + 1.1 * largeur);
  return sous.length ? Math.max(...sous.map((t) => t.y)) : null;
}

export interface CartesTrouvees { attaquants: Rect[]; defense: Rect[] }

// Les trios de traits : même longueur, même hauteur, pas régulier un peu plus
// grand que la carte. ⚠️ Même hauteur à un pixel près (plus un pour cent de
// la longueur, pour une image agrandie) : les bords hauts des trois cartes
// sont sur une même rangée, quand un bord intérieur (le haut d'un portrait)
// est quelques pixels plus bas — un trio qui les mêle aurait un faux pas.
function trios(ts: Trait[]): Trait[][] {
  const res: Trait[][] = [];
  for (const a of ts) for (const b of ts) {
    if (b.x0 <= a.x1 || !proches(b.y, a.y, 1 + 0.01 * a.long) || !proches(b.long, a.long, 2 + 0.1 * a.long)) continue;
    const pas = b.x0 - a.x0;
    if (pas < a.long * 1.0 || pas > a.long * 1.5) continue;
    for (const c of ts) {
      if (!proches(c.y, a.y, 1 + 0.01 * a.long) || !proches(c.long, a.long, 2 + 0.1 * a.long)) continue;
      if (proches(c.x0 - b.x0, pas, 2 + 0.05 * a.long)) res.push([a, b, c]);
    }
  }
  return res;
}

// Un trio de cartes : trois bords hauts, chacun avec ses bords gauche et droit
// à mi-hauteur. Les cartes alignées : même haut, même taille, celle de la
// première ; la hauteur médiane des bords bas trouvés (l'icône du sort de lead
// peut masquer le bas d'une carte ; aucun trouvé, capture coupée sous les
// cartes : carrées).
function cartesDuTrio(img: Image, ts: Trait[], trio: Trait[]): Rect[] | null {
  const ecart_ = trio[1].x0 - trio[0].x1;
  const trouves = trio.map((t) => cotes(img, t, ecart_));
  const lus = trouves.filter((c): c is [number, number] => c !== null);
  if (lus.length < 3) return null;
  const [g0, d0] = lus[0];
  const cote = d0 - g0 + 1;
  const y = trio[0].y;
  const pas = (lus[2][0] - g0) / 2;
  const hauts = lus.map(([g, d]) => bas(ts, [g, y, d - g + 1, 0])).filter((b): b is number => b !== null).sort((a, b) => a - b);
  const hauteur = hauts.length ? hauts[Math.floor((hauts.length - 1) / 2)] - y : cote;
  return [0, 1, 2].map((k): Rect => [g0 + k * pas, y, cote, hauteur]);
}

// Un carré de la taille donnée à cet endroit : un bord gauche et un bord
// droit, à mi-hauteur, là où ils seraient (à quelques pixels près).
function carreA(img: Image, [x, y, cote, hauteur]: Rect): boolean {
  if (x < 0 || x + cote > img.largeur) return false;
  const { largeur: l, rgba } = img;
  const ym = Math.round(y + 0.4 * hauteur);
  const px = (xx: number) => (ym * l + Math.min(l - 1, Math.max(0, Math.round(xx)))) * 4;
  const tol = Math.max(2, Math.round(0.05 * cote));
  const bord = (centre: number, sens: number) => {
    for (let xx = centre - tol; xx <= centre + tol; xx++) if (ecart(rgba, px(xx), px(xx - 2 * sens)) >= CONTRASTE_BORD) return true;
    return false;
  };
  return bord(x, 1) && bord(x + cote - 1, -1);
}

// ⚠️ Une équipe, c'est TROIS carrés : un trio que prolonge un quatrième au
// même pas, d'un côté ou de l'autre, est un morceau de la liste des monstres
// (des vignettes presque de la taille des cartes), pas l'équipe.
function prolonge(img: Image, cartes: Rect[]): boolean {
  const [x0, y, cote, hauteur] = cartes[0];
  const pas = cartes[1][0] - x0;
  return carreA(img, [x0 + 3 * pas, y, cote, hauteur]) || carreA(img, [x0 - pas, y, cote, hauteur]);
}

export function trouverCartes(img: Image): CartesTrouvees | null {
  const longMin = Math.max(12, Math.round(0.03 * img.largeur));
  const ts = traits(img, longMin);
  // Les attaquants : parmi les trios de grands carrés, ceux de la rangée la
  // plus HAUTE — l'équipe est toujours au-dessus de la liste des monstres, dont
  // les vignettes ont presque sa taille (9 sur 10) —, le plus à GAUCHE de
  // cette rangée (la défense, de même taille, est à droite) et, à gauche égale,
  // le plus haut : le bord intérieur du cadre, les étoiles et le bord bas
  // forment aussi des trios, plus bas. La taille est la largeur de la carte à
  // mi-hauteur, pas la longueur du trait : les coins arrondis raccourcissent
  // le bord extérieur, plus que l'intérieur.
  const candidats = trios(ts)
    .map((t) => ({ t, cartes: cartesDuTrio(img, ts, t) }))
    .filter((c): c is { t: Trait[]; cartes: Rect[] } => c.cartes !== null && !prolonge(img, c.cartes));
  if (!candidats.length) return null;
  const plusGrand = Math.max(...candidats.map((c) => c.cartes[0][2]));
  const grands = candidats.filter((c) => c.cartes[0][2] >= 0.75 * plusGrand);
  const haut = Math.min(...grands.map((c) => c.t[0].y));
  const rangee = grands.filter((c) => c.t[0].y <= haut + 0.25 * c.cartes[0][2]);
  const gauche = Math.min(...rangee.map((c) => c.cartes[0][0]));
  const { t: meilleur, cartes: attaquants } = rangee
    .filter((c) => c.cartes[0][0] <= gauche + 0.1 * plusGrand)
    .sort((p, q) => p.t[0].y - q.t[0].y)[0];
  const [, y, cote, hauteur] = attaquants[0];
  const pas = attaquants[1][0] - attaquants[0][0];

  // La défense : le premier trio de même taille, à droite, sur la même ligne ;
  // sinon le symétrique des attaquants. ⚠️ Une capture recadrée sur les seuls
  // attaquants n'a pas de défense : le symétrique tomberait sur eux, ou hors
  // de l'image — aucune carte de défense alors.
  const finAttaque = attaquants[2][0] + cote;
  const aDroite = candidats
    .filter((c) => c.cartes[0][0] >= finAttaque && proches(c.t[0].y, meilleur[0].y, 2 + 0.03 * cote) && proches(c.cartes[0][2], cote, 2 + 0.1 * cote))
    .sort((p, q) => p.cartes[0][0] - q.cartes[0][0] || p.t[0].y - q.t[0].y)[0];
  const x0Defense = aDroite ? aDroite.cartes[0][0] : img.largeur - finAttaque;
  const defense: Rect[] = [0, 1, 2]
    .map((k): Rect => [x0Defense + k * pas, y, cote, hauteur])
    .filter(([x]) => x >= finAttaque + pas - cote && x + cote <= img.largeur);
  return { attaquants, defense };
}
