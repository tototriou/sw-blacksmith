// Le service Discord des recommandations : une fonction Vercel sans état, qui
// relaie chaque requête vers l'API de Discord et ne garde rien
// (docs/04-decisions/adr/local-par-defaut.md, docs/04-decisions/adr/un-salon-une-reco.md).
// Routes et réponses : docs/02-app/siege/feat-recommandations/service-discord.md.
//
// Toutes les dépendances sont injectées (fetch, horloge, hasard, clés) : les
// tests rejouent chaque route contre un Discord simulé.

import type { Dictionnaire } from '../../../src/i18n/fr';
import type { RecoPayload } from '../../../src/types';
import { client, ErreurDiscord, API, type Recuperer } from './discordApi';
import { droitsServeur, droitsSurSalon, estAdministrateur, resumeDroits, type DroitsSalon, type Exception, type Role, type Salon } from './droits';
import { candidats, lireVersion, nomDuMembre, NOM_FICHIER, preparerPublication, sourceDuSalon, TAILLE_MAX, type MessageDiscord } from './recoSalon';
import {
  COOKIE_ETAT, COOKIE_SESSION, cookie, cookieEfface, desceller, DUREE_CODE_S, DUREE_ETAT_S, DUREE_SESSION_S, empreinte, ENTETE_SESSION, estCodeBureau,
  estSession, FORME_DEFI, jetonPorteur, lireCookies, sceller, signer, verifierSignature, type Cle, type CodeBureau, type Session,
} from './session';

export const PREFIXE_SALON = 'blacksmith-reco';
const ROUTE_RECOS = '#/siege/recommandations';
export const PAGE_RECOS = `/${ROUTE_RECOS}`;
// ⚠️ Le paramètre AVANT la route : `/?discord=refus#/siege/…`. Collé après
// `PAGE_RECOS`, il deviendrait `discord=refus/`, que la page ne reconnaît pas.
export const retourPage = (parametre: string, valeur: string) => `/?${parametre}=${valeur}${ROUTE_RECOS}`;
const DUREE_CACHE_MS = 30_000; // droits, rôles et salons d'un serveur (décision du 2026-11-09)
const CACHE_LECTURE_S = 15; // lecture d'un salon, partagée par le CDN entre membres
const CACHE_SALONS_S = 60; // liste des salons d'un serveur : 10 lectures par minute chez Discord
const MARGE_RENOUVELLEMENT_MS = 60_000;

export interface Environnement {
  clientId: string;
  clientSecret: string;
  jetonBot: string;
  cle: Cle; // CLE_SESSION
  contournement?: string; // VERCEL_AUTOMATION_BYPASS_SECRET : la lecture interne passe la protection des aperçus
}

export interface Dependances {
  env: Environnement;
  recuperer: Recuperer;
  maintenant: () => number;
  attendre: (ms: number) => Promise<void>;
  t: Dictionnaire;
  // Lecture d'un salon par l'adresse interne mise en cache. Désactivée dans les
  // tests, qui lisent directement.
  lectureEnCache: boolean;
}

interface MembreDiscord { roles: string[]; nick?: string | null; user?: { id: string; username: string; global_name?: string | null } }
interface ServeurDiscord { id: string; name: string; icon: string | null; owner_id: string; roles: Role[] }
interface ServeurMembre { id: string; name: string; icon: string | null; owner?: boolean }
interface SalonBrut { id: string; guild_id?: string; name: string; type: number; permission_overwrites?: Exception[] }

export interface Version { messageId: string; date: string; texte: string }
export interface VersionLue { messageId: string; date: string; reco: RecoPayload | null }

interface Acces { serveurId: string; salon: Salon; membre: MembreDiscord; utilisateur: DroitsSalon; bot: DroitsSalon }

class Cache<T> {
  private valeurs = new Map<string, { expire: number; valeur: Promise<T> }>();
  constructor(private maintenant: () => number, private duree: number) {}
  obtenir(cle: string, calculer: () => Promise<T>): Promise<T> {
    const v = this.valeurs.get(cle);
    if (v && v.expire > this.maintenant()) return v.valeur;
    const valeur = calculer();
    this.valeurs.set(cle, { expire: this.maintenant() + this.duree, valeur });
    // Un échec ne reste pas en cache : la requête suivante réessaie.
    valeur.catch(() => this.valeurs.delete(cle));
    return valeur;
  }
}

function json(statut: number, corps: unknown, entetes: Record<string, string> = {}, cookies: string[] = []): Response {
  const h = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...entetes });
  for (const c of cookies) h.append('Set-Cookie', c);
  return new Response(statut === 204 ? null : JSON.stringify(corps), { status: statut, headers: h });
}

function redirection(vers: string, cookies: string[] = []): Response {
  const h = new Headers({ Location: vers, 'Cache-Control': 'no-store' });
  for (const c of cookies) h.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers: h });
}

export function creerRouteur(d: Dependances) {
  const discord = client(d.recuperer, d.env.jetonBot, d.attendre);
  const cacheBot = new Cache<{ id: string }>(d.maintenant, 24 * 3600_000);
  const cacheServeursBot = new Cache<Set<string>>(d.maintenant, DUREE_CACHE_MS);
  const cacheServeur = new Cache<{ serveur: ServeurDiscord; bot: MembreDiscord }>(d.maintenant, DUREE_CACHE_MS);
  const cacheSalonsServeur = new Cache<SalonBrut[]>(d.maintenant, CACHE_SALONS_S * 1000);
  const cacheMembre = new Cache<MembreDiscord | null>(d.maintenant, DUREE_CACHE_MS);
  const cacheSalon = new Cache<SalonBrut | null>(d.maintenant, DUREE_CACHE_MS);

  // L'identifiant du bot est la première partie de son jeton (base64) : un
  // appel à Discord de moins. Repli sur `/users/@me` pour un jeton d'une autre forme.
  const idDuJeton = Buffer.from(d.env.jetonBot.split('.')[0] ?? '', 'base64').toString();
  const idBot = () => /^\d+$/.test(idDuJeton)
    ? Promise.resolve(idDuJeton)
    : cacheBot.obtenir('moi', () => discord.bot<{ id: string }>('/users/@me')).then((b) => b.id);

  // Un serveur : ses rôles, son propriétaire, et le bot qui y est membre — ce
  // qu'il faut pour les droits. ⚠️ Jamais sa liste de salons : voir `salonsDuServeur`.
  function serveur(id: string) {
    return cacheServeur.obtenir(id, async () => {
      const botId = await idBot();
      const [serveur, bot] = await Promise.all([
        discord.bot<ServeurDiscord>(`/guilds/${id}`),
        discord.bot<MembreDiscord>(`/guilds/${id}/members/${botId}`),
      ]);
      return { serveur, bot };
    });
  }

  // ⚠️ La liste des salons d'un serveur : Discord n'en accepte que 10 lectures
  // par MINUTE et par serveur, pour tout le bot (mesuré le 2026-11-09) — un
  // quota partagé par toute la guilde. Elle passe donc par une adresse interne
  // signée que le CDN garde 60 s, commune à tous les membres ; seule la
  // découverte des salons (`tout`, `sources`) en a besoin, jamais l'accès à un
  // salon précis, qui lit le salon seul.
  function salonsDirect(serveurId: string) {
    return discord.bot<SalonBrut[]>(`/guilds/${serveurId}/channels`);
  }
  function salonsDuServeur(origine: string, serveurId: string) {
    return cacheSalonsServeur.obtenir(serveurId, async () => {
      if (!d.lectureEnCache) return salonsDirect(serveurId);
      const sig = await signer(`salons:${serveurId}`, d.env.cle);
      try {
        const r = await d.recuperer(`${origine}/api/discord/salons-serveur?serveur=${encodeURIComponent(serveurId)}&sig=${encodeURIComponent(sig)}`, { headers: contournement() });
        if (r.ok) return ((await r.json()) as { salons: SalonBrut[] }).salons;
      } catch { /* repli ci-dessous */ }
      return salonsDirect(serveurId);
    });
  }
  const contournement = (): Record<string, string> => (d.env.contournement ? { 'x-vercel-protection-bypass': d.env.contournement } : {});

  // Un membre absent du serveur (404) n'y a aucun accès.
  function membre(serveurId: string, userId: string) {
    return cacheMembre.obtenir(`${serveurId}:${userId}`, () => discord.bot<MembreDiscord>(`/guilds/${serveurId}/members/${userId}`)
      .catch((e) => { if (e instanceof ErreurDiscord && e.statut === 404) return null; throw e; }));
  }

  function droits(s: { serveur: ServeurDiscord; bot: MembreDiscord }, salon: Salon, m: MembreDiscord, userId: string, botId: string) {
    const serveurId = s.serveur.id;
    return {
      utilisateur: resumeDroits(droitsSurSalon(serveurId, s.serveur.owner_id, s.serveur.roles, salon, { roles: m.roles, userId })),
      bot: resumeDroits(droitsSurSalon(serveurId, s.serveur.owner_id, s.serveur.roles, salon, { roles: s.bot.roles, userId: botId })),
    };
  }

  const estSalonDeRecos = (s: SalonBrut) => s.type === 0 && s.name.startsWith(PREFIXE_SALON);

  async function acces(salonId: string, userId: string): Promise<Acces | null> {
    const salon = await cacheSalon.obtenir(salonId, () => discord.bot<SalonBrut>(`/channels/${salonId}`)
      .catch((e) => { if (e instanceof ErreurDiscord && (e.statut === 403 || e.statut === 404)) return null; throw e; }));
    if (!salon?.guild_id || !estSalonDeRecos(salon)) return null;
    const [s, m, botId] = await Promise.all([serveur(salon.guild_id), membre(salon.guild_id, userId), idBot()]);
    if (!m) return null;
    const complet: Salon = { ...salon, guild_id: salon.guild_id };
    return { serveurId: salon.guild_id, salon: complet, membre: m, ...droits(s, complet, m, userId, botId) };
  }

  // La version courante : le plus récent fichier VALIDE du salon, du bot ou
  // d'un membre (voir `candidats`). Un candidat illisible ou invalide passe au
  // suivant ; un téléchargement en échec aussi.
  async function lireDirect(salonId: string): Promise<Version | null> {
    const messages = await discord.bot<MessageDiscord[]>(`/channels/${salonId}/messages?limit=100`);
    for (const c of candidats(messages)) {
      const texte = await discord.telecharger(c.url).catch(() => null);
      if (texte !== null && lireVersion(texte, d.t)) return { messageId: c.message.id, date: c.message.timestamp, texte };
    }
    return null;
  }

  // La lecture passe par une adresse interne signée, que le CDN garde 15 s :
  // un soir de siège, toute la guilde ouvre la page, et Discord n'accepte
  // qu'environ 5 lectures par seconde et par salon. Les droits, eux, restent
  // vérifiés pour chaque membre AVANT cette lecture. Repli sur une lecture
  // directe si l'adresse interne ne répond pas.
  async function lireEnCache(origine: string, salonId: string): Promise<Version | null> {
    if (!d.lectureEnCache) return lireDirect(salonId);
    const sig = await signer(`brut:${salonId}`, d.env.cle);
    try {
      const r = await d.recuperer(`${origine}/api/discord/brut?salon=${encodeURIComponent(salonId)}&sig=${encodeURIComponent(sig)}`, { headers: contournement() });
      if (r.ok) return ((await r.json()) as { version: Version | null }).version;
    } catch { /* repli ci-dessous */ }
    return lireDirect(salonId);
  }

  const versionLue = (v: Version | null): VersionLue | null => (v ? { messageId: v.messageId, date: v.date, reco: lireVersion(v.texte, d.t) } : null);

  async function jetons(corps: Record<string, string>) {
    const r = await d.recuperer(`${API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...corps, client_id: d.env.clientId, client_secret: d.env.clientSecret }),
    });
    if (!r.ok) throw new ErreurDiscord(r.status, null, 'jeton refusé');
    return (await r.json()) as { access_token: string; refresh_token: string; expires_in: number };
  }

  const finDeSession = () => d.maintenant() + DUREE_SESSION_S * 1000;

  // La session — du cookie (site) ou de `Authorization: Bearer` (application
  // de bureau) —, renouvelée si son jeton d'accès arrive à échéance :
  // `renouvelee` est alors la session scellée à rendre.
  async function lireSession(requete: Request, jeton: string | null): Promise<{ session: Session; renouvelee: string | null } | null> {
    const scellee = jeton ?? lireCookies(requete.headers.get('cookie')).get(COOKIE_SESSION);
    const brut = await desceller<unknown>(scellee, d.env.cle);
    if (!estSession(brut) || brut.fin <= d.maintenant()) return null;
    if (brut.expire > d.maintenant() + MARGE_RENOUVELLEMENT_MS) return { session: brut, renouvelee: null };
    try {
      const j = await jetons({ grant_type: 'refresh_token', refresh_token: brut.renouvellement });
      const session: Session = { ...brut, acces: j.access_token, renouvellement: j.refresh_token, expire: d.maintenant() + j.expires_in * 1000, fin: finDeSession() };
      return { session, renouvelee: await sceller(session, d.env.cle) };
    } catch {
      return null;
    }
  }

  async function traiter(requete: Request): Promise<Response> {
    const url = new URL(requete.url);
    const chemin = (url.searchParams.get('chemin') ?? url.pathname.replace(/^\/api\/discord\/?/, '')).replace(/\/+$/, '');
    const securise = url.protocol === 'https:';
    const route = `${requete.method} ${chemin}`;
    const nonConnecte = () => json(401, { connecte: false }, {}, [cookieEfface(COOKIE_SESSION, securise)]);
    // L'application de bureau envoie sa session en `Authorization: Bearer` ;
    // le cookie est alors ignoré.
    const jeton = jetonPorteur(requete.headers.get('authorization'));

    // Une requête qui modifie quelque chose vient de la page elle-même : même
    // origine, jamais un formulaire d'un autre site (le cookie SameSite=Lax
    // l'écarte déjà, ceci le vérifie une seconde fois). L'application de
    // bureau n'a pas d'origine web : sa session n'est pas un cookie, qu'un
    // autre site ne peut donc pas faire porter à une requête ; l'échange du
    // code, lui, ne vaut rien sans le secret de l'app.
    const sansCookie = jeton !== null || route === 'POST bureau-echange';
    if (requete.method === 'POST' && !sansCookie && requete.headers.get('origin') !== url.origin) return json(403, { erreur: 'origine' });

    // `?bureau=<défi>` : la connexion est demandée par l'application de bureau.
    // Le défi est gardé avec l'état anti-falsification, dans le même cookie.
    if (route === 'GET login') {
      const defi = url.searchParams.get('bureau');
      if (defi !== null && !FORME_DEFI.test(defi)) return json(400, { erreur: 'defi' });
      const etat = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url');
      const params = new URLSearchParams({
        response_type: 'code', client_id: d.env.clientId, scope: 'identify guilds',
        redirect_uri: `${url.origin}/api/discord/callback`, state: etat, prompt: 'none',
      });
      return redirection(`https://discord.com/oauth2/authorize?${params}`, [cookie(COOKIE_ETAT, defi ? `${etat}.${defi}` : etat, DUREE_ETAT_S, securise)]);
    }

    // L'invitation du bot sur un serveur, SANS AUCUN DROIT : l'admin l'ajoute
    // ensuite aux salons de recommandations, avec les quatre droits qu'il y
    // faut. L'identifiant vient de l'environnement : un aperçu invite le bot
    // de test, la production le sien.
    if (route === 'GET invitation') {
      const params = new URLSearchParams({ client_id: d.env.clientId, scope: 'bot', permissions: '0' });
      return redirection(`https://discord.com/oauth2/authorize?${params}`);
    }

    if (route === 'GET callback') {
      const efface = cookieEfface(COOKIE_ETAT, securise);
      const [etat, defi] = (lireCookies(requete.headers.get('cookie')).get(COOKIE_ETAT) ?? '').split('.');
      // Pour l'application de bureau, l'échec est dit sur le site sans toucher
      // à la connexion du site.
      const echec = (quoi: 'refus' | 'erreur') => redirection(retourPage('discord', defi ? `${quoi}-bureau` : quoi), [efface]);
      const code = url.searchParams.get('code');
      if (url.searchParams.get('error')) return echec('refus');
      if (!code || !etat || etat !== url.searchParams.get('state')) return echec('erreur');
      try {
        const j = await jetons({ grant_type: 'authorization_code', code, redirect_uri: `${url.origin}/api/discord/callback` });
        const moi = await discord.membre<{ id: string; username: string; global_name?: string | null }>(j.access_token, '/users/@me');
        const session: Session = {
          acces: j.access_token, renouvellement: j.refresh_token, expire: d.maintenant() + j.expires_in * 1000, fin: finDeSession(),
          utilisateur: { id: moi.id, nom: (moi.global_name || moi.username).slice(0, 40) },
        };
        // Application de bureau : aucun cookie de session sur le site ; la
        // page du site affiche le code à copier dans l'app.
        if (defi) {
          const pourBureau: CodeBureau = { session, defi, expire: d.maintenant() + DUREE_CODE_S * 1000 };
          return redirection(retourPage('discord-bureau', await sceller(pourBureau, d.env.cle)), [efface]);
        }
        return redirection(PAGE_RECOS, [efface, cookie(COOKIE_SESSION, await sceller(session, d.env.cle), DUREE_SESSION_S, securise)]);
      } catch {
        return echec('erreur');
      }
    }

    // L'application de bureau échange le code collé contre sa session, en
    // prouvant qu'elle a demandé la connexion : son secret, dont le défi est
    // l'empreinte.
    if (route === 'POST bureau-echange') {
      let corps: { code?: unknown; secret?: unknown };
      try { corps = JSON.parse(await requete.text()); } catch { return json(400, { erreur: 'corps' }); }
      const c = typeof corps.code === 'string' ? await desceller<unknown>(corps.code, d.env.cle) : null;
      const valide = estCodeBureau(c) && c.expire > d.maintenant() && typeof corps.secret === 'string' && (await empreinte(corps.secret)) === c.defi;
      if (!valide) return json(400, { erreur: 'code' });
      const session: Session = { ...c.session, fin: finDeSession() };
      return json(200, { session: await sceller(session, d.env.cle), utilisateur: session.utilisateur });
    }

    if (route === 'GET brut') {
      const salonId = url.searchParams.get('salon') ?? '';
      if (!(await verifierSignature(`brut:${salonId}`, url.searchParams.get('sig'), d.env.cle))) return json(403, { erreur: 'signature' });
      return json(200, { version: await lireDirect(salonId) }, { 'Vercel-CDN-Cache-Control': `max-age=${CACHE_LECTURE_S}` });
    }

    if (route === 'GET salons-serveur') {
      const serveurId = url.searchParams.get('serveur') ?? '';
      if (!(await verifierSignature(`salons:${serveurId}`, url.searchParams.get('sig'), d.env.cle))) return json(403, { erreur: 'signature' });
      return json(200, { salons: await salonsDirect(serveurId) }, { 'Vercel-CDN-Cache-Control': `max-age=${CACHE_SALONS_S}` });
    }

    const lue = await lireSession(requete, jeton);
    // Une session renouvelée revient au site par son cookie, à l'application
    // de bureau par un en-tête.
    const renouvelee = lue?.renouvelee ?? null;
    const enTetes: Record<string, string> = renouvelee && jeton ? { [ENTETE_SESSION]: renouvelee } : {};
    const cookies = renouvelee && !jeton ? [cookie(COOKIE_SESSION, renouvelee, DUREE_SESSION_S, securise)] : [];
    const repondre = (statut: number, corps: unknown) => json(statut, corps, enTetes, cookies);

    if (route === 'GET session') {
      return lue ? repondre(200, { connecte: true, utilisateur: lue.session.utilisateur }) : nonConnecte();
    }

    if (route === 'POST deconnexion') {
      if (lue) {
        await d.recuperer(`${API}/oauth2/token/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: lue.session.acces, token_type_hint: 'access_token', client_id: d.env.clientId, client_secret: d.env.clientSecret }),
        }).catch(() => undefined);
      }
      return json(204, null, {}, [cookieEfface(COOKIE_SESSION, securise)]);
    }

    if (!lue) return nonConnecte();
    const { session } = lue;

    // Les serveurs communs au membre et au bot, et dans chacun les salons de
    // recommandations que le bot et le membre peuvent lire.
    async function decouvrir() {
      const [siens, duBot, botId] = await Promise.all([
        discord.membre<ServeurMembre[]>(session.acces, '/users/@me/guilds'),
        cacheServeursBot.obtenir('serveurs', async () => new Set((await discord.bot<{ id: string }[]>('/users/@me/guilds')).map((g) => g.id))),
        idBot(),
      ]);
      const serveurs = await Promise.all(siens.filter((g) => duBot.has(g.id)).map(async (g) => {
        const [s, salonsBruts, m] = await Promise.all([serveur(g.id), salonsDuServeur(url.origin, g.id), membre(g.id, session.utilisateur.id)]);
        if (!m) return null;
        const salons = salonsBruts.filter(estSalonDeRecos).flatMap((brut) => {
          const salon: Salon = { ...brut, guild_id: g.id };
          const r = droits(s, salon, m, session.utilisateur.id, botId);
          return r.bot.lire && r.utilisateur.lire ? [{ id: salon.id, nom: salon.name, ecrire: r.utilisateur.ecrire && r.bot.joindre }] : [];
        });
        const botAdmin = estAdministrateur(droitsServeur(g.id, null, s.serveur.roles, { roles: s.bot.roles, userId: botId }));
        return salons.length ? { id: g.id, nom: g.name, icone: g.icon, botAdmin, salons } : null;
      }));
      return serveurs.filter((s) => s !== null);
    }

    try {
      if (route === 'GET sources') {
        return repondre(200, { utilisateur: session.utilisateur, serveurs: await decouvrir() });
      }

      // ⚠️ La lecture d'ouverture de page, en UNE requête : les sources, puis
      // la version de chaque salon lisible. Le serveur, le bot et le membre ne
      // sont lus qu'une fois, là où un appel par salon les relirait chacun.
      if (route === 'GET tout') {
        const serveurs = await decouvrir();
        const salons = serveurs.flatMap((s) => s.salons.map((c) => c.id));
        const lues = await Promise.all(salons.map((id) => lireEnCache(url.origin, id).then(versionLue)));
        const versions = Object.fromEntries(salons.map((id, i) => [id, lues[i]]));
        return repondre(200, { utilisateur: session.utilisateur, serveurs, versions });
      }

      if (route === 'GET salon') {
        const salonId = url.searchParams.get('id') ?? '';
        const a = await acces(salonId, session.utilisateur.id);
        if (!a || !a.utilisateur.lire || !a.bot.lire) return repondre(403, { acces: false });
        const version = versionLue(await lireEnCache(url.origin, salonId));
        return repondre(200, { serveurId: a.serveurId, salonId, nom: a.salon.name, ecrire: a.utilisateur.ecrire && a.bot.joindre, version });
      }

      if (route === 'POST publier') {
        const texte = await requete.text();
        if (texte.length > TAILLE_MAX * 2) return repondre(413, { erreur: 'trop-gros' });
        let corps: { salon?: unknown; base?: unknown; contenu?: unknown };
        try { corps = JSON.parse(texte); } catch { return repondre(400, { erreur: 'corps' }); }
        if (typeof corps.salon !== 'string' || typeof corps.contenu !== 'string' || (corps.base !== null && typeof corps.base !== 'string')) {
          return repondre(400, { erreur: 'corps' });
        }
        const a = await acces(corps.salon, session.utilisateur.id);
        if (!a || !a.utilisateur.ecrire) return repondre(403, { acces: !!a?.utilisateur.lire });
        if (!a.bot.joindre) return repondre(503, { erreur: 'bot-sans-droit' });
        // ⚠️ Lecture DIRECTE, jamais par le cache : la comparaison à la base
        // doit voir la toute dernière version (« publier relit le salon »).
        const courante = await lireDirect(corps.salon);
        if ((courante?.messageId ?? null) !== corps.base) return repondre(409, { conflit: true, version: versionLue(courante) });
        const precedente = courante ? lireVersion(courante.texte, d.t) : null;
        const publieur = nomDuMembre(a.membre) || session.utilisateur.nom;
        const p = preparerPublication(corps.contenu, publieur, precedente, sourceDuSalon(a.serveurId, corps.salon), d.t);
        if (!p.ok) return repondre(400, { erreur: 'contenu', details: p.erreurs });
        const fd = new FormData();
        fd.append('payload_json', JSON.stringify({ attachments: [{ id: 0, filename: NOM_FICHIER }] }));
        fd.append('files[0]', new Blob([p.texte], { type: 'application/json' }), NOM_FICHIER);
        const message = await discord.bot<{ id: string; timestamp: string }>(`/channels/${corps.salon}/messages`, { method: 'POST', body: fd });
        return repondre(201, { version: { messageId: message.id, date: message.timestamp, reco: p.reco } });
      }
    } catch (e) {
      // Le jeton du membre refusé par Discord : la session ne vaut plus rien.
      if (e instanceof ErreurDiscord && e.statut === 401 && e.duMembre) return nonConnecte();
      // Discord limite les appels au-delà de ce que le service attend : la
      // page le dit (« réessaie dans une minute ») plutôt qu'une panne.
      if (e instanceof ErreurDiscord && e.statut === 429) return repondre(503, { erreur: 'limite' });
      if (e instanceof ErreurDiscord) return repondre(502, { erreur: 'discord', statut: e.statut });
      throw e;
    }

    return repondre(404, { erreur: 'route' });
  }

  return { traiter };
}
