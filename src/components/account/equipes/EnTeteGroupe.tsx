import { Layers, Send } from 'lucide-react';
import { Bouton } from '../../../ui';
import { useTraduction } from '../../../hooks/useLangue';
import type { ConflitsGroupe } from '../../../lib/equipesEnregistrees';

interface Props {
  nom: string;
  // Le groupe entier dans l'onglet, filtre de catégorie compris.
  nombre: number;
  conflits: ConflitsGroupe;
  // La raison qui empêche l'export (sans compte) ; `null` : exportable.
  exportImpossible: string | null;
  onExporter: () => void;
}

// L'en-tête d'un groupe dans la grille, sur toute sa largeur : son nom, ses
// équipes, ce que plusieurs d'entre elles portent à la fois, et l'export du
// groupe en une seule liste de l'Optimizer. Les cartes du groupe le suivent.
export default function EnTeteGroupe({ nom, nombre, conflits, exportImpossible, onExporter }: Props) {
  const g = useTraduction().equipes.groupes;
  const signaux = [
    conflits.exemplaires > 0 ? g.conflitsExemplaires(conflits.exemplaires) : null,
    conflits.pieces > 0 ? g.conflitsPieces(conflits.pieces) : null,
  ].filter((x): x is string => x !== null);
  return (
    <div role="group" aria-label={nom} title={g.aide}
      className="col-span-full flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-1.5 pt-1">
      <span className="flex min-w-0 items-baseline gap-2">
        <Layers size={14} className="flex-none self-center text-ink-dim" aria-hidden />
        <span className="truncate text-sm font-semibold text-ink">{nom}</span>
        <span className="flex-none text-xs text-ink-dim">{g.equipes(nombre)}</span>
      </span>
      {signaux.length > 0 && <span className="text-xs text-warn">{signaux.join(' · ')}</span>}
      <div className="ml-auto">
        <Bouton taille="sm" icone={<Send size={14} />} libelle={g.exporter} disabled={exportImpossible !== null}
          title={exportImpossible ?? undefined} onClick={onExporter} />
      </div>
    </div>
  );
}
