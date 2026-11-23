// La simulation des runes maxées (réglages avancés de l'Optimizer, désactivés
// par défaut) : « Simuler +15 » (principale d'une rune 6★ à +15), « Simuler
// max meules/gemmes » (runes normales) et « … antiques » (runes antiques),
// chacune au grade choisi, héroïque ou légendaire, sans jamais descendre.
// Ici : la fonction pure (`runeMaxee`), le producteur du pool
// (`poolDeRecherche`) partagé par l'écran et le CLI (`resolvePool`), la
// recette (et l'ancien interrupteur unique), la session et la clé du cache
// de résolution. Le rendu du détail d'une rune simulée :
// rendu/rune-simulee.test.tsx ; les interrupteurs et le non-effet sur un
// résultat affiché, aux deux formats : rendu/optimizer-non-relance.test.ts et
// rendu/optimizer-ecran-preuves.ts.

import type { RuneDetail } from '../src/types';
import {
  SIMULATION_RUNES_AUCUNE, empreinteSimulation, poolDeRecherche, runeMaxee, simulationDepuisAncienReglage,
  type GradeMeules, type SimulationRunes,
} from '../src/lib/runesMaxees';
import { MAINSTAT_MAX } from '../src/lib/effects';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { signatureArtefacts } from '../src/lib/artifactQueue';
import { restaurerOptimizer } from '../src/lib/sessionOptimizer';
import type { OptimizerState } from '../src/hooks/useOptimizerState';
import { resolvePool } from '../scripts/lib/recipeToSearchParams';
import type { LoadedMonster } from '../scripts/lib/loadMonster';
import { egal, ok, titre } from './outils';
import { fr } from '../src/i18n/fr';

// Une rune 6★ légendaire à +12 : VIT gemmée 7 meulée +3 (le cas de la
// demande), ATQ % meulée +5, PV % jamais meulée, Tx critiq. 6 (non meulable).
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
const ANTIQUE: RuneDetail = { ...RUNE, id: 21, rank: 16, level: 15, main: { code: 4, value: 63 } };

const TOUT = simulationDepuisAncienReglage(true);
function sim(p: { plus15?: boolean; meules?: GradeMeules; antiques?: GradeMeules }): SimulationRunes {
  return {
    plus15: p.plus15 ?? false,
    meules: { actif: p.meules != null, grade: p.meules ?? 'legend' },
    meulesAntiques: { actif: p.antiques != null, grade: p.antiques ?? 'legend' },
  };
}

function recette(extra: Record<string, unknown> = {}) {
  return {
    ...buildOptimizerRecipe({
      monsterCom2usId: 13413, monsterName: 'Lushen (test)', requirement: { sets: [], minStats: {} }, objective: 'efficience',
      damageSetup: DEFAULT_DAMAGE_SETUP, metric: 'eff', slotFilterPreset: 'bas',
      excludeUsedRunes: false, excludeUsedScope: 'rta', excludedSelectors: [], ignoreArtifacts: false,
      artifactMainByKind: { element: 'libre', archetype: 'libre' },
    }),
    ...extra,
  };
}

export function testRunesMaxees() {
  titre('Simulation des runes maxées — tout activé, en légendaire (l’ancien réglage unique)');
  {
    const r = runeMaxee(RUNE, TOUT);
    egal([r.level, r.main.value], [15, MAINSTAT_MAX[4]], '+12 → +15 : niveau 15, principale ATQ % à sa valeur à +15 (63)');
    egal(r.subs[0], { code: 8, value: 15, grind: 5, enchant: true }, 'VIT gemmée 7 +3 → gemme légendaire 10, meule légendaire +5 (le cas de la demande)');
    egal(r.subs[1], { code: 4, value: 17, grind: 10 }, 'ATQ % meulée +5 → meule légendaire +10, base inchangée');
    egal(r.subs[2], { code: 2, value: 16, grind: 10 }, 'PV % jamais meulée : meulée quand même, meule légendaire +10 (toute ligne meulable)');
    ok(r.subs[3] === RUNE.subs[3], 'Tx critiq. (non meulable) : inchangée');
    ok(r.subs.every((s, i) => !!s.enchant === !!RUNE.subs[i].enchant), 'aucune gemme posée sur une ligne qui n’en a pas');
    egal([r.id, r.slot, r.set, r.rank, r.rarity], [RUNE.id, RUNE.slot, RUNE.set, RUNE.rank, RUNE.rarity], 'identité gardée : même identifiant, emplacement, set');
    egal(r.avantSimulation, { level: 12, main: 47, subs: [{ value: 10, grind: 3 }, { value: 12, grind: 5 }, { value: 6, grind: 0 }, { value: 6, grind: 0 }] },
      'les valeurs réelles voyagent avec la copie (`avantSimulation`)');
    egal([RUNE.level, RUNE.main.value, RUNE.subs[0].value, RUNE.avantSimulation], [12, 47, 10, undefined], 'la rune de l’inventaire n’est jamais modifiée');
  }
  {
    const r = runeMaxee(ANTIQUE, TOUT);
    egal([r.subs[0].value, r.subs[0].grind, r.subs[1].value, r.subs[1].grind, r.subs[2].value, r.subs[2].grind], [17, 6, 19, 12, 18, 12],
      'rune antique : tables antiques (gemme VIT 11 +6, meule ATQ % +12, PV % vierge +12)');
    egal([r.level, r.main.value], [15, 63], 'antique déjà à +15 : principale et niveau inchangés');
  }
  {
    const maxee: RuneDetail = { ...RUNE, level: 15, main: { code: 4, value: 63 },
      subs: [{ code: 8, value: 15, grind: 5, enchant: true }, { code: 4, value: 17, grind: 10 }, { code: 9, value: 6 }] };
    ok(runeMaxee(maxee, TOUT) === maxee, 'rune déjà maxée : la même référence, sans `avantSimulation`');
    const nonMeulable: RuneDetail = { ...RUNE, level: 15, main: { code: 4, value: 63 }, subs: [{ code: 9, value: 6 }, { code: 10, value: 7 }] };
    ok(runeMaxee(nonMeulable, TOUT) === nonMeulable, 'rune +15 sans ligne meulable (Tx critiq., Dégâts critiq.) : inchangée');
    const gemmeNonMeulee: RuneDetail = { ...maxee, subs: [{ code: 2, value: 9, enchant: true }] };
    egal(runeMaxee(gemmeNonMeulee, TOUT).subs[0], { code: 2, value: 23, enchant: true, grind: 10 }, 'PV % gemmée 9 jamais meulée : gemme légendaire 13 ET meule légendaire +10');
    const auDela: RuneDetail = { ...maxee, subs: [{ code: 2, value: 16, grind: 0, enchant: true }] };
    egal(runeMaxee(auDela, TOUT).subs[0], { code: 2, value: 26, grind: 10, enchant: true }, 'jamais à la baisse : une base au-dessus de la table reste où elle est (16, meule +10 en plus)');
    const gemmeTc: RuneDetail = { ...maxee, subs: [{ code: 9, value: 5, enchant: true }] };
    ok(runeMaxee(gemmeTc, TOUT) === gemmeTc, 'stat sans table de gemme ni de meule (Tx critiq.) : inchangée');
  }
  {
    const cinq: RuneDetail = { ...RUNE, rank: 5, level: 12, main: { code: 4, value: 40 } };
    const r = runeMaxee(cinq, TOUT);
    egal([r.level, r.main.value, r.subs[0].value], [12, 40, 15], 'rune 5★ : principale et niveau inchangés (aucune table par étoile), meule et gemme maxées');
  }

  titre('Simulation des runes maxées — trois lignes séparées, grade héroïque ou légendaire');
  {
    const r = runeMaxee(RUNE, sim({ plus15: true }));
    egal([r.level, r.main.value, r.subs], [15, 63, RUNE.subs], '« Simuler +15 » seul : la principale monte, les meules et gemmes ne bougent pas');
    const a = runeMaxee(ANTIQUE, sim({ plus15: true, meules: 'legend' }));
    ok(a === ANTIQUE, 'meules des runes normales : une rune antique (déjà +15) reste telle quelle');
    const n = runeMaxee(RUNE, sim({ antiques: 'legend' }));
    ok(n === RUNE, 'meules des runes antiques : une rune normale reste telle quelle');
  }
  {
    const r = runeMaxee(RUNE, sim({ meules: 'hero' }));
    egal([r.level, r.main.value], [12, 47], 'meules seules : niveau et principale inchangés');
    egal(r.subs[0], { code: 8, value: 12, grind: 4, enchant: true }, 'Héro : VIT gemmée 7 +3 → gemme héroïque 8, meule héroïque +4');
    egal(r.subs[1], { code: 4, value: 14, grind: 7 }, 'Héro : ATQ % meulée +5 → meule héroïque +7');
    egal(r.subs[2], { code: 2, value: 13, grind: 7 }, 'Héro : PV % vierge → meule héroïque +7');
    const legendaire: RuneDetail = { ...RUNE, subs: [{ code: 8, value: 15, grind: 5, enchant: true }, { code: 4, value: 17, grind: 10 }] };
    ok(runeMaxee(legendaire, sim({ meules: 'hero' })) === legendaire,
      'Héro sur une rune aux meules et gemme légendaires : rien ne descend, la même référence');
    const a = runeMaxee(ANTIQUE, sim({ antiques: 'hero' }));
    egal([a.subs[0], a.subs[1], a.subs[2]], [{ code: 8, value: 14, grind: 5, enchant: true }, { code: 4, value: 16, grind: 9 }, { code: 2, value: 15, grind: 9 }],
      'Héro antique : tables héroïques antiques (gemme VIT 9 +5, meule ATQ % +9, PV % +9)');
  }

  titre('Simulation des runes maxées — le pool de la recherche, écran et CLI');
  {
    const pool = [RUNE, { ...RUNE, id: 12, level: 15, main: { code: 4, value: 63 }, subs: [{ code: 9, value: 6 }] }];
    ok(poolDeRecherche(pool, SIMULATION_RUNES_AUCUNE) === pool, 'rien d’activé : le pool tel quel, même référence');
    ok(poolDeRecherche(pool, sim({})) === pool, 'grades choisis, interrupteurs éteints : le pool tel quel');
    const simule = poolDeRecherche(pool, TOUT);
    egal(simule.map((r) => [r.id, r.main.value, r.avantSimulation != null]), [[11, 63, true], [12, 63, false]], 'activé : chaque rune maxée, ordre et identifiants gardés');
    const loaded = { allRunes: pool, com2usId: 13413, unitId: 1 } as unknown as LoadedMonster;
    ok(resolvePool(recette(), loaded) === pool, 'CLI, recette sans le champ : le pool réel (même repli que l’écran)');
    egal(resolvePool(recette({ simulationRunes: TOUT }), loaded), simule, 'CLI, champ activé : le pool du même producteur que l’écran');
  }

  titre('Simulation des runes maxées — gardée dans la recette, ancien réglage traduit');
  {
    const lire = (extra: Record<string, unknown>) => parseOptimizerRecipe(JSON.stringify(recette(extra)), fr);
    const heroique = sim({ plus15: true, meules: 'hero' });
    egal(lire({ simulationRunes: heroique }).recipe?.simulationRunes, heroique, 'relue telle quelle, grades compris');
    egal(lire({}).recipe?.simulationRunes, undefined, 'recette exportée avant ce champ : acceptée, champ absent');
    const ancienne = lire({ simulerRunesMaxees: true }).recipe as unknown as Record<string, unknown> | null;
    egal([ancienne?.simulationRunes, 'simulerRunesMaxees' in (ancienne ?? {})], [TOUT, false],
      'ancien `simulerRunesMaxees: true` : les trois lignes activées, en légendaire, l’ancien champ retiré');
    egal(lire({ simulerRunesMaxees: false }).recipe?.simulationRunes, undefined, 'ancien réglage désactivé : rien de simulé');
    egal(lire({ simulerRunesMaxees: true, simulationRunes: heroique }).recipe?.simulationRunes, heroique, 'les deux champs : le nouveau l’emporte');
    const epuisement = lire({ exhaustiveSearch: true }).recipe as unknown as Record<string, unknown> | null;
    ok(epuisement != null && !('exhaustiveSearch' in epuisement), 'ancien `exhaustiveSearch` : recette acceptée, champ retiré');
    for (const [valeur, chemin] of [
      [{ ...heroique, plus15: 'oui' }, 'simulationRunes.plus15'],
      [{ ...heroique, meules: { actif: true, grade: 'mythique' } }, 'simulationRunes.meules.grade'],
      [{ ...heroique, meulesAntiques: null }, 'simulationRunes.meulesAntiques'],
    ] as const) {
      const lu = lire({ simulationRunes: valeur });
      ok(lu.recipe === null && (lu.error ?? '').includes(chemin), `mal formé : refusé avec son chemin (${lu.error})`);
    }
    const mauvais = lire({ simulerRunesMaxees: 'oui' });
    ok(mauvais.recipe === null && /simulerRunesMaxees/.test(mauvais.error ?? ''), `ancien champ mal typé : refusé (${mauvais.error})`);
  }

  titre('Simulation des runes maxées — reprise d’une session');
  {
    const poses: unknown[] = [];
    const etat = { simulationRunes: SIMULATION_RUNES_AUCUNE, setSimulationRunes: (v: unknown) => poses.push(v) } as unknown as OptimizerState;
    restaurerOptimizer(etat, { simulerRunesMaxees: true });
    egal(poses, [TOUT], 'photo d’avant les trois lignes (`simulerRunesMaxees: true`) : traduite comme une recette');
    const laisses = restaurerOptimizer(etat, { simulationRunes: { plus15: true } });
    egal(laisses, ['simulationRunes'], 'photo mal formée : laissée, le champ rendu');
  }

  titre('Simulation des runes maxées — la clé du cache de résolution');
  {
    const base = { monstreCom2usId: 1, damageSetup: DEFAULT_DAMAGE_SETUP, regimeEquipement: 'aucun', ignoreArtifacts: false, principaleParSorte: {},
      lignesVerrouillees: [], relique: null, nbArtefacts: 0, empreinteRelique: null, requirement: { minStats: {}, maxStats: {} },
      artefactsReserves: [], piecesFigees: [], importDuCompte: 0, empreinteSpeedTune: null };
    const signature = (s: SimulationRunes) => signatureArtefacts({ ...base, runesMaxees: empreinteSimulation(s) });
    const sans = signature(SIMULATION_RUNES_AUCUNE);
    ok(!sans.includes('runes-maxees'), 'rien de simulé : composant omis, la signature d’avant ce réglage');
    ok(signature(sim({ meules: 'hero', antiques: 'legend' })) === signature({ ...sim({ meules: 'hero', antiques: 'legend' }), plus15: false }),
      'précondition : même réglage, même signature');
    const variantes = [TOUT, sim({ plus15: true }), sim({ meules: 'hero' }), sim({ meules: 'legend' }), sim({ antiques: 'hero' })].map(signature);
    ok(new Set([sans, ...variantes]).size === variantes.length + 1, 'chaque ligne et chaque grade changent la signature : le cache indexé par identifiants de runes se vide');
    ok(signature(sim({})) === sans, 'un grade choisi sur une ligne éteinte ne change rien');
  }
}
