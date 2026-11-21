// La liste des états du compte archivés par le plugin SWEX, pour Comparaison ›
// Historique (docs/02-app/compte/feat-runes/comparaison.md). L'application de
// bureau la lit dans l'archive du compte (bureau/swexHistorique.ts) ; elle se
// relit à chaque connexion archivée et à chaque changement d'invocateur
// suivi, tant que l'onglet est ouvert.
//
// Sur le site, aucun pont : `etat` reste 'site'.

import { useEffect, useState } from 'react';
import { swex, type EtatHistoriqueSwex } from '../lib/bureau';

export type EtatHistorique =
  | { etat: 'site' }
  | { etat: 'chargement' }
  // `etats` null : pas de dossier SW Exporter, d'invocateur suivi, ou de
  // dossier du plugin pour lui.
  | { etat: 'pret'; etats: EtatHistoriqueSwex[] | null };

export function useHistoriqueSwex(): EtatHistorique {
  const pont = swex();
  const [etat, setEtat] = useState<EtatHistorique>(pont ? { etat: 'chargement' } : { etat: 'site' });

  useEffect(() => {
    if (!pont) return;
    let actif = true;
    // Seule la DERNIÈRE lecture demandée compte (voir useSiegesSwex).
    let demande = 0;
    const lire = () => {
      const n = ++demande;
      pont
        .historique()
        .then((etats) => {
          if (actif && n === demande) setEtat({ etat: 'pret', etats });
        })
        .catch(() => {
          if (actif && n === demande) setEtat({ etat: 'pret', etats: null });
        });
    };
    lire();
    const arreter = pont.surHistoriqueChange(lire);
    return () => {
      actif = false;
      arreter();
    };
  }, [pont]);

  return etat;
}
