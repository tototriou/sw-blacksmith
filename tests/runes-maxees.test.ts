// « Simuler +15 et max meules/gemmes » (réglage avancé de l'Optimizer,
// désactivé par défaut) : la recherche porte sur l'inventaire maxé —
// principale d'une rune 6★ à +15, meules et gemmes déjà posées à leur
// maximum légendaire. Ici : la fonction pure (`runeMaxee`), le producteur du
// pool (`poolDeRecherche`) partagé par l'écran et le CLI (`resolvePool`), la
// recette et la clé du cache de résolution. Le rendu du détail d'une rune
// simulée : rendu/rune-simulee.test.tsx ; l'interrupteur et le non-effet sur
// un résultat affiché, aux deux formats : rendu/optimizer-non-relance.test.ts.

import type { RuneDetail } from '../src/types';
import { poolDeRecherche, runeMaxee } from '../src/lib/runesMaxees';
import { MAINSTAT_MAX } from '../src/lib/effects';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { signatureArtefacts } from '../src/lib/artifactQueue';
import { resolvePool } from '../scripts/lib/recipeToSearchParams';
import type { LoadedMonster } from '../scripts/lib/loadMonster';
import { egal, ok, titre } from './outils';
import { fr } from '../src/i18n/fr';

// Une rune 6★ légendaire à +12 : VIT gemmée 7 meulée +3 (le cas de la
// demande), ATQ % meulée +5, PV % vierge, Tx critiq. 6.
const RUNE: RuneDetail = {
  id: 11, slot: 2, set: 'swift', rank: 6, rarity: 5, level: 12,
  main: { code: 4, value: 47 },
  subs: [
    { code: 8, value: 10, grind: 3, enchant: true },
    { code: 4, value: 12, grind: 5 },
    { code: 2, value: 6 },
    { code: 9, value: 6 },
  ],
};

function recette(simuler?: boolean) {
  return buildOptimizerRecipe({
    monsterCom2usId: 13413, monsterName: 'Lushen (test)', requirement: { sets: [], minStats: {} }, objective: 'efficience',
    damageSetup: DEFAULT_DAMAGE_SETUP, metric: 'eff', slotFilterPreset: 'bas', exhaustiveSearch: false,
    ...(simuler === undefined ? {} : { simulerRunesMaxees: simuler }),
    excludeUsedRunes: false, excludeUsedScope: 'rta', excludedSelectors: [], ignoreArtifacts: false,
    artifactMainByKind: { element: 'libre', archetype: 'libre' },
  });
}

export function testRunesMaxees() {
  titre('« Simuler +15 et max meules/gemmes » — la rune simulée');
  {
    const r = runeMaxee(RUNE);
    egal([r.level, r.main.value], [15, MAINSTAT_MAX[4]], '+12 → +15 : niveau 15, principale ATQ % à sa valeur à +15 (63)');
    egal(r.subs[0], { code: 8, value: 15, grind: 5, enchant: true }, 'VIT gemmée 7 +3 → gemme légendaire 10, meule légendaire +5 (le cas de la demande)');
    egal(r.subs[1], { code: 4, value: 17, grind: 10 }, 'ATQ % meulée +5 → meule légendaire +10, base inchangée');
    ok(r.subs[2] === RUNE.subs[2] && r.subs[3] === RUNE.subs[3], 'ligne sans meule ni gemme : inchangée, rien n’est posé de nouveau');
    egal([r.id, r.slot, r.set, r.rank, r.rarity], [RUNE.id, RUNE.slot, RUNE.set, RUNE.rank, RUNE.rarity], 'identité gardée : même identifiant, emplacement, set');
    egal(r.avantSimulation, { level: 12, main: 47, subs: [{ value: 10, grind: 3 }, { value: 12, grind: 5 }, { value: 6, grind: 0 }, { value: 6, grind: 0 }] },
      'les valeurs réelles voyagent avec la copie (`avantSimulation`)');
    egal([RUNE.level, RUNE.main.value, RUNE.subs[0].value, RUNE.avantSimulation], [12, 47, 10, undefined], 'la rune de l’inventaire n’est jamais modifiée');
  }
  {
    const antique: RuneDetail = { ...RUNE, rank: 16, level: 15, main: { code: 4, value: 63 } };
    const r = runeMaxee(antique);
    egal([r.subs[0].value, r.subs[0].grind, r.subs[1].value, r.subs[1].grind], [17, 6, 19, 12], 'rune antique : tables antiques (gemme VIT 11 +6, meule ATQ % +12)');
    egal([r.level, r.main.value], [15, 63], 'antique déjà à +15 : principale et niveau inchangés');
  }
  {
    const maxee: RuneDetail = { ...RUNE, level: 15, main: { code: 4, value: 63 },
      subs: [{ code: 8, value: 15, grind: 5, enchant: true }, { code: 4, value: 17, grind: 10 }, { code: 9, value: 6 }] };
    ok(runeMaxee(maxee) === maxee, 'rune déjà maxée : la même référence, sans `avantSimulation`');
    const vierge: RuneDetail = { ...RUNE, level: 15, main: { code: 4, value: 63 }, subs: [{ code: 9, value: 6 }, { code: 2, value: 8 }] };
    ok(runeMaxee(vierge) === vierge, 'rune +15 sans meule ni gemme : inchangée');
    const auDela: RuneDetail = { ...maxee, subs: [{ code: 2, value: 16, grind: 0, enchant: true }] };
    egal(runeMaxee(auDela).subs[0].value, 16, 'jamais à la baisse : une base au-dessus de la table reste où elle est');
    const gemmeTc: RuneDetail = { ...maxee, subs: [{ code: 9, value: 5, enchant: true }] };
    ok(runeMaxee(gemmeTc) === gemmeTc, 'stat sans table de gemme (Tx critiq.) : inchangée');
  }
  {
    const cinq: RuneDetail = { ...RUNE, rank: 5, level: 12, main: { code: 4, value: 40 } };
    const r = runeMaxee(cinq);
    egal([r.level, r.main.value, r.subs[0].value], [12, 40, 15], 'rune 5★ : principale et niveau inchangés (aucune table par étoile), meule et gemme maxées');
  }

  titre('« Simuler +15 et max meules/gemmes » — le pool de la recherche, écran et CLI');
  {
    const pool = [RUNE, { ...RUNE, id: 12, level: 15, main: { code: 4, value: 63 }, subs: [{ code: 9, value: 6 }] }];
    ok(poolDeRecherche(pool, false) === pool, 'désactivé : le pool tel quel, même référence');
    const simule = poolDeRecherche(pool, true);
    egal(simule.map((r) => [r.id, r.main.value, r.avantSimulation != null]), [[11, 63, true], [12, 63, false]], 'activé : chaque rune maxée, ordre et identifiants gardés');
    const loaded = { allRunes: pool, com2usId: 13413, unitId: 1 } as unknown as LoadedMonster;
    ok(resolvePool(recette(), loaded) === pool, 'CLI, recette sans le champ : le pool réel (repli `?? false`, comme l’écran)');
    egal(resolvePool(recette(true), loaded), simule, 'CLI, champ activé : le pool du même producteur que l’écran');
  }

  titre('« Simuler +15 et max meules/gemmes » — gardé dans la recette');
  {
    const allerRetour = (v?: boolean) => parseOptimizerRecipe(JSON.stringify(recette(v)), fr).recipe;
    egal([allerRetour(true)?.simulerRunesMaxees, allerRetour(false)?.simulerRunesMaxees], [true, false], 'activé et désactivé : relus tels quels');
    const ancienne = allerRetour(undefined);
    egal([ancienne != null, ancienne?.simulerRunesMaxees], [true, undefined], 'recette exportée avant ce champ : acceptée, champ absent');
    const lu = parseOptimizerRecipe(JSON.stringify({ ...recette(true), simulerRunesMaxees: 'oui' }), fr);
    ok(lu.recipe === null && /simulerRunesMaxees/.test(lu.error ?? ''), `mal typé : refusé avec son chemin (${lu.error})`);
  }

  titre('« Simuler +15 et max meules/gemmes » — la clé du cache de résolution');
  {
    const base = { monstreCom2usId: 1, damageSetup: DEFAULT_DAMAGE_SETUP, regimeEquipement: 'aucun', ignoreArtifacts: false, principaleParSorte: {},
      lignesVerrouillees: [], relique: null, nbArtefacts: 0, empreinteRelique: null, requirement: { minStats: {}, maxStats: {} },
      artefactsReserves: [], piecesFigees: [], importDuCompte: 0, empreinteSpeedTune: null };
    const sans = signatureArtefacts({ ...base, runesMaxees: false });
    ok(signatureArtefacts({ ...base, runesMaxees: true }) !== sans, 'activé : la signature change, le cache indexé par identifiants de runes se vide');
    ok(!sans.includes('runes-maxees'), 'désactivé : composant omis, la signature d’avant ce réglage');
  }
}
