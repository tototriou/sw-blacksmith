// Les tableaux par membre de Siège › Statistiques : attaques et défenses
// (`tableauAttaques`, `tableauDefenses` de src/lib/siegeStatistiques.ts),
// dessinés par le `Tableau` de la librairie (src/ui/Tableau.tsx).
//
// À l'ouverture, aucune colonne ne trie : l'ordre alphabétique des joueurs
// (celui de `tableauAttaques` et `tableauDefenses`), où le tableau revient au
// troisième clic sur un en-tête.
//
// ⚠️ **Compacts** : pas de colonne qui se déduit des autres (les attaques
// faites = V + D ; les monstres utilisés = 3 par attaque). Une tour (5★, 4★)
// tient dans une colonne : « gagnées/toutes », son WR en infobulle.

import { UserMinus } from 'lucide-react';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import { formatNombre } from '../../i18n/format';
import type { JoueurSiege, LigneAttaques, LigneDefenses } from '../../lib/siegeStatistiques';
import { Tableau, type ColonneTableau } from '../../ui';

// ⚠️ **Un ancien membre** (`anciensMembres`, « Tous les sièges ») reste dans le
// tableau — c'est l'historique de la guilde — mais à part, en fin de tableau
// sous l'intertitre « Anciens membres », quel que soit le tri ; et son nom se
// distingue : encre pâle, icône devant (le nom peut être tronqué, pas elle),
// et la mention dans l'infobulle et le nom accessible.
function useCommun(anciens: Set<number>) {
  const textes = useTraduction();
  const langue = useLangue();
  const s = textes.siegeStats;
  const e = s.ensemble;
  const nombre = (n: number) => formatNombre(n, langue, { maximumFractionDigits: 0 });
  const pourcent = (n: number | null) => (n === null ? <span className="text-ink-dimmer">—</span> : `${nombre(n)} %`);
  const col = (cle: keyof typeof e.colonnes) => ({ cle, libelle: e.colonnes[cle], titre: e.titresColonnes[cle] });
  const nom = (j: JoueurSiege) => j.nom || s.joueurInconnu;
  const colJoueur = <L extends { joueur: JoueurSiege }>(): ColonneTableau<L> => ({
    ...col('joueur'),
    fixe: true,
    valeur: (l) => nom(l.joueur),
    rendu: (l) =>
      anciens.has(l.joueur.id) ? (
        <span className="text-ink-dim">
          <UserMinus size={12} aria-hidden="true" className="mr-1 inline-block align-[-1px]" />
          {nom(l.joueur)}
        </span>
      ) : (
        nom(l.joueur)
      ),
    titreCellule: (l) => (anciens.has(l.joueur.id) ? s.ancienMembre : undefined),
  });
  const libelleLigne = (l: { joueur: JoueurSiege }) =>
    anciens.has(l.joueur.id) ? `${s.voirJoueur(nom(l.joueur))} (${s.ancienMembre})` : s.voirJoueur(nom(l.joueur));
  // Les anciens membres, à part en fin de tableau, sous leur intertitre.
  const aPart = {
    ligne: (l: { joueur: JoueurSiege }) => anciens.has(l.joueur.id),
    titre: (
      <>
        <UserMinus size={12} aria-hidden="true" className="mr-1 inline-block align-[-1px]" />
        {s.anciensMembres}
      </>
    ),
  };
  return { s, e, nombre, pourcent, col, colJoueur, libelleLigne, aPart };
}

export function TableauAttaques({
  lignes,
  moi,
  anciens,
  onJoueur,
}: {
  lignes: LigneAttaques[];
  moi: number;
  anciens: Set<number>;
  onJoueur: (id: number) => void;
}) {
  const { e, nombre, pourcent, col, colJoueur, libelleLigne, aPart } = useCommun(anciens);
  const discret = (n: number | null) => <span className={n ? '' : 'text-ink-dimmer'}>{n ?? '—'}</span>;
  const tour = (t: 4 | 5): ColonneTableau<LigneAttaques> => ({
    ...col(t === 5 ? 'tour5' : 'tour4'),
    valeur: (l) => l.parTour[t].taux,
    rendu: (l) =>
      l.parTour[t].total ? (
        <span>
          {l.parTour[t].victoires}
          <span className="text-ink-dim">/{l.parTour[t].total}</span>
        </span>
      ) : (
        <span className="text-ink-dimmer">—</span>
      ),
    titreCellule: (l) => (l.parTour[t].taux === null ? undefined : `${nombre(l.parTour[t].taux!)} %`),
  });
  const colonnes: ColonneTableau<LigneAttaques>[] = [
    colJoueur<LigneAttaques>(),
    { ...col('victoires'), valeur: (l) => l.victoires },
    { ...col('defaites'), valeur: (l) => l.defaites, rendu: (l) => discret(l.defaites) },
    { ...col('manquees'), valeur: (l) => l.manquees, rendu: (l) => discret(l.manquees) },
    { ...col('taux'), valeur: (l) => l.taux, rendu: (l) => pourcent(l.taux) },
    tour(5),
    tour(4),
  ];
  return (
    <Tableau
      lignes={lignes}
      colonnes={colonnes}
      cleLigne={(l) => l.joueur.id}
      marquee={(l) => l.joueur.id === moi}
      libelleTri={e.trier}
      onLigne={(l) => onJoueur(l.joueur.id)}
      libelleLigne={libelleLigne}
      formaterNombre={nombre}
      pleineLargeur
      aPart={aPart}
    />
  );
}

export function TableauDefenses({
  lignes,
  moi,
  anciens,
  onJoueur,
}: {
  lignes: LigneDefenses[];
  moi: number;
  anciens: Set<number>;
  onJoueur: (id: number) => void;
}) {
  const { e, nombre, pourcent, col, colJoueur, libelleLigne, aPart } = useCommun(anciens);
  const colonnes: ColonneTableau<LigneDefenses>[] = [
    colJoueur<LigneDefenses>(),
    { ...col('decks'), valeur: (l) => l.decks },
    { ...col('subis'), valeur: (l) => l.subis },
    { ...col('tenus'), valeur: (l) => l.tenus },
    { ...col('perdus'), valeur: (l) => l.perdus, rendu: (l) => <span className={l.perdus ? '' : 'text-ink-dimmer'}>{l.perdus}</span> },
    { ...col('tenue'), valeur: (l) => l.tenue, rendu: (l) => pourcent(l.tenue) },
  ];
  return (
    <Tableau
      lignes={lignes}
      colonnes={colonnes}
      cleLigne={(l) => l.joueur.id}
      marquee={(l) => l.joueur.id === moi}
      libelleTri={e.trier}
      onLigne={(l) => onJoueur(l.joueur.id)}
      libelleLigne={libelleLigne}
      formaterNombre={nombre}
      pleineLargeur
      aPart={aPart}
    />
  );
}
