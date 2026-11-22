import { CSSProperties } from 'react';

// Icônes de NAVIGATION « objets d'atelier » (docs/02-app/transverse/).
//
// Grille de 24, trait de 2, bouts et angles ronds, `currentColor` : le même
// contrat que lucide, pour que chacune remplace son icône lucide sans que
// l'appelant change (`size`, `color`, `className`). Une icône par section ; les
// ACTIONS (importer, exporter, rechercher…) gardent les formes standard de
// lucide — la toile le dit : « des symboles standards pour les actions ».
//
// Origine des tracés : ceux de la toile (planche « Icônes »), tels quels ; huit
// dessinées pour l'app, choisies par le mainteneur sur planche — la
// coupe (Arène), la clé à molette (Outils), l'enclume (Optimizer), les deux
// compagnons (Ami), le chronomètre (Speed tuning), l'œuf (Monstres), et le
// médaillon (Artéfacts) repris d'`InventaireIcon` ; le dossier à l'étoile (Mes équipes).
// ⚠️ **Une exception, voulue par le mainteneur (2026-11-10)** : l'action
// « Exporter vers l'Optimizer » porte l'enclume de l'Optimizer (`IconeOptimizer`),
// partout où elle existe — on voit d'un coup d'œil où l'équipe part.
// ⚠️ **`InventaireIcon` n'est PAS modifié** : la refonte l'a rangé parmi les
// rendus du jeu à l'identique (ses silhouettes de monstre, de rune et
// d'artéfact), et les écrans du compte le gardent. Les trois inventaires ont
// donc ICI leur icône de NAVIGATION, à part.

export type PropsIcone = { size?: number; color?: string; className?: string; style?: CSSProperties };
export type IconeAtelier = (props: PropsIcone) => JSX.Element;

const cercle = (x: number, y: number, r: number) =>
  `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

function fabrique(d: string): IconeAtelier {
  return function Icone({ size = 24, color, className = '', style }: PropsIcone) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        // `flex-none` : ces icônes vivent dans des rangées en flex (nav,
        // onglets), où elles se feraient écraser à la première contrainte.
        className={`flex-none ${className}`}
        style={color ? { color, ...style } : style}
      >
        <path d={d} />
      </svg>
    );
  };
}

// De la toile.
export const IconeAccueil = fabrique('M2 8h20v3h-5a3 3 0 0 0-3 3v2h2v4H8v-4h2v-2a3 3 0 0 0-3-3H5.5A3.5 3.5 0 0 1 2 8z');
export const IconeSiege = fabrique('M4 21h16M6 21V10h12v11M6 10V5h2.5v2h2V5h3v2h2V5H18v5M10 21v-3a2 2 0 0 1 4 0v3');
export const IconeRecos = fabrique(
  'M19 17V5a2 2 0 0 0-2-2H4M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3M10 8h5M10 12h5'
);
export const IconeRta = fabrique(
  'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2'
);
export const IconeCompte = fabrique('M3 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10H3zM3 12h18M10.5 11h3v3h-3z');
export const IconeBestiaire = fabrique(
  'M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0 0 4h14v-4M10 6.5l-1.5 6M13.5 6.5 12 12.5M17 6.5l-1.5 6'
);
export const IconeMecaniques = fabrique(
  cercle(12, 12, 6.5) +
    cercle(12, 12, 2.5) +
    'M12 2.5V5.5M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1'
);
export const IconeNouveautes = fabrique('M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8zM19 15v6M16 18h6');
// Application de bureau : la page « Télécharger » — la
// flèche qui descend dans le bac. Dessinée pour l'app, pas choisie sur
// planche comme les autres : remplaçable par un objet d'atelier.
export const IconeTelecharger = fabrique('M12 3v11M7.5 9.5 12 14l4.5-4.5M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3');
// Bot Discord : la tête de robot de lucide (`bot`), telle quelle.
export const IconeBotDiscord = fabrique(
  'M12 8V4H8M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM2 14h2M20 14h2M15 13v2M9 13v2'
);
// La page « SW Exporter » : le compte qui suit le jeu — deux flèches en
// boucle autour d'un point (le fichier tenu à jour).
export const IconeSwex = fabrique('M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v3.7h-3.7M6 21v-3.7h3.7' + cercle(12, 12, 2));
// Notions de la toile (« Défense », « Attaque »).
// Statistiques des sièges : des barres sur une ligne de base.
export const IconeStatistiques = fabrique('M3 21h18M6 17v-5M10.5 17V7M15 17v-8M19.5 17V4');
export const IconeDefense = fabrique('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM12 8v8M9 11h6');
export const IconeOffense = fabrique('M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2');
// Action « Réglages » de la toile : Paramètres (l'engrenage est à
// Mécaniques).
export const IconeParametres = fabrique(
  'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0' + cercle(16, 6, 2) + cercle(10, 12, 2) + cercle(18, 18, 2)
);

// Dessinées pour l'app.
export const IconeArene = fabrique(
  'M7 3h10v5a5 5 0 0 1-10 0zM7 5H4v1.5A3.5 3.5 0 0 0 7.5 10M17 5h3v1.5A3.5 3.5 0 0 1 16.5 10M12 13v3M8 21h8M9 16h6l1 5H8z'
);
// La clé à molette, mâchoire ouverte, la molette marquée sur le manche.
export const IconeOutils = fabrique(
  'M19.47 7.08L17.04 9.51L14.49 6.96L16.92 4.53A4.6 4.6 0 0 0 11.06 10.81L3.54 18.34A1.5 1.5 0 0 0 5.66 20.46L13.19 12.94A4.6 4.6 0 0 0 19.47 7.08ZM9.76 12.12L11.88 14.24'
);
// L'enclume et ses étincelles : on y forge le meilleur équipement (le nom de l'app).
export const IconeOptimizer = fabrique(
  'M3 9h12.5c2.5 0 4.5-1 5.5-3v3.5c0 2.5-2 4-5 4H15v2.5l2.5 3.5h-11L9 16v-2.5H5.5A2.5 2.5 0 0 1 3 11zM8 2.5v2.5M11.5 3.5 10.5 5M4.5 3.5 5.5 5'
);
export const IconeAmi = fabrique(cercle(8, 8, 3) + cercle(16, 8, 3) + 'M2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0');
export const IconeSpeedTuning = fabrique(cercle(12, 14, 8) + 'M12 14l3.5-3.5M10 2h4M12 2v4M19 5l1.5 1.5');
// Les trois inventaires de « Mon compte », dans la NAVIGATION.
export const IconeMonstres = fabrique(
  'M12 2.5C7.5 2.5 4.5 9 4.5 14a7.5 7.5 0 0 0 15 0c0-5-3-11.5-7.5-11.5zM7.5 12l2.5 2 2-3 2 2.5 2.5-2M9 18.5h6'
);
// La pierre runique de la toile.
export const IconeRunes = fabrique('M12 2l8.5 5v10L12 22l-8.5-5V7zM12 7v10M12 10.5l3-2M12 13.5l-3-2');
// Le médaillon, repris tel quel d'`InventaireIcon` (le mainteneur l'a préféré).
export const IconeArtefacts = fabrique('M2.5 12L7 3.7H17L21.5 12L17 20.3H7ZM12 8L15 12L12 16L9 12Z');
// « Mes équipes » : un dossier marqué de l'étoile des runes — des équipes rangées
// avec leur équipement.
export const IconeEquipes = fabrique(
  'M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5zM12 9.4 13.05 11.18 15.12 11.2 14.1 13 15.12 14.8 13.05 14.82 12 16.6 10.95 14.82 8.88 14.8 9.9 13 8.88 11.2 10.95 11.18Z'
);
