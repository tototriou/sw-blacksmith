// Tests de rendu — l'accueil « vitrine » (`HomePage`). Principe dans
// tests/rendu/outils-rendu.tsx : on vérifie que chaque fonctionnalité et chaque
// information sont présentes, jamais l'apparence : un changement de style
// doit les laisser verts sans qu'une assertion change.
// ⚠️ Les textes viennent du DICTIONNAIRE (`fr`) : le mainteneur les retouche à
// la main, le test vérifie qu'ils sont affichés, pas leur formulation.

import HomePage, { HomeStats } from '../../src/pages/HomePage';
import { RELEASES, libelleVersion } from '../../src/data/releases';
import { LIEN_DISCORD, NOM_APP } from '../../src/marque';
import { fr } from '../../src/i18n/fr';
import type { Monster } from '../../src/types';
import { egal, monstersJson, ok, titre } from '../outils';
import { bouton, rendre, texteVisible } from './outils-rendu';

const VIDE: HomeStats = { rta: 0, defense: 0, offense: 0, recos: 0 };
const MONSTRES = monstersJson() as Monster[];
const a = fr.accueil;
const v = a.vitrine;

function rendreAccueil(stats: HomeStats, monstres: Monster[] = []): string {
  return rendre(<HomePage stats={stats} onImport={() => {}} monstres={monstres} />);
}

// Chaque lien : sa destination et ce qu'il dit.
function liens(html: string): { href: string; texte: string; nouvelOnglet: boolean }[] {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, contenu]) => ({
    href: attrs.match(/\shref="([^"]*)"/)?.[1] ?? '',
    texte: texteVisible(contenu),
    nouvelOnglet: /\starget="_blank"/.test(attrs),
  }));
}

// Dans le bureau (Electron) : le pont posé, le temps du rendu.
function dansLeBureau<T>(f: () => T): T {
  const pont = globalThis as { swblacksmithBureau?: unknown };
  pont.swblacksmithBureau = { bureau: true, plateforme: 'win32' };
  try {
    return f();
  } finally {
    delete pont.swblacksmithBureau;
  }
}

export function testRenduAccueil() {
  titre('rendu · Accueil — ce que la page dit et permet');

  const html = rendreAccueil(VIDE);
  const t = texteVisible(html);
  const tous = liens(html);
  // `texteVisible` rend l'espace insécable (« Summoners War ») en espace simple.
  const ordinaire = (s: string) => s.replace(/[  ]/g, ' ').trim();

  // Héros : le nom, l'accroche, la promesse, les actions.
  for (const s of [NOM_APP, a.accroche, `${a.promesse}${a.promesseNavigateur}`]) ok(t.includes(ordinaire(s)), `héros : « ${ordinaire(s)} »`);
  ok(!!bouton(html, a.importerMonCompte), `bouton « ${a.importerMonCompte} »`);
  ok(tous.some((l) => l.href === '#/telecharger' && l.texte === v.application && !l.nouvelOnglet), `« ${v.application} » → #/telecharger`);
  ok(t.indexOf(ordinaire(a.accroche)) < t.indexOf(a.importerMonCompte) && t.indexOf(a.importerMonCompte) < t.indexOf(a.deposerIci), 'héros : le texte, les actions, puis la zone de dépôt');

  // Zone de dépôt : un bouton (clavier compris), ses textes, son champ fichier.
  ok(/role="button"[^>]*tabindex="0"|tabindex="0"[^>]*role="button"/.test(html), 'zone de dépôt : role="button", atteignable au clavier');
  for (const s of [a.deposerIci, a.cliquerPourParcourir, a.exportSwex, a.luDansLaPage]) ok(t.includes(s), `zone de dépôt : « ${s} »`);
  egal((html.match(/<input[^>]*type="file"[^>]*accept=".json,application\/json"/g) ?? []).length, 2, 'deux sélecteurs de fichier .json (zone de dépôt, boutons d’import)');
  const exporter = tous.find((l) => l.texte === v.swExporter);
  ok(exporter?.href === 'https://github.com/Xzandro/sw-exporter' && exporter.nouvelOnglet, 'sous la zone de dépôt : SW Exporter, dans un nouvel onglet');

  // « Ton espace » : absent sans données locales.
  ok(!t.includes(a.tonEspace), 'sans données locales, pas de « Ton espace »');

  // Les outils montrés : le titre de la section, puis chacun, dans l'ordre.
  ok(t.includes(`${v.outilsTitre} ${v.outilsAccent}`) && t.includes(v.outilsChapeau), 'titre et chapeau des outils');
  const OUTILS: [keyof typeof v.outils, string][] = [['rta', '#/rta'], ['recos', '#/siege/recommandations'], ['optimizer', '#/outils/optimizer'], ['speed', '#/outils/speed-tuning']];
  let avant = -1;
  for (const [cle, href] of OUTILS) {
    const o = v.outils[cle];
    ok(t.includes(o.titre) && t.includes(o.texte) && o.puces.every((p) => t.includes(p)), `outil « ${o.titre} » : titre, phrase, puces`);
    ok(tous.some((l) => l.href === href && l.texte === o.aller), `outil « ${o.titre} » : « ${o.aller} » → ${href}`);
    ok(t.indexOf(o.titre) > avant, `outil « ${o.titre} » à sa place`);
    avant = t.indexOf(o.titre);
  }
  // Sans les données du jeu : aucun exemple, plutôt qu'un exemple faux.
  ok(!html.includes('data-exemple'), 'sans les données du jeu : aucun exemple');

  // Les autres outils, en pastilles, dans l'ordre de la navigation.
  const PASTILLES = ['#/rta/ami', '#/siege/defense', '#/compte/runes', '#/compte/artefacts', '#/compte/equipes', '#/bestiary', '#/mecaniques', '#/telecharger', '#/arene'];
  const autres = tous.filter((l) => PASTILLES.includes(l.href) && l.texte !== v.application).map((l) => l.href);
  egal(autres, PASTILLES, 'les autres outils, en pastilles, dans l’ordre');
  ok(tous.some((l) => l.href === '#/arene' && l.texte === `${a.cartes.arene.titre}${a.bientot}`), 'l’Arène, marquée « bientôt »');

  // La communauté : le Discord, la dernière version PUBLIÉE, le code.
  ok(t.includes(`${v.commuTitre} ${v.commuAccent}`), 'titre de la communauté');
  ok(t.includes(v.discordTitre(NOM_APP)) && t.includes(a.carteDiscord.texte), 'carte Discord : à quoi sert le serveur');
  const derniere = RELEASES.find((r) => r.version !== null) ?? RELEASES[0];
  ok(t.includes(`${libelleVersion(derniere.version, 'En préparation')} · ${derniere.title}`), 'carte des nouveautés : la dernière version publiée');
  ok(tous.some((l) => l.href === '#/releases' && l.texte === a.voirNouveautes), `« ${a.voirNouveautes} » → #/releases`);
  ok(tous.some((l) => l.href.startsWith('https://github.com/') && l.texte === v.voirGithub && l.nouvelOnglet), 'le code, sur GitHub, dans un nouvel onglet');

  // Le dernier appel : le titre, la phrase, le bouton qui IMPORTE.
  ok(t.includes(a.pretTitre) && t.includes(a.pretTexte), 'dernier appel : titre et phrase');
  egal(t.split(a.importerMonCompte).length - 1, 2, 'deux boutons « Importer mon compte » : le héros, le dernier appel');
}

// Les exemples : les VRAIS composants des outils, sur les équipes de démo.
export function testRenduAccueilExemples() {
  titre('rendu · Accueil — les exemples, vrais composants des outils');
  const html = rendreAccueil(VIDE, MONSTRES);
  for (const cle of ['rta', 'recos', 'optimizer', 'speed']) ok(html.includes(`data-exemple="${cle}"`), `exemple « ${cle} » affiché`);
  const bloc = (cle: string) => {
    const i = html.indexOf(`data-exemple="${cle}"`);
    return texteVisible(html.slice(i, html.indexOf('data-exemple=', i + 20) > 0 ? html.indexOf('data-exemple=', i + 20) : undefined));
  };
  const rta = bloc('rta');
  ok(['Lora', 'Son Zhang Lao', 'Yeonhong', 'Woonsa', 'Han'].every((n) => rta.includes(n)), 'RTA : l’ordre de tour des cinq nat 5★ lumière et ténèbres');
  const recos = bloc('recos');
  ok(recos.includes(v.outils.recos.nom) && recos.includes(`par ${v.outils.recos.auteur}`), 'recommandation : son nom, son auteur');
  ok(html.includes('Maximilian') && html.includes('Lamiella') && html.includes('Odin'), 'recommandation : les decks choisis');
  const optimizer = bloc('optimizer');
  ok(optimizer.includes('#1') && optimizer.includes('#2') && optimizer.includes('Woonsa'), 'Optimizer : la grille de résultats, deux places');
  const speed = bloc('speed');
  ok(speed.includes(fr.speedTuning.ordreDeTour) && speed.includes(fr.speedTuning.barres.titre), 'speed tuning : l’ordre de tour et la barre d’action');
  // Inertes : aucun geste ne part des exemples (posé au montage, voir ExemplesAccueil).
  ok(html.includes('select-none'), 'les exemples ne se sélectionnent pas');
}

// Application de bureau : sur le SITE, le lien vers « Télécharger » ; dans
// l'app, rien.
export function testRenduAccueilBureau() {
  titre('rendu · Accueil — le lien vers « Télécharger »');
  ok(liens(rendreAccueil(VIDE)).filter((l) => l.href === '#/telecharger').length === 2, 'sur le site : le bouton du héros et la pastille');
  const app = dansLeBureau(() => rendreAccueil(VIDE));
  ok(!liens(app).some((l) => l.href === '#/telecharger'), 'dans l’app de bureau : ni bouton ni pastille');
}

// Le serveur Discord de l'app : un bouton dans le héros et la carte de la
// communauté — sur le site comme dans l'application de bureau. Toujours dans
// un nouvel onglet.
export function testRenduAccueilDiscord() {
  titre('rendu · Accueil — le lien vers le Discord de l\'app');
  const verifier = (html: string, ou: string) => {
    const t = texteVisible(html);
    egal(liens(html).filter((l) => l.href === LIEN_DISCORD).map((l) => [l.texte, l.nouvelOnglet]), [
      [a.rejoindreDiscord, true],
      [a.rejoindreDiscord, true],
    ], `${ou} : le bouton du héros et celui de la communauté, dans un nouvel onglet`);
    ok(t.indexOf(a.rejoindreDiscord) < t.indexOf(a.deposerIci), `${ou} : le premier dans le héros, avant la zone de dépôt`);
    egal((html.match(/data-logo="discord"/g) ?? []).length, 3, `${ou} : le logo de Discord sur chaque bouton et dans la carte`);
  };
  verifier(rendreAccueil(VIDE), 'site');
  verifier(dansLeBureau(() => rendreAccueil(VIDE)), 'application de bureau');
}

export function testRenduAccueilEspace() {
  titre('rendu · Accueil — « Ton espace » avec des données locales');

  const html = rendreAccueil({ rta: 12, defense: 1, offense: 0, recos: 3 });
  const t = texteVisible(html);
  ok(t.includes('Ton espace'), 'titre « Ton espace »');

  // Chaque tuile : sa sous-section exacte, son libellé, le chiffre et l'unité
  // accordée ; une valeur à 0 est AFFICHÉE (atténuée, pas masquée).
  const TUILES: [string, string, string][] = [
    ['#/rta', 'Prépa RTA', '12 monstres'],
    ['#/siege/defense', 'Défense de siège', '1 équipe'],
    ['#/siege/offense', 'Offense de siège', '0 équipe'],
    ['#/siege/recommandations', 'Recommandations', '3 recos'],
  ];
  const tous = liens(html);
  for (const [href, libelle, valeur] of TUILES)
    ok(tous.some((l) => l.href === href && l.texte === `${libelle} ${valeur}`), `tuile « ${libelle} » → ${href} : « ${valeur} »`);

  // Une seule donnée suffit à faire apparaître le bloc.
  ok(texteVisible(rendreAccueil({ ...VIDE, recos: 1 })).includes('Ton espace'), 'une seule reco suffit à afficher « Ton espace »');
  ok(texteVisible(rendreAccueil({ ...VIDE, recos: 1 })).includes('1 reco'), 'unité au singulier : « 1 reco »');
}
