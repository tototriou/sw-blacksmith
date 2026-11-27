// Recherche d'un monstre dans les recommandations — calcul pur.
//
// Deux questions différentes se posent devant une liste de recommandations :
//
//   « **contre quoi** ce monstre est-il joué ? »  → il est dans une DÉFENSE visée
//   « **qui** joue ce monstre ? »                 → il est dans un DECK
//
// ⚠️ Le sélecteur **FILTRE** : il décide où l'on cherche, et ce qui relève de
// l'autre rôle n'est pas affiché. Un mode qui se contentait de trier laissait à
// l'écran des résultats qu'on n'avait pas demandés — demander « offense à
// runer » et voir remonter des défenses n'est pas un classement, c'est du
// bruit. « Partout » reste là pour qui veut les deux.

import { Monster, Reco, RecoDeck } from '../types';
import { fiabiliteValide, parFiabilite } from './recoDefenses';

// Où chercher. `all` = les deux rôles.
export type RecoSearchMode = 'all' | 'defense' | 'offense';

// Où le monstre cherché a été trouvé, dans UN deck.
export interface DeckHit {
  deckIndex: number;
  // Positions dans les 3 slots du deck — le monstre est joué par ce deck.
  slots: number[];
  // Index des défenses visées qui le contiennent — le deck bat ce monstre.
  counters: number[];
  // Retenu par le filtre « Modifiés », pas par une recherche : ses défenses
  // passent toutes, aucune n'est surlignée (recoModifies.ts).
  filtre?: true;
}

export interface RecoHit {
  reco: Reco;
  decks: DeckHit[];
  // Pour le tri : un deck qui JOUE le monstre, une défense qui le PORTE.
  enOffense: boolean;
  enDefense: boolean;
}

// Normalisation pour comparer des noms saisis à la main : casse et accents
// ignorés. « chloe » doit trouver « Chloé », sinon la recherche ne sert à rien
// sur des noms que le jeu écrit avec des accents.
export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

// Les noms sous lesquels on cherche un monstre référencé par `com2usId`, déjà
// normalisés : celui du bestiaire s'il est chargé, sinon le nom figé au moment
// du partage (repli déjà utilisé partout ailleurs pour les monstres absents des
// données).
//
// ⚠️ **Et celui de son jumeau de collaboration** : Satoru Gojo et Werner sont le
// même monstre, et chercher « Werner » doit trouver le deck noté Gojo — celui
// qui a recruté l'un ne connaît pas forcément le nom de l'autre.
function nomsDe(
  com2usId: number | null,
  fallback: string,
  monsterByCom2us: Map<number, Monster>
): string[] {
  if (com2usId == null) return [''];
  const fiche = monsterByCom2us.get(com2usId);
  const jumeau = fiche?.jumeauCollab != null ? monsterByCom2us.get(fiche.jumeauCollab) : undefined;
  return [fiche?.name ?? fallback, ...(jumeau ? [jumeau.name] : [])].map(normalise);
}

// Toutes les recherches sont-elles satisfaites par cette composition, et à
// quelles positions ?
//
// ⚠️ **ET, pas OU** : chaque monstre ajouté PRÉCISE la recherche au lieu de
// l'élargir. C'est ce qui permet de retrouver une défense précise qu'on
// affronte — « Chloé + Trevor + Bella » doit sortir le deck qui bat exactement
// cette composition, pas les trois listes de decks qui jouent l'un des trois.
//
// Renvoie les positions occupées, ou `null` si un seul terme n'est pas trouvé.
function positionsSiToutes(
  noms: string[][], // noms de chaque monstre de la composition, dans l'ordre des positions
  termes: string[]
): number[] | null {
  const positions = new Set<number>();
  for (const t of termes) {
    const i = noms.findIndex((n, k) => n.some((x) => x.includes(t)) && !positions.has(k));
    // ⚠️ Une position déjà prise ne compte pas deux fois : chercher deux fois le
    // même nom exigerait deux monstres, or une composition n'en a que trois.
    // Sans ça, « chloe chloe » passerait sur un deck avec une seule Chloé.
    if (i < 0) return null;
    positions.add(i);
  }
  return [...positions];
}

// Les monstres cherchés sont-ils dans ce deck, et où ?
//
// ⚠️ Le « tous présents » vaut **par composition** : soit les trois slots du
// deck, soit une MÊME défense visée. Réparti entre les deux, il ne voudrait rien
// dire — un deck qui joue Chloé et qui bat Trevor ne « contient » pas
// « Chloé + Trevor » au sens où on le cherche.
function chercheDansDeck(
  deck: RecoDeck,
  deckIndex: number,
  termes: string[],
  mode: RecoSearchMode,
  monsterByCom2us: Map<number, Monster>
): DeckHit | null {
  // ⚠️ Le mode RESTREINT où l'on cherche :
  //   `offense` → uniquement les monstres du deck (« qui joue ça ? ») ;
  //   `defense` → uniquement les défenses visées (« qui bat ça ? ») ;
  //   `all`     → les deux.
  // Un mode qui se contentait de trier laissait à l'écran des résultats de
  // l'autre rôle : demander « offense à runer » et voir remonter des défenses
  // n'est pas un classement, c'est du bruit.
  const dansOffense = mode !== 'defense';
  const dansDefense = mode !== 'offense';

  const nomsSlots = deck.slots.map((sl) => nomsDe(sl.com2usId, sl.name, monsterByCom2us));
  const slots = dansOffense ? positionsSiToutes(nomsSlots, termes) ?? [] : [];

  const counters: number[] = [];
  if (dansDefense) {
    deck.counters.forEach((c, i) => {
      const noms = c.monsters.map((m) => nomsDe(m.com2usId, m.name, monsterByCom2us));
      if (positionsSiToutes(noms, termes)) counters.push(i);
    });
  }

  if (!slots.length && !counters.length) return null;
  return { deckIndex, slots, counters };
}

// Recommandations contenant le monstre cherché, dans le rôle demandé.
//
// Une requête vide renvoie `null` : c'est l'état neutre de la page, on ne veut
// alors ni filtrer ni déplier quoi que ce soit.
export function chercheMonstre(
  recos: Reco[],
  query: string | string[],
  mode: RecoSearchMode,
  monsterByCom2us: Map<number, Monster>
): RecoHit[] | null {
  // Les termes vides sont écartés : un emplacement de recherche non rempli ne
  // doit rien exiger — sinon ajouter un champ vide viderait tous les résultats.
  const termes = (Array.isArray(query) ? query : [query]).map(normalise).filter(Boolean);
  if (!termes.length) return null;

  const hits: RecoHit[] = [];
  for (const reco of recos) {
    const decks: DeckHit[] = [];
    reco.decks.forEach((deck, di) => {
      const h = chercheDansDeck(deck, di, termes, mode, monsterByCom2us);
      if (h) decks.push(h);
    });
    if (!decks.length) continue;
    hits.push({
      reco,
      decks,
      enOffense: decks.some((d) => d.slots.length > 0),
      enDefense: decks.some((d) => d.counters.length > 0),
    });
  }

  // ⚠️ Aucun tri : le mode a déjà FILTRÉ à la source (voir `chercheDansDeck`).
  // Ce qui reste répond toutes au rôle demandé, il n'y a plus rien à départager
  // — et l'ordre de la liste reste celui de l'utilisateur. Le tri par
  // fiabilité est un choix à part (`trierParFiabilite`).
  return hits;
}

// ── Tri des résultats par fiabilité ───────────────────────────────────────
//
// L'ordre des résultats : celui des recommandations (défaut), ou la fiabilité
// — le deck le plus sûr d'abord.
export type TriRecherche = 'ordre' | 'fiabilite';

// La fiabilité d'un deck TROUVÉ : la meilleure de ses défenses qui répondent
// à la recherche (le deck bat la défense cherchée — c'est elle qui compte), ou,
// si la recherche l'a trouvé par ses propres monstres, la meilleure de toutes
// ses défenses. `undefined` : aucune défense notée.
export function fiabiliteDuHit(deck: RecoDeck, hit: DeckHit): number | undefined {
  const indices = hit.counters.length ? hit.counters : deck.counters.map((_, i) => i);
  let meilleure: number | undefined;
  for (const i of indices) {
    const f = fiabiliteValide(deck.counters[i]?.fiabilite);
    if (f !== undefined && (meilleure === undefined || f > meilleure)) meilleure = f;
  }
  return meilleure;
}

// Les résultats triés par fiabilité : dans chaque recommandation, ses decks
// trouvés, le plus fiable d'abord ; puis les recommandations, par leur
// meilleur deck. Non notés à la fin, 0 avant eux ; à égalité, l'ordre
// d'origine (les tris sont stables). Rien n'est retiré.
export function trierParFiabilite(hits: RecoHit[]): RecoHit[] {
  const tries = hits.map((h) => {
    const notes = new Map(h.decks.map((d) => [d.deckIndex, fiabiliteDuHit(h.reco.decks[d.deckIndex], d)]));
    const decks = [...h.decks].sort((a, b) => parFiabilite({ fiabilite: notes.get(a.deckIndex) }, { fiabilite: notes.get(b.deckIndex) }));
    return { hit: { ...h, decks }, fiabilite: decks.length ? notes.get(decks[0].deckIndex) : undefined };
  });
  return tries.sort(parFiabilite).map((t) => t.hit);
}

// L'ordre de résultats triés : les recommandations, et dans chacune ses decks.
export interface OrdreResultats {
  recos: string[];
  decks: Map<string, number[]>;
}

export function ordreDe(hits: RecoHit[]): OrdreResultats {
  return { recos: hits.map((h) => h.reco.id), decks: new Map(hits.map((h) => [h.reco.id, h.decks.map((d) => d.deckIndex)])) };
}

// ⚠️ Des résultats RECALCULÉS remis dans un ordre FIGÉ. Trié par fiabilité,
// noter un deck pendant qu'on l'édite le déplaçait sous le clic (un clic ne
// déplace jamais ce qu'on vient de cliquer) : l'ordre est donc pris au moment
// du tri, ou d'une autre recherche, et tenu ensuite. Ce que l'ordre ne connaît
// pas (un deck ajouté, une recommandation qui se met à répondre) vient après,
// dans son ordre d'origine.
export function suivreOrdre(hits: RecoHit[], ordre: OrdreResultats): RecoHit[] {
  const rang = (l: readonly (string | number)[], x: string | number) => {
    const i = l.indexOf(x);
    return i < 0 ? l.length : i;
  };
  return hits
    .map((h) => {
      const connus = ordre.decks.get(h.reco.id) ?? [];
      return { ...h, decks: [...h.decks].sort((a, b) => rang(connus, a.deckIndex) - rang(connus, b.deckIndex)) };
    })
    .sort((a, b) => rang(ordre.recos, a.reco.id) - rang(ordre.recos, b.reco.id));
}
