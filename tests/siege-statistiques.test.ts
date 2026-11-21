// Les statistiques des sièges (src/lib/siegeStatistiques.ts), sur des
// événements FABRIQUÉS de la forme relevée sur un journal réel — aucun nom de
// joueur ni de guilde réel (le dépôt est public).
//
// ⚠️ Ce qui se joue ici : le sens des codes du jeu (`win_lose`, `log_type`,
// `view_battle_deck_info`), établi par recoupement sur un siège joué
// (docs/02-app/siege/statistiques.md). Un code mal lu inverse les victoires
// et les défaites, ou prête au défenseur les monstres de l'attaquant.

import type { EvenementGuilde } from '../plugin-swex/source/guilde';
import {
  anciensMembres,
  attaquesDuJoueur,
  bilanDeLaGuilde,
  defensesAdverses,
  defensesDeLaGuilde,
  defensesDuJoueur,
  bilanDesCombats,
  bilanParJoueur,
  combatsParSiege,
  couleurDeGuilde,
  couleurDePosition,
  comparatifDesGuildes,
  guildeDe,
  guildesDesSieges,
  tourDeBase,
  COMBATS_PAR_PAGE,
  DEFENSES_PAR_PAGE,
  nomDuJoueur,
  pageDe,
  pagesDeCombats,
  courbesDuSiege,
  pointA,
  bornesWr,
  bornesDesValeurs,
  bilanDuMembre,
  defensesQuiBattentLeMembre,
  evolutionDuMembre,
  evolutionDeLaGuilde,
  offensesDuMembre,
  historiqueDesSieges,
  equipesJouees,
  equipesQuiNousBattent,
  estEvenementSiege,
  FILTRE_VIDE,
  filtreActif,
  filtrerCombats,
  filtrerDefenses,
  manquesDuSiege,
  monstresDuSiege,
  releverSieges,
  siegesCumules,
  tableauAttaques,
  tableauDefenses,
  TOUS_LES_SIEGES,
  wrGlissant,
  type AttaqueSiege,
  type DefenseSiege,
  type FiltreSiege,
  type RelevesSiege,
  type SiegeReleve,
} from '../src/lib/siegeStatistiques';
import { egal, ok, titre } from './outils';

const MOI = 1001;
const ALLIE = 1002;
const ENNEMI = 2001;
const ENNEMI2 = 2002;
const NOUS = 501;
const EUX = 502;

const vue = (commande: string, t: number, reponse: Record<string, unknown>, params: Record<string, unknown> = {}): EvenementGuilde => ({
  type: 'vue',
  t,
  commande,
  contenu: /Siege/i.test(commande) ? 'siege' : 'guilde',
  params,
  reponse: { command: commande, ret_code: 0, tvalue: t, ...reponse },
});

const joueurs = [
  { wizard_id: MOI, wizard_name: 'Moi', guild_id: NOUS },
  { wizard_id: ALLIE, wizard_name: 'Allié', guild_id: NOUS },
  { wizard_id: ENNEMI, wizard_name: 'Ennemi', guild_id: EUX },
  { wizard_id: ENNEMI2, wizard_name: 'Ennemi 2', guild_id: EUX },
];
const guildes = (siege: number, match: number, scores: [number, number]) => [
  { siege_id: siege, match_id: match, guild_id: EUX, guild_name: 'Eux', pos_id: 2, match_score: scores[1], match_rank: 1, play_member_count: 2, attack_count: 1, attack_unit_count: 3 },
  { siege_id: siege, match_id: match, guild_id: NOUS, guild_name: 'Nous', pos_id: 1, match_score: scores[0], match_rank: 2, play_member_count: 2, attack_count: 2, attack_unit_count: 6 },
];
const carte = (siege: number, match: number, t: number, defenses = true) =>
  vue(
    'GetGuildSiegeMatchupInfo',
    t,
    {
      match_info: { siege_id: siege, match_id: match, match_start_time: t - 100, match_finish_time: t + 1000 },
      guild_list: guildes(siege, match, [100, 50]),
      wizard_info_list: joueurs,
      defense_deck_list: defenses
        ? [
            { deck_id: 71, wizard_id: MOI, win_count: 1, draw_count: 0, lose_count: 2 },
            { deck_id: 72, wizard_id: ENNEMI, win_count: 3, draw_count: 1, lose_count: 0 },
          ]
        : [],
      defense_deck_assign_list: [
        { base_number: 12, deck_id: 72, status: 1 },
        { base_number: 4, deck_id: 71, status: 1 },
      ],
      // Le type de chaque base : 2 une tour 5★, 3 une tour 4★, 1 ni l'une ni
      // l'autre (relevé sur un siège joué).
      base_list: [
        { base_number: 12, base_type: 2 },
        { base_number: 4, base_type: 3 },
        { base_number: 1, base_type: 1 },
      ],
    },
    { siege_id: siege }
  );
// Une ligne du résumé : chaque combat deux fois, attaque (1) puis défense (2),
// au résultat inversé.
const combat = (att: number, gAtt: number, def: number, gDef: number, t: number, attaqueGagnee: boolean) => [
  { log_type: 1, guild_id: gAtt, wizard_id: att, opp_guild_id: gDef, opp_wizard_id: def, win_lose: attaqueGagnee ? 1 : 2, log_timestamp: t },
  { log_type: 2, guild_id: gDef, wizard_id: def, opp_guild_id: gAtt, opp_wizard_id: att, win_lose: attaqueGagnee ? 2 : 1, log_timestamp: t },
];
const resume = (siege: number, match: number, t: number) =>
  vue(
    'getGuildSiegeMatchBattleLogSummary_v2',
    t,
    {
      guild_list: guildes(siege, match, [120, 60]),
      wizard_info_list: joueurs,
      max_attack_unit_count: 30,
      used_unit_count_list: [
        { wizard_id: MOI, used_unit_count: 6 },
        { wizard_id: ENNEMI, used_unit_count: 3 },
      ],
      wizard_battle_log_list: [
        ...combat(MOI, NOUS, ENNEMI, EUX, t - 50, true),
        ...combat(ENNEMI, EUX, ALLIE, NOUS, t - 40, true),
        ...combat(MOI, NOUS, ENNEMI2, EUX, t - 30, false),
      ],
    },
    { siege_id: siege }
  );

export function testSiegeStatistiquesCodes() {
  titre('siège · statistiques — le sens des codes du jeu');
  const S = 2026110302;
  const M = 2026110302000049;
  const r = releverSieges(MOI, [carte(S, M, 10_000), resume(S, M, 10_100)]);
  egal(r.sieges.length, 1, 'un siège');
  const s = r.sieges[0];
  egal(r.maGuilde, NOUS, 'ma guilde : celle de l’invocateur dans la liste des joueurs');
  egal(s.attaques.length, 3, 'une attaque par ligne de type 1 : la ligne de défense (type 2) est le même combat');
  egal(
    s.attaques.map((x) => [x.attaquant, x.defenseur, x.victoire]),
    [
      [MOI, ENNEMI, true],
      [ENNEMI, ALLIE, true],
      [MOI, ENNEMI2, false],
    ],
    'win_lose 1 = victoire de l’attaquant, 2 = défaite (relevé : seul 1 rapporte des points)'
  );
  egal(s.guildes.map((g) => [g.id, g.position, g.mienne]), [[NOUS, 1, true], [EUX, 2, false]], 'les guildes, par place sur la carte, la mienne marquée');
  egal(s.guildes[0].score, 120, 'la vue la plus récente donne le score (ici le résumé)');
  egal(s.sources, { carte: true, resume: true, journaux: 0, defenses: true }, 'les sources : carte (avec ses défenses) et résumé, aucun journal détaillé');

  const inconnu = releverSieges(MOI, [
    vue('getGuildSiegeMatchBattleLogSummary_v2', 5, {
      guild_list: guildes(S, M, [1, 1]),
      wizard_info_list: joueurs,
      wizard_battle_log_list: [{ log_type: 1, guild_id: NOUS, wizard_id: MOI, opp_guild_id: EUX, opp_wizard_id: ENNEMI, win_lose: 3, log_timestamp: 4 }],
    }),
  ]);
  egal(inconnu.sieges[0].attaques[0].victoire, null, 'un code de résultat jamais relevé reste inconnu, ni victoire ni défaite');
}

export function testSiegeStatistiquesJournaux() {
  titre('siège · statistiques — les journaux de combat détaillés');
  const S = 2026110302;
  const M = 2026110302000049;
  const entree = (log_id: number, extra: Record<string, unknown>) => ({ log_id, siege_id: S, match_id: M, ...extra });
  const journaux = vue('GetGuildSiegeBattleLogByWizardId', 10_200, {
    log_list: [
      {
        battle_log_list: [
          // Mon attaque, vue de mon côté (type 1).
          entree(1, { log_type: 1, wizard_id: MOI, guild_id: NOUS, opp_wizard_id: ENNEMI, opp_guild_id: EUX, win_lose: 1, log_timestamp: 10_050, base_number: 12, view_battle_deck_info: [[101, 102, 103], [201, 202, 203]] }),
          // L'attaque d'un ennemi sur un allié, vue du DÉFENSEUR (type 2) :
          // wizard_id est l'allié, win_lose son résultat à lui.
          entree(2, { log_type: 2, wizard_id: ALLIE, guild_id: NOUS, opp_wizard_id: ENNEMI, opp_guild_id: EUX, win_lose: 2, log_timestamp: 10_060, base_number: 4, view_battle_deck_info: [[301, 302, 303], [401, 402, 403]] }),
        ],
      },
    ],
  });
  const r = releverSieges(MOI, [carte(S, M, 10_000), resume(S, M, 10_100), journaux]);
  const [a1, a2, a3] = r.sieges[0].attaques;
  egal([a1.base, a1.monstres], [12, { attaque: [101, 102, 103], defense: [201, 202, 203] }], 'le détail complète la ligne du résumé du même combat (même heure) : base, monstres [attaque, défense]');
  egal(
    [a2.attaquant, a2.defenseur, a2.victoire, a2.base, a2.monstres?.attaque],
    [ENNEMI, ALLIE, true, 4, [301, 302, 303]],
    'une entrée de défense (type 2) : l’attaquant est opp_wizard_id, le résultat s’inverse, les monstres restent [attaque, défense]'
  );
  egal([a3.base, a3.monstres], [null, null], 'un combat dont le journal n’a pas été ouvert : ni base ni monstres');
  egal(r.sieges[0].sources.journaux, 2, 'deux combats au journal détaillé');
  egal(
    [a1.tour, a2.tour, a3.tour],
    [5, 4, null],
    'la tour de chaque combat, d’après le type de sa base sur la carte (2 → 5★, 3 → 4★) ; base inconnue : tour inconnue'
  );
  const lignes = tableauAttaques(r.sieges[0], NOUS);
  egal(lignes.find((l) => l.joueur.id === MOI)?.parTour, {
    5: { victoires: 1, defaites: 0, total: 1, taux: 100 },
    4: { victoires: 0, defaites: 0, total: 0, taux: null },
  }, 'le tableau par tour : sa victoire sur une tour 5★ ; son attaque à base inconnue n’est dans aucune');

  const sansResume = releverSieges(MOI, [carte(S, M, 10_000), journaux, journaux]);
  egal(sansResume.sieges[0].attaques.length, 2, 'sans le résumé : les seuls combats des journaux, une fois chacun (une entrée revient à chaque ouverture)');
  egal(sansResume.sieges[0].sources.resume, false, 'et la source le dit');
}

export function testSiegeStatistiquesDebuts() {
  titre('siège · statistiques — mes attaques complétées par leur début');
  const S = 2026110302;
  const M = 2026110302000049;
  // Le début d'une attaque : mes monstres (unités entières), ceux de la défense
  // (dans `unit_info`, avec le joueur qui défend), la base dans la requête.
  const debut = (t: number, base: number, defenseur: number, mes: number[], siens: number[]): EvenementGuilde => ({
    type: 'debut',
    t,
    commande: 'BattleGuildSiegeStart_v2',
    contenu: 'siege',
    params: { base_number: base, deck_id: 9 },
    battle_key: t,
    reponse: {
      ret_code: 0,
      tvalue: t,
      guildsiege_my_unit_list: mes.map((m) => ({ unit_master_id: m, wizard_id: MOI })),
      guildsiege_opp_unit_list: siens.map((m, i) => ({ pos_id: i + 1, unit_info: { unit_master_id: m, wizard_id: defenseur } })),
    },
  });
  // Le résumé : MOI→ENNEMI à 10 050, ENNEMI→ALLIE à 10 060, MOI→ENNEMI2 à 10 070.
  const r = releverSieges(MOI, [
    carte(S, M, 10_000),
    debut(10_020, 7, ENNEMI2, [31, 32, 33], [41, 42, 43]),
    debut(10_010, 12, ENNEMI, [11, 12, 13], [21, 22, 23]),
    debut(10_090, 3, ENNEMI, [51, 52, 53], [61, 62, 63]),
    resume(S, M, 10_100),
  ]);
  const [a1, a2, a3] = r.sieges[0].attaques;
  egal([a1.base, a1.monstres], [12, { attaque: [11, 12, 13], defense: [21, 22, 23] }], 'un début se relie à la première de MES attaques qui le suit, contre le même défenseur (relevé : dix sur dix)');
  egal([a3.base, a3.monstres?.attaque], [7, [31, 32, 33]], 'le défenseur départage deux débuts proches : celui contre ENNEMI2 ne prend pas l’attaque contre ENNEMI');
  egal(a2.monstres, null, 'l’attaque d’un autre joueur n’est jamais complétée par mes débuts');
  ok(r.sieges[0].attaques.every((x) => x.monstres?.attaque[0] !== 51), 'un début sans attaque après lui (abandonné, ou pas encore fini) ne se relie à rien');
}

export function testSiegeStatistiquesParticipation() {
  titre('siège · statistiques — les défenses de ma guilde, après la fin du siège');
  const S = 2026110302;
  const M = 2026110302000049;
  // La carte vue APRÈS la fin : sans défenses (relevé réel).
  const sansDefenses = carte(S, M, 10_000, false);
  const r0 = releverSieges(MOI, [sansDefenses, resume(S, M, 10_100)]);
  egal(r0.sieges[0].sources.defenses, false, 'la carte sans défenses : aucune défense connue');
  egal(bilanParJoueur(r0.sieges[0], NOUS)[0].decks, null, 'le bilan dit « inconnu », jamais « 0 deck en défense »');
  egal(manquesDuSiege(r0.sieges[0], 10_500), [], 'mais rien ne « manque » : les défenses se reconstituent d’après les combats (defensesDuJoueur…)');

  // L'écran des défenses de la guilde : il dit de quel siège il parle.
  const participation = vue('GetGuildSiegeParticipationInfo', 10_200, {
    participation_info: { guild_id: NOUS, siege_id: S, match_id: M },
    defense_deck_list: [{ deck_id: 81, wizard_id: ALLIE, win_count: 2, draw_count: 1, lose_count: 0 }],
    defense_deck_assign_list: [{ base_number: 9, deck_id: 81 }],
    wizard_info_list: [{ wizard_id: ALLIE, wizard_name: 'Allié', guild_id: NOUS }],
  });
  const r = releverSieges(MOI, [sansDefenses, resume(S, M, 10_100), participation]);
  const s = r.sieges[0];
  egal(s.defenses.map((d) => [d.deck, d.joueur, d.guilde, d.bases, d.victoires, d.nuls, d.defaites]), [[81, ALLIE, NOUS, [9], 2, 1, 0]], 'les défenses de ma guilde, du même match, avec leurs bases');
  egal(manquesDuSiege(s, 10_500), [], 'plus rien ne manque');
  const ailleurs = vue('GetGuildSiegeParticipationInfo', 10_300, { participation_info: { guild_id: NOUS, siege_id: 1, match_id: 1 }, defense_deck_list: [{ deck_id: 99, wizard_id: MOI }] });
  egal(releverSieges(MOI, [sansDefenses, ailleurs]).sieges.find((x) => x.matchId === M)?.defenses, [], 'celles d’un autre match ne s’y mêlent pas');
}

export function testSiegeStatistiquesFiltres() {
  titre('siège · statistiques — les filtres : résultat, monstres, côté');
  const combat = (t: number, victoire: boolean | null, monstres: AttaqueSiege['monstres']): AttaqueSiege => ({
    t, attaquant: MOI, guildeAttaquante: NOUS, defenseur: ENNEMI, guildeDefense: EUX, victoire, base: null, monstres, points: null, tour: null,
  });
  const A = combat(1, true, { attaque: [1, 2, 3], defense: [7, 8, 9] });
  const B = combat(2, false, { attaque: [1, 4, 5], defense: [2, 8, 6] });
  const C = combat(3, true, null);
  const D = combat(4, null, { attaque: [9, 2, 1], defense: [3, 4, 5] });
  const tous = [A, B, C, D];
  const f = (x: Partial<FiltreSiege>): FiltreSiege => ({ ...FILTRE_VIDE, ...x });

  egal(filtrerCombats(tous, FILTRE_VIDE), tous, 'sans filtre : tout');
  egal(filtrerCombats(tous, f({ resultat: 'victoires' })), [A, C], 'victoires : les combats gagnés, monstres connus ou non');
  egal(filtrerCombats(tous, f({ resultat: 'defaites' })), [B], 'défaites : un résultat inconnu n’en est pas une');
  egal(filtrerCombats(tous, f({ monstres: [1] })), [A, B, D], 'un monstre : les combats où il est, d’un côté ou de l’autre');
  egal(filtrerCombats(tous, f({ monstres: [1, 2] })), [A, D], 'deux monstres : ils doivent être TOUS les deux dans la même équipe');
  egal(filtrerCombats(tous, f({ monstres: [2], cote: 'defense' })), [B], 'côté défense : seulement dans l’équipe qui défend');
  egal(filtrerCombats(tous, f({ monstres: [2], cote: 'attaque', resultat: 'victoires' })), [A], 'les filtres se cumulent');
  ok(!filtrerCombats(tous, f({ monstres: [1] })).includes(C), 'un combat aux monstres inconnus ne passe jamais un filtre de monstres');

  egal(bilanDesCombats([A, B, C, D]), { n: 4, victoires: 2, defaites: 1, taux: (100 * 2) / 3 }, 'le bilan : le taux sur les seuls résultats connus');
  egal(bilanDesCombats([]).taux, null, 'aucun combat : pas de taux');

  const def = (deck: number, monstres: number[] | null): DefenseSiege => ({ deck, joueur: ENNEMI, guilde: EUX, bases: [], victoires: 0, nuls: 0, defaites: 0, monstres });
  const defenses = [def(1, [7, 8, 9]), def(2, null), def(3, [8, 1, 2])];
  egal(filtrerDefenses(defenses, f({ monstres: [8] })).map((d) => d.deck), [1, 3], 'les défenses qui ont le monstre (inconnues exclues)');
  egal(filtrerDefenses(defenses, f({ monstres: [8], cote: 'attaque' })).map((d) => d.deck), [1, 2, 3], 'chercher « en attaque » ne filtre pas les défenses');
  egal(filtrerDefenses(defenses, f({ resultat: 'defaites' })).length, 3, 'le résultat ne filtre pas les défenses');

  const s = releverSieges(MOI, [carte(2026110302, 2026110302000049, 10_000), resume(2026110302, 2026110302000049, 10_100)]).sieges[0];
  egal(monstresDuSiege({ ...s, attaques: [A, B], defenses: [def(5, [8, 6, 10])] }), [8, 1, 2, 6, 3, 4, 5, 7, 9, 10], 'les monstres du siège : les plus fréquents d’abord');
  ok(!filtreActif(FILTRE_VIDE) && filtreActif(f({ monstres: [1] })) && filtreActif(f({ resultat: 'victoires' })), 'un filtre est actif dès qu’il retient quelque chose');

  // Siège par siège, et par pages.
  const s1 = { ...s, matchId: 1, attaques: [A, B] };
  const s2 = { ...s, matchId: 2, attaques: [C] };
  const s3 = { ...s, matchId: 3, attaques: [D] };
  egal(
    combatsParSiege([s1, s2, s3], (x) => x.attaques, FILTRE_VIDE).map((g) => [g.siege.matchId, g.attaques]),
    [[1, [A, B]], [2, [C]], [3, [D]]],
    'les combats siège par siège, dans l’ordre des sièges'
  );
  egal(
    combatsParSiege([s1, s2, s3], (x) => x.attaques, f({ resultat: 'defaites' })).map((g) => g.siege.matchId),
    [1],
    'le filtre s’applique dans chaque siège ; un siège sans combat retenu n’a pas de groupe'
  );
  egal(pageDe([1, 2, 3, 4, 5, 6, 7], 0, 3), { page: 0, pages: 3, elements: [1, 2, 3] }, 'une page de trois');
  egal(pageDe([1, 2, 3, 4, 5, 6, 7], 2, 3), { page: 2, pages: 3, elements: [7] }, 'la dernière page, incomplète');
  egal(pageDe([1, 2], 5, 3), { page: 0, pages: 1, elements: [1, 2] }, 'une page qui n’existe plus (filtre) : ramenée dans les bornes');
  egal(pageDe([], 0, 3), { page: 0, pages: 1, elements: [] }, 'rien : une page vide, pas zéro page');

  // Des pages d'au plus N combats, jamais d'un nombre de sièges : un siège coupé reprend à la suivante.
  const groupes = combatsParSiege([s1, s2, s3], (x) => x.attaques, FILTRE_VIDE);
  egal(
    pagesDeCombats(groupes, 2).map((p) => p.map((m) => [m.groupe.siege.matchId, m.attaques.length, m.suite])),
    [[[1, 2, false]], [[2, 1, false], [3, 1, false]]],
    'deux combats par page : le premier siège remplit la page, les deux suivants partagent la seconde'
  );
  egal(
    pagesDeCombats(groupes, 1).map((p) => p.map((m) => [m.groupe.siege.matchId, m.suite])),
    [[[1, false]], [[1, true]], [[2, false]], [[3, false]]],
    'un siège plus long qu’une page reprend à la suivante, marqué « suite » ; son groupe reste entier (son bilan)'
  );
  ok(pagesDeCombats(groupes, 1)[1][0].groupe.attaques.length === 2, 'la suite garde le siège entier pour son bilan');
  egal(pagesDeCombats([]), [], 'aucun combat : aucune page');
  ok(COMBATS_PAR_PAGE <= 30 && DEFENSES_PAR_PAGE <= 30, 'des pages bornées : un siège relevé compte 204 combats aux monstres connus');

  // La carte : la couleur d'une guilde par sa place, le numéro d'une tour par sa base.
  const g = (position: number | null, mienne = false) => ({ id: 1, nom: '', position, rang: null, score: null, membres: null, attaques: null, monstresUtilises: null, mienne });
  egal([couleurDeGuilde(g(1, true), 0, 1), couleurDeGuilde(g(2), 1, 1), couleurDeGuilde(g(3), 2, 1)], ['bleue', 'rouge', 'jaune'], 'ma guilde en position 1 : elle en bleu, la 2 en rouge, la 3 en jaune — comme sur la carte du jeu (relevé)');
  egal(
    [couleurDeGuilde(g(2, true), 0, 2), couleurDeGuilde(g(3), 1, 2), couleurDeGuilde(g(1), 2, 2)],
    ['bleue', 'rouge', 'jaune'],
    'ma guilde TOUJOURS en bleu, quelle que soit sa place ; les autres lues depuis la mienne (SUPPOSÉ : la carte tourne ainsi)'
  );
  egal([couleurDePosition(2, 2), couleurDePosition(3, 2), couleurDePosition(1, 2)], ['bleue', 'rouge', 'jaune'], 'les territoires des tours aussi : le mien en bleu');
  egal([couleurDeGuilde(g(null, true), 2), couleurDeGuilde(g(null), 1)], ['bleue', 'rouge'], 'place inconnue : ma guilde en bleu, les autres dans l’ordre de la carte');
  // Relevé en jeu : le journal des combats du siège relevé, comparé aux bases relevées.
  egal(
    [18, 23, 25, 9, 10, 13].map(tourDeBase),
    [
      { position: 2, numero: 4 },
      { position: 2, numero: 9 },
      { position: 2, numero: 12 },
      { position: 1, numero: 5 },
      { position: 1, numero: 9 },
      { position: 1, numero: 10 },
    ],
    'relevé en jeu : bases 18, 23, 25 = tours rouges 4, 9, 12 ; bases 9, 10, 13 = tours bleues 5, 9, 10 — le numéro n’est PAS le rang de la base'
  );
  egal(
    [1, 14, 27].map(tourDeBase),
    [
      { position: 1, numero: 'QG' },
      { position: 2, numero: 'QG' },
      { position: 3, numero: 'QG' },
    ],
    'les bases par blocs de 13, un par position, QG en tête (établi sur le siège relevé)'
  );
  egal(tourDeBase(2), { position: 1, numero: null }, 'un rang dont le numéro n’est pas relevé : pas de numéro inventé');
  egal(tourDeBase(31), { position: 3, numero: 4 }, 'SUPPOSÉ : la même table pour les trois territoires (rang 4 du troisième bloc)');
  egal([tourDeBase(0), tourDeBase(1.5)], [null, null], 'une base invalide n’a pas de tour');
  egal([couleurDePosition(2), couleurDePosition(4)], ['rouge', null], 'la couleur d’un territoire ; au-delà de trois, aucune');

  // Les guildes nommées à côté des joueurs : la place dans CE siège d'abord.
  const ancien = { ...s, guildes: [{ ...g(2), id: 7, nom: 'Avant' }] };
  const recent = { ...s, guildes: [{ ...g(3), id: 7, nom: 'Après' }] };
  const connues = guildesDesSieges([recent, ancien]);
  egal(connues.get(7), { nom: 'Après', couleur: 'jaune', mienne: false }, 'une guilde vue dans plusieurs sièges : sa version la plus récente');
  egal(guildeDe(ancien, 7, connues), { nom: 'Avant', couleur: 'rouge', mienne: false }, 'dans un siège, sa place dans ce siège');
  egal(guildeDe({ ...s, guildes: [] }, 7, connues), { nom: 'Après', couleur: 'jaune', mienne: false }, 'le cumul (sans guildes) : le repli');
  egal(guildeDe({ ...s, guildes: [] }, 8, connues), null, 'une guilde inconnue : rien');

  const doublon = { ...s, joueurs: [{ id: 7, nom: 'Premier', guilde: NOUS }, { id: 7, nom: 'Second', guilde: EUX }] };
  egal([nomDuJoueur(doublon, 7), nomDuJoueur(doublon, 7), nomDuJoueur(doublon, 8)], ['Premier', 'Premier', null], 'les noms indexés : le premier joueur d’un identifiant l’emporte, un inconnu reste inconnu');
}

export function testSiegeStatistiquesEnsemble() {
  titre('siège · statistiques — la vue d’ensemble : bilan, courbe, monstres, historique');
  const S = 2026110302;
  const M = 2026110302000049;
  const r = releverSieges(MOI, [carte(S, M, 10_000), resume(S, M, 10_100)]);
  const s = r.sieges[0];

  // Le résumé : MOI gagne contre ENNEMI (10 050), ENNEMI gagne contre ALLIE
  // (10 060), MOI perd contre ENNEMI2 (10 070). Défenses de NOUS : deck 71
  // (1 V, 0 N, 2 D).
  const b = bilanDeLaGuilde(s, NOUS);
  egal([b.attaques.n, b.attaques.victoires, b.attaques.defaites, b.attaques.taux], [2, 1, 1, 50], 'le bilan en attaque de ma guilde');
  egal(
    b.defenses,
    { n: 1, tenus: 0, perdus: 1, tenue: 0 },
    'ses défenses d’après les COMBATS du siège (ENNEMI a battu ALLIE), jamais d’après les compteurs des decks (1 V, 2 D), qui ne sont pas ceux du siège'
  );
  egal(bilanDeLaGuilde({ ...s, sources: { ...s.sources, resume: false } }, NOUS).defenses, null, 'sans le résumé des combats : pas de taux inventé');

  egal(
    courbesDuSiege(s).map((c) => [c.guilde, c.points.map((p) => [p.t, p.attaques, p.victoires, p.wr])]),
    [
      [NOUS, [[9_900, 0, 0, null], [10_050, 1, 1, 100], [10_070, 2, 1, 50]]],
      [EUX, [[9_900, 0, 0, null], [10_060, 1, 1, 100]]],
    ],
    'les courbes : un départ à zéro au début du siège, puis un point par attaque — faites, gagnées, WR cumulés ; pas de WR avant la première'
  );
  const pts = courbesDuSiege(s)[0].points;
  egal([pointA(pts, 10_000).attaques, pointA(pts, 10_060).attaques, pointA(pts, 99_999).wr], [0, 1, 50], 'le point à une heure : le dernier atteint');
  const avecWr = (...wr: (number | null)[]) => [{ points: wr.map((w, i) => ({ t: i, attaques: i, victoires: 0, defaites: 0, wr: w })) }];
  egal(bornesWr(courbesDuSiege(s)), { bas: 50, haut: 100 }, 'l’échelle du WR, centrée sur ses valeurs : de la dizaine sous le plus bas à celle au-dessus du plus haut');
  egal(bornesWr(avecWr(null, 66.7, 86.1)), { bas: 60, haut: 90 }, 'arrondie aux dizaines');
  egal(bornesWr(avecWr(83, 85)), { bas: 80, haut: 100 }, 'au moins 20 points d’écart, sans dépasser 100');
  egal(bornesWr(avecWr(2, 5)), { bas: 0, haut: 20 }, 'ni descendre sous 0');
  egal(bornesWr(avecWr(null)), { bas: 0, haut: 100 }, 'sans aucun WR : 0 à 100');

  const combat = (victoire: boolean, attaque: number[], defense: number[]): AttaqueSiege => ({
    t: 1, attaquant: MOI, guildeAttaquante: NOUS, defenseur: ENNEMI, guildeDefense: EUX, victoire, base: null, monstres: { attaque, defense }, points: null, tour: null,
  });
  const avecMonstres = {
    ...s,
    attaques: [
      combat(true, [1, 2, 3], [7, 8, 9]),
      combat(false, [2, 3, 1], [7, 8, 9]),
      combat(true, [3, 1, 2], [4, 5, 6]),
      combat(false, [1, 2, 4], [9, 7, 8]),
      combat(false, [1, 2, 4], [4, 5, 6]),
      combat(true, [1, 2, 4], [5, 6, 10]),
      { ...combat(true, [9, 9, 9], [1, 2, 3]), guildeAttaquante: EUX },
    ],
  };
  egal(
    equipesJouees(avecMonstres, NOUS).map((e) => [e.equipe, e.combats, e.victoires]),
    [
      [[1, 2, 3], 3, 2],
      [[1, 2, 4], 3, 1],
    ],
    'les équipes jouées par MA guilde, les plus jouées d’abord : une équipe = ses trois monstres, quel que soit leur ordre, montrée dans l’ordre le plus vu'
  );
  egal(
    equipesQuiNousBattent(avecMonstres, NOUS).map((e) => [e.equipe, e.combats - e.victoires, e.combats]),
    [
      [[7, 8, 9], 2, 3],
      [[4, 5, 6], 1, 2],
    ],
    'les équipes en défense qui nous ont le plus battus — à égalité, la plus affrontée d’abord ; une défense jamais vainqueur n’y est pas'
  );
  ok(!equipesJouees(avecMonstres, NOUS).some((e) => e.equipe.includes(9)), 'les équipes de l’autre guilde n’y sont pas');

  const deux = releverSieges(MOI, [carte(S, M, 10_000), carte(2026110301, 2026110301000001, 1_000)]);
  egal(historiqueDesSieges(deux).map((h) => h.matchId), [2026110301000001, M], 'l’historique : du plus ancien au plus récent');
}

export function testSiegeStatistiquesTableaux() {
  titre('siège · statistiques — les tableaux par membre : attaques et défenses');
  const S = 2026110302;
  const M = 2026110302000049;
  // Le résumé donne `max_attack_unit_count` 30 : 10 attaques attendues.
  // MOI : 1 gagnée (contre ENNEMI), 1 perdue ; ALLIE : défenseur une fois, battu.
  const sansJournal = releverSieges(MOI, [carte(S, M, 10_000), resume(S, M, 10_100)]).sieges[0];
  egal(
    tableauAttaques(sansJournal, NOUS).map((l) => [l.joueur.id, l.victoires, l.defaites, l.faites, l.attendues, l.manquees, l.taux, l.performance, l.points]),
    [
      [ALLIE, 0, 0, 0, 10, 10, null, 0, 0],
      [MOI, 1, 1, 2, 10, 8, 50, 10, null],
    ],
    'attaques, par ordre alphabétique (l’ordre de base du tableau) : manquées = attendues − faites ; WR sur les jouées, performance sur les attendues ; points inconnus sans le journal de la victoire, 0 sans victoire'
  );
  const journal = vue('GetGuildSiegeBattleLogByWizardId', 10_200, {
    log_list: [
      {
        battle_log_list: [
          { log_id: 1, siege_id: S, match_id: M, log_type: 1, wizard_id: MOI, guild_id: NOUS, opp_wizard_id: ENNEMI, opp_guild_id: EUX, win_lose: 1, log_timestamp: 10_050, match_score_var: 15 },
          // Le même combat vu du défenseur : SON gain, pas celui de l'attaquant.
          { log_id: 2, siege_id: S, match_id: M, log_type: 2, wizard_id: ENNEMI, guild_id: EUX, opp_wizard_id: MOI, opp_guild_id: NOUS, win_lose: 2, log_timestamp: 10_050, match_score_var: 0 },
        ],
      },
    ],
  });
  const avecJournal = releverSieges(MOI, [carte(S, M, 10_000), resume(S, M, 10_100), journal]).sieges[0];
  egal(tableauAttaques(avecJournal, NOUS).find((x) => x.joueur.id === MOI)?.points, 15, 'les points de la victoire, lus dans l’entrée de l’attaquant — même vue aussi du côté du défenseur');
  egal(
    tableauDefenses(sansJournal, NOUS).map((l) => [l.joueur.id, l.decks, l.subis, l.tenus, l.perdus, l.tenue]),
    [
      [ALLIE, 0, 1, 0, 1, 0],
      [MOI, 1, 0, 0, 0, null],
    ],
    'défenses : combats subis, tenus, perdus, d’après les combats du siège ; les decks à côté'
  );
  const sansResume = releverSieges(MOI, [carte(S, M, 10_000)]).sieges[0];
  egal([sansResume.attendues, tableauDefenses(sansResume, NOUS)], [[], []], 'sans le résumé : ni attaques attendues, ni tableau des défenses');
}

export function testSiegeStatistiquesDefensesCombats() {
  titre('siège · statistiques — les défenses reconstituées d’après les combats');
  const S = 2026110302;
  const M = 2026110302000049;
  const s0 = releverSieges(MOI, [carte(S, M, 10_000)]).sieges[0];
  const combat = (t: number, attaquant: number, defenseur: number, guildeDefense: number, victoire: boolean | null, base: number | null, defense: number[] | null): AttaqueSiege => ({
    t, attaquant, guildeAttaquante: guildeDefense === NOUS ? EUX : NOUS, defenseur, guildeDefense, victoire, base,
    monstres: defense ? { attaque: [1, 2, 3], defense } : null, points: null, tour: null,
  });
  const s = {
    ...s0,
    attaques: [
      combat(1, MOI, ENNEMI, EUX, true, 12, [7, 8, 9]),
      combat(2, ALLIE, ENNEMI, EUX, false, 12, [9, 7, 8]),
      combat(3, MOI, ENNEMI, EUX, true, 3, [7, 8, 9]),
      combat(4, MOI, ENNEMI, EUX, false, null, null),
      combat(5, MOI, ENNEMI2, EUX, true, 5, [4, 5, 6]),
      combat(6, ENNEMI, ALLIE, NOUS, false, 4, [1, 1, 1]),
    ],
  };
  egal(
    defensesDuJoueur(s, ENNEMI).map((d) => [d.monstres, d.combats, d.tenus, d.perdus, d.wr]),
    [
      [[7, 8, 9], 3, 1, 2, 100 / 3],
      [null, 1, 1, 0, 100],
    ],
    'une défense = un défenseur et une équipe (quel que soit l’ordre, montrée dans le plus vu) ; ses combats subis, tenus quand l’attaquant perd ; les combats sans journal à part, monstres inconnus'
  );
  egal(defensesAdverses(s, NOUS).map((d) => d.joueur).sort(), [ENNEMI, ENNEMI, ENNEMI2].sort(), 'les défenses adverses : celles des autres guildes');
  egal(defensesDeLaGuilde(s, NOUS).map((d) => [d.joueur, d.tenus, d.combats]), [[ALLIE, 1, 1]], 'les défenses de ma guilde');
  egal(defensesDuJoueur(s, MOI), [], 'un joueur jamais attaqué : aucune défense');

  // Le journal des défenses de la guilde ne donne qu'UNE équipe, en objet
  // `{"1": [...]}` : la défense (relevé : 132 combats sur 150 portent un deck
  // connu du défenseur). L'attaque y reste inconnue.
  const journalDefense = vue('GetGuildSiegeBattleLog', 10_200, {
    log_list: [
      {
        battle_log_list: [
          { log_id: 9, siege_id: S, match_id: M, log_type: 2, wizard_id: ALLIE, guild_id: NOUS, opp_wizard_id: ENNEMI, opp_guild_id: EUX, win_lose: 2, log_timestamp: 10_060, base_number: 4, view_battle_deck_info: { 1: [41, 42, 43] } },
        ],
      },
    ],
  }, { log_type: 2 });
  const r = releverSieges(MOI, [carte(S, M, 10_000), resume(S, M, 10_100), journalDefense]).sieges[0];
  egal(r.attaques.find((x) => x.defenseur === ALLIE)?.monstres, { attaque: [], defense: [41, 42, 43] }, 'l’équipe unique est la défense ; l’attaque, inconnue, reste vide');
  egal(defensesDeLaGuilde(r, NOUS).map((d) => [d.joueur, d.monstres]), [[ALLIE, [41, 42, 43]]], 'la défense de l’allié, reconstituée avec ses monstres');
  egal(equipesJouees(r, EUX), [], 'une attaque aux monstres inconnus ne compte dans aucune équipe jouée');
}

export function testSiegeStatistiquesCumul() {
  titre('siège · statistiques — tous les sièges confondus');
  const A = { s: 2026110301, m: 2026110301000001 };
  const B = { s: 2026110302, m: 2026110302000002 };
  const r = releverSieges(MOI, [carte(A.s, A.m, 1_000), resume(A.s, A.m, 1_100), carte(B.s, B.m, 5_000), resume(B.s, B.m, 5_100)]);
  const tous = siegesCumules(r)!;
  egal([tous.matchId, tous.guildes, tous.resultat], [TOUS_LES_SIEGES, [], null], 'un siège cumulé : sans guildes (les adversaires changent) ni résultat');
  egal(tous.attaques.length, r.sieges[0].attaques.length + r.sieges[1].attaques.length, 'les combats de tous les sièges');
  egal(tous.monstresUtilises.find((u) => u.joueur === MOI)?.n, 12, 'les monstres utilisés s’additionnent (6 + 6)');
  egal(tous.defenses.map((d) => d.deck).sort(), [71, 72], 'chaque deck une fois, dans sa dernière version');
  egal([tous.debut, tous.fin], [900, 6_000], 'du début du premier siège à la fin du dernier');
  const b = bilanParJoueur(tous, NOUS).find((x) => x.joueur.id === MOI)!;
  egal([b.attaques, b.victoires, b.defaites], [4, 2, 2], 'le bilan d’un joueur sur tous les sièges');
  egal(bilanDeLaGuilde(tous, NOUS).attaques.n, 4, 'le bilan de la guilde aussi');
  const sansResume = releverSieges(MOI, [carte(A.s, A.m, 1_000), resume(A.s, A.m, 1_100), carte(B.s, B.m, 5_000)]);
  egal(siegesCumules(sansResume)!.sources.resume, false, 'un siège sans le résumé des combats : le cumul le dit incomplet');
  egal(siegesCumules({ ...r, sieges: [] }), null, 'aucun siège : pas de cumul');
}

export function testSiegeStatistiquesCarte() {
  titre('siège · statistiques — la carte, les défenses, le résultat, la saison');
  const S = 2026110302;
  const M = 2026110302000049;
  const fin = vue(
    'GetGuildSiegeMatchupInfoForFinished',
    11_500,
    {
      match_info: { siege_id: S, match_id: M, match_start_time: 9_900, match_finish_time: 11_000 },
      guild_list: guildes(S, M, [130, 70]),
      wizard_info_list: joueurs,
      defense_deck_list: [],
      defense_deck_assign_list: [{ base_number: 4, deck_id: 71, status: 1 }],
    },
    { siege_id: S }
  );
  const defUnites = vue('GetGuildSiegeBaseDefenseUnitList', 10_300, {
    defense_unit_list: [
      { deck_id: 72, pos_id: 2, unit_info: { unit_master_id: 502 } },
      { deck_id: 72, pos_id: 1, unit_info: { unit_master_id: 501 } },
      { deck_id: 72, pos_id: 3, unit_info: { unit_master_id: 503 } },
    ],
  });
  const r = releverSieges(MOI, [
    carte(S, M, 10_000),
    defUnites,
    fin,
    vue('getGuildSiegeMatchResult', 9_000, {}),
    vue('getGuildSiegeMatchResult', 12_000, { match_rank: 2, guild_count: 2, guildsiege_score_curr: 1461, guildsiege_score_var: -12 }),
    vue('GetGuildSiegeRankingInfo', 12_100, {
      guildsiege_stat_info: { curr: { season_number: 22, rank: 96, total_guild_count: 20402, score: 1461, win_count: 11, draw_count: 11, lose_count: 6, winning_rate: 39.3 }, prev: null, best: null },
    }),
  ]);
  const s = r.sieges[0];
  egal(
    s.defenses.map((d) => [d.deck, d.joueur, d.guilde, d.bases, d.victoires, d.nuls, d.defaites]),
    [
      [71, MOI, NOUS, [4], 1, 0, 2],
      [72, ENNEMI, EUX, [], 3, 1, 0],
    ],
    'la carte de fin de siège arrive SANS défenses : celles de la carte d’avant restent ; ses bases (non vides) remplacent'
  );
  egal(s.defenses[1].monstres, [501, 502, 503], 'les monstres d’une défense vue (base ouverte), dans l’ordre des places');
  egal(s.defenses[0].monstres, null, 'une défense jamais vue : monstres inconnus');
  egal(s.guildes[0].score, 130, 'les guildes, elles, viennent de la carte la plus récente');
  egal(s.resultat, { rang: 2, nbGuildes: 2, score: 1461, variation: -12 }, 'le résultat : relevé après la fin du siège ; un relevé sans rang ne compte pas');
  egal(r.saison?.courante?.classement, 96, 'la saison : le dernier classement relevé');
  egal(r.saison?.precedente, null, 'une saison précédente absente reste absente');

  ok(estEvenementSiege({ contenu: 'siege', commande: 'GetGuildSiegeMatchupInfo' }), 'un écran de siège est lu');
  ok(estEvenementSiege({ contenu: 'guilde', commande: 'GetGuildInfo' }), 'les informations de la guilde aussi (la saison de siège)');
  ok(!estEvenementSiege({ contenu: 'labyrinthe', commande: 'GetGuildMazeStatusInfo' }), 'pas le labyrinthe');
}

export function testSiegeStatistiquesPlusieurs() {
  titre('siège · statistiques — plusieurs sièges, et le bilan par joueur');
  const A = { s: 2026110301, m: 2026110301000001 };
  const B = { s: 2026110302, m: 2026110302000002 };
  const r = releverSieges(MOI, [
    carte(A.s, A.m, 1_000),
    vue('getGuildSiegeMatchResult', 2_500, { match_rank: 1, guild_count: 3, guildsiege_score_curr: 1500 }),
    carte(B.s, B.m, 5_000),
    resume(B.s, B.m, 5_100),
  ]);
  egal(r.sieges.map((s) => s.siegeId), [B.s, A.s], 'du plus récent au plus ancien');
  egal(r.sieges[1].resultat?.rang, 1, 'le résultat va au siège fini avant lui');
  egal(r.sieges[0].resultat, null, 'pas au siège suivant, pas encore fini');

  const bilan = bilanParJoueur(r.sieges[0], NOUS);
  egal(
    bilan.map((b) => [b.joueur.id, b.attaques, b.victoires, b.defaites, b.monstresUtilises, b.decks, b.enDefense?.n, b.enDefense?.tenus]),
    [
      [MOI, 2, 1, 1, 6, 1, 0, 0],
      [ALLIE, 0, 0, 0, 0, 0, 1, 0],
    ],
    'le bilan de ma guilde : attaques, victoires, défaites, monstres utilisés, decks en défense — du plus actif au moins actif'
  );
  egal(bilanParJoueur(r.sieges[1], NOUS)[0].monstresUtilises, null, 'sans le résumé du match : monstres utilisés inconnus, pas zéro');
}

// ⚠️ Un siège de SAISON oppose trois guildes ; un siège de tournoi, deux.
// Les fixtures ci-dessus n'en ont que deux : celle-ci en pose une troisième,
// qui attaque les deux autres.
const TIERS = 503;
const ENNEMI3 = 3001;
function siegeATroisGuildes() {
  const s0 = releverSieges(MOI, [carte(2026110302, 2026110302000049, 10_000)]).sieges[0];
  const c = (t: number, attaquant: number, gAtt: number, defenseur: number, gDef: number, victoire: boolean, tour: 4 | 5, attaque: number[], defense: number[]): AttaqueSiege => ({
    t, attaquant, guildeAttaquante: gAtt, defenseur, guildeDefense: gDef, victoire, base: null, monstres: { attaque, defense }, points: null, tour,
  });
  return {
    ...s0,
    sources: { ...s0.sources, resume: true },
    guildes: [...s0.guildes, { ...s0.guildes.find((g) => g.id === EUX)!, id: TIERS, nom: 'Tiers', mienne: false }],
    joueurs: [...s0.joueurs, { id: ENNEMI3, nom: 'Ennemi 3', guilde: TIERS }],
    attaques: [
      c(10_001, MOI, NOUS, ENNEMI, EUX, true, 5, [1, 2, 3], [7, 8, 9]),
      c(10_002, MOI, NOUS, ENNEMI3, TIERS, false, 4, [4, 5, 6], [17, 18, 19]),
      c(10_003, ENNEMI3, TIERS, ENNEMI, EUX, true, 5, [21, 22, 23], [7, 8, 9]),
      c(10_004, ENNEMI, EUX, MOI, NOUS, false, 5, [31, 32, 33], [41, 42, 43]),
      c(10_005, ENNEMI3, TIERS, MOI, NOUS, true, 5, [21, 22, 23], [41, 42, 43]),
      c(10_006, MOI, NOUS, ENNEMI, EUX, true, 5, [3, 1, 2], [9, 8, 7]),
    ],
  };
}

export function testSiegeStatistiquesTroisGuildes() {
  titre('siège · statistiques — trois guildes par siège (saison)');
  const s = siegeATroisGuildes();
  egal(courbesDuSiege(s).map((c) => [c.guilde, c.points[c.points.length - 1].attaques]), [[NOUS, 3], [EUX, 1], [TIERS, 2]], 'une courbe par guilde, les trois ; chacune ne compte que SES attaques');
  const b = bilanDeLaGuilde(s, NOUS);
  egal([b.attaques.n, b.attaques.victoires, b.defenses?.n, b.defenses?.tenus], [3, 2, 2, 1], 'ma guilde : ses attaques contre les deux autres, ses défenses contre les attaques des deux autres');
  egal(
    defensesAdverses(s, NOUS).map((d) => [d.joueur, d.guilde, d.combats]),
    [[ENNEMI, EUX, 3], [ENNEMI3, TIERS, 1]],
    'les défenses adverses : celles des DEUX autres guildes'
  );
  egal(equipesQuiNousBattent(s, NOUS).map((e) => e.equipe), [[17, 18, 19]], 'les défenses qui nous battent : nos attaques seulement, pas celles d’une autre guilde contre la troisième');
  egal(equipesJouees(s, NOUS).map((e) => [e.equipe, e.combats]), [[[1, 2, 3], 2], [[4, 5, 6], 1]], 'nos équipes jouées, pas celles des deux autres guildes');

  // Le comparatif : une colonne par guilde, ma guilde d'abord puis l'ordre de la carte.
  const s3 = { ...s, guildes: s.guildes.map((g) => ({ ...g, position: g.id === NOUS ? 1 : g.id === EUX ? 2 : 3 })) };
  egal(
    comparatifDesGuildes(s3, NOUS, false).map((k) => [k.guilde.id, k.couleur, k.contreNous, k.nosAttaques, k.nosVictoires, k.nosDefaites, k.combats, k.victoires, k.defaites, k.rang]),
    [
      [NOUS, 'bleue', null, null, null, null, 3, 2, 1, null],
      [EUX, 'rouge', 1, 2, 2, 0, 1, 0, 1, null],
      [TIERS, 'jaune', 1, 1, 0, 1, 1, 1, 0, null],
    ],
    'comparatif : ma guilde sur tous ses combats ; une autre sur ses combats CONTRE NOUS (pas contre la troisième), et le face-à-face — nos attaques sur elle et leurs résultats ; pas de rang avant la fin'
  );
}

export function testSiegeStatistiquesMembre() {
  titre('siège · statistiques — la vue d’ensemble d’un membre');
  const s = siegeATroisGuildes();
  egal(offensesDuMembre(s, NOUS, MOI, 5).map((e) => [e.equipe, e.combats, e.victoires]), [[[1, 2, 3], 2, 2]], 'ses offenses sur les tours 5★ (un même trio, quel que soit l’ordre)');
  egal(offensesDuMembre(s, NOUS, MOI, 4).map((e) => [e.equipe, e.combats, e.victoires]), [[[4, 5, 6], 1, 0]], 'ses offenses sur les tours 4★');
  egal(defensesQuiBattentLeMembre(s, NOUS, MOI).map((e) => [e.equipe, e.combats - e.victoires]), [[[17, 18, 19], 1]], 'les défenses contre lesquelles il a perdu');
  egal(defensesQuiBattentLeMembre(s, NOUS, ALLIE), [], 'un membre sans défaite : aucune');
  const b = bilanDuMembre(s, NOUS, MOI);
  egal([b.attaques.n, b.attaques.taux, b.defenses?.n, b.defenses?.tenue], [3, 200 / 3, 2, 50], 'son bilan : WR en attaque, défenses tenues');

  // Au fil des sièges : un point par siège où il était de ma guilde.
  const A = { s: 2026110301, m: 2026110301000001 };
  const B = { s: 2026110302, m: 2026110302000002 };
  const r = releverSieges(MOI, [carte(A.s, A.m, 1_000), carte(B.s, B.m, 5_000), resume(B.s, B.m, 5_100)]);
  egal(
    evolutionDuMembre(r, MOI).map((p) => [p.matchId, p.attaques, p.wrAttaque, p.defenses, p.wrDefense]),
    [
      [A.m, 0, null, 0, null],
      [B.m, 2, 50, 0, null],
    ],
    'du plus ancien au plus récent ; sans combat au résultat connu, un WR inconnu (pas zéro)'
  );
  egal(evolutionDuMembre(r, ALLIE).map((p) => [p.defenses, p.wrDefense]), [[0, null], [1, 0]], 'en défense : ses combats subis, tenus sur subis');
  egal(evolutionDuMembre(r, ENNEMI), [], 'un joueur d’une autre guilde : aucun point');
  egal(
    evolutionDeLaGuilde(r).map((p) => [p.matchId, p.attaques, p.wrAttaque, p.defenses, p.wrDefense]),
    [
      [A.m, 0, null, 0, null],
      [B.m, 2, 50, 1, 0],
    ],
    'le WR de ma guilde, siège par siège : sans résumé des combats, une défense inconnue'
  );
  egal(evolutionDeLaGuilde(r).map((p) => p.adversaires), [['Eux'], ['Eux']], 'chaque point nomme ses adversaires, sans ma guilde');
  egal(
    evolutionDeLaGuilde({ ...r, sieges: [siegeATroisGuildes()] }).map((p) => p.adversaires),
    [['Eux', 'Tiers']],
    'en saison : les deux autres guildes, dans l’ordre de la carte'
  );
  egal(bornesDesValeurs([55, null, 72]), { bas: 50, haut: 80 }, 'l’échelle de sa courbe, centrée sur ses WR');
}

// Deux sièges entre lesquels deux joueurs ont changé de camp : l'allié est
// passé chez eux, ENNEMI2 chez nous.
function sieges2Camps(membres: RelevesSiege['membres']): RelevesSiege {
  const base = releverSieges(MOI, [carte(2026110301, 2026110301000001, 10_000)]).sieges[0];
  const c = (t: number, attaquant: number, gAtt: number, defenseur: number, gDef: number): AttaqueSiege => ({
    t, attaquant, guildeAttaquante: gAtt, defenseur, guildeDefense: gDef, victoire: true, base: null, monstres: null, points: null, tour: 5,
  });
  const siege = (matchId: number, debut: number, allie: number, ennemi2: number, attaques: AttaqueSiege[]): SiegeReleve => ({
    ...base,
    matchId,
    debut,
    sources: { ...base.sources, resume: true },
    joueurs: [
      { id: MOI, nom: 'Moi', guilde: NOUS },
      { id: ALLIE, nom: 'Allié', guilde: allie },
      { id: ENNEMI, nom: 'Ennemi', guilde: EUX },
      { id: ENNEMI2, nom: 'Ennemi 2', guilde: ennemi2 },
    ],
    attaques,
    monstresUtilises: [ALLIE, ENNEMI2].map((joueur) => ({ joueur, n: 3 })),
    attendues: [ALLIE, ENNEMI2].map((joueur) => ({ joueur, n: 10 })),
  });
  const A = siege(1, 1_000, NOUS, EUX, [c(1_010, ALLIE, NOUS, ENNEMI, EUX), c(1_020, ENNEMI2, EUX, MOI, NOUS)]);
  const B = siege(2, 5_000, EUX, NOUS, [c(5_010, ALLIE, EUX, MOI, NOUS), c(5_020, ENNEMI2, NOUS, ENNEMI, EUX)]);
  return { moi: MOI, maGuilde: NOUS, sieges: [B, A], saison: null, membres };
}

export function testSiegeStatistiquesAnciensMembres() {
  titre('siège · statistiques — les joueurs qui changent de guilde, les anciens membres');
  const r = sieges2Camps({ t: 9_000, ids: [MOI, ENNEMI2] });
  const tous = siegesCumules(r)!;
  egal(
    bilanParJoueur(tous, NOUS).map((b) => [b.joueur.id, b.attaques, b.monstresUtilises]).sort((x, y) => x[0]! - y[0]!),
    [[MOI, 0, 0], [ALLIE, 1, 3], [ENNEMI2, 1, 3]],
    'tous les sièges : chacun ne compte que ses attaques et ses monstres POUR nous — l’allié parti reste, ENNEMI2 arrivé compte'
  );
  egal(tableauAttaques(tous, NOUS).find((l) => l.joueur.id === ALLIE)?.attendues, 10, 'ses attaques attendues : celles des sièges où il était chez nous');
  egal(bilanDuMembre(tous, NOUS, MOI).defenses?.n, 2, 'mes défenses : les combats subis pour nous, quel que soit l’attaquant');
  egal(bilanDuMembre(tous, NOUS, ENNEMI2).attaques.n, 1, 'la vue d’un membre arrivé : ses attaques contre nous ne sont pas les siennes de membre');
  egal([attaquesDuJoueur(tous, ALLIE, NOUS).length, attaquesDuJoueur(tous, ALLIE).length], [1, 2], 'le détail d’un membre : ses combats pour nous ; sans guilde, tous');
  egal(bilanDeLaGuilde(tous, NOUS).attaques.n, 2, 'le bilan de la guilde : la somme des lignes de ses membres');

  egal([...anciensMembres(r)], [ALLIE], 'un ancien membre : vu chez nous, absent de la liste relevée après');
  egal(
    [...anciensMembres({ ...r, membres: { t: 3_000, ids: [MOI] } })],
    [ALLIE],
    'une liste relevée AVANT le siège où ENNEMI2 nous a rejoints : lui n’est pas un ancien membre'
  );
  egal(anciensMembres({ ...r, membres: null }).size, 0, 'sans liste des membres : aucun ancien membre supposé');

  const lu = releverSieges(MOI, [
    carte(2026110302, 2026110302000049, 10_000),
    vue('GetGuildInfo', 20_000, { guild: { guild_info: { guild_id: NOUS }, guild_members: { [MOI]: { wizard_id: MOI }, [ALLIE]: { wizard_id: ALLIE } } } }),
    vue('GetGuildInfo', 30_000, { guild: { guild_info: { guild_id: EUX }, guild_members: { [ENNEMI]: { wizard_id: ENNEMI } } } }),
  ]);
  egal(lu.membres, { t: 20_000, ids: [MOI, ALLIE] }, 'la liste des membres : celle de MA guilde, à la dernière ouverture de sa fiche');
}

// Trois sièges : le mois en cours (finissant au dernier combat), le mois
// d'avant, et un siège plus vieux que les deux, hors compte.
export function testSiegeStatistiquesWrGlissant() {
  titre('siège · statistiques — le WR glissant sur un mois');
  const base = releverSieges(MOI, [carte(2026110301, 2026110301000001, 10_000)]).sieges[0];
  const J = 86_400;
  const FIN = 1_000 * J;
  const c = (t: number, attaquant: number, gAtt: number, defenseur: number, gDef: number, victoire: boolean | null): AttaqueSiege => ({
    t, attaquant, guildeAttaquante: gAtt, defenseur, guildeDefense: gDef, victoire, base: null, monstres: null, points: null, tour: 5,
  });
  const siege = (matchId: number, attaques: AttaqueSiege[], resume = true): SiegeReleve => ({
    ...base,
    matchId,
    debut: attaques[attaques.length - 1].t,
    sources: { ...base.sources, resume },
    attaques,
  });
  const releves = (decalage: number, resume = true): RelevesSiege => {
    const d = (t: number) => t - decalage;
    const recent = siege(3, [
      c(d(FIN), MOI, NOUS, ENNEMI, EUX, true),
      c(d(FIN - J), ALLIE, NOUS, ENNEMI, EUX, true),
      c(d(FIN - 2 * J), ALLIE, NOUS, ENNEMI, EUX, false),
      c(d(FIN - 3 * J), ALLIE, NOUS, ENNEMI, EUX, null),
      c(d(FIN - 4 * J), ENNEMI, EUX, MOI, NOUS, false),
      c(d(FIN - 5 * J), ENNEMI, EUX, ALLIE, NOUS, true),
    ], resume);
    const avant = siege(2, [
      c(d(FIN - 31 * J), MOI, NOUS, ENNEMI, EUX, false),
      c(d(FIN - 40 * J), ALLIE, NOUS, ENNEMI, EUX, true),
      c(d(FIN - 45 * J), ENNEMI, EUX, MOI, NOUS, false),
    ], resume);
    const vieux = siege(1, [c(d(FIN - 61 * J), MOI, NOUS, ENNEMI, EUX, false), c(d(FIN - 62 * J), ENNEMI, EUX, MOI, NOUS, true)], resume);
    return { moi: MOI, maGuilde: NOUS, sieges: [recent, avant, vieux], saison: null, membres: null };
  };
  const arrondi = (x: number | null | undefined) => (x == null ? x : Math.round(x * 10) / 10);
  const lire = (g: ReturnType<typeof wrGlissant>) =>
    g && [g.attaque.n, arrondi(g.attaque.taux), arrondi(g.attaque.ecart), g.defense?.n, arrondi(g.defense?.taux), arrondi(g.defense?.ecart)];
  egal(
    lire(wrGlissant(releves(0))),
    [3, 66.7, 16.7, 2, 50, -50],
    'la guilde : 2 attaques gagnées sur 3 au résultat connu ce mois-ci contre 1 sur 2 le mois d’avant (+16,7 points) ; en défense 1 sur 2 contre 1 sur 1 (−50) ; le siège de plus de 60 jours ne compte pas'
  );
  egal(lire(wrGlissant(releves(0), ALLIE)), [2, 50, -50, 1, 0, null], 'un membre : ses combats seulement ; rien en défense le mois d’avant, pas d’écart');
  egal(lire(wrGlissant(releves(0), MOI)), [1, 100, 100, 1, 100, 0], 'un autre membre : un écart nul reste un écart (0), pas une absence');
  egal(lire(wrGlissant(releves(400 * J))), lire(wrGlissant(releves(0))), '« aujourd’hui », c’est le dernier combat relevé : des relevés vieux d’un an donnent le même mois');
  egal(wrGlissant(releves(0, false))?.defense, null, 'sans résumé des combats : pas de WR en défense');
  egal(wrGlissant({ ...releves(0), maGuilde: null }), null, 'sans ma guilde : rien');
  egal(wrGlissant({ ...releves(0), sieges: [] }), null, 'sans combat : rien');
}
