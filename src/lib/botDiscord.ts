// Les captures et les étapes de la page « Bot Discord » (`#/bot-discord`).
// Voir docs/02-app/bot-discord/README.md.
//
// ⚠️ **Le dépôt est public** : une capture vient d'un serveur de test, ou d'un
// vrai serveur dont les pseudos et les identifiants Discord sont floutés.
// Celles de l'app sont prises sur un service Discord simulé (« Guilde de
// test », « Membre de test »).
//
// ⚠️ **Les dimensions sont écrites ici** : l'image réserve sa place avant
// d'être chargée, la page ne saute pas pendant la lecture. Un test relit
// chaque fichier et compare.

import type { Dictionnaire } from '../i18n/fr';
import type { Langue } from '../i18n/langue';

export type NomCapture =
  | 'app-connexion'
  | 'app-salons'
  | 'app-salon-choisi'
  | 'message-bot'
  | 'speedtune-capture'
  | 'speedtune-reponse';

interface Taille { largeur: number; hauteur: number }

// Une capture de l'app existe dans chaque langue de l'interface, et au
// téléphone dans sa disposition à lui (une capture d'ordinateur réduite à
// 360 px ne se lirait plus). Une capture de Discord est prise une fois, dans
// un Discord en anglais (la page le dit dans une autre langue) ; une capture
// du jeu, une fois aussi.
export type Capture =
  | { sorte: 'app'; ordinateur: Taille; telephone: Taille }
  | { sorte: 'discord' | 'jeu'; taille: Taille };

export const CAPTURES_BOT: Record<NomCapture, Capture> = {
  'app-connexion': { sorte: 'app', ordinateur: { largeur: 1864, hauteur: 854 }, telephone: { largeur: 716, hauteur: 606 } },
  'app-salons': { sorte: 'app', ordinateur: { largeur: 1864, hauteur: 796 }, telephone: { largeur: 716, hauteur: 550 } },
  'app-salon-choisi': { sorte: 'app', ordinateur: { largeur: 1864, hauteur: 796 }, telephone: { largeur: 716, hauteur: 566 } },
  'message-bot': { sorte: 'discord', taille: { largeur: 533, hauteur: 255 } },
  'speedtune-capture': { sorte: 'jeu', taille: { largeur: 200, hauteur: 72 } },
  'speedtune-reponse': { sorte: 'discord', taille: { largeur: 501, hauteur: 465 } },
};

// Le dossier des captures, sous `public/` : servi tel quel par le site et par
// l'application de bureau.
export const DOSSIER_CAPTURES_BOT = 'bot-discord';

// Le chemin d'une capture, relatif à la racine du site.
export function cheminCapture(nom: NomCapture, langue: Langue, format: 'ordinateur' | 'telephone' = 'ordinateur'): string {
  const c = CAPTURES_BOT[nom];
  if (c.sorte !== 'app') return `${DOSSIER_CAPTURES_BOT}/communes/${nom}.png`;
  return `${DOSSIER_CAPTURES_BOT}/${langue}/${nom}${format === 'telephone' ? '-telephone' : ''}.png`;
}

// Les onglets de la page, dans l'ordre ; le premier est celui de
// `#/bot-discord` sans onglet.
export const ONGLETS_BOT = ['installation', 'recommandations', 'commandes'] as const;
export type OngletBot = (typeof ONGLETS_BOT)[number];
export const ongletBotValide = (v: string | undefined): OngletBot =>
  (ONGLETS_BOT as readonly string[]).includes(v ?? '') ? (v as OngletBot) : 'installation';

// Une étape du guide : sa clé (ses textes sont dans le dictionnaire, sous la
// même clé) et, s'il y a lieu, sa capture. ⚠️ La capture est FACULTATIVE :
// c'est un guide d'utilisation, une étape s'en passe quand le texte suffit.
export interface EtapeBot<K extends string> {
  cle: K;
  capture?: NomCapture;
}

// Les étapes, dans l'ordre. L'administrateur invite le bot, puis met en place
// les salons des recommandations ; les membres s'en servent.
export const ETAPES_INSTALLATION: readonly EtapeBot<'inviter' | 'commandes' | 'salons'>[] = [
  { cle: 'inviter' },
  { cle: 'commandes' },
  { cle: 'salons' },
];
export const ETAPES_ADMIN: readonly EtapeBot<'salon' | 'ajouter' | 'droits' | 'reserver'>[] = [
  { cle: 'salon' },
  { cle: 'ajouter' },
  { cle: 'droits' },
  { cle: 'reserver' },
];
export const ETAPES_MEMBRES: readonly EtapeBot<'connecter' | 'salons' | 'publier' | 'message'>[] = [
  { cle: 'connecter', capture: 'app-connexion' },
  { cle: 'salons', capture: 'app-salons' },
  { cle: 'publier', capture: 'app-salon-choisi' },
  { cle: 'message', capture: 'message-bot' },
];

// Les commandes du bot, dans l'ordre de l'onglet Commandes. Leurs textes, et
// leurs étapes, sont dans le dictionnaire (`commandes.liste.<cle>`) ;
// `captures` donne la capture d'une étape par son NUMÉRO (à partir de 1, comme
// à l'écran) — une étape absente de la table n'en a pas. Une commande de
// plus : une entrée ici, ses textes dans chaque langue, ses captures s'il y en
// a.
export interface CommandeBot {
  cle: keyof Dictionnaire['botDiscord']['commandes']['liste'];
  enEssai: boolean;
  captures: Partial<Record<number, NomCapture>>;
}
export const COMMANDES_BOT: readonly CommandeBot[] = [
  { cle: 'speedtune', enEssai: true, captures: { 1: 'speedtune-capture', 3: 'speedtune-reponse' } },
];

// Les quatre droits du bot dans un salon, sous leur nom dans Discord.
export const DROITS_DU_BOT = ['voir', 'anciens', 'envoyer', 'joindre'] as const;
