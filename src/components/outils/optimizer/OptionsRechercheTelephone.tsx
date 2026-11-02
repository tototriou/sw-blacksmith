import { MobileSheet } from '../../../ui';
import { type ReactNode } from 'react';
import { useTraduction } from '../../../hooks/useLangue';

export interface OptionsRechercheTelephoneProps {
  menuOuvert: boolean;
  onFermerMenu: () => void;
  exclusionRunesTitre: ReactNode;
  exclusionRunesPanneau: ReactNode;
  reglagesAvancesTitre: ReactNode;
  reglagesAvancesPanneau: ReactNode;
}

export default function OptionsRechercheTelephone({ menuOuvert, onFermerMenu, exclusionRunesTitre, exclusionRunesPanneau, reglagesAvancesTitre, reglagesAvancesPanneau }: OptionsRechercheTelephoneProps) {
  const c = useTraduction().optimizer.criteres;
  return (
    <MobileSheet ouvert={menuOuvert} onFermer={onFermerMenu} titre={c.optionsRecherche}>
      {/* ⚠️ `space-y-3` et NON `flex flex-col` : le corps du panneau
          porte `data-tiroir`, et index.css y pose
          `[data-tiroir] .flex-col { align-items: flex-start }` — écrit
          pour les rangées d'actions, mais qui rabote ici les deux cartes
          à la largeur de leur contenu au lieu de les étirer. En blocs
          (`space-y`), les cartes reprennent d'elles-mêmes toute la
          largeur du panneau. Même piège que MobileNavSheet. */}
      <div className="space-y-3">
        <div className="rounded-lg border border-border-soft bg-panel2 p-3">
          <div className="mb-0.5 flex items-center gap-2">{exclusionRunesTitre}</div>
          {exclusionRunesPanneau}
        </div>
        <div className="rounded-lg border border-border-soft bg-panel2 p-3">
          <div className="mb-3 flex items-center gap-1.5 text-[13px] font-bold text-ink">
            {reglagesAvancesTitre}
          </div>
          {reglagesAvancesPanneau}
        </div>
      </div>
    </MobileSheet>
  );
}
