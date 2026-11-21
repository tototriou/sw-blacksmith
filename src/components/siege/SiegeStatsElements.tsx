// Les petits éléments de Siège › Statistiques, partagés entre la page
// (SiegeStatistiques.tsx) et sa vue d'ensemble (SiegeVueEnsemble.tsx).

import { ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import { formatNombre } from '../../i18n/format';
import { JOURS_GLISSANTS, type CouleurGuilde, type WrGlissant } from '../../lib/siegeStatistiques';
import type { Monster } from '../../types';
import MonsterAvatar from '../MonsterAvatar';

// Les monstres par `unit_master_id` (com2usId) : c'est l'identifiant du jeu.
export type ParCom2us = Map<number, Monster>;

// Un chiffre en tête : son libellé, sa valeur, une précision.
// `tendance` : une ligne de plus sous la précision (`Tendance`).
export function Tuile({ libelle, valeur, detail, tendance }: { libelle: string; valeur: ReactNode; detail?: string; tendance?: ReactNode }) {
  return (
    <div className="min-w-[7rem]">
      <div className="label text-ink-dim">{libelle}</div>
      <div className="font-display text-xl tabular-nums text-ink">{valeur}</div>
      {detail && <div className="text-xs text-ink-dim">{detail}</div>}
      {tendance}
    </div>
  );
}

// La TENDANCE d'un WR, sous lui : l'écart en points du WR glissant
// (`wrGlissant`) — ses 30 derniers jours contre les 30 d'avant. Vert et flèche
// montante quand il monte, rouge et flèche descendante quand il baisse.
// ⚠️ Jamais la couleur seule : la flèche et le signe disent aussi le sens.
// Rien sans écart connu (pas de combat sur l'une des deux périodes).
export function Tendance({ wr }: { wr: WrGlissant | null | undefined }) {
  const textes = useTraduction();
  const langue = useLangue();
  const e = textes.siegeStats.ensemble;
  if (!wr || wr.ecart === null) return null;
  // Un écart arrondi à zéro n'est ni une hausse ni une baisse.
  const ecart = Math.round(wr.ecart * 10) / 10;
  const sens = ecart > 0 ? 'hausse' : ecart < 0 ? 'baisse' : 'stable';
  const Icone = sens === 'hausse' ? TrendingUp : sens === 'baisse' ? TrendingDown : Minus;
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-dim" title={e.glissantDetail(wr.n, JOURS_GLISSANTS)}>
      <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${sens === 'hausse' ? 'text-good' : sens === 'baisse' ? 'text-bad' : ''}`}>
        <Icone size={13} aria-hidden="true" />
        {`${formatNombre(ecart, langue, { maximumFractionDigits: 1, signDisplay: 'exceptZero' })} %`}
      </span>
      <span>{e.glissantEcart(JOURS_GLISSANTS)}</span>
    </div>
  );
}

// Des portraits, dans l'ordre du jeu.
export function Equipe({ ids, parCom2us, taille = 36 }: { ids: number[]; parCom2us: ParCom2us; taille?: number }) {
  return (
    <span className="flex flex-none gap-1">
      {ids.map((id, i) => {
        const m = parCom2us.get(id) ?? null;
        return <MonsterAvatar key={`${id}-${i}`} monster={m} fallback={m ? undefined : String(id)} size={taille} element={false} titre={m?.name ?? null} />;
      })}
    </span>
  );
}

// L'ÉCUSSON d'une tour, comme sur la carte du jeu : la forme et le contour
// disent le territoire — bouclier bleu, rond rouge, carré jaune —, le numéro
// (ou « QG ») est au centre. ⚠️ Un rendu du jeu : fond sombre et chiffre clair
// dans les DEUX thèmes (tokens `forge-*`, fixes), comme en jeu. La forme
// double la couleur : un daltonien distingue les territoires sans elle.
const FORMES: Record<CouleurGuilde, (trait: string) => ReactNode> = {
  bleue: (trait) => <path d="M10 1.5 17.5 4v6c0 4.5-3.5 7.3-7.5 8.5C6 17.3 2.5 14.5 2.5 10V4Z" stroke={trait} />,
  rouge: (trait) => <circle cx={10} cy={10} r={8} stroke={trait} />,
  jaune: (trait) => <rect x={2} y={2} width={16} height={16} rx={3} stroke={trait} />,
};
// `numero` : le numéro de la tour, ou le libellé du QG dans la langue de l'interface.
export function EcussonTour({ couleur, numero, taille = 20 }: { couleur: CouleurGuilde; numero: number | string; taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 20 20" aria-hidden="true" className="flex-none">
      <g fill="rgb(var(--forge-bg))" strokeWidth={2}>
        {FORMES[couleur](`rgb(var(--forge-guilde-${couleur}))`)}
      </g>
      <text x={10} y={10.5} textAnchor="middle" dominantBaseline="middle" fill="rgb(var(--forge-ink))" fontSize={typeof numero === 'string' ? 6.5 : 9} fontWeight={700}>
        {numero}
      </text>
    </svg>
  );
}

// Un titre et son aide, sans surface : pour ce qui porte déjà sa carte (le
// `Tableau` de la librairie).
// `aligne` : la section prend ses trois rangées (titre, aide, contenu) dans la
// grille parente (`grid-rows-subgrid`) — deux sections côte à côte y ont leur
// contenu à la même hauteur, même si l'une a une aide plus longue. La grille
// parente n'a pas d'écart vertical : chaque section porte le sien (`mb-4`).
export function Section({ titre, aide, aligne = false, children }: { titre: string; aide?: string; aligne?: boolean; children: ReactNode }) {
  return (
    // L'aide se borne à une ligne lisible : elle ne doit pas élargir la section
    // au-delà de son tableau.
    <section className={`min-w-0 max-w-full ${aligne ? 'row-span-3 mb-4 grid grid-rows-subgrid' : ''}`}>
      <h2 className="label mb-1 text-ink-dim">{titre}</h2>
      {(aide || aligne) && <p className="mb-1.5 max-w-prose text-xs text-ink-dim">{aide}</p>}
      {children}
    </section>
  );
}

// Un bloc titré, sur la surface des cartes. `aligne` : comme `Section`, le
// titre, l'aide et le cadre prennent les rangées de la grille parente
// (`grid-rows-subgrid`) — deux blocs côte à côte ont leurs cadres alignés et de
// même hauteur, même si un seul porte une aide. La grille parente compense la
// marge (`-mb-4`) et n'a pas d'écart vertical.
export function Bloc({ titre, aide, aligne = false, children }: { titre: string; aide?: string; aligne?: boolean; children: ReactNode }) {
  return (
    <section className={`min-w-0 ${aligne ? 'row-span-3 mb-4 grid grid-rows-subgrid' : ''}`}>
      <h2 className="label mb-1 text-ink-dim">{titre}</h2>
      {(aide || aligne) && <p className="mb-1.5 text-xs text-ink-dim">{aide}</p>}
      <div className="rounded-xl border border-border bg-panel">{children}</div>
    </section>
  );
}
