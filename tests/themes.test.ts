// Les trois thèmes (docs/03-developpeur/interface/design/themes.md) : Givre,
// le clair par défaut ; Atelier, le clair au choix ; Forge, le sombre.
//
// Les jetons se lisent dans la feuille elle-même : une couleur n'existe nulle
// part ailleurs, et c'est l'ORDRE des blocs qui décide lequel l'emporte quand
// deux attributs sont posés (`data-theme-clair="atelier"` sous un thème sombre).

import { readFileSync } from 'node:fs';
import { CLE_THEME_CLAIR, choixThemeClair, lireThemeClair, setThemeClair } from '../src/hooks/useTheme';
import { en } from '../src/i18n/en';
import { fr } from '../src/i18n/fr';
import { egal, faussLocalStorage, ok, titre } from './outils';

type Jetons = Map<string, string>;

const BRUT = readFileSync('src/index.css', 'utf8');
const CSS = BRUT.replace(/\/\*[\s\S]*?\*\//g, '');

// Le corps du bloc qui s'ouvre par `entete`, à la n-ième occurrence. Les blocs
// de thème n'imbriquent rien d'autre que leurs déclarations.
function corps(entete: string, occurrence = 0): { texte: string; debut: number } {
  let debut = -1;
  for (let i = 0; i <= occurrence; i++) debut = CSS.indexOf(entete, debut + 1);
  if (debut < 0) throw new Error(`bloc « ${entete} » introuvable dans la feuille`);
  const ouverture = debut + entete.length;
  return { texte: CSS.slice(ouverture, CSS.indexOf('}', ouverture)), debut };
}

function jetons(texte: string): Jetons {
  return new Map([...texte.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const RACINE = corps('\n:root {');
const ATELIER = corps("\n:root[data-theme-clair='atelier'] {");
const VALEURS_FORGE = corps('\n:root {', 1);
const FORGE_SYSTEME = corps("\n  :root:not([data-theme='light']) {");
const FORGE_FORCE = corps("\n:root[data-theme='dark'] {");

const givre = jetons(RACINE.texte);
const atelier = new Map([...givre, ...jetons(ATELIER.texte)]);
// Forge tel qu'il s'applique : chaque jeton que le déclencheur renvoie à sa
// variable `--forge-*`, résolu.
const valeursForge = jetons(VALEURS_FORGE.texte);
const forge = new Map(givre);
for (const [nom, valeur] of jetons(FORGE_FORCE.texte)) {
  const renvoi = valeur.match(/^var\(--(forge-[a-z0-9-]+)\)$/);
  forge.set(nom, renvoi ? (valeursForge.get(renvoi[1]) ?? valeur) : valeur);
}

const canaux = (valeur: string | undefined): number[] | null => {
  const m = valeur?.match(/^(\d+) (\d+) (\d+)$/);
  return m ? m.slice(1).map(Number) : null;
};
const lineaire = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (c: number[]) => 0.2126 * lineaire(c[0]) + 0.7152 * lineaire(c[1]) + 0.0722 * lineaire(c[2]);
function contraste(theme: Jetons, a: string, b: string): number {
  const [x, y] = [canaux(theme.get(a)), canaux(theme.get(b))];
  if (!x || !y) return 0;
  const [clair, fonce] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (clair + 0.05) / (fonce + 0.05);
}

const SURFACES = ['bg', 'panel', 'panel2'];
const TEXTE = ['ink', 'ink-dim', 'ink-dimmer', 'accent-lisible', 'good', 'warn', 'bad'];
const ELEMENTS = ['fire', 'water', 'wind', 'light', 'dark', 'unknown'];

export function testThemesBlocs() {
  titre('thèmes · Givre par défaut, Atelier au choix, Forge par-dessus');

  const propres = jetons(ATELIER.texte);
  ok(propres.size > 0 && [...propres.values()].every((v) => canaux(v) !== null), 'Atelier ne pose que des couleurs, en canaux');
  egal([...propres.keys()].filter((nom) => !givre.has(nom)), [], 'Atelier ne redéfinit que des jetons que Givre définit');
  egal([...propres].filter(([nom, valeur]) => givre.get(nom) === valeur).map(([nom]) => nom), [], 'Atelier ne répète pas une valeur que Givre a déjà');

  // ⚠️ Les trois sélecteurs ont la même spécificité : c'est la place dans la
  // feuille qui fait gagner Forge quand `data-theme-clair="atelier"` reste
  // posé sous un thème sombre.
  ok(ATELIER.debut > RACINE.debut && ATELIER.debut < FORGE_SYSTEME.debut && ATELIER.debut < FORGE_FORCE.debut, 'le bloc d’Atelier vient avant les deux déclencheurs de Forge');
  const sombres = jetons(FORGE_FORCE.texte);
  egal([...propres.keys()].filter((nom) => !sombres.has(nom)), [], 'tout jeton d’Atelier est repris par Forge : aucun ne traverse en sombre');
  egal([...jetons(FORGE_SYSTEME.texte)], [...sombres], 'sombre du système et sombre forcé : les mêmes déclarations');
  egal([...sombres].filter(([, valeur]) => !/^var\(--forge-[a-z0-9-]+\)$/.test(valeur)).map(([nom]) => nom), [], 'Forge ne pose aucune valeur dans ses déclencheurs : chacune renvoie à une variable `--forge-*`');

  // L'application de bureau habille sa fenêtre de la PREMIÈRE déclaration de
  // ces trois jetons (scripts/construire-bureau.mjs) : celle du clair par défaut.
  for (const nom of ['bg', 'bar', 'ink']) {
    egal(BRUT.match(new RegExp(`--${nom}:\\s*(\\d+ \\d+ \\d+)\\s*;`))?.[1], givre.get(nom), `première déclaration de --${nom} : celle de Givre`);
  }
}

export function testThemesContrastes() {
  titre('thèmes · contrastes tenus par chaque thème');
  for (const [nom, theme] of [['Givre', givre], ['Atelier', atelier], ['Forge', forge]] as const) {
    const sous = (seuil: number, paires: [string, string][]) =>
      paires.filter(([a, b]) => contraste(theme, a, b) < seuil).map(([a, b]) => `${a} sur ${b} : ${contraste(theme, a, b).toFixed(2)}`);
    egal(sous(4.5, TEXTE.flatMap((t) => SURFACES.map((s): [string, string] => [t, s]))), [], `${nom} : le texte tient 4,5 sur les trois surfaces`);
    egal(
      sous(4.5, [...ELEMENTS.map((e): [string, string] => [`el-${e}`, 'panel']), ['star', 'panel']]),
      [],
      `${nom} : les éléments et le laiton tiennent 4,5 sur panel`,
    );
    egal(
      sous(4.5, [['accent-lisible', 'accent-soft'], ['good', 'good-soft'], ['warn', 'warn-soft'], ['bad', 'bad-soft'], ['accent-ink', 'accent'], ['bad-ink', 'bad']]),
      [],
      `${nom} : chaque couleur tient 4,5 sur son fond doux, chaque libellé sur son aplat`,
    );
    egal(sous(4.5, ELEMENTS.map((e): [string, string] => ['ink', `el-${e}-soft`])), [], `${nom} : l’encre tient 4,5 sur les fonds doux d’élément`);
    egal(
      sous(4.5, ['ink', 'ink-dim', 'ink-dimmer', 'warn'].flatMap((t) => ['equipe-a', 'equipe-b'].map((b): [string, string] => [t, b]))),
      [],
      `${nom} : les encres tiennent 4,5 sur les deux bandes d’équipes`,
    );
    ok(contraste(theme, 'panel2', 'panel') >= 1.1, `${nom} : panel2 se détache de panel (${contraste(theme, 'panel2', 'panel').toFixed(2)})`);
  }
  // Ce qui fait de Givre un autre thème qu'Atelier : des surfaces sans teinte
  // chaude (le bleu n'y est jamais sous le rouge), et la même braise en aplat.
  for (const s of ['bg', 'bar', 'panel', 'panel2', 'border', 'border-soft']) {
    const c = canaux(givre.get(s))!;
    ok(c[2] >= c[0], `Givre : ${s} n’est pas chaud`);
  }
  egal(givre.get('accent'), '255 122 26', 'Givre : la braise vive de l’app');
  ok(!jetons(ATELIER.texte).has('accent'), 'Atelier garde la même braise vive');
}

export function testThemeClairReglage() {
  titre('thèmes · le réglage « Thème clair »');
  egal([null, '', 'givre', 'atelier', 'forge', 'ATELIER'].map(lireThemeClair), ['givre', 'givre', 'givre', 'atelier', 'givre', 'givre'], 'toute valeur autre qu’« atelier » vaut Givre');
  egal(choixThemeClair(fr).map((c) => [c.key, c.label, c.hint]), [['givre', 'Givre', 'Gris doux, cartes blanches'], ['atelier', 'Atelier', 'Papier chaud, encre chaude']], 'deux choix, Givre en premier');
  egal(choixThemeClair(en).map((c) => [c.key, c.label, c.hint]), [['givre', 'Givre', 'Soft greys, white cards'], ['atelier', 'Atelier', 'Warm paper, warm ink']], 'en anglais : les mêmes noms, l’aide traduite');

  // Le script d'index.html pose l'attribut avant la première peinture, par la
  // même clé et la même valeur que le hook.
  const index = readFileSync('index.html', 'utf8');
  ok(index.includes(`localStorage.getItem('${CLE_THEME_CLAIR}') === 'atelier'`) && index.includes("setAttribute('data-theme-clair', 'atelier')"), 'index.html lit la même clé, et pose le même attribut');

  const mem = faussLocalStorage({});
  const attributs = new Map<string, string>();
  const avant = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    documentElement: {
      setAttribute: (nom: string, valeur: string) => void attributs.set(nom, valeur),
      removeAttribute: (nom: string) => void attributs.delete(nom),
    },
  };
  try {
    setThemeClair('atelier');
    egal([mem.get(CLE_THEME_CLAIR), attributs.get('data-theme-clair')], ['atelier', 'atelier'], 'Atelier : écrit, et posé sur la racine');
    setThemeClair('givre');
    egal([mem.get(CLE_THEME_CLAIR), attributs.has('data-theme-clair')], ['givre', false], 'Givre : écrit, et l’attribut retiré (le `:root` nu)');
  } finally {
    (globalThis as { document?: unknown }).document = avant;
  }
}
