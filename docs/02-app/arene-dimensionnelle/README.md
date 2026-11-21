# Arène dimensionnelle (`#/arene-dimensionnelle/…`)

Une section à part de l'[Arène](../arene/README.md), sur sa propre box. Trois
onglets : deux d'équipes de 4 monstres sur le board de l'arène (vitesse de
combat, leads, « Vérifier mes speed », speed tuning), et les runes du mode.

| Onglet | Adresse | État | `localStorage` |
| --- | --- | --- | --- |
| **Défense** | `#/arene-dimensionnelle/defense` | `useEquipesArene('dimension-defense')` | `swblacksmith-arene-dimension-defense-v1` |
| **Offense** | `#/arene-dimensionnelle/offense` | `useEquipesArene('dimension-offense')` | `swblacksmith-arene-dimension-offense-v1` |
| **Runes** | `#/arene-dimensionnelle/runes` | `useRunesDimension` | `swblacksmith-arene-dimension-runes-v1` |

`#/arene-dimensionnelle`, ou une sous-page inconnue, mène à la défense.

Fichiers : [ArenePage.tsx](src/pages/ArenePage.tsx) (`tab="dimension-defense"`
ou `"dimension-offense"`, le board du siège en mode arène ;
`RunesDimensionPage` pour les runes). Les trois onglets portent une note qui
dit comment obtenir la box (`noteDimension`).

**Runes** : les runes **gagnées** dans le mode — en inventaire et portées par
les monstres de la box (`parseDimensionRunes`), pas celles des builds par
défaut, que le joueur ne possède pas. Elles s'affichent dans la liste de
« Mon compte → Runes » (`RunesList`), avec ses filtres et son tri, retenus à
part de ceux de « Mon compte » (`prefixeEtat="runesDimension"`). Sans runes
lues, la note seule.

## Ce que l'on sait du contenu

Relevé de l'utilisateur (2026-11) :

- la **box de monstres est à part**, et les **runes aussi** ;
- chaque monstre **invoqué** l'est avec des **runes de base** ; on gagne des
  runes, qu'on peut équiper ;
- il n'y a que des **runes antiques**.

## D'où viennent les données

- ⚠️ **L'export de compte ne décrit pas la box dimensionnelle.** Elle vient du
  **plugin SWEX « SW Blacksmith Live »**, qui garde la réponse
  `dimensionarena_getSeasonInfo` que le jeu envoie quand on ouvre le mode —
  les monstres de la box, leurs runes gagnées, les runes en inventaire, le
  build par défaut de chaque espèce et la **défense** — et la tient à jour à
  chaque changement fait dans le mode : runes posées, défense changée,
  monstre invoqué, rune gagnée (détail :
  [feat-swex-direct.md](../bureau/feat-swex-direct.md), « L'arène
  dimensionnelle »). Aucun autre plugin de SWEX n'est nécessaire.
- Un monstre porte ses runes gagnées et, sur chaque emplacement libre, la rune
  du build par défaut de son espèce.
- Les **équipes d'attaque** jouées remplissent l'**Offense** : celles que le
  plugin a vues jouer (les 5 dernières, distinctes), sinon la dernière que
  garde l'export (`deck_recent_list`, type 28) ; leurs monstres se
  reconnaissent dans la box.
- L'export porte aussi la saison et l'état du joueur
  (`dimension_arena_status_info`, `dimension_arena_user_info` : énergie,
  parchemins, combats, palier), non lus.

Détail : [equipes-arene.md](../transverse/feat-import-compte/equipes-arene.md).

## Import

**Application de bureau seulement, avec le dossier SW Exporter choisi et le
plugin SW Blacksmith Live installé** : la saison se lit toute seule dans le
dossier du plugin, à chaque ouverture du mode en jeu et à chaque changement
fait dedans (détail :
[bureau/](../bureau/README.md#larène-dimensionnelle--la-saison-du-plugin-swex)).
La défense, les attaques et les runes de l'invocateur suivi sont alors
**remplacées** (un miroir du jeu ; `appliquerDimension`, App.tsx) ; une
notification l'annonce à l'ouverture du mode, un changement fait dedans
s'applique en silence.

Dans l'app sans dossier, l'import de compte (un `.json`) ne touche pas
l'arène dimensionnelle : ses équipes s'y composent à la main, et l'onglet
Runes reste vide.

⚠️ **Sur le site, l'arène dimensionnelle n'est pas proposée** : ses trois
onglets n'affichent que « disponible dans l'application de bureau, version
web à venir » (`dimensionBureauSeulement`, `ComingSoon`), sans board ni
liste. Ses adresses et sa navigation restent, pour qu'on sache qu'elle existe.

## Règles

- **Leads** : ceux de l'arène (`regleLead="arene"`). ⚠️ Hypothèse, non mesurée
  en jeu, comme pour l'interserveur.
- **Leader de la défense** : le premier de `defense_deck_info`, comme la défense
  d'arène. ⚠️ À confirmer en jeu.
- **Speed tuning** : la défense et l'offense s'y chargent (sources
  `arene-dimension-defense`, `arene-dimension-offense`), « Voir le speed tune »
  s'ouvre depuis elles.
- **Artéfacts** : pas lus dans ce mode. Le contrôle d'équipement des équipes
  ne les réclame pas (`avecArtefacts` de `SiegeTeam`) : seules les runes
  manquantes y sont signalées.
- Pas d'export vers l'Optimizer ni de fichiers d'équipes, comme l'arène.

## Navigation

- Bureau : « Arène dimensionnelle » dans « Jouer » se déroule sur ses trois
  onglets, comme l'Arène.
- Téléphone : son propre groupe « Arène dimensionnelle » dans le panneau
  « Outils », sous celui de l'Arène.
- Palette (Ctrl K) : « Défense », « Offense » et « Runes », dans le contexte
  « Arène dimensionnelle ».
- Accueil : pastille à côté de l'Arène.
