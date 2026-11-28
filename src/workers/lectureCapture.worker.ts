/// <reference lib="webworker" />
// La lecture d'une capture de l'écran de préparation de siège, hors du fil de
// l'interface : 1 à 3 s, jusqu'à 9 s pour une capture de tout un écran 4K —
// l'écran ne doit pas figer pendant ce temps.
//
// ⚠️ La banque de portraits (2,6 Mo) est importée ICI, et seulement ici : le
// Worker n'est créé qu'à la première lecture (lectureNavigateur.ts), si bien
// que ni la page ni le paquet principal ne la portent. Un `import()`
// dynamique n'est pas permis : Vite construit les Workers en un seul fichier.
import banqueJson from '../lib/capture/banque-portraits.json';
import gabaritsJson from '../lib/capture/chiffres-gabarits.json';
import { lireEcranPreparation } from '../lib/capture/ecranPreparation';
import { Banque, type BanqueSerialisee } from '../lib/capture/portraits';
import type { Gabarits } from '../lib/capture/chiffres';
import type { DemandeLecture, ReponseLecture } from '../lib/capture/lectureNavigateur';

// La banque se décode à la première demande, puis reste.
let banque: Banque | null = null;

self.onmessage = (e: MessageEvent<DemandeLecture>) => {
  const { id, image } = e.data;
  try {
    banque ??= new Banque(banqueJson as BanqueSerialisee);
    // ⚠️ VIT facultative : un counter se lit aussi sur trois portraits
    // recadrés, sans pastille de VIT (cartes.ts, `vitFacultative`).
    const lecture = lireEcranPreparation(image, banque, gabaritsJson as Gabarits, { vitFacultative: true });
    self.postMessage({ id, lecture } satisfies ReponseLecture);
  } catch {
    self.postMessage({ id, lecture: null, panne: true } satisfies ReponseLecture);
  }
};
