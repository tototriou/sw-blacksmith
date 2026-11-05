// LA CONTRAINTE DE SPEED TUNE d'un membre, telle que la recherche la lit.
//
// Spec : docs/02-app/optimizer/feat-contrainte-speed-tune.md. Ce module est
// PUR et SANS DÉPENDANCE au speed tuning : la zone y arrive déjà calculée
// (`zoneMembre`, planSpeedTune.ts), en données seules. Il voyage tel quel
// jusqu'aux Workers de résolution — aucune fonction, aucune référence aux
// kits.
//
// ⚠️ **La zone ne s'élague jamais par une borne d'artéfact.** Les runes ne
// voient que l'enveloppe de VIT de fiche (`exigenceSousSpeedTune`), qui
// élargit ; le couple exact (fiche, Swift, 206) se juge sur la VRAIE paire, à
// la résolution (`lignesBorneesDuBuild`).

import type { BuildRequirement } from './runeBuildOptim';
import type { LigneBornee, LigneVerrouillee } from './artifactOptim';
import { CODE_AMPLI_VIT } from './damage';
import { activeSets } from './effects';

export interface ClasseZone {
  // Plage de 206 de la classe (bornes incluses).
  arteMin: number;
  arteMax: number;
  // Intervalles de VIT de FICHE admissibles (bornes incluses), croissants.
  intervalles: [number, number][];
}

export interface ZoneSwift {
  swift: boolean;
  classes: ClasseZone[];
}

export interface ZoneMembre {
  uid: string;
  base: number;
  // Une entrée par état de Swift calculé.
  parSwift: ZoneSwift[];
  // Faux quand aucun buff de vitesse ne peut être posé : le 206 n'agit pas.
  axeArtefact: boolean;
}

// Les sets dont dépendent les cumuls de passif estimés (`cumulsEstimes`) :
// Volonté (personnel) et Bouclier (toute l'équipe). Aucun autre set n'y entre.
export interface SetsCumuls {
  will: boolean;
  shield: boolean;
}

export interface ContrainteSpeedTune {
  version: 1;
  zone: ZoneMembre;
  // Les combinaisons Volonté × Bouclier du build qui tiennent la précondition
  // des cumuls, les autres lignes fixées (`setsAdmis`, planSpeedTune.ts).
  setsAdmis: SetsCumuls[];
}

// Le code de la ligne « Effet aug. VIT » : la seule que la contrainte borne.
export const CODE_206 = CODE_AMPLI_VIT;

// ─── Lecture de la zone ─────────────────────────────────────────────────────

// Le couple (fiche, Swift, 206) est-il dans la zone ?
export function dansZone(z: ZoneMembre, fiche: number, swift: boolean, cumul206: number): boolean {
  const s = z.parSwift.find((x) => x.swift === swift);
  if (!s) return false;
  const c = s.classes.find((x) => cumul206 >= x.arteMin && cumul206 <= x.arteMax);
  return !!c?.intervalles.some(([a, b]) => fiche >= a && fiche <= b);
}

// L'enveloppe de VIT de fiche, toutes classes et tous états de Swift : elle
// élargit, jamais ne resserre. `null` : zone vide.
export function enveloppeZone(z: ZoneMembre): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const s of z.parSwift)
    for (const c of s.classes)
      for (const [a, b] of c.intervalles) {
        if (a < min) min = a;
        if (b > max) max = b;
      }
  return Number.isFinite(min) ? { min, max } : null;
}

// Les 206 admissibles pour un build donné : les classes dont un intervalle
// contient sa fiche. Sert à restreindre la paire.
export function arteAdmissibles(z: ZoneMembre, fiche: number, swift: boolean): { min: number; max: number }[] {
  const s = z.parSwift.find((x) => x.swift === swift);
  if (!s) return [];
  return s.classes
    .filter((c) => c.intervalles.some(([a, b]) => fiche >= a && fiche <= b))
    .map((c) => ({ min: c.arteMin, max: c.arteMax }));
}

// ─── Ce que la contrainte fait des critères ─────────────────────────────────

// Les conditions de la recherche de runes sous la contrainte : la VIT minimum
// du membre est REMPLACÉE par le bas de l'enveloppe (le rattachement possède
// ce champ), la VIT maximum resserrée par son haut. `null` : zone vide, la
// recherche ne part pas.
//
// ⚠️ L'enveloppe est une VIT de FICHE : `requirement` juge le total de
// `computeStats`, la même valeur. La VIT ne dépend que des runes (ni
// principale d'artéfact ni de relique ne porte la VIT) : le filtre est exact
// sur l'enveloppe, la zone elle-même se juge à la résolution.
export function exigenceSousSpeedTune(requirement: BuildRequirement, c: ContrainteSpeedTune): BuildRequirement | null {
  const env = enveloppeZone(c.zone);
  if (!env || c.setsAdmis.length === 0) return null;
  const maxUtilisateur = requirement.maxStats?.spd;
  const max = maxUtilisateur != null && maxUtilisateur > 0 ? Math.min(maxUtilisateur, env.max) : env.max;
  if (max < env.min) return null;
  return {
    ...requirement,
    minStats: { ...requirement.minStats, spd: env.min },
    maxStats: { ...requirement.maxStats, spd: max },
  };
}

// Les verrous de sous-propriétés sous la contrainte : celui du 206, que le
// rattachement possède, disparaît.
export function lignesSousSpeedTune(lignes: LigneVerrouillee[], c: ContrainteSpeedTune | null): LigneVerrouillee[] {
  return c ? lignes.filter((l) => l.code !== CODE_206) : lignes;
}

// ─── La paire d'un build ────────────────────────────────────────────────────

// Le build tient-il la précondition des cumuls par ses sets ?
export function setsTenus(c: ContrainteSpeedTune, setsActifs: readonly string[]): boolean {
  const will = setsActifs.includes('will');
  const shield = setsActifs.includes('shield');
  return c.setsAdmis.some((s) => s.will === will && s.shield === shield);
}

// Les bornes de 206 que la paire d'UN build doit tenir : les classes de la
// zone admissibles pour sa VIT de fiche et son état de Swift (Rapidité
// ACTIVÉE par ses runes, jamais un drapeau à côté). Aucune plage (fiche hors
// zone, sets qui cassent les cumuls) : aucune paire ne convient, le build est
// rejeté. `memo` : un même ensemble de plages rend le même objet, pour que
// les mémoires de la file indexées par identité restent valides d'un build à
// l'autre.
export function lignesBorneesDuBuild(
  c: ContrainteSpeedTune,
  ficheSpd: number,
  setsDesRunes: readonly string[],
  memo?: Map<string, LigneBornee[]>
): LigneBornee[] {
  const actifs = activeSets([...setsDesRunes]);
  const plages = setsTenus(c, actifs) ? arteAdmissibles(c.zone, ficheSpd, actifs.includes('swift')) : [];
  const cle = plages.map((p) => `${p.min}-${p.max}`).join(',');
  const connue = memo?.get(cle);
  if (connue) return connue;
  const out: LigneBornee[] = [{ code: CODE_206, plages }];
  if (memo) {
    if (memo.size >= BORNE_MEMO_BORNES) memo.clear();
    memo.set(cle, out);
  }
  return out;
}

// Au plus tant d'ensembles de plages gardés : un par combinaison de classes
// admissibles rencontrée, une poignée sur une file.
export const BORNE_MEMO_BORNES = 64;

// L'empreinte de la contrainte : sa forme canonique, pour la signature de
// résolution et le contexte photographié. Deux contraintes de même empreinte
// jugent les mêmes builds.
export function empreinteSpeedTune(c: ContrainteSpeedTune | null): string | null {
  return c ? JSON.stringify([c.version, c.zone, c.setsAdmis]) : null;
}

// ─── Lecture validée ────────────────────────────────────────────────────────

const entierNonNegatif = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

// Une contrainte lue d'un fichier (la recette de recherche) : sa forme seule,
// intervalles croissants et bornés compris. Ce qu'elle dit n'est pas
// recalculé : elle a été produite par `contrainteDuMembre`.
export function contrainteValide(v: unknown): v is ContrainteSpeedTune {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  if (c.version !== 1 || typeof c.zone !== 'object' || c.zone === null || !Array.isArray(c.setsAdmis)) return false;
  if (!c.setsAdmis.every((x) => typeof x === 'object' && x !== null
    && typeof (x as SetsCumuls).will === 'boolean' && typeof (x as SetsCumuls).shield === 'boolean')) return false;
  const z = c.zone as Record<string, unknown>;
  if (typeof z.uid !== 'string' || !entierNonNegatif(z.base) || typeof z.axeArtefact !== 'boolean' || !Array.isArray(z.parSwift)) return false;
  return z.parSwift.every((ps) => {
    if (typeof ps !== 'object' || ps === null) return false;
    const { swift, classes } = ps as Record<string, unknown>;
    return typeof swift === 'boolean' && Array.isArray(classes) && classes.every((k) => {
      if (typeof k !== 'object' || k === null) return false;
      const { arteMin, arteMax, intervalles } = k as Record<string, unknown>;
      return entierNonNegatif(arteMin) && entierNonNegatif(arteMax) && arteMin <= arteMax && Array.isArray(intervalles)
        && intervalles.every((i) => Array.isArray(i) && i.length === 2 && entierNonNegatif(i[0]) && entierNonNegatif(i[1]) && i[0] <= i[1]);
    });
  });
}
