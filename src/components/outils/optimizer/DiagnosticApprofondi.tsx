import { RECO_STATS } from '../../../types';
import { type BlockingConditionsDiagnosis } from '../../../lib/runeBuildOptim';
import { useTraduction } from '../../../hooks/useLangue';

export interface DiagnosticApprofondiProps {
  blockingDiagnosis: BlockingConditionsDiagnosis | null;
  diagnoseBlockingEnabled: boolean;
  // Au bureau, sans encadré, sous un trait fin (voir `DiagnosticsSansResultat`).
  bureau?: boolean;
}

export default function DiagnosticApprofondi({ blockingDiagnosis, diagnoseBlockingEnabled, bureau = false }: DiagnosticApprofondiProps) {
  const textes = useTraduction();
  const jeu = textes.jeu;
  const d = textes.optimizer.resultats.diagnostic;
  return blockingDiagnosis && blockingDiagnosis.impacts.length > 0 ? (
    <div className={bureau ? 'mb-3 border-t border-border-soft pt-3' : 'mb-3 rounded-lg border border-border bg-panel p-3'}>
      <p className="mb-1.5 text-xs font-semibold text-ink">
        {d.titre(blockingDiagnosis.baselineMinSlot)}
      </p>
      <ul className="space-y-1">
        {blockingDiagnosis.impacts.map((imp) => {
          const st = RECO_STATS.find((s) => s.key === imp.key)!;
          return (
            <li key={`${imp.key}-${imp.kind}`} className="text-xs text-ink-dim">
              {imp.delta == null ? (
                <>
                  <span className="font-semibold text-ink">{jeu.stats[st.key]}</span> ({imp.kind === 'min' ? '≥' : '≤'}{' '}
                  {imp.requested}
                  {st.suffix}){d.aucunGain}
                </>
              ) : (
                <>
                  <span className="font-semibold text-ink">{jeu.stats[st.key]}</span>{' '}
                  {imp.kind === 'min' ? `−${imp.delta}` : `+${imp.delta}`}
                  {st.suffix}{d.suffit(`${imp.kind === 'min' ? '≥' : '≤'} ${imp.threshold}${st.suffix}`, imp.poolMinSlotAtThreshold)}
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-micro text-ink-dim">
        {d.indice}
      </p>
    </div>
  ) : (
    !diagnoseBlockingEnabled && (
      <p className="mb-3 text-[11px] text-ink-dim">
        {d.astuce}
      </p>
    )
  );
}
