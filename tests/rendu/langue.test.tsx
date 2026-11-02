// Tests de rendu — la langue de l'interface (docs/02-app/transverse/feat-langues.md) :
// le réglage « Langue » des Paramètres, et l'enveloppe de l'app (navigation,
// barre du haut, Paramètres) affichée en anglais quand on l'a choisi.
//
// ⚠️ Le rendu serveur n'a pas de navigateur : « Auto » y donne la langue
// source, le français. Chaque test qui choisit l'anglais revient à « Auto ».

import { SettingsList } from '../../src/components/SettingsMenu';
import { RuneDetailBox } from '../../src/components/PieceDetail';
import type { RuneDetail } from '../../src/types';
import { setChoixLangue } from '../../src/hooks/useLangue';
import MechanicsPage from '../../src/pages/MechanicsPage';
import BestiaryPage from '../../src/pages/BestiaryPage';
import MonsterDetailDialog from '../../src/components/MonsterDetailDialog';
import { mecaniquesEn } from '../../src/i18n/articles/mecaniques.en';
import { mecaniquesFr } from '../../src/i18n/articles/mecaniques.fr';
import { autreForme } from '../../src/lib/monsterForms';
import type { Monster } from '../../src/types';
import { egal, exportSynthetique, monstersJson, ok, titre } from '../outils';
import { parseAccountInventory } from '../../src/lib/importAccount';
import { fr } from '../../src/i18n/fr';
import { rendreApp } from './app.test';
import { rendreCompte } from './compte.test';
import { AVEC_MONSTRE, rendreOptimizer } from './optimizer.test';
import { auTelephone, boutons, rendre, texteVisible } from './outils-rendu';

const rien = () => {};
const MONSTRES = monstersJson() as Monster[];
const reglages = () => rendre(<SettingsList onClearData={rien} onKeepAccount={rien} accountExportedAt={Date.UTC(2026, 7, 9)} groupes />);

function enAnglais<T>(f: () => T): T {
  setChoixLangue('en');
  try {
    return f();
  } finally {
    setChoixLangue('auto');
  }
}

export function testRenduLangueReglage() {
  titre('rendu · langue — le réglage, en tête des Paramètres');
  const html = reglages();
  const texte = texteVisible(html);
  ok(texte.indexOf('Langue') >= 0 && texte.indexOf('Langue') < texte.indexOf('Thème'), '« Langue » vient avant « Thème »');
  const choix = boutons(html).map((b) => b.texte);
  ok(['Auto', 'Français', 'English'].every((c) => choix.includes(c)), 'trois choix : Auto, Français, English');
  // Les boutons eux-mêmes : `Segmented` rend aussi des copies de mesure, invisibles.
  const boutonDe = (nom: string) => (html.match(/<button[\s\S]*?<\/button>/g) ?? []).filter((b) => texteVisible(b) === nom);
  ok(boutonDe('Français').some((b) => b.includes('data-drapeau="fr"')), '« Français » porte le drapeau de la France');
  ok(boutonDe('English').some((b) => b.includes('data-drapeau="en"')), '« English » porte le drapeau du Royaume-Uni');
  ok(boutonDe('Auto').length > 0 && boutonDe('Auto').every((b) => !b.includes('data-drapeau')), '« Auto » n’a pas de drapeau');

  titre('rendu · langue — chaque langue garde son nom dans l’autre');
  const anglais = enAnglais(() => boutons(reglages()).map((b) => b.texte));
  ok(anglais.includes('Français') && anglais.includes('English'), 'en anglais aussi : « Français » et « English »');
}

export function testRenduLangueParametres() {
  titre('rendu · langue — les Paramètres en anglais');
  const texte = enAnglais(() => texteVisible(reglages()));
  for (const attendu of ['Language', 'Theme', 'Keep my data', 'Delete everything', 'Account exported on']) {
    ok(texte.includes(attendu), `« ${attendu} »`);
  }
  for (const absent of ['Thème', 'Garder mes données', 'Tout supprimer', 'Compte exporté']) {
    ok(!texte.includes(absent), `plus de « ${absent} »`);
  }
  ok(texteVisible(reglages()).includes('Garder mes données'), 'revenu à « Auto » : le français du rendu serveur');
}

// Une rune Violente légendaire, principale Dgts critiq. — le vocabulaire du jeu
// s'y lit partout : stat principale, secondaires, grade, effet du set.
const RUNE: RuneDetail = {
  id: 1,
  slot: 2,
  set: 'violent',
  rank: 6,
  rarity: 5,
  level: 15,
  main: { code: 10, value: 80 },
  subs: [{ code: 8, value: 30 }, { code: 9, value: 20 }],
};

export function testRenduLangueFicheRune() {
  titre('rendu · langue — la fiche d’une rune, dans le vocabulaire du jeu de chaque langue');
  const fr = texteVisible(rendre(<RuneDetailBox rune={RUNE} />));
  for (const attendu of ['Dgts critiq. +80%', 'Légendaire', 'VIT 30', 'Tx critiq. 20%', '4 Set : Chance de tour supplémentaire 22%']) {
    ok(fr.includes(attendu), `français : « ${attendu} »`);
  }
  const en = enAnglais(() => texteVisible(rendre(<RuneDetailBox rune={RUNE} />)));
  for (const attendu of ['CRI Dmg +80%', 'Legend', 'SPD 30', 'CRI Rate 20%', '4 Set: Get Extra Turn +22%']) {
    ok(en.includes(attendu), `anglais : « ${attendu} »`);
  }
}

export function testRenduLangueApp() {
  titre('rendu · langue — l’app, en anglais : navigation, barre du haut, Paramètres');
  const html = enAnglais(() => rendreApp('#/parametres'));
  const texte = texteVisible(html);
  for (const attendu of ['Home', 'Play', 'My account', 'Tools', 'Resources', 'Settings', 'Go to…', 'These settings apply to the whole app']) {
    ok(texte.includes(attendu), `« ${attendu} »`);
  }
  ok(html.includes('aria-label="Main navigation"'), 'onglets du bas : « Main navigation »');
  for (const absent of ['Accueil', 'Ressources', 'Aller à…', 'Paramètres']) ok(!texte.includes(absent), `plus de « ${absent} »`);

  titre('rendu · langue — en français, rien ne change');
  const fr = texteVisible(rendreApp('#/parametres'));
  ok(['Accueil', 'Jouer', 'Mon compte', 'Ressources', 'Paramètres'].every((m) => fr.includes(m)), 'les mêmes entrées, en français');
}

// Les pages ouvertes à tous (lot 3) : accueil, Nouveautés, Télécharger,
// Mécaniques, Bestiaire et la fiche d'un monstre, en anglais.
export function testRenduLanguePagesPubliques() {
  titre('rendu · langue — les pages ouvertes à tous, en anglais');
  const accueil = enAnglais(() => texteVisible(rendreApp('#/')));
  for (const attendu of ['The toolbox for Summoners', 'How it works', 'Export your account', 'Features', 'Rune analysis', 'Drop your .json file here', "See what's new"])
    ok(accueil.includes(attendu), `accueil : « ${attendu} »`);
  for (const absent of ['Comment ça marche', 'Fonctionnalités', 'Dépose ton fichier']) ok(!accueil.includes(absent), `accueil : plus de « ${absent} »`);

  const nouveautes = enAnglais(() => texteVisible(rendreApp('#/releases')));
  for (const attendu of ['What changed in each version', 'SW Blacksmith in English', 'Not yet released', 'A redesigned Optimizer'])
    ok(nouveautes.includes(attendu), `Nouveautés : « ${attendu} »`);
  ok(!nouveautes.includes('Version actuelle') && !nouveautes.includes('Un Optimizer repensé'), 'Nouveautés : le journal anglais, pas le français');
  ok(/October 29, 2026/.test(nouveautes), 'Nouveautés : les dates au format anglais');

  const telecharger = enAnglais(() => texteVisible(rendreApp('#/telecharger')));
  ok(telecharger.includes('Download for Windows') && telecharger.includes('Version offered: v'), 'Télécharger : boutons et version proposée');

  const mecaniques = enAnglais(() => rendre(<MechanicsPage />));
  ok(texteVisible(mecaniques).startsWith('Game mechanics The formulas behind Summoners War'), 'Mécaniques : l’article anglais');
  egal(boutons(mecaniques).map((b) => b.texte), mecaniquesEn.sections.map((s) => s.titre), 'Mécaniques : le sommaire anglais');

  const bestiaire = enAnglais(() => rendre(<BestiaryPage monsters={MONSTRES} loadState="live" menuOuvert={false} onFermerMenu={rien} />));
  ok(bestiaire.includes('placeholder="Search for a monster by name…"') && texteVisible(bestiaire).includes('Bestiary'), 'Bestiaire : titre et recherche');
  ok(/\d+ monsters/.test(texteVisible(bestiaire)) && !texteVisible(bestiaire).includes('monstres'), 'Bestiaire : les comptes en anglais');

  const bellenus = MONSTRES.find((m) => m.name === 'Bellenus' && autreForme(m, MONSTRES))!;
  const fiche = enAnglais(() => texteVisible(auTelephone(() => rendre(<MonsterDetailDialog monster={bellenus} autre={autreForme(bellenus, MONSTRES)} onClose={rien} />))));
  for (const attendu of ['Base form', 'Transformed form', 'HP', 'ATK', 'CRI Rate', 'CRI Dmg', 'Resistance', 'Accuracy'])
    ok(fiche.includes(attendu), `fiche d’un monstre : « ${attendu} »`);
}

// La RTA et le Siège en anglais : en-têtes, actions et états vides.
export function testRenduLangueRtaSiege() {
  titre('rendu · langue — la RTA et le Siège, en anglais');
  const prepa = enAnglais(() => rendreApp('#/rta'));
  for (const attendu of ['My prep', 'Add a section', 'Turn order', 'by total combat speed', 'Categories'])
    ok(texteVisible(prepa).includes(attendu), `prépa RTA : « ${attendu} »`);
  ok(prepa.includes('placeholder="Search a monster to add to your RTA prep…"'), 'prépa RTA : la recherche');
  for (const absent of ['Ma prépa', 'Ajouter une section', 'Ordre de tour']) ok(!texteVisible(prepa).includes(absent), `prépa RTA : plus de « ${absent} »`);

  const ami = enAnglais(() => texteVisible(rendreApp('#/rta/ami')));
  ok(ami.includes('No prep opened') && ami.includes('Open a friend’s prep'), 'prépa d’un ami : état vide et bouton');

  const defense = enAnglais(() => texteVisible(rendreApp('#/siege/defense')));
  for (const attendu of ['Defense', '0 team', 'No defense team yet', 'Add a team'])
    ok(defense.includes(attendu), `Siège · défense : « ${attendu} »`);
  ok(!defense.includes('Ajouter une équipe'), 'Siège · défense : plus de français');

  const offense = enAnglais(() => texteVisible(rendreApp('#/siege/offense')));
  ok(offense.includes('No offense team yet'), 'Siège · offense : l’état vide nomme le côté');

  const recos = enAnglais(() => texteVisible(rendreApp('#/siege/recommandations')));
  for (const attendu of ['Recommendations', 'No recommendation.', 'Create one', 'Create a recommendation'])
    ok(recos.includes(attendu), `recommandations : « ${attendu} »`);
  ok(!recos.includes('Recommandations'), 'recommandations : plus de français');
}

// Le Compte, le pied de page et les messages d'import en anglais.
export function testRenduLangueCompte() {
  titre('rendu · langue — le Compte et le pied de page, en anglais');
  const vide = enAnglais(() => texteVisible(rendreApp('#/compte')));
  ok(vide.includes('No account data loaded'), 'Compte vide : le titre de l’état vide');
  ok(vide.includes('Unofficial project, not affiliated with Com2uS.'), 'pied de page : la mention Com2uS');
  ok(!vide.includes('Aucune donnée de compte chargée'), 'Compte vide : plus de français');

  const box = enAnglais(() => texteVisible(rendreCompte('monstres', 'resume')));
  for (const attendu of ['My box', 'Duplicates', 'Clear filters']) ok(box.includes(attendu), `box : « ${attendu} »`);

  const resume = enAnglais(() => texteVisible(rendreCompte('artefacts', 'resume')));
  for (const attendu of ['Artifacts 8', '5 attribute · 3 type · 2 to level', 'Best score 144 attribute 144 · type 93', 'Efficiency distribution', 'Rarities', 'Main stats'])
    ok(resume.includes(attendu), `résumé des artéfacts : « ${attendu} »`);
  for (const absent of ['Raretés', 'Meilleur score']) ok(!resume.includes(absent), `résumé des artéfacts : plus de « ${absent} »`);

  const top = enAnglais(() => texteVisible(rendreCompte('artefacts', 'resume')));
  ok(top.includes('Damage taken reduction') && top.includes('Other substats'), 'top par propriété : les familles en anglais');

  // Les tris de la liste de runes viennent du dictionnaire, pas de la lib.
  const runes = parseAccountInventory(exportSynthetique(), fr).runes;
  const liste = enAnglais(() => texteVisible(rendreCompte('runes', 'liste', runes)));
  ok(liste.includes('Upgrade level') && liste.includes('Substat total'), 'liste de runes : les tris en anglais');
  ok(!liste.includes('Nv. d’amélioration'), 'liste de runes : plus de tri en français');
}

// L'Optimizer, l'écran des critères : au bureau, puis le panneau « Options » du téléphone.
export function testRenduLangueOptimizer() {
  titre('rendu · langue — l’Optimizer, l’écran des critères, en anglais');
  const bureau = enAnglais(() => texteVisible(rendreOptimizer(AVEC_MONSTRE)));
  for (const attendu of ['Active list', 'Searched rune set', 'Conditions', 'Base stats excluded', 'Search objective', 'Efficiency', 'Real damage', 'Effective HP', 'Speed', 'My monster’s state'])
    ok(bureau.includes(attendu), `bureau : « ${attendu} »`);
  for (const absent of ['Liste active', 'Set de runes recherché', 'Objectif de recherche', 'Stats de base exclues', 'État de mon monstre'])
    ok(!bureau.includes(absent), `bureau : plus de « ${absent} »`);

  const panneau = enAnglais(() => auTelephone(() => rendreOptimizer(AVEC_MONSTRE, true)));
  const t = texteVisible(panneau);
  for (const attendu of ['Search depth', 'Low', 'Medium', 'High', 'Extreme', 'Exclude runes already in use'])
    ok(t.includes(attendu), `téléphone, panneau « Options » : « ${attendu} »`);
  ok(boutons(panneau).some((b) => b.texte === 'Medium' && !!b.title), 'un préréglage garde son explication en anglais');
  ok(!t.includes('Profondeur de recherche'), 'téléphone : plus de français dans les réglages avancés');
}

// L'article « Mécaniques » : un par langue, mêmes sections dans le même ordre.
export function testRenduMecaniquesLangues() {
  titre('Mécaniques — un article par langue, mêmes sections');
  egal(mecaniquesEn.sections.map((s) => s.id), mecaniquesFr.sections.map((s) => s.id), 'mêmes sections (ancres), même ordre');
  // « Variance » s'écrit pareil dans les deux langues.
  ok(mecaniquesEn.sections.every((s, i) => s.titre !== mecaniquesFr.sections[i].titre || s.titre === 'Variance'), 'chaque titre de section est traduit');
  const fr = texteVisible(rendre(<MechanicsPage />));
  ok(fr.includes('Correction Rapide') && !fr.includes('Swift'), 'en français, le set porte son nom du jeu : Rapide');
}
