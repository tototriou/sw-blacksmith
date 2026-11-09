// La recommandation d'un salon : sa version courante parmi les messages, et le
// fichier qu'une publication poste. Pur, testé (tests/discord-service.test.ts).
// Le modèle : docs/04-decisions/adr/un-salon-une-reco.md.

import { decodeRecosJson, encodeRecosJson, type Issues } from '../../../src/lib/recoShare';
import type { RecoPayload } from '../../../src/types';
import type { Dictionnaire } from '../../../src/i18n/fr';

// Un message de salon, tel que l'API de Discord le donne (champs utiles).
export interface MessageDiscord {
  id: string;
  timestamp: string;
  author: { id: string };
  attachments: { url: string; filename: string; size: number }[];
}

export const NOM_FICHIER = 'recommandation.json';
const collecteur = (): Issues => ({ errors: [], warnings: [] });
// Une recommandation pèse quelques dizaines de Ko ; au-delà, ce n'en est pas une.
export const TAILLE_MAX = 256 * 1024;

// Les messages arrivent du plus récent au plus ancien : la version courante est
// le premier message du bot qui porte un fichier JSON. Les autres messages
// (discussion, fichiers postés à la main) ne comptent pas.
export function versionCourante(messages: MessageDiscord[], botId: string): { message: MessageDiscord; url: string } | null {
  for (const m of messages) {
    if (m.author.id !== botId) continue;
    const pj = m.attachments.find((a) => a.filename.endsWith('.json'));
    if (pj) return { message: m, url: pj.url };
  }
  return null;
}

// Le contenu d'une version : une seule recommandation valide, ou rien.
export function lireVersion(texte: string, t: Dictionnaire): RecoPayload | null {
  const recos = decodeRecosJson(texte, t, collecteur());
  return recos && recos.length === 1 ? recos[0] : null;
}

// Le nom d'un membre tel que la guilde le connaît : son surnom du serveur, à
// défaut son nom d'affichage, à défaut son identifiant.
export function nomDuMembre(membre: { nick?: string | null; user?: { username: string; global_name?: string | null } }): string {
  return (membre.nick || membre.user?.global_name || membre.user?.username || '').trim().slice(0, 40);
}

export type Publication = { ok: true; texte: string; reco: RecoPayload } | { ok: false; erreurs: string[] };

// Le fichier posté : la recommandation envoyée par le membre, avec la source
// du salon, l'auteur (le premier publieur, repris de la version précédente) et
// les contributeurs (chaque publieur, dans l'ordre de sa première publication).
// ⚠️ Auteur et contributeurs viennent de la session, jamais du fichier reçu :
// un membre ne peut publier sous le nom d'un autre.
export function preparerPublication(texte: string, publieur: string, precedente: RecoPayload | null, source: string, t: Dictionnaire): Publication {
  if (new TextEncoder().encode(texte).length > TAILLE_MAX) return { ok: false, erreurs: ['trop-gros'] };
  const ctx = collecteur();
  const recos = decodeRecosJson(texte, t, ctx);
  if (!recos || recos.length !== 1) return { ok: false, erreurs: recos ? ['plusieurs-recos'] : ctx.errors };
  const contributeurs = [...(precedente?.contributeurs ?? [])];
  if (!contributeurs.includes(publieur)) contributeurs.push(publieur);
  const reco: RecoPayload = {
    ...recos[0],
    author: precedente?.author || publieur,
    contributeurs,
    source,
  };
  return { ok: true, texte: encodeRecosJson([{ ...reco, id: '', origin: 'imported' }]), reco };
}

export function sourceDuSalon(serveurId: string, salonId: string): string {
  return `discord:${serveurId}:${salonId}`;
}
