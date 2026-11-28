// Réserve de meules et de gemmes : décodage de l'export, puis la seule question
// qui compte — « ce plan, je peux l'appliquer MAINTENANT ? ».
//
// ⚠️ Se tromper ici est silencieux et coûteux : une rune annoncée faisable
// envoie le joueur ouvrir le jeu pour rien, une rune écartée à tort lui cache
// le meilleur chantier de sa soirée.

import { parseCrafts } from '../src/lib/importAccount';
import {
  buildCraftStock,
  craftLabel,
  craftsToSpend,
  missingCrafts,
  ownsCraft,
  pickCraft,
  etatsReserve,
  planEnReserve,
  planFaisable,
  GRADE_SCENARIO,
  GRADES_RESERVE,
  reserveDesGrades,
  scenarioDeLaReserve,
} from '../src/lib/crafts';
import { GemmeChoix, gemmeAmeliore, planNeeds, runePlan, runePotential } from '../src/lib/runeOptim';
import { CraftLine, RuneDetail } from '../src/types';
import { convertirPalier } from '../src/hooks/useRuneMetric';
import { egal, ignore, ok, titre, exportReel } from './outils';

const stock = (lignes: Partial<CraftLine>[]) =>
  buildCraftStock(
    lignes.map((l) => ({
      kind: 'grind',
      setKey: 'violent',
      stat: 8,
      grade: 5,
      ancient: false,
      amount: 1,
      ...l,
    })) as CraftLine[]
  );

export default function testMeules() {
  titre("Décodage de la réserve (rune_craft_item_list)");

  // `craft_type_id` = <set><stat><grade>, les deux derniers sur deux chiffres.
  const brut = {
    unit_list: [],
    rune_craft_item_list: [
      { craft_type: 2, craft_type_id: 130804, amount: 3 }, // meule Violent VIT héroïque
      { craft_type: 1, craft_type_id: 251204, amount: 1 }, // gemme Intangible Précision héroïque
      { craft_type: 4, craft_type_id: 990805, amount: 2 }, // meule immémoriale VIT légendaire
      { craft_type: 6, craft_type_id: 30815, amount: 1 }, // meule antique Swift VIT légendaire
      { craft_type: 2, craft_type_id: 130805, amount: 0 }, // lot vide
      { craft_type: 9, craft_type_id: 130805, amount: 5 }, // famille inconnue
    ],
  };
  const lignes = parseCrafts(brut);
  egal(lignes.length, 4, 'lot vide et famille inconnue écartés');
  egal(
    lignes[0],
    { kind: 'grind' as const, setKey: 'violent', stat: 8, grade: 4, ancient: false, amount: 3 },
    'type pair → meule ; set, stat et grade décodés'
  );
  egal(lignes[1].kind, 'gem', 'type impair → gemme');
  egal(lignes[1].stat, 12, 'stat sur DEUX chiffres (12 = Précision), pas 1 puis 2');
  egal(lignes[2].setKey, null, 'immémorial → aucun set, utilisable partout');
  // ⚠️ Le grade antique est décalé de 10 dans les données, comme le rank d'une
  // rune antique. Le garder tel quel comparerait 15 à 5 et rendrait tout
  // infaisable en silence.
  egal(lignes[3], { kind: 'grind' as const, setKey: 'swift', stat: 8, grade: 5, ancient: true, amount: 1 },
    'consommable antique : grade ramené sur l’échelle 1-5');

  egal(parseCrafts({ unit_list: [] }), [], 'export sans réserve → liste vide, pas une erreur');

  titre('Disponibilité d’un consommable');

  const s = stock([
    { kind: 'grind' as const, setKey: 'violent', stat: 8, grade: 4 },
    { kind: 'grind' as const, setKey: null, stat: 4, grade: 5 },
    { kind: 'gem' as const, setKey: 'swift', stat: 8, grade: 5, ancient: true },
  ]);
  const q = (o: Parameters<typeof ownsCraft>[1]) => ownsCraft(s, o);

  ok(q({ kind: 'grind' as const, setKey: 'violent', stat: 8, grade: 4, ancient: false }), 'le grade exact convient');
  ok(q({ kind: 'grind' as const, setKey: 'violent', stat: 8, grade: 3, ancient: false }), 'un grade supérieur convient');
  ok(
    !q({ kind: 'grind' as const, setKey: 'violent', stat: 8, grade: 5, ancient: false }),
    'un grade inférieur ne convient PAS : une meule héroïque n’atteint pas le max légendaire'
  );
  ok(!q({ kind: 'grind' as const, setKey: 'will', stat: 8, grade: 4, ancient: false }), 'meule d’un autre set → non');
  ok(!q({ kind: 'gem' as const, setKey: 'violent', stat: 8, grade: 4, ancient: false }), 'une meule ne fait pas gemme');

  // ⚠️ Sans la seconde consultation, l'immémorial serait invisible et des
  // chantiers réels passeraient pour bloqués.
  ok(
    q({ kind: 'grind' as const, setKey: 'nemesis', stat: 4, grade: 5, ancient: false }),
    'un immémorial couvre n’importe quel set'
  );
  ok(
    !q({ kind: 'grind' as const, setKey: 'nemesis', stat: 4, grade: 5, ancient: true }),
    'mais pas une rune antique : l’immémorial n’existe pas en antique'
  );
  ok(
    !q({ kind: 'gem' as const, setKey: 'swift', stat: 8, grade: 5, ancient: false }),
    'un consommable antique ne va pas sur une rune normale'
  );

  // ⚠️ Le filtre « Sans les immémoriaux » de l'Optimisation ne touche NI
  // `ownsCraft` NI `pickCraft` : il retire les lignes `setKey === null` en amont
  // de `buildCraftStock` (voir RunesOptim). Ce qui suit vérifie que retirer les
  // lignes suffit — sinon le filtre mentirait en laissant passer une rune que
  // seul un immémorial rendait faisable.
  const sansImmemoriaux = stock(
    [
      { kind: 'grind' as const, setKey: 'violent', stat: 8, grade: 4 },
      { kind: 'grind' as const, setKey: null, stat: 4, grade: 5 },
    ].filter((l) => l.setKey !== null)
  );
  ok(
    ownsCraft(sansImmemoriaux, { kind: 'grind' as const, setKey: 'violent', stat: 8, grade: 4, ancient: false }),
    'réserve sans immémoriaux : le stock du set reste disponible'
  );
  ok(
    !ownsCraft(sansImmemoriaux, { kind: 'grind' as const, setKey: 'nemesis', stat: 4, grade: 5, ancient: false }),
    'réserve sans immémoriaux : ce que seul un immémorial couvrait ne l’est plus'
  );
  egal(sansImmemoriaux.total, 1, 'réserve sans immémoriaux : le total suit, il ne les compte plus');
  ok(q({ kind: 'gem' as const, setKey: 'swift', stat: 8, grade: 5, ancient: true }), 'et va bien sur une antique');

  egal(craftLabel({ kind: 'grind' as const, stat: 8 }), 'meule VIT', 'le manque se lit sans décoder un code');

  titre('Ce qu’un plan réclame, confronté à la réserve');

  // Rune Violent slot 2, VIT non meulée : le plan « meule seule » réclame une
  // meule VIT (et rien d'autre — les autres substats ne sont pas meulables).
  const rune: RuneDetail = {
    id: 1,
    slot: 2,
    set: 'violent',
    rank: 6,
    rarity: 5,
    level: 15,
    main: { code: 8, value: 42 },
    subs: [
      { code: 8, value: 5, grind: 0 },
      { code: 9, value: 6 },
      { code: 11, value: 7 },
      { code: 12, value: 8 },
    ],
  };
  const besoins = planNeeds(runePlan(rune, 'legend', false, 'eff'));
  egal(besoins, [{ kind: 'grind' as const, stat: 8 }], 'meule seule → une meule VIT, TC/RES/PRE non meulables');

  const avec = stock([{ kind: 'grind' as const, setKey: 'violent', stat: 8, grade: 5 }]);
  egal(missingCrafts(besoins, rune, GRADE_SCENARIO.legend, avec), [], 'réserve suffisante → rien ne manque');
  egal(
    missingCrafts(besoins, rune, GRADE_SCENARIO.legend, stock([{ stat: 4 }])).map(craftLabel),
    ['meule VIT'],
    'réserve à côté de la plaque → le manque est nommé'
  );
  // ⚠️ Le scénario héroïque se contente d'un grade 4 : confondre les deux
  // écarterait des runes parfaitement meulables ce soir.
  egal(
    missingCrafts(
      planNeeds(runePlan(rune, 'hero', false, 'eff')),
      rune,
      GRADE_SCENARIO.hero,
      stock([{ kind: 'grind' as const, setKey: 'violent', stat: 8, grade: 4 }])
    ),
    [],
    'une meule héroïque suffit au plan héroïque'
  );

  // ⚠️ Le slot GEMMÉ réclame AUSSI sa meule : poser une gemme remet la meule à
  // zéro. Une rune déjà meulée sur ce slot passerait sinon pour faisable sans
  // meule.
  const gemmee: RuneDetail = {
    ...rune,
    subs: [
      { code: 8, value: 25, grind: 20 }, // VIT déjà meulée au max
      { code: 9, value: 6 },
      { code: 11, value: 7 },
      { code: 12, value: 8 },
    ],
  };
  const avecGemme = planNeeds(runePlan(gemmee, 'legend', true, 'eff'));
  const gemStat = avecGemme.find((n) => n.kind === 'gem')?.stat;
  ok(gemStat != null, 'le plan avec gemme réclame bien une gemme');
  ok(
    avecGemme.some((n) => n.kind === 'grind' && n.stat === gemStat),
    'et la meule de la stat gemmée, dont le meulage repart de zéro'
  );

  titre('Réserve du compte réel');

  const reel = exportReel();
  if (!reel) {
    ignore('lecture de la réserve réelle', 'export gitignoré, absent de cette machine');
  } else {
    const lots = parseCrafts(reel);
    ok(lots.length > 0, 'la réserve est extraite du vrai export');
    ok(
      lots.every((l) => l.grade >= 1 && l.grade <= 5),
      'aucun grade hors échelle 1-5 (le décalage antique est bien absorbé)'
    );
    // Les meules n'existent que pour les stats meulables ; l'inverse
    // signalerait un décodage de famille erroné.
    const MEULABLES = new Set([1, 2, 3, 4, 5, 6, 8]);
    ok(
      lots.filter((l) => l.kind === 'grind').every((l) => MEULABLES.has(l.stat)),
      'aucune meule sur une stat non meulable — les familles sont bien séparées'
    );
    ok(
      lots.some((l) => l.kind === 'gem' && !MEULABLES.has(l.stat)),
      'des gemmes portent des stats non meulables (TC/DCC/RES/PRE), comme dans le jeu'
    );
  }
}

// Registre de dépenses : ce qu'on déclare avoir utilisé en jeu, sans réexporter.
//
// ⚠️ C'est ici que se cachent les erreurs SILENCIEUSES : un décompte qui rate,
// et l'app propose des runes qu'on n'a plus de quoi améliorer, sans le moindre
// message. Le test le plus important est celui de l'épuisement.
export function testRegistre() {
  titre('Réserve moins les dépenses déclarées');

  const lignes: CraftLine[] = [
    { kind: 'grind' as const, setKey: 'violent', stat: 8, grade: 4, ancient: false, amount: 1 },
    { kind: 'grind' as const, setKey: 'violent', stat: 8, grade: 5, ancient: false, amount: 2 },
  ];
  const q = { kind: 'grind' as const, setKey: 'violent', stat: 8, grade: 4, ancient: false };

  ok(ownsCraft(buildCraftStock(lignes), q), 'sans dépense, la meule est disponible');

  // ⚠️ Le grade SUFFISANT LE PLUS BAS est servi en premier : l'héroïque avant
  // les légendaires. Piocher au hasard grillerait un légendaire pour rien.
  const choisi = pickCraft(buildCraftStock(lignes), q);
  egal(choisi, { setKey: 'violent', grade: 4 }, 'le grade suffisant le plus bas est retenu');

  const apres1 = buildCraftStock(lignes, { 'grind|violent|8|4|n': 1 });
  egal(
    pickCraft(apres1, q),
    { setKey: 'violent', grade: 5 },
    'héroïque épuisée → on se rabat sur la légendaire'
  );

  // ⚠️ LE test : tout dépenser doit rendre la rune infaisable. C'est le cas
  // d'usage : meuler une Violent, ne plus s'en voir proposer.
  const vide = buildCraftStock(lignes, { 'grind|violent|8|4|n': 1, 'grind|violent|8|5|n': 2 });
  ok(!ownsCraft(vide, q), 'tout dépensé → plus rien de disponible');
  egal(vide.total, 0, 'et la réserve affichée tombe bien à zéro');

  // Une dépense supérieure au stock (registre incohérent) ne doit pas produire
  // un reste négatif qui rendrait la réserve « infinie » au comptage.
  const trop = buildCraftStock(lignes, { 'grind|violent|8|5|n': 99 });
  egal(trop.total, 1, 'dépense supérieure au stock → bornée à zéro, jamais négative');

  titre('Ce qu’un plan consomme');

  const rune: RuneDetail = {
    id: 42,
    slot: 2,
    set: 'violent',
    rank: 6,
    rarity: 5,
    level: 15,
    main: { code: 8, value: 42 },
    subs: [
      { code: 8, value: 5, grind: 0 },
      { code: 9, value: 6 },
      { code: 11, value: 7 },
      { code: 12, value: 8 },
    ],
  };
  const besoins = planNeeds(runePlan(rune, 'hero', false, 'eff'));
  egal(
    craftsToSpend(besoins, rune, GRADE_SCENARIO.hero, buildCraftStock(lignes)),
    ['grind|violent|8|4|n'],
    'on décompte le lot exact qui aurait servi — même règle que la faisabilité'
  );
  egal(
    craftsToSpend(besoins, rune, GRADE_SCENARIO.hero, vide),
    null,
    'réserve épuisée → rien à décompter, et surtout pas la moitié d’un plan'
  );
}

// ⚠️ Le mode « ce que je peux ENCORE poser » (`noDowngrade`), utilisé par le
// filtre « Faisable avec ma réserve ». Il répond à une autre question que le
// potentiel par défaut, et confondre les deux affiche des contradictions : une
// rune annoncée faisable avec un gain négatif.
export function testSansDowngrade() {
  titre('Potentiel sans dégradation de meule');

  // Rune meulée AU MAX LÉGENDAIRE sur la VIT (+5), regardée en héroïque (max +4).
  const meulee: RuneDetail = {
    id: 7,
    slot: 2,
    set: 'violent',
    rank: 6,
    rarity: 5,
    level: 15,
    main: { code: 8, value: 42 },
    subs: [
      { code: 8, value: 12, grind: 5 },
      { code: 9, value: 6 },
      { code: 11, value: 7 },
      { code: 12, value: 8 },
    ],
  };

  const defaut = runePotential(meulee, false, 'eff');
  const sansPerte = runePotential(meulee, false, 'eff', true);

  // Lecture par défaut : « si elle était née héroïque », donc elle y perd.
  ok(defaut.heroGain < 0, 'par défaut, l’héroïque fait PERDRE une rune déjà meulée légendaire');
  // Lecture du filtre : « que puis-je encore lui poser », donc jamais de perte.
  egal(sansPerte.heroGain, 0, 'sans dégradation, l’héroïque n’apporte rien — mais ne retire rien');
  ok(sansPerte.heroEff >= defaut.heroEff, 'et la valeur cible ne descend jamais sous celle par défaut');

  // Le plan affiché doit suivre la même règle, sinon il contredirait le chiffre.
  const plan = runePlan(meulee, 'hero', false, 'eff', true);
  const ligneVit = plan.subs.find((s) => s.code === 8)!;
  egal(ligneVit.grind, 5, 'le plan garde la meule légendaire déjà posée');
  egal(
    runePlan(meulee, 'hero', false, 'eff').subs.find((s) => s.code === 8)!.grind,
    4,
    'alors que par défaut il la redescend au max héroïque'
  );

  // ⚠️ Une rune NON meulée doit donner le même résultat dans les deux modes :
  // l'option ne doit rien changer là où il n'y a rien à préserver.
  const vierge: RuneDetail = { ...meulee, subs: [{ code: 8, value: 7, grind: 0 }, ...meulee.subs.slice(1)] };
  egal(
    runePotential(vierge, false, 'eff', true).heroEff,
    runePotential(vierge, false, 'eff').heroEff,
    'rune sans meule → les deux lectures coïncident'
  );
}

// ⚠️ Conversion du palier au changement de mesure. Un palier qui garde sa
// valeur brute change de sens en changeant d'unité : « 100 » vaut 707 runes en
// efficience et 3 000 en score sur un compte réel. La liste se remplit ou se
// vide toute seule, et on croit à un bug.
export function testPalier() {
  titre('Palier converti d’une mesure à l’autre');

  // 5 runes, valeurs volontairement DÉCORRÉLÉES entre les deux mesures : c'est
  // le cas réel (le rapport score/efficience va de 0,98 à 2,37).
  const paires = [
    { avant: 120, apres: 150 },
    { avant: 110, apres: 260 },
    { avant: 100, apres: 170 },
    { avant: 90, apres: 140 },
    { avant: 80, apres: 300 },
  ];

  // Palier 100 en garde 3 (120, 110, 100) → le nouveau doit en garder 3 aussi :
  // la 3e meilleure valeur « après » est 170.
  egal(convertirPalier(paires, 100), 170, 'la sélection est préservée, pas la valeur');
  egal(paires.filter((p) => p.apres >= convertirPalier(paires, 100)).length, 3, 'et elle garde bien 3 runes');

  egal(convertirPalier(paires, 0), 140, 'palier qui garde tout → le minimum');

  // ⚠️ Un palier qui ne gardait RIEN doit continuer à ne rien garder. Retomber
  // sur le maximum remplirait la liste toute seule.
  const vide = convertirPalier(paires, 999);
  ok(vide > 300, 'palier qui ne garde rien → reste au-dessus du maximum');
  egal(paires.filter((p) => p.apres >= vide).length, 0, 'et ne garde toujours rien');

  egal(convertirPalier([], 100), 100, 'aucune rune → on n’invente pas de conversion');

  // ⚠️ Le cas qui trahit un ratio : palier 120 ne garde QUE la première rune,
  // dont la valeur « après » est 300. Un ratio médian (≈ 1,7) donnerait 204 et
  // en laisserait passer deux — le palier changerait de sens en changeant
  // d'unité, ce qu'on cherche précisément à éviter.
  egal(convertirPalier(paires, 120), 300, 'palier haut : c’est le RANG qui décide, pas un facteur');
  egal(paires.filter((p) => p.apres >= 300).length, 1, 'une seule rune passait, une seule passe encore');
  ok(paires.filter((p) => p.apres >= 204).length === 2, 'là où un ratio en aurait laissé passer deux');
}

export function testGemmeMemeStat() {
  titre('Gemme : la stat de la ligne elle-même est candidate');

  // ⚠️ RÈGLE DU JEU relevée par l'utilisateur, pas déduite : une rune jamais
  // gemmée peut gemmer une ligne PAR SA PROPRE STAT (ATQ% faible → gemme ATQ%).
  // Le calcul l'excluait (« gemme = remplacer par une AUTRE stat »).
  //
  // Montage : PV plat en principale et DEF plat en innée, ATQ% / PV% / DEF% /
  // VIT en substats. Seule autre candidate : l'ATQ plate, qui ne vaut pas
  // l'ATQ% qu'elle remplacerait. Ancienne règle → AUCUNE gemme proposée.
  const vierge: RuneDetail = {
    id: 11,
    slot: 2,
    set: 'violent',
    rank: 6,
    rarity: 5,
    level: 15,
    main: { code: 1, value: 2448 },
    innate: { code: 5, value: 20 },
    subs: [
      { code: 4, value: 5 },
      { code: 2, value: 8 },
      { code: 6, value: 8 },
      { code: 8, value: 6 },
    ],
  };
  const pot = runePotential(vierge, true, 'eff');
  egal(pot.legendGem, 4, 'légendaire : l’ATQ% faible est regemmée en ATQ%');
  egal(pot.heroGem, 4, 'héroïque : idem');
  ok(pot.legendGain > runePotential(vierge, false, 'eff').legendGain, 'et le potentiel dépasse la meule seule');

  const plan = runePlan(vierge, 'legend', true, 'eff');
  const ligne = plan.subs[0];
  ok(ligne.isGem && ligne.fromCode === 4 && ligne.code === 4, 'le plan gemme la ligne ATQ% en ATQ%');
  egal([ligne.base, ligne.grind], [13, 10], 'base de gemme légendaire (13) puis meule légendaire (10)');
  ok(
    planNeeds(plan).some((n) => n.kind === 'gem' && n.stat === 4),
    'le plan réclame une gemme ATQ% à la réserve'
  );

  // Une ligne déjà au-dessus de la base de gemme ne se regemme pas : ce serait
  // une perte, `best` ne la garde pas.
  const haute: RuneDetail = {
    ...vierge,
    subs: [
      { code: 4, value: 25 },
      { code: 2, value: 25 },
      { code: 6, value: 25 },
      { code: 8, value: 22 },
    ],
  };
  egal(runePotential(haute, true, 'eff').legendGem, null, 'lignes au-dessus du max de gemme → aucune gemme');

  // ⚠️ CHOIX PRODUIT, pas règle du jeu : une rune DÉJÀ gemmée garde sa stat,
  // même quand la regemmer vers une autre (ici DEF plat → DEF%, absente de la
  // rune) rapporterait plus. DEF plat déjà à sa base max (40) → rien à faire.
  const gemmee: RuneDetail = {
    ...vierge,
    innate: undefined,
    subs: [
      { code: 5, value: 40, enchant: true },
      { code: 4, value: 8 },
      { code: 2, value: 8 },
      { code: 8, value: 6 },
    ],
  };
  egal(runePotential(gemmee, true, 'eff').legendGem, null, 'rune gemmée : la stat choisie par le joueur n’est pas remplacée');
}

export function testRegemmeDifferent() {
  titre('« Autoriser un regemme différent »');

  // Règles du jeu relevées par l'utilisateur : une rune déjà gemmée peut
  // regemmer sa ligne gemmée avec une AUTRE stat absente de la rune — mais
  // seulement cette ligne-là (une gemme par rune). Par défaut l'outil ne le
  // propose pas (choix produit) ; l'option le lève.
  const base: RuneDetail = {
    id: 21,
    slot: 2,
    set: 'violent',
    rank: 6,
    rarity: 5,
    level: 15,
    main: { code: 1, value: 2448 },
    subs: [],
  };

  // DEF plat gemmée, déjà à sa base max (40) ; DEF% absente de la rune.
  const defPlate: RuneDetail = {
    ...base,
    subs: [
      { code: 5, value: 40, enchant: true },
      { code: 4, value: 8 },
      { code: 2, value: 8 },
      { code: 8, value: 6 },
    ],
  };
  egal(runePotential(defPlate, true, 'eff').legendGem, null, 'éteinte : la DEF plate gemmée reste en place');
  const libre = runePotential(defPlate, true, 'eff', false, true);
  egal(libre.legendGem, 6, 'allumée : la ligne gemmée passe en DEF%');
  ok(libre.legendEff > runePotential(defPlate, true, 'eff').legendEff, 'et le potentiel augmente');

  const plan = runePlan(defPlate, 'legend', true, 'eff', false, true);
  const ligne = plan.subs[0];
  ok(ligne.isGem && ligne.fromCode === 5 && ligne.code === 6, 'le plan remplace la ligne gemmée, pas une autre');
  egal([ligne.base, ligne.grind], [13, 10], 'gemme DEF% légendaire (13) puis meule (10)');
  ok(
    planNeeds(plan).some((n) => n.kind === 'gem' && n.stat === 6),
    'la réserve est interrogée sur une gemme DEF%, plus sur une DEF plate'
  );

  // ⚠️ Seule la ligne DÉJÀ gemmée peut changer : l'ATQ% faible (5) gagnerait
  // plus à devenir DEF%, mais la rune a déjà sa gemme sur la VIT.
  const vitGemmee: RuneDetail = {
    ...base,
    subs: [
      { code: 4, value: 5 },
      { code: 8, value: 10, enchant: true },
      { code: 2, value: 8 },
      { code: 11, value: 8 },
    ],
  };
  const planVit = runePlan(vitGemmee, 'legend', true, 'eff', false, true);
  egal(planVit.gemCode, 6, 'un regemme est bien proposé (VIT → DEF%) — le test ne passe pas à vide');
  ok(
    planVit.subs.every((s, j) => !s.isGem || j === 1),
    'aucune autre ligne que la ligne gemmée n’est regemmée'
  );

  // Rune vierge, au niveau du calcul : `regemLibre` seul n'y change rien, toute
  // ligne y était déjà candidate.
  const vierge: RuneDetail = { ...vitGemmee, subs: vitGemmee.subs.map((s) => ({ ...s, enchant: undefined })) };
  egal(
    runePotential(vierge, true, 'eff', false, true),
    runePotential(vierge, true, 'eff'),
    '`regemLibre` seul : rune jamais gemmée → même potentiel'
  );

  // ⚠️ L'ONGLET Optimisation (choix du mainteneur) : option ÉTEINTE, une rune
  // vierge ne reçoit AUCUNE gemme — changer RES en ATQ% sur une rune qui n'en a
  // pas, c'est déjà un « regemme différent ». L'écran passe
  // `gemmeExistanteSeule = !regemLibre` au potentiel ET au plan.
  const eteinte = runePotential(vierge, true, 'eff', false, false, true);
  egal([eteinte.heroGem, eteinte.legendGem], [null, null], 'éteinte : aucune gemme sur une rune vierge');
  egal(eteinte.legendEff, runePotential(vierge, false, 'eff').legendEff, 'éteinte : rune vierge = meules seules');
  const planEteint = runePlan(vierge, 'legend', true, 'eff', false, false, true);
  ok(planEteint.gemCode === null && planEteint.subs.every((s) => !s.isGem), 'éteinte : le plan détaillé ne gemme aucune ligne');
  const allumee = runePotential(vierge, true, 'eff', false, true, false);
  ok(allumee.legendGem !== null && allumee.legendEff > eteinte.legendEff, 'allumée : la meilleure gemme revient, le potentiel monte');

  // Éteinte, une gemme DÉJÀ posée se relance toujours dans sa stat.
  const vitBasse: RuneDetail = { ...vitGemmee, subs: vitGemmee.subs.map((s) => (s.code === 8 ? { ...s, value: 5 } : s)) };
  const planRelance = runePlan(vitBasse, 'legend', true, 'eff', false, false, true);
  egal(planRelance.gemCode, 8, 'éteinte : la VIT gemmée (5) est relancée en VIT');
  egal(planRelance.subs[1].base, 10, 'à sa base de gemme légendaire (10)');
}

// « Faisable avec ma réserve » choisit les runes, il ne touche pas au calcul :
// le plan est celui d'une réserve sans limite, au max de son grade, et la rune
// est gardée dès qu'UNE de ses lignes se pose avec la réserve — en légendaire,
// un consommable héroïque compte s'il améliore déjà la rune.
export function testPlanFaisable() {
  titre('« Faisable » : au moins une ligne en réserve, calcul inchangé');

  // VIT et ATQ% meulables, les deux autres non : le plan réclame deux meules.
  const rune: RuneDetail = {
    id: 31,
    slot: 2,
    set: 'violent',
    rank: 6,
    rarity: 5,
    level: 15,
    main: { code: 8, value: 42 },
    subs: [
      { code: 8, value: 5, grind: 0 },
      { code: 4, value: 6, grind: 0 },
      { code: 11, value: 7 },
      { code: 12, value: 8 },
    ],
  };
  const plan = (scenario: 'hero' | 'legend') => runePlan(rune, scenario, false, 'eff', true);
  const meule = (stat: number, grade: number) => ({ kind: 'grind' as const, stat, grade });

  const faisable = (p: ReturnType<typeof plan>, r: RuneDetail, s: ReturnType<typeof stock>) => planFaisable(p, r, s, 'eff');
  const etats = (p: ReturnType<typeof plan>, r: RuneDetail, s: ReturnType<typeof stock>) => etatsReserve(p, r, s, 'eff');

  const lesDeux = stock([meule(8, 5), meule(4, 5)]);
  ok(faisable(plan('legend'), rune, lesDeux), 'les deux meules légendaires en réserve : faisable');
  egal(etats(plan('legend'), rune, lesDeux), ['grade', 'grade', null, null], 'chaque ligne meulable marquée en réserve');
  ok(faisable(plan('hero'), rune, lesDeux), 'une meule légendaire sert au plan héroïque (grade ≥ scénario)');

  // UNE ligne suffit : il manque la meule ATQ%, la rune reste, le plan entier.
  const vitSeule = stock([meule(8, 5)]);
  ok(faisable(plan('legend'), rune, vitSeule), 'une seule meule en réserve : faisable');
  egal(etats(plan('legend'), rune, vitSeule), ['grade', 'manque', null, null], 'la meule ATQ% marquée à farmer');
  egal(plan('legend').subs[1].grind, 10, 'le plan garde la meule ATQ% absente du sac (+10)');
  ok(!faisable(plan('legend'), rune, stock([])), 'sac vide : pas faisable');

  // Plan légendaire, meules héroïques : elles améliorent, la rune est gardée,
  // et le calcul reste au max légendaire.
  const heroiques = stock([meule(8, 4), meule(4, 4)]);
  ok(faisable(plan('hero'), rune, heroiques), 'meules héroïques : plan héroïque faisable');
  ok(faisable(plan('legend'), rune, heroiques), 'meules héroïques : plan légendaire gardé, elles améliorent');
  egal(etats(plan('legend'), rune, heroiques), ['heroique', 'heroique', null, null], 'marquées « héroïque seulement »');
  egal(plan('legend').subs[0].grind, 5, 'le plan reste au max légendaire (+5 VIT)');

  // Une meule héroïque qui n'améliore pas — VIT déjà meulée à +4, son max
  // héroïque — ne compte pas pour le plan légendaire.
  const vitHero: RuneDetail = { ...rune, subs: rune.subs.map((s) => (s.code === 8 ? { ...s, value: 9, grind: 4 } : s)) };
  const planVitHero = runePlan(vitHero, 'legend', false, 'eff', true);
  ok(!faisable(planVitHero, vitHero, stock([meule(8, 4)])), 'meule héroïque sur une VIT déjà à +4 : pas faisable');
  ok(faisable(planVitHero, vitHero, stock([meule(8, 5)])), 'la meule légendaire, elle, ajoute (+5)');

  // Rien à poser (tout déjà au max) : écartée, même sac plein.
  const finie: RuneDetail = {
    ...rune,
    subs: rune.subs.map((s) => (s.code === 8 ? { ...s, value: 10, grind: 5 } : s.code === 4 ? { ...s, value: 16, grind: 10 } : s)),
  };
  ok(!faisable(runePlan(finie, 'legend', false, 'eff', true), finie, lesDeux), 'rien à poser : pas faisable');

  // La gemme du plan est celle d'une réserve sans limite, au max légendaire.
  const vierge: RuneDetail = { ...rune, subs: [{ code: 9, value: 6 }, { code: 11, value: 7 }, { code: 12, value: 8 }, { code: 10, value: 5 }] };
  const planGemme = runePlan(vierge, 'legend', true, 'eff', true, true);
  const gemme = planGemme.gemCode!;
  ok(planGemme.gemCode != null, 'rune vierge, regemme libre : une gemme est proposée');
  const gemmeDe = (grade: number) => ({ kind: 'gem' as const, stat: gemme, grade });
  ok(faisable(planGemme, vierge, stock([gemmeDe(5)])), 'la gemme légendaire du plan en réserve : faisable');
  ok(faisable(planGemme, vierge, stock([gemmeDe(4)])), 'la même en héroïque : faisable, elle améliore la rune');
  ok(etats(planGemme, vierge, stock([gemmeDe(4)])).includes('heroique'), 'marquée « héroïque seulement »');
  ok(!faisable(planGemme, vierge, stock([{ kind: 'gem' as const, stat: gemme === 2 ? 4 : 2, grade: 5 }])), 'une autre gemme : pas faisable');
  ok(!faisable(planGemme, vierge, stock([meule(gemme, 5)])), 'la meule de la ligne gemmée sans sa gemme : pas faisable');

  // Une gemme héroïque n'améliore pas une ligne déjà au-dessus de son max :
  // ATQ% gemmée à 12, max héroïque 11, max légendaire 13.
  const atq12: RuneDetail = { ...rune, subs: [{ code: 4, value: 12, enchant: true }, { code: 9, value: 6 }, { code: 11, value: 7 }, { code: 12, value: 8 }] };
  ok(!gemmeAmeliore(atq12, 0, 4, 'hero', null, 'eff'), 'gemme ATQ% héroïque sur ATQ% 12 : n’améliore pas');
  ok(gemmeAmeliore(atq12, 0, 4, 'legend', null, 'eff'), 'gemme ATQ% légendaire : améliore (13)');
}

// Regemme libre : PV%, ATQ% et DEF% ont les mêmes tables, donc le même gain.
// Le plan les propose toutes, le joueur choisit ; le filtre garde la rune si
// l'une d'elles est en réserve, et la montre d'abord.
export function testGemmesMemeGain() {
  titre('Regemme : les gemmes au même gain sont toutes proposées');
  // RES à 5 : la ligne qui gagne le plus à être regemmée.
  const rune: RuneDetail = {
    id: 33,
    slot: 2,
    set: 'violent',
    rank: 6,
    rarity: 5,
    level: 15,
    main: { code: 8, value: 42 },
    subs: [
      { code: 9, value: 6 },
      { code: 10, value: 7 },
      { code: 11, value: 5 },
      { code: 12, value: 8 },
    ],
  };
  const planDe = (choix?: GemmeChoix) => runePlan(rune, 'legend', true, 'eff', true, true, false, choix);
  const plan = planDe();
  egal(plan.gemmes.map((g) => g.code), [2, 4, 6], 'PV%, ATQ% et DEF% au même gain');
  ok(plan.gemmes.every((g) => g.slot === 2), 'toutes sur la ligne RES');
  egal(plan.gemCode, 2, 'sans choix : la première');
  const def = planDe({ slot: 2, code: 6 });
  egal(def.gemCode, 6, 'DEF% choisie : le plan la pose');
  egal(def.targetEff, plan.targetEff, 'et le gain annoncé ne bouge pas');
  egal(planDe({ slot: 0, code: 6 }).gemCode, 2, 'un choix hors des gemmes au même gain est ignoré');
  egal(runePotential(rune, true, 'eff', true, true).legendGem, 2, 'le potentiel nomme toujours la première');

  // Le filtre : la réserve n'a que la DEF% — la rune est gardée, plan DEF%.
  const sacDef = stock([{ kind: 'gem' as const, stat: 6, grade: 5 }]);
  const enReserve = planEnReserve(planDe, rune, sacDef, 'eff');
  ok(enReserve.faisable, 'gemme DEF% en réserve : faisable');
  egal(enReserve.plan.gemCode, 6, 'le plan montré pose la DEF% en réserve');
  ok(!planFaisable(plan, rune, sacDef, 'eff'), 'le plan PV% seul, lui, ne l’était pas');
  const rien = planEnReserve(planDe, rune, stock([]), 'eff');
  ok(!rien.faisable && rien.plan.gemCode === 2, 'sac vide : pas faisable, la première montrée');

  // Gemme figée (regemme éteint) : une ATQ% gemmée à 5 se relance en ATQ%,
  // une seule gemme, rien à choisir.
  const gemmee: RuneDetail = { ...rune, subs: rune.subs.map((s) => (s.code === 11 ? { code: 4, value: 5, enchant: true } : s)) };
  egal(runePlan(gemmee, 'legend', true, 'eff', true, false, true).gemmes.length, 1, 'regemme éteint : une seule gemme');
}

// Les cases « Héroïque » / « Légendaire » de « Faisable avec ma réserve » :
// un grade décoché sort de la réserve — meules ET gemmes —, et un seul grade
// coché impose son scénario au filtre et au plan.
export function testReserveDesGrades() {
  titre('« Faisable » : les grades de consommables cochés');
  const ligne = (l: Partial<CraftLine>): CraftLine =>
    ({ kind: 'grind', setKey: 'violent', stat: 8, grade: 5, ancient: false, amount: 1, ...l }) as CraftLine;
  const lignes = [
    ligne({ grade: 4 }),
    ligne({ grade: 5 }),
    ligne({ kind: 'gem', stat: 4, grade: 5 }),
    ligne({ kind: 'gem', stat: 4, grade: 4, setKey: null }),
  ];
  const tous = new Set<number>(GRADES_RESERVE);
  ok(reserveDesGrades(lignes, tous) === lignes, 'les deux cochés : la réserve entière, rien de retiré');
  egal(reserveDesGrades(lignes, new Set([4])).map((l) => `${l.kind}${l.grade}`), ['grind4', 'gem4'], '« Héroïque » seul : meules ET gemmes héroïques, immémoriaux compris');
  egal(reserveDesGrades(lignes, new Set([5])).map((l) => `${l.kind}${l.grade}`), ['grind5', 'gem5'], '« Légendaire » seul : meules ET gemmes légendaires');
  egal(reserveDesGrades(lignes, new Set()), [], 'aucun coché : réserve vide');

  egal(scenarioDeLaReserve(tous, 'hero'), 'hero', 'les deux cochés : le scénario du tri (héroïque)');
  egal(scenarioDeLaReserve(tous, 'legend'), 'legend', 'les deux cochés : le scénario du tri (légendaire)');
  egal(scenarioDeLaReserve(new Set([4]), 'legend'), 'hero', '« Héroïque » seul : scénario héroïque, même trié en légendaire');
  egal(scenarioDeLaReserve(new Set([5]), 'hero'), 'legend', '« Légendaire » seul : scénario légendaire, même trié en héroïque');
  egal(scenarioDeLaReserve(new Set(), 'legend'), 'legend', 'aucun coché : le tri');

  // Une rune VIT meulable ; dans le sac, UNE meule VIT légendaire. Sans case
  // décochée, le scénario héroïque y puise (grade ≥ scénario). « Héroïque »
  // seul : héroïques STRICTEMENT — la légendaire sort du sac, rien à pousser.
  const rune: RuneDetail = {
    id: 32,
    slot: 2,
    set: 'violent',
    rank: 6,
    rarity: 5,
    level: 15,
    main: { code: 8, value: 42 },
    subs: [
      { code: 8, value: 5, grind: 0 },
      { code: 9, value: 6 },
      { code: 11, value: 7 },
      { code: 12, value: 8 },
    ],
  };
  const sac = [ligne({ grade: 5 })];
  const juger = (grades: Set<number>, lignesSac = sac, tri: 'hero' | 'legend' = 'hero') => {
    const scenario = scenarioDeLaReserve(grades, tri);
    const plan = runePlan(rune, scenario, false, 'eff', true);
    return { plan, faisable: planFaisable(plan, rune, buildCraftStock(reserveDesGrades(lignesSac, grades)), 'eff') };
  };
  ok(juger(tous).faisable && juger(tous).plan.subs[0].grind === 4, 'les deux cochés, trié en héroïque : la meule légendaire sert au plan héroïque (+4)');
  ok(!juger(new Set([4])).faisable, '« Héroïque » seul : la meule légendaire n’est pas utilisée, rune non faisable');
  egal(juger(new Set([4])).plan.subs[0].grind, 4, '… mais le plan héroïque reste entier (+4)');
  ok(juger(new Set([5])).faisable && juger(new Set([5])).plan.subs[0].grind === 5, '« Légendaire » seul, trié en héroïque : plan légendaire (+5)');

  // Une meule VIT HÉROÏQUE, trié en légendaire : les deux cochés, elle compte
  // (elle améliore) ; « Légendaire » seul la sort du sac.
  const sacHero = [ligne({ grade: 4 })];
  ok(juger(tous, sacHero, 'legend').faisable, 'les deux cochés, trié en légendaire : la meule héroïque compte');
  ok(!juger(new Set([5]), sacHero, 'legend').faisable, '« Légendaire » seul : la meule héroïque n’est plus dans le sac');
}
