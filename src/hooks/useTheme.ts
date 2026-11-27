import { useSyncExternalStore } from 'react';
import { selonSupport } from '../lib/bureau';
import type { Dictionnaire } from '../i18n';

// Thème de l'application : **Forge** (sombre), **Givre** (clair, le défaut)
// ou **Atelier** (clair, au choix). Voir docs/03-developpeur/interface/.
//
// ⚠️ TROIS états, pas un interrupteur. Un binaire clair/sombre force à choisir
// une valeur qui cesse alors de suivre le système : quelqu'un dont le téléphone
// bascule en sombre le soir perdrait ce comportement sans l'avoir demandé.
export type ThemeChoice = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
// Lequel des deux thèmes clairs s'applique quand le thème appliqué est clair.
// ⚠️ Un réglage à part, pas un quatrième cran du choix ci-dessus : « Auto »
// doit pouvoir suivre le système ET retomber sur Atelier en clair.
export type ThemeClair = 'givre' | 'atelier';

// Les trois choix et leurs textes, dans la langue affichée. ⚠️ Lu à
// l'affichage : dans l'app de bureau, c'est le thème du système que suit
// « Auto » (application de bureau).
export function choixTheme(t: Dictionnaire): { key: ThemeChoice; label: string; hint: string }[] {
  return [
    { key: 'auto', label: t.theme.auto, hint: selonSupport(t.theme.autoNavigateur, t.theme.autoSysteme) },
    { key: 'light', label: t.theme.clair, hint: t.theme.clairAide },
    { key: 'dark', label: t.theme.sombre, hint: t.theme.sombreAide },
  ];
}

// Les deux thèmes clairs, par leur nom : un nom propre, le même dans chaque
// langue ; seule l'aide se traduit.
export function choixThemeClair(t: Dictionnaire): { key: ThemeClair; label: string; hint: string }[] {
  return [
    { key: 'givre', label: t.theme.givre, hint: t.theme.givreAide },
    { key: 'atelier', label: t.theme.atelier, hint: t.theme.atelierAide },
  ];
}

// **Persisté** dans `localStorage`, même si la conservation est refusée : c'est
// un RÉGLAGE, pas une donnée de l'utilisateur — au même titre que la mesure de
// score ou le choix de conservation lui-même. Un thème oublié à chaque visite
// serait un bug, pas une protection. Voir docs/03-developpeur/ § Persistance.
const STORAGE_KEY = 'swblacksmith-theme-v1';
// ⚠️ Lue aussi par le script inline d'index.html, avant la première peinture.
export const CLE_THEME_CLAIR = 'swblacksmith-theme-clair-v1';

function load(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

// Toute autre valeur que `atelier` vaut Givre : c'est le défaut, et celui
// d'un stockage vide ou illisible.
export function lireThemeClair(valeur: string | null): ThemeClair {
  return valeur === 'atelier' ? 'atelier' : 'givre';
}

function loadClair(): ThemeClair {
  try {
    return lireThemeClair(localStorage.getItem(CLE_THEME_CLAIR));
  } catch {
    return 'givre';
  }
}

let current: ThemeChoice = load();
let clair: ThemeClair = loadClair();
const listeners = new Set<() => void>();

// Media query gardée en module : elle sert à résoudre `auto` ET à réagir quand
// le système bascule pendant que la page est ouverte.
const mql = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function resolveTheme(choice: ThemeChoice = current): ResolvedTheme {
  if (choice !== 'auto') return choice;
  return mql?.matches ? 'dark' : 'light';
}

// Pose l'attribut lu par index.css. ⚠️ En `auto` on RETIRE l'attribut plutôt que
// d'écrire la valeur résolue : c'est la media query qui décide, et l'absence
// d'attribut est justement ce que `:root:not([data-theme='light'])` attend.
function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

export function setTheme(choice: ThemeChoice) {
  if (choice === current) return;
  current = choice;
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* stockage indisponible : le thème vaut pour la session */
  }
  apply(choice);
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

// Pose l'attribut lu par index.css. Givre est le `:root` nu : on RETIRE
// l'attribut plutôt que d'écrire `givre`, comme `auto` retire `data-theme`.
function applyClair(choix: ThemeClair) {
  const root = document.documentElement;
  if (choix === 'atelier') root.setAttribute('data-theme-clair', 'atelier');
  else root.removeAttribute('data-theme-clair');
}

export function setThemeClair(choix: ThemeClair) {
  if (choix === clair) return;
  clair = choix;
  try {
    localStorage.setItem(CLE_THEME_CLAIR, choix);
  } catch {
    /* stockage indisponible : le thème clair vaut pour la session */
  }
  applyClair(choix);
  for (const l of listeners) l();
}

export function useThemeClair(): ThemeClair {
  return useSyncExternalStore(subscribe, () => clair, () => clair);
}

// Le thème RÉELLEMENT appliqué, `auto` résolu. Utile aux rares endroits qui
// doivent adapter autre chose qu'une couleur (une image, un mode de rendu).
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(
    (l) => {
      const un = subscribe(l);
      mql?.addEventListener('change', l);
      return () => {
        un();
        mql?.removeEventListener('change', l);
      };
    },
    () => resolveTheme(),
    () => 'light' as ResolvedTheme
  );
}

// Le script d'index.html a posé les deux attributs avant la première peinture,
// d'après le stockage de CET instant. Une session chargée au démarrage
// (application de bureau) écrit ses réglages après lui, et avant l'import de
// ce module : on repose ce qu'on vient de lire, sinon elle ne changerait de
// thème qu'au lancement suivant.
if (typeof document !== 'undefined') {
  apply(current);
  applyClair(clair);
}

// ⚠️ En mode `auto`, un basculement système doit se voir SANS rechargement.
// Sans ce réveil, quelqu'un dont l'OS passe en sombre le soir garderait le
// thème clair jusqu'au prochain F5.
if (mql) {
  mql.addEventListener('change', () => {
    if (current === 'auto') for (const l of listeners) l();
  });
}
