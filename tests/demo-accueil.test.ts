// Les données de démonstration de l'accueil (src/lib/demoAccueil.ts) : des
// équipes figées, passées par les MÊMES calculs que les outils.

import { DEMO, demoOptimizer, demoReco, demoRta, demoSpeedTune, recosFigees } from '../src/lib/demoAccueil';
import type { Monster } from '../src/types';
import { egal, monstersJson, ok, titre } from './outils';

const MONSTRES = monstersJson() as Monster[];
const parCom2us = new Map<number, Monster>();
for (const m of MONSTRES) if (m.com2usId != null && !parCom2us.has(m.com2usId)) parCom2us.set(m.com2usId, m);

export function testDemoAccueil() {
  titre('Accueil — données de démonstration');

  // Sans les données du jeu : aucune démo, plutôt qu'une démo fausse.
  const vide = new Map<number, Monster>();
  egal([demoRta(vide), demoSpeedTune(vide), demoOptimizer(vide), demoReco(vide, { nom: 'n', auteur: 'a', contributeur: 'c' })], [null, null, null, null],
    'sans les données du jeu : aucune démo');

  ok(Object.values(DEMO).every((id) => parCom2us.has(id)), 'chaque monstre des démos existe dans les données');

  // RTA : cinq nat 5★ lumière et ténèbres, avec leur vitesse de runes.
  const rta = demoRta(parCom2us)!;
  egal(rta.map((i) => i.monster.name), ['Lora', 'Son Zhang Lao', 'Yeonhong', 'Woonsa', 'Han'], 'RTA : la prépa de démonstration');
  ok(rta.every((i) => i.monster.naturalStars === 5 && ['light', 'dark'].includes(i.monster.element) && i.entry.runeSpeed != null),
    'RTA : des nat 5★ lumière et ténèbres, vitesse de runes posée');

  // Speed tuning : le vrai moteur, trois alliés et trois adversaires, un
  // premier tour chacun, sur des ticks croissants.
  const st = demoSpeedTune(parCom2us)!;
  egal(st.premiers.length, 6, 'speed tuning : six premiers tours');
  egal(st.premiers[0].camp, 'allie', 'speed tuning : un allié joue le premier');
  ok(st.premiers.every((a, i) => i === 0 || a.tick >= st.premiers[i - 1].tick), 'speed tuning : les tours dans l’ordre des ticks');
  egal(st.lignesTableau.map((l) => l.id), st.premiers.map((a) => a.id), 'speed tuning : le tableau dans l’ordre de tour');
  ok([...st.parTick.values()].flat().length === 6, 'speed tuning : chaque monstre posé sur le repère des ticks');
  ok(st.premiers.every((a) => st.numAction.get(`${a.id}@${a.tick}`) === a.ordre), 'speed tuning : la case de chaque premier tour porte son rang');

  // Recommandation : trois decks de trois, chacun « fort contre » une défense.
  const reco = demoReco(parCom2us, { nom: 'Défenses GvO', auteur: 'Toto', contributeur: 'Lulu' })!;
  egal(reco.decks.map((d) => d.slots.map((s) => s.name)), [['Maximilian', 'Lora', 'Driana'], ['Sylvia', 'Cichlid', 'Kumar'], ['Lamiella', 'Adriana', 'Odin']],
    'recommandation : les decks choisis');
  ok(reco.decks.every((d) => d.counters.length === 1 && d.counters[0].monsters.length === 3 && d.counters[0].monsters.every((m) => m.com2usId != null)),
    'recommandation : une défense « fort contre » de trois monstres par deck');
  egal([reco.name, reco.author, reco.contributeurs], ['Défenses GvO', 'Toto', ['Toto', 'Lulu']], 'recommandation : nom, auteur, contributeurs');
  const fige = recosFigees(reco);
  egal(fige.state.recos, [reco], 'état figé : la seule recommandation');
  let refuse = false;
  try { fige.addReco(); } catch { refuse = true; }
  ok(refuse, 'état figé : un geste qui rendrait une valeur est refusé');

  // Optimizer : deux builds, stats calculées par `computeStats`.
  const opt = demoOptimizer(parCom2us)!;
  egal(opt.candidats.length, 2, 'Optimizer : deux builds');
  ok(opt.candidats.every((c) => c.runeIds.length === 6 && c.runeIds.every((id) => opt.runes.some((r) => r.id === id))), 'Optimizer : six runes chacun, toutes connues');
  const vit = (i: number) => opt.candidats[i].stats.find((s) => s.key === 'spd');
  ok(!!vit(0) && vit(0)!.total > (opt.monster.stats.speed ?? 0), 'Optimizer : la vitesse des runes s’ajoute à la base');
}
