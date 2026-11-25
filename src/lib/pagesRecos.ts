// La pagination d'une recommandation : ses decks (vue Attaque), les lignes de
// son analyse, ses défenses (vue Défense) — le calcul, sans le DOM.
//
// ⚠️ **Une recommandation n'a pas de taille plafond.** Un lot importé d'un
// salon Discord peut porter des centaines de decks ; les rendre tous d'un coup
// (portraits, pastilles, actions de chaque ligne) figeait la page et faisait
// grimper la mémoire. Une page à la fois borne le DOM, comme l'inventaire de
// runes.

// Combien d'éléments par page. Les decks repliés sont des lignes de tableau à
// la souris, des cartes au doigt : 20 tiennent en quelques écrans. Les lignes
// d'analyse sont une ligne de texte chacune : 50. Les défenses portent leurs
// offenses : 20 blocs.
export const DECKS_PAR_PAGE = 20;
export const LIGNES_ANALYSE_PAR_PAGE = 50;
export const DEFENSES_PAR_PAGE = 20;

// Nombre de pages, jamais moins d'une (une liste vide a une page, vide).
export function nombrePages(n: number, parPage: number): number {
  return Math.max(1, Math.ceil(n / parPage));
}

// La page ramenée dans les bornes : une liste qui raccourcit (deck supprimé,
// filtre posé) ne laisse pas l'écran sur une page qui n'existe plus.
export function pageBornee(page: number, n: number, parPage: number): number {
  return Math.min(Math.max(0, page), nombrePages(n, parPage) - 1);
}

// Les éléments de la page (bornée).
export function tranche<T>(elements: readonly T[], page: number, parPage: number): T[] {
  const p = pageBornee(page, elements.length, parPage);
  return elements.slice(p * parPage, p * parPage + parPage);
}

// La page où se trouve l'élément à cette POSITION dans la liste affichée.
export function pageDeLaPosition(position: number, parPage: number): number {
  return Math.floor(Math.max(0, position) / parPage);
}

// La page qui montre ce deck, parmi les decks AFFICHÉS (`indexAffiches`, dans
// l'ordre) ; `null` s'il n'en fait pas partie (masqué par une recherche).
//
// ⚠️ La position dans la liste affichée, pas l'index du deck : pendant une
// recherche, seuls les decks trouvés sont listés, et le 300ᵉ deck de la
// recommandation peut être le 2ᵉ de la liste.
export function pageDuDeck(indexAffiches: readonly number[], deckIndex: number, parPage: number): number | null {
  const position = indexAffiches.indexOf(deckIndex);
  return position < 0 ? null : pageDeLaPosition(position, parPage);
}

// « 21–40 sur 700 » : la première et la dernière position (comptées de 1) de
// la page, pour le dire à l'écran.
export function plageDeLaPage(page: number, n: number, parPage: number): { debut: number; fin: number } {
  if (n === 0) return { debut: 0, fin: 0 };
  const p = pageBornee(page, n, parPage);
  return { debut: p * parPage + 1, fin: Math.min(n, (p + 1) * parPage) };
}
