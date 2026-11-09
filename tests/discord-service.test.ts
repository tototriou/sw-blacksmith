// Le service Discord des recommandations (api/_source/) : droits sur un salon,
// session chiffrée, version courante d'un salon, fichier publié (auteur,
// contributeurs, source), et chaque route rejouée contre un Discord simulé —
// connexion, sources, lecture d'un salon, publication et conflit.
// Modèle : docs/04-decisions/adr/un-salon-une-reco.md.

import { ADMINISTRATEUR, droitsSurSalon, ENVOYER, JOINDRE, resumeDroits, VOIR_LE_SALON, type Role, type Salon } from '../api/_source/service/droits';
import { candidats, ESSAIS_MAX, lireVersion, nomDuMembre, preparerPublication, type MessageDiscord } from '../api/_source/service/recoSalon';
import { creerRouteur, PAGE_RECOS } from '../api/_source/service/routeur';
import {
  COOKIE_ETAT, COOKIE_SESSION, desceller, empreinte, ENTETE_SESSION, estSession, lireCookies, sceller, signer, verifierSignature, type Cle, type Session,
} from '../api/_source/service/session';
import { fr } from '../src/i18n/fr';
import { decodeRecosJson, encodeRecosJson } from '../src/lib/recoShare';
import { codeBureau, retourDeConnexion } from '../src/lib/discordClient';
import type { Reco } from '../src/types';
import { bits, CDN, LIRE, monde, S, simulateur, TOUT_SALON, type Monde } from './discord-simule';
import { egal, ok, titre } from './outils';

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
  const s: Session = { acces: 'a', renouvellement: 'r', expire: 1, fin: 2, utilisateur: { id: 'U', nom: 'Toto' } };
  const scelle = await sceller(s, cle);
  egal(await desceller(scelle, cle), s, 'scellée puis lue, la session revient intacte');
  ok(!scelle.includes('Toto'), 'le cookie ne laisse rien lire en clair');
  egal(await desceller(scelle, autre), null, 'une autre clé ne lit rien');
  egal(await desceller(scelle.slice(0, -2) + (scelle.endsWith('A') ? 'BB' : 'AA'), cle), null, 'un cookie altéré ne vaut rien');
  egal(await desceller('n\'importe quoi', cle), null, 'un cookie illisible ne vaut rien');
  ok(estSession(s) && !estSession({ acces: 'a' }) && !estSession({ ...s, fin: undefined }), 'forme d\'une session vérifiée, sa fin comprise');
  const sig = await signer('brut:C', cle);
  ok(await verifierSignature('brut:C', sig, cle), 'signature d\'une lecture interne acceptée');
  ok(!(await verifierSignature('brut:D', sig, cle)) && !(await verifierSignature('brut:C', null, cle)), 'autre salon ou signature absente : refusée');
}

export function testDiscordRecoSalon() {
  titre('Service Discord — version courante et fichier publié');
  const m = (id: string, auteur: string, fichiers: string[], taille = 1, url = `${CDN}${id}`): MessageDiscord =>
    ({ id, timestamp: `t${id}`, author: { id: auteur }, attachments: fichiers.map((f) => ({ url, filename: f, size: taille })) });
  const messages = [m('6', 'U', ['Export.JSON']), m('5', 'U', ['gros.json'], 300 * 1024), m('4', 'B', []), m('3', 'B', ['photo.png']),
    m('2', 'U', ['piege.json'], 1, 'https://ailleurs.example/x.json'), m('1', 'B', ['recommandation.json'])];
  egal(candidats(messages).map((c) => c.message.id), ['6', '1'],
    'candidats : un JSON du bot OU d\'un membre ; ni un fichier de plus de 256 Ko, ni une autre extension, ni un lien hors du CDN de Discord');
  egal(candidats(Array.from({ length: 9 }, (_, i) => m(String(9 - i), 'U', ['a.json']))).length, ESSAIS_MAX, 'au plus 5 fichiers essayés par lecture');

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

const CLE: Cle = new Uint8Array(32).fill(3);
const ORIGINE = 'https://sw-blacksmith.vercel.app';

function banc(w: Monde, maintenant = 1_000_000) {
  const routeur = creerRouteur({
    env: { clientId: 'client', clientSecret: 'secret', jetonBot: 'bot', cle: CLE },
    recuperer: simulateur(w), maintenant: () => maintenant, attendre: async () => {}, t: fr, lectureEnCache: false,
  });
  return routeur;
}

const sessionScellee = (utilisateur = 'U', expire = 1e12, fin = 1e12) =>
  sceller({ acces: 'acces-x', renouvellement: 'r', expire, fin, utilisateur: { id: utilisateur, nom: 'Toto' } } satisfies Session, CLE);
async function cookieSession(utilisateur = 'U', expire = 1e12, fin = 1e12) {
  return `${COOKIE_SESSION}=${await sessionScellee(utilisateur, expire, fin)}`;
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
  // Ce que la page lira : le paramètre de l'adresse, puis la route.
  const lu = (r: Response) => { const u = new URL(r.headers.get('location') ?? '', ORIGINE); return [retourDeConnexion(u.search), u.hash]; };
  egal(lu(faux), ['erreur', '#/siege/recommandations'], 'un état qui ne correspond pas : refusé, aucune session, et la page le lit');
  ok(!faux.headers.getSetCookie().some((c) => c.startsWith(`${COOKIE_SESSION}=`)), 'aucun cookie de session posé');
  const refus = await r.traiter(requete(`callback&error=access_denied&state=${etat}`, { cookie: `${COOKIE_ETAT}=${etat}` }));
  egal(lu(refus), ['refus', '#/siege/recommandations'], 'autorisation refusée par le membre : la page le lit');

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
  egal((await r.traiter(requete('session', { cookie: await cookieSession('U', 1e12, 1_000_000) }))).status, 401, 'session de plus de 30 jours : non connecté');
  w.jetonRefuse = true;
  egal((await r.traiter(requete('session', { cookie: await cookieSession('U', 1_000_000) }))).status, 401, 'renouvellement refusé : non connecté');

  const sortie = await r.traiter(requete('deconnexion', { method: 'POST', cookie: await cookieSession() }));
  ok(sortie.status === 204 && sortie.headers.getSetCookie().some((c) => c.startsWith(`${COOKIE_SESSION}=;`) && c.includes('Max-Age=0')), 'déconnexion : cookie effacé');
  ok(w.appels.includes('POST /oauth2/token/revoke'), 'déconnexion : le jeton est révoqué chez Discord');
  egal((await r.traiter(new Request(`${ORIGINE}/api/discord?chemin=deconnexion`, { method: 'POST', headers: { origin: 'https://ailleurs.example' } }))).status, 403,
    'une requête POST d\'une autre origine est refusée');
}

export async function testDiscordRouteurBureau() {
  titre('Service Discord — connexion de l\'application de bureau : code à copier, session en Bearer');
  const w = monde();
  const r = banc(w);
  const secret = 'secret-de-l-app-'.padEnd(43, 'x');
  const defi = await empreinte(secret);
  egal((await r.traiter(requete('login&bureau=pas-un-defi'))).status, 400, 'un défi mal formé est refusé');
  const login = await r.traiter(requete(`login&bureau=${defi}`));
  const etat = new URL(login.headers.get('location') ?? '').searchParams.get('state') ?? '';
  const cookieEtat = (login.headers.get('set-cookie') ?? '').split(';')[0];
  egal(cookieEtat, `${COOKIE_ETAT}=${etat}.${defi}`, 'le défi est gardé avec l\'état anti-falsification');

  const refus = await r.traiter(requete(`callback&error=access_denied&state=${etat}`, { cookie: cookieEtat }));
  egal(new URL(refus.headers.get('location') ?? '', ORIGINE).search, '?discord=refus-bureau', 'refus : dit sur le site, sans toucher à sa connexion');
  const retour = await r.traiter(requete(`callback&code=c&state=${etat}`, { cookie: cookieEtat }));
  ok(!retour.headers.getSetCookie().some((c) => c.startsWith(`${COOKIE_SESSION}=`) && !c.includes('Max-Age=0')), 'aucune session posée sur le site');
  const adresse = new URL(retour.headers.get('location') ?? '', ORIGINE);
  const code = codeBureau(adresse.search) ?? '';
  ok(code.length > 50 && adresse.hash === '#/siege/recommandations', 'le site reçoit le code à copier, sur la page Recommandations');
  ok(await desceller(code, CLE) !== null && !estSession(await desceller(code, CLE)), 'le code n\'est pas une session : il ne s\'utilise pas tel quel');

  const echanger = (corps: unknown, rr = r) => rr.traiter(new Request(`${ORIGINE}/api/discord?chemin=bureau-echange`, { method: 'POST', body: JSON.stringify(corps) }));
  egal((await echanger({ code, secret: 'un autre secret' })).status, 400, 'sans le secret de l\'app, le code ne vaut rien');
  egal((await echanger({ code: 'abimé', secret })).status, 400, 'un code illisible est refusé');
  egal((await echanger({ code, secret }, banc(w, 1_000_000 + 11 * 60_000))).status, 400, 'un code de plus de 10 minutes est refusé');
  const echange = await echanger({ code, secret });
  const corps = await echange.json() as { session: string; utilisateur: unknown };
  egal([echange.status, corps.utilisateur], [200, { id: 'U', nom: 'Toto' }], 'le bon secret, sans origine web : la session et l\'identité');

  const bearer = (chemin: string, session: string, init: RequestInit = {}) =>
    new Request(`${ORIGINE}/api/discord?chemin=${chemin}`, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${session}` } });
  egal(await (await r.traiter(bearer('session', corps.session))).json(), { connecte: true, utilisateur: { id: 'U', nom: 'Toto' } }, 'la session se lit en Bearer');
  const sources = await r.traiter(bearer('sources', corps.session, { headers: { cookie: await cookieSession('L') } }));
  egal((await sources.json() as { utilisateur: { id: string } }).utilisateur.id, 'U', 'en Bearer, le cookie (d\'un autre membre) est ignoré');
  const echue = await r.traiter(bearer('session', await sessionScellee('U', 1_000_000)));
  const renouvelee = echue.headers.get(ENTETE_SESSION);
  ok(echue.status === 200 && !!renouvelee && echue.headers.getSetCookie().length === 0, 'jeton échu : la session renouvelée revient par un en-tête, pas par un cookie');
  egal((await r.traiter(bearer('session', renouvelee ?? ''))).status, 200, 'la session renouvelée se relit');
  egal((await r.traiter(bearer('deconnexion', corps.session, { method: 'POST' }))).status, 204, 'déconnexion en Bearer, sans origine web');
  ok(w.appels.includes('POST /oauth2/token/revoke'), 'le jeton est révoqué');
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
  // ⚠️ Discord n'accepte que 10 lectures par minute de la liste des salons
  // d'un serveur : trois requêtes n'en font qu'une.
  egal(w.appels.filter((a) => a === 'GET /guilds/G1/channels').length, 1, 'la liste des salons d\'un serveur n\'est lue qu\'une fois par minute');
}

export async function testDiscordRouteurToutEtLimites() {
  titre('Service Discord — lecture d\'ouverture en une requête, limites de Discord');
  const w = monde();
  w.messages.C1 = [{ id: '7', timestamp: 't7', author: { id: 'B' }, attachments: [{ url: `${CDN}7`, filename: 'recommandation.json', size: 1 }] }];
  w.pieces[`${CDN}7`] = fichier('Défenses');
  const r = banc(w);
  const rep = await r.traiter(requete('tout', { cookie: await cookieSession() }));
  const corps = await rep.json() as { serveurs: { salons: { id: string }[] }[]; versions: Record<string, { messageId: string; reco: Reco } | null> };
  egal([rep.status, corps.serveurs[0].salons.map((s) => s.id), corps.versions.C1?.messageId, corps.versions.C1?.reco.name], [200, ['C1'], '7', 'Défenses'],
    '`tout` : les sources et la version de chaque salon, en une requête');
  egal(w.appels.filter((a) => a.startsWith('GET /guilds/G1/members/')).length, 2, 'le bot et le membre lus une fois chacun, pas une fois par salon');

  const salonSeul = monde();
  const r2 = banc(salonSeul);
  await r2.traiter(requete('salon&id=C1', { cookie: await cookieSession() }));
  egal(salonSeul.appels.includes('GET /guilds/G1/channels'), false, 'lire un salon précis ne lit pas la liste des salons du serveur');

  const sig = await signer('salons:G1', CLE);
  egal((await r.traiter(requete(`salons-serveur&serveur=G1&sig=${encodeURIComponent(sig)}`))).headers.get('Vercel-CDN-Cache-Control'), 'max-age=60',
    'la liste des salons d\'un serveur : adresse interne gardée 60 s par le CDN');
  egal((await r.traiter(requete('salons-serveur&serveur=G1&sig=faux'))).status, 403, 'sans signature valide : refusée');

  const limite = monde();
  const r3 = creerRouteur({
    env: { clientId: 'client', clientSecret: 'secret', jetonBot: 'bot', cle: CLE },
    recuperer: async (url, init) => (url.includes('/guilds/G1/channels') ? new Response(JSON.stringify({ retry_after: 42 }), { status: 429 }) : simulateur(limite)(url, init)),
    maintenant: () => 1_000_000, attendre: async () => {}, t: fr, lectureEnCache: false,
  });
  const lim = await r3.traiter(requete('tout', { cookie: await cookieSession() }));
  egal([lim.status, await lim.json()], [503, { erreur: 'limite' }], 'Discord limite au-delà de l\'attente tolérée : « limite », pas une panne');
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

  // Fichiers déposés à la main par des membres : le plus récent VALIDE fait foi.
  const msg = (id: string, auteur: string, nomFichier = 'export.json'): MessageDiscord =>
    ({ id, timestamp: `t${id}`, author: { id: auteur }, attachments: [{ url: `${CDN}${id}`, filename: nomFichier, size: 1 }] });
  const parLulu = fichier('Offs de Lulu', { author: 'Lulu' });
  w.messages.C1.unshift(msg('900', 'L'));
  w.pieces[`${CDN}900`] = parLulu;
  const deposee = await (await lire('C1')).json() as { version: { messageId: string; reco: Reco } };
  egal([deposee.version.messageId, deposee.version.reco.name, deposee.version.reco.author], ['900', 'Offs de Lulu', 'Lulu'],
    'un fichier déposé à la main par un membre devient la version courante ; son auteur est celui du fichier');
  w.messages.C1.unshift(msg('904', 'L'), msg('903', 'L'), msg('902', 'L'), msg('901', 'L'));
  const sansEntete = JSON.parse(fichier('Sans en-tête')) as Record<string, unknown>;
  delete sansEntete.format;
  w.pieces[`${CDN}904`] = JSON.stringify(sansEntete);
  w.pieces[`${CDN}903`] = '{"format":"autre-chose"}';
  w.pieces[`${CDN}902`] = encodeRecosJson([reco('Une'), reco('Deux')]);
  w.pieces[`${CDN}901`] = 'pas du json';
  const ignores = await (await lire('C1')).json() as { version: { messageId: string } };
  egal(ignores.version.messageId, '900',
    'ignorés : un fichier sans l\'en-tête SW Blacksmith, d\'un autre format, à deux recommandations, illisible ; le plus récent valide reste');
  const p3 = await publier({ salon: 'C1', base: '900', contenu: fichier('Offs v2') });
  const v3 = await p3.json() as { version: { reco: Reco } };
  egal([p3.status, v3.version.reco.author, v3.version.reco.contributeurs], [201, 'Lulu', ['Toto le chef']],
    'publier par-dessus un fichier déposé : sa base est ce fichier, l\'auteur reste celui du fichier');
}
