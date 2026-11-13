// Tests de rendu — les builds épinglés de l'Optimizer (resultats.md, § Builds
// épinglés) : le bouton de chaque carte, les épinglés en lignes compactes
// au-dessus de la grille et en tête du tableau, numérotés, « Libérer tous les builds épinglés » dans l'en-tête,
// et des épinglés propres au membre affiché. Écran entier pour le branchement,
// composants seuls pour le tableau et l'en-tête. Les gestes (épingler,
// libérer, confirmer) : le banc d'affichage et la carte au navigateur.

import { AVEC_MONSTRE, BOX, rendreOptimizer } from './optimizer.test';
import { boutons, rendre, texteVisible } from './outils-rendu';
import { egal, ok, titre } from '../outils';
import type { BuildCandidate, BuildRequirement } from '../../src/lib/runeBuildOptim';
import { rechercheClasseeTest } from './optimizer-classement-banc';
import { cleEpingle, cleMembreEpingles, MAX_EPINGLES, type BuildEpingle } from '../../src/lib/epinglesOptimizer';
import { exclusionSelectorKey, type ExclusionSelector } from '../../src/lib/optimizerExclusion';
import TableauResultats from '../../src/components/outils/optimizer/TableauResultats';
import EnteteResultats from '../../src/components/outils/optimizer/EnteteResultats';
import ListeEpingles from '../../src/components/outils/optimizer/ListeEpingles';

const EPINGLER = 'Épingler ce build';
const LIBERER = 'Libérer ce build épinglé';
const TOUT = 'Libérer tous les builds épinglés';
const COMPLET = '10 builds épinglés au plus : libères-en un pour épingler celui-ci.';

const STATS = [{ key: 'atk', label: 'ATQ', suffix: '', base: 700, bonus: 300, total: 1000 }];
const candidat = (i: number): BuildCandidate => ({ runeIds: [i, i + 100, i + 200, i + 300, i + 400, i + 500], stats: STATS, effTotal: 0 } as unknown as BuildCandidate);
const resultat = (n: number) => ({ candidates: Array.from({ length: n }, (_, i) => candidat(i + 1)), explored: 10, truncated: false, nearMissByCondition: [], globalNearMiss: null });
type Reel = Parameters<Extract<Parameters<typeof rendreOptimizer>[0], (...a: never[]) => unknown>>[0];

const membre: ExclusionSelector = { source: 'box', unitKey: BOX[0].key };
const autre: ExclusionSelector = { source: 'unowned', monsterId: String(BOX[0].monster.id) };
const MEMBRE = cleMembreEpingles(null, exclusionSelectorKey(membre))!;

// La page classée (sans file : l'équipement est celui de la fiche) et sa photo.
function page(r: Reel, n: number) {
  return rechercheClasseeTest({ status: 'done', result: resultat(n) }, {
    fiche: BOX[0].gear!, pool: BOX[0].gear!.runes, optimiser: false,
    requirement: { sets: r.comboSets, minStats: r.minStats as BuildRequirement['minStats'] },
    vue: { tri: r.sortBy, metric: 'eff', page: 1 },
  });
}
// La photographie que le bouton prendrait de la carte `i` de la page.
function photo(r: Reel, i: number): BuildEpingle {
  const s = page(r, 3);
  const carte = s.classement!.page.cartes[i], contexte = s.contexte!;
  return { cle: cleEpingle(carte.candidat.runeIds, contexte.recherche.artifacts.map((a) => a.id), contexte.fiche.relic?.id), carte, contexte,
    montres: { ehp: false, degats: false } };
}
const ecran = (selector: ExclusionSelector, epingles: (r: Reel) => Record<string, BuildEpingle[]>, avecResultats = true) =>
  rendreOptimizer((r: Reel) => ({ ...AVEC_MONSTRE, optimiserArtefacts: false, sourceSelector: selector, epingles: epingles(r),
    ...(avecResultats ? { search: { ...r.search, ...page(r, 3) } } : {}) }));
const LIGNE = (n: number) => `aria-label="Détail du build épinglé n° ${n}"`;
const rangs = (html: string) => [...texteVisible(html).matchAll(/#(\d+)\b/g)].map((m) => Number(m[1]));
const nommes = (html: string, nom: string) => boutons(html).filter((b) => b.ariaLabel === nom);

export function testRenduOptimizerEpingles() {
  titre('rendu · Optimizer — builds épinglés : bouton, lignes au-dessus de la grille, en-tête, propres au membre');

  // Sans épinglé : un bouton par carte, « Libérer tous… » présent et désactivé.
  const sans = ecran(membre, () => ({}));
  egal(nommes(sans, EPINGLER).length, 3, 'sans épinglé : « Épingler ce build » sur chacune des 3 cartes');
  const tout = boutons(sans).find((b) => b.ariaLabel === TOUT);
  ok(!!tout && tout.desactive, 'sans épinglé : « Libérer tous les builds épinglés » présent et désactivé (sa place est réservée)');

  // Le deuxième build épinglé : une ligne compacte au-dessus de la grille,
  // numérotée 1, sans rang ni carte entière ; son double dans la page garde
  // son rang et dit « Libérer ».
  const un = ecran(membre, (r) => ({ [MEMBRE]: [photo(r, 1)] }));
  egal(rangs(un), [1, 2, 3], 'épinglé : la page garde ses rangs, l’épinglé n’en écrit pas');
  ok(un.includes('data-liste-epingles') && un.indexOf(LIGNE(1)) >= 0 && un.indexOf(LIGNE(1)) < un.indexOf('#1'),
    'épinglé : une ligne numérotée 1, avant la première carte de la page');
  egal((un.match(/data-carte-resultat/g) ?? []).length, 3, 'épinglé : pas de carte entière en plus, la grille garde ses 3 cartes');
  egal(nommes(un, LIBERER).length, 2, 'épinglé : « Libérer » sur sa ligne et sur son double de la page');
  egal(nommes(un, EPINGLER).length, 2, 'épinglé : les deux autres cartes de la page restent épinglables');
  ok(boutons(un).some((b) => b.ariaLabel === TOUT && !b.desactive), 'épinglé : « Libérer tous les builds épinglés » actif');
  egal(boutons(un).filter((b) => b.ariaLabel === LIBERER && b.presse).length, 1, 'le bouton de son double dans la page est enclenché');

  // Deux épinglés : numérotés dans l'ordre d'épinglage.
  const deux = ecran(membre, (r) => ({ [MEMBRE]: [photo(r, 2), photo(r, 0)] }));
  ok(deux.indexOf(LIGNE(1)) >= 0 && deux.indexOf(LIGNE(1)) < deux.indexOf(LIGNE(2)) && deux.indexOf(LIGNE(2)) < deux.indexOf('#1'),
    'deux épinglés : 1 puis 2, avant la page');

  // Dix épinglés : plus de place, le bouton des autres cartes le dit, désactivé.
  const dix = ecran(membre, (r) => ({ [MEMBRE]: Array.from({ length: MAX_EPINGLES }, (_, i) => ({ ...photo(r, 0), cle: `x${i}` })) }));
  const complets = boutons(dix).filter((b) => b.ariaLabel === COMPLET);
  ok(complets.length === 3 && complets.every((b) => b.desactive), 'dix épinglés : les cartes de la page ne peuvent plus épingler, et disent pourquoi');

  // Propres au membre : un autre exemplaire n'en montre aucun.
  const ailleurs = ecran(autre, (r) => ({ [MEMBRE]: [photo(r, 1)] }));
  ok(!ailleurs.includes(LIGNE(1)) && nommes(ailleurs, LIBERER).length === 0, 'un autre membre ne voit pas les épinglés de celui-ci');

  // Sans résultats (retour sur le monstre) : les épinglés restent, sous un
  // en-tête réduit à leur compte et à « Libérer tous… ».
  const seul = ecran(membre, (r) => ({ [MEMBRE]: [photo(r, 1)] }), false);
  const t = texteVisible(seul);
  ok(t.includes('1 build(s) épinglé(s)') && seul.includes(LIGNE(1)) && rangs(seul).length === 0,
    'sans résultats : l’épinglé reste affiché, sous « 1 build(s) épinglé(s) »');
  ok(boutons(seul).some((b) => b.texte.includes(TOUT) && !b.desactive), 'sans résultats : « Libérer tous les builds épinglés » actif');
}

export function testRenduOptimizerEpinglesTableau() {
  titre('rendu · Optimizer — builds épinglés : lignes en tête du tableau, lignes compactes des cartes, bouton de l’en-tête');
  let photoTableau: BuildEpingle | null = null;
  rendreOptimizer((r: Reel) => { photoTableau = photo(r, 1); return { ...AVEC_MONSTRE }; });
  const e = photoTableau!;
  const runeById = new Map(e.contexte.recherche.pool.map((x) => [x.id, x]));
  const tableau = (vide: string | null) => rendre(
    <TableauResultats cartes={[e.carte]} premierRang={1} placesEnAttente={0} runeById={runeById} metric="eff" afficherDepassement
      tri={{ tri: 'atk', sens: 'desc' }} trier={() => {}} bornes={{}} poserBorne={() => {}} disponible={(c) => c !== 'degats_reels'}
      ouvrirDetail={() => {}} vide={vide} epingles={[{ cle: e.cle, numero: 1, carte: e.carte, runeById, base: {} }]} ouvrirEpingle={() => {}} />,
  );
  const plein = tableau(null);
  const iEpingle = plein.indexOf('data-ligne-epinglee'), iRang = plein.indexOf('aria-label="Détail du build n° 1"');
  ok(iEpingle > 0 && iRang > iEpingle && plein.includes('aria-label="Détail du build épinglé n° 1"'),
    'tableau : la ligne épinglée, en tête, au-dessus du build n° 1, et son détail s’ouvre comme une autre ligne');
  const vide = tableau('Vue vide : rien ne passe.');
  ok(vide.includes('data-ligne-epinglee') && texteVisible(vide).includes('Vue vide : rien ne passe.'),
    'tableau : sous une vue vide, l’épinglé reste (un filtre ne le masque pas)');

  // Les lignes compactes du mode cartes : numéro, sets, valeur moyenne, et
  // « Libérer » ; la ligne elle-même ouvre le détail.
  const liste = rendre(
    <ListeEpingles epingles={[{ cle: e.cle, numero: 1, candidat: e.carte.candidat, runeById }, { cle: 'autre', numero: 2, candidat: e.carte.candidat, runeById }]}
      metric="eff" ouvrir={() => {}} liberer={() => {}} />,
  );
  ok(liste.indexOf('aria-label="Détail du build épinglé n° 1"') >= 0 && liste.indexOf('aria-label="Détail du build épinglé n° 1"') < liste.indexOf('aria-label="Détail du build épinglé n° 2"'),
    'lignes compactes : une par épinglé, dans l’ordre, chacune ouvre son détail');
  egal(nommes(liste, LIBERER).length, 2, 'lignes compactes : « Libérer » sur chacune');
  ok(texteVisible(liste).includes('Efficience moyenne'), 'lignes compactes : la valeur moyenne de la mesure courante');
  egal(rendre(<ListeEpingles epingles={[]} metric="eff" ouvrir={() => {}} liberer={() => {}} />), '', 'sans épinglé : aucune liste');

  const entete = (nombre: number, bureau: boolean) => rendre(
    <EnteteResultats result={{ nombre: 3, explored: 10, truncated: false, nearMissByCondition: [], globalNearMiss: null }}
      compteConfirmes={{ confirmees: 3, nonVerifies: 0, pages: 1, pagesPeuventMonter: false, aRecevoir: false, aucune: false }}
      avecFile={false} tri={{ tri: 'atk', sens: 'desc' }} trier={() => {}} metric="eff" disponible={() => true} enAttente={0}
      compteAffiche={{ compte: 3, ecartes: 0, raison: null }} bureau={bureau}
      filtres={{ bornes: {}, poserBorne: () => {}, effacer: () => {}, filtre: null }}
      libererEpingles={{ nombre, demander: () => {} }} />,
  );
  for (const bureau of [true, false]) {
    const format = bureau ? 'bureau' : 'téléphone';
    const html = entete(2, bureau);
    const iTout = html.indexOf(`aria-label="${TOUT}"`), iFiltrer = html.indexOf('Filtrer l&#x27;affichage');
    ok(iTout > 0 && iFiltrer > iTout, `${format} : « Libérer tous les builds épinglés » à gauche de « Filtrer l'affichage »`);
    ok(boutons(entete(0, bureau)).find((b) => b.ariaLabel === TOUT)?.desactive === true, `${format} : désactivé sans épinglé`);
  }
}
