// « Modifié » : les decks d'une recommandation liée à un salon Discord qui
// diffèrent de la dernière version reçue — ce que j'ai changé ou ajouté et
// qui n'est pas encore publié. Calcul pur ;
// docs/02-app/siege/feat-recommandations/interactions.md, « Modifiés ».
//
// ⚠️ **Calculé, jamais stocké** : la même comparaison que l'état « modifiée »
// d'une recommandation (`estModifiee`, recoDiscord.ts), deck par deck, sous la
// forme normalisée de l'export (`empreinteDeck`). Publier, c'est poser une
// nouvelle version de référence : le tag part de lui-même.
//
// Un deck est modifié quand aucun deck de la version reçue n'a la même
// empreinte — l'ordre ne compte pas, deux decks identiques comptent deux fois.
// Un deck sans monstre n'est jamais publié : jamais modifié.
// Une recommandation de l'appareil (sans salon) n'a pas de version de
// référence : rien n'y est « modifié ».

import type { Reco } from '../types';
import { empreinteDeck } from './recoShare';
import type { DeckHit, RecoHit } from './recoSearch';

// La clé collante du filtre de la page Recommandations : la fenêtre d'ajout
// des statistiques l'allume avant d'y mener (AjoutOffenseReco.tsx).
export const CLE_FILTRE_MODIFIES = 'recos.modifies';

const VIDE: ReadonlySet<number> = new Set();

// ⚠️ **Une fois par version de la recommandation** : la page, la vue Défenses
// et chaque carte le demandent, et une empreinte encode tout le deck. Une
// recommandation modifiée est un NOUVEL objet (useSiegeRecos.ts) : le cache par
// identité ne sert jamais un résultat périmé.
const cache = new WeakMap<Reco, ReadonlySet<number>>();

// Les index des decks modifiés d'une recommandation.
export function decksModifies(reco: Reco): ReadonlySet<number> {
  const deja = cache.get(reco);
  if (deja) return deja;
  const res = calculer(reco);
  cache.set(reco, res);
  return res;
}

function calculer(reco: Reco): ReadonlySet<number> {
  const base = reco.lien?.base.reco;
  if (!base) return VIDE;
  const restants = new Map<string, number>();
  for (const d of base.decks) {
    if (!d.slots.some((s) => s.com2usId != null)) continue;
    const e = empreinteDeck(d);
    restants.set(e, (restants.get(e) ?? 0) + 1);
  }
  const modifies = new Set<number>();
  reco.decks.forEach((d, i) => {
    if (!d.slots.some((s) => s.com2usId != null)) return;
    const e = empreinteDeck(d);
    const n = restants.get(e) ?? 0;
    if (n > 0) restants.set(e, n - 1);
    else modifies.add(i);
  });
  return modifies;
}

// Les decks modifiés de ces recommandations, au format d'une recherche : la
// page s'en sert comme d'un résultat. Toutes leurs défenses passent (vue
// Défenses), aucune n'est surlignée.
export function hitsModifies(recos: readonly Reco[]): RecoHit[] {
  const hits: RecoHit[] = [];
  for (const reco of recos) {
    const decks: DeckHit[] = [...decksModifies(reco)].map((deckIndex) => ({
      deckIndex,
      slots: [],
      counters: reco.decks[deckIndex].counters.map((_, ci) => ci),
      filtre: true as const,
    }));
    if (decks.length) hits.push({ reco, decks, enOffense: true, enDefense: decks.some((d) => d.counters.length > 0) });
  }
  return hits;
}

// Combien de decks modifiés.
export const compteModifies = (recos: readonly Reco[]): number => recos.reduce((n, r) => n + decksModifies(r).size, 0);

// Une recherche ET le filtre : les decks retenus par les deux, avec les
// positions de la recherche (son surlignage). `null` : ni l'un ni l'autre.
export function croiserHits(recherche: RecoHit[] | null, filtre: RecoHit[] | null): RecoHit[] | null {
  if (!recherche || !filtre) return recherche ?? filtre;
  const parReco = new Map(filtre.map((h) => [h.reco.id, new Set(h.decks.map((d) => d.deckIndex))]));
  return recherche.flatMap((h) => {
    const gardes = parReco.get(h.reco.id);
    const decks = gardes ? h.decks.filter((d) => gardes.has(d.deckIndex)) : [];
    return decks.length ? [{ ...h, decks }] : [];
  });
}
