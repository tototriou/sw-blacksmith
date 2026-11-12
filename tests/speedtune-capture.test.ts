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
import { decoderImage, decouper, dimensionsPng, reduire, type Image } from '../api/_source/capture/image';
import { Banque, quantifier, signature, TAILLE, COTE, type BanqueSerialisee } from '../api/_source/capture/portraits';
import { lireNombre, type Gabarits } from '../api/_source/capture/chiffres';
import { DISPOSITIONS, lireEcranPreparation } from '../api/_source/capture/ecranPreparation';
import { analyserEquipe } from '../api/_source/speedtune/analyse';
import { creerInteractions, signatureValide, tranchesArte, type Ressources } from '../api/_source/speedtune/interactions';
import { embedErreur, ICONE_APP, LIEN_OUTIL, langueDe, type BoutonBascule, type Embed, type Menu, type Rangee } from '../api/_source/speedtune/message';
import { decoderEtat, encoderEtat, LONGUEUR_MAX, type Etat } from '../api/_source/speedtune/etat';
import { creerEmojis } from '../api/_source/speedtune/emojis';
import gabaritsJson from '../api/_source/capture/chiffres-gabarits.json';
import { combatSpeed, runeSpeedForTarget, siegeLeadFor, speedLeadOf } from '../src/lib/speed';
import { kitVitesse, sortsVitesse } from '../src/lib/speedTuneKit';
import { passifsVitesse, pointsDeGain } from '../src/lib/speedTunePassif';
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
  egal(dimensionsPng(new Uint8Array(PNG.sync.write(png))), { largeur: 3, hauteur: 2 }, 'la taille d\'un PNG se lit dans son en-tête');
  // Un en-tête qui annonce 40 000 × 40 000 : refusé SANS décoder (un PNG uni
  // se compresse à presque rien et se décoderait en plusieurs Go).
  const geant = new Uint8Array(PNG.sync.write(png));
  new DataView(geant.buffer, geant.byteOffset).setUint32(16, 40000);
  new DataView(geant.buffer, geant.byteOffset).setUint32(20, 40000);
  egal(decoderImage(geant), null, 'PNG annoncé trop grand : refusé avant décodage');

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

  // Les cumuls du passif précisés par le joueur : Chilling (+20 par buff) à
  // 367 lu et 1 cumul passe à 387, devant Tarq à 385 — et devient le modèle
  // de l'adversaire de référence.
  const avecCumul = analyserEquipe(equipe.map((a) => (a.monster === chilling ? { ...a, cumuls: 1 } : a)), donneesKit(equipe.map((a) => a.monster)));
  egal(avecCumul.lignes[0].monster.name, 'Chilling', 'un cumul du passif de Chilling le fait jouer le premier');
  egal(avecCumul.reference, 387, 'la référence copie le plus rapide, passif compris');

  // La VIT à viser se donne dans l'échelle de la VIT LUE (sans le passif) :
  // Miles à 2 cumuls en a déjà le gain, la cible lue baisse d'autant.
  const miles = monstreNomme('Miles', 'water');
  const avecMiles = (cumuls: number) => analyserEquipe([{ monster: tarq, combat: 300 }, { monster: miles, combat: 240, cumuls }, { monster: susano, combat: 200 }],
    donneesKit([tarq, miles, susano])).lignes.find((l) => l.monster === miles)!.requis;
  const passifMiles = passifsVitesse(ficheDe(miles.com2usId!)).find((x) => x.gain)!;
  egal(avecMiles(2), avecMiles(0)! - pointsDeGain(passifMiles.gain, miles.stats.speed, 2), 'VIT à viser : le gain du passif n\'est pas compté deux fois');
  egal(r.reference, 385, 'sans cumul, la référence est Tarq');
}

export async function testSpeedtuneEmojis() {
  titre('Speed tune par capture — icônes des monstres en émojis du bot');
  const chilling = monstreNomme('Chilling', 'water'), tarq = monstreNomme('Tarq', 'water');
  const appels: string[] = [];
  let panne = false;
  const emojis = creerEmojis(async (url, init) => {
    appels.push(`${init?.method ?? 'GET'} ${url}`);
    if (panne) return new Response(null, { status: 500 });
    if (url.endsWith('/emojis') && !init?.method) return Response.json({ items: [{ id: '11', name: `m${chilling.com2usId}` }] });
    if (url === tarq.image) return new Response(new Uint8Array([137, 80, 78, 71]));
    if (init?.method === 'POST') return Response.json({ id: '22', name: JSON.parse(String(init.body)).name });
    return new Response(null, { status: 404 });
  }, 'APP', 'JETON');
  const r = await emojis([chilling, tarq, chilling]);
  egal([r.get(chilling.com2usId!), r.get(tarq.com2usId!)], [`<:m${chilling.com2usId}:11>`, `<:m${tarq.com2usId}:22>`], 'un émoji connu, un émoji créé à la demande');
  egal(appels.filter((a) => a.startsWith('POST')).length, 1, 'seul le monstre sans émoji est téléversé, une fois');
  appels.length = 0;
  await emojis([chilling, tarq]);
  egal(appels, [], 'la liste et les créations sont gardées : aucun nouvel appel');
  panne = true;
  const sansListe = creerEmojis(async () => new Response(null, { status: 500 }), 'APP', 'JETON');
  egal((await sansListe([chilling])).size, 0, 'Discord en panne : aucune icône, aucune erreur');
}

export function testSpeedtuneEtat() {
  titre('Speed tune par capture — état porté par les menus Discord');
  const etat: Etat = {
    attaquants: [
      { id: 20711, combat: 367, cumuls: null, arte: 14, vitDouteuse: false, autrePortrait: null },
      { id: 25311, combat: 385, cumuls: 12, arte: null, vitDouteuse: true, autrePortrait: 20701 },
      { id: 19214, combat: 99, cumuls: 0, arte: 0, vitDouteuse: false, autrePortrait: null },
    ],
    defense: [10111, 20222, 30333],
    swift: 5,
    auteur: '1569358973419659324',
  };
  egal(decoderEtat(encoderEtat('s1', etat)), { action: 's1', etat }, 'aller-retour sans perte');
  const pire: Etat = {
    attaquants: [0, 1, 2].map(() => ({ id: 99999, combat: 450, cumuls: 24, arte: 60, vitDouteuse: true, autrePortrait: 99999 })),
    defense: [99999, 99999, 99999],
    swift: 7,
    auteur: '18446744073709551615', // le plus grand identifiant Discord possible
  };
  ok(encoderEtat('c2', pire).length <= LONGUEUR_MAX, 'le pire cas tient dans un custom_id (100 caractères), doutes compris');
  egal(decoderEtat(encoderEtat('c2', pire))?.etat.attaquants[0].autrePortrait, 99999, 'le pire cas garde ses doutes');
  egal(decoderEtat(encoderEtat('c2', pire))?.etat.auteur, '18446744073709551615', 'l\'auteur relu au chiffre près (au-delà de la précision d\'un nombre)');
  egal(decoderEtat('st2:c0:1.2.p...:::1'), null, 'plus de cumuls qu\'un menu n\'en propose : refusé');
  egal(decoderEtat('st2:a0:1.2..1p..:::1'), null, 'plus de 60 % d\'effet aug. VIT : refusé');
  egal(decoderEtat('st2:w:1.2....::2:1'), null, 'set Rapide sur un attaquant qui n\'existe pas : refusé');
  egal(decoderEtat('st2:c0:1.2...x.:::1'), null, 'champ inattendu : refusé');
  egal(decoderEtat('st2:c0:1.2....:::'), null, 'sans auteur : refusé');
  egal(decoderEtat('st1:c0:1.2....::'), null, 'ancien format (avant l\'auteur) : refusé');
  egal(decoderEtat('st2:w:1.2....:::1')?.etat.swift, null, 'set Rapide pas encore précisé');

  // Les tranches d'effet aug. VIT : chacune donne un buff différent, et la
  // borne basse le même buff que toute la tranche.
  const tranches = tranchesArte(30);
  egal([tranches.length, tranches[0], tranches[1], tranches[tranches.length - 1]],
    [19, { de: 0, a: 3, buff: 30 }, { de: 4, a: 6, buff: 31 }, { de: 60, a: 60, buff: 48 }], 'buff de 30 % : 19 tranches de 0 à 60 %');
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
    emojis: async (ms) => new Map(ms.map((m) => [m.com2usId!, `<:m${m.com2usId}:9>`])),
  };

  const envois: { url: string; corps: { embeds: Embed[]; components?: Rangee[] } }[] = [];
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
    type: 2, token: 'T', locale, member: { user: { id: '111' } }, data: { name: 'speedtune', options: [{ name: 'capture', value: '9' }], resolved: { attachments: { 9: piece } } },
  });

  egal(await (await envoyer({ type: 1 })).json(), { type: 1 }, 'PING → PONG');
  egal((await envoyer({ type: 1 }, false)).status, 401, 'signature fausse : 401');
  egal((await envoyer(null, true, 'GET')).status, 405, 'autre méthode que POST : 405');
  egal((await envoyer({ type: 2, token: 'T', data: { name: 'autre' } })).status, 400, 'commande inconnue : 400');

  const r = await envoyer(commande({ url: 'https://cdn.discordapp.com/c.png', content_type: 'image/png', size: octets.length }));
  egal(await r.json(), { type: 5 }, 'la commande répond aussitôt « en cours »');
  await Promise.all(travaux);
  const dernier = () => envois[envois.length - 1];
  // Chilling a un passif qui se cumule : la question d'abord, un menu à lui.
  const question = dernier();
  egal(question.url, 'https://discord.com/api/v10/webhooks/APP/T/messages/@original', 'la question remplace la réponse différée');
  const menusDe = (m: typeof question) => (m.corps.components ?? []).map((r) => r.components[0] as Menu);
  const menus = menusDe(question);
  // Chilling : son passif se cumule ; et son S2 (Song of the Night Wind) buffe
  // la VIT de toute l'équipe : l'effet aug. VIT de chacun compte.
  egal(menus.map((m) => m.placeholder),
    ['Chilling : nombre de cumuls', 'Susano : Effet aug. VIT', 'Chilling : Effet aug. VIT', 'Tarq : Effet aug. VIT'],
    'un menu par valeur que la capture ne montre pas ; le set Rapide ne se demande pas');
  const menu = menus[0];
  egal(menu.options[1].description, '+20 VIT', 'chaque cumul avec la VIT qu\'il ajoute');
  egal([menus[1].options[1].label, menus[1].options[1].description], ['Effet aug. VIT +4 à 6 %', undefined], 'chaque tranche d\'artéfact, nommée comme dans le jeu, sans le buff qui en résulte');
  ok(question.corps.embeds[0].description?.includes('The Cunning') === true, 'le passif est nommé comme dans le jeu');

  // Le choix de quelqu'un d'autre est refusé, en privé.
  // ⚠️ Aucune métadonnée du message : l'auteur ne vient que de l'état.
  const choix = (valeur: string, qui = '111', customId = menu.custom_id) => ({
    type: 3, token: 'C', locale: 'fr', member: { user: { id: qui } },
    data: { custom_id: customId, component_type: 3, values: [valeur] },
  });
  travaux.length = 0;
  const intrus = await (await envoyer(choix('1', '222'))).json() as { type: number; data: { flags: number } };
  egal([intrus.type, intrus.data.flags, travaux.length], [4, 64, 0], 'un autre que l\'auteur : message privé, rien recalculé');
  const perime = await (await envoyer(choix('1', '111', 'st2:s0:abc'))).json() as { type: number };
  egal(perime.type, 4, 'un custom_id illisible : message privé');

  egal(await (await envoyer(choix('1'))).json(), { type: 6 }, 'le choix met à jour le message en différé');
  await Promise.all(travaux);
  const apresUn = dernier();
  egal(apresUn.corps.components?.length, 4, 'tant qu\'il manque une valeur, la question reste');
  egal(menusDe(apresUn)[0].options.find((o) => o.default)?.value, '1', 'le choix fait reste affiché, à sa place');
  // Les trois effets aug. VIT, chacun depuis le dernier message.
  for (const k of [0, 1, 2]) {
    travaux.length = 0;
    const m = menusDe(dernier()).find((x) => x.placeholder.endsWith('Effet aug. VIT') && !x.options.some((o) => o.default))!;
    await envoyer(choix(k === 0 ? '4' : '0', '111', m.custom_id));
    await Promise.all(travaux);
  }
  // Tout est précisé : le résultat, sans Rapide par défaut, et sous lui un
  // bouton Rapide par attaquant, puis le lien vers l'outil.
  const sansSwift = dernier();
  egal(sansSwift.url, 'https://discord.com/api/v10/webhooks/APP/C/messages/@original', 'le résultat remplace la question');
  const boutons = (m: typeof question) => (m.corps.components?.[0].components ?? []) as BoutonBascule[];
  egal(boutons(sansSwift).map((b) => [b.label, b.style]), [['Susano en Rapide', 2], ['Chilling en Rapide', 2], ['Tarq en Rapide', 2]],
    'un bouton Rapide par attaquant, dans l\'ordre de la capture, tous éteints (gris)');
  egal(boutons(sansSwift)[2].emoji, { name: `m${tarq.com2usId}`, id: '9' }, 'chaque bouton porte l\'icône du monstre');
  egal(sansSwift.corps.components?.[1], { type: 1, components: [{ type: 2, style: 5, label: 'Ouvrir l\'outil de speed tuning', url: LIEN_OUTIL }] },
    'puis le bouton vers l\'outil de speed tuning');
  egal(sansSwift.corps.embeds[0].fields?.find((f) => f.name === 'Set Rapide')?.value, 'Aucun', 'par défaut, personne en Rapide');
  const clic = (customId: string, qui = '111') => ({
    type: 3, token: 'C', locale: 'fr', member: { user: { id: qui } }, data: { custom_id: customId, component_type: 2 },
  });
  travaux.length = 0;
  egal(await (await envoyer(clic(boutons(sansSwift)[2].custom_id, '222'))).json() as unknown, { type: 4, data: { content: 'Seul l\'auteur de la commande peut répondre.', flags: 64 } },
    'un bouton Rapide cliqué par un autre : refusé');
  egal(await (await envoyer(clic(boutons(sansSwift)[2].custom_id))).json(), { type: 6 }, 'un clic bascule Tarq en Rapide');
  await Promise.all(travaux);
  const final = dernier();
  egal(boutons(final).map((b) => b.style), [2, 2, 3], 'Tarq allumé (vert), les autres éteints');
  travaux.length = 0;
  await envoyer(clic(boutons(final)[2].custom_id));
  await Promise.all(travaux);
  egal(boutons(dernier()).map((b) => b.style), [2, 2, 2], 'un second clic l\'éteint');
  egal(LIEN_OUTIL, 'https://sw-blacksmith.vercel.app/#/outils/speed-tuning', 'l\'outil du site de production');
  egal(final.corps.embeds.length, 1, 'un seul encart, compact');
  ok(['⚡ Speed tune — personne ne se fait cut', '⚡ Speed tune — quelqu\'un se fait cut'].includes(final.corps.embeds[0].title), 'le titre parle comme les joueurs : « se faire cut »');
  const embed = final.corps.embeds[0];
  const champ = (nom: string) => embed.fields?.find((f) => f.name === nom)?.value ?? '';
  ok(champ('Précisé').includes('Passif de **Chilling** : 1 cumul (+20 VIT)'), 'les cumuls retenus sont rappelés');
  ok(champ('Précisé').includes('**Susano** : Effet aug. VIT +4 à 6 %'), 'l\'effet aug. VIT retenu est rappelé, par sa tranche');
  ok(!/buff/i.test(champ('Précisé')), 'sans la valeur du buff');
  egal(champ('Set Rapide'), 'Tarq', 'le set Rapide retenu, en champ');
  egal(champ('Équipe'), `<:m${susano.com2usId}:9> <:m${chilling.com2usId}:9> <:m${tarq.com2usId}:9>\nLead +30 %`,
    'l\'équipe à régler : ses trois icônes dans l\'ordre de la capture, et son lead');
  ok(/↳ .*· S\d/.test(champ('Ordre de jeu')), 'le sort retenu, par son numéro (S1, S2…)');
  ok(!champ('Ordre de jeu').includes('Song of the Night Wind'), 'pas le nom du sort');
  egal(embed.thumbnail?.url, ICONE_APP, 'la vignette est l\'icône de l\'app');
  // L'ordre de jeu : une ligne par monstre, son icône dans le texte.
  const ordre = champ('Ordre de jeu');
  const lignesOrdre = ordre.split('\n').filter((l) => /^\*\*\d\.\*\*/.test(l));
  egal(lignesOrdre.map((l) => /\*\*([A-Za-z]+)\*\* ·/.exec(l)?.[1]), ['Chilling', 'Tarq', 'Susano'], 'l\'ordre de jeu, passif compris');
  ok(lignesOrdre[0].startsWith(`**1.** <:m${chilling.com2usId}:9> **Chilling** · **367** VIT`), 'l\'icône du monstre dans la ligne, et la VIT lue');
  ok(!/tick/i.test(ordre), 'aucun tick affiché');
  ok(champ('Défense lue') !== '', 'la défense lue, en dernier champ');
  const runesDe = (m: Monster, combat: number, swift: boolean) => runeSpeedForTarget(m.stats.speed, siegeLeadFor(speedLeadOf(susano), m.element), combat, swift);
  ok(ordre.includes(`fiche ${tarq.stats.speed} + ${runesDe(tarq, 385, true)}`), 'Tarq en Rapide : sa VIT de fiche');
  ok(ordre.includes(`${susano.stats.speed} + `), 'Susano : sa VIT de fiche (ou celle à viser)');
  ok(Math.abs(runesDe(tarq, 385, true)! - runesDe(tarq, 385, false)!) <= 1, 'le Rapide ne change la VIT de fiche que d\'un point d\'arrondi');
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
