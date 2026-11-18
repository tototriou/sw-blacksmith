// Un panneau par colonne, des sections séparées par un trait fin.
// docs/02-app/optimizer/ecran/README.md, « Panneaux et sections ».
export const PANNEAU = 'rounded-xl border border-border bg-panel p-2';
export const SECTIONS = '[&>*+*]:mt-2 [&>*+*]:border-t [&>*+*]:border-border-soft [&>*+*]:pt-2';

// ⚠️ Le cadre d'une colonne ne défile jamais (décision de l'utilisateur) : il
// prend la hauteur de la colonne, et son contenu défile À L'INTÉRIEUR
// (`DEFILEMENT`), la barre dans le panneau.
export const CADRE = 'rounded-xl border border-border bg-panel';

// Le panneau sous un groupe d'onglets : le coin haut gauche est carré (le
// premier onglet s'y pose), la ligne de base des onglets fait le haut du
// panneau et s'arrête avant le coin haut droit, qui reste arrondi : seul ce
// coin est dessiné ici.
export const COIN_RACCORD = 'relative rounded-tl-none border-t-0 before:pointer-events-none before:absolute before:-right-px before:-top-px'
  + " before:h-[var(--radius-xl)] before:w-[var(--radius-xl)] before:rounded-tr-xl before:border-r before:border-t before:border-border before:content-['']";

// Ce qui défile dans le cadre : arrondi comme l'intérieur du cadre, pour que
// le contenu ne déborde pas sur ses coins. Barre de 8 px sur fond
// transparent, toujours réservée (`scrollbar-gutter: stable`) : rien ne
// bouge quand elle paraît. ⚠️ Le contenu n'a PAS de rembourrage à droite :
// la barre réservée fait la marge de droite, égale aux 8 px de gauche
// (décision de l'utilisateur : la marge de droite était double). Rien ne
// déborde donc de sa section vers la droite, la barre le rognerait : le cadre
// du set refusé reste dans la largeur du contenu. Une place de 328 px garde
// 302 px de contenu (328 − retrait 8 − contour 2 − 8 − barre 8).
export const DEFILEMENT = 'h-full overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]'
  + ' rounded-[calc(var(--radius-xl)-1px)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent';
