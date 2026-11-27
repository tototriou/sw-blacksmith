// Recommandations — la pagination des decks, de l'analyse et des défenses
// (src/lib/pagesRecos.ts).

import {
  DECKS_PAR_PAGE,
  nombrePages,
  pageBornee,
  pageDeLaPosition,
  pageDuDeck,
  plageDeLaPage,
  tranche,
} from '../src/lib/pagesRecos';
import { egal, titre } from './outils';

export function testPagesRecos() {
  titre('recos · pagination — pages, bornes, tranche, plage');
  egal([nombrePages(0, 20), nombrePages(1, 20), nombrePages(20, 20), nombrePages(21, 20), nombrePages(700, 20)], [1, 1, 1, 2, 35], 'nombre de pages : jamais moins d’une');
  egal([pageBornee(-3, 700, 20), pageBornee(10, 700, 20), pageBornee(99, 700, 20), pageBornee(5, 0, 20)], [0, 10, 34, 0], 'page bornée : dans [0, dernière]');
  const decks = Array.from({ length: 45 }, (_, i) => i);
  egal(tranche(decks, 0, 20), decks.slice(0, 20), 'tranche : la première page');
  egal(tranche(decks, 2, 20), [40, 41, 42, 43, 44], 'tranche : la dernière page, incomplète');
  egal(tranche(decks, 9, 20), [40, 41, 42, 43, 44], 'tranche : une page qui n’existe plus (liste raccourcie) retombe sur la dernière');
  egal([plageDeLaPage(0, 45, 20), plageDeLaPage(2, 45, 20), plageDeLaPage(0, 0, 20)], [{ debut: 1, fin: 20 }, { debut: 41, fin: 45 }, { debut: 0, fin: 0 }], 'plage : « 41–45 sur 45 »');
}

export function testPagesRecosDeckVise() {
  titre('recos · pagination — la page qui montre un deck');
  // Sans recherche : la position est l'index.
  const tous = Array.from({ length: 700 }, (_, i) => i);
  egal([pageDuDeck(tous, 0, DECKS_PAR_PAGE), pageDuDeck(tous, 19, DECKS_PAR_PAGE), pageDuDeck(tous, 20, DECKS_PAR_PAGE), pageDuDeck(tous, 699, DECKS_PAR_PAGE)], [0, 0, 1, 34], 'sans recherche : la page de l’index');
  // Pendant une recherche : la position parmi les decks TROUVÉS, pas l'index.
  const trouves = [3, 150, 299, 650];
  egal(pageDuDeck(trouves, 650, 2), 1, 'pendant une recherche : le 4ᵉ trouvé est en page 2, quel que soit son index');
  egal(pageDuDeck(trouves, 10, 2), null, 'un deck masqué par la recherche : aucune page');
  // Un deck tout juste ajouté (index = ancien nombre de decks) : la page qui
  // le portera, avant même qu'il soit dans la liste.
  egal([pageDeLaPosition(20, 20), pageDeLaPosition(40, 20), pageDeLaPosition(-1, 20)], [1, 2, 0], 'un deck ajouté en fin : sa page, avant qu’il existe');
}
