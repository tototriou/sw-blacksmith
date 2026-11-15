// Rendu — le détail d'une rune SIMULÉE par l'Optimizer (« Simuler +15 et max
// meules/gemmes », runesMaxees.ts) : ce que la simulation a changé s'écrit en
// violet (la teinte du plan « Actuel | Optimisé » de Mon compte > Runes >
// Optimisation), la valeur réelle en infobulle ; une rune de l'inventaire ne
// change pas. C'est la carte des résultats (BuildCandidateCard), aux deux
// formats : le même composant au survol et sous la roue.

import { RuneDetailBox, VIOLET } from '../../src/components/PieceDetail';
import { runeMaxee } from '../../src/lib/runesMaxees';
import type { RuneDetail } from '../../src/types';
import { auTelephone, rendre, texteVisible } from './outils-rendu';
import { ok, titre } from '../outils';

const RUNE: RuneDetail = {
  id: 11, slot: 2, set: 'swift', rank: 6, rarity: 5, level: 12,
  main: { code: 8, value: 31 },
  subs: [
    { code: 4, value: 10, grind: 3, enchant: true },
    { code: 2, value: 12, grind: 5 },
    { code: 9, value: 6 },
  ],
};
const violets = (html: string) => [...html.matchAll(/<span[^>]*style="color:rgb\(var\(--rarity-4\)\)"[^>]*>([^<]*(?:<!-- -->[^<]*)*)<\/span>/g)]
  .map((m) => m[1].replace(/<!-- -->/g, ''));
const decoder = (s: string) => s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');

export function testRenduRuneSimulee() {
  titre('rendu · détail d’une rune simulée — ce qui est simulé en violet, la valeur réelle en infobulle');
  ok(VIOLET === 'rgb(var(--rarity-4))', 'précondition : le violet du plan d’optimisation');
  for (const [format, rendu] of [['ordinateur', (r: RuneDetail) => rendre(<RuneDetailBox rune={r} compact={false} />)],
    ['téléphone', (r: RuneDetail) => auTelephone(() => rendre(<RuneDetailBox rune={r} />))]] as const) {
    const reelle = rendu(RUNE);
    ok(violets(reelle).length === 0 && !reelle.includes('Simulé'), `${format} : rune de l’inventaire, aucune ligne en violet ni infobulle de simulation`);
    const simulee = rendu(runeMaxee(RUNE));
    const v = violets(simulee);
    ok(v.includes('VIT +42'), `${format} : principale montée à +15 en violet (${v.join(' | ')})`);
    ok(v.includes('ATQ 13%') && v.includes('+10%'), `${format} : gemme ATQ % 7 → 13 et sa meule +3 → +10, chacune en violet`);
    ok(v.includes('+10%') && !v.some((x) => x.startsWith('PV')), `${format} : PV % meulée — seule la meule (+10 %) en violet, la base reste blanche`);
    ok(!v.some((x) => x.includes('critiq')), `${format} : ligne sans meule ni gemme, couleur inchangée`);
    const gains = [...simulee.matchAll(/<span data-gain-simule=""[^>]*>([^<]*(?:<!-- -->[^<]*)*)<\/span>/g)].map((m) => m[1].replace(/<!-- -->/g, ''));
    ok(gains.length === 2 && gains[0] === '(+13%)' && gains[1] === '(+5%)',
      `${format} : gain total à droite de chaque ligne simulée — ATQ % 10 → 23 (+13 %), PV % 12 → 17 (+5 %), aucun sur Tx critiq. (${gains.join(' | ')})`);
    ok(!reelle.includes('data-gain-simule'), `${format} : rune de l’inventaire, aucun gain affiché`);    const titres = [...simulee.matchAll(/title="([^"]*Simulé[^"]*)"/g)].map((m) => decoder(m[1]));
    ok(titres.includes('Simulé (maxé) — valeur réelle : VIT +31') && titres.includes('Simulé (maxé) — valeur réelle : ATQ 7% +3%')
      && titres.includes('Simulé (maxé) — valeur réelle : PV 7% +5%'), `${format} : la valeur réelle en infobulle (${titres.join(' | ')})`);
    ok(texteVisible(simulee).includes('PV 7%'), `${format} : la base non simulée reste lisible telle quelle`);
  }
}
