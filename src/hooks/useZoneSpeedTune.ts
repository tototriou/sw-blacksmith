// Les données du speed tune d'un membre que l'Optimizer calcule hors du rendu :
// les kits des monstres du plan, puis la zone du membre dans un Worker, gardée
// en cache sous l'empreinte de son contexte.
//
// Spec : docs/02-app/optimizer/feat-contrainte-speed-tune.md, « Calcul et
// cache ». Tant que les kits ne sont pas chargés, aucune zone n'est publiée et
// la recherche ne part pas ; un calcul en cours est abandonné quand son
// contexte change.
import { useEffect, useMemo, useState } from 'react';
import type { Monster } from '../types';
import type { ContrainteSpeedTune } from '../lib/contrainteSpeedTune';
import { contrainteDuMembre, type Bestiaire, type BornesZone, type EntreesLigne, type PlanSpeedTune } from '../lib/planSpeedTune';
import type { DonneesKit } from '../lib/speedTuneAuto';
import { kitVitesse, sortsVitesse } from '../lib/speedTuneKit';
import { passifsVitesse } from '../lib/speedTunePassif';
import { chargerDetail } from '../lib/monsterSkills';
import { empreinteContexteZone } from '../lib/speedTuneMembre';

export interface DemandeZone {
  id: number;
  plan: PlanSpeedTune;
  donnees: DonneesKit;
  monstres: Bestiaire;
  uid: string;
  autres: Map<string, EntreesLigne>;
  bornes: BornesZone;
}
export interface ReponseZone {
  id: number;
  contrainte: ContrainteSpeedTune | null;
}

// Les kits des monstres d'un plan ; `null` tant qu'un seul manque.
export function useDonneesKitPlan(plan: PlanSpeedTune | null, monstres: Bestiaire): { donnees: DonneesKit; idKits: string } | null {
  const ids = useMemo(() => {
    if (!plan) return [];
    const out = new Set<number>();
    for (const l of plan.lignes) {
      const id = monstres.get(l.monsterId)?.com2usId;
      if (id != null) out.add(id);
    }
    return [...out].sort((a, b) => a - b);
  }, [plan, monstres]);
  const cle = ids.join(',');
  const [charge, setCharge] = useState<{ cle: string; donnees: DonneesKit } | null>(null);
  useEffect(() => {
    if (!cle) return;
    let annule = false;
    Promise.all(cle.split(',').map(Number).map((id) =>
      chargerDetail(id).then((d) => [id, kitVitesse(d), sortsVitesse(d), passifsVitesse(d)] as const)))
      .then((paires) => {
        if (annule) return;
        setCharge({ cle, donnees: {
          kits: new Map(paires.map(([id, k]) => [id, k] as const)),
          sorts: new Map(paires.map(([id, , s]) => [id, s] as const)),
          passifs: new Map(paires.map(([id, , , p]) => [id, p] as const)),
        } });
      })
      .catch(() => { /* kits introuvables : aucune zone, la recherche ne part pas */ });
    return () => { annule = true; };
  }, [cle]);
  return useMemo(() => (charge && charge.cle === cle && cle ? { donnees: charge.donnees, idKits: cle } : null), [charge, cle]);
}

export const bestiaireDe = (monstres: readonly Monster[]): Bestiaire => new Map(monstres.map((m) => [m.id, m] as const));

// Au plus tant de zones gardées : une par membre et par contexte récent.
const BORNE_CACHE_ZONES = 32;
const cache = new Map<string, ContrainteSpeedTune | null>();
let prochainId = 1;

export type EtatZone =
  | { etat: 'aucune' }
  | { etat: 'kits' }
  | { etat: 'calcul'; empreinte: string }
  | { etat: 'prete'; empreinte: string; contrainte: ContrainteSpeedTune | null };

// La contrainte d'un membre attaché. `entree` nul : aucun membre contraint.
export function useZoneSpeedTune(entree: {
  plan: PlanSpeedTune; uid: string; autres: Map<string, EntreesLigne>; bornes: BornesZone; monstres: Bestiaire;
  kits: { donnees: DonneesKit; idKits: string } | null;
} | null): EtatZone {
  const empreinte = useMemo(() => (entree?.kits
    ? empreinteContexteZone(entree.plan, entree.uid, entree.autres, entree.bornes, entree.kits.idKits) : null), [entree]);
  const [resultat, setResultat] = useState<{ empreinte: string; contrainte: ContrainteSpeedTune | null } | null>(null);
  useEffect(() => {
    if (!entree?.kits || !empreinte || cache.has(empreinte)) return;
    const demande: DemandeZone = { id: prochainId++, plan: entree.plan, donnees: entree.kits.donnees, monstres: entree.monstres,
      uid: entree.uid, autres: entree.autres, bornes: entree.bornes };
    const publier = (contrainte: ContrainteSpeedTune | null) => {
      if (cache.size >= BORNE_CACHE_ZONES) cache.delete(cache.keys().next().value!);
      cache.set(empreinte, contrainte);
      setResultat({ empreinte, contrainte });
    };
    // Sans Worker (rendu côté Node des tests), le calcul se fait sur place.
    if (typeof Worker === 'undefined') {
      publier(contrainteDuMembre(demande.plan, demande.donnees, demande.monstres, demande.uid, demande.autres, demande.bornes));
      return;
    }
    const worker = new Worker(new URL('../workers/zoneSpeedTune.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<ReponseZone>) => {
      if (e.data.id === demande.id) publier(e.data.contrainte);
      worker.terminate();
    };
    worker.postMessage(demande);
    return () => worker.terminate();
  }, [empreinte, entree]);
  if (!entree) return { etat: 'aucune' };
  if (!empreinte) return { etat: 'kits' };
  if (cache.has(empreinte)) return { etat: 'prete', empreinte, contrainte: cache.get(empreinte)! };
  if (resultat?.empreinte === empreinte) return { etat: 'prete', empreinte, contrainte: resultat.contrainte };
  return { etat: 'calcul', empreinte };
}
