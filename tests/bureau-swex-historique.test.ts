// L'historique du compte dans l'application de bureau : l'archive du compte
// du plugin SWEX lue sur le disque (bureau/swexHistorique.ts), pour
// Comparaison › Historique.
//
// ⚠️ Ce qui se joue ici : l'ordre des états (le plus récent d'abord), la clé
// qui redemande le BON état quand deux états ont la même empreinte, et un bloc
// d'un autre format pris pour un état du compte.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ajouterAuFichier, empreinteDe } from '../plugin-swex/source/archive';
import { FORMAT_COMPTE_ARCHIVE, VERSION_COMPTE_ARCHIVE } from '../plugin-swex/source/etatDirect';
import { COMPTE_ARCHIVE, COMPTE_LIVE, DOSSIER_PLUGIN } from '../plugin-swex/source/fichiers';
import { lireEtatCompte, listerEtatsCompte } from '../bureau/swexHistorique';
import { egal, ok, titre } from './outils';

const MOI = 7101;

const rune = (id: number, vitesse: number) => ({
  rune_id: id,
  slot_no: 2,
  set_id: 3,
  class: 6,
  extra: 5,
  upgrade_curr: 15,
  pri_eff: [8, 42],
  prefix_eff: [0, 0],
  sec_eff: [[9, 6, 0, 0], [4, 8, 0, 0], [8, vitesse, 0, 0]],
});
const etat = (t: number, runes: unknown[]) =>
  JSON.stringify({ type: 'etat', format: FORMAT_COMPTE_ARCHIVE, version: VERSION_COMPTE_ARCHIVE, wizard_id: MOI, t, runes, artefacts: [], crafts: [], unites: [] }) + '\n';
const bloc = (texte: string, debut: number) => ({ texte, debut, fin: debut, empreinte: empreinteDe(texte.replace(/"t":\d+,/, '')) });

export async function testBureauSwexHistorique() {
  titre('bureau · historique du compte — lire l’archive du plugin');
  const racine = mkdtempSync(join(tmpdir(), 'swb-historique-'));
  try {
    egal(await listerEtatsCompte(racine, String(MOI)), null, 'sans dossier du plugin : pas d’historique');
    const dossier = join(racine, DOSSIER_PLUGIN, `Moi-${MOI}`);
    mkdirSync(dossier, { recursive: true });
    writeFileSync(join(dossier, COMPTE_LIVE), '{}\n');
    egal(await listerEtatsCompte(racine, String(MOI)), [], 'le dossier sans archive (aucune connexion archivée) : une liste vide, sans erreur');

    const archive = join(dossier, COMPTE_ARCHIVE);
    const a = etat(1_000, [rune(1, 10)]);
    const b = etat(2_000, [rune(1, 14), rune(2, 5)]);
    // Revenu à l'état du premier jour : même empreinte, autre date.
    const c = etat(3_000, [rune(1, 10)]);
    await ajouterAuFichier(archive, bloc(a, 1_000));
    await ajouterAuFichier(archive, bloc(b, 2_000));
    await ajouterAuFichier(archive, bloc(c, 3_000));

    const liste = await listerEtatsCompte(racine, String(MOI));
    egal(liste?.map((e) => e.t), [3_000_000, 2_000_000, 1_000_000], 'les états du plus récent au plus ancien, datés en millisecondes');
    ok(new Set(liste?.map((e) => e.cle)).size === 3, 'chaque état a sa clé, même deux états à la même empreinte');

    const milieu = await lireEtatCompte(racine, String(MOI), liste![1].cle);
    egal(milieu?.t, 2_000_000, 'l’état demandé, à sa date');
    egal((milieu?.runes as { rune_id: number }[]).map((r) => r.rune_id), [1, 2], 'ses runes, brutes, telles qu’archivées');
    const dernier = await lireEtatCompte(racine, String(MOI), liste![0].cle);
    egal(dernier?.t, 3_000_000, 'deux états à la même empreinte : la clé désigne le bon');

    egal(await lireEtatCompte(racine, String(MOI), 'inconnue'), null, 'une clé hors de la liste : rien');
    egal(await lireEtatCompte(racine, '7999', liste![0].cle), null, 'un autre invocateur : rien');

    // Un bloc d'un autre format (une version future de l'archive) : pas un
    // état du compte qu'on saurait lire.
    const futur = JSON.stringify({ type: 'etat', format: FORMAT_COMPTE_ARCHIVE, version: VERSION_COMPTE_ARCHIVE + 1, runes: [] }) + '\n';
    await ajouterAuFichier(archive, bloc(futur, 4_000));
    const avecFutur = await listerEtatsCompte(racine, String(MOI));
    egal(await lireEtatCompte(racine, String(MOI), avecFutur![0].cle), null, 'un état d’une autre version : refusé, pas lu de travers');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}
