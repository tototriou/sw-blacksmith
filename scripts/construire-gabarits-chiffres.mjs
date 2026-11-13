// Lanceur : empaquette scripts/construire-gabarits-chiffres.ts avec esbuild,
// puis l'exécute avec Node. Playwright reste hors du paquet (il ne s'empaquette
// pas) : le paquet est écrit dans node_modules/.cache pour le retrouver.

import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dossier = 'node_modules/.cache/gabarits-chiffres';
mkdirSync(dossier, { recursive: true });
const sortie = join(dossier, 'gabarits.mjs');

try {
  await build({
    entryPoints: ['scripts/construire-gabarits-chiffres.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['playwright'],
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    outfile: sortie,
    logLevel: 'error',
  });
} catch {
  process.exit(1); // esbuild a déjà tout dit
}

const code = await new Promise((resolve) => {
  const p = spawn(process.execPath, [sortie, ...process.argv.slice(2)], { stdio: 'inherit' });
  p.on('close', resolve);
});

rmSync(dossier, { recursive: true, force: true });
process.exit(code ?? 1);
