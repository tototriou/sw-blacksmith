// Combien de pastilles l'aperçu d'une recommandation repliée peut montrer
// sur deux lignes (`ApercuDeuxLignes`, RecoCard.tsx) — le calcul, sans le DOM.
//
// ⚠️ **Une recherche par DICHOTOMIE, jamais une pastille de moins par rendu.**
// La mesure se fait avant la peinture (`useLayoutEffect`) : chaque essai est
// une mise à jour synchrone, et React refuse au-delà de 50 imbriquées
// (erreur #185, « Maximum update depth exceeded ») en démontant TOUTE l'app.
// Retirer une pastille à la fois plantait sur une recommandation de plus
// d'une cinquantaine de decks en trop ; ici, une recherche prend au plus
// ~2·log₂(n) + 2 rendus.

export interface RechercheApercu {
  cle: string; // contenu et largeur : une autre clé, une nouvelle recherche
  bas: number; // le plus grand nombre de pastilles MESURÉ comme tenant (0 par défaut)
  haut: number; // le plus petit nombre mesuré comme ne tenant pas (n + 1 par défaut)
  essai: number; // le nombre rendu, à mesurer
}

// Le premier essai : toutes les pastilles, sans « +N ».
export function rechercheInitiale(cle: string, n: number): RechercheApercu {
  return { cle, bas: 0, haut: n + 1, essai: n };
}

// L'étape suivante, d'après la mesure de l'essai rendu ; `null` quand la
// recherche est finie (l'essai rendu est le résultat). Le résultat est
// toujours un nombre MESURÉ comme tenant, ou 0 : une mesure non monotone (un
// « +N » qui perd un chiffre) peut écarter un meilleur nombre, jamais en
// retenir un qui déborde.
//
// ⚠️ Un essai qui ne tient plus alors qu'il est sous la borne basse : la place
// a changé sans changer la clé (la fin a grandi). La borne basse, périmée,
// repart de 0 — sinon la recherche s'arrêterait sur un nombre qui déborde.
export function etapeRecherche(r: RechercheApercu, tient: boolean): RechercheApercu | null {
  const bas = tient ? Math.max(r.bas, r.essai) : r.essai <= r.bas ? 0 : r.bas;
  const haut = tient ? r.haut : Math.min(r.haut, r.essai);
  const essai = haut - bas <= 1 ? bas : Math.floor((bas + haut) / 2);
  // Le même essai : la recherche est finie (tant qu'elle ne l'est pas, le
  // milieu tombe strictement entre les bornes, dont l'une est l'essai rendu).
  // Les bornes ne s'enregistrent pas : ce serait un rendu de plus pour rien.
  if (essai === r.essai) return null;
  return { cle: r.cle, bas, haut, essai };
}

// Le nombre de rangées qu'occupent ces rectangles, dans l'ordre du flux.
// ⚠️ Comptées par CHEVAUCHEMENT vertical, pas par le haut : centrés sur leur
// ligne, deux éléments de hauteurs différentes n'ont pas le même haut, et
// chaque écart de 1 px comptait une ligne de plus.
export function compterLignes(rects: Iterable<{ top: number; bottom: number }>): number {
  let lignes = 0;
  let basDeLigne = -Infinity;
  for (const r of rects) {
    if (r.top >= basDeLigne - 1) {
      lignes += 1;
      basDeLigne = r.bottom;
    } else basDeLigne = Math.max(basDeLigne, r.bottom);
  }
  return lignes;
}
