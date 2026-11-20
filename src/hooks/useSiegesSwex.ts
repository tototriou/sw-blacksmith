// Les sièges relevés par le plugin SWEX, pour Siège › Statistiques
// (docs/02-app/siege/statistiques.md). L'application de bureau les lit dans
// les fichiers de guilde (bureau/swexGuilde.ts) ; ils se relisent à chaque
// changement de ces fichiers, tant que la sous-section est ouverte.
//
// Sur le site, aucun pont : `etat` reste 'site'.

import { useEffect, useState } from 'react';
import { swex } from '../lib/bureau';
import type { RelevesSiege } from '../lib/siegeStatistiques';

export type EtatSiegesSwex =
  | { etat: 'site' }
  | { etat: 'chargement' }
  // `releves` null : pas de dossier SW Exporter, d'invocateur suivi, ou de
  // dossier du plugin pour lui.
  | { etat: 'pret'; releves: RelevesSiege | null };

export function useSiegesSwex(): EtatSiegesSwex {
  const pont = swex();
  const [etat, setEtat] = useState<EtatSiegesSwex>(pont ? { etat: 'chargement' } : { etat: 'site' });

  useEffect(() => {
    if (!pont) return;
    let actif = true;
    // ⚠️ Une lecture à la fois, et seule la DERNIÈRE demandée compte : deux
    // signaux rapprochés ne doivent pas laisser une réponse ancienne écraser
    // la plus récente.
    let demande = 0;
    const lire = () => {
      const n = ++demande;
      pont
        .sieges()
        .then((releves) => {
          if (actif && n === demande) setEtat({ etat: 'pret', releves });
        })
        .catch(() => {
          if (actif && n === demande) setEtat({ etat: 'pret', releves: null });
        });
    };
    lire();
    const arreter = pont.surSiegesChanges(lire);
    return () => {
      actif = false;
      arreter();
    };
  }, [pont]);

  return etat;
}
