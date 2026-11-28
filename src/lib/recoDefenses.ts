// Vue DÉFENSE d'une recommandation : les défenses visées, et pour chacune les
// offenses de la recommandation qui la battent — l'inverse de la vue Attaque
// (un deck, puis les défenses contre lesquelles il est fort). Spec :
// docs/02-app/siege/ § Vue Défense.
//
// ⚠️ **Une VUE, pas un modèle** : tout est DÉRIVÉ des `counters` de chaque
// deck, rien n'est stocké. Le format exporté ne change pas : un ancien fichier
// s'affiche dans les deux vues sans conversion, et les fichiers déjà partagés
// restent lisibles.
//
// ⚠️ **Même défense = même équipe, au sens de `cleEquipe`** : même CHEF et
// mêmes deux autres monstres dans n'importe quel ordre, ou, sans chef, mêmes
// trois monstres dans n'importe quel ordre. Le chef est le premier monstre
// quand son lead est actif en siège : c'est lui seul qui change l'équipe en
// jeu. Un monstre sans identifiant (saisi à la main) se reconnaît à son nom,
// sans casse ; une collaboration, à sa version SW.

import type { ElementKey, LeaderSkill, Monster, Reco, RecoCounter } from '../types';
import { idCanoniqueCollab } from './monsterForms';

// Les deux vues de la page : Attaque (deck → défenses battues, où l'on
// modifie) et Défense (défense → offenses qui la battent, en lecture seule).
export type VueRecos = 'attaque' | 'defense';

// Une offense de la recommandation qui bat la défense : le deck, et la défense
// visée telle que CE deck la porte (sa précision, « si Galleon est en lead »,
// lui appartient).
export interface OffenseContre {
  deckIndex: number;
  counterIndex: number;
  note: string;
  fiabilite?: number;
}

// ── Fiabilité d'un deck contre une défense ────────────────────────────────
//
// Une note en étoiles, de 0 à 5, que l'auteur donne à CE deck contre CETTE
// défense (`RecoCounter.fiabilite`) : quand plusieurs offenses battent la même
// défense, on joue la plus fiable d'abord. Absente = non notée — distincte de
// 0 : « pas encore jugé » n'est pas « ne passe pas ».
// ⚠️ **Saisie par étoile ENTIÈRE** (0, 1, 2, 3, 4, 5 : `FIABILITE_PAS_SAISIE`),
// **lecture par demi-étoile** (`FIABILITE_PAS`) : des notes en demi-étoiles
// existent dans les stockages, les salons et les fichiers d'avant ; les
// refuser les effacerait. Elles s'affichent telles quelles et passent à
// l'entier voisin au premier « + » ou « − ».
export const FIABILITE_MAX = 5;
export const FIABILITE_PAS = 0.5;
export const FIABILITE_PAS_SAISIE = 1;

// Une fiabilité lue d'un stockage ou d'un fichier : un multiple de 0,5 de 0 à
// 5, ou `undefined` (non notée). Tout le reste — 2.3, « 4 », 9, -1 — est
// ignoré : arrondir ou borner inventerait une note que personne n'a donnée.
export function fiabiliteValide(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isInteger(raw / FIABILITE_PAS) && raw >= 0 && raw <= FIABILITE_MAX
    ? raw
    : undefined;
}

// La couleur d'une note : rouge en bas, jaune au milieu, vert en haut — les
// tokens sémantiques `bad`, `warn`, `good`. Seuils : moins de 2, puis moins
// de 4.
export type TonFiabilite = 'bad' | 'warn' | 'good';
export function tonFiabilite(note: number): TonFiabilite {
  return note < 2 ? 'bad' : note < 4 ? 'warn' : 'good';
}

// Ordre des offenses d'une défense : la plus fiable d'abord, les non notées à
// la fin (après un 0) ; à égalité, l'ordre de la vue Attaque (le tri est stable).
export function parFiabilite(a: { fiabilite?: number }, b: { fiabilite?: number }): number {
  return (b.fiabilite ?? -1) - (a.fiabilite ?? -1);
}

export interface DefenseVisee {
  cle: string;
  // Les monstres tels que saisis à la PREMIÈRE apparition de la défense.
  monsters: RecoCounter['monsters'];
  offenses: OffenseContre[];
}

export interface VueDefenses {
  defenses: DefenseVisee[];
  // Les decks qui ne visent aucune défense : ils n'ont pas de ligne à eux, mais
  // ne disparaissent pas de la vue — rien n'est caché en changeant de vue.
  sansDefense: number[];
}

// Exportée pour la fusion d'un import (recoFusion.ts) : un monstre de défense
// s'y reconnaît de la même façon.
//
// ⚠️ Une collaboration et sa version SW (Satoru Gojo, Werner) ont la même clé
// (`idCanoniqueCollab`) : c'est le même monstre, donc la même équipe en jeu.
export function cleMonstre(m: { com2usId: number | null; name: string }, connus?: MonstresConnus): string {
  if (m.com2usId != null) return `#${idCanoniqueCollab(m.com2usId, connus?.get(m.com2usId)?.jumeauCollab)}`;
  const nom = m.name.trim().toLowerCase();
  return nom ? `@${nom}` : '';
}

// Les monstres connus des données chargées, par `com2usId` : leur leader skill
// et leur élément servent à reconnaître le chef, leur jumeau de collaboration à
// reconnaître le monstre. Un paramètre, pas un import : le calcul reste pur, et
// l'écran passe l'index qu'il a déjà (`monsterByCom2us`).
export type MonstresConnus = ReadonlyMap<number, Pick<Monster, 'element' | 'leaderSkill' | 'jumeauCollab'>>;

// Une leader skill est-elle active EN SIÈGE (contenu de guilde) pour cette
// équipe ? Même règle de portée que `siegeLeadFor` (speed.ts) pour la vitesse,
// étendue à toute leader skill, quelle que soit sa stat :
//  - General ou Guild : active ;
//  - Element : active si au moins un monstre de l'équipe est de cet élément ;
//  - Arena, Dungeon, ou pas de leader skill : inactive.
// ⚠️ Dans les données SWARFARM, un lead d'élément porte toujours l'élément de
// son monstre : le chef le remplit seul. La condition reste écrite pour un
// lead qui ne le ferait pas.
export function leadActifEnSiege(lead: LeaderSkill | null | undefined, elements: readonly ElementKey[]): boolean {
  if (!lead) return false;
  if (lead.area === 'General' || lead.area === 'Guild') return true;
  if (lead.area === 'Element') return lead.element != null && elements.includes(lead.element);
  return false;
}

// Le premier monstre compte-t-il pour chef ? Oui si son lead est actif en
// siège ; non s'il n'en a pas, ou si l'emplacement est vide.
//
// ⚠️ **Lead inconnu = chef** : un monstre saisi à la main (`com2usId` null, un
// nom) ou absent des données chargées. Le compter pour chef est le choix sûr :
// la clé distingue alors autant d'équipes que si son lead était actif, jamais
// moins — on ne regroupe ni ne fusionne deux équipes qui pourraient différer
// en jeu. Au pire, une même équipe apparaît deux fois. Même prudence pour un
// lead d'élément qu'un allié inconnu pourrait remplir.
function premierEstChef(monsters: readonly { com2usId: number | null; name: string }[], connus: MonstresConnus): boolean {
  const premier = monsters[0];
  if (!premier || cleMonstre(premier) === '') return false;
  const ficheDe = (m: { com2usId: number | null }) => (m.com2usId != null ? connus.get(m.com2usId) : undefined);
  const fiche = ficheDe(premier);
  if (!fiche) return true;
  const presents = monsters.filter((m) => cleMonstre(m) !== '');
  const elements = presents.flatMap((m) => {
    const e = ficheDe(m)?.element;
    return e ? [e] : [];
  });
  if (leadActifEnSiege(fiche.leaderSkill, elements)) return true;
  return fiche.leaderSkill?.area === 'Element' && presents.some((m) => !ficheDe(m));
}

// L'identité d'une ÉQUIPE de trois monstres — une défense visée, ou l'équipe
// d'un deck (recoFusion.ts) : une seule clé pour les deux.
//  - avec chef : `chef|les deux autres triés` ;
//  - sans chef : `|les trois triés`.
// Solveig-Adriana-Odin et Solveig-Odin-Adriana : même équipe (chef Solveig) ;
// Odin-Adriana-Solveig en est une autre (chef Odin) ; Kinki-Windy-Lulu et
// Windy-Lulu-Kinki : même équipe, aucun des deux premiers n'ayant de lead
// actif en siège.
// `null` : équipe entièrement vide (trois emplacements non remplis) — elle ne
// nomme rien.
export function cleEquipe(
  monsters: readonly { com2usId: number | null; name: string }[],
  connus: MonstresConnus,
): string | null {
  const cles = monsters.map((m) => cleMonstre(m, connus));
  if (cles.every((c) => c === '')) return null;
  const tries = (l: string[]) => l.filter(Boolean).sort().join('+');
  if (premierEstChef(monsters, connus)) {
    const [chef, ...autres] = cles;
    return `${chef}|${tries(autres)}`;
  }
  return `|${tries(cles)}`;
}

// `connus` : les monstres des données chargées, pour reconnaître le chef.
// `garder` : filtre d'une recherche en cours (deck, défense) — `counterIndex`
// vaut `null` pour un deck sans défense visée. Absent : tout est gardé.
export function vueDefenses(
  reco: Reco,
  connus: MonstresConnus,
  garder?: (deckIndex: number, counterIndex: number | null) => boolean,
): VueDefenses {
  const parCle = new Map<string, DefenseVisee>();
  const sansDefense: number[] = [];

  reco.decks.forEach((deck, deckIndex) => {
    let viseUneDefense = false;
    deck.counters.forEach((counter, counterIndex) => {
      const cle = cleEquipe(counter.monsters, connus);
      if (cle == null) return;
      viseUneDefense = true;
      if (garder && !garder(deckIndex, counterIndex)) return;
      let defense = parCle.get(cle);
      if (!defense) {
        defense = { cle, monsters: counter.monsters, offenses: [] };
        parCle.set(cle, defense);
      }
      // Un deck qui vise deux fois la même défense n'y figure qu'une fois : la
      // première saisie, et sa précision.
      if (!defense.offenses.some((o) => o.deckIndex === deckIndex)) {
        const fiabilite = fiabiliteValide(counter.fiabilite);
        defense.offenses.push({ deckIndex, counterIndex, note: counter.note, ...(fiabilite !== undefined ? { fiabilite } : {}) });
      }
    });
    if (!viseUneDefense && (!garder || garder(deckIndex, null))) sansDefense.push(deckIndex);
  });

  // Les défenses : ordre de PREMIÈRE apparition (deck puis défense), celui de
  // la vue Attaque, qu'on retrouve en changeant de vue — `Map` garde l'ordre
  // d'insertion. Leurs offenses : la plus fiable d'abord (`parFiabilite`).
  const defenses = [...parCle.values()];
  for (const d of defenses) d.offenses.sort(parFiabilite);
  return { defenses, sansDefense };
}

// ── Les défenses de TOUTES les recommandations affichées ─────────────────
//
// La vue Défenses de la page : chaque défense visée UNE fois, toutes
// recommandations confondues, et les offenses qui la battent, d'où qu'elles
// viennent. Même identité d'équipe que `vueDefenses` (`cleEquipe`).

// Une offense qui bat la défense : sa recommandation, son deck, et la défense
// telle que CE deck la porte (précision, fiabilité).
export interface OffenseDesRecos extends OffenseContre {
  recoId: string;
}

export interface DefenseDesRecos {
  cle: string;
  monsters: RecoCounter['monsters'];
  // Dans l'ordre des recommandations, puis de leurs decks.
  offenses: OffenseDesRecos[];
  // Combien de recommandations la visent.
  recos: number;
  // La meilleure fiabilité de ses offenses, `undefined` si aucune n'est notée.
  meilleure?: number;
}

export interface DefensesDesRecos {
  defenses: DefenseDesRecos[];
  // Les decks qui ne visent aucune défense : ils restent atteignables dans la
  // vue Défenses (rien n'est caché en changeant de vue).
  sansDefense: { recoId: string; deckIndex: number }[];
}

// `garder` : filtre d'une recherche en cours, comme pour `vueDefenses`
// (`counterIndex` vaut `null` pour un deck sans défense visée).
//
// ⚠️ **Les plus jouées d'abord** : la défense que le plus d'offenses battent
// est celle qu'on rencontre le plus ; à égalité, l'ordre de première
// apparition (recommandation, deck, défense) — le tri est stable.
export function defensesDesRecos(
  recos: readonly Reco[],
  connus: MonstresConnus,
  garder?: (reco: Reco, deckIndex: number, counterIndex: number | null) => boolean,
): DefensesDesRecos {
  const parCle = new Map<string, DefenseDesRecos & { idsRecos: Set<string> }>();
  const sansDefense: DefensesDesRecos['sansDefense'] = [];
  for (const reco of recos) {
    const vue = vueDefenses(reco, connus, garder ? (di, ci) => garder(reco, di, ci) : undefined);
    for (const d of vue.defenses) {
      let defense = parCle.get(d.cle);
      if (!defense) {
        defense = { cle: d.cle, monsters: d.monsters, offenses: [], recos: 0, idsRecos: new Set() };
        parCle.set(d.cle, defense);
      }
      // `vueDefenses` range ses offenses par fiabilité ; ici, l'ordre des decks
      // de la recommandation, celui de son auteur.
      const offenses = [...d.offenses].sort((a, b) => a.deckIndex - b.deckIndex);
      defense.offenses.push(...offenses.map((o) => ({ ...o, recoId: reco.id })));
      defense.idsRecos.add(reco.id);
    }
    for (const deckIndex of vue.sansDefense) sansDefense.push({ recoId: reco.id, deckIndex });
  }
  const defenses = [...parCle.values()].map(({ idsRecos, ...d }) => {
    let meilleure: number | undefined;
    for (const o of d.offenses) if (o.fiabilite !== undefined && (meilleure === undefined || o.fiabilite > meilleure)) meilleure = o.fiabilite;
    return { ...d, recos: idsRecos.size, ...(meilleure !== undefined ? { meilleure } : {}) };
  });
  defenses.sort((a, b) => b.offenses.length - a.offenses.length);
  return { defenses, sansDefense };
}

// L'ordre des offenses d'une défense dans son volet.
//  - `ordre` : par recommandation (dans l'ordre de la page), puis l'ordre de
//    leurs decks — l'ordre de `defensesDesRecos` ;
//  - `fiabilite` : la plus fiable d'abord, non notées à la fin, à égalité
//    l'ordre par recommandation.
// ⚠️ `fige` : un ordre pris plus tôt (clés `recoId:deckIndex`) et TENU — noter
// un deck pendant qu'on l'édite le déplaçait sous le clic. Ce qu'il ne connaît
// pas (un deck qui se met à viser la défense) vient après, dans l'ordre demandé.
export const cleOffense = (o: { recoId: string; deckIndex: number }) => `${o.recoId}:${o.deckIndex}`;
export function ordonnerOffenses<T extends OffenseDesRecos>(
  offenses: readonly T[],
  tri: 'ordre' | 'fiabilite',
  fige?: readonly string[],
): T[] {
  const demandees = tri === 'fiabilite' ? [...offenses].sort(parFiabilite) : [...offenses];
  if (!fige) return demandees;
  const rang = new Map(fige.map((c, i) => [c, i]));
  const r = (o: T) => rang.get(cleOffense(o)) ?? fige.length;
  return demandees.map((o, i) => ({ o, i })).sort((a, b) => r(a.o) - r(b.o) || a.i - b.i).map((x) => x.o);
}
