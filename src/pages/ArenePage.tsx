import { Monster, ElementKey, SiegeTeam as SiegeTeamData } from '../types';
import { LoadState } from '../hooks/useMonsters';
import { CoteArene, estOffenseArene, UseSiegeState } from '../hooks/useSiegeState';
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

export default function ArenePage({ tab, equipes, ...boardProps }: Props) {
  const textes = useTraduction();
  return (
    <>
      {/* La box dimensionnelle vient du journal SWEX, pas de l'export : on dit
          comment l'obtenir, sans quoi un import de l'export seul, qui laisse
          ces onglets vides, passerait pour une panne. */}
      {(tab === 'dimension-defense' || tab === 'dimension-offense') && (
        <p className="mt-4 text-sm text-ink-dim">{textes.arene.noteDimension}</p>
      )}
      {/* key={tab} pour réinitialiser l'état du board au changement de côté. */}
      <SiegeBoard key={tab} side={estOffenseArene(tab) ? 'offense' : 'defense'} arene={tab} siege={equipes} {...boardProps} />
    </>
  );
}
