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

⚠️ **L'export de compte ne décrit pas la box dimensionnelle** : ses monstres et
ses runes viennent de la réponse `dimensionarena_getSeasonInfo`, que le jeu
envoie à l'ouverture du mode. Le plugin SWEX la garde et la tient à jour à
chaque changement fait dans le mode
([dimension.ts](plugin-swex/source/dimension.ts)) ; l'application de bureau la
lit dans son dossier ([swexDimension.ts](bureau/swexDimension.ts)). Les
**attaques** jouées que le plugin a vues y sont ajoutées sous la forme de
l'export (`deck_recent_list`, type 28, leader en tête) ; aucune encore, celle
de l'export.

La réponse a la forme d'un export (relevé sur un journal réel, 2026-11) :

| Clé | Rôle |
|-----|------|
| `unit_list` | Les monstres obtenus dans le mode, chacun avec les runes **gagnées** qu'il porte (`runes`, de 0 à 6). Identifiants d'une plage à part (quelques millions), sans lien avec la box du compte. |
| `rune_list` | Les runes gagnées en inventaire. Toutes antiques, +15. |
| `default_unit_list` | Un build de 6 runes par espèce (`is_default: 1`, identifiants courts 1001…), celui avec lequel un monstre est invoqué. |
| `defense_deck_info.unit_id_list` | La défense : `[[id, id, id, id]]`, leader en tête. |
| `artifact_list` | Vide : pas d'artéfacts dans ce mode. |

⚠️ **Un emplacement sans rune gagnée porte la rune du build par défaut de
l'espèce** (`runesDimension`) : un monstre sans aucune rune porte tout ce build
(relevé de l'utilisateur en jeu, sur sa défense). Le complément emplacement par
emplacement, pour un monstre qui porte quelques runes gagnées, en est le
prolongement, non relevé.

#### Défense — `parseDimensionDefense(saison)`

Depuis la saison du journal. Sans `defense_deck_info` : `sansDefenseDimension` ;
aucun de ses monstres dans la box : `defenseDimensionVide`.

#### Attaque — `parseDimensionOffense(export, saison)`

| Clé | Rôle |
|-----|------|
| `deck_recent_list` filtré sur `type === 28` | Dans l'**export** : les équipes d'attaque jouées, `{ type, sub_type, unit_id_list, leader_unit_id, equip }` ; leader replacé en tête, 4 places ; `equip` vide. |

- `type = 28` (`DIMENSION_OFFENSE_RECENT_TYPE`) : relevé — ses 4 unités sont des
  monstres de la box du journal, dont celui qui porte une rune retrouvée par
  l'utilisateur sur sa dernière attaque ; la défense, elle, est un autre
  quatuor. Les runes sont celles que chaque monstre porte dans la box.
- Aucune équipe de type 28 : `sansOffenseDimension` ; pas de journal :
  `offenseDimensionSansJournal` ; aucun monstre dans la box :
  `offenseDimensionInconnue`.
- Le reste de l'arène dimensionnelle dans l'export — sa saison et l'état du
  joueur (`dimension_arena_status_info`, `dimension_arena_user_info`) — n'est
  pas lu.

### Modèle retourné

Celui du siège (`SiegeParseResult`), avec des `slots` de longueur 4.
