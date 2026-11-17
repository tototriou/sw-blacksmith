// Assemble le plugin SWEX « SW Blacksmith Live » (plugin-swex/source/) en UN
// fichier, `SWBlacksmithLive.js`, que SW Exporter charge depuis son dossier
// `plugins`. Voir docs/02-app/bureau/feat-swex-direct.md.
//
// ⚠️ La version du plugin EST celle de l'app (`package.json`), injectée ici :
// l'app de bureau compare la version installée à la sienne pour proposer la
// mise à jour. CommonJS (SWEX fait un `require`), sans dépendance externe.
// Lancé par scripts/construire-plugin-swex.mjs ; testé par
// tests/plugin-swex.test.ts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

export const NOM_PLUGIN = 'SWBlacksmithLive.js';

export async function construirePluginSwex(dossier = 'dist/plugin-swex') {
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const sortie = join(dossier, NOM_PLUGIN);
  await build({
    entryPoints: ['plugin-swex/source/plugin.ts'],
    outfile: sortie,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    // SWEX embarque son propre Electron, parfois ancien : une cible prudente.
    target: 'node16',
    define: { __VERSION_PLUGIN__: JSON.stringify(version) },
    banner: { js: `// SW Blacksmith Live ${version} — plugin SW Exporter. Source : plugin-swex/ du dépôt SW Blacksmith.` },
    logLevel: 'warning',
  });
  return { sortie, version };
}
