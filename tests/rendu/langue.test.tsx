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
import { ok, titre } from '../outils';
import { rendreApp } from './app.test';
import { boutons, rendre, texteVisible } from './outils-rendu';

const rien = () => {};
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
