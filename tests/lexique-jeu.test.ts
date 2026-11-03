// Le vocabulaire du jeu dans chaque langue — docs/02-app/transverse/feat-langues.md,
// « Le vocabulaire du jeu ».
//
// Le lexique (src/i18n/jeu/) doit couvrir ce que l'app affiche : les sets, les
// éléments, les archétypes, les 49 sous-propriétés d'artéfact connues du moteur,
// et chaque effet de compétence présent dans les données SWARFARM. Un effet qui
// arrive avec une mise à jour des données fait échouer ce test tant qu'il n'a
// pas de nom français relevé en jeu, ou n'est pas inscrit au registre des manques.

import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { jeuFr } from '../src/i18n/jeu/fr';
import { jeuEn } from '../src/i18n/jeu/en';
import { nomEffet, nomSet, nomElement, nomGrade, bonusSet } from '../src/i18n/jeu';
import { CODES_SOUS_PROPRIETES, artifactSubName, libelleEffetRune, choixEffetRune, formatRuneEffect } from '../src/lib/effects';
import { ELEMENTS, RUNE_SETS } from '../src/types';
import { egal, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

// Le REGISTRE DES MANQUES : les effets de compétence dont le nom français n'a pas
// encore été relevé en jeu. Ils s'affichent sous leur nom SWARFARM, en anglais.
// ⚠️ On n'y ajoute un effet qu'en sachant qu'il manque ; on l'en retire quand
// son nom entre dans `jeuFr.effets`.
const EFFETS_SANS_TRADUCTION: readonly string[] = [];

// Les noms d'effets que portent les compétences des données SWARFARM.
function effetsDesDonnees(): Set<string> {
  const dossier = join(RACINE, 'public', 'data', 'skills');
  const noms = new Set<string>();
  for (const f of readdirSync(dossier)) {
    const d = JSON.parse(readFileSync(join(dossier, f), 'utf8')) as { competences?: { effets?: { nom?: string }[] }[] };
    for (const c of d.competences ?? []) for (const e of c.effets ?? []) if (e.nom) noms.add(e.nom);
  }
  return noms;
}

export function testLexiqueJeuCouverture() {
  titre('lexique du jeu — chaque effet des données a son nom français');
  const donnees = effetsDesDonnees();
  ok(donnees.size > 100, `les données portent des effets (${donnees.size})`);
  const sansNom = [...donnees].filter((e) => !(e in jeuFr.effets) && !EFFETS_SANS_TRADUCTION.includes(e)).sort();
  egal(sansNom, [], 'aucun effet sans nom français ni inscription au registre des manques');
  const perimes = Object.keys(jeuFr.effets).filter((e) => !donnees.has(e)).sort();
  egal(perimes, [], 'aucune entrée du lexique pour un effet disparu des données');
  egal(EFFETS_SANS_TRADUCTION.filter((e) => e in jeuFr.effets), [], 'un effet traduit sort du registre des manques');
  egal(Object.keys(jeuEn.effets).length, 0, 'anglais : les noms SWARFARM sont ceux du jeu, aucune entrée');

  titre('lexique du jeu — sets, éléments, sous-propriétés : tout ce que l’app connaît');
  for (const j of [jeuFr, jeuEn]) {
    const langue = j === jeuFr ? 'fr' : 'en';
    egal(RUNE_SETS.map((s) => s.key).filter((k) => !(k in j.sets)), [], `${langue} : chaque set a son nom`);
    egal(ELEMENTS.map((e) => e.key).filter((k) => !(k in j.elements)), [], `${langue} : chaque élément a son nom`);
    egal(Object.keys(j.sousProprietes).map(Number).sort((a, b) => a - b), [...CODES_SOUS_PROPRIETES], `${langue} : exactement les 49 sous-propriétés du moteur`);
    egal(RUNE_SETS.map((s) => s.key).filter((k) => bonusSet(j, k) === undefined), [], `${langue} : chaque set a son effet`);
  }
}

export function testLexiqueJeuLibelles() {
  titre('lexique du jeu — les libellés relevés en jeu');
  egal(jeuFr.stats.cr, 'Tx critiq.', 'le taux critique s’écrit comme dans le jeu');
  egal(jeuFr.stats.cd, 'Dgts critiq.', 'les dégâts critiques aussi');
  egal(choixEffetRune(1, jeuFr), 'PV +', 'dans un choix, la valeur fixe : « PV + »');
  egal(choixEffetRune(2, jeuFr), 'PV %', 'et le pourcentage : « PV % »');
  egal(libelleEffetRune(2, jeuFr), 'PV%', 'sur une ligne de rune, « PV% » comme avant');
  egal(formatRuneEffect({ code: 10, value: 80 }, jeuFr), 'Dgts critiq. +80%', 'une principale de rune');
  egal(formatRuneEffect({ code: 10, value: 80 }, jeuEn), 'CRI Dmg +80%', 'la même en anglais');
  egal(nomSet(jeuFr, 'guard'), 'Gardien', 'Guard : « Gardien », pas une traduction');
  egal(nomSet(jeuFr, 'shield'), 'Protection', 'Shield : « Protection »');
  egal(nomSet(jeuFr, 'violent'), 'Violente', 'les sets sont au féminin, comme « rune »');
  egal(nomSet(jeuEn, 'guard'), 'Guard', 'en anglais, le nom SWARFARM');
  egal(bonusSet(jeuFr, 'vampire'), 'Drain de vie 35%', 'Vampire : « Drain de vie », comme dans l’inventaire');
  ok(bonusSet(jeuFr, 'seal')!.includes('25%') && bonusSet(jeuEn, 'seal')!.includes('25%'), 'Sceau : 25 % de chance, comme en jeu');
  egal(nomEffet(jeuFr, 'Stun'), 'Étourdi', 'Stun : « Étourdi »');
  egal(nomEffet(jeuFr, 'Remove Buff', true), 'Suppr. eff. amélior. enn.', 'la forme courte, celle du filtre du jeu');
  egal(nomEffet(jeuFr, 'Stun', true), 'Étourdi', 'sans forme courte, la longue');
  egal(nomEffet(jeuEn, 'Stun'), 'Stun', 'en anglais, le nom SWARFARM');
  egal(nomEffet(jeuFr, 'Nouvel effet'), 'Nouvel effet', 'un effet inconnu garde son nom SWARFARM');
  egal(nomSet(jeuFr, 'inconnu'), 'inconnu', 'un set inconnu garde sa clé');
  egal(nomElement(jeuEn, 'water'), 'Water', 'un élément en anglais');
  egal(nomGrade(jeuFr, 5, true), 'Lég', 'l’abréviation d’un grade, pour une tuile étroite');

  titre('lexique du jeu — le nom d’une sous-propriété sans sa valeur, dans les deux langues');
  egal(artifactSubName(200, jeuEn), 'ATK+ Proportional to Lost HP', 'anglais : « up to » ôté avec la valeur');
  egal(artifactSubName(218, jeuEn), 'Additional Damage by % of HP', 'anglais : la valeur était au milieu');
  egal(artifactSubName(222, jeuEn), "CRIT DMG+ as the enemy's HP condition is good", 'anglais : « up to » au milieu');
  egal(artifactSubName(215, jeuFr), 'Drain de vie', 'français : inchangé');
}
