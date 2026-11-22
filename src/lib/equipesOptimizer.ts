import type { ElementKey, LeaderSkill } from '../types';
import type { ContenuDeck } from './importAccount';
import type { Dictionnaire } from '../i18n/fr';
import { appliquerCriteres, baseCompleteCriteres, type LeadEffectifOptimizer } from './criteresOptimizer';
import { LEADER_SKILL_STATS, type DamageSetup, type LeaderSkillStat } from './damage';
import { exclusionSelectorKey, findValidatedBuild, resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData, type ValidatedBuild } from './optimizerExclusion';
import {
  MEMBRES_MAX_EQUIPE_OPTIMIZER, MEMBRES_MIN_EQUIPE_OPTIMIZER, cleMemoireMembre, enregistrerMemoireMembre, validerEquipesOptimizer,
  type ContenuListeOptimizer, type EquipeOptimizer, type StockageOptimizer,
} from './optimizerMemberStorage';

type PorteeLead = 'General' | 'Element' | 'Arena' | 'Guild' | 'Dungeon';
type ActiviteLead = 'actif' | 'element' | 'inactif';

// Chaque case suit la table de contenu de combat de la spec :
// docs/02-app/optimizer/feat-listes-equipes-et-sauvegarde.md § Lead effectif d’un membre.
export const ACTIVITE_LEADS_OPTIMIZER = {
  guilde: {
    General: 'actif',
    Element: 'element',
    Arena: 'inactif',
    Guild: 'actif',
    Dungeon: 'inactif',
  },
  arene: {
    General: 'actif',
    Element: 'element',
    Arena: 'actif',
    Guild: 'inactif',
    Dungeon: 'inactif',
  },
  donjon: {
    General: 'actif',
    Element: 'element',
    Arena: 'inactif',
    Guild: 'inactif',
    Dungeon: 'actif',
  },
  // ToA et temple du chaos : aucun lead de zone, seulement les leads globaux
  // et élémentaires (relevé de l'utilisateur, 2026-11-22).
  autre: {
    General: 'actif',
    Element: 'element',
    Arena: 'inactif',
    Guild: 'inactif',
    Dungeon: 'inactif',
  },
} as const satisfies Record<ContenuListeOptimizer, Record<PorteeLead, ActiviteLead>>;

// Le lead qui agit dans chaque contenu du jeu, désigné par le contenu de liste
// de l'Optimizer qui l'applique : relevé de l'utilisateur, en jeu, le
// 2026-11-22 (docs/02-app/optimizer/feat-listes-equipes-et-sauvegarde.md
// § Lead par contenu du jeu). Lead d'arène : arène (et arène de serveur,
// arène dimensionnelle), RTA. Lead de guilde : siège, guerre de guilde, tout le
// labyrinthe, subjugation. Lead de donjon : donjons de Cairos, faille et raid
// des mondes, passage des dimensions et ses raids. Aucun lead de zone
// (`autre`, leads globaux et élémentaires seuls) : tribunal d'ascension et
// tours, temple du chaos.
// ⚠️ `null` : NON RELEVÉ, jamais déduit d'un contenu qui ressemble ; seul un
// type de deck inconnu (`autre`) l'est.
export const CONTENU_LEADS_JEU = {
  'arene-offense': 'arene',
  'guerre-guilde-offense': 'guilde',
  'siege-offense': 'guilde',
  'labyrinthe-normal': 'guilde', 'labyrinthe-sauvetage': 'guilde', 'labyrinthe-temps-limite': 'guilde',
  'labyrinthe-boss': 'guilde', 'labyrinthe-temps-pause': 'guilde', 'labyrinthe-vitesse-limitee': 'guilde',
  'labyrinthe-explosion': 'guilde',
  subjugation: 'guilde',
  cairos: 'donjon',
  'faille-mondes': 'donjon',
  'raid-mondes': 'donjon',
  'passage-dimensions': 'donjon', 'raid-dimensionnel-1': 'donjon', 'raid-dimensionnel-2': 'donjon', 'raid-dimensionnel-3': 'donjon',
  'tribunal-ascension': 'autre', 'tour-eau': 'autre', 'tour-feu': 'autre', 'tour-vent': 'autre', 'tour-lumiere': 'autre',
  'tour-tenebres': 'autre', 'tour-celeste': 'autre',
  'temple-chaos': 'autre',
  autre: null,
} as const satisfies Record<ContenuDeck, ContenuListeOptimizer | null>;

// La raison d'un lead d'équipe sans effet ; sa phrase, dans chaque langue, est
// sous `optimizer.motifsLead` du dictionnaire.
export type MotifLeadOptimizer =
  | 'contenuNonDefini'
  | 'sansLead'
  | 'porteeInconnue'
  | 'porteeInactive'
  | 'autreElement'
  | 'statSansEffet'
  | 'montantInvalide';

// Compatible avec appliquerCriteres ; tout « aucun » porte sa raison.
export type LeadMembreOptimizer = Exclude<LeadEffectifOptimizer, { type: 'aucun' }> | { type: 'aucun'; motif: MotifLeadOptimizer };
const aucun = (motif: MotifLeadOptimizer): LeadMembreOptimizer => ({ type: 'aucun', motif });

// ⚠️ « État de mon monstre » n'affiche JAMAIS le motif d'une liste sans contenu
// de combat (décision de l'utilisateur, « Je ne veux jamais le voir ») : la
// carte passe par `motifLeadAffiche`. Le motif reste porté par le lead
// effectif (repère ⚠ de la liste, rapport d'import).
export const motifLeadAffiche = (motif: MotifLeadOptimizer | null | undefined): MotifLeadOptimizer | null =>
  motif && motif !== 'contenuNonDefini' ? motif : null;
const memeMembre = (a: ExclusionSelector, b: ExclusionSelector): boolean => exclusionSelectorKey(a) === exclusionSelectorKey(b);

export function leadEffectifMembreOptimizer(
  stockage: Pick<StockageOptimizer, 'teams' | 'listContents'>, listId: string, selector: ExclusionSelector, element: ElementKey
): LeadMembreOptimizer {
  const equipe = stockage.teams.find(e => e.listId === listId && e.members.some(s => memeMembre(s, selector)));
  if (!equipe) return { type: 'personnel' };
  const contenu = stockage.listContents.get(listId);
  if (!contenu) return aucun('contenuNonDefini');
  const lead = equipe.lead;
  if (!lead) return aucun('sansLead');
  const ligne = ACTIVITE_LEADS_OPTIMIZER[contenu] as Record<string, ActiviteLead> | undefined;
  const activite = ligne && Object.prototype.hasOwnProperty.call(ligne, lead.area) ? ligne[lead.area] : undefined;
  if (!activite) return aucun('porteeInconnue');
  if (activite === 'inactif') return aucun('porteeInactive');
  if (activite === 'element' && (!lead.element || lead.element !== element)) return aucun('autreElement');
  // damage.ts : RES et Précision n’entrent pas dans les stats de lead calculées.
  if (!LEADER_SKILL_STATS.includes(lead.stat as LeaderSkillStat)) return aucun('statSansEffet');
  if (!Number.isFinite(lead.amount) || lead.amount < 0) return aucun('montantInvalide');
  return { type: 'equipe', lead: { stat: lead.stat as LeaderSkillStat, pct: lead.amount } };
}

export const memeLeadOptimizer = (a: DamageSetup, b: DamageSetup): boolean =>
  a.leaderSkill?.stat === b.leaderSkill?.stat && a.leaderSkill?.pct === b.leaderSkill?.pct && a.leaderSpeedPct === b.leaderSpeedPct;

/**
 * Le lead personnel d'un membre d'équipe est écrasé par son lead effectif,
 * « aucun » compris, et le reste quand le membre quitte l'équipe : rien ne
 * le restaure. Un membre sans mémoire en reçoit une depuis la base complète,
 * comme à l'import. Les mémoires restent la même référence si rien ne change.
 */
export function synchroniserLeadsMembresOptimizer(
  stockage: Pick<StockageOptimizer, 'teams' | 'listContents' | 'members' | 'memories' | 'identities'>,
  listId: string, data: ExclusionSourceData, t: Dictionnaire
): { memories: StockageOptimizer['memories']; ecrits: ExclusionSelector[] } {
  let memories = stockage.memories;
  const ecrits: ExclusionSelector[] = [];
  for (const selector of stockage.teams.filter(e => e.listId === listId).flatMap(e => e.members)) {
    const cle = cleMemoireMembre(listId, selector), resolu = resolveExclusionEntry(selector, data);
    const com2usId = resolu?.monster.com2usId, identite = stockage.identities.get(cle), memoire = memories.get(cle);
    // Un exemplaire qui a changé d'espèce garde sa mémoire sans application.
    if (!resolu || !com2usId || !stockage.members.some(m => m.listId === listId && memeMembre(m.selector, selector))
      || (identite && identite.com2usId !== com2usId) || (memoire && memoire.com2usId !== com2usId)) continue;
    const suivante = appliquerCriteres(memoire?.criteres ?? baseCompleteCriteres(resolu.gear),
      leadEffectifMembreOptimizer(stockage, listId, selector, resolu.monster.element));
    if (memoire && memeLeadOptimizer(memoire.criteres.damageSetup, suivante.damageSetup)) continue;
    const ecriture = enregistrerMemoireMembre(memories, { listId, selector, com2usId }, suivante, data, t);
    if (ecriture.rapport.length) continue;
    memories = ecriture.memories;
    ecrits.push(selector);
  }
  return { memories, ecrits };
}

export type ContexteEquipesOptimizer = Pick<StockageOptimizer, 'lists' | 'members' | 'teams'>;
export interface CreationEquipeOptimizer {
  id: string;
  listId: string;
  members: ExclusionSelector[];
  leader?: ExclusionSelector;
  lead?: LeaderSkill | null;
}
export interface ResultatEquipesOptimizer {
  teams: EquipeOptimizer[];
  rapport: string[];
}

function accepterEquipes(contexte: ContexteEquipesOptimizer, teams: EquipeOptimizer[], t: Dictionnaire): ResultatEquipesOptimizer {
  const validation = validerEquipesOptimizer(teams, t);
  if (validation.rejets.length) return { teams: contexte.teams, rapport: validation.rapport };
  for (const equipe of teams) {
    if (!contexte.lists.some(l => l.id === equipe.listId)
      || equipe.members.some(s => !contexte.members.some(m => m.listId === equipe.listId && memeMembre(m.selector, s)))) {
      return { teams: contexte.teams, rapport: [t.optimizer.rapportsEquipe.listeIntrouvable] };
    }
  }
  // Les données acceptées sont détachées : un éditeur ne peut muter le stockage reçu.
  return { teams: structuredClone(validation.teams), rapport: [] };
}

export function creerEquipeOptimizer(contexte: ContexteEquipesOptimizer, creation: CreationEquipeOptimizer, t: Dictionnaire): ResultatEquipesOptimizer {
  const equipe: EquipeOptimizer = { ...creation, lead: creation.lead ?? null };
  // Une création ne revérifie pas les références des équipes conservées :
  // une liste ou un membre ancien disparu ne doit pas bloquer la nouvelle équipe.
  const resultat = accepterEquipes(contexte, [equipe], t);
  if (resultat.rapport.length) return resultat;
  if (contexte.teams.some(e => e.id === equipe.id
    || (e.listId === equipe.listId && e.members.some(s => equipe.members.some(m => memeMembre(s, m)))))) {
    return { teams: contexte.teams, rapport: [t.optimizer.rapportsEquipe.dejaAffecte] };
  }
  return { teams: [...contexte.teams, ...resultat.teams], rapport: [] };
}

export function ajouterMembreEquipeOptimizer(
  contexte: ContexteEquipesOptimizer, equipeId: string, selector: ExclusionSelector, t: Dictionnaire
): ResultatEquipesOptimizer {
  const equipe = contexte.teams.find(e => e.id === equipeId);
  if (!equipe) return { teams: contexte.teams, rapport: [t.optimizer.rapportsEquipe.introuvableAjout] };
  return modifierEquipeOptimizer(contexte, { ...equipe, members: [...equipe.members, selector] }, t);
}

/** Valider seulement la cible, tout en contrôlant les collisions avec les équipes conservées. */
export function modifierEquipeOptimizer(contexte: ContexteEquipesOptimizer, equipe: EquipeOptimizer, t: Dictionnaire): ResultatEquipesOptimizer {
  if (!contexte.teams.some(e => e.id === equipe.id && e.listId === equipe.listId)) {
    return { teams: contexte.teams, rapport: [t.optimizer.rapportsEquipe.introuvable] };
  }
  const resultat = creerEquipeOptimizer({ ...contexte, teams: contexte.teams.filter(e => e.id !== equipe.id) }, equipe, t);
  if (resultat.rapport.length) return { teams: contexte.teams, rapport: resultat.rapport };
  const valide = resultat.teams.find(e => e.id === equipe.id)!;
  return { teams: contexte.teams.map(e => e.id === equipe.id ? valide : e), rapport: [] };
}

export function retirerMembreEquipeOptimizer(
  teams: EquipeOptimizer[], equipeId: string, selector: ExclusionSelector, t: Dictionnaire
): ResultatEquipesOptimizer {
  const r = t.optimizer.rapportsEquipe;
  const equipe = teams.find(e => e.id === equipeId);
  if (!equipe || !equipe.members.some(s => memeMembre(s, selector))) return { teams, rapport: [r.membreIntrouvable] };
  const members = equipe.members.filter(s => !memeMembre(s, selector));
  if (members.length < 2) return { teams: teams.filter(e => e.id !== equipeId), rapport: [r.dissouteMoinsDeDeux] };
  const { leader, ...reste } = equipe;
  const nouvelle = { ...reste, members, ...(leader && !memeMembre(leader, selector) ? { leader } : {}) };
  return { teams: structuredClone(teams.map(e => e.id === equipeId ? nouvelle : e)), rapport: [] };
}

export function delierMembreOptimizer(teams: EquipeOptimizer[], listId: string, selector: ExclusionSelector, t: Dictionnaire): ResultatEquipesOptimizer {
  const equipe = teams.find(e => e.listId === listId && e.members.some(s => memeMembre(s, selector)));
  return equipe ? retirerMembreEquipeOptimizer(teams, equipe.id, selector, t) : { teams, rapport: [t.optimizer.rapportsEquipe.sansEquipe] };
}

export function dissoudreEquipeOptimizer(teams: EquipeOptimizer[], equipeId: string, t: Dictionnaire): ResultatEquipesOptimizer {
  const r = t.optimizer.rapportsEquipe;
  return teams.some(e => e.id === equipeId)
    ? { teams: teams.filter(e => e.id !== equipeId), rapport: [r.dissoute] }
    : { teams, rapport: [r.introuvableDissolution] };
}

export function equipeApresFiltrageOptimizer(
  contexte: ContexteEquipesOptimizer, creation: CreationEquipeOptimizer, t: Dictionnaire
): { equipe: EquipeOptimizer | null; rapport: string[] } {
  const r = t.optimizer.rapportsEquipe;
  const nombre = creation.members.length;
  if (nombre < MEMBRES_MIN_EQUIPE_OPTIMIZER || nombre > MEMBRES_MAX_EQUIPE_OPTIMIZER) {
    const raison = nombre === 0 ? r.aucunMembre : nombre === 1 ? r.unSeulMembre : r.plusDeSix;
    return { equipe: null, rapport: [`${raison} ${r.aucuneEquipeCreee}`] };
  }
  const resultat = creerEquipeOptimizer(contexte, creation, t);
  if (resultat.rapport.length) return { equipe: null, rapport: [...resultat.rapport, r.aucuneEquipeCreee] };
  return { equipe: resultat.teams.find(e => e.id === creation.id)!, rapport: [] };
}

// « Enregistrer dans Mes équipes » depuis la bande d'une équipe : au moins un
// membre a des runes validées dans la liste (décision de l'utilisateur) — sans
// quoi l'enregistrement ne porterait aucun build de l'Optimizer. Les autres
// membres gardent leur équipement (`preparerRetourOptimizer`).
export function equipeARunesValidees(equipe: Pick<EquipeOptimizer, 'listId' | 'members'>, validated: ValidatedBuild[]): boolean {
  return equipe.members.some((s) => {
    const build = findValidatedBuild(validated, equipe.listId, exclusionSelectorKey(s));
    return !!build && build.runeIds.length > 0;
  });
}
