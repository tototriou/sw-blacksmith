import { useEffect, useRef } from 'react';
import { useDirectSwex } from '../hooks/useCompteDirect';
import { useTraduction } from '../hooks/useLangue';
import type { Dictionnaire } from '../i18n/fr';
import type { EtatDirectSwex } from '../lib/bureau';
import { Annonce, useNotifier } from '../ui/Notification';

// Le plugin SWEX « SW Blacksmith Live » à remplacer, dit par la notification —
// application de bureau. Le processus principal compare le plugin installé
// dans le dossier SW Exporter suivi à celui que sert l'app, par l'empreinte de
// son CODE (bureau/swexPur.ts, `statutPlugin`) : une version de l'app qui ne
// change pas le plugin ne notifie rien. Sur le site : inerte (`etat` reste
// `null`).
//
// ⚠️ **Une question, persistante** : elle reste jusqu'à « Mettre à jour » (la
// page SW Exporter, qui propose le fichier et dit où le déposer) ou la croix.
// ⚠️ **Une fois par plugin installé et par lancement** : l'état du direct
// revient à chaque action en jeu, la notification ne revient pas avec lui.
// Fermée, elle laisse la carte de la page SW Exporter le dire.
export function annoncePlugin(etat: EtatDirectSwex | null, t: Dictionnaire, ouvrir: () => void): Annonce | null {
  if (etat?.plugin.statut !== 'ancien') return null;
  return {
    message: t.swExporter.notifPluginAncien,
    action: ouvrir,
    libelleAction: t.swExporter.notifPluginAction,
    persistante: true,
  };
}

// Ce qui a déjà été notifié : le plugin installé face à l'app. Un autre
// plugin installé (une autre copie ancienne) ou une autre app se notifie.
export const clePlugin = (etat: EtatDirectSwex | null) =>
  etat?.plugin.statut === 'ancien' ? `${etat.plugin.installee}>${etat.plugin.app}` : null;

const ouvrirPageSwex = () => {
  window.location.hash = '#/sw-exporter';
};

export default function MiseAJourPlugin() {
  const notifier = useNotifier();
  const etat = useDirectSwex()?.etat ?? null;
  // La langue au moment de la notification, sans renotifier à son changement.
  const textes = useTraduction();
  const textesVivants = useRef(textes);
  textesVivants.current = textes;
  const dejaDit = useRef<string | null>(null);
  const cle = clePlugin(etat);
  useEffect(() => {
    if (cle === null || cle === dejaDit.current) return;
    dejaDit.current = cle;
    const a = annoncePlugin(etat, textesVivants.current, ouvrirPageSwex);
    if (a) notifier(a);
    // La clé seule décide : `etat` change à chaque action en jeu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, notifier]);
  return null;
}
