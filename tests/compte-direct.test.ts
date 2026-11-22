// « Mon compte » en direct (src/lib/compteDirect.ts) : le fichier live du
// plugin SWEX, posé ligne à ligne.
//
// ⚠️ Deux promesses, vérifiées à CHAQUE ligne de la partie fabriquée des
// tests du plugin :
//  - le compte en direct est exactement celui de l'import, sur l'export que le
//    plugin écrirait à cet instant (`versExport`) — runes, artéfacts, pierres,
//    box, runes utilisées, et dans le même ordre ;
//  - ce qu'une ligne ne touche pas garde le MÊME objet : une meule ne refait
//    ni la box ni les artéfacts.

import { appliquer, depuisConnexion, ligneConnexion, versExport, type Json } from '../plugin-swex/source/etatDirect';
import { creerSuiviDirect } from '../src/lib/compteDirect';
import {
  parseAccountBox,
  parseAccountInventory,
  parseAccountWizardName,
  parseRuneMarkerLabels,
  parseUsedRuneIdsParPerimetre,
} from '../src/lib/importAccount';
import { fr } from '../src/i18n/fr';
import { connexion, PARTIE } from './plugin-swex.test';
import { egal, ok, titre } from './outils';

// Ce que l'import tire d'un export, pour « Mon compte ».
function importe(data: Json) {
  const inv = parseAccountInventory(data, fr);
  return {
    nom: parseAccountWizardName(data),
    box: parseAccountBox(data, fr).monsters,
    runes: inv.runes,
    artifacts: inv.artifacts,
    crafts: inv.crafts,
    usedRuneIds: parseUsedRuneIdsParPerimetre(data),
    runeMarkerLabels: parseRuneMarkerLabels(data),
  };
}

// Une partie : la connexion (avec un deck et un marqueur, que l'import lit),
// puis les lignes du fichier live, et l'état du plugin après chacune.
function partie() {
  const depart = {
    ...connexion(),
    deck_list: [{ deck_type: 3, unit_id_list: [1] }],
    rune_lock_list: [{ rune_id: 12, lock_type: 2 }],
    markers: [{ type: 1, sub_type: 2, description: 'A garder' }],
  };
  const e = depuisConnexion(depart);
  const lignes = [JSON.stringify(ligneConnexion(e, '9.9.9'))];
  const exports = [versExport(e)];
  for (const [commande, rq, rs] of PARTIE) {
    const c = appliquer(e, commande, rq, rs);
    if (!c) continue;
    lignes.push(JSON.stringify(c));
    exports.push(versExport(e));
  }
  return { lignes, exports };
}

export function testCompteDirect() {
  titre('Compte en direct — le résultat de l’import, à chaque ligne');
  const { lignes, exports } = partie();
  const s = creerSuiviDirect();
  const v0 = s.recevoir([lignes[0]], true);
  ok(v0 !== null, 'le fichier commence par la connexion : un compte');
  const { wizardId, t, ...reste0 } = v0!;
  egal(reste0, importe(exports[0]), 'connexion : exactement le compte de l’import');
  egal([wizardId, t], [100, 1000], 'connexion : l’invocateur et l’heure serveur');
  ok(v0!.runes.some((r) => r.id === 12 && r.marker === 2), 'le marqueur de la connexion est porté');

  for (let i = 1; i < lignes.length; i++) {
    const v = s.recevoir([lignes[i]], false)!;
    const { wizardId: _w, t: _t, ...reste } = v;
    egal(reste, importe(exports[i]), `ligne ${i} (${JSON.parse(lignes[i]).commande}) : le compte de l’import`);
  }
  // En un seul envoi, la même chose.
  const d = creerSuiviDirect().recevoir(lignes, true)!;
  const { wizardId: _w, t: tFin, ...resteFin } = d;
  egal(resteFin, importe(exports[exports.length - 1]), 'le fichier entier d’un coup : le même compte');
  egal(tFin, 1300, 'l’heure du dernier changement');

  titre('Compte en direct — seul ce qui est touché change');
  const s2 = creerSuiviDirect();
  const a = s2.recevoir([lignes[0]], true)!;
  // AmplifyRune_v2 : une rune de l'inventaire et un lot de pierres.
  const b = s2.recevoir([lignes[1]], false)!;
  ok(b.box === a.box, 'meule d’une rune de l’inventaire : la box est le même tableau');
  ok(b.artifacts === a.artifacts, 'meule : les artéfacts, le même tableau');
  ok(b.usedRuneIds === a.usedRuneIds, 'meule : les runes utilisées ne sont pas recalculées');
  ok(b.runes !== a.runes && b.crafts !== a.crafts, 'meule : les runes et les pierres changent');
  const intacte = (v: typeof a) => v.runes.find((r) => r.id === 11);
  ok(intacte(b) === intacte(a), 'une rune non touchée garde le même détail');
  // SellRune : la rune 13 part.
  const c = s2.recevoir([lignes[2]], false)!;
  ok(!c.runes.some((r) => r.id === 13), 'vente : la rune disparaît');
  ok(c.box === b.box, 'vente d’une rune de l’inventaire : la box ne bouge pas');
  // UpdateUnitEquip : la rune 12 passe sur le monstre 1.
  const e = s2.recevoir([lignes[3]], false)!;
  ok(e.box !== c.box, 'rune posée : la box change');
  ok(e.usedRuneIds !== c.usedRuneIds, 'rune posée : les runes utilisées se recalculent');
  ok(e.box.find((m) => m.unitId === 1)?.gear?.runes.some((r) => r.id === 12) === true, 'le monstre porte la rune');
  ok(s2.recevoir([], false) === e, 'aucune ligne : le même compte, pas de rendu');
  ok(s2.recevoir(['{"type":"changement","maj":'], false) === e, 'ligne abîmée : ignorée');

  titre('Compte en direct — ce qui n’est pas un fichier live');
  egal(creerSuiviDirect().recevoir([], true), null, 'aucune ligne : rien (direct oublié)');
  egal(creerSuiviDirect().recevoir([lignes[1]], true), null, 'sans connexion en tête : rien');
  egal(creerSuiviDirect().recevoir([lignes[1]], false), null, 'une suite sans début : rien');
  const s3 = creerSuiviDirect();
  s3.recevoir(lignes, true);
  egal(s3.recevoir([], true), null, 'repartir de rien (direct coupé) : le compte est oublié');
}
