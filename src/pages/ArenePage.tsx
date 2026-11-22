import { Monster, ElementKey, RuneDetail, SiegeTeam as SiegeTeamData } from '../types';
import RunesList from '../components/account/RunesList';
import { LoadState } from '../hooks/useMonsters';
import { CoteArene, estDimension, estOffenseArene, UseSiegeState } from '../hooks/useSiegeState';
import { estBureau } from '../lib/bureau';
import ComingSoon from './ComingSoon';
import { IconeArene } from '../components/IconesAtelier';
import SiegeBoard from '../components/siege/SiegeBoard';
import { useTraduction } from '../hooks/useLangue';
import { CustomLead } from '../hooks/useCustomMonsters';
import type { ActionImportOptimizer } from '../lib/actionImportOptimizer';
import type { ExclusionSourceData } from '../lib/optimizerExclusion';

// L'Arène (#/arene/…) : la défense, l'offense et la défense interserveur ; et
// l'arène dimensionnelle (#/arene-dimensionnelle/…), sa défense et son
// offense. Des équipes de 4 monstres. Le board est celui du siège, en mode arène (4 places,
// leads d'arène, ses textes) — voir docs/02-app/arene/.
// ⚠️ Pas de sous-onglets ICI : comme au siège, ils sont dans la barre latérale
// (bureau) et le panneau de navigation (téléphone).
interface Props {
  onImporterEquipe: ActionImportOptimizer;
  sourcesOptimizer: ExclusionSourceData;
  compteCharge: boolean;
  tab: CoteArene;
  equipes: UseSiegeState; // le côté de l'onglet actif
  monsters: Monster[];
  siegeDefenseTeams: SiegeTeamData[];
  siegeOffenseTeams: SiegeTeamData[];
  loadState: LoadState;
  onCreateMonster: (name: string, element: ElementKey, speed: number, lead?: CustomLead | null) => Monster;
  customMonsters: Monster[];
  onDeleteMonster: (id: string) => void;
  menuOuvert: boolean;
  onFermerMenu: () => void;
}

// Sur le SITE, l'arène dimensionnelle : sa box n'arrive que par le journal
// SWEX, que seule l'application de bureau lit. Ses onglets disent qu'elle y
// est, et que la version web viendra — rien d'autre.
function DimensionBureauSeulement() {
  const textes = useTraduction();
  return <ComingSoon title={textes.navigation.areneDimensionnelle} icon={IconeArene} description={textes.arene.dimensionBureauSeulement} />;
}

// L'onglet « Runes » de l'arène dimensionnelle (#/arene-dimensionnelle/runes) :
// les runes gagnées dans le mode, dans la liste de « Mon compte » (filtres et
// tri à part). Sans runes lues — l'app sans le plugin SWEX —, la note seule dit
// comment les obtenir.
export function RunesDimensionPage({
  runes,
  menuOuvert,
  onFermerMenu,
}: {
  runes: RuneDetail[];
  menuOuvert: boolean;
  onFermerMenu: () => void;
}) {
  const textes = useTraduction();
  if (!estBureau()) return <DimensionBureauSeulement />;
  return (
    <>
      <p className="mt-4 text-sm text-ink-dim">{textes.arene.noteDimension}</p>
      {runes.length > 0 && (
        <div className="mt-4">
          <RunesList runes={runes} menuOuvert={menuOuvert} onFermerMenu={onFermerMenu} prefixeEtat="runesDimension" />
        </div>
      )}
    </>
  );
}

export default function ArenePage({ tab, equipes, ...boardProps }: Props) {
  const textes = useTraduction();
  if (estDimension(tab) && !estBureau()) return <DimensionBureauSeulement />;
  return (
    <>
      {/* La box dimensionnelle vient du plugin SWEX, pas de l'export : on dit
          comment l'obtenir, sans quoi un import de l'export seul, qui laisse
          ces onglets vides, passerait pour une panne. */}
      {estDimension(tab) && <p className="mt-4 text-sm text-ink-dim">{textes.arene.noteDimension}</p>}
      {/* key={tab} pour réinitialiser l'état du board au changement de côté. */}
      <SiegeBoard key={tab} side={estOffenseArene(tab) ? 'offense' : 'defense'} arene={tab} siege={equipes} {...boardProps} />
    </>
  );
}
