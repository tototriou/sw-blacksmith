import { useEffect, useState } from 'react';
import type { RuneDetail } from '../types';
import { lireTravail, saveLocal, usePersistence } from './usePersistence';

// Les runes gagnées dans l'arène dimensionnelle (onglet « Runes » de la
// section), tenues par le plugin SWEX et lues par l'application de bureau
// (`parseDimensionRunes`). Conservées comme les équipes : par `saveLocal`,
// seulement si l'utilisateur a accepté de garder ses données.
export const CLE_RUNES_DIMENSION = 'swblacksmith-arene-dimension-runes-v1';

// Relu avec méfiance : une entrée qui n'est pas une rune est écartée.
function charger(): RuneDetail[] {
  try {
    const brut = JSON.parse(lireTravail(CLE_RUNES_DIMENSION) ?? '[]');
    return Array.isArray(brut)
      ? brut.filter((r): r is RuneDetail => !!r && typeof r === 'object' && typeof r.id === 'number' && !!r.main)
      : [];
  } catch {
    return [];
  }
}

export function useRunesDimension(): { runes: RuneDetail[]; remplacer: (runes: RuneDetail[]) => void } {
  const [runes, remplacer] = useState<RuneDetail[]>(charger);
  const persist = usePersistence();
  useEffect(() => {
    saveLocal(CLE_RUNES_DIMENSION, JSON.stringify(runes));
  }, [runes, persist]);
  return { runes, remplacer };
}
