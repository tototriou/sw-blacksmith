// Construit les gabarits de chiffres de la lecture de capture
// (api/_source/capture/chiffres-gabarits.json) :
//   - les dix chiffres de la police Inter (graisses 500, 600, 700), rendus par
//     Chromium en blanc sur fond sombre. Inter est la police installée la plus
//     proche de celle du jeu : seule à lire sans erreur les chiffres relevés
//     sur de vraies captures, avec la plus grande marge ;
//   - les chiffres de VRAIES captures de l'écran de préparation, passées en
//     arguments avec leurs trois VIT attendues, quand on en a. Les captures ne
//     sont jamais versionnées (dépôt public) : seuls les glyphes normalisés
//     (12 × 18 valeurs d'encre) le sont.
//
//   node scripts/construire-gabarits-chiffres.mjs [capture.png 322,268,286]…
//
// ⚠️ Chromium vient de Playwright, et la police Inter doit être installée sur
// le poste.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { decoderImage } from '../api/_source/capture/image';
import { GH, GL, glyphes, masqueClair, normaliser, type Gabarits } from '../api/_source/capture/chiffres';
import { zoneVitesse, DISPOSITIONS } from '../api/_source/capture/ecranPreparation';

const SORTIE = 'api/_source/capture/chiffres-gabarits.json';
const arrondi = (v: Float32Array) => Array.from(v, (x) => Math.round(x * 1000) / 1000);

// Conteneur Linux (claude.ai/code) : Chromium y est préinstallé pour une autre
// version de Playwright. Même repli que tests/banc/session.mjs.
const CHROMIUM_PREINSTALLE = '/opt/pw-browsers/chromium';

async function rendus(): Promise<Record<string, number[][]>> {
  const navigateur = await chromium.launch().catch((err) => {
    if (!existsSync(CHROMIUM_PREINSTALLE)) throw err;
    return chromium.launch({ executablePath: CHROMIUM_PREINSTALLE });
  });
  const page = await navigateur.newPage({ deviceScaleFactor: 1 });
  const sortie: Record<string, number[][]> = {};
  for (const graisse of [500, 600, 700]) {
    await page.setContent(`<body style="margin:0;background:#2a2a2e"><div id="t" style="display:inline-block;padding:8px 12px;color:#fff;font:${graisse} 26px 'Inter';letter-spacing:12px">0123456789</div></body>`);
    if (!(await page.evaluate(() => document.fonts.check("26px 'Inter'")))) throw new Error('police Inter introuvable');
    const img = decoderImage(await page.locator('#t').screenshot())!;
    const m = masqueClair(img);
    const gs = glyphes(m);
    if (gs.length !== 10) throw new Error(`Inter ${graisse} : ${gs.length} glyphes au lieu de 10`);
    gs.forEach((g, i) => (sortie[String(i)] ??= []).push(arrondi(normaliser(m, g))));
  }
  await navigateur.close();
  return sortie;
}

function releves(args: string[]): Record<string, number[][]> {
  const sortie: Record<string, number[][]> = {};
  for (let i = 0; i + 1 < args.length; i += 2) {
    const img = decoderImage(readFileSync(args[i]));
    if (!img) throw new Error(`${args[i]} : image illisible`);
    const attendus = args[i + 1].split(',');
    attendus.forEach((texte, k) => {
      const zone = zoneVitesse(img, DISPOSITIONS.hauteur, k);
      const m = zone && masqueClair(zone);
      const gs = m ? glyphes(m) : [];
      if (!m || gs.length !== texte.length) throw new Error(`${args[i]}, carte ${k + 1} : ${gs.length} glyphes pour « ${texte} »`);
      gs.forEach((g, j) => (sortie[texte[j]] ??= []).push(arrondi(normaliser(m, g))));
    });
  }
  return sortie;
}

const chiffres = await rendus();
for (const [c, vs] of Object.entries(releves(process.argv.slice(2)))) chiffres[c].push(...vs);
const gabarits: Gabarits = { l: GL, h: GH, chiffres };
writeFileSync(SORTIE, JSON.stringify(gabarits) + '\n');
console.log(`gabarits : ${Object.entries(chiffres).map(([c, v]) => `${c}×${v.length}`).join(' ')} → ${SORTIE}`);
