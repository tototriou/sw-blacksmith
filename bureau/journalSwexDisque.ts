// Le journal complet de SWEX (`full_log.txt`, plugin Full Logger) dans le
// dossier SW Exporter : la box de l'arène dimensionnelle, que l'export de
// compte ne contient pas (src/lib/journalSwex.ts). Lecture sur le disque,
// sans Electron — testé par tests/bureau-swex.test.ts.
//
// ⚠️ **Le journal grossit sans limite** (8 Mo pour un quart d'heure de jeu) et
// change à CHAQUE commande échangée avec le jeu. Deux lectures, donc :
//  - `saisonDuJournal` lit par la FIN, par fenêtres qui grandissent, jusqu'à
//    trouver la dernière saison de l'invocateur — jamais tout le fichier
//    d'emblée ;
//  - `ajoutContientSaison` ne relit que ce qui a été AJOUTÉ depuis la lecture
//    précédente : pendant une partie, presque toujours sans saison.

import { promises } from 'node:fs';
import { COMMANDE_SAISON_DIMENSION, saisonDeLInvocateur } from '../src/lib/journalSwex';

export const NOM_JOURNAL = 'full_log.txt';

const FENETRE = 16 * 1024 * 1024;
// Au-delà, la chaîne lue dépasserait ce qu'un moteur JavaScript accepte : un
// journal de cette taille sans saison récente n'en donnera pas.
const FENETRE_MAX = 256 * 1024 * 1024;
const MARQUE = `API Command: ${COMMANDE_SAISON_DIMENSION} - `;

// La dernière saison dimensionnelle de l'invocateur `wizardId`, ou null (pas
// de journal, ou le mode jamais ouvert depuis qu'il existe). Une coupure de
// fenêtre au milieu d'un caractère ne touche que le début du texte lu, avant
// l'échange cherché.
export async function saisonDuJournal(
  chemin: string,
  wizardId: number,
  fenetreInitiale = FENETRE
): Promise<Record<string, any> | null> {
  let f: promises.FileHandle;
  try {
    f = await promises.open(chemin, 'r');
  } catch {
    return null;
  }
  try {
    const { size } = await f.stat();
    let fenetre = Math.min(fenetreInitiale, size);
    for (;;) {
      const tampon = Buffer.alloc(fenetre);
      await f.read(tampon, 0, fenetre, size - fenetre);
      const saison = saisonDeLInvocateur(tampon.toString('utf8'), wizardId);
      if (saison || fenetre >= size || fenetre >= FENETRE_MAX) return saison;
      fenetre = Math.min(fenetre * 4, size, FENETRE_MAX);
    }
  } finally {
    await f.close();
  }
}

// Ce qui a été ajouté au journal depuis `depuis` octets contient-il une
// saison ? `taille` : la taille lue, à repasser au prochain appel. Un journal
// plus court qu'avant a été recommencé : il est relu comme neuf
// (`contient` vrai, la saison se cherche alors en entier).
export async function ajoutContientSaison(chemin: string, depuis: number): Promise<{ taille: number; contient: boolean }> {
  let f: promises.FileHandle;
  try {
    f = await promises.open(chemin, 'r');
  } catch {
    return { taille: 0, contient: false };
  }
  try {
    const { size } = await f.stat();
    if (size < depuis) return { taille: size, contient: true };
    if (size === depuis) return { taille: size, contient: false };
    // La marque peut chevaucher la limite de la lecture précédente.
    const debut = Math.max(0, depuis - MARQUE.length);
    const tampon = Buffer.alloc(size - debut);
    await f.read(tampon, 0, tampon.length, debut);
    return { taille: size, contient: tampon.toString('utf8').includes(MARQUE) };
  } finally {
    await f.close();
  }
}
