// Le point d'arrivée des interactions Discord (commandes slash) : Discord y
// envoie chaque `/speedtune`, signé par la clé de l'application. Sans état ;
// toutes les dépendances sont injectées, les tests rejouent la route sans
// réseau.
//
// Déroulé de `/speedtune capture:<image>` :
//   1. signature vérifiée (Ed25519), sinon 401 — Discord l'exige, et refuse un
//      point d'arrivée qui accepterait une requête non signée ;
//   2. réponse différée (« réfléchit… ») tout de suite : Discord n'attend que
//      3 s, la lecture d'une capture en prend 1 à 3 ;
//   3. en tâche de fond (`differer`, le `waitUntil` de Vercel) : téléchargement,
//      lecture de l'écran de préparation, analyse, puis le message est remplacé
//      par le résultat.

import { createPublicKey, verify } from 'node:crypto';
import type { Monster } from '../../../src/types';
import type { DetailMonstre } from '../../../src/lib/monsterSkills';
import { kitVitesse, sortsVitesse } from '../../../src/lib/speedTuneKit';
import { passifsVitesse } from '../../../src/lib/speedTunePassif';
import type { DonneesKit } from '../../../src/lib/speedTuneAuto';
import { API, type Recuperer } from '../service/discordApi';
import { decoderImage } from '../capture/image';
import type { Banque } from '../capture/portraits';
import type { Gabarits } from '../capture/chiffres';
import { lireEcranPreparation, type LectureEcran } from '../capture/ecranPreparation';
import { analyserEquipe } from './analyse';
import { embedErreur, embedResultat, langueDe, type Embed, type Langue } from './message';

export const COMMANDE = 'speedtune';
export const OPTION_CAPTURE = 'capture';
export const TAILLE_MAX_IMAGE = 10 * 1024 * 1024;
const CDN_DISCORD = /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\//;
// Sous ce score, le portrait n'est pas celui d'un monstre : la capture n'est
// pas l'écran attendu, ou elle est recadrée (un portrait juste dépasse 0,8).
export const SCORE_PORTRAIT_MIN = 0.5;
// Écart au deuxième candidat sous lequel le portrait est dit incertain.
export const ECART_DOUTE = 0.05;
// Sous cette confiance, la VIT lue est dite incertaine.
export const CONFIANCE_VIT_MIN = 0.6;
const ATTENTE_AVANT_CALCUL_MS = 50;

export interface Ressources {
  banque: Banque;
  gabarits: Gabarits;
  monstre: (com2usId: number) => Monster | undefined;
  detail: (com2usId: number) => Promise<DetailMonstre | null>;
}

export interface DependancesInteractions {
  clePublique: string; // DISCORD_PUBLIC_KEY, en hexadécimal
  applicationId: string;
  recuperer: Recuperer;
  differer: (travail: Promise<unknown>) => void;
  ressources: () => Promise<Ressources>;
}

// Préfixe DER d'une clé publique Ed25519 brute (32 octets).
const PREFIXE_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');

export function signatureValide(clePublique: string, signature: string, horodatage: string, corps: string): boolean {
  try {
    if (!/^[0-9a-f]{64}$/i.test(clePublique) || !/^[0-9a-f]{128}$/i.test(signature)) return false;
    const cle = createPublicKey({ key: Buffer.concat([PREFIXE_ED25519, Buffer.from(clePublique, 'hex')]), format: 'der', type: 'spki' });
    return verify(null, Buffer.from(horodatage + corps), cle, Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

interface PieceJointe { url: string; content_type?: string; size: number }
interface Interaction {
  type: number;
  token: string;
  locale?: string;
  guild_locale?: string;
  data?: {
    name: string;
    options?: { name: string; value: string }[];
    resolved?: { attachments?: Record<string, PieceJointe> };
  };
}

const json = (corps: unknown, statut = 200) => Response.json(corps, { status: statut });

export function creerInteractions(d: DependancesInteractions) {
  async function remplacer(token: string, embed: Embed) {
    await d.recuperer(`${API}/webhooks/${d.applicationId}/${token}/messages/@original`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
    });
  }

  async function traiterCapture(token: string, langue: Langue, piece: PieceJointe | undefined) {
    // ⚠️ La lecture occupe le processeur 1 à 3 s d'un bloc : lancée tout de
    // suite, elle passait AVANT l'envoi de la réponse différée (mesuré : 2,3 s
    // de retard), et Discord abandonne l'interaction à 3 s. On rend d'abord la
    // main, le temps que la réponse parte.
    await new Promise((ok) => setTimeout(ok, ATTENTE_AVANT_CALCUL_MS));
    try {
      if (!piece || !CDN_DISCORD.test(piece.url) || !/^image\/(png|jpeg)$/.test(piece.content_type ?? '')) {
        return await remplacer(token, embedErreur(langue, 'pasImage'));
      }
      if (piece.size > TAILLE_MAX_IMAGE) return await remplacer(token, embedErreur(langue, 'tropLourde'));
      const r = await d.recuperer(piece.url);
      if (!r.ok) throw new Error(`pièce jointe HTTP ${r.status}`);
      const octets = new Uint8Array(await r.arrayBuffer());
      if (octets.length > TAILLE_MAX_IMAGE) return await remplacer(token, embedErreur(langue, 'tropLourde'));
      const img = decoderImage(octets);
      if (!img) return await remplacer(token, embedErreur(langue, 'pasImage'));
      const res = await d.ressources();
      return await remplacer(token, await calculer(res, lireEcranPreparation(img, res.banque, res.gabarits), langue));
    } catch (e) {
      console.error(e);
      await remplacer(token, embedErreur(langue, 'panne')).catch((e2) => console.error(e2));
    }
  }

  return {
    async traiter(requete: Request): Promise<Response> {
      if (requete.method !== 'POST') return json({ erreur: 'methode' }, 405);
      const corps = await requete.text();
      const signature = requete.headers.get('x-signature-ed25519') ?? '';
      const horodatage = requete.headers.get('x-signature-timestamp') ?? '';
      if (!signatureValide(d.clePublique, signature, horodatage, corps)) return json({ erreur: 'signature' }, 401);
      const interaction = JSON.parse(corps) as Interaction;
      if (interaction.type === 1) return json({ type: 1 }); // PING
      if (interaction.type === 2 && interaction.data?.name === COMMANDE) {
        const id = interaction.data.options?.find((o) => o.name === OPTION_CAPTURE)?.value;
        const piece = id ? interaction.data.resolved?.attachments?.[id] : undefined;
        d.differer(traiterCapture(interaction.token, langueDe(interaction.locale ?? interaction.guild_locale), piece));
        return json({ type: 5 }); // réponse différée
      }
      return json({ erreur: 'interaction' }, 400);
    },
  };
}

// La lecture → le message : refus si l'écran n'est pas reconnu, sinon
// l'analyse, avec ce qui reste incertain dans la lecture.
export async function calculer(res: Ressources, lecture: LectureEcran, langue: Langue): Promise<Embed> {
  const att = lecture.attaquants;
  if (att.some((a) => !a.portrait || a.portrait.meilleur.score < SCORE_PORTRAIT_MIN)) return embedErreur(langue, 'illisible');
  const monstres = att.map((a) => res.monstre(a.portrait!.meilleur.com2usId));
  if (monstres.some((m) => !m)) return embedErreur(langue, 'illisible');
  const sansVit = att.flatMap((a, i) => (a.vitesse ? [] : [monstres[i]!.name]));
  if (sansVit.length) return embedErreur(langue, { vitIllisible: sansVit });

  const douteux: string[] = [];
  att.forEach((a, i) => {
    const p = a.portrait!;
    const suivant = p.suivants[0];
    if (suivant && p.meilleur.score - suivant.score < ECART_DOUTE) douteux.push(`${monstres[i]!.name} / ${res.monstre(suivant.com2usId)?.name ?? '?'}`);
    if (a.vitesse!.confiance < CONFIANCE_VIT_MIN) douteux.push(`${monstres[i]!.name} ${a.vitesse!.texte}`);
  });

  const donnees: DonneesKit = { kits: new Map(), sorts: new Map(), passifs: new Map() };
  await Promise.all(att.map(async (a) => {
    const id = a.portrait!.meilleur.com2usId;
    const detail = await res.detail(id);
    donnees.kits.set(id, kitVitesse(detail));
    donnees.sorts.set(id, sortsVitesse(detail));
    donnees.passifs.set(id, passifsVitesse(detail));
  }));
  const resultat = analyserEquipe(att.map((a, i) => ({ monster: monstres[i]!, combat: a.vitesse!.valeur })), donnees);
  const defense = lecture.defense
    .filter((x) => x.portrait && x.portrait.meilleur.score >= SCORE_PORTRAIT_MIN)
    .map((x) => res.monstre(x.portrait!.meilleur.com2usId))
    .filter((m): m is Monster => m !== undefined);
  return embedResultat(langue, resultat, defense, douteux);
}
