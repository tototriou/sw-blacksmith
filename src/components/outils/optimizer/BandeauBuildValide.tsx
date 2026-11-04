import { CheckCircle2 } from 'lucide-react';
import { type ValidatedBuild } from '../../../lib/optimizerExclusion';
import { useTraduction } from '../../../hooks/useLangue';

export interface BandeauBuildValideProps {
  ownValidatedBuild: ValidatedBuild | undefined;
  showRealGear: boolean;
  runesAbsentesValidees: number[];
  artefactsAbsentsValides: number[];
}

export default function BandeauBuildValide({ ownValidatedBuild, showRealGear, runesAbsentesValidees, artefactsAbsentsValides }: BandeauBuildValideProps) {
  const v = useTraduction().optimizer.validation;
  return (
    ownValidatedBuild ? (
      <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent">
        <CheckCircle2 size={13} className="flex-none" />
        <span className="grid min-w-0 flex-1">
          <span className={`col-start-1 row-start-1 ${showRealGear ? 'invisible' : ''}`} aria-hidden={showRealGear}>
            {v.valideAffiche}
          </span>
          <span className={`col-start-1 row-start-1 ${showRealGear ? '' : 'invisible'}`} aria-hidden={!showRealGear}>
            {v.reelAffiche}
          </span>
          {runesAbsentesValidees.length > 0 && <span role="status" className="text-warn">
            {v.runesAbsentes(runesAbsentesValidees.length)}
          </span>}
          {artefactsAbsentsValides.length > 0 && <span role="status" className="text-warn">
            {v.artefactsAbsents(artefactsAbsentsValides.length)}
          </span>}
        </span>
      </div>
    ) : null
  );
}
