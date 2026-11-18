// Analyse automatique du speed tune — deux boosts d'ATB d'équipe à la suite.
//
// Kabilla (Alert, +30 % de barre à l'équipe) puis Eludia (Purifying Blaze,
// +15 %), avant Trinity et Lagmaron. Les vitesses requises se cherchaient sur
// les grilles figées aux vitesses du moment : quand Eludia ne jouait pas encore
// juste après Kabilla, son boost restait écrit trop tard, et les vitesses
// annoncées pour Trinity et Lagmaron ne comptaient que celui de Kabilla —
// surévaluées. Kits réels (public/data/skills).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Monster } from '../src/types';
import type { DetailMonstre } from '../src/lib/monsterSkills';
import { analyseAutomatique, sortRetenu, type DonneesKit, type EntreeAuto } from '../src/lib/speedTuneAuto';
import { diagnostiquerSequence, fenetresRequises } from '../src/lib/speedTune';
import { appliquerMods, entreeDe, ligneReference, ligneVierge, plateauDeLignes, plateauDesRequis, tuneDe, type Leads } from '../src/lib/speedTuneLignes';
import { kitVitesse, sortsVitesse } from '../src/lib/speedTuneKit';
import { passifsVitesse } from '../src/lib/speedTunePassif';
import { egal, monstersJson, ok, titre } from './outils';

const EQUIPE = { Kabilla: 10514, Eludia: 14514, Trinity: 13815, Lagmaron: 14613 } as const;
type Nom = keyof typeof EQUIPE;

function preparer(): { donnees: DonneesKit; entree: (nom: Nom, runeSpeed: number) => EntreeAuto } {
  const monstres = monstersJson() as Monster[];
  const donnees: DonneesKit = { kits: new Map(), sorts: new Map(), passifs: new Map() };
  for (const c of Object.values(EQUIPE)) {
    const detail = JSON.parse(readFileSync(resolve('public/data/skills', `${c}.json`), 'utf8')) as DetailMonstre;
    donnees.kits.set(c, kitVitesse(detail));
    donnees.sorts.set(c, sortsVitesse(detail));
    donnees.passifs.set(c, passifsVitesse(detail));
  }
  const entree = (nom: Nom, runeSpeed: number): EntreeAuto => ({
    id: nom,
    monster: monstres.find((m) => m.com2usId === EQUIPE[nom])!,
    runeSpeed,
    swift: false,
  });
  return { donnees, entree };
}

export function testSpeedTuneDeuxBoostsAtb() {
  titre('Speed tuning · analyse auto — deux boosts d’ATB d’équipe à la suite');
  const { donnees, entree } = preparer();
  const analyser = (v: Record<Nom, number>) =>
    analyseAutomatique((Object.keys(EQUIPE) as Nom[]).map((n) => entree(n, v[n])), 0, donnees);

  // Eludia trop lente : elle joue après Trinity et Lagmaron, son boost aussi.
  const depart: Record<Nom, number> = { Kabilla: 150, Eludia: 60, Trinity: 90, Lagmaron: 90 };
  const r = analyser(depart);
  ok(!r.verdict.ok, 'au départ, l’équipe ne tient pas');
  const vise = { ...depart };
  for (const x of r.requis) if (x.combatRequis != null) vise[x.id as Nom] += x.combatRequis - x.combatActuel;
  ok(analyser(vise).verdict.ok, 'aux vitesses annoncées, l’équipe tient (réanalysée)');
  // Chaque vitesse annoncée est un minimum : un point de moins, et ça ne tient plus.
  for (const x of r.requis.filter((y) => y.combatRequis != null)) {
    const moins = { ...vise, [x.id]: vise[x.id as Nom] - 1 };
    ok(!analyser(moins).verdict.ok, `${x.id} : la vitesse annoncée est un minimum, pas un surplus`);
  }
  // Le boost d'Eludia compte : Lagmaron n'a besoin de rien de plus une fois
  // Eludia remontée (le boost de Kabilla seul lui demandait des points).
  egal(r.requis.some((x) => x.id === 'Lagmaron'), false, 'Lagmaron : aucune vitesse en plus, le boost d’Eludia la porte');
}

// Le même cas par le chemin de l'ÉCRAN : l'analyse écrit les grilles, puis
// l'« Ordre des sorts » (Kabilla, Eludia, Lagmaron, Trinity) cherche ses
// fenêtres. Sur les grilles, le boost d'Eludia restait à son ancien tick.
export function testSpeedTuneDeuxBoostsAtbEcran() {
  titre('Speed tuning · écran — ordre des sorts avec deux boosts d’ATB d’équipe');
  const { donnees } = preparer();
  const monstres = monstersJson() as Monster[];
  const leads: Leads = { allie: null, ennemi: null };
  const ORDRE: Nom[] = ['Kabilla', 'Eludia', 'Lagmaron', 'Trinity'];

  // L'écran : ses lignes, l'analyse (sorts retenus, référence en face), les
  // grilles écrites, puis les deux plateaux.
  const ecran = (runes: Record<Nom, number>) => {
    const allies = ORDRE.map((n) => ({ ...ligneVierge(monstres.find((m) => m.com2usId === EQUIPE[n])!, 'allie'), runeSpeed: runes[n] }));
    const reference = ligneReference(allies[0], allies, donnees);
    const lignes = [...allies, reference];
    const sort: Record<string, string> = {};
    for (const l of allies) {
      const s = sortRetenu(entreeDe(l), donnees);
      if (s) sort[l.uid] = s.nom;
    }
    const choix = { sort };
    const res = analyseAutomatique(plateauDeLignes(lignes, leads), 0, donnees, { choix, idReference: reference.uid });
    const apres = appliquerMods(lignes, res.mods);
    return {
      ordre: allies.map((l) => l.uid),
      uid: Object.fromEntries(ORDRE.map((n, i) => [n, allies[i].uid])) as Record<Nom, string>,
      grilles: tuneDe(apres, leads, donnees, choix),
      requis: plateauDesRequis(apres, leads, donnees, choix)!,
    };
  };

  const depart: Record<Nom, number> = { Kabilla: 150, Eludia: 60, Trinity: 90, Lagmaron: 90 };
  const e = ecran(depart);
  ok(!diagnostiquerSequence(e.grilles, e.ordre).ok, 'au départ, l’ordre n’est pas tenu (Eludia se fait couper)');
  const fenetres = fenetresRequises(e.requis, e.ordre, undefined, 'combat', true);
  const vise = { ...depart };
  for (const n of ORDRE) {
    const f = fenetres.find((x) => x.id === e.uid[n]);
    if (f && !f.ok && f.min != null) vise[n] += f.min - f.combatActuel;
  }
  const corrige = ecran(vise);
  ok(diagnostiquerSequence(corrige.grilles, corrige.ordre).ok, 'aux vitesses annoncées, l’ordre tient (réanalysé, comme après « Relancer »)');
  // Sur les grilles, le boost d'Eludia ne suivait pas : les fenêtres
  // demandaient davantage à Lagmaron et Trinity.
  const surGrilles = fenetresRequises(e.grilles, e.ordre, undefined, 'combat', true);
  const besoin = (fs: typeof fenetres, n: Nom) => {
    const f = fs.find((x) => x.id === e.uid[n]);
    return f && !f.ok && f.min != null ? f.min - f.combatActuel : 0;
  };
  ok(
    besoin(fenetres, 'Lagmaron') + besoin(fenetres, 'Trinity') < besoin(surGrilles, 'Lagmaron') + besoin(surGrilles, 'Trinity'),
    `le boost d’Eludia compte : Lagmaron +${besoin(fenetres, 'Lagmaron')}, Trinity +${besoin(fenetres, 'Trinity')} (sur les grilles : +${besoin(surGrilles, 'Lagmaron')}, +${besoin(surGrilles, 'Trinity')})`
  );
}
