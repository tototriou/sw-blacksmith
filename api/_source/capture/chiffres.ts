// Lecture d'un nombre écrit en clair sur un fond sombre (la VIT sous un
// portrait de l'écran de préparation) : seuil, découpage des glyphes par
// colonnes, puis chaque glyphe comparé à des gabarits de chiffres rendus à sa
// taille (voir « Lecture à la taille d'origine »).
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

// Les boîtes des rangées [ya, yb) : colonnes contiguës qui y portent de
// l'encre, puis leurs bornes verticales — la plus longue bande de rangées
// encrées (un trou d'une rangée, que le seuil peut creuser dans un trait fin,
// ne la coupe pas).
function boites(m: Masque, ya: number, yb: number): Glyphe[] {
  const colonne = (x: number) => {
    let s = 0;
    for (let y = ya; y < yb; y++) s += m.encre[y * m.largeur + x];
    return s;
  };
  const runs: [number, number][] = [];
  let debut = -1;
  for (let x = 0; x <= m.largeur; x++) {
    const plein = x < m.largeur && colonne(x) >= 0.5;
    if (plein && debut < 0) debut = x;
    if (!plein && debut >= 0) { runs.push([debut, x]); debut = -1; }
  }
  return runs.map(([x0, x1]) => {
    const encree = (y: number) => {
      for (let x = x0; x < x1; x++) if (m.encre[y * m.largeur + x] >= 0.5) return true;
      return false;
    };
    let y0 = 0, y1 = -1, debutY = -1, fin = -1;
    for (let y = ya; y < yb; y++) {
      if (!encree(y)) continue;
      if (debutY < 0 || y - fin > 2) debutY = y;
      fin = y;
      if (fin - debutY > y1 - y0) { y0 = debutY; y1 = fin; }
    }
    return { x: x0, y: y0, l: x1 - x0, h: y1 - y0 + 1 };
  }).filter((b) => b.h > 0);
}

// La hauteur d'un chiffre : celle de la boîte notable la plus à DROITE, le
// dernier chiffre (la pastille se termine sur le nombre). Pas celle de la plus
// haute : l'icône de vitesse, à gauche, l'est souvent, grandie d'un bout de
// portrait au-dessus d'elle.
function dernierChiffre(bs: Glyphe[]): Glyphe | undefined {
  const hMax = Math.max(0, ...bs.map((b) => b.h));
  return [...bs].reverse().find((b) => b.h >= 0.5 * hMax);
}

// Les glyphes du nombre. Les colonnes se comptent dans la seule BANDE des
// chiffres (celle du dernier) : un bout du portrait au-dessus de la pastille
// relierait sinon les colonnes de deux chiffres, ou d'un chiffre et du vide.
// Les glyphes d'une autre hauteur ne sont pas des chiffres. Un morceau collé
// au bord gauche est la fin de l'icône, coupée par la zone : jamais un
// chiffre, qui commence après elle.
export function glyphes(m: Masque): Glyphe[] {
  const repere = dernierChiffre(boites(m, 0, m.hauteur));
  if (!repere) return [];
  const marge = Math.ceil(0.15 * repere.h);
  const bs = boites(m, Math.max(0, repere.y - marge), Math.min(m.hauteur, repere.y + repere.h + marge));
  const dernier = dernierChiffre(bs);
  if (!dernier) return [];
  return bs.filter((b) => b.h >= dernier.h * 0.7 && b.h <= dernier.h * 1.3 && b.l >= 1 && b.x > 0).flatMap((b) => separer(m, b));
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

// ---- Lecture à la taille d'origine ------------------------------------------
//
// ⚠️ Un chiffre de 7 pixels AGRANDI à 12 × 18 n'a plus sa forme : l'agrandir
// invente du flou, et un 9 y ressemble à un 3. On fait l'inverse : chaque
// gabarit est RÉDUIT à la taille exacte du glyphe lu, par moyenne de surface
// (l'anticrénelage du jeu), sous de petits décalages d'une fraction de pixel
// (la place du chiffre dans la grille de pixels change sa forme rendue), et
// comparé à la luminosité brute de la capture, sans seuil. La même méthode
// vaut à toutes les tailles.

// La luminosité de la zone ramenée de 0 (fond de la pastille) à 1 (blanc des
// chiffres) : la plus petite composante, entre le 30e centile (le fond, qui
// occupe la plus grande part) et le 99e (le cœur des traits).
function luminosite(zone: Image): Float32Array {
  const n = zone.largeur * zone.hauteur;
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.min(zone.rgba[i * 4], zone.rgba[i * 4 + 1], zone.rgba[i * 4 + 2]);
  const tri = Float32Array.from(v).sort();
  const bas = tri[Math.floor(n * 0.3)], haut = tri[Math.min(n - 1, Math.floor(n * 0.99))];
  for (let i = 0; i < n; i++) v[i] = Math.max(0, Math.min(1, (v[i] - bas) / Math.max(1, haut - bas)));
  return v;
}

// La moyenne d'un gabarit (constant par case) sur le rectangle [u0, u1] × [v0, v1]
// de ses coordonnées : la valeur d'un pixel qui le recouvre.
function moyenneGabarit(m: number[], gl: number, gh: number, u0: number, u1: number, v0: number, v1: number): number {
  let s = 0;
  for (let y = Math.max(0, Math.floor(v0)); y < Math.min(gh, Math.ceil(v1)); y++) {
    const py = Math.min(y + 1, v1) - Math.max(y, v0);
    if (py <= 0) continue;
    for (let x = Math.max(0, Math.floor(u0)); x < Math.min(gl, Math.ceil(u1)); x++) {
      const px = Math.min(x + 1, u1) - Math.max(x, u0);
      if (px > 0) s += m[y * gl + x] * px * py;
    }
  }
  return s / ((u1 - u0) * (v1 - v0));
}

function correlationTableaux(a: Float32Array, b: Float32Array): number {
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

// Les décalages essayés, en pixels : hauteur rendue, haut et centre du glyphe.
// La boîte du glyphe vient d'un seuil : ses bords sont justes à un
// demi-pixel près.
const DECALAGES_H = [-0.5, 0, 0.5];
const DECALAGES_Y = [-0.5, -0.25, 0, 0.25];
const DECALAGES_X = [-0.5, -0.25, 0, 0.25, 0.5];

// Le chiffre du glyphe `b`, comparé sur sa boîte élargie d'un pixel. Un
// gabarit normalisé a la hauteur du glyphe sur ses GH rangées, centré dans
// ses GL colonnes à l'échelle (voir `normaliser`).
export function reconnaitreATaille(lum: Float32Array, largeur: number, hauteur: number, b: Glyphe, g: Gabarits): ChiffreLu {
  const x0 = Math.max(0, b.x - 1), x1 = Math.min(largeur, b.x + b.l + 1);
  const y0 = Math.max(0, b.y - 1), y1 = Math.min(hauteur, b.y + b.h + 1);
  const lu = new Float32Array((x1 - x0) * (y1 - y0));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) lu[(y - y0) * (x1 - x0) + x - x0] = lum[y * largeur + x];
  const rendu = new Float32Array(lu.length);
  const scores = Object.entries(g.chiffres).map(([c, modeles]) => {
    let meilleur = -1;
    for (const m of modeles) for (const dh of DECALAGES_H) for (const dy of DECALAGES_Y) for (const dx of DECALAGES_X) {
      const echelle = (b.h + dh) / g.h, haut = b.y + dy, centre = b.x + b.l / 2 + dx;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        rendu[(y - y0) * (x1 - x0) + x - x0] = moyenneGabarit(m, g.l, g.h,
          (x - centre) / echelle + g.l / 2, (x + 1 - centre) / echelle + g.l / 2, (y - haut) / echelle, (y + 1 - haut) / echelle);
      }
      meilleur = Math.max(meilleur, correlationTableaux(lu, rendu));
    }
    return [c, meilleur] as const;
  });
  scores.sort((a, b2) => b2[1] - a[1]);
  return { chiffre: scores[0][0], score: scores[0][1], ecart: scores[0][1] - (scores[1]?.[1] ?? 0) };
}

// `confiance` : le plus faible score de ses chiffres ; `marge` : le plus faible
// écart entre le chiffre lu et le suivant, pour un de ses chiffres. `accord` :
// la lecture agrandie (chaque glyphe ramené à 12 × 18, l'ancienne méthode)
// donne le même nombre, avec une confiance d'au moins 0,65 — deux méthodes
// différentes qui s'accordent. `hauteur` : celle des chiffres, en pixels.
export interface NombreLu { valeur: number; texte: string; confiance: number; marge: number; accord: boolean; hauteur: number }

// Sous 5 pixels de haut, un chiffre n'a plus que trois colonnes : on ne le lit
// pas, et la commande demande une capture plus grande.
export const HAUTEUR_CHIFFRE_MIN = 5;
const CONFIANCE_ACCORD = 0.65;

// Le nombre est le groupe de glyphes le plus à droite : des chiffres serrés.
// L'icône de vitesse, à sa gauche dans la pastille, en est séparée par un
// écart plus grand qu'entre deux chiffres : plus de 0,8 fois leur hauteur,
// ou — dès qu'un écart entre deux chiffres est connu — plus de 0,3 fois et le
// double du plus grand de ces écarts. Relevé : l'icône est à 0,75 fois la
// hauteur des chiffres sur PC (deux chiffres à 0,25), à 0,4 sur un grand
// écran (deux chiffres à 0,1). Le seuil absolu reste haut : à pas fixe, un
// « 1 », étroit, laisse plus de 0,5 fois la hauteur de blanc de chaque côté.
const ECART_DANS_NOMBRE = 0.8;
const ECART_ICONE_MIN = 0.3;

function nombreADroite(gs: Glyphe[]): Glyphe[] {
  const h = Math.max(...gs.map((x) => x.h));
  let debut = gs.length - 1, ecartChiffres = -1;
  while (debut > 0) {
    const e = gs[debut].x - (gs[debut - 1].x + gs[debut - 1].l);
    if (e > ECART_DANS_NOMBRE * h) break;
    if (ecartChiffres >= 0 && e > ECART_ICONE_MIN * h && e > 2 * Math.max(ecartChiffres, 0.15 * h)) break;
    ecartChiffres = Math.max(ecartChiffres, e);
    debut--;
  }
  return gs.slice(debut);
}

// Les glyphes du nombre de la zone, icône de vitesse écartée. Aussi l'entrée
// des gabarits relevés sur de vraies captures
// (scripts/construire-gabarits-chiffres.ts), découpés comme à la lecture.
export function glyphesDuNombre(m: Masque): Glyphe[] {
  const tous = glyphes(m);
  return tous.length ? nombreADroite(tous) : [];
}

// Le nombre de la zone, `null` si elle n'en porte pas un lisible.
export function lireNombre(zone: Image, g: Gabarits): NombreLu | null {
  const m = masqueClair(zone);
  const gs = glyphesDuNombre(m);
  const hauteur = gs.length ? Math.max(...gs.map((x) => x.h)) : 0;
  if (gs.length === 0 || gs.length > 4 || hauteur < HAUTEUR_CHIFFRE_MIN) return null;
  const lum = luminosite(zone);
  const lus = gs.map((x) => reconnaitreATaille(lum, zone.largeur, zone.hauteur, x, g));
  const texte = lus.map((l) => l.chiffre).join('');
  const agrandis = gs.map((x) => reconnaitreChiffre(decoupesVoisines(m, x).map((v) => normaliser(m, v)), g));
  const accord = agrandis.map((l) => l.chiffre).join('') === texte && Math.min(...agrandis.map((l) => l.score)) >= CONFIANCE_ACCORD;
  return { valeur: Number(texte), texte, confiance: Math.min(...lus.map((l) => l.score)), marge: Math.min(...lus.map((l) => l.ecart)), accord, hauteur };
}
