// Charger une session (application de bureau) — ce qui s'applique AVANT le
// premier rendu (src/lib/chargementSession.ts), la reprise de l'Optimizer
// (`restaurerOptimizer`) et les messages d'un chargement refusé
// (`messageEchecChargement`). Voir
// docs/02-app/transverse/feat-sauvegarde-session.md, « Charger ».

import 'fake-indexeddb/auto';
import { indexedDB } from 'fake-indexeddb';
import { ACCOUNT_SCHEMA, clearAccount, loadAccount, type StoredAccount } from '../src/lib/accountStore';
import { appliquerSession, sessionChargee } from '../src/lib/chargementSession';
import { runesUtiliseesVides } from '../src/lib/importAccount';
import { messageEchecChargement } from '../src/lib/bureau';
import { CLES_SESSION, composerSession, ecrireSession, lireSession } from '../src/lib/session';
import { restaurerOptimizer } from '../src/lib/sessionOptimizer';
import { lireTravail, setPersistence } from '../src/hooks/usePersistence';
import { photographierMemoire } from '../src/hooks/useStickyState';
import type { OptimizerState } from '../src/hooks/useOptimizerState';
import { fr } from '../src/i18n/fr';
import { egal, faussLocalStorage, ok, titre } from './outils';

const RTA = 'swblacksmith-rta-v1';
const SIEGE = 'swblacksmith-siege-defense-v1';
const THEME = 'swblacksmith-theme-v1';

const compte: StoredAccount = {
  schema: ACCOUNT_SCHEMA,
  savedAt: 1,
  exportedAt: 2,
  wizardName: 'Testeur',
  box: [],
  runes: [],
  artifacts: [],
  relics: [],
  crafts: [],
  usedRuneIds: runesUtiliseesVides(),
  relicUsageById: {},
  runeMarkerLabels: {},
};

const session = (avecCompte: boolean) =>
  composerSession({
    maintenant: new Date(0),
    versionApp: 'test',
    stockage: { [RTA]: '{"entries":{"7":{}}}', [THEME]: 'dark' },
    compte: avecCompte ? compte : null,
    memoire: { 'box.query': 'lushen' },
    optimizer: { sortBy: 'spd' },
  });

export async function testChargementSession() {
  titre('charger une session · conservation refusée : en mémoire seulement');
  // L'app d'avant : une prépa, un siège, un thème clair.
  faussLocalStorage({ [RTA]: '{"ancienne":1}', [SIEGE]: '{"teams":[1]}', [THEME]: 'light' });
  setPersistence(false);
  await appliquerSession(session(true), 'ma-session.json', ['comptePerime']);
  egal(lireTravail(RTA), '{"entries":{"7":{}}}', 'la prépa de la session : relue par les hooks (miroir)');
  egal(localStorage.getItem(RTA), null, '… et rien sur le disque, conservation refusée');
  egal(lireTravail(SIEGE), null, 'une clé absente de la session : effacée, l’ancien siège ne survit pas');
  egal(localStorage.getItem(THEME), 'dark', 'un réglage : écrit tel quel, comme son hook le fait');
  egal(photographierMemoire()['box.query'], 'lushen', 'la mémoire des outils : posée avant le montage');
  const c = sessionChargee();
  ok(c?.nom === 'ma-session.json' && c.compte?.wizardName === 'Testeur', 'le nom et le compte, pour App.tsx');
  egal(c?.optimizer, { sortBy: 'spd' }, 'la photo de l’Optimizer, rejouée après le montage');
  egal(c?.avertissements, ['comptePerime'], 'les avertissements de la lecture');

  titre('charger une session · conservation acceptée : sur le disque');
  // ⚠️ testPersistance, plus tôt dans le même lancement, retire IndexedDB
  // (`indexedDB = null`) : on le remet.
  (globalThis as { indexedDB?: unknown }).indexedDB = indexedDB;
  faussLocalStorage({ [SIEGE]: '{"teams":[1]}' });
  setPersistence(true);
  try {
    await appliquerSession(session(true), 's.json', []);
    egal(localStorage.getItem(RTA), '{"entries":{"7":{}}}', 'la prépa : écrite sur le disque');
    egal(localStorage.getItem(SIEGE), null, 'la clé absente : effacée du disque');
    egal((await loadAccount())?.wizardName, 'Testeur', 'le compte : écrit dans IndexedDB');
    await appliquerSession(session(false), 's.json', []);
    egal(await loadAccount(), null, 'une session sans compte : celui d’avant est effacé');
  } finally {
    await clearAccount();
    setPersistence(false);
  }
}

// L'aller-retour : une session écrite, relue, appliquée, puis recomposée
// depuis ce que l'app relit au démarrage — rien ne doit s'être perdu.
export async function testAllerRetourSession() {
  titre('charger une session · aller-retour complet, conservation refusée');
  faussLocalStorage({});
  setPersistence(false);
  const memoire = {
    'box.query': 'lushen',
    'runesList.sets': new Set(['violent', 'swift']),
    'recos.parId': new Map([['r1', { ouvert: true }]]),
    'optim.regemLibre': true,
  };
  const origine = composerSession({
    maintenant: new Date(0),
    versionApp: 'test',
    stockage: {
      [RTA]: '{"entries":{"7":{}}}',
      [SIEGE]: '{"teams":[{"id":"t1"}]}',
      [THEME]: 'dark',
      'swblacksmith-langue-v1': 'en',
      'swblacksmith-rune-metric-v1': 'score',
    },
    compte,
    memoire,
    optimizer: { selectedId: '18', sortBy: 'spd', comboSets: ['violent'] },
  });
  const lecture = lireSession(ecrireSession(origine));
  ok(lecture.ok, 'la session écrite se relit');
  if (!lecture.ok) return;
  await appliquerSession(lecture.session, 'aller-retour.json', lecture.avertissements);
  const chargee = sessionChargee();
  const memoireRelue = photographierMemoire();
  const recomposee = composerSession({
    maintenant: new Date(0),
    versionApp: 'test',
    stockage: Object.fromEntries(CLES_SESSION.map((cle) => [cle, lireTravail(cle)])),
    compte: chargee?.compte ?? null,
    memoire: Object.fromEntries(Object.keys(memoire).map((cle) => [cle, memoireRelue[cle]])),
    optimizer: chargee?.optimizer ?? null,
  });
  egal(recomposee.stockage, origine.stockage, 'le travail et les réglages : identiques');
  egal(recomposee.compte, origine.compte, 'le compte : identique');
  egal(recomposee.outils.memoire, origine.outils.memoire, 'la mémoire des écrans : identique, Set et Map compris');
  egal(recomposee.outils.optimizer, origine.outils.optimizer, 'la photo de l’Optimizer : identique');
  ok(memoireRelue['runesList.sets'] instanceof Set && memoireRelue['recos.parId'] instanceof Map, 'un Set revient en Set, une Map en Map, pour l’écran qui les lit');
}

export function testRestaurerOptimizer() {
  titre('charger une session · l’Optimizer rejoué par ses set…');
  const appels: string[] = [];
  const setter = (nom: string) => (v: unknown) => appels.push(`${nom}=${JSON.stringify(v instanceof Set ? [...v] : v)}`);
  const etat = {
    selectedId: null,
    setSelectedId: setter('selectedId'),
    comboSets: [],
    setComboSets: setter('comboSets'),
    excludedSelectors: [],
    setExcludedSelectors: setter('excludedSelectors'),
    sortBy: 'score',
    setSortBy: setter('sortBy'),
  } as unknown as OptimizerState;
  const laisses = restaurerOptimizer(etat, {
    sortBy: 'spd',
    comboSets: ['violent'],
    selectedId: '12',
    excludedSelectors: new Set([1]),
  });
  egal(appels, ['selectedId="12"', 'comboSets=["violent"]', 'sortBy="spd"'], 'la sélection d’abord, puis l’ordre de CHAMPS_OPTIMIZER_SESSION');
  egal(laisses, ['excludedSelectors'], 'une valeur d’une autre forme (un Set où l’écran attend un tableau) : laissée, et dite');
}

export function testMessageEchecChargement() {
  titre('charger une session · pourquoi elle ne l’a pas été');
  const c = fr.donnees.chargement;
  egal(messageEchecChargement({ issue: 'echec', motif: 'pas-une-session', code: null }, fr), c.pasUneSession, 'le bureau : pas une session');
  egal(messageEchecChargement({ issue: 'echec', motif: 'lecture', code: 'ENOENT' }, fr), c.introuvable, 'le bureau : fichier disparu');
  egal(messageEchecChargement({ issue: 'echec', motif: 'lecture', code: 'EPERM' }, fr), c.refus, 'le bureau : lecture refusée');
  egal(messageEchecChargement({ issue: 'echec', motif: 'lecture', code: 'EXYZ' }, fr), c.autre('EXYZ'), 'le bureau : un autre code, cité');
  egal(messageEchecChargement({ code: 'autreFormat' }, fr), c.autreFormat, 'la page : un autre export de l’app');
  egal(messageEchecChargement({ code: 'tropRecente' }, fr), c.tropRecente, 'la page : une version plus récente');
  ok(messageEchecChargement({ code: 'valeurIllisible', cle: RTA }, fr).includes(RTA), 'la page : la clé illisible, nommée');
}
