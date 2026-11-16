# Arène dimensionnelle (`#/arene-dimensionnelle/defense`)

Une section à part de l'[Arène](../arene/README.md). Un onglet pour l'instant :
la **Défense**, une équipe de 4 monstres, sur le board de l'arène (vitesse de
combat, leads, « Vérifier mes speed », speed tuning). `#/arene-dimensionnelle`
mène à la défense.

Fichiers : [ArenePage.tsx](src/pages/ArenePage.tsx) (`tab="dimension-defense"`),
le board du siège en mode arène ; état `useEquipesArene('dimension-defense')`,
`localStorage` `swblacksmith-arene-dimension-defense-v1`.

## Ce que l'on sait du contenu

Relevé de l'utilisateur (2026-11) :

- la **box de monstres est à part**, et les **runes aussi** ;
- chaque monstre **invoqué** l'est avec des **runes de base** ; on gagne des
  runes, qu'on peut équiper ;
- il n'y a que des **runes antiques**.

## Ce que l'export en dit

- La saison et l'état du joueur (`dimension_arena_status_info`,
  `dimension_arena_user_info` : énergie, parchemins, combats, palier).
- La **défense** : la dernière équipe de type 28 de `deck_recent_list`
  (`parseArenaDimensionDefense`), 4 unités, leader en tête. Ses unités sont
  d'une plage d'identifiants où n'est aucun monstre du compte : la box
  dimensionnelle. Que ce soit la défense est le relevé de l'utilisateur.
- ⚠️ **L'export ne décrit pas cette box** : ni l'espèce, ni le niveau, ni les
  runes de ses monstres. La défense importée reste donc vide
  (`defenseDimensionInconnue`) et se **compose à la main** — l'onglet le dit
  (`noteDimension`). Si un export la décrit un jour, ses monstres se résolvent
  sans rien changer à la lecture.

Détail : [equipes-arene.md](../transverse/feat-import-compte/equipes-arene.md).

## Règles

- **Leads** : ceux de l'arène (`regleLead="arene"`). ⚠️ Hypothèse, non mesurée
  en jeu, comme pour l'interserveur.
- **Speed tuning** : la défense s'y charge (source `arene-dimension-defense`),
  « Voir le speed tune » s'ouvre depuis elle.
- Pas d'export vers l'Optimizer ni de fichiers d'équipes, comme l'arène.

## Navigation

- Bureau : « Arène dimensionnelle » dans « Jouer », lien direct vers la défense
  (un seul onglet : une section pour un seul choix n'ajouterait qu'un geste).
- Téléphone : dans le groupe « Arène » du panneau « Outils ».
- Accueil : pastille à côté de l'Arène.
