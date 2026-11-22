import type { ReactNode } from 'react';
import { Layers } from 'lucide-react';

interface Props {
  nom: string;
  // Le nombre d'équipes, dit en clair.
  detail?: string;
  // Ce que plusieurs équipes du groupe portent à la fois.
  signaux?: string[];
  // Les gestes du groupe, à droite ; aucun pour les équipes non groupées.
  children?: ReactNode;
}

// L'en-tête d'un bloc de la grille, sur toute sa largeur : un groupe (son nom,
// ses équipes, ce que plusieurs d'entre elles portent à la fois, ses gestes),
// ou les équipes non groupées qui suivent les groupes. Les cartes du bloc le
// suivent.
export default function EnTeteGroupe({ nom, detail, signaux = [], children }: Props) {
  return (
    <div role="group" aria-label={nom}
      className="col-span-full flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-1.5 pt-1">
      <span className="flex min-w-0 items-baseline gap-2">
        <Layers size={14} className="flex-none self-center text-ink-dim" aria-hidden />
        <span className="truncate text-sm font-semibold text-ink">{nom}</span>
        {detail && <span className="flex-none text-xs text-ink-dim">{detail}</span>}
      </span>
      {signaux.length > 0 && <span className="text-xs text-warn">{signaux.join(' · ')}</span>}
      {children && <div className="ml-auto flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
