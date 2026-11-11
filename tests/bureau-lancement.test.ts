// L'environnement donné à Electron par les scripts de lancement
// (scripts/lib/environnementElectron.mjs, scripts/lib/electron.mjs,
// scripts/generer-icone-bureau.mjs).
//
// ⚠️ Une variable héritée du terminal de VS Code qui passerait empêcherait la
// fenêtre de s'ouvrir : `ELECTRON_RUN_AS_NODE` fait démarrer Electron comme un
// simple Node ; les variables GIO, GSettings et GTK d'un VS Code en snap le
// font planter à la création de la fenêtre (SIGSEGV). Le lancement réel n'est
// exercé que par `npm run bureau` lui-même.

import { readFileSync } from 'node:fs';
import { SUFFIXE_ORIGINE_SNAP, VARIABLES_DU_SNAP, environnementElectron } from '../scripts/lib/environnementElectron.mjs';
import { egal, ok, titre } from './outils';

const sansCommentaires = (source: string) =>
  source.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// Le terminal d'un VS Code installé en snap (Ubuntu 24.04, VS Code 2026),
// relevé tel quel au dossier personnel près.
const XDG_DATA_DIRS_SYSTEME = '/usr/share/ubuntu:/usr/share/gnome:/usr/local/share/:/usr/share/:/var/lib/snapd/desktop';
const TERMINAL_VSCODE_SNAP: Record<string, string> = {
  HOME: '/home/moi',
  PATH: '/usr/local/bin:/usr/bin:/bin',
  DISPLAY: ':0',
  WAYLAND_DISPLAY: 'wayland-0',
  XDG_SESSION_TYPE: 'wayland',
  ELECTRON_RUN_AS_NODE: '1',
  SNAP: '/snap/code/274',
  SNAP_NAME: 'code',
  GTK_MODULES: 'gail:atk-bridge',
  XDG_DATA_DIRS: `/home/moi/snap/code/274/.local/share:/home/moi/snap/code/274:/snap/code/274/usr/share:${XDG_DATA_DIRS_SYSTEME}`,
  XDG_DATA_DIRS_VSCODE_SNAP_ORIG: XDG_DATA_DIRS_SYSTEME,
  XDG_CONFIG_DIRS: '/etc/xdg/xdg-ubuntu:/etc/xdg',
  XDG_CONFIG_DIRS_VSCODE_SNAP_ORIG: '/etc/xdg/xdg-ubuntu:/etc/xdg',
  GIO_MODULE_DIR: '/home/moi/snap/code/common/.cache/gio-modules',
  GSETTINGS_SCHEMA_DIR: '/home/moi/snap/code/274/.local/share/glib-2.0/schemas',
  GTK_PATH: '/snap/code/274/usr/lib/x86_64-linux-gnu/gtk-3.0',
  GTK_EXE_PREFIX: '/snap/code/274/usr',
  GTK_IM_MODULE_FILE: '/home/moi/snap/code/common/.cache/immodules/immodules.cache',
  GDK_PIXBUF_MODULE_FILE: '/home/moi/snap/code/common/.cache/gdk-pixbuf-loaders.cache',
  GDK_PIXBUF_MODULEDIR: '/snap/code/274/usr/lib/x86_64-linux-gnu/gdk-pixbuf-2.0/2.10.0/loaders',
  LOCPATH: '/snap/code/274/usr/lib/locale',
};

export default function testBureauLancement() {
  titre('bureau · lancement — le terminal d’un VS Code en snap');
  const herite = { ...TERMINAL_VSCODE_SNAP };
  const env = environnementElectron(herite, { SWBLACKSMITH_DEV_URL: 'http://localhost:5173/' });
  egal(env.ELECTRON_RUN_AS_NODE, undefined, 'ELECTRON_RUN_AS_NODE retirée');
  for (const nom of ['GIO_MODULE_DIR', 'GSETTINGS_SCHEMA_DIR', 'GTK_PATH', 'GTK_EXE_PREFIX', 'GTK_IM_MODULE_FILE',
    'GDK_PIXBUF_MODULE_FILE', 'GDK_PIXBUF_MODULEDIR', 'LOCPATH']) {
    egal(env[nom], undefined, `${nom} du snap retirée`);
  }
  egal(env.XDG_DATA_DIRS, XDG_DATA_DIRS_SYSTEME, 'XDG_DATA_DIRS rendue à sa valeur d’origine (sans les dossiers du snap)');
  egal(env.XDG_CONFIG_DIRS, '/etc/xdg/xdg-ubuntu:/etc/xdg', 'XDG_CONFIG_DIRS rendue à sa valeur d’origine');
  egal(Object.keys(env).filter((k) => k.endsWith(SUFFIXE_ORIGINE_SNAP)), [], 'aucune `…_VSCODE_SNAP_ORIG` transmise');
  egal([env.HOME, env.PATH, env.DISPLAY, env.WAYLAND_DISPLAY, env.XDG_SESSION_TYPE, env.GTK_MODULES],
    ['/home/moi', '/usr/local/bin:/usr/bin:/bin', ':0', 'wayland-0', 'wayland', 'gail:atk-bridge'],
    'le reste passe tel quel : dossier, PATH, affichage (Wayland reste Wayland), modules GTK sans chemin');
  egal(env.SWBLACKSMITH_DEV_URL, 'http://localhost:5173/', 'le supplément du script est ajouté');
  egal(herite, TERMINAL_VSCODE_SNAP, 'l’environnement reçu n’est pas modifié');
  egal([...VARIABLES_DU_SNAP].sort(), ['GDK_PIXBUF_MODULEDIR', 'GDK_PIXBUF_MODULE_FILE', 'GIO_MODULE_DIR', 'GSETTINGS_SCHEMA_DIR',
    'GTK_EXE_PREFIX', 'GTK_IM_MODULE_FILE', 'GTK_PATH', 'LOCPATH'],
  'la liste des variables du snap : les trois qui font planter (GIO, GSettings ; XDG_DATA_DIRS par son origine) et leurs voisines');

  titre('bureau · lancement — les valeurs d’origine');
  const origineVide = environnementElectron({ XDG_DATA_HOME: '/home/moi/snap/code/274/.local/share', XDG_DATA_HOME_VSCODE_SNAP_ORIG: '' });
  ok(!('XDG_DATA_HOME' in origineVide), 'origine vide (variable absente avant VS Code) : la variable est retirée');
  const origineSysteme = environnementElectron({ GTK_PATH: '/snap/code/274/usr/lib/x86_64-linux-gnu/gtk-3.0', GTK_PATH_VSCODE_SNAP_ORIG: '/opt/gtk' });
  egal(origineSysteme.GTK_PATH, '/opt/gtk', 'origine posée hors du snap : rendue, et gardée');

  titre('bureau · lancement — un terminal ordinaire');
  const ordinaire = { HOME: '/home/moi', PATH: '/usr/bin', GTK_PATH: '/usr/lib/gtk-perso', LOCPATH: '/usr/lib/locale', ELECTRON_RUN_AS_NODE: '1' };
  egal(environnementElectron(ordinaire), { HOME: '/home/moi', PATH: '/usr/bin', GTK_PATH: '/usr/lib/gtk-perso', LOCPATH: '/usr/lib/locale' },
    'sans snap : seule ELECTRON_RUN_AS_NODE part ; une variable GTK posée pour le système reste');
  const windows = { USERPROFILE: 'C:\\Users\\moi', Path: 'C:\\Windows\\System32', ELECTRON_RUN_AS_NODE: '1' };
  egal(environnementElectron(windows), { USERPROFILE: 'C:\\Users\\moi', Path: 'C:\\Windows\\System32' }, 'Windows : seule ELECTRON_RUN_AS_NODE part');
  egal(environnementElectron({ ELECTRON_RUN_AS_NODE: '1' }, { ELECTRON_RUN_AS_NODE: '1' }).ELECTRON_RUN_AS_NODE, '1',
    'le supplément l’emporte sur le nettoyage (aucun script ne s’en sert pour la remettre)');

  titre('bureau · lancement — tout lancement passe par la règle, contrôlé sur la source');
  const lanceur = sansCommentaires(readFileSync('scripts/lib/electron.mjs', 'utf8'));
  ok(/import \{ environnementElectron \} from '\.\/environnementElectron\.mjs';/.test(lanceur),
    'electron.mjs importe la règle, en JavaScript : chargée par tout Node, sans compilation ni option');
  ok(/const environnement = \(supplement\) => environnementElectron\(process\.env, supplement\);/.test(lanceur),
    'electron.mjs : l’environnement est celui du processus, nettoyé');
  const lancements = (lanceur.match(/\bspawn(Sync)?\(/g) ?? []).length;
  ok(lancements >= 3 && (lanceur.match(/env: environnement\(supplement\)/g) ?? []).length === lancements,
    'electron.mjs : chaque lancement (`lancerElectron`, `lancerElectronEtAttendre`, `lancerElectronEnFond`) se fait avec lui');
  const icone = sansCommentaires(readFileSync('scripts/generer-icone-bureau.mjs', 'utf8'));
  ok(/import \{ environnementElectron \} from '\.\/lib\/environnementElectron\.mjs';/.test(icone)
    && /const env = environnementElectron\(process\.env\);/.test(icone) && /spawnSync\(electron, \[[^\]]*\], \{ stdio: 'inherit', env \}\)/.test(icone),
    'generer-icone-bureau.mjs : relancé dans Electron avec le même nettoyage');
}
