# Arène (`#/arene/defense`, `#/arene/offense`, `#/arene/interserveur`)

Composer des équipes de **4 monstres** d'arène, avec lead de vitesse
**automatique** (règles de l'arène) et vérification des **speed tune** (ticks),
comme au [Siège](../siege/README.md). La page a **trois sous-onglets** :

- **Défense** : la défense de l'arène classique ;
- **Offense** : les équipes d'attaque, communes à l'arène classique et à
  l'arène interserveur ;
- **Défense interserveur** : la défense de l'arène interserveur — seule la
  défense y diffère de l'arène classique.

L'[arène dimensionnelle](../arene-dimensionnelle/README.md) est une section à
part.

Fichiers :
- [ArenePage.tsx](src/pages/ArenePage.tsx) — monte le board du siège en mode
  arène (`arene={tab}`), `key={tab}` pour le réinitialiser au changement d'onglet.
- [SiegeBoard.tsx](src/components/siege/SiegeBoard.tsx) et
  [SiegeTeam.tsx](src/components/siege/SiegeTeam.tsx) — le board et la carte
  d'équipe du siège, partagés (voir ci-dessous ce qui diffère).
- État : [useSiegeState.ts](src/hooks/useSiegeState.ts), `useEquipesArene(cote)`
  — une liste d'équipes par côté, `localStorage`
  `swblacksmith-arene-<defense|offense|interserveur>-v1`.

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| `src/pages/ArenePage.tsx`, le mode arène de `SiegeBoard.tsx` et `SiegeTeam.tsx`, `useEquipesArene` | ce README, puis [siege/](../siege/README.md) pour le board partagé |
| la règle de lead en arène (`areneLeadFor`, `leadPour`, `isLeadActif` de `src/lib/speed.ts`) | [transverse/feat-calcul-vitesse.md](../transverse/feat-calcul-vitesse.md) |
| l'import des équipes d'arène | [feat-import-compte/equipes-arene.md](../transverse/feat-import-compte/equipes-arene.md) |

## Ce qui est repris du siège

Le board et la carte d'équipe sont ceux du siège ([siege/README.md](../siege/README.md),
[feat-equipes.md](../siege/feat-equipes.md), [feat-speed-tick.md](../siege/feat-speed-tick.md)) :
composition, leader en place 1, vitesse de combat, « Vérifier mes speed »,
recherche d'équipe par monstre, carte d'ajout, retrait annulable, « Tout
effacer », création d'un monstre.

## Ce qui diffère

- **4 places par équipe.** Les flèches de position s'arrêtent à la 4ᵉ. Une
  colonne de la liste fait **640 px au moins** (480 au siège) : la largeur où
  quatre monstres repliés tiennent côte à côte, au même ratio que trois sur 480.
- ⚠️ **Une équipe tient sur UNE ligne** (le mainteneur), dépliée comme
  repliée : sur la largeur où le siège met trois places, chacune est
  **resserrée** (`serre`, SlotContent).
  - Dépliée, au bureau (~210 px la place) : portrait à 32 px, sets à 14 px SOUS
    le nom, pas de pastille de lead dans la place (l'en-tête de l'équipe la
    porte, le badge du portrait dit qui est le leader), et une colonne de
    QUATRE lignes alignées — le monstre, le champ SPD, les ticks (sous le champ,
    plus à côté), la conclusion. À côté, les ticks sortaient de la place et
    « VIT : » se coupait.
  - Repliée, au téléphone (~84 px la carte sous `sm`) : la carte EMPILE le
    portrait au-dessus du nom et de la ligne vitesse + sets.
  - Le siège garde ses trois places et sa disposition.
- **Leads d'arène** (`regleLead="arene"`) : un lead d'**Arène** ou **sans
  restriction** vaut pour tous, un lead d'**élément** pour son élément, un lead
  de **guilde** ou de **donjon** ne compte pas. La pastille de lead le dit
  (« sans effet en arène », portée « (guilde) »). Même règle dans la vitesse de
  combat, le statut et l'analyse automatique de la carte, et à l'import.
  ⚠️ Pour l'**interserveur**, c'est une hypothèse non mesurée (voir
  `areneLeadFor`).
- **Speed tuning** : « Voir le speed tune » ouvre l'outil avec l'équipe d'arène
  (source `arene-<cote>`), et l'outil propose les équipes d'arène à l'import
  de deck, avec leurs leads d'arène — voir
  [feat-import-deck-siege.md](../speed-tuning/feat-import-deck-siege.md).
- **Pas encore branchés** (le board les retire en mode arène) : l'export vers
  l'Optimizer, l'export et l'import de fichiers d'équipes (le format
  `swblacksmith/siege-equipes` porte des équipes de 3).
- « Vérifier mes speed » : un interrupteur par côté d'arène
  (`arene.checkTicks.<cote>`), non persisté.

## Import depuis le compte

L'import global (barre de nav) remplit aussi l'arène : défense
(`defense_deck_info`), offense (`deck_list`, `deck_type = 1`) et défense
interserveur (`server_arena_defense_deck_info`). Détail :
[equipes-arene.md](../transverse/feat-import-compte/equipes-arene.md). Comme au
siège, il **remplace** les équipes du côté qui a des données, et la position
fait l'identité d'une équipe. L'import demande confirmation s'il y a déjà des
équipes d'arène ; elles entrent dans la sauvegarde de session.

## Navigation

- Bureau : « Arène » dans « Jouer », à côté du Siège ; elle ouvre ses trois
  sous-onglets dans la barre latérale.
- Téléphone : pas d'onglet du bas ; l'onglet « Outils » ouvre un panneau qui
  porte un groupe « Arène » (les trois sous-onglets et l'arène
  dimensionnelle).
- `#/arene` mène à la défense, comme `#/siege`.
