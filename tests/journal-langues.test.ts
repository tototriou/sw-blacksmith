// Un journal des versions par langue — docs/02-app/nouveautes/README.md,
// « Un journal par langue ».
//
// Le journal anglais doit suivre le français entrée pour entrée : une version
// ou une ligne ajoutée d'un seul côté laisserait le joueur anglais sans elle.
// Seuls les textes changent ; la structure, elle, est identique.

import { RELEASES, journal, libelleVersion, type Release } from '../src/data/releases';
import { RELEASES_EN } from '../src/data/releases.en';
import { egal, ok, titre } from './outils';

/** La forme d'un journal, sans ses textes : ce qui doit être identique d'une langue à l'autre. */
function forme(j: Release[]) {
  return j.map((r) => ({
    version: r.version,
    date: r.date,
    tag: r.tag,
    highlights: r.highlights?.length ?? 0,
    changes: r.changes.map((c) => c.kind),
  }));
}

/** Les textes vides ou laissés en français (apostrophe typographique + mot français courant). */
function textesSuspects(j: Release[]): string[] {
  const textes = j.flatMap((r) => [r.title, ...(r.highlights ?? []), ...r.changes.flatMap((c) => [c.scope, c.text])]);
  return textes.filter((t) => !t.trim() || /\b(les|des|une|est|pour|dans|avec|sans|ton|tes)\b/i.test(t));
}

export function testJournalAligne() {
  titre('journal des versions — un journal par langue, de même forme');
  egal(forme(RELEASES_EN), forme(RELEASES), 'même versions, dates, tags, points mis en avant et changements, dans le même ordre');
  egal(textesSuspects(RELEASES_EN), [], 'aucun texte anglais vide ni resté en français');
  ok(RELEASES_EN.every((r, i) => r.title !== RELEASES[i].title), 'chaque titre est traduit');
  ok(journal('fr') === RELEASES && journal('en') === RELEASES_EN, 'journal(langue) rend le journal de la langue');
  egal([libelleVersion(null, 'In preparation'), libelleVersion('2.2.0', 'In preparation')], ['In preparation', 'v2.2.0'],
    'une version sans numéro prend le libellé de la langue ; le « v » reste porté par libelleVersion');
}
