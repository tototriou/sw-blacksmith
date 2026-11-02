import GameIcon from '../../GameIcon';
import { type ReactNode } from 'react';
import { useTraduction } from '../../../hooks/useLangue';

// La carte « Monstre & équipement » du téléphone : l'en-tête, puis les trois
// blocs empilés de `MonstreEquipementTelephone`. Au bureau, la page en
// colonnes (`bureau/PageBureau.tsx`) répartit ces contenus entre la liste de
// travail et « Exemplaire ».
export default function MonstreEquipement({ children }: { children: ReactNode }) {
  const c = useTraduction().optimizer.criteres;
  return (
    <div className="rounded-xl border border-border bg-panel p-3">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-soft bg-panel2">
          <GameIcon name="monster" size={15} />
        </div>
        <p className="text-[13.5px] font-bold text-ink">{c.monstreEquipement}</p>
      </div>
      {children}
    </div>
  );
}
