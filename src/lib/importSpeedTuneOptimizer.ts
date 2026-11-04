import type { DeckInitial } from '../hooks/useSpeedTune';
import type { SiegeTeam } from '../types';
import type { ImportOptimizer } from './importEquipes';
import { exclusionSelectorKey, resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData } from './optimizerExclusion';
import { retrouverDeckCompositionOptimizer, selecteurRepliCompositionOptimizer } from './deckCompositionOptimizer';
import type { LeadInfo } from './speed';
import type { Ligne } from './speedTuneLignes';
import { artifactSubName } from './effects';
import type { Dictionnaire } from '../i18n/fr';

export function importerSpeedTuneOptimizer(
  lignes: readonly Ligne[], lead: LeadInfo | null, data: ExclusionSourceData, t: Dictionnaire, deckInitial?: DeckInitial
): ImportOptimizer {
  const m = t.optimizer.importsEquipe;
  const s = m.speedTune;
  const resultat: ImportOptimizer = { nomListe: s.nomListe, contenu: 'guilde', membres: [], equipes: [], ignores: [],
    messages: [s.avertissement] };
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
    resultat.membres.push({ selector: { ...selector }, com2usId: monstre.com2usId, libelle: monstre.name, criteres });
  }
  // La cardinalité se juge dans le consommateur après sa revérification. Le
  // lead reste sur la proposition pour être nommé même si l'équipe est refusée.
  const members = resultat.membres.map(m => m.selector);
  const leader = deck && sourceDeck ? members.find(s => exclusionSelectorKey(s)
    === exclusionSelectorKey({ source: sourceDeck, teamId: deck.id, slotIndex: 0 })) : undefined;
  resultat.equipes.push({ libelle: s.tonEquipe, members, ...(leader ? { leader: { ...leader } } : {}),
    lead: lead ? { stat: 'Attack Speed', amount: lead.amount, area: lead.area, element: lead.element } : null });
  return resultat;
}
