// Les compétences auxiliaires de SWARFARM, rangées sous leur compétence par
// `scripts/fetch-skills.mjs` (`Competence.auxiliaires`).
//
// Vérifié sur les VRAIES données de `public/data/skills` : ce qui serait grave
// et invisible, c'est une régénération qui les perdrait (les dégâts de la
// forme archer des anges, des secondes phases, retomberaient à rien sans
// erreur), ou un auxiliaire déjà listé sur le monstre compté deux fois.
// Chaque valeur attendue est relevée dans l'API, jamais relue dans le script.

import { readFileSync, readdirSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { DetailMonstre } from '../src/lib/monsterSkills';
import { egal, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${com2usId}.json`), 'utf8'));
}

function auxiliaireDe(com2usId: number, sort: number) {
  const c = fiche(com2usId).competences.find((k) => k.com2usId === sort);
  return c?.auxiliaires ?? [];
}

export default function testDonneesAuxiliaires() {
  titre('Données — les compétences auxiliaires sont rangées sous leur compétence');

  // Hammer Punch de Tractor eau : l'auxiliaire 11616 désigne le sort (coup en plus).
  const hammer = auxiliaireDe(20811, 11601);
  egal(hammer.map((a) => [a.sens, a.competence.com2usId, a.competence.formule]), [['versCeSort', 11616, '1.8*{DEF}']],
    'Hammer Punch (Tractor eau) : un auxiliaire, versCeSort, 1.8*{DEF}');

  // Anges jumeaux : le Horn et le tir de l'archer se désignent l'un l'autre.
  const corne = auxiliaireDe(29111, 18801);
  egal(corne.map((a) => [a.sens, a.competence.nom, a.competence.formule]), [['mutuel', 'Aim Shot', '3.8*{ATK}']],
    'Horn of Charge (Ramael et Judiah) : Aim Shot, lien mutuel, 3.8*{ATK}');

  // Incarnation Split désigne un sort que rien ne désigne en retour.
  const incarnation = auxiliaireDe(42206, 100906);
  egal(incarnation.map((a) => [a.sens, a.competence.com2usId]), [['depuisCeSort', 100908]],
    'Incarnation Split : un auxiliaire, depuisCeSort');

  // Sans lien, pas de champ (la plupart des sorts).
  const magicRay = fiche(1000101).competences.find((k) => k.com2usId === 10111000);
  ok(magicRay !== undefined && magicRay.auxiliaires === undefined, 'Magic Ray : aucun auxiliaire, champ absent');

  let fichesAvecAuxiliaires = 0;
  let doublons = 0;
  for (const f of readdirSync(DOSSIER_SORTS)) {
    if (!f.endsWith('.json')) continue;
    const d: DetailMonstre = JSON.parse(readFileSync(resolve(DOSSIER_SORTS, f), 'utf8'));
    const listees = new Set(d.competences.map((c) => c.id));
    const aux = d.competences.flatMap((c) => c.auxiliaires ?? []);
    if (aux.length > 0) fichesAvecAuxiliaires++;
    doublons += aux.filter((a) => listees.has(a.competence.id)).length;
  }
  // Témoin : 165 fiches le 2026-10-17 ; un seuil bas, pour qu'un ajout de SWARFARM ne casse rien.
  ok(fichesAvecAuxiliaires >= 150, `témoin : au moins 150 fiches portent des auxiliaires (${fichesAvecAuxiliaires})`);
  egal(doublons, 0, 'aucun auxiliaire n’est aussi une compétence listée du monstre');
}

export function testDonneesFastPaceGeneration() {
  titre('Données — le vrai générateur conserve Fast Pace comme option lumière');
  const dossier = mkdtempSync(resolve(tmpdir(), 'swblacksmith-test-fast-'));
  if (!dossier.startsWith(resolve(tmpdir(), 'swblacksmith-test-fast-'))) throw new Error('Dossier temporaire inattendu');
  try {
    mkdirSync(resolve(dossier, 'scripts'));
    mkdirSync(resolve(dossier, 'public/data/skills'), { recursive: true });
    copyFileSync(resolve(racine, 'scripts/fetch-skills.mjs'), resolve(dossier, 'scripts/fetch-skills.mjs'));
    const ids = [1000204, 1000214, 1000215];
    writeFileSync(resolve(dossier, 'public/data/monsters.json'), JSON.stringify({ monsters: ids.map(com2usId => ({ com2usId })) }));
    const fast = fiche(1000214).competences.find(c => c.com2usId === 10243010)!;
    const competences = new Map(ids.flatMap(id => fiche(id).competences).map(c => [c.id, c]));
    const brutes = [...competences.values()].map(c => ({
      id: c.id, com2us_id: c.com2usId, name: c.nom, description: c.description, slot: c.slot, passive: c.passif,
      aoe: c.aoe, cooltime: c.cooldown, hits: c.coups, max_level: c.niveauMax, multiplier_formula: c.formule,
      scales_with: c.scale, level_progress_description: c.ameliorations,
      icon_filename: c.icone?.split('/').pop() ?? '',
      effects: c.effets.map(e => ({ effect: { name: e.nom, type: e.type, is_buff: e.bonus, description: e.description,
        icon_filename: e.icone?.split('/').pop() ?? '' }, chance: e.chance, quantity: e.quantite, self_effect: e.surSoi,
        aoe: e.aoe, on_crit: e.surCritique, on_death: e.surMort, note: e.note })),
    }));
    const monstres = ids.map(id => ({ com2us_id: id, skills: fiche(id).competences
      .filter(c => id === 1000214 || c.com2usId !== 10243010).map(c => c.id) }));
    const mock = resolve(dossier, 'mock.mjs');
    writeFileSync(mock, [
      "import fs from 'node:fs';",
      'const corpus = JSON.parse(fs.readFileSync(new URL("corpus.json", import.meta.url), "utf8"));',
      'globalThis.fetch = async url => ({ ok: true, json: async () => ({ next: null, results: url.includes("/skills/") ? corpus.skills : corpus.monsters }) });',
    ].join('\n'));
    const entree = resolve(dossier, 'scripts/fetch-skills.mjs');
    writeFileSync(resolve(dossier, 'corpus.json'), JSON.stringify({ skills: brutes, monsters: monstres }));
    execFileSync(process.execPath, ['--import', pathToFileURL(mock).href, entree], { cwd: dossier, stdio: 'pipe' });
    for (const id of ids) {
      const d: DetailMonstre = JSON.parse(readFileSync(resolve(dossier, 'public/data/skills', id + '.json'), 'utf8'));
      egal(d.competences.filter(c => c.com2usId === 10243010).length, id === 1000215 ? 0 : 1,
        id + ' : option lumière présente une fois, même si SWARFARM la rattache déjà');
      if (id !== 1000215) egal(d.competences.find(c => c.com2usId === 10243010), fast, id + ' : description, portée, effets, icône et skill-ups API préservés');
    }
    writeFileSync(resolve(dossier, 'corpus.json'), JSON.stringify({ skills: brutes.filter(c => c.com2us_id !== 10243010), monsters: monstres }));
    const conservee = readFileSync(resolve(dossier, 'public/data/skills/1000214.json'), 'utf8');
    let refus = '';
    try { execFileSync(process.execPath, ['--import', pathToFileURL(mock).href, entree], { cwd: dossier, stdio: 'pipe' }); }
    catch (e) { refus = String((e as { stderr?: Buffer }).stderr); }
    ok(refus.includes('Compétence supplémentaire absente : 10243010'), 'API sans Fast Pace : régénération refusée explicitement');
    egal(readFileSync(resolve(dossier, 'public/data/skills/1000214.json'), 'utf8'), conservee, 'le refus préserve les fiches existantes');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}
