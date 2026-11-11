// Branchement — régler le speed tune depuis l'Optimizer : le bouton de l'équipe
// (liste de siège seulement), la modale prérempli, son état à part, « Appliquer
// à l'équipe » qui refuse ou remplace le plan, et le geste de l'encart.
// Spec : docs/02-app/optimizer/feat-speed-tune-depuis-optimizer.md.
import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import type { ExclusionSelector } from '../../src/lib/optimizerExclusion';
import type { Monster } from '../../src/types';
import { ligneVierge } from '../../src/lib/speedTuneLignes';
import { planDepuisSpeedTune } from '../../src/lib/planSpeedTune';
import { photographierMemoire } from '../../src/hooks/useStickyState';
import { fr } from '../../src/i18n/fr';

interface Banc {
  etat: () => OptimizerState;
  listes: () => UseOptimizerLists;
  geste: (faire: () => void) => Promise<void>;
  premier: ExclusionSelector;
  second: ExclusionSelector;
}
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const boutons = (texte: string, racine: ParentNode = document) => [...racine.querySelectorAll<HTMLButtonElement>('button')]
  .filter(b => visible(b) && (b.textContent?.trim() === texte || b.getAttribute('aria-label') === texte));
const dialogue = () => { const d = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]; return d[d.length - 1] ?? null; };
const groupe = () => [...document.querySelectorAll<HTMLElement>('section[aria-label="Équipe 1"]')].find(visible) ?? null;

export async function preuvesSpeedTuneDepuisOptimizer(b: Banc, monstres: readonly Monster[]): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  const o = fr.optimizer.speedTune, c = fr.speedTuning.camp;
  // Les kits se lisent en asynchrone : on rend la main jusqu'à la condition.
  const jusqua = async (cond: () => boolean) => {
    for (let i = 0; i < 100 && !cond(); i++) await b.geste(() => {}).then(() => new Promise(r => setTimeout(r, 30)));
    return cond();
  };
  const pli = boutons('Gérer mes listes')[0];
  if (pli) await b.geste(() => pli.click());
  const sansPlan = { id: 'ea', listId: 'a', members: [b.premier, b.second], lead: { stat: 'Attack Speed', amount: 24, area: 'Guild', element: null } };
  await b.geste(() => { b.listes().setListContent('a', 'guilde'); b.listes().setTeams([sansPlan]); });

  const regler = groupe() && boutons(o.regler, groupe()!)[0];
  verifier(!!regler, 'équipe sans plan d’une liste de siège : « Régler le speed tune »');
  await b.geste(() => regler!.click());
  const appliquer = () => dialogue() && boutons(c.appliquer, dialogue()!)[0];
  verifier(!!appliquer() && boutons(c.exporter, dialogue()!).length === 0, 'la modale offre « Appliquer à l’équipe » à la place de l’export');
  verifier(await jusqua(() => !!appliquer() && !appliquer()!.disabled), 'état posé : « Appliquer » actif');
  verifier(['Premier', 'Second'].every(n => dialogue()!.textContent!.includes(n)), 'les membres de l’équipe dans « Ton équipe »');
  await b.geste(() => appliquer()!.click());
  verifier(dialogue()!.textContent!.includes(c.vitesseManquante('Premier')) && !b.listes().teams[0]!.speedTune,
    'membre sans équipement complet : vitesse à saisir, rien n’est écrit');
  const cles = Object.keys(photographierMemoire()).filter(k => k.startsWith('speedTune.'));
  verifier(cles.length > 0 && cles.every(k => k.startsWith('speedTune.optimizer.')), 'état à part : aucune clé de la page Speed tuning touchée');
  await b.geste(() => boutons('Fermer', dialogue()!)[0]!.click());

  // Un plan : il revient dans l'outil, et « Appliquer » le remplace.
  const [m1, m2] = monstres;
  const lignes = [{ ...ligneVierge(m1!, 'allie'), runeSpeed: 120 }, { ...ligneVierge(m2!, 'allie'), runeSpeed: 90 }];
  const construit = planDepuisSpeedTune(lignes, { allie: null, ennemi: null }, {}, ['allie:1', 'allie:2'], { kits: new Map(), sorts: new Map(), passifs: new Map() });
  if (!('plan' in construit)) throw new Error('plan refusé');
  const repli = { vitesseMin: null, effet206: 0 };
  await b.geste(() => b.listes().setTeams([{ ...sansPlan, speedTune: { plan: construit.plan, membres: [
    { uid: 'allie:1', selector: b.premier, attache: true, repli }, { uid: 'allie:2', selector: b.second, attache: false, repli },
  ] } }]));
  const modifier = groupe() && boutons(o.modifier, groupe()!)[0];
  verifier(!!modifier, 'équipe avec plan : « Modifier le speed tune »');
  await b.geste(() => modifier!.click());
  verifier(await jusqua(() => !!appliquer() && !appliquer()!.disabled), 'kits de toutes les lignes lus : « Appliquer » actif');
  // Une vitesse corrigée dans l'outil : c'est elle que le plan appliqué porte.
  const champ = [...dialogue()!.querySelectorAll<HTMLInputElement>(`input[aria-label="${c.runesAria('Premier')}"]`)].find(visible)!;
  verifier(champ?.value === '120', 'la vitesse de runes du plan revient dans l’outil');
  await b.geste(() => {
    champ.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, '130');
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    champ.blur();
  });
  await b.geste(() => appliquer()!.click());
  const confirmer = dialogue() && boutons(c.verdictDifferent.action, dialogue()!)[0];
  if (confirmer) await b.geste(() => confirmer.click());
  const st = b.listes().teams[0]!.speedTune;
  verifier(!dialogue() && st?.plan?.lignes.map(l => [l.uid, l.runeSpeed]).join() === 'allie:1,130,allie:2,90',
    'plan appliqué : la modale se ferme, le plan de l’équipe est celui de l’outil');
  verifier(st?.membres.map(m => [m.uid, m.attache]).join() === 'allie:1,true,allie:2,false', 'liens gardés avec leur état');
  verifier(st?.membres[0]?.repli.vitesseMin === 100 + 130, 'repli suivant la ligne');

  // L'encart du membre lié ouvre la même modale.
  await b.geste(() => b.etat().choisirMembre('a', b.premier));
  const depuisEncart = [...document.querySelectorAll<HTMLElement>(`section[aria-label="${o.titre}"]`)].filter(visible)
    .flatMap(s => boutons(o.modifier, s))[0];
  // Au téléphone seulement : au bureau, la liste des équipes et son bouton sont à côté.
  const bureau = matchMedia('(min-width: 1024px)').matches;
  verifier(bureau ? !depuisEncart : !!depuisEncart, bureau ? 'bureau : pas de « Modifier le speed tune » dans l’encart, doublon du bouton de l’équipe'
    : 'téléphone : « Modifier le speed tune » dans l’encart du membre');
  if (depuisEncart) {
    await b.geste(() => depuisEncart.click());
    verifier(!!appliquer(), 'il ouvre la modale de l’équipe');
    await b.geste(() => boutons('Fermer', dialogue()!)[0]!.click());
  }

  await b.geste(() => b.listes().setListContent('a', 'arene'));
  verifier(!!groupe() && boutons(o.modifier, groupe()!).length === 0, 'liste Arène : aucun bouton de speed tune');
  verifier(document.documentElement.scrollWidth <= window.innerWidth, 'écran sans débordement horizontal');
  return preuves;
}
