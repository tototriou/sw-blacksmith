// Lire une capture DANS LE NAVIGATEUR : le navigateur la décode (PNG, JPEG,
// WebP, image collée…), un Web Worker la lit (lectureCapture.worker.ts).
//
// ⚠️ **La capture ne quitte jamais l'appareil** (local par défaut) : rien
// n'est envoyé, ni au service du bot, ni ailleurs.

import type { Image } from './image';
import { PIXELS_MAX } from './image';
import type { LectureEcran } from './ecranPreparation';

export interface DemandeLecture { id: number; image: Image }
// `panne` : la lecture n'a pas pu se faire (banque introuvable…), à distinguer
// d'un écran non reconnu (`lecture: null`).
export interface ReponseLecture { id: number; lecture: LectureEcran | null; panne?: boolean }

export type IssueLecture =
  | { type: 'lue'; lecture: LectureEcran }
  | { type: 'non-reconnue' }
  | { type: 'pas-une-image' }
  | { type: 'trop-grande' }
  | { type: 'panne' };

// Les pixels d'une image, tels quels : ni conversion de couleur, ni alpha
// prémultiplié — la lecture compare des portraits au pixel près.
async function decoder(fichier: Blob): Promise<Image | 'pas-une-image' | 'trop-grande'> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(fichier, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  } catch {
    return 'pas-une-image';
  }
  try {
    const { width: largeur, height: hauteur } = bitmap;
    if (largeur * hauteur > PIXELS_MAX) return 'trop-grande';
    const toile = document.createElement('canvas');
    toile.width = largeur;
    toile.height = hauteur;
    const ctx = toile.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 'pas-une-image';
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, largeur, hauteur);
    return { largeur, hauteur, rgba: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
  } finally {
    bitmap.close();
  }
}

// Un seul Worker, gardé : la banque de portraits n'est chargée qu'une fois.
let worker: Worker | null = null;
let prochainId = 1;
const enAttente = new Map<number, (r: ReponseLecture) => void>();
function leWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../../workers/lectureCapture.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<ReponseLecture>) => {
      enAttente.get(e.data.id)?.(e.data);
      enAttente.delete(e.data.id);
    };
    worker.onerror = () => {
      for (const repondre of enAttente.values()) repondre({ id: 0, lecture: null, panne: true });
      enAttente.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

export async function lireCapture(fichier: Blob): Promise<IssueLecture> {
  const image = await decoder(fichier);
  if (image === 'pas-une-image' || image === 'trop-grande') return { type: image };
  const id = prochainId++;
  const reponse = await new Promise<ReponseLecture>((resoudre) => {
    enAttente.set(id, resoudre);
    // Les pixels sont TRANSFÉRÉS, pas copiés : une capture 4K pèse 33 Mo.
    leWorker().postMessage({ id, image } satisfies DemandeLecture, [image.rgba.buffer]);
  });
  if (reponse.panne) return { type: 'panne' };
  return reponse.lecture ? { type: 'lue', lecture: reponse.lecture } : { type: 'non-reconnue' };
}
