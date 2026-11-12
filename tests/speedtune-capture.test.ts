// `/speedtune` : lecture d'une capture de l'écran de préparation de siège
// (api/_source/capture/), analyse par le moteur de speed tuning de l'app, et
// le point d'arrivée des interactions Discord (api/_source/speedtune/).
//
// ⚠️ Aucune vraie capture dans le dépôt (public) : les écrans sont RECOMPOSÉS
// aux positions de la mise en page réelle, avec des portraits synthétiques et
// des chiffres dessinés depuis les gabarits. Le calcul, lui, part des vrais
// monstres et de leurs vrais kits (public/data).

import { generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { decoderImage, decouper, reduire, type Image } from '../api/_source/capture/image';
import { Banque, quantifier, signature, TAILLE, COTE, type BanqueSerialisee } from '../api/_source/capture/portraits';
import { lireNombre, type Gabarits } from '../api/_source/capture/chiffres';
import { DISPOSITIONS, lireEcranPreparation } from '../api/_source/capture/ecranPreparation';
import { analyserEquipe } from '../api/_source/speedtune/analyse';
import { creerInteractions, signatureValide, type Ressources } from '../api/_source/speedtune/interactions';
import { embedErreur, langueDe, type Embed } from '../api/_source/speedtune/message';
import gabaritsJson from '../api/_source/capture/chiffres-gabarits.json';
import { combatSpeed, runeSpeedForTarget, siegeLeadFor, speedLeadOf } from '../src/lib/speed';
import { kitVitesse, sortsVitesse } from '../src/lib/speedTuneKit';
import { passifsVitesse } from '../src/lib/speedTunePassif';
import type { DonneesKit } from '../src/lib/speedTuneAuto';
import type { DetailMonstre } from '../src/lib/monsterSkills';
import type { Monster } from '../src/types';
import { egal, monstersJson, ok, titre } from './outils';

const gabarits = gabaritsJson as Gabarits;

// ---- Fabrication d'images ------------------------------------------------

function imageUnie(l: number, h: number, [r, v, b]: [number, number, number]): Image {
  const rgba = new Uint8Array(l * h * 4);
  for (let i = 0; i < l * h; i++) { rgba[i * 4] = r; rgba[i * 4 + 1] = v; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255; }
  return { largeur: l, hauteur: h, rgba };
}

// Un « portrait » : motif pseudo-aléatoire déterministe (graine), dans une
// teinte donnée — deux graines différentes = deux dessins ; même graine et
// teintes différentes = un même monstre de deux éléments.
function portrait(graine: number, teinte: [number, number, number], cote = 96): Image {
  const img = imageUnie(cote, cote, [0, 0, 0]);
  let s = graine;
  const hasard = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const taches = Array.from({ length: 14 }, () => ({ x: hasard() * cote, y: hasard() * cote, r: 6 + hasard() * 18, k: 0.2 + hasard() * 0.8 }));
  for (let y = 0; y < cote; y++) for (let x = 0; x < cote; x++) {
    let k = 0.15;
    for (const t of taches) if ((x - t.x) ** 2 + (y - t.y) ** 2 < t.r ** 2) k = Math.max(k, t.k);
    const i = (y * cote + x) * 4;
    img.rgba[i] = teinte[0] * k; img.rgba[i + 1] = teinte[1] * k; img.rgba[i + 2] = teinte[2] * k;
  }
  return img;
}

// Colle `src` redimensionnée (plus proche voisin) dans le rectangle de `dst`.
function coller(dst: Image, src: Image, x0: number, y0: number, l: number, h: number) {
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const sx = Math.min(src.largeur - 1, Math.floor((x / l) * src.largeur));
    const sy = Math.min(src.hauteur - 1, Math.floor((y / h) * src.hauteur));
    const d = ((Math.round(y0) + y) * dst.largeur + Math.round(x0) + x) * 4, s = (sy * src.largeur + sx) * 4;
    if (d < 0 || d >= dst.rgba.length) continue;
    dst.rgba.set(src.rgba.subarray(s, s + 4), d);
  }
}

// Un nombre en blanc, chiffre par chiffre depuis les gabarits (2ᵉ modèle :
// Inter 600), sur fond sombre.
function nombre(texte: string, hGlyphe: number): Image {
  const lG = Math.round((hGlyphe * gabarits.l) / gabarits.h);
  const pas = lG + Math.max(2, Math.round(hGlyphe / 6));
  const img = imageUnie(texte.length * pas + 8, hGlyphe + 8, [40, 40, 44]);
  [...texte].forEach((c, k) => {
    const m = gabarits.chiffres[c][1];
    for (let y = 0; y < hGlyphe; y++) for (let x = 0; x < lG; x++) {
      const v = m[Math.floor((y / hGlyphe) * gabarits.h) * gabarits.l + Math.floor((x / lG) * gabarits.l)];
      const i = ((y + 4) * img.largeur + 4 + k * pas + x) * 4;
      const p = 40 + v * 215;
      img.rgba[i] = p; img.rgba[i + 1] = p; img.rgba[i + 2] = p;
    }
  });
  return img;
}

function banqueDe(entrees: { id: number; img: Image }[]): Banque {
  const sigs = entrees.map((e) => signature(e.img)!);
  const dessins = new Int8Array(entrees.length * TAILLE);
  sigs.forEach((s, k) => dessins.set(quantifier(s.dessin), k * TAILLE));
  const s: BanqueSerialisee = { version: 1, cote: COTE, ids: entrees.map((e) => e.id), teintes: sigs.flatMap((x) => x.teinte), dessins: Buffer.from(dessins.buffer).toString('base64') };
  return new Banque(JSON.parse(JSON.stringify(s)));
}

// L'écran de préparation recomposé : fond sombre, six cartes à leur place
// (disposition « hauteur », téléphone 2556 × 1179), cadre doré, VIT des trois
// attaquants dans une pastille en bas à droite.
function ecran(portraits: Image[], vitesses: string[], l = 2556, h = 1179): Image {
  const img = imageUnie(l, h, [52, 40, 30]);
  portraits.forEach((p, k) => {
    const [x, y, c] = DISPOSITIONS.hauteur.carte(img, k);
    coller(img, imageUnie(4, 4, [200, 160, 80]), x, y, c, c);
    const cadre = Math.round(c * 0.04);
    coller(img, p, x + cadre, y + cadre, c - 2 * cadre, c - 2 * cadre);
    if (k < 3) {
      const n = nombre(vitesses[k], Math.round(c * 0.105));
      coller(img, imageUnie(4, 4, [40, 40, 44]), x + 0.62 * c, y + 0.79 * c, 0.34 * c, 0.16 * c);
      coller(img, n, x + 0.66 * c, y + 0.8 * c, n.largeur, n.hauteur);
    }
  });
  return img;
}

const ROUGE: [number, number, number] = [230, 70, 60];
const BLEU: [number, number, number] = [60, 110, 230];
const VERT: [number, number, number] = [70, 200, 90];

// ---- Image ----------------------------------------------------------------

export function testCaptureImage() {
  titre('Speed tune par capture — image : décodage, découpe, réduction');
  const png = new PNG({ width: 3, height: 2 });
  png.data.fill(0);
  png.data.set([10, 20, 30, 255], 0);
  const lu = decoderImage(new Uint8Array(PNG.sync.write(png)));
  egal([lu?.largeur, lu?.hauteur, Array.from(lu?.rgba.subarray(0, 4) ?? [])], [3, 2, [10, 20, 30, 255]], 'PNG décodé');
  const j = jpeg.encode({ data: Buffer.from(imageUnie(16, 8, [200, 100, 50]).rgba), width: 16, height: 8 }, 95).data;
  const lj = decoderImage(new Uint8Array(j));
  ok(lj?.largeur === 16 && lj.hauteur === 8 && Math.abs(lj.rgba[0] - 200) < 8, 'JPEG décodé');
  egal(decoderImage(new TextEncoder().encode('pas une image')), null, 'ni PNG ni JPEG : refusé');

  const img = imageUnie(10, 10, [1, 2, 3]);
  egal([decouper(img, 8, 8, 5, 5)?.largeur, decouper(img, -3, 0, 5, 5)?.largeur], [2, 2], 'découpe ramenée dans l\'image');
  egal(decouper(img, 20, 20, 5, 5), null, 'découpe hors de l\'image : rien');
  const damier = imageUnie(2, 2, [0, 0, 0]);
  damier.rgba.set([200, 100, 0, 255], 0);
  egal(Array.from(reduire(damier, 1, 1)), [50, 25, 0], 'réduction : moyenne de surface');
}

// ---- Portraits --------------------------------------------------------------

export function testCapturePortraits() {
  titre('Speed tune par capture — portraits reconnus, élément départagé par la teinte');
  const banque = banqueDe([
    { id: 1, img: portrait(11, ROUGE) },
    { id: 2, img: portrait(22, BLEU) },
    { id: 3, img: portrait(22, VERT) }, // même dessin que 2, autre élément
    { id: 4, img: portrait(33, VERT) },
  ]);
  const ecr = ecran([portrait(11, ROUGE), portrait(22, VERT), portrait(33, VERT), portrait(22, BLEU), portrait(11, ROUGE), portrait(33, VERT)], ['100', '100', '100']);
  const lecture = lireEcranPreparation(ecr, banque, gabarits);
  egal(lecture.attaquants.map((a) => a.portrait?.meilleur.com2usId), [1, 3, 4], 'les trois attaquants, dans l\'ordre');
  egal(lecture.defense.map((d) => d.portrait?.meilleur.com2usId), [2, 1, 4], 'la défense');
  const vert = lecture.attaquants[1].portrait!;
  const bleu = vert.suivants.find((s) => s.com2usId === 2);
  ok(vert.meilleur.com2usId === 3 && bleu !== undefined && vert.meilleur.score - bleu.score > 0.3, 'même dessin, autre élément : la teinte départage, avec une marge nette');

  // Deux portraits d'un même monstre (paire collab) : un seul candidat.
  const collab = banqueDe([{ id: 7, img: portrait(44, ROUGE) }, { id: 7, img: portrait(45, ROUGE) }, { id: 8, img: portrait(46, BLEU) }]);
  const r = collab.reconnaitre([portrait(44, ROUGE)])!;
  egal([r.meilleur.com2usId, r.suivants.map((s) => s.com2usId)], [7, [8]], 'les portraits d\'un même monstre ne se font pas concurrence');
}

// ---- Chiffres ----------------------------------------------------------------

export function testCaptureChiffres() {
  titre('Speed tune par capture — VIT lue chiffre par chiffre');
  for (const texte of ['0123', '4567', '89', '239', '286', '301', '114', '409']) {
    const lu = lireNombre(nombre(texte, 19), gabarits);
    egal(lu?.texte, texte, `« ${texte} » lu`);
  }
  // Petits caractères (capture réduite) : encore lisibles à 12 pixels.
  egal(lireNombre(nombre('357', 12), gabarits)?.texte, '357', 'lisible à 12 pixels de haut');
  egal(lireNombre(imageUnie(40, 20, [40, 40, 44]), gabarits), null, 'zone sans chiffre : rien');
}

// ---- Écran de préparation ----------------------------------------------------

export function testCaptureEcran() {
  titre('Speed tune par capture — écran de préparation : monstres et VIT');
  const banque = banqueDe([1, 2, 3, 4, 5, 6].map((id) => ({ id, img: portrait(id * 7, [ROUGE, BLEU, VERT][id % 3]) })));
  const portraits = [1, 2, 3, 4, 5, 6].map((id) => portrait(id * 7, [ROUGE, BLEU, VERT][id % 3]));
  const l = lireEcranPreparation(ecran(portraits, ['357', '367', '385']), banque, gabarits);
  egal(l.attaquants.map((a) => [a.portrait?.meilleur.com2usId, a.vitesse?.valeur]), [[1, 357], [2, 367], [3, 385]], 'attaquants et VIT de combat');
  egal(l.disposition, 'hauteur', 'mise à l\'échelle retenue');
  // Un écran moitié moins grand se lit encore.
  const petit = lireEcranPreparation(ecran(portraits, ['239', '286', '301'], 1278, 590), banque, gabarits);
  egal(petit.attaquants.map((a) => a.vitesse?.valeur), [239, 286, 301], 'capture en demi-résolution : VIT lues');
  // Une VIT hors de portée du jeu n'est pas une VIT.
  const absurde = lireEcranPreparation(ecran(portraits, ['9', '999', '357']), banque, gabarits);
  egal(absurde.attaquants.map((a) => a.vitesse?.valeur ?? null), [null, null, 357], 'VIT invraisemblable : écartée');
}

// ---- Analyse -------------------------------------------------------------------

const MONSTRES = monstersJson() as Monster[];
const monstreNomme = (nom: string, element: string) => MONSTRES.find((m) => m.name === nom && m.element === element && m.obtainable)!;
function donneesKit(monstres: Monster[]): DonneesKit {
  const d: DonneesKit = { kits: new Map(), sorts: new Map(), passifs: new Map() };
  for (const m of monstres) {
    const det = ficheDe(m.com2usId!);
    d.kits.set(m.com2usId!, kitVitesse(det)); d.sorts.set(m.com2usId!, sortsVitesse(det)); d.passifs.set(m.com2usId!, passifsVitesse(det));
  }
  return d;
}
function ficheDe(id: number): DetailMonstre | null {
  const p = `public/data/skills/${id}.json`;
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

export function testSpeedtuneAnalyse() {
  titre('Speed tune par capture — analyse : même moteur que l\'outil');
  const susano = monstreNomme('Susano', 'water'), chilling = monstreNomme('Chilling', 'water'), tarq = monstreNomme('Tarq', 'water');
  const equipe = [{ monster: susano, combat: 357 }, { monster: chilling, combat: 367 }, { monster: tarq, combat: 385 }];
  // La VIT de runes reconstituée redonne EXACTEMENT la VIT de combat lue.
  const lead = speedLeadOf(susano);
  for (const a of equipe) {
    const p = siegeLeadFor(lead, a.monster.element);
    egal(combatSpeed(a.monster.stats.speed, runeSpeedForTarget(a.monster.stats.speed, p, a.combat), p), a.combat, `${a.monster.name} : VIT de combat reconstituée`);
  }
  const r = analyserEquipe(equipe, donneesKit(equipe.map((a) => a.monster)));
  egal([r.lead?.monster.name, r.lead?.pourcent], ['Susano', 30], 'le premier monstre est le leader, son lead s\'applique');
  egal(r.lignes[0].monster.name, 'Tarq', 'le plus rapide joue le premier');
  ok(r.lignes.every((l, i) => i === 0 || (l.tick ?? Infinity) > (r.lignes[i - 1].tick ?? 0)), 'un seul monstre par tick, dans l\'ordre de jeu');
  ok(r.lignes.some((l) => l.sort !== null), 'les sorts de vitesse des kits sont pris en compte');

  // Une équipe sans lead de siège : aucun pourcentage.
  const sansLead = analyserEquipe([{ monster: tarq, combat: 300 }, { monster: chilling, combat: 250 }, { monster: susano, combat: 200 }], donneesKit([tarq, chilling, susano]));
  egal(sansLead.lead, null, 'un leader sans lead de vitesse : pas de lead');
  ok(!sansLead.ok && sansLead.lignes.some((l) => l.requis !== null), 'des alliés coupés : la VIT à atteindre est donnée');
}

// ---- Interactions Discord ------------------------------------------------------

export async function testSpeedtuneInteractions() {
  titre('Speed tune par capture — interactions Discord : signature, réponse différée, message');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const cle = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');
  ok(signatureValide(cle, sign(null, Buffer.from('1{}'), privateKey).toString('hex'), '1', '{}'), 'signature Ed25519 valide');
  ok(!signatureValide(cle, sign(null, Buffer.from('1{}'), privateKey).toString('hex'), '2', '{}'), 'horodatage changé : refusée');
  ok(!signatureValide('zz', 'aa', '1', '{}'), 'clé ou signature mal formée : refusée');

  // Trois vrais monstres, reconnus par une banque synthétique à leur identifiant.
  const susano = monstreNomme('Susano', 'water'), chilling = monstreNomme('Chilling', 'water'), tarq = monstreNomme('Tarq', 'water');
  const equipe = [susano, chilling, tarq];
  const dessins = [...equipe, susano, chilling, tarq].map((m, k) => portrait(k < 3 ? m.com2usId! : m.com2usId! + 1, [ROUGE, BLEU, VERT][k % 3]));
  const banque = banqueDe(equipe.map((m, k) => ({ id: m.com2usId!, img: dessins[k] })));
  const capture = ecran(dessins, ['357', '367', '385']);
  const octets = PNG.sync.write(Object.assign(new PNG({ width: capture.largeur, height: capture.hauteur }), { data: Buffer.from(capture.rgba) }));
  const ressources: Ressources = {
    banque, gabarits, monstre: (id) => MONSTRES.find((m) => m.com2usId === id), detail: async (id) => ficheDe(id),
  };

  const envois: { url: string; corps: { embeds: Embed[] } }[] = [];
  const travaux: Promise<unknown>[] = [];
  const service = creerInteractions({
    clePublique: cle,
    applicationId: 'APP',
    recuperer: async (url, init) => {
      if (url === 'https://cdn.discordapp.com/c.png') return new Response(new Uint8Array(octets));
      envois.push({ url, corps: JSON.parse(String(init?.body)) });
      return new Response(null, { status: 204 });
    },
    differer: (t) => travaux.push(t),
    ressources: async () => ressources,
  });
  const envoyer = (objet: unknown, signer = true, methode = 'POST') => {
    const corps = JSON.stringify(objet);
    const sig = signer ? sign(null, Buffer.from('7' + corps), privateKey).toString('hex') : '00'.repeat(64);
    return service.traiter(new Request('https://x/api/interactions', methode === 'POST'
      ? { method: 'POST', body: corps, headers: { 'x-signature-ed25519': sig, 'x-signature-timestamp': '7' } }
      : { method: methode }));
  };
  const commande = (piece: unknown, locale = 'fr') => ({
    type: 2, token: 'T', locale, data: { name: 'speedtune', options: [{ name: 'capture', value: '9' }], resolved: { attachments: { 9: piece } } },
  });

  egal(await (await envoyer({ type: 1 })).json(), { type: 1 }, 'PING → PONG');
  egal((await envoyer({ type: 1 }, false)).status, 401, 'signature fausse : 401');
  egal((await envoyer(null, true, 'GET')).status, 405, 'autre méthode que POST : 405');
  egal((await envoyer({ type: 2, token: 'T', data: { name: 'autre' } })).status, 400, 'commande inconnue : 400');

  const r = await envoyer(commande({ url: 'https://cdn.discordapp.com/c.png', content_type: 'image/png', size: octets.length }));
  egal(await r.json(), { type: 5 }, 'la commande répond aussitôt « en cours »');
  await Promise.all(travaux);
  const dernier = () => envois[envois.length - 1];
  const final = dernier();
  egal(final.url, 'https://discord.com/api/v10/webhooks/APP/T/messages/@original', 'le résultat remplace la réponse différée');
  const embed = final.corps.embeds[0];
  ok(embed.description?.includes('Susano') === true && embed.description.includes('+30 %'), 'le leader et son lead');
  const ordre = embed.fields?.[0].value ?? '';
  ok(ordre.startsWith('1. **Tarq** · 385 VIT · tick'), 'l\'ordre de jeu, VIT et tick');
  ok(['Susano', 'Chilling'].every((n) => ordre.includes(n)), 'les trois attaquants y figurent');
  egal(final.corps, { ...final.corps, allowed_mentions: { parse: [] } }, 'aucune mention possible');

  // Les refus, en anglais quand Discord est en anglais.
  const titreDe = async (piece: unknown) => {
    travaux.length = 0;
    await envoyer(commande(piece, 'en-US'));
    await Promise.all(travaux);
    return dernier().corps.embeds[0].description;
  };
  egal(await titreDe({ url: 'https://ailleurs.example/c.png', content_type: 'image/png', size: 10 }), embedErreur('en', 'pasImage').description, 'une adresse hors du CDN de Discord n\'est pas téléchargée');
  egal(await titreDe({ url: 'https://cdn.discordapp.com/c.gif', content_type: 'image/gif', size: 10 }), embedErreur('en', 'pasImage').description, 'ni PNG ni JPEG : refusé');
  egal(await titreDe({ url: 'https://cdn.discordapp.com/c.png', content_type: 'image/png', size: 11 * 1024 * 1024 }), embedErreur('en', 'tropLourde').description, 'plus de 10 Mo : refusé avant téléchargement');
  egal([langueDe('fr'), langueDe('en-GB'), langueDe(undefined)], ['fr', 'en', 'en'], 'langue : français, sinon anglais');
}
