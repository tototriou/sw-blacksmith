// Siège › Statistiques, LES GUILDES d'un siège choisi (`comparatifDesGuildes`,
// src/lib/siegeStatistiques.ts — docs/02-app/siege/statistiques.md), en deux
// lectures :
// - le CLASSEMENT : une barre de score par guilde, à sa couleur, son emblème
//   (la forme de son territoire sur la carte) et son rang ; sa participation
//   en petit dessous ;
// - le FACE-À-FACE avec chaque autre guilde : nos attaques sur elle et les
//   siennes sur nous, chacune en barre gagnées / perdues, à la couleur de
//   la guilde qui attaque.
//
// ⚠️ **Rien de calculé ici.** ⚠️ **Deux formats, un seul rendu** : les blocs
// se rangent côte à côte à la souris, empilés au doigt.

import { useMemo } from 'react';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import { formatNombre } from '../../i18n/format';
import { comparatifDesGuildes, type ColonneComparatif, type CouleurGuilde, type SiegeReleve } from '../../lib/siegeStatistiques';
import { FOND_GUILDE } from './SiegeGraphes';
import { Bloc, EcussonTour } from './SiegeStatsElements';

export default function SiegeComparatif({ siege, maGuilde, fini }: { siege: SiegeReleve; maGuilde: number; fini: boolean }) {
  const textes = useTraduction();
  const langue = useLangue();
  const s = textes.siegeStats;
  const c = s.comparatif;
  const colonnes = useMemo(() => comparatifDesGuildes(siege, maGuilde, fini), [siege, maGuilde, fini]);
  const nombre = (n: number) => formatNombre(n, langue, { maximumFractionDigits: 0 });
  // Le classement : au rang une fois le siège fini, au score sinon.
  const classees = [...colonnes].sort((a, b) => (a.rang ?? 9) - (b.rang ?? 9) || (b.score ?? 0) - (a.score ?? 0));
  const scoreMax = Math.max(1, ...colonnes.map((k) => k.score ?? 0));
  const nous = colonnes.find((k) => k.guilde.id === maGuilde);
  const adversaires = colonnes.filter((k) => k.guilde.id !== maGuilde);
  const participation = (k: ColonneComparatif) =>
    [
      k.joueurs !== null ? c.joueurs(k.joueurs) : null,
      k.attaques !== null ? c.attaques(nombre(k.attaques), k.attendues !== null ? nombre(k.attendues) : null) : null,
      k.monstres !== null ? c.monstres(nombre(k.monstres), k.monstresMax !== null ? nombre(k.monstresMax) : null) : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="label text-ink-dim">{c.titre}</h2>
      {/* ⚠️ ALIGNÉS (`Bloc aligne`) : titres, aide et cadres partagent les
          rangées de la grille — l'aide du face-à-face ne décale plus son cadre,
          et les deux cadres ont la même hauteur. */}
      <div className="-mb-4 grid gap-x-4 grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
        <Bloc aligne titre={fini ? c.classement : c.classementProvisoire}>
          <ol className="flex flex-col gap-3 px-4 py-3">
            {classees.map((k, i) => (
              <li key={k.guilde.id} className="flex items-center gap-3">
                <span className="w-7 flex-none text-center font-display text-lg text-ink">{k.rang !== null ? s.place(k.rang) : s.place(i + 1)}</span>
                <EcussonTour couleur={k.couleur} numero="" taille={18} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm text-ink">
                      <span className={k.guilde.mienne ? 'font-semibold' : ''}>{k.guilde.nom}</span>
                      {k.guilde.mienne && <span className="ml-1.5 text-xs text-ink-dim">{s.maGuilde}</span>}
                    </span>
                    <span className="flex-none font-display text-base tabular-nums text-ink">{k.score !== null ? nombre(k.score) : '—'}</span>
                  </span>
                  <span className="mt-1 block h-2 rounded-full bg-border-soft">
                    <span className={`block h-full rounded-full ${FOND_GUILDE[k.couleur]}`} style={{ width: `${(100 * (k.score ?? 0)) / scoreMax}%` }} />
                  </span>
                  <span className="mt-0.5 block truncate text-xs tabular-nums text-ink-dim">{participation(k)}</span>
                </span>
              </li>
            ))}
          </ol>
        </Bloc>

        {nous && adversaires.length > 0 && (
          <Bloc aligne titre={c.faceAFace} aide={c.aide}>
            <div className="flex flex-col divide-y divide-border-soft">
              {adversaires.map((k) => {
                // Les deux barres d'un face-à-face à la même échelle.
                const max = Math.max(1, k.nosAttaques ?? 0, k.contreNous ?? 0);
                return (
                  <div key={k.guilde.id} className="px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 text-sm text-ink">
                      <EcussonTour couleur={k.couleur} numero="" taille={16} />
                      <span className="truncate font-semibold">{c.contre(k.guilde.nom)}</span>
                    </div>
                    <Duel libelle={c.nosAttaques} couleur={nous.couleur} victoires={k.nosVictoires ?? 0} defaites={k.nosDefaites ?? 0} total={k.nosAttaques ?? 0} max={max} />
                    <Duel libelle={c.sesAttaques} couleur={k.couleur} victoires={k.victoires} defaites={k.defaites} total={k.contreNous ?? 0} max={max} />
                  </div>
                );
              })}
            </div>
          </Bloc>
        )}
      </div>
    </section>
  );
}

// Une ligne du face-à-face : qui attaque, la barre (gagnées pleines, perdues
// pâles, un écart de 2 px entre les deux), le compte et le taux.
function Duel({ libelle, couleur, victoires, defaites, total, max }: { libelle: string; couleur: CouleurGuilde; victoires: number; defaites: number; total: number; max: number }) {
  const textes = useTraduction();
  const langue = useLangue();
  const c = textes.siegeStats.comparatif;
  const nombre = (n: number) => formatNombre(n, langue, { maximumFractionDigits: 0 });
  const connus = victoires + defaites;
  const taux = connus ? nombre((100 * victoires) / connus) : null;
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-0.5 py-0.5 text-xs" title={c.detailDuel(victoires, defaites, total)}>
      <span className="truncate text-ink-dim">{libelle}</span>
      <span className="flex h-2.5 gap-[2px]" style={{ width: `${(100 * total) / max}%` }}>
        {victoires > 0 && <span className={`h-full rounded-l-full ${defaites ? '' : 'rounded-r-full'} ${FOND_GUILDE[couleur]}`} style={{ flexGrow: victoires }} />}
        {defaites > 0 && <span className={`h-full rounded-r-full ${victoires ? '' : 'rounded-l-full'} ${FOND_GUILDE[couleur]} opacity-40`} style={{ flexGrow: defaites }} />}
      </span>
      <span />
      <span className="tabular-nums text-ink">{c.resumeDuel(nombre(total), nombre(victoires), taux)}</span>
    </div>
  );
}
