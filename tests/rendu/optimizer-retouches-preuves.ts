import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import type { ExclusionSelector } from '../../src/lib/optimizerExclusion';
export interface BancRetouches {
  etat: () => OptimizerState;
  listes: () => UseOptimizerLists;
  geste: (faire: () => void) => Promise<void>;
  premier: ExclusionSelector;
  second: ExclusionSelector;
}
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';

// ⚠️ « Immobile » se prouve sur des positions lues une fois l'élément ARRÊTÉ,
// jamais après une attente fixe : dialogues et panneaux s'ouvrent et se
// ferment avec une animation, qui dure plus longtemps sous la charge de la
// suite complète — la mesure tombait alors en plein mouvement.
// Deux temps : la fin de toutes les animations et transitions du document
// (styles compris : un contour qui change de couleur en transition), puis cinq
// lectures identiques d'affilée — deux seulement pouvaient tomber AVANT le
// départ d'une animation et la déclarer finie.
async function positionStable(el: Element): Promise<DOMRect> {
  await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  let avant = el.getBoundingClientRect();
  let identiques = 0;
  for (let i = 0; i < 120 && identiques < 5; i++) {
    await new Promise(r => setTimeout(r, 25));
    const r = el.getBoundingClientRect();
    identiques = r.x === avant.x && r.y === avant.y && r.width === avant.width ? identiques + 1 : 0;
    avant = r;
  }
  return avant;
}
export const bouton = (nom: string, racine: ParentNode = document) => [...racine.querySelectorAll<HTMLButtonElement>('button')]
  .find(e => visible(e) && ((e.querySelector('[data-libelle-onglet]') ?? e).textContent?.trim() === nom || e.getAttribute('aria-label') === nom))!;
/**
 * Les animations et transitions CSS d'un élément et de ses descendants,
 * finies. ⚠️ Un délai fixe ne suffit pas sur une machine chargée : une mesure
 * prise pendant leurs dernières images (position, couleur) n'est pas la
 * finale. Les animations infinies ne s'attendent pas.
 */
export async function animationsFinies(element: Element) {
  await Promise.all(element.getAnimations({ subtree: true })
    .filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished));
}
/** Le dialogue ouvert, une fois son entrée (`dialogue`, 200 ms, translation et échelle 0,98) finie. */
export async function dialoguePose(): Promise<HTMLElement> {
  await new Promise(r => setTimeout(r, 250));
  const dialogue = document.querySelector<HTMLElement>('[role="dialog"]')!;
  await animationsFinies(dialogue);
  return dialogue;
}
export async function deplierListes(b: BancRetouches) {
  const gerer = bouton('Gérer mes listes');
  if (gerer?.getAttribute('aria-expanded') === 'false') await b.geste(() => gerer.click());
}
export async function preuvesCreationObligatoire(b: BancRetouches): Promise<[boolean, string][]> {
  await b.geste(() => b.listes().setActiveListId(null));
  const champ = [...document.querySelectorAll<HTMLInputElement>('[placeholder="Rechercher un monstre…"]')].find(visible)!;
  await b.geste(() => {
    champ.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, 'Second');
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const choix = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(e => visible(e) && e.textContent?.includes('Second'))!;
  await b.geste(() => choix.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
  const dialogue = await dialoguePose();
  const menu = dialogue.querySelector<HTMLSelectElement>('[aria-label="Contenu de la liste"]')!;
  const creer = bouton('Créer', dialogue), styleVide = getComputedStyle(menu);
  const couleurVide = styleVide.borderTopColor;
  const preuves: [boolean, string][] = [
    [menu.value === '' && menu.selectedOptions[0].textContent === 'Choisis le contenu de la liste', 'création : invitation explicite, aucune présélection'],
    [menu.classList.contains('border-accent') && styleVide.borderTopWidth === '1px' && styleVide.boxShadow === 'none'
      && (styleVide.outlineStyle === 'none' || styleVide.outlineColor === 'rgba(0, 0, 0, 0)'),
      `contenu absent : contour accent unique de 1 px, aucun halo (${styleVide.borderTopWidth}, ${styleVide.boxShadow}, ${styleVide.outlineStyle}, ${styleVide.outlineColor})`],
    [dialogue.textContent?.includes("Obligatoire : le contenu décide des leads actifs et des compétences d'invocateur.") === true
      && !!document.getElementById(menu.getAttribute('aria-describedby')!), 'aide obligatoire sous le champ et liée au menu'],
    [creer.disabled && creer.title === "Choisis d'abord le contenu.", 'Créer grisé : infobulle du contenu à choisir'],
  ];
  const avant = await positionStable(creer);
  await b.geste(() => { menu.focus(); menu.value = 'guilde'; menu.dispatchEvent(new Event('change', { bubbles: true })); });
  // Le contour passe de l'accent au neutre par une transition : la couleur se lit à son terme.
  await animationsFinies(menu);
  const apres = await positionStable(creer);
  preuves.push([!creer.disabled && !creer.title && menu.classList.contains('border-border') && getComputedStyle(menu).borderTopColor !== couleurVide,
    'contenu choisi : contour normal et Créer actif sans infobulle de blocage']);
  preuves.push([avant.x === apres.x && avant.y === apres.y, 'choix du contenu : action immobile']);
  preuves.push([document.documentElement.scrollWidth <= innerWidth, 'création sans débordement horizontal']);
  return preuves;
}

export async function preuvesEtatAuras(b: BancRetouches): Promise<[boolean, string][]> {
  if (innerWidth >= 1024) return preuvesEtatAurasBureau(b);
  const titre = [...document.querySelectorAll<HTMLElement>('p')].find(e=>visible(e) && e.textContent==='État de mon monstre')!;
  const carte=titre.parentElement!.parentElement!;
  const ajout = bouton("Ajouter un set d'aura");
  const buffs = bouton('Buff ATQ')?.parentElement;
  const lead = document.querySelector('[aria-label="Type de leader skill"]')?.parentElement?.parentElement;
  const aura = ajout?.parentElement;
  if (!aura || !buffs || !lead) return [[false, 'trois cartes de contexte présentes']];
  const a = aura.getBoundingClientRect(), l = lead.getBoundingClientRect(), f = buffs.getBoundingClientRect();
  const avant = await positionStable(ajout);
  await b.geste(() => ajout.click());
  const apres = await positionStable(ajout);
  return [
    [a.y >= Math.max(f.bottom, l.bottom), `auras : empilement au téléphone (${JSON.stringify({a:a.y,l:l.y,f:f.y})})`],
    [avant.x === apres.x && avant.y === apres.y, 'ajouter une aura garde le bouton immobile'],
    [document.documentElement.scrollWidth <= innerWidth, 'cartes de contexte sans débordement'],
    [[...aura.querySelectorAll<HTMLElement>('*')].filter(visible).every(e=>e.getBoundingClientRect().right<=carte.getBoundingClientRect().right),
      'colonne réelle : les contrôles des auras restent dans la carte'],
  ];
}

// Au bureau, « État de mon monstre » est réduit aux buffs et au lead, dans
// les essentiels ; les sets d'aura des autres monstres ont leur carte en tête
// de la colonne repliable « Aura, exclusion, avancés », ouverte par son onglet.
async function preuvesEtatAurasBureau(b: BancRetouches): Promise<[boolean, string][]> {
  const essentiels = document.querySelector<HTMLElement>('[data-colonne="criteres"]');
  const etat = essentiels?.querySelector<HTMLElement>('section[aria-label="État de mon monstre"]');
  const buffs = etat ? bouton('Buff ATQ', etat) : undefined;
  const lead = etat?.querySelector('[aria-label="Type de leader skill"]');
  const onglet = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    .find(e => e.querySelector('[data-libelle-onglet]')?.textContent?.trim() === 'Options');
  if (!etat || !buffs || !lead || !onglet) return [[false, 'état du monstre (buffs, lead) dans les essentiels, et l’onglet de sa colonne']];
  const avantOnglet = await positionStable(onglet);
  if (onglet.getAttribute('aria-selected') !== 'true') await b.geste(() => onglet.click());
  const apresOnglet = await positionStable(onglet);
  const carte = document.querySelector<HTMLElement>('[data-colonne="complements"] section[aria-label="Sets d\'aura des autres monstres"]');
  const ajout = carte ? bouton("Ajouter un set d'aura", carte) : undefined;
  if (!carte || !ajout) return [[false, 'la carte des sets d’aura, en tête de sa colonne ouverte']];
  const avant = await positionStable(ajout);
  await b.geste(() => ajout.click());
  const apres = await positionStable(ajout);
  return [
    [!etat.textContent?.includes('Sets d\'aura des autres monstres') && carte.closest('[data-colonne="complements"]')!.querySelector('section') === carte,
      'bureau : buffs et lead dans les essentiels, les sets d’aura en tête de la colonne « Aura, exclusion, avancés »'],
    [avantOnglet.x === apresOnglet.x && avantOnglet.y === apresOnglet.y, 'ouvrir la colonne garde l’onglet immobile'],
    [avant.x === apres.x && avant.y === apres.y, 'ajouter une aura garde le bouton immobile'],
    [document.documentElement.scrollWidth <= innerWidth, 'cartes de contexte sans débordement'],
    [[...carte.querySelectorAll<HTMLElement>('*')].filter(visible).every(e=>e.getBoundingClientRect().right<=carte.getBoundingClientRect().right),
      'colonne réelle : les contrôles des auras restent dans la carte'],
  ];
}

export async function preparerEquipe(b: BancRetouches) {
  await deplierListes(b);
  await b.geste(() => {
    b.listes().setListContent('a', 'arene');
    b.listes().setTeams([{ id: 'retouches', listId: 'a', members: [b.premier, b.second], leader: b.premier,
      lead: { stat: 'Attack Speed', amount: 24, area: 'Guild', element: null } }]);
  });
}
export async function preuvesEnteteEquipe(b: BancRetouches): Promise<[boolean, string][]> {
  await preparerEquipe(b);
  const equipe = [...document.querySelectorAll<HTMLElement>('section[aria-label="Équipe 1"]')].find(visible)!;
  const modifier = bouton('Modifier l’équipe', equipe), nom = equipe.querySelector<HTMLElement>('[title^="Équipe 1"]')!;
  const compte = [...equipe.querySelectorAll<HTMLElement>('span')].find(e => e.textContent === '⚠ 2 leads inactifs')!;
  if (!nom || !compte) return [[false, 'nom avec infobulle et compteur présents']];
  const m = await positionStable(modifier);
  const n=nom.getBoundingClientRect(), c=compte.getBoundingClientRect();
  const titres = nom.title.replace(/\s*·\s*/g, '·') === nom.textContent?.trim().replace(/\s*·\s*/g, '·');
  await b.geste(() => b.listes().setListContent('a', 'guilde'));
  const apres = await positionStable(modifier);
  return [
    [Math.abs(n.y-c.y) < Math.max(n.height,c.height) && c.x>=n.right && m.y>=Math.max(n.bottom,c.bottom) - 1 && m.right>=c.right - 1,
      'en-tête : compteur à côté du nom, Modifier dessous, à droite'],
    [titres, 'nom tronqué : texte complet en infobulle'],
    [m.x === apres.x && m.y === apres.y, 'compte inactif à place réservée, Modifier immobile'],
    [document.documentElement.scrollWidth<=innerWidth, 'en-tête sans débordement'],
  ];
}

export async function preuvesDialogueElement(b: BancRetouches): Promise<[boolean, string][]> {
  await preparerEquipe(b);
  await b.geste(() => bouton('Modifier l’équipe').click());
  const dialogue = await dialoguePose();
  const menu = dialogue.querySelector<HTMLSelectElement>('[aria-label="Élément du lead de l’équipe"]')!;
  const portee = dialogue.querySelector<HTMLSelectElement>('[aria-label="Portée du lead de l’équipe"]')!;
  const position = await positionStable(menu);
  const preuves: [boolean,string][] = [
    [dialogue.querySelector('[aria-label="Leader de l’équipe"]')?.parentElement?.firstChild?.textContent?.trim() === 'Leader', 'libellé Leader sans facultatif'],
    [menu.disabled && menu.value === '' && menu.selectedOptions[0].textContent === '', 'portée Guilde : Élément désactivé et sans texte'],
  ];
  const changer = (v:string) => b.geste(() => { portee.value=v; portee.dispatchEvent(new Event('change',{bubbles:true})); });
  await changer('Element');
  preuves.push([!menu.disabled && menu.value==='fire', 'portée Élément : choix actif et renseigné']);
  await changer('Arena');
  const apres = await positionStable(menu);
  preuves.push([menu.disabled && menu.value === '' && menu.selectedOptions[0].textContent === '', 'retour Arène : aucune valeur visible']);
  preuves.push([position.x===apres.x && position.y===apres.y && position.width===apres.width, 'menu toujours affiché à la même place']);
  preuves.push([b.listes().teams[0].lead?.area==='Guild', 'changement de portée limité au brouillon']);
  preuves.push([document.documentElement.scrollWidth<=innerWidth, 'dialogue sans débordement']);
  return preuves;
}

export async function preuvesActionsZoneC(b: BancRetouches): Promise<[boolean, string][]> {
  await deplierListes(b);
  await b.geste(() => b.listes().renameList('a', 'Une liste au nom suffisamment long pour exiger une troncature des actions'));
  const ligne = [...document.querySelectorAll<HTMLElement>('[aria-label="Actions de la liste"]')].find(visible)!;
  const actions = [...ligne.querySelectorAll<HTMLButtonElement>('button')];
  const [lier,sauver,reprendre] = actions;
  const rects=actions.map(e=>e.getBoundingClientRect());
  const preuves: [boolean,string][] = [
    [actions.length===3 && lier.textContent==='Lier une équipe' && sauver.textContent?.trim()==='Sauvegarder' && reprendre.textContent?.trim()==='Reprendre', 'trois actions réunies dans leur ordre, ajout par la recherche'],
    [innerWidth>=1024 ? rects.every(r=>r.y===rects[0].y) : new Set(rects.map(r=>r.y)).size===2, 'actions : une ligne au bureau, deux lignes compactes au téléphone'],
  ];
  const a = await positionStable(sauver);
  await b.geste(()=>sauver.click());
  const z = await positionStable(sauver);
  preuves.push([a.x===z.x && a.y===z.y && !reprendre.disabled, 'Sauvegarder immobile et Reprendre activé à sa place']);
  for (const action of [lier, reprendre]) {
    const avant = await positionStable(action);
    await b.geste(()=>action.click());
    await new Promise(r=>setTimeout(r,250));
    const dialogue=document.querySelector<HTMLElement>('[role="dialog"]')!;
    await b.geste(()=>bouton('Annuler',dialogue).click());
    const apres = await positionStable(action);
    preuves.push([avant.x===apres.x && avant.y===apres.y, `${action.textContent?.trim()} garde sa place après ouverture et annulation`]);
  }
  preuves.push([document.documentElement.scrollWidth<=innerWidth, 'actions sans débordement horizontal']);
  return preuves;
}
