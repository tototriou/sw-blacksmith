// Les fichiers de guilde du plugin SWEX, sur le disque — ce que bureau/swex.ts
// en lit pour la page Siège › Statistiques (docs/02-app/siege/statistiques.md).
// Sans Electron : tests/bureau-swex-guilde.test.ts le lance sur un dossier
// temporaire.
//
// Deux fichiers par invocateur (plugin-swex/source/fichiers.ts) : l'ARCHIVE
// (`guilde.jsonl.gz`, une session finie par bloc gzip, ajoutée à chaque
// connexion) et la session en cours (`guilde.live.jsonl`). Seuls les
// événements de siège sont posés (`estEvenementSiege`), dans l'ordre : archive,
// puis session en cours.
//
// ⚠️ **Rien ne se relit deux fois.** L'archive grossit de plusieurs Mo par
// siège, une session en cours peut en peser des dizaines : relire le tout à
// chaque ligne ajoutée serait trop lent.
//  - L'archive se lit bloc par bloc : un bloc ne change plus une fois écrit,
//    l'accumulateur des blocs déjà lus est gardé (`CacheGuilde.accu`), seuls
//    les blocs ajoutés depuis sont posés.
//  - La session en cours se lit comme le compte live (`lireLive`) : seules les
//    lignes ajoutées, posées sur un accumulateur à elle (`CacheGuilde.live`),
//    parti d'une COPIE de celui de l'archive. Elle repart de zéro quand le
//    fichier est réécrit (nouvelle connexion) ou que l'archive a changé.

import { promises } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parcourirArchive } from '../plugin-swex/source/archive';
import { GUILDE_ARCHIVE, GUILDE_LIVE } from '../plugin-swex/source/fichiers';
import { parcourirLignesGuilde } from '../plugin-swex/source/guilde';
import { accuSieges, AccuSieges, estEvenementSiege, finaliserSieges, poserSiege, RelevesSiege } from '../src/lib/siegeStatistiques';
import { dossierDuPlugin, lireLive, LectureLive } from './swexLive';

export interface CacheGuilde {
  chemin: string;
  moi: number;
  // Les blocs déjà posés, par empreinte, dans l'ordre de l'archive.
  blocs: string[];
  accu: AccuSieges;
  // La session en cours : où en est sa lecture, et l'accumulateur
  // archive + session.
  live: { lecture: LectureLive; suite: { sienne: boolean }; accu: AccuSieges } | null;
}

// Pose des lignes JSON Lines, événements de siège seulement.
function poserLignes(accu: AccuSieges, lignes: Iterable<string>, suite?: { sienne: boolean }) {
  parcourirLignesGuilde(
    lignes,
    accu.moi,
    (ev) => {
      if (estEvenementSiege(ev)) poserSiege(accu, ev);
    },
    suite
  );
}

// L'accumulateur de l'archive : repris du cache si ses blocs en sont le début,
// sinon relu depuis le premier bloc. Un bloc illisible est sauté. `change` :
// un bloc a été posé (l'accumulateur n'est plus celui de la dernière fois).
async function lireArchive(chemin: string, moi: number, cache: CacheGuilde | null) {
  const { blocs } = await parcourirArchive(chemin);
  const empreintes = blocs.map((b) => b.empreinte);
  const reprise = cache && cache.chemin === chemin && cache.moi === moi && cache.blocs.every((e, i) => empreintes[i] === e);
  const accu = reprise ? cache.accu : accuSieges(moi);
  const deja = reprise ? cache.blocs.length : 0;
  if (deja < blocs.length) {
    const fichier = await promises.open(chemin, 'r');
    try {
      for (const b of blocs.slice(deja)) {
        const octets = Buffer.alloc(b.taille);
        await fichier.read(octets, 0, b.taille, b.position);
        try {
          poserLignes(accu, gunzipSync(octets).toString('utf8').split('\n'));
        } catch {
          /* bloc abîmé : les autres valent */
        }
      }
    } finally {
      await fichier.close();
    }
  }
  return { blocs: empreintes, accu, change: !reprise || deja < blocs.length };
}

// Les sièges de l'invocateur `id`, ou `null` sans dossier du plugin pour lui.
// Rend aussi le cache à donner à l'appel suivant.
export async function lireSieges(
  dossierSwex: string,
  id: string,
  cache: CacheGuilde | null
): Promise<{ releves: RelevesSiege; cache: CacheGuilde } | null> {
  const dossier = await dossierDuPlugin(dossierSwex, id);
  const moi = Number(id);
  if (!dossier || !Number.isFinite(moi)) return null;
  const chemin = join(dossier, GUILDE_ARCHIVE);
  const archive = await lireArchive(chemin, moi, cache);

  // La session en cours : la suite de la dernière lecture si rien n'a changé
  // en amont, sinon tout le fichier, sur une copie de l'archive.
  let live = !archive.change && cache?.live ? cache.live : null;
  try {
    const r = await lireLive(join(dossier, GUILDE_LIVE), live?.lecture ?? null);
    if (r.debut || !live) live = { lecture: r.lecture, suite: { sienne: false }, accu: structuredClone(archive.accu) };
    else live = { ...live, lecture: r.lecture };
    poserLignes(live.accu, r.lignes, live.suite);
  } catch {
    live = null; // pas de session en cours (guilde désactivée), ou fichier réécrit à l'instant
  }
  const releves = finaliserSieges(live?.accu ?? archive.accu);
  return { releves, cache: { chemin, moi, blocs: archive.blocs, accu: archive.accu, live } };
}
