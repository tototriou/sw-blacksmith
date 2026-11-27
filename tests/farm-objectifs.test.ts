// Où farmer : le manque de chaque donjon d'après l'état du compte face à ses
// objectifs — voir src/lib/farmObjectifs.ts et
// docs/02-app/compte/feat-objectifs.md § Où farmer.

import { BlocProfondeur, FamilleObjectifs, LigneProfondeur, SETS_OBJECTIFS } from '../src/lib/objectifsCompte';
import { ARTEFACTS_PAR_DONJON, RUNES_PAR_DONJON, donjonDuSet, idLieu, recosFarm } from '../src/lib/farmObjectifs';
import { egal, ok, titre } from './outils';

// Un bloc d'un set : une ligne par emplacement, [visé, actuel, si max ?].
function bloc(set: string, cases: [number, number, number?][]): BlocProfondeur {
  const lignes: LigneProfondeur[] = cases.map(([vise, actuel, siMax], i) => ({
    cle: i + 1, seuil: 100, vise, actuel, intangible: 0, ...(siMax !== undefined ? { siMax } : {}),
  }));
  return { tableaux: [{ cle: set, lignes, vise: 0, compte: 0, surplus: 0, score: null }], parLigne: [], global: null };
}
const VIDE: BlocProfondeur = { tableaux: [], parLigne: [], global: null };
const SANS_ARTEFACTS = { attribut: [], type: [] };
// Une famille d'artéfacts : une fiche, des sous-colonnes [visé, actuel].
const famille = (cases: [number, number][]): FamilleObjectifs => ({
  famille: 'recus',
  lignes: [0],
  bloc: {
    tableaux: [{ cle: '0', lignes: cases.map(([vise, actuel], i) => ({ cle: i, seuil: 22, vise, actuel, intangible: 0 })), vise: 0, compte: 0, surplus: 0, score: null }],
    parLigne: [],
    global: null,
  },
});

export default function testFarmObjectifs() {
  titre('Objectifs du compte — où farmer');

  // ── La table des drops ──
  egal(donjonDuSet('violent'), 'taniere-dragon', 'Violent : Tanière du dragon');
  egal(donjonDuSet('despair'), 'castel-geant', 'Désespoir : Castel du Géant');
  egal(donjonDuSet('rage'), 'necropolis', 'Rage : Nécropolis');
  egal(donjonDuSet('seal'), 'royaume-spirituel', 'Sceau : Royaume spirituel');
  egal(donjonDuSet('intangible'), null, 'Intangible : pas un objectif, pas de donjon');
  ok(SETS_OBJECTIFS.every((s) => donjonDuSet(s) !== null), 'chaque set qu’on peut viser a son donjon');
  const tous = Object.values(RUNES_PAR_DONJON).flat();
  egal(tous.length, new Set(tous).size, 'un set ne tombe que dans un donjon');
  egal(ARTEFACTS_PAR_DONJON, { attribut: 'forteresse-acier', type: 'crypte-jugement' }, 'artéfacts : attribut à la Forteresse, type à la Crypte');

  // ── Le manque : visé − actuel, case par case ──
  const r = recosFarm([bloc('violent', [[4, 1], [2, 5], [3, 3]])], VIDE, SANS_ARTEFACTS);
  egal(
    r,
    [{ lieu: { donjon: 'taniere-dragon' }, vise: 9, manque: 3, surplus: 3, score: 6 / 9 }],
    'un surplus en 2 ne comble pas le manque en 1 : sous 100 % tant qu’il manque quelque chose'
  );

  // ── Au-delà de 100 % : seulement quand tout est atteint ──
  const s = recosFarm([bloc('violent', [[4, 6, 6], [2, 2, 2]])], bloc('violent', [[1, 2]]), SANS_ARTEFACTS);
  egal(
    s.map((d) => [idLieu(d.lieu), d.vise, d.surplus, d.score]),
    [['raid-0', 6, 0, 1], ['taniere-dragon', 7, 3, 10 / 7]],
    'tout atteint : le surplus des cases s’ajoute (142,9 %) ; le raid s’arrête à 100 %'
  );

  // ── Ce que la meule comble se farme au Raid des mondes, pas au donjon ──
  const m = recosFarm([bloc('will', [[4, 1, 3], [2, 0, 5]])], VIDE, SANS_ARTEFACTS);
  egal(
    m,
    [
      { lieu: { raid: 0 }, vise: 5, manque: 4, surplus: 0, score: 0.2 },
      { lieu: { donjon: 'necropolis' }, vise: 6, manque: 1, surplus: 0, score: 5 / 6 },
    ],
    'raid : il vise ce que la meule atteint (3 en 1, 2 en 2 — si max plafonné au visé), il en manque 4 ; au donjon, le meulable compte comme acquis'
  );
  egal(idLieu({ raid: 1 }), 'raid-1', 'un raid par palier');

  // ── Tous les paliers comptent pareil, la vitesse aussi ──
  const p = recosFarm([bloc('violent', [[2, 0]]), bloc('violent', [[1, 0]])], bloc('swift', [[3, 1]]), SANS_ARTEFACTS);
  egal(
    p.map((d) => [idLieu(d.lieu), d.vise, d.manque]),
    [['taniere-dragon', 3, 3], ['castel-geant', 3, 2]],
    'les manques des paliers s’additionnent ; la vitesse sans si max se farme en entier ; le moins avancé d’abord'
  );
  const v = recosFarm([bloc('violent', [[2, 0, 2]]), bloc('violent', [[1, 0, 0]])], bloc('swift', [[3, 1]]), SANS_ARTEFACTS);
  egal(
    v.map((d) => [idLieu(d.lieu), d.vise, d.manque]),
    [['raid-0', 2, 2], ['castel-geant', 3, 2], ['taniere-dragon', 3, 1]],
    'un raid par palier dont la meule fait passer quelque chose ; jamais pour la vitesse'
  );

  // ── Le classement suit la part acquise, pas le nombre de pièces ──
  const c = recosFarm([bloc('violent', [[100, 60]]), bloc('swift', [[4, 0]]), bloc('rage', [[2, 0]])], VIDE, SANS_ARTEFACTS);
  egal(
    c.map((d) => [idLieu(d.lieu), d.score]),
    [['castel-geant', 0], ['necropolis', 0], ['taniere-dragon', 0.6]],
    '40 pièces à 60 % passent après 4 pièces à 0 % ; ex æquo, le plus gros manque d’abord'
  );

  // ── Artéfacts ──
  const a = recosFarm([], VIDE, { attribut: [famille([[2, 0], [0, 3], [1, 1]])], type: [famille([[3, 0]])] });
  egal(
    a.map((d) => [idLieu(d.lieu), d.vise, d.manque]),
    [['crypte-jugement', 3, 3], ['forteresse-acier', 3, 2]],
    'artéfacts : le manque par sorte, à son donjon ; une case sans visée ne compte pas'
  );

  // ── Rien ne manque ──
  egal(
    recosFarm([bloc('violent', [[2, 2]])], VIDE, SANS_ARTEFACTS),
    [{ lieu: { donjon: 'taniere-dragon' }, vise: 2, manque: 0, surplus: 0, score: 1 }],
    'objectifs atteints : le donjon reste, à 100 %'
  );
  egal(recosFarm([], VIDE, SANS_ARTEFACTS), [], 'rien de visé : aucun lieu');
}
