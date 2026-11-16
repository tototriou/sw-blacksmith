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

## D'où viennent les données

- ⚠️ **L'export de compte ne décrit pas la box dimensionnelle.** Elle vient du
  **journal complet de SWEX** (`full_log.txt`), à la réponse
  `dimensionarena_getSeasonInfo` que le jeu envoie quand on ouvre le mode :
  les monstres de la box, leurs runes gagnées, les runes en inventaire, le
  build par défaut de chaque espèce et la **défense**.
- Un monstre porte ses runes gagnées et, sur chaque emplacement libre, la rune
  du build par défaut de son espèce.
- L'export garde les **équipes d'attaque** jouées (`deck_recent_list`, type 28),
  dont les monstres se reconnaissent dans la box du journal.
- L'export porte aussi la saison et l'état du joueur
  (`dimension_arena_status_info`, `dimension_arena_user_info` : énergie,
  parchemins, combats, palier), non lus.

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
