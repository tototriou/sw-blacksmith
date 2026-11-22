// La fenêtre d'import commune (docs/02-app/transverse/feat-fenetre-import.md) :
// ce qu'elle montre, ce qu'on y choisit, ce que le choix produit.
//
// ⚠️ Ce qui casserait sans bruit : un filtre de contenu qui cache la raison
// d'une source vide, un monstre choisi qui reprend l'équipement d'un autre
// exemplaire, un bloc choisi qui part en plusieurs listes, un ajout à la liste
// active qui écrase ce qu'elle avait.

import { egal, ok, titre } from './outils';
import type { Monster, Reco, SiegeTeam } from '../src/types';
import { fr } from '../src/i18n/fr';
import { creerEquipe, indexerInventaire, type EquipeEnregistree } from '../src/lib/equipesEnregistrees';
import type { ExclusionSourceData } from '../src/lib/optimizerExclusion';
import type { StockageOptimizer } from '../src/lib/optimizerMemberStorage';
import { consommerImportOptimizer, importerOffenseSiegeOptimizer } from '../src/lib/importEquipes';
import {
  sourcesImportEquipes, sourcesMesEquipes, sourcesRecommandations, type ContexteSourcesEquipes, type SourceImportEquipe,
} from '../src/lib/sourcesEquipesEnregistrees';
import {
  SELECTION_VIDE, basculerBloc, basculerEquipe, basculerMonstre, categorieDuGroupe, comptesParContenu, conflitsSelection, creerEquipesChoisies,
  filtreInitial, fusionnerImports, monstresChoisis, producteurChoix, sectionsFenetre, sourceInitiale, sourcesVisibles,
} from '../src/lib/fenetreImport';
import { equipementEx, monstreEx } from './equipes-enregistrees.test';

const T0 = new Date('2026-11-22T10:00:00Z');
function monstre(id: number, nom = `Monstre ${id}`): Monster {
  return { id, com2usId: 1000 + id, name: nom, element: 'fire', stars: 5, naturalStars: 5, secondAwaken: false,
    image: null, stats: { hp: 10000, attack: 700, defense: 600, speed: 101, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 },
    leaderSkill: null };
}
const MONSTRES = [monstre(1, 'Éclair'), monstre(2), monstre(3)];
// Deux défenses (un bloc) et une offense ; les slots portent chacun leur équipement.
const deck = (id: string, ids: string[], premiere: number): SiegeTeam => ({ id, lead: 0, tickAlertDismissed: false,
  slots: ids.map((m, i) => ({ monsterId: m, runeSpeed: 120, tick: 0, gear: equipementEx(premiere + 10 * i) })) });
const DEFENSES = [deck('d1', ['1', '2'], 1), deck('d2', ['2', '3'], 100)];
const OFFENSES = [deck('o1', ['1', '3', '1'], 200)];
function contexte(): ContexteSourcesEquipes {
  return {
    box: [{ key: '11', monster: MONSTRES[0], stars: 6, level: 40, gear: equipementEx(1) }],
    siegeDefenseTeams: DEFENSES, siegeOffenseTeams: OFFENSES, rta: { sections: [], entries: {} },
    arenaDecks: null, decksEnregistres: [], compte: true,
    monsterById: new Map(MONSTRES.map((m) => [String(m.id), m])),
    monsterByCom2us: new Map(MONSTRES.map((m) => [m.com2usId as number, m])),
  };
}
const data = (): ExclusionSourceData => ({ box: [...contexte().box], rtaEntries: {}, siegeDefenseTeams: DEFENSES, siegeOffenseTeams: OFFENSES,
  monsterById: new Map(contexte().monsterById) });
const INV = indexerInventaire([], [], []);
const EQUIPES: EquipeEnregistree[] = [
  { ...creerEquipe('e1', 'faille/raid', 'Raid 1', T0), monstres: [monstreEx('a', 1001, null), monstreEx('b', 1002, null, null)], groupe: 'Raid' },
  { ...creerEquipe('e2', 'faille/raid', 'Raid 2', T0), monstres: [monstreEx('c', 1003, null, null), monstreEx('d', 1002, null, null)], groupe: 'Raid' },
];
const RECO: Reco = { id: 'r1', origin: 'mine', name: 'Contres', author: '', note: '',
  decks: [{ name: '', note: '', counters: [], slots: [1001, 1002, 1003].map((c) => ({ com2usId: c, name: '', stats: {}, sets: [] })) }] } as unknown as Reco;
const toutes = (): SourceImportEquipe[] => [
  ...sourcesMesEquipes(EQUIPES, contexte(), fr),
  ...sourcesImportEquipes(contexte(), null, INV, 'arene', fr).filter((s) => s.source === 'jeu'),
  ...sourcesRecommandations([RECO], contexte(), fr),
];
let n = 0;
const tirer = () => `t${++n}`;

function testFenetreImportFiltres() {
  titre('fenêtre d’import — sources, contenus, recherche');
  const s = toutes();
  const libelles = (f: Parameters<typeof sourcesVisibles>[1]) => sourcesVisibles(s, f).map((x) => x.libelle);
  egal(libelles(filtreInitial('jeu', 'guilde/defense-siege')), ['Défense 1', 'Défense 2'], 'le contenu de l’onglet ouvert, avec sa catégorie');
  egal(libelles(filtreInitial('jeu', 'guilde')), ['Défense 1', 'Défense 2', 'Offense 1'], 'la catégorie entière');
  ok(libelles(filtreInitial('jeu', 'cairos')).includes(fr.equipes.imports.arene) === false
    && libelles(filtreInitial('jeu', null)).includes(fr.equipes.imports.arene), 'une source vide reste visible sous « Tous les contenus », filtrée ailleurs');
  egal(libelles({ ...filtreInitial('jeu', null), texte: 'eclair' }), ['Défense 1', 'Offense 1'], 'la recherche lit les monstres, sans casse ni accents');
  egal(libelles({ ...filtreInitial('equipes', 'arene') }), ['Raid 1', 'Raid 2'].filter(() => false), 'Mes équipes se filtre aussi par contenu');
  egal(libelles(filtreInitial('recos', 'arene')), ['Deck 1'], 'les recommandations ne se filtrent pas par contenu');
  const comptes = comptesParContenu(s, 'jeu');
  egal([comptes.get(''), comptes.get('guilde'), comptes.get('guilde/defense-siege'), comptes.get('arene')], [3, 3, 2, undefined],
    'les comptes ne comptent que l’importable, par catégorie et par rangement');
  egal(sourceInitiale(s, ['optimizer', 'jeu']), 'jeu', 'la fenêtre s’ouvre sur la première source qui a de quoi importer');
  const sections = sectionsFenetre(sourcesVisibles(s, filtreInitial('jeu', 'guilde')));
  egal(sections.map((x) => [x.groupe, x.blocs.map((b) => [b.bloc?.nom ?? null, b.sources.length])]),
    [[fr.equipes.imports.siegeDefenses, [[fr.equipes.imports.siegeDefenses, 2]]], [fr.equipes.imports.siegeAttaques, [[null, 1]]]],
    'les défenses de siège en un bloc, sous leur section');
  // Mes équipes revient au même contenu après un autre, et coupe un groupe :
  // une section et un bloc n'apparaissent qu'une fois (clés de rendu uniques).
  const x = (cle: string, groupe: string, bloc?: string) => ({ ...s[0], cle, groupe, ...(bloc ? { bloc: { cle: bloc, nom: bloc } } : { bloc: undefined }) });
  const melees = sectionsFenetre([x('1', 'Guilde', 'G'), x('2', 'Arène'), x('3', 'Guilde', 'G'), x('4', 'Guilde'), x('5', 'Arène')]);
  egal(melees.map((m) => [m.groupe, m.blocs.map((b) => [b.bloc?.nom ?? null, b.sources.map((y) => y.cle)])]),
    [['Guilde', [['G', ['1', '3']], [null, ['4']]]], ['Arène', [[null, ['2', '5']]]]],
    'sections et blocs réunis à leur première apparition');
}

function testFenetreImportSelection() {
  titre('fenêtre d’import — des équipes ou des monstres');
  let sel = basculerEquipe(SELECTION_VIDE, 'a');
  sel = basculerBloc(sel, ['a', 'b']);
  egal(sel.equipes, ['a', 'b'], 'un bloc complète le choix');
  egal(basculerBloc(sel, ['a', 'b']).equipes, [], 'un bloc entier se décoche d’un geste');
  const m = basculerMonstre(sel, { cle: 'x', index: 0 });
  egal([m.equipes, m.monstres.length], [[], 1], 'choisir un monstre vide le choix d’équipes');
  egal(basculerEquipe(m, 'a').monstres, [], 'et l’inverse');
  egal(basculerMonstre(m, { cle: 'x', index: 1 }, 1).monstres.length, 1, 'au-delà de la place libre, rien n’est ajouté');
  egal(basculerMonstre(m, { cle: 'x', index: 0 }).monstres, [], 'un monstre choisi se retire');
}

function testFenetreImportProduits() {
  titre('fenêtre d’import — ce que le choix crée');
  const s = toutes();
  const crees = creerEquipesChoisies(s, ['siege-defense:d1', 'siege-attaque:o1'], tirer, tirer, T0);
  egal(crees.map((c) => [c.cree.equipe.nom, c.cree.equipe.onglet]), [['Défense 1', 'guilde/defense-siege'], ['Offense 1', 'guilde/offense-siege']],
    'chaque équipe dans son rangement');
  egal(categorieDuGroupe(crees.map((c) => c.cree.equipe)), 'guilde', 'un groupe possible dans leur onglet commun');
  egal(categorieDuGroupe([{ onglet: 'guilde' }, { onglet: 'arene' }]), null, 'pas de groupe entre deux onglets');
  egal(categorieDuGroupe([{ onglet: 'rta' }, { onglet: 'rta' }]), null, 'ni entre des prépas');
  const conflits = conflitsSelection(s, ['siege-defense:d1', 'siege-attaque:o1'], contexte().monsterByCom2us);
  egal(conflits.especes.map((x) => [x.com2usId, x.equipes]), [[1001, ['siege-defense:d1', 'siege-attaque:o1']]],
    'une espèce jouée dans les deux équipes, dite avant l’import');
  // Le second Éclair de l'offense : son équipement, pas celui du premier.
  const offense = s.find((x) => x.cle === 'siege-attaque:o1')!;
  const choisis = monstresChoisis(s, [{ cle: offense.cle, index: 2 }, { cle: 'equipe:e1', index: 1 }], tirer, T0);
  egal(choisis.map((x) => [x.com2usId, x.equipement?.runes[0].id ?? null, x.provenance]), [[1001, 220, 'siege-attaque'], [1002, null, 'aucun']],
    'chaque monstre choisi garde l’exemplaire et l’équipement de sa place');
}

function testFenetreImportOptimizer() {
  titre('fenêtre d’import — vers l’Optimizer');
  const s = toutes();
  const offense = s.find((x) => x.cle === 'siege-attaque:o1')!;
  ok(producteurChoix(s, { equipes: [offense.cle], monstres: [] }, INV, 'arene') === offense.produireOptimizer, 'une équipe seule garde l’import de sa source');
  const bloc = producteurChoix(s, { equipes: ['siege-defense:d1', 'siege-defense:d2'], monstres: [] }, INV, 'arene')!(data(), fr);
  egal([bloc.nomListe, bloc.equipes.length, bloc.membres.length], [fr.equipes.imports.siegeDefenses, 2, 4], 'un bloc entier : une liste à son nom, une équipe par deck');
  const melange = producteurChoix(s, { equipes: ['siege-defense:d1', 'equipe:e1', 'equipe:e2'], monstres: [] }, INV, 'arene')!(data(), fr);
  egal([melange.nomListe, melange.equipes.map((e) => e.libelle)], [fr.fenetreImport.nomSelection('Défense 1', 2), ['Défense 1', 'Raid 1', 'Raid 2']],
    'des équipes de sources différentes : une liste, chacune son équipe');
  const monstres = producteurChoix(s, { equipes: [], monstres: [{ cle: offense.cle, index: 1 }] }, INV, 'guilde')!(data(), fr);
  egal([monstres.nomListe, monstres.membres.length, monstres.equipes.length], ['Monstre 3', 1, 0], 'des monstres seuls : des membres, sans équipe');
  egal(producteurChoix(s, SELECTION_VIDE, INV, 'arene'), null, 'rien de choisi, rien à importer');
  const double = fusionnerImports([importerOffenseSiegeOptimizer('o1', data(), fr), importerOffenseSiegeOptimizer('o1', data(), fr)], 'X');
  egal([double.membres.length, double.equipes.length], [3, 2], 'un même membre proposé deux fois n’entre qu’une fois');
}

function testFenetreImportListeActive() {
  titre('fenêtre d’import — ajouter à la liste active');
  const vide: StockageOptimizer = { identities: new Map(), lists: [], members: [], validated: [], memories: new Map(),
    teams: [], listContents: new Map(), rejets: { listContents: [], memories: [], teams: [] } };
  const premier = consommerImportOptimizer(vide, null, importerOffenseSiegeOptimizer('o1', data(), fr), data(), 'l1', fr);
  ok(premier.rapport.listeCreee !== null, 'précondition : une liste créée');
  const id = premier.rapport.listeCreee!.id;
  const defense = producteurChoix(toutes(), { equipes: ['siege-defense:d1'], monstres: [] }, INV, 'arene')!(data(), fr);
  const ajout = consommerImportOptimizer(premier.stockage, id, defense, data(), 'autre', fr, id);
  egal([ajout.rapport.listeCreee, ajout.rapport.listeCompletee?.id, ajout.stockage.lists.length], [null, id, 1], 'ajouté à la liste visée, sans liste neuve');
  egal(ajout.stockage.members.filter((m) => m.listId === id).length, 5, 'ses membres restent, les nouveaux s’ajoutent');
  egal(ajout.stockage.listContents.get(id), premier.stockage.listContents.get(id), 'son contenu ne change pas');
  const encore = consommerImportOptimizer(ajout.stockage, id, defense, data(), 'autre', fr, id);
  ok(encore.rapport.ignores.length === 2 && encore.rapport.ignores.every((x) => x.raison === fr.optimizer.importsEquipe.dejaDansLaListe),
    'un membre déjà dans la liste est ignoré, avec sa raison');
  const absente = consommerImportOptimizer(ajout.stockage, id, defense, data(), 'autre', fr, 'disparue');
  ok(absente.stockage === ajout.stockage && absente.rapport.messages.includes(fr.optimizer.importsEquipe.listeCibleAbsente),
    'une liste disparue : refus, rien d’écrit');
}

export const verificationsFenetreImport: [string, () => void][] = [
  ['testFenetreImportFiltres', testFenetreImportFiltres],
  ['testFenetreImportSelection', testFenetreImportSelection],
  ['testFenetreImportProduits', testFenetreImportProduits],
  ['testFenetreImportOptimizer', testFenetreImportOptimizer],
  ['testFenetreImportListeActive', testFenetreImportListeActive],
];
