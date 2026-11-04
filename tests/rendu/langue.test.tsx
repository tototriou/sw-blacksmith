// Tests de rendu — la langue de l'interface (docs/02-app/transverse/feat-langues.md) :
// le réglage « Langue » des Paramètres, et l'enveloppe de l'app (navigation,
// barre du haut, Paramètres) affichée en anglais quand on l'a choisi.
//
// ⚠️ Le rendu serveur n'a pas de navigateur : « Auto » y donne la langue
// source, le français. Chaque test qui choisit l'anglais revient à « Auto ».

import { SettingsList } from '../../src/components/SettingsMenu';
import { RuneDetailBox } from '../../src/components/PieceDetail';
import type { Reco, RecoPayload, RuneDetail } from '../../src/types';
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
import { ETAT_EQUIPE, rendreSpeedTune } from './speed-tune.test';
import { en } from '../../src/i18n/en';
import { OptionsFusion, SousTitreFusion, titreChoixFusion } from '../../src/components/siege/ChoixFusionRecos';
import { messageFusion } from '../../src/lib/recoFusion';
import { CASSIE as CASSIE_DEGATS, CROSS_FIRE as CROSS_FIRE_DEGATS, carte as carteDegats } from './attaque-conjointe-ecran.test';
import { formuleLisible } from '../../src/lib/monsterSkills';
import { CRIT_MODES, IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID, calculPartielDuSort, cransDeLaRegleIgnoreDef, monsterDamageSkills, monsterModificateursVit, resumeSequenceDeCoups } from '../../src/lib/damage';
import { phraseDegats } from '../../src/i18n/phrasesDegats';
import BlocApplication, { presentationSwex } from '../../src/components/BlocApplication';
import { annonce as annonceMiseAJour } from '../../src/components/MiseAJourBureau';
import { messageExportSwex } from '../../src/components/SuiviSwex';
import NumberField from '../../src/ui/NumberField';
import { BandeauNotification } from '../../src/ui/Notification';
import RelicSlot from '../../src/components/RelicSlot';
import MobileNotice from '../../src/components/MobileNotice';
import { loadMonsterSkills } from '../../scripts/lib/skillsData';
import { validateRecosImport } from '../../src/lib/recoShare';
import ProgressionRecherche from '../../src/components/outils/optimizer/ProgressionRecherche';
import PaginationResultats from '../../src/components/outils/optimizer/PaginationResultats';
import { auTelephone, boutons, rendre, texteVisible, valeurs } from './outils-rendu';

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
  ok(telecharger.includes('Download for Linux (.deb)') && telecharger.includes('For another distribution: the AppImage'), 'Télécharger : le .deb, et l’AppImage pour les autres distributions');

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

// L'Optimizer, les résultats : progression, refus, pagination.
export function testRenduLangueOptimizerResultats() {
  titre('rendu · langue — l’Optimizer, les résultats, en anglais');
  const progression = enAnglais(() => texteVisible(rendre(
    <ProgressionRecherche status="running" progress={{ phase: 'pairing', explored: 1234, totalPairs: 5678, pct: 0.2 } as never} refusal={null} compteAffiche={{ compte: 42 }} />)));
  ok(progression.includes('1,234 / 5,678 combinations examined · 42 found'), 'progression : la phrase et les nombres de l’anglais');
  ok(progression.includes('Wait for the search to finish'), 'progression : l’invitation à attendre');
  const refus = enAnglais(() => texteVisible(rendre(
    <ProgressionRecherche status="refused" progress={null} refusal={{ motif: 'relique-pool-vide', vide: 'seuil' }} compteAffiche={{ compte: 0 }} />)));
  ok(refus.includes('No eligible relic: lower the minimum level.'), 'refus : la raison en anglais');
  const pages = enAnglais(() => rendre(
    <PaginationResultats setResultsPage={() => {}} resultsPage={1} pageDraft={null} setPageDraft={() => {}} totalResultsPages={3} />));
  ok(boutons(pages).some((b) => b.texte === 'Next page' || b.ariaLabel === 'Next page'), 'pagination : « Next page »');
}

// Le speed tuning en anglais : la règle, les deux camps, les tableaux et les
// grilles. Les mêmes états que les tests français (speed-tune.test.tsx).
export function testRenduLangueSpeedTuning() {
  titre('rendu · langue — le speed tuning, en anglais');
  const vide = enAnglais(() => rendreSpeedTune());
  const tv = texteVisible(vide);
  // `texteVisible` sépare chaque nœud d'une espace : « 7% ; » vient de la balise qui met la formule en valeur.
  ok(tv.startsWith('Speed tuning Each tick, the attack bar fills by speed × 7% ; only one monster acts per tick. Add your monsters and the opposing ones to see who moves first.'), 'le titre et la règle des ticks');
  ok(tv.includes('Combat speed needed to act at tick · speed tune reference 3 477 4 358'), 'le repère des ticks');
  ok(tv.includes('Your team Lead None +33%') && tv.includes('Opponent Lead None +33%'), 'les deux camps et leurs leads');
  ok(valeurs(vide, 'aria-label').includes('Speed lead — Your team') && valeurs(vide, 'placeholder').includes('Add an opposing monster…'), 'le lead nommé, la recherche d’ajout');
  ok(boutons(vide).filter((b) => b.texte === 'Import a siege deck').every((b) => b.desactive && b.title === en.speedTuning.importDeck.vide), 'l’import de deck, désactivé et pourquoi');
  ok(tv.endsWith('Add at least one monster to see the attack bars fill and the turn order.'), 'ce qu’il faut faire');

  const html = enAnglais(() => rendreSpeedTune(ETAT_EQUIPE()));
  const t = texteVisible(html);
  const b = boutons(html);
  const nomme = (n: string) => b.find((x) => x.ariaLabel === n);
  ok(t.includes('Galleon base 108 Runes Set SPD buff effect 331 combat'), 'la carte d’un monstre');
  ok(nomme('Swift set worn by Galleon')?.presse === true && nomme('Swift set worn by Galleon')?.title === en.speedTuning.camp.setAide, 'le set Swift, porté et expliqué');
  ok(!!nomme('Move Veromos up: at equal speed, it will move earlier') && nomme('Galleon already moves first at equal speed')?.desactive === true, 'monter / descendre');
  ok(!!nomme('Copy Galleon to the opponent') && !!nomme('Copy Lushen to your team') && !!nomme('Remove Lushen'), 'copier, retirer');
  ok(t.includes('Skill order Show Add monsters to your team to build an order.'), 'l’ordre des sorts');
  ok(b.find((x) => x.texte === 'Analyze')?.title === en.speedTuning.analyse.analyserAide, '« Analyze » et ce qu’il écrit');
  ok(t.includes('Attack bar per tick · % filled over 40 ticks — highlighted cell = this monster takes its turn (the bar goes back to 0)'), 'le tableau des barres');
  ok(t.includes('Veromos 20.230%/tick') && t.includes('Lushen opp 17.430%/tick'), 'la barre par tick, l’adversaire marqué');
  ok(t.includes('Your team acts Opponent acts Only one monster per tick; the number gives the turn order.'), 'la légende');
  ok(t.includes('Attack bar change · at a given tick') && t.includes('Speed buff · SPD icon = +30% buff in one click'), 'les deux grilles');
  ok(b.find((x) => x.ariaLabel === 'Galleon — tick 3 — +30% buff')?.presse === true && valeurs(html, 'aria-label').includes('Your whole team — tick 1'), 'les cases des grilles');
  ok(t.endsWith('Turn order 1 Veromos tick 4 → 2 Galleon tick 5 → 3 Belladeon tick 6 → 4 Lushen tick 7'), 'l’ordre de tour');
  ok(!/Ton équipe|Ajoute|Ordre de tour|Barre d'action/.test(t + tv), 'aucun texte français resté en dur');
  egal([1, 2, 3, 4, 11, 12, 13, 21, 22, 112].map(en.speedTuning.ordreSorts.tour), ['1st turn', '2nd turn', '3rd turn', '4th turn', '11th turn', '12th turn', '13th turn', '21st turn', '22nd turn', '112th turn'], 'les rangs des tours en anglais');
}

// La fusion d'une recommandation importée en anglais : le dialogue, l'aperçu,
// le message après coup et l'avertissement d'une provenance illisible.
export function testRenduLangueFusionRecos() {
  titre('rendu · langue — la fusion d’une recommandation, en anglais');
  const existante: Reco = { id: 'r1', origin: 'imported', name: 'My offs', author: 'A', note: '', decks: [] };
  const entrante: RecoPayload = { name: 'Offs', author: 'A', note: '', decks: [] };
  const paires = [{ entrante, existante }];
  egal(titreChoixFusion(paires, en), 'This file completes one of your recommendations', 'le titre');
  const sous = enAnglais(() => texteVisible(rendre(<SousTitreFusion paires={paires} />)));
  ok(sous.includes('“Offs” extends your recommendation “My offs” .') && sous.includes('Either way, nothing you have is removed or rewritten.'), 'le sous-titre');
  const options = enAnglais(() => boutons(rendre(
    <OptionsFusion une apercu={{ decksAjoutes: 1, decksEnrichis: 2, defensesAjoutees: 1, decksInchanges: 0 }} onChoisir={() => {}} />)));
  ok(options.some((b) => b.texte.startsWith('Merge into the existing recommendation') && b.texte.includes('1 new deck, at the end; 2 decks you already have gain 1 targeted defense.')), 'fusionner, avec l’aperçu');
  ok(options.some((b) => b.texte.startsWith('Add separately')), 'ajouter à part');
  egal(messageFusion({ decksAjoutes: 2, decksEnrichis: 1, defensesAjoutees: 3, decksInchanges: 0, recosAjoutees: 1, recosFusionnees: 1 }, en),
    'Merge: 2 decks added, 1 deck enriched with 3 defenses · 1 recommendation added separately. Nothing was removed or changed.', 'le message après la fusion');
  const lu = validateRecosImport(JSON.stringify({ format: 'swblacksmith/recommandations', version: 5, recommandations: [{ nom: 'R', source: 42, decks: [{ monstres: [{ com2usId: 1 }] }] }] }), en);
  ok(lu.warnings.some((w) => w.includes('“source” is not text — ignored.')), 'la provenance illisible, signalée en anglais');
}

// L'objectif « Dégâts réels » en anglais : la carte, les libellés et résumés
// que damage.ts rédige pour elle, la formule dans les stats du jeu anglais.
export function testRenduLangueDegatsReels() {
  titre('rendu · langue — les dégâts réels, en anglais');
  const html = enAnglais(() => carteDegats(CASSIE_DEGATS, CROSS_FIRE_DEGATS, false));
  const t = texteVisible(html);
  for (const morceau of ['Skill used', 'Active effects', 'Opponent', 'Target element', 'Ignore', 'Critical hit', 'Non-critical', 'Joint attack'])
    ok(t.includes(morceau), `la carte : « ${morceau} »`);
  ok(html.includes('aria-label="Joint attack — off"'), 'la vignette dit son état en anglais');
  ok(/× ATK/.test(t) && !/ATQ/.test(t), 'la formule du sort dans les stats du jeu anglais');
  ok(!/Compétence utilisée|Adversaire|Effets actifs|Élément visé|Coup critique/.test(t), 'aucun texte français resté en dur');
  egal(formuleLisible('3.6*{ATK} + 0.5*{HP}', en.jeu), '3.6 × ATK + 0.5 × HP', 'formule : stats du jeu anglais');
  egal(formuleLisible('3.6*{ATK} + 0.5*{HP}', fr.jeu), '3.6 × ATQ + 0.5 × PV', 'formule : stats du jeu français, inchangées');
  egal(resumeSequenceDeCoups([{ coups: 2, zone: false }, { coups: 1, zone: true }], en), '2 hits · Single target, then 1 hit · AoE', 'une séquence de coups');
  egal(cransDeLaRegleIgnoreDef(IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID[14811], en).map((c) => c.libelle),
    ['From the 2nd hit', 'From the 3rd hit', 'From the 4th hit', 'From the 5th hit', 'From the 6th hit', '7th hit only'], 'les crans d’ignore DEF');
  egal(CRIT_MODES.map((m) => en.degats.critModes[m]), ['Critical', 'Non-critical'], 'les modes critiques');
}

// L'app de bureau et les contrôles partagés en anglais : le bloc
// « Application », la notification de mise à jour, le suivi de SW Exporter,
// les contrôles de src/ui/ et les pièces d'un monstre.
export function testRenduLangueBureauControles() {
  titre('rendu · langue — l’app de bureau et les contrôles partagés, en anglais');
  const bloc = texteVisible(enAnglais(() => rendre(<BlocApplication classeCarte="" />)));
  for (const morceau of ['SW Exporter folder', 'Summoner', 'Check', 'New versions are checked at launch.', 'Choose the folder where SW Exporter saves its exports'])
    ok(bloc.includes(morceau), `le bloc « Application » : « ${morceau} »`);
  ok(!/Dossier SW Exporter|Invocateur|Rechercher|cherchées/.test(bloc), 'le bloc « Application » : aucun texte français resté');
  egal(presentationSwex({ dossier: 'C:/x', fichier: null, exports: [], dernierLu: null, introuvable: true }, en).invocateur,
    'Folder not found: check it still exists, or choose another one.', 'SW Exporter : dossier introuvable');
  egal(annonceMiseAJour({ phase: 'prete', version: '2.3.0' }, en)?.message, 'Update ready', 'la notification de mise à jour');
  egal(annonceMiseAJour({ phase: 'disponible', version: '2.3.0' }, en)?.libelleAction, 'Update', 'son action');
  egal(messageExportSwex('Ayla', true, en), 'Ayla’s account loaded from SW Exporter', 'le suivi de SW Exporter');
  egal(messageExportSwex(null, false, fr), 'Compte mis à jour depuis SW Exporter', 'en français : la phrase d’avant');
  const champ = enAnglais(() => rendre(<NumberField value={3} onChange={() => {}} />));
  ok(champ.includes('aria-label="Decrease"') && champ.includes('aria-label="Increase"'), 'un champ numérique');
  const bandeau = enAnglais(() => rendre(<BandeauNotification annonce={{ message: 'x', action: () => {} }} onFermer={() => {}} />));
  ok(bandeau.includes('Close the notification') && bandeau.includes('Cancel'), 'une notification et son action par défaut');
  const relique = enAnglais(() => rendre(<RelicSlot relic={undefined} />));
  ok(texteVisible(relique).includes('Relic') && relique.includes('No relic equipped'), 'une relique absente');
  const avis = texteVisible(enAnglais(() => rendre(<MobileNotice />)));
  ok(avis.includes('The curves and the Optimizer are easier to read on a large screen.'), 'l’avertissement du téléphone');
}

// Les phrases curées de damage.ts à l'écran anglais (src/i18n/phrasesDegats.ts) :
// un compteur, un « Calcul partiel », la raison d'un sort refusé, un
// modificateur toujours actif. La couverture de toute la table :
// tests/phrases-degats.test.ts.
export function testRenduLanguePhrasesDegats() {
  titre('rendu · langue — les phrases curées des dégâts réels, en anglais');
  const compteur = texteVisible(enAnglais(() => carteDegats(20805, 11605, false)));
  ok(compteur.includes('Attacks received before this skill') && !compteur.includes('Attaques reçues'), 'Hammer Punch (Frankenstein) : le compteur curé en anglais');
  // La phrase du « Calcul partiel » ne se rend qu'à l'ouverture de sa bulle :
  // l'étiquette se voit ici, la phrase passe par `phraseDegats` (branchement :
  // testCalculPartielEcran).
  ok(texteVisible(enAnglais(() => carteDegats(23101, 13406, false))).includes(en.degats.competence.partiel), 'Madness Judgement (Belial) : l’étiquette « Calcul partiel » en anglais');
  const madness = monsterDamageSkills(loadMonsterSkills(23101)).find((s) => s.skillCom2usId === 13406);
  egal(madness && phraseDegats(calculPartielDuSort(madness) ?? '', 'en'),
    'Ignore DEF is counted in full, at all times; the in-game share, which grows as your HP drop, isn’t modeled yet.', 'Madness Judgement : la phrase du « Calcul partiel » en anglais');
  const refus = texteVisible(enAnglais(() => carteDegats(11903, 0, false)));
  ok(refus.includes('Formula not supported by the damage calculation.') && !refus.includes('Formule non prise en charge'), 'un sort refusé : sa raison en anglais');
  egal(monsterModificateursVit(loadMonsterSkills(26113), en).map((m) => m.detail), ['always active — up to +50% damage at a 50 SPD gap'],
    'Sonia : le modificateur toujours actif en anglais');
  egal(monsterModificateursVit(loadMonsterSkills(26113), fr).map((m) => m.detail), ['toujours actif — jusqu\'à +50 % de dégâts à 50 pts d\'écart de VIT'],
    'Sonia : en français, la phrase d’avant');
  ok(texteVisible(carteDegats(20805, 11605, false)).includes('Attaques reçues avant ce sort'), 'en français, la phrase curée reste telle quelle');
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
