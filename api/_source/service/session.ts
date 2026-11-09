// Session du service : un cookie HttpOnly chiffré (AES-GCM, Web Crypto de
// Node), aucun stockage côté serveur. Il porte les jetons Discord du membre
// (accès et renouvellement) pour relire ses serveurs à chaque requête
// (docs/04-decisions/adr/local-par-defaut.md).
//
// ⚠️ Un cookie illisible, altéré ou chiffré avec une autre clé vaut « pas de
// session » : jamais une erreur, le membre se reconnecte.

export const COOKIE_SESSION = 'swb_discord';
export const COOKIE_ETAT = 'swb_discord_etat';
export const DUREE_SESSION_S = 30 * 24 * 3600;
export const DUREE_ETAT_S = 10 * 60;
const CHEMIN = '/api/discord';

export interface Session {
  acces: string; // jeton d'accès Discord du membre
  renouvellement: string; // jeton de renouvellement
  expire: number; // fin de validité du jeton d'accès, en ms depuis l'époque
  utilisateur: { id: string; nom: string };
}

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

function versBase64Url(octets: Uint8Array): string {
  return Buffer.from(octets).toString('base64url');
}
function depuisBase64Url(texte: string): Uint8Array {
  return new Uint8Array(Buffer.from(texte, 'base64url'));
}

// Web Crypto n'accepte qu'un tampon ordinaire, jamais partagé.
export type Cle = Uint8Array<ArrayBuffer>;

// La clé vient de la variable d'environnement CLE_SESSION : 32 octets en
// base64. Une clé absente ou de mauvaise taille est une erreur de déploiement.
export function lireCle(base64: string | undefined): Cle {
  const octets = base64 ? new Uint8Array(Buffer.from(base64, 'base64')) : new Uint8Array();
  if (octets.length !== 32) throw new Error('CLE_SESSION doit faire 32 octets en base64');
  return octets;
}

async function cleAes(cle: Cle): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', cle, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function sceller(valeur: unknown, cle: Cle): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cleAes(cle), encodeur.encode(JSON.stringify(valeur))));
  const tout = new Uint8Array(iv.length + chiffre.length);
  tout.set(iv);
  tout.set(chiffre, iv.length);
  return versBase64Url(tout);
}

export async function desceller<T>(texte: string | undefined, cle: Cle): Promise<T | null> {
  if (!texte) return null;
  try {
    const tout = depuisBase64Url(texte);
    if (tout.length < 13) return null;
    const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: tout.slice(0, 12) }, await cleAes(cle), tout.slice(12));
    return JSON.parse(decodeur.decode(clair)) as T;
  } catch {
    return null;
  }
}

export function estSession(v: unknown): v is Session {
  const s = v as Session | null;
  return !!s && typeof s.acces === 'string' && typeof s.renouvellement === 'string' && typeof s.expire === 'number'
    && !!s.utilisateur && typeof s.utilisateur.id === 'string' && typeof s.utilisateur.nom === 'string';
}

// Signature HMAC d'une adresse interne (la lecture d'un salon mise en cache) :
// sans elle, n'importe qui lirait la recommandation d'un salon par son
// identifiant, à travers le cache partagé.
export async function signer(message: string, cle: Cle): Promise<string> {
  const k = await crypto.subtle.importKey('raw', cle, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return versBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', k, encodeur.encode(message))));
}

export async function verifierSignature(message: string, signature: string | null, cle: Cle): Promise<boolean> {
  if (!signature) return false;
  const attendue = await signer(message, cle);
  if (attendue.length !== signature.length) return false;
  let ecart = 0;
  for (let i = 0; i < attendue.length; i++) ecart |= attendue.charCodeAt(i) ^ signature.charCodeAt(i);
  return ecart === 0;
}

export function lireCookies(entete: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const morceau of (entete ?? '').split(';')) {
    const i = morceau.indexOf('=');
    if (i > 0) cookies.set(morceau.slice(0, i).trim(), morceau.slice(i + 1).trim());
  }
  return cookies;
}

// HttpOnly : la page ne lit jamais le cookie. Secure, sauf en local (http). SameSite=Lax :
// le retour de Discord (navigation) le porte, une requête POST d'un autre site non.
export function cookie(nom: string, valeur: string, dureeS: number, securise: boolean): string {
  return `${nom}=${valeur}; Path=${CHEMIN}; Max-Age=${dureeS}; HttpOnly; SameSite=Lax${securise ? '; Secure' : ''}`;
}

export function cookieEfface(nom: string, securise: boolean): string {
  return cookie(nom, '', 0, securise);
}
