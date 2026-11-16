// Le dossier SW Exporter
// (bureau/swexPur.ts, src/components/BlocApplication.tsx).
//
// ⚠️ Ce module décide quel fichier de l'utilisateur est lu et quand : un nom
// mal reconnu suivrait le mauvais compte, un réglage mal relu inventerait un
// chemin, une décision « donner » trop large réannoncerait sans cesse.

import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { aDonner, dimensionADonner, exportsDuDossier, lireNomExport, lireReglage } from '../bureau/swexPur';
import { ajoutContientSaison, saisonDuJournal } from '../bureau/journalSwexDisque';
import { presentationSwex } from '../src/components/BlocApplication';
import { messageExportSwex } from '../src/components/SuiviSwex';
import { egal, ok, titre } from './outils';
import { fr } from '../src/i18n/fr';

export default function testBureauSwex() {
  titre('bureau · SW Exporter — reconnaître un export de compte');
  // Les noms d'un vrai dossier SW Exporter.
  egal(lireNomExport('tototriou-12889591.json'), { fichier: 'tototriou-12889591.json', nom: 'tototriou', id: '12889591' }, 'nom simple');
  egal(lireNomExport('Killian26~-738882.json')?.nom, 'Killian26~', 'un « ~ » dans le nom');
  egal(lireNomExport('✨Vincent✨-1321384.json')?.nom, '✨Vincent✨', 'des emojis dans le nom');
  egal(lireNomExport('Jean-Pierre-42.json'), { fichier: 'Jean-Pierre-42.json', nom: 'Jean-Pierre', id: '42' }, 'un tiret dans le nom : l’identifiant est le DERNIER groupe');
  for (const pasUnExport of ['ca.pem', 'settings.json', '-123.json', 'tototriou.json', 'tototriou-12a.json', 'tototriou-123.json.bak'])
    egal(lireNomExport(pasUnExport), null, `pas un export : ${pasUnExport}`);
  egal(
    exportsDuDossier(['ZzzzzZ-5281814.json', 'cert', 'tototriou-12889591.json', 'notes.txt', 'Quentin000-2105714.json']).map((e) => e.nom),
    ['Quentin000', 'tototriou', 'ZzzzzZ'],
    'les exports d’un dossier, triés par nom, le reste écarté'
  );

  titre('bureau · SW Exporter — le réglage relu avec méfiance');
  const vide = { dossier: null, fichier: null, dernierLu: null, dimensionLue: null };
  egal(lireReglage(null), vide, 'premier lancement : rien');
  egal(lireReglage('abîmé'), vide, 'fichier abîmé : rien');
  const bon = { dossier: 'C:\\SWEX', fichier: 'tototriou-12889591.json', dernierLu: 1759737040000, dimensionLue: 1794858558 };
  egal(lireReglage(bon), bon, 'réglage complet : relu tel quel');
  egal(lireReglage({ ...bon, fichier: '..\\..\\Windows\\win.ini' }).fichier, null, 'un CHEMIN à la place du nom de fichier : refusé');
  egal(lireReglage({ ...bon, fichier: 'sous/tototriou-1.json' }).fichier, null, 'un sous-dossier : refusé');
  egal(lireReglage({ ...bon, dernierLu: 'hier' }).dernierLu, null, 'date illisible : oubliée');
  egal(lireReglage({ ...bon, dimensionLue: 'hier' }).dimensionLue, null, 'saison dimensionnelle illisible : oubliée');

  titre('bureau · SW Exporter — donner l’export à la page, ou pas');
  egal(aDonner(1000, null, false), { donner: true, nouveau: true }, 'jamais lu : donné, annoncé');
  egal(aDonner(2000, 1000, false), { donner: true, nouveau: true }, 'plus récent que le dernier lu : donné, annoncé');
  egal(aDonner(1000, 1000, false), { donner: false, nouveau: false }, 'déjà lu, la page a son compte : rien');
  egal(aDonner(1000, 1000, true), { donner: true, nouveau: false }, 'déjà lu, page SANS compte : redonné en silence');

  titre('bureau · SW Exporter — ce que montre le bloc « Application »');
  const aucun = presentationSwex(null, fr);
  ok(aucun.options.length === 0 && aucun.invocateur === 'Aucun dossier choisi.', 'sans dossier : sélecteur vide, « Aucun dossier choisi. »');
  const etat = {
    dossier: 'C:\\SWEX',
    fichier: 'tototriou-12889591.json',
    exports: [
      { fichier: 'tototriou-12889591.json', nom: 'tototriou', id: '12889591', modifie: 2000 },
      { fichier: 'Sam-1.json', nom: 'Sam', id: '1', modifie: 1 },
      { fichier: 'Sam-2.json', nom: 'Sam', id: '2', modifie: 1 },
    ],
    dernierLu: 2000,
    introuvable: false,
  };
  egal(presentationSwex(etat, fr).options.map((o) => o.libelle), ['tototriou', 'Sam (1)', 'Sam (2)'], 'deux homonymes : l’identifiant les sépare');
  ok(presentationSwex(etat, fr).invocateur.endsWith('— lu.'), 'export suivi déjà appliqué : « — lu. »');
  ok(presentationSwex({ ...etat, dernierLu: 1000 }, fr).invocateur.endsWith('lecture en cours…'), 'export plus récent que le dernier lu : « lecture en cours… »');
  egal(presentationSwex({ ...etat, fichier: null }, fr).invocateur, 'Choisis l’invocateur à suivre.', 'dossier choisi, invocateur non');
  egal(presentationSwex({ ...etat, exports: [] }, fr).invocateur, 'Aucun export de compte à la racine de ce dossier.', 'dossier sans export');
  ok(presentationSwex({ ...etat, introuvable: true }, fr).invocateur.startsWith('Dossier introuvable'), 'dossier disparu : dit');

  titre('bureau · SW Exporter — l’annonce d’un export appliqué');
  egal(messageExportSwex('Sam', true, fr), 'Compte de Sam chargé depuis SW Exporter', 'après un choix : chargé');
  egal(messageExportSwex('Sam', false, fr), 'Compte de Sam mis à jour depuis SW Exporter', 'export suivant : mis à jour');
  egal(messageExportSwex(null, false, fr), 'Compte mis à jour depuis SW Exporter', 'sans nom de joueur');

  // ⚠️ Le marquage `complet` vit dans le processus principal, qu'aucun test
  // unitaire n'atteint sans Electron : un contrôle de source ici. La garde
  // et l'import complet, côté page, se prouvent dans l'app
  // (`npm run bureau:preuve -- --swex`).
  titre('bureau · SW Exporter — l’export qui suit un choix part complet');
  const principal = readFileSync('bureau/swex.ts', 'utf8');
  ok(/fichier, dernierLu: null, dimensionLue: null \};\s*complet = true;/.test(principal), 'bureau/swex.ts : choisir un invocateur rend l’export suivant complet, et sa saison dimensionnelle à redonner');
  ok(/dernierLu: modifie \};\s*complet = false;/.test(principal), 'bureau/swex.ts : appliqué par la page, l’export suivant redevient « Mon compte »');
  ok(principal.includes("envoyer('bureau:swex-export', { texte, modifie, nouveau, fichier, complet });"), 'bureau/swex.ts : `complet` part avec l’export');
}

// L'arène dimensionnelle : le journal SWEX du dossier (bureau/journalSwexDisque.ts)
// et son passage à la page (bureau/swex.ts, SuiviSwex, App.tsx).
export async function testBureauJournalSwex() {
  titre('bureau · SW Exporter — la saison dimensionnelle du journal SWEX');
  const journal = 'tests/fixtures/journal-swex-miniature.txt';
  egal((await saisonDuJournal(journal, 424242))?.tvalue, 2000, 'la dernière saison lisible de l’invocateur suivi');
  egal((await saisonDuJournal(journal, 777))?.tvalue, 1000, 'celle d’un autre invocateur du même journal : la sienne, plus ancienne');
  egal(await saisonDuJournal(journal, 1), null, 'un invocateur absent du journal : rien');
  // Une fenêtre minuscule : la lecture par la fin s'élargit jusqu'à la trouver.
  egal((await saisonDuJournal(journal, 777, 64))?.tvalue, 1000, 'lue par la fin, fenêtre élargie jusqu’à la saison');

  titre('bureau · SW Exporter — le journal relu seulement sur ce qui s’y ajoute');
  const dossier = mkdtempSync(join(tmpdir(), 'swb-journal-'));
  try {
    const chemin = join(dossier, 'full_log.txt');
    egal(await saisonDuJournal(chemin, 424242), null, 'pas de journal (Full Logger éteint) : rien');
    writeFileSync(chemin,'API Command: HubUserLogin - x\nRequest: \n{}\nResponse: \n{"ret_code":0}\n');
    const premier = await ajoutContientSaison(chemin, 0);
    ok(!premier.contient && premier.taille > 0, 'un journal sans saison : rien à relire');
    appendFileSync(chemin, 'API Command: BattleDungeonResult_V2 - x\nRequest: \n{}\n');
    egal((await ajoutContientSaison(chemin, premier.taille)).contient, false, 'un ajout sans saison (une partie) : rien à relire');
    const avant = (await ajoutContientSaison(chemin, premier.taille)).taille;
    appendFileSync(chemin, readFileSync(journal, 'utf8'));
    egal((await ajoutContientSaison(chemin, avant)).contient, true, 'un ajout avec une saison (le mode ouvert) : à relire');
    writeFileSync(chemin, 'API Command: HubUserLogin - x\n');
    egal((await ajoutContientSaison(chemin, avant)).contient, true, 'un journal recommencé (plus court) : relu comme neuf');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }

  titre('bureau · SW Exporter — donner une saison dimensionnelle, ou pas');
  ok(dimensionADonner(2000, null), 'jamais appliquée : donnée');
  ok(dimensionADonner(2000, 1000), 'plus récente que la dernière appliquée : donnée');
  ok(!dimensionADonner(2000, 2000), 'déjà appliquée : rien');
  ok(!dimensionADonner(undefined, null), 'sans heure serveur lisible : jamais');

  // Le passage à la page, sans Electron : un contrôle de source, comme plus haut.
  titre('bureau · SW Exporter — la saison part à la page, qui la confirme');
  const principal = readFileSync('bureau/swex.ts', 'utf8');
  ok(principal.includes("envoyer('bureau:swex-dimension', { saison, recents, cle: saison.tvalue });"), 'bureau/swex.ts : la saison part avec les équipes récentes de l’export');
  ok(/void donnerDimension\(false\);/.test(principal) && /pagePrete = true;[\s\S]*?void donnerDimension\(true\);/.test(principal), 'bureau/swex.ts : relue à la page prête, puis à chaque changement du dossier');
  const preload = readFileSync('bureau/preload.ts', 'utf8');
  ok(preload.includes("'bureau:swex-dimension'") && preload.includes("'bureau:swex-dimension-lue'"), 'bureau/preload.ts : les deux canaux');
  egal(fr.application.dimensionMiseAJour(2), 'Arène dimensionnelle mise à jour depuis le journal SWEX : 2 équipes', 'l’annonce');
}
