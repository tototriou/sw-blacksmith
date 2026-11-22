# Fenêtre d'import

Une seule fenêtre pour importer des équipes, des groupes d'équipes ou des monstres, partagée par
la page Mes équipes ([feat-equipes.md](../compte/feat-equipes.md) § Imports) et l'Optimizer
([feat-import-equipes.md](../optimizer/feat-import-equipes.md) § F1). Elle remplace le menu
déroulant des sources, devenu long avec les catégories des onglets.

Code : `src/components/FenetreImport.tsx` (le rendu), `src/lib/fenetreImport.ts` (filtres,
sélection, produits : calcul pur, testé par `tests/fenetre-import.test.ts`), les sources dans
`src/lib/sourcesEquipesEnregistrees.ts`.

## Sources

Une source est un ensemble d'équipes importables, choisi par un sélecteur segmenté en tête de la
fenêtre. Chaque point d'entrée dit lesquelles il montre, et dans quel ordre :

| Source | Contenu | Mes équipes | Optimizer |
| --- | --- | --- | --- |
| Decks du jeu | ce que l'app a lu de l'export : défenses et offenses de siège (celles créées dans la page Siège comprises), decks d'arène, decks enregistrés, prépa de la page RTA | oui | oui |
| Mes équipes | les équipes enregistrées, un groupe = un bloc | pour « Importer des monstres » seulement | oui, en premier |
| Optimizer | les équipes des listes de l'Optimizer | oui | non (elles y sont déjà) |
| Recommandations | chaque deck de chaque recommandation, une recommandation = un bloc | oui | oui |

La prépa RTA est un **contenu** des decks du jeu, pas une source : c'est un inventaire alternatif
lu dans l'export (décision de l'utilisateur). La fenêtre s'ouvre sur la première source qui a
quelque chose à importer, dans l'ordre du point d'entrée (`sourceInitiale`).

## Filtres

- **Contenu** (`Selecteur`) : « Tous les contenus » ou une catégorie des onglets de Mes équipes
  (Arène, Cairos, Combat de guilde…), chacune suivie du nombre de ses équipes importables ; dessous,
  les sous-catégories de la catégorie choisie en pastilles (elles défilent de côté au téléphone).
  Le filtre ne vaut que pour les sources rangées par contenu (decks du jeu, Mes équipes) ; une
  équipe sans rangement reste visible.
- **Recherche** : sur le libellé de l'équipe et le nom de ses monstres, sans tenir compte des
  accents ni de la casse.
- Ouverture : depuis Mes équipes, la fenêtre s'ouvre sur l'onglet et la sous-catégorie ouverts ;
  depuis l'Optimizer, sur « Tous les contenus ».

## Liste et sélection

Les équipes se rangent sous l'en-tête de leur groupe (un onglet, une recommandation…), chaque
en-tête une seule fois, à la place de sa première équipe, même quand ses équipes ne se suivent pas
dans la source (`sectionsFenetre`). Les équipes d'un même bloc (un groupe de Mes équipes, les
défenses de siège, une recommandation) sont réunies de même et s'encadrent, avec une case « Tout « nom » » qui coche le bloc entier.

Une ligne : la case de l'équipe à gauche, les portraits des monstres, puis le libellé et,
dessous, la raison d'une équipe non importable (« Moins de deux monstres connus. », « Réimporte
ton compte… »). Le libellé est le `label` de la case : un clic dessus coche l'équipe aussi.

Deux gestes, chacun sur sa cible, sans bascule entre eux :

- **Équipes** (mode `equipes`, `mixte`) : la case prend l'équipe entière ; plusieurs se cochent.
- **Monstres** (mode `monstres`, `mixte`) : chaque portrait est un bouton à bascule
  (`aria-pressed`) qui prend ce monstre seul. Choisi, il prend un contour et un fond d'accent, et
  une coche d'accent en coin. En mode `monstres`, un plafond (`maxMonstres`, les places libres)
  borne la sélection. Un deck non importable comme équipe garde ses monstres choisissables un à un.

En mode `mixte` (l'Optimizer), équipes cochées et monstres choisis s'additionnent dans un même
import : choisir un monstre ne décoche rien, décocher une équipe ne retire pas ses monstres
choisis. Mes équipes n'ouvre que les modes `equipes` (« Importer une équipe ») et `monstres`
(« Importer des monstres »).

Le pied de la fenêtre résume la sélection, liste les conflits (ci-dessous) et lit le rapport du
dernier import ; ses actions viennent du point d'entrée.

## Conflits

Les decks du jeu ne sont pas liés entre eux : au temple du chaos, le joueur en choisit trois, et
le combat ne se lance pas si deux decks partagent un monstre, une rune ou un artéfact. Quand la
sélection touche plusieurs équipes, la fenêtre calcule leurs conflits (`conflitsSelection`, par
`conflitsGroupe` de Mes équipes) et les liste avant l'import : rien ne bloque, l'utilisateur
décide. Les monstres choisis un à un y comptent (décision de l'utilisateur) : ceux d'une même
équipe non cochée y forment une équipe à eux, nommée comme elle ; ceux d'une équipe cochée y sont
déjà. Deux monstres d'une même équipe ne sont jamais en conflit entre eux.

## Ce que produit un import

- **Mes équipes** : une équipe par équipe cochée (« Importer » ou « Importer séparément »), ou,
  avec « Importer en groupe », ces équipes réunies dans un groupe nouveau (nom libre suivant de
  l'onglet). Le groupe exige au moins deux équipes d'une même catégorie hors RTA
  (`categorieDuGroupe`) ; sinon l'action est désactivée et le dit. Les monstres choisis
  s'ajoutent à l'équipe ouverte, dans la limite de ses places.
- **Optimizer** : un producteur unique (`producteurChoix`). Une seule équipe qui a son propre
  producteur le garde tel quel ; plusieurs équipes fusionnent leurs propositions (membres et
  builds dédoublonnés par sélecteur) ; des monstres forment une proposition sans équipe, fusionnée de même avec les équipes
  cochées. La liste prend le nom du bloc quand la sélection est exactement un bloc entier (sans
  monstre choisi), sinon celui de la première équipe ou, sans équipe, du premier monstre, suivi de
  « +N » (équipes et monstres comptés ensemble).

Les producteurs ne tournent qu'au geste d'import, jamais à l'ouverture.

## Format

- **Ordinateur** : modale de 720 px au plus ; sources, contenu et recherche en tête, liste
  défilante, pied fixe.
- **Téléphone** : la fenêtre prend toute la hauteur permise (90 % de l'écran) et la liste le reste,
  quel que soit son nombre de lignes : un filtre qui la vide ne change ni la taille de la fenêtre ni
  la place des filtres. Sources et sous-catégories défilent de côté, la raison passe sous le libellé,
  un libellé long passe sur deux lignes au lieu d'être tronqué, et les actions s'empilent.

Le banc d'affichage mesure la fenêtre ouverte depuis Mes équipes (`compte-equipes`, états
`imports`, `import-groupe`, `import-monstres`) et depuis l'Optimizer (`optimizer`, état `import`).
