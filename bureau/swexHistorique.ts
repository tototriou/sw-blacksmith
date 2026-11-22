// L'historique du compte tenu par le plugin SWEX, sur le disque — ce que
// bureau/swex.ts en lit pour Mon compte › Runes › Comparaison › Historique
// (docs/02-app/compte/feat-runes/comparaison.md). Sans Electron :
// tests/bureau-swex-historique.test.ts le lance sur un dossier temporaire.
//
// L'archive du compte (`compte.jsonl.gz`, plugin-swex/source/fichiers.ts) :
// un bloc gzip par connexion, chacun l'état allégé du compte à ce moment-là
// (`versEtatArchive`, plugin-swex/source/etatDirect.ts).
//
// ⚠️ **Lister ne décompresse rien.** Chaque bloc dit sa date et son empreinte
// dans son en-tête (`parcourirArchive`) : la liste coûte quelques octets par
// connexion, et seul l'état demandé se décompresse (~190 Ko pour un gros
// compte). ⚠️ Rien n'est écrit : le dossier est celui du plugin.

import { promises } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parcourirArchive } from '../plugin-swex/source/archive';
import { FORMAT_COMPTE_ARCHIVE, VERSION_COMPTE_ARCHIVE } from '../plugin-swex/source/etatDirect';
import { COMPTE_ARCHIVE } from '../plugin-swex/source/fichiers';
import { dossierDuPlugin } from './swexLive';

// Un état de l'archive, tel que listé. `cle` le désigne pour `lireEtatCompte` :
// la date ET l'empreinte. L'empreinte seule ne suffit pas : un compte revenu
// à un état antérieur (une rune retirée puis remise) la reprend plus loin.
export interface EtatHistorique {
  cle: string;
  // Heure serveur de la connexion, en millisecondes.
  t: number;
}

const cleDe = (b: { debut: number; empreinte: string }) => `${b.debut}:${b.empreinte}`;

async function cheminArchive(dossierSwex: string, id: string): Promise<string | null> {
  const dossier = await dossierDuPlugin(dossierSwex, id);
  return dossier ? join(dossier, COMPTE_ARCHIVE) : null;
}

// Les états de l'invocateur `id`, du plus récent au plus ancien ; `null` sans
// dossier du plugin pour lui, `[]` sans archive encore (aucune connexion vue).
export async function listerEtatsCompte(dossierSwex: string, id: string): Promise<EtatHistorique[] | null> {
  const chemin = await cheminArchive(dossierSwex, id);
  if (!chemin) return null;
  const { blocs } = await parcourirArchive(chemin);
  return blocs.map((b) => ({ cle: cleDe(b), t: b.debut * 1000 })).reverse();
}

// Les runes BRUTES (format de l'export) de l'état `cle`, et sa date ; `null`
// si l'état n'existe plus, ou que son bloc est illisible ou d'un autre format.
// Les runes restent brutes : le calcul (efficience, score) est celui de l'app
// du jour, pour toute la chronologie.
export async function lireEtatCompte(
  dossierSwex: string,
  id: string,
  cle: string
): Promise<{ t: number; runes: unknown[] } | null> {
  const chemin = await cheminArchive(dossierSwex, id);
  if (!chemin) return null;
  const { blocs } = await parcourirArchive(chemin);
  const bloc = blocs.find((b) => cleDe(b) === cle);
  if (!bloc) return null;
  const fichier = await promises.open(chemin, 'r');
  try {
    const octets = Buffer.alloc(bloc.taille);
    await fichier.read(octets, 0, bloc.taille, bloc.position);
    const premiere = gunzipSync(octets).toString('utf8').split('\n', 1)[0];
    const etat = JSON.parse(premiere) as Record<string, unknown>;
    if (etat.format !== FORMAT_COMPTE_ARCHIVE || etat.version !== VERSION_COMPTE_ARCHIVE || !Array.isArray(etat.runes)) return null;
    return { t: bloc.debut * 1000, runes: etat.runes };
  } catch {
    return null; // bloc abîmé
  } finally {
    await fichier.close();
  }
}
