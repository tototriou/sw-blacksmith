// Le décodage d'une capture côté service (Node) : PNG et JPEG, les deux
// formats d'une capture d'écran. La lecture elle-même est partagée avec l'app
// (src/lib/capture/), qui décode dans le navigateur.
//
// ⚠️ Décodeurs en JavaScript pur (`pngjs`, `jpeg-js`) : la fonction Vercel est
// empaquetée par esbuild, où un module natif (sharp, canvas) ne se transporte
// pas.

import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { dimensionsPng, estPng, PIXELS_MAX, type Image } from '../../../src/lib/capture/image';

const estJpeg = (o: Uint8Array) => o.length > 3 && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff;

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
