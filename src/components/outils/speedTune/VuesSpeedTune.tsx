import type { UIEventHandler } from 'react';
import MonsterAvatar from '../../MonsterAvatar';
import { Jeton } from '../../../ui';
import { useTraduction } from '../../../hooks/useLangue';
import { SIEGE_TICKS } from '../../../lib/speed';
import { speedForTick, HORIZON_TICKS, type Action, type LigneSim } from '../../../lib/speedTune';
import type { Ligne } from '../../../lib/speedTuneLignes';

// Les vues du speed tuning qui ne font QU'AFFICHER un résultat : le repère des
// ticks, l'ordre de tour, la barre d'action par tick. Sorties de
// SpeedTuningSection pour que l'accueil montre EXACTEMENT ce que l'outil
// montre, sur une équipe de démonstration passée par le même moteur
// (docs/02-app/speed-tuning/feat-ecran.md, docs/02-app/accueil/README.md).
// ⚠️ Aucun calcul ici : tout arrive de `useSpeedTune` (l'outil) ou de
// `demoSpeedTune` (l'accueil), qui appellent la même lib.

// Repère des ticks en tête : vitesse de combat minimale pour agir à chaque tick.
// Plage utile en jeu, les deux ticks siège (239/286) marqués en couleur.
//
// ⚠️ **Dans le SENS CROISSANT des ticks (3 → 11)**, comme les trois tableaux qui
// suivent et comme le temps lui-même. Il descendait (11 → 3) pour aller du plus
// lent au plus rapide : on lisait donc l'écran dans un sens en haut et dans
// l'autre en dessous, et il fallait retourner sa lecture à chaque aller-retour.
const RULER_TICKS = [3, 4, 5, 6, 7, 8, 9, 10, 11];
const TICKS_SIEGE = new Set(SIEGE_TICKS.map((t) => t.value));

// ⚠️ **Les trois tableaux (barres, boost, buff) partagent EXACTEMENT la même
// grille de colonnes** — même largeur de colonne « cible », même largeur de
// tick, mêmes 40 ticks — et leur défilement horizontal est synchronisé. Sans
// ça, tick 12 du boost ne tombait pas sous tick 12 des barres : on se perdait.
export const LARGEUR_CIBLE = 210; // colonne de gauche (portrait + nom)
export const LARGEUR_TICK = 92; // chaque colonne de tick (3 décimales, voir plus bas)
const ticksJusqua = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
export const largeurTable = (n: number = HORIZON_TICKS) => LARGEUR_CIBLE + n * LARGEUR_TICK;

// Colonnes fixes communes, posées à l'identique dans chaque tableau.
export function Colonnes({ nbTicks = HORIZON_TICKS }: { nbTicks?: number }) {
  return (
    <colgroup>
      <col style={{ width: LARGEUR_CIBLE }} />
      {ticksJusqua(nbTicks).map((t) => (
        <col key={t} style={{ width: LARGEUR_TICK }} />
      ))}
    </colgroup>
  );
}

// En-tête de ticks commun (numéros 1 → 40).
export function TeteTicks({ premiere, nbTicks = HORIZON_TICKS }: { premiere: string; nbTicks?: number }) {
  return (
    <thead>
      <tr className="border-b border-border text-ink-dimmer">
        <th className="sticky left-0 z-[2] border-r border-border-soft bg-panel px-3 py-2 text-left text-xs font-semibold">
          {premiere}
        </th>
        {ticksJusqua(nbTicks).map((t) => (
          <th key={t} className="px-1 py-2 text-center font-mono text-xs font-semibold">
            {t}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// Le repère des ticks : chaque monstre posé dans la case du tick que lui donne
// sa vitesse (tick NATUREL, regroupé par `parTick`).
export function RepereTicks({ parTick }: { parTick: Map<number, Ligne[]> }) {
  const st = useTraduction().speedTuning;
  return (
    <section className="rounded-lg border border-border bg-panel">
      <div className="border-b border-border-soft px-4 py-2 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
        {st.repere.titre}
        <span className="ml-2 font-normal normal-case tracking-normal text-ink-dimmer">{st.repere.sousTitre}</span>
      </div>
      <div className="flex overflow-x-auto">
        {RULER_TICKS.map((n, i) => {
          const sp = speedForTick(n);
          const siege = TICKS_SIEGE.has(sp);
          const ici = parTick.get(n) ?? [];
          return (
            <div
              key={n}
              className={`flex-1 basis-[74px] px-2 py-1.5 text-center ${i > 0 ? 'border-l border-border-soft' : ''} ${
                siege ? 'bg-accent-soft' : ''
              }`}
            >
              {/* ⚠️ Tick et vitesse sur UNE ligne : deux lignes empilées
                  coûtaient la hauteur d'un portrait pour deux nombres courts,
                  en tête d'un écran qui manque de place. Ticks siège
                  (239 / 286) : couleur seule, sans libellé. */}
              <div className="flex items-baseline justify-center gap-1">
                <span className={`font-mono text-sm font-bold ${siege ? 'text-accent' : 'text-ink'}`}>{n}</span>
                <span className={`font-mono text-micro ${siege ? 'text-accent/70' : 'text-ink-dim'}`}>{sp}</span>
              </div>
              {ici.length > 0 && (
                <div className="mt-1 flex flex-wrap justify-center gap-1">
                  {ici.map((l) => (
                    <MonsterAvatar
                      key={l.uid}
                      monster={l.monster}
                      size={20}
                      element={false}
                      className={l.camp === 'ennemi' ? 'rounded-sm ring-1 ring-bad' : ''}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// L'ordre de tour : un jeton par premier tour, les deux camps entrelacés.
export function OrdreDeTour({ premiers, ligneParUid, className = '' }: { premiers: Action[]; ligneParUid: Map<string, Ligne>; className?: string }) {
  const st = useTraduction().speedTuning;
  return (
    <section className={`rounded-lg border border-border bg-panel ${className}`}>
      <div className="border-b border-border-soft px-4 py-2.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
        {st.ordreDeTour}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3.5">
        {premiers.map((a, i) => {
          const l = ligneParUid.get(a.id);
          if (!l) return null;
          const adv = a.camp === 'ennemi';
          return (
            <span key={a.id} className="flex items-center gap-2">
              {i > 0 && <span className="text-ink-dimmer">→</span>}
              <Jeton
                icone={
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-micro font-bold text-bg ${
                        adv ? 'bg-bad' : 'bg-good'
                      }`}
                    >
                      {a.ordre}
                    </span>
                    <MonsterAvatar monster={l.monster} size={20} element={false} />
                  </span>
                }
                libelle={l.monster.name}
                detail={<span className="font-mono">{st.tick(a.tick)}</span>}
              />
            </span>
          );
        })}
      </div>
    </section>
  );
}

// La barre d'action par tick (résultat, lecture seule).
// `nbTicks` : les colonnes montrées — les 40 du moteur dans l'outil, les
// premières sur l'accueil.
export function TableauBarres({
  lignesTableau,
  ligneParUid,
  numAction,
  nbTicks = HORIZON_TICKS,
  refConteneur,
  onScroll,
}: {
  lignesTableau: LigneSim[];
  ligneParUid: Map<string, Ligne>;
  numAction: Map<string, number>;
  nbTicks?: number;
  refConteneur?: (el: HTMLDivElement | null) => void;
  onScroll?: UIEventHandler<HTMLDivElement>;
}) {
  const st = useTraduction().speedTuning;
  return (
    <section className="rounded-lg border border-border bg-panel">
      <div className="border-b border-border-soft px-4 py-2.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
        {st.barres.titre}
        <span className="ml-2 font-normal normal-case tracking-normal text-ink-dimmer">{st.barres.sousTitre(HORIZON_TICKS)}</span>
      </div>
      <div className="overflow-x-auto" ref={refConteneur} onScroll={onScroll}>
        <table
          className="table-fixed border-collapse font-mono text-xs [font-variant-numeric:tabular-nums]"
          style={{ width: largeurTable(nbTicks) }}
        >
          <Colonnes nbTicks={nbTicks} />
          <TeteTicks premiere={st.barres.monstre} nbTicks={nbTicks} />
          <tbody>
            {lignesTableau.map((e) => {
              const l = ligneParUid.get(e.id);
              if (!l) return null;
              const adv = e.camp === 'ennemi';
              return (
                <tr key={e.id} className="border-b border-border-soft">
                  {/* ⚠️ **La colonne des noms porte le camp.** C'est la
                      seule qui reste à l'écran quand on défile les 40
                      ticks : sans elle, on lit une ligne de chiffres sans
                      savoir si elle est à soi ou en face. Fond SOLIDE
                      (`-soft`), jamais une transparence — la colonne est
                      collante et passe par-dessus le tableau qui défile
                      dessous. */}
                  <th
                    className={`sticky left-0 z-[2] border-r border-border-soft px-3 py-1.5 text-left font-normal ${
                      adv ? 'bg-bad-soft' : 'bg-good-soft'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <MonsterAvatar monster={l.monster} size={24} element={false} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-sans text-sm">{l.monster.name}</span>
                          {adv && (
                            <span className="flex-none rounded border border-bad/50 px-1 text-micro font-bold uppercase tracking-wide text-bad">
                              {st.barres.adv}
                            </span>
                          )}
                        </span>
                        <span className="block text-micro text-ink-dim">{st.barres.parTick(e.incBase.toFixed(3))}</span>
                      </span>
                    </span>
                  </th>
                  {ticksJusqua(nbTicks).map((t) => {
                    const num = numAction.get(`${e.id}@${t}`);
                    const estAction = num != null;
                    const atb = e.trajectoire[t - 1];
                    // Les DEUX camps par une transparence de leur couleur : `accent-soft` était
                    // un fond opaque d'un côté et un voile de l'autre, deux
                    // intensités pour un même repère.
                    const fond = estAction ? (adv ? 'bg-bad/15' : 'bg-good/15') : '';
                    const encre = estAction
                      ? 'font-bold text-ink'
                      : atb != null && atb >= 100
                        ? 'text-ink' // barre pleine en attente de son tour
                        : 'text-ink-dim';
                    return (
                      <td key={t} className={`relative py-1.5 text-center ${fond} ${encre}`}>
                        {atb == null ? '' : atb.toFixed(3)}
                        {estAction && (
                          <span
                            className={`absolute -right-0.5 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-0.5 text-micro font-bold text-bg ${
                              adv ? 'bg-bad' : 'bg-good'
                            }`}
                          >
                            {num}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border-soft px-4 py-2.5 text-xs text-ink-dim">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-good/25" /> {st.barres.equipeAgit}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-bad/25" /> {st.barres.adversaireAgit}
        </span>
        <span>{st.barres.unParTick}</span>
      </div>
    </section>
  );
}
