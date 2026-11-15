// Construit la banque de portraits de la lecture de capture
// (api/_source/capture/banque-portraits.json) : une signature par icône
// SWARFARM de monstre obtenable et éveillé (public/data/monsters.json).
//
// Lancé à la demande, quand les données des monstres changent :
//   node scripts/construire-banque-portraits.mjs
// Les icônes sont gardées dans node_modules/.cache/portraits-swarfarm : une
// reconstruction ne retélécharge que les nouvelles.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decoderImage } from '../api/_source/capture/image';
import { COTE, quantifier, signature, TAILLE, type BanqueSerialisee } from '../api/_source/capture/portraits';
import type { Monster } from '../src/types';

const CACHE = 'node_modules/.cache/portraits-swarfarm';
const SORTIE = 'api/_source/capture/banque-portraits.json';
const PARALLELE = 8;

// Monstre de la banque : obtenable, avec une icône, et éveillé. La forme non
// éveillée (chiffre des dizaines du com2usId à 0) n'entre jamais en siège, et
// son portrait ressemble à celui de la forme éveillée : elle volait la
// reconnaissance.
type MonstreRetenu = Monster & { com2usId: number };
const retenu = (m: Monster): m is MonstreRetenu =>
  m.com2usId != null && Boolean(m.obtainable && m.image) && Math.floor(m.com2usId / 10) % 10 !== 0;

// Une paire collab ⇄ SW est un seul monstre : la référence est la forme au
// plus petit com2usId, comme la carte du bestiaire.
const reference = (m: MonstreRetenu) => (m.jumeauCollab != null ? Math.min(m.com2usId, m.jumeauCollab) : m.com2usId);

async function icone(m: MonstreRetenu): Promise<Uint8Array | null> {
  const fichier = join(CACHE, `${m.com2usId}.png`);
  if (existsSync(fichier)) return readFileSync(fichier);
  for (let essai = 0; essai < 3; essai++) {
    try {
      const r = await fetch(m.image!);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(String(r.status));
      const octets = new Uint8Array(await r.arrayBuffer());
      writeFileSync(fichier, octets);
      return octets;
    } catch {
      await new Promise((ok) => setTimeout(ok, 1000 * (essai + 1)));
    }
  }
  return null;
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const { monsters } = JSON.parse(readFileSync('public/data/monsters.json', 'utf8')) as { monsters: Monster[] };
  const monstres = monsters.filter(retenu);
  const resultats: ({ id: number; dessin: Int8Array; teinte: [number, number] } | null)[] = new Array(monstres.length).fill(null);
  let suivant = 0;
  const manquants: string[] = [];
  await Promise.all(Array.from({ length: PARALLELE }, async () => {
    while (suivant < monstres.length) {
      const i = suivant++;
      const m = monstres[i];
      const octets = await icone(m);
      const img = octets && decoderImage(octets);
      const sig = img && signature(img);
      if (!sig) { manquants.push(`${m.name} (${m.com2usId})`); continue; }
      resultats[i] = { id: reference(m), dessin: quantifier(sig.dessin), teinte: sig.teinte };
    }
  }));
  const gardes = resultats.filter((r): r is NonNullable<typeof r> => r !== null);
  const dessins = new Int8Array(gardes.length * TAILLE);
  gardes.forEach((g, k) => dessins.set(g.dessin, k * TAILLE));
  const banque: BanqueSerialisee = {
    version: 1,
    cote: COTE,
    ids: gardes.map((g) => g.id),
    teintes: gardes.flatMap((g) => g.teinte.map((v) => Math.round(v * 1e4) / 1e4)),
    dessins: Buffer.from(dessins.buffer).toString('base64'),
  };
  writeFileSync(SORTIE, JSON.stringify(banque) + '\n');
  console.log(`banque : ${gardes.length} portraits sur ${monstres.length} monstres retenus → ${SORTIE}`);
  if (manquants.length) console.log(`sans icône lisible : ${manquants.join(', ')}`);
}

await main();
