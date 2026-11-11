// Tests au navigateur de l'aperçu replié d'une recommandation : la mesure se
// fait sur la vraie mise en page, que le rendu serveur ne voit pas. Banc :
// apercu-recos-banc.tsx.
//
// ⚠️ Le cas qui a vidé l'application de bureau (v2.4.0) : une recommandation de
// plus de 200 decks. Retirer une pastille par rendu dépassait les 50 rendus
// imbriqués que React tolère, et toute l'app était démontée.
import type { Page } from 'playwright';
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';

const BANC = 'tests/rendu/apercu-recos-banc.tsx';
type Banc = { monter: (n: number, largeur: number) => void; elargir: (largeur: number) => void };

// Les rangées occupées (par chevauchement vertical, comme le composant), les
// pastilles visibles et le « +N ».
const lire = (page: Page) => page.evaluate(() => {
  const zone = document.querySelector('[data-apercu-reco]')!;
  let lignes = 0;
  let bas = -Infinity;
  for (const c of zone.children) {
    const r = c.getBoundingClientRect();
    if (r.top >= bas - 1) { lignes += 1; bas = r.bottom; } else bas = Math.max(bas, r.bottom);
  }
  return {
    lignes,
    visibles: zone.querySelectorAll('[data-pastille]').length,
    plus: zone.querySelector('[data-apercu-plus]')?.textContent ?? null,
    fin: !!zone.querySelector('[data-fin]'),
  };
});

export async function testRenduRecosApercuCentainesDeDecks() {
  titre('rendu · recos — aperçu replié : 250 decks sur deux lignes, sans démonter l’app');
  const { browser, page } = await navigateurOptimizer(false, BANC);
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  try {
    await page.evaluate(() => (globalThis as unknown as { bancOptimizer: Banc }).bancOptimizer.monter(250, 320));
    await page.waitForTimeout(100);
    const etroit = await lire(page);
    ok(erreurs.length === 0, `aucune erreur de la page (${erreurs.join(' | ') || 'aucune'})`);
    ok(etroit.lignes <= 2 && etroit.fin, `320 px : deux lignes au plus, la fin comprise (${JSON.stringify(etroit)})`);
    ok(etroit.visibles > 0 && etroit.plus === `+${250 - etroit.visibles}`, `320 px : le « +N » compte les pastilles cachées (${etroit.visibles} visibles, ${etroit.plus})`);

    // Plus large : la recherche repart, davantage de pastilles tiennent.
    await page.evaluate(() => (globalThis as unknown as { bancOptimizer: Banc }).bancOptimizer.elargir(900));
    await page.waitForTimeout(200);
    const large = await lire(page);
    ok(erreurs.length === 0, 'élargie : toujours aucune erreur');
    ok(large.lignes <= 2 && large.visibles > etroit.visibles && large.plus === `+${250 - large.visibles}`,
      `900 px : davantage de pastilles, toujours deux lignes au plus (${JSON.stringify(large)})`);

    // Peu de decks : tout tient, aucun « +N ».
    await page.evaluate(() => (globalThis as unknown as { bancOptimizer: Banc }).bancOptimizer.monter(3, 900));
    await page.waitForTimeout(100);
    const peu = await lire(page);
    ok(peu.visibles === 3 && peu.plus === null && peu.lignes === 1, `3 decks à 900 px : tous visibles, sans « +N » (${JSON.stringify(peu)})`);
  } finally { await browser.close(); }
}
