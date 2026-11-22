// Les SOURCES de « Mes équipes » : l'équipement qu'un monstre ajouté peut
// copier, et les équipes qu'un import peut créer.
//
// Spec : docs/02-app/compte/feat-equipes.md, « Créer et modifier » et
// « Imports ». Tout se lit dans les données de l'app (Box, prépa RTA, équipes
// de siège, decks d'arène, listes de l'Optimizer) ; rien n'est écrit ici, le
// geste rend une équipe neuve que l'écran ajoute.

import { RTA_UNASSIGNED, type GearSet, type Monster, type RtaState, type SiegeTeam } from '../types';
import type { BoxItem } from './applyAccount';
import type { Dictionnaire } from '../i18n/fr';
import type { ContenuDeck, DeckArene, DeckEnregistreImporte, SousContenuDeck } from './importAccount';
import { resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData } from './optimizerExclusion';
import type { StockageOptimizer } from './optimizerMemberStorage';
import { creerDepuisEquipeOptimizer, disponibiliteRetourOptimizer } from './importEquipesEnregistrees';
import {
  CATEGORIES_EQUIPES, MONSTRES_MAX_EQUIPE, MONSTRES_MAX_PREPA, MONSTRES_MIN_EQUIPE, categorieDe, creerEquipe, normaliserPrepa, sousCategorieDe,
  type EquipeEnregistree, type InventaireCompte, type MonstreEnregistre, type OngletEquipes,
  type ProvenanceEquipement, type TirerId,
} from './equipesEnregistrees';

export interface ContexteSourcesEquipes {
  box: readonly BoxItem[];
  siegeDefenseTeams: readonly SiegeTeam[];
  siegeOffenseTeams: readonly SiegeTeam[];
  // La prépa de la page RTA, telle qu'elle est.
  rta: RtaState;
  // `null` : compte conservé avant la lecture des decks d'arène.
  arenaDecks: readonly DeckArene[] | null;
  // Tous les decks enregistrés du jeu ; `null` : compte conservé avant leur lecture.
  decksEnregistres: readonly DeckEnregistreImporte[] | null;
  // Un compte est-il chargé (Box ou inventaire non vides) ?
  compte: boolean;
  monsterById: ReadonlyMap<string, Monster>;
  monsterByCom2us: ReadonlyMap<number, Monster>;
}

/* --------------------------------------------------------------------------
 * L'équipement d'un monstre ajouté
 * ----------------------------------------------------------------------- */

export interface SourceEquipement {
  cle: string;
  libelle: string;
  provenance: ProvenanceEquipement;
  unitId: number | null;
  equipement: GearSet | null;
  // Un deck (siège, arène) : ses membres dans l'ordre des places (`null` =
  // place vide ou espèce inconnue) et la place du monstre, de quoi
  // distinguer deux decks par leurs coéquipiers, comme dans l'Optimizer.
  equipe?: { membres: (Monster | null)[]; position: number };
}

// Les choix d'équipement d'une espèce, dans l'ordre de la spec : chaque
// exemplaire de la Box, le build de la prépa RTA, les decks de siège, les
// decks d'arène, puis « Sans équipement », toujours présent.
export function sourcesEquipementEspece(com2usId: number, ctx: ContexteSourcesEquipes, t: Dictionnaire): SourceEquipement[] {
  const a = t.equipes.ajout;
  const res: SourceEquipement[] = [];
  for (const b of ctx.box) {
    if (b.monster.com2usId !== com2usId) continue;
    const unitId = /^\d+$/.test(b.key) ? Number(b.key) : null;
    res.push({ cle: `box:${b.key}`, libelle: a.porte(b.level), provenance: b.gear ? 'porte' : 'aucun', unitId, equipement: b.gear ?? null });
  }
  for (const e of Object.values(ctx.rta.entries)) {
    if (e.gear && ctx.monsterById.get(e.monsterId)?.com2usId === com2usId)
      res.push({ cle: `rta:${e.monsterId}`, libelle: a.prepaRta, provenance: 'rta', unitId: e.unitId ?? null, equipement: e.gear });
  }
  const siege = (teams: readonly SiegeTeam[], provenance: ProvenanceEquipement, libelle: (n: number) => string) =>
    teams.forEach((team, i) => team.slots.forEach((slot, s) => {
      if (slot.monsterId !== null && slot.gear && ctx.monsterById.get(slot.monsterId)?.com2usId === com2usId)
        res.push({ cle: `${provenance}:${team.id}:${s}`, libelle: libelle(i + 1), provenance, unitId: null, equipement: slot.gear,
          equipe: { membres: team.slots.map((x) => (x.monsterId === null ? null : ctx.monsterById.get(x.monsterId) ?? null)), position: s } });
    }));
  siege(ctx.siegeDefenseTeams, 'siege-defense', a.defense);
  siege(ctx.siegeOffenseTeams, 'siege-attaque', a.attaque);
  for (const deck of ctx.arenaDecks ?? []) deck.slots.forEach((slot, s) => {
    if (slot.com2usId !== com2usId) return;
    const provenance: ProvenanceEquipement = deck.cle === 'attaque' ? 'arene-attaque' : 'arene-defense';
    res.push({ cle: `arene:${deck.cle}:${deck.rang}:${s}`, libelle: libelleDeckArene(deck, a), provenance, unitId: slot.unitId, equipement: slot.gear,
      equipe: { membres: deck.slots.map((x) => ctx.monsterByCom2us.get(x.com2usId) ?? null), position: s } });
  });
  res.push({ cle: 'aucun', libelle: a.sansEquipement, provenance: 'aucun', unitId: null, equipement: null });
  return res;
}

function libelleDeckArene(deck: DeckArene, a: { areneDefense: string; areneDefenseServeur: string; areneAttaque: (n: number) => string }): string {
  return deck.cle === 'defense' ? a.areneDefense : deck.cle === 'defense-serveur' ? a.areneDefenseServeur : a.areneAttaque(deck.rang + 1);
}

/* --------------------------------------------------------------------------
 * Les imports d'équipes
 * ----------------------------------------------------------------------- */

export interface ImportEquipeCree {
  equipe: EquipeEnregistree;
  // Monstres d'espèce inconnue, laissés de côté.
  ignores: number;
}

export interface SourceImportEquipe {
  cle: string;
  groupe: string;
  libelle: string;
  monstres: Monster[];
  // La raison quand la source n'a rien à importer ; `null` : utilisable.
  raison: string | null;
  // Où va l'équipe créée ; absent : l'onglet ouvert (Optimizer), ou une
  // source sans contenu.
  rangement?: OngletEquipes;
  creer: (id: string, tirerUid: TirerId, maintenant: Date) => ImportEquipeCree | null;
}

// `leader` : le membre vient du slot 0 de sa source (siège) ou de la tête du deck (arène).
interface MembreBrut { com2usId: number | null; unitId: number | null; equipement: GearSet | null; leader: boolean }

function equipeDepuisMembres(
  membres: MembreBrut[], onglet: OngletEquipes, nom: string, provenance: ProvenanceEquipement,
  ctx: ContexteSourcesEquipes, id: string, tirerUid: TirerId, maintenant: Date, max = MONSTRES_MAX_EQUIPE
): ImportEquipeCree {
  let ignores = 0;
  const monstres: MonstreEnregistre[] = [];
  let leader: string | null = null;
  for (const m of membres.slice(0, max)) {
    if (m.com2usId === null || !ctx.monsterByCom2us.has(m.com2usId)) { ignores++; continue; }
    const uid = tirerUid();
    if (m.leader) leader = uid;
    monstres.push({ uid, com2usId: m.com2usId, unitId: m.unitId, provenance: m.equipement ? provenance : 'aucun',
      equipement: m.equipement ? structuredClone(m.equipement) : null });
  }
  return { equipe: { ...creerEquipe(id, onglet, nom, maintenant), monstres, leader }, ignores };
}

const monstresConnus = (ids: (number | null)[], ctx: ContexteSourcesEquipes) =>
  ids.map((c) => (c === null ? undefined : ctx.monsterByCom2us.get(c))).filter((m): m is Monster => !!m);
// Un deck vide, ou de moins de deux espèces connues, n'est pas importable : une
// équipe enregistrée a au moins deux monstres.
const raisonDeck = (membres: MembreBrut[], connus: Monster[], im: Dictionnaire['equipes']['imports']) =>
  !membres.length ? im.aucunDeck : connus.slice(0, MONSTRES_MAX_EQUIPE).length < MONSTRES_MIN_EQUIPE ? im.moinsDeDeux : null;

// Le rangement d'un deck de l'export dans les onglets et leurs catégories
// (décision de l'utilisateur, 2026-11-22) : par son contenu, et par son donjon
// pour Cairos, la faille, le passage des dimensions et la subjugation. Un
// contenu non relevé (`autre`) va dans l'onglet ouvert. Les types 1 (arène —
// offense) et 22 (siège — offense) ne sont pas repris ici : les decks d'arène
// et les équipes de siège les portent déjà.
export const RANGEMENT_CONTENU_DECK: Readonly<Record<ContenuDeck, OngletEquipes | null>> = {
  'arene-offense': 'arene/offense',
  'guerre-guilde-offense': 'guilde/offense-gdg',
  'siege-offense': 'guilde/offense-siege',
  'labyrinthe-normal': 'labyrinthe/normal', 'labyrinthe-sauvetage': 'labyrinthe/sauvetage',
  'labyrinthe-temps-limite': 'labyrinthe/temps-limite', 'labyrinthe-boss': 'labyrinthe/boss',
  'labyrinthe-temps-pause': 'labyrinthe/temps-pause', 'labyrinthe-vitesse-limitee': 'labyrinthe/vitesse-limitee',
  'labyrinthe-explosion': 'labyrinthe/explosion',
  'tribunal-ascension': 'toa', 'tour-eau': 'toa', 'tour-feu': 'toa', 'tour-vent': 'toa', 'tour-lumiere': 'toa',
  'tour-tenebres': 'toa', 'tour-celeste': 'toa',
  'passage-dimensions': 'passage-dimensions', 'raid-dimensionnel-1': 'passage-dimensions/raid',
  'raid-dimensionnel-2': 'passage-dimensions/raid', 'raid-dimensionnel-3': 'passage-dimensions/raid',
  cairos: 'cairos', 'faille-mondes': 'faille', 'raid-mondes': 'faille/raid', subjugation: 'subjugation',
  // L'export ne dit pas l'élément du temple : l'onglet seul.
  'temple-chaos': 'temple-chaos',
  autre: null,
};
export const RANGEMENT_SOUS_CONTENU_DECK: Readonly<Record<SousContenuDeck, OngletEquipes>> = {
  'castel-geant': 'cairos/geant', 'taniere-dragon': 'cairos/dragon', necropolis: 'cairos/necropolis',
  'royaume-spirituel': 'cairos/royaume-spirituel', 'forteresse-acier': 'cairos/forteresse-acier', 'crypte-jugement': 'cairos/crypte-jugement',
  'bete-glace': 'faille/glace', 'bete-enflammee': 'faille/enflammee', 'bete-orage': 'faille/orage',
  'bete-radiance': 'faille/radiance', 'bete-marecage': 'faille/marecage',
  'foret-fauves-rugissants': 'passage-dimensions/karzhan', 'sanctuaire-fees-reveuses': 'passage-dimensions/ellunia',
  'falaise-hommes-betes': 'passage-dimensions/lumel', 'ruines-mort-silencieuse': 'passage-dimensions/khalderun',
  'chateau-heros-oublies': 'passage-dimensions/sacreon', 'terre-infernale-embrasee': 'passage-dimensions/inferas',
  'subjugation-eau': 'subjugation/eau', 'subjugation-feu': 'subjugation/feu', 'subjugation-vent': 'subjugation/vent',
  'subjugation-boss': 'subjugation/boss',
};
export const rangementDeck = (d: Pick<DeckEnregistreImporte, 'contenu' | 'sousContenu'>): OngletEquipes | null =>
  (d.sousContenu ? RANGEMENT_SOUS_CONTENU_DECK[d.sousContenu] : null) ?? RANGEMENT_CONTENU_DECK[d.contenu];
const CONTENUS_DEJA_SOURCES: readonly ContenuDeck[] = ['arene-offense', 'siege-offense'];

// L'ordre des sources pour l'onglet ouvert (décision de l'utilisateur) :
// d'abord celles de la catégorie filtrée, puis celles de l'onglet, puis le
// reste dans l'ordre de base. Sans catégorie filtrée, l'onglet d'abord.
export function ordonnerSourcesPourOnglet<T extends { cle: string; rangement?: OngletEquipes }>(sources: T[], onglet: OngletEquipes): T[] {
  const categorie = categorieDe(onglet);
  const sous = sousCategorieDe(onglet);
  const rang = (s: T) => {
    if (!s.rangement || categorieDe(s.rangement) !== categorie) return 2;
    return sous === null || sousCategorieDe(s.rangement) === sous ? 0 : 1;
  };
  // `sort` est stable : à rang égal, l'ordre de base.
  return [...sources].sort((a, b) => rang(a) - rang(b));
}

export function sourcesImportEquipes(
  ctx: ContexteSourcesEquipes, optimizer: { stockage: StockageOptimizer; data: ExclusionSourceData } | null,
  inv: InventaireCompte, ongletOuvert: OngletEquipes, t: Dictionnaire
): SourceImportEquipe[] {
  return ordonnerSourcesPourOnglet(sourcesDansLOrdreDeBase(ctx, optimizer, inv, ongletOuvert, t), ongletOuvert);
}

function sourcesDansLOrdreDeBase(
  ctx: ContexteSourcesEquipes, optimizer: { stockage: StockageOptimizer; data: ExclusionSourceData } | null,
  inv: InventaireCompte, ongletOuvert: OngletEquipes, t: Dictionnaire
): SourceImportEquipe[] {
  const im = t.equipes.imports;
  const res: SourceImportEquipe[] = [];

  const siege = (teams: readonly SiegeTeam[], groupe: string, onglet: OngletEquipes, provenance: ProvenanceEquipement, libelle: (n: number) => string) =>
    teams.forEach((team, i) => {
      // Le leader est le slot 0, et lui seul : un slot 0 vide laisse l'équipe sans leader.
      const membres: MembreBrut[] = team.slots.flatMap((s, i) => (s.monsterId === null ? [] : [{
        com2usId: ctx.monsterById.get(s.monsterId)?.com2usId ?? null, unitId: null, equipement: s.gear ?? null, leader: i === 0 }]));
      const connus = monstresConnus(membres.map((m) => m.com2usId), ctx);
      res.push({ cle: `${provenance}:${team.id}`, groupe, libelle: libelle(i + 1), monstres: connus, raison: raisonDeck(membres, connus, im), rangement: onglet,
        creer: (id, tirerUid, maintenant) => equipeDepuisMembres(membres, onglet, libelle(i + 1), provenance, ctx, id, tirerUid, maintenant) });
    });
  siege(ctx.siegeDefenseTeams, im.siegeDefenses, 'guilde/defense-siege', 'siege-defense', im.defense);
  siege(ctx.siegeOffenseTeams, im.siegeAttaques, 'guilde/offense-siege', 'siege-attaque', im.attaque);

  // Arène : lue dans l'export de compte.
  if (!ctx.compte || ctx.arenaDecks === null || ctx.arenaDecks.length === 0) {
    const raison = !ctx.compte ? im.sansCompte : ctx.arenaDecks === null ? im.reimporter : im.aucunDeck;
    res.push({ cle: 'arene', groupe: im.arene, libelle: im.arene, monstres: [], raison, rangement: 'arene', creer: () => null });
  } else for (const deck of ctx.arenaDecks) {
    const libelle = deck.cle === 'defense' ? im.areneDefense : deck.cle === 'defense-serveur' ? im.areneDefenseServeur : im.areneAttaque(deck.rang + 1);
    const onglet: OngletEquipes = deck.cle === 'attaque' ? 'arene/offense' : deck.cle === 'defense-serveur' ? 'arene/defense-serveur' : 'arene/defense';
    const provenance: ProvenanceEquipement = deck.cle === 'attaque' ? 'arene-attaque' : 'arene-defense';
    const membres: MembreBrut[] = deck.slots.map((s, i) => ({ com2usId: s.com2usId, unitId: s.unitId, equipement: s.gear, leader: i === 0 }));
    const connus = monstresConnus(membres.map((m) => m.com2usId), ctx);
    res.push({ cle: `arene:${deck.cle}:${deck.rang}`, groupe: im.arene, libelle, monstres: connus, raison: raisonDeck(membres, connus, im), rangement: onglet,
      creer: (id, tirerUid, maintenant) => equipeDepuisMembres(membres, onglet, libelle, provenance, ctx, id, tirerUid, maintenant) });
  }

  // La prépa de la page RTA, entière, en une prépa enregistrée : ses sections
  // dans leur ordre, « Non classé » en dernier. Rangée avec les decks du jeu
  // (décision de l'utilisateur) : un inventaire alternatif lu dans l'export,
  // comme eux.
  {
    const ordre = [...ctx.rta.sections, RTA_UNASSIGNED];
    const rang = (section: string) => { const i = ordre.indexOf(section); return i < 0 ? ordre.length : i; };
    const entrees = Object.values(ctx.rta.entries).sort((a, b) => rang(a.section) - rang(b.section));
    const membres: MembreBrut[] = entrees.map((e) => ({ com2usId: ctx.monsterById.get(e.monsterId)?.com2usId ?? null,
      unitId: e.unitId ?? null, equipement: e.gear ?? null, leader: false }));
    const connus = monstresConnus(membres.map((m) => m.com2usId), ctx);
    res.push({ cle: 'rta', groupe: im.decks, libelle: im.prepaRta, monstres: connus, raison: connus.length ? null : im.prepaVide, rangement: 'rta',
      creer: (id, tirerUid, maintenant) => equipeDepuisMembres(membres, 'rta', im.prepaRta, 'rta', ctx, id, tirerUid, maintenant, MONSTRES_MAX_PREPA) });
  }

  // Les autres decks enregistrés du jeu (labyrinthe, Cairos, ToA…), rangés
  // dans leur catégorie, groupés par catégorie dans l'ordre des onglets.
  if (!ctx.compte || ctx.decksEnregistres === null) {
    res.push({ cle: 'decks', groupe: im.decks, libelle: im.decks, monstres: [], raison: !ctx.compte ? im.sansCompte : im.reimporter, creer: () => null });
  } else {
    const decks = ctx.decksEnregistres
      .filter((d) => !CONTENUS_DEJA_SOURCES.includes(d.contenu))
      .map((d) => ({ d, onglet: rangementDeck(d) ?? ongletOuvert }));
    const ordre = (o: OngletEquipes) => CATEGORIES_EQUIPES.indexOf(categorieDe(o));
    decks.sort((a, b) => ordre(a.onglet) - ordre(b.onglet));
    for (const { d, onglet } of decks) {
      const nom = libelleDeckEnregistre(d, t);
      const membres: MembreBrut[] = d.slots.flatMap((s, i) => (s ? [{ com2usId: s.com2usId, unitId: s.unitId ?? null, equipement: s.gear ?? null, leader: i === 0 }] : []));
      const connus = monstresConnus(membres.map((m) => m.com2usId), ctx);
      res.push({ cle: `deck:${d.contenu}:${d.deckType}:${d.deckId}`, groupe: t.equipes.categories[categorieDe(onglet)], libelle: nom, monstres: connus,
        raison: raisonDeck(membres, connus, im), rangement: onglet,
        creer: (id, tirerUid, maintenant) => equipeDepuisMembres(membres, onglet, nom, 'deck', ctx, id, tirerUid, maintenant) });
    }
  }

  // Optimizer : une équipe d'une liste.
  const st = optimizer?.stockage;
  if (!optimizer || !st || st.lists.length === 0) {
    res.push({ cle: 'optimizer', groupe: im.optimizer, libelle: im.optimizer, monstres: [], raison: im.aucuneListe, creer: () => null });
    return res;
  }
  for (const liste of st.lists) {
    const equipes = st.teams.filter((e) => e.listId === liste.id);
    const especes = (selectors: ExclusionSelector[]) => selectors
      .map((sel) => resolveExclusionEntry(sel, optimizer.data)?.monster).filter((m): m is Monster => !!m);
    const brouillon = (id: string, equipeId: string, nom: string, maintenant: Date): EquipeEnregistree => ({
      ...creerEquipe(id, ongletOuvert, nom, maintenant), lienOptimizer: { listId: liste.id, equipeId, correspondance: [] } });
    // Un membre que le compte ne résout plus rend la source indisponible, avec sa raison.
    const raisonOptimizer = (equipeId: string) => {
      const r = disponibiliteRetourOptimizer(brouillon('', equipeId, '', new Date(0)), st, optimizer.data);
      return r ? t.equipes.retour.refus[r] : null;
    };
    const creerDepuis = (equipeId: string, nom: string) => (id: string, tirerUid: TirerId, maintenant: Date): ImportEquipeCree | null => {
      const r = creerDepuisEquipeOptimizer({ listId: liste.id, equipeId, nom, onglet: ongletOuvert }, st, optimizer.data, inv, id, tirerUid, maintenant);
      if (typeof r === 'string') return null;
      // Une copie, sans lien : seuls l'export et « Enregistrer dans Mes équipes »
      // de l'Optimizer en posent, pour qu'une équipe de l'Optimizer n'ait
      // qu'une équipe enregistrée qui la suive.
      const { lienOptimizer: _lien, ...equipe } = r.equipe;
      return { equipe: normaliserPrepa({ ...equipe, modifieLe: maintenant.toISOString() }), ignores: 0 };
    };
    // Une équipe à la fois, jamais une liste entière (décision de l'utilisateur) :
    // une liste sans équipe n'est pas une source.
    equipes.forEach((e, i) => {
      const nom = im.equipeListe(liste.name, i + 1);
      res.push({ cle: `optimizer:${liste.id}:${e.id}`, groupe: im.optimizer, libelle: nom, monstres: especes(e.members), raison: raisonOptimizer(e.id), creer: creerDepuis(e.id, nom) });
    });
  }
  if (!res.some((x) => x.groupe === im.optimizer))
    res.push({ cle: 'optimizer', groupe: im.optimizer, libelle: im.optimizer, monstres: [], raison: im.aucuneEquipe, creer: () => null });
  return res;
}

// Le nom d'un deck de l'export : son contenu, son donjon s'il en a un, son
// numéro ; un contenu non relevé se dit par son numéro de type.
export function libelleDeckEnregistre(d: DeckEnregistreImporte, t: Dictionnaire): string {
  const dk = t.equipes.decks;
  const contenu = d.contenu === 'autre' ? dk.autre(d.deckType) : dk.contenus[d.contenu];
  const sous = d.sousContenu ? dk.sousContenus[d.sousContenu] : d.categorie !== null ? dk.categorie(d.categorie) : null;
  return dk.libelle(sous ? `${contenu} — ${sous}` : contenu, d.emplacement);
}
