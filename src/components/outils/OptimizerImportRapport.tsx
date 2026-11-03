import type { RapportImportOptimizer } from '../../lib/importEquipes';
import { Modale } from '../../ui/Dialogs';
import { useTraduction } from '../../hooks/useLangue';

// Portée par App : le rapport reste lisible après l'atterrissage dans l'Optimizer.
export default function OptimizerImportRapport({ rapport, onFermer }: {
  rapport: RapportImportOptimizer;
  onFermer: () => void;
}) {
  const i = useTraduction().optimizer.importEquipe;
  return <Modale titre={i.exportVersOptimizer} labelledBy="rapport-export-optimizer" croix onClose={onFermer}>
    <div role="status" aria-label={i.rapport} className="space-y-2 text-sm text-ink-dim">
      <p>{rapport.listeCreee ? i.listeCreee(rapport.listeCreee.name, rapport.membresImportes, rapport.equipesCreees) : i.aucuneListe}</p>
      {rapport.ignores.map((m, n) => <p key={`ignore-${n}`}>{i.ignore(m.libelle, m.raison)}</p>)}
      {rapport.messages.map((m, n) => <p key={`message-${n}`}>{m}</p>)}
    </div>
  </Modale>;
}
