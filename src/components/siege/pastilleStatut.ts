import type { StatutEquipe } from '../../lib/siegeStatut';
import type { Dictionnaire } from '../../i18n/fr';

// La PASTILLE de statut d'une équipe de siège, écrite à côté de son titre, à
// la place d'un point de couleur ou d'un fond coloré : le statut y est ÉCRIT.
//
// ⚠️ **Des libellés tirés des phrases de l'app**, jamais inventés : choisis
// parmi les phrases que le pied de la carte affiche déjà
// (« Tous au tick », « Speed tune validé », « Ton équipe n'est pas au tick »…).
// La phrase détaillée reste dans le pied : la pastille dit l'état d'un coup
// d'œil, le pied dit quoi faire.
//
// Affichage seulement — le statut lui-même se décide dans `lib/siegeStatut`,
// où chaque cas est testé. Ce module ne fait que le NOMMER.

export type TonPastille = 'good' | 'warn' | 'bad';

export interface EntreePastille {
  statut: StatutEquipe;
  // L'utilisateur a validé l'écart à la main (« Valider le tick / speed tune »).
  validee: boolean;
  // Au moins un set Rapidité : l'équipe se juge au speed tune.
  swift: boolean;
  // Un monstre de l'équipe n'a pas tout son équipement (plus urgent que tout).
  manqueRunes: boolean;
  manqueArtes: boolean;
}

export function pastilleStatut(e: EntreePastille, t: Dictionnaire): { libelle: string; ton: TonPastille } | null {
  const p = t.siege.pastille;
  // L'équipement d'abord, comme dans le pied : c'est le défaut le plus urgent.
  // ⚠️ « Artéfacts incomplets » quand il ne manque QUE des artéfacts : « Runes
  // incomplètes » y serait faux.
  if (e.manqueRunes) return { libelle: p.runesIncompletes, ton: 'bad' };
  if (e.manqueArtes) return { libelle: p.artefactsIncomplets, ton: 'bad' };
  switch (e.statut) {
    case 'rouge':
      return { libelle: p.pasAuTick, ton: 'bad' };
    case 'orange':
      return { libelle: p.aVerifier, ton: 'warn' };
    case 'vert':
      if (e.validee) return { libelle: e.swift ? p.speedTuneValide : p.tickValide, ton: 'good' };
      return { libelle: e.swift ? p.speedTune : p.tousAuTick, ton: 'good' };
    default:
      return null;
  }
}
