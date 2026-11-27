// L'écran de préparation d'un combat de siège (ou de son test) : à gauche les
// trois ATTAQUANTS, leader en premier, chacun avec sa VIT DE COMBAT écrite sous
// son portrait (lead et totem compris) ; à droite la défense, sans VIT.
//
// ⚠️ Ni le format de l'image, ni la taille des cartes, ni la couleur des
// cadres ne comptent : les cartes se TROUVENT à leur contour, et les
// attaquants sont celles qui portent une pastille de VIT (cartes.ts,
// pastille.ts). Sans trois attaquants trouvés, l'écran n'est pas reconnu :
// aucune position n'est supposée.

import type { Image } from './image';
import { lireNombre, scoresParSynthese, type Gabarits, type NombreLu } from './chiffres';
import { variantes, type Banque, type Reconnaissance } from './portraits';
import { trouverCartesAToutesEchelles, type OptionsCartes, type Rect } from './cartes';
import { zoneVitesse } from './pastille';

export interface MonstreLu {
  rect: Rect;
  portrait: Reconnaissance | null;
}
// `vitesse` : la VIT SÛRE (règle `plausible`), sinon `null`. `hypotheses` :
// les VIT possibles, de la plus probable à la moins probable, même quand
// aucune n'est sûre — vide si la pastille ne porte pas trois chiffres.
export interface AttaquantLu extends MonstreLu {
  vitesse: NombreLu | null;
  hypotheses: number[];
}
export interface LectureEcran {
  attaquants: AttaquantLu[];
  defense: MonstreLu[];
}

// Une VIT de combat possible en siège, où l'on règle des vitesses : au-delà,
// ce n'est pas une VIT (une capture d'un autre écran, un nombre mal découpé,
// un chiffre perdu — « 66 » pour 314).
export const VIT_MIN = 100;
export const VIT_MAX = 450;

// Une VIT FAUSSE donnée pour sûre est pire qu'une VIT supposée, que le message
// dit à vérifier (`hypotheses`) : sous CONFIANCE_VIT_PLANCHER, la VIT n'est
// pas sûre, ni quand un de ses chiffres est presque à égalité avec un autre
// (MARGE_VIT_MIN) sans que la lecture agrandie donne le même nombre. ⚠️ Sous HAUTEUR_SURE pixels, l'écart
// ne suffit plus : un 9 et un 0 de 6 pixels ne diffèrent que de deux ou trois
// pixels. Relevé sur 17 vraies captures réduites jusqu'à des chiffres de 5
// pixels et compressées : à 5 et 6 pixels, sans accord des deux lectures, 69
// justes et 9 fausses (« 340 » pour 349, écart jusqu'à 0,07), aux écarts
// mêlés ; seul l'accord y vaut. À 7 pixels et plus, aucune fausse ne passe la
// règle de l'écart. ⚠️ Sous HAUTEUR_LISIBLE, même l'accord ne suffit plus : à
// 5 pixels, les deux lectures se sont accordées sur un « 340 » pour 349 (une
// capture réduite à 75 % et compressée) — la VIT n'y est jamais sûre.
export const CONFIANCE_VIT_PLANCHER = 0.7;
const MARGE_VIT_MIN = 0.05;
const HAUTEUR_SURE = 7;
const HAUTEUR_LISIBLE = 6;

const plausible = (lu: NombreLu | null): NombreLu | null =>
  (lu && lu.valeur >= VIT_MIN && lu.valeur <= VIT_MAX && lu.confiance >= CONFIANCE_VIT_PLANCHER && lu.hauteur >= HAUTEUR_LISIBLE
    && (lu.accord || (lu.marge >= MARGE_VIT_MIN && lu.hauteur >= HAUTEUR_SURE)) ? lu : null);

// Les VIT possibles quand aucune n'est sûre, de la plus probable à la moins
// probable : chaque nombre de trois chiffres entre VIT_MIN et VIT_MAX reçoit
// un score EN ENTIER. Un chiffre qui hésite seul (un 9 ou un 0 de 5 pixels) se
// départage ainsi par ce qu'une VIT peut être : « 549 » n'en est pas une,
// « 349 » si.
//   - Trois glyphes ou plus : la somme des scores de ses chiffres, lus à la
//     taille d'origine. Plus de trois : un intrus colle au nombre (l'icône à
//     gauche, un bout de cadre à droite — relevé : « 3168 » pour 316 sur une
//     capture floutée) ; chaque suite de trois glyphes est essayée.
//   - Moins de trois (des chiffres soudés ou perdus par le seuil — relevé :
//     « 00 » ou « 1 » pour 384) : le nombre entier rendu et comparé à la zone
//     (`scoresParSynthese`).
// ⚠️ Relevé sur le banc de stress (VIT refusées de 20 vraies captures réduites
// jusqu'à ×0,4, compressées, floutées) : glyphes à la taille d'origine, juste
// en tête 72 fois sur 100 ; y ajouter la lecture agrandie, 37 ; la synthèse,
// 50 — moins précise que les glyphes quand ils existent, elle ne sert que
// sans eux. Combiner les deux dégradait le classement.
export const HYPOTHESES_MAX = 10;
const VALEURS_VIT = Array.from({ length: VIT_MAX - VIT_MIN + 1 }, (_, i) => VIT_MIN + i);
export function hypothesesVit(zone: Image | null, lu: NombreLu | null, gabarits: Gabarits): number[] {
  const cs = lu?.chiffres ?? [];
  let scores: Map<number, number> | null = null;
  if (cs.length >= 3) {
    scores = new Map();
    for (let debut = 0; debut + 3 <= cs.length; debut++) {
      for (const v of VALEURS_VIT) {
        const t = String(v);
        const s = cs[debut].aTaille[t[0]] + cs[debut + 1].aTaille[t[1]] + cs[debut + 2].aTaille[t[2]];
        if (s > (scores.get(v) ?? -Infinity)) scores.set(v, s);
      }
    }
  } else if (zone) {
    scores = scoresParSynthese(zone, gabarits, VALEURS_VIT);
  }
  return scores ? [...scores].sort((a, b) => b[1] - a[1]).slice(0, HYPOTHESES_MAX).map(([v]) => v) : [];
}

// `null` : les trois cartes des attaquants ne sont pas dans l'image.
// `options.vitFacultative` : trois portraits sans VIT suffisent (l'app, pour
// un counter ; jamais le bot — voir cartes.ts).
export function lireEcranPreparation(img: Image, banque: Banque, gabarits: Gabarits, options: OptionsCartes = {}): LectureEcran | null {
  const cartes = trouverCartesAToutesEchelles(img, options);
  if (!cartes) return null;
  const monstre = (rect: Rect): MonstreLu => ({ rect, portrait: banque.reconnaitre(variantes(img, rect)) });
  const attaquant = (rect: Rect): AttaquantLu => {
    const zone = zoneVitesse(img, rect);
    const lu = zone ? lireNombre(zone, gabarits) : null;
    const vitesse = plausible(lu);
    return { ...monstre(rect), vitesse, hypotheses: vitesse ? [vitesse.valeur] : hypothesesVit(zone, lu, gabarits) };
  };
  return { attaquants: cartes.attaquants.map(attaquant), defense: cartes.defense.map(monstre) };
}
