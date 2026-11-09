// Appels de la page au service Discord (api/, même origine que le site).
// `fetch` est injecté : les tests rejouent chaque réponse du service.
// Routes et réponses : docs/02-app/siege/feat-recommandations/service-discord.md.

import type { VersionSalon } from '../types';
import type { SalonAccessible, VersionValide } from './recoDiscord';

export const URL_CONNEXION = '/api/discord/login';
const BASE = '/api/discord';

export type Recuperer = (url: string, init?: RequestInit) => Promise<Response>;

export interface Utilisateur { id: string; nom: string }
export interface SalonDuService { id: string; nom: string; ecrire: boolean }
export interface ServeurDuService { id: string; nom: string; icone: string | null; botAdmin: boolean; salons: SalonDuService[] }
export interface Sources { utilisateur: Utilisateur; serveurs: ServeurDuService[] }

// Une réponse du service que la page sait lire, ou la raison de son échec :
// non connecté (session absente ou échue), refusé (droits), service ou réseau
// en panne.
export type Echec = 'non-connecte' | 'refuse' | 'limite' | 'indisponible';
export type Reponse<T> = { ok: true; valeur: T } | { ok: false; echec: Echec };

async function appeler<T>(recuperer: Recuperer, chemin: string, init?: RequestInit): Promise<Reponse<T> & { statut?: number; corps?: unknown }> {
  let r: Response;
  try {
    r = await recuperer(BASE + chemin, { credentials: 'same-origin', ...init });
  } catch {
    return { ok: false, echec: 'indisponible' };
  }
  const corps = await r.json().catch(() => null);
  if (r.ok) return { ok: true, valeur: corps as T, statut: r.status };
  if (r.status === 401) return { ok: false, echec: 'non-connecte', statut: r.status, corps };
  if (r.status === 403) return { ok: false, echec: 'refuse', statut: r.status, corps };
  // Discord limite les appels (voir le service) : à réessayer plus tard.
  if (r.status === 503 && (corps as { erreur?: string } | null)?.erreur === 'limite') return { ok: false, echec: 'limite', statut: r.status, corps };
  return { ok: false, echec: 'indisponible', statut: r.status, corps };
}

export async function lireSession(recuperer: Recuperer): Promise<Reponse<Utilisateur>> {
  const r = await appeler<{ utilisateur: Utilisateur }>(recuperer, '/session');
  return r.ok ? { ok: true, valeur: r.valeur.utilisateur } : { ok: false, echec: r.echec };
}

export async function lireSources(recuperer: Recuperer): Promise<Reponse<Sources>> {
  const r = await appeler<Sources>(recuperer, '/sources');
  return r.ok ? { ok: true, valeur: r.valeur } : { ok: false, echec: r.echec };
}

// Les salons d'une réponse `sources`, sous la forme que la synchronisation lit.
export function salonsAccessibles(s: Sources): SalonAccessible[] {
  return s.serveurs.flatMap((g) => g.salons.map((c) => ({ serveurId: g.id, salonId: c.id, nomServeur: g.nom, nomSalon: c.nom, ecrire: c.ecrire })));
}

export interface LectureSalon { salonId: string; ecrire: boolean; version: VersionSalon | null }

export async function lireSalon(recuperer: Recuperer, salonId: string): Promise<Reponse<LectureSalon>> {
  const r = await appeler<LectureSalon>(recuperer, `/salon?id=${encodeURIComponent(salonId)}`);
  return r.ok ? { ok: true, valeur: r.valeur } : { ok: false, echec: r.echec };
}

// Les salons et la version courante de chacun, en UNE requête (route `tout`) :
// un appel par salon relirait chaque fois le serveur et le membre chez
// Discord, dont les quotas sont serrés. Un salon que le membre ne lit plus
// n'est pas dans la réponse : la synchronisation le traite comme un accès perdu.
export async function lireTout(recuperer: Recuperer): Promise<Reponse<{ sources: Sources; salons: SalonAccessible[]; versions: Map<string, VersionSalon | null> }>> {
  const r = await appeler<Sources & { versions: Record<string, VersionSalon | null> }>(recuperer, '/tout');
  if (!r.ok) return { ok: false, echec: r.echec };
  const { versions, ...sources } = r.valeur;
  return { ok: true, valeur: { sources, salons: salonsAccessibles(sources), versions: new Map(Object.entries(versions ?? {})) } };
}

export type ResultatPublication =
  | { type: 'publie'; version: VersionValide }
  | { type: 'conflit'; version: VersionSalon | null }
  | { type: 'refuse' }
  | { type: 'invalide' }
  | { type: 'non-connecte' }
  | { type: 'indisponible' };

// `base` : la version sur laquelle le membre a travaillé (null : il n'en
// connaissait aucune). Un 409 rend la version courante, à fusionner.
export async function publier(recuperer: Recuperer, salonId: string, base: string | null, contenu: string): Promise<ResultatPublication> {
  const r = await appeler<{ version: VersionValide }>(recuperer, '/publier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ salon: salonId, base, contenu }),
  });
  if (r.ok) return { type: 'publie', version: r.valeur.version };
  if (r.statut === 409) return { type: 'conflit', version: (r.corps as { version?: VersionSalon | null } | null)?.version ?? null };
  if (r.statut === 400 || r.statut === 413) return { type: 'invalide' };
  if (r.echec === 'non-connecte') return { type: 'non-connecte' };
  if (r.echec === 'refuse') return { type: 'refuse' };
  return { type: 'indisponible' };
}

export async function deconnecter(recuperer: Recuperer): Promise<void> {
  await appeler(recuperer, '/deconnexion', { method: 'POST' });
}

// Le retour de l'autorisation Discord, lu dans l'adresse (`?discord=refus`,
// `?discord=erreur`) : à dire une fois, puis à effacer de l'adresse.
export function retourDeConnexion(search: string): 'refus' | 'erreur' | null {
  const v = new URLSearchParams(search).get('discord');
  return v === 'refus' || v === 'erreur' ? v : null;
}
