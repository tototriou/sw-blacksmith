// Les configurations et onglets du bureau (src/lib/optimizerColonnes.ts).
import { attenteResultats, configurationBureau, ongletOuvert, LARGEURS_BUREAU, RETRAIT_PANNEAU, SEUILS_BUREAU } from '../src/lib/optimizerColonnes';
import { LARGEUR_MONSTRE } from '../src/components/outils/optimizer/bureau/ListeDeTravailBureau';
import { LARGEUR_ARTEFACTS } from '../src/components/outils/optimizer/bureau/ArtefactsEtReliqueBureau';
import { LARGEUR_COMPLEMENTS } from '../src/components/outils/optimizer/bureau/SetsAuraBureau';
import { colonnesCoffre } from '../src/lib/coffreSets';
import { RESULTATS_TABLEAU, largeurResultats } from '../src/lib/optimizerColonnes';
import { SEUIL_TABLEAU_PX } from '../src/components/outils/optimizer/TableauResultats';

// Le réglage « Tableau » : la configuration la plus large qui laisse au
// tableau sa largeur ; trop étroit, celle de la largeur seule (les résultats
// passent en cartes).
export function testOptimizerColonnesTableau() {
  titre('Optimizer · configuration quand les résultats sont en tableau');
  egal(RESULTATS_TABLEAU, SEUIL_TABLEAU_PX + 26, 'la largeur du tableau plus le contour, le rembourrage et la barre du panneau');
  const cas: [number, string, string][] = [
    [2288, 'groupe-large', 'groupe-large'], // 2560 plein
    [1648, 'groupe-large', 'groupe-large'], // 1920 plein
    [1491, 'groupe-large', 'groupe-large'],
    [1490, 'groupe-large', 'groupe'],
    [1427, 'groupe-large', 'groupe'],
    [1426, 'groupe-large', 'quatre-onglets'],
    [1264, 'groupe-large', 'quatre-onglets'], // portable
    [1112, 'groupe', 'quatre-onglets'], // 2560 scindé
    [792, 'quatre-onglets', 'quatre-onglets'], // 1920 scindé : trop étroit, cartes
  ];
  for (const [largeur, cartes, tableau] of cas) {
    egal([configurationBureau(largeur).configuration, configurationBureau(largeur, true).configuration], [cartes, tableau],
      `${largeur} px : ${cartes} en cartes, ${tableau} en tableau`);
  }
  ok(largeurResultats(1112, 'quatre-onglets') >= RESULTATS_TABLEAU && largeurResultats(792, 'quatre-onglets') < RESULTATS_TABLEAU,
    '2560 scindé tient le tableau dans son onglet, 1920 scindé jamais');
}
import { egal, ok, titre } from './outils';

// La grille des sets dans son coffre : 3 + 4 colonnes, puis le principal à
// 2, puis le secondaire à 3 et à 2, puis le principal à 1, et le secondaire
// à 1 en dernier recours (boutons de 32 px, écarts de 4, 9 px entre les
// groupes : 4 de marge de chaque côté du trait).
export function testOptimizerColonnesCoffreSets() {
  titre('Optimizer · colonnes de la grille des sets selon la largeur du coffre');
  const cas: [number, number, number][] = [
    [400, 3, 4], [253, 3, 4], [252, 2, 4], [217, 2, 4], [216, 2, 3], [181, 2, 3], [180, 2, 2], [145, 2, 2],
    [144, 1, 2], [109, 1, 2], [108, 1, 1], [60, 1, 1],
  ];
  for (const [largeur, principal, secondaire] of cas) {
    egal(colonnesCoffre(largeur), { principal, secondaire }, `${largeur} px : ${principal} + ${secondaire} colonnes`);
  }
}

export function testOptimizerColonnes() {
  titre('Optimizer · configuration des colonnes selon la largeur');
  egal(LARGEURS_BUREAU, { monstre: 392, reglage: 328, reglageLarge: 392, resultats: 360, gouttiere: 10 }, 'places de la spec');
  egal([LARGEUR_MONSTRE, LARGEUR_ARTEFACTS, LARGEUR_COMPLEMENTS], [392, 328, 328], 'les composants déclarent les mêmes places');
  egal(RETRAIT_PANNEAU + LARGEURS_BUREAU.gouttiere, 18, '10 + 8 = 18 entre panneaux');
  // La barre est dans le panneau : place − retrait 8 − contour 2 − rembourrage 2 × 8 − barre 8.
  egal([LARGEURS_BUREAU.reglage - 34, LARGEURS_BUREAU.monstre - 34], [294, 358], 'contenus : 294 px dans le groupe, 358 dans « Monstre »');
  egal(SEUILS_BUREAU, { groupe: 1100, groupeLarge: 1164 }, 'seuils calculés sur les places');
  egal(LARGEURS_BUREAU.reglageLarge, LARGEURS_BUREAU.monstre, 'groupe large : la largeur de « Monstre »');
  const cas = [
    [751, 'quatre-onglets'], [752, 'quatre-onglets'], [753, 'quatre-onglets'],
    [1099, 'quatre-onglets'], [1100, 'groupe'], [1101, 'groupe'],
    [1163, 'groupe'], [1164, 'groupe-large'], [1165, 'groupe-large'], [2288, 'groupe-large'],
  ] as const;
  for (const [largeur, configuration] of cas) egal(configurationBureau(largeur).configuration, configuration, `${largeur} px : ${configuration}`);
  egal(configurationBureau(752), { configuration: 'quatre-onglets', groupe: ['criteres', 'artefacts', 'complements', 'resultats'], reglage: 0 },
    'minimum de bureau : l’objectif et les résultats deviennent le quatrième onglet');
  egal(largeurResultats(752, 'quatre-onglets'), 350, 'l’onglet des résultats reçoit 350 px au minimum');
  egal(configurationBureau(1100), { configuration: 'groupe', groupe: ['criteres', 'artefacts', 'complements'], reglage: 328 }, 'groupe de trois à côté des résultats');
  egal(configurationBureau(1164), { configuration: 'groupe-large', groupe: ['criteres', 'artefacts', 'complements'], reglage: 392 }, 'groupe large dès que les résultats gardent 360 px');
  egal([largeurResultats(1100, 'groupe'), largeurResultats(1164, 'groupe-large')], [360, 360], 'à chaque seuil, les résultats gardent leur largeur minimale');
  // Décision de l'utilisateur : jamais de colonne de réglages, même très large.
  for (const [largeur] of cas) {
    egal(configurationBureau(largeur).groupe.slice(0, 3), ['criteres', 'artefacts', 'complements'], `${largeur} px : les trois réglages en onglets, dans leur ordre`);
  }
}

export function testOptimizerColonnesOnglet() {
  titre('Optimizer · onglet gardé ou remplacé au redimensionnement');
  const trois = configurationBureau(1264).groupe;
  egal(ongletOuvert(trois, null), 'criteres', 'premier onglet au départ');
  egal(ongletOuvert(trois, 'complements'), 'complements', 'onglet précédent gardé');
  egal(ongletOuvert(trois, 'artefacts'), 'artefacts', 'Artéfacts gardé');
  egal(ongletOuvert(configurationBureau(792).groupe, 'complements'), 'complements', 'passer à quatre onglets garde Options');
  egal(ongletOuvert(configurationBureau(2288).groupe, 'complements'), 'complements', 'agrandir la fenêtre garde Options');
  egal(ongletOuvert(configurationBureau(792).groupe, 'resultats'), 'resultats', 'quatre onglets : Résultats gardé');
  egal(ongletOuvert(configurationBureau(1264).groupe, 'resultats'), 'criteres', 'les résultats redevenus colonne : premier onglet');
  for (const largeur of [792, 1112, 1264, 1648, 2288]) {
    const groupe = configurationBureau(largeur).groupe;
    const avant = ongletOuvert(groupe, 'complements');
    egal(ongletOuvert(groupe, avant), avant, 'une recherche ne fournit aucun changement de groupe ni guidage');
  }
}

export function testOptimizerColonnesGuidages() {
  titre('Optimizer · guidages vers les réglages rangés');
  const trois = configurationBureau(1264).groupe;
  egal(ongletOuvert(trois, 'artefacts', 'criteres'), 'criteres', 'Rechercher sans set ouvre Critères');
  egal(ongletOuvert(trois, 'criteres', 'complements'), 'complements', 'auras RES/PRE : Options');
  egal(ongletOuvert(configurationBureau(2288).groupe, 'artefacts', 'complements'), 'complements', 'guidage Options aussi en fenêtre large');
  egal(ongletOuvert(trois, 'complements', 'complements'), 'complements', 'un guidage ne referme jamais sa cible');
  egal(ongletOuvert(configurationBureau(752).groupe, 'resultats', 'criteres'), 'criteres', 'quatre onglets : Rechercher sans set quitte Résultats pour Critères');
}

export function testOptimizerColonnesAttenteResultats() {
  titre("Optimizer · place d'attente des résultats au bureau");
  egal(attenteResultats(false, false, 'idle'), 'sans-monstre', 'aucun monstre');
  egal(attenteResultats(false, true, 'done'), 'sans-monstre', 'aucun monstre, même avec des résultats');
  egal(attenteResultats(true, false, 'idle'), 'sans-recherche', 'un monstre, aucune recherche');
  egal((['running', 'done', 'error', 'refused'] as const).map(s => attenteResultats(true, false, s)), ['sans-carte', 'sans-carte', 'sans-carte', 'sans-carte'], 'recherche sans carte : cadre seul');
  egal(attenteResultats(true, true, 'running'), null, 'des cartes : les résultats');
}
