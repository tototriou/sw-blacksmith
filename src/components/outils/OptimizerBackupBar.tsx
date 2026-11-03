import { useState, type ReactNode } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { Bouton, ConfirmDialog } from '../../ui';
import type { UseOptimizerLists } from '../../hooks/useOptimizerLists';
import type { OptimizerState } from '../../hooks/useOptimizerState';
import type { ExclusionSourceData } from '../../lib/optimizerExclusion';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import { formatDateHeure } from '../../i18n/format';

export default function OptimizerBackupBar({ listes, optimizer, data, artifactIds, debut, fin }: {
  listes: UseOptimizerLists; optimizer: OptimizerState; data: ExclusionSourceData; artifactIds: Set<number>;
  /** Posé au bout de la ligne d'annonce, dans une place réservée par l'appelant. */
  fin?: ReactNode;
  /** Actions de la liste, dans la même rangée que Sauvegarder et Reprendre. */
  debut?: ReactNode;
}) {
  const [confirmation, setConfirmation] = useState<'remplacer' | 'reprendre' | null>(null);
  const textes = useTraduction();
  const langue = useLangue();
  const s = textes.optimizer.sauvegarde;
  const point = listes.point;
  const date = point ? formatDateHeure(new Date(point.date), langue) : '';
  const sauvegarder = () => listes.sauvegarderPoint(optimizer.proprietaireCriteres, data);
  const annonce = point ? s.annonce(point.historique.lists.length, point.historique.members.length, date)
    : listes.pointExiste ? listes.rapportPoint.join(' ') : s.aucun;
  return <div aria-label={s.titre}>
    <div aria-label={s.actions} className="grid grid-cols-2 gap-1 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
      {debut}
      <Bouton taille="sm" pleineLargeur icone={<Save size={14} />} libelle={s.sauvegarder}
        title={s.sauvegarderAide}
        onClick={() => listes.pointExiste ? setConfirmation('remplacer') : sauvegarder()} />
      <Bouton taille="sm" pleineLargeur icone={<RotateCcw size={14} />} libelle={s.reprendre}
        disabled={!point} title={point ? s.reprendreAide
          : listes.pointExiste ? s.illisible : s.aucun}
        onClick={() => setConfirmation('reprendre')} />
    </div>
    {/* Une seule ligne, réservée avant le premier point aux deux formats :
        l'annonce tronquée garde son texte complet en infobulle. La colonne
        minmax(0, 1fr) empêche son texte d'élargir la page au téléphone. */}
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <p role="status" aria-label={s.annonceAria} title={annonce}
        className="truncate py-1 text-[11px] text-ink-dim">{annonce}</p>
      {fin}
    </div>
    {confirmation === 'remplacer' && <ConfirmDialog titre={s.remplacerTitre} destructif libelleAction={s.remplacer}
      message={s.remplacerMessage(point ? s.lePointDu(date, point.historique.lists.length) : s.lePointIllisible)}
      onCancel={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); sauvegarder(); }} />}
    {confirmation === 'reprendre' && point && <ConfirmDialog titre={s.reprendreTitre} destructif libelleAction={s.reprendre}
      message={s.reprendreMessage(date, point.historique.lists.length)}
      onCancel={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); optimizer.reprendrePoint(artifactIds); }} />}
  </div>;
}
