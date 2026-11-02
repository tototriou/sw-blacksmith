import IconeInterdite from '../../IconeInterdite';
import { WHEEL_IMG } from '../../RuneWheel';
import HelpPopover from '../../HelpPopover';
import { Interrupteur } from '../../../ui';
import Segmented from '../../../ui/Segmented';
import { AUTO_EXCLUSION_SCOPES, type AutoExclusionScope } from '../../../lib/optimizerExclusion';
import { type Dispatch, type SetStateAction } from 'react';
import { useTraduction } from '../../../hooks/useLangue';

export interface RunesDejaUtiliseesProps {
  excludeUsedRunes: boolean;
  setExcludeUsedRunes: Dispatch<SetStateAction<boolean>>;
  excludeUsedScope: AutoExclusionScope;
  setExcludeUsedScope: Dispatch<SetStateAction<AutoExclusionScope>>;
  // Colonne « Aura, exclusion, avancés » du bureau : interrupteur à droite.
  // Absent : la rangée du téléphone, inchangée.
  bureau?: boolean;
}

export default function RunesDejaUtilisees({ excludeUsedRunes, setExcludeUsedRunes, excludeUsedScope, setExcludeUsedScope, bureau = false }: RunesDejaUtiliseesProps) {
  const o = useTraduction().optimizer;
  const u = o.dejaUtilisees;
  const aide = <HelpPopover title={u.titre}>{u.aide}</HelpPopover>;
  const interrupteur = <Interrupteur actif={excludeUsedRunes} onChange={setExcludeUsedRunes} aria-label={u.titre} />;
  return (
    <div>
      {/* ⚠️ Au bureau, l'interrupteur est à droite, aligné sur ceux des
          « Réglages avancés » (leur carte l'écarte du bord de 9 px : 8 de
          rembourrage, 1 de contour), et son « ? » collé à lui, au même écart
          (12 px) que dans cette colonne. */}
      <div className={bureau ? 'mb-2 flex items-center gap-1.5 pr-[9px]' : 'flex flex-wrap items-center gap-1.5 mb-2'}>
        {/* Roue de runes (le fond derrière les runes des résultats de
            build, RuneWheel.tsx), barrée du symbole « interdit » —
            même traitement que l'icône « Exclusion de runes » : ce
            réglage retire des runes DÉJÀ PORTÉES de la recherche. */}
        <IconeInterdite>
          <img src={WHEEL_IMG} alt="" className="h-4 w-4 object-contain" />
        </IconeInterdite>
        <span className={`text-[12.5px] font-semibold text-ink-dim${bureau ? ' min-w-0 flex-1' : ''}`}>{u.titre}</span>
        {bureau ? <span className="flex flex-none items-center gap-3">{aide}{interrupteur}</span> : <>{aide}{interrupteur}</>}
      </div>
      <Segmented
        options={AUTO_EXCLUSION_SCOPES.map((s) => ({ key: s.key, label: o.sources[s.key] }))}
        value={excludeUsedScope}
        onChange={setExcludeUsedScope}
        disabled={!excludeUsedRunes}
        size="lg"
      />
    </div>
  );
}
