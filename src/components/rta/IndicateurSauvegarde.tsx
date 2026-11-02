import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useTraduction } from '../../hooks/useLangue';
import type { Dictionnaire } from '../../i18n/fr';

// « Sauvegardé il y a … » — l'heure du DERNIER CHANGEMENT de la prépa, donc de
// son dernier enregistrement automatique (la maquette). Voir docs/02-app/rta/.
//
// ⚠️ Il DIT la conservation automatique, il ne l'imite pas : ce n'est pas un
// bouton « enregistrer », qui mentirait (la prépa est déjà écrite à chaque
// changement). Et il ne se confond pas avec le POINT de sauvegarde, posé à la
// main par « Sauvegarder ».

// Une durée écoulée, en mots : « à l'instant », « il y a 3 min », « il y a
// 2 h », « il y a 4 j », dans la langue de `t`. Pure, pour être testée.
export function depuis(ms: number, t: Dictionnaire): string {
  const s = t.sauvegardeRta;
  const min = Math.floor(ms / 60000);
  if (min < 1) return s.instant;
  if (min < 60) return s.minutes(min);
  const h = Math.floor(min / 60);
  if (h < 24) return s.heures(h);
  return s.joursCourt(Math.floor(h / 24));
}

// ⚠️ La prépa ET ses catégories, passées SÉPARÉMENT : ce sont les références
// d'état des hooks, stables tant que rien ne change. Un tableau `[a, b]`
// recréé à chaque rendu relancerait l'effet à chaque rendu — donc en boucle,
// puisque l'effet pose un état.
export default function IndicateurSauvegarde({ prepa, categories }: { prepa: unknown; categories: unknown }) {
  const textes = useTraduction();
  // L'heure du dernier changement VU dans cette session. ⚠️ `null` avant le
  // premier : celle d'une session précédente n'est pas connue, et on ne
  // l'invente pas — d'où « Enregistré sur cet appareil ».
  const [dernier, setDernier] = useState<number | null>(null);
  const premier = useRef(true);
  useEffect(() => {
    if (premier.current) {
      premier.current = false;
      return;
    }
    setDernier(Date.now());
  }, [prepa, categories]);

  // Rafraîchi chaque minute : « il y a 1 min » ne doit pas rester figé.
  const [, setTic] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTic((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-dim" role="status">
      <Check size={13} className="flex-none text-good" aria-hidden />
      {dernier === null
        ? textes.sauvegardeRta.surCetAppareil
        : textes.sauvegardeRta.sauvegarde(depuis(Date.now() - dernier, textes))}
    </span>
  );
}
