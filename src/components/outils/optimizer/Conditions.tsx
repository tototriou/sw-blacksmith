import HelpPopover from '../../HelpPopover';
import { Interrupteur, NumberField, Bouton, Pastille } from '../../../ui';
import { RECO_STATS } from '../../../types';
import { BASE_TOGGLE_STATS, CAPPED_100 } from './constantes';
import { Fragment, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { RotateCcw } from 'lucide-react';
import { type StatKey } from '../../../lib/effects';
import { useLangue, useTraduction } from '../../../hooks/useLangue';
import { formatNombre } from '../../../i18n/format';
import { SORTS_PRECISION, type SortPrecision } from '../../../lib/precisionParSort';

export interface ConditionsProps {
  excludeBase: boolean;
  setExcludeBase: Dispatch<SetStateAction<boolean>>;
  baseOf: (key: StatKey) => number;
  artifactFloorOf: (key: StatKey, base: number, bonusMode: boolean) => number;
  minStats: Partial<Record<StatKey, number>>;
  maxStats: Partial<Record<StatKey, number>>;
  setMinStats: Dispatch<SetStateAction<Partial<Record<StatKey, number>>>>;
  setMaxStats: Dispatch<SetStateAction<Partial<Record<StatKey, number>>>>;
  // Variante de « Critères » au bureau (`bureau/ConditionsBureau.tsx`, section
  // de 302 px) : la colonne des libellés prend la largeur du plus long d'entre
  // eux au lieu de 90 px au moins, les colonnes s'écartent de 12 px au lieu de
  // 16, et la grille est centrée dans la section. « Min » et « Max » y sont des
  // en-têtes de colonne posés une fois, comme au téléphone : collés à chaque
  // champ, ils faisaient déborder la grille de la colonne (≈ 322). Le téléphone
  // ne la passe pas.
  bureau?: boolean;
  // L'encart « Speed tune » du membre contraint
  // (feat-contrainte-speed-tune.md, « Écran ») : posé sous la grille.
  // `vitessePossedee` : attaché, il possède la VIT minimum, qui ne s'affiche
  // ni ne se saisit ; la VIT maximum reste une condition du membre.
  speedTune?: ReactNode;
  vitessePossedee?: boolean;
  // La VIT maximum saisie sous le bas de la zone du speed tune
  // (`conflitVitesseMax`), en VIT totale : le champ passe en rouge et un
  // message le dit sous la grille. Sans lui, « Rechercher » ne ferait rien.
  conflitVitesse?: { max: number; min: number } | null;
  // Précision minimale PAR SORT (precisionParSort.ts) : les sorts cochés sous
  // la ligne « Précision ». `sortsDisponibles` : ceux que le monstre peut
  // lancer (`sortsPrecisionDisponibles`) ; un sort absent reste décochable.
  // Absents (gabarits du banc sans état) : la rangée ne s'affiche pas.
  sortsPrecision?: SortPrecision[];
  setSortsPrecision?: Dispatch<SetStateAction<SortPrecision[]>>;
  sortsDisponibles?: readonly SortPrecision[];
}

export default function Conditions({ excludeBase, setExcludeBase, baseOf, artifactFloorOf, minStats, maxStats, setMinStats, setMaxStats, bureau = false, speedTune, vitessePossedee = false, conflitVitesse = null, sortsPrecision, setSortsPrecision, sortsDisponibles = SORTS_PRECISION }: ConditionsProps) {
  const textes = useTraduction();
  const jeu = textes.jeu;
  const k = textes.optimizer.conditions;
  const a = k.aideBase;
  // ⚠️ Le conflit se montre à la SORTIE du champ : à la frappe, « 2 » puis
  // « 22 » en route vers « 220 » allumeraient le message à chaque touche.
  const [saisieVitMax, setSaisieVitMax] = useState(false);
  const conflitAffiche = vitessePossedee && !saisieVitMax ? conflitVitesse : null;
  const bonusVit = BASE_TOGGLE_STATS.has('spd') && excludeBase;
  const langue = useLangue();
  const n = (v: number) => formatNombre(v, langue);
  const vitAffichee = (v: number) => (bonusVit ? v - baseOf('spd') : v);
  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <p className="label">{k.titre}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-ink-dim">{k.baseExclue}</span>
          <HelpPopover title={k.baseExclue}>
            <b className="text-ink">{a.statsDeBase}</b>{a.active}<b className="text-ink">{a.auDessus}</b>{a.desactive}
            <b className="text-ink">{a.statsTotales}</b>{a.toujoursTotal}
          </HelpPopover>
          <Interrupteur
            actif={excludeBase}
            onChange={setExcludeBase}
            aria-label={k.baseExclueAria}
          />
        </div>
      </div>
      {/* ⚠️ `boxWidth` fixe sur CHAQUE NumberField ci-dessous (voir
          NumberField.tsx) : sans ça, un champ avec suffixe « % » serait
          TOUJOURS plus large qu'un champ sans suffixe à largeur de texte
          égale (le suffixe prend de la place en plus), et les colonnes
          Min/Max ne s'aligneraient pas d'une stat à l'autre. */}
      {/* ⚠️ `gap-x` réduit sous `sm` : trois colonnes plus deux écarts de
          16 px ne laissaient plus de place aux champs sur 348 px utiles. */}
      {/* ⚠️ `w-fit` : sans lui, un conteneur `grid` en bloc prend TOUTE la
          largeur de son parent, et les colonnes `auto` (Min/Max) SE
          PARTAGENT l'espace libre restant (comportement CSS Grid par
          défaut dès qu'aucune piste n'est en `fr`) — sur une carte large,
          Min et Max se retrouvaient étirés à des dizaines de pixels l'un
          de l'autre. `w-fit` borne la grille à son contenu réel : les
          colonnes redeviennent SERRÉES, quelle que soit la largeur de la
          carte qui l'entoure. Demande explicite : « resserré ». */}
      <div className={bureau
        ? 'mx-auto grid w-fit grid-cols-[auto_auto_auto] items-center gap-x-3 gap-y-1.5 pr-px'
        : 'grid w-fit grid-cols-[minmax(76px,auto)_auto_auto] items-center gap-x-2 gap-y-1.5 sm:grid-cols-[minmax(90px,auto)_auto_auto] sm:gap-x-4'}>
        {/* ⚠️ En-têtes Min/Max au doigt et dans « Critères » au bureau. Le
            libellé « Min »/« Max » collé à chaque champ faisait déborder la
            rangée (label + 2 champs + 2 mots > largeur utile) ; on les masque
            et on pose ces deux en-têtes une seule fois. Ailleurs (`sm:`, hors
            variante bureau), chaque champ garde son libellé à côté. */}
        <span className={bureau ? '' : 'sm:hidden'} aria-hidden />
        <span className={`label text-center ${bureau ? '' : 'sm:hidden'}`}>{k.min}</span>
        <span className={`label text-center ${bureau ? '' : 'sm:hidden'}`}>{k.max}</span>
        {RECO_STATS.map((st) => {
          const affectedByToggle = BASE_TOGGLE_STATS.has(st.key);
          const base = baseOf(st.key);
          const capped = CAPPED_100.has(st.key);
          const bonusMode = affectedByToggle && excludeBase;
          const ceiling = capped ? (bonusMode ? 100 - base : 100) : undefined;
          // ⚠️ Plancher affiché/autorisé, PAS la même chose que `base` (qui
          // sert à la conversion affichage↔stockage, voir `baseOf`) : avec
          // zéro rune, un monstre a déjà AU MOINS ce bonus/total en jeu
          // (base nue + artéfacts éventuellement comptés) — voir
          // `artifactFloorOf`. En mode bonus, seul l'artéfact compte (la
          // base nue est déjà soustraite par la conversion elle-même) ; en
          // mode total, base ET artéfact s'additionnent.
          const floor = artifactFloorOf(st.key, base, bonusMode);

          const minTotal = minStats[st.key] ?? null;
          const minDisplayed = minTotal == null ? null : bonusMode ? minTotal - base : minTotal;
          const maxTotalVal = maxStats[st.key] ?? null;
          const maxDisplayed = maxTotalVal == null ? null : bonusMode ? maxTotalVal - base : maxTotalVal;
          const parSort = st.key === 'acc' && (sortsPrecision?.length ?? 0) > 0;

          return (
            <Fragment key={st.key}>
              <span className="text-xs text-ink">{jeu.stats[st.key]}</span>
              {vitessePossedee && st.key === 'spd' ? (
                <span className="text-xs text-ink-dim" title={k.vitesseSpeedTune}>{k.vitesseSpeedTuneCourt}</span>
              ) : (
              <div className="flex items-center gap-1.5">
                <NumberField
                  value={minDisplayed}
                  onChange={(v) =>
                    setMinStats((prev) => {
                      const next = { ...prev };
                      if (v == null) delete next[st.key];
                      else next[st.key] = bonusMode ? v + base : v;
                      return next;
                    })
                  }
                  allowEmpty
                  // ⚠️ Le total (ou le bonus, artéfacts comptés) ne descend
                  // jamais sous ce plancher — même sans la moindre rune, il
                  // est déjà garanti (base nue en mode total, artéfacts en
                  // mode bonus).
                  min={floor}
                  max={ceiling}
                  placeholder={String(floor)}
                  suffix={st.suffix || undefined}
                  boxWidth="w-24"
                  ariaLabel={`${jeu.stats[st.key]} minimum`}
                  title={parSort ? k.minimumParSort(sortsPrecision!.map((n) => k.sortCourt(n)).join(', ')) : k.minimum}
                />
                {!bureau && <span className="hidden sm:inline text-ink-dim text-micro">{k.min}</span>}
              </div>
              )}
              <div className="flex items-center gap-1.5"
                onFocusCapture={st.key === 'spd' ? () => setSaisieVitMax(true) : undefined}>
                <NumberField
                  value={maxDisplayed}
                  ton={st.key === 'spd' && conflitAffiche ? 'bad' : 'neutre'}
                  onChange={(v) =>
                    setMaxStats((prev) => {
                      const next = { ...prev };
                      if (v == null) delete next[st.key];
                      else next[st.key] = bonusMode ? v + base : v;
                      return next;
                    })
                  }
                  allowEmpty
                  min={floor}
                  max={ceiling}
                  placeholder={capped ? String(ceiling) : '—'}
                  suffix={st.suffix || undefined}
                  boxWidth="w-24"
                  // ⚠️ **Un maximum sous le minimum retombe au défaut**
                  // (demande explicite) : la condition serait insatisfaisable
                  // par construction, et la recherche renverrait « 0 build »
                  // sans que rien ne dise pourquoi.
                  //
                  // ⚠️ À la SORTIE du champ, jamais à la frappe : on ne
                  // saurait pas distinguer un « 5 » définitif d'un « 50 » en
                  // cours d'écriture — c'est le même piège que celui que
                  // `NumberField` documente déjà pour le bornage par `min`.
                  //
                  // ⚠️ On EFFACE plutôt que de remonter à la valeur du
                  // minimum : le champ retrouve alors son placeholder, donc
                  // son défaut (le plafond pour une stat bornée à 100,
                  // « aucun maximum » sinon). Le corriger silencieusement en
                  // « max = min » poserait une contrainte que l'utilisateur
                  // n'a pas demandée, et qui ne laisse passer qu'une valeur.
                  onBlur={() => {
                    if (st.key === 'spd') setSaisieVitMax(false);
                    const mn = minStats[st.key];
                    const mx = maxStats[st.key];
                    if (mn == null || mx == null || mx >= mn) return;
                    setMaxStats((prev) => {
                      const next = { ...prev };
                      delete next[st.key];
                      return next;
                    });
                  }}
                  ariaLabel={`${jeu.stats[st.key]} maximum`}
                  title={k.maximum}
                />
                {!bureau && <span className="hidden sm:inline text-ink-dim text-micro">{k.max}</span>}
              </div>
              {/* ⚠️ Rangée TOUJOURS posée sous « Précision » : cocher un sort ne
                  déplace rien (un clic ne déplace jamais ce qu'on vient de
                  cliquer). Les pastilles occupent les colonnes Min et Max. */}
              {st.key === 'acc' && sortsPrecision && setSortsPrecision && (
                <>
                  <span className="flex items-center gap-1 text-xs text-ink-dim">
                    {k.parSort}
                    <HelpPopover title={k.parSort}>{k.parSortAide}</HelpPopover>
                  </span>
                  <div className="col-span-2 flex items-center gap-1.5">
                    {SORTS_PRECISION.map((n) => {
                      const actif = sortsPrecision.includes(n);
                      const disponible = sortsDisponibles.includes(n);
                      return (
                        <Pastille
                          key={n}
                          actif={actif}
                          libelle={k.sortCourt(n)}
                          aria-label={k.sortAria(n)}
                          title={disponible ? k.sortAria(n) : k.sortIndisponible}
                          // Un sort coché reste décochable même indisponible
                          // (recette importée d'un autre monstre).
                          disabled={!disponible && !actif}
                          className="disabled:opacity-40"
                          onClick={() =>
                            setSortsPrecision((prev) =>
                              prev.includes(n) ? prev.filter((x) => x !== n) : SORTS_PRECISION.filter((x) => x === n || prev.includes(x))
                            )
                          }
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </Fragment>
          );
        })}
      </div>
      <div className="flex justify-end mt-1.5">
        <Bouton
          fond="vide"
          trait="aucun"
          taille="sm"
          onClick={() => {
            setMinStats({});
            setMaxStats({});
            setSortsPrecision?.([]);
          }}
          icone={<RotateCcw size={13} />}
          libelle={k.reinitialiser}
          className="text-ink-dim hoverable:text-bad"
        />
      </div>
      {/* Sous le bouton de remise à zéro : son apparition ne déplace aucun
          contrôle de la grille, seulement l'encart qui suit. */}
      {conflitAffiche && (
        <p role="alert" data-conflit-vitesse className="mt-1.5 text-xs text-bad">
          {k.vitesseMaxSousSpeedTune(n(vitAffichee(conflitAffiche.max)), n(vitAffichee(conflitAffiche.min)))}
        </p>
      )}
      {speedTune}
    </div>
  );
}
