import { type BilanRecherche } from '../../../hooks/useBuildOptimSearch';
import type { ArretMemoire } from '../../../lib/classementCompact';
import { useLangue, useTraduction } from '../../../hooks/useLangue';
import { formatNombre } from '../../../i18n/format';

export interface AvisRechercheTronqueeProps {
  result: BilanRecherche | null;
  stoppedManually: boolean;
  /** L'arrêt sur la mémoire du classeur : il prime sur les autres motifs, la cause n'est ni le temps ni l'utilisateur. */
  arretMemoire?: ArretMemoire | null;
}

export default function AvisRechercheTronquee({ result, stoppedManually, arretMemoire = null }: AvisRechercheTronqueeProps) {
  const a = useTraduction().optimizer.resultats.troncature;
  const langue = useLangue();
  const n = (v: number) => formatNombre(v, langue);
  return (
    <p className="mb-2 text-micro text-warn" data-arret-memoire={arretMemoire ? '' : undefined}>
      {arretMemoire
        ? a.memoire(n(arretMemoire.gardes), n(arretMemoire.trouves))
        : stoppedManually
          ? a.arretee(n(result?.explored ?? 0))
          : a.interrompue(n(result?.explored ?? 0))}
    </p>
  );
}
