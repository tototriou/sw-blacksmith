// Recommandations — « Modifiés » (src/lib/recoModifies.ts) : les decks d'une
// recommandation de salon qui diffèrent de la dernière version reçue, ce qui
// n'est pas encore publié. Calculé, jamais stocké.

import { compteModifies, croiserHits, decksModifies, hitsModifies } from '../src/lib/recoModifies';
import { recoAvecOffense, trioDe } from '../src/lib/ajoutOffenseReco';
import type { RecoHit } from '../src/lib/recoSearch';
import { emptyRecoDeck, emptyRecoSlot, type LienDiscord, type Reco, type RecoDeck } from '../src/types';
import { egal, ok, titre } from './outils';

const deck = (id: number, spd?: number): RecoDeck => ({
  name: '', note: '',
  slots: [{ ...emptyRecoSlot(), com2usId: id, name: `M${id}`, stats: spd ? { spd } : {} }, emptyRecoSlot(), emptyRecoSlot()],
  counters: [{ monsters: [{ com2usId: 900, name: 'D' }, { com2usId: null, name: '' }, { com2usId: null, name: '' }], note: '' }],
});
// Une recommandation liée à un salon, dont la dernière version reçue porte `recus`.
const liee = (id: string, decks: RecoDeck[], recus: RecoDeck[]): Reco => ({
  id, origin: 'imported', name: id, author: '', note: '', decks,
  lien: {
    serveurId: 's', salonId: id, nomServeur: 'S', nomSalon: `salon-${id}`, ecrire: true,
    base: { messageId: 'm', date: '2026-11-27', reco: { name: id, author: '', note: '', decks: recus } },
  } satisfies LienDiscord,
});

export function testRecoModifies() {
  titre('Recommandations — « Modifiés » : ce qui n’est pas publié');
  const recus = [deck(1, 200), deck(2)];

  egal([...decksModifies(liee('a', structuredClone(recus), recus))], [], 'identique à la version du salon : rien de modifié');
  egal([...decksModifies(liee('a', [deck(2), deck(1, 200)], recus))], [], 'l’ordre des decks ne compte pas');
  egal([...decksModifies(liee('a', [deck(1, 210), deck(2)], recus))], [0], 'une stat changée : ce deck seulement');
  egal([...decksModifies(liee('a', [...recus, deck(3)], recus))], [2], 'un deck ajouté');
  egal([...decksModifies(liee('a', [...recus, deck(2)], recus))], [2], 'deux decks identiques comptent deux fois : le second est un ajout');
  egal([...decksModifies(liee('a', [...recus, emptyRecoDeck()], recus))], [], 'un deck vide n’est jamais publié : jamais modifié');
  egal([...decksModifies({ ...liee('a', [deck(3)], recus), lien: undefined })], [], 'une recommandation de l’appareil n’a pas de version de salon : rien de modifié');

  // Ce que l'ajout depuis les statistiques produit : le nouveau deck, ou le
  // deck qui gagne une défense, est « modifié » ; publié, il ne l'est plus.
  const nom = (id: number) => `M${id}`;
  const apres = recoAvecOffense(liee('b', structuredClone(recus), recus), { offense: trioDe([5, 6, 7], nom), defense: trioDe([8, 9, 10], nom) }, new Map());
  egal([...decksModifies(apres)], [2], 'une offense ajoutée depuis les statistiques : son deck est modifié');
  // L'offense du premier deck (un seul monstre posé), contre une autre défense.
  const offense1 = [{ com2usId: 1, name: 'M1' }, { com2usId: null, name: '' }, { com2usId: null, name: '' }];
  const contre = recoAvecOffense(liee('b', structuredClone(recus), recus), { offense: offense1, defense: trioDe([8, 9, 10], nom) }, new Map());
  egal([contre.decks.length, [...decksModifies(contre)]], [2, [0]], 'une défense ajoutée au deck de la même offense : ce deck est modifié');
  const publiee = { ...apres, lien: { ...apres.lien!, base: { ...apres.lien!.base, reco: { name: 'b', author: '', note: '', decks: apres.decks } } } };
  egal([...decksModifies(publiee)], [], 'publiée : la version du salon est la sienne, plus rien de modifié');

  // La page : le compte, et le filtre au format d'une recherche.
  const a = liee('a', [deck(1, 210), deck(2)], recus);
  const b = liee('c', structuredClone(recus), recus);
  egal(compteModifies([a, b]), 1, 'le compte : les decks modifiés');
  const hits = hitsModifies([a, b]);
  egal(hits.map((h) => [h.reco.id, h.decks]), [['a', [{ deckIndex: 0, slots: [], counters: [0], filtre: true }]]],
    'le filtre : les decks modifiés, toutes leurs défenses, rien de surligné');
  const recherche: RecoHit[] = [{ reco: a, decks: [{ deckIndex: 0, slots: [0], counters: [] }, { deckIndex: 1, slots: [0], counters: [] }], enOffense: true, enDefense: false }];
  egal(croiserHits(recherche, hits)?.map((h) => h.decks), [[{ deckIndex: 0, slots: [0], counters: [] }]], 'recherche ET filtre : les decks des deux, le surlignage de la recherche');
  ok(croiserHits(null, null) === null && croiserHits(recherche, null) === recherche && croiserHits(null, hits) === hits, 'l’un sans l’autre : lui seul');
  ok(decksModifies(a) === decksModifies(a), 'calculé une fois par version de la recommandation');
}
