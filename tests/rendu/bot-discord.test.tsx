// Tests de rendu — la page « Bot Discord » (`#/bot-discord`) et ses captures.
// Principe dans tests/rendu/outils-rendu.tsx : ce que la page dit et permet,
// jamais l'apparence.

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import BotDiscordPage from '../../src/pages/BotDiscordPage';
import { CorpsInstallation } from '../../src/components/siege/discord/DialoguesDiscord';
import { setChoixLangue } from '../../src/hooks/useLangue';
import {
  CAPTURES_BOT,
  COMMANDES_BOT,
  ETAPES_ADMIN,
  ETAPES_INSTALLATION,
  ETAPES_MEMBRES,
  ONGLETS_BOT,
  cheminCapture,
  ongletBotValide,
  type NomCapture,
} from '../../src/lib/botDiscord';
import { LANGUES } from '../../src/i18n';
import { fr } from '../../src/i18n/fr';
import { en } from '../../src/i18n/en';
import { LIEN_DISCORD } from '../../src/marque';
import { egal, ok, titre } from '../outils';
import { boutons, rendre, texteVisible } from './outils-rendu';

const racine = process.cwd();

// Largeur et hauteur d'un PNG, lues dans son en-tête IHDR.
function taillePng(chemin: string): { largeur: number; hauteur: number } {
  const o = readFileSync(chemin);
  ok(o.subarray(1, 4).toString('latin1') === 'PNG', `${chemin} : un PNG`);
  return { largeur: o.readUInt32BE(16), hauteur: o.readUInt32BE(20) };
}

export function testBotDiscordCaptures() {
  titre('Bot Discord — chaque capture existe, aux dimensions écrites');
  for (const [nom, c] of Object.entries(CAPTURES_BOT) as [NomCapture, (typeof CAPTURES_BOT)[NomCapture]][]) {
    const formats = c.sorte === 'app'
      ? ([['ordinateur', c.ordinateur], ['telephone', c.telephone]] as const)
      : ([['ordinateur', c.taille]] as const);
    for (const langue of LANGUES)
      for (const [format, taille] of formats) {
        const chemin = resolve(racine, 'public', cheminCapture(nom, langue, format));
        ok(existsSync(chemin), `${nom} (${langue}, ${format}) : le fichier existe`);
        if (existsSync(chemin)) egal(taillePng(chemin), taille, `${nom} (${langue}, ${format}) : dimensions écrites = celles du fichier`);
      }
    if (c.sorte === 'app') ok(cheminCapture(nom, 'fr') !== cheminCapture(nom, 'en'), `${nom} : une capture par langue`);
    else egal(cheminCapture(nom, 'fr'), cheminCapture(nom, 'en'), `${nom} : la même capture dans chaque langue`);
    ok(fr.botDiscord.captures[nom].length > 0 && en.botDiscord.captures[nom].length > 0, `${nom} : un texte de remplacement dans chaque langue`);
  }
  // Une capture rangée sert à une étape au moins : pas de fichier orphelin.
  const utilisees = new Set<NomCapture>([
    ...[...ETAPES_INSTALLATION, ...ETAPES_ADMIN, ...ETAPES_MEMBRES].flatMap((e) => (e.capture ? [e.capture] : [])),
    ...COMMANDES_BOT.flatMap((c) => Object.values(c.captures).filter((x): x is NomCapture => !!x)),
  ]);
  egal(Object.keys(CAPTURES_BOT).filter((n) => !utilisees.has(n as NomCapture)), [], 'chaque capture sert à une étape');
}

const images = (html: string) =>
  [...html.matchAll(/<img\b([^>]*)>/g)].map(([, a]) => ({
    src: a.match(/\ssrc="([^"]*)"/)?.[1] ?? '',
    alt: texteVisible(a.match(/\salt="([^"]*)"/)?.[1] ?? ''),
    largeur: a.match(/\swidth="([^"]*)"/)?.[1],
    hauteur: a.match(/\sheight="([^"]*)"/)?.[1],
  }));
function enAnglais<T>(f: () => T): T {
  setChoixLangue('en');
  try {
    return f();
  } finally {
    setChoixLangue('auto');
  }
}

const sources = (html: string) => [...html.matchAll(/<source\b([^>]*)>/g)].map(([, a]) => a.match(/\ssrcSet="([^"]*)"/i)?.[1] ?? '');

// Chaque capture affichée : à sa place réservée, avec son texte de remplacement.
function capturesAffichees(html: string, attendues: NomCapture[], quoi: string) {
  const imgs = images(html);
  egal(imgs.length, attendues.length, `${quoi} : une image par capture prévue`);
  for (const nom of attendues) {
    const i = imgs.find((x) => x.src.endsWith(cheminCapture(nom, 'fr')));
    ok(!!i && !!i.largeur && !!i.hauteur, `${quoi} · ${nom} : affichée, largeur et hauteur écrites`);
    ok(i?.alt === fr.botDiscord.captures[nom], `${quoi} · ${nom} : son texte de remplacement`);
  }
}

// Les onglets de la page, et celui qui est ouvert.
const ongletsRendus = (html: string) =>
  [...html.matchAll(/<button\b([^>]*role="tab"[^>]*)>([\s\S]*?)<\/button>/g)].map(([, a, contenu]) => ({
    texte: texteVisible(contenu.replace(/<span[^>]*data-reserve-onglet[\s\S]*?<\/span>/, '')),
    ouvert: /aria-selected="true"/.test(a),
  }));

export function testRenduBotDiscordOnglets() {
  titre('rendu · Bot Discord — trois onglets, celui de l\'adresse ouvert');
  for (const onglet of ONGLETS_BOT) {
    const html = rendre(<BotDiscordPage onglet={onglet} />);
    const t = texteVisible(html);
    ok(t.startsWith('Bot Discord'), `${onglet} : le titre « Bot Discord »`);
    egal(ongletsRendus(html), ONGLETS_BOT.map((o) => ({ texte: fr.botDiscord.onglets[o], ouvert: o === onglet })),
      `${onglet} : Installation, Recommandations, Commandes — « ${fr.botDiscord.onglets[onglet]} » ouvert`);
    ok(html.includes(`data-onglet-bot="${onglet}"`), `${onglet} : son contenu, et lui seul`);
    ok(html.includes(`href="${LIEN_DISCORD}"`) && /target="_blank"/.test(html), `${onglet} : le Discord de l'app, dans un nouvel onglet`);
  }
  egal(ongletBotValide(undefined), 'installation', '#/bot-discord sans onglet : l\'installation');
  egal(ongletBotValide('inconnu'), 'installation', 'un onglet inconnu : l\'installation');
}

export function testRenduBotDiscordInstallation() {
  titre('rendu · Bot Discord — Installation');
  const b = fr.botDiscord.installation;
  const html = rendre(<BotDiscordPage onglet="installation" />);
  const t = texteVisible(html);
  for (const a of b.atouts) ok(t.includes(a.titre), `ce qu'il faut savoir : « ${a.titre} »`);
  ok(t.includes('Gérer le serveur'), 'le droit qu\'il faut pour inviter le bot');
  ok(boutons(html).some((x) => x.texte === 'Inviter le bot'), 'le bouton « Inviter le bot »');
  egal(ETAPES_INSTALLATION.map((e) => t.includes(b.etapes[e.cle].titre)), ETAPES_INSTALLATION.map(() => true), 'inviter, ses commandes, ses salons');
  for (const d of b.depannage) ok(t.includes(d.probleme), `dépannage : « ${d.probleme} »`);
  ok(t.includes('Réinvite-le par « Inviter le bot »'), 'des commandes absentes : réinviter le bot, qui reste sur le serveur');
  capturesAffichees(html, ETAPES_INSTALLATION.flatMap((e) => (e.capture ? [e.capture] : [])), 'installation');
}

export function testRenduBotDiscordRecommandations() {
  titre('rendu · Bot Discord — Recommandations');
  const b = fr.botDiscord;
  const html = rendre(<BotDiscordPage onglet="recommandations" />);
  const t = texteVisible(html);
  for (const a of b.recos.atouts) ok(t.includes(a.titre), `ce qu'il faut savoir : « ${a.titre} »`);
  for (const e of Object.values(b.etapesAdmin)) ok(t.includes(e.titre), `les salons : « ${e.titre} »`);
  for (const d of ['Voir le salon', 'Voir les anciens messages', 'Envoyer des messages', 'Joindre des fichiers'])
    ok(t.includes(d), `les quatre droits, sous leur nom dans Discord : « ${d} »`);
  for (const e of Object.values(b.etapesMembres)) ok(t.includes(e.titre), `côté membres : « ${e.titre} »`);
  for (const d of b.depannageRecos) ok(t.includes(d.probleme), `dépannage : « ${d.probleme} »`);
  const captures = [...ETAPES_ADMIN, ...ETAPES_MEMBRES].flatMap((e) => (e.capture ? [e.capture] : []));
  capturesAffichees(html, captures, 'recommandations');
  // Au téléphone, les captures de l'app prises dans sa disposition.
  egal(sources(html).map((s) => s.replace(/^.*bot-discord\//, '')),
    captures.filter((c) => CAPTURES_BOT[c].sorte === 'app').map((c) => `fr/${c}-telephone.png`),
    'au téléphone : les captures prises dans sa disposition');
  egal(html.split(b.capturesEnAnglais).length - 1, 1, 'en français : « Captures de Discord en anglais » sous le message du bot');
}

export function testRenduBotDiscordCommandes() {
  titre('rendu · Bot Discord — Commandes');
  const c = fr.botDiscord.commandes;
  const html = rendre(<BotDiscordPage onglet="commandes" />);
  const t = texteVisible(html);
  ok(t.includes(c.intro), 'comment lancer une commande');
  for (const cmd of COMMANDES_BOT) {
    const textes = c.liste[cmd.cle];
    ok(html.includes(`data-commande-bot="${cmd.cle}"`) && t.includes(textes.nom), `${textes.nom} : sa section`);
    // Une capture est facultative ; celle qui existe désigne une étape réelle.
    for (const n of Object.keys(cmd.captures).map(Number))
      ok(Number.isInteger(n) && n >= 1 && n <= textes.etapes.length, `${textes.nom} : la capture de l'étape ${n} désigne une étape qui existe`);
    for (const e of textes.etapes) ok(t.includes(e.titre), `${textes.nom} : « ${e.titre} »`);
  }
  ok(t.includes('/speedtune En essai'), '/speedtune, marquée « En essai »');
  capturesAffichees(html, COMMANDES_BOT.flatMap((cmd) => Object.values(cmd.captures).filter((x): x is NomCapture => !!x)), 'commandes');
  // L'étape 2 de /speedtune n'a pas de capture : rien ne la remplace.
  const etape2 = html.split('Réponds à ses questions')[1]?.split('</li>')[0] ?? '';
  ok(!etape2.includes('<img'), '/speedtune : une étape sans capture n\'en montre aucune');
  // La capture du jeu n'est pas une capture de Discord : rien à dire sous elle.
  egal(html.split(fr.botDiscord.capturesEnAnglais).length - 1, 1, 'en français : la précision sous la réponse du bot seulement');
}

export function testRenduBotDiscordAnglais() {
  titre('rendu · Bot Discord — en anglais');
  const [recos, installation] = enAnglais(() => [
    rendre(<BotDiscordPage onglet="recommandations" />),
    rendre(<BotDiscordPage onglet="installation" />),
  ]);
  const t = texteVisible(recos);
  ok(t.startsWith('Discord bot') && t.includes('Set up the channels') && t.includes('Read Message History'), 'la page en anglais, avec les noms anglais des droits');
  ok(texteVisible(installation).includes('Invite the bot') && ongletsRendus(installation).map((o) => o.texte).join(', ') === 'Installation, Recommendations, Commands',
    'les onglets en anglais');
  ok(images(recos).filter((i) => i.src.includes('bot-discord/en/')).length === 3 && !recos.includes('bot-discord/fr/'), 'les captures de l\'app en anglais');
  ok(!t.includes(en.botDiscord.capturesEnAnglais), 'en anglais : rien à préciser sous les captures de Discord');
}

export function testRenduBotDiscordDepuisRecos() {
  titre('rendu · Bot Discord — le guide d\'installation des recommandations y mène');
  const guide = rendre(<CorpsInstallation onInviter={() => {}} />);
  const lien = [...guide.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].find(([, a]) => a.includes('href="#/bot-discord"'));
  ok(!!lien && texteVisible(lien[2]) === 'Le guide pas à pas, avec captures', '« Le guide pas à pas, avec captures » → #/bot-discord');
  ok(!lien?.[1].includes('target='), 'dans la page, pas dans un nouvel onglet');
}
