// Lecture de capture — un counter de recommandation tiré d'une capture de
// l'écran de préparation de siège (src/lib/capture/counterDepuisCapture.ts) :
// la règle du bot pour les monstres, la défense, le deck, et les corrections
// faites dans l'aperçu de l'app.

import { aVerifier, corrigerMonstre, counterDepuisLecture, deckDepuisCounterLu, defenseLue } from '../src/lib/capture/counterDepuisCapture';
import type { LectureEcran, MonstreLu } from '../src/lib/capture/ecranPreparation';
import { emptyRecoSlot } from '../src/types';
import { egal, titre } from './outils';

// Un monstre lu : son meilleur candidat, et le second.
const lu = (id: number, score = 0.85, second?: { id: number; score: number }): MonstreLu => ({
  rect: [0, 0, 10, 10],
  portrait: { meilleur: { com2usId: id, score }, suivants: second ? [{ com2usId: second.id, score: second.score }] : [] },
});
const lecture = (attaquants: MonstreLu[], defense: MonstreLu[] = []): LectureEcran => ({
  attaquants: attaquants.map((a) => ({ ...a, vitesse: null, hypotheses: [] })),
  defense,
});
const connu = (id: number) => id < 100;
const nom = (id: number) => `M${id}`;

export function testCaptureCounter() {
  titre('Lecture de capture — un counter de recommandation');

  // Sans les trois monstres de l'offense, rien : la règle du bot.
  egal(counterDepuisLecture(null, connu), null, 'écran non reconnu : rien');
  egal(counterDepuisLecture(lecture([lu(1), lu(2)]), connu), null, 'deux attaquants : rien');
  egal(counterDepuisLecture(lecture([lu(1), lu(2, 0.4), lu(3)]), connu), null, 'un portrait sous 0,5 : rien');
  egal(counterDepuisLecture(lecture([lu(1), lu(2), lu(300)]), connu), null, 'un monstre absent des données : rien');

  // Les monstres reconnus ; le second candidat presque aussi probable est à vérifier.
  const c = counterDepuisLecture(lecture([lu(1), lu(2, 0.8, { id: 5, score: 0.77 }), lu(3, 0.9, { id: 6, score: 0.7 })]), connu)!;
  egal(c.offense, [{ com2usId: 1, autre: null }, { com2usId: 2, autre: 5 }, { com2usId: 3, autre: null }], 'offense : écart sous 0,05, le second est proposé');
  egal(aVerifier(c), 1, 'un monstre à vérifier');
  egal(c.defense, [], 'pas de défense sur la capture');
  egal(defenseLue(c, nom), null, 'pas de défense lue');

  // La défense : ses places gardées, une place non reconnue reste vide.
  const avecDef = counterDepuisLecture(lecture([lu(1), lu(2), lu(3)], [lu(7), lu(8, 0.33), lu(9)]), connu)!;
  egal(avecDef.defense.map((m) => m?.com2usId ?? null), [7, null, 9], 'défense : la place non reconnue reste vide, à sa place');
  egal(defenseLue(avecDef, nom), [{ com2usId: 7, name: 'M7' }, { com2usId: null, name: '' }, { com2usId: 9, name: 'M9' }], 'défense lue, au format d\'une défense visée');
  egal(counterDepuisLecture(lecture([lu(1), lu(2), lu(3)], [lu(7, 0.3), lu(8, 0.3), lu(9, 0.3)]), connu)!.defense, [],
    'aucun portrait de défense reconnu : pas de défense');

  // Le deck : les attaquants dans l'ordre (leader en premier), la défense visée donnée.
  const deck = deckDepuisCounterLu(avecDef, nom, defenseLue(avecDef, nom));
  egal(deck.slots.map((s) => [s.com2usId, s.name]), [[1, 'M1'], [2, 'M2'], [3, 'M3']], 'deck : les attaquants, dans l\'ordre');
  egal(deck.slots[0].stats, {}, 'la VIT lue est ignorée : aucun minimum');
  egal(deck.counters.map((x) => x.monsters.map((m) => m.com2usId)), [[7, null, 9]], 'deck : la défense lue, visée');
  egal(deckDepuisCounterLu(avecDef, nom, null).counters, [], 'sans défense donnée : aucune visée');

  // Corriger dans l'aperçu : remplacer, vider ; un monstre choisi est sûr.
  const corrige = corrigerMonstre(c, 'offense', 1, 4);
  egal(corrige.offense[1], { com2usId: 4, autre: null }, 'offense corrigée : le monstre choisi, plus à vérifier');
  egal(aVerifier(corrige), 0, 'plus rien à vérifier');
  const vide = corrigerMonstre(c, 'offense', 0, null);
  egal(vide.offense[0], null, 'offense : une place vidée par sa croix');
  egal(deckDepuisCounterLu(vide, nom, null).slots[0], emptyRecoSlot(), 'une place vidée donne un emplacement vide');
  egal(corrigerMonstre(c, 'defense', 2, 9).defense.map((m) => m?.com2usId ?? null), [null, null, 9],
    'défense non lue : ses trois places à la première correction');
  egal(defenseLue(corrigerMonstre(avecDef, 'defense', 0, null), nom)?.map((m) => m.com2usId), [null, null, 9], 'défense : une place vidée');
  egal(defenseLue(corrigerMonstre(corrigerMonstre(avecDef, 'defense', 0, null), 'defense', 2, null), nom), null,
    'défense entièrement vidée : plus de défense visée');
}
