# Import de compte — équipes d'arène

Partie de [Import d'un compte SWEX](README.md).

## Import des équipes d'arène (défense, défense interserveur, offense)

Des decks de **4 monstres** (index 0 = leader), où chaque monstre a les runes et
les artéfacts du preset du deck, comme au siège. La logique est celle du siège
([equipes-siege.md](equipes-siege.md)), sur 4 places : `buildSiegeDecks(…,
nbSlots)`, `SLOTS_ARENE = 4`.

### Défense — `parseArenaDefense`

Un deck unique. Champs SWEX :

| Clé | Rôle |
|-----|------|
| `defense_deck_info` | `{ unit_id_list, equip }`. `unit_id_list` : des **ids nus**, dans l'ordre des places ; **index 0 = leader** ; `0` = place vide. `equip` : `[{ unit_id, rune_id_list, artifact_id_list }, …]`. |

Le leader en tête est un relevé : sur deux exports réels, le premier monstre
porte un lead d'arène (N1X, Jin Kazama).

### Défense interserveur — `parseArenaInterserveurDefense`

La défense de l'arène interserveur, un deck unique. Seule la défense diffère
de l'arène classique : les équipes d'attaque sont les mêmes.

| Clé | Rôle |
|-----|------|
| `server_arena_defense_deck_info` | `{ unit_id_list, equip }`. ⚠️ `unit_id_list` porte des **objets** `{ unit_id, pos_id }` : les places suivent `pos_id`, pas l'ordre du tableau ; **la position 1 est le leader** (relevé : le même leader que la défense classique sur un export réel). |

### Offense — `parseArenaOffense`

| Clé | Rôle |
|-----|------|
| `deck_list` filtré sur `deck_type === 1` | Chaque deck : `{ deck_seq, unit_id_list, leader_unit_id, equip }`, comme l'offense de siège ; **leader** donné par `leader_unit_id`, replacé en tête. |

- `deck_type = 1` = équipes d'attaque d'arène (constante
  `ARENA_OFFENSE_DECK_TYPE` : 15 decks de 4 monstres sur chacun de deux exports
  réels).

### Erreurs

Chaque lecture dit ce qui manque : pas de `defense_deck_info`
(`sansDefenseArene`), pas de `server_arena_defense_deck_info`
(`sansDefenseInterserveur`), aucun deck de type 1 (`sansOffenseArene`) ; des
données présentes mais aucune place remplie : `defenseAreneVide`,
`defenseInterserveurVide`, `offenseAreneVide`.

### Arène dimensionnelle

### Défense de l'arène dimensionnelle — `parseArenaDimensionDefense`

| Clé | Rôle |
|-----|------|
| `deck_recent_list` filtré sur `type === 28` | La première de ces équipes : `{ type, sub_type, unit_id_list, leader_unit_id, equip }`, leader replacé en tête, 4 places ; `equip` vide. |

- `type = 28` (`DIMENSION_DEFENSE_RECENT_TYPE`) : relevé sur un export réel de
  2026-11 — la seule équipe de ce type, absente d'un export d'août, dont les
  4 unités sont d'une plage d'identifiants (1,4 à 4,3 millions) où n'est aucun
  monstre du compte (tous au-dessus de 5,7 millions). Que ce soit la **défense**
  est le relevé de l'utilisateur.
- ⚠️ **L'export ne décrit pas la box dimensionnelle** (box et runes à part,
  runes antiques seulement) : une unité absente de `unit_list` laisse sa place
  vide, et une défense toute vide n'est pas importée — `defenseDimensionInconnue`.
  Sans équipe de type 28 : `sansDefenseDimension`. Si un export décrit un jour
  ces unités dans `unit_list`, elles se résolvent sans rien changer ici.
- Le reste de l'arène dimensionnelle dans l'export — sa saison et l'état du
  joueur (`dimension_arena_status_info`, `dimension_arena_user_info`) — n'est
  pas lu.

### Modèle retourné

Celui du siège (`SiegeParseResult`), avec des `slots` de longueur 4.
