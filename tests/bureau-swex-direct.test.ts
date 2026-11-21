// Le direct de l'application de bureau : le fichier live du plugin SWEX
// trouvé, jugé et lu (bureau/swexPur.ts, bureau/swexLive.ts), et le plugin
// installé comparé à l'app.
//
// ⚠️ Ce qui se joue ici : suivre le fichier d'un AUTRE invocateur, ou un
// fichier périmé (plugin retiré), montrerait un faux compte ; relire une
// ligne deux fois, ou couper une ligne à moitié écrite, le fausserait.

import { appendFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { depuisConnexion, ligneConnexion } from '../plugin-swex/source/etatDirect';
import {
  COMPTE_LIVE as COMPTE_LIVE_PLUGIN,
  DOSSIER_PLUGIN as DOSSIER_PLUGIN_PLUGIN,
} from '../plugin-swex/source/fichiers';
import {
  COMPTE_LIVE,
  DOSSIER_PLUGIN,
  comparerVersions,
  dossierDeLInvocateur,
  enteteLive,
  liveAJour,
  statutPlugin,
  versionDuPlugin,
} from '../bureau/swexPur';
import { cheminLive, enteteDuLive, heureExport, lireLive, versionInstallee } from '../bureau/swexLive';
import { texteDuPluginSwex } from '../scripts/lib/construirePluginSwex.mjs';
import { connexion } from './plugin-swex.test';
import { egal, ok, titre } from './outils';

export async function testBureauSwexDirect() {
  titre('bureau · direct — trouver et juger le fichier live');
  egal([DOSSIER_PLUGIN, COMPTE_LIVE], [DOSSIER_PLUGIN_PLUGIN, COMPTE_LIVE_PLUGIN], 'les noms lus par l’app sont ceux qu’écrit le plugin');
  egal(
    dossierDeLInvocateur(
      [
        { nom: 'tototriou-12889591', modifie: 1000 },
        { nom: 'AncienPseudo-12889591', modifie: 2000 },
        { nom: 'Autre-1', modifie: 9000 },
        { nom: 'Vide-12889591', modifie: null },
        { nom: 'x112889591', modifie: 9999 },
      ],
      '12889591'
    ),
    'AncienPseudo-12889591',
    'parmi les dossiers de l’identifiant : le fichier live le plus récent ; jamais un autre invocateur'
  );
  egal(dossierDeLInvocateur([{ nom: '-42', modifie: 1 }], '42'), null, 'un dossier sans nom devant l’identifiant : écarté');

  const ligne = JSON.stringify(ligneConnexion(depuisConnexion(connexion()), '2.4.4'));
  egal(enteteLive(ligne.slice(0, 300)), { wizardId: 100, t: 1000, plugin: '2.4.4' }, 'l’en-tête se lit dans les premiers octets de la connexion');
  egal(enteteLive('{"type":"changement"}'), null, 'pas une connexion : rien');
  ok(liveAJour(1000, 1000), 'connexion à la même heure que l’export : à jour');
  ok(liveAJour(1200, 1000), 'connexion plus récente que l’export : à jour');
  ok(!liveAJour(900, 1000), 'export plus récent (plugin retiré) : périmé');
  ok(liveAJour(900, null), 'export sans heure : le fichier live fait foi');
  ok(!liveAJour(null, 1000), 'connexion sans heure : périmé');

  titre('bureau · direct — la version du plugin');
  const { texte, version } = await texteDuPluginSwex();
  egal(versionDuPlugin(texte.slice(0, 200)), version, 'la bannière du plugin construit donne sa version');
  egal(versionDuPlugin('// un autre plugin\n'), null, 'un autre plugin : rien');
  ok(comparerVersions('2.4.10', '2.4.9') > 0 && comparerVersions('2.4', '2.4.0') === 0 && comparerVersions('2.3.9', '2.4.0') < 0, 'versions comparées nombre par nombre');
  egal(
    [statutPlugin(null, '2.4.4'), statutPlugin('2.4.4', '2.4.4'), statutPlugin('2.4.2', '2.4.4'), statutPlugin('2.5.0', '2.4.4')],
    ['absent', 'a-jour', 'ancien', 'plus-recent'],
    'statut : absent, à jour, ancien, plus récent'
  );

  titre('bureau · direct — sur le disque');
  const swex = mkdtempSync(join(tmpdir(), 'swex-direct-'));
  try {
    egal(await cheminLive(swex, '100'), null, 'sans dossier SWBlacksmith : rien');
    egal(await versionInstallee(swex), null, 'sans dossier plugins : rien');
    mkdirSync(join(swex, 'plugins'));
    writeFileSync(join(swex, 'plugins', 'SWBlacksmithLive.js'), texte);
    writeFileSync(join(swex, 'plugins', 'AutrePlugin.js'), '// autre\n');
    egal(await versionInstallee(swex), version, 'le plugin installé et sa version');
    writeFileSync(join(swex, 'plugins', 'copie.js'), '// SW Blacksmith Live 1.0.0 — plugin SW Exporter.\n');
    egal(await versionInstallee(swex), '1.0.0', 'une ancienne copie à côté : c’est elle qu’on montre');

    const dossier = join(swex, DOSSIER_PLUGIN, 'Essai-100');
    mkdirSync(dossier, { recursive: true });
    mkdirSync(join(swex, DOSSIER_PLUGIN, 'Autre-200'));
    writeFileSync(join(swex, DOSSIER_PLUGIN, 'Autre-200', COMPTE_LIVE), 'x\n');
    const live = join(dossier, COMPTE_LIVE);
    egal(await cheminLive(swex, '100'), null, 'dossier sans fichier live : rien');
    writeFileSync(live, `${ligne}\n`);
    egal(await cheminLive(swex, '100'), live, 'le fichier live de l’invocateur');
    egal(await enteteDuLive(live), { wizardId: 100, t: 1000, plugin: '2.4.4' }, 'son en-tête, lu sur le disque');

    const exporte = join(swex, 'Essai-100.json');
    writeFileSync(exporte, JSON.stringify({ ...connexion(), tvalue: 1500 }));
    egal(await heureExport(exporte), 1500, 'l’heure serveur de l’export');
    writeFileSync(exporte, '{"tvalue": 16');
    utimesSync(exporte, new Date(), new Date(Date.now() + 5000));
    egal(await heureExport(exporte), null, 'export à moitié écrit : pas d’heure');

    // La lecture : tout, puis la suite seulement.
    const r1 = await lireLive(live, null);
    egal([r1.debut, r1.lignes.length], [true, 1], 'première lecture : le fichier entier');
    const r2 = await lireLive(live, r1.lecture);
    egal([r2.debut, r2.lignes], [false, []], 'rien d’ajouté : aucune ligne');
    appendFileSync(live, '{"type":"changement","n":1}\n{"type":"changement","n":2}\n{"type":"chan');
    const r3 = await lireLive(live, r2.lecture);
    egal([r3.debut, r3.lignes], [false, ['{"type":"changement","n":1}', '{"type":"changement","n":2}']], 'les lignes ajoutées, sans la dernière à moitié écrite');
    appendFileSync(live, 'gement","n":3,"nom":"é');
    const r4 = await lireLive(live, r3.lecture);
    egal(r4.lignes, [], 'la ligne n’est toujours pas finie : elle attend');
    appendFileSync(live, 'té"}\n');
    const r5 = await lireLive(live, r4.lecture);
    egal(r5.lignes, ['{"type":"changement","n":3,"nom":"été"}'], 'finie : elle arrive entière, accents compris');

    // Nouvelle connexion : le plugin réécrit le fichier (autre fichier).
    const tmp = `${live}.tmp`;
    writeFileSync(tmp, `${ligne}\n`);
    renameSync(tmp, live);
    const r6 = await lireLive(live, r5.lecture);
    egal([r6.debut, r6.lignes.length], [true, 1], 'fichier réécrit à la connexion : relu en entier');
    // Plus court qu'à la dernière lecture (même fichier tronqué) : tout.
    writeFileSync(live, '');
    const r7 = await lireLive(live, r6.lecture);
    egal([r7.debut, r7.lignes], [true, []], 'fichier tronqué : relu en entier');
  } finally {
    rmSync(swex, { recursive: true, force: true });
  }
}
