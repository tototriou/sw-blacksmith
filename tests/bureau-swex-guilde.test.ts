// Les sièges dans l'application de bureau : les fichiers de guilde du plugin
// SWEX lus sur le disque (bureau/swexGuilde.ts) — l'archive bloc par bloc,
// puis la session en cours.
//
// ⚠️ Ce qui se joue ici : les sièges d'un AUTRE invocateur montrés comme les
// siens ; un bloc d'archive lu deux fois (le cache), ou la session en cours
// gardée dans le cache — elle serait comptée à nouveau à la lecture suivante.

import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ajouterAuFichier, empreinteDe } from '../plugin-swex/source/archive';
import { COMPTE_LIVE, DOSSIER_PLUGIN, GUILDE_ARCHIVE, GUILDE_LIVE } from '../plugin-swex/source/fichiers';
import { ligneSessionGuilde, type EvenementGuilde } from '../plugin-swex/source/guilde';
import { lireSieges } from '../bureau/swexGuilde';
import { egal, ok, titre } from './outils';

const MOI = 7001;
const AUTRE = 7002;

const carte = (siege: number, t: number): EvenementGuilde => ({
  type: 'vue',
  t,
  commande: 'GetGuildSiegeMatchupInfo',
  contenu: 'siege',
  params: { siege_id: siege },
  reponse: {
    ret_code: 0,
    match_info: { siege_id: siege, match_id: siege * 1000, match_start_time: t, match_finish_time: t + 100 },
    guild_list: [{ guild_id: 1, guild_name: 'G', pos_id: 1, match_score: t }],
    wizard_info_list: [{ wizard_id: MOI, wizard_name: 'Moi', guild_id: 1 }],
  },
});
const session = (wizard: number, t: number, evenements: EvenementGuilde[]) =>
  [ligneSessionGuilde(wizard, t, '9.9.9'), ...evenements].map((l) => JSON.stringify(l)).join('\n') + '\n';
const bloc = (texte: string, debut: number) => ({ texte, debut, fin: debut + 1, empreinte: empreinteDe(texte) });

export async function testBureauSwexGuilde() {
  titre('bureau · sièges — lire les fichiers de guilde du plugin');
  const racine = mkdtempSync(join(tmpdir(), 'swb-guilde-'));
  try {
    const dossier = join(racine, DOSSIER_PLUGIN, `Moi-${MOI}`);
    mkdirSync(dossier, { recursive: true });
    egal(await lireSieges(racine, String(MOI), null), null, 'sans compte live (le dossier n’est pas encore celui de l’invocateur) : rien');
    writeFileSync(join(dossier, COMPTE_LIVE), '{}\n');

    const vide = await lireSieges(racine, String(MOI), null);
    egal(vide?.releves.sieges, [], 'ni archive ni session : aucun siège, sans erreur');

    const archive = join(dossier, GUILDE_ARCHIVE);
    await ajouterAuFichier(archive, bloc(session(MOI, 100, [carte(1, 100)]), 100));
    // Une session d'un autre invocateur dans la même archive (dossier partagé
    // après un changement de compte) : jamais lue comme la sienne.
    await ajouterAuFichier(archive, bloc(session(AUTRE, 150, [carte(9, 150)]), 150));
    writeFileSync(join(dossier, GUILDE_LIVE), session(MOI, 200, [carte(2, 200)]));

    const r1 = await lireSieges(racine, String(MOI), null);
    egal(r1?.releves.sieges.map((s) => s.siegeId), [2, 1], 'l’archive puis la session en cours : deux sièges, du plus récent au plus ancien');
    egal(r1?.cache.blocs.length, 2, 'le cache retient les blocs de l’archive');

    // Une ligne ajoutée à la session, une dernière à moitié écrite.
    appendFileSync(join(dossier, GUILDE_LIVE), JSON.stringify(carte(3, 300)) + '\n{"type":"vue","t":4');
    const r2 = await lireSieges(racine, String(MOI), r1!.cache);
    egal(r2?.releves.sieges.map((s) => s.siegeId), [3, 2, 1], 'la session relue avec ce qui s’y ajoute ; la ligne à moitié écrite attend');
    ok(r2!.cache.accu === r1!.cache.accu, 'l’archive, inchangée, n’est pas relue : le cache sert tel quel');
    ok(r2!.cache.live?.accu === r1!.cache.live?.accu, 'la session en cours non plus : seules les lignes ajoutées sont posées, sur son accumulateur');
    appendFileSync(join(dossier, GUILDE_LIVE), ',"commande":"x"}\n' + JSON.stringify(carte(4, 400)) + '\n');
    const r2b = await lireSieges(racine, String(MOI), r2!.cache);
    egal(r2b?.releves.sieges.map((s) => s.siegeId), [4, 3, 2, 1], 'la ligne à moitié écrite, complétée, est lue avec la suivante');
    egal(r1!.cache.accu.sieges.size, 1, 'la session en cours n’entre jamais dans le cache (posée sur une copie)');

    // À la connexion suivante, la session s'archive et une autre commence.
    await ajouterAuFichier(archive, bloc(session(MOI, 200, [carte(2, 200), carte(3, 300)]), 200));
    writeFileSync(join(dossier, GUILDE_LIVE), session(MOI, 400, []));
    const r3 = await lireSieges(racine, String(MOI), r2b!.cache);
    egal(r3?.releves.sieges.map((s) => s.siegeId), [3, 2, 1], 'la session archivée : les mêmes sièges, une fois chacun');
    egal(r3?.cache.blocs.length, 3, 'seul le bloc ajouté est lu');

    // Une archive réécrite (autre début) : relue en entier.
    rmSync(archive);
    await ajouterAuFichier(archive, bloc(session(MOI, 500, [carte(5, 500)]), 500));
    const r4 = await lireSieges(racine, String(MOI), r3!.cache);
    egal(r4?.releves.sieges.map((s) => s.siegeId), [5], 'une archive qui ne commence plus par les blocs connus : relue depuis le début');

    egal(await lireSieges(racine, String(AUTRE), null), null, 'un autre invocateur sans dossier à lui : rien, même si ses sessions sont dans l’archive d’un autre');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}
