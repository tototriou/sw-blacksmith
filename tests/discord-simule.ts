// Un Discord simulé, pour rejouer le service des recommandations (api/_source/)
// sans réseau : un serveur, ses rôles, ses salons, ses membres, les messages
// et pièces jointes de chaque salon. Les tests du service
// (tests/discord-service.test.ts) et la preuve de l'application de bureau
// (`npm run bureau:preuve -- --discord`) s'en servent.

import { ENVOYER, JOINDRE, HISTORIQUE, VOIR_LE_SALON, type Role, type Salon } from '../api/_source/service/droits';
import { API } from '../api/_source/service/discordApi';
import type { MessageDiscord } from '../api/_source/service/recoSalon';
import { creerRouteur } from '../api/_source/service/routeur';
import { fr } from '../src/i18n/fr';
import { encodeRecosJson } from '../src/lib/recoShare';
import type { Reco } from '../src/types';

export const S = 'G1'; // serveur
export const CDN = 'https://cdn.discordapp.com/attachments/'; // seul hébergeur de pièces jointes accepté
export const bits = (...b: bigint[]) => b.reduce((a, x) => a | x, 0n).toString();
export const LIRE = bits(VOIR_LE_SALON, HISTORIQUE);
export const TOUT_SALON = bits(VOIR_LE_SALON, HISTORIQUE, ENVOYER, JOINDRE);

export interface Monde {
  roles: Role[];
  salons: { id: string; name: string; type: number; permission_overwrites?: Salon['permission_overwrites'] }[];
  membres: Record<string, { roles: string[]; nick?: string | null; user: { id: string; username: string; global_name?: string | null } }>;
  messages: Record<string, MessageDiscord[]>;
  pieces: Record<string, string>;
  postes: { salon: string; texte: string }[];
  appels: string[];
  jetonRefuse?: boolean;
}

export function monde(): Monde {
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

// Un fichier déposé dans un salon par `auteur` : message et pièce jointe.
export function deposer(w: Monde, salon: string, id: string, texte: string, auteur = 'B') {
  w.pieces[`${CDN}${id}`] = texte;
  (w.messages[salon] ??= []).unshift({ id, timestamp: `t${id}`, author: { id: auteur }, attachments: [{ url: `${CDN}${id}`, filename: 'recommandation.json', size: 1 }] });
}

// Une recommandation d'un deck, valide pour le service.
export function recoSimple(nom: string, monstre = 14105): Reco {
  const slot = (id: number | null) => ({ com2usId: id, name: id ? `M${id}` : '', stats: {}, setOptions: [], artifacts: { element: [], archetype: [] } });
  return { id: 'x', origin: 'mine', name: nom, author: 'saisi', note: '', decks: [{ name: '', note: '', slots: [slot(monstre), slot(null), slot(null)], counters: [] }] };
}

// Le VRAI service devant ce Discord simulé, pour la preuve de l'application de
// bureau : deux salons qui portent chacun une recommandation. Le membre qui se
// connecte est `U` (« Toto »).
export function serviceDePreuve() {
  const w = monde();
  w.salons.push({ id: 'C4', name: 'blacksmith-reco-offs', type: 0 });
  deposer(w, 'C1', '501', encodeRecosJson([recoSimple('Défenses GvO')]));
  deposer(w, 'C4', '502', encodeRecosJson([recoSimple('Offs de guilde')]));
  const routeur = creerRouteur({
    env: { clientId: 'client', clientSecret: 'secret', jetonBot: 'bot', cle: new Uint8Array(32).fill(5) },
    recuperer: simulateur(w), maintenant: () => Date.now(), attendre: async () => {}, t: fr, lectureEnCache: false,
  });
  return { traiter: routeur.traiter, monde: w };
}

// Le `fetch` du service, branché sur le monde : l'API REST de Discord (le
// jeton du membre en `Bearer`, celui du bot autrement) et les pièces jointes.
export function simulateur(w: Monde) {
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
      deposer(w, msgs[1], id, texte);
      return r({ id, timestamp: `t${id}` });
    }
    return r({ message: `route simulée absente : ${methode} ${chemin}` }, 500);
  };
}
