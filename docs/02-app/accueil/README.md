# Accueil (`#/`)

Page d'entrée de SW Blacksmith, en **vitrine** : faire faire le **premier geste**
(importer son compte), **montrer** ce que fait chaque outil phare, ramener
l'habitué là où il s'était arrêté, et mener à la communauté.

Fichiers :
- [HomePage.tsx](src/pages/HomePage.tsx) — la page.
- [ExemplesAccueil.tsx](src/components/accueil/ExemplesAccueil.tsx) — les exemples des outils.
- [demoAccueil.ts](src/lib/demoAccueil.ts) — leurs données de démonstration (calcul pur, testé).

## Contenu, de haut en bas

### 1. Héros — le nom, les actions, la zone de dépôt

- **Logo + nom `SW Blacksmith`** en grand (Saira, capitales espacées,
  `clamp(32px, 5vw, 56px)`), l'**accroche** en sous-titre (« La boîte à outils
  pour Summoners War. »), puis la **promesse** (le lieu du calcul en gras).
  ⚠️ Le nom du site reste le titre : c'est la page d'entrée, on doit savoir
  sur quel site on est (un titre-slogan a été essayé et écarté).
- **Trois actions** : « Importer mon compte » (le bouton plein de la page, il
  ouvre le sélecteur de fichier), « Rejoindre le Discord » (au logo de
  Discord, `LIEN_DISCORD` de `src/marque.ts`, **nouvel onglet**) et
  « Application Windows et Linux » (lien vers [Télécharger](../telecharger/),
  **site seulement** — `estBureau()`).
  ⚠️ **Sur une ligne quand elle les tient, sinon une par ligne — jamais deux
  puis une** (choix du mainteneur) : bascule par la largeur de la colonne
  (requête de conteneur `@[640px]`), pas par `flex-wrap`.
- **La zone de dépôt** (voir 2), puis, **hors de la zone** — qui est un bouton,
  un lien dedans serait un contrôle dans un contrôle —, la ligne « Pas encore
  d'export ? … SW Exporter ↗ » (nouvel onglet) : c'est là que vit désormais le
  « comment obtenir l'export ».
- **Disposition** : deux colonnes (texte, zone de dépôt) seulement quand la
  page a **1 200 px de contenu** ; sinon le texte en pleine largeur et la zone
  dessous, **à l'horizontale** dès 600 px (roue à gauche, textes à droite).
  ⚠️ Requêtes de conteneur sur la page (`@container`), pas sur la fenêtre :
  avec la barre latérale, à 1 366 px, la page n'a que 1 070 px.
- Fond : deux lueurs des jetons (braise, violet du sombre), sur le panneau.

### 2. ⚠️ Zone de dépôt DANS le héros

C'est le geste qui **débloque tout l'outil** : il est la première chose
visible.

- **La roue des runes du jeu** (`public/rune-wheel.png`, rendu du jeu tel
  quel) dans une lueur de braise, les textes (« Dépose ton fichier .json
  ici », « ou clique pour parcourir », « Export SWEX (.json) », « lu dans la
  page, jamais envoyé ») et les **5 éléments qui flottent**.
- **Glisser-déposer ET clic** : on ne sait pas lequel le visiteur tentera.
  Accessible au clavier (`Entrée` / `Espace`).
- Elle appelle le **même `onImport`** que les deux boutons « Importer mon
  compte » et la nav — un seul chemin d'import.

### 3. « Ton espace »

Affiché **dès qu'il y a des données locales** (`HomeStats`, passé par
[App.tsx](src/App.tsx) : mêmes états que les pages outils, **aucun calcul ni
stockage en plus**). Quatre tuiles → prépa RTA, défense, offense,
recommandations.

- ⚠️ **Titre NEUTRE** : le bloc apparaît dès le premier import, pas seulement
  au retour.
- **Le chiffre d'abord** ; le lien mène dans la **sous-section exacte**.
- Une valeur à 0 est **atténuée, pas masquée** — sinon la rangée saute. Une
  **équipe vide** n'est pas comptée.

### 4. « Ce que propose l'outil » — les outils, montrés

Quatre outils phares, chacun en **deux parts côte à côte, en alternance** :
le texte (tuile à la teinte de la section, rubrique, titre, phrase, trois
puces, bouton « Ouvrir… ») et **son exemple** ; l'un sous l'autre au
téléphone. L'exemple prend les **trois cinquièmes** de la largeur (à partir de
900 px de contenu) : ce sont de vrais composants, pensés pour leur page.

⚠️ **Les exemples sont les VRAIS composants des outils** (« des images
réalisables avec l'appli »), sur des équipes de démonstration passées par les
**mêmes calculs** ([demoAccueil.ts](src/lib/demoAccueil.ts)) :

| Outil | Exemple | Démo |
|---|---|---|
| Prépa RTA | `TurnOrder` (ordre de tour, leads) | Lora, Son Zhang Lao, Yeonhong, Woonsa, Han |
| Recommandations | `RecoCard` dépliée, état figé (`recosFigees`) | trois decks choisis par le mainteneur, chacun « fort contre » une défense |
| Optimizer | `GrilleResultats` : #1 et #2 | Woonsa, Violent ×4 + Volonté ×2, puis Rapide ×4 + Volonté ×2 ; stats par `computeStats` |
| Speed tuning | `OrdreDeTour` + `TableauBarres` (vues de l'outil) | trois alliés, trois adversaires, le vrai moteur (`simuler`) |

- ⚠️ **Des nat 5★ lumière et ténèbres** dans les équipes montrées (choix du
  mainteneur), sauf les decks de la recommandation, qu'il a choisis lui-même.
- ⚠️ **Inertes** (`inert`) : on regarde, on ne modifie rien — leurs gestes
  toucheraient sinon aux réglages du joueur.
- ⚠️ **À 80 %** (`zoom`) : un **aperçu** qui donne envie, pas le détail. `zoom`
  et non `transform` : la mise en page suit.
- **Sans les données du jeu** (premier chargement) : aucun exemple, plutôt
  qu'un exemple faux.
- ⚠️ **Aucune superposition** : la carte de recommandation, au téléphone, passe
  son « Fort contre » à la ligne quand la place manque (correctif de
  `RecoCard`, qui vaut aussi pour la page Recommandations).

Puis **les autres outils, en pastilles** (tuile ronde à la teinte, titre), dans
l'ordre de la navigation : Prépa d'un ami, Défenses et offenses, Analyse de
runes, Analyse d'artéfacts, Mes équipes, Bestiaire, Mécaniques, Application de bureau
(**site seulement**), Arène classique · bientôt (atténuée, lien vers le
placeholder).

### 5. « Rejoins la communauté » — compacte

Trois cartes **de même taille** sur une rangée (une colonne au téléphone) :

- **Discord** — teinte de braise, « Les joueurs qui utilisent SW Blacksmith
  sont sur Discord », à quoi sert le serveur, bouton plein « Rejoindre le
  Discord » (nouvel onglet) ;
- **Nouveautés** — la **dernière version PUBLIÉE** (une version en préparation
  est en tête du journal sans être en ligne) et son titre, « Voir les
  nouveautés » → [Nouveautés](../nouveautes/) ;
- **Le code** — open source, lien vers GitHub (nouvel onglet).

⚠️ Compacte, sans grande bande (le mainteneur : « trop grosse comparée au
reste ») : le Discord se distingue par sa teinte, pas par sa taille.

### 6. Dernier appel

« Prêt à préparer tes équipes ? », sa phrase, et « Importer mon compte » : il
**ouvre le sélecteur de fichier** (un lien `#depot` ne ferait rien de visible
avec le routage par hash), même `onImport` que la zone de dépôt.

## Icônes et couleurs

- Les tuiles de **section** (outils, pastilles, « Ton espace ») portent les
  **icônes d'atelier** de la navigation
  ([IconesAtelier.tsx](../src/components/IconesAtelier.tsx)) : une section a la
  même icône partout.
- ⚠️ **L'accueil est coloré, le menu neutre** : chaque tuile est **à la teinte
  de sa section** (icône à la teinte, fond à 14 %, contour à 32 %), avec un
  **halo** flouté derrière chaque exemple.
- ⚠️ **En thème CLAIR, chaque teinte a sa variante assombrie**
  (`TEINTE_CLAIRE`, [couleursSection.ts](../src/data/couleursSection.ts)) : la
  tuile et le halo posent les deux valeurs (`--teinte-sombre`,
  `--teinte-clair`), la règle `.teinte-section` d'index.css choisit selon le
  thème.
- Les titres de section : Cinzel, la fin à l'accent (« Ce que propose
  **l'outil** », « Rejoins **la communauté** »).

## Textes

Tous dans le dictionnaire, sous `accueil` et `accueil.vitrine`
([fr.ts](src/i18n/fr.ts), [en.ts](src/i18n/en.ts)) — le mainteneur les
retouche à la main ; les tests les lisent dans le dictionnaire.

## Règles / attendus

- ⚠️ **L'accueil doit rester le miroir de l'app** : **toute page ou section
  ajoutée / renommée / supprimée se répercute ici** (outil montré ou
  pastille, et tuile de « Ton espace » si la section a un état local), **dans
  le même commit**.
- ⚠️ **Un exemple est un vrai composant** : quand un outil change d'allure,
  l'exemple suit tout seul ; un exemple redessiné à la main finirait par
  mentir.
- Aucune mesure d'audience : pas de chiffres d'usage sur la page.
- Tests : [accueil.test.tsx](tests/rendu/accueil.test.tsx) (contenu, exemples,
  Discord, bureau), [demo-accueil.test.ts](tests/demo-accueil.test.ts) (les
  démos et leur calcul).
