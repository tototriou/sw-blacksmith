// Le dossier SW Exporter.
//
// L'utilisateur choisit dans les Réglages (bloc « Application ») le dossier où
// SW Exporter écrit ses exports et l'invocateur à suivre. Ce module retient ce
// réglage (`swex.json`, dossier des données de l'app — un RÉGLAGE, retenu même
// sans « Garder mes données »), surveille le dossier et donne le texte de
// l'export à la page (src/App.tsx, `rafraichirCompte`).
//
// ⚠️ **Import complet après un CHOIX seulement.** L'export qui suit le choix
// d'un invocateur (ou d'un dossier qui en désigne un d'office) part
// `complet` : la page remplace alors prépa RTA, siège et « Mon compte ». Les
// exports suivants du même invocateur — chaque connexion au jeu — ne mettent
// à jour que « Mon compte » : la prépa ne s'efface pas à chaque partie.
//
// ⚠️ **La page confirme ce qu'elle a appliqué** (`bureau:swex-lu`) : un export
// à moitié écrit, illisible, n'avance pas « dernier export lu », et sera
// redonné au prochain changement du fichier.
// ⚠️ **On attend 1,5 s après la dernière écriture** : SW Exporter écrit un
// fichier de plusieurs Mo, et le système signale chaque morceau.
//
// L'arène dimensionnelle : sa box n'est pas dans l'export mais dans le journal
// complet de SWEX (`full_log.txt`, à la racine du même dossier), écrit quand
// le joueur ouvre le mode — APRÈS l'export, écrit à la connexion. Le journal
// est donc suivi pour lui-même : à chaque nouvelle saison de l'invocateur
// suivi, elle part à la page (`bureau:swex-dimension`) avec les équipes
// récentes de l'export (les attaques), et la page confirme l'avoir appliquée
// (`bureau:swex-dimension-lue`).
//
// Le DIRECT : le plugin SWEX « SW Blacksmith Live » écrit le compte pendant
// la partie (`SWBlacksmith/<nom>-<id>/compte.live.jsonl`). « Direct » activé
// (page « Mon compte »), ses lignes partent à la page à mesure qu'elles
// s'écrivent : le fichier entier d'abord, puis les seules lignes ajoutées
// (`bureau:swex-direct-lignes`, src/lib/compteDirect.ts). Sans notification,
// et sans rien enregistrer : « Mon compte » change, le compte de l'app non.
// « Mettre à jour » (page SW Exporter) rend le compte du fichier live sous la
// forme d'un export, que la page applique comme un nouvel export. ⚠️ Rien
// n'est jamais écrit dans le dossier de SWEX.

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { FSWatcher, promises, readdirSync, readFileSync, statSync, watch, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { depuisLignesLive, versExport } from '../plugin-swex/source/etatDirect';
import {
  aDonner,
  dimensionADonner,
  DOSSIER_PLUGIN,
  ExportCompte,
  exportsDuDossier,
  liveAJour,
  lireNomExport,
  lireReglage,
  ReglageSwex,
  statutPlugin,
  StatutPlugin,
} from './swexPur';
import { cheminLive, enteteDuLive, heureExport, lireLive, LectureLive, versionInstallee } from './swexLive';
import { ajoutContientSaison, NOM_JOURNAL, saisonDuJournal } from './journalSwexDisque';
import { textesBureau } from './textes';

// Le direct, vu de la page : l'interrupteur, s'il y a un fichier live de la
// dernière connexion (`disponible`), sa dernière écriture, et le plugin
// installé comparé à l'app.
export interface EtatDirectSwex {
  actif: boolean;
  disponible: boolean;
  maj: number | null;
  plugin: { installee: string | null; app: string; statut: StatutPlugin };
}

export interface EtatSwex {
  dossier: string | null;
  fichier: string | null;
  exports: (ExportCompte & { modifie: number })[];
  dernierLu: number | null;
  // Le dossier choisi n'est plus lisible (débranché, renommé).
  introuvable: boolean;
}

// Mode preuve : le dossier « choisi » sans boîte de dialogue.
export interface PreuveSwex {
  dossier: string;
}

const ATTENTE = 1500;
// Le fichier live : une ligne de quelques centaines d'octets, écrite d'un
// coup — un délai court regroupe seulement une rafale.
const ATTENTE_DIRECT = 300;
// Délai avant de relancer une surveillance perdue (disque démonté un
// instant, dossier synchronisé, dossier absent au lancement).
const RELANCE = 5000;

export function brancherSwex(fenetre: BrowserWindow, preuve?: PreuveSwex) {
  const cheminReglage = () => join(app.getPath('userData'), 'swex.json');
  const lire = (): ReglageSwex => {
    try {
      return lireReglage(JSON.parse(readFileSync(cheminReglage(), 'utf8')));
    } catch {
      return lireReglage(null); // premier lancement, ou fichier abîmé
    }
  };
  const ecrire = () => {
    try {
      writeFileSync(cheminReglage(), JSON.stringify(reglage, null, 2));
    } catch {
      /* disque en lecture seule : le réglage vaut pour la session */
    }
  };

  let reglage = lire();
  let surveillance: FSWatcher | null = null;
  let minuterie: ReturnType<typeof setTimeout> | null = null;
  let relance: ReturnType<typeof setTimeout> | null = null;
  let pagePrete = false;
  // Le prochain export donné suit un choix : complet, jusqu'à ce que la page
  // l'ait appliqué (`bureau:swex-lu`) — un export illisible le garde complet.
  let complet = false;
  // Octets du journal SWEX déjà examinés : seul ce qui s'y ajoute est relu.
  let journalVu = 0;
  // Le direct : la dernière lecture du fichier live DONNÉE à la page, la
  // surveillance du dossier `SWBlacksmith`, et la file de ses lectures (une à la fois :
  // deux lectures croisées enverraient deux fois les mêmes lignes).
  let lecture: LectureLive | null = null;
  let surveillanceDirect: FSWatcher | null = null;
  let minuterieDirect: ReturnType<typeof setTimeout> | null = null;
  let fileDirect: Promise<unknown> = Promise.resolve();

  const deLaPage = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => e.sender === fenetre.webContents;
  const envoyer = (canal: string, valeur: unknown) => {
    if (!fenetre.isDestroyed()) fenetre.webContents.send(canal, valeur);
  };

  function etat(): EtatSwex {
    const { dossier, fichier, dernierLu } = reglage;
    if (!dossier) return { dossier, fichier, exports: [], dernierLu, introuvable: false };
    try {
      const noms = readdirSync(dossier, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name);
      // ⚠️ Chaque fichier à part : un export que SW Exporter réécrit à cet
      // instant peut disparaître entre la liste et sa date. Il est sauté —
      // le dossier, lui, est bien là.
      const exports = exportsDuDossier(noms).flatMap((e) => {
        try {
          return [{ ...e, modifie: statSync(join(dossier, e.fichier)).mtimeMs }];
        } catch {
          return [];
        }
      });
      return { dossier, fichier, exports, dernierLu, introuvable: false };
    } catch {
      return { dossier, fichier, exports: [], dernierLu, introuvable: true };
    }
  }

  // Donne l'export suivi à la page, s'il y a lieu (`aDonner`).
  async function donner(pageSansCompte: boolean) {
    const { dossier, fichier } = reglage;
    if (!pagePrete || !dossier || !fichier) return;
    const chemin = join(dossier, fichier);
    try {
      const modifie = (await promises.stat(chemin)).mtimeMs;
      const { donner: oui, nouveau } = aDonner(modifie, reglage.dernierLu, pageSansCompte);
      if (!oui) return;
      const texte = await promises.readFile(chemin, 'utf8');
      envoyer('bureau:swex-export', { texte, modifie, nouveau, fichier, complet });
    } catch {
      /* fichier absent ou verrouillé : rien, le prochain changement redonnera */
    }
  }

  // Donne à la page la dernière saison de l'arène dimensionnelle de
  // l'invocateur suivi, si elle est plus récente que la dernière appliquée,
  // ou si la page n'a rien de ce mode (`pageSansDimension`, au lancement).
  // `relire` : tout le journal (page prête, choix, surveillance revenue) ;
  // sinon, seulement si ce qui s'y est ajouté contient une saison.
  async function donnerDimension(relire: boolean, pageSansDimension = false) {
    const { dossier, fichier } = reglage;
    const id = Number(fichier ? lireNomExport(fichier)?.id : NaN);
    if (!pagePrete || !dossier || !fichier || !Number.isFinite(id)) return;
    const chemin = join(dossier, NOM_JOURNAL);
    try {
      if (relire) journalVu = (await promises.stat(chemin)).size;
      else {
        const ajout = await ajoutContientSaison(chemin, journalVu);
        journalVu = ajout.taille;
        if (!ajout.contient) return;
      }
      const saison = await saisonDuJournal(chemin, id);
      if (!saison || !dimensionADonner(saison.tvalue, reglage.dimensionLue, pageSansDimension)) return;
      // Les attaques jouées sont dans l'export (`deck_recent_list`).
      let recents: unknown[] = [];
      try {
        const compte = JSON.parse(await promises.readFile(join(dossier, fichier), 'utf8'));
        if (Array.isArray(compte?.deck_recent_list)) recents = compte.deck_recent_list;
      } catch {
        /* export illisible : la défense part seule */
      }
      // `nouvelle` : plus récente que la dernière appliquée (annoncée) ; sinon
      // redonnée en silence à une page qui n'a rien de ce mode.
      const nouvelle = dimensionADonner(saison.tvalue, reglage.dimensionLue);
      envoyer('bureau:swex-dimension', { saison, recents, cle: saison.tvalue, nouvelle });
    } catch {
      /* pas de journal (plugin Full Logger éteint), ou verrouillé : rien */
    }
  }

  // Le fichier live de l'invocateur suivi, s'il est celui de la DERNIÈRE
  // connexion (`liveAJour`), et l'état du direct.
  async function calculerDirect(): Promise<{ etat: EtatDirectSwex; chemin: string | null }> {
    const { dossier, fichier } = reglage;
    const versionApp = app.getVersion();
    const installee = dossier ? await versionInstallee(dossier) : null;
    const id = fichier ? lireNomExport(fichier)?.id : undefined;
    let chemin: string | null = null;
    let maj: number | null = null;
    if (dossier && fichier && id) {
      const trouve = await cheminLive(dossier, id);
      if (trouve) {
        const entete = await enteteDuLive(trouve).catch(() => null);
        const tExport = await heureExport(join(dossier, fichier)).catch(() => null);
        if (entete && String(entete.wizardId) === id && liveAJour(entete.t, tExport)) {
          chemin = trouve;
          maj = await promises.stat(trouve).then((s) => s.mtimeMs, () => null);
        }
      }
    }
    return {
      etat: {
        actif: reglage.direct,
        disponible: chemin !== null,
        maj,
        plugin: { installee, app: versionApp, statut: statutPlugin(installee, versionApp) },
      },
      chemin,
    };
  }

  // Donne à la page ce qui s'est ajouté au fichier live (`relire` : tout),
  // puis l'état du direct. Interrupteur coupé ou fichier périmé : la page
  // oublie le compte en direct (aucune ligne, `debut`).
  function suivreDirect(relire: boolean): Promise<EtatDirectSwex | null> {
    const suite = fileDirect.then(async () => {
      if (!pagePrete) return null;
      const { etat, chemin } = await calculerDirect();
      if (reglage.direct && chemin) {
        try {
          const r = await lireLive(chemin, relire ? null : lecture);
          lecture = r.lecture;
          if (r.debut || r.lignes.length) envoyer('bureau:swex-direct-lignes', { debut: r.debut, lignes: r.lignes });
        } catch {
          lecture = null; // réécrit à l'instant : le prochain changement relira tout
        }
      } else if (lecture !== null || relire) {
        lecture = null;
        envoyer('bureau:swex-direct-lignes', { debut: true, lignes: [] });
      }
      envoyer('bureau:swex-direct-etat', etat);
      return etat;
    });
    fileDirect = suite.catch(() => null);
    return suite.catch(() => null);
  }

  // Surveille le dossier `SWBlacksmith` et ses dossiers d'invocateurs. Absent (pas de
  // plugin, pas encore de connexion) : la surveillance de la racine voit sa
  // création et relance celle-ci (`directAJour`).
  // ⚠️ **Jamais sur un dossier absent** : sous Linux, la surveillance
  // récursive de Node ne lève rien sur un chemin qui n'existe pas — elle ne
  // surveille rien, en silence, et ne se relançait jamais. Le dossier
  // surveillé est retenu par son inode : supprimé puis recréé, c'en est un
  // autre, et la surveillance repart.
  let inodeDirect: number | null = null;
  const inodeDuDossierPlugin = () => {
    try {
      return reglage.dossier ? statSync(join(reglage.dossier, DOSSIER_PLUGIN)).ino : null;
    } catch {
      return null;
    }
  };
  function surveillerDirect() {
    surveillanceDirect?.close();
    surveillanceDirect = null;
    inodeDirect = inodeDuDossierPlugin();
    if (!reglage.dossier || inodeDirect === null) return;
    try {
      surveillanceDirect = watch(join(reglage.dossier, DOSSIER_PLUGIN), { recursive: true }, () => {
        if (minuterieDirect) clearTimeout(minuterieDirect);
        minuterieDirect = setTimeout(() => void suivreDirect(false), ATTENTE_DIRECT);
      });
      surveillanceDirect.on('error', () => {
        surveillanceDirect?.close();
        surveillanceDirect = null;
        inodeDirect = null;
      });
    } catch {
      surveillanceDirect = null;
      inodeDirect = null;
    }
  }
  // La surveillance porte-t-elle encore sur le dossier `SWBlacksmith` actuel ?
  const directAJour = () => inodeDuDossierPlugin() === inodeDirect;

  // ⚠️ **Une surveillance perdue se relance.** Sur une erreur (disque externe
  // démonté un instant, dossier synchronisé) ou un dossier illisible, elle
  // était fermée pour de bon : les nouveaux exports n'arrivaient plus dans
  // « Mon compte », sans un mot. L'état est diffusé (le dossier peut être dit
  // introuvable), puis on réessaie ; revenue, la surveillance relit le dossier
  // et l'export suivi, qui ont pu changer entre-temps.
  function relancerPlusTard() {
    envoyer('bureau:swex-etat', etat());
    if (relance) clearTimeout(relance);
    relance = setTimeout(() => {
      relance = null;
      if (!surveiller()) return;
      envoyer('bureau:swex-etat', etat());
      void donner(false);
      void donnerDimension(true);
      void suivreDirect(true);
    }, RELANCE);
  }

  // `true` si le dossier est surveillé.
  function surveiller(): boolean {
    surveillance?.close();
    surveillance = null;
    if (relance) clearTimeout(relance);
    relance = null;
    surveillerDirect();
    if (!reglage.dossier) return false;
    try {
      // Non récursif : seuls les exports et le journal de la RACINE comptent
      // (`live` écrit en continu pendant une partie). Tout changement relance
      // la liste, l'export suivi et le journal, une fois le dossier calme.
      // Le fichier live a sa propre surveillance (`surveillerDirect`) ; un
      // nouvel export peut toutefois le rendre périmé, ou le dossier `SWBlacksmith`
      // apparaître : le direct est revu aussi.
      surveillance = watch(reglage.dossier, () => {
        if (minuterie) clearTimeout(minuterie);
        minuterie = setTimeout(() => {
          envoyer('bureau:swex-etat', etat());
          void donner(false);
          void donnerDimension(false);
          if (!directAJour()) surveillerDirect();
          void suivreDirect(false);
        }, ATTENTE);
      });
      surveillance.on('error', () => {
        surveillance?.close();
        surveillance = null;
        relancerPlusTard();
      });
      return true;
    } catch {
      // Dossier illisible : `etat().introuvable` le dit, et on réessaie.
      relancerPlusTard();
      return false;
    }
  }

  ipcMain.handle('bureau:swex-etat', (e) => (deLaPage(e) ? etat() : null));

  // ⚠️ Après chaque CHOIX, l'état est aussi DIFFUSÉ : deux endroits de la page
  // le montrent (Réglages, carte du compte), et seul celui qui a fait le choix
  // reçoit la réponse — sans diffusion, l'autre resterait sur l'ancien état.
  const repondre = () => {
    const e = etat();
    envoyer('bureau:swex-etat', e);
    return e;
  };

  ipcMain.handle('bureau:swex-choisir-dossier', async (e) => {
    if (!deLaPage(e)) return null;
    let dossier: string | undefined;
    if (preuve) dossier = preuve.dossier;
    else {
      const r = await dialog.showOpenDialog(fenetre, {
        title: textesBureau().dossierSwex,
        properties: ['openDirectory'],
        defaultPath: reglage.dossier ?? app.getPath('desktop'),
      });
      if (r.canceled || !r.filePaths[0]) return etat();
      dossier = r.filePaths[0];
    }
    reglage = { dossier, fichier: null, dernierLu: null, dimensionLue: null, direct: reglage.direct };
    // Un seul invocateur dans le dossier : c'est lui.
    const seul = etat().exports;
    if (seul.length === 1) reglage.fichier = seul[0].fichier;
    complet = reglage.fichier !== null;
    ecrire();
    surveiller();
    void donner(false);
    void donnerDimension(true);
    void suivreDirect(true);
    return repondre();
  });

  ipcMain.handle('bureau:swex-choisir-invocateur', (e, fichier: unknown) => {
    if (!deLaPage(e)) return null;
    // Seulement un export de CE dossier : jamais un chemin venu de la page.
    if (typeof fichier !== 'string' || !etat().exports.some((x) => x.fichier === fichier)) return etat();
    reglage = { ...reglage, fichier, dernierLu: null, dimensionLue: null };
    complet = true;
    ecrire();
    void donner(false);
    void donnerDimension(true);
    void suivreDirect(true);
    return repondre();
  });

  ipcMain.handle('bureau:swex-oublier', (e) => {
    if (!deLaPage(e)) return null;
    reglage = { dossier: null, fichier: null, dernierLu: null, dimensionLue: null, direct: reglage.direct };
    complet = false;
    ecrire();
    surveiller();
    void suivreDirect(true);
    return repondre();
  });

  // Le direct : son état (relu à la demande : la page SW Exporter l'affiche
  // à l'ouverture, plugin installé entre-temps compris), l'interrupteur.
  ipcMain.handle('bureau:swex-direct-etat', async (e) => (deLaPage(e) ? (await calculerDirect()).etat : null));
  ipcMain.handle('bureau:swex-direct-activer', async (e, oui: unknown) => {
    if (!deLaPage(e) || typeof oui !== 'boolean') return null;
    reglage = { ...reglage, direct: oui };
    ecrire();
    return suivreDirect(true);
  });

  // « Mettre à jour » : le compte du fichier live, sous la forme d'un export,
  // que la page applique comme un nouvel export de SWEX. ⚠️ Lu seulement :
  // rien ne s'écrit dans le dossier de SWEX. L'export du disque, plus ancien,
  // est marqué lu : il ne reviendra pas écraser le compte mis à jour.
  ipcMain.handle('bureau:swex-mettre-a-jour', async (e) => {
    if (!deLaPage(e)) return null;
    const { chemin } = await calculerDirect();
    if (!chemin || !reglage.dossier || !reglage.fichier) return null;
    try {
      const compte = depuisLignesLive((await promises.readFile(chemin, 'utf8')).split('\n'));
      if (!compte) return null;
      const exporte = await promises.stat(join(reglage.dossier, reglage.fichier)).then((s) => s.mtimeMs, () => null);
      if (exporte !== null && (reglage.dernierLu === null || exporte > reglage.dernierLu)) {
        reglage = { ...reglage, dernierLu: exporte };
        ecrire();
      }
      return { texte: JSON.stringify(versExport(compte)), t: compte.tvalue };
    } catch {
      return null;
    }
  });

  // La page est prête (données des monstres chargées, compte conservé relu) :
  // l'export suivi peut lui être donné.
  ipcMain.on('bureau:swex-pret', (e, pageSansCompte: unknown, pageSansDimension: unknown) => {
    if (!deLaPage(e)) return;
    pagePrete = true;
    void donner(pageSansCompte === true);
    void donnerDimension(true, pageSansDimension === true);
    void suivreDirect(true);
  });

  // La page a APPLIQUÉ la saison de l'arène dimensionnelle de cette heure
  // serveur : elle ne sera plus redonnée.
  ipcMain.on('bureau:swex-dimension-lue', (e, cle: unknown) => {
    if (!deLaPage(e) || typeof cle !== 'number' || !Number.isFinite(cle)) return;
    reglage = { ...reglage, dimensionLue: cle };
    ecrire();
  });

  // La page a APPLIQUÉ l'export de cette date.
  ipcMain.on('bureau:swex-lu', (e, modifie: unknown) => {
    if (!deLaPage(e) || typeof modifie !== 'number' || !Number.isFinite(modifie)) return;
    reglage = { ...reglage, dernierLu: modifie };
    complet = false;
    ecrire();
    envoyer('bureau:swex-etat', etat());
  });

  surveiller();
}
