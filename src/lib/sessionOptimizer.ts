// L'Optimizer dans une sauvegarde de session : une photo de ses champs de
// DONNÉES (`useOptimizerState`) : sélection, exemplaire, critères, tri et
// filtres d'affichage des résultats.
// La photo est sérialisée, puis rejouée au chargement d'une session
// (`restaurerOptimizer`, appelé par App.tsx une fois l'écran monté).
//
// ⚠️ **Chaque champ de données de `OptimizerState` est classé** : dans la
// session, ou hors session (interface, état passager, résultats qui se
// recalculent). Les gardes ci-dessous font échouer `tsc` sur un champ ajouté
// sans être classé, sur un champ classé qui n'existe plus, et sur un champ
// de la session sans son `set…` — l'oubli d'un champ optionnel, que `tsc` ne
// voit jamais ailleurs, devient une erreur de compilation.

import type { OptimizerState } from '../hooks/useOptimizerState';
import { normaliserCompetencesInvocateur } from './competencesInvocateur';
import { estSimulationRunes, simulationDepuisAncienReglage } from './runesMaxees';

export const CHAMPS_OPTIMIZER_SESSION = [
  'selectedId',
  // L'exemplaire de l'espèce : revérifié contre le compte au remontage de
  // l'écran (OptimizerSection.tsx).
  'gearSource',
  'sourceSelector',
  'comboSets',
  'minStats',
  'maxStats',
  'mainStatsBySlot',
  'lockedRunes',
  'excludeBase',
  'optimiserArtefacts',
  'artifactMainByKind',
  'relicMainChoice',
  'relicUniqueChoice',
  'relicMinUpgrade',
  'lignesVerrouillees',
  'sortsPrecision',
  'objective',
  'damageSetup',
  'compterAurasResPre',
  'excludeUsedRunes',
  'excludeUsedScope',
  'excludedSelectors',
  'verifierToutesLesCombinaisons',
  'simulationRunes',
  'slotFilterPreset',
  'sortBy',
  // Les filtres d'affichage des résultats voyagent avec le tri.
  'sensTri',
  'bornesResultats',
] as const;

export const CHAMPS_OPTIMIZER_HORS_SESSION = [
  // Attribution à reconstruire seulement par un geste, jamais à la reprise.
  'proprietaireCriteres',
  'rapportCriteres',
  // Interface et validation de l'écran.
  'setPickerInvalid',
  'resultsPage',
  'openDetailKey',
  // Les builds épinglés photographient des cartes et le contexte de leur
  // recherche (le pool de runes compris) : un affichage de travail, comme
  // les résultats, qui ne se rejoue pas à la reprise.
  'epingles',
  // Cran remonté pour la navigation seulement ; format de session inchangé.
  'critereArtefacts',
  // Passager : diagnostic, arrêt manuel, compteurs d'import.
  'diagnoseBlockingEnabled',
  'stoppedManually',
  'importDuCompte',
  'importReliqueTraite',
  // La recherche et ses résultats : ils se recalculent.
  'search',
] as const;

type ChampSession = (typeof CHAMPS_OPTIMIZER_SESSION)[number];
type ChampClasse = ChampSession | (typeof CHAMPS_OPTIMIZER_HORS_SESSION)[number];
// Les champs de données : tout sauf les fonctions (les `set…`, `resetSearch`…).
type ChampDonnee = { [K in keyof OptimizerState]: OptimizerState[K] extends (...a: never[]) => unknown ? never : K }[keyof OptimizerState];

// ⚠️ Gardes à la compilation. Une erreur ici = un champ à classer.
type NonClasse = Exclude<ChampDonnee, ChampClasse>;
type Inexistant = Exclude<ChampClasse, ChampDonnee>;
type SansSetter = { [K in ChampSession]: `set${Capitalize<K>}` extends keyof OptimizerState ? never : K }[ChampSession];
const GARDES: [[NonClasse] extends [never] ? 'ok' : NonClasse, [Inexistant] extends [never] ? 'ok' : Inexistant, [SansSetter] extends [never] ? 'ok' : SansSetter] = ['ok', 'ok', 'ok'];
void GARDES;

// La photo : les champs de la session, et eux seuls.
export function photoOptimizer(etat: OptimizerState): Record<string, unknown> {
  const photo: Record<string, unknown> = {};
  for (const champ of CHAMPS_OPTIMIZER_SESSION) photo[champ] = etat[champ];
  photo.damageSetup = normaliserCompetencesInvocateur(etat.damageSetup);
  return photo;
}

// La FORME d'une valeur, assez fine pour refuser un tableau là où l'écran
// attend un `Set`, un texte là où il attend un nombre.
function forme(v: unknown): string {
  if (v === null || v === undefined) return 'vide';
  if (v instanceof Set) return 'set';
  if (v instanceof Map) return 'map';
  if (Array.isArray(v)) return 'tableau';
  return typeof v;
}

// Une photo rejouée sur l'écran de l'Optimizer, par les `set…` de ses champs
// (garantis par les gardes ci-dessus), dans l'ordre de
// `CHAMPS_OPTIMIZER_SESSION` : la sélection du monstre d'abord.
// ⚠️ **La forme se vérifie contre l'état de l'écran** : une valeur d'une autre
// forme (photo d'une ancienne version, fichier retouché) casserait l'écran
// qui la lit — elle est laissée, et son champ rendu. Un champ encore vide à
// l'écran (rien de choisi) accepte toute valeur.
// Rend les champs laissés.
// ⚠️ Une photo d'avant les trois lignes de simulation porte l'ancien
// interrupteur unique `simulerRunesMaxees`, traduit comme dans une recette
// (`simulationDepuisAncienReglage`) ; l'ancien `exhaustiveSearch`, retiré,
// est ignoré. `simulationRunes` se vérifie jusque dans ses lignes : un objet
// d'une autre forme casserait la colonne des options.
export function restaurerOptimizer(etat: OptimizerState, photo: Record<string, unknown>): string[] {
  const laisses: string[] = [];
  if (!('simulationRunes' in photo) && typeof photo.simulerRunesMaxees === 'boolean') {
    photo = { ...photo, simulationRunes: simulationDepuisAncienReglage(photo.simulerRunesMaxees) };
  }
  for (const champ of CHAMPS_OPTIMIZER_SESSION) {
    if (!(champ in photo)) continue;
    const valeur = photo[champ];
    const courant = etat[champ];
    if (champ === 'simulationRunes' && !estSimulationRunes(valeur)) {
      laisses.push(champ);
      continue;
    }
    if (forme(valeur) !== forme(courant) && forme(courant) !== 'vide') {
      laisses.push(champ);
      continue;
    }
    const setter = etat[`set${champ[0].toUpperCase()}${champ.slice(1)}` as keyof OptimizerState] as (v: unknown) => void;
    setter(valeur);
  }
  return laisses;
}
