import { RECO_STATS } from '../../../types';
import { type StatFeasibility } from '../../../lib/runeBuildOptim';
import { useTraduction } from '../../../hooks/useLangue';

export interface DiagnosticFaisabiliteProps {
  impossibleFeasibility: StatFeasibility[];
  // Au bureau, sans encadré, sous un trait fin : une section du panneau de la
  // colonne de droite (voir `DiagnosticsSansResultat`).
  bureau?: boolean;
}

export default function DiagnosticFaisabilite({ impossibleFeasibility, bureau = false }: DiagnosticFaisabiliteProps) {
  const textes = useTraduction();
  const jeu = textes.jeu;
  const d = textes.optimizer.resultats.faisabilite;
  return (
    <div className={bureau ? 'mb-3 border-t border-border-soft pt-3' : 'mb-3 rounded-lg border border-border bg-panel p-3'}>
      {impossibleFeasibility.length > 0 ? (
        <>
          <p className="mb-1.5 text-xs font-semibold text-bad">
            {d.horsDePortee(impossibleFeasibility.length)}
          </p>
          <ul className="space-y-1">
            {impossibleFeasibility.map((f) => {
              const st = RECO_STATS.find((s) => s.key === f.key)!;
              return (
                <li key={`${f.key}-${f.kind}`} className="text-xs text-ink-dim">
                  <span className="font-semibold text-ink">{jeu.stats[st.key]}</span>{' '}
                  {f.kind === 'min'
                    ? d.minimum(`${f.requested}${st.suffix}`, `${f.bound}${st.suffix}`)
                    : d.maximum(`${f.requested}${st.suffix}`, `${f.bound}${st.suffix}`)}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="text-xs text-ink-dim">
          {d.aucuneDebut}<b className="text-ink">{d.combinaison}</b>{d.aucuneFin}
        </p>
      )}
    </div>
  );
}
