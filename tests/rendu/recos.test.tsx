// Tests de rendu — Siège · Recommandations (`RecoBoard`, `VoletDefenses`,
// `ListeRecos`, `RecoCard`). La fenêtre « Ajouter un counter », une modale
// montée dans `<body>`, se teste dans le navigateur (rta-reco-export.test.ts).
// Principe dans
// tests/rendu/outils-rendu.tsx : on vérifie que chaque fonctionnalité et chaque
// information sont présentes, jamais l'apparence : un changement de style doit
// les laisser verts sans qu'une assertion change.
//
// ⚠️ Rendu BUREAU : le panneau d'actions mobile est fermé (`menuOuvert` faux).
// La page arrive sur la vue Défenses ; la vue Decks montre la liste des
// recommandations et, à côté, la première ouverte.

import RecoBoard from '../../src/components/siege/RecoBoard';
import RecoCard, { DeckBlock, StatEditor } from '../../src/components/siege/RecoCard';
import { useSiegeRecos } from '../../src/hooks/useSiegeRecos';
import { chercheMonstre } from '../../src/lib/recoSearch';
import { useSiegeState } from '../../src/hooks/useSiegeState';
import type { Monster, RecoSlot } from '../../src/types';
import type { VueRecos } from '../../src/lib/recoDefenses';
import type { RecoMatch } from '../../src/lib/recoMatch';
import type { EtatAffiche } from '../../src/lib/provenancesRecos';
import { ficheSpeedForTick } from '../../src/lib/speed';
import { egal, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { bouton, boutons, rendre, texteVisible, valeurs } from './outils-rendu';
import { ChoixFiabilite } from '../../src/components/siege/EtoilesFiabilite';
import { amorcerMemoire, reinitialiserSticky } from '../../src/hooks/useStickyState';

const MONSTRES = monstersJson() as Monster[];
const c2u = (nom: string, el: string) =>
  MONSTRES.filter((m) => m.name === nom && m.element === el && m.com2usId != null).sort((a, b) => (a.stats.speed ?? 0) - (b.stats.speed ?? 0))[0].com2usId!;

const slot = (nom: string, el: string, extra: object = {}) => ({
  com2usId: c2u(nom, el),
  name: nom,
  stats: {},
  setOptions: [[]],
  artifacts: { attribute: [], type: [] },
  ...extra,
});

export const RECOS = {
  recos: [
    {
      id: 'r1',
      origin: 'mine',
      name: 'Contres des défenses feu',
      author: 'Joueur',
      note: 'Toujours viser le heal en premier.',
      decks: [
        {
          name: 'Def 1',
          note: 'Lushen ouvre.',
          slots: [
            slot('Lushen', 'wind', { stats: { spd: 200 }, setOptions: [['violent', 'will']] }),
            slot('Veromos', 'dark'),
            slot('Chasun', 'wind'),
          ],
          counters: [{ monsters: [
            { com2usId: c2u('Galleon', 'water'), name: 'Galleon' },
            { com2usId: c2u('Belladeon', 'light'), name: 'Belladeon' },
            { com2usId: null, name: '' },
          ], note: 'si Galleon est en lead' }],
        },
        {
          name: 'Def 2',
          note: '',
          slots: [slot('Galleon', 'water'), slot('Belladeon', 'light'), slot('Chasun', 'wind')],
          counters: [],
        },
      ],
    },
    {
      id: 'r2',
      origin: 'imported',
      name: 'Defs de guilde',
      author: 'Ami',
      note: '',
      decks: [{ name: '', note: '', slots: [slot('Lushen', 'wind'), slot('Veromos', 'dark'), slot('Chasun', 'wind')], counters: [] }],
    },
  ],
};

function Page() {
  const recos = useSiegeRecos();
  const offense = useSiegeState('offense');
  return (
    <RecoBoard
      onImporterEquipe={() => { throw new Error('Action non attendue dans le rendu serveur.'); }}
      compteCharge={false}
      sourcesOptimizer={{ box: [], rtaEntries: {}, siegeDefenseTeams: [], siegeOffenseTeams: [], monsterById: new Map(MONSTRES.map(m => [String(m.id), m])) }}
      recos={recos}
      monsters={MONSTRES}
      builds={[]}
      teams={[]}
      copies6={new Map()}
      offense={offense}
      equipesEnregistrees={[]}
      menuOuvert={false}
      onFermerMenu={() => {}}
    />
  );
}

// La page, dans la vue demandée (`recos.vue`, mémorisée : Défenses à
// l'arrivée) et avec d'autres réglages mémorisés (`sticky`).
export function rendreRecos(etat: object = RECOS, vue: VueRecos = 'defense', sticky: Record<string, unknown> = {}): string {
  faussLocalStorage({ 'swblacksmith-siege-recos-v1': JSON.stringify(etat) });
  amorcerMemoire({ 'recos.vue': vue, ...sticky });
  try {
    return rendre(<Page />);
  } finally {
    reinitialiserSticky('recos.');
  }
}

// Le volet d'UNE recommandation (vue Decks), toujours ouvert. `lien` : la
// provenance et « Détacher » d'une recommandation liée à un salon.
interface Lien { provenance: { nom: string; etat: EtatAffiche | null }; onDetacher: () => void }
function Carte({ edition, cherche, match = null, lien }: { edition: boolean; cherche?: string; match?: RecoMatch | null; lien?: Lien }) {
  const recos = useSiegeRecos();
  const monsterByCom2us = new Map(MONSTRES.filter((m) => m.com2usId != null).map((m) => [m.com2usId!, m]));
  const monsterById = new Map(MONSTRES.map((m) => [String(m.id), m]));
  // Le rendu serveur ne clique pas : une RECHERCHE (la vraie, `chercheMonstre`)
  // restreint les decks à ceux qui contiennent le monstre.
  const hit = cherche
    ? (chercheMonstre(recos.state.recos, cherche, 'all', monsterByCom2us) ?? []).find((h) => h.reco.id === recos.state.recos[0].id) ?? null
    : undefined;
  return (
    <RecoCard
      raisonExportDe={() => 'Importe un compte pour exporter vers l’Optimizer.'}
      onExporterDeckOptimizer={() => {}}
      reco={recos.state.recos[0]}
      index={0}
      monsters={MONSTRES}
      monsterByCom2us={monsterByCom2us}
      monsterById={monsterById}
      offenseTeams={[]}
      equipesChoix={[]}
      match={match}
      editing={edition}
      onToggleEdit={() => {}}
      onExport={() => {}}
      recos={recos}
      hit={hit}
      provenance={lien?.provenance}
      onDetacher={lien?.onDetacher}
    />
  );
}

export function rendreCarte(edition = false, cherche?: string, etat: object = RECOS, match: RecoMatch | null = null, lien?: Lien): string {
  faussLocalStorage({ 'swblacksmith-siege-recos-v1': JSON.stringify(etat) });
  return rendre(<Carte edition={edition} cherche={cherche} match={match} lien={lien} />);
}

// Les decks de la recommandation, DÉPLIÉS. Le rendu serveur ne clique pas, et
// rien ne déplie un deck d'office (pas même la recherche) : on rend donc
// chaque deck ouvert, comme après un clic sur son chevron.
function DecksOuverts({ cherche }: { cherche?: string }) {
  const recos = useSiegeRecos();
  const reco = recos.state.recos[0];
  const monsterByCom2us = new Map(MONSTRES.filter((m) => m.com2usId != null).map((m) => [m.com2usId!, m]));
  const hit = cherche
    ? (chercheMonstre(recos.state.recos, cherche, 'all', monsterByCom2us) ?? []).find((h) => h.reco.id === reco.id) ?? null
    : null;
  return (
    <>
      {reco.decks.map((deck, di) => (
        <DeckBlock
          key={di}
          onExporterOptimizer={() => {}}
          reco={reco}
          deck={deck}
          deckIndex={di}
          monsters={MONSTRES}
          monsterByCom2us={monsterByCom2us}
          match={null}
          editing={false}
          onToggleEdit={() => {}}
          onAnnulerEdition={() => {}}
          annulable={false}
          folded={false}
          onToggleFold={() => {}}
          hit={hit?.decks.find((d) => d.deckIndex === di) ?? null}
          recos={recos}
          onSupprime={() => {}}
        />
      ))}
    </>
  );
}

function rendreDecksOuverts(cherche?: string, etat: object = RECOS): string {
  faussLocalStorage({ 'swblacksmith-siege-recos-v1': JSON.stringify(etat) });
  return rendre(<DecksOuverts cherche={cherche} />);
}

const nomme = (html: string, nom: string) =>
  boutons(html).filter((b) => b.ariaLabel === nom || b.title === nom || b.texte === nom);
// Le volet d'une défense (vue Défenses), sans la liste à côté. ⚠️ L'attribut
// EXACT : `data-volet-defenses` porte toute la vue, liste comprise.
const volet = (html: string) => html.slice(html.indexOf('data-volet-defense='));

export function testRenduRecosPage() {
  titre('rendu · Siège · Recommandations — la page : actions, vues, liste et volet');
  const html = rendreRecos();

  // Actions de la page.
  ok(boutons(html).some((b) => b.texte.includes('Créer une recommandation')), 'bouton « Créer une recommandation »');
  ok(!!nomme(html, "Charger un fichier .json reçu d'un ami")[0], '« Importer », son infobulle');
  ok(!!nomme(html, 'Exporter toutes les recommandations en un seul fichier')[0], '« Tout exporter », son infobulle');
  ok(boutons(html).some((b) => b.texte === 'Tout effacer'), 'bouton « Tout effacer »');

  // Les deux vues : Défenses à l'arrivée.
  ok(boutons(html).some((b) => b.texte === 'Défenses' && b.presse === true), 'vue « Défenses », enclenchée à l\'arrivée');
  ok(boutons(html).some((b) => b.texte === 'Decks' && b.presse === false), 'vue « Decks »');
  const confronter = boutons(html).find((b) => b.texte === 'Confronter à mon compte');
  ok(!!confronter && confronter.desactive && confronter.title === 'Importe ton compte pour analyser', '« Confronter à mon compte » désactivé sans compte, et pourquoi');
  ok(valeurs(html, 'placeholder').some((p) => p.startsWith('Monstre')), 'la recherche par monstre');

  // Vue Decks : la liste des recommandations, et la première ouverte à côté.
  const decks = rendreRecos(RECOS, 'attaque');
  const t = texteVisible(decks);
  ok(boutons(decks).some((b) => b.texte === 'Decks' && b.presse === true), 'vue « Decks » enclenchée');
  ok(t.includes('2 recommandations · 3 decks'), 'la liste : combien de recommandations et de decks');
  ok(!!boutons(decks).find((b) => b.texte === 'Contres des défenses feu 2 decks' && b.title === 'Voir les 2 deck(s)'), 'la liste : une recommandation, son nombre de decks');
  ok(!!boutons(decks).find((b) => b.texte === 'Defs de guilde 1 deck Importée'), 'la liste : la recommandation reçue porte « Importée »');
  ok(/data-reco-liste/.test(decks) && /data-volet-reco/.test(decks), 'la liste et le volet de la recommandation choisie');
  ok(t.includes('2 decks · par Joueur'), 'le volet : la première recommandation, ses decks et son auteur');
  ok(!!nomme(decks, 'Toutes les recommandations')[0], 'le volet : le retour à la liste (fenêtre étroite)');
}

// L'en-tête bureau.
export function testRenduRecosEnTete() {
  titre('rendu · Siège · Recommandations — l\'en-tête bureau et son menu « ⋯ »');
  const html = rendreRecos();
  ok(texteVisible(html).includes('Recommandations 2 recommandations'), 'le titre, puis le compteur');
  const menu = html.match(/<div[^>]*role="menu"[\s\S]*?<\/div><\/div>/)?.[0] ?? '';
  // Importer et Créer restent visibles, le menu ne garde que Tout exporter et
  // Tout effacer.
  egal(boutons(menu).map((b) => b.texte), ['Tout exporter', 'Tout effacer'], 'le menu : Tout exporter, puis Tout effacer');
  const horsMenu = boutons(html.replace(menu, ''));
  ok(horsMenu.some((b) => b.texte === 'Importer'), '« Importer » reste visible');
  ok(horsMenu.some((b) => b.texte === 'Créer une recommandation'), '« Créer une recommandation » reste visible');
}

// Le volet d'une recommandation et la ligne d'un deck RÉDUIT : ses portraits
// seuls, ni noms ni runes — ceux-ci s'écrivent dans le deck ouvert ; ses
// défenses en petit, notables ; ses actions sur sa ligne.
export function testRenduRecosLigneDeckReduite() {
  titre('rendu · Siège · Recommandations — le volet d\'une recommandation, un deck réduit');
  const html = rendreCarte();
  const t = texteVisible(html);
  ok(t.includes('Consignes générales · Toujours viser le heal en premier.'), 'les consignes générales, sur une ligne');
  ok(!!boutons(html).find((b) => b.texte === 'lire'), '« lire » les ouvre en entier');
  const ajouter = boutons(html).find((b) => b.texte === 'Ajouter un counter');
  ok(!!ajouter && !ajouter.desactive, '« Ajouter un counter », hors édition');
  egal(nomme(html, 'Éditer la recommandation').length, 1, '« Éditer la recommandation »');
  ok(boutons(html).some((b) => b.texte === 'Exporter en fichier') && boutons(html).some((b) => b.texte === 'Supprimer cette recommandation'),
    'le menu de la recommandation : exporter, supprimer');

  ok(!/Lushen|Veromos|Galleon|Belladeon|Chasun/.test(t), 'deck réduit : aucun nom de monstre écrit');
  ok(!/runes\/[a-z]+\.png/.test(html), 'deck réduit : aucune icône de set de runes');
  ok(/title="Lushen"/.test(html), 'le nom reste en infobulle du portrait');
  const b = boutons(html);
  const nombre = (nom: string) => b.filter((x) => x.ariaLabel === nom && !x.desactive).length;
  egal([nombre('Éditer ce deck'), nombre('Supprimer ce deck')], [2, 2], 'chaque deck réduit porte « Éditer ce deck » et « Supprimer ce deck », actifs');
  egal(b.filter((x) => x.ariaLabel === 'Exporter vers l\'Optimizer' && x.desactive && x.title === 'Importe un compte pour exporter vers l’Optimizer.').length, 2,
    'et « Exporter vers l\'Optimizer », désactivé sans compte, et pourquoi');
  ok(b.filter((x) => x.ariaLabel === 'Éditer ce deck').every((x) => x.presse === false), 'éditer un deck ne demande pas d\'éditer la recommandation');
  ok(/data-actions-deck/.test(html), 'les actions sont sur la ligne du deck');
  // Les défenses battues : notables sur la ligne, chacune la sienne.
  egal((html.match(/data-defense-ligne/g) ?? []).length, 1, 'la défense battue du premier deck, sur sa ligne');
  ok(!!b.find((x) => x.texte === 'Noter' && x.ariaLabel === 'Noter la fiabilité contre cette défense'), 'non notée : « Noter », contre cette défense');
  // Ouvert, le deck écrit ses noms et ses runes.
  const ouvert = texteVisible(rendreDecksOuverts());
  ok(ouvert.includes('Lushen') && ouvert.includes('Runage'), 'deck ouvert : le nom du monstre et son runage');
}

// Plusieurs défenses sur la ligne d'un deck : trois vignettes au plus, puis
// « … » qui les liste toutes, chacune sa note.
export function testRenduRecosDefensesDeLaLigne() {
  titre('rendu · Siège · Recommandations — plusieurs défenses sur la ligne d\'un deck');
  const r = RECOS.recos[0];
  const def = (a: string, b: string, c: string) => ({ monsters: [[a, 'water'], [b, 'light'], [c, 'wind']].map(([n, el]) => ({ com2usId: c2u(n, el), name: n })), note: '' });
  const quatre = [def('Galleon', 'Belladeon', 'Chasun'), { ...def('Galleon', 'Belladeon', 'Chasun'), fiabilite: 4 }, def('Galleon', 'Belladeon', 'Chasun'), def('Galleon', 'Belladeon', 'Chasun')];
  const html = rendreCarte(false, undefined, { recos: [{ ...r, decks: [{ ...r.decks[0], counters: quatre }] }] });
  egal((html.match(/data-defense-ligne/g) ?? []).length, 3, 'trois défenses au plus sur la ligne');
  ok(/data-defense-ligne[^>]*class="[^"]*hidden @\[11rem\]:flex/.test(html) || /class="[^"]*hidden @\[11rem\]:flex[^"]*"[^>]*data-defense-ligne/.test(html),
    'la deuxième ne se montre que si la place le permet');
  ok(!!boutons(html).find((b) => b.texte === '…' && b.ariaLabel === 'Les 4 défenses de ce deck, et leur fiabilité'), '« … » : les quatre défenses, et leur fiabilité');
  ok(valeurs(html, 'aria-label').includes('Fiabilité 4 sur 5'), 'une défense notée : ses étoiles sur la ligne');
}

export function testRenduRecosDeploiement() {
  titre('rendu · Siège · Recommandations — une recherche, des decks ouverts');
  // La recherche « Chasun » trouve les deux decks (il est dans les deux), et
  // les laisse REPLIÉS : sur un gros lot, les déplier d'office en ouvrait des
  // dizaines. « Déplier tous les decks » les ouvre d'un geste.
  const carte = rendreCarte(false, 'Chasun');
  const tc = texteVisible(carte);
  ok(tc.includes('2 sur 2 decks'), 'la recherche dit « 2 sur 2 decks »');
  egal([nomme(carte, 'Déplier ce deck').length, nomme(carte, 'Replier ce deck').length], [2, 0], 'recherche : les decks trouvés restent repliés');
  ok(tc.includes('Déplier tous les decks'), 'recherche : « Déplier tous les decks » ouvre les decks trouvés');

  const html = rendreDecksOuverts('Chasun');
  const t = texteVisible(html);
  ok(/bg-accent\/\[0\.10\]/.test(html), 'deck ouvert : le slot du monstre cherché surligné');
  ok(t.includes('Consignes du deck Lushen ouvre.'), 'les consignes du deck');
  ok(/Lushen \+33%/.test(t) && /Galleon \+24%/.test(t), 'le bonus du leader de chaque deck');
  ok(t.includes('×4 ×2'), 'les sets recommandés (4 pièces + 2 pièces)');
  ok(boutons(html).some((b) => b.texte === 'Stat Base + bonus VIT 103 +97' && b.title === 'Voir les valeurs totales'),
    'la stat recommandée (VIT, base + bonus) sous l\'en-tête de son tableau, bascule vers les totaux');
  ok(t.includes('Aucun set recommandé') && t.includes('Aucune stat recommandée'), 'un monstre sans consigne le dit');
  egal((t.match(/Fort contre/g) ?? []).length, 2, '« Fort contre » sur chaque deck');
  ok(!!nomme(html, 'Modifier cette défense')[0], 'la défense visée se modifie');
  egal(nomme(html, 'Ajouter une défense que ce deck bat').length, 2, '« Ajouter une défense que ce deck bat » sur chaque deck');
  egal(nomme(html, 'Replier ce deck').length, 2, 'chaque deck ouvert se replie');
  egal(nomme(html, 'Éditer ce deck').length, 2, '« Éditer ce deck » sur chaque deck');
}

export function testRenduRecosEdition() {
  titre('rendu · Siège · Recommandations — une recommandation en édition');
  const html = rendreCarte(true);
  const t = texteVisible(html);
  ok(boutons(html).some((b) => b.ariaLabel === "Terminer l'édition" && b.presse === true), '« Terminer l\'édition » enclenché');
  ok(t.includes('Consignes générales'), 'les consignes générales se saisissent');
  ok(boutons(html).some((b) => b.texte === 'Ajouter un counter'), '« Ajouter un counter », en édition aussi');
  ok(!boutons(html).some((b) => b.texte === 'Ajouter un deck vide' || b.texte.startsWith("Partir d'une de mes équipes")),
    'plus de formulaire d\'ajout dans l\'édition : tout passe par « Ajouter un counter »');
  ok(t.includes('Déplier tous les decks'), '« Déplier tous les decks »');
}

// La vue Défenses : chaque défense visée, toutes recommandations confondues,
// et le volet de celle qu'on choisit, avec les offenses qui la battent.
export function testRenduRecosVueDefense() {
  titre('rendu · Siège · Recommandations — la vue Défenses');
  const html = rendreRecos();
  const t = texteVisible(html);
  ok(t.includes('1 défense visée · 1 offense'), 'la liste : combien de défenses et d\'offenses');
  egal((html.match(/data-defense-liste/g) ?? []).length, 2, 'la liste : la défense visée, puis « Sans défense visée »');
  ok(t.includes('Sans défense visée 2 decks'), 'les decks sans défense visée restent atteignables');
  ok(t.includes('Galleon - Belladeon 1 offense · 1 recommandation'), 'le volet : la première défense, son nombre d\'offenses');
  ok(boutons(html).some((b) => b.texte === 'Par reco' && b.presse === true) && boutons(html).some((b) => b.texte === 'Par fiabilité'),
    'le rangement : par reco (à l\'arrivée), ou par fiabilité');
  const ajouter = boutons(html).find((b) => b.texte === 'Ajouter un counter');
  ok(!!ajouter && !ajouter.desactive && ajouter.title === 'Ajouter une offense contre cette défense : elle s\'ouvre en édition', '« Ajouter un counter » contre cette défense');
  ok(t.includes('Contres des défenses feu par Joueur · 1 deck ici · 2 au total'), 'le bandeau de la recommandation, combien de decks ici');
  ok(t.includes('Contre cette défense : si Galleon est en lead'), 'l\'offense : la précision que ce deck donne contre cette défense');
  ok(t.includes('Lushen ouvre.'), 'l\'offense : les consignes du deck');
  ok(['Publier dans…', 'Éditer la recommandation', 'Exporter en fichier', 'Supprimer cette recommandation'].every((n) => boutons(html).some((b) => b.texte === n)),
    'le menu de la recommandation : publier, éditer, exporter, supprimer');

  // Le chef : le premier monstre, s'il a un lead actif en siège. Kinki et Windy
  // n'en ont pas : Kinki-Windy-Lulu et Windy-Lulu-Kinki font une seule défense.
  // Solveig et Odin en ont un : en chef, deux défenses.
  const equipe = (...l: [string, string][]) => ({ monsters: l.map(([nom, el]) => ({ com2usId: c2u(nom, el), name: nom })), note: '' });
  const kwl = equipe(['Kinki', 'light'], ['Windy', 'wind'], ['Lulu', 'water']);
  const wlk = equipe(['Windy', 'wind'], ['Lulu', 'water'], ['Kinki', 'light']);
  const sao = equipe(['Solveig', 'fire'], ['Adriana', 'water'], ['Odin', 'wind']);
  const oas = equipe(['Odin', 'wind'], ['Adriana', 'water'], ['Solveig', 'fire']);
  const deckContre = (contre: object) => ({ ...RECOS.recos[0].decks[1], counters: [contre] });
  const chefs = rendreRecos({ recos: [{ ...RECOS.recos[0], decks: [kwl, wlk, sao, oas].map(deckContre) }] });
  egal((chefs.match(/data-defense-liste/g) ?? []).length, 3, 'chef : Kinki-Windy-Lulu et Windy-Lulu-Kinki réunies, Solveig et Odin en chef séparées');
  ok(texteVisible(volet(chefs)).includes('Kinki - Windy - Lulu'), 'la défense réunie, la plus jouée, s\'ouvre la première, dans l\'ordre de sa première saisie');
}

// La fiabilité d'un deck contre une défense : des étoiles de 0 à 5, saisies
// par étoile entière, notables depuis la ligne d'un deck ; en vue Défenses, la
// plus fiable passe d'abord quand on range par fiabilité.
export function testRenduRecosFiabilite() {
  titre('rendu · Siège · Recommandations — la fiabilité d\'un deck contre une défense');
  const r = RECOS.recos[0];
  const defense = r.decks[0].counters[0];
  // Les deux decks battent la même défense : le premier à 2, le second à 4,5
  // (une note d'avant, en demi-étoile, toujours relue).
  const etat = {
    recos: [{
      ...r,
      decks: [
        { ...r.decks[0], counters: [{ ...defense, fiabilite: 2 }] },
        { ...r.decks[1], counters: [{ ...defense, note: '', fiabilite: 4.5 }] },
      ],
    }],
  };

  // Vue Défenses : par reco, l'ordre des decks ; par fiabilité, la plus fiable
  // d'abord. Les étoiles et leur couleur.
  egal(valeurs(volet(rendreRecos(etat)), 'data-fiabilite'), ['2', '4.5'], 'par reco : dans l\'ordre de la recommandation');
  const parFiabilite = volet(rendreRecos(etat, 'defense', { 'recos.tri': 'fiabilite' }));
  egal(valeurs(parFiabilite, 'data-fiabilite'), ['4.5', '2'], 'par fiabilité : la plus fiable d\'abord');
  ok(/data-fiabilite="4.5"[\s\S]*?text-good/.test(parFiabilite) && /data-fiabilite="2"[\s\S]*?text-warn/.test(parFiabilite), 'couleur : vert à 4,5, jaune à 2');
  ok(valeurs(parFiabilite, 'aria-label').includes('Noter la fiabilité contre cette défense'), 'la fiabilité se note depuis la ligne de l\'offense');

  // Vue Decks, decks ouverts : la fiabilité sur la ligne et sur la vignette de
  // la défense (la fiabilité passe par la relecture du stockage).
  const decks = rendreDecksOuverts(undefined, etat);
  egal(valeurs(decks, 'aria-label').filter((v) => v.startsWith('Fiabilité ')),
    ['Fiabilité 2 sur 5', 'Fiabilité 2 sur 5', 'Fiabilité 4,5 sur 5', 'Fiabilité 4,5 sur 5'],
    'vue Decks : chaque deck porte la fiabilité de sa défense, sur sa ligne et sur la vignette');
  ok(!rendreDecksOuverts().includes('data-fiabilite='), 'une défense non notée n\'affiche aucune étoile');

  // La saisie : cinq étoiles entières, « − », « + », « × ».
  const choix = (note: number | undefined) => rendre(<ChoixFiabilite note={note} onChange={() => {}} />);
  const vide = choix(undefined);
  ok(texteVisible(vide).includes('Fiabilité') && texteVisible(vide).includes('Non notée'), 'saisie : « Non notée » par défaut');
  egal(boutons(vide).filter((b) => b.ariaLabel?.startsWith('Noter ')).map((b) => b.ariaLabel),
    ['1', '2', '3', '4', '5'].map((n) => `Noter ${n} sur 5`), 'saisie : une cible par étoile entière, de 1 à 5');
  const etatBoutons = (h: string) => ['Une étoile de moins', 'Une étoile de plus', 'Retirer la note'].map((n) => !!bouton(h, n)?.desactive);
  egal(etatBoutons(vide), [true, false, true], 'non notée : « − » et « × » désactivés, « + » actif');
  egal(etatBoutons(choix(5)), [false, true, false], 'à 5 : « + » désactivé');
  egal(etatBoutons(choix(0)), [true, false, false], 'à 0 : « − » désactivé, 0 reste une note (« × » actif)');
  ok(texteVisible(choix(3.5)).includes('3,5 / 5'), 'une note d\'avant en demi-étoile s\'écrit telle quelle');
  ok(!texteVisible(rendre(<ChoixFiabilite note={3} onChange={() => {}} sansValeur />)).includes('3 / 5'), 'dans une liste de défenses : sans la note écrite');
}

// Une recommandation de CENTAINES de decks (un lot de salon Discord) : une page
// à la fois, dans le volet comme en vue Défenses. Les rendre tous figeait la page.
export function testRenduRecosGrosLot() {
  titre('rendu · Siège · Recommandations — un lot de 700 decks, paginé');
  const n = 700;
  const lot = { recos: [{ ...RECOS.recos[0], decks: Array.from({ length: n }, () => RECOS.recos[0].decks[1]) }] };

  const html = rendreCarte(false, undefined, lot);
  egal(nomme(html, 'Éditer ce deck').length, 20, 'le volet : 20 decks rendus sur 700');
  egal((texteVisible(html).match(/1–20 sur 700/g) ?? []).length, 2, 'la plage « 1–20 sur 700 », en haut et en bas des decks');
  ok(boutons(html).some((b) => b.ariaLabel === 'Page suivante' && !b.desactive), 'la pagination : « Page suivante »');
  ok(valeurs(html, 'aria-label').includes('Aller à la page'), 'la pagination : aller directement à une page');
  ok(texteVisible(html).includes('/ 35'), '35 pages');
  ok(texteVisible(html).includes('Déplier tous les decks'), '« Déplier tous les decks » reste');

  // Vue Défenses : ce lot n'a aucune défense visée — « Sans défense visée » se
  // pagine lui aussi.
  const defense = rendreRecos(lot);
  egal((volet(defense).match(/data-deck-ligne=/g) ?? []).length, 20, 'vue Défenses : 20 offenses rendues sur 700');
  ok(texteVisible(defense).includes('Sans défense visée 700 decks ne visent aucune défense'), 'vue Défenses : les decks sans défense visée');
  ok(texteVisible(defense).includes('1–20 sur 700'), 'vue Défenses : la plage');

  // Confronté : le bilan, en filtres au-dessus des decks ; toujours 20 decks.
  const aComposer = { status: 'nodeck', slots: [], okCount: 0, filled: 3, team: null, copies: null };
  const match = { status: 'partial', decks: Array.from({ length: n }, () => aComposer), okDecks: 0, totalDecks: n } as unknown as RecoMatch;
  const confronte = rendreCarte(false, undefined, lot, match);
  ok(/data-bilan-analyse/.test(confronte), 'confronté : le bilan au-dessus des decks');
  egal(nomme(confronte, 'Éditer ce deck').length, 20, 'confronté : 20 decks rendus sur 700');

  // Une recommandation ordinaire n'a pas de pagination.
  ok(!/sur 2\b/.test(texteVisible(rendreCarte())), 'deux decks : aucune pagination');
}

// Raccourci « Tick rapide / Tick lent » dans la saisie de la VIT d'un deck :
// la VIT de FICHE qui tombe pile sur le tick, totem et lead du deck compris.
// Rien n'est stocké d'autre que la VIT : le bouton s'allume d'après elle.
export function testRenduRecosTicks() {
  titre('rendu · Siège · Recommandations — ticks Rapide / Lent en édition');
  const monstre = (nom: string, el: string) => MONSTRES.find((m) => m.com2usId === c2u(nom, el))!;
  const veromos = monstre('Veromos', 'dark');
  // Un lead de vitesse de 24 % : il entre dans la VIT proposée.
  const rapide = ficheSpeedForTick(veromos.stats.speed, 24, 286)!;
  const lent = ficheSpeedForTick(veromos.stats.speed, 24, 239)!;
  const editeur = (extra: object) =>
    rendre(
      <StatEditor
        slot={{ ...slot('Veromos', 'dark', extra), artifacts: { element: [], archetype: [] } } as RecoSlot}
        monster={veromos}
        lead={24}
        onSet={() => {}}
      />
    );
  const tick = (html: string, nom: string) => boutons(html).find((b) => b.texte === nom)!;

  // VIT vide : les deux ticks proposés, éteints, avec la VIT qu'ils mettront.
  const vide = editeur({});
  ok(!!tick(vide, 'Tick rapide') && !!tick(vide, 'Tick lent'), '« Tick rapide » et « Tick lent » sous la VIT');
  egal(tick(vide, 'Tick rapide').title, `Mettre la VIT à ${rapide} : tick 286 en combat, totem et lead compris`, 'Rapide : la VIT proposée, lead compris');
  egal(tick(vide, 'Tick lent').title, `Mettre la VIT à ${lent} : tick 239 en combat, totem et lead compris`, 'Lent : la VIT proposée, lead compris');
  ok(tick(vide, 'Tick rapide').presse === false && !tick(vide, 'Tick rapide').desactive, 'VIT vide : éteint, cliquable');

  // +3 pour passer devant un autre monstre au même tick : toujours allumé.
  const devant = editeur({ stats: { spd: rapide + 3 } });
  ok(tick(devant, 'Tick rapide').presse === true, 'au tick rapide +3 : « Tick rapide » reste allumé');
  ok(tick(devant, 'Tick lent').presse === false, '… et « Tick lent » éteint');
  // Au-delà de la marge de 15, on n'est plus « sur » le tick.
  ok(tick(editeur({ stats: { spd: rapide + 16 } }), 'Tick rapide').presse === false, 'tick dépassé de 16 : éteint');

  // Toutes les possibilités de runage en Swift : il se speed tune.
  const swift = editeur({ setOptions: [['swift', 'energy'], ['swift', 'will']] });
  ok(
    tick(swift, 'Tick rapide').desactive && tick(swift, 'Tick rapide').title === 'Runage Rapide : il se speed tune, il ne vise pas de tick',
    'Swift partout : désactivé, et pourquoi'
  );
  ok(!tick(editeur({ setOptions: [['swift', 'energy'], ['violent', 'will']] }), 'Tick rapide').desactive, 'une option sans Swift suffit : actif');
}

// La saisie des stats d'un deck : PV, ATQ, DEF et VIT en base + bonus (le
// « + » devant le champ) ; Taux Crit, Dmg Crit, RES et Précision en total,
// sans base rappelée ni « + ».
export function testRenduRecosStatsEnTotal() {
  titre('rendu · Siège · Recommandations — saisie des stats, bonus ou total');
  const veromos = MONSTRES.find((m) => m.com2usId === c2u('Veromos', 'dark'))!;
  const html = rendre(
    <StatEditor
      slot={{ ...slot('Veromos', 'dark', { stats: { spd: 200, cr: 60 } }), artifacts: { element: [], archetype: [] } } as RecoSlot}
      monster={veromos}
      lead={0}
      onSet={() => {}}
    />
  );
  const ligne = (cle: string) => html.split(`data-stat-reco="${cle}"`)[1]?.split('data-stat-reco=')[0] ?? '';
  const plus = (cle: string) => />\+<\/span>/.test(ligne(cle));
  const avecPlus = ['hp', 'atk', 'def', 'spd'].filter(plus), sansPlus = ['cr', 'cd', 'res', 'acc'].filter((c) => ligne(c) && !plus(c));
  egal(avecPlus, ['hp', 'atk', 'def', 'spd'], 'PV, ATQ, DEF et VIT : le « + » d’un bonus sur la base');
  egal(sansPlus, ['cr', 'cd', 'res', 'acc'], 'Taux Crit, Dmg Crit, RES et Précision : pas de « + », le champ vaut le total');
  ok(/value="60"/.test(ligne('cr')) && ligne('cr').includes('= 60'), 'Taux Crit 60 saisi : le champ et le total écrivent 60');
}

// « Annuler les modifications » : en édition seulement, à côté du ✓, grisé
// tant que rien n'a changé. Le rendu serveur ne clique pas : on vérifie la
// PRÉSENCE et l'état à l'ouverture, la règle elle-même est testée dans
// annuler-edition.test.ts.
export function testRenduRecosAnnulerEdition() {
  titre('rendu · Siège · Recommandations — annuler une édition');
  // Les boutons VISIBLES : la ligne d'un deck réserve la place d'« Annuler »
  // hors édition, par un bouton invisible et masqué au lecteur d'écran.
  const reserves = (html: string) => [...html.matchAll(/<button\b[^>]*aria-hidden="true"[^>]*aria-label="Annuler les modifications"|<button\b[^>]*aria-label="Annuler les modifications"[^>]*aria-hidden="true"/g)].length;
  const annuler = (html: string) => boutons(html.replace(/<button\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/button>/g, '')).filter((b) => b.ariaLabel === 'Annuler les modifications');

  // Hors édition : aucun bouton d'annulation visible, mais sa place réservée
  // sur chaque deck (aucun bouton ne bouge quand l'édition s'ouvre).
  const ferme = rendreCarte();
  egal(annuler(ferme).length, 0, 'hors édition : pas de « Annuler les modifications »');
  ok(reserves(ferme) > 0 && /invisible/.test(ferme), 'hors édition : la place d\'« Annuler » est réservée sur la ligne du deck');

  // Recommandation en édition : un bouton, grisé (rien n'a encore changé).
  const reco = annuler(rendreCarte(true));
  egal(reco.length, 1, 'recommandation en édition : « Annuler les modifications » dans son en-tête');
  ok(reco[0]?.desactive === true, '… grisé tant que rien n’a changé');

  // Une recommandation tout juste créée ouvre AUSSI son deck vide en édition :
  // deux boutons, celui de la recommandation et celui du deck.
  const neuve = {
    recos: [{ id: 'n', origin: 'mine', name: '', author: '', note: '', decks: [{ name: '', note: '', slots: [null, null, null].map(() => ({ com2usId: null, name: '', stats: {}, setOptions: [[]], artifacts: { element: [], archetype: [] } })), counters: [] }] }],
  };
  const deux = annuler(rendreCarte(true, undefined, neuve));
  egal(deux.length, 2, 'deck neuf en édition : un bouton pour la recommandation, un pour le deck');
  ok(deux.every((b) => b.desactive), '… tous deux grisés à l’ouverture');
}
