// La pastille de VIT d'une carte : ce qui fait d'une carte un ATTAQUANT. Sur
// l'écran de préparation, seuls les attaquants portent leur VIT de combat ; la
// défense et la liste des monstres n'en ont pas (cartes.ts).
//
// La VIT est écrite en clair dans une PASTILLE sombre, en bas à droite de la
// carte, avec l'icône de vitesse à sa gauche. ⚠️ Sa place exacte varie selon
// l'écran (plus basse sur PC, plus haute sur une carte recadrée) : on la
// TROUVE dans la carte plutôt que de la supposer. Son bas : la plus basse
// rangée PLEINE (une longue suite sombre, jusqu'au bord droit de la carte, où
// la pastille s'appuie) au-dessus du cadre ; elle donne sa largeur. Les
// chiffres sont juste au-dessus, BLANCS : en remontant, les rangées qui portent
// du clair dans cette largeur ; la première qui n'en porte plus est le haut de
// la zone. ⚠️ Pas le noir : un portrait sombre qui touche la pastille la
// prolonge, à côté des chiffres comme au-dessus. Relevé : la pastille va de
// (30, 30, 27) à (50, 38, 17) ; les chiffres, blancs, ont leur plus faible
// composante au-dessus de 150 au cœur du trait, qu'aucune teinte vive d'un
// portrait n'atteint.

import { decouper, type Image } from './image';
import { glyphesDuNombre, masqueClair } from './chiffres';
import type { Rect } from './cartes';

const SOMBRE = 60;
const CLAIR = 150;
const SUITE_PASTILLE = 0.25; // longueur d'une rangée pleine de la pastille, en largeur de carte (relevé : 0,5 à 0,6)
const HAUTEUR_PASTILLE_MAX = 0.3; // en hauteur de carte

export function pastilleVitesse(img: Image, [x, y, l, h]: Rect): Rect | null {
  const { largeur, rgba } = img;
  const x0 = Math.max(0, Math.round(x + 0.3 * l)), x1 = Math.min(largeur - 1, Math.round(x + l) - 1);
  const yHaut = Math.max(0, Math.round(y + 0.55 * h)), yBas = Math.min(img.hauteur - 1, Math.round(y + 0.97 * h));
  const sombre = (xx: number, yy: number) => {
    const i = (yy * largeur + xx) * 4;
    return Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) < SOMBRE;
  };
  const plusLongueSuite = (yy: number): [number, number] => {
    let meilleure: [number, number] = [0, -1], debut = -1;
    for (let xx = x0; xx <= x1 + 1; xx++) {
      if (xx <= x1 && sombre(xx, yy)) { if (debut < 0) debut = xx; continue; }
      if (debut >= 0 && xx - debut > meilleure[1] - meilleure[0] + 1) meilleure = [debut, xx - 1];
      debut = -1;
    }
    return meilleure;
  };
  // La pastille touche le bord droit de la carte : sa suite sombre y va.
  const pleine = (s: [number, number]) => s[1] - s[0] + 1 >= SUITE_PASTILLE * l && s[1] >= x + 0.9 * l;
  let bas = -1, gauche = x1, droite = x0;
  for (let yy = yBas; yy >= yHaut && bas < 0; yy--) {
    const s = plusLongueSuite(yy);
    if (pleine(s)) { bas = yy; [gauche, droite] = s; }
  }
  if (bas < 0) return null;
  // Un clair de chiffre est posé sur la pastille : du sombre à courte distance
  // de chaque côté (moins qu'une largeur de chiffre). Le blanc d'un portrait,
  // au coin arrondi de la pastille, est entouré de portrait.
  const portee = Math.max(3, Math.round(0.1 * l));
  const blanc = (xx: number, yy: number) => {
    const i = (yy * largeur + xx) * 4;
    return Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) >= CLAIR;
  };
  const surSombre = (xx: number, yy: number) => {
    let g = false, d = false;
    for (let k = 1; k <= portee && !g; k++) g = xx - k >= gauche && sombre(xx - k, yy);
    for (let k = 1; k <= portee && !d; k++) d = xx + k <= droite && sombre(xx + k, yy);
    return g && d;
  };
  const premierClair = (yy: number, jusque: number) => {
    for (let xx = gauche; xx <= jusque; xx++) if (blanc(xx, yy) && surSombre(xx, yy)) return xx;
    return -1;
  };
  const clair = (yy: number) => premierClair(yy, droite) >= 0;
  // Sans rangée vide au-dessus des chiffres avant la hauteur limite, la zone
  // s'arrête à cette limite. Aucun clair : pas de VIT dans la carte.
  let haut = -1, chiffres = false;
  for (let yy = bas - 1; yy >= Math.max(yHaut, bas - HAUTEUR_PASTILLE_MAX * h); yy--) {
    haut = yy;
    if (clair(yy)) chiffres = true;
    else if (chiffres) break;
  }
  if (!chiffres) return null;
  // À gauche, la zone part du premier clair (l'icône ou le premier chiffre),
  // avec une marge de fond : un portrait sombre qui prolonge la pastille y
  // mêlerait ses teintes au seuil d'encre.
  let premier = droite;
  for (let yy = haut; yy <= bas; yy++) {
    const p = premierClair(yy, premier - 1);
    if (p >= 0) premier = p;
  }
  const debut = Math.max(gauche, premier - Math.max(2, Math.round(0.3 * (bas - haut))));
  // En haut, une marge d'un quart de la zone (une rangée au moins) : le haut
  // d'un chiffre est un mélange de blanc et de fond, sous le seuil du clair —
  // une rangée sur un chiffre de 5 pixels, deux ou trois sur une capture
  // agrandie (relevé : le 205 d'une capture ×1,5 perdait son haut, et sa VIT).
  const dessus = Math.max(yHaut, haut - Math.max(1, Math.round(0.25 * (bas - haut))));
  // À droite, la même marge qu'à gauche : la rangée sombre du bas s'arrête au
  // coin arrondi de la pastille, et le dernier chiffre peut la dépasser (relevé :
  // 1 à 2 pixels sur une capture de téléphone en 2640 × 1080, qui coupaient le
  // 8 de 328 et de 368). Le cadre de la carte, s'il entre, n'est pas de l'encre :
  // sa plus faible composante reste sous celle des chiffres blancs.
  const fin = Math.min(largeur - 1, droite + Math.max(2, Math.round(0.3 * (bas - haut))));
  return [debut, dessus, fin - debut + 1, bas - dessus + 1];
}

export function zoneVitesse(img: Image, carte: Rect): Image | null {
  const p = pastilleVitesse(img, carte);
  return p ? decouper(img, ...p) : null;
}

// La carte porte une VIT : sa pastille, et dedans un NOMBRE — deux à quatre
// glyphes clairs alignés à droite. ⚠️ La pastille seule ne suffit pas : un
// coin sombre de portrait avec un reflet clair lui ressemble, surtout sous la
// compression JPEG ; un nombre écrit, non. On ne le lit pas ici : une VIT
// illisible (chiffres trop petits) reste celle d'un attaquant.
export function porteUneVit(img: Image, carte: Rect): boolean {
  const zone = zoneVitesse(img, carte);
  if (!zone) return false;
  const n = glyphesDuNombre(masqueClair(zone)).length;
  return n >= 2 && n <= 4;
}
