// Les données de DÉMONSTRATION des exemples de l'accueil : des équipes figées,
// passées par les MÊMES calculs que les outils (docs/02-app/accueil/README.md).
// Pur, testé (tests/demo-accueil.test.ts).
//
// ⚠️ Des nat 5★ lumière et ténèbres SEULEMENT, dans toute équipe montrée (choix
// du mainteneur) : ce sont eux qu'un joueur reconnaît d'un coup d'œil. Sans les
// données du jeu (premier chargement, tests), une démo ne se monte pas : `null`,
// et l'accueil n'affiche pas d'exemple plutôt qu'un exemple faux.

import { emptyRecoArtifacts, type EffectLine, type Monster, type Reco, type RtaEntry, type RuneDetail } from '../types';
import type { UseRecoState } from '../hooks/useSiegeRecos';
import type { BuildCandidate } from './runeBuildOptim';
import { computeStats, monsterBaseStats } from './stats';
import { HORIZON_TICKS, simuler, vuesDeSimulation, type Action, type Camp, type LigneSim } from './speedTune';
import { ligneVierge, parTickNaturel, tuneDe, type Leads, type Ligne } from './speedTuneLignes';
import type { DonneesKit } from './speedTuneAuto';

// Les monstres des démos, par identifiant com2us.
export const DEMO = {
  LORA: 16114,
  SON_ZHANG_LAO: 16815,
  YEONHONG: 18314,
  WOONSA: 18615,
  HAN: 13515,
  AKROMA: 13814,
  TRINITY: 13815,
  ONGYOUKI: 25115,
  // Les decks de la recommandation, choisis par le mainteneur.
  MAXIMILIAN: 25715,
  DRIANA: 34213,
  SYLVIA: 20115,
  CICHLID: 19613,
  KUMAR: 17412,
  LAMIELLA: 31311,
  ADRIANA: 26811,
  ODIN: 22613,
} as const;

function tous(parCom2us: Map<number, Monster>, ids: number[]): Monster[] | null {
  const out = ids.map((id) => parCom2us.get(id));
  return out.every((m): m is Monster => m != null) ? out : null;
}

// RTA : une prépa de cinq monstres, leurs vitesses de runes et leurs sets.
const PREPA_RTA: [number, number, string][] = [
  [DEMO.LORA, 168, 'swift'],
  [DEMO.SON_ZHANG_LAO, 152, 'swift'],
  [DEMO.YEONHONG, 128, 'violent'],
  [DEMO.WOONSA, 105, 'violent'],
  [DEMO.HAN, 96, 'violent'],
];

export function demoRta(parCom2us: Map<number, Monster>): { monster: Monster; entry: RtaEntry }[] | null {
  const monstres = tous(parCom2us, PREPA_RTA.map(([id]) => id));
  if (!monstres) return null;
  return monstres.map((monster, i) => ({
    monster,
    entry: { monsterId: String(monster.id), section: PREPA_RTA[i][2], runeSpeed: PREPA_RTA[i][1], sets: [PREPA_RTA[i][2]] },
  }));
}

// Speed tuning : trois alliés, trois adversaires, sans lead ni sort — les
// vitesses seules, réparties sur les ticks 5 à 8.
const EQUIPES_SPEED: [number, Camp, number][] = [
  [DEMO.LORA, 'allie', 150],
  [DEMO.WOONSA, 'allie', 105],
  [DEMO.AKROMA, 'allie', 80],
  [DEMO.HAN, 'ennemi', 155],
  [DEMO.ONGYOUKI, 'ennemi', 120],
  [DEMO.TRINITY, 'ennemi', 70],
];
const SANS_KIT: DonneesKit = { kits: new Map(), sorts: new Map(), passifs: new Map() };
const SANS_LEAD: Leads = { allie: null, ennemi: null };

export interface DemoSpeedTune {
  ligneParUid: Map<string, Ligne>;
  parTick: Map<number, Ligne[]>;
  premiers: Action[];
  numAction: Map<string, number>;
  lignesTableau: LigneSim[];
}

// Recommandations : une recommandation de trois decks, telle que la page la
// montre. Ses textes (nom, auteur) viennent du dictionnaire de l'appelant.
// ⚠️ Ces decks-là sont ceux du mainteneur (2026-11-10), pas forcément des nat
// 5★ lumière et ténèbres : c'est son choix pour cet exemple.
const DECKS_RECO: number[][] = [
  [DEMO.MAXIMILIAN, DEMO.LORA, DEMO.DRIANA],
  [DEMO.SYLVIA, DEMO.CICHLID, DEMO.KUMAR],
  [DEMO.LAMIELLA, DEMO.ADRIANA, DEMO.ODIN],
];
// La défense que chaque deck bat (« Fort contre »), une par deck — des nat 5★
// lumière et ténèbres.
const FORT_CONTRE: number[][] = [
  [DEMO.HAN, DEMO.YEONHONG, DEMO.WOONSA],
  [DEMO.AKROMA, DEMO.TRINITY, DEMO.ONGYOUKI],
  [DEMO.SON_ZHANG_LAO, DEMO.HAN, DEMO.YEONHONG],
];

export function demoReco(parCom2us: Map<number, Monster>, textes: { nom: string; auteur: string; contributeur: string }): Reco | null {
  if (!tous(parCom2us, [...DECKS_RECO.flat(), ...FORT_CONTRE.flat()])) return null;
  return {
    id: 'demo-accueil',
    origin: 'imported',
    name: textes.nom,
    author: textes.auteur,
    contributeurs: [textes.auteur, textes.contributeur],
    note: '',
    decks: DECKS_RECO.map((ids, d) => ({
      name: '',
      note: '',
      counters: [{ note: '', monsters: FORT_CONTRE[d].map((id) => ({ com2usId: id, name: parCom2us.get(id)!.name })) }],
      slots: ids.map((id) => ({
        com2usId: id,
        name: parCom2us.get(id)!.name,
        stats: {},
        setOptions: [['violent', 'will']],
        artifacts: emptyRecoArtifacts(),
      })),
    })),
  };
}

// L'état des recommandations d'un exemple FIGÉ : il se lit, rien ne s'y
// modifie. L'exemple est inerte (`inert`), ces gestes ne sont jamais appelés ;
// ceux qui rendent une valeur le disent s'ils l'étaient.
const fige = (): never => {
  throw new Error('exemple figé de l’accueil');
};
const rien = () => {};
export function recosFigees(reco: Reco): UseRecoState {
  return {
    state: { recos: [reco] },
    addReco: fige, removeReco: rien, setMeta: rien, addDeck: rien, addDeckWith: rien, removeDeck: rien,
    restaurerReco: rien, restaurerDeck: rien, setDeckMeta: rien, remettreContenuDeck: rien,
    addCounter: rien, removeCounter: rien, setCounterMonster: rien, setCounterNote: rien,
    setSlotMonster: rien, setSlotStat: rien, addSlotArtifact: rien, removeSlotArtifact: rien,
    addSlotSet: rien, removeSlotSet: rien, addSetOption: rien, removeSetOption: rien, swapSlots: rien,
    importRecos: fige, clearAll: rien, synchroniserDiscord: fige, delierReco: rien,
    apresPublicationDiscord: rien, apresConflitDiscord: rien, fusionnerDiscord: () => false,
  };
}

// Optimizer : deux builds de six runes légendaires +15 pour Woonsa — Violent
// ×4 + Volonté ×2, puis Rapide ×4 + Volonté ×2 —, leurs stats calculées comme
// l'Optimizer les calcule : la page de résultats, ses deux premières places.
// Codes d'effet com2us : 1 PV+, 2 PV%, 3 ATQ+, 4 ATQ%, 5 DEF+, 6 DEF%,
// 8 VIT, 9 Tx critiq., 10 Dgts critiq., 11 RES, 12 Précision.
const l = (code: number, value: number): EffectLine => ({ code, value });
const BUILDS_DEMO: [string, EffectLine, EffectLine[]][][] = [
  [
    ['violent', l(3, 160), [l(8, 18), l(2, 13), l(11, 9), l(12, 8)]],
    ['violent', l(8, 42), [l(2, 15), l(6, 11), l(11, 12), l(12, 9)]],
    ['violent', l(5, 160), [l(8, 16), l(2, 12), l(11, 8), l(12, 13)]],
    ['violent', l(2, 63), [l(8, 20), l(6, 10), l(11, 10), l(12, 7)]],
    ['will', l(1, 2448), [l(8, 14), l(2, 16), l(11, 11), l(12, 10)]],
    ['will', l(2, 63), [l(8, 17), l(6, 12), l(11, 9), l(12, 9)]],
  ],
  [
    ['swift', l(3, 160), [l(8, 15), l(2, 11), l(11, 11), l(12, 10)]],
    ['swift', l(8, 42), [l(2, 13), l(6, 13), l(11, 9), l(12, 12)]],
    ['swift', l(5, 160), [l(8, 14), l(2, 15), l(11, 10), l(12, 8)]],
    ['swift', l(2, 63), [l(8, 17), l(6, 9), l(11, 12), l(12, 9)]],
    ['will', l(1, 2448), [l(8, 12), l(2, 14), l(11, 9), l(12, 11)]],
    ['will', l(2, 63), [l(8, 13), l(6, 11), l(11, 10), l(12, 8)]],
  ],
];

export function demoOptimizer(parCom2us: Map<number, Monster>): { monster: Monster; runes: RuneDetail[]; candidats: BuildCandidate[] } | null {
  const monster = parCom2us.get(DEMO.WOONSA);
  if (!monster) return null;
  const builds = BUILDS_DEMO.map((build, b) =>
    build.map(([set, main, subs], i): RuneDetail => ({ id: 900001 + b * 10 + i, slot: i + 1, set, rank: 6, rarity: 5, level: 15, main, subs }))
  );
  const candidats = builds.map((runes) => ({
    runeIds: runes.map((r) => r.id),
    stats: computeStats({ base: monsterBaseStats(monster), runes, artifacts: [] }),
    effTotal: 0,
  }));
  return { monster, runes: builds.flat(), candidats };
}

export function demoSpeedTune(parCom2us: Map<number, Monster>): DemoSpeedTune | null {
  const monstres = tous(parCom2us, EQUIPES_SPEED.map(([id]) => id));
  if (!monstres) return null;
  const lignes: Ligne[] = monstres.map((m, i) => ({ ...ligneVierge(m, EQUIPES_SPEED[i][1]), runeSpeed: EQUIPES_SPEED[i][2] }));
  const sim = simuler(tuneDe(lignes, SANS_LEAD, SANS_KIT, {}), HORIZON_TICKS);
  return {
    ligneParUid: new Map(lignes.map((l) => [l.uid, l])),
    parTick: parTickNaturel(lignes, SANS_LEAD, SANS_KIT),
    ...vuesDeSimulation(sim),
  };
}
