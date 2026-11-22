// Mode preuve de l'application de bureau — `SWBLACKSMITH_PREUVE=<dossier>`.
//
// L'app se contrôle elle-même DE L'INTÉRIEUR (origine, stockage, données,
// worker, cloisonnement, habillage de la fenêtre), écrit ses résultats en
// JSON, puis se ferme (`npm run bureau:preuve`) : on n'affirme pas « ça
// marche », on le relit. Jamais de capture d'écran. Sans la variable, ce
// module ne fait rien.
//
// ⚠️ Ses données (stockage, état de la fenêtre) vivent dans `<dossier>/donnees`
// (voir main.ts) : une preuve ne touche jamais celles de l'utilisateur.

import { app, BrowserWindow } from 'electron';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { depuisConnexion, ligneConnexion } from '../plugin-swex/source/etatDirect';
import type { PreuveMiseAJour } from './miseAJour';
import type { PreuveSession } from './session';
import type { PreuveSwex } from './swex';

// Ce que les branchements enregistrent en mode preuve : la navigation
// (navigation.ts) au lieu d'ouvrir le navigateur ou une boîte de dialogue, la
// mise à jour (miseAJour.ts) au lieu de télécharger ou de redémarrer, la
// session (session.ts) au lieu de demander où l'enregistrer.
export interface TemoinsPreuve {
  liensOuverts: string[];
  dossierTelechargements: string;
  miseAJour: PreuveMiseAJour;
  swex?: PreuveSwex;
  session?: PreuveSession;
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Clique le bouton de ce libellé dès qu'il apparaît (au plus `delai` ms) :
// après un import, la question « Garder mes données » arrive après un délai
// variable — un délai fixe la manque.
async function cliquerQuandPret(fenetre: BrowserWindow, libelle: string, delai = 10_000): Promise<string> {
  const fin = Date.now() + delai;
  while (Date.now() < fin) {
    const fait = await fenetre.webContents.executeJavaScript(
      `(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(libelle)});
        if (!b) return false;
        b.click();
        return true;
      })()`,
      true
    );
    if (fait) return 'cliqué';
    await attendre(250);
  }
  return `pas de bouton « ${libelle} »`;
}

// Clique le bouton de ce libellé dans la BARRE DU HAUT.
function cliquerDansLaBarre(fenetre: BrowserWindow, libelle: string): Promise<string> {
  return fenetre.webContents.executeJavaScript(
    `(() => {
      const b = [...document.querySelectorAll('header button')].find((x) => x.textContent.trim() === ${JSON.stringify(libelle)});
      if (!b) return 'pas de bouton';
      b.click();
      return 'cliqué';
    })()`,
    true
  );
}

// La session en cours, vue de l'app et du disque, après un geste : les
// fichiers de `<dossier>/swblacksmith/sessions` (le dossier SW Blacksmith du
// mode preuve, main.ts) et la date écrite dans chacun, l'infobulle de
// « Sauvegarder » (barre du haut), la notification, la ligne « Dossier SW
// Blacksmith » des Paramètres quand ils sont affichés, si `session.json` la
// retient pour le prochain lancement, et le réglage du dossier.
async function releverSession(fenetre: BrowserWindow, dossier: string) {
  await attendre(1200);
  const sessions = join(dossier, 'swblacksmith', 'sessions');
  const reglage = join(dossier, 'donnees', 'dossier-swblacksmith.json');
  const fichiers = existsSync(sessions) ? readdirSync(sessions).sort() : [];
  const dates: Record<string, string | null> = {};
  for (const f of fichiers.filter((n) => /^[^.].*\.json$/.test(n))) {
    try {
      dates[f] = (JSON.parse(readFileSync(join(sessions, f), 'utf8')) as { enregistreeLe?: string }).enregistreeLe ?? null;
    } catch {
      dates[f] = 'illisible';
    }
  }
  const page = (await fenetre.webContents.executeJavaScript(
    `({
      infobulle: [...document.querySelectorAll('header button')].find((b) => b.textContent.trim() === 'Sauvegarder')?.title ?? null,
      notification: [...document.querySelectorAll('[role="status"]')].map((e) => e.innerText.trim()).join(' | '),
      ligneDossier: document.querySelector('[data-repere="dossier-swblacksmith"]')?.innerText.replace(/\\s+/g, ' ').trim() ?? null,
    })`,
    true
  )) as { infobulle: string | null; notification: string; ligneDossier: string | null };
  return {
    fichiers,
    dates,
    ...page,
    retenue: existsSync(join(dossier, 'donnees', 'session.json')),
    dossierRetenu: existsSync(reglage) ? (JSON.parse(readFileSync(reglage, 'utf8')) as { dossier: string | null }).dossier : 'absent',
  };
}


// ── Les données survivent à la fermeture de l'app ───────────────
// Deux lancements sur le MÊME dossier de données (`npm run bureau:preuve --
// --conservation`). `ecrire` importe un compte de test par le vrai champ
// fichier de l'accueil, répond « Garder mes données », puis l'app se ferme ;
// `relire` relance et relève la même chose. Le script compare les deux.
export async function lancerPreuveConservation(fenetre: BrowserWindow, dossier: string, etape: 'ecrire' | 'relire', compte: string) {
  mkdirSync(dossier, { recursive: true });
  const resultats: Record<string, unknown> = { etape };
  const js = (code: string) => fenetre.webContents.executeJavaScript(code, true);
  try {
    if (fenetre.webContents.isLoading()) {
      await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    }
    await attendre(2500);
    if (etape === 'ecrire') {
      resultats.import = await js(`(() => {
        const champ = document.querySelector('input[type="file"][accept*="json"]');
        if (!champ) return 'pas de champ fichier';
        const dt = new DataTransfer();
        dt.items.add(new File([${JSON.stringify(compte)}], 'compte-miniature.json', { type: 'application/json' }));
        champ.files = dt.files;
        champ.dispatchEvent(new Event('change', { bubbles: true }));
        return 'déposé';
      })()`);
      resultats.garder = await cliquerQuandPret(fenetre, 'Garder mes données (recommandé)');
      await attendre(2500);
      // La session en cours, choisie maintenant : conservation activée, elle
      // doit être retenue pour le lancement suivant.
      resultats.sauvegarde = await cliquerDansLaBarre(fenetre, 'Sauvegarder');
      resultats.session = await releverSession(fenetre, dossier);
    } else {
      await attendre(1500); // le compte se relit d'IndexedDB, après la page
      // La session en cours est revenue : Ctrl+S la réécrit, sans rien demander.
      resultats.sessionAuLancement = await releverSession(fenetre, dossier);
      await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }))`);
      resultats.session = await releverSession(fenetre, dossier);
    }
    // Ce qui est retenu : le compte affiché, la conservation, les clés de
    // stockage et leur taille, les bases IndexedDB.
    resultats.etat = await js(`(async () => ({
      compteAffiche: document.body.innerText.includes('Testeur'),
      conservation: localStorage.getItem('swblacksmith-persist-v1'),
      cles: Object.keys(localStorage).filter((k) => k.startsWith('swblacksmith')).sort()
        .map((k) => k + ' (' + localStorage.getItem(k).length + ')'),
      bases: (await indexedDB.databases()).map((b) => b.name).sort(),
    }))()`);
  } catch (e) {
    resultats.erreur = String(e);
  } finally {
    writeFileSync(join(dossier, `conservation-${etape}.json`), JSON.stringify(resultats, null, 2));
    // Fermeture ORDINAIRE (comme l'utilisateur) : le stockage s'écrit sur le
    // disque à la sortie de Chromium.
    fenetre.close();
  }
}

// ── Le dossier SW Exporter ─────────────────────────────────────
// `npm run bureau:preuve -- --swex` : un dossier de fixtures (deux
// invocateurs, un sous-dossier `live`), « choisi » sans boîte de dialogue (main.ts). Un
// import MANUEL d'abord (prépa RTA et siège remplis), puis le dossier depuis
// les Réglages et l'invocateur depuis la carte du compte — chaque choix
// propose d'abord de sauvegarder ; le choix de l'invocateur importe TOUT.
// Puis l'export réécrit pendant que l'app tourne, l'invocateur déjà suivi
// rechoisi, un rechargement, une écriture dans `live` : « Mon compte »
// seulement, la prépa RTA et le siège INCHANGÉS. Puis le direct du plugin
// SWEX ; une relance avec la conservation refusée (tout importé) ; enfin un
// import manuel : l'invocateur suivi est lâché, ses exports ne s'appliquent
// plus.
export async function lancerPreuveSwex(fenetre: BrowserWindow, dossier: string, fixtures: string, compte: string) {
  mkdirSync(dossier, { recursive: true });
  const resultats: Record<string, unknown> = {};
  const js = (code: string) => fenetre.webContents.executeJavaScript(code, true);
  const travail = () =>
    js(`JSON.stringify(['swblacksmith-rta-v1', 'swblacksmith-siege-defense-v1', 'swblacksmith-siege-offense-v1'].map((k) => localStorage.getItem(k)))`);
  const notification = () =>
    js(`document.querySelector('[aria-label="Fermer la notification"]')?.closest('[role="status"]')?.innerText.replace(/\\s+/g, ' ').trim() ?? 'aucune'`);
  const fermerNotification = () => js(`document.querySelector('[aria-label="Fermer la notification"]')?.click()`);
  // Le nom porté par la CARTE du compte — pas n'importe où dans la barre :
  // le menu des invocateurs y garde ses entrées, même fermé.
  const compteAffiche = () =>
    js(`document.querySelector('aside button[aria-label="Changer de compte"], aside button[aria-label="Importer un compte"]')?.querySelector('.font-semibold')?.textContent.trim() ?? 'aucun'`);
  const reglage = () => js(`document.querySelector('[data-reglage-swex]')?.innerText.replace(/\\s+/g, ' ').trim() ?? 'aucun bloc'`);
  try {
    if (fenetre.webContents.isLoading()) {
      await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    }
    await attendre(2500);

    // 1. Import manuel : la prépa RTA et le siège se remplissent.
    resultats.importManuel = await js(`(() => {
      const champ = document.querySelector('input[type="file"][accept*="json"]');
      const dt = new DataTransfer();
      dt.items.add(new File([${JSON.stringify(compte)}], 'compte.json', { type: 'application/json' }));
      champ.files = dt.files;
      champ.dispatchEvent(new Event('change', { bubbles: true }));
      return 'déposé';
    })()`);
    resultats.garder = await cliquerQuandPret(fenetre, 'Garder mes données (recommandé)');
    await attendre(1500);
    const avant = await travail();
    resultats.travailRempli = JSON.parse(avant).every((v: string | null) => v !== null && v.length > 50);
    resultats.compteApresImport = await compteAffiche();

    // La modale du changement de compte est-elle ouverte ? Ses boutons se
    // cherchent DANS elle : la page peut porter un autre « Annuler ».
    const modale = () => js(`[...document.querySelectorAll('[role="dialog"]')].some((d) => d.innerText.includes('Sauvegarder ta session ?'))`);
    const cliquerDansModale = (libelle: string) =>
      js(`(() => {
        const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.textContent.trim() === ${JSON.stringify(libelle)});
        if (!b) return 'pas de bouton « ${libelle} » dans la modale';
        b.click();
        return 'cliqué';
      })()`);
    // Le récapitulatif d'un import complet (« Import : … »), ou `aucun`.
    const recapitulatif = () =>
      js(`[...document.querySelectorAll('[role="status"] > p')].map((p) => p.textContent.trim()).find((t) => t.startsWith('Import :')) ?? 'aucun'`);
    const menuCarte = () =>
      js(`(() => {
        const carte = document.querySelector('aside button[aria-label="Changer de compte"]');
        if (!carte) return 'pas de menu sur la carte du compte';
        carte.click();
        return [...document.querySelectorAll('aside [role="menuitemcheckbox"], aside [role="menuitem"]')]
          .map((e) => e.textContent.trim() + (e.getAttribute('aria-checked') === 'true' ? ' ✓' : ''));
      })()`);
    const choisirAuMenu = (nom: string) =>
      js(`(() => {
        const e = [...document.querySelectorAll('aside [role="menuitemcheckbox"]')].find((x) => x.textContent.trim() === ${JSON.stringify(nom)});
        if (!e) return 'pas d’entrée « ${nom} »';
        e.click();
        return 'cliqué';
      })()`);

    // 2. Les Réglages : choisir le dossier — il peut désigner un invocateur
    // d'office, donc la sauvegarde est proposée d'abord.
    await js(`location.hash = '#/parametres'`);
    await attendre(1200);
    resultats.reglageAvant = await reglage();
    // ⚠️ DANS le bloc : « Dossier SW Blacksmith », plus haut, a aussi son
    // « Choisir… ».
    resultats.choisirDossier = await js(`(() => {
      const b = [...document.querySelectorAll('[data-reglage-swex] button')].find((x) => x.textContent.trim() === 'Choisir…');
      if (!b) return 'pas de bouton « Choisir… » dans le bloc SW Exporter';
      b.click();
      return 'cliqué';
    })()`);
    await attendre(500);
    resultats.modaleDossier = await modale();
    resultats.changerSansSauvegarderDossier = await cliquerDansModale('Changer sans sauvegarder');
    await attendre(1200);
    resultats.reglageDossier = await reglage();
    resultats.options = await js(`[...document.querySelectorAll('[data-reglage-swex] select option')].map((o) => o.textContent)`);
    await fermerNotification();

    // 3. L'invocateur « Autre », depuis la CARTE DU COMPTE : la modale
    // d'abord. « Annuler » ne change rien.
    resultats.menuCompte = await menuCarte();
    await attendre(300);
    resultats.choisirInvocateur = await choisirAuMenu('Autre');
    await attendre(500);
    resultats.modaleInvocateur = await modale();
    resultats.annuler = await cliquerDansModale('Annuler');
    await attendre(1500);
    resultats.apresAnnuler = {
      modale: await modale(),
      compte: await compteAffiche(),
      selecteur: await js(`document.querySelector('[data-reglage-swex] select')?.value`),
      travailInchange: (await travail()) === avant,
    };

    // 4. « Changer sans sauvegarder » : TOUT s'importe — annoncé « chargé »,
    // avec le récapitulatif de l'import.
    await menuCarte();
    await attendre(300);
    await choisirAuMenu('Autre');
    await attendre(500);
    resultats.changerSansSauvegarder = await cliquerDansModale('Changer sans sauvegarder');
    await attendre(2500);
    resultats.selecteurReglages = await js(`document.querySelector('[data-reglage-swex] select')?.value`);
    resultats.apresChoix = { compte: await compteAffiche(), notification: await notification(), recapitulatif: await recapitulatif(), reglage: await reglage() };
    const apresChoix = await travail();

    // 5. SW Exporter réécrit l'export pendant que l'app tourne : « Mon
    // compte » seulement.
    await fermerNotification();
    const autre = JSON.parse(compte);
    autre.wizard_info = { ...autre.wizard_info, wizard_id: 2, wizard_name: 'Autre-bis' };
    writeFileSync(join(fixtures, 'Autre-2.json'), JSON.stringify(autre));
    await attendre(4500);
    resultats.apresReecriture = { compte: await compteAffiche(), notification: await notification(), travailInchange: (await travail()) === apresChoix };

    // 6. L'invocateur déjà suivi, rechoisi : rien — ni modale, ni import.
    await fermerNotification();
    await menuCarte();
    await attendre(300);
    await choisirAuMenu('Autre');
    await attendre(2000);
    resultats.memeInvocateur = { modale: await modale(), notification: await notification(), travailInchange: (await travail()) === apresChoix };
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);

    // 7. Un rechargement (comme un relancement, compte conservé) : rien de
    // nouveau, rien d'annoncé.
    fenetre.webContents.reload();
    await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    await attendre(3500);
    resultats.apresRechargement = { compte: await compteAffiche(), notification: await notification(), travailInchange: (await travail()) === apresChoix };

    // 8. Une écriture dans `live` (SW Exporter en partie) : ignorée.
    writeFileSync(join(fixtures, 'live', 'partie.json'), '{}');
    await attendre(3500);
    resultats.apresLive = { notification: await notification() };

    // 9. Retour à « Testeur » par « Sauvegarder et changer » : la session
    // s'écrit (dossier SW Blacksmith du mode preuve), PUIS le compte change.
    const sessions = () => {
      try {
        return readdirSync(join(dossier, 'swblacksmith', 'sessions')).filter((f) => f.endsWith('.json'));
      } catch {
        return [];
      }
    };
    const sessionsAvant = sessions().length;
    await menuCarte();
    await attendre(300);
    await choisirAuMenu('Testeur');
    await attendre(500);
    resultats.modaleRetour = await modale();
    resultats.sauvegarderEtChanger = await cliquerDansModale('Sauvegarder et changer');
    await attendre(3000);
    resultats.apresSauvegarde = { sessionsEcrites: sessions().length - sessionsAvant, compte: await compteAffiche(), recapitulatif: await recapitulatif() };

    // 10. Le direct (plugin SWEX) : un plugin ANCIEN installé, et le fichier
    // live de « Testeur », à la même connexion que son export.
    await fermerNotification();
    const racineAvant = readdirSync(fixtures).sort();
    const exportAvant = readFileSync(join(fixtures, 'Testeur-1.json'), 'utf8');
    mkdirSync(join(fixtures, 'plugins'), { recursive: true });
    writeFileSync(join(fixtures, 'plugins', 'SWBlacksmithLive.js'), '// SW Blacksmith Live 1.0.0 — plugin SW Exporter.\n');
    const live = join(fixtures, 'SWBlacksmith', 'Testeur-1', 'compte.live.jsonl');
    mkdirSync(join(fixtures, 'SWBlacksmith', 'Testeur-1'), { recursive: true });
    const etatLive = depuisConnexion(JSON.parse(compte));
    writeFileSync(live, `${JSON.stringify(ligneConnexion(etatLive, '1.0.0'))}\n`);
    // Le nombre de runes de l'inventaire, en tête de la liste (« 8 runes »).
    const nombreRunes = () =>
      js(`[...document.querySelectorAll('span, p')].map((e) => e.textContent.trim()).find((t) => /^\\d+ runes?$/.test(t)) ?? 'aucun'`);
    const interrupteur = () =>
      js(`(() => { const b = document.querySelector('[data-interrupteur-direct]'); return b ? { presse: b.getAttribute('aria-pressed'), titre: b.title } : 'absent'; })()`);
    const cliquer = (selecteur: string) =>
      js(`(() => { const b = document.querySelector(${JSON.stringify(selecteur)}); if (!b) return 'absent'; b.click(); return 'cliqué'; })()`);
    const basculer = () => cliquer('[data-interrupteur-direct]');
    await js(`location.hash = '#/compte/runes/liste'`);
    await attendre(2500);
    resultats.directAvant = { runes: await nombreRunes(), interrupteur: await interrupteur() };
    await basculer();
    await attendre(1500);
    resultats.directActive = { runes: await nombreRunes(), interrupteur: await interrupteur() };
    // Une rune vendue pendant la partie : une ligne ajoutée au fichier.
    const vendue = Number(JSON.parse(compte).runes[0].rune_id);
    appendFileSync(live, `${JSON.stringify({ type: 'changement', t: (etatLive.tvalue ?? 0) + 10, commande: 'SellRune', maj: {}, retires: { runes: [vendue] } })}\n`);
    await attendre(2500);
    resultats.directVente = { runes: await nombreRunes(), notification: await notification() };
    // La page SW Exporter : le plugin, la session, « Mettre à jour mon compte ».
    const carte = () => js(`document.querySelector('[data-etat-plugin]')?.innerText.replace(/\\s+/g, ' ').trim() ?? 'aucune carte'`);
    await js(`location.hash = '#/sw-exporter'`);
    await attendre(1500);
    resultats.cartePlugin = await carte();
    resultats.mettreAJour = await cliquer('[data-mettre-a-jour]');
    await attendre(2500);
    resultats.apresMiseAJour = { carte: await carte(), notification: await notification() };
    // Direct coupé : « Mon compte » revient au compte de l'app, mis à jour.
    await js(`location.hash = '#/compte/runes/liste'`);
    await attendre(1500);
    await basculer();
    await attendre(1500);
    resultats.directCoupe = { runes: await nombreRunes(), interrupteur: await interrupteur() };
    resultats.dossierSwexIntact = {
      export: readFileSync(join(fixtures, 'Testeur-1.json'), 'utf8') === exportAvant,
      racine: JSON.stringify(readdirSync(fixtures).sort().filter((f) => f !== 'plugins' && f !== 'SWBlacksmith')) === JSON.stringify(racineAvant.filter((f) => f !== 'SWBlacksmith')),
      dossierPlugin: readdirSync(join(fixtures, 'SWBlacksmith', 'Testeur-1')),
    };

    const reglageDisque = () => JSON.parse(readFileSync(join(dossier, 'donnees', 'swex.json'), 'utf8'));
    resultats.reglageRetenu = reglageDisque();

    // 11. La conservation refusée (Paramètres), puis une relance : rien
    // n'est resté sur le disque, et l'export de l'invocateur suivi
    // s'importe EN ENTIER — la prépa RTA revient, pas seulement « Mon compte ».
    // Le compteur de « Ma prépa » en témoigne (bureau : à côté du titre).
    const compteurPrepa = async () => {
      await js(`location.hash = '#/rta'`);
      await attendre(1200);
      return js(`[...document.querySelectorAll('h1')].find((h) => h.textContent.trim() === 'Ma prépa')?.nextElementSibling?.textContent.trim() ?? 'aucun'`);
    };
    await fermerNotification();
    resultats.prepaAvantRefus = await compteurPrepa();
    await js(`location.hash = '#/parametres'`);
    await attendre(1000);
    resultats.refus = await js(`(() => {
      const s = document.querySelector('[role="switch"][aria-label="Garder mes données sur cet appareil"]');
      if (!s) return 'pas d’interrupteur';
      if (s.getAttribute('aria-checked') !== 'true') return 'déjà refusée';
      s.click();
      return 'cliqué';
    })()`);
    await attendre(1500);
    fenetre.webContents.reload();
    await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    await attendre(4000);
    resultats.apresRelanceSansConservation = {
      conservation: await js(`localStorage.getItem('swblacksmith-persist-v1')`),
      compte: await compteAffiche(),
      prepa: await compteurPrepa(),
      notification: await notification(),
    };
    await js(`location.hash = '#/parametres'`);
    await attendre(1000);

    // 12. Un import MANUEL, « Testeur » suivi : l'invocateur est lâché, le
    // dossier reste — aucun coché, ni au menu ni dans les Réglages. Puis
    // l'export de l'ancien invocateur, réécrit : il ne s'applique plus.
    await fermerNotification();
    const manuel = JSON.parse(compte);
    manuel.wizard_info = { ...manuel.wizard_info, wizard_id: 3, wizard_name: 'Manuel' };
    await js(`(() => {
      const champ = document.querySelector('aside input[type="file"]');
      const dt = new DataTransfer();
      dt.items.add(new File([${JSON.stringify(JSON.stringify(manuel))}], 'manuel.json', { type: 'application/json' }));
      champ.files = dt.files;
      champ.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await attendre(800);
    resultats.remplacerManuel = await cliquerDansModale('Remplacer');
    await attendre(1500);
    await cliquerQuandPret(fenetre, 'Garder mes données (recommandé)', 2000);
    await attendre(800);
    resultats.apresImportManuel = {
      compte: await compteAffiche(),
      menu: await menuCarte(),
      selecteur: await js(`document.querySelector('[data-reglage-swex] select')?.value`),
      reglage: reglageDisque(),
    };
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await fermerNotification();
    writeFileSync(join(fixtures, 'Testeur-1.json'), JSON.stringify({ ...manuel, wizard_info: { ...manuel.wizard_info, wizard_id: 1, wizard_name: 'Testeur-bis' } }));
    await attendre(4500);
    resultats.apresAncienExport = { compte: await compteAffiche(), notification: await notification() };
  } catch (e) {
    resultats.erreur = String(e);
  } finally {
    writeFileSync(join(dossier, 'resultats-swex.json'), JSON.stringify(resultats, null, 2));
    app.quit();
  }
}

// ── Sauvegarde de session ──────────────────────────────────────────────
// `npm run bureau:preuve -- --session` : un compte importé en REFUSANT la
// conservation (rien n'est alors sur le disque : c'est le cas où la session
// doit lire l'app, pas le stockage), deux écrans visités, puis chaque accès :
// « Sauvegarder » des Paramètres (aucun dossier SW Blacksmith : il est
// demandé — sans boîte en mode preuve — puis la session s'écrit dans son
// sous-dossier `sessions`), « Sauvegarder la session » de la palette, Ctrl+S,
// « Sauvegarder sous… » puis « Sauvegarder » de la barre du haut, enfin
// « Retirer » le dossier dans les Paramètres et Ctrl+S ; puis un rechargement
// (la page repart vide) et Ctrl+O, « Charger… », qui reprend la session la
// plus récente. Après chaque geste, `releverSession`. Le script relit chaque
// fichier de session par `lireSession`.
// Le script pose avant le lancement un `session.json` d'une ouverture
// précédente : conservation refusée, il doit être oublié, jamais réécrit.
export async function lancerPreuveSession(fenetre: BrowserWindow, dossier: string, compte: string, telechargements: string) {
  const resultats: Record<string, unknown> = {};
  const js = (code: string) => fenetre.webContents.executeJavaScript(code, true);
  const releve = async () => ({
    ...(await releverSession(fenetre, dossier)),
    telechargements: existsSync(telechargements) ? readdirSync(telechargements) : [],
  });
  try {
    if (fenetre.webContents.isLoading()) {
      await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    }
    await attendre(2500);
    resultats.depart = await releve();
    resultats.import = await js(`(() => {
      const champ = document.querySelector('input[type="file"][accept*="json"]');
      if (!champ) return 'pas de champ fichier';
      const dt = new DataTransfer();
      dt.items.add(new File([${JSON.stringify(compte)}], 'compte-miniature.json', { type: 'application/json' }));
      champ.files = dt.files;
      champ.dispatchEvent(new Event('change', { bubbles: true }));
      return 'déposé';
    })()`);
    resultats.refus = await cliquerQuandPret(fenetre, 'Non, ne rien garder de mes informations');
    await attendre(1500);
    // Conservation refusée : le travail n'est PAS sur le disque.
    resultats.disque = await js(`({
      conservation: localStorage.getItem('swblacksmith-persist-v1'),
      prepaRta: localStorage.getItem('swblacksmith-rta-v1'),
      siegeDefense: localStorage.getItem('swblacksmith-siege-defense-v1'),
    })`);
    for (const ecran of ['#/siege/defense', '#/outils/optimizer']) {
      await js(`location.hash = '${ecran}'`);
      await attendre(1500);
    }
    // 1. « Sauvegarder », ligne « Session » des Paramètres (hors de la barre
    // du haut, qui porte le même libellé).
    await js(`location.hash = '#/parametres'`);
    await attendre(1200);
    const boutonReglages = `[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Sauvegarder' && !x.closest('header'))`;
    resultats.ligneSession = await js(`(() => {
      const b = ${boutonReglages};
      if (!b) return 'pas de bouton';
      return b.closest('.py-2\\\\.5')?.innerText.replace(/\\s+/g, ' ').trim() ?? 'ligne introuvable';
    })()`);
    resultats.avantReglages = await releve();
    resultats.clicReglages = await js(`(() => {
      const b = ${boutonReglages};
      if (!b) return 'pas de bouton';
      b.click();
      return 'cliqué';
    })()`);
    resultats.apresReglages = await releve();
    // 2. Ctrl K, puis l'action « Sauvegarder la session ».
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))`);
    await attendre(800);
    resultats.actionsPalette = await js(
      `[...document.querySelectorAll('[role="option"]')].map((x) => x.textContent.trim()).filter((t) => /session/i.test(t))`
    );
    resultats.clicPalette = await js(`(() => {
      const o = [...document.querySelectorAll('[role="option"]')].find((x) => x.textContent.includes('Sauvegarder la session'));
      if (!o) return 'pas d’action';
      o.click();
      return 'cliqué';
    })()`);
    resultats.apresPalette = await releve();
    // 3. Ctrl+S.
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }))`);
    resultats.apresCtrlS = await releve();
    // 4. « Sauvegarder sous… », puis 5. « Sauvegarder », dans la barre du haut.
    resultats.clicNouvelle = await cliquerDansLaBarre(fenetre, 'Sauvegarder sous…');
    resultats.apresNouvelle = await releve();
    resultats.clicBarre = await cliquerDansLaBarre(fenetre, 'Sauvegarder');
    resultats.apresBarre = await releve();
    // 6. « Retirer » le dossier (Paramètres), puis Ctrl+S : la session en
    // cours reste celle qu'on avait.
    resultats.clicRetirer = await js(`(() => {
      const b = [...document.querySelectorAll('[data-repere="dossier-swblacksmith"] button')].find((x) => x.textContent.trim() === 'Retirer');
      if (!b) return 'pas de bouton';
      b.click();
      return 'cliqué';
    })()`);
    resultats.apresRetrait = await releve();
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }))`);
    resultats.apresRetraitCtrlS = await releve();

    // 7. « Charger… » : un rechargement d'abord — conservation refusée, la
    // page repart vide —, puis Ctrl+O, qui reprend la session la plus récente
    // (mode preuve, sans boîte). La prépa RTA revient, le compte aussi, et
    // rien n'est écrit sur le disque.
    const compteurPrepa = async () => {
      await js(`location.hash = '#/rta'`);
      await attendre(1200);
      return js(`[...document.querySelectorAll('h1')].find((h) => h.textContent.trim() === 'Ma prépa')?.nextElementSibling?.textContent.trim() ?? 'aucun'`);
    };
    const compteAffiche = () =>
      js(`document.querySelector('aside button[aria-label="Importer un compte"], aside button[aria-label="Changer de compte"]')?.querySelector('.font-semibold')?.textContent.trim() ?? 'aucun'`);
    // Un état RICHE pour l'aller-retour, par de vrais gestes : un thème (un
    // réglage), « Autoriser un regemme différent » à l'onglet Optimisation
    // (la mémoire d'un écran), un monstre choisi dans l'Optimizer (sa photo).
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))`);
    await attendre(800);
    resultats.etatRiche = {
      theme: await js(`(() => {
        const o = [...document.querySelectorAll('[role="option"]')].find((x) => x.textContent.includes('Thème sombre'));
        if (!o) return 'pas d’action';
        o.click();
        return 'cliqué';
      })()`),
    } as Record<string, unknown>;
    await attendre(600);
    await js(`location.hash = '#/compte/runes/optimisation'`);
    await attendre(1500);
    (resultats.etatRiche as Record<string, unknown>).regemme = await js(`(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Autoriser un regemme différent' && x.offsetParent !== null);
      if (!b) return 'pas de bouton';
      if (b.disabled) return 'désactivé';
      b.click();
      return 'cliqué';
    })()`);
    await js(`location.hash = '#/outils/optimizer'`);
    await attendre(1500);
    // ⚠️ Attentes RELANCÉES, pas fixes : l'écran de l'Optimizer se charge à
    // part, son champ et ses suggestions peuvent tarder.
    (resultats.etatRiche as Record<string, unknown>).monstre = await js(`(async () => {
      const attendreQue = async (f) => {
        for (let i = 0; i < 40; i++) {
          const v = f();
          if (v) return v;
          await new Promise((r) => setTimeout(r, 150));
        }
        return null;
      };
      // La première suggestion choisissable : la box du compte de test n'a
      // que trois monstres, leur nom importe peu. ⚠️ La saisie est RETENTÉE :
      // l'écran finit de se monter juste après l'apparition du champ, et peut
      // remplacer celui où l'on vient de taper.
      let champ = null;
      let o = null;
      for (let essai = 0; essai < 3 && !o; essai++) {
        champ = await attendreQue(() => [...document.querySelectorAll('input[placeholder="Rechercher un monstre…"]')].find((x) => x.offsetParent !== null));
        if (!champ) return 'pas de champ';
        // ⚠️ La liste ne s'ouvre qu'au focus (useComboboxNav). Fenêtre sans le
        // focus du système, \`focus()\` n'émet pas l'événement que React écoute :
        // il est émis ici.
        champ.focus();
        champ.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(champ, 'e');
        champ.dispatchEvent(new Event('input', { bubbles: true }));
        for (let i = 0; i < 10 && !o; i++) {
          await new Promise((r) => setTimeout(r, 150));
          o = [...document.querySelectorAll('[role="option"]')].find((x) => x.getAttribute('aria-disabled') !== 'true') ?? null;
        }
      }
      if (!o) return 'pas de suggestion : ' + JSON.stringify({
        champs: document.querySelectorAll('input[placeholder="Rechercher un monstre…"]').length,
        valeur: champ.value,
        options: document.querySelectorAll('[role="option"]').length,
        listes: document.querySelectorAll('[role="listbox"]').length,
        actif: document.activeElement === champ,
        hash: location.hash,
      });
      o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      return 'choisi : ' + o.textContent.trim();
    })()`);
    await attendre(1200);

    resultats.prepaAvantChargement = await compteurPrepa();
    // La RÉFÉRENCE de l'aller-retour : la session telle qu'elle est maintenant,
    // écrite par Ctrl+S et copiée à part (elle sera réécrite après le
    // chargement, puis comparée champ par champ par le script).
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }))`);
    const reference = await releve();
    resultats.reference = reference;
    const nomCourante = /Sauvegarder dans (.+) \(Ctrl\+S\)/.exec(reference.infobulle ?? '')?.[1] ?? null;
    resultats.nomCourante = nomCourante;
    const cheminCourante = nomCourante ? join(dossier, 'swblacksmith', 'sessions', nomCourante) : null;
    if (cheminCourante && existsSync(cheminCourante)) writeFileSync(join(dossier, 'reference-session.json'), readFileSync(cheminCourante));
    fenetre.webContents.reload();
    await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    await attendre(3000);
    resultats.apresRechargementVide = { prepa: await compteurPrepa(), compte: await compteAffiche() };
    const charge = new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true }))`);
    await charge;
    await attendre(3500);
    const notificationCharge = await js(`[...document.querySelectorAll('[role="status"]')].map((e) => e.innerText.trim()).join(' | ')`);
    resultats.apresChargement = {
      notification: notificationCharge,
      prepa: await compteurPrepa(),
      compte: await compteAffiche(),
      disque: await js(`({
        conservation: localStorage.getItem('swblacksmith-persist-v1'),
        prepaRta: localStorage.getItem('swblacksmith-rta-v1'),
      })`),
      session: await releve(),
    };
    // 8. L'aller-retour : les écrans de la référence revisités, puis Ctrl+S
    // réécrit la session chargée — le script la compare à la référence.
    for (const ecran of ['#/siege/defense', '#/outils/optimizer', '#/rta']) {
      await js(`location.hash = '${ecran}'`);
      await attendre(1500);
    }
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }))`);
    resultats.apresResauvegarde = await releve();
    if (cheminCourante && existsSync(cheminCourante)) writeFileSync(join(dossier, 'resauvegarde-session.json'), readFileSync(cheminCourante));
  } catch (e) {
    resultats.erreur = String(e);
  } finally {
    writeFileSync(join(dossier, 'resultats-session.json'), JSON.stringify(resultats, null, 2));
    app.quit();
  }
}

// ── La connexion à Discord ─────────────────────────────────────
// `npm run bureau:preuve -- --discord` : le VRAI service, lancé par le script
// devant un Discord simulé (`SWBLACKSMITH_SERVICE_DISCORD`), deux lancements
// sur le même dossier. `connecter` : « Se connecter à Discord », le
// navigateur simulé ici (login, puis retour de Discord avec l'état), le code
// collé dans le dialogue ; conservation refusée, rien sur le disque ; un
// favori ; puis « Garder mes données » : la session s'écrit, chiffrée.
// `relire` : connecté dès l'ouverture, favori en tête, puis « Se déconnecter ».
export async function lancerPreuveDiscord(fenetre: BrowserWindow, dossier: string, etape: 'connecter' | 'relire', temoins: TemoinsPreuve) {
  mkdirSync(dossier, { recursive: true });
  const resultats: Record<string, unknown> = { etape };
  const js = (code: string) => fenetre.webContents.executeJavaScript(code, true);
  const fichier = join(dossier, 'donnees', 'discord.json');
  const attendreQue = async (condition: string, delai = 15_000) => {
    const fin = Date.now() + delai;
    while (Date.now() < fin) {
      if (await js(condition)) return true;
      await attendre(250);
    }
    return false;
  };
  const connecte = `!!document.querySelector('[data-compte-discord="connecte"]')`;
  // La colonne : le compte, les salons dans leur ordre, les étoiles.
  const releve = async () => ({
    compte: await js(`document.querySelector('[data-compte-discord]')?.getAttribute('data-compte-discord') ?? null`),
    colonne: await js(`document.querySelector('[data-colonne-provenances]')?.innerText.replace(/\\s+/g, ' ').trim() ?? null`),
    etoiles: await js(`[...document.querySelectorAll('[data-colonne-provenances] button[aria-pressed]')].map((b) => b.getAttribute('aria-label'))`),
    recos: await js(`document.body.innerText.includes('Défenses GvO') && document.body.innerText.includes('Offs de guilde')`),
    fichier: existsSync(fichier) ? readFileSync(fichier, 'utf8') : null,
  });
  try {
    if (fenetre.webContents.isLoading()) {
      await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    }
    await attendre(2500);
    await js(`location.hash = '#/siege/recommandations'`);
    await attendre(1500);
    if (etape === 'connecter') {
      resultats.depart = await releve();
      // Le guide d'installation : « Inviter le bot » ouvre le navigateur sur
      // le service, qui renvoie vers l'invitation Discord.
      resultats.guide = await cliquerQuandPret(fenetre, 'Installer le bot sur ton serveur');
      resultats.inviter = await cliquerQuandPret(fenetre, 'Inviter le bot');
      await attendre(500);
      const invitation = temoins.liensOuverts.find((l) => l.endsWith('/api/discord/invitation')) ?? '';
      resultats.invitation = invitation ? new URL(invitation).pathname : null;
      if (invitation) {
        const vers = new URL((await fetch(invitation, { redirect: 'manual' })).headers.get('location') ?? '');
        resultats.invitationVers = `${vers.origin}${vers.pathname}?scope=${vers.searchParams.get('scope')}&permissions=${vers.searchParams.get('permissions')}`;
      }
      resultats.fermerGuide = await cliquerQuandPret(fenetre, 'Fermer');
      await attendre(300);
      resultats.connexion = await cliquerQuandPret(fenetre, 'Se connecter à Discord');
      resultats.continuer = await cliquerQuandPret(fenetre, 'Continuer vers Discord');
      await attendre(500);
      const lien = temoins.liensOuverts.find((l) => l.includes('/api/discord/login?bureau=')) ?? '';
      resultats.lien = lien.replace(/bureau=.*/, 'bureau=…');
      resultats.dialogueCode = await attendreQue(`!!document.querySelector('input[aria-label="Code de connexion"]')`, 5000);
      // Le navigateur : le login pose l'état en cookie et part vers Discord ;
      // Discord revient sur le service avec un code et l'état ; le service
      // renvoie vers le site, qui afficherait le code à copier.
      const service = new URL(lien).origin;
      const login = await fetch(lien, { redirect: 'manual' });
      const cookieEtat = (login.headers.get('set-cookie') ?? '').split(';')[0];
      const etat = new URL(login.headers.get('location') ?? '').searchParams.get('state') ?? '';
      const retour = await fetch(`${service}/api/discord/callback?code=c&state=${etat}`, { redirect: 'manual', headers: { cookie: cookieEtat } });
      const code = new URL(retour.headers.get('location') ?? '', service).searchParams.get('discord-bureau') ?? '';
      resultats.codeObtenu = code.length;
      // Un code abîmé d'abord : refusé, dit, le dialogue reste.
      const coller = (texte: string) => js(`(() => {
        const champ = document.querySelector('input[aria-label="Code de connexion"]');
        if (!champ) return 'pas de champ';
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(champ, ${JSON.stringify(texte)});
        champ.dispatchEvent(new Event('input', { bubbles: true }));
        return 'collé';
      })()`);
      resultats.collerFaux = await coller(code.slice(0, -4) + 'AAAA');
      resultats.validerFaux = await cliquerQuandPret(fenetre, 'Se connecter');
      resultats.refusDit = await attendreQue(`document.querySelector('[role="alert"]')?.innerText.includes('Ce code ne marche pas') ?? false`, 5000);
      // Le bon code, collé avec le retour à la ligne d'un copier-coller.
      resultats.coller = await coller(`  ${code}\n`);
      resultats.valider = await cliquerQuandPret(fenetre, 'Se connecter');
      resultats.connecte = await attendreQue(connecte);
      await attendre(500);
      resultats.apresConnexion = await releve();
      // Un favori : le second salon.
      resultats.favori = await js(`(() => {
        const ligne = [...document.querySelectorAll('[data-colonne-provenances] [data-serveur] > div')].find((d) => d.innerText.includes('blacksmith-reco-offs'));
        const b = ligne?.querySelector('button[aria-pressed]');
        if (!b) return 'pas d’étoile';
        b.click();
        return 'cliqué';
      })()`);
      await attendre(500);
      resultats.apresFavori = await releve();
      // « Garder mes données » : la page le redit au rechargement, la session
      // (toujours dans le processus principal) s'écrit.
      await js(`localStorage.setItem('swblacksmith-persist-v1', '1'); location.reload()`);
      await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
      await attendre(2500);
      resultats.reconnecteApresRechargement = await attendreQue(connecte);
      resultats.apresConservation = await releve();
    } else {
      resultats.connecteAuLancement = await attendreQue(connecte);
      resultats.auLancement = await releve();
      resultats.deconnexion = await js(`(() => {
        const b = document.querySelector('button[aria-label="Se déconnecter de Discord"]');
        if (!b) return 'pas de bouton';
        b.click();
        return 'cliqué';
      })()`);
      resultats.deconnecte = await attendreQue(`document.querySelector('[data-compte-discord]')?.getAttribute('data-compte-discord') === 'deconnecte'`, 5000);
      await attendre(500);
      resultats.apresDeconnexion = await releve();
    }
  } catch (e) {
    resultats.erreur = String(e);
  } finally {
    writeFileSync(join(dossier, `discord-${etape}.json`), JSON.stringify(resultats, null, 2));
    fenetre.close();
  }
}

export async function lancerPreuve(fenetre: BrowserWindow, dossier: string, racine: string, temoins: TemoinsPreuve) {
  mkdirSync(dossier, { recursive: true });
  const resultats: Record<string, unknown> = {};
  const js = (code: string) => fenetre.webContents.executeJavaScript(code, true);
  try {
    if (fenetre.webContents.isLoading()) {
      await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    }
    await attendre(2500);

    // ── L'app installée ──────────────────────────────────────────
    // Empaquetée, elle porte le nom de electron-builder.yml (`SW Blacksmith`,
    // dossier des données) ; lancée par `bureau:local`, celui de package.json.
    resultats.empaquetee = app.isPackaged;
    resultats.nomApp = app.getName();
    // ⚠️ Windows impose au PREMIER affichage l'état demandé par le processus
    // qui lance l'app (STARTUPINFO) : lancée depuis un shell caché, elle
    // s'ouvre réduite. Un double-clic l'ouvre normalement. La preuve la
    // rouvre et le note.
    resultats.ouverteReduite = fenetre.isMinimized();
    if (fenetre.isMinimized()) {
      fenetre.restore();
      await attendre(1000);
    }

    // ── La coquille ──────────────────────────────────────────────
    resultats.origine = await js('location.origin');
    resultats.titre = fenetre.getTitle();
    resultats.stockage = await js(`(() => {
      try {
        localStorage.setItem('swblacksmith-preuve', '1');
        const lu = localStorage.getItem('swblacksmith-preuve') === '1';
        localStorage.removeItem('swblacksmith-preuve');
        return lu;
      } catch (e) { return String(e); }
    })()`);
    resultats.prechargement = await js('JSON.stringify(Object.keys(window.swblacksmithBureau ?? {}))');
    resultats.nodeDansLaPage = await js('typeof require + " / " + typeof process');
    // Les cœurs physiques, lus par le processus principal (bureau/coeurs.ts)
    // et demandés par la page comme le fait la recherche de runes.
    resultats.coeursPhysiques = await js('window.swblacksmithBureau.coeursPhysiques()');
    resultats.fetchDonnees = await js(
      `fetch('/data/monsters.json').then((r) => r.status).catch((e) => 'erreur ' + e)`
    );
    // Un fichier qui EXISTE hors du build (`package.json`, à la racine du
    // dépôt), visé par `..` + barre encodée — la forme que l'analyse de l'URL
    // ne résout pas : le protocole doit répondre 404.
    resultats.horsRacineEncode = await js(
      `fetch('/..%2Fpackage.json').then((r) => r.status).catch((e) => 'erreur ' + e)`
    );
    const worker = readdirSync(join(racine, 'assets')).find((n) => /^runeBuildOptim\.worker-.*\.js$/.test(n));
    resultats.worker = worker
      ? await js(`new Promise((r) => {
          const w = new Worker('/assets/${worker}', { type: 'module' });
          w.onerror = (e) => r('erreur ' + (e.message || ''));
          setTimeout(() => { w.terminate(); r('ok : ${worker}'); }, 2000);
        })`)
      : 'aucun worker dans le build';

    // ── L'habillage de la fenêtre ────────────────────────────
    resultats.dataBureau = await js(`document.documentElement.getAttribute('data-bureau')`);
    resultats.zoneDeplacement = await js(
      `getComputedStyle(document.querySelector('header[data-barre-fenetre]')).getPropertyValue('-webkit-app-region') || getComputedStyle(document.querySelector('header[data-barre-fenetre]')).getPropertyValue('app-region')`
    );
    resultats.boutonCliquable = await js(
      `getComputedStyle(document.querySelector('header[data-barre-fenetre] button')).getPropertyValue('-webkit-app-region') || 'non lu'`
    );
    resultats.margeBoutonsWindows = await js(
      `getComputedStyle(document.querySelector('header[data-barre-fenetre]')).paddingRight`
    );
    resultats.tailleFenetre = fenetre.getBounds();
    // L'APP ne propose pas de télécharger l'app — ni
    // entrée « Télécharger » dans la navigation, ni lien ou carte sur
    // l'accueil.
    resultats.accueilSansTelechargement = await js(
      `!document.querySelector('a[href="#/telecharger"]') && !document.body.innerText.includes('Existe aussi en application')`
    );
    resultats.menu = fenetre.isMenuBarVisible() ? 'visible' : 'aucun';

    // La fenêtre suit le thème : la couleur de fond qu'elle a reçue de la
    // page, par thème.
    for (const theme of ['dark', 'light'] as const) {
      await js(`document.documentElement.setAttribute('data-theme', '${theme}')`);
      await attendre(800);
      resultats[`fond-${theme}`] = fenetre.getBackgroundColor();
    }
    await js(`document.documentElement.removeAttribute('data-theme')`);

    // ── Liens, navigations, téléchargements ──────────────────────
    // Chaque lien externe de l'accueil, puis de la page Nouveautés, cliqué :
    // il doit être confié au navigateur (ici, noté), et l'app rester en place.
    const cliquerLiensExternes = () =>
      js(`(() => {
        const liens = [...document.querySelectorAll('a[target="_blank"]')].map((a) => a.href);
        document.querySelectorAll('a[target="_blank"]').forEach((a) => a.click());
        return liens;
      })()`) as Promise<string[]>;
    await js(`location.hash = '#/'`);
    await attendre(1000);
    const liensAccueil = await cliquerLiensExternes();
    await js(`location.hash = '#/releases'`);
    await attendre(1500);
    const liensNouveautes = await cliquerLiensExternes();
    await attendre(500);
    const attendus = [...new Set([...liensAccueil, ...liensNouveautes])];
    resultats.liensExternes = {
      cliques: attendus.length,
      confiesAuNavigateur: [...new Set(temoins.liensOuverts)].length,
      manquants: attendus.filter((l) => !temoins.liensOuverts.includes(l)),
      exemples: attendus.slice(0, 6),
      appToujoursLa: await js('location.origin'),
    };
    // Quitter l'app : vers un fichier du disque (bloqué, rien d'ouvert) et
    // vers le web (bloqué, confié au navigateur).
    const avant = temoins.liensOuverts.length;
    await js(`location.href = 'file:///C:/Windows/win.ini'`).catch(() => undefined);
    await attendre(800);
    resultats.navigationFichier = { origine: await js('location.origin'), ouvertDehors: temoins.liensOuverts.length > avant };
    await js(`location.href = 'https://example.com/'`).catch(() => undefined);
    await attendre(800);
    resultats.navigationWeb = {
      origine: await js('location.origin'),
      confieAuNavigateur: temoins.liensOuverts.includes('https://example.com/'),
    };
    // Un téléchargement, construit comme les cinq exports de l'app (un Blob,
    // puis `a.download`).
    await js(`(() => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['{"preuve":"telechargement"}'], { type: 'application/json' }));
      a.download = 'swblacksmith-essai.json';
      a.click();
    })()`);
    await attendre(1500);
    const telecharge = join(temoins.dossierTelechargements, 'swblacksmith-essai.json');
    resultats.telechargement = existsSync(telecharge) ? readFileSync(telecharge, 'utf8') : 'absent';

    // ── La mise à jour automatique ───────────────────────────────
    // Une version « disponible », simulée (aucun réseau). L'utilisateur
    // décide : la question doit RESTER au-delà des 6 s, rien ne doit se
    // télécharger sans « Mettre à jour » ; puis « Mise à jour prête »,
    // « Redémarrer » qui atteint le processus principal (compté, sans
    // redémarrer), et la page RECHARGÉE qui la propose encore.
    // ⚠️ La notification, pas la première zone `role="status"` (App.tsx en a
    // une, toujours là) : celle qui porte la croix « Fermer la notification ».
    const notification = () =>
      js(`document.querySelector('[aria-label="Fermer la notification"]')?.closest('[role="status"]')?.innerText.replace(/\\s+/g, ' ').trim() ?? 'aucune'`);
    const cliquer = (libelle: string) =>
      js(`(() => {
        const b = [...document.querySelectorAll('[role="status"] button')].find((x) => x.textContent.trim() === ${JSON.stringify(libelle)});
        if (!b) return 'pas de bouton « ${libelle} »';
        b.click();
        return 'cliqué';
      })()`);
    // Le bloc « Application » des Réglages : la mise à jour
    // remise à plus tard s'y fait quand il veut.
    const bloc = () =>
      js(`(() => {
        const s = document.querySelector('[data-bloc-application]');
        if (!s) return 'aucun bloc';
        const b = s.querySelector('button');
        return s.innerText.replace(/\\s+/g, ' ').trim() + (b?.disabled ? ' [désactivé]' : '');
      })()`);
    const cliquerBloc = () => js(`document.querySelector('[data-bloc-application] button')?.click() ?? 'pas de bouton'`);
    const ma: Record<string, unknown> = {};
    await js(`location.hash = '#/parametres'`);
    await attendre(1200);
    ma.avant = await notification();
    ma.blocAvant = await bloc();
    await cliquerBloc();
    await attendre(100);
    ma.blocRecherche = await bloc();
    await attendre(600);
    ma.blocAJour = await bloc();
    ma.recherches = temoins.miseAJour.recherches;
    temoins.miseAJour.simuler?.('9.9.9');
    await attendre(800);
    ma.disponible = await notification();
    ma.blocDisponible = await bloc();
    await attendre(7000);
    ma.disponibleApres7s = await notification();
    // « Plus tard » : la croix. Rien ne se télécharge, le bloc garde l'offre.
    await js(`document.querySelector('[aria-label="Fermer la notification"]')?.click()`);
    await attendre(300);
    ma.apresCroix = await notification();
    ma.blocApresCroix = await bloc();
    ma.telechargementsSansAccord = temoins.miseAJour.telechargements;
    // … puis « Mettre à jour » depuis les Réglages.
    await cliquerBloc();
    await attendre(100);
    ma.pendant = await notification();
    ma.blocPendant = await bloc();
    await attendre(1000);
    ma.telechargements = temoins.miseAJour.telechargements;
    ma.prete = await notification();
    ma.blocPrete = await bloc();
    ma.clicRedemarrer = await cliquer('Redémarrer');
    await attendre(500);
    ma.redemarrages = temoins.miseAJour.redemarrages;
    fenetre.webContents.reload();
    await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    await attendre(2000);
    ma.apresRechargement = await notification();
    resultats.miseAJour = ma;

    await js(`location.hash = '#/bestiary'`);
    await attendre(2500);
    // Le compteur du Bestiaire (« 2 859 monstres ») : les données sont lues.
    resultats.bestiaire = await js(`document.body.innerText.match(/[0-9][0-9\\s\\u202f\\u00a0]* monstres/)?.[0] ?? 'aucun compteur'`);
  } catch (e) {
    resultats.erreur = String(e);
  } finally {
    writeFileSync(join(dossier, 'resultats.json'), JSON.stringify(resultats, null, 2));
    app.quit();
  }
}
