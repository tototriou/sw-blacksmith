# Arène dimensionnelle (`#/arene-dimensionnelle/…`)

Une section à part de l'[Arène](../arene/README.md), sur sa propre box. Deux
onglets, des équipes de 4 monstres sur le board de l'arène (vitesse de combat,
leads, « Vérifier mes speed », speed tuning) :

| Onglet | Adresse | État | `localStorage` |
| --- | --- | --- | --- |
| **Défense** | `#/arene-dimensionnelle/defense` | `useEquipesArene('dimension-defense')` | `swblacksmith-arene-dimension-defense-v1` |
| **Offense** | `#/arene-dimensionnelle/offense` | `useEquipesArene('dimension-offense')` | `swblacksmith-arene-dimension-offense-v1` |

`#/arene-dimensionnelle`, ou une sous-page inconnue, mène à la défense.

Fichiers : [ArenePage.tsx](src/pages/ArenePage.tsx) (`tab="dimension-defense"`
ou `"dimension-offense"`), le board du siège en mode arène. Les deux onglets
portent une note qui dit comment obtenir la box (`noteDimension`).

## Ce que l'on sait du contenu

Relevé de l'utilisateur (2026-11) :

- la **box de monstres est à part**, et les **runes aussi** ;
- chaque monstre **invoqué** l'est avec des **runes de base** ; on gagne des
  runes, qu'on peut équiper ;
- il n'y a que des **runes antiques**.

## D'où viennent les données

- ⚠️ **L'export de compte ne décrit pas la box dimensionnelle.** Elle vient du
  **journal complet de SWEX** (`full_log.txt`, plugin Full Logger), à la
  réponse `dimensionarena_getSeasonInfo` que le jeu envoie quand on ouvre le
  mode : les monstres de la box, leurs runes gagnées, les runes en inventaire,
  le build par défaut de chaque espèce et la **défense**.
- Un monstre porte ses runes gagnées et, sur chaque emplacement libre, la rune
  du build par défaut de son espèce.
- L'export garde les **équipes d'attaque** jouées (`deck_recent_list`, type 28),
  dont les monstres se reconnaissent dans la box du journal : elles remplissent
  l'**Offense**.
- L'export porte aussi la saison et l'état du joueur
  (`dimension_arena_status_info`, `dimension_arena_user_info` : énergie,
  parchemins, combats, palier), non lus.

Détail : [equipes-arene.md](../transverse/feat-import-compte/equipes-arene.md).

## Import

**Application de bureau seulement, avec le dossier SW Exporter choisi** : le
journal se lit tout seul dans ce dossier, à chaque ouverture du mode en jeu
(détail : [bureau/](../bureau/README.md#larène-dimensionnelle--le-journal-swex)).
La défense et les attaques de l'invocateur suivi sont alors **remplacées**
(un miroir du jeu ; `appliquerDimension`, App.tsx), avec une notification.

Sur le site, et dans l'app sans dossier, l'import de compte (un `.json`) ne
touche pas l'arène dimensionnelle : ses équipes s'y composent à la main.

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

- Bureau : « Arène dimensionnelle » dans « Jouer » se déroule sur ses deux
  onglets, comme l'Arène.
- Téléphone : son propre groupe « Arène dimensionnelle » dans le panneau
  « Outils », sous celui de l'Arène.
- Palette (Ctrl K) : « Défense » et « Offense », dans le contexte « Arène
  dimensionnelle ».
- Accueil : pastille à côté de l'Arène.
