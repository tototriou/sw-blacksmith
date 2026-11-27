// LES MONSTRES DES OBJECTIFS : les listes du joueur (objectifsCompte.ts,
// `ObjectifsMonstres`) face à sa box 6★. Voir
// docs/02-app/compte/feat-objectifs.md § Monstres.

import type { Monster } from '../types';
import { libelleCollab } from './collabPairs';
import { idCanoniqueCollab } from './monsterForms';
import { ListeMonstres, ObjectifsMonstres, scoreObjectif } from './objectifsCompte';

// L'identifiant qu'une liste retient pour un monstre : celui que partagent les
// deux faces d'une collaboration (`idCanoniqueCollab`). Choisir Angela ou Pure
// Vanilla Cookie (Vent) inscrit le même monstre.
export function idObjectifMonstre(m: Pick<Monster, 'com2usId' | 'jumeauCollab'>): number | null {
  return m.com2usId != null ? idCanoniqueCollab(m.com2usId, m.jumeauCollab) : null;
}

// Le jumeau de collaboration d'un monstre, s'il est connu.
export function jumeauConnu(m: Monster, parId: ReadonlyMap<number, Monster>): Monster | null {
  return m.jumeauCollab != null ? (parId.get(m.jumeauCollab) ?? null) : null;
}

// Le nom d'un monstre des listes : les deux noms d'une collaboration, comme sa
// carte dans la box (« Pure Vanilla Cookie, Angela »).
export function nomObjectifMonstre(m: Monster, parId: ReadonlyMap<number, Monster>): string {
  const jumeau = jumeauConnu(m, parId);
  return jumeau ? libelleCollab(m.name, jumeau.name) : m.name;
}

// ⚠️ **Le même monstre, quelle que soit sa forme ou sa face** : même nom et
// même élément (la règle de `formesJouables`, monsterForms.ts : on choisit la
// 2A, la box peut porter l'éveillée simple), ou les deux faces d'une
// collaboration — Angela et Pure Vanilla Cookie (Vent) sont un seul monstre,
// partout dans l'app. Les clés d'un monstre : son nom et celui de son jumeau,
// chacun avec l'élément, et l'identifiant commun de la paire.
function clesMonstre(m: Monster, parId: ReadonlyMap<number, Monster>): string[] {
  const cles = [`${m.name}|${m.element}`];
  const jumeau = jumeauConnu(m, parId);
  if (jumeau) cles.push(`${jumeau.name}|${jumeau.element}`);
  const id = idObjectifMonstre(m);
  if (id != null) cles.push(`#${id}`);
  return cles;
}

export interface LigneMonstre {
  id: number;
  // Absent des données de monstres chargées : affiché par son identifiant.
  monstre: Monster | null;
  // Les exemplaires 6★ de la box.
  possedes: number;
  // « À monter » seulement : les exemplaires 6★ visés.
  vise?: number;
}

export interface MesureMonstres {
  listes: Record<ListeMonstres, LigneMonstre[]>;
  // Le score de « à monter », comme tous les scores (`scoreObjectif`) : par
  // monstre, `min(possédés, visés)`, rapport des totaux ; au-delà de 100 %
  // seulement quand tous sont atteints. Null si rien n'est visé.
  score: number | null;
}

export function mesurerMonstres(
  objectifs: ObjectifsMonstres,
  box6: readonly Monster[],
  parId: ReadonlyMap<number, Monster>
): MesureMonstres {
  const clesBox = box6.map((b) => new Set(clesMonstre(b, parId)));
  const ligne = (id: number, vise?: number): LigneMonstre => {
    const monstre = parId.get(id) ?? null;
    const cles = monstre ? clesMonstre(monstre, parId) : [];
    const possedes = clesBox.filter((c) => cles.some((k) => c.has(k))).length;
    return { id, monstre, possedes, ...(vise !== undefined ? { vise } : {}) };
  };
  // ⚠️ Une liste écrite à la main (ou d'avant cette règle) peut porter les deux
  // faces d'une collaboration : elles ne font qu'une ligne, la première.
  const sansDoublon = <T>(liste: readonly T[], id: (x: T) => number): T[] => {
    const vus = new Set<number>();
    return liste.filter((x) => {
      const m = parId.get(id(x));
      const canon = (m && idObjectifMonstre(m)) ?? id(x);
      if (vus.has(canon)) return false;
      vus.add(canon);
      return true;
    });
  };
  const aMonter = sansDoublon(objectifs.aMonter, (m) => m.monstre).map((m) => ligne(m.monstre, m.exemplaires));
  let vise = 0;
  let compte = 0;
  let surplus = 0;
  for (const l of aMonter) {
    const v = l.vise ?? 0;
    vise += v;
    compte += Math.min(l.possedes, v);
    surplus += Math.max(0, l.possedes - v);
  }
  return {
    listes: {
      aMonter,
      aGarder: sansDoublon(objectifs.aGarder, (id) => id).map((id) => ligne(id)),
      aSniper: sansDoublon(objectifs.aSniper, (id) => id).map((id) => ligne(id)),
    },
    score: scoreObjectif(compte, vise, surplus),
  };
}
