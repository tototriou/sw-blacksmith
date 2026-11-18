import type { CarteClassement } from './classementCompact';
import type { ContexteResultat } from './contexteResultat';

// Les builds épinglés de l'Optimizer : des builds de résultat mis de côté
// pendant la recherche, qui restent visibles quand on change les critères, les
// filtres d'affichage ou le tri (docs/02-app/optimizer/ecran/resultats.md,
// § Builds épinglés).
//
// ⚠️ **Une photographie, jamais une référence à la page du classeur** : une
// épingle garde la carte telle que le classeur l'a publiée ET le contexte de la
// recherche qui l'a produite. Le classeur n'envoie à l'écran que la page
// affichée ; une nouvelle recherche, un tri ou un filtre la remplacent, et un
// build épinglé n'en fait plus forcément partie.
// ⚠️ **Propres à chaque monstre de la liste** : rangées par membre
// (`cleMembreEpingles`), passer à un autre monstre n'en montre aucune autre.
// Calcul pur : l'écran tient l'état (useOptimizerState.ts), ces fonctions le
// transforment sans jamais le modifier.

/** Au plus dix builds épinglés par monstre (demande de l'utilisateur). */
export const MAX_EPINGLES = 10;

/** Ce qu'une épingle doit au moins porter : son identité. */
export interface AvecCleEpingle {
  readonly cle: string;
}

/** Les épinglés de chaque monstre, dans l'ordre d'épinglage. */
export type EpinglesParMembre<T extends AvecCleEpingle> = Readonly<Record<string, readonly T[]>>;

/**
 * L'identité d'un build épinglé : ses six runes, sa paire d'artéfacts et sa
 * relique — ce que « Valider » réserverait. Deux recherches peuvent rendre les
 * mêmes runes avec une autre paire : deux builds, comme pour « Valider les
 * artéfacts ». Les runes dans leur ordre de slot, les artéfacts triés (leur
 * ordre d'affichage ne fait pas un autre build).
 */
export function cleEpingle(runeIds: readonly number[], artefactIds: readonly number[], reliqueId: number | null | undefined): string {
  return `${runeIds.join('-')}|${[...artefactIds].sort((a, b) => a - b).join('-')}|${reliqueId ?? ''}`;
}

/**
 * La clé d'un membre : la liste active et l'exemplaire (`exclusionSelectorKey`).
 * Le même exemplaire dans deux listes garde deux jeux d'épinglés, comme ses
 * critères (mémoires par liste et sélecteur). `null` sans exemplaire résolu :
 * rien à épingler.
 */
export function cleMembreEpingles(listId: string | null, selecteur: string | null): string | null {
  return selecteur ? `${listId ?? ''}::${selecteur}` : null;
}

export function epinglesDe<T extends AvecCleEpingle>(etat: EpinglesParMembre<T>, membre: string | null): readonly T[] {
  return (membre && etat[membre]) || [];
}

/** Le numéro d'un build épinglé, de 1 à 10 dans l'ordre d'épinglage ; `null` s'il ne l'est pas. */
export function numeroEpingle<T extends AvecCleEpingle>(liste: readonly T[], cle: string): number | null {
  const i = liste.findIndex((e) => e.cle === cle);
  return i < 0 ? null : i + 1;
}

/** Peut-on encore en épingler un ? Faux au-delà de `MAX_EPINGLES`. */
export function placeLibre<T extends AvecCleEpingle>(liste: readonly T[]): boolean {
  return liste.length < MAX_EPINGLES;
}

/**
 * Épingle `build` à la fin de la liste du membre. Sans effet (le même objet
 * rendu) s'il est déjà épinglé ou si les dix places sont prises : rien n'est
 * jamais remplacé en silence.
 */
export function epingler<T extends AvecCleEpingle>(etat: EpinglesParMembre<T>, membre: string, build: T): EpinglesParMembre<T> {
  const liste = epinglesDe(etat, membre);
  if (!placeLibre(liste) || numeroEpingle(liste, build.cle) !== null) return etat;
  return { ...etat, [membre]: [...liste, build] };
}

/**
 * Libère un build : les suivants remontent d'un numéro, sans trou. Sans effet
 * s'il n'était pas épinglé.
 */
export function liberer<T extends AvecCleEpingle>(etat: EpinglesParMembre<T>, membre: string, cle: string): EpinglesParMembre<T> {
  const liste = epinglesDe(etat, membre);
  if (numeroEpingle(liste, cle) === null) return etat;
  const reste = liste.filter((e) => e.cle !== cle);
  if (reste.length > 0) return { ...etat, [membre]: reste };
  const { [membre]: _retire, ...autres } = etat;
  return autres;
}

/** Libère tous les builds épinglés du membre, et seulement les siens. */
export function libererTout<T extends AvecCleEpingle>(etat: EpinglesParMembre<T>, membre: string): EpinglesParMembre<T> {
  if (!(membre in etat)) return etat;
  const { [membre]: _retire, ...autres } = etat;
  return autres;
}

/** Épingle ou libère : le geste du bouton de la carte. */
export function basculerEpingle<T extends AvecCleEpingle>(etat: EpinglesParMembre<T>, membre: string, build: T): EpinglesParMembre<T> {
  return numeroEpingle(epinglesDe(etat, membre), build.cle) === null ? epingler(etat, membre, build) : liberer(etat, membre, build.cle);
}

/**
 * Un build épinglé à l'écran : la carte publiée par le classeur, le contexte de
 * la recherche qui l'a produite (runes du pool photographié, fiche, combat,
 * relique), et les rangées de valeur que la carte montrait (`objectifsMontres`
 * au moment du geste). Rien n'est recalculé contre la recherche courante : la
 * carte épinglée reste celle qu'on a vue.
 */
export interface BuildEpingle extends AvecCleEpingle {
  readonly carte: CarteClassement;
  readonly contexte: ContexteResultat;
  readonly montres: { readonly ehp: boolean; readonly degats: boolean };
}
