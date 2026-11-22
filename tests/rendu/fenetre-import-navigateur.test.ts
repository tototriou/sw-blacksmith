import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';

// La fenêtre d'import dans un vrai navigateur, aux deux formats : changer de
// source remplace la liste, même quand Mes équipes revient plusieurs fois au
// même contenu.
async function verifier(telephone: boolean) {
  titre(`Fenêtre d’import · changer de source · ${telephone ? 'téléphone' : 'bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone, 'tests/rendu/fenetre-import-banc.tsx');
  try {
    const preuves = await page.evaluate(() => (globalThis as unknown as {
      bancOptimizer: { scenario: () => Promise<[boolean, string][]> };
    }).bancOptimizer.scenario());
    ok(preuves.length > 0, 'scénario joué');
    for (const [condition, texte] of preuves) ok(condition, texte);
  } finally { await browser.close(); }
}
export const testRenduFenetreImportSources = () => verifier(false);
export const testRenduTelephoneFenetreImportSources = () => verifier(true);
