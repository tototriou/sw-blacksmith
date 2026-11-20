// Le plugin SWEX « SW Blacksmith Live » : ce que SW Exporter charge depuis son
// dossier `plugins`. Assemblé par scripts/construire-plugin-swex.mjs en un
// seul fichier, `SWBlacksmithLive.js`, dont la version est celle de l'app.
//
// SWEX donne au plugin chaque échange avec le jeu (`apiCommand`). Dans
// `SWBlacksmith/<nom>-<id>/`, que l'application de bureau suit, deux types de
// données, chacun en deux fichiers — la session en cours (`….live.jsonl`,
// une ligne ajoutée aussitôt par changement) et son archive (`….jsonl.gz`) :
//  - le COMPTE : à la connexion, son état allégé s'archive et le fichier live
//    repart de la réponse du serveur (l'export de ProfileExport) ; chaque
//    commande qui le change y ajoute une ligne ;
//  - la GUILDE : chaque vue ou combat y ajoute une ligne ; à la connexion
//    suivante, la session finie s'archive en entier — l'historique compte.
// Voir docs/02-app/bureau/feat-swex-direct.md.

import { existsSync, promises } from 'node:fs';
import { join } from 'node:path';
import { ajouterAuFichier, empreinteDe, type Bloc } from './archive';
import { appliquer, depuisConnexion, ligneConnexion, versEtatArchive, type EtatDirect, type Json } from './etatDirect';
import { contenuDeVue, evenementGuilde, ligneSessionGuilde } from './guilde';
import { COMPTE_ARCHIVE, COMPTE_LIVE, GUILDE_ARCHIVE, GUILDE_LIVE, dossierInvocateur, ecrireAtomique, nomDeBase } from './fichiers';

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

interface Proxy {
  on(evenement: 'apiCommand', ecouteur: (req: Json, res: Json) => void): void;
  log(entree: { type: string; source: string; name: string; message: string }): void;
}
interface ConfigSwex {
  Config: { App: { filesPath: string }; Plugins: Record<string, { enabled?: boolean; guilde?: boolean } | undefined> };
}

// Un invocateur suivi : son dossier et son compte.
interface Suivi {
  base: string;
  dossier: string; // SWBlacksmith/<nom>-<id>, dans le dossier de SWEX
  compte: EtatDirect;
  // L'empreinte du dernier contenu écrit de chaque vue de guilde, de la
  // session : une vue inchangée ne se réécrit pas (`contenuDeVue`, guilde.ts).
  vues: Map<string, string>;
}

// Ce qui s'archive du compte à une connexion : l'état allégé, et son empreinte
// SANS l'heure — deux connexions sans rien de changé entre elles ne
// l'archivent qu'une fois.
function blocEtat(compte: EtatDirect): Bloc {
  const etat = versEtatArchive(compte);
  const t = Number(etat.t) || 0;
  return { texte: `${JSON.stringify(etat)}\n`, debut: t, fin: t, empreinte: empreinteDe(JSON.stringify({ ...etat, t: null })) };
}

// Ce qui s'archive d'une session de guilde finie : ses lignes COMPLÈTES (une
// dernière ligne à moitié écrite est laissée), si elle a au moins un
// événement. Ses dates : la plus ancienne et la plus récente heure serveur.
export function blocSessionGuilde(texte: string): Bloc | null {
  const complet = texte.slice(0, texte.lastIndexOf('\n') + 1);
  const heures: number[] = [];
  let evenements = 0;
  for (const l of complet.split('\n')) {
    if (!l.trim()) continue;
    try {
      const o = JSON.parse(l);
      if (o.type !== 'session') evenements++;
      if (typeof o.t === 'number') heures.push(o.t);
    } catch {
      /* ligne abîmée : gardée telle quelle, la lecture s'y arrêtera */
    }
  }
  if (!evenements) return null;
  const [debut, fin] = heures.length ? [Math.min(...heures), Math.max(...heures)] : [0, 0];
  return { texte: complet, debut, fin, empreinte: empreinteDe(complet) };
}

// Le plugin. `ecritures()` : la file des écritures, pour que les tests
// attendent qu'elle se vide.
export function creerPlugin() {
  // ⚠️ UNE file pour toutes les écritures : chaque ligne s'ajoute après la
  // précédente, et après l'en-tête de sa session — jamais avant ; une session
  // s'archive avant que son fichier live ne reparte.
  let file: Promise<void> = Promise.resolve();

  function init(proxy: Proxy, config: ConfigSwex) {
    const suivis = new Map<number, Suivi>();
    const journal = (type: 'info' | 'error', message: string) =>
      proxy.log({ type, source: 'plugin', name: pluginName, message });
    const reglage = () => config.Config.Plugins[pluginName] ?? {};
    const guildeActive = () => reglage().guilde !== false;
    const dossier = () => config.Config.App.filesPath;
    const enFile = (nom: string, travail: () => Promise<unknown>) => {
      file = file.then(travail).then(
        () => undefined,
        (e: Error) => journal('error', `${nom} : ${e.message}`)
      );
    };
    // Une ligne ajoutée AUSSITÔT : quelques centaines d'octets. ⚠️ Le fichier
    // a disparu (dossier supprimé pendant la partie, guilde activée en cours
    // de session) : il repart de `depart`, sinon il n'aurait plus son en-tête.
    const ajouter = (s: Suivi, fichier: string, ligne: string, depart: () => string) => {
      const chemin = join(s.dossier, fichier);
      enFile(`${s.base}/${fichier}`, () =>
        existsSync(chemin) ? promises.appendFile(chemin, ligne, 'utf8') : ecrireAtomique(chemin, depart())
      );
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
          const compte = depuisConnexion(res);
          suivis.set(id, { base, dossier: dossierSuivi, compte, vues: new Map() });
          // Les textes sont faits MAINTENANT : le compte bougera avant leur
          // tour dans la file.
          const t = typeof res.tvalue === 'number' ? res.tvalue : null;
          const bloc = blocEtat(compte);
          const premiere = `${JSON.stringify(ligneConnexion(compte, VERSION))}\n`;
          const entete = `${JSON.stringify(ligneSessionGuilde(id, t, VERSION))}\n`;
          const avecGuilde = guildeActive();
          // Le compte : l'état de la connexion s'archive, le live en repart.
          enFile(`${base}/${COMPTE_ARCHIVE}`, () => ajouterAuFichier(join(dossierSuivi, COMPTE_ARCHIVE), bloc));
          enFile(`${base}/${COMPTE_LIVE}`, () => ecrireAtomique(join(dossierSuivi, COMPTE_LIVE), premiere));
          // La guilde : la session finie s'archive, puis une nouvelle commence
          // — ou plus rien, si la guilde est désactivée dans SWEX.
          enFile(`${base}/${GUILDE_ARCHIVE}`, async () => {
            const chemin = join(dossierSuivi, GUILDE_LIVE);
            const finie = await promises.readFile(chemin, 'utf8').catch(() => null);
            const session = finie === null ? null : blocSessionGuilde(finie);
            if (session) await ajouterAuFichier(join(dossierSuivi, GUILDE_ARCHIVE), session);
            if (avecGuilde) await ecrireAtomique(chemin, entete);
            else await promises.rm(chemin, { force: true });
          });
          journal('info', `suivi de ${base}`);
          return;
        }

        const s = suivis.get(Number(req?.wizard_id));
        if (!s) return; // pas de connexion vue depuis le lancement de SWEX
        const changement = appliquer(s.compte, commande, req, res);
        // Les lignes en file disent l'état FINAL de ce qu'elles touchent :
        // reposées après un départ de l'état tenu, elles ne changent rien.
        if (changement)
          ajouter(s, COMPTE_LIVE, `${JSON.stringify(changement)}\n`, () => `${JSON.stringify(ligneConnexion(s.compte, VERSION))}\n`);
        // Guilde désactivée : réactivée, le fichier repart de son en-tête, et
        // chaque vue doit s'y réécrire.
        if (!guildeActive()) s.vues.clear();
        const evenement = guildeActive() ? evenementGuilde(s.compte.wizardId, commande, req, res) : null;
        const vue = evenement ? contenuDeVue(evenement) : null;
        const empreinte = vue ? empreinteDe(vue.contenu) : null;
        // Une vue au même contenu que la précédente de même écran : rien.
        if (evenement && (!vue || s.vues.get(vue.cle) !== empreinte)) {
          if (vue && empreinte) s.vues.set(vue.cle, empreinte);
          const ligne = `${JSON.stringify(evenement)}\n`;
          ajouter(s, GUILDE_LIVE, ligne, () => `${JSON.stringify(ligneSessionGuilde(s.compte.wizardId, evenement.t, VERSION))}\n${ligne}`);
        }
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
