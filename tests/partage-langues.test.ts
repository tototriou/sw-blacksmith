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
}
