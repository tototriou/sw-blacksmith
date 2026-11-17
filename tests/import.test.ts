// Extraction d'un export SWEX. Deux propriétés à ne pas perdre :
//  - un fichier passé en TEXTE et le même passé en OBJET donnent exactement le
//    même résultat (c'est ce qui autorise le parse unique) ;
//  - la date affichée est celle de l'EXPORT, pas celle de l'import.

import {
  parseAccountBox,
  parseAccountExportDate,
  parseAccountInventory,
  parseAccountJson,
  parseAccountSource,
  parseSiegeDefense,
  parseSiegeOffense,
  parseArenaDefense,
  parseArenaInterserveurDefense,
  parseArenaOffense,
  parseDimensionDefense,
  parseDimensionOffense,
  parseDimensionRunes,
  parseRuneMarkerLabels,
  parseUsedRuneIds,
  parseUsedRuneIdsParPerimetre,
  parseWizardId,
  unionRunesUtilisees,
} from '../src/lib/importAccount';
import { estJournalSwex, lireSaisonDimension, saisonDeLInvocateur } from '../src/lib/journalSwex';
import { areneClassiqueVide, equipesAreneClassique, equipesDimension } from '../src/lib/applyAccount';
import type { Monster } from '../src/types';
import { formatRelicUnique } from '../src/lib/effects';
import { egal, exportReel, exportExemplairesMultiples, exportSynthetique, ignore, journalSwexMiniature, journalSwexReel, ok, titre } from './outils';
import { fr } from '../src/i18n/fr';

export default function testImport() {
  titre('Import de compte');

  const texte = exportSynthetique();
  const objet = parseAccountSource(texte)!;

  /* --- Contenu attendu du fichier d'exemple --------------------------- */

  const box = parseAccountBox(objet, fr);
  egal(box.monsters.length, 2, 'box : seules les unités montées 6★ sont retenues');
  egal(box.monsters[0].com2usId, 15105, 'box : com2usId lu depuis unit_master_id');

  // ⚠️ **La propriété unique d'une relique n'est pas une substat.** Elle
  // déclenche un effet proportionnel à une stat (« +2 % par tranche de
  // 27 000 »), et `sec_effect` porte donc TYPE, TRANCHE et POURCENTAGE. Lue
  // comme un `{ code, value }`, elle affichait « Effet secondaire · 27000 » : le
  // pourcentage était perdu, et le nombre montré n'était pas une valeur mais un
  // diviseur.
  const relique = box.monsters[0].gear?.relic;
  egal(relique?.main, { code: 100, value: 11 }, 'relique : la stat principale reste un PV%');
  egal(
    relique?.unique,
    { type: 12, tranche: 27000, percent: 2 },
    'relique : type, tranche et pourcentage sont tous les trois lus'
  );

  // La tranche s'affiche AVEC son unité quand le type est connu (27 000 ne peut
  // être que des PV), et sans unité sinon — jamais avec une unité devinée.
  // ⚠️ Le séparateur de milliers est celui du FRANÇAIS (`toLocaleString`), une
  // espace insécable étroite — pas l'espace ordinaire du clavier. L'écrire en
  // dur dans l'attendu faisait échouer un test dont les deux chaînes
  // s'affichaient pourtant identiques.
  // ⚠️ **Aucun signe dans le repli** : le type 1 accorde « +1% de DGTS
  // infligés », le type 6 retranche « -1% de DGTS reçus », et le fichier écrit
  // `1` dans les deux cas. Le sens appartient au type ; l'inventer se trompait
  // une fois sur deux.
  egal(
    formatRelicUnique(relique!.unique!),
    `[DEF +2% tous les ${(27000).toLocaleString('fr-FR')} pts du max des PV] au début du combat`,
    'relique : la propriété unique s’écrit dans les mots du jeu'
  );
  // ⚠️ Le jeu annonce que d'autres propriétés seront ajoutées : un type inconnu
  // ne doit ni disparaître ni mentir. On donne la mécanique, sans le SIGNE ni la
  // stat — qui appartiennent au type.
  egal(
    formatRelicUnique({ type: 999, tranche: 1000, percent: 1 }),
    `1% par tranche de ${(1000).toLocaleString('fr-FR')}`,
    'relique : un type ajouté par une mise à jour s’affiche sans signe ni stat devinés'
  );
  // Deux types sur la MÊME tranche de PV, en sens opposés : 3 augmente les
  // dégâts infligés, 6 réduit les dégâts reçus. Rien dans le fichier ne les
  // distingue — seule la table le fait.
  egal(
    formatRelicUnique({ type: 3, tranche: 27000, percent: 1 }),
    `DGTS infligés +1% tous les ${(27000).toLocaleString('fr-FR')} pts du max des PV au début du combat`,
    'relique : le type 3 augmente les dégâts infligés'
  );
  // ⚠️ Toutes les propriétés uniques ne sont pas des dégâts : le type 14 accorde
  // une STAT, crochets du jeu compris.
  egal(
    formatRelicUnique({ type: 14, tranche: 200, percent: 2 }),
    '[Max des PV +2% tous les 200 pts de VIT] au début du combat',
    'relique : une propriété qui accorde une stat garde la ponctuation du jeu'
  );
  // ⚠️ **La magnitude ne distingue PAS l'ATQ de la DEF** : le type 1 compte
  // « par 1000 pts d'ATQ », le type 5 « par 2500 pts de DEF » — même courbe,
  // deux stats. C'est pourquoi les types de cette famille jamais lus en jeu
  // (2, 15) restent SANS unité, au lieu d'hériter de celle de leurs voisins.
  egal(
    formatRelicUnique({ type: 5, tranche: 2500, percent: 1 }),
    `DGTS reçus -1% tous les ${(2500).toLocaleString('fr-FR')} pts de DEF au début du combat`,
    'relique : le type 5 compte en DEF, pas en ATQ comme son voisin de même échelle'
  );
  egal(
    formatRelicUnique({ type: 2, tranche: 2500, percent: 1 }),
    `DGTS infligés +1% tous les ${(2500).toLocaleString('fr-FR')} pts de DEF au début du combat`,
    'relique : même effet que le type 1, mais compté en DEF — la tranche seule ne le disait pas'
  );
  // Le type 6 est une RÉDUCTION : le fichier écrit 1, le jeu affiche « -1% ».
  egal(
    formatRelicUnique({ type: 6, tranche: 27000, percent: 1 }),
    `DGTS reçus -1% tous les ${(27000).toLocaleString('fr-FR')} pts du max des PV au début du combat`,
    'relique : un effet en RÉDUCTION s’affiche avec son signe, qui vient du type et non du fichier'
  );
  // ⚠️ **Les six types lus en jeu vérifient la table officielle**, dont l'ordre
  // EST la numérotation du champ `type`. Si un jour cet ordre bouge, ce sont ces
  // six-là qui le diront — chacun a été relevé sur une pièce réelle.
  egal(
    formatRelicUnique({ type: 1, tranche: 1000, percent: 1 }),
    `DGTS infligés +1% tous les ${(1000).toLocaleString('fr-FR')} pts d'ATQ au début du combat`,
    'relique : type 1 — Conquête · ATQ (+9 Conquête Aiguisé)'
  );
  egal(
    formatRelicUnique({ type: 7, tranche: 250, percent: 2 }),
    '[ATQ +2% tous les 250 pts de VIT] au début du combat',
    'relique : type 7 — Bravoure · VIT (+5 Bravoure Agile)'
  );
  // Sans pourcentage (fichier partagé par une version antérieure), la phrase du
  // jeu serait incomplète : on retombe sur la formule.
  egal(
    formatRelicUnique({ type: 1, tranche: 1000 }),
    `par tranche de ${(1000).toLocaleString('fr-FR')} ATQ`,
    'relique : sans pourcentage connu, on retombe sur la formule plutôt que d’écrire une phrase trouée'
  );

  const inv = parseAccountInventory(objet, fr);
  egal(inv.runes.length, 8, 'inventaire : runes équipées ET en réserve, dédupliquées');
  egal(inv.artifacts.length, 3, 'inventaire : artéfacts équipés ET en réserve');

  /* --- Inventaire de reliques ------------------------------------------- */

  // data.relics porte 4 pièces, dont 7001 (équipée par l'unité 101, présente
  // AUSSI dans unit.relics[0]) : le dédoublonnage par rid ne doit pas la
  // compter deux fois.
  egal(inv.relics.length, 4, 'inventaire : reliques dédupliquées entre data.relics et unit.relics[0]');
  const parId = new Map(inv.relics.map((r) => [r.id, r]));
  egal(
    parId.get(7001),
    { id: 7001, upgrade: 8, main: { code: 100, value: 11 }, unique: { type: 12, tranche: 27000, percent: 2 } },
    'relique 7001 : id et upgrade portés par le type, en plus de main/unique'
  );
  // 7002 : sec_effect à deux éléments seulement → `percent` ABSENT, jamais 0.
  egal(
    parId.get(7002),
    { id: 7002, upgrade: 5, main: { code: 101, value: 8 }, unique: { type: 7, tranche: 250 } },
    'relique 7002 : pourcentage illisible → percent absent, pas 0'
  );
  // 7004 : aucun sec_effect → propriété unique illisible, la pièce reste dans
  // l'inventaire (l'import ne la rejette pas).
  egal(
    parId.get(7004),
    { id: 7004, upgrade: 0, main: { code: 100, value: 3 } },
    'relique 7004 : propriété unique illisible → pièce conservée, unique absent'
  );

  // 7003 : upgrade_curr = 3 (donc pri_effect[1] attendu 6), mais le fichier
  // porte 99 — écart compté, jamais reconstruit (`game-data-curation`).
  egal(inv.relicUpgradeMismatches, 1, 'inventaire : un seul écart upgrade + 3 sur les 4 pièces');
  egal(
    parId.get(7003)?.main,
    { code: 102, value: 99 },
    'relique 7003 : la valeur de la principale reste celle DE `pri_effect`, jamais recalculée'
  );

  // Occupation : uniquement l'unité 101 porte 7001 ; jamais déduite de
  // `data.relics.length` (les trois autres pièces sont en inventaire seul).
  egal(inv.relicUsageById, { 7001: 1 }, 'inventaire : occupation comptée sur les unités, pas sur data.relics');

  const rta = parseAccountJson(objet, fr);
  egal(rta.units!.length, 2, 'RTA : les favoris, et eux seuls');

  const def = parseSiegeDefense(objet, fr);
  egal(def.decks!.length, 2, 'siège défense : les decks configurés');
  egal(def.decks![0].slots.filter(Boolean).length, 2, 'siège défense : un slot vide reste vide');

  const off = parseSiegeOffense(objet, fr);
  egal(off.decks!.length, 1, 'siège attaque : seuls les decks de type 22');
  egal(off.decks![0].slots[0]!.com2usId, 14314, 'siège attaque : le leader est en tête');
  egal(off.decks![0].slots.length, 3, 'siège attaque : trois places');

  // Arène : des decks de 4 places. Le fichier d'exemple porte une attaque de
  // type 1 (unité 101), une défense classique (unité 102, ids nus) et une
  // défense interserveur (101 en position 1 et 102 en position 2, listées
  // dans le désordre).
  const com2us = (d: { slots: ({ com2usId: number } | null)[] }) => d.slots.map((s) => s?.com2usId ?? null);
  const offArene = parseArenaOffense(objet, fr);
  egal(offArene.decks.map(com2us), [[15105, null, null, null]], 'arène attaque : les decks de type 1, sur 4 places');
  egal(com2us(parseArenaDefense(objet, fr).decks[0]), [14314, null, null, null], 'arène défense : defense_deck_info, sur 4 places');
  egal(
    com2us(parseArenaInterserveurDefense(objet, fr).decks[0]),
    [15105, 14314, null, null],
    'arène interserveur : l’ordre des positions, la position 1 en leader'
  );
  ok(
    parseArenaInterserveurDefense(objet, fr).decks[0].slots[0]!.flatRuneSpeed > 0,
    'arène interserveur : les runes du preset de la défense'
  );
  const sansArene = { ...objet, deck_list: [], defense_deck_info: undefined, server_arena_defense_deck_info: undefined };
  egal(
    [parseArenaOffense(sansArene, fr).error, parseArenaDefense(sansArene, fr).error, parseArenaInterserveurDefense(sansArene, fr).error],
    [fr.importCompte.sansOffenseArene, fr.importCompte.sansDefenseArene, fr.importCompte.sansDefenseInterserveur],
    'arène : sans ses données, chaque lecture dit ce qui manque'
  );

  /* --- Arène dimensionnelle : la box du journal SWEX -------------------- */

  // Le journal miniature : une saison périmée, puis la saison à lire, puis une
  // dernière occurrence tronquée (journal coupé en cours d'écriture).
  const journal = journalSwexMiniature();
  ok(estJournalSwex(journal) && !estJournalSwex(texte), 'journal SWEX : reconnu, et un export ne l’est pas');
  const saison = lireSaisonDimension(journal);
  egal(
    saison?.defense_deck_info?.unit_id_list,
    [[900002, 900001, 0, 0]],
    'journal SWEX : la dernière saison lisible, pas la tronquée ni la périmée'
  );
  egal(lireSaisonDimension(JSON.stringify(saison))?.unit_list?.length, 3, 'journal SWEX : la réponse seule se lit aussi');
  egal(lireSaisonDimension(texte), null, 'journal SWEX : un export de compte n’est pas une saison');
  const defDim = parseDimensionDefense(saison, fr).decks[0];
  egal(com2us(defDim), [15105, 14314, null, null], 'dimension défense : defense_deck_info, leader en tête, 4 places');
  // 900001 sans rune : tout le build par défaut de 14314 (VIT 42 + 15,
  // Violent + Volonté).
  egal(
    [defDim.slots[1]!.flatRuneSpeed, [...defDim.slots[1]!.sets].sort(), defDim.slots[1]!.gear!.runes.length],
    [57, ['violent', 'will'], 6],
    'dimension défense : un monstre sans rune porte le build par défaut de son espèce'
  );
  // 900002 : ses runes gagnées en 5 et 6, le build par défaut de 15105 en 1 à
  // 4 (VIT 42 + 10 + 20 meulée +3 = 75) ; les VIT 30 des runes par défaut 5
  // et 6 ne comptent pas.
  egal(
    [defDim.slots[0]!.flatRuneSpeed, defDim.slots[0]!.swift, defDim.slots[0]!.gear!.runes.map((r) => r.slot)],
    [75, true, [1, 2, 3, 4, 5, 6]],
    'dimension défense : un emplacement sans rune gagnée prend la rune par défaut, les autres gardent la leur'
  );
  // Les runes gagnées : l'inventaire du mode et celles des monstres de la box,
  // pas celles des builds par défaut.
  egal(
    parseDimensionRunes(saison).map((r) => r.id).sort(),
    [2000005, 2000006, 2000100],
    'dimension runes : l’inventaire et les runes portées, sans les builds par défaut'
  );
  egal(parseDimensionRunes(null), [], 'dimension runes : sans saison, aucune');
  egal(
    [parseDimensionDefense(null, fr).error, parseDimensionDefense({ defense_deck_info: { unit_id_list: [[123, 0, 0, 0]] } }, fr).error],
    [fr.importCompte.sansDefenseDimension, fr.importCompte.defenseDimensionVide],
    'dimension défense : sans saison, ou sans monstre connu, la lecture le dit'
  );

  // L'attaque : les équipes de type 28 de l'export, résolues dans la box.
  const avecAttaqueDim = {
    ...objet,
    deck_recent_list: [
      { type: 1, sub_type: 1, unit_id_list: [101, 0, 0, 0], leader_unit_id: 101, equip: [] },
      { type: 28, sub_type: 1, unit_id_list: [900001, 900003, 900002, 0, 0, 0, 0, 0], leader_unit_id: 900002, equip: [] },
    ],
  };
  egal(
    parseDimensionOffense(avecAttaqueDim, saison, fr).decks.map(com2us),
    [[15105, 14314, 14314, null]],
    'dimension attaque : les équipes de type 28, leader en tête'
  );
  egal(
    [parseDimensionOffense(avecAttaqueDim, null, fr).error, parseDimensionOffense(objet, saison, fr).error],
    [fr.importCompte.offenseDimensionSansJournal, fr.importCompte.sansOffenseDimension],
    'dimension attaque : sans journal, ou sans équipe de type 28, la lecture le dit'
  );

  // Ce que l'app applique à chaque saison du dossier SW Exporter : la défense
  // et les attaques, avec les monstres de l'app.
  const monstre = (id: string, speed: number) => ({ id, name: id, element: 'wind', stats: { speed } }) as unknown as Monster;
  const parCom2us = new Map<number, Monster>([[14314, monstre('m14314', 100)], [15105, monstre('m15105', 105)]]);
  const dim = equipesDimension(saison!, avecAttaqueDim.deck_recent_list, parCom2us, fr);
  egal(
    [dim.defense.teams.map((e) => e.slots.map((s) => s.monsterId)), dim.offense.teams.length, dim.defense.missing + dim.offense.missing],
    [[['m15105', 'm14314', null, null]], 1, 0],
    'dimension : la défense et les attaques, prêtes pour les états'
  );

  // L'arène classique, prête pour les états — partagée par l'import complet et
  // le rattrapage du dossier SW Exporter (arène vide).
  const classique = equipesAreneClassique(objet, parCom2us, fr);
  egal(
    [classique.defense.teams.length, classique.offense.teams.length, classique.interserveur.teams.length],
    [1, 1, 1],
    'arène classique : défense, offense et interserveur de l’export'
  );
  ok(
    areneClassiqueVide({ defense: [], offense: [], interserveur: [] }) &&
      !areneClassiqueVide({ defense: [], offense: [{}], interserveur: [] }),
    'arène classique vide : aucune équipe d’aucun côté, et elle seule'
  );

  /* --- Runes utilisées (decks tous contenus + RTA) --------------------- */

  // Le fichier d'exemple couvre les quatre chemins d'un coup :
  //  - preset RTA (1001-1003 + 9002, dont une rune qui dort en INVENTAIRE) ;
  //  - preset de défense de siège (1001-1003, 2001-2002) ;
  //  - deck de type 22 avec `equip` (1001, 1004, 2001) ;
  //  - deck ordinaire SANS preset (unité 101) → ses runes actuellement portées.
  // Reste dehors : 9001, en réserve et posée nulle part.
  const utilisees = parseUsedRuneIds(objet);
  egal(
    utilisees,
    [1001, 1002, 1003, 1004, 2001, 2002, 9002],
    'runes utilisées : decks (tous types) + presets RTA et siège'
  );
  ok(
    !utilisees.includes(9001),
    "runes utilisées : une rune de réserve posée nulle part n'y est pas"
  );
  // ⚠️ Une rune de l'INVENTAIRE peut jouer : les presets RTA/siège ne
  // déplacent rien en jeu. S'en tenir à `occupied_id` aurait raté ce cas.
  ok(utilisees.includes(9002), 'runes utilisées : une rune de réserve montée en RTA compte');

  // Par périmètre — chaque source dans le sien, avec la même règle « preset,
  // sinon ce que l'unité porte ». Le fichier d'exemple ajoute :
  //  - défense d'arène (`defense_deck_info`, unité 102 sans preset) ;
  //  - défense d'arène de serveur (unité 101, preset 1004, ids en objets) ;
  //  - un deck de type 3 (ni siège ni arène) → « autres ».
  const parPerimetre = parseUsedRuneIdsParPerimetre(objet);
  egal(parPerimetre.rta, [1001, 1002, 1003, 2001, 2002, 9002], 'périmètre RTA : les presets RTA');
  egal(parPerimetre['siege-defense'], [1001, 1002, 1003, 2001, 2002], 'périmètre siège — défense');
  egal(parPerimetre['siege-attaque'], [1001, 1004, 2001], 'périmètre siège — attaque : deck_type 22');
  egal(
    parPerimetre['arene-attaque'],
    [1001, 1002, 1003, 1004],
    'périmètre arène — attaque : deck_type 1, sans preset → runes portées'
  );
  egal(
    parPerimetre['arene-defense'],
    [1004, 2001, 2002],
    'périmètre arène — défense : les deux défenses, ids nus et en objets'
  );
  egal(parPerimetre.autres, [2001, 2002], 'périmètre autres : tout autre deck_type');
  egal(unionRunesUtilisees(parPerimetre), utilisees, 'l’union des périmètres = les runes utilisées');
  egal(
    unionRunesUtilisees(parPerimetre, ['siege-attaque', 'arene-defense']),
    [1001, 1004, 2001, 2002],
    'union restreinte aux périmètres choisis'
  );
  egal(parseUsedRuneIdsParPerimetre('{oops').rta, [], 'fichier illisible → périmètres vides');

  /* --- Marqueurs de runes (rune_lock_list + markers) -------------------- */

  // ⚠️ Le marqueur n'est PAS dans l'objet rune : il vient de `rune_lock_list`.
  // Une rune absente de la liste n'a pas de marqueur — le champ reste absent.
  const inventaire = parseAccountInventory(objet, fr).runes;
  const marqueDe = (id: number) => inventaire.find((r) => r.id === id)?.marker;
  egal(marqueDe(1002), 1, 'marqueur : rune équipée marquée');
  egal(marqueDe(9001), 3, 'marqueur : rune d’inventaire marquée');
  egal(marqueDe(2001), 7, 'marqueur : numéro sans libellé conservé');
  ok(
    !('marker' in inventaire.find((r) => r.id === 1001)!),
    'marqueur : absent de la liste → champ absent, jamais 0'
  );
  // Même donnée sur l'équipement des monstres de la box : une rune ne change
  // pas de marqueur selon l'endroit où on la regarde.
  const rune1002Box = box.monsters[0].gear?.runes.find((r) => r.id === 1002);
  egal(rune1002Box?.marker, 1, 'marqueur : aussi sur l’équipement de la box');

  egal(
    parseRuneMarkerLabels(objet),
    { 1: 'Target reap', 3: 'meule' },
    'libellés : type 1 seulement, espaces retirés, libellé vide absent'
  );
  egal(parseRuneMarkerLabels('{oops'), {}, 'libellés : fichier illisible → aucun');
  egal(parseUsedRuneIds('{oops'), [], 'fichier illisible → aucune rune utilisée');

  /* --- Texte et objet : strictement équivalents ------------------------ */

  // ⚠️ C'est cette égalité qui autorise `App` à ne parser qu'une fois. Si elle
  // casse, l'app entière lit des données différentes de ce que testent les
  // lignes ci-dessus.
  for (const [nom, fn] of [
    ['RTA', (s: Parameters<typeof parseAccountJson>[0]) => parseAccountJson(s, fr)],
    ['box', (s: Parameters<typeof parseAccountBox>[0]) => parseAccountBox(s, fr)],
    ['inventaire', (s: Parameters<typeof parseAccountInventory>[0]) => parseAccountInventory(s, fr)],
    ['siège défense', (s: Parameters<typeof parseSiegeDefense>[0]) => parseSiegeDefense(s, fr)],
    ['siège attaque', (s: Parameters<typeof parseSiegeOffense>[0]) => parseSiegeOffense(s, fr)],
    ['runes utilisées', parseUsedRuneIds],
  ] as const) {
    ok(
      JSON.stringify(fn(texte)) === JSON.stringify(fn(objet)),
      `${nom} : appel par texte identique à l'appel par objet`
    );
  }

  /* --- Fichiers illisibles --------------------------------------------- */

  egal(parseAccountJson('{oops', fr).error, 'Fichier JSON illisible.', 'JSON cassé → message clair');
  ok(
    /unit_list/.test(parseAccountJson('[]', fr).error ?? ''),
    "racine inattendue → on parle de 'unit_list', plus utile qu'« illisible »"
  );

  /* --- Date de l'export ------------------------------------------------ */

  const date = parseAccountExportDate(objet);
  egal(date, 1786261890 * 1000, 'date lue depuis tvalue (et non tvaluelocal)');
  // ⚠️ Garde-fous : sans eux, un champ absent ou dans une autre unité afficherait
  // une date absurde à l'utilisateur, qui la croirait.
  egal(parseAccountExportDate('{"unit_list":[]}'), null, 'pas de tvalue → aucune date');
  egal(parseAccountExportDate('{"tvalue":1786261890000}'), null, 'tvalue en millisecondes → rejetée');
  egal(parseAccountExportDate('{"tvalue":1}'), null, 'tvalue antérieure au jeu → rejetée');

  /* --- Identité du compte (wizard_id) ----------------------------------- */

  // ⚠️ C'est CETTE valeur (pas `tvalue`) qui distingue un réexport du même
  // compte (même wizard_id, autre date) d'un compte réellement différent —
  // voir App.tsx, `appliquerImport` (réinitialisation de l'exclusion
  // manuelle de runes de l'Optimizer).
  egal(parseWizardId('{"wizard_id":6399149}'), 6399149, 'wizard_id lu depuis la racine');
  egal(parseWizardId('{"unit_list":[]}'), null, 'pas de wizard_id → aucune identité');
  egal(parseWizardId('{"wizard_id":0}'), null, 'wizard_id à zéro → rejeté (jamais un vrai compte)');
  egal(parseWizardId('{"wizard_id":"abc"}'), null, 'wizard_id non numérique → rejeté');

  /* --- L'exemplaire, pas l'espèce --------------------------------------- */

  // Deux unit_id du MÊME com2usId (15105) portent des reliques différentes.
  // Box, RTA et défense de siège doivent chacun retrouver la BONNE relique
  // pour le BON unit_id — jamais celle de l'autre exemplaire, jamais celle
  // « du » com2usId (il n'y en a pas une seule).
  const exemplaires = parseAccountSource(exportExemplairesMultiples())!;

  const boxExemplaires = parseAccountBox(exemplaires, fr).monsters;
  egal(boxExemplaires.length, 2, 'deux exemplaires 6★ du même com2usId, tous deux retenus');
  const gearParUnitId = new Map(boxExemplaires.map((m) => [m.unitId, m.gear]));
  egal(gearParUnitId.get(201)?.relic?.id, 9101, 'Box : unit_id 201 → sa propre relique');
  egal(gearParUnitId.get(202)?.relic?.id, 9102, 'Box : unit_id 202 → sa propre relique, pas celle de 201');

  const rtaExemplaires = parseAccountJson(exemplaires, fr);
  egal(rtaExemplaires.units?.length, 1, 'RTA : seul le favori (unit_id 201) est retenu');
  egal(rtaExemplaires.units?.[0]?.gear?.relic?.id, 9101, 'RTA : même relique que la Box pour ce unit_id');

  // Défense de siège : le deck place 201 puis 202 (guildsiege_defense_deck_unit_list) —
  // l'ordre des slots reflète l'ordre du preset, chaque slot garde SA relique.
  const siegeExemplaires = parseSiegeDefense(exemplaires, fr).decks!;
  egal(siegeExemplaires.length, 1, 'siège : un deck configuré');
  const slotsExemplaires = siegeExemplaires[0]?.slots ?? [];
  egal(slotsExemplaires[0]?.gear?.relic?.id, 9101, 'siège : premier slot (unit_id 201) → sa relique');
  egal(slotsExemplaires[1]?.gear?.relic?.id, 9102, 'siège : second slot (unit_id 202) → sa relique, pas celle du premier');

  /* --- Sur l'export réel, quand il est là ------------------------------ */

  const reel = exportReel();
  if (!reel) {
    ignore("cohérence sur l'export réel", 'export du développeur absent, gitignoré');
    return;
  }
  const reelObjet = parseAccountSource(reel)!;
  ok(parseAccountBox(reelObjet, fr).monsters.length > 100, 'export réel : la box 6★ est extraite');
  ok(parseAccountInventory(reelObjet, fr).runes.length > 1000, 'export réel : l’inventaire de runes est extrait');
  const d = parseAccountExportDate(reelObjet);
  ok(d !== null && d < Date.now(), 'export réel : date d’export plausible');
  const w = parseWizardId(reelObjet);
  ok(w !== null && w > 0, 'export réel : wizard_id plausible');
  // Un compte réel fait jouer une PART de son stock : ni zéro (les decks
  // seraient mal lus), ni tout (le filtre ne servirait à rien).
  const utiliseesReelles = parseUsedRuneIds(reelObjet);
  const totalRunes = parseAccountInventory(reelObjet, fr).runes.length;
  ok(
    utiliseesReelles.length > 0 && utiliseesReelles.length < totalRunes,
    `export réel : ${utiliseesReelles.length} runes utilisées sur ${totalRunes}`
  );
  const parPerimetreReel = parseUsedRuneIdsParPerimetre(reelObjet);
  egal(
    unionRunesUtilisees(parPerimetreReel),
    utiliseesReelles,
    'export réel : l’union des périmètres = les runes utilisées'
  );
  ok(
    parPerimetreReel['arene-attaque'].length > 0 && parPerimetreReel['siege-attaque'].length > 0,
    `export réel : arène — attaque ${parPerimetreReel['arene-attaque'].length}, siège — attaque ${parPerimetreReel['siege-attaque'].length}`
  );
  const marquees = parseAccountInventory(reelObjet, fr).runes.filter((r) => r.marker !== undefined).length;
  ok(marquees > 0, `export réel : ${marquees} runes marquées`);
  // Arène : des attaques de 4 monstres (15 relevées), et deux défenses pleines.
  // Leur leader n'est pas forcément le même : le joueur compose chacune.
  const offAreneReel = parseArenaOffense(reelObjet, fr).decks;
  ok(
    offAreneReel.length > 0 && offAreneReel.every((dk) => dk.slots.length === 4 && dk.slots[0] !== null),
    `export réel : ${offAreneReel.length} attaques d'arène, leader en tête, sur 4 places`
  );
  const defReel = parseArenaDefense(reelObjet, fr).decks[0];
  const interReel = parseArenaInterserveurDefense(reelObjet, fr).decks[0];
  ok(
    !!defReel && !!interReel && defReel.slots.every(Boolean) && interReel.slots.every(Boolean),
    'export réel : défense d’arène et défense interserveur pleines'
  );

  // Arène dimensionnelle : la défense du journal réel, pleine, chaque monstre
  // avec 6 runes (les siennes ou celles du build par défaut) ; l'attaque de
  // type 28 de l'export, résolue dans sa box.
  const journalReel = journalSwexReel();
  if (!journalReel) {
    ignore('journal réel : box dimensionnelle', 'journal SWEX réel (full_log.txt) absent');
    return;
  }
  const saisonReelle = lireSaisonDimension(journalReel);
  ok(
    saisonDeLInvocateur(journalReel, Number(parseWizardId(reelObjet))) !== null,
    'journal réel : la saison de l’invocateur de l’export (celle que lit l’application de bureau)'
  );
  const defDimReel = parseDimensionDefense(saisonReelle, fr).decks[0];
  ok(
    !!defDimReel && defDimReel.slots.every((s) => s !== null && s.gear!.runes.length === 6),
    'journal réel : défense dimensionnelle pleine, 6 runes par monstre'
  );
  const offDimReel = parseDimensionOffense(reelObjet, saisonReelle, fr);
  ok(
    offDimReel.decks.length > 0 && offDimReel.decks.every((dk) => dk.slots.every((s) => s !== null)),
    `journal réel : ${offDimReel.decks.length} attaque(s) dimensionnelle(s) de l'export, résolue(s) dans la box ${offDimReel.error ?? ''}`
  );
}
