import ArtefactsEtReliques, { type ArtefactsEtReliquesProps } from '../ArtefactsEtReliques';

// La place de l'onglet « Artéfacts » dans le groupe de 328 px : son panneau
// en prend 320 (`RETRAIT_PANNEAU`), ses sections 294 (la barre de défilement
// est dans le panneau).
export const LARGEUR_ARTEFACTS = 328;

// « Artéfacts et relique », au bureau : la carte du téléphone (`ArtefactsEtReliques`,
// partagée) dans sa forme `bureau` — section sans cadre du panneau de la
// colonne, Attribut et Type sur une ligne —, SANS l'encart « Meilleurs
// artéfacts offensifs » : il devient une section à part, sous la relique
// (`MeilleursArtefactsBureau`).
export default function ArtefactsEtReliqueBureau(props: Omit<ArtefactsEtReliquesProps, 'blocArtefactsSeuls' | 'bureau'>) {
  return (
    <div>
      <ArtefactsEtReliques {...props} blocArtefactsSeuls={null} bureau />
    </div>
  );
}
