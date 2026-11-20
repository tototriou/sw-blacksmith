// L'arène dimensionnelle tenue par le plugin SWEX
// (plugin-swex/source/dimension.ts) : la saison de l'ouverture du mode, puis
// chaque changement fait dans le mode. Sur une saison FABRIQUÉE (fixture
// `dimension-saison-miniature.json`, sans donnée réelle) ; et, s'il est là,
// sur le journal SWEX réel du développeur (gitignoré) : chaque ouverture du
// mode doit égaler la saison reconstruite depuis la précédente.

import { readFileSync } from 'node:fs';
import { ATTAQUES_GARDEES, appliquerDimension, estCommandeDimension, FORMAT_DIMENSION, TYPE_ATTAQUE_DIMENSION } from '../plugin-swex/source/dimension';
import { egal, ignore, journalSwexReel, ok, titre } from './outils';

type Json = Record<string, any>;
const OUVERTURE = 'dimensionarena_getSeasonInfo';
const saisonFixture = (): Json => JSON.parse(readFileSync('tests/fixtures/dimension-saison-miniature.json', 'utf8'));
const ouvrir = (extra: Json = {}) => appliquerDimension(null, OUVERTURE, {}, { ...saisonFixture(), reqid: 'secret', session_key: 'secret', ...extra }, 'essai')!;
const rune = (rune_id: number, slot_no: number, occupied_id = 0): Json => ({ rune_id, slot_no, occupied_type: occupied_id ? 1 : 2, occupied_id, set_id: 3, pri_eff: [1, 100] });
const monstre = (s: Json, id: number) => s.unit_list.find((u: Json) => u.unit_id === id);
const ou = (s: Json, rune_id: number) => {
  if (s.rune_list.some((r: Json) => r.rune_id === rune_id)) return 'inventaire';
  const u = s.unit_list.find((x: Json) => (x.runes ?? []).some((r: Json) => r.rune_id === rune_id));
  return u ? u.unit_id : null;
};

export function testPluginSwexDimension() {
  titre('Plugin SWEX — l’arène dimensionnelle : la saison et ses changements');
  const s0 = ouvrir();
  egal([s0.swblacksmith.format, s0.swblacksmith.ouverture, s0.swblacksmith.t, s0.swblacksmith.plugin], [FORMAT_DIMENSION, 2000, 2000, 'essai'], 'l’ouverture du mode : la saison du jeu, marquée de ses heures');
  ok(!JSON.stringify(s0).includes('secret'), 'aucune clé de session dans la saison');
  egal(appliquerDimension(s0, 'dimensionarena_getStatusInfo', {}, { tvalue: 2001 }, 'essai'), null, 'une commande qui ne change rien : rien à écrire');
  egal(appliquerDimension(null, 'dimensionarena_setDefenseDeck', {}, { tvalue: 2001, defense_deck_info: {} }, 'essai'), null, 'un changement sans saison tenue : ignoré, la prochaine ouverture rattrape');
  egal(
    appliquerDimension(s0, 'dimensionarena_setDefenseDeck', {}, { tvalue: 2001, season_id: 2, defense_deck_info: { unit_id_list: [[1, 0, 0, 0]] } }, 'essai'),
    null,
    'un changement d’une autre saison du jeu : ignoré'
  );
  ok(estCommandeDimension(OUVERTURE) && estCommandeDimension('dimensionarena_setRuneList') && !estCommandeDimension('dimensionarena_getRanking'), 'les commandes suivies');

  // Poser une rune de l'inventaire sur un monstre (relevé : le monstre entier,
  // et dans `rune_list` la rune posée).
  const posee = rune(2000100, 2, 900001);
  const s1 = appliquerDimension(
    s0,
    'dimensionarena_setRuneList',
    { unit_id: 900001, rune_id_list: [2000100] },
    { tvalue: 2100, season_id: 1, unit_list: [{ ...monstre(s0, 900001), runes: [posee] }], rune_list: [posee] },
    'essai'
  )!;
  egal([ou(s1, 2000100), s1.rune_list.length, s1.swblacksmith.t, s1.swblacksmith.ouverture], [900001, 0, 2100, 2000], 'une rune de l’inventaire posée : portée par le monstre, plus dans l’inventaire');
  egal([ou(s0, 2000100), s0.rune_list.length], ['inventaire', 1], 'la saison d’avant n’a pas bougé (l’écriture peut attendre son tour)');

  // Prendre la rune d'un AUTRE monstre, sur un emplacement déjà occupé : la
  // réponse ne renvoie pas l'autre monstre ; la rune remplacée part à
  // l'inventaire (`occupied_type` 2).
  const prise = rune(2000006, 2, 900001);
  const rendue = rune(2000100, 2);
  const s2 = appliquerDimension(
    s1,
    'dimensionarena_setRuneList',
    { unit_id: 900001, rune_id_list: [2000006] },
    { tvalue: 2200, season_id: 1, unit_list: [{ ...monstre(s1, 900001), runes: [prise] }], rune_list: [prise, rendue] },
    'essai'
  )!;
  egal(
    [ou(s2, 2000006), ou(s2, 2000100), monstre(s2, 900002).runes.map((r: Json) => r.rune_id)],
    [900001, 'inventaire', [2000005]],
    'une rune prise à un autre monstre : il la perd ; la rune remplacée revient à l’inventaire'
  );

  // La défense, une invocation, une récompense, les favoris.
  const s3 = appliquerDimension(s2, 'dimensionarena_setDefenseDeck', {}, { tvalue: 2300, season_id: 1, defense_deck_info: { unit_id_list: [[900003, 900001, 0, 0]], season_id: 1 } }, 'essai')!;
  egal(s3.defense_deck_info.unit_id_list, [[900003, 900001, 0, 0]], 'la défense changée');
  const s4 = appliquerDimension(s3, 'dimensionarena_summonUnit', {}, { tvalue: 2400, season_id: 1, unit_list: [{ unit_id: 900004, unit_master_id: 14314, runes: [] }], user_info: { dimension_arena_scroll: 0 } }, 'essai')!;
  egal([s4.unit_list.map((u: Json) => u.unit_id), s4.user_info.dimension_arena_scroll], [[900001, 900002, 900003, 900004], 0], 'un monstre invoqué : ajouté à la box');
  const gagnee = rune(2000200, 4);
  const s5 = appliquerDimension(s4, 'dimensionarena_receiveBattleCountReward', {}, { tvalue: 2500, season_id: 1, rune_list: [gagnee] }, 'essai')!;
  egal(ou(s5, 2000200), 'inventaire', 'une rune gagnée : dans l’inventaire');
  const s6 = appliquerDimension(s5, 'dimensionarena_updateFavoriteUnitList', {}, { tvalue: 2550, season_id: 1, favorite_unit_list: [[900001], []] }, 'essai')!;
  egal(s6.favorite_unit_list, [[900001], []], 'les favoris');

  // Les attaques : l'équipe envoyée, leader en tête (relevé : comme
  // `leader_unit_id` de l'export), la plus récente d'abord, sans doublon.
  let s = s6;
  const attaquer = (ids: number[], t: number) => (s = appliquerDimension(s, 'dimensionarena_battleStart', { unit_id_list: ids }, { tvalue: t, season_id: 1 }, 'essai')!);
  attaquer([900002, 900001, 900003, 900004], 2600);
  egal(s.deck_recent_list, [{ type: TYPE_ATTAQUE_DIMENSION, sub_type: 0, unit_id_list: [900002, 900001, 900003, 900004], equip: [], leader_unit_id: 900002 }], 'une attaque : son équipe, sous la forme de l’export');
  attaquer([900001, 900002, 900003, 900004], 2700);
  egal([s.deck_recent_list.length, s.deck_recent_list[0].leader_unit_id], [1, 900001], 'la même équipe rejouée (autre ordre) : une seule fois, dans son dernier ordre');
  for (let i = 0; i < ATTAQUES_GARDEES + 2; i++) attaquer([900010 + i, 900001, 0, 0], 2800 + i);
  egal([s.deck_recent_list.length, s.deck_recent_list[0].unit_id_list], [ATTAQUES_GARDEES, [900016, 900001]], `les ${ATTAQUES_GARDEES} dernières équipes, la plus récente d’abord`);
  const resultat = appliquerDimension(s, 'dimensionarena_battleResult', {}, { tvalue: 2900, season_id: 1, participation_info: { attack_win_count: 1 } }, 'essai')!;
  egal(resultat.participation_info, { attack_win_count: 1 }, 'un résultat de combat : la participation');

  // Rouvrir le mode : la saison du jeu remplace la tenue ; les attaques
  // restent si c'est la même saison du jeu.
  const rouverte = appliquerDimension(resultat, OUVERTURE, {}, { ...saisonFixture(), tvalue: 3000 }, 'essai')!;
  egal([rouverte.deck_recent_list.length, rouverte.swblacksmith.ouverture, rouverte.unit_list.length], [ATTAQUES_GARDEES, 3000, 3], 'une nouvelle ouverture : la saison du jeu, les attaques de la saison gardées');
  const autreSaison = appliquerDimension(resultat, OUVERTURE, {}, { ...saisonFixture(), tvalue: 3000, defense_deck_info: { unit_id_list: [[0, 0, 0, 0]], season_id: 2 } }, 'essai')!;
  egal(autreSaison.deck_recent_list, undefined, 'une autre saison du jeu : les attaques de la précédente ne suivent pas');
}

// Rejoue dans le moteur du plugin les échanges de l'arène dimensionnelle d'un
// journal SWEX (`full_log.txt` : `API Command: <commande> - <date>`, puis
// `Request:` et `Response:` en JSON). Rend la saison tenue de chaque
// invocateur, et, à chaque ouverture du mode précédée de changements, la
// saison tenue face à celle que le jeu renvoie.
export function rejouerDimension(texte: string) {
  const re = /API Command: (\w+) - /g;
  const tenues = new Map<number, Json>();
  const changees = new Set<number>();
  const ouvertures: { tenue: Json; jeu: Json }[] = [];
  const lire = (s: string) => {
    try {
      return JSON.parse(s.slice(s.indexOf('{')));
    } catch {
      return null;
    }
  };
  let m: RegExpExecArray | null;
  while ((m = re.exec(texte))) {
    if (!estCommandeDimension(m[1])) continue;
    const fin = texte.indexOf('\nAPI Command: ', m.index + 10);
    const echange = texte.slice(m.index, fin < 0 ? undefined : fin);
    const req = lire(echange.slice(echange.indexOf('Request:'), echange.indexOf('Response:')));
    const res = lire(echange.slice(echange.indexOf('Response:')));
    if (!req || !res || Number(res.ret_code) !== 0) continue;
    const w = Number(req.wizard_id);
    const tenue = tenues.get(w) ?? null;
    if (m[1] === OUVERTURE && tenue && changees.has(w)) ouvertures.push({ tenue, jeu: res });
    if (m[1] === OUVERTURE) changees.delete(w);
    else changees.add(w);
    const apres = appliquerDimension(tenue, m[1], req, res, 'rejeu');
    if (apres) tenues.set(w, apres);
  }
  return { tenues, ouvertures };
}

// Le journal SWEX réel rejoué : à chaque ouverture du mode précédée de
// changements, la saison reconstruite égale celle que le jeu renvoie (où est
// chaque rune, la box, la défense).
export function testPluginSwexDimensionReel() {
  titre('Plugin SWEX — l’arène dimensionnelle rejouée sur un journal réel');
  const texte = journalSwexReel();
  if (!texte) {
    ignore('arène dimensionnelle : rejeu réel', 'journal SWEX réel (full_log.txt) absent');
    return;
  }
  const places = (s: Json) => {
    const m = new Map<number, string>();
    for (const r of s.rune_list ?? []) m.set(r.rune_id, 'inventaire');
    for (const u of s.unit_list ?? []) for (const r of u.runes ?? []) m.set(r.rune_id, String(u.unit_id));
    return m;
  };
  const box = (s: Json) => (s.unit_list ?? []).map((u: Json) => u.unit_id).sort().join();
  const defense = (s: Json) => JSON.stringify(s.defense_deck_info?.unit_id_list);
  const { ouvertures } = rejouerDimension(texte);
  const comparees = ouvertures.length;
  const ecarts = ouvertures.flatMap(({ tenue, jeu }, i) => {
    const [a, b] = [places(tenue), places(jeu)];
    const runesEgales = a.size === b.size && [...b].every(([id, p]) => a.get(id) === p);
    return runesEgales && box(tenue) === box(jeu) && defense(tenue) === defense(jeu) ? [] : [`ouverture ${i + 1}`];
  });
  if (!comparees) {
    ignore('arène dimensionnelle : rejeu réel', 'aucun changement fait dans le mode dans ce journal');
    return;
  }
  egal(ecarts, [], `les ${comparees} ouvertures précédées de changements égalent la saison reconstruite`);
}
