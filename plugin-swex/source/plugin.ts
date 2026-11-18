// Le plugin SWEX « SW Blacksmith Live » : ce que SW Exporter charge depuis son
// dossier `plugins`. Assemblé par scripts/construire-plugin-swex.mjs en un
// seul fichier, `SWBlacksmithLive.js`, dont la version est celle de l'app.
//
// SWEX donne au plugin chaque échange avec le jeu (`apiCommand`). À la
// connexion, le plugin repart de la réponse du serveur (l'export de
// ProfileExport) ; ensuite, chaque commande qui change le compte ou un combat
// de guilde fait réécrire, après un temps calme, `compte.json` et
// `guilde.json` dans `SWBlacksmith/<nom>-<id>/`, que l'application de bureau
// suit. Voir docs/02-app/bureau/feat-swex-direct.md.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appliquer, depuisConnexion, versExport, type EtatDirect, type Json } from './etatDirect';
import { appliquerGuilde, depuisFichierGuilde, versFichierGuilde, type EtatGuilde } from './guilde';
import { FICHIER_COMPTE, FICHIER_GUILDE, dossierInvocateur, ecrireAtomique, nomDeBase } from './fichiers';

declare const __VERSION_PLUGIN__: string;
export const VERSION = typeof __VERSION_PLUGIN__ === 'string' ? __VERSION_PLUGIN__ : 'dev';

export const pluginName = 'SWBlacksmithLive';
export const pluginDescription =
  `SW Blacksmith ${VERSION} — keeps your account (runes, grindstones, gems, monsters) and guild battles up to date ` +
  'for the SW Blacksmith app while you play. / Tient ton compte et tes combats de guilde à jour pour SW Blacksmith pendant la partie.';
export const defaultConfig = { enabled: true, guilde: true };
export const defaultConfigDetails = {
  guilde: { label: 'Guild battles (siege, guild war, labyrinth) / Combats de guilde (siège, guerre, labyrinthe)' },
};

// ⚠️ Écriture TEMPORISÉE : le fichier n'est réécrit qu'après ce délai sans
// nouveau changement. Une série de meules ne réécrit pas 8 Mo à chaque coup.
export const DELAI_ECRITURE = 2000;

interface Proxy {
  on(evenement: 'apiCommand', ecouteur: (req: Json, res: Json) => void): void;
  log(entree: { type: string; source: string; name: string; message: string }): void;
}
interface ConfigSwex {
  Config: { App: { filesPath: string }; Plugins: Record<string, { enabled?: boolean; guilde?: boolean } | undefined> };
}

// Un invocateur suivi : son compte, ses combats de guilde, et l'écriture en
// attente de chacun.
type Quoi = 'compte' | 'guilde';
interface Suivi {
  base: string;
  dossier: string; // SWBlacksmith/<nom>-<id>, dans le dossier de SWEX

  compte: EtatDirect;
  guilde: EtatGuilde;
  minuteries: Partial<Record<Quoi, ReturnType<typeof setTimeout>>>;
  // ⚠️ Une écriture À LA FOIS par fichier : deux écritures qui se
  // chevauchent partagent le fichier temporaire, et la seconde ne le trouve
  // plus à renommer. Demandée pendant une écriture, la suivante attend sa fin
  // et écrit l'état le plus récent.
  enCours: Partial<Record<Quoi, boolean>>;
  aRefaire: Partial<Record<Quoi, boolean>>;
}

// Le plugin, avec son délai d'écriture : 0 dans les tests.
export function creerPlugin(delai = DELAI_ECRITURE) {
  return function init(proxy: Proxy, config: ConfigSwex) {
    const suivis = new Map<number, Suivi>();
    const journal = (type: 'info' | 'error', message: string) =>
      proxy.log({ type, source: 'plugin', name: pluginName, message });
    const reglage = () => config.Config.Plugins[pluginName] ?? {};
    const dossier = () => config.Config.App.filesPath;

    const lancer = (s: Suivi, quoi: Quoi) => {
      if (s.enCours[quoi]) {
        s.aRefaire[quoi] = true;
        return;
      }
      s.enCours[quoi] = true;
      const fichier = quoi === 'compte' ? FICHIER_COMPTE : FICHIER_GUILDE;
      const nom = `${s.base}/${fichier}`;
      const contenu = quoi === 'compte' ? versExport(s.compte) : versFichierGuilde(s.guilde);
      ecrireAtomique(join(s.dossier, fichier), JSON.stringify(contenu))
        .then(
          () => journal('info', `${nom} mis à jour`),
          (e: Error) => journal('error', `${nom} : ${e.message}`)
        )
        .finally(() => {
          s.enCours[quoi] = false;
          if (s.aRefaire[quoi]) {
            s.aRefaire[quoi] = false;
            lancer(s, quoi);
          }
        });
    };
    const ecrire = (s: Suivi, quoi: Quoi) => {
      const m = s.minuteries[quoi];
      if (m) clearTimeout(m);
      s.minuteries[quoi] = setTimeout(() => {
        s.minuteries[quoi] = undefined;
        lancer(s, quoi);
      }, delai);
    };

    proxy.on('apiCommand', (req, res) => {
      try {
        if (!reglage().enabled) return;
        const commande = String(req?.command ?? res?.command ?? '');
        if (!res || Number(res.ret_code) !== 0) return;

        if (commande === 'HubUserLogin') {
          const id = Number(res.wizard_info?.wizard_id);
          if (!Number.isFinite(id)) return;
          const base = nomDeBase(dossier(), id, String(res.wizard_info?.wizard_name ?? ''));
          const dossierSuivi = dossierInvocateur(dossier(), id, base);
          // Les combats de guilde déjà écrits sont repris : l'historique
          // survit au redémarrage de SWEX.
          let fichierGuilde: unknown = null;
          try {
            fichierGuilde = JSON.parse(readFileSync(join(dossierSuivi, FICHIER_GUILDE), 'utf8'));
          } catch {
            /* pas encore de fichier, ou illisible : on repart de zéro */
          }
          const ancien = suivis.get(id);
          for (const m of Object.values(ancien?.minuteries ?? {})) if (m) clearTimeout(m);
          suivis.set(id, {
            base,
            dossier: dossierSuivi,
            compte: depuisConnexion(res),
            guilde: depuisFichierGuilde(fichierGuilde, id),
            minuteries: {},
            enCours: {},
            aRefaire: {},
          });
          journal('info', `suivi de ${base}`);
          return;
        }

        const s = suivis.get(Number(req?.wizard_id));
        if (!s) return; // pas de connexion vue depuis le lancement de SWEX
        if (appliquer(s.compte, commande, req, res)) ecrire(s, 'compte');
        if (reglage().guilde !== false && appliquerGuilde(s.guilde, commande, req, res)) ecrire(s, 'guilde');
      } catch (e) {
        // ⚠️ Jamais d'exception vers SWEX : une commande que le plugin ne
        // comprend pas ne doit pas gêner les autres plugins ni le jeu.
        journal('error', (e as Error).message);
      }
    });
  };
}

export const init = creerPlugin();
