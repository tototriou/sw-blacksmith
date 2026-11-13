// Reconnaissance d'un monstre à son portrait, portée du projet
// « Youtube-to-offenses-decks » (portraits.py), dont les réglages ont été
// choisis sur 2 799 portraits étiquetés.
//
// Descripteur : la zone centrale du portrait (sans le cadre, les étoiles en
// haut, la barre de VIT et la pastille de chef en bas), ramenée à 24 × 24, en
// Lab, centrée-réduite canal par canal, et la TEINTE moyenne de cette zone.
// Score = corrélation normalisée (1 = identique), moins une pénalité d'écart de
// teinte : plusieurs éléments d'un même monstre ont le même dessin et ne
// diffèrent que par la couleur, que la réduction canal par canal efface.
//
// La banque (un descripteur par portrait SWARFARM de monstre obtenable et
// éveillé) est construite hors ligne par scripts/construire-banque-portraits.ts.

import { decouper, reduire, type Image } from './image';

export const COTE = 24;
export const TAILLE = COTE * COTE * 3;
// Zone utile, en fraction du portrait sans cadre : x, y, largeur, hauteur.
const INTERIEUR = [0.1, 0.25, 0.8, 0.5] as const;
// Bordure du portrait dans le jeu, en fraction du côté. Les icônes de la banque
// n'en ont pas.
export const CADRE = 0.04;
// Recalage de la découpe, en fraction du côté : chaque monstre garde son
// meilleur score sur toutes les découpes voisines.
const DECALAGES = [-0.06, -0.03, 0, 0.03, 0.06];
const TAILLES = [-0.06, 0, 0.06];
// Teinte : direction moyenne (a, b), divisée par sa norme plus AMORTI (unités
// Lab) ; pénalité = POIDS_TEINTE × distance des deux vecteurs.
const AMORTI = 6;
const POIDS_TEINTE = 0.2;

// sRVB (0-255) → Lab (D65).
function lab(r: number, v: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r), V = lin(v), B = lin(b);
  const X = (0.4124564 * R + 0.3575761 * V + 0.1804375 * B) / 0.95047;
  const Y = 0.2126729 * R + 0.7151522 * V + 0.072175 * B;
  const Z = (0.0193339 * R + 0.119192 * V + 0.9503041 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function zone(portrait: Image, cadre: number): Image | null {
  let p: Image | null = portrait;
  if (cadre) {
    const dx = Math.floor(p.largeur * cadre), dy = Math.floor(p.hauteur * cadre);
    p = decouper(p, dx, dy, p.largeur - 2 * dx, p.hauteur - 2 * dy);
  }
  if (!p) return null;
  const [x, y, l, h] = INTERIEUR;
  return decouper(p, p.largeur * x, p.hauteur * y, p.largeur * l, p.hauteur * h);
}

export interface Signature {
  dessin: Float32Array; // TAILLE valeurs, de norme 1
  teinte: [number, number];
}

export function signature(portrait: Image, cadre = 0): Signature | null {
  const z = zone(portrait, cadre);
  if (!z) return null;
  const rvb = reduire(z, COTE, COTE);
  const n = COTE * COTE;
  const labs = new Float32Array(TAILLE);
  for (let i = 0; i < n; i++) {
    const [L, a, b] = lab(rvb[i * 3], rvb[i * 3 + 1], rvb[i * 3 + 2]);
    labs[i * 3] = L; labs[i * 3 + 1] = a; labs[i * 3 + 2] = b;
  }
  const dessin = new Float32Array(TAILLE);
  const moyenneAb = [0, 0];
  for (let c = 0; c < 3; c++) {
    let m = 0;
    for (let i = 0; i < n; i++) m += labs[i * 3 + c];
    m /= n;
    if (c > 0) moyenneAb[c - 1] = m;
    let v = 0;
    for (let i = 0; i < n; i++) v += (labs[i * 3 + c] - m) ** 2;
    const et = Math.sqrt(v / n) + 1e-6;
    for (let i = 0; i < n; i++) dessin[i * 3 + c] = (labs[i * 3 + c] - m) / et / Math.sqrt(TAILLE);
  }
  // La teinte : moyenne (a, b) de la zone réduite, qui vaut celle de la zone
  // entière à l'arrondi près (la réduction est une moyenne de surface).
  const norme = Math.hypot(moyenneAb[0], moyenneAb[1]) + AMORTI;
  return { dessin, teinte: [moyenneAb[0] / norme, moyenneAb[1] / norme] };
}

// La découpe [x, y, l, h] et ses voisines, décalées et agrandies ou réduites.
export function variantes(img: Image, [x, y, l, h]: [number, number, number, number]): Image[] {
  const sortie: Image[] = [];
  for (const dt of TAILLES) {
    const lt = Math.round(l * (1 + dt)), ht = Math.round(h * (1 + dt));
    for (const fx of DECALAGES) {
      for (const fy of DECALAGES) {
        const m = decouper(img, x + fx * l - (lt - l) / 2, y + fy * h - (ht - h) / 2, lt, ht);
        if (m && m.largeur > 4 && m.hauteur > 4) sortie.push(m);
      }
    }
  }
  return sortie;
}

// ---- La banque ----------------------------------------------------------

// Forme sérialisée : `dessins` est un Int8Array en base64, chaque valeur du
// dessin multipliée par ECHELLE × √TAILLE (une valeur centrée-réduite, entre
// -4 et 4 en pratique, tient sur un octet signé).
export const ECHELLE = 30;
export interface BanqueSerialisee {
  version: 1;
  cote: number;
  // L'identifiant de référence (paire collab ramenée à la forme au plus petit
  // com2usId, comme le bestiaire de l'app) : deux portraits peuvent le partager.
  ids: number[];
  teintes: number[]; // 2 par portrait
  dessins: string;
}

export interface Candidat { com2usId: number; score: number }
export interface Reconnaissance { meilleur: Candidat; suivants: Candidat[] }

export class Banque {
  readonly ids: number[];
  private readonly dessins: Int8Array;
  private readonly teintes: Float32Array;

  constructor(s: BanqueSerialisee) {
    if (s.version !== 1 || s.cote !== COTE) throw new Error('banque de portraits incompatible');
    this.ids = s.ids;
    this.teintes = Float32Array.from(s.teintes);
    const brut = Buffer.from(s.dessins, 'base64');
    this.dessins = new Int8Array(brut.buffer, brut.byteOffset, brut.length);
    if (this.dessins.length !== s.ids.length * TAILLE) throw new Error('banque de portraits tronquée');
  }

  // Les découpes d'un même portrait (voir `variantes`) : chaque monstre garde
  // son meilleur score. Les portraits d'un même monstre (deux faces d'une paire
  // collab) ne se font pas concurrence : le suivant est le meilleur AUTRE.
  reconnaitre(decoupes: Image[], n = 3): Reconnaissance | null {
    const sigs = decoupes.map((d) => signature(d, CADRE)).filter((s): s is Signature => s !== null);
    if (sigs.length === 0 || this.ids.length === 0) return null;
    const echelle = ECHELLE * Math.sqrt(TAILLE);
    const parId = new Map<number, number>();
    for (let k = 0; k < this.ids.length; k++) {
      const base = k * TAILLE;
      const tA = this.teintes[k * 2], tB = this.teintes[k * 2 + 1];
      let meilleur = -Infinity;
      for (const s of sigs) {
        let produit = 0;
        for (let i = 0; i < TAILLE; i++) produit += this.dessins[base + i] * s.dessin[i];
        const score = produit / echelle - POIDS_TEINTE * Math.hypot(tA - s.teinte[0], tB - s.teinte[1]);
        if (score > meilleur) meilleur = score;
      }
      const id = this.ids[k];
      if (meilleur > (parId.get(id) ?? -Infinity)) parId.set(id, meilleur);
    }
    const tries = [...parId].sort((a, b) => b[1] - a[1]).slice(0, n + 1).map(([com2usId, score]) => ({ com2usId, score }));
    return { meilleur: tries[0], suivants: tries.slice(1) };
  }
}

// Pour le script de construction : la signature d'une icône, quantifiée.
export function quantifier(dessin: Float32Array): Int8Array {
  const echelle = ECHELLE * Math.sqrt(TAILLE);
  const q = new Int8Array(TAILLE);
  for (let i = 0; i < TAILLE; i++) q[i] = Math.max(-127, Math.min(127, Math.round(dessin[i] * echelle)));
  return q;
}
