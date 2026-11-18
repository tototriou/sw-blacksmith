// Le moteur du plugin SWEX « SW Blacksmith Live » (plugin-swex/source/) : un
// compte fabriqué, puis les commandes du jeu une à une. Chaque cas reprend un
// piège relevé en rejouant un vrai journal — le journal réel ne vient pas ici,
// il porte la clé de session du joueur.

import { appliquer, depuisConnexion, versExport, type Json } from '../plugin-swex/source/etatDirect';
import {
  COMBATS_MAX,
  FORMAT_GUILDE,
  appliquerGuilde,
  depuisFichierGuilde,
  guildeVide,
  versFichierGuilde,
} from '../plugin-swex/source/guilde';
import { DOSSIER_PLUGIN, FICHIER_COMPTE, FICHIER_GUILDE, dossierInvocateur, nomDeBase } from '../plugin-swex/source/fichiers';
import { CHEMIN_PLUGIN, NOM_PLUGIN, construirePluginSwex } from '../scripts/lib/construirePluginSwex.mjs';
import { CHEMIN_PLUGIN_SWEX, FICHIER_PLUGIN_SWEX } from '../src/lib/pluginSwex';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
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

function connexion(): Json {
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
  ok(
    appliquer(e, 'AmplifyRune_v2', req(), ok0({ rune: rune(12, {}, 15, { sec_eff: [[4, 10, 0, 5]] }), rune_craft_item: craft(41, 2), tvalue: 1100 })),
    'meule : le compte change'
  );
  let x = versExport(e);
  egal(x.runes.find((r: Json) => r.rune_id === 12).sec_eff, [[4, 10, 0, 5]], 'meule : la rune est meulée');
  egal(x.rune_craft_item_list[0].amount, 2, 'meule : une pierre de moins');
  egal(x.tvalue, 1100, 'l’heure serveur suit la dernière réponse');

  // Dernière pierre : le lot disparaît.
  appliquer(e, 'AmplifyRune_v2', req(), ok0({ rune: rune(12, {}), rune_craft_item: craft(41, 0) }));
  egal(versExport(e).rune_craft_item_list.length, 0, 'dernière pierre : le lot disparaît');

  // Vente : la réponse renvoie les runes VENDUES (rachat) — elles ne reviennent pas.
  appliquer(e, 'SellRune', req({ rune_id_list: [13] }), ok0({ runes: [rune(13, {})] }));
  egal(idsInventaire(versExport(e)), [12], 'vente : la rune vendue disparaît, malgré la réponse qui la montre');

  // Équipement : la rune 12 passe sur le monstre 1, la 11 retourne à l'inventaire.
  appliquer(
    e,
    'UpdateUnitEquip',
    req(),
    ok0({ EquipRuneList: { unit_info: unite(1, [rune(12, { unite: 1 })], [artefact(31, 1)], [relique(51)]) } })
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
  appliquer(e, 'GetBlackMarketList', req(), ok0({ market_list: [{ runes: [rune(90, {}, 0, { occupied_type: 3, occupied_id: 1 })] }] }));
  appliquer(e, 'GetWizardDataPart1', req(), ok0({ deck: [{ unit_id: 1, unit_master_id: 13413, runes: [11, 12] }] }));
  appliquer(e, 'BattleDungeonStart', req(), ok0({ dungeon_unit_list: [[{ unit_id: 14101, unit_master_id: 1, unit_level: 70, runes: [] }]] }));
  appliquer(e, 'getPlayPassInfo', req(), ok0({ pass: [rune(0, {})] }));
  appliquer(e, 'VisitFriend', req(), ok0({ unit_list: [{ ...unite(9, []), wizard_id: AUTRE }] }));
  appliquer(e, 'GetGuildSiegeDefenseDeckListAlly', req(), ok0({ unit_list: [unite(1, [rune(11, { unite: 1 })])] }));
  appliquer(e, 'GetRTPvPInfo_v3', req(), ok0({ unit_list: [unite(2, [])] }));
  egal(JSON.stringify(versExport(e)), avant, 'marché noir, decks recommandés, ennemis, aperçus, amis, siège, RTA : rien ne change');

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

  // Monstres retirés (mis en stock, sacrifiés).
  appliquer(e, 'ConvertUnitToStorage', req({ unit_id_list: [1] }), ok0({ remove_unit_id_list: [1] }));
  egal(versExport(e).unit_list.map((u: Json) => u.unit_id), [2], 'monstre mis en stock : il disparaît');

  // Reliques : partagées, mises à jour à chaque vue.
  appliquer(e, 'BattleDungeonResult_V2', req(), ok0({ unit_list: [unite(2, [rune(12, { unite: 2 })], [], [relique(52, 3)])] }));
  egal(versExport(e).relics.find((r: Json) => r.rid === 52).upgrade_curr, 3, 'relique vue sur un monstre : la liste du compte suit');

  // Garde-fous : une commande en échec, un autre invocateur.
  const fige = JSON.stringify(versExport(e));
  ok(!appliquer(e, 'SellRune', req({ rune_id_list: [12] }), { ret_code: 1 }), 'commande en échec : ignorée');
  ok(!appliquer(e, 'SellRune', { wizard_id: AUTRE, rune_id_list: [12] }, ok0()), 'autre invocateur : ignoré');
  egal(JSON.stringify(versExport(e)), fige, 'rien n’a changé');
}

export function testPluginSwexGuilde() {
  titre('Plugin SWEX — le contenu des combats de guilde');
  const g = guildeVide(MOI);

  // Une vue par jeu de paramètres : la base 12 ne remplace pas la base 8.
  const base = (n: number, deck: number) =>
    appliquerGuilde(g, 'GetGuildSiegeBaseDefenseUnitList', req({ base_number: n, session_key: 'secret' }), ok0({ deck: [deck], tvalue: 2000 + n }));
  ok(base(8, 1) && base(12, 2) && base(8, 3), 'défenses de base : retenues');
  const vues = versFichierGuilde(g).vues as Record<string, Json>;
  const bases = Object.values(vues).filter((v) => v.commande === 'GetGuildSiegeBaseDefenseUnitList');
  egal(bases.length, 2, 'une vue par base');
  egal(bases.find((v) => v.params.base_number === 8)?.reponse.deck, [3], 'la même base revue : la dernière réponse');
  egal(bases[0].contenu, 'siege', 'le contenu est reconnu');

  // Combats : la fin rejoint son début par `battle_key`.
  appliquerGuilde(g, 'battleGuildMazeStart', req({ tile_id: 4 }), ok0({ battle_key: 77 }));
  appliquerGuilde(g, 'battleGuildMazeResult', req({ battle_key: 77, win_lose: 1 }), ok0());
  appliquerGuilde(g, 'BattleGuildSiegeStart_v2', req({ base_number: 12 }), ok0({ battle_key: 78 }));
  appliquerGuilde(g, 'battleGuildRivalResult', req({ battle_key: 79, win_lose: 2 }), ok0());
  let combats = versFichierGuilde(g).combats as Json[];
  egal(combats.map((c) => [c.contenu, c.battle_key, !!c.debut, !!c.fin]), [
    ['labyrinthe', 77, true, true],
    ['siege', 78, true, false],
    ['rivaux', 79, false, true],
  ], 'début et fin reliés ; siège sans fin ; fin sans début gardée');
  egal(combats[0].fin.requete.win_lose, 1, 'le résultat est dans la fin');

  // Aucun secret, à aucune profondeur.
  appliquerGuilde(g, 'GetGuildSiegeMatchupInfo', req(), ok0({ niveau: { session_key: 'secret', infocsv: 'x', base: 1 } }));
  ok(!JSON.stringify(versFichierGuilde(g)).includes('secret'), 'aucune clé de session écrite');
  ok(!JSON.stringify(versFichierGuilde(g)).includes('infocsv'), 'aucun identifiant du client écrit');

  // Ce qui n'est pas du contenu de guilde, ou pas le nôtre.
  ok(!appliquerGuilde(g, 'SellRune', req(), ok0()), 'une vente : ignorée');
  ok(!appliquerGuilde(g, 'BuyGuildBlackMarketItem', req(), ok0()), 'la boutique de guilde : ignorée');
  ok(!appliquerGuilde(g, 'GetGuildSiegeMatchupInfo', req(), { ret_code: 9 }), 'commande en échec : ignorée');
  ok(!appliquerGuilde(g, 'GetGuildSiegeMatchupInfo', { wizard_id: AUTRE }, ok0()), 'autre invocateur : ignoré');

  // Les combats les plus récents seulement.
  for (let i = 0; i < COMBATS_MAX + 5; i++) appliquerGuilde(g, 'battleGuildRivalStart', req(), ok0({ battle_key: 1000 + i }));
  combats = versFichierGuilde(g).combats as Json[];
  egal([combats.length, combats[combats.length - 1].battle_key], [COMBATS_MAX, 1000 + COMBATS_MAX + 4], 'combats : les plus récents gardés');

  // Le plugin redémarré reprend son fichier ; un autre invocateur repart de zéro.
  const fichier = JSON.parse(JSON.stringify(versFichierGuilde(g)));
  egal(fichier.format, FORMAT_GUILDE, 'le fichier porte son format');
  const repris = depuisFichierGuilde(fichier, MOI);
  egal([repris.vues.size, repris.combats.length], [g.vues.size, g.combats.length], 'fichier repris : vues et combats');
  egal(depuisFichierGuilde(fichier, AUTRE).vues.size, 0, 'fichier d’un autre invocateur : rien de repris');
  egal(depuisFichierGuilde({ format: 'autre' }, MOI).combats.length, 0, 'autre format : rien de repris');
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
    writeFileSync(join(dossierAncien, FICHIER_GUILDE), 'historique');
    const dossierNouveau = dossierInvocateur(ailleurs, MOI, 'Nouveau-100');
    egal(readdirSync(join(ailleurs, DOSSIER_PLUGIN)), ['Nouveau-100'], 'l’ancien dossier est renommé, pas doublé');
    egal(readFileSync(join(dossierNouveau, FICHIER_GUILDE), 'utf8'), 'historique', 'son contenu le suit');
    // Le dossier voulu existe déjà à côté d'un ancien : on s'y tient.
    mkdirSync(join(ailleurs, DOSSIER_PLUGIN, 'Autre-100'));
    egal(dossierInvocateur(ailleurs, MOI, 'Nouveau-100'), dossierNouveau, 'le dossier voulu existant est gardé');
    egal(readdirSync(join(ailleurs, DOSSIER_PLUGIN)).sort(), ['Autre-100', 'Nouveau-100'], 'rien n’est écrasé');

    let ecouteur: (req: Json, res: Json) => void = () => {};
    const journal: string[] = [];
    const proxy = { on: (_: string, f: typeof ecouteur) => (ecouteur = f), log: (e: Json) => journal.push(`${e.type} ${e.message}`) };
    const reglages = { enabled: true, guilde: true };
    plugin.creerPlugin(0)(proxy, { Config: { App: { filesPath: dossier }, Plugins: { SWBlacksmithLive: reglages } } });

    // Avant toute connexion : rien.
    ecouteur(req({ command: 'AmplifyRune_v2' }), ok0({ rune: rune(12, {}) }));
    ecouteur(req({ command: 'HubUserLogin' }), { ...connexion(), wizard_info: { wizard_id: MOI, wizard_name: 'Essai.Pro' } });
    // Une série de meules, d'un coup : les écritures ne se marchent pas dessus.
    for (let i = 0; i < 20; i++) ecouteur(req({ command: 'AmplifyRune_v2' }), ok0({ rune: rune(12, {}, 15, { sec_eff: [[4, 10, 0, i]] }) }));
    ecouteur(req({ command: 'GetGuildSiegeMatchupInfo' }), ok0({ carte: 1, session_key: 'secret' }));
    await new Promise((r) => setTimeout(r, 300));

    egal(journal.filter((l) => l.startsWith('error')), [], 'aucune erreur d’écriture');
    egal(readdirSync(dossier).sort(), ['Essai.Pro-100.json', DOSSIER_PLUGIN].sort(),'à la racine : l’export et le dossier du plugin, rien d’autre');
    const dossierSuivi = join(dossier, DOSSIER_PLUGIN, 'Essai.Pro-100');
    egal(readdirSync(join(dossier, DOSSIER_PLUGIN)), ['Essai.Pro-100'], 'un dossier, au nom de l’export');
    egal(readdirSync(dossierSuivi).sort(), [FICHIER_COMPTE, FICHIER_GUILDE], 'les deux fichiers, sans fichier temporaire');
    const compte = readFileSync(join(dossierSuivi, FICHIER_COMPTE), 'utf8');
    egal(JSON.parse(compte).runes.find((r: Json) => r.rune_id === 12).sec_eff, [[4, 10, 0, 19]], 'le compte écrit est le dernier état');
    ok(!compte.includes('secret') && !readFileSync(join(dossierSuivi, FICHIER_GUILDE), 'utf8').includes('secret'), 'aucune clé de session écrite');

    // Le dossier supprimé pendant la partie : il est recréé à l'écriture suivante.
    rmSync(join(dossier, DOSSIER_PLUGIN), { recursive: true });
    ecouteur(req({ command: 'AmplifyRune_v2' }), ok0({ rune: rune(12, {}) }));
    await new Promise((r) => setTimeout(r, 100));
    ok(readdirSync(dossierSuivi).includes(FICHIER_COMPTE), 'dossier supprimé : recréé');

    // Désactivé dans SWEX : plus rien n'est écrit.
    reglages.enabled = false;
    rmSync(join(dossierSuivi, FICHIER_COMPTE));
    ecouteur(req({ command: 'AmplifyRune_v2' }), ok0({ rune: rune(12, {}) }));
    await new Promise((r) => setTimeout(r, 100));
    ok(!readdirSync(dossierSuivi).includes(FICHIER_COMPTE), 'plugin désactivé : rien n’est écrit');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}
