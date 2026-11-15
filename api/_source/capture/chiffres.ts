// Lecture d'un nombre écrit en clair sur un fond sombre (la VIT sous un
// portrait de l'écran de préparation) : seuil, découpage des glyphes par
// colonnes, puis chaque glyphe comparé à des gabarits de chiffres.
//
// Les gabarits (chiffres-gabarits.json) sont construits hors ligne par
// scripts/construire-gabarits-chiffres.ts.

import type { Image } from './image';

export const GL = 12; // largeur d'un glyphe normalisé
export const GH = 18; // hauteur

export interface Masque { largeur: number; hauteur: number; encre: Float32Array } // 0 (fond) à 1 (encre)

// L'encre, c'est le CLAIR : la plus petite des trois composantes (un texte
// blanc l'a haute, un fond coloré même vif l'a basse). Seuil d'Otsu sur
// l'histogramme de la zone, puis transition douce sur ±20 niveaux pour garder
// l'anticrénelage.
export function masqueClair(img: Image): Masque {
  const n = img.largeur * img.hauteur;
  const valeurs = new Uint8Array(n);
  const histo = new Float64Array(256);
  for (let i = 0; i < n; i++) {
    const v = Math.min(img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2]);
    valeurs[i] = v;
    histo[v]++;
  }
  const seuil = otsu(histo, n);
  const encre = new Float32Array(n);
  for (let i = 0; i < n; i++) encre[i] = Math.max(0, Math.min(1, (valeurs[i] - seuil + 20) / 40));
  return { largeur: img.largeur, hauteur: img.hauteur, encre };
}

function otsu(histo: Float64Array, n: number): number {
  let somme = 0;
  for (let i = 0; i < 256; i++) somme += i * histo[i];
  let sb = 0, wb = 0, meilleur = 0, seuil = 128;
  for (let t = 0; t < 256; t++) {
    wb += histo[t];
    if (wb === 0) continue;
    const wf = n - wb;
    if (wf === 0) break;
    sb += t * histo[t];
    const mb = sb / wb, mf = (somme - sb) / wf;
    const entre = wb * wf * (mb - mf) ** 2;
    if (entre > meilleur) { meilleur = entre; seuil = t; }
  }
  return seuil;
}

export interface Glyphe { x: number; y: number; l: number; h: number }

// Les glyphes : colonnes contiguës qui portent de l'encre, puis leurs bornes
// verticales. Un morceau beaucoup plus bas que le plus haut (bruit, contour de
// la pastille) est écarté ; deux chiffres collés (rare à cette taille) ne sont
// pas séparés : le nombre lu sera alors refusé à la validation.
export function glyphes(m: Masque): Glyphe[] {
  const colonne = (x: number) => {
    let s = 0;
    for (let y = 0; y < m.hauteur; y++) s += m.encre[y * m.largeur + x];
    return s;
  };
  const runs: [number, number][] = [];
  let debut = -1;
  for (let x = 0; x <= m.largeur; x++) {
    const plein = x < m.largeur && colonne(x) >= 0.5;
    if (plein && debut < 0) debut = x;
    if (!plein && debut >= 0) { runs.push([debut, x]); debut = -1; }
  }
  const boites = runs.map(([x0, x1]) => {
    let y0 = m.hauteur, y1 = -1;
    for (let y = 0; y < m.hauteur; y++) {
      for (let x = x0; x < x1; x++) {
        if (m.encre[y * m.largeur + x] >= 0.5) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); break; }
      }
    }
    return { x: x0, y: y0, l: x1 - x0, h: y1 - y0 + 1 };
  }).filter((b) => b.h > 0);
  const hMax = Math.max(0, ...boites.map((b) => b.h));
  // Un morceau collé au bord gauche est la fin de l'icône de vitesse, coupée
  // par la zone : jamais un chiffre, qui commence après elle.
  return boites.filter((b) => b.h >= hMax * 0.7 && b.l >= 1 && b.x > 0).flatMap((b) => separer(m, b));
}

// Un chiffre n'est jamais plus large que 0,9 fois sa hauteur. Au-delà, ce sont
// deux chiffres que l'anticrénelage a soudés — sur PC, les chiffres ne font que
// 9 pixels et « 64 » se touche par un pixel adouci. On coupe à la colonne la
// moins encrée du milieu du glyphe, et on recommence sur chaque moitié.
const LARGEUR_CHIFFRE_MAX = 0.9;

function separer(m: Masque, b: Glyphe): Glyphe[] {
  if (b.l <= LARGEUR_CHIFFRE_MAX * b.h || b.l < 4) return [b];
  let coupe = -1, minimum = Infinity;
  for (let x = b.x + Math.ceil(b.l * 0.25); x <= b.x + Math.floor(b.l * 0.75); x++) {
    let s = 0;
    for (let y = b.y; y < b.y + b.h; y++) s += m.encre[y * m.largeur + x];
    if (s < minimum) { minimum = s; coupe = x; }
  }
  if (coupe < 0) return [b];
  const gauche = { ...b, l: coupe - b.x };
  const droite = { ...b, x: coupe + 1, l: b.x + b.l - coupe - 1 };
  return [gauche, droite].filter((g) => g.l >= 1).flatMap((g) => separer(m, g));
}

// Le glyphe ramené à GL × GH, encre moyenne par case, centré dans sa largeur
// en gardant ses proportions (un « 1 » reste étroit : l'étirer le confondrait
// avec un « 7 » ou un « 4 »).
export function normaliser(m: Masque, g: Glyphe): Float32Array {
  const sortie = new Float32Array(GL * GH);
  const echelle = GH / g.h;
  const largeurCible = Math.min(GL, g.l * echelle);
  const decalage = (GL - largeurCible) / 2;
  for (let oy = 0; oy < GH; oy++) {
    for (let ox = 0; ox < GL; ox++) {
      const gx0 = (ox - decalage) / echelle, gx1 = (ox + 1 - decalage) / echelle;
      const gy0 = oy / echelle, gy1 = (oy + 1) / echelle;
      if (gx1 <= 0 || gx0 >= g.l) continue;
      let s = 0, p = 0;
      for (let y = Math.floor(gy0); y < Math.ceil(gy1); y++) {
        const py = Math.min(y + 1, gy1) - Math.max(y, gy0);
        if (py <= 0 || y >= g.h) continue;
        for (let x = Math.floor(Math.max(0, gx0)); x < Math.ceil(Math.min(g.l, gx1)); x++) {
          const px = Math.min(x + 1, gx1) - Math.max(x, gx0);
          if (px <= 0) continue;
          s += m.encre[(g.y + y) * m.largeur + g.x + x] * px * py;
          p += px * py;
        }
      }
      sortie[oy * GL + ox] = p ? s / p : 0;
    }
  }
  return sortie;
}

export interface Gabarits { l: number; h: number; chiffres: Record<string, number[][]> }

function correlation(a: Float32Array, b: number[]): number {
  let ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
  ma /= a.length; mb /= a.length;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    ab += x * y; aa += x * x; bb += y * y;
  }
  return ab / (Math.sqrt(aa * bb) + 1e-9);
}

export interface ChiffreLu { chiffre: string; score: number; ecart: number }

// `vs` : un même glyphe normalisé sous plusieurs découpes ; chaque chiffre
// garde sa meilleure correspondance sur l'ensemble.
export function reconnaitreChiffre(v: Float32Array | Float32Array[], g: Gabarits): ChiffreLu {
  const vs = Array.isArray(v) ? v : [v];
  const scores = Object.entries(g.chiffres).map(([c, modeles]) => [c, Math.max(...vs.flatMap((x) => modeles.map((m) => correlation(x, m))))] as const);
  scores.sort((a, b) => b[1] - a[1]);
  return { chiffre: scores[0][0], score: scores[0][1], ecart: scores[0][1] - (scores[1]?.[1] ?? 0) };
}

// Un glyphe et ses découpes voisines, d'un pixel plus large, plus étroite,
// plus haute ou plus basse de chaque côté : à 8 pixels de haut, un pixel
// d'anticrénelage gardé ou perdu par le seuil change la forme comparée.
function decoupesVoisines(m: Masque, g: Glyphe): Glyphe[] {
  const res: Glyphe[] = [g];
  for (const [dx, dl, dy, dh] of [[-1, 1, 0, 0], [0, 1, 0, 0], [1, -1, 0, 0], [0, -1, 0, 0], [0, 0, -1, 1], [0, 0, 0, 1], [0, 0, 1, -1], [0, 0, 0, -1]]) {
    const v = { x: g.x + dx, l: g.l + dl, y: g.y + dy, h: g.h + dh };
    if (v.x >= 0 && v.y >= 0 && v.l >= 1 && v.h >= 2 && v.x + v.l <= m.largeur && v.y + v.h <= m.hauteur) res.push(v);
  }
  return res;
}

// `confiance` : le plus faible score de ses chiffres ; `marge` : le plus faible
// écart entre le chiffre lu et le suivant, pour un de ses chiffres.
export interface NombreLu { valeur: number; texte: string; confiance: number; marge: number }

// Sous 7 pixels de haut, un chiffre se lit FAUX plutôt que pas du tout (un 9
// pris pour un 3, un 8 pour un 6) : on ne le lit pas, et la commande demande
// une capture plus grande.
export const HAUTEUR_CHIFFRE_MIN = 8;

// Le nombre est le groupe de glyphes le plus à droite : des chiffres serrés.
// L'icône de vitesse, à sa gauche, en est séparée par un écart plus grand
// qu'entre deux chiffres — une zone large peut donc la contenir.
const ECART_DANS_NOMBRE = 0.45;

function nombreADroite(gs: Glyphe[]): Glyphe[] {
  const h = Math.max(...gs.map((x) => x.h));
  let debut = gs.length - 1;
  while (debut > 0 && gs[debut].x - (gs[debut - 1].x + gs[debut - 1].l) <= ECART_DANS_NOMBRE * h) debut--;
  return gs.slice(debut);
}

// Le nombre de la zone, `null` si elle n'en porte pas un lisible.
export function lireNombre(zone: Image, g: Gabarits): NombreLu | null {
  const m = masqueClair(zone);
  const tous = glyphes(m);
  if (tous.length === 0) return null;
  const gs = nombreADroite(tous);
  if (gs.length > 4 || Math.max(...gs.map((x) => x.h)) < HAUTEUR_CHIFFRE_MIN) return null;
  const lus = gs.map((x) => reconnaitreChiffre(decoupesVoisines(m, x).map((v) => normaliser(m, v)), g));
  const texte = lus.map((l) => l.chiffre).join('');
  return { valeur: Number(texte), texte, confiance: Math.min(...lus.map((l) => l.score)), marge: Math.min(...lus.map((l) => l.ecart)) };
}
