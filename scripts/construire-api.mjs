// Empaquette le service (`api/_source/*.ts`) en un fichier par point d'entrée,
// dans le dossier api/_paquet, ignoré par Git, que chaque fonction `api/*.mjs`
// charge.
//
// ⚠️ Vercel compile chaque fichier de `api/` séparément : dans un projet ESM,
// un import relatif sans extension — ceux de tout `src/` — échoue à
// l'exécution (`ERR_MODULE_NOT_FOUND`). Empaqueté par esbuild (déjà utilisé
// par le bureau et `tests/run.mjs`), le service réutilise `src/lib/` tel quel.
// Les dossiers en `_` ne deviennent pas des fonctions. Lancé par `npm run
// build`, donc par Vercel avant la préparation des fonctions.

import { readdirSync } from 'node:fs';
import { build } from 'esbuild';

const entrees = Object.fromEntries(readdirSync('api/_source')
  .filter((f) => f.endsWith('.ts'))
  .map((f) => [f.replace(/\.ts$/, ''), `api/_source/${f}`]));

await build({
  entryPoints: entrees,
  outdir: 'api/_paquet',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  logLevel: 'warning',
});
console.log(`api : ${Object.keys(entrees).map((e) => `api/_paquet/${e}.mjs`).join(', ')}`);
