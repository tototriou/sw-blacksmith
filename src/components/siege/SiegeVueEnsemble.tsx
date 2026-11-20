// Siège › Statistiques, la VUE D'ENSEMBLE de la guilde (première page de la
// sous-section) : les chiffres de la guilde, puis des graphes — victoires au fil
// du siège, attaques par membre, monstres joués, défenses les plus dures à battre,
// score par siège (docs/02-app/siege/statistiques.md).
//
// ⚠️ **Rien de calculé ici** : tout vient de src/lib/siegeStatistiques.ts.
//
// ⚠️ **Couleurs des graphes** (SiegeGraphes.tsx) : ma guilde toujours en
// série 1, les autres guildes — une en tournoi, deux en saison — dans l'ordre
// de la carte.
//
// ⚠️ **Deux formats, un seul rendu** : les graphes prennent la largeur de leur
// bloc (mesurée pour la courbe, en pourcentage pour les barres) ; les blocs se
// rangent en grille, deux côte à côte à la souris, empilés au doigt.

import { ReactNode, useMemo, useState } from 'react';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import { formatDate, formatDateHeure, formatNombre } from '../../i18n/format';
import {
  bilanDeLaGuilde,
  tableauAttaques,
  tableauDefenses,
  courbesDuSiege,
  pointA,
  bornesWr,
  type PointCourbe,
  historiqueDesSieges,
  evolutionDeLaGuilde,
  wrGlissant,
  equipesJouees,
  equipesQuiNousBattent,
  TOUS_LES_SIEGES,
  couleurDeGuilde,
  maPosition,
  type CouleurGuilde,
  type RelevesSiege,
  type SiegeReleve,
} from '../../lib/siegeStatistiques';
import { Bloc, Section, Tendance, Tuile, type ParCom2us } from './SiegeStatsElements';
import { BarresEquipes, FOND_GUILDE, Graphe, GrapheEvolution, Legende, TRAIT_GUILDE, useLargeur } from './SiegeGraphes';
import { TableauAttaques, TableauDefenses } from './SiegeTableauxMembres';
import SiegeComparatif from './SiegeComparatif';

export default function SiegeVueEnsemble({
  siege,
  releves,
  parCom2us,
  anciens,
  fini,
  onJoueur,
  onSiege,
}: {
  siege: SiegeReleve;
  releves: RelevesSiege;
  parCom2us: ParCom2us;
  // Le siège choisi est fini : son classement est définitif.
  fini: boolean;
  // Les anciens membres à distinguer (« Tous les sièges ») ; vide sinon.
  anciens: Set<number>;
  onJoueur: (id: number) => void;
  // Un siège choisi depuis le graphe du WR siège par siège.
  onSiege: (matchId: number) => void;
}) {
  const textes = useTraduction();
  const langue = useLangue();
  const s = textes.siegeStats;
  const e = s.ensemble;
  const nombre = (n: number, decimales = 0) => formatNombre(n, langue, { maximumFractionDigits: decimales });
  // Ma guilde par son identifiant : le siège cumulé (« Tous les sièges ») n'a
  // pas de liste de guildes.
  const maGuilde = releves.maGuilde;
  const tous = siege.matchId === TOUS_LES_SIEGES;
  // ⚠️ Calculés une fois par siège et par relevé, pas à chaque rendu : un
  // tableau qui reçoit de nouvelles lignes se retrie.
  const historique = useMemo(() => historiqueDesSieges(releves), [releves]);
  const evolution = useMemo(() => evolutionDeLaGuilde(releves), [releves]);
  // Le WR glissant n'a de sens que sur « Tous les sièges » : un siège dure deux jours.
  const glissant = useMemo(() => wrGlissant(releves), [releves]);
  const calculs = useMemo(
    () =>
      maGuilde === null
        ? null
        : {
            attaques: tableauAttaques(siege, maGuilde),
            defenses: tableauDefenses(siege, maGuilde),
            joues: equipesJouees(siege, maGuilde),
            battent: equipesQuiNousBattent(siege, maGuilde),
          },
    [siege, maGuilde]
  );
  // Chaque guilde à la couleur de sa place sur la carte du jeu ; dans l'ordre
  // de la carte (ma guilde d'abord).
  const ordre = [...siege.guildes].sort((a, b) => Number(b.mienne) - Number(a.mienne) || (a.position ?? 9) - (b.position ?? 9));
  const couleurDe = (guilde: number): CouleurGuilde => {
    const i = ordre.findIndex((g) => g.id === guilde);
    return i < 0 ? 'bleue' : couleurDeGuilde(ordre[i], i, maPosition(siege));
  };
  return (
    <div className="flex flex-col gap-4">
      {maGuilde !== null && <Chiffres siege={siege} guilde={maGuilde} nbSieges={tous ? releves.sieges.length : null} glissant={tous ? glissant : null} />}

      {/* Un siège choisi : sous nos chiffres, les guildes du siège. */}
      {!tous && maGuilde !== null && siege.guildes.length > 0 && <SiegeComparatif siege={siege} maGuilde={maGuilde} fini={fini} />}

      {/* Siège par siège : sur « Tous les sièges » seulement — un siège
          choisi, on veut SES chiffres. Un clic sur un siège l'ouvre. */}
      {tous && <GrapheEvolution id="guilde" titre={e.evolutionTitre} aide={e.evolutionAide} points={evolution} onOuvrir={onSiege} />}

      {/* La courbe n'a de sens que sur UN siège : un axe des heures. Chaque
          guilde et chaque mesure se masque depuis la légende. */}
      {!tous && siege.attaques.length > 0 && (
        <Graphe
          id="courbe"
          titre={e.courbeTitre}
          aide={e.courbeAide}
          legende={[
            ...ordre.map((g) => ({ guilde: couleurDe(g.id), nom: g.nom, cle: `g${g.id}` })),
            { trait: 'pointille' as const, nom: e.legendeFaites, cle: 'faites' },
            { trait: 'plein' as const, nom: e.legendeGagnees, cle: 'gagnees' },
          ]}
        >
          {(infobulles, visible) => <CourbeVictoires siege={siege} couleurDe={couleurDe} infobulles={infobulles} visible={visible} />}
        </Graphe>
      )}

      {/* Les deux tableaux, moitié-moitié quand la place le permet (deux
          colonnes d'au moins 30 rem), l'un sous l'autre sinon ; chacun remplit
          sa colonne. ⚠️ ALIGNÉS : titres, aides et tableaux partagent les
          rangées de la grille (`Section aligne`), une aide plus longue d'un
          côté ne décale plus le tableau de l'autre. */}
      {calculs && (
        <div className="-mb-4 grid items-start gap-x-4 grid-cols-[repeat(auto-fit,minmax(min(100%,30rem),1fr))]">
          <Section aligne titre={e.tableauAttaquesTitre} aide={e.tableauAttaquesAide}>
            <TableauAttaques lignes={calculs.attaques} moi={releves.moi} anciens={anciens} onJoueur={onJoueur} />
          </Section>
          {siege.sources.resume && (
            <Section aligne titre={e.tableauDefensesTitre} aide={e.tableauDefensesAide}>
              <TableauDefenses lignes={calculs.defenses} moi={releves.moi} anciens={anciens} onJoueur={onJoueur} />
            </Section>
          )}
        </div>
      )}

      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(22rem,1fr))]">
        {calculs && (
          <Bloc titre={e.jouesTitre} aide={e.jouesAide}>
            <Legende elements={[{ couleur: 0, nom: e.legendeCombats }]} className="px-4 pt-3" />
            <BarresEquipes
              comptes={calculs.joues}
              parCom2us={parCom2us}
              valeur={(c) => c.combats}
              detail={(c) => e.combatsEquipe(c.combats, nombre((100 * c.victoires) / c.combats))}
            />
          </Bloc>
        )}
        {calculs && (
          <Bloc titre={e.battentTitre} aide={e.battentAide}>
            <Legende elements={[{ couleur: 0, nom: e.legendeAttaquesPerdues }]} className="px-4 pt-3" />
            <BarresEquipes
              comptes={calculs.battent}
              parCom2us={parCom2us}
              valeur={(c) => c.combats - c.victoires}
              detail={(c) => e.defaitesEquipe(c.combats - c.victoires, c.combats)}
            />
          </Bloc>
        )}
        {historique.length > 1 && (
          // Sans infobulle : la date, le score et le rang sont déjà écrits sur
          // chaque ligne.
          <Bloc titre={e.historiqueTitre}>
            <Legende elements={[{ couleur: 0, nom: e.legendeScore }]} className="px-4 pt-3" />
            <Barres
              lignes={historique.map((h) => ({
                cle: String(h.matchId),
                etiquette: h.debut !== null ? formatDate(h.debut * 1000, langue, { day: 'numeric', month: 'short' }) : '—',
                valeur: h.score ?? 0,
                texte: h.score !== null ? `${nombre(h.score)}${h.rang !== null ? ` · ${s.place(h.rang)}` : ''}` : '—',
              }))}
            />
          </Bloc>
        )}
      </div>
    </div>
  );
}

// Les chiffres de ma guilde : rang, score (d'un siège) ou nombre de sièges
// (tous les sièges), attaques, victoires en attaque et en défense ; sur tous
// les sièges, la tendance de chaque WR sous lui.
function Chiffres({
  siege,
  guilde,
  nbSieges,
  glissant,
}: {
  siege: SiegeReleve;
  guilde: number;
  nbSieges: number | null;
  glissant: ReturnType<typeof wrGlissant>;
}) {
  const textes = useTraduction();
  const langue = useLangue();
  const s = textes.siegeStats;
  const e = s.ensemble;
  const nombre = (n: number) => formatNombre(n, langue, { maximumFractionDigits: 0 });
  const g = siege.guildes.find((x) => x.id === guilde) ?? null;
  const b = bilanDeLaGuilde(siege, guilde);
  const rang = siege.resultat?.rang ?? g?.rang ?? null;
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-border bg-panel px-4 py-3">
      {nbSieges !== null && <Tuile libelle={e.sieges} valeur={nombre(nbSieges)} />}
      {rang !== null && <Tuile libelle={e.rang} valeur={s.place(rang)} detail={s.placeSur(s.place(rang), siege.resultat?.nbGuildes ?? siege.guildes.length)} />}
      {g?.score != null && <Tuile libelle={e.score} valeur={nombre(g.score)} />}
      <Tuile libelle={e.attaques} valeur={nombre(b.attaques.n)} detail={e.surAttaques(b.attaques.victoires, b.attaques.defaites)} />
      <Tuile
        libelle={e.tauxAttaque}
        valeur={b.attaques.taux !== null ? `${nombre(b.attaques.taux)} %` : '—'}
        detail={b.attaques.taux === null ? e.sansResultat : undefined}
        tendance={<Tendance wr={glissant?.attaque} />}
      />
      {b.defenses && (
        <Tuile
          libelle={e.tenue}
          valeur={b.defenses.tenue !== null ? `${nombre(b.defenses.tenue)} %` : '—'}
          tendance={<Tendance wr={glissant?.defense} />}
        />
      )}
    </div>
  );
}

// Deux bandes sur le même axe des heures, et un survol commun :
//  - en haut, les attaques FAITES (pointillé) et GAGNÉES (plein) de chaque
//    guilde, cumulées, en escalier — une même échelle, des attaques ;
//  - en bas, le WR de chaque guilde au fil du siège, sur une échelle centrée
//    sur ses valeurs (`bornesWr` : 50 à 100 % plutôt que 0 à 100).
// ⚠️ **Jamais deux échelles sur un même tracé** : un WR (0-100 %) posé sur
// l'axe des attaques inventerait des croisements qui n'existent pas. Deux
// bandes, une échelle chacune, le même temps.
const HAUTEUR = 170;
const HAUTEUR_WR = 70;
const ECART = 22;
const MARGE = { gauche: 34, droite: 44, haut: 10, bas: 24 };

function CourbeVictoires({
  siege,
  couleurDe,
  infobulles,
  visible,
}: {
  siege: SiegeReleve;
  couleurDe: (guilde: number) => CouleurGuilde;
  infobulles: boolean;
  visible: (cle: string) => boolean;
}) {
  const textes = useTraduction();
  const langue = useLangue();
  const e = textes.siegeStats.ensemble;
  const [ref, largeur] = useLargeur<HTMLDivElement>();
  const [survol, setSurvol] = useState<number | null>(null);
  // ⚠️ Mémorisées : le survol redessine la courbe à chaque mouvement.
  const toutes = useMemo(() => courbesDuSiege(siege), [siege]);
  // Les guildes masquées depuis la légende disparaissent ; les axes restent
  // ceux de toutes (une échelle qui sauterait à chaque clic se lirait mal).
  const courbes = toutes.filter((c) => visible(`g${c.guilde}`));
  const faites = visible('faites');
  const gagnees = visible('gagnees');
  const t0 = Math.min(...toutes.flatMap((c) => c.points.map((p) => p.t)));
  const t1 = Math.max(siege.fin ?? 0, ...siege.attaques.map((x) => x.t));
  const max = Math.max(1, ...toutes.map((c) => c.points[c.points.length - 1].attaques));
  const lx = largeur - MARGE.gauche - MARGE.droite;
  const x = (t: number) => MARGE.gauche + (t1 > t0 ? ((t - t0) / (t1 - t0)) * lx : 0);
  const y = (n: number) => MARGE.haut + HAUTEUR - (n / max) * HAUTEUR;
  const hautWr = MARGE.haut + HAUTEUR + ECART;
  // L'échelle du WR, centrée sur ses valeurs (`bornesWr`) : de 50 à 100 %
  // plutôt que de 0, quand le WR ne descend pas plus bas.
  const { bas, haut } = bornesWr(toutes);
  const yWr = (p: number) => hautWr + HAUTEUR_WR - ((p - bas) / (haut - bas)) * HAUTEUR_WR;
  const nomDe = (id: number) => siege.guildes.find((g) => g.id === id)?.nom ?? '';
  const heure = (t: number) => formatDateHeure(t * 1000, langue, { hour: '2-digit', minute: '2-digit' });
  const pourcent = (p: number) => `${formatNombre(p, langue, { maximumFractionDigits: 0 })} %`;
  // Les graduations : 0, la moitié, le haut ; 0, 50, 100 % ; cinq heures.
  const gradY = [...new Set([0, Math.round(max / 2), max])];
  const gradX = Array.from({ length: 5 }, (_, i) => t0 + ((t1 - t0) * i) / 4);
  // Un escalier : la valeur tient jusqu'au point suivant, puis jusqu'à la fin.
  const chemin = (points: PointCourbe[], v: (p: PointCourbe) => number | null, yv: (n: number) => number) => {
    let d = '';
    let dernier: number | null = null;
    for (const p of points) {
      const n = v(p);
      if (n === null) continue;
      d += d ? `H${x(p.t)}V${yv(n)}` : `M${x(p.t)},${yv(n)}`;
      dernier = n;
    }
    return dernier === null ? '' : `${d}H${x(t1)}`;
  };
  const surDeplacement = (ev: React.PointerEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ev.clientX - r.left;
    if (px < MARGE.gauche || px > largeur - MARGE.droite) return setSurvol(null);
    setSurvol(t0 + ((px - MARGE.gauche) / lx) * (t1 - t0));
  };
  const hauteurTotale = hautWr + HAUTEUR_WR + MARGE.bas;
  const derniers = courbes.map((c) => ({ c, p: c.points[c.points.length - 1] }));
  return (
    <div ref={ref} className="relative px-1 pb-2 pt-1">
      <svg
        width={largeur}
        height={hauteurTotale}
        className="block max-w-full touch-pan-y"
        onPointerMove={infobulles ? surDeplacement : undefined}
        onPointerLeave={() => setSurvol(null)}
        role="img"
        aria-label={derniers.map(({ c, p }) => e.courbePoint(nomDe(c.guilde), p.attaques, p.victoires, p.wr === null ? '—' : pourcent(p.wr))).join(' ; ')}
      >
        {gradY.map((n) => (
          <g key={`a${n}`}>
            <line x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y(n)} y2={y(n)} stroke="rgb(var(--border-soft))" strokeWidth={1} />
            <text x={MARGE.gauche - 6} y={y(n) + 4} textAnchor="end" className="fill-ink-dim text-micro">
              {n}
            </text>
          </g>
        ))}
        {[bas, (bas + haut) / 2, haut].map((p) => (
          <g key={`w${p}`}>
            <line x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={yWr(p)} y2={yWr(p)} stroke="rgb(var(--border-soft))" strokeWidth={1} />
            <text x={MARGE.gauche - 6} y={yWr(p) + 4} textAnchor="end" className="fill-ink-dim text-micro">
              {p}
            </text>
          </g>
        ))}
        <text x={MARGE.gauche} y={hautWr - 6} className="fill-ink-dim text-micro font-semibold">
          {e.courbeWr}
        </text>
        {gradX.map((t, i) => (
          <text key={i} x={x(t)} y={hauteurTotale - 6} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} className="fill-ink-dim text-micro">
            {heure(t)}
          </text>
        ))}
        {courbes.map((c) => (
          <g key={c.guilde} fill="none" stroke={TRAIT_GUILDE[couleurDe(c.guilde)]} strokeLinejoin="round">
            {faites && <path d={chemin(c.points, (p) => p.attaques, y)} strokeWidth={1.5} strokeDasharray="4 3" />}
            {gagnees && <path d={chemin(c.points, (p) => p.victoires, y)} strokeWidth={2} />}
            {gagnees && <path d={chemin(c.points, (p) => p.wr, yWr)} strokeWidth={2} />}
          </g>
        ))}
        {/* Libellés directs en bout de ligne, à l'encre : les attaques gagnées,
            et le WR final. */}
        {gagnees && derniers.map(({ c, p }) => (
          <g key={c.guilde} className="fill-ink text-micro font-semibold">
            <text x={x(t1) + 6} y={y(p.victoires) + 4}>
              {p.victoires}
            </text>
            {p.wr !== null && (
              <text x={x(t1) + 6} y={yWr(p.wr) + 4}>
                {formatNombre(p.wr, langue, { maximumFractionDigits: 0 })}
              </text>
            )}
          </g>
        ))}
        {infobulles && survol !== null && (
          <g>
            <line x1={x(survol)} x2={x(survol)} y1={MARGE.haut} y2={hautWr + HAUTEUR_WR} stroke="rgb(var(--ink-dimmer))" strokeWidth={1} />
            {courbes.map((c) => {
              const p = pointA(c.points, survol);
              return (
                <g key={c.guilde} fill={TRAIT_GUILDE[couleurDe(c.guilde)]} stroke="rgb(var(--panel))" strokeWidth={2}>
                  {faites && <circle cx={x(survol)} cy={y(p.attaques)} r={3} />}
                  {gagnees && <circle cx={x(survol)} cy={y(p.victoires)} r={4} />}
                  {gagnees && p.wr !== null && <circle cx={x(survol)} cy={yWr(p.wr)} r={4} />}
                </g>
              );
            })}
          </g>
        )}
      </svg>
      {infobulles && survol !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg border border-border bg-panel2 px-2.5 py-1.5 text-xs text-ink shadow-sm"
          style={x(survol) > largeur / 2 ? { right: largeur - x(survol) + 8 } : { left: x(survol) + 8 }}
        >
          <div className="mb-0.5 font-mono text-ink-dim">{heure(survol)}</div>
          {courbes.map((c) => {
            const p = pointA(c.points, survol);
            return (
              <div key={c.guilde} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className={`h-2 w-2 rounded-sm ${FOND_GUILDE[couleurDe(c.guilde)]}`} aria-hidden="true" />
                {e.courbePoint(nomDe(c.guilde), p.attaques, p.victoires, p.wr === null ? '—' : pourcent(p.wr))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Des barres simples : étiquette, barre (série 1), texte.
function Barres({ lignes }: { lignes: { cle: string; etiquette: string; valeur: number; texte: ReactNode }[] }) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      {lignes.map((l) => (
        <div key={l.cle} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-xs">
          <span className="truncate text-ink-dim">{l.etiquette}</span>
          <span className="h-2.5">
            <span className="block h-full rounded bg-serie-1" style={{ width: `${(100 * l.valeur) / max}%` }} />
          </span>
          <span className="tabular-nums text-ink">{l.texte}</span>
        </div>
      ))}
    </div>
  );
}
