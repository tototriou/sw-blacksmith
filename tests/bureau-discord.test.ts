// La connexion à Discord de l'application de bureau (bureau/discordPur.ts,
// bureau/discord.ts, bureau/preload.ts, src/lib/bureau.ts) : adresse du
// service, secret et défi, code collé, routes que la page peut faire appeler,
// chiffrement sûr, fichier retenu ; le relais de la page vers le processus
// principal ; et chaque canal vérifié du côté du processus principal.
//
// La connexion de bout en bout (navigateur simulé, vrai service, session
// retenue) : `npm run bureau:preuve -- --discord`.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  adresseConnexion, adresseService, chiffrementSur, codeColle, corpsAutorise, lireFichierSession, nouveauSecret, routeAutorisee, SERVICE_PAR_DEFAUT,
} from '../bureau/discordPur';
import { ENTETE_SESSION, FORME_DEFI } from '../api/_source/service/session';
import { ENTETE_SESSION as ENTETE_BUREAU } from '../bureau/discordPur';
import { recupererParLeBureau, type PontDiscord } from '../src/lib/bureau';
import { lireTout } from '../src/lib/discordClient';
import { egal, ok, titre } from './outils';

const sansCommentaires = (source: string) =>
  source.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

export default async function testBureauDiscord() {
  titre('Bureau — connexion à Discord : service, code, routes, session');
  egal([adresseService(undefined), adresseService('http://localhost:3000/'), adresseService('https://apercu.vercel.app/x'),
    adresseService('http://ailleurs.example'), adresseService('pas une adresse')],
  [SERVICE_PAR_DEFAUT, 'http://localhost:3000', 'https://apercu.vercel.app', SERVICE_PAR_DEFAUT, SERVICE_PAR_DEFAUT],
  'le service : la production, sauf une autre adresse https, ou http sur la machine');

  const { secret, defi } = nouveauSecret();
  ok(FORME_DEFI.test(defi) && defi === createHash('sha256').update(secret).digest('base64url'), 'le défi est l\'empreinte du secret, dans la forme que le service accepte');
  ok(nouveauSecret().secret !== secret, 'un secret neuf à chaque connexion');
  egal(adresseConnexion('https://s.example', defi), `https://s.example/api/discord/login?bureau=${defi}`, 'le navigateur ne reçoit que le défi');
  egal(ENTETE_BUREAU, ENTETE_SESSION, 'la session renouvelée est lue dans l\'en-tête que le service écrit');

  const code = 'A'.repeat(60);
  egal([codeColle(`  ${code.slice(0, 30)}\n${code.slice(30)} `), codeColle('court'), codeColle('pas un code !'.repeat(10)), codeColle(42)],
    [code, null, null, null], 'code collé : les blancs d\'un copier-coller retirés ; trop court, autres caractères ou autre chose refusés');

  egal(['session', 'sources', 'tout', 'salon?id=123', 'salon?id=../x', 'bureau-echange', 'https://ailleurs.example'].map((c) => routeAutorisee(c, 'GET')),
    ['session', 'sources', 'tout', 'salon?id=123', null, null, null], 'GET : seules les lectures du service');
  egal(['publier', 'deconnexion', 'tout'].map((c) => routeAutorisee(c, 'POST')), ['publier', 'deconnexion', null], 'POST : publier et se déconnecter seulement');
  egal(routeAutorisee('tout', 'DELETE'), null, 'aucune autre méthode');
  egal([corpsAutorise('publier', '{}'), corpsAutorise('publier', 'x'.repeat(600 * 1024)), corpsAutorise('publier', undefined), corpsAutorise('tout', undefined), corpsAutorise('tout', 'x')],
    ['{}', null, null, undefined, null], 'un corps pour publier seulement, borné');

  egal([chiffrementSur(true, 'win32', null), chiffrementSur(false, 'win32', null), chiffrementSur(true, 'linux', 'gnome_libsecret'),
    chiffrementSur(true, 'linux', 'basic_text'), chiffrementSur(true, 'linux', 'unknown')],
  [true, false, true, false, false], 'chiffrement sûr : Windows, ou un trousseau sous Linux ; la clé connue de tous ne compte pas');
  egal([lireFichierSession({ session: 'YWJj' }), lireFichierSession({ session: 3 }), lireFichierSession(null), lireFichierSession({ session: 'a b' })],
    ['YWJj', null, null, null], 'discord.json relu avec méfiance');

  // Le relais de la page : chaque appel du client passe par le pont.
  const appels: unknown[][] = [];
  const pont = (statut: number, corps: string): PontDiscord => ({
    etat: async () => null, connecter: async () => true, annuler: async () => null, code: async () => null,
    appeler: async (...a: unknown[]) => { appels.push(a); return { statut, corps }; },
  });
  const tout = await lireTout(recupererParLeBureau(pont(200, JSON.stringify({ utilisateur: { id: 'U', nom: 'T' }, serveurs: [], versions: {} }))));
  ok(tout.ok, 'la page lit les salons par le processus principal');
  egal(appels[0], ['tout', 'GET', undefined], 'le chemin de la route, sans l\'adresse du service');
  egal(await lireTout(recupererParLeBureau(pont(401, '{"connecte":false}'))), { ok: false, echec: 'non-connecte' }, '401 : non connecté, comme sur le site');
  egal(await lireTout(recupererParLeBureau(pont(0, ''))), { ok: false, echec: 'indisponible' }, 'service injoignable : indisponible');

  // Les canaux : déclarés au préchargement, vérifiés (expéditeur) dans le
  // processus principal, branchés dans main.ts et suivis par la session.
  const preload = sansCommentaires(readFileSync('bureau/preload.ts', 'utf8'));
  const discord = sansCommentaires(readFileSync('bureau/discord.ts', 'utf8'));
  for (const canal of ['etat', 'connecter', 'annuler', 'code', 'appeler']) {
    ok(preload.includes(`ipcRenderer.invoke('bureau:discord-${canal}'`), `préchargement : bureau:discord-${canal}`);
    ok(new RegExp(`ipcMain\\.handle\\('bureau:discord-${canal}',[^]*?deLaPage\\(e\\)`).test(discord), `processus principal : bureau:discord-${canal}, de la page seulement`);
  }
  ok(!/session/.test(preload.slice(preload.indexOf('discord:'))), 'la page ne reçoit jamais la session');
  const main = sansCommentaires(readFileSync('bureau/main.ts', 'utf8'));
  ok(/brancherSession\(fenetre, preuve\?\.session, discord\)/.test(main), '« Garder mes données » et « Tout supprimer » suivis par la connexion');
  const session = sansCommentaires(readFileSync('bureau/session.ts', 'utf8'));
  ok(/suivre\?\.retenir\(oui\)/.test(session) && /suivre\?\.oublier\(\)/.test(session), 'la session relaie les deux signaux');
}
