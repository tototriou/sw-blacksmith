// La connexion à Discord de l'application de bureau, ce qui se décide sans
// Electron (testé : tests/bureau-discord.test.ts). Le branchement :
// bureau/discord.ts. Spec : docs/02-app/bureau/README.md § « Discord ».
//
// L'app n'a ni cookie ni origine web : elle garde la session du service
// elle-même, et l'envoie en `Authorization: Bearer`. La page ne la voit
// jamais : elle demande une route, le processus principal l'appelle.

import { createHash, randomBytes } from 'node:crypto';

export const SERVICE_PAR_DEFAUT = 'https://sw-blacksmith.vercel.app';
export const ENTETE_SESSION = 'x-session-discord'; // api/_source/service/session.ts

// L'adresse du service : la production, sauf une autre donnée par
// `SWBLACKSMITH_SERVICE_DISCORD` (`vercel dev` en développement, le faux
// service de la preuve). `https`, ou `http` sur la machine seulement.
export function adresseService(valeur: string | undefined): string {
  if (!valeur) return SERVICE_PAR_DEFAUT;
  try {
    const u = new URL(valeur);
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol === 'https:' || (u.protocol === 'http:' && local)) return u.origin;
  } catch {
    /* illisible : la production */
  }
  return SERVICE_PAR_DEFAUT;
}

// Le secret de la connexion en cours (32 octets aléatoires) et son empreinte,
// le défi, seul envoyé au navigateur : le code que le site affichera ne
// s'échange que contre ce secret, qui ne quitte jamais le processus principal.
export function nouveauSecret(): { secret: string; defi: string } {
  const secret = randomBytes(32).toString('base64url');
  return { secret, defi: createHash('sha256').update(secret).digest('base64url') };
}

export const adresseConnexion = (service: string, defi: string) => `${service}/api/discord/login?bureau=${encodeURIComponent(defi)}`;
// L'invitation du bot sur un serveur, ouverte dans le navigateur du système.
export const adresseInvitation = (service: string) => `${service}/api/discord/invitation`;

// Le code collé par l'utilisateur : les blancs (retour à la ligne d'un
// copier-coller) retirés ; base64url seulement, d'une longueur plausible.
export function codeColle(texte: unknown): string | null {
  if (typeof texte !== 'string') return null;
  const code = texte.replace(/\s+/g, '');
  return /^[A-Za-z0-9_-]{40,4000}$/.test(code) ? code : null;
}

// ⚠️ **Les seules routes que la page peut faire appeler**, avec leur
// méthode : jamais une adresse quelconque, qui ferait du processus principal
// un relais vers n'importe où, la session du membre en tête.
export function routeAutorisee(chemin: unknown, methode: unknown): string | null {
  if (typeof chemin !== 'string') return null;
  if (methode === 'GET' && (chemin === 'session' || chemin === 'sources' || chemin === 'tout' || /^salon\?id=\d{1,25}$/.test(chemin))) return chemin;
  if (methode === 'POST' && (chemin === 'publier' || chemin === 'deconnexion')) return chemin;
  return null;
}

// Le corps d'une publication : du texte, borné (le service refuse au-delà
// de 512 Ko). Les autres routes n'en ont pas.
export function corpsAutorise(chemin: string, corps: unknown): string | undefined | null {
  if (chemin !== 'publier') return corps === undefined || corps === null ? undefined : null;
  return typeof corps === 'string' && corps.length <= 512 * 1024 ? corps : null;
}

// Le système sait-il chiffrer la session ? Sous Linux sans trousseau,
// Electron se rabat sur une clé connue de tous (`basic_text`) : la session
// reste alors en mémoire, jamais écrite.
export function chiffrementSur(disponible: boolean, plateforme: string, stockage: string | null): boolean {
  return disponible && !(plateforme === 'linux' && (stockage === 'basic_text' || stockage === 'unknown'));
}

// `discord.json` : la session chiffrée par le système, en base64. Relu avec
// méfiance.
export function lireFichierSession(brut: unknown): string | null {
  const s = (brut as { session?: unknown } | null)?.session;
  return typeof s === 'string' && /^[A-Za-z0-9+/=]{1,8000}$/.test(s) ? s : null;
}
