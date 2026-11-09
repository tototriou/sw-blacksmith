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
import { lireVersion, nomDuMembre, NOM_FICHIER, preparerPublication, sourceDuSalon, TAILLE_MAX, versionCourante, type MessageDiscord } from './recoSalon';
import {
  COOKIE_ETAT, COOKIE_SESSION, cookie, cookieEfface, desceller, DUREE_ETAT_S, DUREE_SESSION_S, estSession, lireCookies, sceller, signer,
  verifierSignature, type Cle, type Session,
} from './session';

export const PREFIXE_SALON = 'blacksmith-reco';
export const PAGE_RECOS = '/#/siege/recommandations';
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

  async function lireDirect(salonId: string): Promise<Version | null> {
    const [messages, botId] = await Promise.all([discord.bot<MessageDiscord[]>(`/channels/${salonId}/messages?limit=100`), idBot()]);
    const courante = versionCourante(messages, botId);
    if (!courante) return null;
    return { messageId: courante.message.id, date: courante.message.timestamp, texte: await discord.telecharger(courante.url) };
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

  // La session du cookie, renouvelée si son jeton d'accès arrive à échéance.
  async function lireSession(requete: Request, securise: boolean): Promise<{ session: Session; cookies: string[] } | null> {
    const brut = await desceller<unknown>(lireCookies(requete.headers.get('cookie')).get(COOKIE_SESSION), d.env.cle);
    if (!estSession(brut)) return null;
    if (brut.expire > d.maintenant() + MARGE_RENOUVELLEMENT_MS) return { session: brut, cookies: [] };
    try {
      const j = await jetons({ grant_type: 'refresh_token', refresh_token: brut.renouvellement });
      const session: Session = { ...brut, acces: j.access_token, renouvellement: j.refresh_token, expire: d.maintenant() + j.expires_in * 1000 };
      return { session, cookies: [cookie(COOKIE_SESSION, await sceller(session, d.env.cle), DUREE_SESSION_S, securise)] };
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

    // Une requête qui modifie quelque chose vient de la page elle-même : même
    // origine, jamais un formulaire d'un autre site (le cookie SameSite=Lax
    // l'écarte déjà, ceci le vérifie une seconde fois).
    if (requete.method === 'POST' && requete.headers.get('origin') !== url.origin) return json(403, { erreur: 'origine' });

    if (route === 'GET login') {
      const etat = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url');
      const params = new URLSearchParams({
        response_type: 'code', client_id: d.env.clientId, scope: 'identify guilds',
        redirect_uri: `${url.origin}/api/discord/callback`, state: etat, prompt: 'none',
      });
      return redirection(`https://discord.com/oauth2/authorize?${params}`, [cookie(COOKIE_ETAT, etat, DUREE_ETAT_S, securise)]);
    }

    if (route === 'GET callback') {
      const efface = cookieEfface(COOKIE_ETAT, securise);
      const etat = lireCookies(requete.headers.get('cookie')).get(COOKIE_ETAT);
      const code = url.searchParams.get('code');
      if (url.searchParams.get('error')) return redirection(`/?discord=refus${PAGE_RECOS}`, [efface]);
      if (!code || !etat || etat !== url.searchParams.get('state')) return redirection(`/?discord=erreur${PAGE_RECOS}`, [efface]);
      try {
        const j = await jetons({ grant_type: 'authorization_code', code, redirect_uri: `${url.origin}/api/discord/callback` });
        const moi = await discord.membre<{ id: string; username: string; global_name?: string | null }>(j.access_token, '/users/@me');
        const session: Session = {
          acces: j.access_token, renouvellement: j.refresh_token, expire: d.maintenant() + j.expires_in * 1000,
          utilisateur: { id: moi.id, nom: (moi.global_name || moi.username).slice(0, 40) },
        };
        return redirection(PAGE_RECOS, [efface, cookie(COOKIE_SESSION, await sceller(session, d.env.cle), DUREE_SESSION_S, securise)]);
      } catch {
        return redirection(`/?discord=erreur${PAGE_RECOS}`, [efface]);
      }
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

    const lue = await lireSession(requete, securise);

    if (route === 'GET session') {
      return lue ? json(200, { connecte: true, utilisateur: lue.session.utilisateur }, {}, lue.cookies) : nonConnecte();
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
    const { session, cookies } = lue;

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
        return json(200, { utilisateur: session.utilisateur, serveurs: await decouvrir() }, {}, cookies);
      }

      // ⚠️ La lecture d'ouverture de page, en UNE requête : les sources, puis
      // la version de chaque salon lisible. Le serveur, le bot et le membre ne
      // sont lus qu'une fois, là où un appel par salon les relirait chacun.
      if (route === 'GET tout') {
        const serveurs = await decouvrir();
        const salons = serveurs.flatMap((s) => s.salons.map((c) => c.id));
        const lues = await Promise.all(salons.map((id) => lireEnCache(url.origin, id).then(versionLue)));
        const versions = Object.fromEntries(salons.map((id, i) => [id, lues[i]]));
        return json(200, { utilisateur: session.utilisateur, serveurs, versions }, {}, cookies);
      }

      if (route === 'GET salon') {
        const salonId = url.searchParams.get('id') ?? '';
        const a = await acces(salonId, session.utilisateur.id);
        if (!a || !a.utilisateur.lire || !a.bot.lire) return json(403, { acces: false }, {}, cookies);
        const version = versionLue(await lireEnCache(url.origin, salonId));
        return json(200, { serveurId: a.serveurId, salonId, nom: a.salon.name, ecrire: a.utilisateur.ecrire && a.bot.joindre, version }, {}, cookies);
      }

      if (route === 'POST publier') {
        const texte = await requete.text();
        if (texte.length > TAILLE_MAX * 2) return json(413, { erreur: 'trop-gros' }, {}, cookies);
        let corps: { salon?: unknown; base?: unknown; contenu?: unknown };
        try { corps = JSON.parse(texte); } catch { return json(400, { erreur: 'corps' }, {}, cookies); }
        if (typeof corps.salon !== 'string' || typeof corps.contenu !== 'string' || (corps.base !== null && typeof corps.base !== 'string')) {
          return json(400, { erreur: 'corps' }, {}, cookies);
        }
        const a = await acces(corps.salon, session.utilisateur.id);
        if (!a || !a.utilisateur.ecrire) return json(403, { acces: !!a?.utilisateur.lire }, {}, cookies);
        if (!a.bot.joindre) return json(503, { erreur: 'bot-sans-droit' }, {}, cookies);
        // ⚠️ Lecture DIRECTE, jamais par le cache : la comparaison à la base
        // doit voir la toute dernière version (« publier relit le salon »).
        const courante = await lireDirect(corps.salon);
        if ((courante?.messageId ?? null) !== corps.base) return json(409, { conflit: true, version: versionLue(courante) }, {}, cookies);
        const precedente = courante ? lireVersion(courante.texte, d.t) : null;
        const publieur = nomDuMembre(a.membre) || session.utilisateur.nom;
        const p = preparerPublication(corps.contenu, publieur, precedente, sourceDuSalon(a.serveurId, corps.salon), d.t);
        if (!p.ok) return json(400, { erreur: 'contenu', details: p.erreurs }, {}, cookies);
        const fd = new FormData();
        fd.append('payload_json', JSON.stringify({ attachments: [{ id: 0, filename: NOM_FICHIER }] }));
        fd.append('files[0]', new Blob([p.texte], { type: 'application/json' }), NOM_FICHIER);
        const message = await discord.bot<{ id: string; timestamp: string }>(`/channels/${corps.salon}/messages`, { method: 'POST', body: fd });
        return json(201, { version: { messageId: message.id, date: message.timestamp, reco: p.reco } }, {}, cookies);
      }
    } catch (e) {
      // Le jeton du membre refusé par Discord : la session ne vaut plus rien.
      if (e instanceof ErreurDiscord && e.statut === 401 && e.duMembre) return nonConnecte();
      // Discord limite les appels au-delà de ce que le service attend : la
      // page le dit (« réessaie dans une minute ») plutôt qu'une panne.
      if (e instanceof ErreurDiscord && e.statut === 429) return json(503, { erreur: 'limite' }, {}, cookies);
      if (e instanceof ErreurDiscord) return json(502, { erreur: 'discord', statut: e.statut }, {}, cookies);
      throw e;
    }

    return json(404, { erreur: 'route' }, {}, cookies);
  }

  return { traiter };
}
