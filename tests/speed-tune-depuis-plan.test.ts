// Régler le speed tune depuis l'Optimizer : l'outil rouvert sur un plan donne le
// plateau du plan, l'état sans plan, et le plan appliqué à l'équipe.
// Spec : docs/02-app/optimizer/feat-speed-tune-depuis-optimizer.md.
import { diagnostiquerSequence, simuler } from '../src/lib/speedTune';
import { ligneVierge, tuneDe, uidReference, type Ligne } from '../src/lib/speedTuneLignes';
import { planDepuisSpeedTune, plateauDuPlan, planTient, type PlanSpeedTune } from '../src/lib/planSpeedTune';
import { appliquerPlanALEquipe, criteresAvecRepli, etatDepuisMembres, etatDepuisPlan, jugerApplication, ouvertureDeLEquipe, perdOrigine, vitesseManquante, type EtatOutil } from '../src/lib/speedTuneDepuisPlan';
import { baseCompleteCriteres } from '../src/lib/criteresOptimizer';
import { CODE_206 } from '../src/lib/contrainteSpeedTune';
import type { ExclusionSelector } from '../src/lib/optimizerExclusion';
import type { SpeedTuneEquipe } from '../src/lib/speedTuneEquipe';
import { A, B, C, E, analysees, bestiaire, choix, donnees, leads, lignesDe, ordre, planDe } from './plan-speed-tune.test';
import { egal, ok, titre } from './outils';

const actions = (t: ReturnType<typeof plateauDuPlan>) => simuler(t).actions.map((x) => `${x.id}@${x.tick}`).join(',');
function rouvert(plan: PlanSpeedTune): EtatOutil {
  const r = etatDepuisPlan(plan, donnees, bestiaire);
  if (!('lignes' in r)) throw new Error(JSON.stringify(r));
  return r;
}

export function testSpeedTuneDepuisPlanFidele() {
  titre('Speed tune depuis l’Optimizer · l’outil rouvert donne le plateau du plan');
  let accords = 0, n = 0;
  for (let a = 150; a <= 230; a += 16)
    for (let b = 110; b <= 200; b += 18)
      for (const c of [120, 190]) {
        const plan = planDe(analysees(lignesDe({ a, b, c, e: 150 })));
        const e = rouvert(plan);
        const outil = tuneDe(e.lignes, e.leads, donnees, e.choix);
        if (actions(outil) === actions(plateauDuPlan(plan, donnees, bestiaire))) accords++;
        n++;
      }
  egal(accords, n, `les ${n} plans rouverts donnent les mêmes actions que leur projection`);

  // Un plan sans sort choisi pour le lanceur : l'outil ne lui prête pas celui de son kit.
  const sansChoix = planDepuisSpeedTune(lignesDe({ a: 200, b: 160, c: 150, e: 150 }), leads, { sort: {} }, ordre, donnees);
  if (!('plan' in sansChoix)) throw new Error('refus');
  const e = rouvert(sansChoix.plan);
  egal(e.choix.sort['allie:9001'], '', 'choix absent : « aucun sort » explicite');
  egal(actions(tuneDe(e.lignes, e.leads, donnees, e.choix)), actions(plateauDuPlan(sansChoix.plan, donnees, bestiaire)), 'et le plateau reste celui du plan');
  egal([e.ordreRange, e.ordre], [true, ordre], 'ordre voulu du plan, rangé');

  // La référence revient telle quelle ; un monstre absent du bestiaire empêche l'ouverture.
  const ref: Ligne = { ...ligneVierge(E, 'ennemi'), uid: uidReference(A.id), runeSpeed: 150, reference: true };
  const avecRef = planDepuisSpeedTune([...lignesDe({ a: 200, b: 160, c: 150, e: 150 }), ref], leads, choix, ordre, donnees);
  if (!('plan' in avecRef)) throw new Error('refus');
  const r = rouvert(avecRef.plan).lignes.find((l) => l.uid === uidReference(A.id));
  ok(!!r?.reference && r.runeSpeed === 150, 'adversaire de référence : rendu tel quel, référence comprise');
  const manque = etatDepuisPlan(planDe(analysees(lignesDe({ a: 200, b: 160, c: 150, e: 150 }))), donnees, new Map([[A.id, A], [B.id, B], [E.id, E]]));
  egal(manque, { motif: 'monstre-introuvable', monsterId: C.id }, 'monstre absent du bestiaire : la modale ne s’ouvre pas');
}

export function testSpeedTuneDepuisMembres() {
  titre('Speed tune depuis l’Optimizer · sans plan, les membres de l’équipe');
  const e = etatDepuisMembres([
    { monster: A, entrees: { runeSpeed: 120, swift: true, sets: ['swift'], artefactBuff: 6 } },
    { monster: B, entrees: null },
  ], { amount: 24, area: 'Guild', element: null });
  egal(e.lignes.map((l) => [l.uid, l.runeSpeed, l.swift ?? false, l.artefactBuff]), [['allie:9001', 120, true, 6], ['allie:9002', null, false, null]],
    'build ou équipement : ses entrées ; sans équipement complet : vitesse à saisir');
  egal([e.leads.allie?.amount, e.leads.ennemi, e.ordreRange], [24, null, false], 'lead de l’équipe, aucun adversaire, ordre libre');
  egal(vitesseManquante(e.lignes)?.uid, 'allie:9002', '« Appliquer » refusé tant qu’une vitesse alliée manque');
  egal(vitesseManquante(e.lignes.map((l) => ({ ...l, runeSpeed: l.runeSpeed ?? 100 }))), null, 'saisie : accepté');
}

export function testSpeedTuneAppliquerALEquipe() {
  titre('Speed tune depuis l’Optimizer · appliquer le plan à l’équipe');
  const sa: ExclusionSelector = { source: 'box', unitKey: 'a' }, sb: ExclusionSelector = { source: 'box', unitKey: 'b' };
  const sc: ExclusionSelector = { source: 'box', unitKey: 'c' }, parti: ExclusionSelector = { source: 'box', unitKey: 'z' };
  const monstre = new Map([['a', A.id], ['b', B.id], ['c', C.id], ['z', C.id]]);
  const monstreDe = (s: ExclusionSelector) => monstre.get((s as { unitKey: string }).unitKey) ?? null;
  const plan = planDe(analysees(lignesDe({ a: 200, b: 160, c: 150, e: 150 })));
  const ancien: SpeedTuneEquipe = { plan: null, membres: [
    { uid: 'allie:9001', selector: sa, attache: false, repli: { vitesseMin: 1, effet206: 0 } },
    { uid: 'allie:9003', selector: parti, attache: true, repli: { vitesseMin: 250, effet206: 4 } },
  ] };
  const { st, replis } = appliquerPlanALEquipe(ancien, plan, [sa, sb, sc], monstreDe, bestiaire);
  egal(st.plan, plan, 'le nouveau plan remplace l’ancien');
  egal(st.membres.map((m) => [m.uid, (m.selector as { unitKey: string }).unitKey, m.attache]), [['allie:9001', 'a', false], ['allie:9002', 'b', true], ['allie:9003', 'c', true]],
    'lien gardé avec son état ; lien d’un membre retiré tombé ; lignes libres affectées par monstre, attachées');
  egal(st.membres[0]!.repli, { vitesseMin: 105 + 200, effet206: 0 }, 'repli suivant la ligne');
  egal(replis, [], 'membre retiré de l’équipe : aucun critère à poser chez lui');

  // Un membre attaché dont le monstre a quitté « Ton équipe » : son repli se pose.
  const sansC = planDepuisSpeedTune(lignesDe({ a: 200, b: 160, c: 150, e: 150 }).filter((l) => l.uid !== 'allie:9003'), leads, choix, ['allie:9001', 'allie:9002'], donnees);
  if (!('plan' in sansC)) throw new Error('refus');
  const apres = appliquerPlanALEquipe(st, sansC.plan, [sa, sb, sc], monstreDe, bestiaire);
  egal(apres.st.membres.map((m) => m.uid), ['allie:9001', 'allie:9002'], 'membre sans ligne : lien retiré');
  egal(apres.replis.map((r) => [(r.selector as { unitKey: string }).unitKey, r.vitesseMin]), [['c', 102 + 150]], 'attaché : ses valeurs de repli se posent comme par « Détacher »');
  ok(planTient(apres.st.plan!, donnees, bestiaire) !== null, 'le plan appliqué se juge');
}

export function testSpeedTuneJugerApplication() {
  titre('Speed tune depuis l’Optimizer · « Appliquer à l’équipe » jugé');
  const lignes = analysees(lignesDe({ a: 200, b: 160, c: 150, e: 150 }));
  const tient = planTient(planDe(lignes), donnees, bestiaire).ok;
  const r = jugerApplication(lignes, leads, choix, ordre, donnees, bestiaire, tient);
  ok('plan' in r && !r.verdictDifferent, 'verdict de l’écran celui du plan : appliqué sans question');
  const autre = jugerApplication(lignes, leads, choix, ordre, donnees, bestiaire, !tient);
  ok('plan' in autre && autre.verdictDifferent, 'verdict différent : confirmation demandée');
  // Une vitesse changée sans relancer l'analyse : l'écran garde ses cases d'avant,
  // le plan rejoue les sorts à leurs nouveaux ticks. Le geste le voit quand les
  // deux verdicts divergent.
  let divergences = 0, justes = 0, n = 0;
  for (let base = 150; base <= 230; base += 20) for (const b of [110, 160, 200]) for (let a = 120; a <= 260; a += 7) {
    const changees = analysees(lignesDe({ a: base, b, c: 150, e: 150 })).map((l) => (l.uid === 'allie:9001' ? { ...l, runeSpeed: a } : l));
    const ecran = diagnostiquerSequence(tuneDe(changees, leads, donnees, choix), ordre).ok;
    const j = jugerApplication(changees, leads, choix, ordre, donnees, bestiaire, ecran);
    if (!('plan' in j)) continue;
    n++;
    const differe = planTient(j.plan, donnees, bestiaire).ok !== ecran;
    if (differe) divergences++;
    if (j.verdictDifferent === differe) justes++;
  }
  ok(divergences > 0 && justes === n, `vitesse changée sans analyse : ${divergences} verdict(s) divergent(s), tous signalés`);
  const sansVitesse = jugerApplication(lignes.map((l) => (l.uid === 'allie:9002' ? { ...l, runeSpeed: null } : l)), leads, choix, ordre, donnees, bestiaire, tient);
  egal('manque' in sansVitesse && sansVitesse.manque.uid, 'allie:9002', 'vitesse alliée manquante : refusé avant le constructeur');
  const seul = jugerApplication(lignes.filter((l) => l.uid === 'allie:9001'), leads, choix, ['allie:9001'], donnees, bestiaire, tient);
  egal('refus' in seul && seul.refus.motif, 'membres-insuffisants', 'refus du constructeur : rendu tel quel');
  const plan = planDe(lignes);
  ok(!perdOrigine(plan) && !perdOrigine(null), 'plan sans ligne recalculée : rien à dire');
  ok(perdOrigine({ ...plan, lignes: plan.lignes.map((l) => (l.uid === 'allie:9001' ? { ...l, runeSpeed: l.runeSpeed + 1 } : l)) }),
    'ligne recalculée : « Appliquer remplace les valeurs d’origine » est dit');
}

export function testSpeedTuneOuvertureEquipe() {
  titre('Speed tune depuis l’Optimizer · ouverture d’une équipe et critères de repli');
  const sa: ExclusionSelector = { source: 'box', unitKey: 'a' }, sb: ExclusionSelector = { source: 'box', unitKey: 'b' }, perdu: ExclusionSelector = { source: 'box', unitKey: 'x' };
  const membreDe = (s: ExclusionSelector) => {
    const k = (s as { unitKey: string }).unitKey;
    return k === 'a' ? { monster: A, entrees: null } : k === 'b' ? { monster: B, entrees: null } : null;
  };
  const vit = { stat: 'Attack Speed', amount: 24, area: 'Guild', element: null };
  const r = ouvertureDeLEquipe({ members: [sb, perdu, sa], lead: vit }, membreDe, bestiaire);
  ok('etat' in r && r.etat.lignes.map((l) => l.uid).join() === 'allie:9002,allie:9001' && r.etat.leads.allie?.amount === 24,
    'sans plan : membres résolus dans l’ordre de l’équipe, lead de vitesse de l’équipe');
  const pv = ouvertureDeLEquipe({ members: [sa, sb], lead: { ...vit, stat: 'HP' } }, membreDe, bestiaire);
  ok('etat' in pv && pv.etat.leads.allie === null, 'lead d’une autre stat : aucun lead allié');
  const plan = planDe(analysees(lignesDe({ a: 200, b: 160, c: 150, e: 150 })));
  const avecPlan = ouvertureDeLEquipe({ members: [sa, sb], lead: null, speedTune: { plan, membres: [] } }, membreDe, bestiaire);
  ok('plan' in avecPlan && avecPlan.plan === plan, 'avec plan : le plan');
  egal(ouvertureDeLEquipe({ members: [sa], lead: null, speedTune: { plan, membres: [] } }, membreDe, new Map([[A.id, A]])),
    { motif: 'monstre-introuvable', monsterId: B.id }, 'monstre du plan absent : refus');

  const c = { ...baseCompleteCriteres(undefined), minStats: { spd: 300, hp: 1 }, lignesVerrouillees: [{ code: CODE_206, min: 9 }, { code: 1, min: 2 }] };
  const pose = criteresAvecRepli(c, { vitesseMin: 250, verrou206: 4 });
  egal([pose.minStats, pose.lignesVerrouillees], [{ spd: 250, hp: 1 }, [{ code: 1, min: 2 }, { code: CODE_206, min: 4 }]], 'repli posé : VIT minimum et verrou 206');
  const vide = criteresAvecRepli(c, { vitesseMin: null, verrou206: null });
  egal([vide.minStats, vide.lignesVerrouillees], [{ hp: 1 }, [{ code: 1, min: 2 }]], 'repli vide : les deux champs retirés, le reste intact');
}

export const verificationsSpeedTuneDepuisPlan: [string, () => void][] = [
  testSpeedTuneDepuisPlanFidele, testSpeedTuneDepuisMembres, testSpeedTuneAppliquerALEquipe, testSpeedTuneJugerApplication, testSpeedTuneOuvertureEquipe,
].map((t) => [t.name, t]);
