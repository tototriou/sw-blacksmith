// L'ARÈNE DIMENSIONNELLE tenue à jour par le plugin SWEX « SW Blacksmith
// Live » : sa box n'est pas dans l'export de compte. Le jeu l'envoie entière à
// chaque ouverture du mode (`dimensionarena_getSeasonInfo` : monstres, runes
// en inventaire, builds par défaut, défense) ; on part de cette SAISON, puis on
// lui applique ce que le serveur renvoie à chaque changement fait dans le mode.
// Le fichier écrit garde la forme de la réponse du jeu : l'app la lit comme
// telle (src/lib/importAccount.ts, `parseDimension…`).
//
// Calcul PUR (aucun accès disque) : le plugin l'assemble, les tests le
// rejouent. ⚠️ Établi sur un journal réel (docs/02-app/bureau/feat-swex-direct.md,
// « L'arène dimensionnelle ») : chaque saison reconstruite à partir de la
// précédente et des changements entre les deux égale celle que le jeu renvoie
// ensuite.
//
// ⚠️ **Une rune ne vit qu'à un endroit.** `dimensionarena_setRuneList` renvoie
// le monstre équipé ENTIER, et dans `rune_list` les seules runes qui ont
// bougé : celles posées sur lui (`occupied_type` 1) et celles qu'il a rendues à
// l'inventaire (`occupied_type` 2). Une rune prise à un AUTRE monstre ne lui
// est pas renvoyée : on la lui retire. Toute rune vue est donc d'abord ôtée de
// partout, puis rangée là où elle est.

import type { Json } from './etatDirect';

export const FORMAT_DIMENSION = 'swblacksmith/dimension';
export const VERSION_DIMENSION = 1;
// Le type des équipes d'attaque d'arène dimensionnelle dans `deck_recent_list`
// (celui de l'export de compte, que l'app lit déjà).
export const TYPE_ATTAQUE_DIMENSION = 28;
// Les dernières équipes d'attaque gardées, distinctes, la plus récente d'abord.
// L'export n'en garde qu'une (relevé) : au-delà, l'onglet Offense en montre
// plusieurs.
export const ATTAQUES_GARDEES = 5;

const OUVERTURE = 'dimensionarena_getSeasonInfo';

// Les clés qui ne sortent jamais dans le fichier écrit.
const SECRETS = ['session_key', 'session_key_node', 'reqid'];
const sansSecrets = (o: Json): Json => Object.fromEntries(Object.entries(o).filter(([k]) => !SECRETS.includes(k)));

// Ce que le plugin ajoute à la saison du jeu : de quoi la reconnaître, et ses
// heures serveur — `ouverture`, la dernière ouverture du mode ; `t`, le dernier
// changement. L'app n'annonce que ce qui suit une nouvelle ouverture.
export interface MarqueDimension {
  format: typeof FORMAT_DIMENSION;
  version: number;
  plugin: string;
  ouverture: number;
  t: number;
}

const idSaison = (s: Json): number | null => {
  const id = Number(s.schedule_info?.season_id ?? s.user_info?.season_id ?? s.defense_deck_info?.season_id);
  return Number.isFinite(id) ? id : null;
};
const liste = (x: unknown): Json[] => (Array.isArray(x) ? x : []);
const occupee = (r: Json) => Number(r.occupied_type) === 1 && Number(r.occupied_id) > 0;

// Une rune ôtée de partout : inventaire et monstres.
function oterRune(s: Json, id: number) {
  s.rune_list = liste(s.rune_list).filter((r) => Number(r.rune_id) !== id);
  for (const u of liste(s.unit_list)) if (Array.isArray(u.runes)) u.runes = u.runes.filter((r: Json) => Number(r.rune_id) !== id);
}

// Un monstre de la box remplacé à sa place (ou ajouté à la fin).
function poserMonstre(s: Json, u: Json) {
  const unites = liste(s.unit_list);
  const i = unites.findIndex((x) => Number(x.unit_id) === Number(u.unit_id));
  if (i >= 0) unites[i] = u;
  else unites.push(u);
  s.unit_list = unites;
}

// Ce qu'une commande change à la saison ; `false` : rien.
type Regle = (s: Json, req: Json, res: Json) => boolean;
const REGLES: Record<string, Regle> = {
  dimensionarena_setRuneList: (s, _req, res) => {
    const u = liste(res.unit_list)[0];
    if (!u) return false;
    const runes = [...liste(u.runes), ...liste(res.rune_list)];
    for (const r of runes) oterRune(s, Number(r.rune_id));
    poserMonstre(s, u);
    for (const r of liste(res.rune_list)) {
      if (!occupee(r)) s.rune_list = [...liste(s.rune_list), r];
    }
    return true;
  },
  dimensionarena_setDefenseDeck: (s, _req, res) => {
    if (!res.defense_deck_info) return false;
    s.defense_deck_info = res.defense_deck_info;
    if (res.participation_info) s.participation_info = res.participation_info;
    return true;
  },
  dimensionarena_summonUnit: (s, _req, res) => {
    const nouveaux = liste(res.unit_list);
    for (const u of nouveaux) poserMonstre(s, u);
    if (res.user_info) s.user_info = res.user_info;
    return nouveaux.length > 0 || !!res.user_info;
  },
  dimensionarena_receiveBattleCountReward: (s, _req, res) => {
    for (const r of liste(res.rune_list)) {
      oterRune(s, Number(r.rune_id));
      s.rune_list = [...liste(s.rune_list), r];
    }
    if (res.user_info) s.user_info = res.user_info;
    return true;
  },
  // Une attaque : son équipe, dans l'ordre envoyé (leader en tête, comme
  // `leader_unit_id` de l'export — relevé), devant les précédentes.
  dimensionarena_battleStart: (s, req, res) => {
    const ids = liste(req.unit_id_list).map(Number).filter((x) => Number.isFinite(x) && x > 0);
    if (!ids.length) return false;
    const cle = [...ids].sort((a, b) => a - b).join();
    const autres = liste(s.deck_recent_list).filter(
      (d) => Number(d.type) !== TYPE_ATTAQUE_DIMENSION || [...liste(d.unit_id_list)].map(Number).sort((a, b) => a - b).join() !== cle
    );
    s.deck_recent_list = [
      { type: TYPE_ATTAQUE_DIMENSION, sub_type: 0, unit_id_list: ids, equip: [], leader_unit_id: ids[0] },
      ...autres,
    ].slice(0, ATTAQUES_GARDEES);
    if (res.user_info) s.user_info = res.user_info;
    if (res.participation_info) s.participation_info = res.participation_info;
    return true;
  },
  dimensionarena_battleResult: (s, _req, res) => {
    if (res.user_info) s.user_info = res.user_info;
    if (res.participation_info) s.participation_info = res.participation_info;
    return !!(res.user_info || res.participation_info);
  },
  dimensionarena_updateFavoriteUnitList: (s, _req, res) => {
    if (!Array.isArray(res.favorite_unit_list)) return false;
    s.favorite_unit_list = res.favorite_unit_list;
    return true;
  },
};

// La saison après la commande `commande`, ou `null` si elle ne la change pas.
// Une ouverture du mode REMPLACE la saison (les attaques gardées restent si
// c'est la même saison du jeu) ; un changement d'une autre saison que celle
// tenue, ou sans saison tenue, est ignoré : la prochaine ouverture rattrape.
// ⚠️ La saison donnée n'est jamais modifiée : l'écriture du fichier peut
// attendre son tour.
export function appliquerDimension(saison: Json | null, commande: string, req: Json, res: Json, plugin: string): Json | null {
  const t = Number(res.tvalue);
  if (!Number.isFinite(t)) return null;
  if (commande === OUVERTURE) {
    const nouvelle = sansSecrets(res);
    const memeSaison = saison && idSaison(saison) === idSaison(nouvelle);
    if (memeSaison && Array.isArray(saison.deck_recent_list)) nouvelle.deck_recent_list = saison.deck_recent_list;
    nouvelle.swblacksmith = { format: FORMAT_DIMENSION, version: VERSION_DIMENSION, plugin, ouverture: t, t } satisfies MarqueDimension;
    return nouvelle;
  }
  const regle = REGLES[commande];
  if (!regle || !saison) return null;
  const id = Number(res.season_id);
  if (Number.isFinite(id) && id !== idSaison(saison)) return null;
  // Une copie profonde : la saison en file d'écriture ne bouge pas. Par JSON,
  // pas `structuredClone` : SWEX peut tourner sur un Node qui ne l'a pas.
  const s: Json = JSON.parse(JSON.stringify(saison));
  if (!regle(s, req, res)) return null;
  s.tvalue = t;
  s.swblacksmith = { ...(s.swblacksmith as MarqueDimension), t };
  return s;
}

// Les commandes de l'arène dimensionnelle que le plugin suit.
export const estCommandeDimension = (commande: string) => commande === OUVERTURE || commande in REGLES;
