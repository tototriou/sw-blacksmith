// La notification du plugin SWEX à remplacer, dans un vrai navigateur
// (tests/rendu/notif-plugin-banc.tsx) : elle se dit une fois, reste, ouvre la
// page SW Exporter, et revient après une annonce passagère.
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';

export async function testRenduNotifPlugin() {
  titre('rendu · notification du plugin SWEX à remplacer');
  const { browser, page } = await navigateurOptimizer(false, 'tests/rendu/notif-plugin-banc.tsx');
  try {
    const preuves = await page.evaluate(() =>
      (globalThis as unknown as { bancOptimizer: { scenario: () => Promise<[boolean, string][]> } }).bancOptimizer.scenario()
    );
    ok(preuves.length > 0, 'scénario exécuté sur le composant et le fournisseur réels');
    for (const [condition, texte] of preuves) ok(condition, texte);
  } finally {
    await browser.close();
  }
}
