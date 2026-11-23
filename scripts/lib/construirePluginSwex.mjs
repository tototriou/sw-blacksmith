// Assemble le plugin SWEX « SW Blacksmith Live » (plugin-swex/source/) en UN
// fichier, `SWBlacksmithLive.js`, que SW Exporter charge depuis son dossier
// `plugins`. Voir docs/02-app/bureau/feat-swex-direct.md.
//
// ⚠️ La version du plugin EST celle de l'app (`package.json`), injectée ici.
// CommonJS (SWEX fait un `require`), sans dépendance externe.
//
// ⚠️ **La bannière porte aussi l'empreinte du CODE** (`code …`) : celle du
// plugin construit avec un numéro neutre. Deux versions de l'app qui ne
// changent pas le plugin donnent la même empreinte, et l'app de bureau ne
// demande de le remplacer que si elle diffère (bureau/swexPur.ts,
// `statutPlugin`).
//
// Deux usages : `texteDuPluginSwex` (en mémoire) pour Vite, qui l'émet dans
// `dist/plugin-swex/` et le sert en développement (vite.config.ts) ;
// `construirePluginSwex` (sur le disque) pour scripts/construire-plugin-swex.mjs
// et les tests (tests/plugin-swex.test.ts).

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

export const NOM_PLUGIN = 'SWBlacksmithLive.js';
// L'adresse du fichier sur le site (et dans l'app de bureau, qui sert `dist`).
export const CHEMIN_PLUGIN = `plugin-swex/${NOM_PLUGIN}`;

// Le numéro du plugin dont on prend l'empreinte : n'importe lequel, pourvu
// qu'il ne change jamais.
const VERSION_NEUTRE = '0.0.0';

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
    logLevel: 'warning',
    write: false,
    outfile: NOM_PLUGIN,
  };
}

// Fins de ligne ramenées à `\n` : le site (Linux) et l'installeur Windows
// construisent le même plugin, et doivent lui donner la même empreinte.
const empreinte = (texte) => createHash('sha256').update(texte.replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);

export const banniere = (version, code) =>
  `// SW Blacksmith Live ${version} · code ${code} — plugin SW Exporter. Source : plugin-swex/ du dépôt SW Blacksmith.\n`;

const versionApp = () => JSON.parse(readFileSync('package.json', 'utf8')).version;

// `version` : celle de l’app par défaut ; une autre, pour vérifier que
// l’empreinte ne dépend pas du numéro (tests/bureau-swex-direct.test.ts).
export async function texteDuPluginSwex(version = versionApp()) {
  const neutre = await build({ ...options(VERSION_NEUTRE), entryPoints: ['plugin-swex/source/plugin.ts'] });
  const r = await build({ ...options(version), entryPoints: ['plugin-swex/source/plugin.ts'] });
  const code = empreinte(neutre.outputFiles[0].text);
  return { texte: banniere(version, code) + r.outputFiles[0].text, version, code };
}

export async function construirePluginSwex(dossier = 'dist/plugin-swex') {
  const { texte, version, code } = await texteDuPluginSwex();
  const sortie = join(dossier, NOM_PLUGIN);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(sortie, texte);
  return { sortie, version, code };
}
