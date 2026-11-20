# Guilde — pistes futures

Les écrans de guilde nourris par le plugin SWEX « SW Blacksmith Live », qui enregistre déjà tout ce
que le jeu montre des contenus de guilde
([feat-swex-direct.md](../02-app/bureau/feat-swex-direct.md) § « Le contenu des combats de
guilde »). L'application de bureau en montre les sièges, dans Siège › Statistiques
([statistiques.md](../02-app/siege/statistiques.md)). Une piste est ce qui n'est pas fait : avant
de s'y fier, vérifier dans le code qu'elle ne l'a pas été depuis. Une piste réalisée quitte ce
registre ; ce qu'elle produit se décrit dans la fiche de l'écran.

| Piste | Bloquée par | Fiche à compléter |
| --- | --- | --- |
| Statistiques : les runes de mes attaques | rien | [statistiques.md](../02-app/siege/statistiques.md) |

## Statistiques : les runes de mes attaques

Les monstres de chaque attaque sont affichés ; leurs **runes**, pas encore. Le début de chacune de
mes attaques (`BattleGuildSiegeStart_v2`, enregistré par le plugin) les porte : la requête donne
les `rune_id` et `artifact_id` équipés, la réponse les monstres avec leurs runes et artéfacts
(`guildsiege_my_unit_list`). Le début est déjà relié à son combat (`completerParLesDebuts` de
[siegeStatistiques.ts](../../src/lib/siegeStatistiques.ts)).

- Les runes d'une défense adverse ne sont jamais données (`runes` vide dans
  `guildsiege_opp_unit_list`) : la page ne les cherche pas.
- Les tests rejouent des fixtures fabriquées de même forme ; le journal réel reste hors du dépôt.

## Ce que chaque piste emporte

La définition de fini ([definition-de-fini.md](../03-developpeur/definition-de-fini.md)) : la fiche
[statistiques.md](../02-app/siege/statistiques.md) et les fiches voisines, les textes en français
et en anglais, les tests du calcul, du rendu (deux formats, site et app) et du branchement.
