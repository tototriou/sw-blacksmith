// Le speed tune d'une équipe lue sur une capture, calculé par le MÊME
// enchaînement que l'outil de l'app (src/hooks/useSpeedTune.ts) : lignes
// vierges, plateau (`plateauDeLignes`, lead filtré par élément), analyse
// automatique avec les kits des monstres (sorts de barre et de buff de
// vitesse, passifs), adversaire de référence compris.
//
// ⚠️ La capture donne la VIT DE COMBAT (lead et totem compris), l'outil part
// de la VIT de runes : on la retrouve par `runeSpeedForTarget`, sans le set
// Rapidité, qu'on ne voit pas. Sans effet sur l'ordre de jeu : la vitesse de
// combat reconstituée est celle lue, au point près.
//
// ⚠️ Les FICHES affichées (base + runes, l'actuelle et celle à viser) sont
// celles du cas le plus DÉFAVORABLE : le set Rapide change d'un point
// d'arrondi la VIT de runes qui donne une VIT de combat, et on ne le voit pas.
// La plus haute des deux déductions, avec et sans lui, donne cette VIT de
// combat dans les deux cas.

import type { Monster } from '../../../src/types';
import { runeSpeedForTarget, siegeLeadFor, speedLeadOf, isSiegeLeadActive, type LeadInfo } from '../../../src/lib/speed';
import { analyseAutomatique, sortRetenu, type DonneesKit } from '../../../src/lib/speedTuneAuto';
import { ligneVierge, plateauDeLignes } from '../../../src/lib/speedTuneLignes';

export interface AttaquantAnalyse {
  monster: Monster;
  combat: number; // VIT de combat lue
  // Cumuls du passif de vitesse, précisés par le joueur (la capture ne les
  // montre pas). Absents : l'analyse les estime, comme l'outil.
  cumuls?: number | null;
  // Effet aug. VIT de ses artéfacts (%), précisé par le joueur. Absent : 0.
  arte?: number | null;
  // En set Rapide : sans effet sur l'ordre, il change la VIT de runes déduite.
  swift?: boolean;
}

export interface LigneResultat {
  monster: Monster;
  combat: number;
  // VIT de fiche : base + runes (ce que montre le monstre hors combat), la VIT
  // de runes déduite de celle lue (lead, totem et set Rapide retirés), au cas
  // le plus défavorable du set Rapide ; `runesRequis` : de même, pour `requis`.
  base: number | null;
  runes: number | null;
  runesRequis: number | null;
  tick: number | null; // tick de son premier tour, `null` s'il ne joue pas dans l'horizon
  // Le sort de vitesse retenu par l'analyse : son numéro (S1, S2…) se lit
  // mieux que son nom, que peu de joueurs connaissent.
  sort: { nom: string; slot: number | null } | null;
  // VIT de combat à atteindre pour ne plus être coupé, dans l'échelle de la VIT
  // LUE (sans le passif, comme l'écran de préparation), `null` si rien à faire
  // ou hors de portée (voir `horsDePortee`).
  requis: number | null;
  horsDePortee: boolean;
}

export interface ResultatSpeedTune {
  lead: { monster: Monster; pourcent: number } | null;
  ok: boolean;
  lignes: LigneResultat[]; // dans l'ordre de jeu
  equipe: Monster[]; // les attaquants dans l'ordre de la capture, leader en premier
  // VIT de combat de l'adversaire de référence : celle du plus rapide, passif
  // compris (Chilling à 367 lu, +20 par cumul, peut devenir le plus rapide).
  reference: number | null;
}

// La VIT de runes qui donne la VIT de combat `cible`, avec ou sans le set
// Rapide : la plus haute des deux.
export function runesAuPire(base: number | null, pourcent: number, cible: number): number | null {
  const sans = runeSpeedForTarget(base, pourcent, cible, false), avec = runeSpeedForTarget(base, pourcent, cible, true);
  return sans === null || avec === null ? null : Math.max(sans, avec);
}

export function analyserEquipe(attaquants: AttaquantAnalyse[], donnees: DonneesKit): ResultatSpeedTune {
  // Le leader est le premier monstre ; son lead ne compte que s'il vaut en
  // siège (pas un lead d'Arène ou de Donjon).
  const infoLead: LeadInfo | null = speedLeadOf(attaquants[0]?.monster);
  const leadActif = isSiegeLeadActive(infoLead) ? infoLead : null;
  const lignes = attaquants.map((a) => {
    const l = ligneVierge(a.monster, 'allie');
    const pourcent = siegeLeadFor(leadActif, a.monster.element);
    return {
      ...l,
      runeSpeed: runeSpeedForTarget(a.monster.stats.speed ?? null, pourcent, a.combat, a.swift ?? false),
      swift: a.swift ?? false,
      ...(a.cumuls != null ? { cumulsPassif: a.cumuls } : {}),
      ...(a.arte != null ? { artefactBuff: a.arte } : {}),
    };
  });
  const plateau = plateauDeLignes(lignes, { allie: leadActif, ennemi: null });
  const r = analyseAutomatique(plateau, 0, donnees);

  const parId = new Map(lignes.map((l, i) => [l.uid, { l, a: attaquants[i], entree: plateau[i] }]));
  const tickDe = new Map(r.ordre.map((o) => [o.id, o.tick]));
  const requisDe = new Map(r.requis.map((q) => [q.id, q]));
  const coupes = new Set(r.verdict.coupes.map((c) => c.id));
  const resultat: LigneResultat[] = [...parId].map(([uid, { a, entree }]) => {
    const q = requisDe.get(uid);
    const coupe = coupes.has(uid);
    // ⚠️ Le moteur raisonne en VIT de combat PASSIF COMPRIS (`combatActuel`,
    // `combatRequis`) ; la capture montre la VIT SANS le passif. On garde donc
    // l'écart du moteur, appliqué à la VIT lue : comparer `combatRequis` à la
    // VIT lue comptait le gain du passif deux fois (Miles à 2 cumuls : « viser
    // 300 » au lieu de 300 moins son gain).
    const ecart = q?.combatRequis != null ? q.combatRequis - q.combatActuel : 0;
    const requis = coupe && ecart > 0 ? a.combat + ecart : null;
    const base = a.monster.stats.speed ?? null;
    const pourcent = siegeLeadFor(leadActif, a.monster.element);
    return {
      monster: a.monster,
      combat: a.combat,
      base,
      runes: runesAuPire(base, pourcent, a.combat),
      runesRequis: requis != null ? runesAuPire(base, pourcent, requis) : null,
      tick: tickDe.get(uid) ?? null,
      sort: (() => {
        const s = sortRetenu(entree, donnees);
        return s ? { nom: s.nom, slot: s.slot } : null;
      })(),
      requis,
      horsDePortee: coupe && q?.combatRequis == null,
    };
  });
  resultat.sort((x, y) => (x.tick ?? Infinity) - (y.tick ?? Infinity));
  return {
    lead: leadActif ? { monster: attaquants[0].monster, pourcent: leadActif.amount } : null,
    ok: r.verdict.ok,
    lignes: resultat,
    equipe: attaquants.map((a) => a.monster),
    reference: r.reference ? (r.combats.get(r.reference.id) ?? null) : null,
  };
}
