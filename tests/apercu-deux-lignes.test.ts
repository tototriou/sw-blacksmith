// Recommandations — l'aperçu replié sur deux lignes (src/lib/apercuDeuxLignes.ts) :
// la recherche du nombre de pastilles qui tient, et le compte des rangées.
// ⚠️ La borne du nombre d'étapes est l'invariant qui compte : chaque étape est
// un rendu synchrone, et React démonte toute l'app au-delà de 50.

import { compterLignes, etapeRecherche, rechercheInitiale, type RechercheApercu } from '../src/lib/apercuDeuxLignes';
import { egal, ok, titre } from './outils';

// Rejoue la boucle du composant : rendre l'essai, le mesurer, passer au
// suivant. Rend le nombre retenu et le nombre de rendus.
function rejouer(n: number, tient: (k: number) => boolean): { retenu: number; rendus: number } {
  let r: RechercheApercu | null = rechercheInitiale('cle', n);
  let retenu = n;
  let rendus = 0;
  while (r) {
    rendus += 1;
    retenu = r.essai;
    if (rendus > 200) break;
    r = etapeRecherche(r, tient(r.essai));
  }
  return { retenu, rendus };
}

export function testApercuDeuxLignesRecherche() {
  titre('recos · aperçu replié — la dichotomie retient le plus grand nombre qui tient');
  let exact = true;
  let pire = 0;
  for (let n = 0; n <= 70; n++) {
    for (let seuil = 0; seuil <= n; seuil++) {
      const { retenu, rendus } = rejouer(n, (k) => k <= seuil);
      if (retenu !== seuil) exact = false;
      pire = Math.max(pire, rendus);
    }
  }
  ok(exact, 'jusqu’à 70 pastilles, pour chaque seuil : le nombre retenu est le seuil exact');
  ok(pire < 50, `jusqu’à 70 pastilles : au plus ${pire} rendus, sous la limite de 50 de React`);

  egal(rejouer(5, () => true), { retenu: 5, rendus: 1 }, 'tout tient : un seul rendu, toutes les pastilles');
  egal(rejouer(0, () => true), { retenu: 0, rendus: 1 }, 'aucune pastille : un seul rendu');
  egal(rejouer(8, () => false).retenu, 0, 'rien ne tient (la fin seule déborde) : aucune pastille');
}

export function testApercuDeuxLignesBorne() {
  titre('recos · aperçu replié — des centaines de decks restent sous 50 rendus');
  for (const n of [51, 233, 1000, 100_000]) {
    for (const seuil of [0, 1, Math.floor(n / 3), n - 1, n]) {
      const { retenu, rendus } = rejouer(n, (k) => k <= seuil);
      ok(retenu === seuil && rendus <= 2 * Math.log2(n + 1) + 3,
        `${n} pastilles, ${seuil} tiennent : ${retenu} retenues en ${rendus} rendus`);
    }
  }
}

export function testApercuDeuxLignesNonMonotone() {
  titre('recos · aperçu replié — une mesure non monotone ne retient jamais un nombre qui déborde');
  // Un « +N » qui perd un chiffre peut faire tenir k sans faire tenir k - 1.
  const tient = (k: number) => k <= 10 || k === 30;
  let r: RechercheApercu | null = rechercheInitiale('cle', 60);
  let dernier = 60;
  while (r) {
    dernier = r.essai;
    r = etapeRecherche(r, tient(r.essai));
  }
  ok(tient(dernier), `le nombre retenu (${dernier}) a été mesuré comme tenant`);
}

export function testApercuDeuxLignesFinQuiGrandit() {
  titre('recos · aperçu replié — la fin grandit après la recherche : on repart, sans déborder');
  // Recherche finie à 30 sur 60, puis seules 12 pastilles tiennent encore.
  let r: RechercheApercu | null = rechercheInitiale('cle', 60);
  let dernier = 60;
  while (r) { dernier = r.essai; const suivante: RechercheApercu | null = etapeRecherche(r, r.essai <= 30); if (!suivante) break; r = suivante; }
  egal(dernier, 30, 'première recherche : 30 retenues');
  let rendus = 0;
  while (r) {
    dernier = r.essai;
    rendus += 1;
    r = etapeRecherche(r, r.essai <= 12);
  }
  ok(dernier === 12 && rendus < 50, `la place réduite : ${dernier} retenues en ${rendus} rendus`);
}

export function testApercuDeuxLignesRangees() {
  titre('recos · aperçu replié — les rangées comptées par chevauchement vertical');
  egal(compterLignes([]), 0, 'rien : aucune rangée');
  egal(compterLignes([{ top: 0, bottom: 20 }, { top: 0, bottom: 20 }]), 1, 'même haut : une rangée');
  egal(compterLignes([{ top: 0, bottom: 24 }, { top: 4, bottom: 20 }]), 1, 'plus petit et centré sur la ligne : la même rangée');
  egal(compterLignes([{ top: 0, bottom: 20 }, { top: 26, bottom: 46 }, { top: 52, bottom: 72 }]), 3, 'trois rangées');
  egal(compterLignes([{ top: 0, bottom: 20 }, { top: 19.5, bottom: 40 }]), 2, 'un recouvrement de moins d’un pixel : rangée suivante');
}
