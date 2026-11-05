// Le plan de speed tune (src/lib/planSpeedTune.ts) : projection fidèle à
// l'écran, refus, zone contre balayage brut, préconditions des cumuls.
// Spec : docs/02-app/optimizer/feat-contrainte-speed-tune.md.

import type { Monster } from '../src/types';
import { diagnostiquerSequence, simuler, ARTE_MAX } from '../src/lib/speedTune';
import { analyseAutomatique, type DonneesKit } from '../src/lib/speedTuneAuto';
import type { SortVitesse } from '../src/lib/speedTuneKit';
import type { PassifVitesse } from '../src/lib/speedTunePassif';
import {
  appliquerMods,
  ligneVierge,
  modifierMod,
  plateauDeLignes,
  tuneDe,
  type Leads,
  type Ligne,
} from '../src/lib/speedTuneLignes';
import { arteAdmissibles, dansZone, enveloppeZone } from '../src/lib/contrainteSpeedTune';
import {
  classesArtefact,
  contexteTenu,
  cumulsEnDefaut,
  entreesDeBuild,
  planDepuisSpeedTune,
  planTient,
  plateauDuPlan,
  zoneMembre,
  type EntreesLigne,
  type PlanSpeedTune,
} from '../src/lib/planSpeedTune';
import { egal, ok, titre } from './outils';

const monstre = (id: number, nom: string, spd: number): Monster =>
  ({ id, com2usId: id, name: nom, element: 'wind', stats: { speed: spd } }) as unknown as Monster;

const sort = (nom: string, effet: SortVitesse['effet'], cooldown = 0, buffsEquipe = 0): SortVitesse => ({
  nom, slot: 3, icone: null, effet, rejoue: false, cooldown,
  atbNiveau1: 0, atbSkillUp: 0, chance: null, neutre: false, buffsEquipe,
});

export const passifChilling: PassifVitesse = {
  nom: 'Cumuls', texte: '', amplifieBuff: null,
  gain: { valeur: 20, pourcent: false, plafond: null, parCumul: true, cumulEquipe: false, releve: true },
  buff: false, barre: null, tourSupp: false, inconnu: false,
};

// Un lanceur de buff (A), deux alliés, un adversaire. A pose +30 % de vitesse
// à l'équipe et +15 % de barre (rechargement 3).
const A = monstre(9001, 'Lanceur', 105);
const B = monstre(9002, 'Second', 100);
const C = monstre(9003, 'Troisième', 102);
const E = monstre(9004, 'Adverse', 110);
const donnees: DonneesKit = {
  kits: new Map(),
  sorts: new Map([[9001, [sort('Vent', { buffEquipe: 30, atbEquipe: 15 }, 3, 1)]]]),
  passifs: new Map(),
};
const bestiaire = new Map([A, B, C, E].map((m) => [m.id, m] as const));
const leads: Leads = { allie: null, ennemi: null };

function lignesDe(spd: { a: number; b: number; c: number; e: number }, artB = 0): Ligne[] {
  return [
    { ...ligneVierge(A, 'allie'), runeSpeed: spd.a },
    { ...ligneVierge(B, 'allie'), runeSpeed: spd.b, artefactBuff: artB },
    { ...ligneVierge(C, 'allie'), runeSpeed: spd.c },
    { ...ligneVierge(E, 'ennemi'), runeSpeed: spd.e },
  ];
}
const choix = { sort: { 'allie:9001': 'Vent', 'allie:9002': '', 'allie:9003': '' } };
const ordre = ['allie:9001', 'allie:9002', 'allie:9003'];

// L'état de l'écran après « Analyser » : grilles écrites, provenance marquée.
function analysees(lignes: Ligne[]): Ligne[] {
  const r = analyseAutomatique(plateauDeLignes(lignes, leads), 0, donnees, { choix });
  return appliquerMods(lignes, r.mods);
}

function planDe(lignes: Ligne[], o = ordre): PlanSpeedTune {
  const r = planDepuisSpeedTune(lignes, leads, choix, o, donnees);
  if (!('plan' in r)) throw new Error('plan refusé : ' + JSON.stringify(r.refus));
  return r.plan;
}

// ⚠️ À entrées inchangées depuis l'analyse, le plan juge ce que l'écran juge,
// tick pour tick : mêmes actions, même verdict.
export function testPlanSpeedTuneFideleEcran() {
  titre('Plan de speed tune — fidèle à l’écran');
  let accords = 0;
  let tenus = 0;
  for (let a = 150; a <= 230; a += 8)
    for (let b = 110; b <= 200; b += 9)
      for (const c of [120, 160, 190]) {
        const lignes = analysees(lignesDe({ a, b, c, e: 150 }));
        const ecran = tuneDe(lignes, leads, donnees, choix);
        const plan = planDe(lignes);
        const projete = plateauDuPlan(plan, donnees, bestiaire);
        const ae = simuler(ecran).actions.map((x) => `${x.id}@${x.tick}`).join(',');
        const ap = simuler(projete).actions.map((x) => `${x.id}@${x.tick}`).join(',');
        const ve = diagnostiquerSequence(ecran, ordre).ok;
        if (ae === ap && ve === planTient(plan, donnees, bestiaire).ok) accords++;
        if (ve) tenus++;
      }
  egal(accords, 11 * 11 * 3, 'les 363 états analysés donnent les mêmes actions et le même verdict');
  ok(tenus > 0 && tenus < 363, 'le balayage contient des ordres tenus et des ordres cassés');

  // Une case SAISIE après l'analyse garde sa priorité, zéro compris.
  const lignes = analysees(lignesDe({ a: 200, b: 160, c: 150, e: 150 }));
  const b = lignes[1];
  const tBuff = Number(Object.keys(b.speedMod)[0]);
  ok(Number.isFinite(tBuff), 'l’analyse a posé un buff sur le second');
  const corrigees = lignes.map((l, i) => (i === 1 ? modifierMod(l, 'speedMod', tBuff, 0) : l));
  const ecran = tuneDe(corrigees, leads, donnees, choix);
  const projete = plateauDuPlan(planDe(corrigees), donnees, bestiaire);
  egal(
    simuler(projete).actions.map((x) => `${x.id}@${x.tick}`),
    simuler(ecran).actions.map((x) => `${x.id}@${x.tick}`),
    'un zéro saisi sur un buff automatique est rejoué à son tick'
  );
  egal(projete.find((m) => m.id === 'allie:9002')!.speedMod?.[tBuff], 0, 'et il remplace le buff du sort');
}

// ⚠️ Rejoué à d'autres vitesses, le buff suit son lanceur : il n'est pas figé au
// tick de l'analyse.
export function testPlanSpeedTuneSortsSuivent() {
  titre('Plan de speed tune — les sorts suivent leur lanceur');
  const lignes = analysees(lignesDe({ a: 200, b: 160, c: 150, e: 150 }));
  const plan = planDe(lignes);
  const lent: EntreesLigne = { runeSpeed: 120, swift: false, artefactBuff: 0 };
  const projete = plateauDuPlan(plan, donnees, bestiaire, new Map([['allie:9001', lent]]));
  const premierA = simuler(projete).actions.find((x) => x.id === 'allie:9001')!.tick;
  const ticksBuff = Object.keys(projete.find((m) => m.id === 'allie:9002')!.speedMod ?? {}).map(Number);
  ok(ticksBuff.length > 0 && Math.min(...ticksBuff) === premierA + 1, 'le buff part au tick qui suit le tour du lanceur ralenti');
  const fige = Object.keys(lignes[1].speedMod).map(Number);
  ok(Math.min(...fige) !== Math.min(...ticksBuff), 'et non au tick que l’analyse avait écrit');
}

export function testPlanSpeedTuneRefus() {
  titre('Plan de speed tune — refus');
  const lignes = analysees(lignesDe({ a: 200, b: 160, c: 150, e: 150 }));
  const refus = (l: Ligne[], o: string[]) => {
    const r = planDepuisSpeedTune(l, leads, choix, o, donnees);
    return 'refus' in r ? r.refus.motif : null;
  };
  egal(refus(lignes, []), 'ordre-vide', 'un ordre vide refuse le plan');
  egal(refus(lignes, ordre.slice(0, 2)), 'ordre-incomplet', 'un ordre qui omet un allié refuse le plan');
  egal(refus(lignes, ['allie:9001#2', 'allie:9001', 'allie:9002', 'allie:9003']), 'occurrences-inversees', 'une occurrence rangée avant la précédente refuse le plan');
  const ancienne = lignes.map((l, i) => (i === 1 ? { ...l, casesAuto: undefined } : l));
  egal(refus(ancienne, ordre), 'provenance-inconnue', 'une grille de provenance inconnue refuse le plan');
  egal(refus([lignes[0], lignes[3]], ['allie:9001']), 'membres-insuffisants', 'un seul allié ne pose pas de plan');
  const masque = lignes.map((l, i) => (i === 2 ? { ...l, masque: true } : l));
  egal(refus(masque, ordre.slice(0, 2)), null, 'une ligne masquée n’entre pas dans le plan ni dans l’ordre exigé');
  ok(!planDe(masque, ordre.slice(0, 2)).lignes.some((l) => l.uid === 'allie:9003'), 'et le plan ne la contient pas');
}

// ⚠️ DIFFÉRENTIEL : la zone contre le prédicat brut, point par point, sur toute
// la grille balayée — et la propriété des classes (un représentant suffit).
export function testPlanSpeedTuneZoneDifferentielle() {
  titre('Plan de speed tune — zone contre balayage brut');
  const lignes = analysees(lignesDe({ a: 200, b: 160, c: 150, e: 150 }, 0));
  const plan = planDe(lignes);
  const bornes = { ficheMax: { swift: 330, sansSwift: 320 }, etatsSwift: [false, true] };
  const z = zoneMembre(plan, donnees, bestiaire, 'allie:9002', new Map(), bornes)!;
  ok(z.axeArtefact, 'un buff court : l’axe artéfact existe');
  let ecarts = 0;
  let dedans = 0;
  for (const swift of [false, true])
    for (let fiche = 100; fiche <= (swift ? 330 : 320); fiche++)
      for (let a = 0; a <= ARTE_MAX; a++) {
        const brut = planTient(plan, donnees, bestiaire, new Map([['allie:9002', { runeSpeed: fiche - 100, swift, artefactBuff: a }]])).ok;
        if (brut !== dansZone(z, fiche, swift, a)) ecarts++;
        if (brut) dedans++;
      }
  egal(ecarts, 0, 'aucun point où la zone et le prédicat brut divergent');
  ok(dedans > 0, 'la zone n’est pas vide');
  const env = enveloppeZone(z)!;
  ok(env.min >= 100 && env.max <= 330, 'l’enveloppe reste dans le domaine balayé');
  const admis = arteAdmissibles(z, env.min, z.parSwift[0].classes.some((c) => c.intervalles.some(([x]) => x === env.min)) ? false : true);
  ok(admis.length > 0, 'à la borne basse de l’enveloppe, au moins une classe d’artéfact est admise');

  // Classes : 30 % de buff, rien d'autre → une classe change à chaque point de buff.
  egal(classesArtefact([30], 0, 10), [{ min: 0, max: 3 }, { min: 4, max: 6 }, { min: 7, max: 9 }, { min: 10, max: 10 }], '30 % : 30, 31, 32, 33 % de buff');
  egal(classesArtefact([25, 30], 0, 8), [{ min: 0, max: 3 }, { min: 4, max: 6 }, { min: 7, max: 7 }, { min: 8, max: 8 }], '25 et 30 % : les classes croisent les deux découpages (25 change à 4 et 8, 30 à 4 et 7)');
  egal(classesArtefact([], 0, 60), [{ min: 0, max: 60 }], 'sans buff : une seule classe');
}

// ⚠️ Les cumuls de passif sont photographiés ; leurs préconditions se gardent,
// sur le CONTEXTE ENTIER.
export function testPlanSpeedTuneCumuls() {
  titre('Plan de speed tune — préconditions des cumuls');
  const chil = monstre(9101, 'Chilling', 101);
  const porteur = monstre(9102, 'Porteur', 100);
  const d: DonneesKit = { kits: new Map(), sorts: new Map(), passifs: new Map([[9101, [passifChilling]]]) };
  const best = new Map([chil, porteur, E].map((m) => [m.id, m] as const));
  const lignes: Ligne[] = [
    { ...ligneVierge(chil, 'allie'), runeSpeed: 150, sets: ['will'], cumulsPassif: 1 },
    { ...ligneVierge(porteur, 'allie'), runeSpeed: 120, sets: ['violent'] },
    { ...ligneVierge(E, 'ennemi'), runeSpeed: 100 },
  ];
  const r = planDepuisSpeedTune(lignes, leads, {}, ['allie:9101', 'allie:9102'], d);
  if (!('plan' in r)) throw new Error('refus');
  const plan = r.plan;
  egal(plan.referenceGains, { 'allie:9101': 20 }, 'la Volonté de Chilling lui vaut un cumul : 20 de référence');
  const sansWill = entreesDeBuild(101, 251, ['violent'], 0);
  egal(cumulsEnDefaut(plan, d, best, new Map([['allie:9101', sansWill]])), ['allie:9101'], 'un build sans Volonté casse la précondition');
  egal(cumulsEnDefaut(plan, d, best, new Map([['allie:9101', entreesDeBuild(101, 251, ['will', 'violent'], 0)]])), [], 'avec Volonté, elle tient');
  // Un autre membre en Bouclier AJOUTE un cumul : trop rapide aussi est un défaut.
  egal(
    cumulsEnDefaut(plan, d, best, new Map([['allie:9102', entreesDeBuild(100, 220, ['shield'], 0)]])),
    ['allie:9101'],
    'un Bouclier ajouté par un autre build change aussi le gain'
  );
  ok(!contexteTenu(plan, d, best, new Map([['allie:9101', sansWill]])).ok, 'le prédicat commun le refuse');
  egal(entreesDeBuild(101, 251, ['swift', 'will'], 12), { runeSpeed: 150, swift: true, sets: ['swift', 'will'], artefactBuff: 12 }, 'l’adaptateur dérive Swift des sets activés');
}

export const verificationsPlanSpeedTune: [string, () => void][] = [
  testPlanSpeedTuneFideleEcran,
  testPlanSpeedTuneSortsSuivent,
  testPlanSpeedTuneRefus,
  testPlanSpeedTuneZoneDifferentielle,
  testPlanSpeedTuneCumuls,
].map((t) => [t.name, t]);
