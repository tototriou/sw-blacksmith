// Une image en mémoire, décodée d'un PNG ou d'un JPEG (les deux formats d'une
// capture d'écran), et les deux opérations dont la lecture a besoin : découper
// un rectangle et le réduire par moyenne de surface.
//
// ⚠️ Décodeurs en JavaScript pur (`pngjs`, `jpeg-js`) : la fonction Vercel est
// empaquetée par esbuild, où un module natif (sharp, canvas) ne se transporte
// pas.

import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

export interface Image {
  largeur: number;
  hauteur: number;
  rgba: Uint8Array; // 4 octets par pixel, ligne par ligne
}

// Au-delà, la capture n'est pas un écran de téléphone : on refuse avant de
// décoder (une image de 20 000 × 20 000 pèse 1,6 Go une fois décodée).
export const PIXELS_MAX = 16_000_000;

const estPng = (o: Uint8Array) => o.length > 8 && o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4e && o[3] === 0x47;
const estJpeg = (o: Uint8Array) => o.length > 3 && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff;

// La taille annoncée par l'en-tête d'un PNG : le premier bloc est toujours
// IHDR (longueur sur 4 octets, « IHDR », puis largeur et hauteur sur 4 octets
// chacune, gros-boutistes). `null` si l'en-tête n'est pas celui attendu.
export function dimensionsPng(o: Uint8Array): { largeur: number; hauteur: number } | null {
  if (o.length < 24 || o[12] !== 0x49 || o[13] !== 0x48 || o[14] !== 0x44 || o[15] !== 0x52) return null;
  const vue = new DataView(o.buffer, o.byteOffset, o.byteLength);
  return { largeur: vue.getUint32(16), hauteur: vue.getUint32(20) };
}

// `null` : ni PNG ni JPEG, illisible, ou trop grande.
export function decoderImage(octets: Uint8Array): Image | null {
  try {
    if (estPng(octets)) {
      // ⚠️ La taille se lit dans l'en-tête IHDR AVANT de décoder : un PNG d'une
      // couleur unie se compresse à presque rien, et 10 Mo peuvent en cacher
      // des milliards de pixels — la fonction manquait de mémoire au décodage.
      const dims = dimensionsPng(octets);
      if (!dims || dims.largeur * dims.hauteur > PIXELS_MAX) return null;
      const png = PNG.sync.read(Buffer.from(octets));
      return { largeur: png.width, hauteur: png.height, rgba: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length) };
    }
    if (estJpeg(octets)) {
      const j = jpeg.decode(octets, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: PIXELS_MAX / 1e6, maxMemoryUsageInMB: 512 });
      return { largeur: j.width, hauteur: j.height, rgba: j.data };
    }
  } catch {
    return null;
  }
  return null;
}

// Le rectangle [x, y, largeur, hauteur] ramené dans l'image, `null` s'il en sort.
export function decouper(img: Image, x: number, y: number, l: number, h: number): Image | null {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(img.largeur, Math.round(x + l));
  const y1 = Math.min(img.hauteur, Math.round(y + h));
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  const sortie = new Uint8Array((x1 - x0) * (y1 - y0) * 4);
  for (let yy = y0; yy < y1; yy++) {
    sortie.set(img.rgba.subarray((yy * img.largeur + x0) * 4, (yy * img.largeur + x1) * 4), (yy - y0) * (x1 - x0) * 4);
  }
  return { largeur: x1 - x0, hauteur: y1 - y0, rgba: sortie };
}

// Réduction par moyenne de surface (l'`INTER_AREA` d'OpenCV) : chaque pixel de
// sortie est la moyenne pondérée des pixels source qu'il recouvre. Rend du RVB
// flottant, 3 valeurs par pixel, de 0 à 255.
export function reduire(img: Image, l: number, h: number): Float32Array {
  const sortie = new Float32Array(l * h * 3);
  const fx = img.largeur / l;
  const fy = img.hauteur / h;
  for (let oy = 0; oy < h; oy++) {
    const sy0 = oy * fy;
    const sy1 = sy0 + fy;
    for (let ox = 0; ox < l; ox++) {
      const sx0 = ox * fx;
      const sx1 = sx0 + fx;
      let r = 0, v = 0, b = 0, poids = 0;
      for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
        const py = Math.min(y + 1, sy1) - Math.max(y, sy0);
        if (py <= 0) continue;
        for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
          const px = Math.min(x + 1, sx1) - Math.max(x, sx0);
          if (px <= 0) continue;
          const p = px * py;
          const i = (Math.min(y, img.hauteur - 1) * img.largeur + Math.min(x, img.largeur - 1)) * 4;
          r += img.rgba[i] * p;
          v += img.rgba[i + 1] * p;
          b += img.rgba[i + 2] * p;
          poids += p;
        }
      }
      const o = (oy * l + ox) * 3;
      sortie[o] = r / poids;
      sortie[o + 1] = v / poids;
      sortie[o + 2] = b / poids;
    }
  }
  return sortie;
}
