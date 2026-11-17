// Les fichiers que le plugin écrit dans le dossier de SW Exporter : leur nom,
// et une écriture qui ne laisse jamais un fichier à moitié écrit.

import { promises, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Le nom de base des fichiers du plugin pour un invocateur : celui de l'export
// de ProfileExport (`<nom>-<id>.json`) s'il est là — ProfileExport nettoie le
// pseudo à sa façon, et l'app relie les deux fichiers par ce nom —, sinon le
// pseudo débarrassé des caractères interdits dans un nom de fichier.
export function nomDeBase(dossier: string, wizardId: number, wizardName: string): string {
  try {
    const suffixe = `-${wizardId}.json`;
    const exportCompte = readdirSync(dossier).find((f) => f.endsWith(suffixe) && f.length > suffixe.length);
    if (exportCompte) return exportCompte.slice(0, -'.json'.length);
  } catch {
    /* dossier illisible : le nom se déduit du pseudo */
  }
  return `${wizardName.replace(/[\\/:*?"<>|]/g, '').trim() || 'compte'}-${wizardId}`;
}

// ⚠️ Les deux fichiers du plugin, à côté de l'export. Leurs noms ne passent
// PAS le filtre des exports de l'app (`<nom>-<id>.json`) : ils ne s'ajoutent
// jamais à la liste des comptes.
export const nomDirect = (base: string) => `${base}.direct.json`;
export const nomGuilde = (base: string) => `${base}.guilde.json`;

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ⚠️ Écriture ATOMIQUE : un fichier temporaire, puis renommé. L'app relit le
// fichier dès qu'il change ; écrit en place, elle pourrait lire 8 Mo à moitié
// écrits. Sous Windows, le renommage échoue tant qu'un autre programme lit le
// fichier (`EBUSY`, `EPERM`, `EACCES`) : on réessaie un peu plus tard.
export async function ecrireAtomique(chemin: string, texte: string, essais = 8, pause = 250): Promise<void> {
  const temporaire = `${chemin}.tmp`;
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

// Le chemin d'un fichier du plugin dans le dossier de SW Exporter.
export const chemin = (dossier: string, nom: string) => join(dossier, nom);
