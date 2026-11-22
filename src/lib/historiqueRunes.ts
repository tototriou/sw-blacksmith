// L'historique du compte, côté page : un état de l'archive du plugin SWEX
// (bureau/swexHistorique.ts) ramené aux runes que la Comparaison sait tracer
// (docs/02-app/compte/feat-runes/comparaison.md, « Historique »).

import type { RuneDetail } from '../types';
import { runeToDetail } from './importAccount';

// Les runes BRUTES d'un état (format de l'export : `rune_id`, `sec_eff`…) en
// runes de l'app. Sans marqueurs : ils ne sont pas archivés, et la
// Comparaison ne s'en sert pas. Une entrée qui n'est pas une rune est sautée.
export function runesDeLEtat(brutes: unknown[]): RuneDetail[] {
  const vide = new Map<number, number>();
  return brutes
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && Number((r as { rune_id?: unknown }).rune_id) > 0)
    .map((r) => runeToDetail(r, vide));
}
