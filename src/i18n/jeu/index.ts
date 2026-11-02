// Lire le vocabulaire du jeu dans la langue affichée. Le lexique se passe en
// paramètre (`useTraduction().jeu`) : ces fonctions sont pures.
//
// ⚠️ Une clé inconnue (un set, un effet arrivé avec une mise à jour des
// données) rend la clé elle-même — le nom SWARFARM, en anglais — plutôt
// qu'un vide : on lit toujours quelque chose, et le test du lexique la signale.

import type { LexiqueJeu, Terme } from './fr';

export type { LexiqueJeu, Terme } from './fr';

const terme = (t: Terme | undefined, court: boolean) => (t ? (court ? t.court ?? t.long : t.long) : undefined);

export function nomSet(j: LexiqueJeu, cle: string): string {
  return (j.sets as Record<string, string>)[cle] ?? cle;
}

// Le nom d'un effet de compétence, d'après son nom SWARFARM.
export function nomEffet(j: LexiqueJeu, nom: string, court = false): string {
  return terme(j.effets[nom], court) ?? nom;
}

export function nomGrade(j: LexiqueJeu, rarete: number, court = false): string {
  return terme(j.grades[rarete], court) ?? '';
}

export function nomElement(j: LexiqueJeu, element: string | null | undefined): string {
  return (j.elements as Record<string, string>)[element ?? 'unknown'] ?? '—';
}

export function nomArchetype(j: LexiqueJeu, archetype: string | null | undefined): string {
  return (j.archetypes as Record<string, string>)[archetype ?? ''] ?? '—';
}

export function nomZoneLead(j: LexiqueJeu, zone: string): string {
  return (j.zonesLead as Record<string, string>)[zone] ?? zone;
}

// L'effet d'un set (« VIT +25% »), ou `undefined` pour un set sans effet propre.
export function bonusSet(j: LexiqueJeu, cle: string): string | undefined {
  return j.bonusSets[cle];
}
