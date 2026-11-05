import DiagnosticFaisabilite from './DiagnosticFaisabilite';
import DiagnosticApprofondi from './DiagnosticApprofondi';
import QuasiSucces from './QuasiSucces';
import { type StatFeasibility, type BlockingConditionsDiagnosis, type Objective } from '../../../lib/runeBuildOptim';
import { type RuneDetail } from '../../../types';
import { type BilanRecherche } from '../../../hooks/useBuildOptimSearch';
import { type RuneMetric } from '../../../hooks/useRuneMetric';
import { type SetAura, type DamageSetup } from '../../../lib/damage';
import { useLangue, useTraduction } from '../../../hooks/useLangue';
import { formatNombre } from '../../../i18n/format';

export interface DiagnosticsSansResultatProps {
  result: BilanRecherche | null;
  feasibilityDiagnosis: StatFeasibility[];
  impossibleFeasibility: StatFeasibility[];
  blockingDiagnosis: BlockingConditionsDiagnosis | null;
  diagnoseBlockingEnabled: boolean;
  runeById: Map<number, RuneDetail>;
  metric: RuneMetric;
  objective: Objective;
  aurasPropresDe: (c: { runeIds: number[]; }) => Readonly<Record<SetAura, number>>;
  damageSetup: DamageSetup;
  // ⚠️ Au bureau, chaque diagnostic sans encadré, sous un trait fin : les
  // résultats sont une section du panneau de la colonne de droite, où une
  // boîte de plus ferait la mosaïque que le trait évite
  // (docs/02-app/optimizer/ecran/README.md, « Panneaux et sections »).
  // Le téléphone garde ses encadrés.
  bureau?: boolean;
  // L'enveloppe de VIT de fiche d'une recherche sous contrainte de speed
  // tune : une condition bloquante comme une autre, nommée comme telle.
  speedTune?: { min: number; max: number } | null;
}

export default function DiagnosticsSansResultat({ result, feasibilityDiagnosis, impossibleFeasibility, blockingDiagnosis, diagnoseBlockingEnabled, runeById, metric, objective, aurasPropresDe, damageSetup, bureau = false, speedTune = null }: DiagnosticsSansResultatProps) {
  const t = useTraduction();
  const langue = useLangue();
  return (
    <>
    {result?.nombre === 0 && speedTune && (
      <p className={`text-xs font-semibold text-bad ${bureau ? 'mb-3 border-t border-border-soft pt-3' : 'mb-3 rounded-lg border border-border bg-panel p-3'}`}>
        {t.optimizer.speedTune.conditionBloquante(formatNombre(speedTune.min, langue), formatNombre(speedTune.max, langue))}
      </p>
    )}
    {/* ⚠️ Diagnostic affiché UNIQUEMENT sur 0 résultat — voir
        `diagnoseFeasibility` dans runeBuildOptim.ts pour ce qu'il
        prouve exactement. Deux cas : au moins une condition
        PROUVÉE hors de portée (rouge, liste précise) ; ou aucune ne
        l'est individuellement (message neutre — le blocage vient de
        leur combinaison ou de la recherche elle-même, pas d'une seule
        stat identifiable). */}
    {result?.nombre === 0 && feasibilityDiagnosis.length > 0 && (
      <DiagnosticFaisabilite
        impossibleFeasibility={impossibleFeasibility}
        bureau={bureau}
      />
    )}

    {/* ⚠️ Palier 2 — voir `rankBlockingConditions` dans
        runeBuildOptim.ts : un INDICE (pas une preuve, contrairement au
        palier 1 ci-dessus), désactivé par défaut (coûte plus cher).
        Deux affichages selon l'état de la bascule : le classement s'il
        est activé, une invitation discrète sinon. */}
    {result?.nombre === 0 && (
      <DiagnosticApprofondi blockingDiagnosis={blockingDiagnosis} diagnoseBlockingEnabled={diagnoseBlockingEnabled} bureau={bureau} />
    )}

    {/* ⚠️ Quasi-succès à l'appariement — sous-produit GRATUIT de la
        vraie recherche (`pairBuckets`, jamais recalculé), affiché
        SYSTÉMATIQUEMENT (contrairement au palier 2 ci-dessus, dont le
        coût réel justifie un réglage) : voir docs/03-developpeur/optimizer/,
        « Quasi-succès à l'appariement ». Ne voit que ce que la recherche a
        RÉELLEMENT exploré avant troncature — une paire encore plus
        proche, jamais atteinte, resterait invisible. */}
    {result?.nombre === 0 && (result.globalNearMiss || result.nearMissByCondition.length > 0) && (
      <QuasiSucces
        result={result}
        runeById={runeById}
        metric={metric}
        objective={objective}
        aurasPropresDe={aurasPropresDe}
        damageSetup={damageSetup}
        bureau={bureau}
      />
    )}
    </>
  );
}
