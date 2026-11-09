// Le service Discord des recommandations (api/_source/) : droits sur un salon,
// session chiffrée, version courante d'un salon, fichier publié (auteur,
// contributeurs, source), et chaque route rejouée contre un Discord simulé —
// connexion, sources, lecture d'un salon, publication et conflit.
// Modèle : docs/04-decisions/adr/un-salon-une-reco.md.

import { ADMINISTRATEUR, droitsSurSalon, ENVOYER, HISTORIQUE, JOINDRE, resumeDroits, VOIR_LE_SALON, type Role, type Salon } from '../api/_source/service/droits';
import { API } from '../api/_source/service/discordApi';
import { lireVersion, nomDuMembre, preparerPublication, versionCourante, type MessageDiscord } from '../api/_source/service/recoSalon';
import { creerRouteur, PAGE_RECOS } from '../api/_source/service/routeur';
import { COOKIE_ETAT, COOKIE_SESSION, desceller, estSession, lireCookies, sceller, signer, verifierSignature, type Cle, type Session } from '../api/_source/service/session';
import { fr } from '../src/i18n/fr';
import { decodeRecosJson, encodeRecosJson } from '../src/lib/recoShare';
import type { Reco } from '../src/types';
import { egal, ok, titre } from './outils';

const S = 'G1'; // serveur
const bits = (...b: bigint[]) => b.reduce((a, x) => a | x, 0n).toString();
const LIRE = bits(VOIR_LE_SALON, HISTORIQUE);
const TOUT_SALON = bits(VOIR_LE_SALON, HISTORIQUE, ENVOYER, JOINDRE);

function reco(nom: string, monstre = 14105): Reco {
  const slot = (id: number | null) => ({ com2usId: id, name: id ? `M${id}` : '', stats: {}, setOptions: [], artifacts: { element: [], archetype: [] } });
  return { id: 'x', origin: 'mine', name: nom, author: 'saisi', note: '', decks: [{ name: '', note: '', slots: [slot(monstre), slot(null), slot(null)], counters: [] }] };
}
const fichier = (nom: string, extra: Partial<Reco> = {}) => encodeRecosJson([{ ...reco(nom), ...extra }]);

export function testDiscordDroits() {
  titre('Service Discord — droits d\'un membre sur un salon');
  const roles: Role[] = [{ id: S, permissions: LIRE }, { id: 'officier', permissions: bits(ENVOYER, JOINDRE) }, { id: 'chef', permissions: bits(ADMINISTRATEUR) }];
  const salon = (exceptions: Salon['permission_overwrites']): Salon => ({ id: 'C', guild_id: S, name: 'blacksmith-reco', type: 0, permission_overwrites: exceptions });
  const d = (s: Salon, roles2: string[], userId = 'U', proprietaire: string | null = null) => resumeDroits(droitsSurSalon(S, proprietaire, roles, s, { roles: roles2, userId }));

  egal(d(salon([]), []), { lire: true, ecrire: false, joindre: false }, '@everyone lit, n\'écrit pas');
  egal(d(salon([]), ['officier']), { lire: true, ecrire: true, joindre: true }, 'un rôle ajoute l\'écriture');
  egal(d(salon([{ id: S, type: 0, allow: '0', deny: bits(VOIR_LE_SALON) }]), ['officier']), { lire: false, ecrire: false, joindre: false },
    'salon fermé à @everyone : sans voir le salon, aucun autre droit');
  egal(d(salon([{ id: S, type: 0, allow: '0', deny: bits(VOIR_LE_SALON) }, { id: 'officier', type: 0, allow: bits(VOIR_LE_SALON), deny: '0' }]), ['officier']),
    { lire: true, ecrire: true, joindre: true }, 'l\'exception d\'un rôle rouvre le salon');
  egal(d(salon([{ id: 'U', type: 1, allow: '0', deny: bits(ENVOYER) }]), ['officier']), { lire: true, ecrire: false, joindre: false },
    'l\'exception du membre passe en dernier');
  egal(d(salon([{ id: S, type: 0, allow: '0', deny: TOUT_SALON }]), ['chef']), { lire: true, ecrire: true, joindre: true }, 'un administrateur passe outre les exceptions');
  egal(d(salon([{ id: S, type: 0, allow: '0', deny: TOUT_SALON }]), [], 'U', 'U'), { lire: true, ecrire: true, joindre: true }, 'le propriétaire du serveur a tout');
}

export async function testDiscordSession() {
  titre('Service Discord — session chiffrée et signature');
  const cle: Cle = new Uint8Array(32).fill(7);
  const autre: Cle = new Uint8Array(32).fill(8);
  const s: Session = { acces: 'a', renouvellement: 'r', expire: 1, utilisateur: { id: 'U', nom: 'Toto' } };
  const scelle = await sceller(s, cle);
  egal(await desceller(scelle, cle), s, 'scellée puis lue, la session revient intacte');
  ok(!scelle.includes('Toto'), 'le cookie ne laisse rien lire en clair');
  egal(await desceller(scelle, autre), null, 'une autre clé ne lit rien');
  egal(await desceller(scelle.slice(0, -2) + (scelle.endsWith('A') ? 'BB' : 'AA'), cle), null, 'un cookie altéré ne vaut rien');
  egal(await desceller('n\'importe quoi', cle), null, 'un cookie illisible ne vaut rien');
  ok(estSession(s) && !estSession({ acces: 'a' }), 'forme d\'une session vérifiée');
  const sig = await signer('brut:C', cle);
  ok(await verifierSignature('brut:C', sig, cle), 'signature d\'une lecture interne acceptée');
  ok(!(await verifierSignature('brut:D', sig, cle)) && !(await verifierSignature('brut:C', null, cle)), 'autre salon ou signature absente : refusée');
}

export function testDiscordRecoSalon() {
  titre('Service Discord — version courante et fichier publié');
  const m = (id: string, auteur: string, fichiers: string[]): MessageDiscord =>
    ({ id, timestamp: `t${id}`, author: { id: auteur }, attachments: fichiers.map((f) => ({ url: `u${id}`, filename: f, size: 1 })) });
  const messages = [m('5', 'U', ['a.json']), m('4', 'B', []), m('3', 'B', ['photo.png']), m('2', 'B', ['recommandation.json']), m('1', 'B', ['recommandation.json'])];
  egal(versionCourante(messages, 'B')?.message.id, '2', 'la plus récente du bot qui porte un JSON ; ni un membre, ni un message sans fichier');
  egal(versionCourante([m('9', 'U', ['a.json'])], 'B'), null, 'aucun message du bot : pas de recommandation');

  egal(nomDuMembre({ nick: 'Chef de guerre', user: { username: 'toto', global_name: 'Toto' } }), 'Chef de guerre', 'surnom du serveur d\'abord');
  egal(nomDuMembre({ nick: null, user: { username: 'toto', global_name: 'Toto' } }), 'Toto', 'à défaut, le nom d\'affichage');

  const premiere = preparerPublication(fichier('Défenses'), 'Toto', null, 'discord:G1:C', fr);
  ok(premiere.ok, 'première publication acceptée');
  if (!premiere.ok) return;
  egal([premiere.reco.author, premiere.reco.contributeurs, premiere.reco.source], ['Toto', ['Toto'], 'discord:G1:C'],
    'auteur = premier publieur (pas l\'auteur saisi), contributeurs, source du salon');
  const relue = lireVersion(premiere.texte, fr);
  egal([relue?.author, relue?.contributeurs], ['Toto', ['Toto']], 'le fichier posté se relit avec auteur et contributeurs');
  const seconde = preparerPublication(fichier('Défenses v2', { author: 'Usurpateur', contributeurs: ['Faux'] }), 'Lulu', relue, 'discord:G1:C', fr);
  ok(seconde.ok && seconde.reco.author === 'Toto' && JSON.stringify(seconde.reco.contributeurs) === '["Toto","Lulu"]',
    'publication suivante : l\'auteur reste le premier, le publieur s\'ajoute ; ce que dit le fichier reçu est ignoré');
  const encore = seconde.ok ? preparerPublication(fichier('v3'), 'Toto', seconde.reco, 'discord:G1:C', fr) : null;
  egal(encore?.ok ? encore.reco.contributeurs : null, ['Toto', 'Lulu'], 'un contributeur ne revient pas deux fois');
  ok(!preparerPublication('pas du json', 'Toto', null, 's', fr).ok, 'un fichier illisible est refusé');
  ok(!preparerPublication(encodeRecosJson([reco('a'), reco('b')]), 'Toto', null, 's', fr).ok, 'deux recommandations : refusé, un salon en porte une');
  ok(preparerPublication(fichier('x') + ' ', 'Toto', null, 's', fr).ok
    && !preparerPublication(fichier('x') + ' '.repeat(300 * 1024), 'Toto', null, 's', fr).ok, 'un fichier de plus de 256 Ko est refusé, même valide');
}

export function testDiscordContributeursFormat() {
  titre('Format des recommandations — champ contributeurs');
  const lues = decodeRecosJson(fichier('R', { contributeurs: ['A', ' B ', 'A', '', 'x'.repeat(60)] }), fr);
  egal(lues?.[0].contributeurs, ['A', 'B', 'x'.repeat(40)], 'noms nettoyés : espaces, doublons et vides retirés, longueur bornée');
  egal(decodeRecosJson(fichier('R'), fr)?.[0].contributeurs, undefined, 'sans contributeurs, le champ reste absent');
  ok(!fichier('R').includes('contributeurs'), 'une recommandation sans contributeurs n\'écrit pas de liste vide');
}

/* --------------------------------------------------------------------------
 * Discord simulé
 * ----------------------------------------------------------------------- */

interface Monde {
  roles: Role[];
  salons: { id: string; name: string; type: number; permission_overwrites?: Salon['permission_overwrites'] }[];
  membres: Record<string, { roles: string[]; nick?: string | null; user: { id: string; username: string; global_name?: string | null } }>;
  messages: Record<string, MessageDiscord[]>;
  pieces: Record<string, string>;
  postes: { salon: string; texte: string }[];
  appels: string[];
  jetonRefuse?: boolean;
}

function monde(): Monde {
  return {
    roles: [{ id: S, permissions: LIRE }, { id: 'officier', permissions: bits(ENVOYER, JOINDRE) }],
    salons: [
      { id: 'C1', name: 'blacksmith-reco-siege', type: 0 },
      { id: 'C2', name: 'general', type: 0 },
      { id: 'C3', name: 'blacksmith-reco-cache', type: 0, permission_overwrites: [{ id: S, type: 0, allow: '0', deny: bits(VOIR_LE_SALON) }] },
    ],
    membres: {
      B: { roles: ['officier'], user: { id: 'B', username: 'bot' } },
      U: { roles: ['officier'], nick: 'Toto le chef', user: { id: 'U', username: 'toto', global_name: 'Toto' } },
      L: { roles: [], user: { id: 'L', username: 'lulu' } },
    },
    messages: { C1: [] },
    pieces: {},
    postes: [],
    appels: [],
  };
}

function simulateur(w: Monde) {
  let n = 100;
  return async (url: string, init: RequestInit = {}): Promise<Response> => {
    const methode = init.method ?? 'GET';
    const auth = (init.headers as Record<string, string> | undefined)?.Authorization ?? '';
    w.appels.push(`${methode} ${url.replace(API, '')}`);
    const r = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut });
    if (url in w.pieces) return new Response(w.pieces[url]);
    const chemin = url.replace(API, '');
    if (chemin === '/oauth2/token') {
      const p = init.body as URLSearchParams;
      if (w.jetonRefuse) return r({ error: 'invalid_grant' }, 400);
      return r({ access_token: `acces-${p.get('grant_type')}`, refresh_token: 'renouv-2', expires_in: 604800 });
    }
    if (chemin === '/oauth2/token/revoke') return new Response(null, { status: 200 });
    const user = auth.startsWith('Bearer ') ? 'U' : 'B';
    if (chemin === '/users/@me') return r(user === 'U' ? w.membres.U.user : { id: 'B', username: 'bot' });
    if (chemin === '/users/@me/guilds') return r(user === 'U' ? [{ id: S, name: 'Ma guilde', icon: null }, { id: 'G9', name: 'Sans bot', icon: null }] : [{ id: S }]);
    if (chemin === `/guilds/${S}`) return r({ id: S, name: 'Ma guilde', icon: null, owner_id: 'O', roles: w.roles });
    if (chemin === `/guilds/${S}/channels`) return r(w.salons);
    const membre = chemin.match(/^\/guilds\/G1\/members\/(\w+)$/);
    if (membre) return w.membres[membre[1]] ? r(w.membres[membre[1]]) : r({ code: 10007 }, 404);
    const salon = chemin.match(/^\/channels\/(\w+)$/);
    if (salon) { const s = w.salons.find((x) => x.id === salon[1]); return s ? r({ ...s, guild_id: S }) : r({}, 404); }
    const msgs = chemin.match(/^\/channels\/(\w+)\/messages(\?limit=100)?$/);
    if (msgs && methode === 'GET') return r(w.messages[msgs[1]] ?? []);
    if (msgs && methode === 'POST') {
      const fd = init.body as FormData;
      const texte = await (fd.get('files[0]') as Blob).text();
      const id = String(++n);
      w.postes.push({ salon: msgs[1], texte });
      w.pieces[`https://cdn/${id}`] = texte;
      (w.messages[msgs[1]] ??= []).unshift({ id, timestamp: `t${id}`, author: { id: 'B' }, attachments: [{ url: `https://cdn/${id}`, filename: 'recommandation.json', size: 1 }] });
      return r({ id, timestamp: `t${id}` });
    }
    return r({ message: `route simulée absente : ${methode} ${chemin}` }, 500);
  };
}

const CLE: Cle = new Uint8Array(32).fill(3);
const ORIGINE = 'https://sw-blacksmith.vercel.app';

function banc(w: Monde, maintenant = 1_000_000) {
  const routeur = creerRouteur({
    env: { clientId: 'client', clientSecret: 'secret', jetonBot: 'bot', cle: CLE },
    recuperer: simulateur(w), maintenant: () => maintenant, attendre: async () => {}, t: fr, lectureEnCache: false,
  });
  return routeur;
}

async function cookieSession(utilisateur = 'U', expire = 1e12) {
  const s: Session = { acces: 'acces-x', renouvellement: 'r', expire, utilisateur: { id: utilisateur, nom: 'Toto' } };
  return `${COOKIE_SESSION}=${await sceller(s, CLE)}`;
}

const requete = (chemin: string, init: RequestInit & { cookie?: string } = {}) => new Request(`${ORIGINE}/api/discord?chemin=${chemin}`, {
  ...init, headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.method === 'POST' ? { origin: ORIGINE } : {}), ...(init.headers as Record<string, string> | undefined) },
});

export async function testDiscordRouteurConnexion() {
  titre('Service Discord — connexion, session et déconnexion');
  const w = monde();
  const r = banc(w);
  const login = await r.traiter(requete('login'));
  const vers = new URL(login.headers.get('location') ?? '');
  egal([login.status, vers.origin + vers.pathname], [302, 'https://discord.com/oauth2/authorize'], 'login renvoie vers l\'autorisation Discord');
  egal([vers.searchParams.get('scope'), vers.searchParams.get('redirect_uri')], ['identify guilds', `${ORIGINE}/api/discord/callback`], 'scopes identify + guilds, retour sur le site');
  const etat = vers.searchParams.get('state') ?? '';
  ok(etat.length > 10 && (login.headers.get('set-cookie') ?? '').includes(`${COOKIE_ETAT}=${etat}`), 'un état anti-falsification, gardé en cookie');
  ok((login.headers.get('set-cookie') ?? '').includes('HttpOnly') && (login.headers.get('set-cookie') ?? '').includes('Secure'), 'cookie HttpOnly et Secure');

  const faux = await r.traiter(requete(`callback&code=c&state=autre`, { cookie: `${COOKIE_ETAT}=${etat}` }));
  egal(faux.headers.get('location'), `/?discord=erreur${PAGE_RECOS}`, 'un état qui ne correspond pas : refusé, aucune session');
  ok(!faux.headers.getSetCookie().some((c) => c.startsWith(`${COOKIE_SESSION}=`)), 'aucun cookie de session posé');
  const refus = await r.traiter(requete(`callback&error=access_denied&state=${etat}`, { cookie: `${COOKIE_ETAT}=${etat}` }));
  egal(refus.headers.get('location'), `/?discord=refus${PAGE_RECOS}`, 'autorisation refusée par le membre : dit à la page');

  const retour = await r.traiter(requete(`callback&code=c&state=${etat}`, { cookie: `${COOKIE_ETAT}=${etat}` }));
  egal(retour.headers.get('location'), PAGE_RECOS, 'connecté : retour à la page Recommandations');
  const pose = retour.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE_SESSION}=`)) ?? '';
  ok(pose.includes(`Max-Age=${30 * 24 * 3600}`), 'session de 30 jours');
  const session = await desceller<Session>(lireCookies(pose.split(';')[0]).get(COOKIE_SESSION), CLE);
  egal([session?.acces, session?.utilisateur], ['acces-authorization_code', { id: 'U', nom: 'Toto' }], 'la session porte le jeton et l\'identité');

  const lue = await r.traiter(requete('session', { cookie: pose.split(';')[0] }));
  egal(await lue.json(), { connecte: true, utilisateur: { id: 'U', nom: 'Toto' } }, 'session lue');
  egal((await r.traiter(requete('session'))).status, 401, 'sans cookie : non connecté');

  // Jeton d'accès échu : renouvelé, nouveau cookie posé.
  const echue = await r.traiter(requete('session', { cookie: await cookieSession('U', 1_000_000) }));
  ok(echue.status === 200 && echue.headers.getSetCookie().some((c) => c.startsWith(`${COOKIE_SESSION}=`)), 'jeton échu : renouvelé, cookie réécrit');
  w.jetonRefuse = true;
  egal((await r.traiter(requete('session', { cookie: await cookieSession('U', 1_000_000) }))).status, 401, 'renouvellement refusé : non connecté');

  const sortie = await r.traiter(requete('deconnexion', { method: 'POST', cookie: await cookieSession() }));
  ok(sortie.status === 204 && sortie.headers.getSetCookie().some((c) => c.startsWith(`${COOKIE_SESSION}=;`) && c.includes('Max-Age=0')), 'déconnexion : cookie effacé');
  ok(w.appels.includes('POST /oauth2/token/revoke'), 'déconnexion : le jeton est révoqué chez Discord');
  egal((await r.traiter(new Request(`${ORIGINE}/api/discord?chemin=deconnexion`, { method: 'POST', headers: { origin: 'https://ailleurs.example' } }))).status, 403,
    'une requête POST d\'une autre origine est refusée');
}

export async function testDiscordRouteurSources() {
  titre('Service Discord — sources du membre');
  const w = monde();
  const r = banc(w);
  const rep = await r.traiter(requete('sources', { cookie: await cookieSession() }));
  const corps = await rep.json() as { serveurs: { id: string; botAdmin: boolean; salons: { id: string; nom: string; ecrire: boolean }[] }[] };
  egal(corps.serveurs.map((s) => s.id), [S], 'seuls les serveurs communs au membre et au bot');
  egal(corps.serveurs[0].salons, [{ id: 'C1', nom: 'blacksmith-reco-siege', ecrire: true }],
    'seuls les salons blacksmith-reco… que le bot et le membre voient, avec le droit d\'écrire');
  egal(corps.serveurs[0].botAdmin, false, 'bot sans droit administrateur');
  const r2 = banc({ ...monde(), roles: [{ id: S, permissions: LIRE }, { id: 'officier', permissions: bits(ADMINISTRATEUR) }] });
  const admin = await (await r2.traiter(requete('sources', { cookie: await cookieSession() }))).json() as typeof corps;
  egal(admin.serveurs[0].botAdmin, true, 'bot administrateur : signalé, sans bloquer');
  egal((await r.traiter(requete('sources'))).status, 401, 'sans session : non connecté');
  const lulu = await (await r.traiter(requete('sources', { cookie: await cookieSession('L') }))).json() as typeof corps;
  egal(lulu.serveurs[0].salons.map((s) => s.ecrire), [false], 'un membre sans droit d\'écrire voit le salon en lecture seule');
}

export async function testDiscordRouteurSalonEtPublication() {
  titre('Service Discord — lecture d\'un salon et publication');
  const w = monde();
  const r = banc(w);
  const toto = await cookieSession('U');
  const lire = async (id: string, c = toto) => r.traiter(requete(`salon&id=${id}`, { cookie: c }));
  const publier = async (corps: unknown, c = toto, origine = ORIGINE) => r.traiter(new Request(`${ORIGINE}/api/discord?chemin=publier`, {
    method: 'POST', headers: { cookie: c, origin: origine, 'content-type': 'application/json' }, body: JSON.stringify(corps),
  }));

  const vide = await (await lire('C1')).json() as { version: unknown; ecrire: boolean };
  egal([vide.version, vide.ecrire], [null, true], 'salon sans publication : aucune version, écriture permise');
  egal((await lire('C2')).status, 403, 'un salon qui n\'est pas blacksmith-reco… : refusé');
  egal((await lire('C3')).status, 403, 'un salon que le membre ne voit pas : refusé');

  egal((await publier({ salon: 'C1', base: null, contenu: fichier('Défenses') }, toto, 'https://ailleurs.example')).status, 403, 'publication d\'une autre origine : refusée');
  const p1 = await publier({ salon: 'C1', base: null, contenu: fichier('Défenses') });
  const v1 = await p1.json() as { version: { messageId: string; reco: Reco } };
  egal([p1.status, v1.version.reco.author, v1.version.reco.contributeurs, v1.version.reco.source], [201, 'Toto le chef', ['Toto le chef'], 'discord:G1:C1'],
    'première publication : postée, auteur et contributeur = surnom du serveur, source du salon');
  egal(w.postes.length, 1, 'un message posté par le bot');

  const lu = await (await lire('C1')).json() as { version: { messageId: string; reco: Reco } };
  egal([lu.version.messageId, lu.version.reco.name], [v1.version.messageId, 'Défenses'], 'la lecture rend la version publiée');

  const lulu = await cookieSession('L');
  egal((await publier({ salon: 'C1', base: v1.version.messageId, contenu: fichier('x') }, lulu)).status, 403, 'sans droit d\'écrire : publication refusée');

  const conflit = await publier({ salon: 'C1', base: null, contenu: fichier('Autre') });
  const c = await conflit.json() as { conflit: boolean; version: { messageId: string } };
  egal([conflit.status, c.conflit, c.version.messageId], [409, true, v1.version.messageId], 'base dépassée : conflit, avec la version courante à fusionner');
  egal(w.postes.length, 1, 'rien n\'est posté en conflit');

  const p2 = await publier({ salon: 'C1', base: v1.version.messageId, contenu: fichier('Défenses v2', { author: 'Moi' }) });
  const v2 = await p2.json() as { version: { reco: Reco } };
  egal([p2.status, v2.version.reco.author], [201, 'Toto le chef'], 'base à jour : publiée, l\'auteur reste le premier publieur');
  egal(w.messages.C1.length, 2, 'la version précédente reste dans le salon');

  egal((await publier({ salon: 'C1', base: 'faux', contenu: 'pas du json' })).status, 409, 'le conflit se vérifie avant le contenu');
  const courante = (await (await lire('C1')).json() as { version: { messageId: string } }).version.messageId;
  egal((await publier({ salon: 'C1', base: courante, contenu: 'pas du json' })).status, 400, 'contenu illisible : refusé');
  egal((await publier({ salon: 'C1', contenu: 'x' })).status, 400, 'corps incomplet : refusé');
}
