// Construction d'un deck de recommandation à partir d'une équipe existante :
// une équipe de siège (offense) ou une équipe de « Mes équipes ». Les deux
// portent l'équipement de chaque monstre : on peut donc pré-remplir les stats
// RÉELLES du build, que l'auteur ajuste ensuite. Calcul pur.

import {
  ArtifactKind,
  GearSet,
  MAX_ARTIFACT_SUBS,
  Monster,
  RecoDeck,
  RecoSlot,
  RecoStatKey,
  SiegeTeam,
  emptyRecoArtifacts,
  emptyRecoSlot,
} from '../types';
import { computeStats } from './stats';
import { activeSets, canAddSet, isArtifactSub } from './effects';
import { estPrepa, type EquipeEnregistree } from './equipesEnregistrees';

// Stats totales d'un gear → minimums recommandés. On ne garde que les valeurs
// > 0 (une stat à 0, comme la précision d'un build sans précision, n'a rien à
// faire dans une recommandation).
function statsFromGear(gear: GearSet | null | undefined): Partial<Record<RecoStatKey, number>> {
  const out: Partial<Record<RecoStatKey, number>> = {};
  if (!gear) return out;
  // `computeStats` renvoie déjà des entiers (arrondis au supérieur) : rien à
  // réarrondir ici, sous peine d'introduire un second arrondi.
  for (const row of computeStats(gear)) {
    if (row.total > 0) out[row.key as RecoStatKey] = row.total;
  }
  return out;
}

// Des sets ACTIFS, repris tels quels en respectant la limite de 6 runes par
// sécurité. Ceux d'un slot de siège sont calculés à l'import ; ceux d'un
// équipement enregistré se déduisent de ses runes.
function setsRetenus(sets: readonly string[]): string[] {
  const out: string[] = [];
  for (const key of sets) {
    if (canAddSet(out, key)) out.push(key);
  }
  return out;
}

// Propriétés secondaires réellement portées par les artéfacts du build de
// siège. Comme les stats, elles sont reprises TELLES QUELLES : l'auteur retire
// ensuite ce qui n'est pas déterminant. Pré-remplir puis élaguer demande moins
// de travail que retrouver huit lignes dans une liste de 45.
function artifactsFromGear(gear: GearSet | null | undefined): Record<ArtifactKind, number[]> {
  const out = emptyRecoArtifacts();
  for (const art of gear?.artifacts ?? []) {
    for (const sub of art.subs) {
      if (!isArtifactSub(sub.code) || out[art.kind].includes(sub.code)) continue;
      if (out[art.kind].length >= MAX_ARTIFACT_SUBS) break;
      out[art.kind].push(sub.code);
    }
  }
  return out;
}

// Une équipe de siège → un deck de recommandation (mêmes positions, slot 0 =
// leader). Un monstre absent des données chargées ou sans `com2usId` (monstre
// perso, non partageable) laisse le slot vide.
//
// Le `name` reste VIDE : le nom affiché est alors dérivé des monstres du deck
// (« Trevor - Bella - Loren »). L'auteur peut le remplacer s'il le souhaite.
export function deckFromSiegeTeam(team: SiegeTeam, monsterById: Map<string, Monster>): RecoDeck {
  const slots: RecoSlot[] = team.slots.map((slot) => {
    const monster = slot.monsterId ? monsterById.get(slot.monsterId) : null;
    if (!monster || monster.com2usId == null) return emptyRecoSlot();
    return {
      com2usId: monster.com2usId,
      name: monster.name,
      stats: statsFromGear(slot.gear),
      // Une seule possibilité au départ : l'auteur en ajoute s'il veut.
      setOptions: [setsRetenus(slot.sets ?? [])],
      artifacts: artifactsFromGear(slot.gear),
    };
  });
  // ⚠️ Aucune défense visée : une équipe d'offense dit ce qu'on JOUE, jamais
  // contre quoi. L'information n'existe nulle part dans l'export du jeu — c'est
  // à l'auteur de la poser, s'il la connaît.
  return { name: '', note: '', slots, counters: [] };
}

// Une équipe de « Mes équipes » → un deck de recommandation. Le leader de
// l'équipe passe en tête (le slot 0 d'un deck porte le lead), puis les autres
// dans l'ordre de l'équipe ; un deck de siège compte TROIS monstres : au-delà
// (une équipe d'arène en a quatre), les suivants ne sont pas repris. Un monstre
// absent des données chargées laisse le slot vide. Aucune défense visée,
// comme pour une équipe de siège.
export function deckFromEquipeEnregistree(e: EquipeEnregistree, monsterByCom2us: Map<number, Monster>): RecoDeck {
  const ordre = e.leader
    ? [...e.monstres.filter((m) => m.uid === e.leader), ...e.monstres.filter((m) => m.uid !== e.leader)]
    : e.monstres;
  const slots: RecoSlot[] = ordre.slice(0, 3).map((m) => {
    const monster = monsterByCom2us.get(m.com2usId);
    if (!monster || monster.com2usId == null) return emptyRecoSlot();
    return {
      com2usId: monster.com2usId,
      name: monster.name,
      stats: statsFromGear(m.equipement),
      setOptions: [setsRetenus(activeSets(m.equipement?.runes.map((r) => r.set) ?? []))],
      artifacts: artifactsFromGear(m.equipement),
    };
  });
  while (slots.length < 3) slots.push(emptyRecoSlot());
  return { name: '', note: '', slots, counters: [] };
}

// Les équipes de « Mes équipes » proposables comme point de départ d'un
// deck : pas les prépas RTA (un ensemble de monstres, pas une équipe), et au
// moins un monstre connu.
export function equipeProposable(e: EquipeEnregistree, monsterByCom2us: Map<number, Monster>): boolean {
  return !estPrepa(e.onglet) && e.monstres.some((m) => monsterByCom2us.has(m.com2usId));
}

// Résumé d'une équipe pour le sélecteur (« Trevor · Bella · Loren ») ; `vide`
// nomme une équipe sans monstre, dans la langue affichée.
export function teamSummary(team: SiegeTeam, monsterById: Map<string, Monster>, vide: string): string {
  const noms = team.slots
    .map((s) => (s.monsterId ? monsterById.get(s.monsterId)?.name : null))
    .filter((n): n is string => !!n);
  return noms.length ? noms.join(' · ') : vide;
}

// Une équipe est proposable si elle contient au moins un monstre partageable.
export function isTeamUsable(team: SiegeTeam, monsterById: Map<string, Monster>): boolean {
  return team.slots.some((s) => {
    const m = s.monsterId ? monsterById.get(s.monsterId) : null;
    return !!m && m.com2usId != null;
  });
}
