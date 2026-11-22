# Mes équipes (`#/compte/equipes`)

Un stockage durable d'équipes construites : chaque équipe garde ses monstres, leur
équipement complet (runes, artéfacts, relique), son leader et, s'il existe, son speed
tune. Les équipes se rangent par contenu, se retrouvent par les monstres qui les
composent, et font l'aller-retour avec l'Optimizer.

Le jeu limite le nombre de decks par contenu : cette page garde ce que le jeu ne garde
pas, une équipe construite, optimisée puis rangée pour plus tard.

Fichiers : `src/components/account/equipes/` (écran), `src/lib/equipesEnregistrees.ts`
(modèle pur, validation, comparaison au compte), `src/lib/equipesStore.ts` (IndexedDB),
`src/lib/equipesFichier.ts` (export et import de fichier),
`src/lib/importEquipesEnregistrees.ts` (conversions depuis et vers l'Optimizer),
`src/hooks/useEquipesEnregistrees.ts` (état, instancié dans `src/App.tsx`).

Voir aussi : [feat-import-equipes.md](../optimizer/feat-import-equipes.md) (le modèle
d'import de l'Optimizer, que l'export réutilise),
[persistance.md](../transverse/feat-import-compte/persistance.md) (l'interrupteur de
conservation).

## Place dans l'app

- 4ᵉ sous-section du dropdown « Mon compte », après « Artéfacts » : « Mes équipes »,
  route `#/compte/equipes`. Elle entre aussi dans la palette Ctrl K, sur l'accueil
  (carte « Mon compte ») et dans [../README.md](../README.md).
- **Lisible sans compte importé** : une équipe porte une copie de son équipement, elle
  s'affiche telle qu'enregistrée. Sans compte, la comparaison au compte (plus bas) et
  les imports qui lisent le compte sont désactivés, avec leur raison en `title`.
- Pendant la relecture du compte conservé (`accountHydrating`), les équipes
  s'affichent déjà ; seuls les marqueurs d'écart attendent le compte.

## Onglets

Une rangée `Onglets` (`src/ui/Onglets.tsx`) de **dix onglets**, un par contenu du jeu,
dans cet ordre, choisi par l'utilisateur (le premier est ouvert par défaut ;
`CATEGORIES_EQUIPES`). Chacun a ses **catégories**, nommées par l'utilisateur, que
l'on filtre dans l'onglet et que l'on choisit pour chaque équipe
(`SOUS_CATEGORIES_EQUIPES`) ; la RTA et la ToA n'en ont pas. L'onglet RTA garde des
**prépas**, pas des équipes (§ Prépas RTA).

| Onglet | Catégories | Contenu de liste de l'Optimizer |
| --- | --- | --- |
| `arene` « Arène » | Offense arène, Défense arène, Défense inter serveur, Arène dimensionnelle | `arene` |
| `rta` « RTA » (des prépas) | — | `arene` |
| `guilde` « Combat de guilde » | Offense siège, Défense siège, Offense guerre de guilde, Défense guerre de guilde | `guilde` |
| `cairos` « Cairos » | Géant, Dragon, Nécropolis, Royaume Spirituel, Forteresse d'Acier, Crypte du jugement | `donjon` |
| `labyrinthe` « Labyrinthe » | Boss, Normal, Sauvetage, Explosion, Vitesse limitée, Temps limité, Temps de pause | `guilde` |
| `subjugation` « Subjugation » | Eau, Feu, Vent, Boss | `guilde` |
| `passage-dimensions` « Passage des dimensions » | Karzhan, Ellunia, Lumel, Khalderun, Sacreon, Inferas, Raid dimensionnel (ses trois phases) | `donjon` |
| `faille` « Rift » | Bête de glace, Orage, Marécages, Enflammée, Radiance, Raid des mondes | `donjon` |
| `temple-chaos` « Temple du chaos » | Eau, Feu, Vent, Ténèbres, Lumière | `autre` |
| `toa` « ToA » (tribunal d'ascension et tours) | — | `autre` |

« Temps de pause » n'était pas dans la liste de l'utilisateur ; il est ajouté parce que
l'export porte ce mode du labyrinthe (`deck_type` 9).

Le filtre est au-dessus de la grille : « Tout » puis chaque catégorie, chacune avec
son nombre d'équipes ; sous « Tout », chaque carte dit sa catégorie. À la souris, un
`Segmented` ; au téléphone, un menu (`Selecteur`) : sept crans n'y tiendraient pas.
Le filtre se garde par onglet pour la session.

Une équipe porte son **rangement** dans `onglet` : l'onglet seul (catégorie non
choisie), ou l'onglet et sa catégorie, `arene/rta`, `cairos/geant`. Une équipe créée
ou importée dans l'onglet ouvert prend la catégorie filtrée, aucune sous « Tout ».
Le détail d'une équipe change son rangement (« Onglet et catégorie », un menu groupé
par onglet, `SelecteurRangement`) ; « Déplacer vers… » du menu de la carte l'envoie
dans un autre onglet, sans catégorie.

Le contenu de liste suit le lead qui agit dans l'onglet, le même pour toutes ses
catégories, relevé en jeu par l'utilisateur
([§ Lead par contenu du jeu](../optimizer/feat-listes-equipes-et-sauvegarde.md#lead-par-contenu-du-jeu)) :
chaque onglet s'exporte.

Les rangements des versions de travail précédentes se relisent dans les nouveaux
(stockage, fichier, session ; `ONGLETS_ANCIENS`) : `siege-attaque` en Offense siège,
`siege-defense` en Défense siège, `guerre-guilde`, `guerre-guilde-offense` et
`guerre-guilde-defense` en offense et défense de guerre de guilde, `arene-attaque` et
`arene-offense` en Offense arène, `arene-defense` en Défense arène, `rta` en RTA,
`pve` en Cairos ; `guilde-offense` et `guilde-defense` (siège et guerre de guilde
mêlés) dans Combat de guilde, sans catégorie. Un onglet gardé pour la session qui
n'existe plus retombe sur le premier. Chaque onglet porte le nombre de ses équipes.

## Prépas RTA

En RTA, on ne prépare pas une équipe mais un **ensemble de monstres** : la prépa
(décision de l'utilisateur, 2026-11-22). L'onglet RTA garde donc des prépas
enregistrées, plusieurs à la fois (par saison, par draft), ce que la page RTA ne fait
pas. Une prépa est une `EquipeEnregistree` rangée `rta` (`estPrepa`) :

- **de 1 à 300 monstres** (`bornesMonstres` ; 300 n'est qu'un garde-fou de
  relecture) : « Nouvelle prépa » s'enregistre dès son premier monstre, et la
  limite par contenu ne la borne pas ;
- **ni leader, ni speed tune, ni groupe**, ni lien vers l'Optimizer : relue, une
  prépa les oublie ; créée dans l'onglet depuis une équipe de l'Optimizer, elle les
  perd (`normaliserPrepa`). Le détail ne propose ni leader, ni « Onglet et
  catégorie », ni « Groupe » ; l'onglet n'a pas de « Nouveau groupe » ;
- **une prépa et une équipe ne s'échangent pas** : « Déplacer vers… » n'existe pas
  sur une prépa, la RTA n'est pas proposée à une équipe, et `deplacerVersOnglet`
  refuse le passage dans un sens comme dans l'autre ;
- la carte montre ses douze premiers monstres, puis le nombre des autres (« +3 ») ;
- « Exporter vers l'Optimizer » crée une liste au nom de la prépa, au lead d'arène,
  avec tous ses membres et **sans équipe** (une équipe de l'Optimizer en a six au
  plus) ; rien n'est lié, « Mettre à jour depuis l'Optimizer » n'est pas proposé.

Les équipes rangées « Arène — RTA » des versions précédentes (`arene/rta`, et
l'ancien `rta`) se relisent en prépas, sans leur leader ni leur speed tune.

## Monstres par équipe

Le jeu limite le nombre de monstres d'une équipe selon le contenu ; règle relevée en
jeu par l'utilisateur le 2026-11-22, portée par `monstresMax`
(`src/lib/equipesEnregistrees.ts`) :

| Rangement | Monstres au plus |
| --- | --- |
| Arène (toutes ses catégories) | 4 |
| Combat de guilde (siège et guerre de guilde) | 3 |
| Cairos | 5 |
| Labyrinthe | 5, sauf Sauvetage : 4 |
| Subjugation | 5 |
| Passage des dimensions | 4, sauf Raid dimensionnel : 5 |
| Rift | 6 |
| Temple du chaos | 5 |
| ToA | 5 |

⚠️ Un contenu ajouté sans règle relevée prend la limite de l'app (6) : on ne la
complète pas par ressemblance, on demande le relevé.
Sans catégorie choisie, la limite est la plus grande des catégories de l'onglet :
l'alerte ne vise qu'une équipe trop grande pour chacune.

- **À la création** : « Ajouter un monstre » est désactivé à la limite, et son
  infobulle la dit (« En Arène — Offense arène, une équipe compte 4 monstres au
  plus. ») ; `ajouterMonstre` la refuse aussi.
- **Au déplacement** : vers un rangement où l'équipe a trop de monstres (« Onglet et
  catégorie » du détail, « Déplacer vers… » de la carte), une confirmation le dit
  (« Déplacer quand même ? ») ; son défaut est « Annuler ». À l'enregistrement d'une
  équipe de l'Optimizer, la fenêtre le dit sous le choix du rangement.
- **Ensuite** : une équipe trop grande pour son rangement (déplacée quand même,
  importée d'un fichier, mise à jour depuis l'Optimizer) le dit sur sa carte
  (« 5 monstres : 4 au plus ici ») et dans son détail.

## Groupes

Certaines équipes se jouent **ensemble** et se partagent les runes du compte : les
trois équipes du raid des mondes, celles du temple du chaos, les défenses de siège,
les offenses de guerre de guilde. Règle de jeu relevée par l'utilisateur
(2026-11-22) : dans ces contenus, une rune ne sert qu'à l'une des équipes, et une
**espèce** ne s'y joue qu'une fois, même si le compte en a plusieurs exemplaires. Un
**groupe** les réunit, par un nom libre, dans un onglet (choix de l'utilisateur,
plutôt qu'une liaison propre à chaque contenu).

- « Nouveau groupe », à côté de « Nouvelle équipe » (au téléphone, sur la même
  ligne), forme un groupe depuis la grille (`ModaleGroupe.tsx`) : son nom (prérempli
  du premier « Groupe N » libre) et les équipes de l'onglet à cocher. Une équipe d'un
  autre groupe le dit (« dans Raid A ») et, cochée, en change. « Modifier le
  groupe », dans l'en-tête du groupe, rouvre la même fenêtre : renommer, ajouter,
  décocher pour faire quitter le groupe (`appliquerGroupe`). Il faut au moins une
  équipe cochée, et un nom qu'aucun autre groupe de l'onglet ne porte. « Supprimer le
  groupe », dans la même fenêtre, le fait disparaître après confirmation (défaut
  « Annuler ») : ses équipes restent, sans groupe.
- Le détail d'une équipe choisit son groupe (« Groupe », `SelecteurGroupe` de
  `DetailEquipe.tsx`) : « Aucun groupe », les groupes déjà formés dans l'onglet
  (`groupesDeLOnglet`), ou « Nouveau groupe… », nommé dans la fenêtre de
  `NouvelleEquipeModale` (prérempli du premier « Groupe N » libre). Un nom vide fait
  quitter le groupe (`modifierGroupe`).
- **Un groupe ne sort pas de son onglet** : deux groupes du même nom dans deux onglets
  sont deux groupes (`equipesDuGroupe`). Changer de catégorie dans l'onglet garde le
  groupe, changer d'onglet le quitte (`deplacerVersOnglet`) ; une copie
  (« Dupliquer ») n'est dans aucun groupe.
- Dans la grille, **les groupes d'abord**, chacun d'un bloc, dans l'ordre de leur
  équipe la plus récente, puis les équipes hors groupe sous un en-tête « Non
  groupées » (absent quand l'onglet n'a aucun groupe) : une carte hors groupe ne
  paraît jamais sous l'en-tête d'un groupe (`regrouper`). L'**en-tête** d'un groupe,
  sur toute la largeur (`EnTeteGroupe.tsx`), donne le nom, le nombre d'équipes du
  groupe entier (filtre de catégorie compris), ce que plusieurs d'entre elles
  portent à la fois, « Modifier le groupe » et « Exporter le groupe vers
  l'Optimizer ». Un bloc coupé par la pagination reprend son en-tête en haut de la
  page suivante. Même en-tête aux deux formats ; au téléphone, il passe sur
  plusieurs lignes.
- Ce que l'en-tête signale (`conflitsGroupe`) : les **pièces** (runes, artéfacts,
  relique, par leur identifiant du jeu ; une pièce sans identifiant n'est pas
  comptée) et les **espèces** (par `com2usId`, quel que soit l'exemplaire), nommées,
  présentes dans plus d'une équipe du groupe, d'après les copies enregistrées. Un
  doublon dans une même équipe n'est pas compté. Une collaboration et sa version SW
  comptent pour deux espèces : la règle ne dit rien d'elles.
L'onglet ouvert, le filtre de chaque onglet et la recherche se gardent pour la
session, comme l'état des autres outils (`useStickyState`).

Une équipe a un seul rangement. Elle
compte **de 2 à 6 monstres** (décision de l'utilisateur) à la relecture, quel que
soit l'onglet ; la limite du contenu (§ Monstres par équipe) borne l'ajout et
alerte au-delà, sans rendre l'équipe illisible. Une équipe de
0 ou 1 monstre n'est jamais enregistrée : illisible à la relecture (stockage,
fichier, session), elle va aux rejets ; « Nouvelle équipe » reste un brouillon tant
qu'elle n'a pas deux monstres ; le retrait du deuxième est refusé. Toute équipe
enregistrée s'exporte donc vers une équipe de l'Optimizer, qui en accepte 2 à 6.

## Ce qu'une équipe enregistre

`EquipeEnregistree` :

- `id` : chaîne unique, tirée à la création, jamais réutilisée ;
- `onglet` : son rangement, l'onglet et sa catégorie (plus haut) ;
- `nom` : texte non vide (« Équipe N » libre par défaut), trimé à la sortie du champ ;
- `note` : texte libre, vide par défaut ;
- `monstres` : 0 à 6 `MonstreEnregistre`, **dans l'ordre de l'équipe** ;
- `leader` : l'`uid` d'un monstre de `monstres`, ou `null` ;
- `speedTune` (facultatif) : la forme de `SpeedTuneEquipe`
  (`src/lib/speedTuneEquipe.ts`) entière — `plan` (`PlanSpeedTune`, ou `null` pour un
  plan perdu), et pour chaque ligne alliée son `uid` de ligne, son état `attache` et
  ses valeurs de `repli` —, à ceci près que le membre d'une ligne est désigné par
  l'`uid` d'un monstre de l'équipe au lieu d'un sélecteur de l'Optimizer. Un speed
  tune malformé à la relecture (plan illisible, lien vers un `uid` absent, champ mal
  typé) ne rejette jamais l'équipe : le plan illisible devient `null`, le lien
  invalide est retiré, et la carte le signale (« Speed tune incomplet ») ;
- `groupe` (facultatif) : le nom de son groupe dans l'onglet (§ Groupes), trimé ;
  vide, il est oublié à la relecture ;
- `lienOptimizer` (facultatif) : `{ listId, equipeId, correspondance }`, la liste de
  l'Optimizer créée par le dernier export de cette équipe, l'équipe de cette liste
  (toujours désignée : un lien sans équipe est retiré à la relecture), et pour chaque
  membre exporté le couple `{ uid, selecteur }` (le monstre de l'équipe et son
  sélecteur dans la liste) ;
- `creeLe`, `modifieLe` : dates ISO.

`MonstreEnregistre` :

- `uid` : identifiant du monstre **dans l'équipe**, tiré à l'ajout, stable quand on
  réordonne. Le leader et les lignes du speed tune le désignent : réordonner ne
  change aucune désignation ; retirer un monstre remet `leader` à `null` s'il le
  désignait et retire ses liens de lignes (la ligne reste dans le plan, sans
  monstre, comme dans l'Optimizer) ;
- `com2usId` : l'espèce. Le `Monster` se re-résout à chaque lecture avec les données
  du jour, jamais figé dans l'enregistrement (même règle que le compte conservé) ;
- `unitId` : l'unité du jeu (`unit_id`) **quand la source la connaît** : un
  exemplaire de la Box, un membre Box de l'Optimizer, un deck d'arène. Les presets de
  siège ne la portent pas dans l'app : `unitId` vaut alors `null`, et aucune copie de la
  Box n'est choisie à sa place. Même règle pour un monstre ajouté sans exemplaire ;
- `provenance` : d'où vient l'équipement (`porte`, `rta`, `siege-defense`,
  `siege-attaque`, `arene-defense`, `arene-attaque`, `deck`, `optimizer`, `aucun`) ;
- `equipement` : un `GearSet` **copié** au moment de l'enregistrement — stats de base
  de l'unité, runes (`RuneDetail` complet, identifiant compris), artéfacts
  (`ArtifactDetail`), relique (`RelicDetail`). `null` pour un monstre sans équipement.

⚠️ **Une copie, pas une référence.** Le compte change (runes meulées, vendues,
déplacées) ; une équipe doit rester lisible, et dire ce qui a changé, même si plus
rien de son équipement n'existe. Les identifiants gardés servent à la comparaison,
jamais à relire l'équipement.

## Comparaison au compte

Avec un compte chargé, chaque pièce enregistrée est comparée, par son identifiant, à
l'inventaire actuel (`runes`, `artifacts`, `relics` du compte) :

| État | Règle |
| --- | --- |
| identique | la pièce existe, et tous ses champs sont égaux, sauf les exclusions ci-dessous |
| modifiée | la pièce existe, mais un champ comparé diffère |
| disparue | aucune pièce de cet identifiant dans l'inventaire |

L'égalité est champ à champ sur le type de la pièce (`RuneDetail`, `ArtifactDetail`,
`RelicDetail`), lignes d'effet comprises dans leur ordre, par une seule fonction pure
(`comparerPiece`) : un champ ajouté à ces types est comparé sans qu'on y pense. La
seule exclusion est le marqueur de rune posé en jeu (`marker`), qui n'est pas une
stat. Une pièce
d'identifiant non strictement positif (pièce synthétique) n'est jamais comparée :
elle est marquée « hors compte ».

Par monstre, une ligne dit en plus ce que porte son exemplaire :

| `unitId` | Équipement | Ligne |
| --- | --- | --- |
| connu, dans la Box | égal pièce à pièce à l'enregistré | « Équipé ainsi » |
| connu, dans la Box | différent | « Équipé autrement » |
| connu, absent de la Box | — | « Exemplaire absent du compte » |
| `null` | — | aucune ligne : l'exemplaire n'est pas connu |

Un monstre sans équipement enregistré n'a ni pièce ni ligne d'exemplaire.

⚠️ **La page affiche l'écart, elle ne corrige rien.** Aucune équipe n'est réécrite
parce que le compte a changé : seul un geste de l'utilisateur la modifie (mise à jour
depuis l'Optimizer, édition).

La carte d'une équipe résume l'état de pire gravité : rien quand tout est identique,
sinon « N pièces modifiées », « N pièces disparues ». Le détail marque chaque pièce.

## Écran

### Ordinateur

- En tête : la rangée d'onglets, puis une ligne d'actions : la recherche, « Nouvelle
  équipe », « Importer une équipe » (menu des sources), « Nouveau groupe », et, à
  droite, « Exporter le fichier » et « Importer un fichier ».
- Dessous, une grille de cartes (autant de colonnes que la largeur le permet, par
  requête de conteneur). Une carte : le nom, les avatars des monstres dans l'ordre
  (le leader marqué), la note sur une ligne tronquée, le résumé d'écart, et un menu
  d'actions (`Menu`) : « Ouvrir », « Exporter vers l'Optimizer », « Mettre à jour
  depuis l'Optimizer », « Dupliquer », « Déplacer vers… », « Supprimer ».
- Au-delà de 24 équipes dans l'onglet (après recherche), la grille se pagine
  (`Pager`), posé **au-dessus** de la grille : la hauteur d'une page varie avec ses
  cartes, et un pager placé dessous bougerait sous le clic.
- « Ouvrir » (la carte ou son menu) affiche l'équipe **dans la page**, à la place de
  la barre de recherche et de la grille, sans modale : une ligne d'en-tête,
  « Toutes les équipes » (retour à la grille), le nom et la note éditables, puis le
  menu d'actions de la carte (sans « Ouvrir ») ; le nom n'est écrit que dans son
  champ. Ensuite, **une ligne par monstre** :
  à gauche son identité (avatar, nom suivi de la croix de retrait, provenance,
  leader et, dessous, la position, reprise de l'équipement, état de chaque pièce
  qui n'est pas identique), dans une colonne à la largeur de son contenu (au plus
  224 px), à droite son équipement enregistré par `MonsterGear` (fiche de stats,
  artéfacts, relique ; sans la roue de runes, `sansRoue`, que les cartes
  remplacent), puis, à droite de la relique, ses runes en cartes : la carte de
  la liste du compte (`CarteRune`, même bascule détail ↔ total au clic), dans
  l'ordre des slots, telle que la copie l'a enregistrée (l'écart au compte reste dit
  sous le nom). Les six cartes tiennent sur une rangée quand la place à droite de
  la relique le permet (1 330 px), sinon en grille de trois sur deux rangées
  (661 px, le cas d'un écran de 1 920 px) ; sans même cette place, la grille passe
  sous l'équipement. Toutes les fiches partagent ces colonnes (une grille commune,
  chaque fiche en `grid-cols-subgrid`) : fiches de stats et cartes de runes
  s'alignent d'un monstre à l'autre, l'identité prenant la largeur de la plus
  large. Les
  onglets restent : celui de l'équipe est marqué, en choisir
  un autre referme l'équipe. Refermée, la grille revient sur l'onglet de l'équipe
  (elle a pu y être déplacée). L'écran partagé (`DeuxVolets`) reste celui de l'app,
  pas un second volet propre à la page.

### Téléphone

- La rangée d'onglets défile de côté. Sous elle, la recherche sur toute la largeur,
  puis « Nouvelle équipe ». Le bouton « Options » de la barre du haut (panneau
  d'actions, [panneau-actions-mobile.md](../transverse/feat-navigation/panneau-actions-mobile.md))
  regroupe les imports et les fichiers.
- Les équipes en une colonne de cartes, mêmes informations, même menu.
- « Ouvrir » affiche l'équipe dans la page comme au bureau, les monstres à la
  suite : l'identité passe au-dessus de l'équipement (requête de conteneur), et le
  leader et la position sous le nom, pour ne pas tronquer le nom. L'en-tête met
  « Toutes les équipes » et le menu sur une ligne, le nom et la note dessous.
  L'équipement garde sa roue de runes, sans les cartes : six cartes y prendraient
  plus de hauteur que la roue.

Aucune des deux mises en page n'est dérivée de l'autre : chacune a son agencement
et ses tests de rendu. Le banc d'affichage mesure la page (`compte-equipes` :
ouverture, sources d'import, équipe importée, détail, groupe, « Nouveau groupe » ; en plus des deux formats,
à 1 920 px, runes en 3 × 2, et à 2 560 px, runes sur une rangée) et l'Optimizer sur une liste
liée (`optimizer`, état `equipe-liee`).

## Recherche

- Un champ à suggestions de monstres (`useComboboxNav`), qui ajoute un monstre à la
  recherche sous forme de `Jeton` ; plusieurs jetons possibles.
- Une équipe est retenue si elle contient **tous** les monstres recherchés. Une
  collaboration et sa version SW (`jumeauCollab`) comptent pour la même espèce,
  comme dans la confrontation des recommandations.
- La recherche porte **sur l'onglet ouvert** seulement ; les jetons restent quand on
  change d'onglet, et le compte de chaque onglet reste le total de l'onglet.
- Le nom de l'équipe n'est pas cherché : la recherche est une recherche par monstre.
- Ordre des cartes : la dernière modifiée en premier.

## Créer et modifier

- « Nouvelle équipe » demande d'abord le nom de l'équipe (`NouvelleEquipeModale`,
  prérempli du premier « Équipe N » libre ; vide, il garde ce nom), puis ouvre le
  détail d'un **brouillon** dans l'onglet ouvert (« L'équipe
  s'enregistre dès qu'elle a deux monstres. ») : rien n'est enregistré avant le
  deuxième monstre (`gesteSurBrouillon`), et fermer le détail avant l'abandonne.
- « Ajouter un monstre » : une recherche d'espèce, puis le choix de l'équipement
  parmi ce que le compte connaît de cette espèce, chaque choix nommé par sa
  provenance : « Équipement porté » (chaque exemplaire de la Box), « Prépa RTA »
  (son build de la prépa de la page RTA), « Défense de siège N », « Offense de siège N », « Défense d'arène », « Offense
  d'arène N », ou « Sans équipement ». Chaque choix équipé montre la rangée du choix
  d'exemplaire de l'Optimizer (`LigneExemplaire`, d'`ExclusionCandidateRow.tsx`) :
  le monstre, ses sets actifs, son nombre de runes et, pour un deck de siège ou
  d'arène, ses coéquipiers dans l'ordre des places, le monstre en gras. Le choix
  copie l'équipement à cet instant.
- Réordonner par un sélecteur de position (« Position N », le même geste aux deux
  formats, sans glisser-déposer), désigner le leader, retirer un monstre. À deux
  monstres, la croix est désactivée, son infobulle dit « Une équipe garde au moins
  deux monstres. »
- « Reprendre l'équipement porté » sur une fiche de monstre remplace sa copie par
  ce que son exemplaire porte aujourd'hui (provenance `porte`), et son infobulle le
  dit. Il n'existe que si `unitId` est connu, présent dans la Box, **et** équipé
  autrement que la copie : quand l'exemplaire porte déjà la copie (« Équipé
  ainsi »), le geste ne changerait rien et n'est pas proposé.
- La fiche n'a pas de geste pour retirer la seule relique : l'équipement se
  remplace en entier (« Reprendre l'équipement porté », ou l'Optimizer).
- « Dupliquer » copie l'équipe dans le même onglet, nom suffixé, nouveaux `id` et
  `uid` ; le leader et les liens du speed tune suivent la correspondance ancien →
  nouveau `uid`, et les `uid` des lignes du plan restent. La copie n'a **pas** de
  `lienOptimizer` : deux équipes ne mettent jamais à jour la même liste.
- « Supprimer » une équipe passe par une confirmation (`Dialogs.tsx`), dont le défaut
  est « Annuler ».

## Imports

Le menu « Importer » liste ses sources avec la grammaire de l'import de l'Optimizer
(un en-tête par section, avatars, libellé court, source sans contenu désactivée avec
sa raison). Chaque choix crée **une nouvelle équipe** ; rien d'existant n'est
modifié.

Les sources suivent l'**onglet ouvert** (décision de l'utilisateur,
`ordonnerSourcesPourOnglet`, par le rangement de chaque source) : d'abord celles de
la catégorie filtrée, puis celles de l'onglet, puis le reste dans l'ordre de base
(défenses de siège, offenses de siège, arène, prépa de la page RTA, decks du jeu,
Optimizer). Dans Combat
de guilde filtré sur « Défense siège », les défenses de siège, puis les offenses de
siège et de guerre de guilde, puis le reste ; sous « Tout », toutes les sources de
l'onglet d'abord.

| Source | Rangement de l'équipe créée | Équipement copié |
| --- | --- | --- |
| Une défense de siège | Combat de guilde — Défense siège | le preset du deck |
| Une offense de siège | Combat de guilde — Offense siège | le preset du deck |
| La défense d'arène | Arène — Défense arène | le preset de la défense, même vide ; sans preset pour l'unité, ce qu'elle porte |
| La défense d'arène de serveur | Arène — Défense inter serveur | idem |
| Une offense d'arène | Arène — Offense arène | ce que portent les monstres à l'export |
| La prépa de la page RTA (avec les decks du jeu) | RTA, une prépa | le build de chaque monstre dans la prépa |
| Un deck enregistré du jeu | son onglet et sa catégorie (`rangementDeck`) ; un type non relevé, l'onglet ouvert | le preset du deck |
| Une équipe de l'Optimizer | l'onglet ouvert | le build validé du membre, sinon son équipement affiché |

- Siège : depuis les équipes de siège de l'app (`SiegeTeam`, slot 0 = leader).
- Prépa de la page RTA : la prépa telle qu'elle est (`RtaState`), entière, dans
  l'ordre de ses sections, « Non classé » en dernier. Comme les decks, c'est une
  donnée lue dans l'export (un inventaire alternatif), d'où sa place sous « Decks du
  jeu » (décision de l'utilisateur). L'import du compte garde, pour chaque monstre de
  la prépa, l'exemplaire dont vient son build (`RtaEntry.unitId`) : la prépa
  enregistrée le désigne dans la Box. Une prépa vide n'est pas importable.
- Arène : les decks d'arène sont lus à l'import du compte (`parseArenaDecks` :
  `defense_deck_info`, `server_arena_defense_deck_info`, `deck_list` au `deck_type`
  1) et conservés avec le compte dans un champ facultatif, `arenaDecks`, sans
  changer de schéma. Un compte conservé avant ce champ n'a pas ses decks d'arène : la
  source est désactivée, « Réimporte ton compte pour lire tes decks d'arène ». Ces
  decks connaissent l'unité de chaque monstre : leurs monstres gardent leur
  `unitId`.
- RTA : la prépa RTA n'est pas une source, ni d'équipe ni d'équipement (décision de
  l'utilisateur) ; les équipes RTA se créent à la main ou depuis l'Optimizer.
- Optimizer : une équipe d'une liste (ses membres, son leader, son speed tune), une à
  la fois. **Jamais une liste entière** (décision de l'utilisateur) : une liste sans
  équipe n'est pas une source ; sans aucune équipe, la source est désactivée, « Aucune
  équipe dans l'Optimizer ». Une source dont un membre ne se résout plus dans le compte
  est désactivée, avec sa raison.
- Siège : le leader est le monstre du slot 0, et lui seul ; un slot 0 vide donne une
  équipe sans leader.
- Un deck de siège ou d'arène de moins de deux espèces connues est désactivé, « Moins
  de deux monstres connus. »
- Decks du jeu : les decks enregistrés de l'export (`deck_list`, lus par
  `parseDecksEnregistres`, [decks-enregistres.md](../transverse/feat-import-compte/decks-enregistres.md))
  et conservés avec le compte dans un champ facultatif, `decksEnregistres`. Un groupe
  par onglet, dans l'ordre des onglets ; chaque deck nommé par son contenu, son
  donjon ou sa catégorie s'il en a un, et son numéro (« Cairos — Tanière du dragon
  · 2 »). Le type 1 (arène — offense) et le type 22 (siège — offense) n'y sont pas
  repris : les decks d'arène et les équipes de siège les portent déjà. Le leader est
  le slot 0 ; les monstres n'ont pas d'`unitId` (le deck ne garde que l'espèce et
  l'équipement). Sans ce champ (compte conservé avant lui), la source est désactivée,
  « Réimporte ton compte ». Le rangement (`RANGEMENT_CONTENU_DECK`, puis
  `RANGEMENT_SOUS_CONTENU_DECK` pour le donjon) : guerre de guilde en Offense guerre
  de guilde ; chaque mode du labyrinthe dans le sien ; tribunal d'ascension et tours
  en ToA ; chaque donjon de Cairos, de la faille, du passage des dimensions et de la
  subjugation dans le sien ; les trois phases du raid dimensionnel en Raid
  dimensionnel ; le raid des mondes dans Rift ; le temple du chaos dans son onglet,
  sans catégorie (l'export ne dit pas l'élément). Un deck sans donjon connu va dans
  son onglet, sans catégorie.

Un rapport (modale) suit chaque import : l'équipe créée, les monstres ignorés et leur
raison (espèce inconnue, slot vide sans monstre).

## Aller-retour avec l'Optimizer

### Exporter vers l'Optimizer

« Exporter vers l'Optimizer » crée une **nouvelle liste** par l'action commune
`importerEquipe` (voir [feat-import-equipes.md](../optimizer/feat-import-equipes.md)),
avec un producteur dédié, `preparerExportEquipeOptimizer` (`src/lib/importEquipesEnregistrees.ts`) :

- nom de liste : le nom de l'équipe ; contenu : celui de son onglet (tableau plus
  haut), chaque onglet s'exporte ;
- membres, dans l'ordre de l'équipe : un monstre dont l'`unitId` est dans la Box
  prend le sélecteur Box de cette unité ; sinon le sélecteur `unowned` de son espèce,
  avec une `copie` distincte par occurrence (deux occurrences d'une espèce restent
  deux membres), et le rapport le dit. Deux monstres de la même unité Box : le
  second est ignoré avec sa raison (un exemplaire ne figure qu'une fois dans une
  liste) ;
- équipe : créée si 2 à 6 membres restent (règle de l'Optimizer) ; leader et lead du
  monstre leader ; speed tune reporté sur les membres de ses lignes. Si un doublon
  d'unité laisse moins de deux membres, la liste n'a pas d'équipe et aucun lien
  n'est posé ;
- **point de départ** : un build validé par membre, dans l'ordre de l'équipe, quand
  son équipement enregistré compte 6 runes d'identifiant strictement positif,
  distinctes, une par emplacement de 1 à 6. Les artéfacts repris sont ceux de la
  copie, au plus un par sorte (attribut, type) ; une copie qui en porte deux d'une
  même sorte ne reprend aucun artéfact, et le rapport le dit. La paire vient d'un
  équipement du jeu, où elle était valide : aucun autre contrôle d'éligibilité
  n'est fait. Les identifiants
  d'artéfacts et de relique non positifs ne sont pas repris. Une pièce
  disparue va dans `runesManquantes` / `artefactsManquants`. Une pièce modifiée est
  validée sous son identifiant, et le rapport la nomme, puisque l'Optimizer lira sa
  version actuelle. Si une rune ou un artéfact présent est déjà réservé par un membre
  précédent de la même liste (deux presets qui partagent une pièce), le membre n'a
  pas de build validé, et le rapport nomme les deux monstres. Un membre sans
  6 runes n'a pas de build validé.

⚠️ **C'est la seule entrée dont le consommateur pose des builds validés.** Le
consommateur commun (`consommerImportOptimizer`) reçoit pour cela un champ facultatif
de l'import, `buildsAValider`, que les autres producteurs laissent absent ; il les
pose après l'ajout des membres, avec les contrôles de réservation de la validation
manuelle. [feat-import-equipes.md](../optimizer/feat-import-equipes.md) borne son
« aucun build n'est validé par l'import » à ce seul cas, dans le même commit.

Après acceptation, l'équipe enregistre `lienOptimizer = { listId, equipeId, correspondance }` et
l'Optimizer s'ouvre, comme pour les autres exports. Le lien est stocké avec l'équipe
enregistrée, jamais dans le stockage des listes de l'Optimizer, qui ne change pas de
format.

### Exporter un groupe

« Exporter le groupe vers l'Optimizer », dans l'en-tête d'un groupe, crée **une seule
liste**, nommée comme le groupe, avec toutes ses équipes
(`preparerExportGroupeOptimizer`) : la liste est la réserve de runes partagée de
l'Optimizer ([feat-listes-et-reservation.md](../optimizer/feat-listes-et-reservation.md)),
ses équipes ne s'y prennent pas leurs runes. Chaque équipe y entre comme à l'export
d'une équipe seule, avec ces différences :

- un exemplaire de la Box n'entre qu'une fois dans la liste : déjà pris par une autre
  équipe du groupe, il est ignoré avec sa raison (« Ce même exemplaire figure déjà
  dans une autre équipe du groupe. ») ;
- les monstres non possédés se numérotent (`copie`) sur tout le groupe ;
- une pièce réservée par le build validé d'une équipe précédente refuse celui du
  membre suivant, comme dans une équipe, et le rapport nomme les deux monstres.

Après acceptation, chaque équipe que l'Optimizer a créée se lie à la sienne dans la
liste (`liensApresExportGroupe`, d'après `equipesCreeesIndices` du rapport) ; une
équipe restée à moins de deux membres n'est pas créée et garde son lien d'avant.
Chaque équipe se met ensuite à jour depuis l'Optimizer seule, comme les autres.

### Mettre à jour depuis l'Optimizer

Une équipe dont la liste liée existe encore propose « Mettre à jour depuis
l'Optimizer ». Dans l'Optimizer, **chaque équipe d'une liste** porte, sur l'en-tête
de sa bande, centré entre « Équipe N » et « Speed tune », un bouton à l'icône de
Mes équipes dans une case oblongue de la hauteur de « Speed tune », aux deux
formats. Son infobulle dit « Enregistrer dans Mes équipes ». Tant
qu'un membre de l'équipe n'a pas de build validé portant ses runes **et** ses
artéfacts (`buildsEquipeValides`), il reste grisé et son infobulle dit « Valide
d'abord les builds des monstres de l'équipe ». La fenêtre « Modifier l'équipe »
n'a plus ce geste. **L'enregistrement se fait équipe par équipe,
jamais pour une liste entière** (décision de l'utilisateur). Le geste ouvre « Mes
équipes » et, après sa relecture :

- une équipe enregistrée suit déjà cette équipe de l'Optimizer (`equipeLieeA` :
  même `listId`, même `equipeId`) : la même confirmation que « Mettre à jour depuis
  l'Optimizer », sur l'onglet de l'équipe ;
- sinon : « Enregistrer dans Mes équipes », une confirmation qui crée une **nouvelle**
  équipe (`creerDepuisEquipeOptimizer`), avec un champ de nom prérempli du premier
  « Équipe N » libre (`nomEquipeLibre`), un sélecteur d'onglet (l'onglet ouvert par défaut : le contenu d'une liste de
  l'Optimizer ne désigne pas un onglet) et les pièces introuvables nommées. L'équipe
  créée est **liée** : l'enregistrer à nouveau la met à jour au lieu d'en créer une
  autre. L'import « Optimizer » de Mes équipes, lui, crée une copie sans lien, pour
  qu'une équipe de l'Optimizer n'ait qu'une équipe enregistrée qui la suive.

**La source est fixée par le lien** :

- `equipeId` désigne une équipe qui existe encore dans la liste : ses membres, dans
  leur ordre, son leader et son speed tune.

Un membre repris retrouve son monstre enregistré par la
`correspondance` du lien (clé `exclusionSelectorKey` du sélecteur) et garde son
`uid` ; un membre sans correspondance (ajouté dans l'Optimizer, ou dont la
revérification du compte a changé le sélecteur) devient un nouveau monstre. Un
monstre enregistré sans membre repris est retiré, avec son leader et ses liens de
lignes ; la confirmation le nomme.

- `equipeId` désigne une équipe disparue : l'action est désactivée, « L'équipe de
  l'Optimizer n'existe plus », et rien n'est deviné.

⚠️ **Un membre qui ne se résout
pas** (compte pas encore relu, exemplaire disparu) refuse toute la mise à jour : le
reprendre comme absent retirerait son monstre de l'équipe. Sans compte chargé,
l'action est désactivée (« Importe ton compte pour mettre à jour depuis l'Optimizer »).
L'équipe de l'Optimizer compte 2 à 6 membres : la mise à jour ne vide jamais une
équipe enregistrée.

L'équipement de chaque monstre se reconstruit pièce par pièce :

- avec un build validé, ses identifiants de runes (`runeIds` et `runesManquantes`),
  d'artéfacts (`artifactIds` et `artefactsManquants`) et de relique ; sans build
  validé, l'équipement affiché de l'exemplaire de la Box (provenance `optimizer` dans
  les deux cas). Sans build validé ni exemplaire (un monstre non possédé), l'Optimizer
  ne connaît aucun équipement : celui enregistré est gardé avec sa provenance, pour
  qu'un aller-retour sans changement ne vide pas le monstre ;
- chaque identifiant se relit dans l'inventaire actuel ; absent de l'inventaire, la
  copie de la pièce de **même type et même identifiant** est cherchée dans tout
  l'équipement enregistré de l'équipe (une pièce a pu passer d'un monstre à
  l'autre). Plusieurs copies de cet identifiant au contenu différent : celle du même
  monstre d'abord, sinon la première dans l'ordre de l'équipe, et la confirmation
  nomme ce choix ; absente des deux, la pièce **manque** ;
- un build validé sans `artifactIds` (validé avant ce champ) garde les artéfacts
  enregistrés, et la confirmation dit « artéfacts gardés » ; un build validé sans
  `reliqueId` garde la relique enregistrée,
  jamais la relique portée. La confirmation dit « relique gardée » : l'Optimizer ne
  distingue pas un retrait volontaire de la relique d'un build validé sans relique ;
- les stats de base sont celles de l'exemplaire actuel s'il est dans la Box, sinon
  celles de la copie enregistrée du monstre, sinon celles de l'espèce (6★ niveau
  max, comme un monstre non possédé de l'Optimizer).

Une confirmation (`Dialogs.tsx`) précède l'écriture, qui remplace l'équipe. Elle
nomme le nombre de monstres et de pièces qui changent (les pièces d'un monstre retiré
comprises), et **chaque pièce manquante**
avec son monstre ; son défaut est « Annuler ». Nom, note, onglet et `creeLe`
restent ; `modifieLe` change. La `correspondance` du lien est réécrite avec les
membres repris, nouveaux compris, pour que le retour suivant les retrouve.

Une liste liée supprimée de l'Optimizer désactive l'action (« La liste de l'Optimizer
n'existe plus ») ; le lien reste, inoffensif. Exporter de nouveau remplace le lien
par la nouvelle liste.

## Conservation

- Les équipes vivent en **IndexedDB**, dans une base à elles,
  `swblacksmith-equipes` : un store `equipes` (une entrée par équipe, clé = `id`). La base du compte (`swblacksmith`) n'est pas touchée et garde sa
  version. Raison de l'IndexedDB : des centaines d'équipes à six monstres équipés
  pèsent plusieurs mégaoctets, hors de portée de `localStorage`.
- **Sous l'interrupteur unique de conservation** (`usePersistence`) : écrites
  seulement si l'utilisateur l'a accepté ; sans accord, elles vivent en mémoire pour
  la session.
- **État « jamais demandé »** : la première équipe créée ou importée pose la question
  de conservation (`KeepAccountDialog`), comme le premier import de compte. Fermer
  sans répondre n'enregistre rien. Une fois la question tranchée, créer une équipe
  ne la repose pas : elle revient à l'import de compte, comme aujourd'hui.
- **Activer la conservation** écrit tout de suite les équipes déjà en mémoire.
  **Refuser alors qu'on conservait**, et « Tout supprimer », effacent aussi les
  équipes, avec les confirmations existantes ; l'effacement est attendu avant le
  rechargement de « Tout supprimer ».
- **Relecture au démarrage et gestes** : les équipes conservées se relisent au
  démarrage. Un geste fait avant la fin de la relecture (créer, importer, modifier,
  supprimer) s'applique **par-dessus** les équipes relues, jamais à leur place : la
  relecture fusionne par `id`, l'état en mémoire gagne pour une même équipe, et une
  équipe supprimée pendant la relecture ne revient pas.
- Toutes les écritures passent par une file sérielle, comme le compte : la dernière
  action gagne, et une suppression n'est jamais ressuscitée par une écriture en
  retard.
- Une entrée illisible à la relecture est écartée de l'écran et signalée une fois par
  une notification ; elle reste telle quelle dans la base, jamais réécrite ni
  supprimée par la relecture (seuls « Tout supprimer » et le refus de conservation
  l'effacent).
- Erreur de stockage (navigation privée, quota) : repli en mémoire, comme le compte,
  sans exception.

### Fichier

- « Exporter le fichier » télécharge toutes les équipes, tous onglets confondus :
  `{ "format": "swblacksmith/equipes", "version": 1, "exporteLe": …, "equipes": [...] }`
  (`formatExport`, `src/lib/formatsExport.ts`).
- « Importer un fichier » est désactivé tant que les équipes conservées se relisent
  (« Lecture des équipes enregistrées… ») : les collisions d'`id` se résolvent contre
  l'ensemble complet.
- « Importer un fichier » **ajoute** les équipes du fichier, jamais ne remplace : une
  équipe dont l'`id` existe déjà reçoit un nouvel `id`, et le rapport dit combien. Les
  clés des entrées illisibles de la base comptent comme prises : un import ne les
  écrase jamais. Les collisions se résolvent contre l'état courant au moment de
  l'ajout, deux fichiers lus en même temps ne se donnent pas le même `id`. Un speed
  tune abîmé dans le fichier est signalé sur la carte (« Speed tune incomplet »).
  Les `lienOptimizer` importés sont retirés (ils désignent les listes d'un autre
  navigateur) ; le `groupe` est gardé. Une équipe invalide est ignorée avec sa raison ; un fichier d'un autre
  format est refusé entier.
- L'application de bureau ajoute les équipes à la session sauvegardée, comme le reste
  du travail ([feat-sauvegarde-session.md](../transverse/feat-sauvegarde-session.md)).

## Hors périmètre

- Partager une équipe avec un autre joueur (lien ou fichier d'une seule équipe).
- Une défense de guerre de guilde : l'export n'en a pas.
- Corriger automatiquement une équipe dont les pièces ont changé.
