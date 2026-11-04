import { Monitor, X } from 'lucide-react';
import { useStickyState } from '../hooks/useStickyState';
import { useTraduction } from '../hooks/useLangue';

// Avertissement affiché **sur petit écran uniquement** : l'app manipule des
// listes de runes, des équipes de trois monstres et des ordres de tour — tout
// cela demande de la largeur. Sans un mot, on croit à un site mal fait plutôt
// qu'à un site consulté dans de mauvaises conditions.
//
// ⚠️ **Détection par media query CSS (`md:hidden`), jamais par user-agent.** Le
// sniffing se trompe (tablettes, mode bureau, navigateurs exotiques) et vieillit
// mal ; ce qui compte ici n'est pas l'appareil mais **la largeur disponible**.
//
// ⚠️ **Refermable, et l'oubli est volontairement court** : la fermeture vit en
// mémoire (`useStickyState`), donc elle tient pour la session et le bandeau
// revient à la visite suivante. Le persister demanderait le consentement de
// conservation — mettre un bandeau d'information dans la même balance qu'une
// prépa RTA serait disproportionné.
export default function MobileNotice() {
  const [ferme, setFerme] = useStickyState('mobileNotice.ferme', false);
  const a = useTraduction().controles.avertissementMobile;
  if (ferme) return null;

  return (
    <div className="md:hidden mb-4 flex items-start gap-2.5 rounded-xl border border-accent bg-panel2/60 px-3 py-2.5">
      <Monitor size={16} className="mt-0.5 flex-none text-accent" />
      {/* ⚠️ Texte RACCOURCI depuis la refonte : « SW Forge est pensé pour un
          grand écran » n'est plus vrai — la navigation, les grilles et les
          listes s'adaptent désormais. Ce qui reste vrai, et seulement ça : les
          écrans les plus DENSES (comparaison de courbes, optimiseur) demandent
          de la largeur. Trois lignes pour le dire prenaient un quart de
          l'écran, juste sous la barre. */}
      <p className="flex-1 text-xs leading-relaxed text-ink-dim">
        {a.debut}<b className="text-ink">{a.courbes}</b>{a.milieu}<b className="text-ink">{a.optimiseur}</b>{a.fin}
      </p>
      <button
        onClick={() => setFerme(true)}
        aria-label={a.masquer}
        className="flex-none rounded-md p-1 text-ink-dim transition hoverable:text-ink"
      >
        <X size={14} />
      </button>
    </div>
  );
}
