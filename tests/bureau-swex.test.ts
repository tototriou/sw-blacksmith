// Le dossier SW Exporter
// (bureau/swexPur.ts, src/components/BlocApplication.tsx).
//
// ⚠️ Ce module décide quel fichier de l'utilisateur est lu et quand : un nom
// mal reconnu suivrait le mauvais compte, un réglage mal relu inventerait un
// chemin, une décision « donner » trop large réannoncerait sans cesse.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { aDonner, dimensionADonner, exportsDuDossier, lireNomExport, lireReglage } from '../bureau/swexPur';
import { lireDimension } from '../bureau/swexDimension';
import { appliquerDimension } from '../plugin-swex/source/dimension';
import { COMPTE_LIVE, DIMENSION, DOSSIER_PLUGIN } from '../plugin-swex/source/fichiers';
import { presentationSwex } from '../src/components/BlocApplication';
import { messageExportSwex } from '../src/components/SuiviSwex';
import { egal, ok, saisonDimensionMiniature, titre } from './outils';
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
  const vide = { dossier: null, fichier: null, dernierLu: null, dimensionLue: null, direct: false };
  egal(lireReglage(null), vide, 'premier lancement : rien, direct coupé');
  egal(lireReglage('abîmé'), vide, 'fichier abîmé : rien');
  const bon = { dossier: 'C:\\SWEX', fichier: 'tototriou-12889591.json', dernierLu: 1759737040000, dimensionLue: 1794858558, direct: true };
  egal(lireReglage(bon), bon, 'réglage complet : relu tel quel');
  egal(lireReglage({ ...bon, fichier: '..\\..\\Windows\\win.ini' }).fichier, null, 'un CHEMIN à la place du nom de fichier : refusé');
  egal(lireReglage({ ...bon, fichier: 'sous/tototriou-1.json' }).fichier, null, 'un sous-dossier : refusé');
  egal(lireReglage({ ...bon, dernierLu: 'hier' }).dernierLu, null, 'date illisible : oubliée');
  egal(lireReglage({ ...bon, dimensionLue: 'hier' }).dimensionLue, null, 'saison dimensionnelle illisible : oubliée');
  egal(lireReglage({ ...bon, direct: 'oui' }).direct, false, 'direct illisible : coupé');

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

// L'arène dimensionnelle : la saison tenue par le plugin SWEX, lue dans son
// dossier (bureau/swexDimension.ts), et son passage à la page (bureau/swex.ts,
// SuiviSwex, App.tsx).
export async function testBureauSwexDimension() {
  titre('bureau · SW Exporter — la saison dimensionnelle du plugin SWEX');
  const dossier = mkdtempSync(join(tmpdir(), 'swb-dimension-'));
  try {
    const suivi = join(dossier, DOSSIER_PLUGIN, 'Essai-424242');
    egal(await lireDimension(dossier, '424242'), null, 'pas de dossier du plugin : rien');
    mkdirSync(suivi, { recursive: true });
    writeFileSync(join(suivi, COMPTE_LIVE), '{}\n');
    egal(await lireDimension(dossier, '424242'), null, 'le mode jamais ouvert : rien');
    const saison = appliquerDimension(null, 'dimensionarena_getSeasonInfo', {}, saisonDimensionMiniature(), 'essai')!;
    const attaquee = appliquerDimension(saison, 'dimensionarena_battleStart', { unit_id_list: [900002, 900001, 0, 0] }, { tvalue: 2500, season_id: 1 }, 'essai')!;
    writeFileSync(join(suivi, DIMENSION), JSON.stringify(saison));
    const lue = await lireDimension(dossier, '424242');
    egal([lue?.ouverture, lue?.t, lue?.attaques, lue?.saison.unit_list.length], [2000, 2000, [], 3], 'la saison de l’ouverture : ses heures, aucune attaque vue');
    writeFileSync(join(suivi, DIMENSION), JSON.stringify(attaquee));
    egal(
      await lireDimension(dossier, '424242').then((l) => [l?.ouverture, l?.t, l?.attaques.length]),
      [2000, 2500, 1],
      'un changement dans le mode : la même ouverture, une heure plus récente, l’attaque jouée'
    );
    egal(await lireDimension(dossier, '777'), null, 'un autre invocateur : pas son dossier');
    writeFileSync(join(suivi, DIMENSION), JSON.stringify({ ...saison, wizard_id: 777 }));
    egal(await lireDimension(dossier, '424242'), null, 'une saison d’un autre invocateur dans le dossier : refusée');
    writeFileSync(join(suivi, DIMENSION), JSON.stringify({ ...saison, swblacksmith: undefined }));
    egal(await lireDimension(dossier, '424242'), null, 'un fichier sans la marque du plugin : refusé');
    writeFileSync(join(suivi, DIMENSION), '{"wizard_id":4242');
    egal(await lireDimension(dossier, '424242'), null, 'un fichier à moitié écrit : rien, le prochain changement redonnera');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }

  titre('bureau · SW Exporter — donner une saison dimensionnelle, ou pas');
  ok(dimensionADonner(2000, null), 'jamais appliquée : donnée');
  ok(dimensionADonner(2000, 1000), 'plus récente que la dernière appliquée : donnée');
  ok(!dimensionADonner(2000, 2000), 'déjà appliquée : rien');
  ok(!dimensionADonner(undefined, null), 'sans heure serveur lisible : jamais');
  ok(dimensionADonner(2000, 2000, true), 'déjà appliquée, mais la page n’a rien de ce mode : redonnée');

  // Le passage à la page, sans Electron : un contrôle de source, comme plus haut.
  titre('bureau · SW Exporter — la saison part à la page, qui la confirme');
  const principal = readFileSync('bureau/swex.ts', 'utf8');
  ok(principal.includes("envoyer('bureau:swex-dimension', { saison: lue.saison, recents, cle: lue.t, nouvelle });"), 'bureau/swex.ts : la saison part avec les attaques, sa clé est l’heure du dernier changement');
  ok(principal.includes('const nouvelle = dimensionADonner(lue.ouverture, reglage.dimensionLue);'), 'bureau/swex.ts : annoncée seulement après une OUVERTURE du mode non appliquée, pas à chaque changement');
  ok(
    /\/dimension\/\.test\(String\(nom\)\)\) dimensionChangee\(\);/.test(principal) && /pagePrete = true;[\s\S]*?void donnerDimension\(pageSansDimension === true\);/.test(principal),
    'bureau/swex.ts : relue à la page prête (redonnée si la page n’a rien de ce mode), puis à chaque écriture du fichier par le plugin'
  );
  ok(!principal.includes('full_log') && !principal.includes('journalSwex'), 'bureau/swex.ts : plus de journal Full Logger');
  const preload = readFileSync('bureau/preload.ts', 'utf8');
  ok(preload.includes("'bureau:swex-dimension'") && preload.includes("'bureau:swex-dimension-lue'"), 'bureau/preload.ts : les deux canaux');
  egal(fr.application.dimensionMiseAJour(2), 'Arène dimensionnelle mise à jour depuis SW Exporter : 2 équipes', 'l’annonce');
}
