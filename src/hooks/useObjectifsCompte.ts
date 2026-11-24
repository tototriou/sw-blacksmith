import { useSyncExternalStore } from 'react';
import { OBJECTIFS_DEFAUT, ObjectifsCompte, lireObjectifs, lireObjectifsStockes } from '../lib/objectifsCompte';

// Les objectifs du compte (onglet « Objectifs » des Paramètres), lus par les
// vues « Objectifs » des runes et des artéfacts. Voir
// docs/02-app/compte/feat-objectifs.md.
//
// ⚠️ Un RÉGLAGE, comme les builds les plus rapides : on fixe une fois ce qu'on
// vise. Il est donc écrit même sans l'accord de conservation
// (`CLES_DE_REGLAGE`, usePersistence.ts).
//
// Store externe : la vue déjà montée suit en direct un changement fait dans les
// Paramètres ou par un import de fichier.
export const CLE_OBJECTIFS = 'swblacksmith-objectifs-compte-v1';

function load(): ObjectifsCompte {
  try {
    return lireObjectifsStockes(localStorage.getItem(CLE_OBJECTIFS));
  } catch {
    return OBJECTIFS_DEFAUT;
  }
}

let current: ObjectifsCompte = load();
const listeners = new Set<() => void>();

// ⚠️ Une valeur illisible n'est pas écrite : l'éditeur ne produit que des
// valeurs bornées, et un import passe par `lireFichierObjectifs` avant.
export function setObjectifsCompte(v: ObjectifsCompte) {
  const lu = lireObjectifs(v);
  if (!lu) return;
  current = lu;
  try {
    localStorage.setItem(CLE_OBJECTIFS, JSON.stringify(current));
  } catch {
    /* stockage indisponible : la valeur vit jusqu'au rechargement */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useObjectifsCompte(): ObjectifsCompte {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
