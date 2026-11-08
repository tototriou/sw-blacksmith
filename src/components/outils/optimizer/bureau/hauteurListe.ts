import { createContext } from 'react';

// Ce que la page de bureau dit à la liste des membres (`MonstresDeLaListe`,
// forme de bureau) : la hauteur qu'elle peut prendre dans « Monstre »,
// mesurée sur la colonne (sa hauteur moins tout le reste de son contenu).
// ⚠️ « Monstre » ne défile pas (décision de l'utilisateur) : la liste prend
// cette hauteur au plus, puis défile seule. `null` (avant la mesure, hors de
// la page) : sa hauteur entière.
export const HauteurListeContext = createContext<number | null>(null);

// ⚠️ La liste ne descend jamais sous la hauteur de la plus petite équipe,
// trois monstres (décision de l'utilisateur), ou sous sa hauteur entière si
// elle est plus courte : c'est la mesure qui décide si l'exemplaire tient
// encore dessous (`hauteurEquipeMinimale`). Repli, sans membre à mesurer :
// une équipe de trois au bureau (en-tête et trois cartes).
export const MIN_LISTE_BUREAU = 176;

// La hauteur d'une équipe de trois dans cette liste, lue sur son rendu : du
// haut de sa première section au bas de sa troisième carte (les cartes
// manquantes comptées à la hauteur et à l'écart des premières), plus son
// rembourrage bas.
export function hauteurEquipeMinimale(liste: HTMLElement): number {
  const section = liste.querySelector<HTMLElement>(':scope > section');
  const cartes = section ? [...section.querySelectorAll<HTMLElement>('[data-carte-membre]')] : [];
  if (!section || !cartes.length) return MIN_LISTE_BUREAU;
  const rect = (i: number) => cartes[i].getBoundingClientRect();
  const ecart = cartes.length > 1 ? rect(1).top - rect(0).bottom : 2;
  const n = Math.min(3, cartes.length);
  const jusquA = rect(n - 1).bottom - section.getBoundingClientRect().top + (3 - n) * (rect(0).height + ecart);
  return Math.ceil(jusquA + (parseFloat(getComputedStyle(section).paddingBottom) || 0));
}
