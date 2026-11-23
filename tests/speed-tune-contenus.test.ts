// Le speed tuning en raid et en RTA : la taille du tick (7 %, 4,5 %, 1,5 %),
// ses seuils, l'horloge de chaque contenu, la première colonne montrée, et le
// plan de l'Optimizer qui emporte son contenu
// (docs/02-app/speed-tuning/feat-formule.md).
//
// ⚠️ Les tailles de tick sont CITÉES (wiki d'Ellia) ; le totem +15 % compté en
// RTA et en raid est AFFIRMÉ par le mainteneur, non mesuré : aucun test ici ne
// le présente comme établi.

import {
  CONTENUS_SPEED_TUNE,
  HORIZON_TICKS,
  TICK_DIXIEMES,
  atbParTick,
  debutAffiche,
  horlogePour,
  premiersTours,
  simuler,
  speedForTick,
  tickDeVitesse,
  type ContenuSpeedTune,
  type TuneMonstre,
} from '../src/lib/speedTune';
import { horlogeDuPlan } from '../src/lib/planSpeedTune';
import { planSpeedTuneValide } from '../src/lib/speedTuneEquipe';
import { egal, ok, titre } from './outils';

const monstre = (id: string, combat: number, camp: TuneMonstre['camp'] = 'allie', extra: Partial<TuneMonstre> = {}): TuneMonstre => ({
  id,
  combat,
  camp,
  ...extra,
});

export function testSpeedTuneContenus() {
  titre('speed tuning · la taille du tick selon le contenu');
  egal(TICK_DIXIEMES, { siege: 70, raid: 45, rta: 15 }, '7 % en siège, 4,5 % en raid, 1,5 % en RTA (wiki d’Ellia)');
  egal([atbParTick(300), atbParTick(300, 'raid'), atbParTick(300, 'rta')], [21, 13.5, 4.5], 'barre gagnée par tick à 300 de vitesse');
  egal([speedForTick(5), speedForTick(6), speedForTick(11)], [286, 239, 130], 'siège inchangé : 286 au tick 5, 239 au 6, 130 au 11');
  egal([speedForTick(20, 'rta'), speedForTick(7, 'raid')], [334, 318], 'RTA : 334 au tick 20 ; raid : 318 au tick 7');
  egal([tickDeVitesse(300), tickDeVitesse(300, 'raid'), tickDeVitesse(300, 'rta')], [5, 8, 23], 'le tick naturel d’un monstre à 300');
  let inverse = true;
  for (const c of CONTENUS_SPEED_TUNE) {
    for (let v = 90; v <= 480; v++) {
      const n = tickDeVitesse(v, c);
      if (speedForTick(n, c) > v || (n > 1 && speedForTick(n - 1, c) <= v)) inverse = false;
    }
  }
  ok(inverse, 'tickDeVitesse est l’inverse exact de speedForTick, dans les trois contenus (90 à 480)');

  titre('speed tuning · l’horloge de chaque contenu');
  egal(
    CONTENUS_SPEED_TUNE.map((c) => horlogePour(c).ticks),
    [HORIZON_TICKS, 63, 187],
    'la même durée de jeu que les 40 ticks du siège : 40, 63, 187'
  );
  const lent = [monstre('rapide', 300), monstre('lent', 100)];
  const enRta = premiersTours(simuler(lent, horlogePour('rta')));
  egal(enRta.map((a) => [a.id, a.tick]), [['rapide', 23], ['lent', 67]], 'en RTA, un monstre à 100 joue au tick 67 : il reste dans le calcul');
  // Au tick 15 du siège, le rapide (son 3ᵉ tour) et le lent sont pleins à
  // égalité de barre : le plus rapide passe, le lent joue au 16.
  egal(premiersTours(simuler(lent, HORIZON_TICKS)).map((a) => a.tick), [5, 16], 'en siège, les mêmes jouent aux ticks 5 et 16');
  egal(simuler([monstre('x', 300)], horlogePour('rta')).lignes[0].trajectoire.slice(0, 2), [4.5, 9], 'la trajectoire monte de 4,5 par tick en RTA');

  // Sans modificateur, tout le monde est ralenti dans la même proportion :
  // l'ordre des premiers tours ne dépend pas du contenu.
  const equipe = [
    monstre('a', 286),
    monstre('b', 241),
    monstre('c', 205),
    monstre('d', 160),
    monstre('e', 290, 'ennemi'),
    monstre('f', 210, 'ennemi'),
  ];
  const ordre = (c: ContenuSpeedTune) => premiersTours(simuler(equipe, horlogePour(c))).map((a) => a.id);
  egal([ordre('raid'), ordre('rta')], [ordre('siege'), ordre('siege')], 'sans modificateur, le même ordre de tour dans les trois contenus');

  titre('speed tuning · la première colonne montrée');
  const sim = (c: ContenuSpeedTune) => simuler([monstre('x', 300), monstre('y', 150)], horlogePour(c));
  egal(debutAffiche(sim('siege'), 'siege'), 1, 'en siège, toujours le tick 1');
  egal([debutAffiche(sim('raid'), 'raid'), debutAffiche(sim('rta'), 'rta')], [8, 23], 'en raid et en RTA, le tick du premier tour');
  // À 40 de vitesse, le premier tour tombe au tick 167 de la RTA : 40 colonnes
  // à partir de là dépasseraient les 187 ticks.
  egal(debutAffiche(simuler([monstre('z', 40)], horlogePour('rta')), 'rta'), 187 - HORIZON_TICKS + 1, 'jamais au-delà de la fin de l’horloge');
  egal(debutAffiche(simuler([], horlogePour('rta')), 'rta'), 1, 'personne ne joue : le tick 1');
  const saisi = [monstre('x', 300, 'allie', { atbMod: { 4: 20 } }), monstre('y', 150, 'allie', { speedMod: { 12: 30 } })];
  egal(
    debutAffiche(simuler(saisi, horlogePour('rta')), 'rta', saisi),
    4,
    'une case saisie avant le premier tour reste visible : les colonnes partent d’elle'
  );

  titre('speed tuning · le plan de l’Optimizer emporte son contenu');
  egal(horlogeDuPlan({}), { ticks: 40, contenu: 'siege' }, 'un plan sans contenu (exporté avant, ou de siège) se rejoue en siège');
  egal(horlogeDuPlan({ contenu: 'rta' }), { ticks: 187, contenu: 'rta' }, 'un plan de RTA se rejoue en RTA');
  const plan = {
    version: 1,
    lignes: [
      { uid: 'allie:1', camp: 'allie', monsterId: 1, runeSpeed: 100, swift: false, artefactBuff: 0, cumulsPassif: 0, lead: 0, atb: {}, speed: {} },
      { uid: 'allie:2', camp: 'allie', monsterId: 2, runeSpeed: 90, swift: false, artefactBuff: 0, cumulsPassif: 0, lead: 0, atb: {}, speed: {} },
    ],
    choix: {},
    ordre: ['allie:1', 'allie:2'],
    leads: { allie: null, ennemi: null },
    origine: {},
    referenceGains: {},
  };
  ok(planSpeedTuneValide(plan), 'un plan sans contenu reste lisible');
  ok(planSpeedTuneValide({ ...plan, contenu: 'raid' }) && planSpeedTuneValide({ ...plan, contenu: 'rta' }), 'un plan de raid ou de RTA se relit');
  ok(!planSpeedTuneValide({ ...plan, contenu: 'pve' }), 'un contenu inconnu écarte le plan');
}
