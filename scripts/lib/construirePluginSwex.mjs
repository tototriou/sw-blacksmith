// Assemble le plugin SWEX « SW Blacksmith Live » (plugin-swex/source/) en UN
// fichier, `SWBlacksmithLive.js`, que SW Exporter charge depuis son dossier
// `plugins`. Voir docs/02-app/bureau/feat-swex-direct.md.
//
// ⚠️ La version du plugin EST celle de l'app (`package.json`), injectée ici :
// l'app de bureau compare la version installée à la sienne pour proposer la
// mise à jour. CommonJS (SWEX fait un `require`), sans dépendance externe.
//
// Deux usages : `texteDuPluginSwex` (en mémoire) pour Vite, qui l'émet dans
// `dist/plugin-swex/` et le sert en développement (vite.config.ts) ;
// `construirePluginSwex` (sur le disque) pour scripts/construire-plugin-swex.mjs
// et les tests (tests/plugin-swex.test.ts).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

export const NOM_PLUGIN = 'SWBlacksmithLive.js';
// L'adresse du fichier sur le site (et dans l'app de bureau, qui sert `dist`).
export const CHEMIN_PLUGIN = `plugin-swex/${NOM_PLUGIN}`;

// ⚠️ `entryPoints` est écrit DANS chaque appel à `build` : c'est là que la
// sélection des tests (tests/selection.ts) le lit, pour relier le plugin aux
// tests qui le construisent.
function options(version) {
  return {
    bundle: true,
    platform: 'node',
    format: 'cjs',
    // SWEX embarque son propre Electron, parfois ancien : une cible prudente.
    target: 'node16',
    define: { __VERSION_PLUGIN__: JSON.stringify(version) },
    banner: { js: `// SW Blacksmith Live ${version} — plugin SW Exporter. Source : plugin-swex/ du dépôt SW Blacksmith.` },
    logLevel: 'warning',
  };
}

const versionApp = () => JSON.parse(readFileSync('package.json', 'utf8')).version;

export async function texteDuPluginSwex() {
  const version = versionApp();
  const r = await build({ ...options(version), entryPoints: ['plugin-swex/source/plugin.ts'], write: false, outfile: NOM_PLUGIN });
  return { texte: r.outputFiles[0].text, version };
}

export async function construirePluginSwex(dossier = 'dist/plugin-swex') {
  const version = versionApp();
  const sortie = join(dossier, NOM_PLUGIN);
  await build({ ...options(version), entryPoints: ['plugin-swex/source/plugin.ts'], outfile: sortie });
  return { sortie, version };
}
