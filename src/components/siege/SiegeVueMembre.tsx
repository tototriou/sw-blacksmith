// Siège › Statistiques, la VUE D'ENSEMBLE d'un membre : ses chiffres du siège
// choisi, son WR au fil des sièges, ses offenses les plus jouées sur les tours
// 5★ et 4★, les défenses les plus dures à battre pour lui
// (docs/02-app/siege/statistiques.md).
//
// ⚠️ **Rien de calculé ici** : tout vient de src/lib/siegeStatistiques.ts.
// ⚠️ La courbe suit TOUS les sièges relevés (un point par siège), quel que
// soit le siège choisi ; le reste suit le siège choisi (ou leur cumul).

import { useMemo } from 'react';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import { formatNombre } from '../../i18n/format';
import {
  bilanDuMembre,
  defensesQuiBattentLeMembre,
  evolutionDuMembre,
  offensesDuMembre,
  TOUS_LES_SIEGES,
  wrGlissant,
  type RelevesSiege,
  type SiegeReleve,
} from '../../lib/siegeStatistiques';
import { Bloc, Tendance, Tuile, type ParCom2us } from './SiegeStatsElements';
import { BarresEquipes, GrapheEvolution, Legende } from './SiegeGraphes';

export default function SiegeVueMembre({
  siege,
  releves,
  joueur,
  parCom2us,
}: {
  siege: SiegeReleve;
  releves: RelevesSiege;
  joueur: number;
  parCom2us: ParCom2us;
}) {
  const textes = useTraduction();
  const langue = useLangue();
  const s = textes.siegeStats;
  const e = s.ensemble;
  const m = s.membre;
  const nombre = (n: number) => formatNombre(n, langue, { maximumFractionDigits: 0 });
  // Un membre, ce sont ses combats POUR ma guilde : sans elle, rien à dire.
  const guilde = releves.maGuilde;
  // Calculés une fois par siège et par membre, pas à chaque rendu.
  const calculs = useMemo(
    () =>
      guilde === null
        ? null
        : {
            bilan: bilanDuMembre(siege, guilde, joueur),
            offenses: { 5: offensesDuMembre(siege, guilde, joueur, 5), 4: offensesDuMembre(siege, guilde, joueur, 4) },
            battent: defensesQuiBattentLeMembre(siege, guilde, joueur),
          },
    [siege, guilde, joueur]
  );
  const evolution = useMemo(() => evolutionDuMembre(releves, joueur), [releves, joueur]);
  // Sur « Tous les sièges » seulement : un siège dure deux jours.
  const tous = siege.matchId === TOUS_LES_SIEGES;
  const glissant = useMemo(() => (tous ? wrGlissant(releves, joueur) : null), [tous, releves, joueur]);
  if (!calculs) return null;
  const b = calculs.bilan;
  const joues = (tour: 4 | 5) => (
    <BarresEquipes
      comptes={calculs.offenses[tour]}
      parCom2us={parCom2us}
      valeur={(c) => c.combats}
      detail={(c) => e.combatsEquipe(c.combats, nombre((100 * c.victoires) / c.combats))}
      vide={m.aucuneOffense}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-border bg-panel px-4 py-3">
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

      {/* Sur « Tous les sièges » seulement : un siège choisi, on veut SES chiffres. */}
      {tous && <GrapheEvolution id="membre" titre={m.evolutionTitre} aide={m.evolutionAide} points={evolution} />}

      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(22rem,1fr))]">
        <Bloc titre={m.offenses5Titre}>
          <Legende elements={[{ couleur: 0, nom: e.legendeCombats }]} className="px-4 pt-3" />
          {joues(5)}
        </Bloc>
        <Bloc titre={m.offenses4Titre} aide={m.offenses4Aide}>
          <Legende elements={[{ couleur: 0, nom: e.legendeCombats }]} className="px-4 pt-3" />
          {joues(4)}
        </Bloc>
        <Bloc titre={m.battentTitre} aide={m.battentAide}>
          <Legende elements={[{ couleur: 0, nom: m.legendeAttaquesPerdues }]} className="px-4 pt-3" />
          <BarresEquipes
            comptes={calculs.battent}
            parCom2us={parCom2us}
            valeur={(c) => c.combats - c.victoires}
            detail={(c) => e.defaitesEquipe(c.combats - c.victoires, c.combats)}
            vide={m.aucuneDefaite}
          />
        </Bloc>
      </div>
    </div>
  );
}
