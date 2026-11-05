import type { DeckInitial } from '../hooks/useSpeedTune';
import type { SiegeTeam } from '../types';
import type { ImportOptimizer } from './importEquipes';
import { exclusionSelectorKey, resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData } from './optimizerExclusion';
import { retrouverDeckCompositionOptimizer, selecteurRepliCompositionOptimizer } from './deckCompositionOptimizer';
import type { LeadInfo } from './speed';
import type { Ligne } from './speedTuneLignes';
import type { Leads } from './speedTuneLignes';
import type { ChoixSorts, DonneesKit } from './speedTuneAuto';
import { planDepuisSpeedTune, planTient, type PlanSpeedTune, type RefusPlan } from './planSpeedTune';
import type { MembreLigne } from './speedTuneEquipe';
import { artifactSubName } from './effects';
import type { Dictionnaire } from '../i18n/fr';

// L'état de l'outil dont l'export photographie le plan
// (feat-contrainte-speed-tune.md, « Le plan de speed tune ») ; absent : export
// sans plan, comme avant.
export interface EtatPlanSpeedTune {
  leads: Leads;
  choix: ChoixSorts;
  ordre: string[];
  donnees: DonneesKit;
  // Le verdict que l'écran affiche (`sequence.ok`), comparé à celui du plan.
  verdictEcran: boolean;
}

// Le refus du constructeur dans les mots du rapport d'export ; repris par
// « Appliquer à l'équipe ».
export function raisonRefus(refus: RefusPlan, lignes: readonly Ligne[], t: Dictionnaire): string {
  const r = t.optimizer.importsEquipe.speedTune.refusPlan;
  const nom = (uid: string) => lignes.find((l) => l.uid === uid)?.monster.name ?? uid;
  switch (refus.motif) {
    case 'ordre-vide': return r.ordreVide;
    case 'ordre-incomplet': return r.ordreIncomplet(refus.manquants.map(nom).join(', '));
    case 'occurrences-inversees': return r.occurrencesInversees(nom(refus.id));
    case 'provenance-inconnue': return r.provenanceInconnue(nom(refus.uid));
    case 'membres-insuffisants': return r.membresInsuffisants;
    case 'ligne-dupliquee': return r.ligneDupliquee(nom(refus.uid));
  }
}

export function importerSpeedTuneOptimizer(
  lignes: readonly Ligne[], lead: LeadInfo | null, data: ExclusionSourceData, t: Dictionnaire, deckInitial?: DeckInitial,
  etatPlan?: EtatPlanSpeedTune
): ImportOptimizer {
  const m = t.optimizer.importsEquipe;
  const s = m.speedTune;
  const resultat: ImportOptimizer = { nomListe: s.nomListe, contenu: 'guilde', membres: [], equipes: [], ignores: [],
    messages: [] };
  const construit = etatPlan ? planDepuisSpeedTune([...lignes], etatPlan.leads, etatPlan.choix, etatPlan.ordre, etatPlan.donnees) : null;
  let plan: PlanSpeedTune | null = construit && 'plan' in construit ? construit.plan : null;
  if (construit && 'refus' in construit) resultat.messages.push(s.sansPlan(raisonRefus(construit.refus, lignes, t), artifactSubName(206, t.jeu)));
  const alliesDuPlan = new Set(plan?.lignes.filter((l) => l.camp === 'allie').map((l) => l.uid) ?? []);
  // Les membres d'une ligne du plan, avec les critères qu'ils reçoivent si le
  // plan tombe faute de deux membres : ils ne se décident qu'après la boucle.
  const liens: { membre: ImportOptimizer['membres'][number]; lien: MembreLigne; sansPlan: ImportOptimizer['membres'][number]['criteres'] }[] = [];
  let deck: SiegeTeam | undefined;
  let sourceDeck: 'siege-defense' | 'siege-offense' | undefined;
  if (deckInitial) {
    const teams = deckInitial.source === 'defense' ? data.siegeDefenseTeams : data.siegeOffenseTeams;
    // Même résolution que l'ouverture du speed tuning depuis un deck.
    deck = teams.find(e => e.id === deckInitial.teamId) ?? teams[Number(deckInitial.teamId)];
    sourceDeck = deckInitial.source === 'defense' ? 'siege-defense' : 'siege-offense';
  } else {
    const composition = lignes.filter(l => l.camp === 'allie').map(l => {
      const monstre = data.monsterById.get(String(l.monster.id));
      return monstre?.com2usId === l.monster.com2usId ? monstre?.com2usId ?? null : null;
    });
    const retrouve = retrouverDeckCompositionOptimizer({ type: 'speed-tuning', composition }, data);
    deck = retrouve?.team;
    sourceDeck = retrouve?.source;
  }
  const slotsUtilises = new Set<number>();
  for (const ligne of lignes) {
    if (ligne.camp !== 'allie') continue;
    const monsterId = String(ligne.monster.id), monstre = data.monsterById.get(monsterId);
    let selector: ExclusionSelector = { source: 'unowned', monsterId };
    const ignorer = (raison: string) => resultat.ignores.push({ selector: { ...selector }, libelle: ligne.monster.name, raison });
    if (!monstre || !Number.isSafeInteger(monstre.com2usId) || monstre.com2usId === null
      || monstre.com2usId <= 0 || monstre.com2usId !== ligne.monster.com2usId) {
      ignorer(m.reco.monstreInconnu);
      continue;
    }
    if (deckInitial && !deck) {
      ignorer(s.deckIntrouvable);
      continue;
    }
    const slotIndex = deck?.slots.findIndex((s, i) => !slotsUtilises.has(i) && s.monsterId !== null
      && data.monsterById.get(s.monsterId)?.com2usId === monstre.com2usId) ?? -1;
    if (deck && sourceDeck && slotIndex >= 0) {
      selector = { source: sourceDeck, teamId: deck.id, slotIndex };
      slotsUtilises.add(slotIndex);
    } else {
      const choisi = selecteurRepliCompositionOptimizer(monsterId, monstre.com2usId, data, 'box');
      if (!choisi) {
        ignorer(s.sansEquipement);
        continue;
      }
      selector = choisi;
      if (deck) resultat.messages.push(s.horsDeck(monstre.name));
    }
    const resolu = resolveExclusionEntry(selector, data);
    if (!resolu || resolu.monster.com2usId !== monstre.com2usId) {
      ignorer(m.exemplaireIntrouvable);
      continue;
    }
    const base = ligne.monster.stats.speed, runeSpeed = ligne.runeSpeed;
    if (runeSpeed === null || base === null || !Number.isFinite(base) || base < 0
      || !Number.isFinite(runeSpeed) || runeSpeed < 0 || !Number.isFinite(base + runeSpeed)) {
      ignorer(s.vitesseNonSaisie);
      continue;
    }
    // La saisie porte déjà Swift à plat, comme la fiche computeStats.
    const criteres: ImportOptimizer['membres'][number]['criteres'] = { vitesse: { minimum: base + runeSpeed } };
    if (ligne.swift) criteres.comboSets = ['swift'];
    else resultat.messages.push(m.aucunSet(monstre.name));
    if (ligne.artefactBuff !== null) {
      if (Number.isFinite(ligne.artefactBuff) && ligne.artefactBuff > 0) {
        criteres.lignesVerrouillees = [{ code: 206, min: ligne.artefactBuff }];
      } else if (!Number.isFinite(ligne.artefactBuff) || ligne.artefactBuff < 0) {
        resultat.messages.push(s.effetVitInvalide(monstre.name, artifactSubName(206, t.jeu)));
      }
    }
    const membre = { selector: { ...selector }, com2usId: monstre.com2usId, libelle: monstre.name, criteres };
    if (alliesDuPlan.has(ligne.uid)) {
      // Attaché, la contrainte remplace la VIT minimum et le verrou 206 ; ils
      // restent comme valeurs de repli, reprises au détachement.
      const effet206 = criteres.lignesVerrouillees?.[0]?.min ?? 0;
      const sansPlan = { ...criteres };
      membre.criteres = { ...criteres };
      delete membre.criteres.vitesse;
      delete membre.criteres.lignesVerrouillees;
      liens.push({ membre, sansPlan, lien: { uid: ligne.uid, selector: { ...selector }, attache: true, repli: { vitesseMin: base + runeSpeed, effet206 } } });
    }
    resultat.membres.push(membre);
  }
  if (plan && liens.length < 2) {
    resultat.messages.push(s.sansPlan(s.refusPlan.membresInsuffisants, artifactSubName(206, t.jeu)));
    for (const l of liens) l.membre.criteres = l.sansPlan;
    plan = null;
  }
  if (plan) {
    resultat.messages.push(s.avertissementPlan);
    const bestiaire = new Map(lignes.map((l) => [l.monster.id, l.monster] as const));
    if (planTient(plan, etatPlan!.donnees, bestiaire).ok !== etatPlan!.verdictEcran) resultat.messages.push(s.verdictDifferent);
  } else resultat.messages.unshift(s.avertissement);
  // La cardinalité se juge dans le consommateur après sa revérification. Le
  // lead reste sur la proposition pour être nommé même si l'équipe est refusée.
  const members = resultat.membres.map(m => m.selector);
  const leader = deck && sourceDeck ? members.find(s => exclusionSelectorKey(s)
    === exclusionSelectorKey({ source: sourceDeck, teamId: deck.id, slotIndex: 0 })) : undefined;
  resultat.equipes.push({ libelle: s.tonEquipe, members, ...(leader ? { leader: { ...leader } } : {}),
    lead: lead ? { stat: 'Attack Speed', amount: lead.amount, area: lead.area, element: lead.element } : null,
    ...(plan ? { speedTune: { plan, membres: liens.map((l) => l.lien) } } : {}) });
  return resultat;
}
