# Mon compte — Objectifs (`#/compte/runes/objectifs`, `#/compte/artefacts/objectifs`)

Où en est le compte face à ce que le joueur vise : combien de runes de qualité
par set et par emplacement, combien de runes rapides, combien d'artéfacts qui
portent les bonnes secondaires. Les objectifs se règlent dans **Paramètres ›
Objectifs** (`#/parametres/objectifs`), s'exportent et s'importent en fichier.

Fichiers : calcul pur [objectifsCompte.ts](src/lib/objectifsCompte.ts) ·
réglage [useObjectifsCompte.ts](src/hooks/useObjectifsCompte.ts) · vues
[VueObjectifs.tsx](src/components/account/VueObjectifs.tsx) · éditeur
[ReglagesObjectifs.tsx](src/components/ReglagesObjectifs.tsx), rendu par
[SettingsPage.tsx](src/pages/SettingsPage.tsx).

## Les trois blocs

| Bloc | Une fiche | Une colonne | Compte |
| --- | --- | --- | --- |
| **Profondeur par efficience**, un bloc par palier | un set | un emplacement (1 à 6) | les runes du set à cet emplacement dont l'efficience atteint le seuil |
| **Vitesse par emplacement** | un set | un emplacement (1, 3, 4, 5, 6) | les runes dont la vitesse en secondaire (substats, meule et innée comprises) atteint le seuil |
| **Artéfacts**, un bloc par tableau — une sorte (Attribut ou Type) et une principale (PV, ATQ, DEF, ou toutes) | une secondaire et sa valeur minimale | un élément (Attribut) ou un style (Type) | les artéfacts de cette colonne, de la principale du tableau, qui portent la secondaire à la valeur minimale au moins |

- **Tout l'inventaire** compte, runes et artéfacts possédés comme équipés.
- ⚠️ **Le seuil d'une rune est une efficience**, quel que soit le choix
  « Efficience / Score SW » de l'affichage : un même seuil ne vaut pas dans les
  deux mesures.
- **Vitesse sans l'emplacement 2** : il porte la vitesse en principale.
- **« Si max »** (runes, efficience) : le même compte si chaque rune était
  poussée au maximum, selon le **potentiel du palier** (`Palier.potentiel`) :
  meule et gemme au maximum **héroïque** (« Max héro »), ou au maximum
  **légendaire** (« Max lég. »).
  - ⚠️ **Les gemmes comme l'onglet Optimisation quand « regemme différent »
    est éteint** (`gemmeExistanteSeule`) : une gemme déjà posée se relance au
    maximum sur SA stat, une rune sans gemme n'en reçoit pas. Créditer chaque
    rune vierge de la meilleure gemme compterait des runes qu'on n'a pas.
  - Le calcul est `runePotential` (voir
    [feat-calcul-runes.md § 4](feat-calcul-runes.md)), en gardant la meilleure
    valeur entre l'actuelle et ce potentiel : un scénario ne fait jamais
    baisser une rune déjà mieux meulée ou mieux gemmée. Un palier sans
    potentiel est héroïque.
- **« La plus rapide »** (vitesse) : la plus grande vitesse en secondaire de la
  case, seuil ou non.
- **Intangible** : compté à part. Runes : dans chaque case, les Intangibles de
  l'emplacement qui passent le seuil. Artéfacts : par secondaire, les
  Intangibles qui la portent (ils n'ont ni élément ni style, donc pas de
  colonne). ⚠️ Ils n'entrent dans aucun score : une même pièce complète
  n'importe quel set, la compter partout la compterait plusieurs fois.
  L'Intangible ne peut pas être un objectif.

### Les artéfacts : des secondaires, pas l'efficience

⚠️ L'efficience d'un artéfact mesure la qualité de ses rolls face à leur
plafond ([feat-calcul-artefacts.md](feat-calcul-artefacts.md)), pas l'utilité
de ses lignes : un artéfact « efficace » peut ne rien porter d'utile. Les
objectifs comptent donc **les artéfacts qui portent une secondaire donnée à
une valeur donnée au moins** (« dégâts reçus de l'Eau -22 % ou mieux »).

- La valeur minimale s'écrit **sans signe** : la donnée du jeu porte « -22 % »
  comme 22. Elle peut être décimale (dégâts supplémentaires proportionnels,
  par dixièmes).
- La valeur d'un artéfact est **nettoyée** avant comparaison
  (`valeurArtefactPropre`) : le jeu accumule ses rolls en virgule flottante.
- Une sorte ne propose que ses secondaires (`effetsArtefact`) : 300-309 pour
  l'Attribut, 400-411 pour le Type, 200-226 pour les deux.

## Les scores

- **Case** : `min(actuel, visé)`. ⚠️ Plafonnée case par case : un surplus à
  l'emplacement 2 ne comble pas un manque à l'emplacement 4 — ce sont deux
  pièces différentes à aller chercher.
- **Fiche** (un set, une secondaire) : `Σ min(actuel, visé) / Σ visé`.
- **Par emplacement**, **par élément**, **par style** (bandeau) et score du
  bloc : le même rapport des totaux, toutes fiches du bloc confondues — pas la
  moyenne des pourcentages. Un set dont on vise 20 runes pèse plus qu'un set
  dont on en vise 2.
- Rien de visé : pas de score (« — »).

## Ce que montre la vue

- **Le résumé d'abord** : une **carte par bloc** — chaque palier, la vitesse,
  les artéfacts (tous les tableaux ensemble ; Mon compte › Artéfacts ›
  Objectifs en donne une par sorte) — avec son score et une **jauge verticale
  remplie jusqu'au score, à la couleur de son niveau**. Pas de pièces visées
  sur la carte : le score suffit au résumé. La carte est un **raccourci** :
  elle fait défiler jusqu'à la section de son bloc (pas de lien `#…`,
  l'adresse porte la route).
- **Le résumé par set** (runes seulement, sous les cartes) : une petite fiche
  par set, une jauge verticale par palier et une pour la vitesse — le score du
  set dans ce bloc au-dessus, le nom du bloc dessous ; « — » et une jauge vide
  quand le bloc ne vise pas ce set.
- **À la souris, rien ne s'étire sur toute la largeur** : cartes, fiches et
  colonnes gardent leur taille et se rangent à la suite. Au doigt, cartes et
  fiches prennent la largeur de l'écran.
- **Puis une section par bloc, toutes l'une sous l'autre** (chaque palier, la
  vitesse, chaque tableau d'artéfacts — « Attribut · Toutes les principales »,
  « Type · PV »…) : son titre, le seuil quand il est le même partout (runes),
  son score, une légende, la bande **« Par emplacement »** (« Par élément »,
  « Par style » pour les artéfacts), puis une **fiche par set** (ou par
  secondaire) :
  - en tête, le nom — pour un artéfact, le libellé du jeu avec « ≥ » devant sa
    valeur (« Réd. dgts reçus de l'Eau ≥ -22% ») —, la quantité visée et le
    seuil quand ils sont les mêmes pour toutes les colonnes (« 20 par
    emplacement · seuil 100 % », « 2 par élément »), les Intangibles d'une
    ligne d'artéfact, le score sur l'aplat de son niveau ;
  - un **histogramme**, une colonne par emplacement (ou élément, style) : le
    compte au-dessus, la colonne remplie vers l'objectif (pointillés en haut),
    à la couleur de la case ; derrière, en gris, ce que le « si max » du
    palier ajouterait (efficience) ;
  - sous chaque colonne, ses chiffres : le **seuil** (seulement s'il diffère
    d'une colonne à l'autre), le **visé**, le **max** du palier (efficience)
    ou la **plus rapide** (vitesse), et les **Intangibles** de la case (runes),
    hors score. Pas de total de pièces en pied de fiche : le score le dit déjà.
- **Niveaux** (`niveauScore`) : rouge sous 30 %, orange sous 50 %, jaune sous
  70 %, vert clair sous 100 %, vert à 100 % et au-delà — tokens `niveau-0` à
  `niveau-4` ([tokens-couleurs.md](../../03-developpeur/interface/design/tokens-couleurs.md)).
- **Une colonne** (`niveauCase`) : entamée en jaune, atteinte tout juste en
  vert clair, dépassée en vert ; vide, elle reste vide.
- Le chiffre reste écrit partout : la couleur ne porte jamais seule la valeur.
  ⚠️ Un niveau ne s'écrit qu'en aplat ou en barre, jamais en couleur de texte :
  ces pastels sont les mêmes dans les deux thèmes, illisibles sur le fond clair.
- Les fiches se rangent à la suite, chacune à la largeur de ses colonnes
  (2 rem par emplacement, 3,75 rem par élément ou style, qui portent un nom) :
  une par ligne au téléphone, où les colonnes se partagent la largeur.

## Les objectifs par défaut

- Deux paliers : **« Base »** à 100 % et **« Premium »** à 110 %. Quantités
  par emplacement :

  | Palier | Violent | Will | Despair | Shield | Destroy | Nemesis | Seal |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | Base | 20 | 12 | 12 | 12 | 6 | 6 | 2 |
  | Premium | 8 | 6 | 6 | 6 | 3 | 3 | 2 |

  « Si max » : héroïque pour Base, **légendaire pour Premium**.
- Vitesse : 28 (29 en Swift) ; Despair 2, Swift, Violent et Will 3 par
  emplacement.
- Artéfacts d'**attribut** :
  - dégâts infligés à chaque élément **≥ 18 %** : toutes principales 2 par
    élément, PV 1, ATQ 2, DEF 1 ;
  - dégâts reçus de chaque élément **≥ 22 %** : toutes principales, PV et DEF,
    2 par élément, **3 contre l'élément qui bat la colonne** (l'Eau contre un
    artéfact de Feu, le Feu contre le Vent, le Vent contre l'Eau, la Lumière
    contre les Ténèbres et l'inverse).
- Artéfacts de **type**, un tableau par principale (PV, ATQ, DEF) : précision
  des compétences 1 à 3 ≥ 22 %, dégâts CRIT reçus ≥ 14 %, effet aug. VIT
  ≥ 22 %, dégâts CRIT des compétences 1 à 3 ≥ 22 %, soins des compétences 1 à
  3 ≥ 22 % — quantités par style dans `TYPE_DEFAUT` ; puis, sur l'ATQ, effet
  renforcement ATQ ≥ 15 %.
- Un palier sans nom prend le nom de son rang dans la langue affichée
  (« Base », « Premium », « Palier 3 »…) : un nom écrit dans la donnée resterait
  en français pour un joueur anglais.

## Le réglage (Paramètres › Objectifs)

- **Un réglage**, comme les builds les plus rapides : clé
  `swblacksmith-objectifs-compte-v1`, dans `CLES_DE_REGLAGE`
  ([persistance.md](../transverse/feat-import-compte/persistance.md)) — écrit
  même sans l'accord de conservation, épargné par « Tout supprimer », emporté par
  une session.
- Chaque geste s'applique tout de suite. Par set, une grille : une colonne par
  emplacement, une ligne « Seuil » et une ligne « Quantité », et une colonne
  « Tous » qui pose la même valeur partout (vide quand les valeurs diffèrent).
  Au doigt, la grille défile de côté.
- Paliers : nom (trimé à la sortie du champ), « si max » (héroïque ou
  légendaire ; un palier ajouté est héroïque), ajout (cinq au plus, bouton
  désactivé au-delà), retrait. Sets : ajout d'un set absent, retrait.
- Artéfacts, par sorte : des tableaux (douze au plus), chacun sa principale
  (ou toutes) et son retrait ; dans un tableau, une ligne par secondaire — sa
  valeur minimale, la quantité par élément (ou par style), la colonne « Tous »,
  son retrait — et l'ajout d'une secondaire de la sorte (trente au plus). Une
  secondaire peut revenir à deux valeurs dans le même tableau.
- **« Exporter »** : un fichier `"format": "swblacksmith/objectifs-compte"`,
  `version` 1. **« Importer »** : le fichier est validé en entier ; un fichier
  qui n'est pas un fichier d'objectifs, ou mal formé (set inconnu ou en double,
  Intangible, nombre de cases ou de colonnes, valeur hors bornes, quantité non
  entière, potentiel inconnu, principale inconnue, secondaire inconnue ou que
  la sorte ne porte pas), est refusé avec la raison, et rien ne change.
- ⚠️ **« Importer » et « Valeurs par défaut » remplacent tout** : ils
  s'appliquent, puis la notification « Annuler » rend les objectifs d'avant.
  « Valeurs par défaut » est désactivé quand rien ne diffère des défauts.

## Vérifié par

`tests/objectifs-compte.test.ts` (défauts, comptes, plafond, Intangible,
« si max » et gemmes, vitesse, artéfacts par secondaire, lecture du fichier) et
`tests/rendu/objectifs.test.tsx` (les deux vues, les onglets et l'éditeur des
Paramètres).
