import { useEffect, useRef } from 'react';
import { useTraduction } from '../hooks/useLangue';
import type { Dictionnaire } from '../i18n/fr';
import { EtatMiseAJour, redemarrerPourMettreAJour, suivreMiseAJour, telechargerMiseAJour } from '../lib/bureau';
import { Annonce, useNotifier } from '../ui/Notification';

// La mise à jour automatique, dite par la notification — application de
// bureau (bureau/miseAJour.ts). ⚠️ **L'utilisateur décide** : rien ne
// se télécharge sans « Mettre à jour », et la question RESTE jusqu'à sa
// réponse (la croix la ferme ; le bloc « Application » des Réglages la
// garde à portée, src/components/BlocApplication.tsx). Sur le site : inerte.
//
// Les phases d'une RECHERCHE (`aucune`, `recherche`, `a-jour`,
// `injoignable`) ne notifient rien : elles se lisent dans les Réglages.
export function annonce({ phase, version }: EtatMiseAJour, t: Dictionnaire): Annonce | null {
  const a = t.application;
  switch (phase) {
    case 'aucune':
    case 'recherche':
    case 'a-jour':
    case 'injoignable':
      return null;
    case 'disponible':
      return {
        message: a.notifDisponible(version),
        action: telechargerMiseAJour,
        libelleAction: a.mettreAJour,
        persistante: true,
      };
    case 'telechargement':
      return { message: a.notifTelechargement };
    case 'prete':
      // Sans redémarrage, elle s'installe à la fermeture de l'app.
      return { message: a.notifPrete, action: redemarrerPourMettreAJour, libelleAction: a.redemarrer };
    case 'echec':
      return {
        message: a.notifEchec,
        action: telechargerMiseAJour,
        libelleAction: a.reessayer,
        persistante: true,
      };
  }
}

export default function MiseAJourBureau() {
  const notifier = useNotifier();
  // La langue au moment de la notification, sans réabonner le suivi.
  const textes = useTraduction();
  const textesVivants = useRef(textes);
  textesVivants.current = textes;
  useEffect(
    () =>
      suivreMiseAJour((etat) => {
        const a = annonce(etat, textesVivants.current);
        if (a) notifier(a);
      }),
    [notifier]
  );
  return null;
}
