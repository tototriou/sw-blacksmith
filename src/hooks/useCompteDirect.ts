import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { swex, type EtatDirectSwex } from '../lib/bureau';
import { creerSuiviDirect, type CompteDirect } from '../lib/compteDirect';
import type { BoxItem } from '../lib/applyAccount';
import type { BoxMonster } from '../lib/importAccount';
import type { Monster } from '../types';

// Le compte EN DIRECT, côté page — application de bureau (bureau/swex.ts,
// src/lib/compteDirect.ts). Sur le site : inerte, `etat` reste `null`.
//
// ⚠️ **« Mon compte » seulement.** Le compte en direct n'est donné qu'aux
// pages de « Mon compte » (App.tsx) : l'Optimizer, le speed tuning, la RTA et
// le siège gardent le compte de l'app, que seul « Mettre à jour » (page SW
// Exporter) change. Aucune notification, rien d'enregistré.

export interface DirectSwex {
  etat: EtatDirectSwex | null;
  activer: (oui: boolean) => void;
  // Redemande l'état (plugin installé depuis, session commencée).
  relire: () => void;
  // Reporte la session sur le compte de l'app ; `ok: false` sans fichier live
  // lisible.
  mettreAJour: () => Promise<{ ok: boolean; nom: string | null }>;
}

export const DirectSwexContext = createContext<DirectSwex | null>(null);
export const useDirectSwex = () => useContext(DirectSwexContext);

export function useCompteDirect(
  monsterByCom2us: Map<number, Monster>,
  appliquer: (texte: string, complet: boolean) => { ok: boolean; nom: string | null }
) {
  const [etat, setEtat] = useState<EtatDirectSwex | null>(null);
  const [compte, setCompte] = useState<CompteDirect | null>(null);
  const suivi = useRef(creerSuiviDirect());
  const appliquerRef = useRef(appliquer);
  appliquerRef.current = appliquer;

  useEffect(() => {
    const s = swex();
    if (!s) return;
    let vivant = true;
    void s.etatDirect().then((e) => vivant && e && setEtat(e));
    const desabonnerEtat = s.surEtatDirect(setEtat);
    // `recevoir` rend le MÊME compte quand les lignes ne touchent rien : pas
    // de rendu.
    const desabonnerLignes = s.surLignesDirect(({ debut, lignes }) => setCompte(suivi.current.recevoir(lignes, debut)));
    return () => {
      vivant = false;
      desabonnerEtat();
      desabonnerLignes();
    };
  }, []);

  // La box en monstres de l'app, convertie monstre par monstre : un monstre
  // inchangé garde la même carte. L'index des monstres change (données du
  // jour chargées) : tout se refait.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- un cache neuf par index
  const cartes = useMemo(() => new WeakMap<BoxMonster, BoxItem | null>(), [monsterByCom2us]);
  const boxBrute = compte?.box;
  const box = useMemo(() => {
    if (!boxBrute) return [];
    const out: BoxItem[] = [];
    for (const b of boxBrute) {
      let carte = cartes.get(b);
      if (carte === undefined) {
        const monster = monsterByCom2us.get(b.com2usId);
        carte = monster ? { key: String(b.unitId), monster, stars: b.stars, level: b.level, gear: b.gear } : null;
        cartes.set(b, carte);
      }
      if (carte) out.push(carte);
    }
    return out;
  }, [boxBrute, cartes, monsterByCom2us]);

  const activer = useCallback((oui: boolean) => {
    void swex()
      ?.activerDirect(oui)
      .then((e) => e && setEtat(e));
  }, []);

  const relire = useCallback(() => {
    void swex()
      ?.etatDirect()
      .then((e) => e && setEtat(e));
  }, []);

  const mettreAJour = useCallback(async () => {
    const r = await swex()?.mettreAJour();
    if (!r) return { ok: false, nom: null };
    return appliquerRef.current(r.texte, false);
  }, []);

  const direct: DirectSwex = useMemo(
    () => ({ etat, activer, relire, mettreAJour }),
    [etat, activer, relire, mettreAJour]
  );
  // Le compte à montrer dans « Mon compte » : seulement interrupteur ACTIVÉ et
  // fichier live de la dernière connexion.
  const enDirect = etat?.actif && etat.disponible && compte ? { ...compte, box } : null;
  return { direct, enDirect };
}
