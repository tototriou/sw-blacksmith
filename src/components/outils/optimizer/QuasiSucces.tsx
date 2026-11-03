import { RECO_STATS, type RuneDetail } from '../../../types';
import { candidateMetricTotal, pvEffectifs, type NearMiss, type Objective, type SearchResult, type StatShortfall } from '../../../lib/runeBuildOptim';
import { formatRuneMetric, type RuneMetric } from '../../../hooks/useRuneMetric';
import { moyenneParRune } from '../../../lib/valeursAffichees';
import { type StatKey } from '../../../lib/effects';
import { type DamageSetup, type SetAura } from '../../../lib/damage';
import { useLangue, useTraduction } from '../../../hooks/useLangue';
import { formatNombre } from '../../../i18n/format';

export interface QuasiSuccesProps {
  result: Pick<SearchResult, 'globalNearMiss' | 'nearMissByCondition'>;
  runeById: Map<number, RuneDetail>;
  metric: RuneMetric;
  objective: Objective;
  aurasPropresDe: (c: { runeIds: number[] }) => Readonly<Record<SetAura, number>>;
  damageSetup: DamageSetup;
  // Au bureau, sans encadré, sous un trait fin (voir `DiagnosticsSansResultat`).
  bureau?: boolean;
}

export default function QuasiSucces({ result, runeById, metric, objective, aurasPropresDe, damageSetup, bureau = false }: QuasiSuccesProps) {
  const textes = useTraduction();
  const langue = useLangue();
  const jeu = textes.jeu;
  const q = textes.optimizer.resultats.quasi;
  // ⚠️ Même vocabulaire que le palier 2 (`DiagnosticApprofondi`, « −15 suffit ») :
  // un seul réflexe de lecture
  // pour tout l'écran diagnostic, plutôt que deux formulations
  // (« manque »/« suffit ») pour la même idée de desserrage.
  // ⚠️ Le score affiché doit être celui que l'utilisateur reconnaît
  // des cartes de résultat (`BuildCandidateCard.tsx`) : la moyenne
  // PAR RUNE (pas la somme brute), formatée par `formatRuneMetric`
  // (« 140.2% », jamais un nombre nu) ; « PV effectifs » en plus
  // quand c'est l'objectif choisi — sinon un nombre sans légende
  // reconnaissable ressemble à une erreur, pas à un score (« 1309.0 »
  // affiché pour une recherche PV effectifs n'aurait aucun rapport
  // avec ce qui est cherché).
  const nearMissScoreText = (miss: NearMiss): string => {
    const moyenne = moyenneParRune(candidateMetricTotal(miss, runeById, metric));
    const base = `${metric === 'eff' ? q.efficienceMoyenne : q.scoreMoyen} ${formatRuneMetric(moyenne, metric)}`;
    if (objective !== 'ehp') return base;
    return `${base}${q.pvEffectifs(formatNombre(Math.round(pvEffectifs(miss.stats, aurasPropresDe(miss), damageSetup)), langue))}`;
  };
  const suffiraitText = (s: StatShortfall) => {
    const st = RECO_STATS.find((r) => r.key === s.key)!;
    const nouveauSeuil = s.kind === 'min' ? s.requested - s.shortfall : s.requested + s.shortfall;
    return (
      <span key={`${s.key}-${s.kind}`}>
        <span className="font-semibold text-ink">{jeu.stats[st.key]}</span> {s.kind === 'min' ? '−' : '+'}
        {s.shortfall}
        {st.suffix}{q.suffirait(`${s.kind === 'min' ? '≥' : '≤'} ${nouveauSeuil}${st.suffix}`)}
      </span>
    );
  };
  return (
    <div className={bureau ? 'mb-3 border-t border-border-soft pt-3' : 'mb-3 rounded-lg border border-border bg-panel p-3'}>
      <p className="mb-1.5 text-xs font-semibold text-ink">{q.titre}</p>
      {result.globalNearMiss && (
        <p className="mb-1.5 text-xs text-ink-dim">
          {q.plusProche}{' '}
          {result.globalNearMiss.shortfalls.map((s, i) => (
            <span key={`${s.key}-${s.kind}`}>
              {i > 0 ? ', ' : ''}
              {suffiraitText(s)}
            </span>
          ))}{' '}
          — {nearMissScoreText(result.globalNearMiss)}.
        </p>
      )}
      {result.nearMissByCondition.length > 0 && (
        <>
          <p className="mb-1 text-xs text-ink-dim">
            {q.parCondition}
          </p>
          <ul className="space-y-1">
            {result.nearMissByCondition.map(({ key, kind, miss }: { key: StatKey; kind: 'min' | 'max'; miss: NearMiss }) => (
              <li key={`${key}-${kind}`} className="text-xs text-ink-dim">
                {suffiraitText(miss.shortfalls[0])} — {nearMissScoreText(miss)}.
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-1.5 text-micro text-ink-dim">
        {q.limite}
      </p>
    </div>
  );
}
