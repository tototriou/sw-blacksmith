import { Monster, ElementKey, SiegeTeam as SiegeTeamData } from '../types';
import { LoadState } from '../hooks/useMonsters';
import { CoteArene, UseSiegeState } from '../hooks/useSiegeState';
import SiegeBoard from '../components/siege/SiegeBoard';
import { CustomLead } from '../hooks/useCustomMonsters';
import type { ActionImportOptimizer } from '../lib/actionImportOptimizer';
import type { ExclusionSourceData } from '../lib/optimizerExclusion';

// L'Arène (#/arene/…) : la défense, l'offense et la défense interserveur, des
// équipes de 4 monstres. Le board est celui du siège, en mode arène (4 places,
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

export default function ArenePage({ tab, equipes, ...boardProps }: Props) {
  return (
    // key={tab} pour réinitialiser l'état du board au changement de côté.
    <SiegeBoard key={tab} side={tab === 'offense' ? 'offense' : 'defense'} arene={tab} siege={equipes} {...boardProps} />
  );
}
