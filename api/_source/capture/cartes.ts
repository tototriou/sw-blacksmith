// Les cartes de l'écran de préparation, TROUVÉES dans l'image plutôt que
// placées par des proportions ou choisies par leur position : la mise en page
// dépend du format de l'écran, de la fenêtre PC (barre de titre ou non) et du
// recadrage de la capture, que rien de figé ne couvre.
//
// 1. Tous les CADRES de l'image, de toute taille. Un cadre est un contour fin
//    posé sur un fond uni : sa COULEUR varie (bleu vif d'un deck préréglé,
//    doré d'un deck composé sur le moment, bronze sombre, gris éteint) — ⚠️ on
//    ne la suppose pas, seul compte le contraste de son bord. Son bord haut
//    est un trait horizontal de contraste ; ses bords gauche et droit se
//    cherchent à mi-hauteur, au bout de ce trait ; son bord bas, en suivant
//    ces bords vers le bas jusqu'à ce qu'ils s'arrêtent.
// 2. Les ATTAQUANTS sont les cadres qui portent une pastille de VIT
//    (pastille.ts) : sur cet écran, seuls les attaquants affichent leur VIT.
//    La défense et la liste des monstres, aux vignettes presque de même
//    taille, n'en ont pas. Il en faut TROIS, de même taille, sur une même
//    ligne.
// 3. La DÉFENSE : les cadres de même taille à leur droite, sur la même ligne ;
//    sans eux, le symétrique des attaquants par rapport au centre de l'image
//    (la mise en page du jeu l'est).

import type { Image } from './image';
import { pastilleVitesse, porteUneVit } from './pastille';

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

// Les pixels de bord horizontal : chacun diffère de celui deux rangées
// au-dessus.
function bordsHorizontaux(img: Image): Uint8Array {
  const { largeur: l, hauteur: h, rgba } = img;
  const bord = new Uint8Array(l * h);
  for (let y = 1; y < h; y++) {
    const dessus = Math.max(0, y - 2);
    for (let x = 0; x < l; x++) bord[y * l + x] = ecart(rgba, (y * l + x) * 4, (dessus * l + x) * 4) >= CONTRASTE_BORD ? 1 : 0;
  }
  return bord;
}

// Les traits horizontaux de contraste : bords hauts et bas des cartes, et
// bruit des portraits. Deux rangées voisines se cumulent ; un trou de trois
// pixels ne coupe pas un trait. Un bord haut tombe sur la première rangée du
// cadre.
function traits(img: Image, bord: Uint8Array, longMin: number): Trait[] {
  const { largeur: l, hauteur: h } = img;
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
const memeRangee = (a: Trait, b: Trait) => proches(a.y, b.y, 1 + 0.01 * a.long);

// Les bords gauche et droit du cadre, cherchés à mi-hauteur (les coins arrondis
// raccourcissent le bord haut ; le bas de la carte porte l'icône du sort de
// lead et la pastille de VIT) : le premier contraste en venant du fond.
// ⚠️ Près du bout du trait : les coins arrondis ne le raccourcissent que d'un
// ou deux pour cent ; plus loin, la recherche prend pour le bord de la carte
// ce qui est posé à côté (une carte collée, un bout d'interface). Et pas plus
// loin que la moitié de l'espace qui sépare ce trait du trait voisin sur la
// même rangée (la carte voisine). Aucun bord à mi-hauteur : ce trait n'est
// pas le haut d'un cadre (null).
const MARGE_COTE = 0.03; // en longueur du trait (relevé : un pixel sur 83, de chaque côté)
function cotes(img: Image, t: Trait, rangee: Trait[]): [number, number] | null {
  const { largeur: l, rgba } = img;
  const y = Math.min(img.hauteur - 1, Math.round(t.y + t.long * 0.4));
  const px = (x: number) => (y * l + Math.min(l - 1, Math.max(0, x))) * 4;
  const espaceG = Math.min(Infinity, ...rangee.filter((u) => u.x1 < t.x0).map((u) => t.x0 - u.x1));
  const espaceD = Math.min(Infinity, ...rangee.filter((u) => u.x0 > t.x1).map((u) => u.x0 - t.x1));
  const marge = (espace: number) => Math.max(1, Math.floor(Math.min(Math.max(2, t.long * MARGE_COTE), espace / 2)));
  let gauche = -1, droite = -1;
  for (let x = Math.max(0, t.x0 - marge(espaceG)); x <= t.x0 + 2; x++) if (ecart(rgba, px(x), px(x - 2)) >= CONTRASTE_BORD) { gauche = x; break; }
  for (let x = Math.min(l - 1, t.x1 + marge(espaceD)); x >= t.x1 - 2; x--) if (ecart(rgba, px(x), px(x + 2)) >= CONTRASTE_BORD) { droite = x; break; }
  return gauche < 0 || droite < 0 ? null : [gauche, droite];
}

// Le bas du cadre : là où s'arrêtent ses bords gauche et droit, suivis depuis
// mi-hauteur, rangée par rangée, à deux pixels près (le coin arrondi les
// rentre peu à peu). Un trou de quelques rangées ne les arrête pas (l'icône
// du sort de lead, à cheval sur le bord gauche). Le plus long des deux
// l'emporte. Plus bas que 1,4 fois la largeur : ce n'est plus le cadre.
function basDuCadre(img: Image, gauche: number, droite: number, yMilieu: number, cote: number): number {
  const { largeur: l, hauteur: h, rgba } = img;
  const yMax = Math.min(h - 1, Math.round(yMilieu + 1.4 * cote));
  const trouMax = Math.max(2, Math.round(0.05 * cote));
  const suivre = (depart: number, sens: 1 | -1) => {
    let x = depart, dernier = yMilieu, trou = 0;
    for (let y = yMilieu + 1; y <= yMax; y++) {
      let trouve = -1;
      for (const dx of [0, sens, -sens, 2 * sens, -2 * sens]) {
        const xx = x + dx, voisin = xx - 2 * sens;
        if (xx < 0 || xx >= l || voisin < 0 || voisin >= l) continue;
        if (ecart(rgba, (y * l + xx) * 4, (y * l + voisin) * 4) >= CONTRASTE_BORD) { trouve = xx; break; }
      }
      if (trouve >= 0) { x = trouve; dernier = y; trou = 0; } else if (++trou > trouMax) break;
    }
    return dernier;
  };
  return Math.max(suivre(gauche, 1), suivre(droite, -1));
}

// La part de la largeur [g, d] où la rangée y (à un pixel près) est un bord.
function couverture(img: Image, bord: Uint8Array, g: number, d: number, y: number): number {
  const l = img.largeur;
  let n = 0;
  for (let x = g; x <= d; x++) {
    for (let yy = Math.max(0, y - 1); yy <= Math.min(img.hauteur - 1, y + 1); yy++) if (bord[yy * l + x]) { n++; break; }
  }
  return n / (d - g + 1);
}

// Tous les cadres de l'image : chaque trait assez long dont les deux bouts
// tombent sur un bord gauche et un bord droit, avec un bas. Un cadre est à peu
// près carré (selon l'écran, un peu plus large que haut) : sinon, ce n'en est
// pas un. ⚠️ Son bord haut le couvre d'un côté à l'autre, à ses coins
// arrondis près (BOUT_MAX) : un trait intérieur dont la recherche des côtés a
// franchi l'espace entre deux cartes (et pris le bord de la voisine) s'arrête
// loin de ce côté, avec du fond au-dessus de l'espace. Le bord intérieur d'un
// cadre, juste dedans, en donne un second, plus petit : on le garde, le choix
// se fait plus loin.
const COUVERTURE_MIN = 0.85;
const BOUT_MAX = 0.1; // en largeur de cadre
function cadres(img: Image, bord: Uint8Array, ts: Trait[]): Rect[] {
  const res: Rect[] = [];
  for (const t of ts) {
    const c = cotes(img, t, ts.filter((u) => u !== t && memeRangee(t, u)));
    if (!c) continue;
    const [g, d] = c;
    const cote = d - g + 1;
    if (t.x0 - g > BOUT_MAX * cote || d - t.x1 > BOUT_MAX * cote) continue;
    if (couverture(img, bord, g, d, t.y) < COUVERTURE_MIN) continue;
    const yMilieu = Math.min(img.hauteur - 1, Math.round(t.y + cote * 0.4));
    const hauteur = basDuCadre(img, g, d, yMilieu, cote) + 1 - t.y;
    if (hauteur < 0.6 * cote || hauteur > 1.3 * cote) continue;
    res.push([g, t.y, cote, hauteur]);
  }
  return res;
}

// Les cadres d'une RANGÉE : trois traits de même longueur, à la même hauteur et
// à pas régulier, un peu plus grand que la carte. Une seconde source de
// cadres, pour ceux dont le contour seul ne suffit pas : un liseré peu
// contrasté sur le fond, que l'agrandissement d'une capture rend flou, ne
// donne pas de côté net au bout de son trait, mais trois traits égaux au même
// pas restent un indice sûr. Les côtés se cherchent alors jusqu'à la moitié de
// l'espace entre deux cartes ; la hauteur, au bord bas médian des trois.
// ⚠️ Même hauteur à un pixel près (plus un pour cent de la longueur, pour une
// image agrandie) : les bords hauts des trois cartes sont sur une même rangée,
// quand un bord intérieur (le haut d'un portrait) est quelques pixels plus
// bas — une rangée qui les mêle aurait un faux pas.
function rangees(ts: Trait[]): Trait[][] {
  const res: Trait[][] = [];
  for (const a of ts) for (const b of ts) {
    if (b.x0 <= a.x1 || !memeRangee(a, b) || !proches(b.long, a.long, 2 + 0.1 * a.long)) continue;
    const pas = b.x0 - a.x0;
    if (pas < a.long * 1.0 || pas > a.long * 1.5) continue;
    for (const c of ts) {
      if (!memeRangee(a, c) || !proches(c.long, a.long, 2 + 0.1 * a.long)) continue;
      if (proches(c.x0 - b.x0, pas, 2 + 0.05 * a.long)) res.push([a, b, c]);
    }
  }
  return res;
}
function cotesEspaces(img: Image, t: Trait, espace: number): [number, number] | null {
  const { largeur: l, rgba } = img;
  const y = Math.min(img.hauteur - 1, Math.round(t.y + t.long * 0.4));
  const px = (x: number) => (y * l + Math.min(l - 1, Math.max(0, x))) * 4;
  const marge = Math.max(1, Math.floor(Math.min(t.long * 0.2, espace / 2)));
  let gauche = -1, droite = -1;
  for (let x = Math.max(0, t.x0 - marge); x <= t.x0 + 2; x++) if (ecart(rgba, px(x), px(x - 2)) >= CONTRASTE_BORD) { gauche = x; break; }
  for (let x = Math.min(l - 1, t.x1 + marge); x >= t.x1 - 2; x--) if (ecart(rgba, px(x), px(x + 2)) >= CONTRASTE_BORD) { droite = x; break; }
  return gauche < 0 || droite < 0 ? null : [gauche, droite];
}
function basSous(ts: Trait[], x: number, y: number, largeur: number): number | null {
  const sous = ts.filter((t) => t.y >= y + 0.5 * largeur && t.y <= y + 1.4 * largeur && t.long >= 0.4 * largeur
    && t.x0 >= x - 0.1 * largeur && t.x1 <= x + 1.1 * largeur);
  return sous.length ? Math.max(...sous.map((t) => t.y)) : null;
}
function cadresDeRangee(img: Image, ts: Trait[], rangee: Trait[]): Rect[] {
  const espace = rangee[1].x0 - rangee[0].x1;
  const lus = rangee.map((t) => cotesEspaces(img, t, espace));
  if (lus.some((c) => c === null)) return [];
  const [g0, d0] = lus[0]!;
  const cote = d0 - g0 + 1;
  const y = rangee[0].y;
  const pas = (lus[2]![0] - g0) / 2;
  const bas = lus.map((c) => basSous(ts, c![0], y, c![1] - c![0] + 1)).filter((b): b is number => b !== null).sort((a, b) => a - b);
  const hauteur = bas.length ? bas[Math.floor((bas.length - 1) / 2)] - y : cote;
  if (hauteur < 0.6 * cote || hauteur > 1.3 * cote) return [];
  return [0, 1, 2].map((k): Rect => [Math.round(g0 + k * pas), y, cote, hauteur]);
}

// Deux cadres qui se recouvrent en grande partie sont le même (le bord
// extérieur et le bord intérieur d'une carte, ou un même bord vu deux fois) :
// le plus grand reste, c'est le contour de la carte.
function recouvrement([ax, ay, al, ah]: Rect, [bx, by, bl, bh]: Rect): number {
  const l = Math.min(ax + al, bx + bl) - Math.max(ax, bx), h = Math.min(ay + ah, by + bh) - Math.max(ay, by);
  return l > 0 && h > 0 ? (l * h) / Math.min(al * ah, bl * bh) : 0;
}
function contours(rects: Rect[]): Rect[] {
  const tries = [...rects].sort((a, b) => b[2] * b[3] - a[2] * a[3]);
  const res: Rect[] = [];
  for (const r of tries) if (!res.some((s) => recouvrement(r, s) > 0.5)) res.push(r);
  return res;
}

const memeLigne = (a: Rect, b: Rect) => proches(a[1], b[1], 2 + 0.1 * a[2]) && proches(a[2], b[2], 2 + 0.1 * a[2]) && proches(a[3], b[3], 2 + 0.15 * a[3]);

export interface CartesTrouvees { attaquants: Rect[]; defense: Rect[] }

const LONGUEUR_CARTE_MIN = 12;

export function trouverCartes(img: Image): CartesTrouvees | null {
  // ⚠️ Un seuil en pixels, pas en part de l'image : une capture de tout
  // l'écran, où la fenêtre du jeu n'occupe qu'un coin, a des cartes petites
  // devant l'image. Sous 12 pixels, une VIT ne se lit plus de toute façon.
  const longMin = LONGUEUR_CARTE_MIN;
  const bord = bordsHorizontaux(img);
  const ts = traits(img, bord, longMin);
  const tous = [...cadres(img, bord, ts), ...rangees(ts).flatMap((r) => cadresDeRangee(img, ts, r))];
  // Les attaquants : les cadres qui portent une pastille de VIT. ⚠️ Pas
  // seulement le plus grand de ceux qui se recouvrent : le bord intérieur
  // d'une carte porte sa pastille aussi, mais un rectangle plus grand qui la
  // contient également (le bord d'une capture posée dans une autre image).
  // C'est le trio qui tranche.
  const uniques = [...new Map(tous.map((r) => [r.join(','), r])).values()];
  const avecPastille = uniques.filter((r) => pastilleVitesse(img, r) !== null);
  const nombre = new Set(avecPastille.filter((r) => porteUneVit(img, r)));
  // Trois cartes de même taille, sur une même ligne, CÔTE À CÔTE, à pas
  // régulier, et au moins deux où la pastille porte un nombre net : une
  // fausse pastille (un coin de portrait sombre au reflet clair, sous la
  // compression JPEG) reste isolée ; un nombre mal découpé (l'icône du sort
  // de lead qui le touche) ne fait pas perdre sa carte à l'équipe. Plusieurs
  // trios possibles (le contour et le bord intérieur des mêmes cartes, à un
  // ou deux pixels près) : celui dont les trois nombres sont nets, puis les
  // plus grandes cartes, puis la plus haute.
  const trios: Rect[][] = [];
  for (const a of avecPastille) for (const b of avecPastille) {
    const pas = b[0] - a[0];
    if (!memeLigne(a, b) || pas < 0.9 * a[2] || pas > 1.6 * a[2]) continue;
    for (const c of avecPastille) {
      if (!memeLigne(a, c) || !proches(c[0] - b[0], pas, 2 + 0.1 * a[2])) continue;
      if ([a, b, c].filter((r) => nombre.has(r)).length >= 2) trios.push([a, b, c]);
    }
  }
  const nets = (t: Rect[]) => t.filter((r) => nombre.has(r)).length;
  trios.sort((p, q) => nets(q) - nets(p) || q[0][2] - p[0][2] || p[0][1] - q[0][1]);
  if (!trios.length) return null;
  const trio = trios[0];
  // Une même taille pour les trois (la médiane), chacune à sa place.
  const mediane = (v: number[]) => [...v].sort((a, b) => a - b)[1];
  const y = mediane(trio.map((r) => r[1])), cote = mediane(trio.map((r) => r[2])), hauteur = mediane(trio.map((r) => r[3]));
  const attaquants = trio.map(([x]): Rect => [x, y, cote, hauteur]);
  const pas = (attaquants[2][0] - attaquants[0][0]) / 2;

  // La défense : les cadres de même taille, à droite, sur la même ligne, sans
  // VIT ; sinon le symétrique des attaquants. ⚠️ Une capture recadrée sur les
  // seuls attaquants n'a pas de défense : le symétrique tomberait sur eux, ou
  // hors de l'image — aucune carte de défense alors.
  const finAttaque = attaquants[2][0] + cote;
  const aDroite = contours(tous)
    .filter((r) => r[0] >= finAttaque && memeLigne(attaquants[0], r))
    .sort((p, q) => p[0] - q[0]);
  if (aDroite.length >= 3) return { attaquants, defense: aDroite.slice(0, 3).map(([x]): Rect => [x, y, cote, hauteur]) };
  const x0Defense = aDroite.length ? aDroite[0][0] : img.largeur - finAttaque;
  const defense: Rect[] = [0, 1, 2]
    .map((k): Rect => [x0Defense + k * pas, y, cote, hauteur])
    .filter(([x]) => x >= finAttaque + pas - cote && x + cote <= img.largeur);
  return { attaquants, defense };
}
