// Le moteur du plugin SWEX « SW Blacksmith Live » (plugin-swex/source/) : un
// compte fabriqué, puis les commandes du jeu une à une. Chaque cas reprend un
// piège relevé en rejouant un vrai journal — le journal réel ne vient pas ici,
// il porte la clé de session du joueur.

import {
  FORMAT_COMPTE_ARCHIVE,
  FORMAT_COMPTE_LIVE,
  appliquer,
  depuisConnexion,
  depuisLignesLive,
  ligneConnexion,
  versEtatArchive,
  versExport,
  type Json,
} from '../plugin-swex/source/etatDirect';
import {
  ajouterAuFichier,
  construireBloc,
  empreinteDe,
  lireEntete,
  parcourirArchive,
  type Bloc,
} from '../plugin-swex/source/archive';
import {
  FORMAT_GUILDE_LIVE,
  depuisLignesGuilde,
  evenementGuilde,
  ligneSessionGuilde,
} from '../plugin-swex/source/guilde';
import {
  COMPTE_ARCHIVE,
  COMPTE_LIVE,
  DOSSIER_PLUGIN,
  GUILDE_ARCHIVE,
  GUILDE_LIVE,
  dossierInvocateur,
  nomDeBase,
} from '../plugin-swex/source/fichiers';
import { blocSessionGuilde } from '../plugin-swex/source/plugin';
import { CHEMIN_PLUGIN, NOM_PLUGIN, construirePluginSwex } from '../scripts/lib/construirePluginSwex.mjs';
import { CHEMIN_PLUGIN_SWEX, FICHIER_PLUGIN_SWEX } from '../src/lib/pluginSwex';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { gunzipSync, gzipSync } from 'node:zlib';
import { egal, ok, titre } from './outils';

const MOI = 100;
const AUTRE = 200;

const rune = (id: number, place: { unite?: number }, upgrade = 15, extra: Json = {}): Json => ({
  rune_id: id,
  wizard_id: MOI,
  occupied_type: place.unite ? 1 : 2,
  occupied_id: place.unite ?? 0,
  slot_no: 1 + (id % 6),
  rank: 5,
  class: 6,
  set_id: 13,
  upgrade_curr: upgrade,
  pri_eff: [8, 42],
  prefix_eff: [0, 0],
  sec_eff: [[4, 10, 0, 0]],
  extra: 5,
  ...extra,
});
const artefact = (rid: number, unite = 0): Json => ({
  rid,
  wizard_id: MOI,
  occupied_id: unite,
  slot: unite ? 1 : 0,
  natural_rank: 5,
  rank: 5,
  level: 15,
  pri_effect: [100, 160],
  sec_effects: [],
});
const relique = (rid: number, upgrade = 0): Json => ({
  rid,
  wizard_id: MOI,
  type: 7,
  upgrade_curr: upgrade,
  durability: 3,
  pri_effect: [100, 3],
  sec_effect: [7, 250, 2],
});
const unite = (id: number, runes: Json[], artefacts: Json[] = [], reliques: Json[] = [], niveau = 40): Json => ({
  unit_id: id,
  wizard_id: MOI,
  unit_master_id: 13413,
  unit_level: niveau,
  class: 6,
  runes,
  artifacts: artefacts,
  relics: reliques,
});
const craft = (id: number, amount: number): Json => ({
  craft_item_id: id,
  wizard_id: MOI,
  craft_type: 2,
  craft_type_id: 130805,
  amount,
});

// Exportée, comme `PARTIE` : le compte en direct de l'app
// (tests/compte-direct.test.ts) rejoue la même partie.
export function connexion(): Json {
  return {
    command: 'HubUserLogin',
    ret_code: 0,
    wizard_info: { wizard_id: MOI, wizard_name: 'Essai' },
    session_key: 'secret',
    session_key_node: 'secret',
    tvalue: 1000,
    unit_list: [unite(1, [rune(11, { unite: 1 })], [artefact(31, 1)], [relique(51)]), unite(2, [])],
    runes: [rune(12, {}), rune(13, {})],
    artifacts: [artefact(32)],
    rune_craft_item_list: [craft(41, 3)],
    relics: [relique(51), relique(52)],
  };
}

const req = (extra: Json = {}): Json => ({ wizard_id: MOI, ...extra });
const ok0 = (extra: Json = {}): Json => ({ ret_code: 0, ...extra });
const idsInventaire = (e: Json) => e.runes.map((r: Json) => r.rune_id).sort();
const idsPortees = (e: Json, u: number) => e.unit_list.find((x: Json) => x.unit_id === u).runes.map((r: Json) => r.rune_id).sort();

export function testPluginSwexEtat() {
  titre('Plugin SWEX — le compte suivi en direct');

  // Sans commande, l'export est la connexion, sans la session.
  const e0 = depuisConnexion(connexion());
  const x0 = versExport(e0);
  egal([idsPortees(x0, 1), idsInventaire(x0)], [[11], [12, 13]], 'connexion : runes portées et inventaire');
  ok(!('session_key' in x0) && !('session_key_node' in x0), 'la clé de session n’est jamais écrite');

  // Meule : la rune ET le lot de pierres.
  const e = depuisConnexion(connexion());
  const meule = appliquer(
    e,
    'AmplifyRune_v2',
    req(),
    ok0({ rune: rune(12, {}, 15, { sec_eff: [[4, 10, 0, 5]] }), rune_craft_item: craft(41, 2), tvalue: 1100 })
  );
  // Le changement rendu : l'état final de ce qui a bougé, rien d'autre.
  egal(
    [meule?.type, meule?.t, meule?.commande, meule?.maj.runes?.map((r) => r.rune_id), meule?.maj.crafts?.[0].amount, meule?.retires],
    ['changement', 1100, 'AmplifyRune_v2', [12], 2, {}],
    'meule : le changement dit la rune et le lot de pierres, à l’heure du serveur'
  );
  let x = versExport(e);
  egal(x.runes.find((r: Json) => r.rune_id === 12).sec_eff, [[4, 10, 0, 5]], 'meule : la rune est meulée');
  egal(x.rune_craft_item_list[0].amount, 2, 'meule : une pierre de moins');
  egal(x.tvalue, 1100, 'l’heure serveur suit la dernière réponse');

  // Dernière pierre : le lot disparaît.
  appliquer(e, 'AmplifyRune_v2', req(), ok0({ rune: rune(12, {}), rune_craft_item: craft(41, 0) }));
  egal(versExport(e).rune_craft_item_list.length, 0, 'dernière pierre : le lot disparaît');

  // Vente : la réponse renvoie les runes VENDUES (rachat) — elles ne reviennent pas.
  const vente = appliquer(e, 'SellRune', req({ rune_id_list: [13] }), ok0({ runes: [rune(13, {})] }));
  egal(idsInventaire(versExport(e)), [12], 'vente : la rune vendue disparaît, malgré la réponse qui la montre');
  egal([vente?.retires, vente?.maj], [{ runes: [13] }, {}], 'vente : le changement dit la rune retirée');

  // Équipement : la rune 12 passe sur le monstre 1, la 11 retourne à l'inventaire.
  const equipement = appliquer(
    e,
    'UpdateUnitEquip',
    req(),
    ok0({ EquipRuneList: { unit_info: unite(1, [rune(12, { unite: 1 })], [artefact(31, 1)], [relique(51)]) } })
  );
  egal(
    [equipement?.maj.unites?.map((u) => [u.unit_id, u.runes, u.artifacts]), equipement?.maj.runes?.map((r) => r.rune_id).sort()],
    [[[1, [], []]], [11, 12]],
    'équipement : le monstre sans son équipement, les deux runes pour elles-mêmes'
  );
  x = versExport(e);
  egal([idsPortees(x, 1), idsInventaire(x)], [[12], [11]], 'équipement : la rune posée change de place, l’autre est rendue');
  egal(x.runes[0].occupied_type, 2, 'la rune rendue est marquée en inventaire');

  // Un monstre qui passe sa rune à un autre, dans la même réponse.
  appliquer(e, 'UpdateUnitEquip', req(), ok0({ updated: [unite(2, [rune(12, { unite: 2 })]), unite(1, [], [artefact(31, 1)])] }));
  x = versExport(e);
  egal([idsPortees(x, 1), idsPortees(x, 2)], [[], [12]], 'rune passée d’un monstre à l’autre : chez le nouveau, pas dans l’inventaire');

  // Combat : une rune gagnée, un monstre qui monte de niveau.
  appliquer(
    e,
    'BattleDungeonResult_V2',
    req(),
    ok0({ unit_list: [unite(2, [rune(12, { unite: 2 })], [], [], 41)], changed_item_list: [{ type: 8, info: rune(14, {}, 0) }] })
  );
  x = versExport(e);
  ok(idsInventaire(x).includes(14), 'combat : la rune gagnée arrive dans l’inventaire');
  egal(x.unit_list.find((u: Json) => u.unit_id === 2).unit_level, 41, 'combat : le niveau du monstre suit');

  // Ce qui n'est PAS l'état du compte.
  const avant = JSON.stringify(versExport(e));
  const rien = [
    appliquer(e, 'GetBlackMarketList', req(), ok0({ market_list: [{ runes: [rune(90, {}, 0, { occupied_type: 3, occupied_id: 1 })] }] })),
    appliquer(e, 'GetWizardDataPart1', req(), ok0({ deck: [{ unit_id: 1, unit_master_id: 13413, runes: [11, 12] }] })),
    appliquer(e, 'BattleDungeonStart', req(), ok0({ dungeon_unit_list: [[{ unit_id: 14101, unit_master_id: 1, unit_level: 70, runes: [] }]] })),
    appliquer(e, 'getPlayPassInfo', req(), ok0({ pass: [rune(0, {})] })),
    appliquer(e, 'VisitFriend', req(), ok0({ unit_list: [{ ...unite(9, []), wizard_id: AUTRE }] })),
    appliquer(e, 'GetGuildSiegeDefenseDeckListAlly', req(), ok0({ unit_list: [unite(1, [rune(11, { unite: 1 })])] })),
    appliquer(e, 'GetRTPvPInfo_v3', req(), ok0({ unit_list: [unite(2, [])] })),
  ];
  egal(JSON.stringify(versExport(e)), avant, 'marché noir, decks recommandés, ennemis, aperçus, amis, siège, RTA : rien ne change');
  egal(rien, rien.map(() => null), 'aucun changement rendu : aucune ligne écrite');

  // Arène serveur : l'historique des récompenses montre une rune vendue depuis.
  appliquer(e, 'SellRune', req({ rune_id_list: [14] }), ok0());
  appliquer(
    e,
    'receiveServerArenaReward_v2',
    req(),
    ok0({
      reward_id: 2,
      user_reward_info: {
        reward_result: [
          { reward_id: 1, changed_item_list: [{ info: rune(14, {}) }] },
          { reward_id: 2, changed_item_list: [{ info: rune(15, {}) }] },
        ],
      },
    })
  );
  x = versExport(e);
  ok(!idsInventaire(x).includes(14) && idsInventaire(x).includes(15), 'arène serveur : seule la récompense reçue est lue, pas l’historique');

  // Une rune gagnée en combat arrive avec des sous-stats en deux cases : elle
  // est complétée comme l'export l'écrit, `[type, valeur, gemme, meule]`.
  appliquer(e, 'BattleDungeonResult_V2', req(), ok0({ changed_item_list: [{ info: rune(16, {}, 0, { sec_eff: [[4, 6], [8, 4]] }) }] }));
  egal(
    versExport(e).runes.find((r: Json) => r.rune_id === 16).sec_eff,
    [[4, 6, 0, 0], [8, 4, 0, 0]],
    'rune gagnée en combat : sous-stats complétées par des zéros'
  );

  // Le rachat d'une rune vendue : hors lecture générale, mais la rune revient.
  appliquer(e, 'SellRune', req({ rune_id_list: [16] }), ok0());
  appliquer(e, 'GetRuneRepurchaseList', req(), ok0({ runes: [rune(17, {})] }));
  ok(!idsInventaire(versExport(e)).includes(17), 'liste de rachat : ses runes (vendues) ne reviennent pas');
  appliquer(e, 'RepurchaseRune', req({ rune_id: 16 }), ok0({ rune: rune(16, {}, 0, { sec_eff: [[4, 6, 0, 0]] }) }));
  ok(idsInventaire(versExport(e)).includes(16), 'rachat : la rune rachetée revient dans l’inventaire');

  // Monstres retirés (mis en stock, sacrifiés).
  appliquer(e, 'ConvertUnitToStorage', req({ unit_id_list: [1] }), ok0({ remove_unit_id_list: [1] }));
  egal(versExport(e).unit_list.map((u: Json) => u.unit_id), [2], 'monstre mis en stock : il disparaît');
  // Rangés dans le stockage : la liste des retirés est imbriquée.
  appliquer(e, 'SummonUnit', req(), ok0({ unit_list: [unite(5, []), unite(6, [])] }));
  appliquer(
    e,
    'MoveStorageFromTo',
    req({ from: 1, to: 3, unit_id_list: [5, 6] }),
    ok0({ from: 1, to: 3, result_from: [], result_to: { ret_code: 0, remove_unit_id_list: [5, 6] } })
  );
  egal(versExport(e).unit_list.map((u: Json) => u.unit_id), [2], 'rangés dans le stockage : retirés de la box (liste imbriquée)');

  // Reliques : partagées, mises à jour à chaque vue.
  appliquer(e, 'BattleDungeonResult_V2', req(), ok0({ unit_list: [unite(2, [rune(12, { unite: 2 })], [], [relique(52, 3)])] }));
  egal(versExport(e).relics.find((r: Json) => r.rid === 52).upgrade_curr, 3, 'relique vue sur un monstre : la liste du compte suit');

  // Garde-fous : une commande en échec, un autre invocateur.
  const fige = JSON.stringify(versExport(e));
  ok(!appliquer(e, 'SellRune', req({ rune_id_list: [12] }), { ret_code: 1 }), 'commande en échec : ignorée');
  ok(!appliquer(e, 'SellRune', { wizard_id: AUTRE, rune_id_list: [12] }, ok0()), 'autre invocateur : ignoré');
  egal(JSON.stringify(versExport(e)), fige, 'rien n’a changé');
}

// Une partie fabriquée : meules, vente, équipement, combat, monstre mis en
// stock, et des commandes qui ne changent rien.
export const PARTIE: [string, Json, Json][] = [
  ['AmplifyRune_v2', req(), ok0({ rune: rune(12, {}, 15, { sec_eff: [[4, 10, 0, 5]] }), rune_craft_item: craft(41, 2), tvalue: 1100 })],
  ['GetBlackMarketList', req(), ok0({ market_list: [{ runes: [rune(90, {}, 0, { occupied_type: 3 })] }] })],
  ['SellRune', req({ rune_id_list: [13] }), ok0({ runes: [rune(13, {})], tvalue: 1200 })],
  ['UpdateUnitEquip', req(), ok0({ EquipRuneList: { unit_info: unite(1, [rune(12, { unite: 1 })], [artefact(31, 1)], [relique(51)]) } })],
  ['BattleDungeonResult_V2', req(), ok0({ unit_list: [unite(2, [], [], [relique(52, 3)], 41)], changed_item_list: [{ info: rune(14, {}, 0) }] })],
  ['ConvertUnitToStorage', req({ unit_id_list: [2] }), ok0({ remove_unit_id_list: [2], tvalue: 1300 })],
  ['AmplifyRune_v2', req(), ok0({ rune: rune(14, {}), rune_craft_item: craft(41, 0) })],
];

// Le compte écrit, rangé pour comparer : l'ordre de l'inventaire n'a pas de sens.
const range = (x: Json) => ({
  ...x,
  runes: [...x.runes].sort((a, b) => a.rune_id - b.rune_id),
  artifacts: [...x.artifacts].sort((a, b) => a.rid - b.rid),
  unit_list: [...x.unit_list].sort((a, b) => a.unit_id - b.unit_id),
});

export function testPluginSwexLive() {
  titre('Plugin SWEX — le fichier live, relu');
  const e = depuisConnexion(connexion());
  const lignes = [JSON.stringify(ligneConnexion(e, '9.9.9'))];
  for (const [commande, rq, rs] of PARTIE) {
    const c = appliquer(e, commande, rq, rs);
    if (c) lignes.push(JSON.stringify(c));
  }
  egal(lignes.length, 1 + PARTIE.length - 1, 'une ligne par commande qui change le compte, aucune pour le marché noir');
  const premiere = JSON.parse(lignes[0]);
  egal([premiere.type, premiere.format, premiere.plugin, premiere.wizard_id], ['connexion', FORMAT_COMPTE_LIVE, '9.9.9', MOI], 'la première ligne : la connexion, et la version du plugin');
  ok(!lignes.join('\n').includes('secret'), 'aucune clé de session dans le fichier live');

  // Relu, le fichier donne exactement le compte que tient le plugin.
  const relu = depuisLignesLive(lignes);
  egal(range(versExport(relu!)), range(versExport(e)), 'relu : le même compte que celui du plugin');
  egal(relu!.tvalue, 1300, 'relu : l’heure du dernier changement');
  // Au milieu de la partie aussi.
  const mi = depuisConnexion(connexion());
  for (const [commande, rq, rs] of PARTIE.slice(0, 4)) appliquer(mi, commande, rq, rs);
  egal(range(versExport(depuisLignesLive(lignes.slice(0, 4))!)), range(versExport(mi)), 'relu en cours de partie : le compte à cet instant');

  // Une dernière ligne à moitié écrite : ce qui précède vaut.
  egal(
    range(versExport(depuisLignesLive([...lignes, lignes[1].slice(0, 20)])!)),
    range(versExport(e)),
    'dernière ligne coupée : ignorée'
  );
  egal(depuisLignesLive([JSON.stringify({ type: 'connexion', format: 'autre' })]), null, 'un autre format : rien');
  egal(depuisLignesLive([lignes[1]]), null, 'sans connexion en tête : rien');

  // L'état allégé, archivé à la connexion : les objets bruts, pas la session.
  const etat = versEtatArchive(e);
  egal(
    [etat.format, etat.runes.length, etat.artefacts.length, etat.crafts.length, etat.unites],
    [FORMAT_COMPTE_ARCHIVE, e.runes.size, e.artefacts.size, 0, [{ unit_id: 1, unit_master_id: 13413, class: 6, unit_level: 40 }]],
    'état allégé : runes, artéfacts, pierres, monstres réduits'
  );
}

export async function testPluginSwexArchive() {
  titre('Plugin SWEX — l’archive, un bloc gzip par session');
  const bloc = (texte: string, debut: number): Bloc => ({ texte, debut, fin: debut + 60, empreinte: empreinteDe(texte) });
  const un = construireBloc(bloc('{"a":1}\n', 1000));
  const deux = construireBloc(bloc('{"b":2}\n', 2000));
  egal(lireEntete(un), { taille: un.length, debut: 1000, fin: 1060, empreinte: empreinteDe('{"a":1}\n') }, 'l’en-tête dit la taille, les dates, l’empreinte');
  egal(gunzipSync(Buffer.concat([un, deux])).toString(), '{"a":1}\n{"b":2}\n', 'deux blocs à la suite : un seul texte, relu par gunzip');
  egal(gunzipSync(deux).toString(), '{"b":2}\n', 'un bloc seul se décompresse');
  egal(lireEntete(gzipSync('x')), null, 'un gzip ordinaire : pas un de nos blocs');

  const racine = mkdtempSync(join(tmpdir(), 'archive-swex-'));
  const chemin = join(racine, 'compte.jsonl.gz');
  try {
    ok(await ajouterAuFichier(chemin, bloc('{"a":1}\n', 1000)), 'premier bloc : l’archive est créée');
    ok(!(await ajouterAuFichier(chemin, bloc('{"a":1}\n', 1100))), 'même empreinte que le dernier : pas ajouté deux fois');
    ok(await ajouterAuFichier(chemin, bloc('{"b":2}\n', 2000)), 'autre contenu : ajouté');
    let { blocs } = await parcourirArchive(chemin);
    egal(blocs.map((b) => [b.position, b.debut]), [[0, 1000], [un.length, 2000]], 'les sessions listées sans décompresser');

    // Un ajout interrompu : un bloc à moitié écrit en fin de fichier.
    writeFileSync(chemin, Buffer.concat([readFileSync(chemin), construireBloc(bloc('{"c":3}\n', 3000)).subarray(0, 25)]));
    let erreur = '';
    try {
      gunzipSync(readFileSync(chemin));
    } catch (e) {
      erreur = (e as NodeJS.ErrnoException).code ?? '';
    }
    egal(erreur, 'Z_BUF_ERROR', 'bloc tronqué : l’archive ne se relit plus d’un coup');
    ok(await ajouterAuFichier(chemin, bloc('{"c":3}\n', 3000)), 'l’ajout suivant répare et ajoute');
    egal(gunzipSync(readFileSync(chemin)).toString(), '{"a":1}\n{"b":2}\n{"c":3}\n', 'réparée : tout se relit, rien en double');
    // Des octets étrangers en fin de fichier : coupés de même.
    writeFileSync(chemin, Buffer.concat([readFileSync(chemin), Buffer.from('xyz')]));
    ok(!(await ajouterAuFichier(chemin, bloc('{"c":3}\n', 3100))), 'même dernier bloc : rien d’ajouté…');
    ({ blocs } = await parcourirArchive(chemin));
    egal([blocs.length, readFileSync(chemin).length], [3, blocs[2].position + blocs[2].taille], '… mais les octets étrangers sont coupés');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

export function testPluginSwexGuilde() {
  titre('Plugin SWEX — le contenu des combats de guilde');
  // Une session : son en-tête, puis une ligne par événement, comme le plugin
  // l'écrit dans `guilde.live.jsonl`.
  const lignes = [JSON.stringify(ligneSessionGuilde(MOI, 1900, '9.9.9'))];
  const jouer = (commande: string, rq: Json, rs: Json) => {
    const ev = evenementGuilde(MOI, commande, rq, rs);
    if (ev) lignes.push(JSON.stringify(ev));
    return ev;
  };
  const relire = () => depuisLignesGuilde(lignes, MOI);

  // Une vue par jeu de paramètres : la base 12 ne remplace pas la base 8.
  const base = (n: number, deck: number) =>
    jouer('GetGuildSiegeBaseDefenseUnitList', req({ base_number: n, session_key: 'secret' }), ok0({ deck: [deck], tvalue: 2000 + n }));
  ok(!!(base(8, 1) && base(12, 2) && base(8, 3)), 'défenses de base : une ligne chacune');
  const bases = [...relire().vues.values()].filter((v) => v.commande === 'GetGuildSiegeBaseDefenseUnitList');
  egal(bases.length, 2, 'relu : une vue par base');
  egal(bases.find((v) => v.params.base_number === 8)?.reponse.deck, [3], 'la même base revue : la dernière réponse');
  egal([bases[0].contenu, bases[0].t], ['siege', 2008], 'le contenu est reconnu, l’heure serveur gardée');

  // Combats : la fin rejoint son début par `battle_key`.
  jouer('battleGuildMazeStart', req({ tile_id: 4 }), ok0({ battle_key: 77 }));
  jouer('battleGuildMazeResult', req({ battle_key: 77, win_lose: 1 }), ok0());
  jouer('BattleGuildSiegeStart_v2', req({ base_number: 12 }), ok0({ battle_key: 78 }));
  jouer('battleGuildRivalResult', req({ battle_key: 79, win_lose: 2 }), ok0());
  const combats = relire().combats;
  egal(combats.map((c) => [c.contenu, c.battle_key, !!c.debut, !!c.fin]), [
    ['labyrinthe', 77, true, true],
    ['siege', 78, true, false],
    ['rivaux', 79, false, true],
  ], 'début et fin reliés ; siège sans fin ; fin sans début gardée');
  egal(combats[0].fin?.params.win_lose, 1, 'le résultat est dans la fin');

  // Aucun secret, à aucune profondeur.
  jouer('GetGuildSiegeMatchupInfo', req(), ok0({ niveau: { session_key: 'secret', infocsv: 'x', base: 1 } }));
  ok(!lignes.join('\n').includes('secret'), 'aucune clé de session écrite');
  ok(!lignes.join('\n').includes('infocsv'), 'aucun identifiant du client écrit');

  // Ce qui n'est pas du contenu de guilde, ou pas le nôtre.
  egal(evenementGuilde(MOI, 'SellRune', req(), ok0()), null, 'une vente : ignorée');
  egal(evenementGuilde(MOI, 'BuyGuildBlackMarketItem', req(), ok0()), null, 'la boutique de guilde : ignorée');
  egal(evenementGuilde(MOI, 'GetGuildSiegeMatchupInfo', req(), { ret_code: 9 }), null, 'commande en échec : ignorée');
  egal(evenementGuilde(MOI, 'GetGuildSiegeMatchupInfo', { wizard_id: AUTRE }, ok0()), null, 'autre invocateur : ignoré');

  // Tout est gardé : plus de plafond de combats.
  for (let i = 0; i < 400; i++) jouer('battleGuildRivalStart', req(), ok0({ battle_key: 1000 + i }));
  egal(relire().combats.length, 3 + 400, 'tous les combats de la session');

  // Le texte d'une archive : plusieurs sessions à la suite, dont une d'un
  // autre invocateur, et une dernière ligne à moitié écrite.
  const autre = [JSON.stringify(ligneSessionGuilde(AUTRE, 3000, '9.9.9')), lignes[1]];
  const suite = [JSON.stringify(ligneSessionGuilde(MOI, 4000, '9.9.9')), JSON.stringify(evenementGuilde(MOI, 'battleGuildMazeStart', req(), ok0({ battle_key: 5 })))];
  const archive = [...lignes, ...autre, ...suite, suite[1].slice(0, 30)];
  egal(depuisLignesGuilde(archive, MOI).combats.length, 3 + 400 + 1, 'archive : les sessions de l’invocateur, pas celles d’un autre');
  egal(depuisLignesGuilde(archive, AUTRE).vues.size, 1, 'et celles de l’autre pour lui');

  // Ce qui s'archive d'une session finie : ses lignes complètes, ses dates.
  const texte = `${lignes.join('\n')}\n${lignes[1].slice(0, 10)}`;
  const bloc = blocSessionGuilde(texte);
  egal([bloc?.texte, bloc?.debut, bloc?.fin], [`${lignes.join('\n')}\n`, 1900, 2012], 'session archivée : lignes complètes, de la plus ancienne à la plus récente heure');
  egal(blocSessionGuilde(`${lignes[0]}\n`), null, 'session sans événement : rien à archiver');
}

// Le plugin CONSTRUIT (le fichier que SWEX charge), nourri par un faux SWEX :
// sa version est celle de l'app, et il écrit les deux fichiers sans secret.
export async function testPluginSwexPaquet() {
  titre('Plugin SWEX — le fichier construit, chargé comme par SW Exporter');
  // L'adresse que la page SW Exporter donne est celle où Vite émet le fichier.
  egal([CHEMIN_PLUGIN_SWEX, FICHIER_PLUGIN_SWEX], [CHEMIN_PLUGIN, NOM_PLUGIN], 'la page et la construction : même adresse');

  const racine = mkdtempSync(join(tmpdir(), 'plugin-swex-'));
  try {
    const { sortie, version } = await construirePluginSwex(join(racine, 'plugins'));
    egal(sortie.endsWith(NOM_PLUGIN), true, `un seul fichier, ${NOM_PLUGIN}`);
    const plugin = createRequire(join(racine, 'x.js'))(sortie);
    egal(version, JSON.parse(readFileSync('package.json', 'utf8')).version, 'la version du plugin est celle de l’app');
    egal(plugin.VERSION, version, 'la version est dans le plugin');
    ok(typeof plugin.init === 'function' && plugin.pluginName === 'SWBlacksmithLive', 'ce que SWEX attend : init, pluginName');
    egal(plugin.defaultConfig, { enabled: true, guilde: true }, 'réglages par défaut : activé, guilde comprise');

    // Le dossier de SW Exporter, avec l'export de ProfileExport : le plugin
    // reprend son nom (le pseudo nettoyé par ProfileExport).
    const dossier = join(racine, 'swex');
    mkdirSync(dossier);
    writeFileSync(join(dossier, 'Essai.Pro-100.json'), '{}');
    egal(nomDeBase(dossier, MOI, 'Essai/Pro'), 'Essai.Pro-100', 'nom repris de l’export');
    egal(nomDeBase(join(racine, 'absent'), MOI, 'Es:sai'), 'Essai-100', 'sans export : le pseudo nettoyé');
    egal(nomDeBase(dossier, 1100, 'X'), 'X-1100', 'un export d’un autre identifiant (…-100) n’est pas pris');

    // Pseudo changé : ProfileExport écrit un nouvel export, l'ancien reste. Le
    // plus récent donne le nom.
    const ailleurs = join(racine, 'renomme');
    mkdirSync(ailleurs);
    writeFileSync(join(ailleurs, 'Ancien-100.json'), '{}');
    utimesSync(join(ailleurs, 'Ancien-100.json'), new Date(2026, 0, 1), new Date(2026, 0, 1));
    writeFileSync(join(ailleurs, 'Nouveau-100.json'), '{}');
    egal(nomDeBase(ailleurs, MOI, 'Nouveau'), 'Nouveau-100', 'plusieurs exports : le plus récent');

    // Un dossier par invocateur, reconnu à son identifiant : le nom changé, il
    // est renommé avec ce qu'il contient.
    const dossierAncien = dossierInvocateur(ailleurs, MOI, 'Ancien-100');
    egal(dossierAncien, join(ailleurs, DOSSIER_PLUGIN, 'Ancien-100'), 'SWBlacksmith/<nom>-<id>');
    writeFileSync(join(dossierAncien, GUILDE_ARCHIVE), 'historique');
    const dossierNouveau = dossierInvocateur(ailleurs, MOI, 'Nouveau-100');
    egal(readdirSync(join(ailleurs, DOSSIER_PLUGIN)), ['Nouveau-100'], 'l’ancien dossier est renommé, pas doublé');
    egal(readFileSync(join(dossierNouveau, GUILDE_ARCHIVE), 'utf8'), 'historique', 'son contenu le suit');
    // Le dossier voulu existe déjà à côté d'un ancien : on s'y tient.
    mkdirSync(join(ailleurs, DOSSIER_PLUGIN, 'Autre-100'));
    egal(dossierInvocateur(ailleurs, MOI, 'Nouveau-100'), dossierNouveau, 'le dossier voulu existant est gardé');
    egal(readdirSync(join(ailleurs, DOSSIER_PLUGIN)).sort(), ['Autre-100', 'Nouveau-100'], 'rien n’est écrasé');

    let ecouteur: (req: Json, res: Json) => void = () => {};
    const journal: string[] = [];
    const proxy = { on: (_: string, f: typeof ecouteur) => (ecouteur = f), log: (e: Json) => journal.push(`${e.type} ${e.message}`) };
    const reglages = { enabled: true, guilde: true };
    const instance = plugin.creerPlugin();
    instance(proxy, { Config: { App: { filesPath: dossier }, Plugins: { SWBlacksmithLive: reglages } } });
    const attendre = () => instance.ecritures();
    const seConnecter = (res: Json = connexion()) =>
      ecouteur(req({ command: 'HubUserLogin' }), { ...res, wizard_info: { wizard_id: MOI, wizard_name: 'Essai.Pro' } });
    const dossierSuivi = join(dossier, DOSSIER_PLUGIN, 'Essai.Pro-100');
    const lire = (f: string) => readFileSync(join(dossierSuivi, f), 'utf8').split('\n').filter(Boolean);
    const lireGz = (f: string) => gunzipSync(readFileSync(join(dossierSuivi, f))).toString().split('\n').filter(Boolean);
    const live = () => lire(COMPTE_LIVE);
    const archive = () => lireGz(COMPTE_ARCHIVE);
    const meule = (i: number) => ecouteur(req({ command: 'AmplifyRune_v2' }), ok0({ rune: rune(12, {}, 15, { sec_eff: [[4, 10, 0, i]] }) }));
    const sec12 = (lignes: string[]) => versExport(depuisLignesLive(lignes)!).runes.find((r: Json) => r.rune_id === 12).sec_eff;
    const vueSiege = () => ecouteur(req({ command: 'GetGuildSiegeMatchupInfo' }), ok0({ carte: 1, session_key: 'secret' }));

    // Avant toute connexion : rien.
    meule(99);
    seConnecter();
    // Une série de meules, d'un coup : les lignes s'ajoutent dans l'ordre.
    for (let i = 0; i < 20; i++) meule(i);
    vueSiege();
    await attendre();

    egal(journal.filter((l) => l.startsWith('error')), [], 'aucune erreur d’écriture');
    egal(readdirSync(dossier).sort(), ['Essai.Pro-100.json', DOSSIER_PLUGIN].sort(), 'à la racine : l’export et le dossier du plugin, rien d’autre');
    egal(readdirSync(join(dossier, DOSSIER_PLUGIN)), ['Essai.Pro-100'], 'un dossier, au nom de l’export');
    egal(readdirSync(dossierSuivi).sort(), [COMPTE_ARCHIVE, COMPTE_LIVE, GUILDE_LIVE].sort(), 'les fichiers live et l’archive du compte, sans fichier temporaire');
    egal(live().length, 21, 'le fichier live : la connexion, puis une ligne par meule');
    egal(sec12(live()), [[4, 10, 0, 19]], 'relu, le fichier live donne le dernier état');
    egal([archive().length, JSON.parse(archive()[0]).format], [1, FORMAT_COMPTE_ARCHIVE], 'l’archive : l’état de la connexion');
    egal(lire(GUILDE_LIVE).map((l) => JSON.parse(l).type), ['session', 'vue'], 'la guilde : l’en-tête de session, puis la vue');
    egal(JSON.parse(lire(GUILDE_LIVE)[0]).format, FORMAT_GUILDE_LIVE, 'l’en-tête porte son format');
    // Le jeu redemande un écran en boucle : une vue inchangée (heure exclue)
    // ne se réécrit pas ; changée, ou d'autres paramètres, si.
    ecouteur(req({ command: 'GetGuildSiegeMatchupInfo' }), ok0({ carte: 1, session_key: 'secret', tvalue: 4242 }));
    ecouteur(req({ command: 'GetGuildSiegeMatchupInfo' }), ok0({ carte: 2 }));
    ecouteur(req({ command: 'GetGuildSiegeMatchupInfo', siege_id: 9 }), ok0({ carte: 2 }));
    ecouteur(req({ command: 'GetGuildSiegeMatchupInfo' }), ok0({ carte: 2, tvalue: 4343 }));
    await attendre();
    egal(
      lire(GUILDE_LIVE).map((l) => JSON.parse(l).reponse?.carte ?? null),
      [null, 1, 2, 2],
      'une vue au même contenu que la précédente du même écran n’est pas réécrite, même à une autre heure'
    );
    const tout = [COMPTE_LIVE, GUILDE_LIVE].map((f) => readFileSync(join(dossierSuivi, f), 'utf8')).join('') + archive().join('');
    ok(!tout.includes('secret'), 'aucune clé de session écrite, nulle part');

    // Reconnexion sans rien de changé : le live repart, l'archive du compte ne
    // double pas ; la session de guilde finie s'archive.
    seConnecter();
    await attendre();
    egal([live().length, archive().length], [1, 1], 'reconnexion à l’identique : nouvelle session, pas de second état archivé');
    egal(lireGz(GUILDE_ARCHIVE).map((l) => JSON.parse(l).type), ['session', 'vue', 'vue', 'vue'], 'la session de guilde finie : archivée en entier');
    egal(lire(GUILDE_LIVE).length, 1, 'une nouvelle session de guilde commence');
    // Un combat, puis une reconnexion après une partie hors du plugin.
    ecouteur(req({ command: 'battleGuildMazeStart' }), ok0({ battle_key: 77, tvalue: 5000 }));
    ecouteur(req({ command: 'battleGuildMazeResult', battle_key: 77, win_lose: 1 }), ok0({ tvalue: 5100 }));
    const changee = connexion();
    changee.runes[0] = rune(12, {}, 15, { sec_eff: [[4, 10, 0, 42]] });
    seConnecter(changee);
    await attendre();
    egal(archive().length, 2, 'connexion sur un compte changé : un état de plus dans l’archive');
    egal(sec12(live()), [[4, 10, 0, 42]], 'le live repart de la nouvelle connexion');
    const historique = depuisLignesGuilde(lireGz(GUILDE_ARCHIVE), MOI);
    egal([historique.vues.size, historique.combats.map((c) => [c.battle_key, !!c.debut, !!c.fin])], [2, [[77, true, true]]], 'l’archive de guilde relue : les deux sessions');
    egal((await parcourirArchive(join(dossierSuivi, GUILDE_ARCHIVE))).blocs.map((b) => b.fin), [1000, 5100], 'un bloc par session, daté');
    // Une reconnexion sans rien joué en guilde : rien de plus à archiver.
    seConnecter(changee);
    await attendre();
    egal((await parcourirArchive(join(dossierSuivi, GUILDE_ARCHIVE))).blocs.length, 2, 'session de guilde vide : pas archivée');

    // Le dossier supprimé pendant la partie : les fichiers live repartent.
    rmSync(join(dossier, DOSSIER_PLUGIN), { recursive: true });
    meule(7);
    meule(8);
    vueSiege();
    await attendre();
    egal(sec12(live()), [[4, 10, 0, 8]], 'dossier supprimé : recréé, le live relu donne le dernier état');
    egal(JSON.parse(live()[0]).type, 'connexion', 'il commence par une ligne de connexion');
    egal(lire(GUILDE_LIVE).map((l) => JSON.parse(l).type), ['session', 'vue'], 'la guilde repart de son en-tête');

    // La guilde désactivée dans SWEX : plus rien n'y est écrit, et à la
    // connexion la session s'archive sans qu'une autre ne commence.
    reglages.guilde = false;
    vueSiege();
    await attendre();
    egal(lire(GUILDE_LIVE).length, 2, 'guilde désactivée : la vue n’est pas écrite');
    seConnecter(changee);
    await attendre();
    ok(!readdirSync(dossierSuivi).includes(GUILDE_LIVE), 'connexion, guilde désactivée : pas de session de guilde');
    // Réactivée en cours de session : le fichier repart de son en-tête.
    reglages.guilde = true;
    vueSiege();
    await attendre();
    egal(lire(GUILDE_LIVE).map((l) => JSON.parse(l).type), ['session', 'vue'], 'guilde réactivée : en-tête, puis la vue');

    // Désactivé dans SWEX : plus rien n'est écrit.
    reglages.enabled = false;
    const avant = live().length;
    meule(9);
    await attendre();
    egal(live().length, avant, 'plugin désactivé : rien n’est écrit');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}
