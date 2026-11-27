import {
  DEFAULT_DAMAGE_SETUP,
  LEADER_SKILL_VALEURS,
  summonerSkillBonus,
  type DamageSetup,
  type LeaderSkillStat,
} from './damage';
import type { ElementKey, Monster } from '../types';

// Saisie de l'adversaire de la fenêtre « Dégâts réels », en parties : lead,
// stats de base, bonus de runes. Le moteur ne lit que les TOTAUX
// (`enemyHp`, `enemyDef`, `enemyAtk`, `enemySpd`) ; cette saisie les produit.
//
// ⚠️ **Le détail ne remplace pas les totaux, il les écrit.** Le calcul, les
// Workers, le CLI et les recettes lisent toujours les quatre champs `enemy…`,
// inchangés : la saisie en parties n'est qu'une façon de les remplir. Un seul
// producteur, `avecTotauxAdversaire`, appelé par le setter de l'écran
// (useOptimizerState.ts) à CHAQUE changement du réglage : changer le contenu
// des compétences d'invocateur dans « État de mon monstre », ou l'élément
// visé, recalcule les totaux sans que la fenêtre soit ouverte.

export type StatAdversaire = 'hp' | 'def' | 'atk' | 'spd';
export const STATS_ADVERSAIRE: readonly StatAdversaire[] = ['hp', 'def', 'atk', 'spd'];

// Les leads qui changent une stat de l'adversaire lue par le calcul : PV, DEF,
// ATQ, VIT. Le Taux et les Dgts Crit de l'adversaire ne servent à rien ici.
export const STATS_LEAD_ADVERSAIRE: readonly LeaderSkillStat[] = ['HP', 'Attack Power', 'Defense', 'Attack Speed'];
const STAT_DU_LEAD: Partial<Record<LeaderSkillStat, StatAdversaire>> = {
  HP: 'hp',
  'Attack Power': 'atk',
  Defense: 'def',
  'Attack Speed': 'spd',
};

export type ValeursAdversaire = Record<StatAdversaire, number>;

export interface SaisieAdversaire {
  // `id` du monstre importé (liste SWARFARM ou monstre perso), pour son
  // portrait. `null` : stats de base saisies à la main.
  monstreId: string | null;
  base: ValeursAdversaire;
  // Le « + » vert de la fiche du monstre en jeu : une valeur FIXE par stat.
  runes: ValeursAdversaire;
  lead: { stat: LeaderSkillStat; pct: number } | null;
}

export interface DetailStatAdversaire {
  base: number;
  runes: number;
  lead: number;
  invocateur: number;
  total: number;
}

const CHAMP_TOTAL: Record<StatAdversaire, 'enemyHp' | 'enemyDef' | 'enemyAtk' | 'enemySpd'> = {
  hp: 'enemyHp',
  def: 'enemyDef',
  atk: 'enemyAtk',
  spd: 'enemySpd',
};

/** Le total ÉCRIT d'une stat (ATQ et VIT absentes d'une ancienne recette : leur défaut). */
export function totalEcrit(setup: DamageSetup, stat: StatAdversaire): number {
  return setup[CHAMP_TOTAL[stat]] ?? DEFAULT_DAMAGE_SETUP[CHAMP_TOTAL[stat]] ?? 0;
}

/**
 * La saisie en parties du réglage. Sans saisie (ancienne recette, défaut) :
 * chaque total écrit passe dans la colonne des runes, base à 0 et sans lead.
 *
 * ⚠️ **Les runes et non la base** : le lead et les compétences d'invocateur
 * s'appliquent à la base. Ranger l'ancien total dans la base le majorerait
 * d'au moins 15 % au premier changement — l'ancienne valeur doit rester
 * exactement celle qui était saisie.
 */
export function saisieAdversaireDe(setup: DamageSetup): SaisieAdversaire {
  if (setup.adversaire) return setup.adversaire;
  const runes = { hp: 0, def: 0, atk: 0, spd: 0 };
  for (const s of STATS_ADVERSAIRE) runes[s] = totalEcrit(setup, s);
  return { monstreId: null, base: { hp: 0, def: 0, atk: 0, spd: 0 }, runes, lead: null };
}

/**
 * Base, runes, part du lead, part des compétences d'invocateur et total, par
 * stat. Lead et compétences d'invocateur sont des pourcentages de la BASE,
 * comme pour le monstre optimisé (`summonerSkillBonus`) ; l'adversaire est
 * dans le même contenu que lui (normal ou guilde), et l'ATQ élémentaire ne
 * compte que si son élément est connu.
 */
export function detailAdversaire(
  saisie: SaisieAdversaire,
  summonerSkills: DamageSetup['summonerSkills'],
  element: ElementKey | null
): Record<StatAdversaire, DetailStatAdversaire> {
  const invoc = summonerSkillBonus(summonerSkills, element);
  const leadSur = saisie.lead ? STAT_DU_LEAD[saisie.lead.stat] : undefined;
  const sortie = {} as Record<StatAdversaire, DetailStatAdversaire>;
  for (const s of STATS_ADVERSAIRE) {
    const base = saisie.base[s];
    const runes = saisie.runes[s];
    const lead = saisie.lead && leadSur === s ? (base * saisie.lead.pct) / 100 : 0;
    const invocateur = (base * invoc.pct[s]) / 100;
    sortie[s] = { base, runes, lead, invocateur, total: Math.round(base + runes + lead + invocateur) };
  }
  return sortie;
}

/**
 * Le réglage dont les totaux `enemy…` sont ceux de sa saisie. Sans saisie,
 * le réglage est rendu tel quel : les totaux restent ceux qu'on a écrits.
 */
export function avecTotauxAdversaire(setup: DamageSetup): DamageSetup {
  if (!setup.adversaire) return setup;
  const detail = detailAdversaire(setup.adversaire, setup.summonerSkills, setup.enemyElement ?? null);
  let change = false;
  const suivant: DamageSetup = { ...setup };
  for (const s of STATS_ADVERSAIRE) {
    if (suivant[CHAMP_TOTAL[s]] !== detail[s].total) {
      suivant[CHAMP_TOTAL[s]] = detail[s].total;
      change = true;
    }
  }
  return change ? suivant : setup;
}

/**
 * Importer un monstre : ses stats de base, son portrait et son élément.
 * Les runes et le lead saisis restent : le lead vient du chef de l'équipe
 * adverse, pas du monstre visé.
 *
 * ⚠️ **Sauf les « runes » d'un réglage sans saisie** : ce sont les anciens
 * TOTAUX (`saisieAdversaireDe`), pas des bonus de runes. Les garder en
 * ajoutant la base compterait l'adversaire deux fois (40 000 PV + la base
 * du monstre) : l'import part alors de runes à 0.
 */
export function importerMonstreAdversaire(setup: DamageSetup, monstre: Monster): Partial<DamageSetup> {
  const saisie = saisieAdversaireDe(setup);
  const st = monstre.stats;
  return {
    adversaire: {
      ...saisie,
      runes: setup.adversaire ? saisie.runes : { hp: 0, def: 0, atk: 0, spd: 0 },
      monstreId: String(monstre.id),
      base: { hp: st.hp ?? 0, def: st.defense ?? 0, atk: st.attack ?? 0, spd: st.speed ?? 0 },
    },
    ...(monstre.element !== 'unknown' ? { enemyElement: monstre.element } : {}),
  };
}

/** Une valeur saisie (base ou runes) d'une stat. */
export function avecValeurAdversaire(
  setup: DamageSetup,
  colonne: 'base' | 'runes',
  stat: StatAdversaire,
  valeur: number
): Partial<DamageSetup> {
  const saisie = saisieAdversaireDe(setup);
  return { adversaire: { ...saisie, [colonne]: { ...saisie[colonne], [stat]: Math.max(0, valeur) } } };
}

/** Le lead de l'équipe adverse ; `null` : aucun. Un type changé repart sur son premier palier. */
export function avecLeadAdversaire(setup: DamageSetup, lead: { stat: LeaderSkillStat; pct?: number } | null): Partial<DamageSetup> {
  const saisie = saisieAdversaireDe(setup);
  return {
    adversaire: {
      ...saisie,
      lead: lead ? { stat: lead.stat, pct: lead.pct ?? LEADER_SKILL_VALEURS[lead.stat][0] } : null,
    },
  };
}
