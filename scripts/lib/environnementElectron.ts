// L'environnement donné à Electron quand un script le lance
// (scripts/lib/electron.mjs). Pur, testé (tests/bureau-lancement.test.ts) ;
// chargé par `node` sans compilation : syntaxe TypeScript effaçable seulement.
//
// Deux héritages du terminal de VS Code empêchent la fenêtre de s'ouvrir :
//
// - ⚠️ **`ELECTRON_RUN_AS_NODE`** : VS Code, lui-même une app Electron, la pose
//   à 1. Héritée, elle fait démarrer Electron comme un simple Node :
//   `require('electron')` rend un chemin au lieu de l'API (« Cannot read
//   properties of undefined (reading 'registerSchemesAsPrivileged') »).
// - ⚠️ **Les variables d'un VS Code installé en snap** (Linux) : le snap fait
//   pointer GIO, GSettings et GTK vers ses propres modules et schémas, plus
//   anciens que ceux du système. Electron les lit et plante à la création de
//   la fenêtre, en SIGSEGV, sans autre message que « Schema
//   org.gnome.desktop.interface does not have key font-antialiasing ».
//   Retirer `GIO_MODULE_DIR`, `GSETTINGS_SCHEMA_DIR` et rendre `XDG_DATA_DIRS`
//   suffit, mais seulement les trois ensemble ; le reste du jeu pointe aussi
//   dans le snap et part avec. VS Code garde la valeur d'origine de certaines
//   dans `<NOM>_VSCODE_SNAP_ORIG` (vide : absente à l'origine) : elle est
//   rendue. Les autres n'ont pas d'origine : retirées, elles reprennent le
//   défaut du système.

// Les variables du snap qui désignent ses bibliothèques. Retirées seulement
// quand leur valeur pointe dans un snap (`/snap/`, ou `~/snap/`) : une valeur
// posée à la main pour le système reste.
export const VARIABLES_DU_SNAP = [
  'GIO_MODULE_DIR', 'GSETTINGS_SCHEMA_DIR', 'GTK_PATH', 'GTK_EXE_PREFIX', 'GTK_IM_MODULE_FILE',
  'GDK_PIXBUF_MODULE_FILE', 'GDK_PIXBUF_MODULEDIR', 'LOCPATH',
] as const;

export const SUFFIXE_ORIGINE_SNAP = '_VSCODE_SNAP_ORIG';

type Environnement = Record<string, string | undefined>;

// L'environnement hérité, nettoyé, puis complété par `supplement` (qui
// l'emporte). L'objet reçu n'est pas modifié.
export function environnementElectron(herite: Environnement, supplement: Environnement = {}): Environnement {
  const env: Environnement = { ...herite };
  delete env.ELECTRON_RUN_AS_NODE;

  for (const cle of Object.keys(env)) {
    if (!cle.endsWith(SUFFIXE_ORIGINE_SNAP)) continue;
    const nom = cle.slice(0, -SUFFIXE_ORIGINE_SNAP.length);
    const origine = env[cle];
    delete env[cle];
    if (origine) env[nom] = origine;
    else delete env[nom];
  }

  for (const nom of VARIABLES_DU_SNAP) {
    if (env[nom]?.includes('/snap/')) delete env[nom];
  }

  return { ...env, ...supplement };
}
