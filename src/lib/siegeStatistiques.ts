// Les statistiques des sièges, tirées des fichiers de guilde du plugin SWEX
// (`SWBlacksmith/<nom>-<id>/guilde.*`, plugin-swex/source/guilde.ts). Calcul PUR :
// l'application de bureau lit les fichiers (bureau/swexGuilde.ts) et pose
// chaque événement ici ; la page n'a que le résultat, compact.
//
// ⚠️ **Le plugin n'enregistre que ce que le jeu MONTRE** : un écran de siège
// jamais ouvert n'a rien laissé. Chaque siège dit d'où viennent ses données
// (`sources`), et ce qui manque reste absent — jamais un zéro inventé.
//
// Le sens des codes, établi par recoupement sur un journal réel (siège joué,
// 439 combats ; docs/02-app/siege/statistiques.md) — pas supposé :
//  - `win_lose` : 1 victoire, 2 défaite, du point de vue de `wizard_id`. Seul 1
//    rapporte des points (`match_score_var`). Aucun autre code n'a été vu : il
//    reste inconnu (`victoire: null`).
//  - `log_type` : 1 une attaque, 2 une défense. Le résumé du match donne
//    chaque combat DEUX fois, une ligne de chaque, au résultat inversé ; dans
//    une ligne de défense, `wizard_id` est le défenseur, `opp_wizard_id`
//    l'attaquant. `guild_id` est toujours la guilde de `wizard_id`.
//  - `view_battle_deck_info` (journaux de combat) : [monstres de l'attaque,
//    monstres de la défense], dans les deux types — vérifié sur des combats vus
//    des deux côtés, et contre le début de chaque attaque du joueur.
//  - une entrée de journal et la ligne du résumé du même combat ont la même
//    heure (`log_timestamp`), à la seconde.
//  - `getGuildSiegeMatchResult` ne dit pas de quel siège il parle : c'est le
//    dernier siège fini à son heure.

import type { EvenementGuilde } from '../../plugin-swex/source/guilde';

type Json = Record<string, unknown>;
const tab = (v: unknown): Json[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Json[]) : []);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const texte = (v: unknown): string => (typeof v === 'string' ? v : '');

// ── Ce que la page reçoit ───────────────────────────────────────────────

export interface GuildeSiege {
  id: number;
  nom: string;
  // Place sur la carte (`pos_id`), et rang dans le match (`match_rank`) :
  // provisoire tant que le siège n'est pas fini.
  position: number | null;
  rang: number | null;
  score: number | null;
  membres: number | null; // membres ayant joué
  attaques: number | null;
  monstresUtilises: number | null;
  mienne: boolean;
}

export interface JoueurSiege {
  id: number;
  nom: string;
  guilde: number;
}

export interface AttaqueSiege {
  t: number;
  attaquant: number;
  guildeAttaquante: number;
  defenseur: number;
  guildeDefense: number;
  // `null` : code de résultat inconnu.
  victoire: boolean | null;
  // Connus seulement si le journal de combat a été ouvert en jeu.
  base: number | null;
  monstres: { attaque: number[]; defense: number[] } | null;
  // Les points de siège que l'attaque a rapportés (`match_score_var` d'une
  // entrée de journal vue de l'attaquant) ; `null` sans elle.
  points: number | null;
  // La tour attaquée : 5★ (aucune restriction) ou 4★ (monstres 4★ naturels
  // et moins) ; `null` si la base ou son type est inconnu (`TOUR_PAR_TYPE`).
  tour: 4 | 5 | null;
}

// Le type de base de la carte (`base_list[].base_type`) → la tour.
// ⚠️ Établi sur données, pas supposé : sur le siège relevé, les 69 défenses
// vues sur les bases de type 3 n'ont que des monstres 4★ naturels ou moins
// (la règle des tours 4★), celles des bases de type 2 ont des 5★ (271). Le
// type 1 (une base par guilde, sans défense vue) est le QG, d'après le
// joueur : ni l'une ni l'autre, il ne compte pas.
export const TOUR_PAR_TYPE: Record<number, 4 | 5> = { 2: 5, 3: 4 };

// ── La carte : couleurs des guildes, numéros des tours ──────────────────

// La couleur d'une guilde sur la carte du jeu : bleu en bas à gauche, rouge en
// haut, jaune à droite (carte du jeu, relevée par le joueur). ⚠️ **Ma guilde
// est TOUJOURS en bas à gauche, en bleu** (le jeu le montre ainsi, dit le
// joueur) : la couleur suit « moi », pas la place (`pos_id`). Les autres se
// lisent par leur place À PARTIR DE la mienne — la suivante en rouge, l'autre
// en jaune. Établi sur le siège relevé (ma guilde en position 1, l'autre en 2
// et en rouge) ; SUPPOSÉ : que la carte tourne ainsi quand ma guilde a une
// autre place — un siège où elle n'est pas en position 1 le dira.
export type CouleurGuilde = 'bleue' | 'rouge' | 'jaune';
const COULEURS: CouleurGuilde[] = ['bleue', 'rouge', 'jaune'];
// La place de ma guilde dans un siège (`null` : inconnue).
export const maPosition = (s: { guildes: GuildeSiege[] }) => s.guildes.find((g) => g.mienne)?.position ?? null;
// Une place (1 à 3) vue depuis la mienne ; ma place inconnue, la place telle quelle.
const couleurDeLaPlace = (position: number, mienne: number | null): CouleurGuilde | null =>
  position >= 1 && position <= 3 ? COULEURS[(position - (mienne ?? 1) + 3) % 3] : null;
export function couleurDeGuilde(g: GuildeSiege, rang = 0, mienne: number | null = null): CouleurGuilde {
  if (g.mienne) return 'bleue';
  const parPlace = g.position !== null ? couleurDeLaPlace(g.position, mienne) : null;
  // Place inconnue : les autres dans l'ordre de la carte.
  return parPlace ?? COULEURS[Math.min(2, Math.max(1, rang))];
}

// Le numéro d'une base dans le territoire de sa guilde de départ, comme la
// carte du jeu l'affiche : le QG, puis les tours 1 à 12.
// ⚠️ Établi sur le siège relevé : les bases se suivent par blocs de 13, un par
// position (1 à 13, 14 à 26) ; chaque bloc commence par son QG (type 1) et a
// ses tours 4★ aux mêmes rangs.
// ⚠️ Le numéro de la tour N'EST PAS le rang de la base dans son bloc : le jeu
// suit sa propre table (`NUMERO_PAR_RANG`), relevée en jeu en comparant le
// journal des combats aux bases relevées — rang 4 → tour 4, 8 → 5, 9 → 9,
// 11 → 12, 12 → 10. Les rangs non relevés n'ont pas de numéro (`null`) : la
// page montre alors « Base n ». SUPPOSÉ : que la table soit la même pour les
// trois territoires (le rang 9 donne la tour 9 en bleu comme en rouge).
export const BASES_PAR_GUILDE = 13;
const NUMERO_PAR_RANG: Partial<Record<number, number>> = { 4: 4, 8: 5, 9: 9, 11: 12, 12: 10 };
export function tourDeBase(base: number): { position: number; numero: number | 'QG' | null } | null {
  if (!Number.isInteger(base) || base < 1) return null;
  const position = Math.floor((base - 1) / BASES_PAR_GUILDE) + 1;
  const rang = (base - 1) % BASES_PAR_GUILDE;
  return { position, numero: rang === 0 ? 'QG' : (NUMERO_PAR_RANG[rang] ?? null) };
}
// La couleur d'un territoire (le bloc de bases d'une place), vue depuis ma
// place dans le siège.
export const couleurDePosition = (position: number, mienne: number | null = null): CouleurGuilde | null => couleurDeLaPlace(position, mienne);

// Le nom et la couleur d'une guilde, pour la nommer à côté d'un joueur ;
// `mienne` : la page ne nomme que les AUTRES guildes.
export interface InfoGuilde {
  nom: string;
  couleur: CouleurGuilde;
  mienne: boolean;
}
// Toutes les guildes des sièges relevés (le cumul n'a pas de liste de
// guildes) ; une guilde vue dans plusieurs sièges garde sa version la plus
// récente.
export function guildesDesSieges(sieges: SiegeReleve[]): Map<number, InfoGuilde> {
  const m = new Map<number, InfoGuilde>();
  for (const s of [...sieges].reverse()) s.guildes.forEach((g, i) => m.set(g.id, { nom: g.nom, couleur: couleurDeGuilde(g, i, maPosition(s)), mienne: g.mienne }));
  return m;
}
// Une guilde dans un siège : sa place dans CE siège d'abord, sinon `repli`.
export function guildeDe(s: SiegeReleve, id: number, repli: Map<number, InfoGuilde>): InfoGuilde | null {
  const i = s.guildes.findIndex((g) => g.id === id);
  return i >= 0 ? { nom: s.guildes[i].nom, couleur: couleurDeGuilde(s.guildes[i], i, maPosition(s)), mienne: s.guildes[i].mienne } : (repli.get(id) ?? null);
}

export interface DefenseSiege {
  deck: number;
  joueur: number;
  guilde: number | null;
  bases: number[];
  victoires: number;
  nuls: number;
  defaites: number;
  // Les monstres (`unit_master_id`, dans l'ordre des places), si la défense a
  // été vue en jeu (base ouverte, défenses d'un joueur).
  monstres: number[] | null;
}

export interface ResultatSiege {
  rang: number;
  nbGuildes: number | null;
  score: number | null;
  variation: number | null;
}

export interface SiegeReleve {
  siegeId: number;
  matchId: number;
  debut: number | null;
  fin: number | null;
  // Heure serveur du dernier écran de ce siège vu en jeu.
  vu: number | null;
  guildes: GuildeSiege[];
  joueurs: JoueurSiege[];
  attaques: AttaqueSiege[];
  defenses: DefenseSiege[];
  // Monstres utilisés en attaque, par joueur (`used_unit_count_list`).
  monstresUtilises: { joueur: number; n: number }[];
  // Les attaques ATTENDUES de chaque joueur du match : `max_attack_unit_count`
  // du résumé divisé par 3 (une attaque de siège = 3 monstres) — 30, soit 10
  // attaques, sur le siège relevé, comme le compte le jeu. Vide sans le résumé.
  attendues: { joueur: number; n: number }[];
  resultat: ResultatSiege | null;
  // D'où viennent les données : la carte (`GetGuildSiegeMatchupInfo`), le
  // résumé des combats (`getGuildSiegeMatchBattleLogSummary_v2`), le nombre
  // de combats dont le journal détaillé a été ouvert, et si des défenses sont
  // connues (la carte pendant le siège, ou les défenses de ma guilde).
  sources: { carte: boolean; resume: boolean; journaux: number; defenses: boolean };
}

export interface BilanSaison {
  numero: number | null;
  classement: number | null;
  nbGuildes: number | null;
  score: number | null;
  victoires: number;
  nuls: number;
  defaites: number;
  tauxVictoire: number | null;
}

export interface SaisonSiege {
  t: number | null;
  courante: BilanSaison | null;
  precedente: BilanSaison | null;
  meilleure: BilanSaison | null;
}

export interface RelevesSiege {
  moi: number;
  maGuilde: number | null;
  // Du plus récent au plus ancien.
  sieges: SiegeReleve[];
  saison: SaisonSiege | null;
  // Les membres de ma guilde à la dernière ouverture de sa fiche
  // (`GetGuildInfo`), et quand ; `null` si elle n'a jamais été ouverte.
  membres: { t: number; ids: number[] } | null;
}

// ── L'accumulateur : un événement après l'autre ─────────────────────────

interface Carte {
  t: number;
  guildes: Json[];
  joueurs: Json[];
  defenses: Json[];
  assignations: Json[];
  bases: Json[];
}

interface Resume {
  t: number;
  guildes: Json[];
  joueurs: Json[];
  lignes: Json[];
  utilises: Json[];
  maxMonstres: number | null;
}

interface SiegeEnCours {
  siegeId: number;
  matchId: number;
  debut: number | null;
  fin: number | null;
  vu: number | null;
  carte: Carte | null;
  resume: Resume | null;
  // Les défenses de MA guilde (`GetGuildSiegeParticipationInfo`) : la seule
  // source après la fin du siège, où la carte ne les donne plus.
  participation: { t: number; guilde: number | null; defenses: Json[]; assignations: Json[]; joueurs: Json[] } | null;
}

export interface AccuSieges {
  moi: number;
  maGuilde: number | null;
  sieges: Map<number, SiegeEnCours>;
  // Les entrées de journal détaillées, par `log_id` : une même entrée revient
  // à chaque ouverture.
  journaux: Map<number, Json>;
  // Les monstres de chaque défense vue, par `deck_id`.
  monstresDeck: Map<number, number[]>;
  resultats: { t: number; resultat: ResultatSiege }[];
  saison: { t: number; info: Json } | null;
  // Le début de chacune de MES attaques (`BattleGuildSiegeStart_v2`) : mes
  // monstres, ceux de la défense et son joueur, la base — connus même si le
  // journal du combat n'a jamais été ouvert.
  debuts: DebutAttaque[];
  // La dernière liste des membres de chaque guilde dont la fiche a été
  // ouverte (`GetGuildInfo`), par guilde : celle de MA guilde est retenue à la
  // fin, quand on la connaît.
  membres: Map<number, { t: number; ids: number[] }>;
}

interface DebutAttaque {
  t: number;
  base: number | null;
  defenseur: number | null;
  attaque: number[];
  defense: number[];
}

export const accuSieges = (moi: number): AccuSieges => ({
  moi,
  maGuilde: null,
  sieges: new Map(),
  journaux: new Map(),
  monstresDeck: new Map(),
  resultats: [],
  saison: null,
  debuts: [],
  membres: new Map(),
});

function siegeDe(a: AccuSieges, matchId: number, siegeId: number): SiegeEnCours {
  let s = a.sieges.get(matchId);
  if (!s) {
    s = { siegeId, matchId, debut: null, fin: null, vu: null, carte: null, resume: null, participation: null };
    a.sieges.set(matchId, s);
  }
  return s;
}

const vuA = (s: SiegeEnCours, t: number) => {
  if (s.vu === null || t > s.vu) s.vu = t;
};

function noterMaGuilde(a: AccuSieges, joueurs: Json[]) {
  const moi = joueurs.find((j) => num(j.wizard_id) === a.moi);
  const g = num(moi?.guild_id);
  if (g !== null) a.maGuilde = g;
}

// Les événements que ce module lit : la page n'a besoin de rien d'autre, et
// l'application de bureau ne garde qu'eux en lisant les fichiers.
export const estEvenementSiege = (ev: Pick<EvenementGuilde, 'contenu' | 'commande'>) =>
  ev.contenu === 'siege' || ev.commande === 'GetGuildInfo';

// Pose un événement de guilde, dans l'ordre du fichier.
export function poserSiege(a: AccuSieges, ev: EvenementGuilde) {
  const r = ev.reponse as Json;
  const t = num(ev.t) ?? 0;
  if (ev.type === 'debut' && ev.commande === 'BattleGuildSiegeStart_v2') {
    // ⚠️ Dans l'ordre de la réponse : c'est celui du journal du même combat
    // (`view_battle_deck_info`), recoupé sur les dix attaques relevées.
    const maitres = (liste: unknown, infos: boolean) =>
      tab(liste)
        .map((u) => num(((infos ? u.unit_info : u) as Json | undefined)?.unit_master_id))
        .filter((m): m is number => m !== null);
    const adverses = tab(r.guildsiege_opp_unit_list);
    a.debuts.push({
      t,
      base: num((ev.params as Json)?.base_number),
      defenseur: num((adverses[0]?.unit_info as Json | undefined)?.wizard_id),
      attaque: maitres(r.guildsiege_my_unit_list, false),
      defense: maitres(r.guildsiege_opp_unit_list, true),
    });
    return;
  }
  if (ev.type !== 'vue') return;
  switch (ev.commande) {
    case 'GetGuildSiegeMatchupInfo':
    case 'GetGuildSiegeMatchupInfoForFinished': {
      const mi = r.match_info as Json | undefined;
      const matchId = num(mi?.match_id);
      const siegeId = num(mi?.siege_id);
      if (matchId === null || siegeId === null) return;
      const s = siegeDe(a, matchId, siegeId);
      s.debut = num(mi?.match_start_time) ?? s.debut;
      s.fin = num(mi?.match_finish_time) ?? s.fin;
      vuA(s, t);
      // ⚠️ Liste par liste, et seulement par une liste NON VIDE : la carte de
      // fin de siège (`…ForFinished`) arrive sans les défenses
      // (`defense_deck_list` vide) — elle effaçait celles de la carte d'avant.
      const c = s.carte ?? (s.carte = { t, guildes: [], joueurs: [], defenses: [], assignations: [], bases: [] });
      if (t >= c.t || c.guildes.length === 0) {
        const garder = (avant: Json[], v: unknown) => (tab(v).length ? tab(v) : avant);
        c.guildes = garder(c.guildes, r.guild_list);
        c.joueurs = garder(c.joueurs, r.wizard_info_list);
        c.defenses = garder(c.defenses, r.defense_deck_list);
        c.assignations = garder(c.assignations, r.defense_deck_assign_list);
        c.bases = garder(c.bases, r.base_list);
        c.t = Math.max(c.t, t);
      }
      noterMaGuilde(a, tab(r.wizard_info_list));
      return;
    }
    case 'GetGuildSiegeParticipationInfo': {
      const p = r.participation_info as Json | undefined;
      const matchId = num(p?.match_id);
      const siegeId = num(p?.siege_id);
      if (matchId === null || siegeId === null) return;
      const s = siegeDe(a, matchId, siegeId);
      vuA(s, t);
      const defenses = tab(r.defense_deck_list);
      if (defenses.length && (!s.participation || t >= s.participation.t))
        s.participation = { t, guilde: num(p?.guild_id), defenses, assignations: tab(r.defense_deck_assign_list), joueurs: tab(r.wizard_info_list) };
      noterMaGuilde(a, tab(r.wizard_info_list));
      return;
    }
    case 'getGuildSiegeMatchBattleLogSummary_v2': {
      const guildes = tab(r.guild_list);
      const matchId = num(guildes[0]?.match_id);
      const siegeId = num(guildes[0]?.siege_id) ?? num((ev.params as Json)?.siege_id);
      if (matchId === null || siegeId === null) return;
      const s = siegeDe(a, matchId, siegeId);
      vuA(s, t);
      if (!s.resume || t >= s.resume.t) {
        s.resume = {
          t,
          guildes,
          joueurs: tab(r.wizard_info_list),
          lignes: tab(r.wizard_battle_log_list),
          utilises: tab(r.used_unit_count_list),
          maxMonstres: num(r.max_attack_unit_count),
        };
      }
      noterMaGuilde(a, tab(r.wizard_info_list));
      return;
    }
    case 'GetGuildSiegeBattleLog':
    case 'GetGuildSiegeBattleLogByWizardId':
    case 'GetGuildSiegeBattleLogByDeckId':
      for (const l of tab(r.log_list))
        for (const b of tab(l.battle_log_list)) {
          const id = num(b.log_id);
          if (id !== null) a.journaux.set(id, b);
        }
      return;
    case 'GetGuildSiegeBaseDefenseUnitList':
    case 'GetGuildSiegeBaseDefenseUnitListPreset':
    case 'GetGuildSiegeDefenseDeckByWizardId': {
      const parDeck = new Map<number, { pos: number; m: number }[]>();
      for (const u of tab(r.defense_unit_list)) {
        const deck = num(u.deck_id);
        const m = num((u.unit_info as Json | undefined)?.unit_master_id);
        if (deck === null || m === null) continue;
        (parDeck.get(deck) ?? parDeck.set(deck, []).get(deck)!).push({ pos: num(u.pos_id) ?? 0, m });
      }
      for (const [deck, us] of parDeck) a.monstresDeck.set(deck, us.sort((x, y) => x.pos - y.pos).map((u) => u.m));
      return;
    }
    case 'getGuildSiegeMatchResult': {
      const rang = num(r.match_rank);
      if (rang === null) return; // pas de siège fini à montrer
      a.resultats.push({
        t,
        resultat: { rang, nbGuildes: num(r.guild_count), score: num(r.guildsiege_score_curr), variation: num(r.guildsiege_score_var) },
      });
      return;
    }
    case 'GetGuildSiegeRankingInfo':
    case 'GetGuildInfo': {
      const info = r.guildsiege_stat_info;
      if (info && typeof info === 'object' && (!a.saison || t >= a.saison.t)) a.saison = { t, info: info as Json };
      if (ev.commande === 'GetGuildInfo') {
        const g = r.guild as Json | undefined;
        const guilde = num((g?.guild_info as Json | undefined)?.guild_id);
        const liste = g?.guild_members;
        if (guilde !== null && liste && typeof liste === 'object') {
          const ids = Object.values(liste as Json).flatMap((m) => {
            const id = num((m as Json | null)?.wizard_id);
            return id === null ? [] : [id];
          });
          const avant = a.membres.get(guilde);
          if (!avant || t >= avant.t) a.membres.set(guilde, { t, ids });
        }
      }
      return;
    }
  }
}

// ── Le résultat ─────────────────────────────────────────────────────────

const victoireDe = (code: unknown, pointDeVue: 'attaquant' | 'defenseur'): boolean | null => {
  const v = code === 1 ? true : code === 2 ? false : null;
  return v === null || pointDeVue === 'attaquant' ? v : !v;
};

// Une entrée de journal, du point de vue de l'attaquant.
function attaqueDuJournal(b: Json): AttaqueSiege | null {
  const type = num(b.log_type);
  if (type !== 1 && type !== 2) return null;
  const att = type === 1;
  const brute = b.view_battle_deck_info;
  const vue = Array.isArray(brute) ? (brute as unknown[]) : [];
  const ids = (x: unknown) => (Array.isArray(x) ? x.filter((m): m is number => typeof m === 'number') : []);
  // ⚠️ DEUX formes. Une liste `[attaque, défense]` (journaux par joueur, par
  // deck, et les attaques de la guilde). Un objet à une seule équipe, `{"1":
  // [...]}` (journaux des défenses de la guilde, `GetGuildSiegeBattleLog`
  // log_type 2) : c'est la DÉFENSE — sur le siège relevé, 132 des 150 combats
  // dont le défenseur avait des decks connus portent un de ces decks (les 18
  // autres, des decks vraisemblablement changés pendant le siège). L'attaque
  // n'y est pas : `attaque` vide, inconnue.
  const seule = brute && typeof brute === 'object' && !Array.isArray(brute) ? ids((brute as Json)['1']) : [];
  const monstres = vue.length === 2 ? { attaque: ids(vue[0]), defense: ids(vue[1]) } : seule.length ? { attaque: [], defense: seule } : null;
  return {
    t: num(b.log_timestamp) ?? 0,
    attaquant: num(att ? b.wizard_id : b.opp_wizard_id) ?? 0,
    guildeAttaquante: num(att ? b.guild_id : b.opp_guild_id) ?? 0,
    defenseur: num(att ? b.opp_wizard_id : b.wizard_id) ?? 0,
    guildeDefense: num(att ? b.opp_guild_id : b.guild_id) ?? 0,
    victoire: victoireDe(b.win_lose, att ? 'attaquant' : 'defenseur'),
    base: num(b.base_number),
    monstres,
    // Vue du défenseur, `match_score_var` est SON gain : celui de l'attaquant
    // n'y est pas.
    points: att ? num(b.match_score_var) : null,
    tour: null, // posée par siège, d'après sa carte
  };
}

const cleCombat = (x: Pick<AttaqueSiege, 'attaquant' | 'defenseur' | 't'>) => `${x.attaquant}>${x.defenseur}@${x.t}`;

function guildesDe(liste: Json[], maGuilde: number | null): GuildeSiege[] {
  return liste
    .map((g) => ({
      id: num(g.guild_id) ?? 0,
      nom: texte(g.guild_name),
      position: num(g.pos_id),
      rang: num(g.match_rank),
      score: num(g.match_score),
      membres: num(g.play_member_count),
      attaques: num(g.attack_count),
      monstresUtilises: num(g.attack_unit_count),
      mienne: num(g.guild_id) === maGuilde,
    }))
    .sort((x, y) => (x.position ?? 9) - (y.position ?? 9));
}

function bilanSaison(x: unknown): BilanSaison | null {
  if (!x || typeof x !== 'object') return null;
  const b = x as Json;
  return {
    numero: num(b.season_number),
    classement: num(b.rank),
    nbGuildes: num(b.total_guild_count),
    score: num(b.score),
    victoires: num(b.win_count) ?? 0,
    nuls: num(b.draw_count) ?? 0,
    defaites: num(b.lose_count) ?? 0,
    tauxVictoire: num(b.winning_rate),
  };
}

// Mes attaques, complétées par leur début (monstres, base) quand le journal du
// combat ne les a pas donnés.
// ⚠️ La règle, établie sur données (dix attaques sur dix) : un début se relie
// à la PREMIÈRE de mes attaques qui le suit, contre le MÊME défenseur
// (`unit_info.wizard_id` des monstres adverses) — 12 à 93 s plus tard sur le
// journal relevé. Chaque attaque ne prend qu'un début. Seuls les débuts tombés
// pendant ce siège comptent.
function completerParLesDebuts(a: AccuSieges, s: SiegeEnCours, attaques: AttaqueSiege[]) {
  const pris = new Set<AttaqueSiege>();
  const debuts = a.debuts
    .filter((d) => (s.debut === null || d.t >= s.debut) && (s.fin === null || d.t <= s.fin))
    .sort((x, y) => x.t - y.t);
  for (const d of debuts) {
    const i = attaques.findIndex((x) => !pris.has(x) && x.attaquant === a.moi && x.t >= d.t && x.defenseur === d.defenseur);
    if (i < 0) continue;
    const x = attaques[i];
    pris.add(x);
    const complete = {
      ...x,
      base: x.base ?? d.base,
      // Chaque équipe que le journal n'a pas donnée vient du début.
      monstres:
        x.monstres || d.attaque.length || d.defense.length
          ? {
              attaque: x.monstres?.attaque.length ? x.monstres.attaque : d.attaque,
              defense: x.monstres?.defense.length ? x.monstres.defense : d.defense,
            }
          : null,
    };
    attaques[i] = complete;
    pris.add(complete);
  }
}

export function finaliserSieges(a: AccuSieges): RelevesSiege {
  // Les journaux détaillés, rangés par match.
  const journauxParMatch = new Map<number, AttaqueSiege[]>();
  for (const b of a.journaux.values()) {
    const m = num(b.match_id);
    const x = attaqueDuJournal(b);
    if (m === null || !x) continue;
    (journauxParMatch.get(m) ?? journauxParMatch.set(m, []).get(m)!).push(x);
  }

  const sieges: SiegeReleve[] = [...a.sieges.values()].map((s) => {
    const detail = new Map<string, AttaqueSiege>();
    // Un combat vu dans plusieurs journaux : chacun garde ce qu'il sait le
    // mieux, quel que soit l'ordre — les points (seulement dans l'entrée de
    // l'attaquant), et les équipes (une entrée de défense de la guilde ne
    // donne que la défense).
    for (const x of journauxParMatch.get(s.matchId) ?? []) {
      const avant = detail.get(cleCombat(x));
      if (!avant) {
        detail.set(cleCombat(x), x);
        continue;
      }
      const equipe = (a: number[] | undefined, b: number[] | undefined) => (a?.length ? a : (b ?? []));
      const monstres =
        x.monstres || avant.monstres
          ? { attaque: equipe(x.monstres?.attaque, avant.monstres?.attaque), defense: equipe(x.monstres?.defense, avant.monstres?.defense) }
          : null;
      detail.set(cleCombat(x), { ...x, points: x.points ?? avant.points, base: x.base ?? avant.base, monstres });
    }

    // Les combats : le résumé s'il a été ouvert (tous les combats), sinon les
    // seuls journaux détaillés. Le détail complète le résumé (base, monstres).
    let attaques: AttaqueSiege[];
    if (s.resume) {
      attaques = s.resume.lignes
        .filter((l) => num(l.log_type) === 1)
        .map((l) => {
          const x: AttaqueSiege = {
            t: num(l.log_timestamp) ?? 0,
            attaquant: num(l.wizard_id) ?? 0,
            guildeAttaquante: num(l.guild_id) ?? 0,
            defenseur: num(l.opp_wizard_id) ?? 0,
            guildeDefense: num(l.opp_guild_id) ?? 0,
            victoire: victoireDe(l.win_lose, 'attaquant'),
            base: null,
            monstres: null,
            points: null,
            tour: null,
          };
          const d = detail.get(cleCombat(x));
          return d ? { ...x, base: d.base, monstres: d.monstres, points: d.points } : x;
        });
    } else attaques = [...detail.values()];
    attaques.sort((x, y) => x.t - y.t);
    completerParLesDebuts(a, s, attaques);
    // La tour de chaque combat à base connue, d'après la carte de CE siège :
    // la disposition des bases peut changer d'un siège à l'autre.
    const typeDe = new Map((s.carte?.bases ?? []).map((b) => [num(b.base_number), num(b.base_type)]));
    attaques = attaques.map((x) => {
      const type = x.base === null ? null : typeDe.get(x.base);
      return { ...x, tour: type == null ? null : (TOUR_PAR_TYPE[type] ?? null) };
    });

    // Les joueurs et les guildes : la vue la plus récente des deux.
    const plusRecente = s.resume && (!s.carte || s.resume.t >= s.carte.t) ? s.resume : s.carte;
    const joueursParId = new Map<number, JoueurSiege>();
    for (const src of [s.carte?.joueurs ?? [], s.resume?.joueurs ?? []])
      for (const j of src) {
        const id = num(j.wizard_id);
        if (id !== null) joueursParId.set(id, { id, nom: texte(j.wizard_name), guilde: num(j.guild_id) ?? 0 });
      }

    // Les défenses : celles de la carte (toutes les guildes, pendant le
    // siège), complétées par celles de ma guilde (`participation`) — qui
    // l'emportent si elles sont plus récentes. Chacune avec les bases de SA
    // source.
    const parDeck = new Map<number, DefenseSiege>();
    const poserDefenses = (liste: Json[], assignations: Json[], guildeParDefaut: number | null, remplacer: boolean) => {
      const basesDe = new Map<number, number[]>();
      for (const x of assignations) {
        const deck = num(x.deck_id);
        const base = num(x.base_number);
        if (deck !== null && base !== null) (basesDe.get(deck) ?? basesDe.set(deck, []).get(deck)!).push(base);
      }
      for (const d of liste) {
        const deck = num(d.deck_id);
        const joueur = num(d.wizard_id);
        if (deck === null || joueur === null || (!remplacer && parDeck.has(deck))) continue;
        parDeck.set(deck, {
          deck,
          joueur,
          guilde: joueursParId.get(joueur)?.guilde ?? guildeParDefaut,
          bases: (basesDe.get(deck) ?? []).sort((x, y) => x - y),
          victoires: num(d.win_count) ?? 0,
          nuls: num(d.draw_count) ?? 0,
          defaites: num(d.lose_count) ?? 0,
          monstres: a.monstresDeck.get(deck) ?? null,
        });
      }
    };
    if (s.carte) poserDefenses(s.carte.defenses, s.carte.assignations, null, true);
    if (s.participation)
      poserDefenses(s.participation.defenses, s.participation.assignations, s.participation.guilde, !s.carte || s.participation.t >= s.carte.t);
    const defenses = [...parDeck.values()];

    // Le résultat final : le dernier relevé après la fin de CE siège, et
    // avant le début du suivant.
    const suivant = [...a.sieges.values()]
      .map((x) => x.debut)
      .filter((d): d is number => d !== null && s.debut !== null && d > s.debut)
      .sort((x, y) => x - y)[0];
    const resultat =
      s.fin === null
        ? null
        : ([...a.resultats].reverse().find((r) => r.t >= s.fin! && (suivant === undefined || r.t < suivant))?.resultat ?? null);

    return {
      siegeId: s.siegeId,
      matchId: s.matchId,
      debut: s.debut,
      fin: s.fin,
      vu: s.vu,
      guildes: guildesDe(plusRecente?.guildes ?? [], a.maGuilde),
      joueurs: [...joueursParId.values()],
      attaques,
      defenses,
      monstresUtilises: (s.resume?.utilises ?? []).flatMap((u) => {
        const joueur = num(u.wizard_id);
        const n = num(u.used_unit_count);
        return joueur === null || n === null ? [] : [{ joueur, n }];
      }),
      attendues:
        s.resume?.maxMonstres != null
          ? s.resume.joueurs.flatMap((j) => {
              const joueur = num(j.wizard_id);
              return joueur === null ? [] : [{ joueur, n: Math.floor(s.resume!.maxMonstres! / 3) }];
            })
          : [],
      resultat,
      sources: {
        carte: s.carte !== null,
        resume: s.resume !== null,
        journaux: journauxParMatch.get(s.matchId)?.length ?? 0,
        defenses: defenses.length > 0,
      },
    };
  });

  sieges.sort((x, y) => (y.debut ?? y.vu ?? 0) - (x.debut ?? x.vu ?? 0));
  const info = a.saison?.info;
  return {
    moi: a.moi,
    maGuilde: a.maGuilde,
    sieges,
    saison: info
      ? { t: a.saison!.t, courante: bilanSaison(info.curr), precedente: bilanSaison(info.prev), meilleure: bilanSaison(info.best) }
      : null,
    membres: (a.maGuilde !== null && a.membres.get(a.maGuilde)) || null,
  };
}

// Raccourci : des événements, dans l'ordre, au résultat.
export function releverSieges(moi: number, evenements: Iterable<EvenementGuilde>): RelevesSiege {
  const a = accuSieges(moi);
  for (const ev of evenements) poserSiege(a, ev);
  return finaliserSieges(a);
}

// ── Ce que l'écran lit d'un siège ───────────────────────────────────────

// Fini : son heure de fin est passée, ou son résultat est connu. Le rang des
// guildes n'est définitif qu'une fois le siège fini.
export const siegeFini = (s: SiegeReleve, maintenant: number) => s.resultat !== null || (s.fin !== null && maintenant >= s.fin);

// Les écrans jamais ouverts en jeu pour ce siège : ce qui manque, à dire.
// (Les défenses ne manquent jamais à part : elles se reconstituent d'après les
// combats — c'est le résumé des combats qui manque, s'il manque.)
export type ManqueSiege = 'carte' | 'resume' | 'resultat';
export function manquesDuSiege(s: SiegeReleve, maintenant: number): ManqueSiege[] {
  const m: ManqueSiege[] = [];
  if (!s.sources.carte) m.push('carte');
  if (!s.sources.resume) m.push('resume');
  if (s.resultat === null && siegeFini(s, maintenant)) m.push('resultat');
  return m;
}

// ⚠️ Les noms d'un siège sont indexés UNE fois (puis gardés tant que le siège
// vit) : une liste de combats en demande des centaines, et le cumul de tous
// les sièges compte des centaines de joueurs. Le premier joueur d'un
// identifiant l'emporte, comme le ferait une recherche dans la liste.
const nomsParSiege = new WeakMap<SiegeReleve, Map<number, string>>();
export function nomDuJoueur(s: SiegeReleve, id: number): string | null {
  let noms = nomsParSiege.get(s);
  if (!noms) {
    noms = new Map();
    for (const j of s.joueurs) if (!noms.has(j.id)) noms.set(j.id, j.nom);
    nomsParSiege.set(s, noms);
  }
  return noms.get(id) ?? null;
}

// Les combats d'un joueur, en attaque, du plus récent au plus ancien.
// Avec `guilde` : ses combats POUR cette guilde seulement (un joueur passé
// d'une guilde à l'autre, dans le cumul de tous les sièges).
export const attaquesDuJoueur = (s: SiegeReleve, joueur: number, guilde: number | null = null) =>
  s.attaques.filter((x) => x.attaquant === joueur && (guilde === null || x.guildeAttaquante === guilde)).sort((x, y) => y.t - x.t);

// Une défense RECONSTITUÉE d'après les combats du siège : un défenseur et une
// équipe (ses trois monstres, quel que soit leur ordre), et les combats où
// elle a été attaquée — tenus (l'attaquant a perdu), perdus.
// ⚠️ D'après les COMBATS, pas les decks : les compteurs des decks ne sont pas
// ceux du siège, et une défense n'a ses monstres sur la carte que si sa base a
// été ouverte en jeu. Les monstres viennent ici du journal de chaque combat ;
// les combats dont le journal n'a pas été ouvert forment, par défenseur, une
// défense aux monstres inconnus (`monstres` null).
export interface DefenseCombats {
  joueur: number;
  guilde: number;
  monstres: number[] | null;
  combats: number;
  tenus: number;
  perdus: number;
  // Tenus sur les combats au résultat connu ; `null` sans aucun.
  wr: number | null;
}

function defensesDepuisCombats(attaques: AttaqueSiege[]): DefenseCombats[] {
  const parCle = new Map<string, DefenseCombats & { ordres: Map<string, number> }>();
  for (const x of attaques) {
    const equipe = x.monstres?.defense.length ? x.monstres.defense : null;
    const cle = `${x.defenseur}|${equipe ? cleEquipe(equipe) : '?'}`;
    const d = parCle.get(cle) ?? { joueur: x.defenseur, guilde: x.guildeDefense, monstres: equipe, combats: 0, tenus: 0, perdus: 0, wr: null, ordres: new Map() };
    d.combats++;
    if (x.victoire === false) d.tenus++;
    if (x.victoire === true) d.perdus++;
    if (equipe) d.ordres.set(equipe.join(), (d.ordres.get(equipe.join()) ?? 0) + 1);
    parCle.set(cle, d);
  }
  return [...parCle.values()].map(({ ordres, ...d }) => {
    // L'équipe dans l'ordre le plus vu.
    let meilleur: string | null = null;
    for (const [ordre, n] of ordres) if (meilleur === null || n > ordres.get(meilleur)!) meilleur = ordre;
    return {
      ...d,
      monstres: meilleur === null ? null : meilleur.split(',').map(Number),
      wr: d.tenus + d.perdus ? (100 * d.tenus) / (d.tenus + d.perdus) : null,
    };
  });
}

// Les plus attaquées d'abord ; à égalité, la plus battue.
const parCombats = (x: DefenseCombats, y: DefenseCombats) => y.combats - x.combats || y.perdus - x.perdus || x.joueur - y.joueur;

// Les défenses d'un joueur, d'une guilde, et des AUTRES guildes.
export const defensesDuJoueur = (s: SiegeReleve, joueur: number, guilde: number | null = null) =>
  defensesDepuisCombats(s.attaques.filter((x) => x.defenseur === joueur && (guilde === null || x.guildeDefense === guilde))).sort(parCombats);
export const defensesDeLaGuilde = (s: SiegeReleve, guilde: number) =>
  defensesDepuisCombats(s.attaques.filter((x) => x.guildeDefense === guilde)).sort(parCombats);
export const defensesAdverses = (s: SiegeReleve, maGuilde: number) =>
  defensesDepuisCombats(s.attaques.filter((x) => x.guildeDefense !== maGuilde)).sort(parCombats);

// Les attaques d'une guilde dont les monstres sont connus, du plus récent au
// plus ancien : qui a tapé qui, avec quoi, contre quoi.
export const combatsDeLaGuilde = (s: SiegeReleve, guilde: number) =>
  s.attaques.filter((x) => x.guildeAttaquante === guilde && x.monstres !== null).sort((x, y) => y.t - x.t);

// ── Les filtres de l'écran ──────────────────────────────────────────────

export interface FiltreSiege {
  resultat: 'tous' | 'victoires' | 'defaites';
  // Monstres (`unit_master_id`) qui doivent TOUS être dans l'équipe — de
  // l'attaque, de la défense, ou de l'une des deux (`cote`).
  monstres: number[];
  cote: 'tous' | 'attaque' | 'defense';
}

export const FILTRE_VIDE: FiltreSiege = { resultat: 'tous', monstres: [], cote: 'tous' };
export const filtreActif = (f: FiltreSiege) => f.resultat !== 'tous' || f.monstres.length > 0;

const contientTous = (equipe: number[], voulus: number[]) => voulus.every((m) => equipe.includes(m));

// Les combats qui passent le filtre. ⚠️ Un combat aux monstres inconnus ne
// passe JAMAIS un filtre de monstres : on ne sait pas s'il les contient.
export function filtrerCombats(attaques: AttaqueSiege[], f: FiltreSiege): AttaqueSiege[] {
  return attaques.filter((x) => {
    if (f.resultat === 'victoires' && x.victoire !== true) return false;
    if (f.resultat === 'defaites' && x.victoire !== false) return false;
    if (f.monstres.length === 0) return true;
    if (!x.monstres) return false;
    const enAttaque = contientTous(x.monstres.attaque, f.monstres);
    const enDefense = contientTous(x.monstres.defense, f.monstres);
    return f.cote === 'attaque' ? enAttaque : f.cote === 'defense' ? enDefense : enAttaque || enDefense;
  });
}

// Les défenses qui passent le filtre de monstres (le résultat ne s'y applique
// pas : une défense a des victoires ET des défaites). Filtrer « en attaque »
// ne dit rien d'une défense : elles passent toutes. Une défense aux monstres
// inconnus ne passe pas un filtre de monstres.
export function filtrerDefenses<D extends { monstres: number[] | null }>(defenses: D[], f: FiltreSiege): D[] {
  if (f.monstres.length === 0 || f.cote === 'attaque') return defenses;
  return defenses.filter((d) => d.monstres !== null && contientTous(d.monstres, f.monstres));
}

// Le bilan de combats : combien, gagnés, perdus, et le taux de victoire sur
// ceux dont le résultat est connu (`null` sans aucun).
// Les combats SIÈGE PAR SIÈGE (le détail de « Tous les sièges ») : pour chaque
// siège relevé, du plus récent au plus ancien, ses combats (`combats`) qui
// passent le filtre. Un siège sans aucun combat retenu n'a pas de groupe.
export interface CombatsDuSiege {
  siege: SiegeReleve;
  attaques: AttaqueSiege[];
}
export function combatsParSiege(sieges: SiegeReleve[], combats: (s: SiegeReleve) => AttaqueSiege[], filtre: FiltreSiege): CombatsDuSiege[] {
  return sieges.flatMap((siege) => {
    const attaques = filtrerCombats(combats(siege), filtre);
    return attaques.length ? [{ siege, attaques }] : [];
  });
}

// ⚠️ Le détail se lit par pages d'un nombre BORNÉ de cartes, jamais d'un
// nombre de sièges : un siège relevé compte 204 combats aux monstres connus
// (six portraits chacun), 101 défenses de la guilde et 89 adverses — trois
// sièges par page rendaient des milliers de portraits, et la page ramait.
export const COMBATS_PAR_PAGE = 30;
export const DEFENSES_PAR_PAGE = 24;

// La page `page` de `elements`, ramenée dans les bornes (un filtre qui en
// retire ne laisse pas sur une page qui n'existe plus).
export function pageDe<T>(elements: T[], page: number, parPage: number) {
  const pages = Math.max(1, Math.ceil(elements.length / parPage));
  const p = Math.min(pages - 1, Math.max(0, page));
  return { page: p, pages, elements: elements.slice(p * parPage, (p + 1) * parPage) };
}

// Les combats siège par siège, découpés en pages d'au plus `parPage` combats.
// Un siège qui ne tient pas sur une page reprend sur la suivante, sous le même
// en-tête marqué `suite` ; `groupe` reste le siège entier (son bilan).
export interface MorceauDeSiege {
  groupe: CombatsDuSiege;
  attaques: AttaqueSiege[];
  suite: boolean;
}
export function pagesDeCombats(groupes: CombatsDuSiege[], parPage = COMBATS_PAR_PAGE): MorceauDeSiege[][] {
  const pages: MorceauDeSiege[][] = [];
  let page: MorceauDeSiege[] = [];
  let place = parPage;
  for (const groupe of groupes) {
    for (let debut = 0; debut < groupe.attaques.length; ) {
      if (place === 0) {
        pages.push(page);
        page = [];
        place = parPage;
      }
      const attaques = groupe.attaques.slice(debut, debut + place);
      page.push({ groupe, attaques, suite: debut > 0 });
      debut += attaques.length;
      place -= attaques.length;
    }
  }
  if (page.length) pages.push(page);
  return pages;
}

export function bilanDesCombats(attaques: AttaqueSiege[]) {
  const victoires = attaques.filter((x) => x.victoire === true).length;
  const defaites = attaques.filter((x) => x.victoire === false).length;
  return { n: attaques.length, victoires, defaites, taux: victoires + defaites ? (100 * victoires) / (victoires + defaites) : null };
}

// Les monstres vus dans un siège (combats et défenses) : ceux qu'on peut
// chercher, dans l'ordre de leur fréquence.
export function monstresDuSiege(s: SiegeReleve): number[] {
  const n = new Map<number, number>();
  const compter = (ids: number[]) => ids.forEach((m) => n.set(m, (n.get(m) ?? 0) + 1));
  for (const x of s.attaques)
    if (x.monstres) {
      compter(x.monstres.attaque);
      compter(x.monstres.defense);
    }
  for (const d of s.defenses) if (d.monstres) compter(d.monstres);
  return [...n].sort((x, y) => y[1] - x[1] || x[0] - y[0]).map(([m]) => m);
}

// ── La vue d'ensemble ───────────────────────────────────────────────────

// Les combats où une guilde (ou un joueur) DÉFENDAIT, dans ce siège : tenus
// (l'attaquant a perdu), perdus (il a gagné), et la part tenue sur ceux dont
// le résultat est connu.
// ⚠️ Tirés des COMBATS du siège, jamais des compteurs des decks
// (`win_count`, `lose_count`) : ceux-là ne sont PAS ceux du siège — sur le
// siège relevé, 527 défaites comptées sur les decks d'une guilde que l'autre
// n'avait attaquée que 237 fois. Ce sont les compteurs du jeu pour le deck
// (le journal montre une commande qui les remet à zéro,
// `ResetGuildSiegeDefenseDeckStat`).
function combatsEnDefense(attaques: AttaqueSiege[]) {
  const tenus = attaques.filter((x) => x.victoire === false).length;
  const perdus = attaques.filter((x) => x.victoire === true).length;
  return { n: attaques.length, tenus, perdus, tenue: tenus + perdus ? (100 * tenus) / (tenus + perdus) : null };
}

// Le bilan d'une guilde dans un siège : ses attaques et ses défenses, d'après
// les combats du siège (`null` en défense sans le résumé des combats : seuls
// les journaux ouverts seraient comptés).
export function bilanDeLaGuilde(s: SiegeReleve, guilde: number) {
  return {
    attaques: bilanDesCombats(s.attaques.filter((x) => x.guildeAttaquante === guilde)),
    defenses: s.sources.resume ? combatsEnDefense(s.attaques.filter((x) => x.guildeDefense === guilde)) : null,
  };
}

export interface PointCourbe {
  t: number;
  // Cumulés depuis le début du siège.
  attaques: number;
  victoires: number;
  defaites: number;
  // Victoires sur les attaques au résultat connu ; `null` avant la première.
  wr: number | null;
}

// Les attaques de chaque guilde au fil du siège, CUMULÉES : un point par
// attaque, plus un point de départ à zéro (début du siège, ou première
// attaque). Les guildes dans l'ordre de `s.guildes` ; une guilde sans attaque
// garde sa ligne plate.
export function courbesDuSiege(s: SiegeReleve): { guilde: number; points: PointCourbe[] }[] {
  const debut = s.debut ?? Math.min(...s.attaques.map((x) => x.t));
  return s.guildes.map((g) => {
    const points: PointCourbe[] = [{ t: debut, attaques: 0, victoires: 0, defaites: 0, wr: null }];
    let attaques = 0;
    let victoires = 0;
    let defaites = 0;
    for (const x of s.attaques) {
      if (x.guildeAttaquante !== g.id) continue;
      attaques++;
      if (x.victoire === true) victoires++;
      if (x.victoire === false) defaites++;
      points.push({ t: x.t, attaques, victoires, defaites, wr: victoires + defaites ? (100 * victoires) / (victoires + defaites) : null });
    }
    return { guilde: g.id, points };
  });
}

// Le point d'une courbe à l'heure `t` : le dernier atteint.
export function pointA(points: PointCourbe[], t: number): PointCourbe {
  let p = points[0];
  for (const q of points) if (q.t <= t) p = q;
  return p;
}

// L'échelle du WR, CENTRÉE sur ses valeurs (demande de l'utilisateur) : de la
// dizaine sous le plus bas à la dizaine au-dessus du plus haut, tous les points
// comptés (la courbe reste entière), sur au moins 20 points — un WR presque
// constant ne s'étire pas sur toute la hauteur. 0 à 100 sans aucun WR.
export function bornesWr(courbes: { points: PointCourbe[] }[]): { bas: number; haut: number } {
  return bornesDesValeurs(courbes.flatMap((c) => c.points.map((p) => p.wr)));
}

// La même règle, sur des WR en vrac (la courbe d'un membre, siège par siège).
export function bornesDesValeurs(valeurs: (number | null)[]): { bas: number; haut: number } {
  const wr = valeurs.filter((x): x is number => x !== null);
  if (wr.length === 0) return { bas: 0, haut: 100 };
  let bas = Math.floor(Math.min(...wr) / 10) * 10;
  let haut = Math.ceil(Math.max(...wr) / 10) * 10;
  if (haut - bas < 20) {
    haut = Math.min(100, bas + 20);
    bas = Math.max(0, haut - 20);
  }
  return { bas, haut };
}

// Une ÉQUIPE et ses combats : un monstre seul ne dit rien en siège, c'est
// l'équipe de trois qui se joue et qui se bat.
export interface EquipeCompte {
  // Les trois monstres, dans l'ordre où l'équipe a été vue le plus souvent.
  equipe: number[];
  combats: number;
  // Victoires de l'ATTAQUANT.
  victoires: number;
}

// La clé d'une équipe : ses monstres, quel que soit leur ordre.
// ⚠️ Le leader n'est pas distingué : rien dans les données relevées n'établit
// quelle place de `view_battle_deck_info` le porte. Deux ordres d'une même
// composition sont donc une seule équipe.
const cleEquipe = (equipe: number[]) => [...equipe].sort((a, b) => a - b).join('-');

// Les équipes en ATTAQUE de ces combats, les plus jouées d'abord (combats aux
// monstres connus seulement), avec leurs victoires.
export function equipesJoueesDans(attaques: AttaqueSiege[], max = 10): EquipeCompte[] {
  return compterEquipes(attaques, 'attaque')
    .sort((a, b) => b.combats - a.combats || b.victoires - a.victoires || a.equipe.join().localeCompare(b.equipe.join()))
    .slice(0, max);
}

// Les équipes en DÉFENSE qui ont le plus battu ces attaques : les plus de
// défaites infligées d'abord ; à égalité, la plus affrontée.
export function equipesQuiBattent(attaques: AttaqueSiege[], max = 10): EquipeCompte[] {
  return compterEquipes(attaques, 'defense')
    .filter((e) => e.combats > e.victoires)
    .sort((a, b) => b.combats - b.victoires - (a.combats - a.victoires) || b.combats - a.combats || a.equipe.join().localeCompare(b.equipe.join()))
    .slice(0, max);
}

// Les mêmes, pour une guilde entière.
export const equipesJouees = (s: SiegeReleve, guilde: number, max = 10) =>
  equipesJoueesDans(s.attaques.filter((x) => x.guildeAttaquante === guilde), max);
export const equipesQuiNousBattent = (s: SiegeReleve, guilde: number, max = 10) =>
  equipesQuiBattent(s.attaques.filter((x) => x.guildeAttaquante === guilde), max);

// ⚠️ **Un membre, ce sont SES combats POUR la guilde** : un joueur passé d'une
// guilde à l'autre a, dans le cumul de tous les sièges, des combats des deux
// côtés ; ceux menés contre nous ne sont pas les siens de membre.
const sesAttaques = (s: SiegeReleve, guilde: number, joueur: number) =>
  s.attaques.filter((x) => x.attaquant === joueur && x.guildeAttaquante === guilde);
const sesDefenses = (s: SiegeReleve, guilde: number, joueur: number) =>
  s.attaques.filter((x) => x.defenseur === joueur && x.guildeDefense === guilde);

// Les offenses d'un membre sur un type de tour : 5★ (aucune restriction) ou
// 4★ (monstres 4★ naturels et moins). Une attaque à la tour inconnue n'entre
// dans aucune des deux.
export const offensesDuMembre = (s: SiegeReleve, guilde: number, joueur: number, tour: 4 | 5, max = 10) =>
  equipesJoueesDans(sesAttaques(s, guilde, joueur).filter((x) => x.tour === tour), max);

// Les défenses contre lesquelles un membre a le plus perdu.
export const defensesQuiBattentLeMembre = (s: SiegeReleve, guilde: number, joueur: number, max = 10) =>
  equipesQuiBattent(sesAttaques(s, guilde, joueur), max);

// Le bilan d'un membre dans un siège : ses attaques, et ses défenses d'après
// les combats (`null` en défense sans le résumé des combats).
export function bilanDuMembre(s: SiegeReleve, guilde: number, joueur: number) {
  return {
    attaques: bilanDesCombats(sesAttaques(s, guilde, joueur)),
    defenses: s.sources.resume ? combatsEnDefense(sesDefenses(s, guilde, joueur)) : null,
  };
}

// Les ANCIENS membres : vus dans ma guilde pendant un siège, et absents de sa
// dernière liste des membres. ⚠️ Seulement si cette liste date d'APRÈS le
// dernier siège où on l'y a vu : un membre arrivé depuis la dernière ouverture
// de la fiche de guilde n'y est pas encore, il n'est pas parti. Sans liste,
// aucun.
export function anciensMembres(r: RelevesSiege): Set<number> {
  const anciens = new Set<number>();
  if (!r.membres || r.maGuilde === null) return anciens;
  const actuels = new Set(r.membres.ids);
  const dernierVu = new Map<number, number | null>();
  for (const s of r.sieges) {
    const t = s.debut ?? s.vu;
    for (const j of s.joueurs) {
      if (j.guilde !== r.maGuilde) continue;
      const avant = dernierVu.get(j.id);
      dernierVu.set(j.id, avant === undefined ? t : avant === null || t === null ? null : Math.max(avant, t));
    }
  }
  for (const [id, t] of dernierVu) if (!actuels.has(id) && t !== null && r.membres.t >= t) anciens.add(id);
  return anciens;
}

// Un WR au fil des sièges, du plus ancien au plus récent : un point par
// siège, en attaque et en défense. Un WR `null` : aucun combat au résultat
// connu ce siège-là (en défense : ou pas de résumé des combats).
export interface PointEvolution {
  matchId: number;
  debut: number | null;
  // Les noms des autres guildes du siège (une en tournoi, deux en saison),
  // dans l'ordre de la carte ; vide sans la carte.
  adversaires: string[];
  attaques: number;
  wrAttaque: number | null;
  defenses: number;
  wrDefense: number | null;
}

type Bilan = ReturnType<typeof bilanDeLaGuilde>;
const pointDuSiege = (s: SiegeReleve, b: Bilan): PointEvolution => ({
  matchId: s.matchId,
  debut: s.debut,
  adversaires: s.guildes.filter((g) => !g.mienne && g.nom).map((g) => g.nom),
  attaques: b.attaques.n,
  wrAttaque: b.attaques.taux,
  defenses: b.defenses?.n ?? 0,
  wrDefense: b.defenses?.tenue ?? null,
});

// D'un membre : les sièges où il était de ma guilde.
export function evolutionDuMembre(r: RelevesSiege, joueur: number): PointEvolution[] {
  const guilde = r.maGuilde;
  if (guilde === null) return [];
  return r.sieges
    .filter((s) => s.joueurs.some((j) => j.id === joueur && j.guilde === guilde))
    .map((s) => pointDuSiege(s, bilanDuMembre(s, guilde, joueur)))
    .reverse();
}

// De ma guilde : tous les sièges relevés.
export function evolutionDeLaGuilde(r: RelevesSiege): PointEvolution[] {
  const guilde = r.maGuilde;
  if (guilde === null) return [];
  return r.sieges.map((s) => pointDuSiege(s, bilanDeLaGuilde(s, guilde))).reverse();
}

// Le WR GLISSANT sur un mois : les combats des `jours` derniers jours, et
// l'écart, en points, avec les `jours` d'avant. ⚠️ « Aujourd'hui », c'est le
// dernier combat relevé, pas l'horloge : des relevés vieux de deux mois
// donnent leur dernier mois, pas un mois vide. Un écart `null` : pas de
// résultat connu sur l'une des deux périodes.
export const JOURS_GLISSANTS = 30;
export interface WrGlissant {
  taux: number | null;
  // Les combats au résultat connu de la période.
  n: number;
  ecart: number | null;
}
export function wrGlissant(r: RelevesSiege, joueur: number | null = null, jours = JOURS_GLISSANTS): { attaque: WrGlissant; defense: WrGlissant | null } | null {
  const guilde = r.maGuilde;
  if (guilde === null) return null;
  let fin = -Infinity;
  for (const s of r.sieges) for (const x of s.attaques) if (x.t > fin) fin = x.t;
  if (fin === -Infinity) return null;
  const duree = jours * 86400;
  const periode = (t: number) => (t > fin - duree ? 0 : t > fin - 2 * duree ? 1 : null);
  // [période en cours, période d'avant] × [gagnés, connus].
  const compter = (garder: (s: SiegeReleve, x: AttaqueSiege) => boolean, gagne: (x: AttaqueSiege) => boolean) => {
    const c = [
      [0, 0],
      [0, 0],
    ];
    for (const s of r.sieges)
      for (const x of s.attaques) {
        const p = x.victoire === null ? null : periode(x.t);
        if (p === null || !garder(s, x)) continue;
        c[p][1]++;
        if (gagne(x)) c[p][0]++;
      }
    const taux = (k: number) => (c[k][1] ? (100 * c[k][0]) / c[k][1] : null);
    const avant = taux(1);
    const maintenant = taux(0);
    return { taux: maintenant, n: c[0][1], ecart: maintenant !== null && avant !== null ? maintenant - avant : null };
  };
  const attaque = compter(
    (_, x) => x.guildeAttaquante === guilde && (joueur === null || x.attaquant === joueur),
    (x) => x.victoire === true
  );
  // En défense : les sièges au résumé des combats seulement (`bilanDeLaGuilde`).
  const avecResume = r.sieges.some((s) => s.sources.resume);
  const defense = avecResume
    ? compter(
        (s, x) => s.sources.resume && x.guildeDefense === guilde && (joueur === null || x.defenseur === joueur),
        (x) => x.victoire === false
      )
    : null;
  return { attaque, defense };
}

function compterEquipes(attaques: AttaqueSiege[], cote: 'attaque' | 'defense'): EquipeCompte[] {
  const parEquipe = new Map<string, EquipeCompte & { ordres: Map<string, number> }>();
  for (const x of attaques) {
    const equipe = x.monstres?.[cote];
    if (!equipe?.length) continue;
    const cle = cleEquipe(equipe);
    const c = parEquipe.get(cle) ?? { equipe, combats: 0, victoires: 0, ordres: new Map<string, number>() };
    c.combats++;
    if (x.victoire === true) c.victoires++;
    c.ordres.set(equipe.join(), (c.ordres.get(equipe.join()) ?? 0) + 1);
    parEquipe.set(cle, c);
  }
  return [...parEquipe.values()].map(({ ordres, combats, victoires, equipe }) => {
    // L'ordre le plus vu (le premier vu à égalité).
    let meilleur = equipe.join();
    for (const [ordre, n] of ordres) if (n > (ordres.get(meilleur) ?? 0)) meilleur = ordre;
    return { equipe: meilleur.split(',').map(Number), combats, victoires };
  });
}

// Les sièges relevés, du plus ancien au plus récent : rang final (ou du
// moment) et score de ma guilde.
export function historiqueDesSieges(r: RelevesSiege) {
  return r.sieges
    .map((s) => {
      const g = s.guildes.find((x) => x.mienne);
      return { matchId: s.matchId, debut: s.debut, rang: s.resultat?.rang ?? g?.rang ?? null, nbGuildes: s.resultat?.nbGuildes ?? (s.guildes.length || null), score: g?.score ?? null };
    })
    .reverse();
}

// ── Le comparatif des guildes d'un siège ────────────────────────────────

// Une colonne par guilde du siège (ma guilde d'abord, puis l'ordre de la
// carte). ⚠️ Ce que le journal montre d'une AUTRE guilde, ce sont ses combats
// contre NOUS : ses victoires et défaites se comptent sur eux (`contreNous`) ;
// ses attaques faites, son score et ses monstres viennent de la carte, pour
// tout le siège.
export interface ColonneComparatif {
  guilde: GuildeSiege;
  couleur: CouleurGuilde;
  rang: number | null;
  score: number | null;
  joueurs: number | null;
  attaques: number | null;
  attendues: number | null;
  restantes: number | null;
  // Une autre guilde : ses attaques sur nous, et les nôtres sur elle, avec
  // leurs résultats (le face-à-face).
  contreNous: number | null;
  nosAttaques: number | null;
  nosVictoires: number | null;
  nosDefaites: number | null;
  // Ses combats relevés : tous pour ma guilde, contre nous pour une autre.
  combats: number;
  victoires: number;
  defaites: number;
  monstres: number | null;
  monstresMax: number | null;
}
export function comparatifDesGuildes(s: SiegeReleve, maGuilde: number, fini: boolean): ColonneComparatif[] {
  const guildeDuJoueur = new Map(s.joueurs.map((j) => [j.id, j.guilde]));
  const attendues = new Map<number, number>();
  for (const a of s.attendues) {
    const g = guildeDuJoueur.get(a.joueur);
    if (g !== undefined) attendues.set(g, (attendues.get(g) ?? 0) + a.n);
  }
  const ordre = [...s.guildes].sort((a, b) => Number(b.mienne) - Number(a.mienne) || (a.position ?? 9) - (b.position ?? 9));
  return ordre.map((g) => {
    const siennes = s.attaques.filter((x) => x.guildeAttaquante === g.id);
    const releves = g.id === maGuilde ? siennes : siennes.filter((x) => x.guildeDefense === maGuilde);
    const attendu = attendues.has(g.id) ? attendues.get(g.id)! : null;
    const nous = g.id === maGuilde ? null : s.attaques.filter((x) => x.guildeAttaquante === maGuilde && x.guildeDefense === g.id);
    return {
      guilde: g,
      couleur: couleurDeGuilde(g, s.guildes.indexOf(g), maPosition(s)),
      rang: fini ? (g.mienne ? (s.resultat?.rang ?? g.rang) : g.rang) : null,
      score: g.score,
      joueurs: g.membres,
      attaques: g.attaques,
      attendues: attendu,
      restantes: attendu !== null && g.attaques !== null ? Math.max(0, attendu - g.attaques) : null,
      contreNous: g.id === maGuilde ? null : releves.length,
      nosAttaques: nous ? nous.length : null,
      nosVictoires: nous ? nous.filter((x) => x.victoire === true).length : null,
      nosDefaites: nous ? nous.filter((x) => x.victoire === false).length : null,
      combats: releves.length,
      victoires: releves.filter((x) => x.victoire === true).length,
      defaites: releves.filter((x) => x.victoire === false).length,
      monstres: g.monstresUtilises,
      monstresMax: attendu !== null ? attendu * 3 : null,
    };
  });
}

// ── Les tableaux par membre ─────────────────────────────────────────────

export interface LigneAttaques {
  joueur: JoueurSiege;
  victoires: number;
  defaites: number;
  faites: number;
  // `null` sans le résumé du match (attaques attendues inconnues).
  attendues: number | null;
  manquees: number | null;
  // Victoires sur les attaques au résultat connu.
  taux: number | null;
  // Victoires sur les attaques ATTENDUES : une attaque manquée compte.
  performance: number | null;
  // Les points de ses attaques ; `null` si une victoire n'a pas ses points
  // (journal du combat jamais ouvert) — jamais une somme partielle.
  points: number | null;
  monstresUtilises: number | null;
  // Ses attaques par tour, 5★ et 4★ (`AttaqueSiege.tour`) : celles dont la
  // base est inconnue n'y sont pas.
  parTour: Record<4 | 5, { victoires: number; defaites: number; total: number; taux: number | null }>;
}

// Les attaques sur une tour : gagnées, perdues, toutes, et le taux sur les
// résultats connus.
function bilanTour(attaques: AttaqueSiege[], tour: 4 | 5) {
  const sur = attaques.filter((x) => x.tour === tour);
  const victoires = sur.filter((x) => x.victoire === true).length;
  const defaites = sur.filter((x) => x.victoire === false).length;
  return { victoires, defaites, total: sur.length, taux: victoires + defaites ? (100 * victoires) / (victoires + defaites) : null };
}

// Le tableau des attaques des membres d'une guilde, par ordre alphabétique :
// l'ordre de base du tableau, quand aucune colonne ne le trie.
export function tableauAttaques(s: SiegeReleve, guilde: number): LigneAttaques[] {
  const attendues = new Map(s.attendues.map((a) => [a.joueur, a.n]));
  return [...bilanParJoueur(s, guilde)].sort(parNom).map((b) => {
    const siennes = sesAttaques(s, guilde, b.joueur.id);
    const n = attendues.get(b.joueur.id) ?? null;
    const gagnees = siennes.filter((x) => x.victoire === true);
    const connus = b.victoires + b.defaites;
    return {
      joueur: b.joueur,
      victoires: b.victoires,
      defaites: b.defaites,
      faites: b.attaques,
      attendues: n,
      manquees: n === null ? null : Math.max(0, n - b.attaques),
      taux: connus ? (100 * b.victoires) / connus : null,
      performance: n ? (100 * b.victoires) / n : null,
      points: gagnees.every((x) => x.points !== null) ? siennes.reduce((t, x) => t + (x.points ?? 0), 0) : null,
      monstresUtilises: b.monstresUtilises,
      parTour: { 5: bilanTour(siennes, 5), 4: bilanTour(siennes, 4) },
    };
  });
}

export interface LigneDefenses {
  joueur: JoueurSiege;
  // `null` : aucune défense connue pour ce siège.
  decks: number | null;
  subis: number;
  tenus: number;
  perdus: number;
  tenue: number | null;
}

// Le tableau des défenses des membres d'une guilde : les combats où ils
// défendaient, d'après les combats du siège. Vide sans le résumé du match.
// Par ordre alphabétique : l'ordre de base du tableau.
export function tableauDefenses(s: SiegeReleve, guilde: number): LigneDefenses[] {
  return bilanParJoueur(s, guilde)
    .flatMap((b) =>
      b.enDefense ? [{ joueur: b.joueur, decks: b.decks, subis: b.enDefense.n, tenus: b.enDefense.tenus, perdus: b.enDefense.perdus, tenue: b.enDefense.tenue }] : []
    )
    .sort(parNom);
}

// L'ordre de base des tableaux : alphabétique, par nom de joueur.
const parNom = (a: { joueur: JoueurSiege }, b: { joueur: JoueurSiege }) => a.joueur.nom.localeCompare(b.joueur.nom) || a.joueur.id - b.joueur.id;

// ── Tous les sièges confondus ───────────────────────────────────────────

// L'identifiant du siège « cumulé » : aucun vrai siège n'a ce `match_id`.
export const TOUS_LES_SIEGES = 0;

// Tous les sièges relevés en UN, pour que chaque vue (bilan, membres,
// équipes, combats, filtres) les compte ensemble : les combats et les monstres
// utilisés s'additionnent, chaque joueur et chaque deck garde sa dernière
// version. ⚠️ Ce qui n'a de sens que pour un siège n'y est pas : ni guildes
// (les adversaires changent), ni résultat, ni courbe (l'écran la masque).
// Les sources : le résumé seulement s'il a été ouvert pour CHAQUE siège —
// sinon des combats manquent au cumul.
//
// ⚠️ **Un joueur qui a changé de guilde** garde la version de lui où il était
// de MA guilde, la plus récente : un ancien membre retrouvé chez un adversaire
// reste dans nos tableaux, et y garde ses combats pour nous (les bilans
// filtrent par guilde, `sesAttaques`). Ses monstres utilisés et ses attaques
// attendues ne s'additionnent que sur les sièges où il était de cette guilde.
export function siegesCumules(r: RelevesSiege): SiegeReleve | null {
  if (r.sieges.length === 0) return null;
  const anciens = [...r.sieges].reverse();
  const joueurs = new Map<number, JoueurSiege>();
  const decks = new Map<number, DefenseSiege>();
  const utilises = new Map<number, number>();
  const attendues = new Map<number, number>();
  for (const s of anciens) {
    for (const j of s.joueurs) {
      const avant = joueurs.get(j.id);
      if (!(avant && avant.guilde === r.maGuilde && j.guilde !== r.maGuilde)) joueurs.set(j.id, j);
    }
    for (const d of s.defenses) decks.set(d.deck, d);
  }
  // Le joueur était-il, dans ce siège, de la guilde que le cumul lui donne ?
  // Absent des joueurs du siège : on ne sait pas, il compte.
  const memeGuilde = (s: SiegeReleve, id: number) => {
    const ici = s.joueurs.find((j) => j.id === id);
    return !ici || ici.guilde === joueurs.get(id)?.guilde;
  };
  for (const s of anciens) {
    for (const u of s.monstresUtilises) if (memeGuilde(s, u.joueur)) utilises.set(u.joueur, (utilises.get(u.joueur) ?? 0) + u.n);
    // Les attaques attendues : celles de chaque siège où le joueur était.
    for (const a of s.attendues) if (memeGuilde(s, a.joueur)) attendues.set(a.joueur, (attendues.get(a.joueur) ?? 0) + a.n);
  }
  const heures = (f: (s: SiegeReleve) => number | null) => anciens.map(f).filter((t): t is number => t !== null);
  return {
    siegeId: TOUS_LES_SIEGES,
    matchId: TOUS_LES_SIEGES,
    debut: heures((s) => s.debut).length ? Math.min(...heures((s) => s.debut)) : null,
    fin: heures((s) => s.fin).length ? Math.max(...heures((s) => s.fin)) : null,
    vu: heures((s) => s.vu).length ? Math.max(...heures((s) => s.vu)) : null,
    guildes: [],
    joueurs: [...joueurs.values()],
    attaques: anciens.flatMap((s) => s.attaques),
    defenses: [...decks.values()],
    monstresUtilises: [...utilises].map(([joueur, n]) => ({ joueur, n })),
    attendues: [...attendues].map(([joueur, n]) => ({ joueur, n })),
    resultat: null,
    sources: {
      carte: anciens.some((s) => s.sources.carte),
      resume: anciens.every((s) => s.sources.resume),
      journaux: anciens.reduce((n, s) => n + s.sources.journaux, 0),
      defenses: anciens.some((s) => s.sources.defenses),
    },
  };
}

// ── Les bilans d'un siège ───────────────────────────────────────────────

export interface BilanJoueur {
  joueur: JoueurSiege;
  attaques: number;
  victoires: number;
  defaites: number;
  // `null` sans le résumé du match.
  monstresUtilises: number | null;
  // Ses decks en défense ; `null` : aucune défense connue pour ce siège
  // (jamais un zéro inventé).
  decks: number | null;
  // Les combats où il défendait, dans ce siège (`combatsEnDefense`) ; `null`
  // sans le résumé du match.
  enDefense: { n: number; tenus: number; perdus: number; tenue: number | null } | null;
}

// Le bilan de chaque joueur d'une guilde (la mienne par défaut), du plus
// actif au moins actif.
export function bilanParJoueur(s: SiegeReleve, guilde: number): BilanJoueur[] {
  const utilises = new Map(s.monstresUtilises.map((u) => [u.joueur, u.n]));
  return s.joueurs
    .filter((j) => j.guilde === guilde)
    .map((joueur) => {
      const siennes = sesAttaques(s, guilde, joueur.id);
      return {
        joueur,
        attaques: siennes.length,
        victoires: siennes.filter((x) => x.victoire === true).length,
        defaites: siennes.filter((x) => x.victoire === false).length,
        monstresUtilises: s.sources.resume ? (utilises.get(joueur.id) ?? 0) : null,
        decks: s.sources.defenses ? s.defenses.filter((d) => d.joueur === joueur.id).length : null,
        enDefense: s.sources.resume ? combatsEnDefense(sesDefenses(s, guilde, joueur.id)) : null,
      };
    })
    .sort((x, y) => y.attaques - x.attaques || y.victoires - x.victoires || x.joueur.nom.localeCompare(y.joueur.nom));
}
