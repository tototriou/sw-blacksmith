// L'archive d'un type de données du plugin (`compte.jsonl.gz`,
// `guilde.jsonl.gz`) : UN fichier, fait de blocs gzip ajoutés à la suite, un
// par session. Le format gzip permet d'enchaîner des blocs : `zcat`, 7-Zip ou
// le `zlib` de Node relisent le tout comme un seul texte JSON Lines.
//
// ⚠️ **Chaque bloc dit sa taille, ses dates et son empreinte**, dans un champ
// que le format gzip prévoit pour cela (FEXTRA, sous-champ `SB`) et que les
// outils ignorent — le principe du format BGZF. Sans décompresser, on saute
// ainsi d'en-tête en en-tête : lister les sessions coûte quelques octets lus
// par session, et on ne décompresse que celles qu'on demande.
//
// ⚠️ **Un ajout interrompu ne perd rien.** Un dernier bloc tronqué rendrait
// toute l'archive illisible d'un seul `gunzip` (`Z_BUF_ERROR`). Avant chaque
// ajout, la chaîne des en-têtes est parcourue : là où un bloc annonce plus
// d'octets qu'il n'en reste, ou n'a pas d'en-tête valide, l'archive est
// coupée. Et un bloc dont l'empreinte est celle du dernier bloc n'est pas
// ajouté deux fois (ajout repris après une interruption, état inchangé).
//
// Pur ici (construire et lire un bloc) ; le disque : `ajouterAuFichier`.

import { createHash } from 'node:crypto';
import { promises } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

export interface EnteteBloc {
  // Taille du bloc entier, en octets, en-tête compris.
  taille: number;
  // Heures serveur (secondes) de début et de fin de la session.
  debut: number;
  fin: number;
  // Les 8 premiers octets du SHA-1 du contenu, en hexadécimal.
  empreinte: string;
}

const VERSION_ENTETE = 1;
// Sous-champ FEXTRA : identifiant (2 octets), longueur (2), puis version (1),
// taille (4), début (4), fin (4), empreinte (8).
const DONNEES = 1 + 4 + 4 + 4 + 8;
const SOUS_CHAMP = 4 + DONNEES;
// Ce qu'il faut lire pour décoder un en-tête : les 10 octets fixes, XLEN, et
// notre sous-champ, toujours le premier.
export const OCTETS_ENTETE = 10 + 2 + SOUS_CHAMP;

// L'empreinte d'un contenu. ⚠️ C'est l'APPELANT qui dit ce qu'elle couvre :
// pour l'état du compte, tout sauf l'heure (deux connexions sans rien de joué
// entre elles ont le même état) ; pour une session de guilde, tout le texte.
export const empreinteDe = (texte: string) => createHash('sha1').update(texte).digest('hex').slice(0, 16);

export interface Bloc {
  texte: string;
  debut: number;
  fin: number;
  // Rendue par `empreinteDe` : 16 caractères hexadécimaux.
  empreinte: string;
}

// Un bloc : le texte compressé, et notre sous-champ glissé dans l'en-tête gzip.
// ⚠️ On part de `gzipSync` et on insère le champ après les 10 octets fixes : le
// CRC du gzip porte sur les données, pas sur l'en-tête (FHCRC n'est pas mis).
export function construireBloc({ texte, debut, fin, empreinte }: Bloc): Buffer {
  const gz = gzipSync(texte, { level: 9 });
  const taille = gz.length + 2 + SOUS_CHAMP;
  const extra = Buffer.alloc(2 + SOUS_CHAMP);
  extra.writeUInt16LE(SOUS_CHAMP, 0); // XLEN
  extra.write('SB', 2, 'latin1');
  extra.writeUInt16LE(DONNEES, 4);
  extra.writeUInt8(VERSION_ENTETE, 6);
  extra.writeUInt32LE(taille, 7);
  extra.writeUInt32LE(borne(debut), 11);
  extra.writeUInt32LE(borne(fin), 15);
  extra.write(empreinte, 19, 'hex');
  const entete = Buffer.from(gz.subarray(0, 10));
  entete[3] |= 0x04; // FLG.FEXTRA
  return Buffer.concat([entete, extra, gz.subarray(10)]);
}

const borne = (n: number) => (Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 0xffffffff) : 0);

// L'en-tête d'un bloc, lu dans ses premiers octets, ou `null` s'il n'en est pas
// un des nôtres.
export function lireEntete(octets: Buffer): EnteteBloc | null {
  if (octets.length < OCTETS_ENTETE) return null;
  if (octets[0] !== 0x1f || octets[1] !== 0x8b || octets[2] !== 8 || !(octets[3] & 0x04)) return null;
  if (octets.toString('latin1', 12, 14) !== 'SB' || octets.readUInt16LE(14) !== DONNEES) return null;
  if (octets.readUInt8(16) !== VERSION_ENTETE) return null;
  return {
    taille: octets.readUInt32LE(17),
    debut: octets.readUInt32LE(21),
    fin: octets.readUInt32LE(25),
    empreinte: octets.toString('hex', 29, 37),
  };
}

// Les blocs valides d'une archive, en sautant d'en-tête en en-tête, et où
// s'arrête la partie saine (`fin` : là où couper ce qui suit).
export async function parcourirArchive(chemin: string): Promise<{ blocs: (EnteteBloc & { position: number })[]; fin: number }> {
  const blocs: (EnteteBloc & { position: number })[] = [];
  let fichier: FileHandle;
  try {
    fichier = await promises.open(chemin, 'r');
  } catch {
    return { blocs, fin: 0 }; // pas encore d'archive
  }
  try {
    const total = (await fichier.stat()).size;
    const tampon = Buffer.alloc(OCTETS_ENTETE);
    let position = 0;
    while (position < total) {
      const { bytesRead } = await fichier.read(tampon, 0, OCTETS_ENTETE, position);
      const entete = lireEntete(tampon.subarray(0, bytesRead));
      if (!entete || entete.taille < OCTETS_ENTETE || position + entete.taille > total) break;
      blocs.push({ ...entete, position });
      position += entete.taille;
    }
    return { blocs, fin: position };
  } finally {
    await fichier.close();
  }
}

// Ajoute un bloc à l'archive : coupe d'abord ce qui suit le dernier bloc sain
// (un ajout interrompu), puis ajoute — sauf si le dernier bloc a déjà cette
// empreinte. `false` si rien n'a été ajouté.
// ⚠️ Ouvert en ajout (`a`) : chaque écriture va en fin de fichier, et la fin
// est la partie saine une fois coupé ce qui la suivait.
export async function ajouterAuFichier(chemin: string, bloc: Bloc): Promise<boolean> {
  const { blocs, fin: sain } = await parcourirArchive(chemin);
  const dernier = blocs[blocs.length - 1];
  const fichier = await promises.open(chemin, 'a');
  try {
    if ((await fichier.stat()).size !== sain) await fichier.truncate(sain);
    if (dernier && dernier.empreinte === bloc.empreinte) return false;
    const octets = construireBloc(bloc);
    await fichier.write(octets, 0, octets.length);
    await fichier.sync();
    return true;
  } finally {
    await fichier.close();
  }
}
