// La rune choisie sur une courbe de runes (src/lib/courbeChoix.ts).
//
// ⚠️ Ce qui se joue ici : une rune montée (« Mon compte » en direct) change de
// score, donc de rang ; un choix resté au rang montrait une AUTRE rune.

import { choixAuRang, serieDeReference, suivreChoix } from '../src/lib/courbeChoix';
import { egal, ok, titre } from './outils';

const serie = (ids: number[], own: boolean) => ({ effs: ids.map((_, i) => 100 - i), runes: ids.map((id) => ({ id })), own });

export function testCourbeChoix() {
  titre('courbes de runes — la rune choisie suit son rang');
  const avant = [serie([11, 12, 13, 14], true), serie([21, 22, 23, 24], false)];
  const choix = choixAuRang(avant, 2);
  egal(choix, { rang: 2, runeId: 13 }, 'le choix retient la rune du rang sur la courbe « Actuelle »');

  // La rune 13 est montée : elle passe 1ʳᵉ.
  const apres = [serie([13, 11, 12, 14], true), serie([21, 22, 23, 24], false)];
  egal(suivreChoix(choix, apres), { rang: 0, runeId: 13 }, 'après le recalcul : le choix suit SA rune à son nouveau rang, pas la rune venue au rang');

  ok(suivreChoix(choix, avant) === choix, 'rien n’a bougé : le même objet (aucun dessin de plus)');
  const sansElle = [serie([11, 12, 14], true)];
  ok(suivreChoix(choix, sansElle) === choix, 'la rune n’y est plus (filtrée, vendue) : le rang reste tel quel');
  egal(suivreChoix(null, apres), null, 'aucun choix : rien à suivre');

  egal(serieDeReference([serie([21], false), serie([11], true)])?.runes?.[0].id, 11, 'la référence : la courbe de ses runes (« Actuelle »)…');
  const sansRunes: { effs: number[]; runes?: { id: number }[]; own: boolean } = { effs: [1, 2], own: true };
  egal(serieDeReference([sansRunes, serie([21], false)])?.runes?.[0].id, 21, '…sinon la première qui porte des runes');
  egal(choixAuRang([sansRunes], 1), { rang: 1, runeId: null }, 'une courbe sans runes (partagée) : le rang seul, comme avant');
}
