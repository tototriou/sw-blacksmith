// Objectifs du compte : défauts, lecture (stockage et fichier) et calcul des
// trois blocs — voir src/lib/objectifsCompte.ts et
// docs/02-app/compte/feat-objectifs.md.

import { ArtifactDetail, EffectLine, RuneDetail } from '../src/types';
import {
  OBJECTIFS_DEFAUT,
  ObjectifsCompte,
  Palier,
  Potentiel,
  RuneMesuree,
  effetsArtefact,
  fichierObjectifs,
  lireFichierObjectifs,
  lireObjectifs,
  lireObjectifsStockes,
  mesurerRunes,
  niveauCase,
  niveauScore,
  profondeurArtefacts,
  profondeurPalier,
  profondeurVitesse,
  vitesseSecondaire,
} from '../src/lib/objectifsCompte';
import { runeEfficiency } from '../src/lib/effects';
import { runePotential } from '../src/lib/runeOptim';
import { CLES_SESSION } from '../src/lib/session';
import { egal, ok, titre } from './outils';

let id = 0;
// Une rune 6★ +15. Principale ATQ plat 160 (ratio 1) : son efficience vaut
// (1 + Σ secondaires) / 2,8.
function rune(set: string, slot: number, subs: EffectLine[], innate?: EffectLine): RuneDetail {
  return { id: ++id, slot, set, rank: 6, rarity: 5, level: 15, main: { code: 3, value: 160 }, subs, ...(innate ? { innate } : {}) };
}
// VIT 30 + TC 24 → (1 + 1 + 0,8) / 2,8 = 100 %.
const cent = (set: string, slot: number) => rune(set, slot, [{ code: 8, value: 30, grind: 0 }, { code: 9, value: 24 }]);
// VIT 10 → 47,6 %.
const faible = (set: string, slot: number) => rune(set, slot, [{ code: 8, value: 10, grind: 0 }]);

function palier(set: string, seuil: number, quantite: number): Palier {
  return { sets: [{ set, cases: Array.from({ length: 6 }, () => ({ seuil, quantite })) }] };
}

export default function testObjectifsCompte() {
  titre('Objectifs du compte');

  // ── Défauts ──
  egal(OBJECTIFS_DEFAUT.paliers.length, 2, 'deux paliers par défaut');
  egal(OBJECTIFS_DEFAUT.paliers.map((p) => p.sets[0].cases[0].seuil), [100, 110], 'Base à 100 %, Premium à 110 %');
  egal(
    OBJECTIFS_DEFAUT.paliers[0].sets.map((s) => [s.set, s.cases[0].quantite]),
    [['violent', 20], ['will', 12], ['despair', 12], ['shield', 12], ['destroy', 6], ['nemesis', 6], ['seal', 2]],
    'quantités par défaut, Base'
  );
  egal(
    OBJECTIFS_DEFAUT.paliers[1].sets.map((s) => [s.set, s.cases[0].quantite]),
    [['violent', 8], ['will', 6], ['despair', 6], ['shield', 6], ['destroy', 3], ['nemesis', 3], ['seal', 2]],
    'quantités par défaut, Premium : moins de runes visées'
  );
  egal(
    OBJECTIFS_DEFAUT.vitesse.map((s) => [s.set, s.cases[0].seuil, s.cases[0].quantite, s.cases.length]),
    [['despair', 28, 2, 5], ['swift', 29, 3, 5], ['violent', 28, 3, 5], ['will', 28, 3, 5]],
    'vitesse par défaut, cinq emplacements'
  );
  egal(
    OBJECTIFS_DEFAUT.artefacts.attribut.map((t) => [t.principale, t.lignes[0].effet, t.lignes[0].seuil, t.lignes[0].quantites[0]]),
    [[0, 300, 18, 2], [100, 300, 18, 1], [101, 300, 18, 2], [102, 300, 18, 1], [0, 305, 22, 2], [100, 305, 22, 2], [102, 305, 22, 2]],
    'artéfacts d’attribut : dégâts infligés ≥ 18 % (toutes, PV, ATQ, DEF), dégâts reçus ≥ 22 % (toutes, PV, DEF)'
  );
  // Dégâts reçus : une pièce de plus visée contre l'élément qui bat la colonne
  // (Feu, Eau, Vent, Lumière, Ténèbres) — l'Eau bat le Feu, etc.
  egal(
    OBJECTIFS_DEFAUT.artefacts.attribut[4].lignes.map((l) => l.quantites),
    [[2, 2, 3, 2, 2], [3, 2, 2, 2, 2], [2, 3, 2, 2, 2], [2, 2, 2, 2, 3], [2, 2, 2, 3, 2]],
    'dégâts reçus : 3 contre l’élément qui bat la colonne, 2 sinon'
  );
  egal(
    OBJECTIFS_DEFAUT.artefacts.type.map((t) => [t.principale, t.lignes.length]),
    [[100, 11], [101, 11], [102, 11], [101, 1]],
    'artéfacts de type : PV, ATQ, DEF (précision, dgts CRIT reçus, aug. VIT, dgts CRIT, soins), puis renforcement ATQ'
  );
  ok(lireObjectifs(OBJECTIFS_DEFAUT) !== null, 'les défauts se relisent');

  // ── Efficience : compte, plafond, Intangible ──
  ok(Math.abs(runeEfficiency(cent('violent', 1)) - 100) < 1e-9, 'la rune témoin vaut 100 %');
  const runes = [
    cent('violent', 1),
    cent('violent', 1),
    cent('violent', 1),
    faible('violent', 1),
    cent('violent', 2),
    cent('will', 1),
    cent('intangible', 1),
    faible('intangible', 1),
  ];
  const b = profondeurPalier(palier('violent', 100, 2), mesurerRunes(runes));
  const t = b.tableaux[0];
  egal(t.lignes[0].actuel, 3, 'emplacement 1 : trois Violent à 100 %, la faible et la Will ne comptent pas');
  egal(t.lignes[0].intangible, 1, 'emplacement 1 : une Intangible au seuil, en colonne à part');
  egal(t.lignes[1].actuel, 1, 'emplacement 2 : une Violent');
  egal(t.compte, 3, 'plafonné case par case : 2 (sur 3) + 1, l’Intangible hors du compte');
  egal(t.vise, 12, 'visé : 2 × 6');
  egal(t.score, 3 / 12, 'score du set = compte / visé');
  egal(b.parLigne.map((l) => l.score), [1, 0.5, 0, 0, 0, 0], 'score par emplacement');
  egal(b.global, 3 / 12, 'global');

  // Rapport des totaux, pas moyenne des pourcentages.
  const deuxSets: Palier = { sets: [...palier('violent', 100, 4).sets, ...palier('will', 100, 1).sets] };
  const b2 = profondeurPalier(deuxSets, mesurerRunes([cent('will', 1)]));
  egal(b2.parLigne[0].score, 1 / 5, 'emplacement 1 : 1 rune sur 5 visées, pas la moyenne de 0 % et 100 %');

  // Rien de visé : pas de score.
  egal(profondeurPalier(palier('violent', 100, 0), []).global, null, 'rien de visé : score absent');

  // ── Si max héroïque ──
  // VIT 26 + TC 24 → 95,2 % ; la meule héroïque (+4 VIT) la porte à 100 % au moins.
  const presque = rune('violent', 1, [{ code: 8, value: 26, grind: 0 }, { code: 9, value: 24 }]);
  const m = mesurerRunes([presque]);
  ok(m[0].eff < 100 && m[0].effMax.heroique >= 100, 'meulée au héroïque, la rune passe le seuil');
  const bm = profondeurPalier(palier('violent', 100, 2), m);
  egal([bm.tableaux[0].lignes[0].actuel, bm.tableaux[0].lignes[0].siMax], [0, 1], 'actuel 0, si max héroïque 1');
  egal(bm.tableaux[0].compteMax, 1, 'compte si max héroïque');
  // Meule légendaire (VIT +5) : le scénario héroïque ne la reprend pas à la baisse.
  const legende = rune('violent', 1, [{ code: 8, value: 30, grind: 5 }, { code: 9, value: 24 }]);
  const ml = mesurerRunes([legende])[0];
  ok(ml.effMax.heroique >= ml.eff, 'une meule légendaire ne fait pas baisser « si max héroïque »');

  // ── Les gemmes : comme l'onglet Optimisation, « regemme différent » éteint ──
  // Une rune vierge ne reçoit pas de gemme : son « si max » est celui de la meule seule.
  const sansGemme = (r: RuneDetail, scenario: 'heroEff' | 'legendEff') =>
    Math.max(runeEfficiency(r), runePotential(r, false, 'eff', true)[scenario]);
  egal(m[0].effMax.heroique, sansGemme(presque, 'heroEff'), 'rune vierge, héroïque : aucune gemme simulée');
  egal(m[0].effMax.legendaire, sansGemme(presque, 'legendEff'), 'rune vierge, légendaire : aucune gemme simulée');
  // Une gemme posée (ATQ% à 5) se relance au maximum, sur SA stat.
  const gemmee = rune('violent', 1, [{ code: 8, value: 26, grind: 0 }, { code: 9, value: 24 }, { code: 4, value: 5, enchant: true }]);
  const mg = mesurerRunes([gemmee])[0];
  ok(mg.effMax.heroique > sansGemme(gemmee, 'heroEff'), 'rune gemmée, héroïque : la gemme se relance');
  ok(mg.effMax.legendaire > sansGemme(gemmee, 'legendEff'), 'rune gemmée, légendaire : la gemme se relance');
  egal(
    [mg.effMax.heroique, mg.effMax.legendaire],
    [runePotential(gemmee, true, 'eff', true, undefined, false, true).heroEff, runePotential(gemmee, true, 'eff', true, undefined, false, true).legendEff],
    'le même calcul que l’onglet Optimisation, regemme différent éteint'
  );

  // ── Le « si max » de chaque palier ──
  egal(OBJECTIFS_DEFAUT.paliers.map((p) => p.potentiel), ['heroique', 'legendaire'], 'Base : héroïque ; Premium : légendaire');
  ok(ml.effMax.legendaire >= ml.eff, 'jamais sous l’actuelle');
  // Deux runes dont seul le scénario diffère : le palier lit SON potentiel.
  const fictives: RuneMesuree[] = [{ rune: cent('violent', 1), eff: 90, effMax: { heroique: 120, legendaire: 95 } }];
  const siMaxAvec = (potentiel?: Potentiel) => profondeurPalier({ ...palier('violent', 100, 2), ...(potentiel ? { potentiel } : {}) }, fictives).tableaux[0].lignes[0].siMax;
  egal([siMaxAvec('heroique'), siMaxAvec('legendaire'), siMaxAvec()], [1, 0, 1], 'le si max suit le potentiel du palier ; absent = héroïque');
  ok(lireObjectifs({ ...OBJECTIFS_DEFAUT, paliers: [{ potentiel: 'mythique', sets: [] }] }) === null, 'potentiel inconnu : refusé');
  egal(lireObjectifs({ ...OBJECTIFS_DEFAUT, paliers: [{ sets: [] }] })?.paliers, [{ sets: [] }], 'potentiel absent : lu tel quel (héroïque)');

  // ── Vitesse ──
  const rapides = [
    rune('swift', 1, [{ code: 8, value: 29 }]),
    rune('swift', 1, [{ code: 8, value: 20 }], { code: 8, value: 9 }),
    rune('swift', 1, [{ code: 8, value: 12 }]),
    rune('swift', 2, [{ code: 8, value: 33 }]),
    rune('intangible', 3, [{ code: 8, value: 30 }]),
  ];
  egal(vitesseSecondaire(rapides[1]), 29, 'innée comprise');
  const v = profondeurVitesse([{ set: 'swift', cases: Array.from({ length: 5 }, () => ({ seuil: 29, quantite: 3 })) }], rapides);
  const lv = v.tableaux[0].lignes;
  egal(lv.map((l) => l.cle), [1, 3, 4, 5, 6], 'sans l’emplacement 2');
  egal([lv[0].actuel, lv[0].plusRapide], [2, 29], 'emplacement 1 : deux à 29, la plus rapide à 29');
  egal(lv[1].intangible, 1, 'Intangible rapide en colonne à part');
  egal(lv[1].plusRapide, undefined, 'aucune Swift en 3 : pas de « plus rapide »');
  egal(v.global, 2 / 15, 'global vitesse');

  // ── Artéfacts : le nombre qui porte une secondaire à une valeur donnée ──
  // 301 : dégâts infligés à l'Eau ; 214 : dgts CRIT reçus (deux sortes).
  const art = (over: Partial<ArtifactDetail>, subs: EffectLine[]): ArtifactDetail => ({
    id: ++id,
    kind: 'element',
    element: 'fire',
    level: 15,
    rarity: 5,
    main: { code: 101, value: 100 },
    subs,
    ...over,
  });
  const arts = [
    art({}, [{ code: 301, value: 18 }]), // Feu, ATQ, au seuil
    art({}, [{ code: 301, value: 17.999999999999996 }]), // bruit de virgule flottante : 18 aussi
    art({}, [{ code: 301, value: 12 }]), // sous le seuil
    art({}, [{ code: 302, value: 20 }]), // autre secondaire
    art({ main: { code: 100, value: 1500 } }, [{ code: 301, value: 20 }]), // Feu, PV
    art({ element: 'water' }, [{ code: 301, value: 25 }]), // Eau
    art({ intangible: true, element: undefined }, [{ code: 301, value: 19 }]), // Intangible
    art({ kind: 'archetype', element: undefined, archetype: 'attack' }, [{ code: 214, value: 14 }]),
  ];
  const ligne = (effet: number, seuil: number, n: number) => ({ effet, seuil, quantites: Array.from({ length: n }, () => 1) });
  const toutes = profondeurArtefacts({ principale: 0, lignes: [ligne(301, 18, 5)] }, arts, 'attribut');
  egal(
    toutes.tableaux[0].lignes.map((l) => l.actuel),
    [3, 1, 0, 0, 0],
    'toutes principales : Feu 3 (deux ATQ au seuil, bruit compris, et la PV), Eau 1 ; ni la faible ni l’autre secondaire'
  );
  egal(toutes.tableaux[0].intangible, 1, 'l’Intangible : par ligne, hors colonnes');
  egal(toutes.tableaux[0].compte, 2, 'plafonné par colonne : Feu 1 sur 1, Eau 1 ; l’Intangible hors du compte');
  egal(toutes.parLigne.map((l) => l.score), [1, 1, 0, 0, 0], 'score par élément');
  const pv = profondeurArtefacts({ principale: 100, lignes: [ligne(301, 18, 5)] }, arts, 'attribut');
  egal(pv.tableaux[0].lignes[0].actuel, 1, 'filtre de principale : seule la pièce PV');
  const ty = profondeurArtefacts({ principale: 0, lignes: [ligne(214, 14, 4)] }, arts, 'type');
  egal(ty.tableaux[0].lignes.map((l) => l.actuel), [1, 0, 0, 0], 'Type : la pièce d’attaque, colonne Attaque');
  egal(
    effetsArtefact('attribut').slice(0, 10),
    [300, 301, 302, 303, 304, 305, 306, 307, 308, 309],
    'les secondaires d’attribut, dans l’ordre du jeu'
  );
  ok(!effetsArtefact('attribut').some((c) => c >= 400) && !effetsArtefact('type').some((c) => c >= 300 && c < 400), 'chaque sorte, ses secondaires');

  // ── Niveaux (couleurs) ──
  egal(
    [0, 0.167, 0.3, 0.417, 0.5, 0.583, 0.7, 0.833, 1, 1.167].map(niveauScore),
    [0, 0, 1, 1, 2, 2, 3, 3, 4, 4],
    'niveau d’un score : <30 %, <50 %, <70 %, <100 %, atteint'
  );
  egal(niveauScore(null), null, 'pas de score, pas de niveau');
  egal([niveauCase(0, 2), niveauCase(1, 2), niveauCase(2, 2), niveauCase(3, 2), niveauCase(0, 0)], [0, 2, 3, 4, null], 'niveau d’une case : vide, entamée, atteinte, dépassée, rien de visé');

  // ── Lecture ──
  const fichier = fichierObjectifs(OBJECTIFS_DEFAUT);
  const lu = lireFichierObjectifs(fichier);
  ok(lu.ok && JSON.stringify(lu.objectifs) === JSON.stringify(OBJECTIFS_DEFAUT), 'un fichier exporté se relit à l’identique');
  ok(JSON.parse(fichier).format === 'swblacksmith/objectifs-compte', 'identifiant de format');
  const ancien = JSON.stringify({ ...JSON.parse(fichier), format: 'sw-forge/objectifs-compte' });
  ok(lireFichierObjectifs(ancien).ok, 'l’ancien préfixe reste reconnu');
  egal(lireFichierObjectifs('pas du json'), { ok: false, raison: 'format' }, 'texte illisible : format');
  egal(lireFichierObjectifs(JSON.stringify({ format: 'swblacksmith/session' })), { ok: false, raison: 'format' }, 'autre fichier de l’app : format');

  const modifie = (f: (o: ObjectifsCompte) => void) => {
    const o = JSON.parse(JSON.stringify(OBJECTIFS_DEFAUT)) as ObjectifsCompte;
    f(o);
    return lireFichierObjectifs(JSON.stringify({ format: 'swblacksmith/objectifs-compte', version: 1, objectifs: o }));
  };
  egal(modifie((o) => (o.paliers[0].sets[0].set = 'inconnu')), { ok: false, raison: 'contenu' }, 'set inconnu refusé');
  egal(modifie((o) => (o.paliers[0].sets[1].set = 'violent')), { ok: false, raison: 'contenu' }, 'set en double refusé');
  egal(modifie((o) => (o.paliers[0].sets[0].set = 'intangible')), { ok: false, raison: 'contenu' }, 'Intangible refusée comme objectif');
  egal(modifie((o) => o.paliers[0].sets[0].cases.pop()), { ok: false, raison: 'contenu' }, 'cinq cases au lieu de six refusées');
  egal(modifie((o) => (o.paliers[0].sets[0].cases[0].quantite = 2.5)), { ok: false, raison: 'contenu' }, 'quantité non entière refusée');
  egal(modifie((o) => (o.vitesse[0].cases[0].seuil = 500)), { ok: false, raison: 'contenu' }, 'vitesse hors bornes refusée');
  egal(modifie((o) => (o.artefacts.type[0].lignes[0].effet = 301)), { ok: false, raison: 'contenu' }, 'une secondaire d’attribut dans un tableau de type refusée');
  egal(modifie((o) => (o.artefacts.attribut[0].lignes[0].effet = 999)), { ok: false, raison: 'contenu' }, 'secondaire inconnue refusée');
  egal(modifie((o) => o.artefacts.attribut[0].lignes[0].quantites.pop()), { ok: false, raison: 'contenu' }, 'quatre colonnes au lieu de cinq refusées');
  egal(modifie((o) => ((o.artefacts.attribut[0] as { principale: number }).principale = 103)), { ok: false, raison: 'contenu' }, 'principale inconnue refusée');
  const decimal = modifie((o) => (o.artefacts.type[0].lignes[0].seuil = 0.5));
  ok(decimal.ok, 'une valeur minimale décimale (dégâts supp. en prop. des PV) est acceptée');
  const nomme = modifie((o) => (o.paliers[0].nom = '  Base  '));
  ok(nomme.ok && nomme.objectifs.paliers[0].nom === 'Base', 'nom de palier trimé');
  const vide = modifie((o) => (o.paliers[0].nom = '   '));
  ok(vide.ok && !('nom' in vide.objectifs.paliers[0]), 'nom vide : nom par défaut');

  egal(lireObjectifsStockes(null), OBJECTIFS_DEFAUT, 'rien de stocké : défauts');
  egal(lireObjectifsStockes('{"paliers":3}'), OBJECTIFS_DEFAUT, 'stockage illisible : défauts');
  ok((CLES_SESSION as readonly string[]).includes('swblacksmith-objectifs-compte-v1'), 'les objectifs entrent dans une session');
}
