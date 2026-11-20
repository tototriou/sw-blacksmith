// Le fichier live du plugin SWEX, sur le disque — ce que bureau/swex.ts en
// lit pour « Mon compte » en direct (docs/02-app/bureau/feat-swex-direct.md).
// Sans Electron : tests/bureau-swex-direct.test.ts le lance sur un dossier
// temporaire.
//
// ⚠️ **Seul ce qui s'ajoute se relit.** Le plugin AJOUTE une ligne par
// changement ; à la connexion suivante, il RÉÉCRIT le fichier (fichier
// temporaire renommé : un autre fichier sur le disque). Une lecture retient
// donc l'identité du fichier (`ino`) et l'octet où elle s'est arrêtée : même
// fichier et plus long, on lit la suite ; autre fichier ou plus court, tout.
// ⚠️ **Une dernière ligne sans fin de ligne attend** : le plugin l'écrit
// peut-être à cet instant. Ses octets sont gardés (`reste`, des OCTETS : un
// caractère peut être coupé en deux) et complétés à la lecture suivante.

import { promises } from 'node:fs';
import { join } from 'node:path';
import { COMPTE_LIVE, DOSSIER_PLUGIN, comparerVersions, dossierDeLInvocateur, enteteLive, versionDuPlugin } from './swexPur';

export interface LectureLive {
  chemin: string;
  ino: number;
  lu: number;
  reste: Buffer;
}

// Les lignes complètes de `octets`, et ce qui reste après la dernière.
function couper(octets: Buffer): { lignes: string[]; reste: Buffer } {
  const fin = octets.lastIndexOf(0x0a);
  if (fin < 0) return { lignes: [], reste: octets };
  const lignes = octets.subarray(0, fin).toString('utf8').split('\n').filter((l) => l.trim());
  return { lignes, reste: Buffer.from(octets.subarray(fin + 1)) };
}

// Lit le fichier live : en entier (`debut`) sans lecture précédente de ce
// fichier, sinon ce qui s'y est ajouté. Lève si le fichier n'est pas lisible.
export async function lireLive(
  chemin: string,
  avant: LectureLive | null
): Promise<{ lecture: LectureLive; debut: boolean; lignes: string[] }> {
  const fichier = await promises.open(chemin, 'r');
  try {
    const { ino, size } = await fichier.stat();
    const suite = avant !== null && avant.chemin === chemin && avant.ino === ino && size >= avant.lu;
    const depuis = suite ? avant.lu : 0;
    const octets = Buffer.alloc(size - depuis);
    let n = 0;
    while (n < octets.length) {
      const { bytesRead } = await fichier.read(octets, n, octets.length - n, depuis + n);
      if (!bytesRead) break;
      n += bytesRead;
    }
    const { lignes, reste } = couper(suite ? Buffer.concat([avant.reste, octets.subarray(0, n)]) : octets.subarray(0, n));
    return { lecture: { chemin, ino, lu: depuis + n, reste }, debut: !suite, lignes };
  } finally {
    await fichier.close();
  }
}

// Le fichier live de l'invocateur `id` dans le dossier de SWEX, ou `null`.
export async function cheminLive(dossierSwex: string, id: string): Promise<string | null> {
  const dossier = await dossierDuPlugin(dossierSwex, id);
  return dossier ? join(dossier, COMPTE_LIVE) : null;
}

// Le dossier du plugin pour l'invocateur `id` (`SWBlacksmith/<nom>-<id>`), ou
// `null` : celui dont le compte live est le plus récent (`dossierDeLInvocateur`).
// Ses fichiers de guilde sont à côté.
export async function dossierDuPlugin(dossierSwex: string, id: string): Promise<string | null> {
  const racine = join(dossierSwex, DOSSIER_PLUGIN);
  let entrees: string[];
  try {
    entrees = (await promises.readdir(racine, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return null; // pas de plugin, ou pas encore de connexion
  }
  const dossiers = await Promise.all(
    entrees
      .filter((nom) => nom.endsWith(`-${id}`))
      .map(async (nom) => ({
        nom,
        modifie: await promises.stat(join(racine, nom, COMPTE_LIVE)).then((s) => s.mtimeMs, () => null),
      }))
  );
  const nom = dossierDeLInvocateur(dossiers, id);
  return nom ? join(racine, nom) : null;
}

// Les premiers octets d'un fichier (en-tête du live, bannière du plugin).
async function debutDe(chemin: string, octets = 512): Promise<string> {
  const fichier = await promises.open(chemin, 'r');
  try {
    const tampon = Buffer.alloc(octets);
    const { bytesRead } = await fichier.read(tampon, 0, octets, 0);
    return tampon.subarray(0, bytesRead).toString('utf8');
  } finally {
    await fichier.close();
  }
}

export async function enteteDuLive(chemin: string) {
  return enteteLive(await debutDe(chemin));
}

// La version du plugin installé dans SWEX (son dossier `plugins`), ou `null`. Tout `.js`
// du dossier est regardé : l'utilisateur a pu renommer le fichier.
export async function versionInstallee(dossierSwex: string): Promise<string | null> {
  const dossier = join(dossierSwex, 'plugins');
  let noms: string[];
  try {
    noms = (await promises.readdir(dossier)).filter((n) => n.toLowerCase().endsWith('.js'));
  } catch {
    return null;
  }
  let meilleure: string | null = null;
  for (const nom of noms) {
    const v = versionDuPlugin(await debutDe(join(dossier, nom), 200).catch(() => ''));
    // Deux copies (une ancienne laissée sous un autre nom) : la plus ancienne
    // est montrée — c'est elle qu'il faut remplacer.
    if (v && (meilleure === null || comparerVersions(v, meilleure) < 0)) meilleure = v;
  }
  return meilleure;
}

// L'heure serveur (`tvalue`) de l'export, mémorisée par fichier et date : un
// export pèse plusieurs Mo, il ne se relit qu'à un changement.
const heures = new Map<string, { modifie: number; t: number | null }>();
export async function heureExport(chemin: string): Promise<number | null> {
  const modifie = (await promises.stat(chemin)).mtimeMs;
  const connue = heures.get(chemin);
  if (connue && connue.modifie === modifie) return connue.t;
  let v: unknown;
  try {
    v = JSON.parse(await promises.readFile(chemin, 'utf8'))?.tvalue;
  } catch {
    return null; // export à moitié écrit : relu au prochain changement
  }
  const t = typeof v === 'number' && Number.isFinite(v) ? v : null;
  heures.set(chemin, { modifie, t });
  return t;
}
