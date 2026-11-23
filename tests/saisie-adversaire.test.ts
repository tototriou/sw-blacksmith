// Saisie de l'adversaire en parties (src/lib/saisieAdversaire.ts) : lead,
// base, runes, compétences d'invocateur, et les totaux `enemy…` qu'elle
// écrit — les seuls que le calcul lit.
//
// Spec : docs/02-app/optimizer/ecran/objectif-de-recherche.md,
// « Dégâts réels — adversaire » ; docs/02-app/degats-reels/feat-formules-et-combat.md.

import { readFileSync } from 'node:fs';
import { egal, ok, titre } from './outils';
import { DEFAULT_DAMAGE_SETUP, type DamageSetup } from '../src/lib/damage';
import {
  avecLeadAdversaire,
  avecTotauxAdversaire,
  avecValeurAdversaire,
  detailAdversaire,
  importerMonstreAdversaire,
  saisieAdversaireDe,
} from '../src/lib/saisieAdversaire';
import { damageSetupApresChangementMonstre } from '../src/lib/damageSetupTransition';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { fr } from '../src/i18n/fr';
import type { Monster } from '../src/types';

const MONSTRES: Monster[] = JSON.parse(readFileSync('public/data/monsters.json', 'utf8')).monsters;
const chasun = () => {
  const m = MONSTRES.find((x) => x.name === 'Chasun' && x.element === 'wind' && x.obtainable !== false);
  if (!m) throw new Error('précondition : Chasun (vent) dans monsters.json');
  return m;
};
// Le réglage après un changement, comme le setter de l'écran l'écrit.
const appliquer = (setup: DamageSetup, patch: Partial<DamageSetup>) => avecTotauxAdversaire({ ...setup, ...patch });

export function testSaisieAdversaireCalcul() {
  titre('Saisie de l’adversaire — base, runes, lead, compétences d’invocateur et totaux');

  // Sans saisie : les totaux écrits passent dans les runes, rien ne bouge.
  const ancien: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, enemyHp: 52_000, enemyDef: 1_234 };
  const legacy = saisieAdversaireDe(ancien);
  egal(legacy.base, { hp: 0, def: 0, atk: 0, spd: 0 }, 'sans saisie : base à 0');
  egal(legacy.runes, { hp: 52_000, def: 1_234, atk: DEFAULT_DAMAGE_SETUP.enemyAtk, spd: DEFAULT_DAMAGE_SETUP.enemySpd },
    'sans saisie : chaque total écrit (ATQ et VIT absentes : leur défaut) dans les runes');
  egal(legacy.lead, null, 'sans saisie : aucun lead');
  ok(avecTotauxAdversaire(ancien) === ancien, 'sans saisie : le réglage est rendu tel quel');
  const touche = appliquer(ancien, avecValeurAdversaire(ancien, 'runes', 'def', 1_234));
  egal([touche.enemyHp, touche.enemyDef], [52_000, 1_234], 'premier changement sans effet de valeur : les totaux restent exacts (base 0, aucune part en %)');

  // Import d'un monstre : bases SWARFARM, élément visé, runes gardées.
  const m = chasun();
  let s = appliquer(ancien, importerMonstreAdversaire(ancien, m));
  egal(s.adversaire?.base, { hp: m.stats.hp, def: m.stats.defense, atk: m.stats.attack, spd: m.stats.speed }, 'import : les stats de base du monstre');
  egal(s.adversaire?.monstreId, String(m.id), 'import : son identifiant, pour le portrait');
  egal(s.enemyElement, 'wind', 'import : l’élément visé devient le sien');
  egal(s.adversaire?.runes, { hp: 0, def: 0, atk: 0, spd: 0 }, 'import sur un réglage sans saisie : les anciens totaux ne deviennent pas des runes');
  const runesGardees = appliquer(s, avecValeurAdversaire(s, 'runes', 'hp', 7_000));
  egal(appliquer(runesGardees, importerMonstreAdversaire(runesGardees, m)).adversaire?.runes.hp, 7_000, 'import sur une saisie : les runes saisies restent');

  // Contenu normal, élément connu : +20 % PV/DEF, +41 % ATQ, +15 % VIT sur la base.
  s = appliquer(s, { adversaire: { ...s.adversaire!, runes: { hp: 12_450, def: 788, atk: 120, spd: 98 } } });
  const d = detailAdversaire(s.adversaire!, 'normal', 'wind');
  egal(d.hp.invocateur, 11_040 * 0.2, 'PV : +20 % de la base');
  egal(d.atk.invocateur, (659 * 41) / 100, 'ATQ : +20 % et +21 % élémentaire, élément connu');
  egal(d.spd.invocateur, (101 * 15) / 100, 'VIT : +15 %');
  egal(s.enemyHp, Math.round(11_040 + 12_450 + 11_040 * 0.2), 'enemyHp = base + runes + invocateur');
  egal(s.enemySpd, Math.round(101 + 98 + 101 * 0.15), 'enemySpd = base + runes + invocateur');
  egal(detailAdversaire(s.adversaire!, 'normal', null).atk.invocateur, 659 * 0.2, 'ATQ : sans élément visé, pas d’ATQ élémentaire');

  // Lead : sur SA stat seulement, sur la base ; un type changé repart à son premier palier.
  s = appliquer(s, avecLeadAdversaire(s, { stat: 'HP', pct: 33 }));
  egal(s.enemyHp, Math.round(11_040 + 12_450 + 11_040 * 0.2 + 11_040 * 0.33), 'lead PV 33 % : ajouté au total des PV');
  egal(s.enemyDef, Math.round(582 + 788 + 582 * 0.2), 'lead PV : la DEF ne bouge pas');
  egal(avecLeadAdversaire(s, { stat: 'Defense' }).adversaire?.lead, { stat: 'Defense', pct: 20 }, 'type changé : premier palier de DEF');
  egal(appliquer(s, avecLeadAdversaire(s, null)).enemyHp, Math.round(11_040 + 12_450 + 11_040 * 0.2), 'aucun lead : sa part disparaît');

  // Ce dont les totaux dépendent hors de la fenêtre.
  const guilde = appliquer(s, { summonerSkills: 'guilde' });
  egal(guilde.enemyHp, Math.round(11_040 + 12_450 + 11_040 * 0.73), 'contenu de guilde : +20 % de plus, recalculé sans la fenêtre');
  egal(appliquer(s, { enemyElement: null }).enemyAtk, Math.round(659 + 120 + 659 * 0.2), 'élément ignoré : l’ATQ élémentaire part du total');

  // Une valeur saisie négative est ramenée à 0.
  egal(avecValeurAdversaire(s, 'runes', 'def', -5).adversaire?.runes.def, 0, 'une valeur négative est ramenée à 0');

  // Contexte de combat : la saisie suit un changement de monstre optimisé.
  egal(damageSetupApresChangementMonstre(s).adversaire, s.adversaire, 'changement de monstre optimisé : la saisie de l’adversaire reste');
}

export function testSaisieAdversaireRecette() {
  titre('Saisie de l’adversaire — dans la recette');
  const m = chasun();
  let setup = appliquer(DEFAULT_DAMAGE_SETUP, importerMonstreAdversaire(DEFAULT_DAMAGE_SETUP, m));
  setup = appliquer(setup, avecLeadAdversaire(setup, { stat: 'Attack Speed', pct: 24 }));
  const recette = (damageSetup: unknown) =>
    JSON.stringify({
      ...buildOptimizerRecipe({
        monsterCom2usId: 19315, monsterName: 'Cassie',
        requirement: { sets: [], minStats: {} }, objective: 'degats_reels',
        damageSetup: DEFAULT_DAMAGE_SETUP, metric: 'eff', slotFilterPreset: 'bas',
        exhaustiveSearch: false, excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [],
        ignoreArtifacts: true, artifactMainByKind: {},
      }),
      damageSetup,
    });
  const lue = parseOptimizerRecipe(recette(setup), fr);
  ok(lue.recipe !== null, `une recette qui porte la saisie se relit (${lue.error ?? 'ok'})`);
  egal(lue.recipe?.damageSetup.adversaire, setup.adversaire, '… avec sa saisie intacte');
  egal(lue.recipe?.damageSetup.enemySpd, setup.enemySpd, '… et ses totaux');
  for (const [nom, adv] of [
    ['base absente', { ...setup.adversaire, base: undefined }],
    ['runes négatives', { ...setup.adversaire, runes: { ...setup.adversaire!.runes, hp: -1 } }],
    ['lead de Taux Crit', { ...setup.adversaire, lead: { stat: 'Critical Rate', pct: 10 } }],
    ['monstre numérique', { ...setup.adversaire, monstreId: 546 }],
  ] as const) {
    ok(parseOptimizerRecipe(recette({ ...setup, adversaire: adv }), fr).recipe === null, `refusée : ${nom}`);
  }
  ok(parseOptimizerRecipe(recette(DEFAULT_DAMAGE_SETUP), fr).recipe !== null, 'une recette sans saisie reste valide');
}
