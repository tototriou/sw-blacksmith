import { type ReactNode } from 'react';
import MonstresDeLaListe, { type MonstresDeLaListeProps } from '../MonstresDeLaListe';
import { useTraduction } from '../../../../hooks/useLangue';

// La place de « Monstre » (docs/02-app/optimizer/ecran/README.md,
// « Mise en page d'ensemble ») : son panneau en prend 384 (358 de contenu,
// sa barre de défilement comprise dedans), le reste va à l'écart avec la
// colonne suivante (`RETRAIT_PANNEAU`, src/lib/optimizerColonnes.ts).
export const LARGEUR_MONSTRE = 392;

export interface ListeDeTravailBureauProps {
  // « Liste active » ▾ · « Importer une équipe » : `SelecteurListes` et
  // `OptimizerImportButton`, tels quels.
  listes: ReactNode;
  // « Rechercher un monstre… » : `MonsterSourcePicker` en mode bestiaire, tel quel.
  recherche: ReactNode;
  liste: MonstresDeLaListeProps;
}

// La liste de travail de « Monstre », au bureau : la recherche du monstre,
// sans titre devant, sur TOUTE la largeur de la colonne (décision de
// l'utilisateur : le monstre actif n'est plus affiché à côté, ni ailleurs ;
// la carte du membre choisi et l'exemplaire le disent). Les membres prennent au
// plus la hauteur que « Monstre » leur laisse (`HauteurListeContext`, mesurée
// par `PageBureau`), puis défilent. Le téléphone garde « Monstre & équipement ».
export default function ListeDeTravailBureau({ listes, recherche, liste }: ListeDeTravailBureauProps) {
  return (
    <section aria-label={useTraduction().optimizer.criteres.listeDeTravail}>
      {listes}
      <div className="mt-2">
        <MonstresDeLaListe {...liste} enTete={<div className="min-w-0 flex-1">{recherche}</div>} />
      </div>
    </section>
  );
}
