// Branchement — « Enregistrer dans Mes équipes » dans la bande d'une équipe de
// l'Optimizer : entre le numéro et le speed tune, grisé tant qu'un membre n'a
// pas ses runes et ses artéfacts validés, et absent de la fenêtre de l'équipe.
// Spec : docs/02-app/compte/feat-equipes.md, « Aller-retour avec l'Optimizer ».
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import type { ExclusionSelector } from '../../src/lib/optimizerExclusion';
import type { EquipeOptimizer } from '../../src/lib/optimizerMemberStorage';
import { fr } from '../../src/i18n/fr';

interface Banc {
  listes: () => UseOptimizerLists;
  geste: (faire: () => void) => Promise<void>;
  premier: ExclusionSelector;
  second: ExclusionSelector;
}
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const boutons = (texte: string, racine: ParentNode = document) => [...racine.querySelectorAll<HTMLButtonElement>('button')]
  .filter(b => visible(b) && (b.textContent?.trim() === texte || b.getAttribute('aria-label') === texte));
const groupe = () => [...document.querySelectorAll<HTMLElement>('section[aria-label="Équipe 1"]')].find(visible) ?? null;

export async function preuvesMesEquipesBande(b: Banc, enregistree: () => EquipeOptimizer | null): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  const q = fr.optimizer.equipe;
  const pli = boutons('Gérer mes listes')[0];
  if (pli) await b.geste(() => pli.click());
  const equipe: EquipeOptimizer = { id: 'ea', listId: 'a', members: [b.premier, b.second], lead: null };
  await b.geste(() => { b.listes().setListContent('a', 'guilde'); b.listes().setTeams([equipe]); });

  const grise = groupe() && boutons(q.validerDAbord, groupe()!)[0];
  verifier(!!grise && grise.disabled && grise.title === q.validerDAbord, 'sans builds validés : grisé, l’infobulle dit de les valider d’abord');
  // Centré entre le numéro et le speed tune, dans une case oblongue de la hauteur de « Speed tune ».
  const numero = groupe()?.querySelector<HTMLElement>('span[title="Équipe 1"]');
  const st = groupe()?.querySelector<HTMLElement>(`button[aria-label="${fr.optimizer.speedTune.regler}"]`);
  const [rg, rn, rs] = [grise, numero, st].map(e => e?.getBoundingClientRect());
  const milieu = rn && rs ? (rn.right + rs.left) / 2 : NaN;
  verifier(!!rg && !!rn && !!rs && rg.left > rn.right && rg.right < rs.left && Math.abs((rg.left + rg.right) / 2 - milieu) <= 1.5
    && Math.abs((rg.top + rg.bottom) / 2 - (rs.top + rs.bottom) / 2) < 2,
    `centré entre « Équipe 1 » et le speed tune, sur sa ligne (${rg && Math.round((rg.left + rg.right) / 2)} pour ${Math.round(milieu)})`);
  verifier(!!numero && numero.scrollWidth <= numero.clientWidth, `avec le bouton, le numéro reste entier (${numero?.scrollWidth}/${numero?.clientWidth})`);
  const modif = [...(groupe()?.querySelectorAll<HTMLElement>('button') ?? [])].find(e => e.textContent === q.modifier);
  const rm = modif?.getBoundingClientRect();
  verifier(!!rs && !!rm && Math.abs((rs.top + rs.bottom) / 2 - (rm.top + rm.bottom) / 2) < 0.5,
    `« Speed tune » à la hauteur de « Modifier l’équipe » (${rs && (rs.top + rs.bottom) / 2} / ${rm && (rm.top + rm.bottom) / 2})`);
  const style = grise ? getComputedStyle(grise) : null;
  verifier(!!style && !!rg && !!rs && style.borderTopWidth === '1px' && style.backgroundColor !== 'rgba(0, 0, 0, 0)'
    && rg.width > rg.height && Math.abs(rg.height - rs.height) < 1, `dans une case oblongue de la hauteur de « Speed tune » (${rg?.width}×${rg?.height}, ${rs?.height})`);

  // Le premier validé seul ne suffit pas : chaque membre, runes et paire.
  await b.geste(() => b.listes().validateBuild('a', b.premier, [1, 2, 3, 4, 5, 6], [1, 2], undefined, 10101));
  verifier(!!boutons(q.validerDAbord, groupe()!)[0]?.disabled, 'un membre validé sur deux : toujours grisé');
  await b.geste(() => b.listes().validateBuild('a', b.second, [7, 8, 9, 10, 11, 12], [3, 4], undefined, 10101));
  const actif = boutons(q.enregistrerMesEquipes, groupe()!)[0];
  verifier(!!actif && !actif.disabled, 'tous les membres validés : « Enregistrer dans Mes équipes » actif');
  await b.geste(() => actif!.click());
  verifier(enregistree()?.id === 'ea', 'le clic passe l’équipe à Mes équipes');

  await b.geste(() => boutons(q.modifier, groupe()!)[0]!.click());
  const dialogue = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].pop();
  verifier(!!dialogue && boutons(q.enregistrerMesEquipes, dialogue).length === 0, 'la fenêtre « Modifier l’équipe » ne le porte plus');
  return preuves;
}
