import { formatRuneMetric } from '../../../hooks/useRuneMetric';
import { useLangue, useTraduction } from '../../../hooks/useLangue';
import { formatNombre } from '../../../i18n/format';
import { entierAffiche, moyenneParRune } from '../../../lib/valeursAffichees';
import type { OptimMetric } from '../../../lib/runeOptim';

// Sous la fiche d'« Exemplaire », quand les résultats sont en cartes : la
// mesure moyenne, les PV effectifs et les dégâts du runage affiché, écrits
// comme les rangées d'une carte de résultat. En tableau, la ligne de la fiche
// du tableau les porte déjà (TableauResultats.tsx).
// ⚠️ Les valeurs sont les références de « Comparer » (OptimizerSection.tsx) :
// ce bloc, l'écart d'une carte et la ligne du tableau disent le même chiffre.

export interface MesuresDeLaFicheProps {
  // La mesure des runes de la fiche, en total, dans la mesure courante.
  mesureTotale: number;
  metric: OptimMetric;
  pvEffectifs: number | null;
  // Sans sort calculable : `null`, la rangée n'est pas écrite.
  degats: { total: number; partPvCible: number } | null;
}

export default function MesuresDeLaFiche({ mesureTotale, metric, pvEffectifs, degats }: MesuresDeLaFicheProps) {
  const textes = useTraduction();
  const langue = useLangue();
  const ca = textes.optimizer.carte;
  const q = textes.optimizer.resultats.quasi;
  const rangee = 'flex flex-wrap items-baseline justify-between gap-x-2 px-2 py-0.5';
  return (
    <div className="mt-2 rounded-lg border border-border-soft bg-panel2 py-0.5" data-mesures-fiche="">
      <p className={rangee}>
        <span className="text-micro text-ink-dim">{metric === 'eff' ? q.efficienceMoyenne : q.scoreMoyen}</span>
        <span className="font-mono text-sm font-bold text-ink">{formatRuneMetric(moyenneParRune(mesureTotale), metric)}</span>
      </p>
      {pvEffectifs !== null && (
        <p className={rangee}>
          <span className="text-micro text-ink-dim">{textes.optimizer.objectifs.ehp}</span>
          <span className="font-mono text-sm font-bold text-star">{formatNombre(entierAffiche(pvEffectifs), langue)}</span>
        </p>
      )}
      {degats && (
        <p className={rangee}>
          <span className="text-micro text-ink-dim">{ca.degats}</span>
          <span className="text-sm font-bold text-star">
            <span className="font-mono">{formatNombre(entierAffiche(degats.total), langue)}</span>
            <span className="ml-1.5 font-normal text-micro text-ink-dim">
              {degats.partPvCible >= 100 ? ca.tueLaCible : ca.partPv(Math.round(degats.partPvCible))}
            </span>
          </span>
        </p>
      )}
    </div>
  );
}
