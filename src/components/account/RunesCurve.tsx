import { useMemo } from 'react';
import { ListOrdered } from 'lucide-react';
import { RuneDetail } from '../../types';
import { distributionsCourbes } from '../../lib/runeCourbes';
import { useRuneMetric } from '../../hooks/useRuneMetric';
import { useStickyState } from '../../hooks/useStickyState';
import SetFilter from './SetFilter';
import NumberField from '../../ui/NumberField';
import AncientFilter, {
  AncientFilter as AncientFilterValue,
  keepAncient,
  normFiltreAntique,
} from './AncientFilter';
import Bouton from '../../ui/Bouton';
import Segmented from '../../ui/Segmented';
import SlotFilter from './SlotFilter';
import FiltresRunes from './FiltresRunes';
import CurveChart, { CurveSeries, OWN_COLOR } from './CurveChart';
import CurveLegend from './CurveLegend';
import HelpPopover from '../HelpPopover';
import InterrupteurDirect from './InterrupteurDirect';
import { useTraduction } from '../../hooks/useLangue';

interface Props {
  runes: RuneDetail[];
}

const DEFAULT_LIMIT = 400; // nb de runes affichées par défaut
const HERO_COLOR = '#c88cff'; // Potentiel héroïque → violet
const LEGEND_COLOR = '#f8b24a'; // Potentiel légendaire → orange

// ⚠️ Les clés des courbes masquées, MÉMORISÉES (`runesCurve.hidden`) : elles ne
// suivent pas la langue, sinon changer de langue réafficherait ce qu'on avait
// masqué. Le nom affiché vient du dictionnaire.
const CLE = { actuelle: 'Actuelle', hero: 'Potentiel Héro', legend: 'Potentiel Légend' } as const;

export default function RunesCurve({ runes }: Props) {
  const textes = useTraduction();
  const k = textes.courbes;
  // Liste blanche, tout coché par défaut (voir RunesList) : un set/slot coché est
  // affiché, aucun coché = rien.
  const [sets, setSets] = useStickyState<Set<string>>('runesCurve.sets', new Set(runes.map((r) => r.set)));
  const [slots, setSlots] = useStickyState<Set<number>>('runesCurve.slots', new Set([1, 2, 3, 4, 5, 6]));
  const [ancientBrut, setAncient] = useStickyState<AncientFilterValue>('runesCurve.ancient', 'all');
  const ancient = normFiltreAntique(ancientBrut);
  const [limit, setLimit] = useStickyState('runesCurve.limit', DEFAULT_LIMIT);
  const [hidden, setHidden] = useStickyState<Set<string>>('runesCurve.hidden', new Set());
  const [gemMode, setGemMode] = useStickyState<'gem' | 'grind'>('runesCurve.gemMode', 'gem');
  // ⚠️ Pas de « Autoriser un regemme différent » ici : les Courbes ne changent
  // jamais la stat d'une gemme, et n'en simulent aucune sur une rune qui n'en a
  // pas (voir runeCourbes.ts).
  // « Rune à rune » : les potentiels suivent le classement d'« Actuelle » au
  // lieu d'être triés chacun de son côté (voir runeCourbes.ts). Éteint par
  // défaut : la lecture classée reste celle qui compare des box.
  const [runeARune, setRuneARune] = useStickyState('runesCurve.runeARune', false);
  const metric = useRuneMetric(); // réglage global : efficience ou score SW
  const withGem = gemMode === 'gem';

  function toggleHidden(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  // Potentiels calculés sur les runes filtrées, puis 3 distributions triées ↓,
  // chacune avec SES runes (voir runeCourbes.ts).
  const { cur, hero, legend, potentiels } = useMemo(() => {
    const filtered = runes.filter((r) => {
      if (!sets.has(r.set)) return false;
      if (!slots.has(r.slot)) return false;
      if (!keepAncient(r, ancient)) return false;
      return true;
    });
    return distributionsCourbes(filtered, withGem, metric, runeARune);
  }, [runes, sets, slots, ancient, withGem, metric, runeARune]);

  const total = cur.effs.length;
  const cap = Math.max(1, limit);
  // Valeurs ET runes bornées ensemble : elles doivent rester alignées.
  const lim = (d: { effs: number[]; runes: RuneDetail[] }) => ({
    effs: d.effs.slice(0, cap),
    runes: d.runes.slice(0, cap),
  });

  // ⚠️ Les TROIS courbes transportent leurs runes. Triées chacune de son côté,
  // elles ne désignent pas la même rune à un même rang : au 32ᵉ rang, la courbe
  // héroïque montre la 32ᵉ meilleure rune EN POTENTIEL héroïque — souvent une
  // rune vierge, créditée du jet maximal —, pas la rune d'« Actuelle »
  // améliorée. Lue rune à rune, la courbe violette fait croire qu'un potentiel
  // n'est jamais atteint, alors que bien des runes meulées le dépassent. Montrer
  // la rune de chaque courbe au rang cliqué rend la lecture juste.
  // « Rune à rune », les potentiels ne sont plus triés : tracés en segments.
  const allSeries: (CurveSeries & { cle: string })[] = [
    { cle: CLE.actuelle, name: k.actuelle, ...lim(cur), color: OWN_COLOR, own: true },
    { cle: CLE.hero, name: k.potentielHero, ...lim(hero), color: HERO_COLOR, own: false, lisse: !runeARune },
    { cle: CLE.legend, name: k.potentielLegend, ...lim(legend), color: LEGEND_COLOR, own: false, lisse: !runeARune },
  ];
  const visible = allSeries.filter((s) => !hidden.has(s.cle));

  // Sur la fiche d'une rune : sa valeur d'aujourd'hui et ses DEUX potentiels,
  // quelle que soit la courbe qui l'a désignée — la carte du rang 32 de la
  // courbe héroïque dit ainsi d'où part cette rune, et ce qu'elle vaudrait en
  // légendaire.
  const valeursRune = (r: RuneDetail) => {
    const p = potentiels.get(r);
    if (!p) return [];
    return [
      { name: k.actuelle, color: OWN_COLOR, val: p.eff },
      { name: k.potentielHero, color: HERO_COLOR, val: p.heroEff },
      { name: k.potentielLegend, color: LEGEND_COLOR, val: p.legendEff },
    ];
  };

  // Le texte d'aide, passé à HelpPopover (bulle à la souris, panneau montant au
  // doigt). Le titre est rendu par HelpPopover, pas répété ici.
  const aide = (
    <>
        <p>
          {k.aide1} <b className="text-ink">{k.aide1Gras1}</b> {k.aide1b}{' '}
          <b className="text-ink">{k.aide1Gras2}</b> {k.aide1c} <i>{k.aide1Italique}</i>{k.aide1d}
        </p>
        <ul className="mt-2 space-y-1.5">
          <li>
            <span style={{ color: OWN_COLOR }}>●</span> <b className="text-ink">{k.actuelle}</b> — {k.aideActuelle}
          </li>
          <li>
            <span style={{ color: HERO_COLOR }}>●</span> <b className="text-ink">{k.potentielHero}</b> — {k.aideHero}{' '}
            <b className="text-ink">{k.aideHeroGras}</b>.
          </li>
          <li>
            <span style={{ color: LEGEND_COLOR }}>●</span> <b className="text-ink">{k.potentielLegend}</b> — {k.aideLegend}{' '}
            <b className="text-ink">{textes.artefactsCompte.aucunQuadGras}</b>.
          </li>
        </ul>
        <p className="mt-2">{k.aideRangs}</p>
        <p className="mt-2">
          {k.aideSelecteur} <b className="text-ink">{k.gemmeMeule} / {k.meuleSeule}</b> {k.aideSelecteur2}{' '}
          <b className="text-ink">{k.gemmeMeule}</b> {k.aideGemmeMeuleCourbes}{' '}
          <b className="text-ink">{k.meuleSeule}</b> {k.aideMeuleSeuleCourbes}
        </p>
        <p className="mt-2">
          {k.aideOnglet} <b className="text-ink">{k.optimisation}</b> {k.aidePourVoir}{' '}
          <b className="text-ink">{k.aideAmeliorer}</b> {k.aideFin}
        </p>
    </>
  );

  return (
    <div>
      {/* ⚠️ **En-tête à la SOURIS** (la maquette) :
          le titre de la vue et ce qu'elle trace. Au doigt, la barre du haut
          dit déjà la vue. */}
      <div className="mb-3 hidden items-baseline gap-3 lg:flex">
        <h1 className="font-display text-xl tracking-wide text-ink">{k.titre}</h1>
        <span className="text-sm text-ink-dim">
          {k.sousTitre(metric === 'eff' ? k.efficience : k.score)}
        </span>
      </div>

      {/* Filtres de la courbe — DANS LA PAGE, aux deux formats.
          ⚠️ **Pas de panneau « Options » ici**, contrairement à l'onglet Liste.
          Descendus dans le tiroir, ils laissaient un écran qui ne porte plus
          qu'un graphe et deux réglages : la page paraît vide, et le bouton
          flottant annonce un contenu qu'on ne devine pas. La Liste, elle, a
          3 000 tuiles à montrer — chaque rangée de filtre lui prend un écran de
          résultats, ce qui n'est pas le cas ici. */}
      {/* Au DOIGT : les rangées d'avant (`lg:hidden`). */}
      <div className="flex flex-col gap-3 mb-4 lg:hidden">
        {/* Application de bureau : « Mon compte » en direct (à la souris, en
            tête de `FiltresRunes`). */}
        <InterrupteurDirect className="self-start" />

        {/* Sets : icônes seules (voir SetFilter) */}
        <SetFilter runes={runes} value={sets} onChange={setSets} />

        <div className="flex flex-wrap items-center gap-2">
          <SlotFilter value={slots} onChange={setSlots} />
          <AncientFilter value={ancient} onChange={setAncient} />
        </div>
      </div>
      {/* À la SOURIS : trois menus déroulants, avec les
          mêmes contrôles dedans. */}
      <div className="mb-4 hidden lg:block">
        <FiltresRunes
          runes={runes}
          sets={sets}
          onSets={setSets}
          slots={slots}
          onSlots={setSlots}
          ancient={ancient}
          onAncient={setAncient}
        />
      </div>

      {/* Mode gemme + nombre de runes */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={gemMode}
            onChange={setGemMode}
            options={[
              {
                key: 'gem',
                label: k.gemmeMeule,
                hint: k.gemmeMeuleAideCourbes,
              },
              {
                key: 'grind',
                label: k.meuleSeule,
                hint: k.meuleSeuleAide,
              },
            ]}
          />
          <Bouton
            onClick={() => setRuneARune((v) => !v)}
            actif={runeARune}
            taille="sm"
            title={k.runeARuneAide}
            icone={<ListOrdered size={14} />}
            libelle={k.runeARune}
          />
          <span className="font-mono text-xs text-ink-dim">
            {k.top(Math.min(cap, total))}
            {total > cap && textes.artefactsCompte.sur(total)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="label">{k.nbRunes}</span>
          <NumberField
            value={limit}
            min={1}
            max={total || 1}
            step={10}
            width="w-14"
            ariaLabel={k.nombreRunes}
            onChange={(v) => setLimit(Math.max(1, v ?? 1))}
          />
          <Bouton onClick={() => setLimit(total || 1)} taille="sm" libelle={k.tout} />
        </div>
      </div>

      {/* Graphe + bouton d'aide superposé.
          ⚠️ **Même plafond de largeur et même centrage que la carte du graphe**
          (voir CurveChart) : sans eux, cette boîte débordait la carte au-delà de
          980 px et le bouton d'aide se posait à côté du dessin, pendant que le
          bouton de plein écran restait dans son coin. Les deux commandes doivent
          tomber sur la MÊME verticale. */}
      {/* ⚠️ **À la SOURIS, le graphe et sa légende côte à côte** (la
          maquette) : la légende passe dans une carte « Séries » à droite, en
          colonne, au lieu d'une rangée sous le graphe. Au doigt, la rangée
          d'avant. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start lg:gap-3">
      <div className="relative mx-auto w-full max-w-[980px]">
        {/* Aide « ? » posée sur le coin du graphe — bulle à la souris, panneau
            montant au doigt (voir HelpPopover). Le wrapper `absolute` la cale sur
            la même verticale que le bouton de plein écran de CurveChart. Libellé
            du bouton et titre du panneau diffèrent volontairement. */}
        <div className="absolute right-2 top-2 z-20">
          <HelpPopover title={k.aideTitre} ariaLabel={k.aideBouton}>
            {aide}
          </HelpPopover>
        </div>

        <CurveChart
          series={visible}
          yLabel={metric === 'eff' ? k.axeEfficience : k.axeScore}
          unit={metric === 'eff' ? '%' : ''}
          ordreCartes="series"
          valeursRune={valeursRune}
        />
      </div>

      {/* Légende partagée avec l'onglet Comparaison (voir CurveLegend) — sous le
          graphe, en rangée : la couleur et le nom, rien d'autre. Les valeurs
          (max, médiane) se lisent au survol du graphe ; répétées ici, elles
          alourdissaient une zone qui ne sert qu'à identifier et masquer. Aucune
          courbe ne se retire ici (potentiels et « Moi » sont calculés). */}
      <aside className="lg:rounded-xl lg:border lg:border-border-soft lg:bg-panel lg:p-3">
        <p className="mb-2 hidden label lg:block">{k.series}</p>
        <CurveLegend
          entrees={allSeries.map((s) => ({ name: s.name, cle: s.cle, color: s.color }))}
          masquees={hidden}
          onBascule={toggleHidden}
          className="lg:mt-0 lg:flex-col lg:items-stretch lg:gap-1"
        />
      </aside>
      </div>
    </div>
  );
}
