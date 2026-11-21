// L'historique du compte, côté page : un état de l'archive du plugin ramené
// aux runes de la Comparaison (src/lib/historiqueRunes.ts).

import { runeEfficiency, runeScore } from '../src/lib/effects';
import { runesDeLEtat } from '../src/lib/historiqueRunes';
import { egal, ok, titre } from './outils';

export function testHistoriqueRunes() {
  titre('historique du compte — les runes d’un état archivé');
  const brute = {
    rune_id: 42,
    slot_no: 4,
    set_id: 13, // Violent
    class: 16, // antique
    extra: 15,
    upgrade_curr: 15,
    pri_eff: [4, 63],
    prefix_eff: [9, 5],
    sec_eff: [[8, 18, 0, 4], [10, 7, 1, 0]],
  };
  const [rune, ...reste] = runesDeLEtat([brute, null, 'x', { rune_id: 0 }, { sans: 'identifiant' }]);
  egal(reste.length, 0, 'ce qui n’est pas une rune est sauté');
  egal([rune.id, rune.slot, rune.set, rune.rank], [42, 4, 'violent', 16], 'identifiant, emplacement, set et rang, comme à l’import d’un compte');
  egal(rune.subs.map((s) => s.value), [22, 7], 'la meule comptée dans la valeur, comme à l’import');
  ok(rune.marker === undefined, 'sans marqueur : l’archive n’en garde pas');
  // Le calcul est celui de l'app du jour, pour toute la chronologie.
  egal(runeScore(rune), Math.round((5 / 30 + 22 / 30 + 7 / 35) * 100), 'le score se calcule sur l’état archivé, innée comprise');
  ok(runeEfficiency(rune) > 0, 'l’efficience aussi');
}
