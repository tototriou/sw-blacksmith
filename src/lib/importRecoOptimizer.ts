import { ARTIFACT_KINDS, RECO_STATS, type RecoDeck, type RecoSlot } from '../types';
import type { CriteresPartielsOptimizer } from './criteresOptimizer';
import { retrouverDeckCompositionOptimizer, selecteurRepliCompositionOptimizer } from './deckCompositionOptimizer';
import { artifactSubKinds, artifactSubName, isArtifactSub, SET_BONUS, setsCost, MAX_SET_PIECES } from './effects';
import type { Dictionnaire } from '../i18n/fr';
import type { ImportOptimizer } from './importEquipes';
import { exclusionSelectorKey, resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData } from './optimizerExclusion';

function criteresDuSlot(slot: RecoSlot, libelle: string, messages: string[], t: Dictionnaire): CriteresPartielsOptimizer {
  const m = t.optimizer.importsEquipe.reco;
  const criteres: CriteresPartielsOptimizer = { minStats: {}, comboSets: [], lignesVerrouillees: [] };
  for (const [key, valeur] of Object.entries(slot.stats)) {
    const stat = RECO_STATS.find(s => s.key === key);
    if (!stat || !Number.isFinite(valeur)) {
      messages.push(m.minimumNonImporte(libelle, key));
    } else if (valeur > 0) {
      // La confrontation juge les totaux de fiche, sans soustraire la base.
      if (stat.key === 'spd') criteres.vitesse = { minimum: valeur };
      else criteres.minStats![stat.key] = valeur;
    }
  }
  const premier = slot.setOptions?.[0] ?? [];
  if (premier.some(s => !Object.prototype.hasOwnProperty.call(SET_BONUS, s) || s === 'intangible') || setsCost(premier) > MAX_SET_PIECES) {
    messages.push(m.runageNonImporte(libelle));
  } else criteres.comboSets = [...premier];
  if (!criteres.comboSets!.length) messages.push(t.optimizer.importsEquipe.aucunSet(libelle));
  if (slot.setOptions?.length > 1) messages.push(m.premierRunage(libelle));

  const sortesParCode = new Map<number, Set<string>>();
  for (const { key } of ARTIFACT_KINDS) {
    for (const code of slot.artifacts?.[key] ?? []) {
      // Vérifier le code avant la sorte : le repli d'un code inconnu admet les deux.
      if (!Number.isSafeInteger(code) || !isArtifactSub(code) || !artifactSubKinds(code).includes(key)) {
        messages.push(m.proprieteNonImportee(libelle, code, key));
        continue;
      }
      const sortes = sortesParCode.get(code) ?? new Set<string>();
      sortes.add(key);
      sortesParCode.set(code, sortes);
    }
  }
  for (const [code, sortes] of sortesParCode) {
    // Ces seuils incluent les anciennes lignes ; ils ne sont pas les minima de tirage actuels.
    criteres.lignesVerrouillees!.push({ code, min: code === 218 ? 0.1 : 1 });
    if (sortes.size === 2) messages.push(m.deuxPieces(libelle, artifactSubName(code, t.jeu)));
    else {
      const piece = sortes.has('element') ? m.pieceAttribut : m.pieceType;
      const portee = artifactSubKinds(code).length === 2 ? m.porteeLibre : m.porteeSeule(piece);
      messages.push(m.unePiece(libelle, artifactSubName(code, t.jeu), piece, portee));
    }
  }
  if (criteres.minStats!.res || criteres.minStats!.acc) messages.push(m.resPreFiche(libelle));
  return criteres;
}

export function importerRecoOptimizer(deck: RecoDeck, data: ExclusionSourceData, t: Dictionnaire): ImportOptimizer {
  const m = t.optimizer.importsEquipe.reco;
  const nom = deck.name.trim() || m.deckRecommande;
  const resultat: ImportOptimizer = { nomListe: nom, contenu: 'guilde', membres: [], equipes: [], ignores: [], messages: [] };
  const retrouve = retrouverDeckCompositionOptimizer({ type: 'recommandation', deck }, data);
  const offenseRetenue = retrouve?.source === 'siege-offense' ? retrouve : null;
  const slotsUtilises = new Set<number>();
  const selecteursPris = new Set<string>();
  let leader: ExclusionSelector | undefined;
  deck.slots.forEach((slot, index) => {
    if (slot.com2usId === null) return;
    const monstre = [...data.monsterById.values()].find(m => m.com2usId === slot.com2usId);
    const libelle = monstre?.name ?? (slot.name || m.espece(slot.com2usId));
    let selector: ExclusionSelector = { source: 'unowned', monsterId: String(monstre?.id ?? slot.com2usId) };
    const ignorer = (raison: string) => resultat.ignores.push({ selector: { ...selector }, libelle, raison });
    if (!monstre || !Number.isSafeInteger(slot.com2usId) || slot.com2usId <= 0) {
      ignorer(m.monstreInconnu);
      return;
    }
    const slotIndex = offenseRetenue?.team.slots.findIndex((s, i) => !slotsUtilises.has(i) && s.monsterId !== null
        && data.monsterById.get(s.monsterId)?.com2usId === slot.com2usId);
    if (offenseRetenue && slotIndex !== undefined && slotIndex >= 0) {
      slotsUtilises.add(slotIndex);
      selector = { source: offenseRetenue.source, teamId: offenseRetenue.team.id, slotIndex };
    } else {
      if (offenseRetenue) resultat.messages.push(m.repliCompte(libelle));
      const choisi = selecteurRepliCompositionOptimizer(String(monstre.id), slot.com2usId, data, 'offense', selecteursPris);
      if (!choisi) {
        ignorer(m.aucunExemplaire);
        return;
      }
      selector = choisi;
    }
    const resolu = resolveExclusionEntry(selector, data);
    if (!resolu || resolu.monster.com2usId !== slot.com2usId) {
      ignorer(t.optimizer.importsEquipe.exemplaireIntrouvable);
      return;
    }
    selecteursPris.add(exclusionSelectorKey(selector));
    if (retrouve) {
      // collectOwnedTeams garde le dernier slot résolvable de chaque espèce.
      const slotJuge = retrouve.team.slots.reduce((dernier, s, i) => s.gear && s.monsterId !== null
        && data.monsterById.get(s.monsterId)?.com2usId === slot.com2usId ? i : dernier, -1);
      if (slotJuge >= 0 && exclusionSelectorKey(selector) !== exclusionSelectorKey({ source: retrouve.source, teamId: retrouve.team.id, slotIndex: slotJuge })) {
        resultat.messages.push(m.autreExemplaire(libelle));
      }
    }
    resultat.membres.push({ selector: { ...selector }, com2usId: slot.com2usId, libelle,
      criteres: criteresDuSlot(slot, libelle, resultat.messages, t) });
    if (index === 0) leader = { ...selector };
  });
  const monstreLeader = [...data.monsterById.values()].find(m => deck.slots[0]?.com2usId != null && m.com2usId === deck.slots[0].com2usId);
  resultat.equipes.push({ libelle: nom, members: resultat.membres.map(m => ({ ...m.selector })),
    ...(leader ? { leader } : {}), lead: structuredClone(monstreLeader?.leaderSkill ?? null) });
  return resultat;
}
