// Charger une session (application de bureau) — l'appliquer AVANT le premier
// rendu. Voir docs/02-app/transverse/feat-sauvegarde-session.md, « Charger ».
//
// ⚠️ **Au redémarrage, pas à chaud.** « Charger… » relance la page ; main.tsx
// demande au bureau la session choisie, l'applique ici, PUIS importe l'app.
// Chaque écran lit alors son état comme à un lancement ordinaire — certains
// réglages se lisent au chargement de leur module (thème, langue, mesure…),
// avant tout rendu : les recoller un par un, à chaud, aurait été fragile.
//
// ⚠️ **Le travail suit « Garder mes données »** (`ecrireDepuisSession`) :
// accepté, il est écrit sur le disque ; refusé, il ne vit qu'en mémoire, où
// les hooks le relisent (`lireTravail`). Le compte de même : écrit dans
// IndexedDB si la conservation est acceptée, et relu par App.tsx depuis
// `sessionChargee()` dans les deux cas.

import { ecrireDepuisSession, persistenceEnabled } from '../hooks/usePersistence';
import { amorcerMemoire } from '../hooks/useStickyState';
import { clearAccount, saveAccount, type StoredAccount } from './accountStore';
import { CLES_SESSION, type AvertissementSession, type Session } from './session';

export interface SessionChargee {
  // Le nom du fichier, pour l'annoncer.
  nom: string;
  compte: StoredAccount | null;
  // La photo de l'Optimizer, rejouée par App.tsx une fois l'écran monté
  // (`restaurerOptimizer`).
  optimizer: Record<string, unknown> | null;
  avertissements: AvertissementSession[];
}

let chargee: SessionChargee | null = null;

// La session appliquée à ce démarrage, ou `null` (lancement ordinaire).
export const sessionChargee = (): SessionChargee | null => chargee;

export async function appliquerSession(
  session: Session,
  nom: string,
  avertissements: AvertissementSession[]
): Promise<void> {
  // TOUTES les clés de la session : une clé absente du fichier efface la
  // valeur d'avant, sinon un ancien travail survivrait au chargement.
  for (const cle of CLES_SESSION) ecrireDepuisSession(cle, session.stockage[cle] ?? null);
  amorcerMemoire(session.outils.memoire);
  if (persistenceEnabled()) {
    if (session.compte) await saveAccount(session.compte);
    else await clearAccount();
  }
  chargee = { nom, compte: session.compte, optimizer: session.outils.optimizer, avertissements };
}
