// Le plugin SWEX « SW Blacksmith Live » : ce que SW Exporter charge depuis son
// dossier `plugins`. Assemblé par scripts/construire-plugin-swex.mjs en un
// seul fichier, `SWBlacksmithLive.js`, dont la version est celle de l'app.
//
// SWEX donne au plugin chaque échange avec le jeu (`apiCommand`). Dans
// `SWBlacksmith/<nom>-<id>/`, que l'application de bureau suit :
//  - à la connexion, l'état allégé du compte s'ajoute à l'archive
//    (`compte.jsonl.gz`), et le fichier live (`compte.live.jsonl`) repart de la
//    réponse du serveur (l'export de ProfileExport) ;
//  - chaque commande qui change le compte y ajoute aussitôt une ligne ;
//  - chaque commande qui change un contenu de guilde fait réécrire, après un
//    temps calme, `guilde.json`.
// Voir docs/02-app/bureau/feat-swex-direct.md.

import { existsSync, promises, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ajouterAuFichier, empreinteDe, type Bloc } from './archive';
import { appliquer, depuisConnexion, ligneConnexion, versEtatArchive, type EtatDirect, type Json } from './etatDirect';
import { appliquerGuilde, depuisFichierGuilde, versFichierGuilde, type EtatGuilde } from './guilde';
import { COMPTE_ARCHIVE, COMPTE_LIVE, FICHIER_GUILDE, dossierInvocateur, ecrireAtomique, nomDeBase } from './fichiers';

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

// Le fichier de guilde est réécrit en entier : seulement après ce délai sans
// nouveau changement. (Le compte, lui, s'écrit ligne à ligne, aussitôt.)
export const DELAI_ECRITURE = 2000;

interface Proxy {
  on(evenement: 'apiCommand', ecouteur: (req: Json, res: Json) => void): void;
  log(entree: { type: string; source: string; name: string; message: string }): void;
}
interface ConfigSwex {
  Config: { App: { filesPath: string }; Plugins: Record<string, { enabled?: boolean; guilde?: boolean } | undefined> };
}

// Un invocateur suivi : son compte, ses combats de guilde, et l'écriture en
// attente du fichier de guilde.
interface Suivi {
  base: string;
  dossier: string; // SWBlacksmith/<nom>-<id>, dans le dossier de SWEX
  compte: EtatDirect;
  guilde: EtatGuilde;
  minuterie?: ReturnType<typeof setTimeout>;
  // ⚠️ Une écriture du fichier de guilde À LA FOIS : deux écritures qui se
  // chevauchent partagent le fichier temporaire, et la seconde ne le trouve
  // plus à renommer. Demandée pendant une écriture, la suivante attend sa fin
  // et écrit l'état le plus récent.
  enCours?: boolean;
  aRefaire?: boolean;
}

// Ce qui s'archive du compte à une connexion : l'état allégé, et son empreinte
// SANS l'heure — deux connexions sans rien de changé entre elles ne
// l'archivent qu'une fois.
function blocEtat(compte: EtatDirect): Bloc {
  const etat = versEtatArchive(compte);
  const t = Number(etat.t) || 0;
  return { texte: `${JSON.stringify(etat)}\n`, debut: t, fin: t, empreinte: empreinteDe(JSON.stringify({ ...etat, t: null })) };
}

// Le plugin, avec le délai d'écriture du fichier de guilde : 0 dans les tests.
// `ecritures()` : la file des écritures du compte, pour que les tests
// attendent qu'elle se vide.
export function creerPlugin(delai = DELAI_ECRITURE) {
  // ⚠️ UNE file pour les écritures du compte : chaque ligne s'ajoute après
  // la précédente, et après la première ligne de sa session — jamais avant.
  let file: Promise<void> = Promise.resolve();

  function init(proxy: Proxy, config: ConfigSwex) {
    const suivis = new Map<number, Suivi>();
    const journal = (type: 'info' | 'error', message: string) =>
      proxy.log({ type, source: 'plugin', name: pluginName, message });
    const reglage = () => config.Config.Plugins[pluginName] ?? {};
    const dossier = () => config.Config.App.filesPath;
    const enFile = (nom: string, travail: () => Promise<unknown>) => {
      file = file.then(travail).then(
        () => undefined,
        (e: Error) => journal('error', `${nom} : ${e.message}`)
      );
    };

    const lancerGuilde = (s: Suivi) => {
      if (s.enCours) {
        s.aRefaire = true;
        return;
      }
      s.enCours = true;
      const nom = `${s.base}/${FICHIER_GUILDE}`;
      ecrireAtomique(join(s.dossier, FICHIER_GUILDE), JSON.stringify(versFichierGuilde(s.guilde)))
        .catch((e: Error) => journal('error', `${nom} : ${e.message}`))
        .finally(() => {
          s.enCours = false;
          if (s.aRefaire) {
            s.aRefaire = false;
            lancerGuilde(s);
          }
        });
    };
    const ecrireGuilde = (s: Suivi) => {
      if (s.minuterie) clearTimeout(s.minuterie);
      s.minuterie = setTimeout(() => {
        s.minuterie = undefined;
        lancerGuilde(s);
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
          if (ancien?.minuterie) clearTimeout(ancien.minuterie);
          const compte = depuisConnexion(res);
          suivis.set(id, { base, dossier: dossierSuivi, compte, guilde: depuisFichierGuilde(fichierGuilde, id) });
          // L'état de la connexion s'archive, puis une nouvelle session
          // commence : le fichier live repart de cette connexion. Les deux
          // textes sont faits MAINTENANT : le compte bougera avant leur tour.
          const bloc = blocEtat(compte);
          const premiere = `${JSON.stringify(ligneConnexion(compte, VERSION))}\n`;
          enFile(`${base}/${COMPTE_ARCHIVE}`, () => ajouterAuFichier(join(dossierSuivi, COMPTE_ARCHIVE), bloc));
          enFile(`${base}/${COMPTE_LIVE}`, () => ecrireAtomique(join(dossierSuivi, COMPTE_LIVE), premiere));
          journal('info', `suivi de ${base}`);
          return;
        }

        const s = suivis.get(Number(req?.wizard_id));
        if (!s) return; // pas de connexion vue depuis le lancement de SWEX
        const changement = appliquer(s.compte, commande, req, res);
        if (changement) {
          // Une ligne par changement, ajoutée AUSSITÔT : quelques centaines
          // d'octets, là où réécrire le compte en coûterait 3 Mo.
          // ⚠️ Le fichier a disparu (dossier supprimé pendant la partie) : il
          // repart de l'état tenu, sinon il n'aurait plus sa ligne de
          // connexion. Les lignes encore en file disent l'état FINAL de ce
          // qu'elles touchent : reposées après, elles ne changent rien.
          const ligne = `${JSON.stringify(changement)}\n`;
          const chemin = join(s.dossier, COMPTE_LIVE);
          enFile(`${s.base}/${COMPTE_LIVE}`, () =>
            existsSync(chemin)
              ? promises.appendFile(chemin, ligne, 'utf8')
              : ecrireAtomique(chemin, `${JSON.stringify(ligneConnexion(s.compte, VERSION))}\n`)
          );
        }
        if (reglage().guilde !== false && appliquerGuilde(s.guilde, commande, req, res)) ecrireGuilde(s);
      } catch (e) {
        // ⚠️ Jamais d'exception vers SWEX : une commande que le plugin ne
        // comprend pas ne doit pas gêner les autres plugins ni le jeu.
        journal('error', (e as Error).message);
      }
    });
  }
  return Object.assign(init, { ecritures: () => file });
}

export const init = creerPlugin();
