// La traduction anglaise des phrases curées de damage.ts
// (`PHRASES_DEGATS_EN`, src/i18n/phrasesDegats.ts).
//
// ⚠️ Ce qui serait INVISIBLE ici : une curation ajoutée ou réécrite (un
// libellé, une condition, une aide, un texte « Calcul partiel ») sans son
// entrée s'afficherait en français dans l'écran anglais, sans que rien ne
// casse. Les phrases se relèvent dans la SOURCE de damage.ts, parce que la
// plupart des tables curées ne sont pas exportées : c'est le seul endroit où
// toutes se lisent.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import ts from 'typescript';
import { egal, ok, titre } from './outils';
import { PHRASES_DEGATS_EN, phraseDegats } from '../src/i18n/phrasesDegats';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

// Les propriétés dont l'écran affiche la valeur, et la table « Calcul partiel ».
const PROPRIETES_AFFICHEES = new Set(['label', 'condition', 'libelle', 'aide', 'raison', 'detail']);
// Des noms de compétences du jeu, déjà ceux du jeu anglais, et des effets dont
// le libellé de l'app est le nom SWARFARM : rien à traduire.
const NOMS_DU_JEU = new Set(['Fierce Attack!', 'Attack Instinct', 'Dark Guardian', 'Rankyaku', 'Accelerando', 'Silence', 'Suppression']);
// La valeur d'exemple d'une phrase à gabarit (`${profil.nom} se déclenche…`).
const EXEMPLE = 'Tempest (Passive)';

function phrasesCurees(): string[] {
  const chemin = resolve(racine, 'src/lib/damage.ts');
  const source = ts.createSourceFile(chemin, readFileSync(chemin, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const phrases = new Set<string>();
  const texte = (n: ts.Node): string | null => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
    if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map((s) => EXEMPLE + s.literal.text).join('');
    return null;
  };
  const visiter = (n: ts.Node) => {
    if (ts.isPropertyAssignment(n) && PROPRIETES_AFFICHEES.has(n.name.getText())) {
      const s = texte(n.initializer);
      if (s != null) phrases.add(s);
    }
    if (ts.isVariableDeclaration(n) && n.name.getText() === 'CALCUL_PARTIEL_PAR_ID' && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      for (const p of n.initializer.properties) {
        const s = ts.isPropertyAssignment(p) ? texte(p.initializer) : null;
        if (s != null) phrases.add(s);
      }
    }
    ts.forEachChild(n, visiter);
  };
  visiter(source);
  return [...phrases];
}

export function testCouverturePhrasesDegats() {
  titre('phrases des dégâts réels — couverture de la traduction anglaise');
  const phrases = phrasesCurees();
  ok(phrases.length > 100, `le relevé lit bien damage.ts (${phrases.length} phrases)`);
  egal(phrases.filter((p) => !NOMS_DU_JEU.has(p) && phraseDegats(p, 'en') === p), [], 'chaque phrase curée a sa traduction anglaise');
  const relevees = new Set(phrases);
  egal(Object.keys(PHRASES_DEGATS_EN).filter((k) => !relevees.has(k)), [], 'aucune entrée dont la phrase n’existe plus dans damage.ts');
  egal([...NOMS_DU_JEU].filter((n) => !relevees.has(n)), [], 'chaque nom du jeu exempté existe encore');
  egal(phrases.filter((p) => phraseDegats(p, 'fr') !== p), [], 'en français, chaque phrase reste telle quelle');
  egal(Object.values(PHRASES_DEGATS_EN).filter((s) => /[àâçéèêîôûœ«»]|\b(le|la|les|des|est|sur|pour|une?)\b/i.test(s)), [],
    'aucune traduction restée en français');
  egal(phraseDegats(`${EXEMPLE} se déclenche à la suite de ce sort (probabilité du jeu non tirée)`, 'en'),
    `${EXEMPLE} triggers following this skill (in-game chance not rolled)`, 'une phrase à valeur : le motif garde le nom');
  egal(phraseDegats('Thousand Shots', 'en'), 'Thousand Shots', 'un nom de sort sans entrée s’affiche tel quel');
}
