// Lanceur : empaquette scripts/construire-banque-portraits.ts avec esbuild,
// puis l'exécute avec Node (même patron que scripts/benchmark-optim.mjs).

import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dossier = mkdtempSync(join(tmpdir(), 'swblacksmith-banque-'));
const sortie = join(dossier, 'banque.mjs');

try {
  await build({
    entryPoints: ['scripts/construire-banque-portraits.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    // pngjs, en CommonJS, fait des `require` de modules de Node : un paquet
    // ESM n'en a pas sans ce `require` recréé.
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    outfile: sortie,
    logLevel: 'error',
  });
} catch {
  process.exit(1); // esbuild a déjà tout dit
}

const code = await new Promise((resolve) => {
  const p = spawn(process.execPath, [sortie], { stdio: 'inherit', cwd: process.cwd() });
  p.on('close', resolve);
});

rmSync(dossier, { recursive: true, force: true });
process.exit(code ?? 1);
