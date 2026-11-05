// Tests de rendu — l'encart « Speed tune » d'un membre contraint
// (`src/components/outils/optimizer/SpeedTuneEncart.tsx`). Le sens, jamais la
// forme : états d'attente, zone, écarts et leurs gestes.
// Spec : docs/02-app/optimizer/feat-contrainte-speed-tune.md, « Écran ».
import SpeedTuneEncart from '../../src/components/outils/optimizer/SpeedTuneEncart';
import type { SpeedTuneDuMembre } from '../../src/hooks/useSpeedTuneMembre';
import type { EtatZone } from '../../src/hooks/useZoneSpeedTune';
import { lignesDeLEquipe, recalculerPlan, type EcartLigne } from '../../src/lib/speedTuneMembre';
import type { ContrainteSpeedTune } from '../../src/lib/contrainteSpeedTune';
import { ok, titre } from '../outils';
import { bouton, rendre, texteVisible } from './outils-rendu';
import { bestiaire, d, sa, sb, sc, speedTune } from '../speed-tune-membre.test';
import { fr } from '../../src/i18n/fr';

const rien = () => {};
const s = fr.optimizer.speedTune;
const contrainte: ContrainteSpeedTune = { version: 1, setsAdmis: [{ will: false, shield: false }], zone: {
  uid: 'allie:9101', base: 105, axeArtefact: true,
  parSwift: [{ swift: false, classes: [{ arteMin: 0, arteMax: 0, intervalles: [[220, 230]] }] }],
} };

function membre(p: { st?: ReturnType<typeof speedTune>; zone?: EtatZone; attache?: boolean; ecarts?: EcartLigne[]; sansPlan?: boolean } = {}) {
  const st = p.st ?? speedTune();
  const plan = p.sansPlan ? null : st.plan;
  const lien = { ...st.membres[0]!, attache: p.attache ?? true };
  const m: SpeedTuneDuMembre = {
    equipe: { id: 'e', listId: 'l', members: [sa, sb, sc], lead: null, speedTune: st }, st, lien, plan,
    lignes: plan ? lignesDeLEquipe(st, plan, [sa, sb, sc], () => null) : [],
    zone: p.zone ?? { etat: 'prete', empreinte: 'x', contrainte }, contrainte: null,
    verdict: { etat: 'tenu' }, ecarts: p.ecarts ?? [], kitsCharges: true, monstres: bestiaire, donnees: d,
  };
  return texteVisible(rendre(<SpeedTuneEncart m={{ ...m, detacher: rien, rattacher: rien, recalculer: rien, restaurer: rien }} monstres={bestiaire} donnees={d} />));
}

export function testRenduSpeedTuneEncart() {
  titre('rendu · Optimizer — encart « Speed tune » d’un membre');
  const pret = membre();
  ok(pret.includes(s.verdictTenu) && pret.includes(s.zoneTitre) && pret.includes(s.sansArtefact), 'zone prête : verdict, zone en clair, classe sans artéfact');
  ok(pret.includes(s.detacher) && !pret.includes(s.rattacher), 'attaché : « Détacher » seul');
  ok(membre({ zone: { etat: 'kits' } }).includes(s.kitsEnCours), 'kits en lecture : dit');
  ok(membre({ zone: { etat: 'calcul', empreinte: 'x' } }).includes(s.zoneEnCours), 'zone en calcul : dit');
  ok(membre({ zone: { etat: 'prete', empreinte: 'x', contrainte: null } }).includes(s.zoneVide), 'zone vide : la recherche ne part pas');
  const detache = membre({ attache: false });
  ok(detache.includes(s.detache) && detache.includes(s.rattacher), 'détaché : dit, « Rattacher » offert');
  ok(membre({ sansPlan: true }).includes(s.planPerdu), 'plan perdu : dit');

  const ecart: EcartLigne = { uid: 'allie:9101', combatPlan: 225, combatOptimizer: 229, artePlan: 0, arteOptimizer: 6, source: 'equipement',
    entrees: { runeSpeed: 104, swift: false, sets: ['violent'], artefactBuff: 6 } };
  const avecEcart = rendre(<SpeedTuneEncart m={{ ...(() => { const st = speedTune(); return {
    equipe: { id: 'e', listId: 'l', members: [sa, sb, sc], lead: null, speedTune: st }, st, lien: st.membres[0]!, plan: st.plan,
    lignes: lignesDeLEquipe(st, st.plan!, [sa, sb, sc], () => null), zone: { etat: 'prete', empreinte: 'x', contrainte } as EtatZone,
    contrainte: null, verdict: { etat: 'tenu' } as const, ecarts: [ecart], kitsCharges: true, monstres: bestiaire, donnees: d,
  }; })(), detacher: rien, rattacher: rien, recalculer: rien, restaurer: rien }} monstres={bestiaire} donnees={d} />);
  ok(!!bouton(avecEcart, s.recalculer('229')), 'écart du membre : « Recalculer avec 229 »');
  ok(texteVisible(avecEcart).includes(s.ecart('M9101', '225', '229', s.sourceEquipement)), 'écart : valeurs du plan et de l’Optimizer, source nommée');

  // Après « Recalculer », l'écart disparaît mais la ligne reste modifiée : « Restaurer » reste offert.
  const recalcule = recalculerPlan(speedTune(), d, bestiaire, [ecart]);
  const apres = membre({ st: recalcule });
  ok(apres.includes(s.modifiee) && apres.includes(s.restaurer), 'ligne du membre recalculée, sans écart : « Restaurer » reste offert');
}
