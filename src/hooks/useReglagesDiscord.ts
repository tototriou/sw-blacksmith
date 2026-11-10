import { useSyncExternalStore } from 'react';
import { basculerFavori } from '../lib/recoDiscord';

// Deux RÉGLAGES de la synchronisation Discord, écrits même sans l'accord de
// conservation (`CLES_DE_REGLAGE`, usePersistence.ts) — ce ne sont pas des
// données de l'utilisateur :
//
// - « Discord activé » : posé au clic sur « Se connecter à Discord », retiré à
//   la déconnexion. ⚠️ Sans lui, la page n'appelle JAMAIS le service : rien ne
//   quitte l'appareil sans un geste de l'utilisateur
//   (docs/04-decisions/adr/local-par-defaut.md). La session elle-même vit dans
//   un cookie que la page ne lit pas : ce réglage dit seulement qu'il vaut la
//   peine de la demander.
// - Les salons favoris, affichés en tête de leur serveur — dans l'application
//   de bureau seulement (docs/02-app/siege/feat-recommandations/synchronisation-discord.md).
//
// Store externe : un second écran monté (écran partagé) suit en direct.

export const CLE_DISCORD_ACTIF = 'swblacksmith-discord-actif-v1';
export const CLE_DISCORD_FAVORIS = 'swblacksmith-discord-favoris-v1';

export interface ReglagesDiscord { actif: boolean; favoris: string[] }

export function lireFavoris(brut: string | null): string[] {
  try {
    const v = JSON.parse(brut ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: string | null) {
  try {
    if (valeur === null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, valeur);
  } catch {
    /* stockage indisponible : le réglage vaut pour la session */
  }
}

let courant: ReglagesDiscord = { actif: lire(CLE_DISCORD_ACTIF) === '1', favoris: lireFavoris(lire(CLE_DISCORD_FAVORIS)) };
const abonnes = new Set<() => void>();
const prevenir = () => { for (const a of abonnes) a(); };

export function setDiscordActif(actif: boolean) {
  if (actif === courant.actif) return;
  courant = { ...courant, actif };
  ecrire(CLE_DISCORD_ACTIF, actif ? '1' : null);
  prevenir();
}

export function basculerSalonFavori(salonId: string) {
  courant = { ...courant, favoris: basculerFavori(courant.favoris, salonId) };
  ecrire(CLE_DISCORD_FAVORIS, JSON.stringify(courant.favoris));
  prevenir();
}

// Relit le disque : pour les tests, qui posent un faux stockage avant le rendu.
export function relireReglagesDiscord() {
  courant = { actif: lire(CLE_DISCORD_ACTIF) === '1', favoris: lireFavoris(lire(CLE_DISCORD_FAVORIS)) };
  prevenir();
}

function abonner(a: () => void) {
  abonnes.add(a);
  return () => abonnes.delete(a);
}

export function useReglagesDiscord(): ReglagesDiscord {
  return useSyncExternalStore(abonner, () => courant, () => courant);
}
