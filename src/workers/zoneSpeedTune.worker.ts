/// <reference lib="webworker" />
// La zone d'un membre sous un plan de speed tune, hors du fil de l'interface
// (feat-contrainte-speed-tune.md, « Calcul et cache ») : une seconde de
// balayage exhaustif ne doit pas figer l'écran.
import { contrainteDuMembre } from '../lib/planSpeedTune';
import type { DemandeZone, ReponseZone } from '../hooks/useZoneSpeedTune';

self.onmessage = (e: MessageEvent<DemandeZone>) => {
  const { id, plan, donnees, monstres, uid, autres, bornes } = e.data;
  const contrainte = contrainteDuMembre(plan, donnees, monstres, uid, autres, bornes);
  self.postMessage({ id, contrainte } satisfies ReponseZone);
};
