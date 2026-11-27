# Recommandations — défenses visées

Partie de [Siège · Recommandations](README.md).

## Défenses visées — « Fort contre »

Une recommandation dit quoi jouer, et **contre quoi** : un deck porte une
liste de **défenses adverses qu'il bat** (`RecoDeck.counters`) :
**3 monstres** et une **précision facultative** (« si le Chloe est en lead »).

- **Facultatif et multiple** : un même deck bat souvent plusieurs compositions,
  et la plupart des decks n'en portent aucune.
- ⚠️ **Une identité, pas un build.** Ni sets, ni stats, ni propriétés
  d'artéfact : on décrit ce qu'on **affronte**, pas comment c'est runé. Le
  runage adverse n'est pas connaissable depuis l'app, et l'exiger transformerait
  une information de terrain en fiche que personne ne remplirait.
- ⚠️ **Purement informatif : jamais confronté au compte.** L'app ne connaît que
  **mes** équipes, pas celles des adversaires — il n'y a rien à quoi comparer.
  Ce bloc ne porte donc ni statut, ni badge, ni couleur de résultat, et
  n'intervient pas dans « Confronter à mon compte ».
- Même clé stable que partout : le **`com2usId`**. Un monstre perso n'y entre
  pas.
- Un monstre ne peut pas occuper deux emplacements de **la même** défense ; il
  peut revenir dans une autre.

**Placement** : bloc dédié **sous les 3 monstres** du deck déplié, séparé par
un filet. C'est une information sur le **deck entier**, pas sur un slot — et le
deck garde sa structure habituelle au-dessus. La ligne repliée en montre un
aperçu : jusqu'à trois défenses en petit, puis « … »
([rendu-de-la-page.md](rendu-de-la-page.md#la-ligne-dun-deck)).

- **Lecture** : les défenses sont **côte à côte** (`flex-wrap`), chacune réduite
  à ses **3 portraits**.
  - ⚠️ **En rangée et non empilées** : une vignette fait 90 px de contenu, une
    par ligne gaspillerait toute la largeur. Côte à côte, on en embrasse plusieurs
    d'un coup — c'est le point, reconnaître la composition qu'on affronte.
  - ⚠️ **La précision est repliée**, et s'ouvre **au clic sur la vignette** : une
    note dépliée fait deux fois la hauteur d'une vignette et casserait
    l'alignement de toute la rangée.
  - Un **chevron** marque les vignettes qui en portent une : sans lui, rien ne
    distingue une défense qui cache une précision d'une défense qui n'en a pas,
    et on cliquerait au hasard. Une vignette sans note **n'est pas cliquable** —
    un bouton qui ne fait rien se lit comme un défaut.

#### La précision s'ouvre en POPOVER, ancré sous sa vignette

La vignette cliquée prend la **bordure d'accent** — comme le monstre sélectionné
d'une équipe de siège dont on consulte les runes (voir
[SiegeTeam.tsx](src/components/siege/SiegeTeam.tsx)) — et la note apparaît en
**flottant ancré** juste dessous.

- ⚠️ **Un flottant, pas un panneau dans le flux.** Posé dans le flux, il
  devrait s'aligner sous une vignette qui, en `flex-wrap`, peut être n'importe
  où sur n'importe quelle ligne : le trait du cran et celui du panneau ne se
  rejoindraient pas, et **le rattachement mentirait**. Un flottant naît de son
  ancre, il n'a rien à aligner — et il ne pousse rien : la rangée reste immobile
  pendant qu'on lit.
- ⚠️ **`origin-top-left`** : un flottant ancré grandit **depuis son ancre**,
  jamais depuis son centre (voir [../../03-developpeur/interface/](../../../03-developpeur/interface/)).
- ⚠️ **Une seule précision ouverte à la fois.** L'état vit dans le **bloc**, pas
  dans la vignette.
- Se ferme au **clic extérieur** et à **Échap**, même motif que les autres
  popovers de l'app ([SettingsMenu.tsx](src/components/SettingsMenu.tsx)).
- `min-w-full` (au moins la largeur de sa vignette, pour se lire comme sa suite)
  et **280 px au plus** : la note est une phrase courte.
- ⚠️ **C'est le `Flottant` de la librairie** : même fond, même contour neutre,
  même ombre, même rembourrage que toutes les bulles de l'app. Le contour
  d'ACCENT est réservé à l'état enclenché, que porte déjà la vignette.
- La vignette ouverte passe en **`z-20`** : les suivantes sont peintes après dans
  le flux et passeraient sinon par-dessus le flottant.

#### ⚠️ La recherche n'ouvre AUCUNE précision

Une défense trouvée n'ouvre pas sa précision d'office : sur une recherche qui
remonte plusieurs défenses, cela déplierait des notes qu'on n'a pas demandées.
Le **surlignage** de la vignette suffit à dire laquelle répond ; on ouvre si
on veut lire.

### ⚠️ Un « + », pas un bouton « Éditer »

Le bloc **n'a pas de mode édition**. Noter la défense qu'on vient d'affronter est
un geste **de passage** : un crayon ajouterait une étape (ouvrir le mode, ajouter,
refermer) là où le geste réel est simplement « + ».

- **« + Défense »** ajoute une entrée **et l'ouvre en édition** — sinon on aurait
  posé une vignette vide sans moyen de la remplir.
- Le **« + » vit DANS la rangée**, à la suite des défenses existantes : c'est là
  qu'on ajoute, et il montre où la prochaine se posera. Il est **toujours
  visible**, y compris sur un deck qui n'en porte aucune — c'est lui qui rend la
  fonctionnalité découvrable.
- ⚠️ **L'édition est PAR DÉFENSE, pas pour le bloc entier**, et **une seule à la
  fois** : on note une composition, pas six. Les autres restent en **vignettes de
  lecture à côté**, ce qui permet de voir ce qu'on a déjà noté pendant qu'on
  ajoute.
- Celle en édition prend **toute la largeur** (`w-full` dans la rangée
  `flex-wrap`) : elle porte 3 sélecteurs et un champ de texte, que la mise en
  vignette écraserait. Une **bordure d'accent** dit laquelle est ouverte.
- ⚠️ **Chaque vignette porte son propre crayon**, sinon une défense posée
  deviendrait non modifiable. Discret (il n'apparaît qu'au survol, pour ne pas
  alourdir une rangée qu'on parcourt du regard) mais **toujours visible au
  tactile** — voir la règle « un élément atteignable ne dépend jamais du survol »
  de [../../03-developpeur/interface/](../../../03-developpeur/interface/).
  Le crayon est posé sur le coin haut droit de la vignette, au-dessus du
  chevron de la précision ; une vignette **sans précision** garde, au même
  endroit, une place vide de la taille du chevron : sans elle, le crayon
  tomberait sur l'icône d'élément du dernier portrait.
  **Repère dans le DOM**, pour le banc d'affichage :
  `data-bouton-coin="modifier-defense"` sur le `<button>` positionné du
  crayon (exception « bouton en coin » de `tests/banc/mesure.ts` : son
  dépassement sur la vignette est voulu).
- ⚠️ **L'index en édition est remis à `null` si le nombre de défenses change** :
  une défense supprimée laisserait l'édition pointer sur sa voisine, ou dans le
  vide.

#### ⚠️ Une défense sans AUCUN monstre n'est pas conservée

L'entrée est bien **créée** au clic sur « + » — c'est le formulaire qu'on
remplit —, mais si on la referme sans avoir rien choisi, elle est **retirée** :
elle ne décrit aucune composition, ne se lit pas en vignette, et voyagerait telle
quelle dans l'export.

Refermer sans rien poser vaut donc « j'abandonne », pas « j'enregistre du vide ».
Les **quatre** sorties sont couvertes :

| Sortie | Ce qui se passe |
|--------|-----------------|
| **Terminer** (✓) | l'entrée vide est retirée |
| **Ouvrir une autre défense** | la précédente, restée vide, est retirée (l'index visé est décalé si elle était avant lui) |
| **Replier le deck** | le bloc est démonté → nettoyage au démontage, sinon l'entrée vide survivrait |
| **Re-cliquer « + »** | aucune seconde entrée n'est créée tant que l'ouverte est vide — on réutilise celle qui est là |

- ⚠️ **La note seule ne suffit pas à la retenir** : une précision sans les
  portraits qu'elle qualifie (« si le Chloe est en lead ») ne veut rien dire. Ce
  sont les **3 monstres** qui font la défense.
- La même règle vaut déjà à l'**export** (`counterListToJson`) et à l'**import**
  (`jsonToCounter` renvoie `null`) : une défense vide n'est ni écrite, ni relue.
  Les trois chemins disent donc la même chose.
- ⚠️ Supprimer une défense la retire **pour de bon**, sans repli sur une entrée
  vide — contrairement aux decks, dont une recommandation garde toujours au
  moins un. **Zéro défense visée est l'état normal.**
- Le bloc vit **dans la partie dépliée du deck** : son état d'édition se
  réinitialise donc de lui-même au repli, sans rien à gérer.

## Fiabilité : quelle offense jouer d'abord

Quand plusieurs decks battent la même défense, on veut jouer **le plus sûr
d'abord**, puis les autres. Chaque défense visée porte donc une **fiabilité** :
celle de **ce deck contre cette défense** (`RecoCounter.fiabilite`), pas celle
du deck en général — un deck sûr contre une défense peut être un pari contre
une autre.

- **En étoiles, de 0 à 5, saisie par étoile entière** (0, 1, 2, 3, 4, 5 —
  `FIABILITE_PAS_SAISIE`) ; 5 est le mieux. **Absente = « non notée »**,
  distincte de 0 : « pas encore jugé » n'est pas « ne passe pas ». ⚠️ **Relue
  par demi-étoile** (`FIABILITE_PAS`) : des notes en demi-étoiles existent dans
  les stockages, les salons et les fichiers ; les refuser les effacerait. Elles
  s'affichent telles quelles (une demi-étoile dessinée) et passent à l'entier
  voisin au premier « + » ou « − ». Calcul pur dans
  [recoDefenses.ts](../../../../src/lib/recoDefenses.ts) (`fiabiliteValide`,
  `tonFiabilite`, `parFiabilite`), affichage et saisie dans
  [EtoilesFiabilite.tsx](../../../../src/components/siege/EtoilesFiabilite.tsx).
- **Couleur selon la note**, sur les étoiles pleines : **rouge** sous 2,
  **jaune** de 2 à 3,5, **vert** à partir de 4 (tokens `bad`, `warn`,
  `good`). Les étoiles vides restent grises.
- **Lecture** : cinq étoiles **au-dessus des portraits** de chaque défense sur
  la ligne d'un deck (vue Decks), **sous les portraits** de la vignette dans
  le deck ouvert, et sur la ligne de l'offense dans la vue Défenses (contre la
  défense regardée). Infobulle et nom accessible : « Fiabilité 4,5 sur 5 ».
- ⚠️ **Elle se note SUR PLACE, sans éditer le deck** (`FiabiliteRapide`) : les
  étoiles — ou « ☆ Noter », sans note — ouvrent le choix dans un flottant.
  ⚠️ **Noter dit contre QUOI** : un deck n'est pas aussi fort contre toutes ses
  défenses. Sur la ligne d'un deck, chaque vignette de défense note la
  sienne, ses portraits en tête du choix ; « … » liste TOUTES les défenses du
  deck, chacune sa rangée (portraits, étoiles, « − », « + », « × »). Dans la
  vue Défenses, la défense est celle du volet. Hors du flux : la ligne ne
  bouge pas à l'ouverture.
- **Le choix** (`ChoixFiabilite`), sur place comme dans la défense en
  édition :
  - toucher la k-ième étoile note k ;
  - ⚠️ **« − » et « + »** font le même geste étoile par étoile, en cibles
    tactiles : une étoile de 20 px reste juste à viser au doigt. 0 s'obtient
    par « − » depuis 1 ; « + » sur une défense non notée donne 1 ;
  - **« × »** la rend non notée. ⚠️ Toujours rendu, désactivé sans note : il
    apparaissait au premier clic et décalait la rangée ;
  - la note s'écrit à côté (« 3 / 5 », ou « Non notée ») — sauf dans la liste
    des défenses d'un deck, où les étoiles la disent : chaque rangée y tient
    sur une ligne au téléphone.
- ⚠️ **Classement dans la vue Défenses** : rangées « Par fiabilité », les
  offenses d'une défense passent **de la plus fiable à la moins fiable**, 0
  avant les non notées ; à égalité, l'ordre par recommandation
  ([recherche-par-monstre.md](recherche-par-monstre.md#la-vue-défenses)). La
  vue Decks ne réordonne rien.
- **Partage** : voyage dans l'export, champ facultatif `fiabilite`
  ([persistance-et-partage.md](persistance-et-partage.md#le-champ-fiabilite-dune-défense-visée)).
