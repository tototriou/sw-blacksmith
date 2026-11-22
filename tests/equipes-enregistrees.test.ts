import { egal, ok, titre } from './outils';
import type { ArtifactDetail, GearSet, Monster, RelicDetail, RuneDetail } from '../src/types';
import type { BoxItem } from '../src/lib/applyAccount';
import { fr } from '../src/i18n/fr';
import { en } from '../src/i18n/en';
import {
  CATEGORIES_EQUIPES, CONTENU_OPTIMIZER_ONGLET, ONGLETS_EQUIPES, SOUS_CATEGORIES_EQUIPES, MONSTRES_MAX_PREPA, ajouterMonstre, appliquerGroupe, normaliserPrepa, categorieDe, conflitsGroupe, libellePieceEnConflit, nombrePiecesEnConflit, monstresMax, nomGroupeLibre, tropDeMonstres, equipesDuGroupe, groupesDeLOnglet, modifierGroupe, regrouper, comparerPiece, compteParCategorie, compteParOnglet, creerEquipe, deplacerMonstre, designerLeader, dupliquerEquipe,
  deplacerVersOnglet, equipesFiltrees, gesteSurBrouillon, etatExemplaire, etatPiece, indexerInventaire, lireEquipeEnregistree, modifierTextes,
  libelleRangement, libelleSousCategorie, nomEquipeLibre, rangement, resumeEcarts, sousCategorieDe, retirerMonstre, type EquipeEnregistree, type MonstreEnregistre, type OngletEquipes,
} from '../src/lib/equipesEnregistrees';

const T0 = new Date('2026-11-05T10:00:00Z');
const T1 = new Date('2026-11-05T11:00:00Z');

export function runeEx(id: number, slot: number, valeur = 10): RuneDetail {
  return { id, slot, set: 'swift', rank: 6, rarity: 5, level: 15, main: { code: 8, value: 42 },
    subs: [{ code: 2, value: valeur, grind: 0 }, { code: 9, value: 6 }] };
}
export function artefactEx(id: number, kind: 'element' | 'archetype'): ArtifactDetail {
  return { id, kind, ...(kind === 'element' ? { element: 'fire' as const } : { archetype: 'attack' as const }),
    level: 15, rarity: 5, main: { code: 100, value: 160 }, subs: [{ code: 200, value: 5 }] };
}
export const reliqueEx = (id: number): RelicDetail => ({ id, upgrade: 15, main: { code: 100, value: 20 } });
export function equipementEx(premiereRune = 1): GearSet {
  return { base: { hp: 10000, atk: 700, def: 600, spd: 101, cr: 15, cd: 50, res: 15, acc: 0 },
    runes: [1, 2, 3, 4, 5, 6].map((s) => runeEx(premiereRune + s - 1, s)),
    artifacts: [artefactEx(premiereRune * 10, 'element'), artefactEx(premiereRune * 10 + 1, 'archetype')], relic: reliqueEx(premiereRune * 100) };
}
export function monstreEx(uid: string, com2usId: number, unitId: number | null, eq: GearSet | null = equipementEx()): MonstreEnregistre {
  return { uid, com2usId, unitId, provenance: eq ? 'porte' : 'aucun', equipement: eq };
}
function monstreJeu(com2usId: number, jumeauCollab?: number): Monster {
  return { id: com2usId, com2usId, name: `M${com2usId}`, element: 'fire', stars: 5, naturalStars: 5, secondAwaken: false,
    image: null, stats: { hp: 1, attack: 1, defense: 1, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 },
    leaderSkill: null, ...(jumeauCollab ? { jumeauCollab } : {}) } as Monster;
}

function testEquipesEnregistreesRelecture() {
  titre('Mes équipes — relecture d’une équipe enregistrée');
  const base = creerEquipe('e1', 'guilde/defense-siege', 'Équipe 1', T0);
  const e: EquipeEnregistree = { ...base, monstres: [monstreEx('a', 1, 11), monstreEx('b', 2, null, null)], leader: 'a' };
  const lu = lireEquipeEnregistree(JSON.parse(JSON.stringify(e)));
  egal(lu?.equipe, e, 'une équipe valide se relit à l’identique');
  egal(lu?.signalements, [], 'sans signalement');
  for (const n of [0, 1]) ok(lireEquipeEnregistree({ ...e, monstres: e.monstres.slice(0, n) }) === null, `${n} monstre : illisible, une équipe en a au moins deux`);
  ok(lireEquipeEnregistree({ ...e, onglet: 'inconnu' }) === null, 'un onglet inconnu rend l’équipe illisible');
  const anciens: [string, string][] = [
    ['guerre-guilde', 'guilde/offense-gdg'], ['guerre-guilde-offense', 'guilde/offense-gdg'], ['guerre-guilde-defense', 'guilde/defense-gdg'],
    ['siege-attaque', 'guilde/offense-siege'], ['siege-defense', 'guilde/defense-siege'], ['arene-attaque', 'arene/offense'],
    ['arene-offense', 'arene/offense'], ['arene-defense', 'arene/defense'], ['rta', 'rta'], ['arene/rta', 'rta'], ['pve', 'cairos'],
    ['guilde-offense', 'guilde'], ['guilde-defense', 'guilde'], ['labyrinthe', 'labyrinthe'], ['passage-dimensions', 'passage-dimensions'],
  ];
  for (const [avant, apres] of anciens) egal(lireEquipeEnregistree({ ...e, onglet: avant })?.equipe.onglet, apres, `l’ancien rangement ${avant} se relit en ${apres}`);
  ok(lireEquipeEnregistree({ ...e, onglet: 'cairos/boss' }) === null, 'une catégorie d’un autre onglet rend l’équipe illisible');
  ok(lireEquipeEnregistree({ ...e, onglet: 'toString' }) === null, 'un nom hérité d’Object n’est pas un ancien rangement');
  ok(lireEquipeEnregistree({ ...e, monstres: [1, 2, 3, 4, 5, 6, 7].map((i) => monstreEx(`u${i}`, i, null)) }) === null, 'plus de 6 monstres : illisible');
  ok(lireEquipeEnregistree({ ...e, monstres: [monstreEx('a', 1, 11), monstreEx('a', 2, 12)] }) === null, 'deux uid identiques : illisible');
  const mauvaisLeader = lireEquipeEnregistree({ ...e, leader: 'zz' });
  egal([mauvaisLeader?.equipe.leader, mauvaisLeader?.signalements], [null, ['leaderRetire']], 'un leader absent est retiré et signalé');
  const st = lireEquipeEnregistree({ ...e, speedTune: { plan: { version: 99 }, liens: [
    { uid: 'l1', monstre: 'a', attache: true, repli: { vitesseMin: 200, effet206: 0 } },
    { uid: 'l2', monstre: 'inconnu', attache: true, repli: { vitesseMin: null, effet206: 0 } },
  ] } });
  ok(st !== null, 'un speed tune malformé ne rejette jamais l’équipe');
  egal(st?.equipe.speedTune?.plan, null, 'le plan illisible devient null');
  egal(st?.equipe.speedTune?.liens.map((l) => l.uid), ['l1'], 'le lien vers un monstre absent est retiré');
  egal(st?.signalements, ['speedTuneIncomplet'], 'et la dégradation est signalée');
  const lien = lireEquipeEnregistree({ ...e, lienOptimizer: { listId: 'L', equipeId: 'E', correspondance: [{ uid: 'a', selecteur: { source: 'box', unitKey: '11' } }] } });
  egal(lien?.equipe.lienOptimizer?.correspondance.length, 1, 'un lien valide se relit');
  const sansEquipe = lireEquipeEnregistree({ ...e, lienOptimizer: { listId: 'L', equipeId: null, correspondance: [] } });
  egal([sansEquipe?.equipe.lienOptimizer, sansEquipe?.signalements], [undefined, ['lienOptimizerRetire']], 'un lien sans équipe de l’Optimizer est retiré et signalé');
  egal(lireEquipeEnregistree({ ...e, lienOptimizer: { listId: 'L' } })?.signalements, ['lienOptimizerRetire'], 'un lien malformé est retiré et signalé');
}

function testEquipesEnregistreesComparaison() {
  titre('Mes équipes — comparaison des pièces au compte');
  const r = runeEx(1, 1);
  ok(comparerPiece(r, { ...r, marker: 3 }), 'le marqueur posé en jeu n’entre pas dans la comparaison');
  ok(!comparerPiece(r, { ...r, level: 12 }), 'un niveau différent : modifiée');
  ok(!comparerPiece(r, { ...r, subs: [{ code: 2, value: 10, grind: 4 }, r.subs[1]] }), 'une meule différente : modifiée');
  ok(!comparerPiece(r, { ...r, subs: [r.subs[1], r.subs[0]] }), 'l’ordre des lignes compte');
  ok(!comparerPiece(r, { ...r, nouveauChamp: 1 }), 'un champ ajouté au type est comparé');
  ok(!comparerPiece({ ...r, nouveauChamp: 1 }, r), 'dans les deux sens : un champ absent de la pièce actuelle compte aussi');
  ok(!comparerPiece({ ...r, innate: { code: 4, value: 3 } }, r), 'une innée perdue : modifiée');
  const inv = indexerInventaire([r, { ...runeEx(2, 2), level: 9 }], [artefactEx(10, 'element')], [reliqueEx(100)]);
  egal(etatPiece('rune', r, inv), 'identique', 'pièce identique');
  egal(etatPiece('rune', runeEx(2, 2), inv), 'modifiee', 'pièce modifiée');
  egal(etatPiece('rune', runeEx(3, 3), inv), 'disparue', 'pièce disparue');
  egal(etatPiece('artefact', artefactEx(0, 'element'), inv), 'hors-compte', 'une pièce synthétique n’est jamais comparée');
  const e = { ...creerEquipe('e', 'arene/offense', 'E', T0), monstres: [monstreEx('a', 1, 11)] };
  egal(resumeEcarts(e, inv), { modifiees: 1, disparues: 4 + 1 }, 'résumé : 1 modifiée, 4 runes et 1 artéfact disparus');
  const box: BoxItem[] = [{ key: '11', monster: monstreJeu(1), stars: 6, level: 40, gear: equipementEx() }];
  egal(etatExemplaire(monstreEx('a', 1, 11), box), 'equipe-ainsi', 'l’exemplaire porte exactement l’enregistré');
  egal(etatExemplaire(monstreEx('a', 1, 11, equipementEx(2)), box), 'equipe-autrement', 'il porte autre chose');
  egal(etatExemplaire(monstreEx('a', 1, 99), box), 'absent', 'exemplaire absent de la Box');
  egal(etatExemplaire(monstreEx('a', 1, null), box), null, 'unitId inconnu : aucune ligne');
  egal(etatExemplaire(monstreEx('a', 1, 11, null), box), null, 'sans équipement : aucune ligne');
}

function testEquipesEnregistreesOperations() {
  titre('Mes équipes — composition, leader, speed tune, duplication');
  // « Nouvelle équipe » : brouillon jusqu'au deuxième monstre, puis équipe à enregistrer.
  const b0 = creerEquipe('n', 'cairos', 'N', T0);
  const b1 = gesteSurBrouillon(b0, (x, n) => ajouterMonstre(x, monstreEx('a', 1, null), n)!, T1);
  egal([b1.brouillon?.monstres.length, b1.aEnregistrer], [1, null], 'un monstre : encore un brouillon, rien à enregistrer');
  const b2 = gesteSurBrouillon(b1.brouillon!, (x, n) => ajouterMonstre(x, monstreEx('b', 2, null), n)!, T1);
  egal([b2.brouillon, b2.aEnregistrer?.monstres.length], [null, 2], 'deux monstres : l’équipe s’enregistre');
  let e = creerEquipe('e', 'cairos', 'E', T0);
  for (const [uid, id] of [['a', 1], ['b', 2], ['c', 3]] as const) e = ajouterMonstre(e, monstreEx(uid, id, null), T1)!;
  e = designerLeader(e, 'b', T1);
  e = { ...e, speedTune: { plan: null, liens: [
    { uid: 'l1', monstre: 'b', attache: true, repli: { vitesseMin: 200, effet206: 0 } },
    { uid: 'l2', monstre: 'c', attache: false, repli: { vitesseMin: null, effet206: 12 } },
  ] } };
  const reordonnee = deplacerMonstre(e, 'c', 0, T1);
  egal(reordonnee.monstres.map((m) => m.uid), ['c', 'a', 'b'], 'réordonner déplace le monstre');
  egal([reordonnee.leader, reordonnee.speedTune?.liens.map((l) => l.monstre)], ['b', ['b', 'c']], 'et ne change aucune désignation');
  const sansB = retirerMonstre(e, 'b', T1);
  egal([sansB.leader, sansB.speedTune?.liens.map((l) => l.uid)], [null, ['l2']], 'retirer le leader remet le leader à null et retire ses liens');
  ok(ajouterMonstre({ ...e, monstres: [1, 2, 3, 4, 5, 6].map((i) => monstreEx(`u${i}`, i, null)) }, monstreEx('z', 9, null), T1) === null, 'pas de 7ᵉ monstre');
  egal(modifierTextes(e, { nom: '  Nouvelle  ', note: ' n ' }, T1).nom, 'Nouvelle', 'le nom est trimé');
  egal(modifierTextes(e, { nom: '   ' }, T1).nom, 'E', 'un nom vide garde l’ancien');
  let n = 0;
  const lie = { ...e, lienOptimizer: { listId: 'L', equipeId: 'T', correspondance: [] } };
  const copie = dupliquerEquipe(lie, 'e2', 'E (2)', () => `n${++n}`, T1);
  egal(copie.monstres.map((m) => m.uid), ['n1', 'n2', 'n3'], 'la copie a de nouveaux uid');
  egal([copie.leader, copie.speedTune?.liens.map((l) => [l.uid, l.monstre])], ['n2', [['l1', 'n2'], ['l2', 'n3']]], 'leader et liens suivent la correspondance ; les lignes gardent leur uid');
  ok(copie.lienOptimizer === undefined, 'la copie n’a pas de lien vers l’Optimizer');
  copie.monstres[0].equipement!.runes[0].level = 1;
  egal(e.monstres[0].equipement!.runes[0].level, 15, 'la copie est détachée de l’original');
  egal(nomEquipeLibre([e, { ...e, nom: 'Équipe 1' }], (k) => `Équipe ${k}`), 'Équipe 2', 'nom libre');
}

function testEquipesEnregistreesRecherche() {
  titre('Mes équipes — recherche par monstre dans l’onglet ouvert');
  const gojo = monstreJeu(2001, 1001);
  const werner = monstreJeu(1001, 2001);
  const index = new Map([[1, monstreJeu(1)], [2, monstreJeu(2)], [1001, werner], [2001, gojo]]);
  const eq = (id: string, onglet: OngletEquipes, ids: number[], quand: string): EquipeEnregistree =>
    ({ ...creerEquipe(id, onglet, id, new Date(quand)), monstres: ids.map((c, i) => monstreEx(`${id}${i}`, c, null)) });
  const toutes = [eq('a', 'toa', [1, 2], '2026-01-01'), eq('b', 'toa', [1, 1001], '2026-02-01'), eq('c', 'cairos/geant', [1, 2], '2026-03-01'),
    eq('d', 'cairos', [1, 2], '2026-04-01'), eq('f', 'cairos/dragon', [1, 2], '2026-05-01')];
  egal(equipesFiltrees(toutes, 'toa', null, [], index).map((e) => e.id), ['b', 'a'], 'sans recherche : l’onglet, dernière modifiée en premier');
  egal(equipesFiltrees(toutes, 'toa', null, [monstreJeu(1), monstreJeu(2)], index).map((e) => e.id), ['a'], 'tous les monstres recherchés sont exigés');
  egal(equipesFiltrees(toutes, 'toa', null, [gojo], index).map((e) => e.id), ['b'], 'une collaboration et sa version SW comptent pour la même espèce');
  egal(equipesFiltrees(toutes, 'cairos', null, [], index).map((e) => e.id), ['f', 'd', 'c'], 'sous « Tout » : chaque catégorie de l’onglet, et ses équipes sans catégorie');
  egal(equipesFiltrees(toutes, 'cairos', 'dragon', [], index).map((e) => e.id), ['f'], 'le filtre ne garde que sa catégorie');
  egal(compteParOnglet(toutes).toa, 2, 'compte par rangement');
  egal([compteParCategorie(toutes).cairos, compteParOnglet(toutes)['cairos/geant'], compteParOnglet(toutes).cairos], [3, 1, 1], 'un onglet compte toutes ses équipes');
}

function testEquipesEnregistreesCategories() {
  titre('Mes équipes — catégories, côtés et rangements');
  egal([...CATEGORIES_EQUIPES], ['arene', 'rta', 'guilde', 'cairos', 'labyrinthe', 'subjugation', 'passage-dimensions', 'faille', 'temple-chaos', 'toa'],
    'les onglets dans l’ordre choisi');
  egal(CATEGORIES_EQUIPES.filter((c) => SOUS_CATEGORIES_EQUIPES[c].length === 0), ['rta', 'toa'], 'seules la RTA et la ToA n’ont pas de catégorie');
  egal([rangement('arene', 'offense'), rangement('arene', 'rta'), rangement('cairos', null), rangement('toa', 'eau'), rangement('cairos', 'eau')],
    ['arene/offense', 'arene', 'cairos', 'toa', 'cairos'], 'rangement : l’onglet et sa catégorie ; une catégorie d’un autre onglet est ignorée');
  for (const o of ONGLETS_EQUIPES) egal(rangement(categorieDe(o), sousCategorieDe(o)), o, `${o} : onglet et catégorie refont le rangement`);
  egal(Object.entries(CONTENU_OPTIMIZER_ONGLET), [['arene', 'arene'], ['rta', 'arene'], ['guilde', 'guilde'], ['cairos', 'donjon'], ['labyrinthe', 'guilde'],
    ['subjugation', 'guilde'], ['passage-dimensions', 'donjon'], ['faille', 'donjon'], ['temple-chaos', 'autre'], ['toa', 'autre']],
    'le lead de chaque onglet, d’après la règle relevée en jeu');
  for (const [dico, langue] of [[fr, 'fr'], [en, 'en']] as const) {
    const manquants = ONGLETS_EQUIPES.filter((o) => sousCategorieDe(o) && libelleSousCategorie(categorieDe(o), sousCategorieDe(o)!, dico) === sousCategorieDe(o));
    egal(manquants, [], `${langue} : chaque catégorie a son libellé`);
  }
  egal([libelleRangement('labyrinthe/boss', fr), libelleRangement('toa', fr)], ['Labyrinthe — Boss', 'ToA'], 'le rangement se dit par l’onglet et la catégorie');
}

// Les groupes : des équipes d'un onglet jouées ensemble, qui se partagent les
// runes (décision de l'utilisateur, 2026-11-22).
function testEquipesEnregistreesGroupes() {
  titre('Mes équipes — groupes d’équipes liées');
  const T = new Date('2026-11-06T10:00:00Z');
  const eq = (id: string, onglet: OngletEquipes, groupe: string | null, monstres: MonstreEnregistre[], quand = '2026-01-01'): EquipeEnregistree =>
    ({ ...creerEquipe(id, onglet, id, new Date(quand)), monstres, ...(groupe ? { groupe } : {}) });
  const a = eq('a', 'faille/raid', 'Raid A', [monstreEx('a1', 1, 11), monstreEx('a2', 2, null)], '2026-03-01');
  egal(lireEquipeEnregistree(JSON.parse(JSON.stringify({ ...a, groupe: '  Raid A ' })))?.equipe.groupe, 'Raid A', 'le groupe se relit, trimé');
  ok(!('groupe' in lireEquipeEnregistree({ ...a, groupe: '   ' })!.equipe), 'un groupe vide est oublié');
  egal(modifierGroupe(a, ' Raid B ', T).groupe, 'Raid B', 'changer de groupe');
  ok(!('groupe' in modifierGroupe(a, '  ', T)), 'un nom vide fait quitter le groupe');
  ok(modifierGroupe(a, 'Raid A', T) === a, 'le même nom ne touche pas l’équipe');
  egal(deplacerVersOnglet(a, 'faille/glace', T).groupe, 'Raid A', 'changer de catégorie dans l’onglet garde le groupe');
  ok(!('groupe' in deplacerVersOnglet(a, 'cairos', T)), 'changer d’onglet quitte le groupe');
  ok(!('groupe' in dupliquerEquipe(a, 'c', 'C', () => 'n', T)), 'la copie n’est dans aucun groupe');
  const b = eq('b', 'faille/raid', 'Raid A', [monstreEx('b1', 3, 11), monstreEx('b2', 4, null, equipementEx(1))], '2026-01-01');
  const seule = eq('s', 'faille/glace', null, [monstreEx('s1', 1, null, equipementEx(50)), monstreEx('s2', 2, null, null)], '2026-02-01');
  const autre = eq('o', 'cairos', 'Raid A', [monstreEx('o1', 1, null), monstreEx('o2', 2, null)], '2026-04-01');
  const toutes = [autre, a, seule, b];
  egal(groupesDeLOnglet(toutes, 'faille'), ['Raid A'], 'les groupes d’un onglet');
  egal(equipesDuGroupe(toutes, 'faille', 'Raid A').map((e) => e.id), ['a', 'b'], 'un groupe ne sort pas de son onglet, même nom ailleurs compris');
  egal(regrouper([seule, a, b]).map((e) => e.id), ['a', 'b', 's'], 'les groupes d’abord, chacun d’un bloc, puis les équipes non groupées');
  const [ab] = conflitsGroupe([a, b]).pieces;
  egal(ab.porteurs, [{ equipe: 'a', uid: 'a1', com2usId: 1 }, { equipe: 'a', uid: 'a2', com2usId: 2 }, { equipe: 'b', uid: 'b1', com2usId: 3 }, { equipe: 'b', uid: 'b2', com2usId: 4 }],
    'les pièces portées par deux équipes du groupe : chacun de leurs porteurs');
  egal(ab.pieces.map((p) => libellePieceEnConflit(p, fr)), [1, 2, 3, 4, 5, 6].map((s) => `Rune Rapide slot ${s}`).concat(['Artéfact (Attribut : Feu)', 'Artéfact (Type : Attaque)']),
    'et chaque pièce nommée : set et slot de la rune, sorte et valeur de l’artéfact ; jamais la relique');
  egal(nombrePiecesEnConflit(conflitsGroupe([a, b])), 8, 'les mêmes porteurs : une ligne pour leurs huit pièces');
  egal(conflitsGroupe([a, seule]), { pieces: [], especes: [{ com2usId: 1, formes: [1], equipes: ['a', 's'] }, { com2usId: 2, formes: [2], equipes: ['a', 's'] }] },
    'une même espèce dans deux équipes, même d’exemplaires différents, avec ses équipes');
  const collab = eq('k', 'faille/raid', 'Raid A', [monstreEx('k1', 1001, null, null), monstreEx('k2', 5, null, null)]);
  const parCom2us = new Map([monstreJeu(1), monstreJeu(1001, 1)].map((m) => [m.com2usId!, m]));
  egal(conflitsGroupe([a, collab], parCom2us).especes, [{ com2usId: 1, formes: [1, 1001], equipes: ['a', 'k'] }],
    'une collaboration et sa version SW : la même espèce, ses deux formes nommées');
  egal(conflitsGroupe([a, collab]).especes, [], 'sans les données des monstres, deux espèces');
  const deux = conflitsGroupe([
    eq('p', 'faille/raid', 'Raid A', [monstreEx('p1', 1, null, equipementEx(1)), monstreEx('p2', 2, null, equipementEx(20))]),
    eq('q', 'faille/raid', 'Raid A', [monstreEx('q1', 3, null, { ...equipementEx(30), runes: [runeEx(1, 1)] }), monstreEx('q2', 4, null, { ...equipementEx(40), artifacts: [artefactEx(200, 'element')] })]),
  ]).pieces;
  egal(deux.map((c) => [c.porteurs.map((p) => p.uid), c.pieces.map((p) => p.piece.id)]), [[['p1', 'q1'], [1]], [['p2', 'q2'], [200]]],
    'des porteurs différents : une ligne chacun');
  const intangible = libellePieceEnConflit({ type: 'artefact', piece: { ...artefactEx(9, 'archetype'), intangible: true } }, fr);
  egal(intangible, 'Artéfact (Type : Intangible)', 'un artéfact intangible le dit, quelle que soit sa valeur lue');
  egal(conflitsGroupe([b, eq('x', 'faille/raid', 'Raid A', [monstreEx('x1', 9, null, null), monstreEx('x2', 9, null, null)])]).especes, [],
    'deux fois l’espèce dans une même équipe : pas un conflit de groupe');
  // Former un groupe depuis la page.
  const formes = appliquerGroupe(toutes, 'faille', null, 'Raid B', new Set(['s', 'a', 'o']), T);
  egal(formes.map((e) => e.groupe ?? null), ['Raid A', 'Raid B', 'Raid B', 'Raid A'], 'les équipes cochées de l’onglet, même d’un autre groupe ; jamais hors de l’onglet');
  const modifie = appliquerGroupe(toutes, 'faille', 'Raid A', 'Raid C', new Set(['b']), T);
  egal(modifie.map((e) => e.groupe ?? null), ['Raid A', null, null, 'Raid C'], 'renommer : une équipe décochée quitte le groupe');
  egal(appliquerGroupe(toutes, 'faille', 'Raid A', '', new Set(), T).map((e) => e.groupe ?? null), ['Raid A', null, null, null],
    'supprimer le groupe : ses équipes de l’onglet restent, sans groupe');
  egal(nomGroupeLibre(['Groupe 1', 'Groupe 3'], (n) => `Groupe ${n}`), 'Groupe 2', 'le premier nom libre');
}

// Les prépas RTA (décision de l'utilisateur, 2026-11-22) : un ensemble de
// monstres, sans leader, ni speed tune, ni groupe.
function testEquipesEnregistreesPrepas() {
  titre('Mes équipes — prépas RTA');
  const T = new Date('2026-11-06T10:00:00Z');
  const monstres = (n: number) => Array.from({ length: n }, (_, k) => monstreEx(`p${k}`, k + 1, null, null));
  const prepa = { ...creerEquipe('p', 'rta', 'Prépa', T0), monstres: monstres(12) };
  ok(lireEquipeEnregistree(JSON.parse(JSON.stringify(prepa))) !== null, 'une prépa de douze monstres se relit');
  ok(lireEquipeEnregistree({ ...prepa, monstres: monstres(1) }) !== null, 'un monstre suffit à une prépa');
  ok(lireEquipeEnregistree({ ...prepa, onglet: 'cairos', monstres: monstres(1) }) === null, 'pas à une équipe');
  ok(lireEquipeEnregistree({ ...prepa, monstres: monstres(MONSTRES_MAX_PREPA + 1) }) === null, 'au-delà du garde-fou, illisible');
  const ancienne = { ...creerEquipe('a', 'arene/offense', 'RTA', T0), onglet: 'arene/rta', monstres: monstres(3), leader: 'p0' };
  const lue = lireEquipeEnregistree(ancienne);
  egal([lue?.equipe.onglet, lue?.equipe.leader, lue?.signalements], ['rta', null, []], 'une ancienne équipe RTA se relit en prépa, sans leader ni signalement');
  egal(gesteSurBrouillon({ ...prepa, monstres: [] }, (e, n) => ajouterMonstre(e, monstreEx('x', 9, null, null), n)!, T).aEnregistrer?.monstres.length, 1,
    'le brouillon d’une prépa s’enregistre dès son premier monstre');
  ok(designerLeader(prepa, 'p0', T) === prepa, 'une prépa n’a pas de leader');
  ok(deplacerVersOnglet(prepa, 'arene/offense', T) === prepa, 'une prépa ne devient pas une équipe');
  const equipe = { ...creerEquipe('e', 'arene/offense', 'E', T0), monstres: monstres(2) };
  ok(deplacerVersOnglet(equipe, 'rta', T) === equipe, 'ni une équipe une prépa');
  egal(monstresMax('rta'), MONSTRES_MAX_PREPA, 'une prépa n’a pas la limite d’une équipe');
  const lie = { ...prepa, leader: 'p0', groupe: 'G', lienOptimizer: { listId: 'l', equipeId: 'q', correspondance: [] } };
  const n = normaliserPrepa(lie);
  egal([n.leader, 'groupe' in n, 'lienOptimizer' in n], [null, false, false], 'une équipe créée dans la RTA y perd ce qu’une prépa ne porte pas');
  ok(normaliserPrepa(equipe) === equipe, 'ailleurs, rien ne change');
}

// Le nombre de monstres d'une équipe par contenu (règle de jeu relevée par
// l'utilisateur, 2026-11-22).
function testEquipesEnregistreesTaille() {
  titre('Mes équipes — monstres par équipe selon le contenu');
  const cas: [OngletEquipes, number][] = [
    ['arene/offense', 4], ['arene', 4], ['guilde/defense-siege', 3], ['guilde/offense-siege', 3], ['guilde/offense-gdg', 3], ['guilde/defense-gdg', 3], ['guilde', 3],
    ['cairos/geant', 5], ['labyrinthe/boss', 5], ['labyrinthe/sauvetage', 4], ['labyrinthe', 5], ['temple-chaos/feu', 5], ['faille/raid', 6],
    ['passage-dimensions/karzhan', 4], ['passage-dimensions/raid', 5], ['passage-dimensions', 5], ['subjugation/eau', 5], ['subjugation', 5], ['toa', 5],
  ];
  egal(cas.map(([o]) => monstresMax(o)), cas.map(([, n]) => n), 'la limite de chaque rangement ; sans catégorie, la plus grande de l’onglet');
  const T = new Date('2026-11-06T10:00:00Z');
  const quatre = { ...creerEquipe('q', 'arene/offense', 'Q', T), monstres: [1, 2, 3, 4].map((k) => monstreEx(`m${k}`, k, null, null)) };
  ok(ajouterMonstre(quatre, monstreEx('m5', 5, null, null), T) === null, 'à la limite du contenu, l’ajout est refusé');
  ok(ajouterMonstre({ ...quatre, onglet: 'cairos' }, monstreEx('m5', 5, null, null), T) !== null, 'sous elle, accepté');
  ok(!tropDeMonstres(quatre) && tropDeMonstres(quatre, 'guilde/defense-siege'), 'trop de monstres pour la défense de siège');
}

export const verificationsEquipesEnregistrees: [string, () => void][] = [
  testEquipesEnregistreesRelecture, testEquipesEnregistreesComparaison, testEquipesEnregistreesOperations, testEquipesEnregistreesRecherche,
  testEquipesEnregistreesCategories, testEquipesEnregistreesGroupes, testEquipesEnregistreesTaille, testEquipesEnregistreesPrepas,
].map((f) => [f.name, f]);
