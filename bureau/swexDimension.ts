// L'arène dimensionnelle lue dans le dossier du plugin SWEX : la saison que le
// plugin tient à jour (`dimension.json`, plugin-swex/source/dimension.ts) —
// la box, les runes, la défense et les attaques jouées. Voir
// docs/02-app/bureau/README.md, « L'arène dimensionnelle ».
//
// ⚠️ Lue seulement : rien n'est jamais écrit dans le dossier de SWEX.

import { promises } from 'node:fs';
import { join } from 'node:path';
import { FORMAT_DIMENSION, TYPE_ATTAQUE_DIMENSION, type MarqueDimension } from '../plugin-swex/source/dimension';
import { DIMENSION } from '../plugin-swex/source/fichiers';
import { dossierDuPlugin } from './swexLive';

export interface DimensionLue {
  // La réponse du jeu, telle que l'app la lit (`parseDimension…`).
  saison: Record<string, any>;
  // Heures serveur : la dernière ouverture du mode, le dernier changement.
  ouverture: number;
  t: number;
  // Les équipes d'attaque jouées, sous la forme de l'export
  // (`deck_recent_list`, type 28) ; vide si le plugin n'en a vu aucune.
  attaques: unknown[];
}

// La saison de l'invocateur `id`, ou `null` : pas de dossier du plugin pour
// lui, mode jamais ouvert, fichier illisible (réécrit à l'instant : le
// prochain changement redonnera) ou d'un autre invocateur.
export async function lireDimension(dossierSwex: string, id: string): Promise<DimensionLue | null> {
  const dossier = await dossierDuPlugin(dossierSwex, id);
  if (!dossier) return null;
  let saison: Record<string, any>;
  try {
    saison = JSON.parse(await promises.readFile(join(dossier, DIMENSION), 'utf8'));
  } catch {
    return null;
  }
  const marque = saison?.swblacksmith as MarqueDimension | undefined;
  if (marque?.format !== FORMAT_DIMENSION || String(saison.wizard_id) !== id) return null;
  const t = Number(marque.t);
  const ouverture = Number(marque.ouverture);
  if (!Number.isFinite(t) || !Number.isFinite(ouverture)) return null;
  const attaques = Array.isArray(saison.deck_recent_list)
    ? saison.deck_recent_list.filter((d: any) => Number(d?.type) === TYPE_ATTAQUE_DIMENSION)
    : [];
  return { saison, ouverture, t, attaques };
}
