// Le speed tune du membre sélectionné dans l'Optimizer : sa ligne du plan,
// l'origine des autres lignes, sa zone, le verdict d'équipe, les écarts, et
// les gestes qui écrivent sur l'équipe (détacher, rattacher, recalculer,
// restaurer).
//
// Spec : docs/02-app/optimizer/feat-contrainte-speed-tune.md. Le calcul est
// dans `src/lib/speedTuneMembre.ts` et `src/lib/planSpeedTune.ts` ; ce hook ne
// fait que l'assembler sur l'état de l'écran.
import { useCallback, useMemo } from 'react';
import type { ArtifactDetail, Monster, RuneDetail } from '../types';
import type { EquipeOptimizer } from '../lib/optimizerMemberStorage';
import { exclusionSelectorKey, findValidatedBuild, resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData, type ValidatedBuild } from '../lib/optimizerExclusion';
import { ligneDuMembre, type MembreLigne, type SpeedTuneEquipe } from '../lib/speedTuneEquipe';
import type { Bestiaire, PlanSpeedTune } from '../lib/planSpeedTune';
import type { DonneesKit } from '../lib/speedTuneAuto';
import type { ContrainteSpeedTune } from '../lib/contrainteSpeedTune';
import {
  autresPour, avecRattachement, bornesDuMembre, criteresDetaches, etatsSwiftDuCombo, ecartsDuPlan, entreesDuGear, gearDuBuildValide,
  lignesDeLEquipe, recalculerPlan, restaurerLigne, verdictEquipe, type BuildDuMembre, type EcartLigne, type LigneEquipe, type VerdictEquipe,
} from '../lib/speedTuneMembre';
import { bestiaireDe, useDonneesKitPlan, useZoneSpeedTune, type EtatZone } from './useZoneSpeedTune';
import { CODE_AMPLI_VIT } from '../lib/damage';

export interface SpeedTuneDuMembre {
  equipe: EquipeOptimizer;
  st: SpeedTuneEquipe;
  lien: MembreLigne;
  // `null` : « plan de speed tune perdu ».
  plan: PlanSpeedTune | null;
  lignes: LigneEquipe[];
  zone: EtatZone;
  // La contrainte que la recherche lit : membre attaché, zone prête.
  contrainte: ContrainteSpeedTune | null;
  verdict: VerdictEquipe | null;
  ecarts: EcartLigne[];
  kitsCharges: boolean;
  monstres: Bestiaire;
  donnees: DonneesKit | null;
}

// Le plus fort cumul 206 qu'une paire peut porter : la meilleure pièce de
// chaque sorte. Un majorant : il peut surestimer, jamais sous-estimer.
function arteMaxInventaire(artifacts: readonly ArtifactDetail[]): number {
  const best = { element: 0, archetype: 0 };
  for (const a of artifacts) best[a.kind] = Math.max(best[a.kind], a.subs.find((s) => s.code === CODE_AMPLI_VIT)?.value ?? 0);
  return best.element + best.archetype;
}

export function useSpeedTuneMembre(e: {
  teams: readonly EquipeOptimizer[];
  validated: readonly ValidatedBuild[];
  activeListId: string | null;
  selector: ExclusionSelector | null;
  data: ExclusionSourceData;
  runeById: ReadonlyMap<number, RuneDetail>;
  artifactById: ReadonlyMap<number, ArtifactDetail>;
  artifacts: readonly ArtifactDetail[];
  allMonsters: readonly Monster[];
  pool: readonly RuneDetail[];
  // Le multiset de sets de la recherche (format `activeSets`).
  comboSets: readonly string[];
  setTeams: (teams: EquipeOptimizer[]) => void;
  // Les deux champs que le rattachement possède : VIT minimum et verrou 206.
  poserRepli: (vitesseMin: number | null, verrou206: number | null) => void;
}): (SpeedTuneDuMembre & {
  detacher: () => void; rattacher: () => void;
  recalculer: (ecarts: readonly EcartLigne[]) => void; restaurer: (uid: string) => void;
}) | null {
  const { teams, validated, activeListId, selector, data, runeById, artifactById } = e;
  const trouve = useMemo(() => {
    if (!selector || !activeListId) return null;
    for (const equipe of teams) {
      if (equipe.listId !== activeListId || !equipe.speedTune) continue;
      const uid = ligneDuMembre(equipe.speedTune, equipe.members, selector);
      const lien = uid ? equipe.speedTune.membres.find((m) => m.uid === uid) : undefined;
      if (lien) return { equipe, st: equipe.speedTune, lien };
    }
    return null;
  }, [teams, activeListId, selector]);
  const monstres = useMemo(() => bestiaireDe(e.allMonsters), [e.allMonsters]);
  const plan = trouve?.st.plan ?? null;
  const lignes = useMemo(() => {
    if (!trouve || !plan) return [];
    const buildDe = (s: ExclusionSelector): BuildDuMembre => {
      const b = findValidatedBuild([...validated], activeListId, exclusionSelectorKey(s));
      if (!b) return null;
      const base = resolveExclusionEntry(s, data)?.gear.base;
      const gear = base ? gearDuBuildValide(base, b.runeIds, b.artifactIds, runeById, artifactById) : null;
      return gear ? { entrees: entreesDuGear(gear) } : 'inexploitable';
    };
    return lignesDeLEquipe(trouve.st, plan, trouve.equipe.members, buildDe);
  }, [trouve, plan, validated, activeListId, data, runeById, artifactById]);
  const kits = useDonneesKitPlan(plan, monstres);
  const uid = trouve?.lien.uid ?? null;
  const base = useMemo(() => {
    const l = plan?.lignes.find((x) => x.uid === uid);
    return l ? monstres.get(l.monsterId)?.stats.speed ?? null : null;
  }, [plan, uid, monstres]);
  const etatsSwift = useMemo(() => etatsSwiftDuCombo(e.comboSets), [e.comboSets]);
  const arteMax = useMemo(() => arteMaxInventaire(e.artifacts), [e.artifacts]);
  const entreeZone = useMemo(() => (plan && uid && base != null ? {
    plan, uid, autres: autresPour(lignes, uid), bornes: bornesDuMembre(base, e.pool, etatsSwift, arteMax), monstres, kits,
  } : null), [plan, uid, base, lignes, e.pool, etatsSwift, arteMax, monstres, kits]);
  const zone = useZoneSpeedTune(entreeZone);
  const verdict = useMemo(() => (plan && kits ? verdictEquipe(plan, kits.donnees, monstres, lignes) : null), [plan, kits, monstres, lignes]);
  const ecarts = useMemo(() => {
    if (!plan || !kits) return [];
    const portees = (s: ExclusionSelector) => {
      const r = resolveExclusionEntry(s, data);
      return r && r.gear.runes.length === 6 ? entreesDuGear(r.gear) : null;
    };
    return ecartsDuPlan(plan, kits.donnees, monstres, lignes, portees);
  }, [plan, kits, monstres, lignes, data]);

  const { setTeams, poserRepli } = e;
  const ecrire = useCallback((st: SpeedTuneEquipe) => {
    if (!trouve) return;
    setTeams(teams.map((t) => (t.id === trouve.equipe.id ? { ...t, speedTune: st } : t)));
  }, [trouve, teams, setTeams]);
  const detacher = useCallback(() => {
    if (!trouve) return;
    const c = criteresDetaches(trouve.lien);
    poserRepli(c.vitesseMin, c.verrou206);
    ecrire(avecRattachement(trouve.st, trouve.lien.uid, false));
  }, [trouve, ecrire, poserRepli]);
  const rattacher = useCallback(() => {
    if (trouve) ecrire(avecRattachement(trouve.st, trouve.lien.uid, true));
  }, [trouve, ecrire]);
  const recalculer = useCallback((liste: readonly EcartLigne[]) => {
    if (trouve && kits) ecrire(recalculerPlan(trouve.st, kits.donnees, monstres, liste));
  }, [trouve, kits, monstres, ecrire]);
  const restaurer = useCallback((u: string) => {
    if (trouve && kits) ecrire(restaurerLigne(trouve.st, kits.donnees, monstres, u));
  }, [trouve, kits, monstres, ecrire]);

  if (!trouve) return null;
  const contrainte = trouve.lien.attache && zone.etat === 'prete' ? zone.contrainte : null;
  return { ...trouve, plan, lignes, zone, contrainte, verdict, ecarts, kitsCharges: !!kits, monstres, donnees: kits?.donnees ?? null, detacher, rattacher, recalculer, restaurer };
}
