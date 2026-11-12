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
//      par le résultat ;
//   4. si la capture ne suffit pas — un passif de vitesse qui se CUMULE
//      (Chilling, Miles…), un buff de VIT que reçoivent des alliés dont on ne
//      voit pas l'effet aug. VIT des artéfacts —, le message pose d'abord la
//      question : un menu par valeur manquante. Chaque choix revient ici
//      (interaction de composant, type 3) avec toute la lecture dans son
//      `custom_id` (etat.ts) ; le résultat remplace la question quand tout est
//      précisé.

import { createPublicKey, verify } from 'node:crypto';
import type { Monster } from '../../../src/types';
import type { DetailMonstre } from '../../../src/lib/monsterSkills';
import { kitVitesse, sortsVitesse } from '../../../src/lib/speedTuneKit';
import { passifsVitesse, pointsDeGain, type PassifVitesse } from '../../../src/lib/speedTunePassif';
import { sortRetenu, sortSecondRetenu, type DonneesKit, type EntreeAuto } from '../../../src/lib/speedTuneAuto';
import { API, type Recuperer } from '../service/discordApi';
import { decoderImage } from '../capture/image';
import type { Banque } from '../capture/portraits';
import type { Gabarits } from '../capture/chiffres';
import { lireEcranPreparation, type LectureEcran } from '../capture/ecranPreparation';
import { analyserEquipe } from './analyse';
import { embedErreur, embedResultat, langueDe, messageQuestion, rangeeOutil, rangeeSwift, texteEphemere, type Demande, type Embed, type Langue, type Message, type Precision } from './message';
import { ARTE_MAX, CUMULS_MAX, decoderEtat, encoderEtat, type Etat } from './etat';
import type { Emojis } from './emojis';

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
  // Les icônes des monstres en émojis du bot (emojis.ts) ; absent, le message
  // s'écrit sans icône.
  emojis?: Emojis;
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
interface Utilisateur { id: string }
interface Interaction {
  type: number;
  token: string;
  locale?: string;
  guild_locale?: string;
  member?: { user?: Utilisateur };
  user?: Utilisateur;
  data?: {
    name?: string;
    options?: { name: string; value: string }[];
    resolved?: { attachments?: Record<string, PieceJointe> };
    custom_id?: string;
    component_type?: number;
    values?: string[];
  };
}

const json = (corps: unknown, statut = 200) => Response.json(corps, { status: statut });

export function creerInteractions(d: DependancesInteractions) {
  async function remplacer(token: string, contenu: Embed | Message) {
    const message: Message = 'embeds' in contenu ? contenu : { embeds: [contenu], components: [] };
    const r = await d.recuperer(`${API}/webhooks/${d.applicationId}/${token}/messages/@original`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...message, allowed_mentions: { parse: [] } }),
    });
    // ⚠️ Un refus de Discord (corps invalide, jeton expiré, limite) n'est pas
    // une exception : sans ce contrôle, le message restait sur « réfléchit… »
    // sans rien dans le journal. L'erreur remonte aux appelants, qui
    // retombent sur le message de panne.
    if (!r.ok) throw new Error(`message Discord refusé : HTTP ${r.status} ${await r.text().catch(() => '')}`.trim());
  }

  // Un cumul choisi dans un menu : l'état revient complet, on le recalcule.
  async function traiterChoix(token: string, langue: Langue, etat: Etat) {
    await new Promise((ok) => setTimeout(ok, ATTENTE_AVANT_CALCUL_MS));
    try {
      await remplacer(token, await repondre(await d.ressources(), etat, langue));
    } catch (e) {
      console.error(e);
      await remplacer(token, embedErreur(langue, 'panne')).catch((e2) => console.error(e2));
    }
  }

  async function traiterCapture(token: string, langue: Langue, piece: PieceJointe | undefined, auteur: string) {
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
      const etat = etatDeLecture(res, lireEcranPreparation(img, res.banque, res.gabarits), auteur);
      return await remplacer(token, 'erreur' in etat ? embedErreur(langue, etat.erreur) : await repondre(res, etat, langue));
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
        const auteur = interaction.member?.user?.id ?? interaction.user?.id ?? '';
        if (!/^\d{1,20}$/.test(auteur)) return json({ erreur: 'interaction' }, 400);
        d.differer(traiterCapture(interaction.token, langueDe(interaction.locale ?? interaction.guild_locale), piece, auteur));
        return json({ type: 5 }); // réponse différée
      }
      if (interaction.type === 3) {
        const langue = langueDe(interaction.locale ?? interaction.guild_locale);
        const ephemere = (quoi: 'pasAuteur' | 'perime') => json({ type: 4, data: { content: texteEphemere(langue, quoi), flags: 64 } });
        const lu = decoderEtat(interaction.data?.custom_id ?? '');
        if (!lu) return ephemere('perime');
        // ⚠️ Le message est public : seul celui qui a lancé la commande répond.
        // Son identifiant vient de l'état (etat.ts), jamais des métadonnées du
        // message, qui peuvent manquer — et rien ne passe sans lui.
        const qui = interaction.member?.user?.id ?? interaction.user?.id;
        if (qui !== lu.etat.auteur) return ephemere('pasAuteur');
        const sorte = lu.action[0];
        const cible = lu.etat.attaquants[Number(lu.action.slice(1))];
        const valeur = interaction.data?.values?.[0] ?? '';
        // Un bouton Rapide (sous le résultat) : il bascule ce monstre.
        if (sorte === 't' && cible) {
          lu.etat.swift = (lu.etat.swift ?? 0) ^ (1 << Number(lu.action.slice(1)));
          d.differer(traiterChoix(interaction.token, langue, lu.etat));
          return json({ type: 6 });
        }
        const max = sorte === 'c' ? CUMULS_MAX : ARTE_MAX;
        if (!cible || (sorte !== 'c' && sorte !== 'a') || !/^\d{1,2}$/.test(valeur) || Number(valeur) > max) return ephemere('perime');
        if (sorte === 'c') cible.cumuls = Number(valeur);
        else cible.arte = Number(valeur);
        d.differer(traiterChoix(interaction.token, langue, lu.etat));
        return json({ type: 6 }); // mise à jour différée du message
      }
      return json({ erreur: 'interaction' }, 400);
    },
  };
}

// La lecture → l'état : refus si l'écran n'est pas reconnu.
export function etatDeLecture(res: Ressources, lecture: LectureEcran, auteur: string): Etat | { erreur: 'illisible' | { vitIllisible: string[] } } {
  const att = lecture.attaquants;
  if (att.some((a) => !a.portrait || a.portrait.meilleur.score < SCORE_PORTRAIT_MIN)) return { erreur: 'illisible' };
  const monstres = att.map((a) => res.monstre(a.portrait!.meilleur.com2usId));
  if (monstres.some((m) => !m)) return { erreur: 'illisible' };
  const sansVit = att.flatMap((a, i) => (a.vitesse ? [] : [monstres[i]!.name]));
  if (sansVit.length) return { erreur: { vitIllisible: sansVit } };
  return {
    attaquants: att.map((a) => {
      const p = a.portrait!;
      const suivant = p.suivants[0];
      return {
        id: p.meilleur.com2usId,
        combat: a.vitesse!.valeur,
        cumuls: null,
        arte: null,
        vitDouteuse: a.vitesse!.confiance < CONFIANCE_VIT_MIN,
        autrePortrait: suivant && p.meilleur.score - suivant.score < ECART_DOUTE ? suivant.com2usId : null,
      };
    }),
    defense: lecture.defense
      .filter((x) => x.portrait && x.portrait.meilleur.score >= SCORE_PORTRAIT_MIN && res.monstre(x.portrait.meilleur.com2usId))
      .map((x) => x.portrait!.meilleur.com2usId),
    swift: null,
    auteur,
  };
}

// Le passif de vitesse qui se cumule, s'il y en a un — celui que l'analyse
// retient (`passifDe` de speedTuneAuto.ts : le premier qui a un gain).
const passifCumulable = (passifs: PassifVitesse[]): PassifVitesse | null => {
  const p = passifs.find((x) => x.gain || x.amplifieBuff) ?? null;
  return p?.gain?.parCumul ? p : null;
};

// Le nombre de cumuls proposé : jusqu'au plafond du passif (Miles : 100 % par
// 5 %, 20 cumuls), sinon 10 ; jamais plus que ce qu'un menu contient. Un
// cumul déjà choisi reste proposé.
const cumulsProposes = (p: PassifVitesse, choisi: number | null) =>
  Math.max(choisi ?? 0, Math.min(CUMULS_MAX, p.gain!.plafond != null ? Math.ceil(p.gain!.plafond / p.gain!.valeur) : 10));

// Le buff de VIT reçu, amplifié par l'effet aug. VIT : la MÊME troncature que
// la simulation (speedTune.ts), multiplication avant division.
const buffAmplifie = (base: number, arte: number) => Math.floor((base * (100 + arte)) / 100);

// Les tranches d'effet aug. VIT qui donnent le même buff : de 0 à 60 %, le buff
// de 30 % ne prend que 19 valeurs (30, 31… 48). Chaque option vaut sa borne
// basse — le résultat est exact pour toute la tranche, et le menu tient dans
// les 25 options de Discord.
export function tranchesArte(base: number): { de: number; a: number; buff: number }[] {
  const tranches: { de: number; a: number; buff: number }[] = [];
  for (let arte = 0; arte <= ARTE_MAX; arte++) {
    const buff = buffAmplifie(base, arte);
    const derniere = tranches[tranches.length - 1];
    if (derniere && derniere.buff === buff) derniere.a = arte;
    else tranches.push({ de: arte, a: arte, buff });
  }
  return tranches;
}

// Qui reçoit un buff de VIT, d'après les sorts que l'analyse retient (premier
// et second tour), et le plus fort de ces buffs. Un buff « sur un allié » peut
// viser n'importe qui, le lanceur compris : tous le reçoivent alors.
function buffsDeVitesse(etat: Etat, d: DonneesKit): { receveurs: Set<number>; base: number } {
  const receveurs = new Set<number>();
  let base = 0;
  etat.attaquants.forEach((a, i) => {
    const e = { id: String(i), monster: { com2usId: a.id } } as EntreeAuto;
    for (const sort of [sortRetenu(e, d), sortSecondRetenu(e, d)]) {
      const effet = sort?.effet;
      if (!effet) continue;
      const tous = etat.attaquants.map((_, k) => k);
      const touches = effet.buffEquipe ? tous.filter((k) => !(effet.buffEquipeSansSoi && k === i))
        : effet.buffAllie ? tous
        : effet.buffSoi ? [i]
        : [];
      touches.forEach((k) => receveurs.add(k));
      base = Math.max(base, effet.buffEquipe ?? 0, effet.buffAllie ?? 0, effet.buffSoi ?? 0);
    }
  });
  return { receveurs, base };
}

// L'état → le message : la question tant qu'une valeur manque, sinon
// l'analyse, avec ce qui reste incertain dans la lecture.
export async function repondre(res: Ressources, etat: Etat, langue: Langue): Promise<Message> {
  const monstres = etat.attaquants.map((a) => res.monstre(a.id));
  if (monstres.some((m) => !m)) return { embeds: [embedErreur(langue, 'illisible')], components: [] };
  const douteux = etat.attaquants.flatMap((a, i) => [
    ...(a.autrePortrait != null ? [`${monstres[i]!.name} / ${res.monstre(a.autrePortrait)?.name ?? '?'}`] : []),
    ...(a.vitDouteuse ? [`${monstres[i]!.name} ${a.combat}`] : []),
  ]);

  const donnees: DonneesKit = { kits: new Map(), sorts: new Map(), passifs: new Map() };
  await Promise.all(etat.attaquants.map(async (a) => {
    const detail = await res.detail(a.id);
    donnees.kits.set(a.id, kitVitesse(detail));
    donnees.sorts.set(a.id, sortsVitesse(detail));
    donnees.passifs.set(a.id, passifsVitesse(detail));
  }));

  const demandes: Demande[] = [];
  const precisions: Precision[] = [];
  etat.attaquants.forEach((a, i) => {
    const monster = monstres[i]!;
    const p = passifCumulable(donnees.passifs.get(a.id) ?? []);
    if (!p) return;
    const points = (n: number) => pointsDeGain(p.gain, monster.stats.speed ?? null, n);
    const options = Array.from({ length: cumulsProposes(p, a.cumuls) + 1 }, (_, n) => ({ valeur: n, points: points(n) }));
    demandes.push({ sorte: 'cumuls', nom: monster.name, passif: p.nom, texte: p.texte, options, choisi: a.cumuls, customId: encoderEtat(`c${i}`, etat) });
    if (a.cumuls != null) precisions.push({ sorte: 'cumuls', nom: monster.name, cumuls: a.cumuls, points: points(a.cumuls) });
  });
  const { receveurs, base } = buffsDeVitesse(etat, donnees);
  for (const i of receveurs) {
    const a = etat.attaquants[i];
    const nom = monstres[i]!.name;
    demandes.push({ sorte: 'arte', nom, options: tranchesArte(base), choisi: a.arte, customId: encoderEtat(`a${i}`, etat) });
    const tranche = tranchesArte(base).find((x) => x.de === a.arte);
    if (a.arte != null) precisions.push({ sorte: 'arte', nom, de: a.arte, a: tranche?.a ?? a.arte });
  }
  // Le set Rapide ne se demande pas : « aucun » par défaut, et des boutons
  // sous le résultat le basculent (`rangeeSwift`).
  const enSwift = (i: number) => ((etat.swift ?? 0) & (1 << i)) !== 0;
  precisions.push({ sorte: 'swift', noms: monstres.filter((_, i) => enSwift(i)).map((m) => m!.name) });

  if (demandes.some((x) => x.choisi == null)) {
    return messageQuestion(langue, etat.attaquants.map((a, i) => ({ nom: monstres[i]!.name, combat: a.combat })), demandes, douteux);
  }

  const resultat = analyserEquipe(
    etat.attaquants.map((a, i) => ({ monster: monstres[i]!, combat: a.combat, cumuls: a.cumuls, arte: a.arte, swift: enSwift(i) })),
    donnees
  );
  const defense = etat.defense.map((id) => res.monstre(id)).filter((m): m is Monster => m !== undefined);
  const icones = res.emojis ? await res.emojis([...monstres.map((m) => m!), ...defense]) : new Map<number, string>();
  const etatSwift = { ...etat, swift: etat.swift ?? 0 };
  const boutons = rangeeSwift(langue, etat.attaquants.map((_, i) => ({ monster: monstres[i]!, swift: enSwift(i), customId: encoderEtat(`t${i}`, etatSwift) })), icones);
  return { embeds: [embedResultat(langue, resultat, defense, douteux, precisions, icones)], components: [boutons, rangeeOutil(langue)] };
}
