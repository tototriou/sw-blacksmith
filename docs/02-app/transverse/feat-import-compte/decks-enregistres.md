# Import de compte — tous les decks enregistrés

Partie de [Import d'un compte SWEX](README.md).

## Ce que lit `parseDecksEnregistres`

Le jeu enregistre dans **`deck_list`** les équipes que le joueur a sauvegardées pour chaque contenu :
arène, siège, guerre de guilde, donjons, ToA, labyrinthe… `parseDecksEnregistres` les rend **toutes**,
dans l'ordre du fichier, chacune avec :

| Champ | Origine |
| --- | --- |
| `deckType` | `deck_type`, tel quel |
| `contenu` | `CONTENUS_DECK[deck_type]`, ou `autre` pour un type non relevé |
| `categorie`, `emplacement` | `deck_seq` décomposé (`decomposerDeckSeq`, voir plus bas) |
| `slots` | une place par monstre, **leader (`leader_unit_id`) en tête**, chacune avec le preset de runes et d'artéfacts du deck (`equip`), comme au siège ([equipes-siege.md](equipes-siege.md)) |

Un deck sans aucun monstre connu de la box (jamais configuré, ou monstres vendus) est écarté. Un
`deck_type` inconnu n'est **jamais** écarté : il sort en `autre`, avec son numéro.

## La forme d'un deck (relevé sur deux exports réels, 131 et 133 decks)

- `unit_id_list` a **toujours 8 cases**, `0` pour une case vide. Les monstres d'un raid y sont placés
  sur la grille du combat (cases 1, 2, 4, 5, 6, 7) : seul l'ordre est gardé, leader en tête.
- `equip` est parfois absent ou vide : le monstre combat alors avec ce qu'il porte, et la place n'a
  que les runes de son preset (aucune).
- Sur les `deck_type` 24 à 27, `deck_seq` vaut **`catégorie × 100 + emplacement`** (101, 201, 202…,
  601, 1001) : c'est un contenu à sous-catégories. Sous 100, `categorie` est `null`.

## Les contenus identifiés

Le fichier ne nomme pas les contenus : chaque ligne de `CONTENUS_DECK` vient d'un relevé, jamais d'une
supposition sur la taille des équipes. 1 et 22 viennent d'exports réels ; les autres ont été nommés
par l'utilisateur d'après ses decks en jeu (2026-11-18 et 2026-11-21).

| `deck_type` | Contenu (`contenu`) | Monstres |
| --- | --- | --- |
| 1 | Arène — offense (`arene-offense`) | 4 |
| 2 | Guerre de guilde — offense (`guerre-guilde-offense`) | 3 |
| 3 | Raid des mondes (`raid-mondes`) | 6 |
| 4 | Labyrinthe, normal (`labyrinthe-normal`) | 5 |
| 5 | Labyrinthe, sauvetage (`labyrinthe-sauvetage`) | 4 |
| 6 | Tribunal d'ascension (`tribunal-ascension`) | 4-5 |
| 7 | Labyrinthe, vitesse limitée (`labyrinthe-vitesse-limitee`) | 5 |
| 8 | Labyrinthe, temps limité (`labyrinthe-temps-limite`) | 4-5 |
| 9 | Labyrinthe, temps de pause (`labyrinthe-temps-pause`) | 5 |
| 10 | Labyrinthe, explosion (`labyrinthe-explosion`) | 5 |
| 11 | Labyrinthe, boss (`labyrinthe-boss`) | 5 |
| 12 | Tour de l'eau (`tour-eau`) | 5 |
| 13 | Tour du feu (`tour-feu`) | 5 |
| 14 | Tour du vent (`tour-vent`) | 5 |
| 15 | Tour de la Lumière (`tour-lumiere`) | 1 |
| 16 | Tour des Ténèbres (`tour-tenebres`) | 1 |
| 17 | `autre`, à nommer ([dette](../../../05-feuille-de-route/dette.md)) | 5 |
| 19 | Passage des dimensions, raid dimensionnel phase 1 (`raid-dimensionnel-1`) | 1 |
| 20 | Passage des dimensions, raid dimensionnel phase 2 (`raid-dimensionnel-2`) | 1 |
| 21 | Passage des dimensions, raid dimensionnel phase 3 (`raid-dimensionnel-3`) | 1 |
| 22 | Siège — offense (`siege-offense`) | 3 |
| 23 | Temple du chaos (`temple-chaos`) | 5 |
| 24 | Donjons de Cairos (`cairos`) | 4-5 |
| 25 | Faille des mondes, bêtes (`faille-mondes`) | 6 |
| 26 | Passage des dimensions (`passage-dimensions`) | 4 |
| 27 | Subjugation de monstre (`subjugation`) | 5 |

### Sous-contenus (`SOUS_CONTENUS_DECK`)

Sur les contenus à sous-catégories, la catégorie de `deck_seq` désigne le donjon ou la variante
(`sousContenu`). Une catégorie non relevée sort en `null`, son numéro restant dans `categorie`.

| Contenu | Catégorie → sous-contenu |
| --- | --- |
| `cairos` | 1 Castel du Géant (`castel-geant`), 2 Tanière du dragon (`taniere-dragon`), 3 Nécropolis (`necropolis`), 4 Royaume spirituel (`royaume-spirituel`), 5 Forteresse d'Acier (`forteresse-acier`), 6 Crypte du Jugement (`crypte-jugement`) |
| `faille-mondes` | 1 Bête de glace (`bete-glace`), 2 Bête enflammée (`bete-enflammee`), 3 Bête de l'orage (`bete-orage`), 4 Bête de radiance (`bete-radiance`), 5 Bête de marécage (`bete-marecage`) |
| `passage-dimensions` | 1 Karzhan, Forêt des fauves rugissants (`foret-fauves-rugissants`), 2 Elunia, Sanctuaire des fées rêveuses (`sanctuaire-fees-reveuses`), 3 Lumel, Falaise des puissants hommes-bêtes (`falaise-hommes-betes`), 4 Khalderun, Ruines de la mort silencieuse (`ruines-mort-silencieuse`), 5 Sacreon, Château des héros oubliés (`chateau-heros-oublies`), 6 Inferas, Terre infernale embrasée (`terre-infernale-embrasee`) |
| `subjugation` | 1 Eau, 2 Feu, 3 Vent, 10 Boss (`subjugation-eau` … `subjugation-boss`) |

Les libellés affichés viendront du dictionnaire (`src/i18n/`), avec les noms du jeu dans chaque
langue, quand un écran montrera ces decks.

## Ce que l'export ne contient pas

- **La défense de guerre de guilde** : `temporary_defense_deck.server_guild_war` est vide sur les deux
  exports. L'export de connexion ne la porte pas.
- Les défenses d'arène et de siège sont hors de `deck_list` : [equipes-arene.md](equipes-arene.md),
  [equipes-siege.md](equipes-siege.md).
