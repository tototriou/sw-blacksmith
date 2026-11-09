// La connexion à Discord de l'application de bureau
// (docs/02-app/bureau/README.md § « Discord ») : la session du service gardée
// par le processus principal, et les appels de la page relayés vers le
// service. Ce qui se décide sans Electron : bureau/discordPur.ts.
//
// La connexion : « Se connecter » ouvre le navigateur du système sur le
// service, avec le défi d'un secret que seule l'app connaît ; après
// l'autorisation, le site affiche un code, que l'utilisateur colle dans
// l'app ; l'app l'échange, avec son secret, contre la session.
//
// ⚠️ **La session n'est retenue après fermeture qu'avec « Garder mes
// données »** (`discord.json`, chiffrée par le système : `safeStorage`). Sans
// chiffrement sûr (Linux sans trousseau), elle reste en mémoire seulement.
// ⚠️ **La page ne la voit jamais** : elle demande une route autorisée, et
// reçoit le statut et le corps de la réponse.

import { app, BrowserWindow, ipcMain, net, safeStorage, shell } from 'electron';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  adresseConnexion, chiffrementSur, codeColle, corpsAutorise, ENTETE_SESSION, lireFichierSession, nouveauSecret, routeAutorisee,
} from './discordPur';

export type IssueCode = 'connecte' | 'invalide' | 'sans-demande' | 'indisponible';
export interface EtatDiscordBureau { conservable: boolean; attente: boolean }

export interface OptionsDiscord {
  service: string;
  // Mode preuve : le lien de connexion est noté au lieu d'ouvrir le navigateur.
  preuve?: { liensOuverts: string[] };
}

// La première réponse de la page à « Garder mes données » se fait attendre
// au plus ce temps : au-delà, la session retenue n'est pas reprise.
const ATTENTE_RETENIR_MS = 5000;

export function brancherDiscord(fenetre: BrowserWindow, options: OptionsDiscord) {
  const chemin = () => join(app.getPath('userData'), 'discord.json');
  const conservable = chiffrementSur(
    safeStorage.isEncryptionAvailable(),
    process.platform,
    process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : null,
  );
  let session: string | null = null;
  let secret: string | null = null;
  let retenir = false;
  let repris = false;
  let signalerPret: () => void = () => {};
  const pret = new Promise<void>((r) => {
    signalerPret = r;
    setTimeout(r, ATTENTE_RETENIR_MS);
  });

  const deLaPage = (e: Electron.IpcMainInvokeEvent) => e.sender === fenetre.webContents;

  function memoriser() {
    try {
      if (retenir && conservable && session) {
        writeFileSync(chemin(), JSON.stringify({ session: safeStorage.encryptString(session).toString('base64') }));
      } else rmSync(chemin(), { force: true });
    } catch {
      /* disque en lecture seule : la session vaut pour cette ouverture */
    }
  }

  // À la PREMIÈRE réponse de la page, si elle conserve : la session retenue.
  function reprendre() {
    if (repris) return;
    repris = true;
    if (!retenir || !conservable) return;
    try {
      const chiffree = lireFichierSession(JSON.parse(readFileSync(chemin(), 'utf8')));
      if (chiffree && !session) session = safeStorage.decryptString(Buffer.from(chiffree, 'base64'));
    } catch {
      /* aucune session retenue, ou illisible (autre machine, autre compte) */
    }
  }

  function changerSession(nouvelle: string | null) {
    session = nouvelle;
    memoriser();
  }

  ipcMain.handle('bureau:discord-etat', (e): EtatDiscordBureau | null => (deLaPage(e) ? { conservable, attente: secret !== null } : null));

  ipcMain.handle('bureau:discord-connecter', (e) => {
    if (!deLaPage(e)) return false;
    const s = nouveauSecret();
    secret = s.secret;
    const adresse = adresseConnexion(options.service, s.defi);
    if (options.preuve) options.preuve.liensOuverts.push(adresse);
    else void shell.openExternal(adresse);
    return true;
  });

  ipcMain.handle('bureau:discord-annuler', (e) => {
    if (deLaPage(e)) secret = null;
    return null;
  });

  ipcMain.handle('bureau:discord-code', async (e, texte: unknown): Promise<IssueCode | null> => {
    if (!deLaPage(e)) return null;
    if (!secret) return 'sans-demande';
    const code = codeColle(texte);
    if (!code) return 'invalide';
    let r: Response;
    try {
      r = await net.fetch(`${options.service}/api/discord/bureau-echange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, secret }),
      });
    } catch {
      return 'indisponible';
    }
    if (r.status === 400) return 'invalide';
    const corps = (await r.json().catch(() => null)) as { session?: unknown } | null;
    if (!r.ok || typeof corps?.session !== 'string') return 'indisponible';
    secret = null;
    changerSession(corps.session);
    return 'connecte';
  });

  // Un appel au service pour la page. `statut` 0 : le service n'a pas répondu.
  ipcMain.handle('bureau:discord-appeler', async (e, cheminBrut: unknown, methode: unknown, corpsBrut: unknown) => {
    if (!deLaPage(e)) return null;
    const route = routeAutorisee(cheminBrut, methode);
    const corps = route ? corpsAutorise(route, corpsBrut) : null;
    if (!route || corps === null) return { statut: 400, corps: '{"erreur":"route"}' };
    await pret;
    if (!session) return { statut: 401, corps: '{"connecte":false}' };
    const envoyee = session;
    let r: Response;
    try {
      r = await net.fetch(`${options.service}/api/discord/${route}`, {
        method: methode as string,
        headers: { Authorization: `Bearer ${envoyee}`, ...(corps !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: corps,
      });
    } catch {
      return { statut: 0, corps: '' };
    }
    const renouvelee = r.headers.get(ENTETE_SESSION);
    // Une déconnexion, une session échue ou refusée : oubliée. Seulement si
    // c'est encore celle qui a été envoyée (une connexion a pu la remplacer
    // pendant l'appel).
    if (route === 'deconnexion' || r.status === 401) {
      if (session === envoyee) changerSession(null);
    } else if (renouvelee && session === envoyee) changerSession(renouvelee);
    return { statut: r.status, corps: await r.text() };
  });

  return {
    // « Garder mes données », redit par la page au chargement et à chaque
    // changement (bureau/session.ts relaie `bureau:session-retenir`).
    retenir(oui: boolean) {
      retenir = oui;
      reprendre();
      memoriser();
      signalerPret();
    },
    // « Tout supprimer » : la session est oubliée, ici et sur le disque.
    oublier() {
      secret = null;
      changerSession(null);
    },
  };
}
