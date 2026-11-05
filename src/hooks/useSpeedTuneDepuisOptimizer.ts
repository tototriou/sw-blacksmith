// Régler le speed tune d'une équipe depuis l'Optimizer : ouvrir l'outil en
// modale sur l'équipe, puis appliquer le plan construit à l'équipe.
// Spec : docs/02-app/optimizer/feat-speed-tune-depuis-optimizer.md.
import { useCallback, useMemo, useState } from 'react';
import type { ArtifactDetail, Monster, RuneDetail } from '../types';
import type { EquipeOptimizer, MemoireMembreOptimizer } from '../lib/optimizerMemberStorage';
import { cleMemoireMembre } from '../lib/optimizerMemberStorage';
import { baseCompleteCriteres, type CriteresOptimizer } from '../lib/criteresOptimizer';
import { exclusionSelectorKey, findValidatedBuild, resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData, type ValidatedBuild } from '../lib/optimizerExclusion';
import type { PlanSpeedTune } from '../lib/planSpeedTune';
import { appliquerPlanALEquipe, criteresAvecRepli, ouvertureDeLEquipe, type OuvertureOptimizer } from '../lib/speedTuneDepuisPlan';
import { entreesDuGear, gearDuBuildValide } from '../lib/speedTuneMembre';
import { reinitialiserSticky } from './useStickyState';
import { ESPACE_SPEED_TUNE_OPTIMIZER } from './useSpeedTune';
import { bestiaireDe } from './useZoneSpeedTune';
import { useTraduction } from './useLangue';

export function useSpeedTuneDepuisOptimizer(e: {
  teams: readonly EquipeOptimizer[];
  validated: readonly ValidatedBuild[];
  activeListId: string | null;
  data: ExclusionSourceData;
  runeById: ReadonlyMap<number, RuneDetail>;
  artifactById: ReadonlyMap<number, ArtifactDetail>;
  allMonsters: readonly Monster[];
  memories: ReadonlyMap<string, MemoireMembreOptimizer>;
  // Clé (`exclusionSelectorKey`) du membre affiché : ses critères vivent dans
  // l'état de l'écran, pas dans sa mémoire.
  selectionne: string | null;
  setTeams: (teams: EquipeOptimizer[]) => void;
  writeMemory: (membre: Omit<MemoireMembreOptimizer, 'criteres'>, criteres: CriteresOptimizer, data: ExclusionSourceData) => void;
  poserRepli: (vitesseMin: number | null, verrou206: number | null) => void;
}) {
  const o = useTraduction().optimizer.speedTune;
  const monstres = useMemo(() => bestiaireDe(e.allMonsters), [e.allMonsters]);
  const [ouverte, setOuverte] = useState<{ equipeId: string; ouverture: OuvertureOptimizer } | null>(null);
  const [messages, setMessages] = useState<string[]>([]);

  const { teams, validated, activeListId, data, runeById, artifactById, memories, selectionne, setTeams, writeMemory, poserRepli } = e;
  const ouvrir = useCallback((equipe: EquipeOptimizer) => {
    // Build validé exploitable, sinon équipement porté complet ; sinon vitesse à saisir.
    const membreDe = (s: ExclusionSelector) => {
      const r = resolveExclusionEntry(s, data);
      if (!r) return null;
      const b = findValidatedBuild([...validated], activeListId, exclusionSelectorKey(s));
      const gear = b ? gearDuBuildValide(r.gear.base, b.runeIds, b.artifactIds, runeById, artifactById) : null;
      const entrees = gear ? entreesDuGear(gear) : r.gear.runes.length === 6 ? entreesDuGear(r.gear) : null;
      return { monster: r.monster, entrees };
    };
    const r = ouvertureDeLEquipe(equipe, membreDe, monstres);
    if ('motif' in r) {
      setMessages([o.ouvertureImpossible(String(r.monsterId))]);
      return;
    }
    setMessages([]);
    // L'état à part repart toujours de l'équipe, jamais d'une ouverture précédente.
    reinitialiserSticky(ESPACE_SPEED_TUNE_OPTIMIZER);
    setOuverte({ equipeId: equipe.id, ouverture: r });
  }, [data, validated, activeListId, runeById, artifactById, monstres, o]);

  const fermer = useCallback(() => setOuverte(null), []);

  const appliquer = useCallback((plan: PlanSpeedTune) => {
    const equipe = ouverte && teams.find((t) => t.id === ouverte.equipeId);
    if (!equipe) return;
    const monstreDe = (s: ExclusionSelector) => resolveExclusionEntry(s, data)?.monster.id ?? null;
    const { st, replis } = appliquerPlanALEquipe(equipe.speedTune, plan, equipe.members, monstreDe, monstres);
    setTeams(teams.map((t) => (t.id === equipe.id ? { ...t, speedTune: st } : t)));
    // Un membre attaché qui perd son lien reçoit son repli, comme par « Détacher » :
    // dans l'écran s'il est affiché, sinon dans sa mémoire.
    for (const r of replis) {
      if (exclusionSelectorKey(r.selector) === selectionne) {
        poserRepli(r.vitesseMin, r.verrou206);
        continue;
      }
      // Sans mémoire, la base complète des critères, comme à sa première ouverture.
      const memoire = memories.get(cleMemoireMembre(equipe.listId, r.selector));
      const resolu = resolveExclusionEntry(r.selector, data);
      const com2usId = memoire?.com2usId ?? resolu?.monster.com2usId;
      if (com2usId == null) continue;
      const criteres = memoire?.criteres ?? baseCompleteCriteres(resolu?.gear);
      writeMemory({ listId: equipe.listId, selector: r.selector, com2usId }, criteresAvecRepli(criteres, r), data);
    }
    setOuverte(null);
  }, [ouverte, teams, data, monstres, setTeams, selectionne, poserRepli, memories, writeMemory]);

  return { ouverte, ouvrir, fermer, appliquer, messages };
}
