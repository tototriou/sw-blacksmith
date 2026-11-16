// `/speedtune` : lecture d'une capture de l'écran de préparation de siège
// (api/_source/capture/), analyse par le moteur de speed tuning de l'app, et
// le point d'arrivée des interactions Discord (api/_source/speedtune/).
//
// ⚠️ Aucune vraie capture dans le dépôt (public) : les écrans sont RECOMPOSÉS
// aux positions de la mise en page réelle, avec des portraits synthétiques et
// des chiffres dessinés depuis les gabarits. Les vraies captures, posées en
// local dans tests/captures-speedtune/ (gitignoré), sont lues par
// testCapturesReelles. Le calcul, lui, part des vrais monstres et de leurs
// vrais kits (public/data).

import { generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { decoderImage, decouper, demiTaille, dimensionsPng, imageTropGrande, reduire, type Image } from '../api/_source/capture/image';
import { Banque, quantifier, signature, TAILLE, COTE, type BanqueSerialisee } from '../api/_source/capture/portraits';
import { HAUTEUR_CHIFFRE_MIN, lireNombre, type Gabarits } from '../api/_source/capture/chiffres';
import { lireEcranPreparation } from '../api/_source/capture/ecranPreparation';
import { analyserEquipe } from '../api/_source/speedtune/analyse';
import { adresseEnPng, creerInteractions, signatureValide, tranchesArte, type Ressources } from '../api/_source/speedtune/interactions';
import { embedErreur, ICONE_APP, LIEN_OUTIL, langueDe, type Embed, type Menu, type Rangee } from '../api/_source/speedtune/message';
import { decoderEtat, encoderEtat, LONGUEUR_MAX, type Etat } from '../api/_source/speedtune/etat';
import { creerEmojis } from '../api/_source/speedtune/emojis';
import gabaritsJson from '../api/_source/capture/chiffres-gabarits.json';
import banqueJson from '../api/_source/capture/banque-portraits.json';
import { combatSpeed, runeSpeedForTarget, siegeLeadFor, speedLeadOf } from '../src/lib/speed';
import { kitVitesse, sortsVitesse } from '../src/lib/speedTuneKit';
import { passifsVitesse, pointsDeGain } from '../src/lib/speedTunePassif';
import type { DonneesKit } from '../src/lib/speedTuneAuto';
import type { DetailMonstre } from '../src/lib/monsterSkills';
import type { Monster } from '../src/types';
import { egal, ignore, monstersJson, ok, titre } from './outils';

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

// Un nombre en blanc, chiffre par chiffre depuis les gabarits (le dernier
// modèle de chaque chiffre : un glyphe relevé sur une vraie capture), sur fond
// sombre. Chaque pixel est la MOYENNE du gabarit sur sa surface, comme
// l'anticrénelage du jeu : un échantillonnage au plus proche voisin donne, à
// 8 pixels, des chiffres en escalier qu'aucune capture ne montre.
function nombre(texte: string, hGlyphe: number, soudes = false): Image {
  const lG = Math.round((hGlyphe * gabarits.l) / gabarits.h);
  // `soudes` : chiffres collés, sans colonne vide entre eux (les petits
  // caractères de la fenêtre PC, que l'anticrénelage soude).
  const pas = soudes ? lG : lG + Math.max(2, Math.round(hGlyphe / 6));
  const img = imageUnie(texte.length * pas + 8, hGlyphe + 8, [40, 40, 44]);
  const moyenne = (m: number[], x0: number, x1: number, y0: number, y1: number) => {
    let s = 0, p = 0;
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      const w = (Math.min(x + 1, x1) - Math.max(x, x0)) * (Math.min(y + 1, y1) - Math.max(y, y0));
      if (w > 0) { s += m[y * gabarits.l + x] * w; p += w; }
    }
    return p ? s / p : 0;
  };
  [...texte].forEach((c, k) => {
    const modeles = gabarits.chiffres[c];
    const m = modeles[modeles.length - 1];
    for (let y = 0; y < hGlyphe; y++) for (let x = 0; x < lG; x++) {
      const fx = gabarits.l / lG, fy = gabarits.h / hGlyphe;
      const v = moyenne(m, x * fx, (x + 1) * fx, y * fy, (y + 1) * fy);
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

type Rect = [number, number, number, number];
type Rvb = [number, number, number];
const CADRE_BLEU: Rvb = [100, 155, 255];
const CADRE_DORE: Rvb = [200, 160, 80];
const CADRE_GRIS: Rvb = [120, 120, 120];
const CADRE_BRONZE: Rvb = [97, 72, 33];

// L'écran de préparation recomposé : fond brun, les cartes à leur place, cadre
// BLEU pour les attaquants d'un deck préréglé (`cadreAttaque` : doré pour un
// deck composé sur le moment, bronze, gris…) et DORÉ pour la défense, comme
// dans le jeu ; VIT des attaquants (les trois premières cartes qui en ont une
// dans `vitesses`) dans une pastille en bas à droite (`pc` : chiffres de la
// fenêtre PC, plus petits et plus bas).
function dessiner(l: number, h: number, rects: Rect[], portraits: Image[], vitesses: string[], pc: boolean, cadreAttaque: Rvb = CADRE_BLEU, cadreDefense: Rvb = CADRE_DORE): Image {
  const img = imageUnie(l, h, [52, 40, 30]);
  portraits.forEach((p, k) => {
    if (!rects[k]) return;
    const [x, y, cl, ch] = rects[k];
    coller(img, imageUnie(4, 4, k < 3 ? cadreAttaque : cadreDefense), x, y, cl, ch);
    const cadre = Math.round(cl * 0.04);
    coller(img, p, x + cadre, y + cadre, cl - 2 * cadre, ch - 2 * cadre);
    if (k >= 3 || vitesses[k] === undefined) return;
    if (pc) {
      // PC : des chiffres de 9 pixels, plus bas dans la carte.
      const n = nombre(vitesses[k], Math.round(ch * 0.096));
      coller(img, imageUnie(4, 4, [40, 40, 44]), x + 0.62 * cl, y + 0.83 * ch, 0.34 * cl, 0.13 * ch);
      coller(img, n, x + 0.66 * cl, y + 0.845 * ch - 4, n.largeur, n.hauteur);
    } else {
      const n = nombre(vitesses[k], Math.round(ch * 0.105));
      coller(img, imageUnie(4, 4, [40, 40, 44]), x + 0.62 * cl, y + 0.79 * ch, 0.34 * cl, 0.16 * ch);
      coller(img, n, x + 0.66 * cl, y + 0.8 * ch, n.largeur, n.hauteur);
    }
  });
  return img;
}

// Des mises en page relevées sur de vraies captures, pour placer les cartes :
// bord gauche de chaque carte en fraction de la hauteur depuis le centre,
// haut et côté en fraction de la hauteur. Le lecteur, lui, ne les connaît pas.
const MISES_EN_PAGE = {
  telephone: { x: [-0.7371, -0.5564, -0.3749, 0.218, 0.3986, 0.5801], y: 0.2578, cote: 0.1535 }, // 2556 × 1179
  fenetre: { x: [-0.6473, -0.5057, -0.3629, 0.2328, 0.3756, 0.5185], y: 0.2793, cote: 0.1199 }, // 1417 × 784, barre de titre comprise
};

function ecran(portraits: Image[], vitesses: string[], l = 2556, h = 1179, mise: keyof typeof MISES_EN_PAGE = 'telephone', cadreAttaque: Rvb = CADRE_BLEU, cadreDefense: Rvb = CADRE_DORE): Image {
  const m = MISES_EN_PAGE[mise];
  const rects = m.x.map((x): Rect => [l / 2 + x * h, m.y * h, m.cote * h, m.cote * h]);
  return dessiner(l, h, rects, portraits, vitesses, mise === 'fenetre', cadreAttaque, cadreDefense);
}

// Une mise en page libre : taille, pas et position des cartes donnés ; des
// cartes carrées sauf hauteur donnée.
function ecranLibre(l: number, h: number, x0: number, y: number, c: number, pas: number, x0Defense: number | null, portraits: Image[], vitesses: string[], pc: boolean, hauteur = c, cadreAttaque: Rvb = CADRE_BLEU): Image {
  const rects: Rect[] = [0, 1, 2].map((k) => [x0 + k * pas, y, c, hauteur]);
  if (x0Defense !== null) rects.push(...[0, 1, 2].map((k): Rect => [x0Defense + k * pas, y, c, hauteur]));
  return dessiner(l, h, rects, portraits, vitesses, pc, cadreAttaque);
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
  // Deux écrans 4K, capturés d'un coup (Win + Impr. écran) : pas trop grand.
  new DataView(geant.buffer, geant.byteOffset).setUint32(16, 7680);
  new DataView(geant.buffer, geant.byteOffset).setUint32(20, 2160);
  egal(imageTropGrande(geant), false, 'capture de deux écrans 4K (7680 × 2160) : acceptée');

  const img = imageUnie(10, 10, [1, 2, 3]);
  egal([decouper(img, 8, 8, 5, 5)?.largeur, decouper(img, -3, 0, 5, 5)?.largeur], [2, 2], 'découpe ramenée dans l\'image');
  egal(decouper(img, 20, 20, 5, 5), null, 'découpe hors de l\'image : rien');
  const damier = imageUnie(2, 2, [0, 0, 0]);
  damier.rgba.set([200, 100, 0, 255], 0);
  egal(Array.from(reduire(damier, 1, 1)), [50, 25, 0], 'réduction : moyenne de surface');
  const demi = demiTaille(damier);
  egal([demi.largeur, demi.hauteur, Array.from(demi.rgba.subarray(0, 3))], [1, 1, [50, 25, 0]], 'demi-taille : la moyenne de chaque carré de 2 × 2');
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
  const lecture = lireEcranPreparation(ecr, banque, gabarits)!;
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
  // Chiffres soudés (aucune colonne vide entre eux) : séparés à leur colonne
  // la moins encrée, plutôt que lus comme un seul glyphe.
  egal(lireNombre(nombre('364', 19, true), gabarits)?.texte, '364', 'chiffres soudés : séparés');
  // L'icône de vitesse dans la zone, à gauche du nombre et plus écartée de lui
  // que deux chiffres entre eux : pas lue comme un chiffre.
  const n = nombre('314', 14);
  const avecIcone = imageUnie(n.largeur + 24, n.hauteur, [40, 40, 44]);
  coller(avecIcone, imageUnie(2, 2, [240, 240, 240]), 2, 4, 11, 14);
  coller(avecIcone, n, 24, 0, n.largeur, n.hauteur);
  egal(lireNombre(avecIcone, gabarits)?.texte, '314', 'icône de vitesse à gauche : écartée du nombre');
  // Les gabarits sont rendus à la taille du chiffre : les petits caractères
  // d'une fenêtre PC réduite se lisent ; sous 5 pixels, plus rien.
  for (const h of [7, 8, 9]) egal(lireNombre(nombre('349', h), gabarits)?.texte, '349', `chiffres de ${h} pixels : lus`);
  egal(lireNombre(nombre('339', HAUTEUR_CHIFFRE_MIN - 1), gabarits), null, `chiffres de ${HAUTEUR_CHIFFRE_MIN - 1} pixels (< ${HAUTEUR_CHIFFRE_MIN}) : non lus`);
}

// ---- Écran de préparation ----------------------------------------------------

export function testCaptureEcran() {
  titre('Speed tune par capture — écran de préparation : monstres et VIT');
  const banque = banqueDe([1, 2, 3, 4, 5, 6].map((id) => ({ id, img: portrait(id * 7, [ROUGE, BLEU, VERT][id % 3]) })));
  const portraits = [1, 2, 3, 4, 5, 6].map((id) => portrait(id * 7, [ROUGE, BLEU, VERT][id % 3]));
  // Le lecteur ne connaît aucune mise en page : les cartes se trouvent à leurs
  // cadres, quel que soit le format.
  const lire = (img: Image) => {
    const r = lireEcranPreparation(img, banque, gabarits);
    return r && { att: r.attaquants.map((a) => [a.portrait?.meilleur.com2usId, a.vitesse?.valeur ?? null]), def: r.defense.map((d) => d.portrait?.meilleur.com2usId) };
  };
  egal(lire(ecran(portraits, ['357', '367', '385'])), { att: [[1, 357], [2, 367], [3, 385]], def: [4, 5, 6] }, 'téléphone 2556 × 1179 : attaquants, VIT et défense');
  egal(lire(ecran(portraits, ['239', '286', '301'], 1278, 590))?.att.map((a) => a[1]), [239, 286, 301], 'téléphone en demi-résolution : VIT lues');
  // La fenêtre du jeu sur PC (1417 × 784) : cartes plus petites, défense plus
  // loin, chiffres de 9 pixels.
  egal(lire(ecran(portraits, ['364', '396', '361'], 1417, 784, 'fenetre')), { att: [[1, 364], [2, 396], [3, 361]], def: [4, 5, 6] }, 'fenêtre PC avec barre de titre');
  // Fenêtre PC sans barre de titre (relevé : 1187 × 646, cartes de 81 px au
  // pas de 96, défense à 752).
  egal(lire(ecranLibre(1187, 646, 161, 162, 81, 96, 752, portraits, ['339', '384', '363'], true)),
    { att: [[1, 339], [2, 384], [3, 363]], def: [4, 5, 6] }, 'fenêtre PC sans barre de titre');
  egal(lire(ecranLibre(2048, 1536, 260, 610, 200, 236, 1112, portraits, ['301', '298', '402'], false)),
    { att: [[1, 301], [2, 298], [3, 402]], def: [4, 5, 6] }, 'tablette 4:3');
  egal(lire(ecranLibre(3200, 1440, 610, 380, 220, 262, 2034, portraits, ['250', '311', '199'], false)),
    { att: [[1, 250], [2, 311], [3, 199]], def: [4, 5, 6] }, 'téléphone 20:9, plus grand');
  // Des cartes plus larges que hautes : la VIT se cherche dans la carte
  // mesurée, pas dans un carré qui déborderait sous elle.
  egal(lire(ecranLibre(420, 110, 60, 8, 107, 116, null, portraits.slice(0, 3), ['314', '404', '355'], false, 92)),
    { att: [[1, 314], [2, 404], [3, 355]], def: [] }, 'cartes plus larges que hautes');
  // Recadrée sur les seuls attaquants : pas de défense, et le symétrique des
  // attaquants ne retombe pas sur eux.
  egal(lire(ecranLibre(330, 130, 31, 22, 81, 96, null, portraits.slice(0, 3), ['339', '384', '363'], true)),
    { att: [[1, 339], [2, 384], [3, 363]], def: [] }, 'les trois attaquants seuls');
  egal(lire(ecranLibre(276, 84, 1, 1, 81, 96, null, portraits.slice(0, 3), ['339', '384', '363'], true)),
    { att: [[1, 339], [2, 384], [3, 363]], def: [] }, 'les trois attaquants, au ras des cadres');
  // Sans la défense à droite (cadres dorés absents) : le symétrique des
  // attaquants par rapport au centre.
  egal(lire(ecranLibre(1187, 646, 161, 162, 81, 96, null, portraits.slice(0, 3), ['339', '384', '363'], true))?.def.length, 3,
    'défense non trouvée : trois cartes au symétrique des attaquants');
  // Des chiffres trop petits : VIT non lue, plutôt que fausse.
  egal(lire(ecranLibre(594, 323, 80, 81, 41, 48, 376, portraits, ['339', '384', '363'], true))?.att.map((a) => a[1]), [null, null, null],
    'capture trop réduite : VIT non lues');
  // Un deck composé sur le moment : attaquants à cadres DORÉS, comme la défense ; le
  // trio le plus à gauche.
  egal(lire(ecran(portraits, ['316', '201', '227'], 1417, 784, 'fenetre', CADRE_DORE)), { att: [[1, 316], [2, 201], [3, 227]], def: [4, 5, 6] },
    'attaquants à cadres dorés : le trio de gauche');
  egal(lire(ecranLibre(317, 125, 20, 22, 80, 94, null, portraits.slice(0, 3), ['316', '201', '227'], true, 80, CADRE_DORE)), { att: [[1, 316], [2, 201], [3, 227]], def: [] },
    'trois cartes dorées seules');
  // La couleur du cadre ne compte pas : les cartes se trouvent à leur contour.
  egal(lire(ecranLibre(596, 249, 77, 63, 132, 151, null, portraits.slice(0, 3), ['337', '404', '368'], false, 134, CADRE_BRONZE)),
    { att: [[1, 337], [2, 404], [3, 368]], def: [] }, 'cadres bronze, cartes seules');
  egal(lire(ecran(portraits, ['357', '367', '385'], 2556, 1179, 'telephone', CADRE_GRIS, CADRE_GRIS)),
    { att: [[1, 357], [2, 367], [3, 385]], def: [4, 5, 6] }, 'cadres gris : lus comme les autres');
  // Les attaquants sont les cartes qui portent une VIT, quelles que soient
  // leur taille et leur place : la liste des monstres aligne des vignettes
  // presque de la même taille, sans VIT.
  const liste = [0, 1, 2, 3, 4, 5].map((k): Rect => [161 + k * 85, 470, 77, 77]);
  const avecListe = dessiner(1187, 646, [[161, 162, 81, 81], [257, 162, 81, 81], [353, 162, 81, 81], ...liste], [...portraits.slice(0, 3), ...portraits, portraits[0]], ['339', '384', '363'], true);
  egal(lire(avecListe)?.att, [[1, 339], [2, 384], [3, 363]], 'liste des monstres sous l\'équipe : écartée');
  egal(lire(dessiner(700, 200, liste.map(([x, , c]): Rect => [x - 100, 60, c, c]), portraits, [], true, CADRE_GRIS, CADRE_GRIS)), null,
    'une rangée de six cartes sans VIT : pas d\'attaquant');
  const auDessus = [0, 1, 2].map((k): Rect => [40 + k * 130, 20, 110, 110]);
  const sousGrandes = dessiner(1187, 646, [[161, 300, 81, 81], [257, 300, 81, 81], [353, 300, 81, 81], ...auDessus], [...portraits.slice(0, 3), ...portraits.slice(3, 6)], ['339', '384', '363'], true);
  egal(lire(sousGrandes)?.att, [[1, 339], [2, 384], [3, 363]], 'des cartes plus grandes, sans VIT, au-dessus de l\'équipe : écartées');
  // Une capture de tout l'écran (4K), la fenêtre du jeu dans un coin : des
  // cartes de 81 pixels sur 3840, petites devant l'image.
  egal(lire(ecranLibre(3840, 2160, 2900, 1700, 81, 96, 3491, portraits, ['339', '384', '363'], true)),
    { att: [[1, 339], [2, 384], [3, 363]], def: [4, 5, 6] }, 'capture de tout un écran 4K : la fenêtre du jeu dans un coin');
  // Sans trois cartes à VIT : écran non reconnu, aucune position supposée.
  egal(lire(dessiner(600, 300, [[100, 100, 81, 81]], portraits.slice(0, 1), ['339'], true)), null, 'une seule carte : écran non reconnu');
  egal(lire(imageUnie(800, 400, [52, 40, 30])), null, 'écran vide : non reconnu');
  // Une VIT hors de portée du jeu n'est pas une VIT.
  const absurde = lireEcranPreparation(ecran(portraits, ['9', '999', '357']), banque, gabarits)!;
  egal(absurde.attaquants.map((a) => a.vitesse?.valeur ?? null), [null, null, 357], 'VIT invraisemblable : écartée');
}

// ---- Vraies captures -----------------------------------------------------------

// Les vraies captures de tests/captures-speedtune/ : IGNORÉES par Git (dépôt
// public), seul attendus.json est versionné. Sur une machine qui ne les a
// pas (la CI), la vérification s'affiche ignorée. Pour en ajouter une : la
// poser dans le dossier et inscrire ses trois VIT et ses trois monstres dans
// attendus.json — une capture sans valeurs attendues fait échouer. `vit` :
// ce que la lecture doit rendre, `null` pour une VIT qu'elle refuse encore
// (chiffres trop petits) ; `vitReelles` : les vraies, quand elles diffèrent,
// pour qu'aucune lecture fausse ne passe.
const DOSSIER_CAPTURES = 'tests/captures-speedtune';
interface CaptureAttendue { ecran: string; vit: (number | null)[]; vitReelles?: number[]; monstres: number[] }

// L'image à l'échelle k : moyenne de surface en réduction, bilinéaire en
// agrandissement (ce que fait un logiciel de capture ou Discord).
function aLEchelle(src: Image, k: number): Image {
  const l = Math.round(src.largeur * k), h = Math.round(src.hauteur * k);
  const rgba = new Uint8Array(l * h * 4);
  const p = (x: number, y: number, c: number) => src.rgba[(y * src.largeur + x) * 4 + c];
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) for (let c = 0; c < 4; c++) {
    let v: number;
    if (k < 1) {
      const x0 = Math.floor(x / k), x1 = Math.min(src.largeur, Math.max(x0 + 1, Math.floor((x + 1) / k)));
      const y0 = Math.floor(y / k), y1 = Math.min(src.hauteur, Math.max(y0 + 1, Math.floor((y + 1) / k)));
      let s = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) s += p(xx, yy, c);
      v = s / ((y1 - y0) * (x1 - x0));
    } else {
      const fx = Math.min(src.largeur - 1.001, Math.max(0, (x + 0.5) / k - 0.5)), fy = Math.min(src.hauteur - 1.001, Math.max(0, (y + 0.5) / k - 0.5));
      const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
      v = (1 - ay) * ((1 - ax) * p(x0, y0, c) + ax * p(x0 + 1, y0, c)) + ay * ((1 - ax) * p(x0, y0 + 1, c) + ax * p(x0 + 1, y0 + 1, c));
    }
    rgba[(y * l + x) * 4 + c] = v;
  }
  return { largeur: l, hauteur: h, rgba };
}

// La capture posée dans une capture de tout un écran 4K : bureau sombre, une
// autre fenêtre claire à droite.
function dansUnEcran(src: Image): Image {
  const l = 3840, h = 2160;
  const img = imageUnie(l, h, [32, 34, 40]);
  coller(img, imageUnie(4, 4, [235, 235, 240]), 2900, 200, 900, 1100);
  const x0 = Math.round((l - src.largeur) / 3), y0 = Math.round((h - src.hauteur) / 2);
  for (let y = 0; y < src.hauteur; y++) img.rgba.set(src.rgba.subarray(y * src.largeur * 4, (y + 1) * src.largeur * 4), ((y0 + y) * l + x0) * 4);
  return img;
}

export function testCapturesReelles() {
  titre('Speed tune par capture — vraies captures (tests/captures-speedtune, hors du dépôt)');
  const attendus = JSON.parse(readFileSync(`${DOSSIER_CAPTURES}/attendus.json`, 'utf8')) as Record<string, CaptureAttendue>;
  const presentes = existsSync(DOSSIER_CAPTURES) ? readdirSync(DOSSIER_CAPTURES).filter((f) => f !== 'attendus.json') : [];
  if (!presentes.length) {
    ignore('vraies captures', 'aucune capture dans tests/captures-speedtune (gitignoré)');
    return;
  }
  egal(presentes.filter((f) => !attendus[f]), [], 'chaque capture du dossier a ses valeurs attendues (attendus.json)');
  const banque = new Banque(banqueJson as unknown as BanqueSerialisee);
  const lire = (img: Image) => {
    const r = lireEcranPreparation(img, banque, gabarits);
    return r && { vit: r.attaquants.map((a) => a.vitesse?.valeur ?? null), monstres: r.attaquants.map((a) => a.portrait?.meilleur.com2usId ?? null) };
  };
  for (const [fichier, a] of Object.entries(attendus)) {
    if (!presentes.includes(fichier)) {
      ignore(fichier, 'capture absente de cette machine');
      continue;
    }
    const img = decoderImage(new Uint8Array(readFileSync(`${DOSSIER_CAPTURES}/${fichier}`)));
    if (!img) {
      ok(false, `${fichier} : décodée`);
      continue;
    }
    // Telle quelle : tout est lu, juste.
    egal(lire(img), { vit: a.vit, monstres: a.monstres }, `${fichier} (${a.ecran}) : les trois VIT et les trois monstres`);
    // Sous une autre forme : une VIT peut être refusée (chiffres trop petits),
    // jamais fausse.
    const formes: [string, Image][] = [
      ['réduite à 85 %', aLEchelle(img, 0.85)],
      ['agrandie à 130 %', aLEchelle(img, 1.3)],
      ['en JPEG', decoderImage(new Uint8Array(jpeg.encode({ data: Buffer.from(img.rgba), width: img.largeur, height: img.hauteur }, 80).data))!],
      ['posée dans une capture de tout un écran 4K', dansUnEcran(img)],
    ];
    for (const [forme, variante] of formes) {
      const r = lire(variante);
      const vraies = a.vitReelles ?? a.vit;
      egal(r ? r.vit.filter((v, i) => v !== null && v !== vraies[i]) : [], [], `${fichier}, ${forme} : aucune VIT fausse`);
    }
  }
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
    auteur: '1569358973419659324',
  };
  egal(decoderEtat(encoderEtat('s1', etat)), { action: 's1', etat }, 'aller-retour sans perte');
  const pire: Etat = {
    attaquants: [0, 1, 2].map(() => ({ id: 99999, combat: 450, cumuls: 24, arte: 60, vitDouteuse: true, autrePortrait: 99999 })),
    defense: [99999, 99999, 99999],
    auteur: '18446744073709551615', // le plus grand identifiant Discord possible
  };
  ok(encoderEtat('c2', pire).length <= LONGUEUR_MAX, 'le pire cas tient dans un custom_id (100 caractères), doutes compris');
  egal(decoderEtat(encoderEtat('c2', pire))?.etat.attaquants[0].autrePortrait, 99999, 'le pire cas garde ses doutes');
  egal(decoderEtat(encoderEtat('c2', pire))?.etat.auteur, '18446744073709551615', 'l\'auteur relu au chiffre près (au-delà de la précision d\'un nombre)');
  egal(decoderEtat('st3:c0:1.2.p...::1'), null, 'plus de cumuls qu\'un menu n\'en propose : refusé');
  egal(decoderEtat('st3:a0:1.2..1p..::1'), null, 'plus de 60 % d\'effet aug. VIT : refusé');
  egal(decoderEtat('st3:c0:1.2...x.::1'), null, 'champ inattendu : refusé');
  egal(decoderEtat('st3:c0:1.2....::'), null, 'sans auteur : refusé');
  egal(decoderEtat('st2:c0:1.2....:::1'), null, 'ancien format (avec le set Rapide) : refusé');
  egal(decoderEtat('st1:c0:1.2....::'), null, 'ancien format (avant l\'auteur) : refusé');

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
  const telecharges: string[] = [];
  // Le CDN de Discord : la capture en PNG, la même en WebP (que le proxy
  // d'images rend en PNG sur demande), un GIF qu'il ne convertit pas.
  const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
  const fichiers: Record<string, Response | (() => Response)> = {
    'https://cdn.discordapp.com/c.png': () => new Response(new Uint8Array(octets)),
    'https://cdn.discordapp.com/c.webp': () => new Response(webp),
    'https://media.discordapp.net/c.webp?format=png': () => new Response(new Uint8Array(octets)),
    'https://cdn.discordapp.com/c.gif': () => new Response(new TextEncoder().encode('GIF89a')),
    'https://media.discordapp.net/c.gif?format=png': () => new Response(null, { status: 415 }),
    'https://cdn.discordapp.com/image.png': () => new Response(new Uint8Array(octets)),
    'https://cdn.discordapp.com/c.pdf': () => new Response(new TextEncoder().encode('%PDF-1.7')),
    'https://media.discordapp.net/c.pdf?format=png': () => new Response(null, { status: 415 }),
  };
  const service = creerInteractions({
    clePublique: cle,
    applicationId: 'APP',
    recuperer: async (url, init) => {
      const f = fichiers[url];
      if (f) { telecharges.push(url); return typeof f === 'function' ? f() : f; }
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
  const perime = await (await envoyer(choix('1', '111', 'st3:s0:abc'))).json() as { type: number };
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
  // Tout est précisé : le résultat, et sous lui le seul lien vers l'outil.
  const final = dernier();
  egal(final.url, 'https://discord.com/api/v10/webhooks/APP/C/messages/@original', 'le résultat remplace la question');
  egal(final.corps.components, [{ type: 1, components: [{ type: 2, style: 5, label: 'Ouvrir l\'outil de speed tuning', url: LIEN_OUTIL }] }],
    'les menus disparaissent ; reste le bouton vers l\'outil de speed tuning, sans bouton Rapide');
  ok(final.corps.embeds[0].footer?.text.startsWith('Fiche calculée sans le set Rapide') === true, 'la fiche se dit calculée sans le set Rapide');
  egal(LIEN_OUTIL, 'https://sw-blacksmith.vercel.app/#/outils/speed-tuning', 'l\'outil du site de production');
  egal(final.corps.embeds.length, 1, 'un seul encart, compact');
  ok(['⚡ Speed tune — personne ne se fait cut', '⚡ Speed tune — quelqu\'un se fait cut'].includes(final.corps.embeds[0].title), 'le titre parle comme les joueurs : « se faire cut »');
  const embed = final.corps.embeds[0];
  const champ = (nom: string) => embed.fields?.find((f) => f.name === nom)?.value ?? '';
  ok(champ('Précisé').includes('Passif de **Chilling** : 1 cumul (+20 VIT)'), 'les cumuls retenus sont rappelés');
  ok(champ('Précisé').includes('**Susano** : Effet aug. VIT +4 à 6 %'), 'l\'effet aug. VIT retenu est rappelé, par sa tranche');
  ok(!/buff/i.test(champ('Précisé')), 'sans la valeur du buff');
  ok(!embed.fields?.some((f) => f.name === 'Set Rapide'), 'plus de champ Set Rapide');
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
  ok(ordre.includes(`fiche ${tarq.stats.speed} + ${runesDe(tarq, 385, false)}`), 'Tarq : sa VIT de fiche, sans Rapide');
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
  egal(await titreDe({ url: 'https://cdn.discordapp.com/c.gif', content_type: 'image/gif', size: 10 }), embedErreur('en', 'pasImage').description,
    'ni PNG ni JPEG, et Discord ne la convertit pas : refusée');
  egal(await titreDe({ url: 'https://cdn.discordapp.com/c.pdf', content_type: 'application/pdf', size: 10 }), embedErreur('en', 'pasImage').description,
    'pas une image : ses octets le disent, refusée');
  // Une capture collée (Ctrl+V) : son type annoncé ne compte pas, ses octets
  // si.
  for (const type of [undefined, 'application/octet-stream', 'image/png'])
    ok(![embedErreur('en', 'pasImage').description, embedErreur('en', 'panne').description].includes(await titreDe({ url: 'https://cdn.discordapp.com/image.png', content_type: type, size: octets.length })),
      `capture collée, type annoncé ${type ?? 'absent'} : lue`);
  telecharges.length = 0;
  ok(await titreDe({ url: 'https://cdn.discordapp.com/c.webp', content_type: 'image/webp', size: webp.length }) !== embedErreur('en', 'pasImage').description
    && telecharges.includes('https://media.discordapp.net/c.webp?format=png'), 'une capture WebP : rendue en PNG par Discord, puis lue');
  egal(adresseEnPng({ url: 'https://cdn.discordapp.com/a/b.webp?ex=1', proxy_url: 'https://media.discordapp.net/a/b.webp?ex=1', size: 1 }),
    'https://media.discordapp.net/a/b.webp?ex=1&format=png', 'la conversion passe par le proxy d\'images, paramètres gardés');
  egal(adresseEnPng({ url: 'https://ailleurs.example/b.webp', proxy_url: 'https://ailleurs.example/b.webp', size: 1 }), null, 'jamais hors de Discord');
  egal(await titreDe({ url: 'https://cdn.discordapp.com/c.png', content_type: 'image/png', size: 26 * 1024 * 1024 }), embedErreur('en', 'tropLourde').description, 'plus de 25 Mo : refusé avant téléchargement');
  egal([langueDe('fr'), langueDe('en-GB'), langueDe(undefined)], ['fr', 'en', 'en'], 'langue : français, sinon anglais');

  // Discord refuse le message (corps invalide, jeton expiré…) : ce n'est pas
  // une exception, mais le service doit le voir et retomber sur la panne
  // plutôt que laisser « réfléchit… » pour toujours.
  const tentatives: string[] = [];
  const refuse = creerInteractions({
    clePublique: cle,
    applicationId: 'APP',
    recuperer: async (url, init) => {
      if (url === 'https://cdn.discordapp.com/c.png') return new Response(new Uint8Array(octets));
      const corps = JSON.parse(String(init?.body)) as { embeds: Embed[] };
      tentatives.push(corps.embeds[0].description ?? corps.embeds[0].title);
      return tentatives.length === 1 ? new Response('{"code":50035}', { status: 400 }) : new Response(null, { status: 204 });
    },
    differer: (t) => travaux.push(t),
    ressources: async () => ressources,
  });
  travaux.length = 0;
  const corpsRefus = JSON.stringify(commande({ url: 'https://cdn.discordapp.com/c.png', content_type: 'image/png', size: octets.length }));
  await refuse.traiter(new Request('https://x/api/interactions', { method: 'POST', body: corpsRefus, headers: { 'x-signature-ed25519': sign(null, Buffer.from('7' + corpsRefus), privateKey).toString('hex'), 'x-signature-timestamp': '7' } }));
  await Promise.all(travaux);
  egal([tentatives.length, tentatives[1]], [2, embedErreur('fr', 'panne').description], 'message refusé par Discord : le service le voit et envoie la panne');
}
