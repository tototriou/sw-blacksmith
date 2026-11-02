import type { OptimizerList } from './optimizerExclusion';

/**
 * Premier nom libre parmi les listes existantes, sans renommer aucune liste.
 * `nom` vient du dictionnaire (`optimizer.listes.nomParDefaut`) : le nom prend
 * la langue du moment de sa création, puis appartient au joueur.
 */
export function nomNouvelleListeOptimizer(listes: readonly OptimizerList[], nom: (numero: number) => string): string {
  const noms = new Set(listes.map(l => l.name.trim()));
  let numero = 1;
  while (noms.has(nom(numero))) numero++;
  return nom(numero);
}
