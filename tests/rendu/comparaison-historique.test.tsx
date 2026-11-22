// Tests de rendu — le sous-onglet « Historique » de la Comparaison
// (docs/02-app/compte/feat-runes/comparaison.md, « Historique »). Il lit
// l'archive du plugin SWEX : sur le site, l'onglet reste affiché, désactivé,
// et dit pourquoi ; dans l'application de bureau, il s'ouvre.

import RunesCompare from '../../src/components/account/RunesCompare';
import { amorcerMemoire } from '../../src/hooks/useStickyState';
import { ok, titre } from '../outils';
import { onglets, rendre, texteVisible } from './outils-rendu';

export function testRenduComparaisonHistorique() {
  titre('rendu · Comparaison › Historique — sur le site');
  const site = onglets(rendre(<RunesCompare runes={[]} />));
  const historique = site.find((o) => o.texte === 'Historique');
  ok(site.map((o) => o.texte).join(' · ') === 'Courbes partagées · Fichiers de compte · Historique', 'trois sous-onglets, l’historique en dernier');
  ok(
    historique?.desactive === true &&
      historique.title === "L'historique se lit dans l'application de bureau, avec le plugin SW Blacksmith Live.",
    'désactivé, avec la raison en infobulle'
  );

  titre('rendu · Comparaison › Historique — dans l’application de bureau');
  const pont = globalThis as { swblacksmithBureau?: unknown };
  pont.swblacksmithBureau = {
    bureau: true,
    plateforme: 'win32',
    swex: { historique: () => new Promise(() => {}), etatHistorique: () => new Promise(() => {}), surHistoriqueChange: () => () => {} },
  };
  amorcerMemoire({ 'runesCompare.tab': 'historique' });
  try {
    const html = rendre(<RunesCompare runes={[]} />);
    const ouvert = onglets(html).find((o) => o.texte === 'Historique');
    ok(ouvert?.desactive === false && ouvert.ouvert, 'l’onglet est disponible, et s’ouvre');
    const texte = texteVisible(html);
    ok(texte.includes("Lecture de l'historique…"), 'pendant la lecture de l’archive, il le dit');
    ok(texte.includes('Aucune date'), 'la liste des dates est là, vide, avant la réponse');
    ok(texte.includes('Nb de runes'), 'les filtres de la Comparaison sont là');
  } finally {
    delete pont.swblacksmithBureau;
    amorcerMemoire({ 'runesCompare.tab': 'courbes' });
  }
}
