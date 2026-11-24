// OÙ FARMER : à partir de l'état du compte face à ses objectifs
// (objectifsCompte.ts), la part acquise des pièces de chaque donjon de Cairos
// et de chaque Raid des mondes (les meules) : le moins avancé d'abord.
// Voir docs/02-app/compte/feat-objectifs.md § Où farmer.

import type { SousContenuDeck } from './importAccount';
import { scoreObjectif } from './objectifsCompte';
import type { BlocProfondeur, FamilleObjectifs, SorteArtefact } from './objectifsCompte';

// ⚠️ **Les drops de chaque donjon de Cairos** — une mécanique du jeu, relevée
// le 2026-11-24 et recoupée entre le wiki Fandom (Cairos Dungeon), Spokland
// (« où obtenir chaque set ») et les guides Theria Games ; les notes de mise à
// jour v8.1.5 et v8.1.9 (Com2uS) pour les artéfacts. Un set ne tombe que dans
// UN donjon de Cairos. Les sets de scénario, de la boutique ou de la
// fabrication ne sont pas des recommandations de farm.
// L'Intangible (Abysses) n'est jamais un objectif : il n'est pas ici.
export const RUNES_PAR_DONJON: Readonly<Partial<Record<SousContenuDeck, readonly string[]>>> = {
  'castel-geant': ['despair', 'energy', 'fatal', 'blade', 'swift'],
  'taniere-dragon': ['violent', 'revenge', 'endure', 'focus', 'shield', 'guard'],
  necropolis: ['rage', 'vampire', 'nemesis', 'will', 'destroy'],
  'royaume-spirituel': ['seal', 'fight', 'determination', 'enhance', 'accuracy', 'tolerance'],
};
// Les artéfacts : d'attribut à la Forteresse d'acier, de type à la Crypte du
// jugement.
export const ARTEFACTS_PAR_DONJON: Readonly<Record<SorteArtefact, SousContenuDeck>> = {
  attribut: 'forteresse-acier',
  type: 'crypte-jugement',
};

export function donjonDuSet(set: string): SousContenuDeck | null {
  for (const [donjon, sets] of Object.entries(RUNES_PAR_DONJON)) if (sets?.includes(set)) return donjon as SousContenuDeck;
  return null;
}

// Où se farme un manque : un donjon de Cairos (les runes, les artéfacts), ou
// le Raid des mondes pour les meules d'un palier (son index).
export type LieuFarm = { donjon: SousContenuDeck } | { raid: number };
export const idLieu = (l: LieuFarm) => ('donjon' in l ? l.donjon : `raid-${l.raid}`);

export interface RecoFarm {
  lieu: LieuFarm;
  // Les pièces visées, celles qui manquent encore, et celles en plus du visé
  // dans les cases atteintes.
  vise: number;
  manque: number;
  surplus: number;
  // La part déjà acquise : `(visé − manque) / visé` tant qu'il manque quelque
  // chose, sous 1 ; tout atteint, `(visé + surplus) / visé`, 1 ou plus.
  score: number;
}

// ⚠️ **Une case manque `visé − actuel` pièces**, plafonné à zéro : le surplus
// d'une case ne comble pas le manque d'une autre (même règle que les scores).
// ⚠️ **Au-delà de 100 % seulement quand tout est atteint**, comme tous les
// scores (`scoreObjectif`). Le raid ne dépasse jamais 100 % : il vise ce que la
// meule peut atteindre, rien au-delà.
// ⚠️ **Ce que la meule comble se farme au Raid des mondes**, qui donne les
// meules — pas au donjon : en efficience, les pièces que le « si max » du
// palier fait passer existent déjà. Pour le donjon, elles comptent comme
// acquises ; pour le raid du palier, elles manquent. Le raid vise les pièces
// que la meule peut atteindre (`min(visé, max(actuel, si max))`) et en a déjà
// `min(visé, actuel)`. La vitesse n'a pas de « si max » : pas de raid, tout
// son manque se farme au donjon.
// ⚠️ **Tous les paliers comptent pareil** (choix de Thomas) : leurs manques
// s'additionnent au donjon, une même rune pouvant manquer à deux paliers. Le
// raid, lui, est un par palier : héroïque et légendaire ne donnent pas les
// mêmes meules.
// ⚠️ **Le classement suit la part acquise**, pas le nombre de pièces : les
// artéfacts visent bien plus de pièces que les runes, et en pièces ils
// passeraient toujours devant. Ex æquo : le plus gros manque d'abord, puis
// l'ordre de Cairos, puis les raids par palier.
export function recosFarm(
  paliers: readonly BlocProfondeur[],
  vitesse: BlocProfondeur,
  artefacts: Readonly<Record<SorteArtefact, readonly FamilleObjectifs[]>>
): RecoFarm[] {
  const lieux = new Map<string, RecoFarm>();
  const ajouter = (lieu: LieuFarm, vise: number, manque: number, surplus = 0) => {
    if (vise <= 0) return;
    const l = lieux.get(idLieu(lieu)) ?? { lieu, vise: 0, manque: 0, surplus: 0, score: 0 };
    l.vise += vise;
    l.manque += manque;
    l.surplus += surplus;
    lieux.set(idLieu(lieu), l);
  };
  const blocs = [...paliers.map((bloc, palier) => ({ bloc, palier })), { bloc: vitesse, palier: null }];
  for (const { bloc, palier } of blocs)
    for (const tab of bloc.tableaux) {
      const donjon = donjonDuSet(tab.cle);
      for (const l of tab.lignes) {
        const acquis = Math.min(l.vise, l.actuel);
        const atteignable = l.siMax === undefined ? acquis : Math.min(l.vise, Math.max(l.actuel, l.siMax));
        if (donjon) ajouter({ donjon }, l.vise, l.vise - atteignable, Math.max(0, l.actuel - l.vise));
        if (palier !== null && l.siMax !== undefined) ajouter({ raid: palier }, atteignable, atteignable - acquis);
      }
    }
  for (const sorte of ['attribut', 'type'] as const)
    for (const f of artefacts[sorte])
      for (const tab of f.bloc.tableaux)
        for (const l of tab.lignes)
          ajouter({ donjon: ARTEFACTS_PAR_DONJON[sorte] }, l.vise, Math.max(0, l.vise - l.actuel), Math.max(0, l.actuel - l.vise));

  const recos = [...lieux.values()].map((l) => ({ ...l, score: scoreObjectif(l.vise - l.manque, l.vise, l.surplus) ?? 0 }));
  const cairos: string[] = [...Object.keys(RUNES_PAR_DONJON), ...Object.values(ARTEFACTS_PAR_DONJON)];
  const ordre = (l: LieuFarm) => ('donjon' in l ? cairos.indexOf(l.donjon) : cairos.length + l.raid);
  return recos.sort((a, b) => a.score - b.score || b.manque - a.manque || ordre(a.lieu) - ordre(b.lieu));
}
