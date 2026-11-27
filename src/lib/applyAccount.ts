// Mappe les données brutes d'un export (parseur → ImportedUnit/SiegeImportedDeck)
// vers les structures attendues par les états RTA & Siège. Partagé par l'import
// global (App) pour alimenter toutes les pages d'un coup.

import { GearSet, Monster, RTA_OTHER, RTA_UNASSIGNED, RUNE_SETS } from '../types';
import {
  AccountSource,
  BoxMonster,
  ImportedUnit,
  SiegeImportedDeck,
  parseArenaDefense,
  parseArenaInterserveurDefense,
  parseArenaOffense,
  parseDimensionDefense,
  parseDimensionOffense,
} from './importAccount';
import type { Dictionnaire } from '../i18n/fr';
import { RtaVueAmi } from './rtaShare';
import { SIEGE_TICKS, combatSpeed, leadPour, speedLeadOf, type RegleLead } from './speed';

// Set principal pour pré-classer un monstre en RTA (4 pièces prioritaires).
const RTA_SET_PRIORITY = ['violent', 'swift', 'despair', 'rage', 'fatal', 'vampire'];
function primarySection(sets: string[]): string {
  for (const key of RTA_SET_PRIORITY) if (sets.includes(key)) return key;
  return RTA_OTHER;
}

type MappedSlot = { monsterId: string | null; runeSpeed: number | null; sets?: string[]; tick?: number; gear?: GearSet; unitId?: number };

// Vitesse de runes finale = SPD plate + bonus Swift (25 % de la base) si set
// complet. Arrondi au SUPÉRIEUR, comme tous les bonus en % de l'app.
// ⚠️ Exportée : c'est aussi la règle de dédup entre plusieurs exemplaires
// d'un même monstre en RTA (meilleur build = SPD max, voir `mapRtaItems`
// ci-dessous) — réutilisée telle quelle par scripts/lib/loadMonster.ts pour
// qu'un script ne réimplémente jamais cette formule à côté.
export function runeSpeedOf(flatRuneSpeed: number, swift: boolean, base: number): number {
  return flatRuneSpeed + (swift ? Math.ceil((base * 25) / 100) : 0);
}

// Tick de siège le plus proche d'une vitesse de combat (0 si inconnue).
function nearestTick(combat: number | null): number {
  if (combat === null) return 0;
  let best = 0;
  let bestDiff = Infinity;
  for (const t of SIEGE_TICKS) {
    const diff = Math.abs(combat - t.value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = t.value;
    }
  }
  return best;
}

// Box RTA → entrées { monsterId, runeSpeed, section, sets }, dédupliquées au
// meilleur build (SPD max). La section est pré-classée selon le set principal.
export function mapRtaItems(
  units: ImportedUnit[],
  byCom2us: Map<number, Monster>
): { monsterId: string; runeSpeed: number; section: string; sets: string[]; gear?: GearSet; unitId?: number }[] {
  const best = new Map<string, { runeSpeed: number; sets: string[]; runeCount: number; gear?: GearSet; unitId?: number }>();
  for (const u of units) {
    const mon = byCom2us.get(u.com2usId);
    if (!mon) continue;
    const rs = runeSpeedOf(u.flatRuneSpeed, u.swift, mon.stats.speed ?? 0);
    const id = String(mon.id);
    const prev = best.get(id);
    if (!prev || rs > prev.runeSpeed) {
      best.set(id, { runeSpeed: rs, sets: u.sets ?? [], runeCount: u.runeCount ?? 0, gear: u.gear, unitId: u.unitId });
    }
  }
  return Array.from(best, ([monsterId, v]) => ({
    monsterId,
    runeSpeed: v.runeSpeed,
    sets: v.sets,
    gear: v.gear,
    ...(v.unitId !== undefined ? { unitId: v.unitId } : {}),
    // Build incomplet (< 6 runes) → on laisse en « Non classé ».
    section: v.runeCount >= 6 ? primarySection(v.sets) : RTA_UNASSIGNED,
  }));
}

// Export de compte d'un AMI → prépa consultable (`#/rta/ami`).
//
// ⚠️ **Le même chemin que son propre import, jusqu'au bout** : `mapRtaItems`
// décide des vitesses (Swift compris), du meilleur exemplaire et du pré-classement
// par set. Reconstruire ici une seconde façon de lire une box RTA aurait donné
// deux prépas différentes pour un même fichier selon qu'on l'importe ou qu'on le
// consulte — et personne n'aurait su laquelle croire.
//
// ⚠️ **Rien n'est conservé.** L'appelant garde la vue en mémoire, jamais sur le
// disque : c'est le compte de quelqu'un d'autre (voir docs/02-app/rta/).
export function mapRtaVueAmi(
  units: ImportedUnit[],
  byCom2us: Map<number, Monster>,
  auteur: string | null
): RtaVueAmi {
  const byId = new Map<string, Monster>();
  for (const m of byCom2us.values()) byId.set(String(m.id), m);

  const entries = mapRtaItems(units, byCom2us).flatMap((it) => {
    const monster = byId.get(it.monsterId);
    if (!monster) return [];
    return [
      {
        monster,
        entry: {
          monsterId: it.monsterId,
          section: it.section,
          runeSpeed: it.runeSpeed,
          sets: it.sets,
          gear: it.gear,
        },
      },
    ];
  });

  // ⚠️ Monstres absents des données chargées : ANNONCÉS, jamais avalés — même
  // règle que la lecture d'un fichier de prépa. Une box qui perd trois monstres
  // en silence passe pour incomplète chez son auteur.
  const inconnus: number[] = [];
  for (const u of units) {
    if (!byCom2us.has(u.com2usId) && !inconnus.includes(u.com2usId)) inconnus.push(u.com2usId);
  }

  // Sections dans l'ordre des sets du jeu, « Autre » en dernier : les mêmes
  // repères que sur sa propre prépa. Seules celles qui portent un monstre sont
  // listées — une section vide chez lui n'apprend rien.
  const presentes = new Set(entries.map((e) => e.entry.section));
  const sections = [
    ...RUNE_SETS.map((s) => s.key).filter((k) => presentes.has(k)),
    ...(presentes.has(RTA_OTHER) ? [RTA_OTHER] : []),
  ];

  return {
    nom: '',
    auteur: auteur ?? '',
    // Un export de compte porte les runes, les vitesses ET le classement par
    // set : c'est exactement ce que décrit le niveau `complet`.
    niveau: 'complet',
    sections,
    entries,
    categories: [],
    inconnus,
  };
}

// Un monstre de la box, résolu vers son Monster (nom/image/élément) + gear.
export interface BoxItem {
  key: string; // unique (unitId) pour le rendu
  monster: Monster;
  stars: number;
  level: number;
  gear?: GearSet;
}

// Box importée → liste de monstres affichables (on ignore ceux dont le
// com2usId n'est pas dans les données de monstres chargées).
export function mapBoxMonsters(box: BoxMonster[], byCom2us: Map<number, Monster>): BoxItem[] {
  const out: BoxItem[] = [];
  for (const b of box) {
    const monster = byCom2us.get(b.com2usId);
    if (!monster) continue;
    out.push({ key: String(b.unitId), monster, stars: b.stars, level: b.level, gear: b.gear });
  }
  return out;
}

// Decks de siège (ou d'arène, `regle`) → équipes { slots }. `missing` =
// monstres non trouvés (slots laissés vides).
export function mapSiegeTeams(
  decks: SiegeImportedDeck[],
  byCom2us: Map<number, Monster>,
  regle: RegleLead = 'siege'
): { teams: { slots: MappedSlot[] }[]; missing: number } {
  let missing = 0;
  const teams = decks.map((dk) => {
    // Lead auto (leader = slot 0) pour la vitesse de combat.
    const leader = dk.slots[0] ? byCom2us.get(dk.slots[0].com2usId) ?? null : null;
    const leadInfo = speedLeadOf(leader);
    // Pas de tick si l'équipe contient Leo, ou au moins un Swift (équipe speed).
    const hasLeo = dk.slots.some((s) => s != null && byCom2us.get(s.com2usId)?.name === 'Leo');
    const teamHasSwift = dk.slots.some((s) => s != null && s.sets.includes('swift'));
    const noTick = hasLeo || teamHasSwift;
    return {
      slots: dk.slots.map((slot): MappedSlot => {
        if (!slot) return { monsterId: null, runeSpeed: null, sets: [], tick: 0 };
        const mon = byCom2us.get(slot.com2usId);
        if (!mon) {
          missing++;
          return { monsterId: null, runeSpeed: null, sets: [], tick: 0 };
        }
        const runeSpeed = runeSpeedOf(slot.flatRuneSpeed, slot.swift, mon.stats.speed ?? 0);
        const combat = combatSpeed(
          mon.stats.speed,
          runeSpeed,
          leadPour(regle, leadInfo, mon.element),
          slot.swift
        );
        return {
          monsterId: String(mon.id),
          runeSpeed,
          sets: slot.sets,
          tick: noTick ? 0 : nearestTick(combat),
          gear: slot.gear,
          ...(slot.unitId !== undefined ? { unitId: slot.unitId } : {}),
        };
      }),
    };
  });
  return { teams, missing };
}

// Les équipes de l'arène classique d'un export, prêtes pour les états :
// défense, offense, défense interserveur. Leads d'arène.
export function equipesAreneClassique(
  data: AccountSource,
  byCom2us: Map<number, Monster>,
  t: Dictionnaire
): Record<'defense' | 'offense' | 'interserveur', ReturnType<typeof mapSiegeTeams>> {
  return {
    defense: mapSiegeTeams(parseArenaDefense(data, t).decks, byCom2us, 'arene'),
    offense: mapSiegeTeams(parseArenaOffense(data, t).decks, byCom2us, 'arene'),
    interserveur: mapSiegeTeams(parseArenaInterserveurDefense(data, t).decks, byCom2us, 'arene'),
  };
}

// Les pages qu'un export du compte suivi (dossier SW Exporter) remplit
// QUAND ELLES SONT VIDES, alors qu'il ne met à jour que « Mon compte » :
// prépa RTA, défenses et attaques de siège, chaque côté de l'arène
// classique. Vide, une page n'a rien à perdre ; pleine, elle porte le travail
// de l'utilisateur (classement, leads, ticks) et l'export n'y touche pas.
export type PageRattrapable = 'rta' | 'siegeDefense' | 'siegeOffense' | 'areneDefense' | 'areneOffense' | 'areneInterserveur';

// Les pages vides parmi `contenus` (le nombre d'entrées ou d'équipes de
// chacune), dans l'ordre donné.
export function pagesVides(contenus: Record<PageRattrapable, number>): PageRattrapable[] {
  return (Object.keys(contenus) as PageRattrapable[]).filter((p) => contenus[p] === 0);
}

// Ce que fait la page d'un export du compte suivi :
// - `tout` : l'import complet — après le choix d'un invocateur (`complet`),
//   ou sur une page sans compte ni équipes (conservation refusée : rien à
//   perdre) ;
// - sinon `compte` : « Mon compte » se met à jour pour un export NOUVEAU, ou
//   sans compte ; un export déjà lu, redonné au lancement pour une page vide,
//   ne le réapplique pas (il remettrait l'Optimizer à zéro à chaque
//   lancement) ;
// - et `pages` : les pages vides, que l'export remplit.
export function planExportSuivi(e: {
  complet: boolean;
  nouveau: boolean;
  aCompte: boolean;
  aDesEquipes: boolean;
  contenus: Record<PageRattrapable, number>;
}): { tout: boolean; compte: boolean; pages: PageRattrapable[] } {
  if (e.complet || (!e.aCompte && !e.aDesEquipes)) return { tout: true, compte: true, pages: [] };
  return { tout: false, compte: e.nouveau || !e.aCompte, pages: pagesVides(e.contenus) };
}

// La page se déclare INCOMPLÈTE au lancement — sans compte, ou avec une page
// vide que l'export sait remplir : l'export suivi, même déjà lu, lui est
// redonné (bureau/swexPur.ts, `aDonner`).
export function pageIncomplete(aCompte: boolean, contenus: Record<PageRattrapable, number>): boolean {
  return !aCompte || pagesVides(contenus).length > 0;
}

// Les équipes de l'arène dimensionnelle, prêtes pour les états : la défense de
// la saison (tenue par le plugin SWEX), les attaques des équipes récentes
// (`deck_recent_list` : vues jouer par le plugin, sinon celle de l'export),
// reconnues dans la box de la saison. Leads d'arène.
export function equipesDimension(
  saison: Record<string, any>,
  recents: unknown[],
  byCom2us: Map<number, Monster>,
  t: Dictionnaire
): { defense: ReturnType<typeof mapSiegeTeams>; offense: ReturnType<typeof mapSiegeTeams> } {
  return {
    defense: mapSiegeTeams(parseDimensionDefense(saison, t).decks, byCom2us, 'arene'),
    offense: mapSiegeTeams(parseDimensionOffense({ deck_recent_list: recents }, saison, t).decks, byCom2us, 'arene'),
  };
}
