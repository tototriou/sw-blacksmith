// Recommandations — une offense venue d'ailleurs ajoutée à une recommandation
// (src/lib/ajoutOffenseReco.ts) : un combat gagné des statistiques de siège
// (l'offense et la défense battue), une équipe de Mes équipes (un deck
// pré-rempli, sans défense). Quand il s'ajoute, où il va, et jamais en double.

import { offenseDuDeck, placeDeLOffense, raisonNonAjoutable, recoAvecOffense, trioDe, type OffenseAAjouter, type TrioReco } from '../src/lib/ajoutOffenseReco';
import type { MonstresConnus } from '../src/lib/recoDefenses';
import type { AttaqueSiege } from '../src/lib/siegeStatistiques';
import { emptyRecoDeck, emptyRecoSlot, type Reco, type RecoDeck } from '../src/types';
import { egal, ok, titre } from './outils';

const combat = (victoire: boolean | null, monstres: AttaqueSiege['monstres']): AttaqueSiege => ({
  t: 0, attaquant: 1, guildeAttaquante: 10, defenseur: 3, guildeDefense: 20, victoire, base: 23, monstres, points: null, tour: 5,
});
const nom = (id: number) => `M${id}`;
const OFF = trioDe([101, 102, 103], nom);
const DEF = trioDe([201, 202, 203], nom);
const duCombat = (offense: TrioReco, defense: TrioReco): OffenseAAjouter => ({ offense, defense });
// Six monstres connus, aucun lead : l'ordre d'une équipe ne compte pas.
const SANS_LEAD: MonstresConnus = new Map(
  [101, 102, 103, 201, 202, 203, 301, 302, 303].map((id) => [id, { element: 'fire', leaderSkill: null, jumeauCollab: null }] as const),
);
const reco = (decks: Reco['decks']): Reco => ({ id: 'r', origin: 'mine', name: 'R', author: '', note: '', decks });

export function testAjoutOffenseRecoCombat() {
  titre('Recommandations — une offense des statistiques de siège');

  const connu = (id: number) => SANS_LEAD.has(id);
  const equipes = { attaque: [101, 102, 103], defense: [201, 202, 203] };
  egal(raisonNonAjoutable(combat(true, equipes), connu), null, 'une victoire aux six monstres connus s’ajoute');
  egal(raisonNonAjoutable(combat(false, equipes), connu), 'defaite', 'une défaite non : l’offense n’a pas battu la défense');
  egal(raisonNonAjoutable(combat(null, equipes), connu), 'resultatInconnu', 'un résultat inconnu non plus');
  egal(raisonNonAjoutable(combat(true, null), connu), 'monstresInconnus', 'un combat dont le journal n’a pas été ouvert non plus');
  egal(raisonNonAjoutable(combat(true, { attaque: [], defense: [201, 202, 203] }), connu), 'monstresInconnus', 'une attaque que le journal ne donne pas non plus');
  egal(raisonNonAjoutable(combat(true, { ...equipes, defense: [201, 202, 999] }), connu), 'monstresInconnus', 'un monstre absent des données non plus');

  // Une recommandation neuve : son deck vide laisse la place au nouveau.
  const neuve = recoAvecOffense(reco([emptyRecoDeck()]), duCombat(OFF, DEF), SANS_LEAD);
  egal(neuve.decks.length, 1, 'recommandation neuve : le deck vide est remplacé, pas suivi');
  egal(neuve.decks[0].slots.map((s) => s.com2usId), [101, 102, 103], 'le deck : l’attaque, dans l’ordre du combat');
  egal(neuve.decks[0].counters, [{ monsters: DEF, note: '' }], 'sa défense visée : la défense battue, non notée');
  // Une autre offense : un deck de plus.
  const autre = reco([{ ...emptyRecoDeck(), slots: trioDe([301, 302, 303], nom).map((m) => ({ ...emptyRecoSlot(), ...m })) }]);
  egal(placeDeLOffense(autre, duCombat(OFF, DEF), SANS_LEAD), { type: 'nouveauDeck' }, 'offense absente : un nouveau deck');
  egal(recoAvecOffense(autre, duCombat(OFF, DEF), SANS_LEAD).decks.length, 2, 'ajouté après les decks existants');

  // La même offense, dans un autre ordre (sans lead) : la défense s'ajoute à son deck.
  const avecOffense = recoAvecOffense(autre, duCombat(trioDe([103, 101, 102], nom), trioDe([301, 302, 303], nom)), SANS_LEAD);
  egal(placeDeLOffense(avecOffense, duCombat(OFF, DEF), SANS_LEAD), { type: 'nouvelleDefense', deckIndex: 1 }, 'offense déjà là : la défense va à son deck');
  const completee = recoAvecOffense(avecOffense, duCombat(OFF, DEF), SANS_LEAD);
  egal(completee.decks.length, 2, 'pas de second deck pour la même offense');
  egal(completee.decks[1].counters.length, 2, 'la défense s’ajoute à ce qu’elle bat');
  // La même défense, dans un autre ordre : déjà dedans, rien ne change.
  egal(placeDeLOffense(completee, duCombat(OFF, trioDe([203, 201, 202], nom)), SANS_LEAD), { type: 'dejaDedans', deckIndex: 1 }, 'déjà dedans : même offense, même défense');
  ok(recoAvecOffense(completee, duCombat(OFF, DEF), SANS_LEAD) === completee, 'déjà dedans : la recommandation reste la même');

  // ⚠️ SUPPOSÉ (ajoutOffenseReco.ts) : le premier monstre du journal est le
  // leader. Un lead inconnu compte pour chef : un autre premier monstre fait
  // une autre offense, donc un autre deck — jamais une fusion abusive.
  const aucunConnu: MonstresConnus = new Map();
  const deja = recoAvecOffense(reco([emptyRecoDeck()]), duCombat(OFF, DEF), aucunConnu);
  egal(placeDeLOffense(deja, duCombat(trioDe([102, 101, 103], nom), DEF), aucunConnu), { type: 'nouveauDeck' }, 'lead inconnu : un autre premier monstre, une autre offense');
}

// Une équipe de Mes équipes : son deck pré-rempli (stats, sets, artéfacts),
// sans défense visée.
export function testAjoutOffenseRecoEquipe() {
  titre('Recommandations — une équipe de Mes équipes');
  const deckEquipe: RecoDeck = {
    ...emptyRecoDeck(),
    slots: [101, 102, 103].map((id) => ({ ...emptyRecoSlot(), com2usId: id, name: nom(id), stats: { spd: 200 + id }, setOptions: [['violent']] })),
  };
  const ajout = offenseDuDeck(deckEquipe);
  egal(ajout.offense, OFF, 'l’offense : les monstres du deck, dans son ordre (leader en tête)');
  ok(ajout.defense === null, 'aucune défense visée : une équipe dit ce qu’on joue, pas ce qu’elle bat');

  const neuve = recoAvecOffense(reco([emptyRecoDeck()]), ajout, SANS_LEAD);
  egal(neuve.decks.length, 1, 'recommandation neuve : le deck vide est remplacé');
  egal(neuve.decks[0].slots.map((s) => [s.stats.spd, s.setOptions]), [[301, [['violent']]], [302, [['violent']]], [303, [['violent']]]],
    'le deck garde les stats et les sets de l’équipe');
  egal(neuve.decks[0].counters, [], 'sans défense visée');
  ok(neuve.decks[0] !== deckEquipe && neuve.decks[0].slots[0] !== deckEquipe.slots[0], 'une copie : modifier le deck de la recommandation ne touche pas l’équipe');

  // La même équipe : déjà dedans, rien à ajouter (aucune défense à joindre).
  egal(placeDeLOffense(neuve, ajout, SANS_LEAD), { type: 'dejaDedans', deckIndex: 0 }, 'la même équipe : déjà dedans');
  ok(recoAvecOffense(neuve, ajout, SANS_LEAD) === neuve, 'déjà dedans : la recommandation reste la même, pas de doublon');
  // Une offense recommandée depuis un combat : l'équipe aux mêmes monstres y est déjà.
  egal(placeDeLOffense(recoAvecOffense(reco([emptyRecoDeck()]), duCombat(OFF, DEF), SANS_LEAD), ajout, SANS_LEAD).type, 'dejaDedans',
    'les mêmes monstres déjà recommandés depuis un combat : déjà dedans');
}
