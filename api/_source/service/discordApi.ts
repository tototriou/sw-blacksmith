// Appels à l'API REST de Discord, avec le jeton du bot ou celui du membre.
// `fetch` est injecté : les tests simulent Discord sans réseau.
//
// ⚠️ Limites de débit : Discord n'accepte qu'environ 5 lectures par seconde
// et par salon (mesuré le 2026-11-09). Une réponse 429 avec une attente courte
// est réessayée une fois ; au-delà, l'erreur remonte (le cache partagé de la
// lecture d'un salon évite d'y arriver, voir routeur.ts).

export const API = 'https://discord.com/api/v10';
const ATTENTE_MAX_S = 2;

export type Recuperer = (url: string, init?: RequestInit) => Promise<Response>;

// `duMembre` : l'appel portait le jeton du membre. Un 401 sur ce jeton met fin
// à la session ; un 401 sur celui du bot est une erreur de configuration.
export class ErreurDiscord extends Error {
  constructor(public statut: number, public code: number | null, message: string, public duMembre = false) {
    super(message);
  }
}

export interface Client {
  bot<T>(chemin: string, init?: RequestInit): Promise<T>;
  membre<T>(jeton: string, chemin: string): Promise<T>;
  // Le contenu d'une pièce jointe : un lien signé du CDN de Discord, sans jeton.
  telecharger(url: string): Promise<string>;
}

export function client(recuperer: Recuperer, jetonBot: string, attendre: (ms: number) => Promise<void>): Client {
  async function appel<T>(chemin: string, autorisation: string, init: RequestInit = {}, essai = 0): Promise<T> {
    const r = await recuperer(API + chemin, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: autorisation } });
    if (r.status === 429 && essai === 0) {
      const corps = await r.json().catch(() => ({})) as { retry_after?: number };
      const delai = corps.retry_after ?? Number(r.headers.get('retry-after') ?? NaN);
      if (Number.isFinite(delai) && delai <= ATTENTE_MAX_S) {
        await attendre(Math.ceil(delai * 1000));
        return appel<T>(chemin, autorisation, init, 1);
      }
    }
    if (!r.ok) {
      const corps = await r.json().catch(() => ({})) as { code?: number; message?: string };
      throw new ErreurDiscord(r.status, corps.code ?? null, corps.message ?? `HTTP ${r.status}`, autorisation.startsWith('Bearer '));
    }
    return (r.status === 204 ? undefined : await r.json()) as T;
  }
  return {
    bot: (chemin, init) => appel(chemin, `Bot ${jetonBot}`, init),
    membre: (jeton, chemin) => appel(chemin, `Bearer ${jeton}`),
    async telecharger(url) {
      const r = await recuperer(url);
      if (!r.ok) throw new ErreurDiscord(r.status, null, `pièce jointe HTTP ${r.status}`);
      return r.text();
    },
  };
}
