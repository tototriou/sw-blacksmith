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

Les équipes se rangent sous l'en-tête de leur groupe (un onglet, une recommandation…). Des
équipes consécutives d'un même bloc (un groupe de Mes équipes, les défenses de siège, une
recommandation) s'encadrent, avec une case « Tout « nom » » qui coche le bloc entier.

Une ligne : les portraits des monstres, puis la case de l'équipe et, dessous, la raison d'une
équipe non importable (« Moins de deux monstres connus. », « Réimporte ton compte… »).

La sélection porte **soit** sur des équipes, **soit** sur des monstres, jamais les deux :

- **Équipes** (mode `equipes`, `mixte`) : plusieurs cases cochées.
- **Monstres** (mode `monstres`, `mixte`) : chaque portrait est un bouton à bascule
  (`aria-pressed`). En mode `monstres`, un plafond (`maxMonstres`, les places libres) borne la
  sélection. Un deck non importable comme équipe garde ses monstres choisissables un à un.

Le pied de la fenêtre résume la sélection, liste les conflits (ci-dessous) et lit le rapport du
dernier import ; ses actions viennent du point d'entrée.

## Conflits

Les decks du jeu ne sont pas liés entre eux : au temple du chaos, le joueur en choisit trois, et
le combat ne se lance pas si deux decks partagent un monstre, une rune ou un artéfact. Quand
plusieurs équipes sont cochées, la fenêtre calcule leurs conflits (`conflitsSelection`, par
`conflitsGroupe` de Mes équipes) et les liste avant l'import : rien ne bloque, l'utilisateur
décide.

## Ce que produit un import

- **Mes équipes** : une équipe par équipe cochée (« Importer » ou « Importer séparément »), ou,
  avec « Importer en groupe », ces équipes réunies dans un groupe nouveau (nom libre suivant de
  l'onglet). Le groupe exige au moins deux équipes d'une même catégorie hors RTA
  (`categorieDuGroupe`) ; sinon l'action est désactivée et le dit. Les monstres choisis
  s'ajoutent à l'équipe ouverte, dans la limite de ses places.
- **Optimizer** : un producteur unique (`producteurChoix`). Une seule équipe qui a son propre
  producteur le garde tel quel ; plusieurs équipes fusionnent leurs propositions (membres et
  builds dédoublonnés par sélecteur) ; des monstres forment une proposition sans équipe. La liste
  prend le nom du bloc quand la sélection est exactement un bloc entier, sinon celui de la
  première équipe ou du premier monstre, suivi de « +N ».

Les producteurs ne tournent qu'au geste d'import, jamais à l'ouverture.

## Format

- **Ordinateur** : modale de 720 px au plus ; sources, contenu et recherche en tête, liste
  défilante, pied fixe.
- **Téléphone** : la même modale, au format téléphone de la librairie ; sources et sous-catégories défilent de
  côté, la raison passe sous le libellé pour ne pas le tronquer, les actions s'empilent.

Le banc d'affichage mesure la fenêtre ouverte depuis Mes équipes (`compte-equipes`, états
`imports`, `import-groupe`, `import-monstres`) et depuis l'Optimizer (`optimizer`, état `import`).
