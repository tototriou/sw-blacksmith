// Le speed tune d'une équipe de l'Optimizer : lecture validée, correspondance
// lignes ↔ membres, stockage et migration des liens avec les membres.
// Spec : docs/02-app/optimizer/feat-contrainte-speed-tune.md, « Membres et
// lignes » et « Persistance ».
import { isDeepStrictEqual } from 'node:util';
import {
  ecrireMembresOptimizer, lireMembresOptimizer, validerEquipesOptimizer, selecteurValide,
} from '../src/lib/optimizerMemberStorage';
import { lireSpeedTuneEquipe, ligneDuMembre, membreDeLaLigne, type SpeedTuneEquipe } from '../src/lib/speedTuneEquipe';
import type { PlanSpeedTune } from '../src/lib/planSpeedTune';
import type { ExclusionSelector } from '../src/lib/optimizerExclusion';
import { egal, ok, titre } from './outils';
import { fr } from '../src/i18n/fr';

const a: ExclusionSelector = { source: 'siege-defense', teamId: 'd1', slotIndex: 0 };
const b: ExclusionSelector = { source: 'siege-defense', teamId: 'd1', slotIndex: 1 };
const c: ExclusionSelector = { source: 'box', unitKey: '77' };

export function plan(): PlanSpeedTune {
  const ligne = (uid: string, camp: 'allie' | 'ennemi', monsterId: number) => ({
    uid, camp, monsterId, runeSpeed: 40, swift: false, artefactBuff: 0, cumulsPassif: 0, lead: 0, atb: {}, speed: { 1: 0 },
  });
  return {
    version: 1,
    lignes: [ligne('allie:1', 'allie', 1), ligne('allie:2', 'allie', 2), ligne('ennemi:3', 'ennemi', 3)],
    choix: { sort: { 'allie:1': 'Vent' } },
    ordre: ['allie:1', 'allie:2'],
    leads: { allie: { amount: 24, area: 'Guild', element: null }, ennemi: null },
    origine: { 'allie:1': { runeSpeed: 40, swift: false, artefactBuff: 0, cumulsPassif: 0 } },
    referenceGains: {},
  };
}
function speedTune(): SpeedTuneEquipe {
  return { plan: plan(), membres: [
    { uid: 'allie:1', selector: a, attache: true, repli: { vitesseMin: 140, effet206: 0 } },
    { uid: 'allie:2', selector: b, attache: false, repli: { vitesseMin: null, effet206: 12 } },
  ] };
}
const lire = (v: unknown) => lireSpeedTuneEquipe(JSON.parse(JSON.stringify(v)), selecteurValide);

export function testSpeedTuneEquipeLecture() {
  titre('Speed tune d’équipe · lecture validée');
  ok(isDeepStrictEqual(lire(speedTune()), speedTune()), 'un speed tune bien formé revient tel quel');
  const perdu = lire({ ...speedTune(), plan: { ...plan(), version: 2 } });
  egal(perdu?.plan, null, 'plan d’une autre version : plan perdu');
  egal(perdu?.membres.length, 2, 'plan perdu : les liens restent');
  egal(lire({ ...speedTune(), plan: { ...plan(), lignes: [...plan().lignes, plan().lignes[0]] } })?.plan, null, 'uid de ligne en double : plan perdu');
  egal(lire({ ...speedTune(), plan: { ...plan(), origine: { inconnue: plan().origine['allie:1'] } } })?.plan, null, 'origine d’une ligne absente : plan perdu');
  const lien = speedTune().membres[0];
  const malformes: [string, unknown][] = [
    ['membres absents', { plan: plan() }],
    ['lien vers une ligne ennemie', { plan: plan(), membres: [{ ...lien, uid: 'ennemi:3' }] }],
    ['lien vers une ligne inconnue', { plan: plan(), membres: [{ ...lien, uid: 'allie:9' }] }],
    ['sélecteur malformé', { plan: plan(), membres: [{ ...lien, selector: { source: 'box' } }] }],
    ['attache non booléen', { plan: plan(), membres: [{ ...lien, attache: 1 }] }],
    ['repli négatif', { plan: plan(), membres: [{ ...lien, repli: { vitesseMin: -1, effet206: 0 } }] }],
    ['206 de repli absent', { plan: plan(), membres: [{ ...lien, repli: { vitesseMin: 100 } }] }],
    ['deux liens sur une ligne', { plan: plan(), membres: [lien, { ...lien, selector: b }] }],
    ['deux lignes pour un membre', { plan: plan(), membres: [lien, { ...lien, uid: 'allie:2' }] }],
  ];
  for (const [nom, v] of malformes) egal(lire(v), null, `${nom} : speed tune écarté`);
  // Sans plan lisible, un lien ne peut pas être confronté à ses lignes : il reste.
  egal(lire({ plan: null, membres: [{ ...lien, uid: 'allie:9' }] })?.membres.length, 1, 'plan perdu : un lien inconnu reste');
}

export function testSpeedTuneEquipeMembres() {
  titre('Speed tune d’équipe · lignes et membres');
  const st = speedTune();
  egal(membreDeLaLigne(st, [a, b], 'allie:1'), a, 'la ligne trouve son membre');
  egal(membreDeLaLigne(st, [a], 'allie:2'), null, 'membre retiré : ligne sans membre');
  egal(membreDeLaLigne(st, [a, b], 'allie:9'), null, 'ligne sans lien : sans membre');
  egal(ligneDuMembre(st, [a, b], b), 'allie:2', 'le membre trouve sa ligne');
  egal(ligneDuMembre(st, [a, b, c], c), null, 'membre sans lien : non contraint');
  egal(ligneDuMembre(st, [a], b), null, 'membre hors de l’équipe : non contraint');
}

function equipe(st: unknown): unknown {
  return { id: 'e1', listId: 'l', members: [a, b], lead: null, speedTune: st };
}

export function testSpeedTuneEquipeStockage() {
  titre('Speed tune d’équipe · stockage des équipes');
  const sans = validerEquipesOptimizer([{ id: 'e0', listId: 'l', members: [a, b], lead: null }], fr);
  ok(!('speedTune' in sans.teams[0]!), 'équipe sans speed tune : lue comme avant, aucun champ ajouté');
  const bien = validerEquipesOptimizer([equipe(speedTune())], fr);
  ok(isDeepStrictEqual(bien.teams[0]!.speedTune, speedTune()) && bien.rapport.length === 0, 'speed tune bien formé : gardé, rien signalé');
  const malforme = validerEquipesOptimizer([equipe({ plan: plan(), membres: 'x' })], fr);
  egal(malforme.teams.length, 1, 'speed tune malformé : l’équipe reste');
  ok(!('speedTune' in malforme.teams[0]!), 'speed tune malformé : écarté de l’équipe');
  egal(malforme.rapport, [fr.optimizer.stockage.speedTuneMalforme(1)], 'speed tune malformé : signalé');
  egal(malforme.rejets.length, 1, 'speed tune malformé : sa valeur brute rejoint les rejets');
  const perdu = validerEquipesOptimizer([equipe({ ...speedTune(), plan: { version: 9 } })], fr);
  egal(perdu.teams[0]!.speedTune?.plan, null, 'plan malformé : plan perdu sur l’équipe');
  egal(perdu.teams[0]!.speedTune?.membres.length, 2, 'plan malformé : liens gardés');
  egal(perdu.rapport, [fr.optimizer.stockage.planSpeedTunePerdu(1)], 'plan malformé : signalé');
  egal(perdu.rejets.length, 1, 'plan malformé : valeur brute dans les rejets');
  // Réécrit `plan: null`, le plan perdu se relit perdu sans ajouter un rejet à chaque lecture.
  const relu = validerEquipesOptimizer(JSON.parse(JSON.stringify(perdu.teams)), fr);
  egal(relu.rejets.length, 0, 'plan déjà perdu : aucun rejet de plus à la relecture');
  egal(relu.rapport, [fr.optimizer.stockage.planSpeedTunePerdu(1)], 'plan déjà perdu : toujours signalé');
  const brut = ecrireMembresOptimizer({ identities: new Map(), memories: new Map(), listContents: new Map(),
    teams: bien.teams, rejets: { memories: [], teams: [], listContents: [] } });
  ok(isDeepStrictEqual(lireMembresOptimizer(brut, fr).teams[0]!.speedTune, speedTune()), 'aller-retour JSON du stockage');
}
