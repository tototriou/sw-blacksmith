// Objectifs du compte : défauts, lecture (stockage et fichier) et calcul des
// trois blocs — voir src/lib/objectifsCompte.ts et
// docs/02-app/compte/feat-objectifs.md.

import { ArtifactDetail, EffectLine, Monster, RuneDetail } from '../src/types';
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
  remplacerSousSections,
  scoreObjectif,
  SOUS_SECTIONS,
  sousSectionsDifferentes,
  sousSectionsPresentes,
  vitesseSecondaire,
} from '../src/lib/objectifsCompte';
import { idObjectifMonstre, mesurerMonstres, nomObjectifMonstre } from '../src/lib/objectifsMonstres';
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
  // Artéfacts : `quantites[colonne][principale]`, principales PV, ATQ, DEF.
  const { attribut: attr, type: typ } = OBJECTIFS_DEFAUT.artefacts;
  egal(
    attr.map((l) => [l.effet, l.seuil]),
    [[305, 22], [306, 22], [307, 22], [308, 22], [309, 22], [300, 18], [301, 18], [302, 18], [303, 18], [304, 18]],
    'artéfacts d’attribut : dégâts reçus ≥ 22 %, puis dégâts infligés ≥ 18 % (l’ordre des familles)'
  );
  egal(attr[5].quantites, [[1, 2, 1], [1, 2, 1], [1, 2, 1], [1, 2, 1], [1, 2, 1]], 'dégâts infligés : PV 1, ATQ 2, DEF 1 par élément');
  // Dégâts reçus : une pièce de plus visée contre l'élément qui bat la colonne
  // (Feu, Eau, Vent, Lumière, Ténèbres) — l'Eau bat le Feu, etc.
  egal(
    attr.slice(0, 5).map((l) => l.quantites.map((q) => q[0])),
    [[2, 2, 3, 2, 2], [3, 2, 2, 2, 2], [2, 3, 2, 2, 2], [2, 2, 2, 2, 3], [2, 2, 2, 3, 2]],
    'dégâts reçus, PV : 3 contre l’élément qui bat la colonne, 2 sinon'
  );
  ok(
    attr.slice(0, 5).every((l) => l.quantites.every(([pv, atq, def]) => atq === 0 && def === pv)),
    'dégâts reçus : les mêmes quantités en DEF qu’en PV, rien en ATQ'
  );
  egal(
    typ.map((l) => l.effet),
    [400, 401, 402, 404, 405, 406, 407, 408, 409, 204, 214, 206],
    'artéfacts de type : dgts CRIT, soins, précision, renforcement ATQ, puis dgts CRIT reçus et aug. VIT'
  );
  egal(typ[6].quantites, [[1, 0, 0], [2, 0, 2], [2, 0, 2], [2, 0, 2]], 'précision [Comp.1] : par style (Attaque, Défense, PV, Support), sur PV et DEF');
  egal(typ[9].quantites, [[0, 1, 0], [0, 0, 0], [0, 1, 0], [0, 1, 0]], 'renforcement ATQ : sur les pièces d’ATQ seulement');
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
  egal(t.surplus, 1, 'surplus : la troisième Violent de l’emplacement 1');
  egal(t.score, 3 / 12, 'score du set = compte / visé : le surplus ne compte pas tant qu’une case manque');
  egal(b.parLigne.map((l) => l.score), [1.5, 0.5, 0, 0, 0, 0], 'score par emplacement : 3 sur 2 visées, atteint, donc 150 %');
  egal(b.global, 3 / 12, 'global');

  // Au-delà de 100 % : seulement quand toutes les cases sont atteintes.
  egal(scoreObjectif(4, 4, 2), 1.5, 'tout atteint : le surplus s’ajoute');
  egal(scoreObjectif(3, 4, 2), 0.75, 'une case manque : le surplus ne compte pas');
  egal(scoreObjectif(0, 0, 2), null, 'rien de visé : pas de score');
  const plein = profondeurPalier(palier('violent', 100, 1), mesurerRunes([1, 1, 2, 3, 4, 5, 6].map((e) => cent('violent', e))));
  egal([plein.tableaux[0].surplus, plein.tableaux[0].score, plein.global], [1, 7 / 6, 7 / 6], 'un set tout atteint, une rune en plus : 116,7 %, au set comme au bloc');

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

  // ── La meule seule : aucune gemme simulée ──
  const sansGemme = (r: RuneDetail, scenario: 'heroEff' | 'legendEff') =>
    Math.max(runeEfficiency(r), runePotential(r, false, 'eff', true)[scenario]);
  egal(m[0].effMax.heroique, sansGemme(presque, 'heroEff'), 'rune vierge, héroïque : aucune gemme posée');
  egal(m[0].effMax.legendaire, sansGemme(presque, 'legendEff'), 'rune vierge, légendaire : aucune gemme posée');
  // Une gemme posée (ATQ% à 5) garde sa valeur : elle n'est pas relancée.
  const gemmee = rune('violent', 1, [{ code: 8, value: 26, grind: 0 }, { code: 9, value: 24 }, { code: 4, value: 5, enchant: true }]);
  const mg = mesurerRunes([gemmee])[0];
  egal(
    [mg.effMax.heroique, mg.effMax.legendaire],
    [sansGemme(gemmee, 'heroEff'), sansGemme(gemmee, 'legendEff')],
    'rune gemmée : la meule seule, gemme inchangée'
  );
  const relancee = runePotential(gemmee, true, 'eff', true, undefined, false, true);
  ok(
    mg.effMax.heroique < relancee.heroEff && mg.effMax.legendaire < relancee.legendEff,
    'rune gemmée : en dessous de la gemme relancée au maximum (preuve qu’elle ne l’est pas)'
  );
  // La ligne gemmée se meule comme les autres : sans meule, la rune ne bouge pas de son actuelle.
  ok(mg.effMax.heroique > mg.eff, 'rune gemmée : la meule s’applique, ligne gemmée comprise');

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
  // Une pièce visée par sous-colonne (élément × principale).
  const ligne = (effet: number, seuil: number, n: number) => ({ effet, seuil, quantites: Array.from({ length: n }, () => [1, 1, 1]) });
  const familles = profondeurArtefacts([ligne(301, 18, 5)], arts, 'attribut');
  egal(familles.map((f) => [f.famille, f.lignes]), [['infliges', [0]]], 'un bloc : la famille de la secondaire');
  const fiche = familles[0].bloc.tableaux[0];
  egal(
    fiche.lignes.slice(0, 6).map((l) => [l.colonne, l.principale, l.actuel]),
    [[0, 100, 1], [0, 101, 2], [0, 102, 0], [1, 100, 0], [1, 101, 1], [1, 102, 0]],
    'sous-colonnes : Feu PV 1, Feu ATQ 2 (bruit compris), Eau ATQ 1 ; ni la faible ni l’autre secondaire'
  );
  egal(fiche.vise, 15, 'visé : 5 éléments × 3 principales');
  egal(fiche.intangible, 1, 'l’Intangible : par ligne, hors colonnes');
  egal(fiche.compte, 3, 'plafonné par sous-colonne : Feu ATQ 1 sur 1 (deux possédés), Feu PV 1, Eau ATQ 1 ; l’Intangible hors du compte');
  egal(familles[0].bloc.parLigne.map((l) => l.score), [2 / 3, 1 / 3, 0, 0, 0], 'score par élément : ses trois principales réunies');
  const ty = profondeurArtefacts([ligne(214, 14, 4)], arts, 'type');
  egal(
    [...ty.map((f) => f.famille), ...ty[0].bloc.tableaux[0].lignes.filter((l) => l.actuel > 0).map((l) => `${l.colonne}:${l.principale}`)],
    ['autres', '0:101'],
    'Type : la pièce d’attaque, colonne Attaque, sous-colonne ATQ ; dgts CRIT reçus dans « Autres »'
  );
  // Rangées par famille, dans l'ordre du Top 10 (reçus avant infligés) ; dans
  // une famille, l'ordre du réglage.
  egal(
    profondeurArtefacts([ligne(301, 18, 5), ligne(306, 22, 5), ligne(300, 18, 5), ligne(301, 20, 5)], [], 'attribut').map((f) => [f.famille, f.lignes]),
    [['recus', [1]], ['infliges', [0, 2, 3]]],
    'une famille par bloc, la même secondaire à deux valeurs gardée deux fois'
  );
  egal(profondeurArtefacts([], arts, 'attribut'), [], 'aucune ligne : aucun bloc');
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
  egal(modifie((o) => (o.artefacts.type[0].effet = 301)), { ok: false, raison: 'contenu' }, 'une secondaire d’attribut parmi les objectifs de type refusée');
  egal(modifie((o) => (o.artefacts.attribut[0].effet = 999)), { ok: false, raison: 'contenu' }, 'secondaire inconnue refusée');
  egal(modifie((o) => o.artefacts.attribut[0].quantites.pop()), { ok: false, raison: 'contenu' }, 'quatre colonnes au lieu de cinq refusées');
  egal(modifie((o) => o.artefacts.attribut[0].quantites[0].pop()), { ok: false, raison: 'contenu' }, 'deux principales au lieu de trois refusées');
  egal(modifie((o) => (o.artefacts.attribut[0].quantites[0][1] = 1.5)), { ok: false, raison: 'contenu' }, 'quantité d’artéfacts non entière refusée');
  egal(
    modifie((o) => ((o.artefacts.attribut as unknown[])[0] = { principale: 0, lignes: [] })),
    { ok: false, raison: 'contenu' },
    'l’ancien format (un tableau par principale) refusé'
  );
  const decimal = modifie((o) => (o.artefacts.type[0].seuil = 0.5));
  ok(decimal.ok, 'une valeur minimale décimale (dégâts supp. en prop. des PV) est acceptée');
  const nomme = modifie((o) => (o.paliers[0].nom = '  Base  '));
  ok(nomme.ok && nomme.objectifs.paliers?.[0].nom === 'Base', 'nom de palier trimé');
  const vide = modifie((o) => (o.paliers[0].nom = '   '));
  ok(vide.ok && !!vide.objectifs.paliers && !('nom' in vide.objectifs.paliers[0]), 'nom vide : nom par défaut');

  egal(lireObjectifsStockes(null), OBJECTIFS_DEFAUT, 'rien de stocké : défauts');
  egal(lireObjectifsStockes('{"paliers":3}'), OBJECTIFS_DEFAUT, 'stockage illisible : défauts');
  ok((CLES_SESSION as readonly string[]).includes('swblacksmith-objectifs-compte-v1'), 'les objectifs entrent dans une session');
}

// Export, import et valeurs par défaut, sous-section par sous-section.
export function testObjectifsSousSections() {
  titre('Objectifs du compte — export, import et valeurs par défaut par sous-section');
  const complet = lireFichierObjectifs(fichierObjectifs(OBJECTIFS_DEFAUT));
  egal(complet.ok && complet.sousSections, [...SOUS_SECTIONS], 'sans choix, le fichier porte les quatre sous-sections');

  const partiel = fichierObjectifs(OBJECTIFS_DEFAUT, ['monstres', 'vitesse']);
  egal(Object.keys(JSON.parse(partiel).objectifs), ['vitesse', 'monstres'], 'le fichier ne porte que les sous-sections choisies, dans l’ordre des onglets');
  const lu = lireFichierObjectifs(partiel);
  egal(lu.ok && lu.sousSections, ['vitesse', 'monstres'], 'un fichier partiel se relit, avec ses sous-sections');

  const enveloppe = (objectifs: unknown) =>
    lireFichierObjectifs(JSON.stringify({ format: 'swblacksmith/objectifs-compte', version: 1, objectifs }));
  egal(enveloppe({}), { ok: false, raison: 'contenu' }, 'aucune sous-section : refusé');
  egal(enveloppe({ vitesse: OBJECTIFS_DEFAUT.vitesse, paliers: 3 }), { ok: false, raison: 'contenu' }, 'une sous-section illisible refuse tout le fichier');
  const ancien = enveloppe({ paliers: OBJECTIFS_DEFAUT.paliers, vitesse: OBJECTIFS_DEFAUT.vitesse, artefacts: OBJECTIFS_DEFAUT.artefacts });
  egal(ancien.ok && ancien.sousSections, ['efficience', 'vitesse', 'artefacts'], 'un fichier sans monstres : les monstres absents, pas vides');

  // Remplacer : seules les sous-sections choisies changent.
  const autre: ObjectifsCompte = {
    ...OBJECTIFS_DEFAUT,
    vitesse: [],
    monstres: { aMonter: [{ monstre: 26313, exemplaires: 2 }], aGarder: [], aSniper: [] },
  };
  const r = remplacerSousSections(OBJECTIFS_DEFAUT, autre, ['monstres']);
  egal([r.vitesse, r.monstres], [OBJECTIFS_DEFAUT.vitesse, autre.monstres], 'seules les sous-sections choisies sont remplacées');
  egal(remplacerSousSections(autre, { vitesse: [] }, ['efficience', 'vitesse']).paliers, autre.paliers, 'une sous-section choisie mais absente reste en place');
  egal(sousSectionsDifferentes(autre, OBJECTIFS_DEFAUT), ['vitesse', 'monstres'], 'les sous-sections qui diffèrent des défauts');
  egal(sousSectionsDifferentes(OBJECTIFS_DEFAUT, OBJECTIFS_DEFAUT), [], 'aux défauts : aucune');
  egal(sousSectionsPresentes({ artefacts: OBJECTIFS_DEFAUT.artefacts }), ['artefacts'], 'les sous-sections présentes');
}

// Les listes de monstres : une collaboration et sa version SW sont UN monstre.
export function testObjectifsMonstresCollab() {
  titre('Objectifs du compte — monstres : une collaboration est le même monstre');
  const monstre = (com2usId: number, name: string, jumeauCollab: number | null, secondAwaken = false): Monster =>
    ({ id: com2usId, com2usId, name, element: 'wind', secondAwaken, jumeauCollab }) as Monster;
  const cookie = monstre(26313, 'Pure Vanilla Cookie', 26813);
  const angela = monstre(26813, 'Angela', 26313);
  const autre = monstre(14013, 'Lushen', null);
  const parId = new Map([cookie, angela, autre].map((m) => [m.com2usId as number, m]));

  egal([idObjectifMonstre(angela), idObjectifMonstre(cookie)], [26313, 26313], 'les deux faces : le même identifiant');
  egal(nomObjectifMonstre(angela, parId), 'Angela, Pure Vanilla Cookie', 'le nom : les deux faces');
  egal(nomObjectifMonstre(autre, parId), 'Lushen', 'sans jumeau : son nom');

  const vise = (id: number) => ({ aMonter: [{ monstre: id, exemplaires: 2 }], aGarder: [], aSniper: [] });
  const box = [angela, cookie, autre];
  egal(mesurerMonstres(vise(26313), box, parId).listes.aMonter[0].possedes, 2, 'viser le Cookie compte aussi Angela');
  egal(mesurerMonstres(vise(26813), box, parId).listes.aMonter[0].possedes, 2, 'viser Angela compte aussi le Cookie');
  egal(mesurerMonstres(vise(26313), box, parId).score, 1, 'deux visés, deux possédés : 100 %');
  const double = mesurerMonstres({ aMonter: [], aGarder: [26313, 26813, 14013], aSniper: [] }, box, parId);
  egal(double.listes.aGarder.map((l) => l.id), [26313, 14013], 'les deux faces inscrites : une seule ligne, la première');
}
