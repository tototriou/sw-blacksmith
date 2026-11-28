// Construit les gabarits de chiffres de la lecture de capture
// (src/lib/capture/chiffres-gabarits.json) :
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
//   node scripts/construire-gabarits-chiffres.mjs --ajouter capture.png 364,396,361
//
// `--ajouter` complète le fichier existant avec les glyphes des captures
// données, sans rien refaire : les glyphes déjà relevés viennent de captures
// qu'on n'a plus forcément (elles ne sont pas versionnées), et une
// reconstruction complète les perdrait.
//
// Les cartes de chaque capture et leur pastille de VIT sont trouvées comme à
// la lecture, et les chiffres découpés de même.
//
// ⚠️ Chromium vient de Playwright, et la police Inter doit être installée sur
// le poste.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { decoderImage } from '../api/_source/capture/decodage';
import { GH, GL, glyphes, glyphesDuNombre, masqueClair, normaliser, type Gabarits } from '../src/lib/capture/chiffres';
import { zoneVitesse } from '../src/lib/capture/pastille';
import { trouverCartes } from '../src/lib/capture/cartes';

const SORTIE = 'src/lib/capture/chiffres-gabarits.json';
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
    const cartes = trouverCartes(img);
    if (!cartes) throw new Error(`${args[i]} : les trois cadres des attaquants ne sont pas trouvés`);
    attendus.forEach((texte, k) => {
      const zone = zoneVitesse(img, cartes.attaquants[k]);
      const m = zone && masqueClair(zone);
      const gs = m ? glyphesDuNombre(m) : [];
      if (!m || gs.length !== texte.length) throw new Error(`${args[i]} : la pastille de la carte ${k + 1} ne donne pas les chiffres de « ${texte} »`);
      gs.forEach((g, j) => (sortie[texte[j]] ??= []).push(arrondi(normaliser(m, g))));
    });
  }
  return sortie;
}

const ajouter = process.argv.includes('--ajouter');
const args = process.argv.slice(2).filter((a) => a !== '--ajouter');
const chiffres = ajouter ? (JSON.parse(readFileSync(SORTIE, 'utf8')) as Gabarits).chiffres : await rendus();
for (const [c, vs] of Object.entries(releves(args))) (chiffres[c] ??= []).push(...vs);
const gabarits: Gabarits = { l: GL, h: GH, chiffres };
writeFileSync(SORTIE, JSON.stringify(gabarits) + '\n');
console.log(`gabarits : ${Object.entries(chiffres).map(([c, v]) => `${c}×${v.length}`).join(' ')} → ${SORTIE}`);
