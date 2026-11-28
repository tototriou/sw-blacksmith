// Recommandations — la fiabilité d'un deck contre une défense : une note en
// étoiles, de 0 à 5, saisie par étoile entière et relue par demi-étoile (les
// notes d'avant), qui classe les offenses d'une même défense en vue Défense,
// et voyage dans l'export.

import { FIABILITE_PAS_SAISIE, fiabiliteValide, parFiabilite, tonFiabilite, vueDefenses, type MonstresConnus } from '../src/lib/recoDefenses';
import { decodeRecosJson, encodeRecosJson } from '../src/lib/recoShare';
import { fiabiliteDuHit, ordreDe, suivreOrdre, trierParFiabilite, type DeckHit, type RecoHit } from '../src/lib/recoSearch';
import { emptyRecoSlot, type Reco, type RecoCounter, type RecoDeck } from '../src/types';
import { fr } from '../src/i18n/fr';
import { egal, ok, titre } from './outils';

const m = (id: number) => ({ com2usId: id, name: `M${id}` });
const contre = (fiabilite?: number): RecoCounter => ({ monsters: [m(1), m(2), m(3)], note: '', ...(fiabilite !== undefined ? { fiabilite } : {}) });
const deck = (counters: RecoCounter[], id: number): RecoDeck => ({
  name: '',
  note: '',
  slots: [{ ...emptyRecoSlot(), com2usId: id, name: `D${id}` }, emptyRecoSlot(), emptyRecoSlot()],
  counters,
});
const reco = (decks: RecoDeck[]): Reco => ({ id: 'r', origin: 'mine', name: 'R', author: '', note: '', decks });
// Aucun lead connu : l'équipe 1-2-3 est la même défense pour chaque deck.
const connus: MonstresConnus = new Map();

export default function testRecoFiabilite() {
  titre('Recommandations — la fiabilité d\'un deck contre une défense');

  // Saisie par étoile entière ; relue par demi-étoile, de 0 à 5, rien d'autre :
  // une note d'avant en demi-étoile n'est pas effacée.
  egal(FIABILITE_PAS_SAISIE, 1, 'saisie : 0, 1, 2, 3, 4, 5');
  egal([0, 0.5, 2.5, 5].map(fiabiliteValide), [0, 0.5, 2.5, 5], 'de 0 à 5 par demi-étoile : relue');
  egal([2.3, 5.5, -0.5, '4', null, NaN].map(fiabiliteValide), [undefined, undefined, undefined, undefined, undefined, undefined],
    'hors des demi-étoiles, au-delà de 5, négative, texte : non notée');

  // Les couleurs : rouge en bas, jaune au milieu, vert en haut.
  egal([0, 1.5, 2, 3.5, 4, 5].map(tonFiabilite), ['bad', 'bad', 'warn', 'warn', 'good', 'good'], 'rouge < 2 ≤ jaune < 4 ≤ vert');

  // Le tri : la plus fiable d'abord, 0 avant « non notée », stable à égalité.
  const ordre = [{ fiabilite: 2, i: 0 }, { i: 1 }, { fiabilite: 0, i: 2 }, { fiabilite: 4.5, i: 3 }, { fiabilite: 2, i: 4 }].sort(parFiabilite);
  egal(ordre.map((x) => x.i), [3, 0, 4, 2, 1], 'tri : 4,5 · 2 · 2 (ordre gardé) · 0 · non notée');

  // La vue Défense classe les offenses d'une même défense.
  const r = reco([deck([contre(2)], 10), deck([contre()], 11), deck([contre(4.5)], 12), deck([contre(0)], 13)]);
  const v = vueDefenses(r, connus);
  egal(v.defenses.length, 1, 'une seule défense, battue par quatre decks');
  egal(v.defenses[0].offenses.map((o) => o.deckIndex), [2, 0, 3, 1], 'vue Défense : la plus fiable d\'abord, la non notée à la fin');
  egal(v.defenses[0].offenses.map((o) => o.fiabilite), [4.5, 2, 0, undefined], 'chaque offense porte sa fiabilité');

  // L'export la transporte ; une défense non notée n'écrit rien.
  const texte = encodeRecosJson([r]);
  ok(texte.includes('"fiabilite": 4.5') && texte.includes('"fiabilite": 0'), 'export : la fiabilité, 0 compris');
  egal((texte.match(/"fiabilite"/g) ?? []).length, 3, 'export : rien pour la défense non notée');
  const relu = decodeRecosJson(texte, fr)?.[0];
  egal(relu?.decks.map((d) => d.counters[0].fiabilite), [2, undefined, 4.5, 0], 'import : la fiabilité relue telle quelle');

  // Une valeur invalide est ignorée, la défense reste ; la clé anglaise est lue.
  const brut = (fiab: object) => JSON.stringify({
    format: 'swblacksmith/recommandations',
    version: 5,
    recommandations: [{ nom: 'R', decks: [{ monstres: [{ com2usId: 10, nom: 'D' }, null, null], fort_contre: [{ monstres: [{ com2usId: 1, nom: 'M1' }, null, null], ...fiab }] }] }],
  });
  const c = (fiab: object) => decodeRecosJson(brut(fiab), fr)?.[0]?.decks[0]?.counters;
  egal(c({ fiabilite: 7 })?.map((x) => x.fiabilite), [undefined], 'import : une fiabilité invalide est ignorée, la défense reste');
  egal(c({ reliability: 3.5 })?.[0]?.fiabilite, 3.5, 'import : la clé anglaise « reliability » est lue');

  // ── Le tri des résultats d'une recherche ──
  const autre = (fiabilite?: number): RecoCounter => ({ monsters: [m(7), m(8), m(9)], note: '', ...(fiabilite !== undefined ? { fiabilite } : {}) });
  const d = (deckIndex: number, counters: number[]): DeckHit => ({ deckIndex, slots: [], counters });
  const r1 = { ...reco([deck([contre(1), autre(5)], 10), deck([contre(4)], 11), deck([contre()], 12)]), id: 'r1' };
  const r2 = { ...reco([deck([contre(4.5)], 20)]), id: 'r2' };

  // La fiabilité d'un deck trouvé : celle des défenses qui répondent.
  egal(fiabiliteDuHit(r1.decks[0], d(0, [0])), 1, 'deck trouvé par sa défense : la fiabilité de CETTE défense (1), pas la meilleure du deck (5)');
  egal(fiabiliteDuHit(r1.decks[0], d(0, [])), 5, 'deck trouvé par ses monstres : la meilleure de ses défenses');
  egal(fiabiliteDuHit(r1.decks[2], d(2, [0])), undefined, 'défense non notée : pas de fiabilité');

  const hits: RecoHit[] = [
    { reco: r1, decks: [d(0, [0]), d(1, [0]), d(2, [0])], enOffense: false, enDefense: true },
    { reco: r2, decks: [d(0, [0])], enOffense: false, enDefense: true },
  ];
  const tries = trierParFiabilite(hits);
  egal(tries.map((h) => h.reco.id), ['r2', 'r1'], 'les recommandations, par leur meilleur deck (4,5 avant 4)');
  egal(tries[1].decks.map((x) => x.deckIndex), [1, 0, 2], 'dans une recommandation : 4, 1, non noté');
  egal(hits[0].decks.map((x) => x.deckIndex), [0, 1, 2], 'les résultats d\'origine ne sont pas modifiés');

  // L'ordre figé : des résultats recalculés (une note changée, un deck ajouté)
  // gardent la place prise au tri ; l'inconnu vient après.
  const recalcules: RecoHit[] = [
    { ...hits[0], decks: [d(0, [0]), d(1, [0]), d(2, [0]), d(3, [0])] },
    hits[1],
    { reco: { ...reco([]), id: 'r3' }, decks: [], enOffense: false, enDefense: true },
  ];
  const suivis = suivreOrdre(recalcules, ordreDe(tries));
  egal(suivis.map((h) => h.reco.id), ['r2', 'r1', 'r3'], 'ordre figé : les recommandations à leur place, la nouvelle après');
  egal(suivis[1].decks.map((x) => x.deckIndex), [1, 0, 2, 3], 'ordre figé : les decks à leur place, le nouveau après');
}
