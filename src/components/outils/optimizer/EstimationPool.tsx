import { formatBig } from '../../../lib/formatBig';
import { useTraduction } from '../../../hooks/useLangue';

export interface EstimationPoolProps {
  estimate: { perSlot: number[]; product: number; };
}

export default function EstimationPool({ estimate }: EstimationPoolProps) {
  const c = useTraduction().optimizer.criteres;
  return (
    <p className="text-micro text-ink-dim">
      {c.estimation(formatBig(estimate.perSlot.reduce((a, b) => a + b, 0)), estimate.perSlot.join(' + '))}
    </p>
  );
}
