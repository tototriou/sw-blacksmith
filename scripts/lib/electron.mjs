// Lancer Electron depuis un script.
//
// ⚠️ **L'environnement hérité est nettoyé** (environnementElectron.mjs) : un
// terminal de VS Code transmet `ELECTRON_RUN_AS_NODE`, et, quand VS Code est
// installé en snap sous Linux, les variables GIO, GSettings et GTK du snap.
// Les unes comme les autres empêchent la fenêtre de s'ouvrir. Tout lancement
// passe donc par ici.

import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { environnementElectron } from './environnementElectron.mjs';

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

// La même chose SANS bloquer le script : il continue de répondre pendant que
// l'app tourne (le faux service Discord de la preuve). Rend une promesse de
// `{ error }`, comme `lancerElectronEtAttendre`.
export function lancerElectronEnFond(supplement = {}, delai = 120_000, exe) {
  return new Promise((resoudre) => {
    const enfant = spawn(exe ?? executable, exe ? [] : ['.'], { stdio: 'inherit', env: environnement(supplement) });
    const minuterie = setTimeout(() => {
      enfant.kill();
      resoudre({ error: new Error(`l'app ne s'est pas fermée en ${delai / 1000} s`) });
    }, delai);
    enfant.on('exit', () => {
      clearTimeout(minuterie);
      resoudre({ error: null });
    });
    enfant.on('error', (error) => {
      clearTimeout(minuterie);
      resoudre({ error });
    });
  });
}
