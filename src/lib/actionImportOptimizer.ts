import type { ProducteurImportOptimizer, RapportImportOptimizer } from './importEquipes';

/** `cible` : la liste existante à compléter ; sans elle, l'import crée une liste. */
export type ActionImportOptimizer = (produire: ProducteurImportOptimizer, cible?: string) => RapportImportOptimizer;

// La navigation suit l'acceptation par l'action commune ; un refus garde sa page.
export function avecNavigationImportOptimizer(importer: ActionImportOptimizer, ouvrir: () => void,
  recevoirRapport?: (rapport: RapportImportOptimizer) => void): ActionImportOptimizer {
  return (produire, cible) => {
    const rapport = importer(produire, cible);
    recevoirRapport?.(rapport);
    if (rapport.listeCreee || rapport.listeCompletee) ouvrir();
    return rapport;
  };
}
