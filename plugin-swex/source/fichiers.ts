// Les fichiers que le plugin écrit dans le dossier de SW Exporter : leur place,
// et une écriture qui ne laisse jamais un fichier à moitié écrit.
//
//   <dossier de SWEX>/
//     <nom>-<id>.json              ← l'export de ProfileExport (pas au plugin)
//     SWBlacksmith/<nom>-<id>/
//       compte.live.jsonl          ← la session en cours : la connexion, puis
//                                    une ligne par changement
//       compte.jsonl.gz            ← l'archive : l'état allégé à chaque connexion
//       guilde.live.jsonl          ← la session en cours : une ligne par vue
//                                    ou combat de guilde
//       guilde.jsonl.gz            ← l'archive : chaque session, en entier
//       dimension.json             ← l'arène dimensionnelle : la saison du jeu,
//                                    tenue à jour à chaque changement du mode

import { existsSync, mkdirSync, promises, readdirSync, renameSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Le dossier du plugin, dans celui de SWEX : du nom du plugin. Hors de la
// racine, ses fichiers ne passent jamais par la liste des comptes de l'app,
// qui ne lit que les `<nom>-<id>.json` de la racine.
export const DOSSIER_PLUGIN = 'SWBlacksmith';
export const COMPTE_LIVE = 'compte.live.jsonl';
export const COMPTE_ARCHIVE = 'compte.jsonl.gz';
export const GUILDE_LIVE = 'guilde.live.jsonl';
export const GUILDE_ARCHIVE = 'guilde.jsonl.gz';
export const DIMENSION = 'dimension.json';

// Le nom du dossier d'un invocateur : celui de l'export de ProfileExport
// (`<nom>-<id>.json`) s'il est là — ProfileExport nettoie le pseudo à sa façon,
// et l'utilisateur y reconnaît son export —, sinon le pseudo débarrassé des
// caractères interdits dans un nom de fichier. Plusieurs exports du même
// invocateur (pseudo changé) : le plus récent, celui qu'écrit ProfileExport.
export function nomDeBase(dossier: string, wizardId: number, wizardName: string): string {
  try {
    const suffixe = `-${wizardId}.json`;
    const exports = readdirSync(dossier)
      .filter((f) => f.endsWith(suffixe) && f.length > suffixe.length)
      .map((f) => ({ f, date: statSync(join(dossier, f)).mtimeMs }))
      .sort((a, b) => b.date - a.date);
    if (exports.length) return exports[0].f.slice(0, -'.json'.length);
  } catch {
    /* dossier illisible : le nom se déduit du pseudo */
  }
  return `${wizardName.replace(/[\\/:*?"<>|]/g, '').trim() || 'compte'}-${wizardId}`;
}

// ⚠️ UN dossier par invocateur, reconnu à son identifiant (`…-<id>`) : le nom
// n'est qu'une étiquette, l'identifiant est le lien — c'est par lui que l'app
// relie le dossier à l'export. Si le nom a changé (pseudo changé, export arrivé
// après une première connexion nommée d'après le pseudo), l'ancien dossier est
// renommé, et l'historique des combats de guilde le suit. Le renommage échoue
// sous Windows tant qu'un programme lit un fichier du dossier : on garde alors
// l'ancien, que l'app retrouve tout autant par l'identifiant. Le dossier voulu
// existe déjà : on s'y tient, l'ancien reste tel quel.
export function dossierInvocateur(dossierSwex: string, wizardId: number, base: string): string {
  const parent = join(dossierSwex, DOSSIER_PLUGIN);
  const voulu = join(parent, base);
  mkdirSync(parent, { recursive: true });
  const suffixe = `-${wizardId}`;
  const ancien = existsSync(voulu)
    ? undefined
    : readdirSync(parent, { withFileTypes: true }).find(
        (d) => d.isDirectory() && d.name.endsWith(suffixe) && d.name.length > suffixe.length
      );
  if (ancien) {
    try {
      renameSync(join(parent, ancien.name), voulu);
    } catch {
      return join(parent, ancien.name);
    }
  }
  mkdirSync(voulu, { recursive: true });
  return voulu;
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ⚠️ Écriture ATOMIQUE, pour ce qui REMPLACE un fichier (la première ligne
// d'une session) : un fichier temporaire, puis renommé. L'app relit le
// fichier dès qu'il change ; écrit en place, elle pourrait lire 3 Mo à moitié
// écrits. Ce qui s'AJOUTE (une ligne) n'en a pas besoin : l'app ignore une
// dernière ligne sans son retour à la ligne. Sous Windows, le renommage échoue tant qu'un autre programme lit le
// fichier (`EBUSY`, `EPERM`, `EACCES`) : on réessaie un peu plus tard. Le
// dossier est recréé s'il a été supprimé pendant la partie.
export async function ecrireAtomique(chemin: string, texte: string, essais = 8, pause = 250): Promise<void> {
  const temporaire = `${chemin}.tmp`;
  await promises.mkdir(dirname(chemin), { recursive: true });
  await promises.writeFile(temporaire, texte, 'utf8');
  for (let i = 1; ; i++) {
    try {
      await promises.rename(temporaire, chemin);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (i >= essais || !['EBUSY', 'EPERM', 'EACCES'].includes(code ?? '')) {
        await promises.rm(temporaire, { force: true });
        throw e;
      }
      await attendre(pause * i);
    }
  }
}
