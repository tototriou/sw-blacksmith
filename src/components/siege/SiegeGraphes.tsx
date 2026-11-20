// Siège › Statistiques, les pièces des GRAPHES, communes à la vue d'ensemble
// de la guilde (SiegeVueEnsemble.tsx) et à celle d'un membre
// (SiegeVueMembre.tsx) : le cadre d'un graphe et son interrupteur des
// infobulles, la légende, la largeur mesurée, les barres d'équipes.
//
// ⚠️ **Couleurs des graphes : les tokens `--serie-1..3`** (index.css), dans cet
// ordre, validés pour les daltoniens — jamais `good` / `bad`, que ceux-ci
// confondent. Une couleur suit son ENTITÉ ; un graphe à une seule série prend
// la série 1. Le texte reste aux encres de l'app, jamais à la couleur d'une
// série ; une légende accompagne chaque graphe.

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import { useStickyState } from '../../hooks/useStickyState';
import { formatDate, formatNombre } from '../../i18n/format';
import { bornesDesValeurs, type CouleurGuilde, type EquipeCompte, type PointEvolution } from '../../lib/siegeStatistiques';
import { Interrupteur, Pastille } from '../../ui';
import { Bloc, Equipe, type ParCom2us } from './SiegeStatsElements';

export const SERIES = ['rgb(var(--serie-1))', 'rgb(var(--serie-2))', 'rgb(var(--serie-3))'];
// Le même, en classes de fond (les barres en HTML).
export const FONDS = ['bg-serie-1', 'bg-serie-2', 'bg-serie-3'];

// ⚠️ Une GUILDE prend la couleur de sa place sur la carte du jeu
// (`couleurDeGuilde`) : bleu, rouge, jaune — tokens `--guilde-*`, validés
// comme les séries. Les séries restent pour ce qui n'est pas une guilde (WR en
// attaque et en défense).
export const TRAIT_GUILDE: Record<CouleurGuilde, string> = {
  bleue: 'rgb(var(--guilde-bleue))',
  rouge: 'rgb(var(--guilde-rouge))',
  jaune: 'rgb(var(--guilde-jaune))',
};
export const FOND_GUILDE: Record<CouleurGuilde, string> = { bleue: 'bg-guilde-bleue', rouge: 'bg-guilde-rouge', jaune: 'bg-guilde-jaune' };
// Un fond TEINTÉ (l'en-tête d'une colonne de guilde) : le texte y reste à l'encre.
export const TEINTE_GUILDE: Record<CouleurGuilde, string> = { bleue: 'bg-guilde-bleue/15', rouge: 'bg-guilde-rouge/15', jaune: 'bg-guilde-jaune/15' };
// Le NOM d'une guilde à sa couleur (à côté d'un joueur) — à la demande de
// l'utilisateur, en gras : le jaune n'atteint que 3:1 sur le clair.
export const TEXTE_GUILDE: Record<CouleurGuilde, string> = { bleue: 'text-guilde-bleue', rouge: 'text-guilde-rouge', jaune: 'text-guilde-jaune' };
// Une entrée de légende cliquable porte la couleur de ce qu'elle désigne :
// contour, et fond teinté tant qu'elle est affichée.
const PASTILLE_GUILDE: Record<CouleurGuilde, string> = {
  bleue: 'border-guilde-bleue data-[active=true]:bg-guilde-bleue/15',
  rouge: 'border-guilde-rouge data-[active=true]:bg-guilde-rouge/15',
  jaune: 'border-guilde-jaune data-[active=true]:bg-guilde-jaune/15',
};
const PASTILLE_SERIE = [
  'border-serie-1 data-[active=true]:bg-serie-1/15',
  'border-serie-2 data-[active=true]:bg-serie-2/15',
  'border-serie-3 data-[active=true]:bg-serie-3/15',
];

// Un graphe : son cadre, sa légende et, d'office, l'interrupteur de SES
// infobulles (survol de la courbe, détail des barres), dans la ligne de la
// légende. Activées par défaut ; chaque graphe retient son choix le temps de
// la session.
//
// Une légende à plusieurs entrées (`cle`) se CLIQUE : chaque entrée affiche ou
// masque ce qu'elle désigne (une guilde, une mesure), et le graphe le reçoit
// (`visible`). Le choix se retient le temps de la session, comme les
// infobulles.
export function Graphe({
  id,
  titre,
  aide,
  legende,
  children,
}: {
  id: string;
  titre: string;
  aide?: string;
  legende: ElementLegende[];
  children: (infobulles: boolean, visible: (cle: string) => boolean) => ReactNode;
}) {
  const e = useTraduction().siegeStats.ensemble;
  const [infobulles, setInfobulles] = useStickyState(`siegeStats.infobulles.${id}`, true);
  const [masques, setMasques] = useStickyState<string[]>(`siegeStats.masques.${id}`, []);
  const visible = (cle: string) => !masques.includes(cle);
  const basculer = (cle: string) => setMasques((m) => (m.includes(cle) ? m.filter((x) => x !== cle) : [...m, cle]));
  return (
    <Bloc titre={titre} aide={aide}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-3">
        <Legende elements={legende} masques={masques} onBasculer={basculer} />
        <Interrupteur actif={infobulles} onChange={setInfobulles} libelle={e.infobulles} />
      </div>
      {children(infobulles, visible)}
    </Bloc>
  );
}

// La légende : une pastille de la couleur de la série, son nom à l'encre.
// Une entrée est une pastille de couleur (une série), ou un trait (le style
// d'une ligne : plein, pointillé), à l'encre neutre — le style ne dit pas la
// série, il dit la mesure.
//
// Avec `cle` et `onBasculer`, une entrée est une `Pastille` à deux états :
// enfoncée, sa série est affichée ; relâchée, masquée (nom barré, pâle).
// ⚠️ La DERNIÈRE entrée affichée d'un groupe (les couleurs, les traits) ne se
// masque pas : désactivée, elle reste à sa place — un graphe vide ne dirait
// rien.
export type ElementLegende = { couleur?: number; guilde?: CouleurGuilde; trait?: 'plein' | 'pointille'; nom: string; cle?: string };

export function Legende({
  elements,
  masques = [],
  onBasculer,
  className = '',
}: {
  elements: ElementLegende[];
  masques?: string[];
  onBasculer?: (cle: string) => void;
  className?: string;
}) {
  const t = useTraduction().siegeStats.ensemble;
  const marque = (x: ElementLegende) =>
    x.trait ? (
      <svg width={18} height={8} aria-hidden="true" className="flex-none">
        <line x1={1} x2={17} y1={4} y2={4} stroke="rgb(var(--ink-dim))" strokeWidth={x.trait === 'plein' ? 2 : 1.5} strokeDasharray={x.trait === 'pointille' ? '4 3' : undefined} />
      </svg>
    ) : (
      <span className={`h-2.5 w-2.5 flex-none rounded-sm ${x.guilde ? FOND_GUILDE[x.guilde] : FONDS[x.couleur ?? 0]}`} aria-hidden="true" />
    );
  const cliquables = onBasculer ? elements.filter((x) => x.cle !== undefined) : [];
  const groupe = (x: ElementLegende) => cliquables.filter((y) => Boolean(y.trait) === Boolean(x.trait));
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-dim ${cliquables.length > 1 ? '!gap-x-1.5' : ''} ${className}`}>
      {elements.map((x) => {
        if (!onBasculer || x.cle === undefined || cliquables.length < 2)
          return (
            <span key={x.nom} className="inline-flex items-center gap-1.5">
              {marque(x)}
              {x.nom}
            </span>
          );
        const cle = x.cle;
        const affiche = !masques.includes(cle);
        const dernier = affiche && groupe(x).filter((y) => !masques.includes(y.cle!)).length === 1;
        return (
          <Pastille
            key={cle}
            actif={affiche}
            disabled={dernier}
            onClick={() => onBasculer(cle)}
            title={dernier ? t.legendeDerniere : affiche ? t.legendeMasquer(x.nom) : t.legendeAfficher(x.nom)}
            icone={<span className={affiche ? '' : 'opacity-40'}>{marque(x)}</span>}
            libelle={<span className={affiche ? '' : 'line-through'}>{x.nom}</span>}
            couleurs={`${x.guilde ? PASTILLE_GUILDE[x.guilde] : x.trait ? 'border-border-soft' : PASTILLE_SERIE[x.couleur ?? 0]} font-normal text-ink-dim data-[active=true]:text-ink disabled:cursor-default`}
          />
        );
      })}
    </div>
  );
}

// La largeur d'un élément, suivie : une courbe se dessine en pixels réels,
// pour que ses textes gardent leur taille à toutes les largeurs.
export function useLargeur<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [largeur, setLargeur] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(([entree]) => setLargeur(Math.max(240, Math.round(entree.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, largeur];
}

// Des équipes en barres : les trois portraits, la barre (série 1), le détail.
// Les noms des trois monstres sont dans l'infobulle : un classement, pas un
// graphe — pas d'interrupteur des infobulles.
export function BarresEquipes({
  comptes,
  parCom2us,
  valeur,
  detail,
  vide,
}: {
  comptes: EquipeCompte[];
  parCom2us: ParCom2us;
  valeur: (e: EquipeCompte) => number;
  detail: (e: EquipeCompte) => string;
  // La phrase sans aucune équipe (par défaut : aucun combat aux monstres connus).
  vide?: string;
}) {
  const e = useTraduction().siegeStats.ensemble;
  if (comptes.length === 0) return <p className="px-4 py-3 text-sm text-ink-dim">{vide ?? e.aucuneEquipe}</p>;
  const max = Math.max(1, ...comptes.map(valeur));
  const noms = (c: EquipeCompte) => c.equipe.map((id) => parCom2us.get(id)?.name ?? String(id)).join(', ');
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      {comptes.map((c) => (
        <div key={c.equipe.join()} className="flex items-center gap-3" title={`${noms(c)} — ${detail(c)}`}>
          <Equipe ids={c.equipe} parCom2us={parCom2us} taille={30} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs tabular-nums text-ink-dim">{detail(c)}</span>
            <span className="mt-1 block h-1.5 rounded bg-serie-1" style={{ width: `${(100 * valeur(c)) / max}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

// Un WR au fil des sièges (de la guilde, d'un membre), dans son cadre : un
// point par siège, en attaque (série 1) et en défense (série 2), chacune
// masquable depuis la légende. Un seul siège relevé : l'aide le dit, la courbe
// n'a qu'un point. ⚠️ Sur « Tous les sièges » seulement : un siège choisi, on
// veut SES chiffres.
//
// Avec `onOuvrir` (la vue d'ensemble de la guilde), l'infobulle nomme les
// adversaires du siège survolé, et un clic ouvre ce siège.
export function GrapheEvolution({
  id,
  titre,
  aide,
  points,
  onOuvrir,
}: {
  id: string;
  titre: string;
  aide: string;
  points: PointEvolution[];
  onOuvrir?: (matchId: number) => void;
}) {
  const m = useTraduction().siegeStats.membre;
  if (points.length === 0) return null;
  return (
    <Graphe
      id={id}
      titre={titre}
      aide={points.length > 1 ? aide : m.unSeulSiege}
      legende={[
        { couleur: 0, nom: m.legendeAttaque, cle: 'wrAttaque' },
        { couleur: 1, nom: m.legendeDefense, cle: 'wrDefense' },
      ]}
    >
      {(infobulles, visible) => <CourbeEvolution points={points} infobulles={infobulles} visible={visible} onOuvrir={onOuvrir} />}
    </Graphe>
  );
}

// Deux WR, une seule échelle (des %), centrée sur leurs valeurs
// (`bornesDesValeurs`). Un siège sans combat au résultat connu n'a pas de
// point : la ligne le saute.
const HAUTEUR = 140;
const MARGE = { gauche: 34, droite: 44, haut: 10, bas: 24 };
const SERIES_EVOLUTION = [
  { cle: 'wrAttaque', couleur: 0 },
  { cle: 'wrDefense', couleur: 1 },
] as const;

function CourbeEvolution({
  points,
  infobulles,
  visible,
  onOuvrir,
}: {
  points: PointEvolution[];
  infobulles: boolean;
  visible: (cle: string) => boolean;
  onOuvrir?: (matchId: number) => void;
}) {
  const textes = useTraduction();
  const langue = useLangue();
  const s = textes.siegeStats;
  const m = s.membre;
  const [ref, largeur] = useLargeur<HTMLDivElement>();
  const [survol, setSurvol] = useState<number | null>(null);
  // Les séries affichées ; l'échelle se resserre sur elles seules.
  const series = SERIES_EVOLUTION.filter((x) => visible(x.cle));
  const { bas, haut } = useMemo(
    () => bornesDesValeurs(points.flatMap((p) => series.map((x) => p[x.cle]))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, series.map((x) => x.cle).join()]
  );
  const n = points.length;
  const lx = largeur - MARGE.gauche - MARGE.droite;
  const x = (i: number) => MARGE.gauche + (n > 1 ? (i / (n - 1)) * lx : lx / 2);
  const y = (v: number) => MARGE.haut + HAUTEUR - ((v - bas) / (haut - bas)) * HAUTEUR;
  const date = (p: PointEvolution, mois: 'short' | 'long') => (p.debut !== null ? formatDate(p.debut * 1000, langue, { day: 'numeric', month: mois }) : '—');
  const pourcent = (v: number | null) => (v === null ? '—' : `${formatNombre(v, langue, { maximumFractionDigits: 0 })} %`);
  // Une date sur `pas` : assez de place entre deux (~70 px).
  const pas = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(lx / 70))));
  const chemin = (cle: (typeof SERIES_EVOLUTION)[number]['cle']) => {
    let d = '';
    points.forEach((p, i) => {
      const v = p[cle];
      if (v !== null) d += `${d ? 'L' : 'M'}${x(i)},${y(v)}`;
    });
    return d;
  };
  // Le siège sous le pointeur : le plus proche en abscisse.
  const indexSous = (ev: React.MouseEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ev.clientX - r.left;
    return n > 1 ? Math.min(n - 1, Math.max(0, Math.round(((px - MARGE.gauche) / lx) * (n - 1)))) : 0;
  };
  const surDeplacement = (ev: React.PointerEvent<SVGSVGElement>) => setSurvol(indexSous(ev));
  const surClic = (ev: React.MouseEvent<SVGSVGElement>) => onOuvrir?.(points[indexSous(ev)].matchId);
  const hauteurTotale = MARGE.haut + HAUTEUR + MARGE.bas;
  const dernier = points[n - 1];
  const detail = (p: PointEvolution) =>
    series.map((x) => ({
      couleur: x.couleur,
      texte: x.cle === 'wrAttaque' ? m.pointAttaque(pourcent(p.wrAttaque), p.attaques) : m.pointDefense(pourcent(p.wrDefense), p.defenses),
    }));
  return (
    <div ref={ref} className="relative px-1 pb-2 pt-1">
      <svg
        width={largeur}
        height={hauteurTotale}
        className={`block max-w-full touch-pan-y ${onOuvrir ? 'cursor-pointer' : ''}`}
        onPointerMove={infobulles ? surDeplacement : undefined}
        onPointerLeave={() => setSurvol(null)}
        onClick={onOuvrir ? surClic : undefined}
        role="img"
        aria-label={`${date(dernier, 'long')} : ${detail(dernier).map((d) => d.texte).join(' ; ')}`}
      >
        {[bas, (bas + haut) / 2, haut].map((v) => (
          <g key={v}>
            <line x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y(v)} y2={y(v)} stroke="rgb(var(--border-soft))" strokeWidth={1} />
            <text x={MARGE.gauche - 6} y={y(v) + 4} textAnchor="end" className="fill-ink-dim text-micro">
              {v}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % pas === 0 || i === n - 1 ? (
            <text key={p.matchId} x={x(i)} y={hauteurTotale - 6} textAnchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'} className="fill-ink-dim text-micro">
              {date(p, 'short')}
            </text>
          ) : null
        )}
        {survol !== null && infobulles && (
          <line x1={x(survol)} x2={x(survol)} y1={MARGE.haut} y2={MARGE.haut + HAUTEUR} stroke="rgb(var(--ink-dimmer))" strokeWidth={1} />
        )}
        {series.map((serie) => (
          <g key={serie.cle}>
            <path d={chemin(serie.cle)} fill="none" stroke={SERIES[serie.couleur]} strokeWidth={2} strokeLinejoin="round" />
            {points.map((p, i) => {
              const v = p[serie.cle];
              return v === null ? null : (
                <circle key={p.matchId} cx={x(i)} cy={y(v)} r={survol === i ? 5 : 4} fill={SERIES[serie.couleur]} stroke="rgb(var(--panel))" strokeWidth={2} />
              );
            })}
            {/* Libellé direct, à l'encre : le dernier WR connu. */}
            {dernier[serie.cle] !== null && (
              <text x={x(n - 1) + 8} y={y(dernier[serie.cle]!) + 4} className="fill-ink text-micro font-semibold">
                {formatNombre(dernier[serie.cle]!, langue, { maximumFractionDigits: 0 })}
              </text>
            )}
          </g>
        ))}
      </svg>
      {infobulles && survol !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg border border-border bg-panel2 px-2.5 py-1.5 text-xs text-ink shadow-sm"
          style={x(survol) > largeur / 2 ? { right: largeur - x(survol) + 8 } : { left: x(survol) + 8 }}
        >
          <div className="mb-0.5 font-mono text-ink-dim">{date(points[survol], 'long')}</div>
          {onOuvrir && points[survol].adversaires.length > 0 && (
            <div className="mb-0.5 whitespace-nowrap font-semibold">{s.contreGuildes(points[survol].adversaires)}</div>
          )}
          {detail(points[survol]).map((ligne) => (
            <div key={ligne.couleur} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className={`h-2 w-2 rounded-sm ${FONDS[ligne.couleur]}`} aria-hidden="true" />
              {ligne.texte}
            </div>
          ))}
          {onOuvrir && <div className="mt-0.5 whitespace-nowrap text-ink-dim">{s.ensemble.evolutionOuvrir}</div>}
        </div>
      )}
    </div>
  );
}
