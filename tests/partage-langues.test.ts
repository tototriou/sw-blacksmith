// Les messages écrits par src/lib/ (rapports d'import, statuts et alertes du
// siège) suivent la langue reçue en paramètre — docs/02-app/transverse/feat-langues.md.

import { validateRtaImport } from '../src/lib/rtaShare';
import { validateRecosImport } from '../src/lib/recoShare';
import { lireEquipes } from '../src/lib/siegeShare';
import { raisonSansVerdict, type EntreeStatut } from '../src/lib/siegeStatut';
import { tickDanger, tickTeamMessage } from '../src/lib/speed';
import { libelleSource } from '../src/lib/ownedBuilds';
import { parseAccountBox, parseAccountJson } from '../src/lib/importAccount';
import { topParPropriete } from '../src/lib/artifactsTop';
import { exemplaireSuivantEspece } from '../src/lib/optimizerExclusion';
import { echoAurasExternes } from '../src/lib/aurasExternes';
import type { Monster } from '../src/types';
import { parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { compteAffichable } from '../src/lib/artifactQueue';
import { importerPrepaRtaOptimizer } from '../src/lib/importEquipes';
import { ligneDesComptes } from '../src/lib/filtresAffichage';
import { fr } from '../src/i18n/fr';
import { en } from '../src/i18n/en';
import { egal, ok, titre } from './outils';

export function testPartageLangues() {
  titre('src/lib/ — les messages dans la langue reçue');

  egal(validateRtaImport('', en).errors, ['Empty content.'], 'prépa RTA vide : refusée en anglais');
  egal(validateRtaImport('', fr).errors, ['Contenu vide.'], 'prépa RTA vide : refusée en français');
  const rta = validateRtaImport(JSON.stringify({ format: 'swblacksmith/prepa-rta', monstres: [{ com2usId: 'x' }] }), en);
  ok(rta.warnings.some((w) => w.startsWith('Monster 1:')), 'prépa RTA : l’entrée fautive est située en anglais (« Monster 1: »)');
  ok(rta.errors.includes('No usable monster in this file.'), 'prépa RTA : rien d’exploitable, en anglais');

  egal(
    validateRecosImport('pas du json', en).errors,
    ['Expected a recommendations JSON (an exported .json file or its pasted content).'],
    'recommandations : contenu refusé en anglais'
  );
  const lu = lireEquipes('pas du json', [], en);
  ok(!lu.ok && lu.erreur === 'This file is not JSON.', 'équipes de siège : fichier refusé en anglais');

  const statut: EntreeStatut = {
    verifier: true,
    swift: false,
    leo: false,
    ignoree: false,
    desMonstres: false,
    speedTune: null,
    horsTick: false,
    slotsRemplis: 0,
    monstresConnus: 0,
  };
  egal(raisonSansVerdict(statut, en), 'Empty team.', 'statut d’équipe : la raison en anglais');

  egal(
    tickTeamMessage([{ nom: 'Tesarion', danger: tickDanger(283) }, { nom: 'Camille', danger: tickDanger(305) }], en),
    'Tesarion does not reach tick 286 and Camille passes tick 286.',
    'alerte de tick : chaque fautif nommé, en anglais'
  );

  egal(libelleSource('Défense 3', en.carteReco.sources), 'Defense 3', 'source d’un build : « Défense 3 » → « Defense 3 »');
  egal(libelleSource('Box', en.carteReco.sources), 'Box', 'source d’un build : « Box » reste « Box »');
  egal(libelleSource('Défense 3', fr.carteReco.sources), 'Défense 3', 'source d’un build : inchangée en français');
  egal(libelleSource('Autre chose', en.carteReco.sources), 'Autre chose', 'un libellé venu d’ailleurs est rendu tel quel');

  egal(parseAccountJson('pas du json', en).error, 'Unreadable JSON file.', 'import du compte : fichier illisible, en anglais');
  egal(parseAccountBox('{}', fr).error, "Ce fichier ne contient pas de 'unit_list' — un export de compte SWEX est attendu.", 'import du compte : en français');
  egal(
    topParPropriete([], 'water', en).map((f) => f.titre)[0],
    'Damage taken reduction',
    'top des artéfacts : les titres de tableau en anglais'
  );
  ok(
    topParPropriete([], 'water', en)[0].colonnes.map((c) => c.entete).includes('Fire'),
    'top des artéfacts : les en-têtes d’élément viennent du lexique anglais'
  );

  const lushen = { id: 1, name: 'Lushen' } as Monster;
  const sansExemplaire = { box: [], rta: [], 'siege-defense': [], 'siege-offense': [] };
  egal(
    exemplaireSuivantEspece(lushen, sansExemplaire, [{ listId: 'L', selector: { source: 'unowned', monsterId: '1' } }], 'L', en).raison,
    'Lushen is already in the list',
    'Optimizer : espèce déjà dans la liste, en anglais'
  );
  egal(
    echoAurasExternes([{ set: 'fight', nombre: 2 }], en),
    'external auras: 2 Fight sets; the build’s aura sets add to them on each result',
    'écho des auras externes : le nom du set vient du lexique anglais'
  );

  egal(parseOptimizerRecipe('pas du json', en).error, 'Unreadable file: this is not valid JSON.', 'recette : fichier illisible, en anglais');
  egal(
    parseOptimizerRecipe(JSON.stringify({ version: 1, monsterCom2usId: 1, requirement: {}, objective: 'inconnu' }), en).error,
    'Invalid file: objective contains an unknown value.',
    'recette : le champ fautif et son attente, en anglais'
  );
  egal(
    compteAffichable({ trouves: 2, recus: 2, affichables: 0, modeRecherche: false }, en).raison,
    '2 combinations found by the search were discarded: no real artifact pair meets all the conditions.',
    'raison du zéro confirmé : en anglais'
  );
  egal(importerPrepaRtaOptimizer({ box: [], rtaEntries: {}, siegeDefenseTeams: [], siegeOffenseTeams: [], monsterById: new Map() }, en).nomListe,
    'RTA prep', 'import d’équipe : le nom de la liste créée suit la langue');
  egal(
    ligneDesComptes({ visiblesConfirmes: 1200, masquesConfirmes: 3, masquesNonVerifies: 0, potentielsNonVerifies: 0, indeterminesNumeriques: 0 } as never, 1, false, en),
    'Filters: 1,200 visible · 3 hidden',
    'filtres d’affichage : la ligne des comptes, nombres compris, en anglais'
  );
}
