// Lancer Electron depuis un script.
//
// ⚠️ **L'environnement hérité est nettoyé** (environnementElectron.ts) : un
// terminal de VS Code transmet `ELECTRON_RUN_AS_NODE`, et, quand VS Code est
// installé en snap sous Linux, les variables GIO, GSettings et GTK du snap.
// Les unes comme les autres empêchent la fenêtre de s'ouvrir. Tout lancement
// passe donc par ici.

import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { environnementElectron } from './environnementElectron.ts';

const executable = createRequire(import.meta.url)('electron');

const environnement = (supplement) => environnementElectron(process.env, supplement);

// Lance l'app (`electron .`) et rend le processus.
export function lancerElectron(supplement = {}) {
  return spawn(executable, ['.'], { stdio: 'inherit', env: environnement(supplement) });
}

// Lance l'app et attend sa fin. `exe` : une app INSTALLÉE, lancée
// telle quelle — elle aussi est un Electron, le nettoyage la concerne aussi.
export function lancerElectronEtAttendre(supplement = {}, delai = 120_000, exe) {
  return spawnSync(exe ?? executable, exe ? [] : ['.'], { stdio: 'inherit', env: environnement(supplement), timeout: delai });
}
