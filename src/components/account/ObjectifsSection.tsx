import type { AccountView } from '../../App';
import { ArtifactDetail, Monster, RuneDetail } from '../../types';
import type { BoxItem } from '../../lib/applyAccount';
import { useTraduction } from '../../hooks/useLangue';
import ReglagesObjectifs from '../ReglagesObjectifs';
import { ObjectifsArtefacts, ObjectifsMonstres, ObjectifsResume, ObjectifsRunes } from './VueObjectifs';

// La section Mon compte › Objectifs (`#/compte/objectifs/<vue>`) : Résumé,
// Runes, Artéfacts, Monstres, Réglage. Une section à part entière, pas une vue
// des inventaires : elle mesure les runes, les artéfacts ET les monstres. Voir
// docs/02-app/compte/feat-objectifs.md.
//
// ⚠️ Rendue par App AVANT les écrans du compte : le Réglage se fait sans compte
// importé. Les autres vues, sans compte, invitent à l'importer.
export default function ObjectifsSection({
  vue,
  runes,
  artifacts,
  box = [],
  allMonsters = [],
  monsterByCom2us = new Map(),
  hydrating = false,
}: {
  vue: AccountView;
  runes: RuneDetail[];
  artifacts: ArtifactDetail[];
  // La box 6★, mesurée par les listes de monstres.
  box?: BoxItem[];
  // Les monstres à choisir dans le Réglage, et l'index des identifiants com2us
  // que les listes retiennent.
  allMonsters?: Monster[];
  monsterByCom2us?: ReadonlyMap<number, Monster>;
  // Relecture du compte conservé en cours : pas d'invite tant qu'on n'a pas
  // fini de regarder.
  hydrating?: boolean;
}) {
  const textes = useTraduction();
  if (vue === 'reglage')
    return (
      // ⚠️ Plus large que la colonne des Paramètres : les grilles de saisie
      // (six emplacements, cinq éléments, et « Tous ») ne tiennent pas dans
      // 620 px.
      <div className="flex max-w-[760px] flex-col gap-4">
        <h1 className="hidden font-display text-xl tracking-wide text-ink lg:block">{textes.navigation.reglage}</h1>
        <ReglagesObjectifs monstres={allMonsters} parCom2us={monsterByCom2us} />
      </div>
    );
  if (runes.length === 0 && artifacts.length === 0 && box.length === 0)
    return <p className="text-sm text-ink-dim">{hydrating ? textes.boxCompte.chargement : textes.objectifs.vue.sansCompte}</p>;
  if (vue === 'runes') return <ObjectifsRunes runes={runes} />;
  if (vue === 'artefacts') return <ObjectifsArtefacts artifacts={artifacts} />;
  if (vue === 'monstres') return <ObjectifsMonstres box={box} parCom2us={monsterByCom2us} />;
  return <ObjectifsResume runes={runes} artifacts={artifacts} box={box} parCom2us={monsterByCom2us} />;
}
