// Construit le plugin SWEX « SW Blacksmith Live » (scripts/lib/construirePluginSwex.mjs).
//
// `npm run build` l’émet déjà (vite.config.ts) ; ce script le construit seul,
// dans `dist/plugin-swex/` (`npm run plugin-swex`).
// `node scripts/construire-plugin-swex.mjs <dossier>` l'écrit ailleurs.

import { construirePluginSwex } from './lib/construirePluginSwex.mjs';

const { sortie, version } = await construirePluginSwex(process.argv[2]);
console.log(`plugin SWEX ${version} : ${sortie}`);
