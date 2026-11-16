import { useEffect, useRef } from 'react';
import { useTraduction } from '../hooks/useLangue';
import type { Dictionnaire } from '../i18n/fr';
import { swex } from '../lib/bureau';
import { useNotifier } from '../ui/Notification';

// Le dossier SW Exporter, côté page — application de bureau (bureau/swex.ts). Rien à
// l'écran : il reçoit les exports du compte suivi, les applique (`appliquer`,
// App.tsx `rafraichirCompte`) et l'annonce. Sur le site : inerte.
//
// ⚠️ **`complet` après le choix d'un invocateur seulement** : tout s'importe
// (prépa RTA, siège, « Mon compte »). Les exports suivants du même
// invocateur ne mettent à jour que « Mon compte ».
//
// ⚠️ **`pret` seulement une fois les monstres chargés ET le compte conservé
// relu** (App.tsx) : appliqué plus tôt, l'export donnerait une box vide
// (sans l'index des monstres), ou serait écrasé par la relecture d'un compte
// plus ancien.
//
// L'arène dimensionnelle arrive à part (`surDimension`), à chaque nouvelle
// saison du journal SWEX : ses équipes sont appliquées (`appliquerDimension`,
// leur nombre), annoncées, et la saison marquée lue. Aucune équipe reconnue :
// rien n'est marqué, la prochaine saison sera redonnée.
export default function SuiviSwex({
  appliquer,
  appliquerDimension,
  pret,
  sansCompte,
}: {
  appliquer: (texte: string, complet: boolean) => { ok: boolean; nom: string | null };
  appliquerDimension: (saison: Record<string, any>, recents: unknown[]) => number;
  pret: boolean;
  // La page n'a aucun compte (conservation refusée) : l'export se relit en
  // silence, même s'il a déjà été lu.
  sansCompte: boolean;
}) {
  const notifier = useNotifier();
  // La langue au moment de la notification, sans réabonner le suivi.
  const textes = useTraduction();
  const textesVivants = useRef(textes);
  textesVivants.current = textes;
  // La DERNIÈRE version des deux : `appliquer` lit l'index des monstres, qui
  // change ; l'abonnement, lui, ne se refait pas à chaque rendu.
  const appliquerRef = useRef(appliquer);
  appliquerRef.current = appliquer;
  const appliquerDimensionRef = useRef(appliquerDimension);
  appliquerDimensionRef.current = appliquerDimension;
  const sansCompteRef = useRef(sansCompte);
  sansCompteRef.current = sansCompte;

  useEffect(() => {
    const s = swex();
    if (!s || !pret) return;
    const desabonner = s.surExport((exp) => {
      const complet = exp.complet === true;
      const r = appliquerRef.current(exp.texte, complet);
      // Illisible (à moitié écrit ?) : rien n'est marqué lu, le prochain
      // changement du fichier le redonnera.
      if (!r.ok) return;
      s.lu(exp.modifie);
      if (exp.nouveau || complet) notifier({ message: messageExportSwex(r.nom, complet, textesVivants.current) });
    });
    const desabonnerDimension = s.surDimension((dim) => {
      const n = appliquerDimensionRef.current(dim.saison, dim.recents);
      if (n === 0) return;
      s.dimensionLue(dim.cle);
      notifier({ message: textesVivants.current.application.dimensionMiseAJour(n) });
    });
    s.pret(sansCompteRef.current);
    return () => {
      desabonner();
      desabonnerDimension();
    };
  }, [pret, notifier]);

  return null;
}

// L'annonce d'un export appliqué : chargé en entier (choix d'un invocateur),
// ou « Mon compte » mis à jour.
export function messageExportSwex(nom: string | null, complet: boolean, t: Dictionnaire): string {
  return complet ? t.application.exportCharge(nom) : t.application.exportMisAJour(nom);
}
