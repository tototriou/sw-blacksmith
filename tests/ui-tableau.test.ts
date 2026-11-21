// Le `Tableau` de la librairie (src/ui/Tableau.tsx) : le tri au clic sur un
// en-tête. Le rendu, lui, est éprouvé sur l'écran qui l'emploie
// (tests/rendu/siege-statistiques.test.tsx).

import { triApresClic, type TriTableau } from '../src/ui/Tableau';
import { egal, titre } from './outils';

export function testUiTableauTri() {
  titre('ui · Tableau — le tri en trois clics');
  let tri: TriTableau = null;
  tri = triApresClic(tri, 'victoires', false);
  egal(tri, { cle: 'victoires', sens: 'desc' }, '1er clic sur des nombres : du plus grand au plus petit');
  tri = triApresClic(tri, 'victoires', false);
  egal(tri, { cle: 'victoires', sens: 'asc' }, '2e clic : inversé');
  tri = triApresClic(tri, 'victoires', false);
  egal(tri, null, '3e clic : plus de tri, le tableau revient à son ordre de base');
  egal(triApresClic(null, 'joueur', true), { cle: 'joueur', sens: 'asc' }, 'du texte : de A à Z d’abord');
  egal(triApresClic({ cle: 'joueur', sens: 'asc' }, 'joueur', true), { cle: 'joueur', sens: 'desc' }, 'puis de Z à A');
  egal(triApresClic({ cle: 'joueur', sens: 'desc' }, 'joueur', true), null, 'puis plus de tri');
  egal(triApresClic({ cle: 'victoires', sens: 'asc' }, 'points', false), { cle: 'points', sens: 'desc' }, 'une autre colonne repart de son premier sens');
}
