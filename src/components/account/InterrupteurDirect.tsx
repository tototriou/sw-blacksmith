import { Radio } from 'lucide-react';
import { useDirectSwex } from '../../hooks/useCompteDirect';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import { formatDateHeure } from '../../i18n/format';
import type { EtatDirectSwex } from '../../lib/bureau';
import type { Dictionnaire } from '../../i18n/fr';
import type { Langue } from '../../i18n/langue';
import Pastille from '../../ui/Pastille';

// L'interrupteur « Direct » de « Mon compte » — application de bureau : posé
// parmi les filtres de chaque vue. Activé, « Mon compte » suit le fichier
// live du plugin SWEX (useCompteDirect.ts). Coupé par défaut ; le choix est
// retenu par l'application (bureau/swex.ts), le même pour toutes les vues.
//
// ⚠️ **Absent** sur le site, et tant que rien ne montre le plugin (ni
// installé, ni session, ni interrupteur déjà activé) : un filtre grisé partout
// pour qui n'a pas SWEX n'apprendrait rien.
// ⚠️ **Le libellé ne change pas** : l'heure de la dernière action est dans
// l'infobulle — un libellé qui s'allonge déplacerait ses voisins.

export function aideDirect(etat: EtatDirectSwex, t: Dictionnaire['direct'], langue: Langue): string {
  if (!etat.actif) return etat.disponible ? t.activer : t.indisponible;
  if (!etat.disponible || etat.maj === null) return t.actifSansSession;
  return t.actif(formatDateHeure(etat.maj, langue, { hour: '2-digit', minute: '2-digit' }));
}

export function directVisible(etat: EtatDirectSwex | null): etat is EtatDirectSwex {
  return etat !== null && (etat.actif || etat.disponible || etat.plugin.statut !== 'absent');
}

export default function InterrupteurDirect({ className = '' }: { className?: string }) {
  const direct = useDirectSwex();
  const t = useTraduction();
  const langue = useLangue();
  const etat = direct?.etat ?? null;
  if (!direct || !directVisible(etat)) return null;
  return (
    <Pastille
      actif={etat.actif}
      // Activable sans session : il suivra la prochaine connexion au jeu.
      onClick={() => direct.activer(!etat.actif)}
      icone={<Radio size={13} />}
      libelle={t.direct.libelle}
      title={aideDirect(etat, t.direct, langue)}
      data-interrupteur-direct=""
      className={className}
    />
  );
}
