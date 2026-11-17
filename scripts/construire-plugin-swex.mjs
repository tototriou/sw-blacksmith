// Construit le plugin SWEX « SW Blacksmith Live » (scripts/lib/construirePluginSwex.mjs).
//
// Lancé par `npm run build` après Vite : le fichier va dans
// `dist/plugin-swex/`, que le site sert et que l'app de bureau embarque.
// `node scripts/construire-plugin-swex.mjs <dossier>` l'écrit ailleurs.

import { construirePluginSwex } from './lib/construirePluginSwex.mjs';

const { sortie, version } = await construirePluginSwex(process.argv[2]);
console.log(`plugin SWEX ${version} : ${sortie}`);
