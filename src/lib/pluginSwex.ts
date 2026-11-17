// Le plugin SWEX « SW Blacksmith Live », vu de l'app : où le télécharger, et
// où sont ceux qui le complètent. Le plugin lui-même vit dans plugin-swex/
// (docs/02-app/bureau/feat-swex-direct.md).
//
// ⚠️ Le fichier est émis par Vite à cette adresse (vite.config.ts, d'après
// `CHEMIN_PLUGIN` de scripts/lib/construirePluginSwex.mjs) : un test vérifie
// que les deux concordent.

export const FICHIER_PLUGIN_SWEX = 'SWBlacksmithLive.js';
export const CHEMIN_PLUGIN_SWEX = `plugin-swex/${FICHIER_PLUGIN_SWEX}`;

// L'adresse du fichier, sur le site comme dans l'app de bureau (qui sert le
// même `dist`).
export const adressePluginSwex = () => `${import.meta.env.BASE_URL}${CHEMIN_PLUGIN_SWEX}`;

// SW Exporter, l'outil de la communauté qui lit le compte depuis le jeu.
export const SW_EXPORTER = 'https://github.com/Xzandro/sw-exporter/releases';
