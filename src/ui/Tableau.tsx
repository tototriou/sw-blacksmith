import { ReactNode, useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpDown, ArrowUpNarrowWide } from 'lucide-react';
import Bouton from './Bouton';
import ZoneCliquable from './ZoneCliquable';

// TABLEAU de données triable, à la grammaire du tableau des résultats de
// l'Optimizer (src/components/outils/optimizer/TableauResultats.tsx), d'où il
// est tiré : une carte (`rounded-xl`, contour `border`, fond `panel`), des
// en-têtes qui sont des `Bouton` pleine largeur (accent plein sur la colonne
// triée, son sens en icône), la colonne triée TEINTÉE sur toute sa hauteur et
// en gras, des chiffres `font-mono` alignés, un trait doux entre les lignes,
// le survol en `panel2`. Pas de barre ni de couleur de donnée dans les
// cellules : un tableau se lit par ses chiffres.
//
// ⚠️ **Deux formats, un seul rendu** : trop large, il défile sur le côté, et sa
// colonne `fixe` (le nom) reste à sa place — on ne perd jamais la ligne lue.
//
// Le tri, en trois clics sur un même en-tête : trié par cette colonne (les
// nombres du plus grand au plus petit, le texte de A à Z), puis inversé, puis
// plus trié du tout — le tableau revient à l'ORDRE DE SES LIGNES, celui que
// l'appelant a choisi comme ordre de base. Une valeur inconnue (`null`) reste
// TOUJOURS en dernier.
//
// Une ligne cliquable (`onLigne`) l'est en entier, et au clavier par sa
// cellule fixe (`ZoneCliquable`) — comme le rang d'un build dans l'Optimizer.
//
// Des lignes À PART (`aPart`) viennent après toutes les autres, sous leur
// intertitre, comme un second tableau qui partage les colonnes : le tri
// s'applique dans chaque groupe, jamais d'un groupe à l'autre.

export type ValeurTri = number | string | null;

export interface ColonneTableau<L> {
  cle: string;
  // L'en-tête, court ; `titre` en donne le sens entier (infobulle).
  libelle: ReactNode;
  titre?: string;
  // La valeur de tri, et le contenu par défaut de la cellule.
  valeur: (l: L) => ValeurTri;
  // Le contenu de la cellule, s'il n'est pas la valeur.
  rendu?: (l: L) => ReactNode;
  // La colonne fixée à gauche quand le tableau défile (le nom), alignée à
  // gauche, en texte et non en chiffres.
  fixe?: boolean;
  titreCellule?: (l: L) => string | undefined;
}

export interface TableauProps<L> {
  lignes: L[];
  colonnes: ColonneTableau<L>[];
  cleLigne: (l: L) => string | number;
  // Le tri à l'ouverture ; `null` (par défaut) : l'ordre des lignes, l'ordre
  // de base.
  triDepart?: { cle: string; sens: 'desc' | 'asc' } | null;
  // La ligne mise en avant (fond `panel2`, comme une fiche épinglée).
  marquee?: (l: L) => boolean;
  // Le nom accessible d'un en-tête : « Trier par … ».
  libelleTri: (colonne: string) => string;
  // Une ligne qui s'ouvre, et le nom accessible de sa cellule fixe.
  onLigne?: (l: L) => void;
  libelleLigne?: (l: L) => string;
  formaterNombre?: (n: number) => string;
  // Remplir la largeur de son conteneur (une colonne de mise en page) au lieu
  // de celle de son contenu.
  pleineLargeur?: boolean;
  // Les lignes mises à part, en fin de tableau sous `titre` ; sans aucune
  // d'elles, pas d'intertitre.
  aPart?: { ligne: (l: L) => boolean; titre: ReactNode };
}

type Sens = 'desc' | 'asc';
export type TriTableau = { cle: string; sens: Sens } | null;

// Le tri après un clic sur l'en-tête `cle` : une autre colonne → triée dans
// son premier sens (le texte de A à Z, les nombres du plus grand au plus
// petit) ; la même → inversée ; la même déjà inversée → plus de tri (l'ordre
// de base des lignes).
export function triApresClic(tri: TriTableau, cle: string, texte: boolean): TriTableau {
  const premier: Sens = texte ? 'asc' : 'desc';
  if (tri?.cle !== cle) return { cle, sens: premier };
  return tri.sens === premier ? { cle, sens: premier === 'desc' ? 'asc' : 'desc' } : null;
}

function comparer(a: ValeurTri, b: ValeurTri, sens: Sens) {
  if (a === null || b === null) return a === null ? (b === null ? 0 : 1) : -1;
  const c = typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : Number(a) - Number(b);
  return sens === 'asc' ? c : -c;
}

export default function Tableau<L>({
  lignes,
  colonnes,
  cleLigne,
  triDepart = null,
  marquee,
  libelleTri,
  onLigne,
  libelleLigne,
  formaterNombre = String,
  pleineLargeur = false,
  aPart,
}: TableauProps<L>) {
  const [tri, setTri] = useState(triDepart);
  const triees = useMemo(() => {
    const col = tri && colonnes.find((c) => c.cle === tri.cle);
    if (!col || !tri) return lignes;
    return [...lignes].sort((a, b) => comparer(col.valeur(a), col.valeur(b), tri.sens));
    // `colonnes` est refait à chaque rendu par l'appelant : seuls les lignes
    // et le tri comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, tri]);
  // Le partage suit le tri (le tri est stable) : chaque groupe garde l'ordre
  // trié de ses lignes.
  const principales = aPart ? triees.filter((l) => !aPart.ligne(l)) : triees;
  const aPartTriees = aPart ? triees.filter((l) => aPart.ligne(l)) : [];
  const trier = (c: ColonneTableau<L>) => {
    const texte = lignes.length > 0 && typeof c.valeur(lignes[0]) === 'string';
    setTri((t) => triApresClic(t, c.cle, texte));
  };
  // La colonne triée, teintée sur toute sa hauteur (comme l'Optimizer).
  const teinte = (c: ColonneTableau<L>) => (tri?.cle === c.cle ? 'bg-accent-soft' : '');
  const fixe = (fond: string) => `sticky left-0 z-10 ${fond}`;

  const ligne = (l: L) => {
    const mise = marquee?.(l) ?? false;
    // ⚠️ La cellule fixe a son PROPRE fond (opaque : les colonnes passent
    // dessous quand le tableau défile) — il suit le survol de la ligne, sinon
    // le nom restait hors du surlignage.
    const fond = mise ? 'bg-panel2' : 'bg-panel group-hoverable:bg-panel2';
    return (
      <tr
        key={cleLigne(l)}
        onClick={onLigne ? () => onLigne(l) : undefined}
        className={`group border-b border-border-soft last:border-0 ${mise ? 'bg-panel2 font-semibold' : 'hoverable:bg-panel2'} ${onLigne ? 'cursor-pointer' : ''}`}
      >
        {colonnes.map((c) => {
          const v = c.valeur(l);
          const corps = c.rendu ? c.rendu(l) : v === null ? <span className="text-ink-dimmer">—</span> : typeof v === 'number' ? formaterNombre(v) : v;
          if (c.fixe)
            return (
              <th key={c.cle} scope="row" title={c.titreCellule?.(l)} className={`max-w-[11rem] px-2 py-1 text-left font-normal text-ink ${fixe(fond)}`}>
                {onLigne ? (
                  <ZoneCliquable
                    onClick={(e) => {
                      e.stopPropagation();
                      onLigne(l);
                    }}
                    aria-label={libelleLigne?.(l)}
                    data-cible-fine=""
                    className="block w-full truncate"
                  >
                    {corps}
                  </ZoneCliquable>
                ) : (
                  <span className="block truncate">{corps}</span>
                )}
              </th>
            );
          return (
            <td
              key={c.cle}
              title={c.titreCellule?.(l)}
              className={`whitespace-nowrap px-1 py-1 text-center font-mono text-ink ${teinte(c)} ${tri?.cle === c.cle ? 'font-semibold' : ''}`}
            >
              {corps}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    // ⚠️ **À la largeur de son contenu** par défaut, jamais étiré sur toute la
    // page : des colonnes de chiffres étalées sur un écran large se lisent mal.
    // `pleineLargeur` : il remplit sa colonne de mise en page. Plus large que
    // la place, il défile (`max-w-full`).
    <div className={`${pleineLargeur ? 'w-full' : 'w-fit'} max-w-full overflow-x-auto rounded-xl border border-border bg-panel`}>
      <table className={`${pleineLargeur ? 'w-full' : ''} border-collapse text-xs tabular-nums`}>
        <thead>
          <tr className="border-b border-border-soft">
            {colonnes.map((c) => {
              const actif = tri?.cle === c.cle;
              const nom = c.titre ?? (typeof c.libelle === 'string' ? c.libelle : c.cle);
              const Sens = !actif ? ArrowUpDown : tri!.sens === 'desc' ? ArrowDownWideNarrow : ArrowUpNarrowWide;
              return (
                <th
                  key={c.cle}
                  scope="col"
                  aria-sort={actif ? (tri!.sens === 'desc' ? 'descending' : 'ascending') : 'none'}
                  className={`px-1 py-1 align-bottom ${c.fixe ? fixe(actif ? 'bg-accent-soft' : 'bg-panel') : teinte(c)}`}
                >
                  <Bouton
                    taille="sm"
                    pleineLargeur
                    ton={actif ? 'accent' : 'neutre'}
                    fond={actif ? 'plein' : 'vide'}
                    title={c.titre}
                    aria-label={libelleTri(nom)}
                    onClick={() => trier(c)}
                    className={`!px-1 leading-tight ${c.fixe ? 'text-left' : 'text-center'}`}
                    libelle={
                      // La flèche sur la ligne du libellé ; elle passe dessous
                      // seulement si la colonne est trop étroite.
                      <span className={`flex flex-wrap items-center gap-x-1 py-0.5 ${c.fixe ? 'justify-start' : 'justify-center'}`}>
                        <span>{c.libelle}</span>
                        <Sens size={14} className={`flex-none ${actif ? '' : 'text-ink-dim'}`} aria-hidden />
                      </span>
                    }
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{principales.map(ligne)}</tbody>
        {aPart && aPartTriees.length > 0 && (
          <tbody>
            {/* L'intertitre ouvre le second groupe ; il reste à gauche quand le
                tableau défile sur le côté. */}
            <tr className="border-b border-t border-b-border-soft border-t-border">
              <th scope="rowgroup" colSpan={colonnes.length} className="px-2 pb-1 pt-3 text-left font-normal">
                <span className="label sticky left-2 inline-block text-ink-dim">{aPart.titre}</span>
              </th>
            </tr>
            {aPartTriees.map(ligne)}
          </tbody>
        )}
      </table>
    </div>
  );
}
