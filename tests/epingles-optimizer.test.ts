// Les builds épinglés de l'Optimizer (epinglesOptimizer.ts) : dix au plus par
// monstre, numérotés dans l'ordre d'épinglage et renumérotés sans trou quand
// on en libère un, propres à chaque membre, jamais remplacés en silence.

import {
  MAX_EPINGLES, basculerEpingle, cleEpingle, cleMembreEpingles, epingler, epinglesDe, liberer, libererTout, numeroEpingle,
  placeLibre, type EpinglesParMembre,
} from '../src/lib/epinglesOptimizer';
import { egal, ok, titre } from './outils';

interface B { cle: string }
const b = (cle: string): B => ({ cle });

export function testEpinglesOptimizer() {
  titre('Optimizer · builds épinglés — ordre, numéros, dix au plus, propres au membre');

  // L'identité : runes dans leur ordre, artéfacts triés, relique.
  egal(cleEpingle([5, 3, 9], [12, 4], 7), '5-3-9|4-12|7', 'identité : runes, artéfacts triés, relique');
  ok(cleEpingle([5, 3, 9], [4, 12], 7) === cleEpingle([5, 3, 9], [12, 4], 7), "l'ordre d'affichage des artéfacts ne fait pas un autre build");
  ok(cleEpingle([5, 3, 9], [4, 12], 7) !== cleEpingle([5, 3, 9], [4, 13], 7), 'mêmes runes, autre paire : un autre build');
  ok(cleEpingle([5, 3, 9], [4, 12], undefined) !== cleEpingle([5, 3, 9], [4, 12], 7), 'mêmes runes et paire, autre relique : un autre build');

  // Le membre : liste et exemplaire ; sans exemplaire, rien.
  egal(cleMembreEpingles('l1', 'box:42'), 'l1::box:42', 'clé de membre : liste et exemplaire');
  ok(cleMembreEpingles('l1', 'box:42') !== cleMembreEpingles('l2', 'box:42'), 'le même exemplaire dans deux listes garde deux jeux');
  egal(cleMembreEpingles('l1', null), null, 'sans exemplaire résolu, pas de membre');

  // L'ordre et les numéros.
  let etat: EpinglesParMembre<B> = {};
  etat = epingler(etat, 'm', b('a'));
  etat = epingler(etat, 'm', b('b'));
  etat = epingler(etat, 'm', b('c'));
  egal(epinglesDe(etat, 'm').map((e) => e.cle), ['a', 'b', 'c'], "dans l'ordre d'épinglage");
  egal([numeroEpingle(epinglesDe(etat, 'm'), 'a'), numeroEpingle(epinglesDe(etat, 'm'), 'c'), numeroEpingle(epinglesDe(etat, 'm'), 'z')], [1, 3, null],
    'numéros 1 et 3, aucun pour un build non épinglé');
  const meme = epingler(etat, 'm', b('b'));
  ok(meme === etat, 'épingler un build déjà épinglé ne change rien');

  // Libérer renumérote sans trou.
  const sansB = liberer(etat, 'm', 'b');
  egal(epinglesDe(sansB, 'm').map((e) => e.cle), ['a', 'c'], 'libérer le deuxième');
  egal(numeroEpingle(epinglesDe(sansB, 'm'), 'c'), 2, 'le troisième devient le deuxième');
  ok(liberer(etat, 'm', 'z') === etat, 'libérer un build non épinglé ne change rien');
  egal(epinglesDe(etat, 'm').map((e) => e.cle), ['a', 'b', 'c'], "l'état d'avant n'est jamais modifié");

  // Le bouton de la carte bascule.
  egal(epinglesDe(basculerEpingle(etat, 'm', b('a')), 'm').map((e) => e.cle), ['b', 'c'], 'basculer un épinglé le libère');
  egal(epinglesDe(basculerEpingle(etat, 'm', b('d')), 'm').map((e) => e.cle), ['a', 'b', 'c', 'd'], 'basculer un autre build l’épingle à la fin');

  // Dix au plus : le onzième est refusé, rien n'est remplacé.
  let plein: EpinglesParMembre<B> = {};
  for (let i = 0; i < MAX_EPINGLES; i++) plein = epingler(plein, 'm', b(`x${i}`));
  egal(MAX_EPINGLES, 10, 'dix builds épinglés au plus');
  ok(!placeLibre(epinglesDe(plein, 'm')), 'à dix, plus de place');
  ok(epingler(plein, 'm', b('onze')) === plein, 'le onzième est refusé, sans rien remplacer');
  ok(placeLibre(epinglesDe(liberer(plein, 'm', 'x4'), 'm')), 'en libérer un rend une place');

  // Propres au membre.
  const deux = epingler(etat, 'autre', b('a'));
  egal(epinglesDe(deux, 'autre').map((e) => e.cle), ['a'], 'un autre membre a ses propres épinglés');
  egal(epinglesDe(deux, 'm').length, 3, "épingler chez l'autre ne touche pas celui-ci");
  const vide = libererTout(deux, 'm');
  egal(epinglesDe(vide, 'm').length, 0, 'tout libérer vide le membre');
  egal(epinglesDe(vide, 'autre').map((e) => e.cle), ['a'], "tout libérer ne touche pas les autres membres");
  ok(libererTout(vide, 'm') === vide, 'tout libérer sans épinglé ne change rien');
  egal(epinglesDe(etat, null).length, 0, 'sans membre, aucun épinglé');
  ok(!('m' in liberer(liberer(liberer(etat, 'm', 'a'), 'm', 'b'), 'm', 'c')), 'le dernier libéré retire le membre de l’état');
}
