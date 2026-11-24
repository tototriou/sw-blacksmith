# Mon compte — Objectifs (`#/compte/objectifs`)

Où en est le compte face à ce que le joueur vise : combien de runes de qualité
par set et par emplacement, combien de runes rapides, combien d'artéfacts qui
portent les bonnes secondaires. Une **section à part entière** de Mon compte,
entre Artéfacts et Mes équipes : elle mesure les runes ET les artéfacts, elle
n'est la vue d'aucun des deux.

| Vue | Adresse | Contenu |
| --- | --- | --- |
| Résumé (défaut) | `#/compte/objectifs/resume` | une carte par bloc, lien vers la vue qui le détaille ; le résumé par set |
| Runes | `#/compte/objectifs/runes` | les paliers d'efficience et la vitesse |
| Artéfacts | `#/compte/objectifs/artefacts` | l'Attribut et le Type, par famille |
| Réglage | `#/compte/objectifs/reglage` | les objectifs eux-mêmes, leur export et leur import |

- ⚠️ **Rendue par App avant les écrans du compte** (`ObjectifsSection`) : le
  Réglage se fait sans compte importé. Sans compte, les trois autres vues
  invitent à l'importer (« Chargement… » pendant la relecture d'un compte
  conservé).
- « Régler les objectifs », en tête du Résumé, des Runes et des Artéfacts,
  mène au Réglage.
- Navigation : l'icône de nav est une **cible** (`IconeObjectifs`), la couleur
  de section un vert-jaune (`COULEUR_COMPTE_SUB.objectifs`, `#B8D84A` ; en
  clair `#72862E`, 3,28:1 sur `panel2`). Une pastille sur l'accueil.

Fichiers : section [ObjectifsSection.tsx](src/components/account/ObjectifsSection.tsx) ·
calcul pur [objectifsCompte.ts](src/lib/objectifsCompte.ts) · réglage
[useObjectifsCompte.ts](src/hooks/useObjectifsCompte.ts) · vues
[VueObjectifs.tsx](src/components/account/VueObjectifs.tsx) · éditeur
[ReglagesObjectifs.tsx](src/components/ReglagesObjectifs.tsx).

## Les trois blocs

| Bloc | Une fiche | Une colonne | Compte |
| --- | --- | --- | --- |
| **Profondeur par efficience**, un bloc par palier | un set | un emplacement (1 à 6) | les runes du set à cet emplacement dont l'efficience atteint le seuil |
| **Vitesse par emplacement** | un set | un emplacement (1, 3, 4, 5, 6) | les runes dont la vitesse en secondaire (substats, meule et innée comprises) atteint le seuil |
| **Artéfacts**, un bloc par sorte (Attribut ou Type) et par famille de secondaire | une secondaire et sa valeur minimale | un élément (Attribut) ou un style (Type), en trois sous-colonnes : PV, ATQ, DEF | les artéfacts de cet élément (ce style) et de cette principale qui portent la secondaire à la valeur minimale au moins |

- **Tout l'inventaire** compte, runes et artéfacts possédés comme équipés.
- ⚠️ **Le seuil d'une rune est une efficience**, quel que soit le choix
  « Efficience / Score SW » de l'affichage : un même seuil ne vaut pas dans les
  deux mesures.
- **Vitesse sans l'emplacement 2** : il porte la vitesse en principale.
- **« Si max »** (runes, efficience) : le même compte si chaque rune était
  poussée au maximum, selon le **potentiel du palier** (`Palier.potentiel`) :
  chaque ligne meulée au maximum **héroïque** (« Max héro »), ou au maximum
  **légendaire** (« Max lég. »).
  - ⚠️ **La meule seule, les gemmes restent telles quelles** : une gemme
    déjà posée garde sa valeur (sa ligne se meule comme les autres), une rune
    sans gemme n'en reçoit pas. Simuler les gemmes compterait des runes qu'on
    n'a pas.
  - Le calcul est `runePotential` sans gemme (voir
    [feat-calcul-runes.md § 4](feat-calcul-runes.md)), en gardant la meilleure
    valeur entre l'actuelle et ce potentiel : une meule déjà posée n'est
    jamais reprise à la baisse (une meule légendaire face au scénario
    héroïque). Un palier sans potentiel est héroïque.
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
- ⚠️ **Toujours par principale** (PV, ATQ, DEF, l'ordre du jeu) : une pièce
  visée l'est sur SA principale, celle qui décide du monstre qui la portera.
  Pas d'objectif « toutes principales ».
- **Les familles** sont celles du Top 10 par propriété, dans son ordre
  (`familleArtefact`, `ORDRE_FAMILLES` d'[artifactsTop.ts](src/lib/artifactsTop.ts) ;
  [feat-artefacts.md](feat-artefacts.md)) : réduction des dégâts reçus, dégâts
  infligés, dégâts critiques, soins, précision, renforcement, dégâts
  proportionnels, critiques selon la cible, puis « Autres sous-propriétés ».
  Elles se déduisent de la secondaire, elles ne sont pas réglées. Dans une
  famille, les secondaires gardent l'ordre du réglage.

## Les scores

- **Case** (un emplacement ; pour un artéfact, une sous-colonne : un élément
  ET une principale) : `min(actuel, visé)`. ⚠️ Plafonnée case par case : un
  surplus à l'emplacement 2 ne comble pas un manque à l'emplacement 4, un
  surplus d'ATQ ne comble pas un manque de PV — ce sont des pièces
  différentes à aller chercher.
- **Fiche** (un set, une secondaire) : `Σ min(actuel, visé) / Σ visé`.
- **Par emplacement**, **par élément**, **par style** (bandeau ; un élément
  réunit ses trois principales) et score du bloc : le même rapport des totaux,
  toutes fiches du bloc confondues — pas la moyenne des pourcentages. Un set
  dont on vise 20 runes pèse plus qu'un set dont on en vise 2.
- ⚠️ **Au-delà de 100 % seulement quand tout est atteint** (demande de
  Thomas ; `scoreObjectif`) : toutes les cases d'un score atteintes, leur
  surplus (`Σ (actuel − visé)` des cases dépassées) s'ajoute —
  `(Σ visé + surplus) / Σ visé`. Tant qu'une case manque, il ne compte pas :
  sinon une fiche à 105 % pourrait cacher une case vide. Vaut pour tous les
  scores (fiche, bandeau, bloc, cartes, « Où farmer ») et pour le « si max ».
  Les jauges restent pleines à 100 %.
- Rien de visé : pas de score (« — »).

## Ce que montrent les vues

- **Des cartes d'abord** : une **carte par bloc** — chaque palier, la vitesse,
  l'Attribut, le Type, « à monter » — avec son score et une **jauge verticale
  remplie jusqu'au score, à la couleur de son niveau**. Devant son titre,
  l'**icône de son inventaire** (runes pour les paliers, chronomètre pour la
  vitesse, artéfacts, monstres) : « Base » ou « Type » seuls ne disent pas de
  quoi la carte parle. Pas de pièces visées sur la
  carte : le score suffit. Au **Résumé**, toutes les cartes, chacune un
  **lien** vers la vue qui la détaille (Runes ou Artéfacts). Aux **Runes** et
  aux **Artéfacts**, les cartes de la vue, des **raccourcis** qui font
  défiler jusqu'à leur section (pas d'ancre `#…`, l'adresse porte la route).
- **Le résumé par set** (Résumé seulement, sous les cartes) : une petite fiche
  par set, une jauge verticale par palier et une pour la vitesse — le score du
  set dans ce bloc au-dessus, le nom du bloc dessous ; « — » et une jauge vide
  quand le bloc ne vise pas ce set.
- **À la souris, rien ne s'étire sur toute la largeur** : cartes, fiches et
  colonnes gardent leur taille et se rangent à la suite. Au doigt, cartes et
  fiches prennent la largeur de l'écran.
- **Puis, aux Runes et aux Artéfacts, une section par bloc, toutes l'une sous
  l'autre** (chaque palier et la vitesse ; chaque famille d'artéfacts — « Attribut · Réduction des dégâts
  reçus », « Type · Augmentation des soins »…) : son titre, le seuil quand il
  est le même partout (runes), son score, une légende, la bande **« Par
  emplacement »** (« Par élément », « Par style » pour les artéfacts), puis
  une **fiche par set** (ou par secondaire). Une sorte d'artéfact sans aucun
  objectif garde une section, qui le dit : sa carte y mène toujours.
  - en tête, le nom — pour un artéfact, le libellé du jeu avec « ≥ » devant sa
    valeur (« Réd. dgts reçus de l'Eau ≥ -22% ») —, la quantité visée et le
    seuil quand ils sont les mêmes pour toutes les colonnes (« 20 par
    emplacement · seuil 100 % », « 2 par élément et principale »), les
    Intangibles d'une ligne d'artéfact, le score sur l'aplat de son niveau ;
  - un **histogramme**, une colonne par emplacement : le compte au-dessus, la
    colonne remplie vers l'objectif (pointillés en haut), à la couleur de la
    case ; derrière, en gris, ce que le « si max » du palier ajouterait
    (efficience) ;
  - **artéfacts** : une colonne par élément (ou style), **en trois
    sous-colonnes, PV · ATQ · DEF**, chacune avec son compte et sa barre, et
    dessous **l'icône de sa principale** — celles du Top 10, en couleur (cœur
    rouge, épées à l'encre, bouclier bleu ; `ICONE_PRINCIPALE`,
    [IconePrincipale.tsx](src/components/IconePrincipale.tsx)), nommée au
    survol. Les sous-colonnes d'un élément se serrent, les éléments s'écartent :
    c'est l'écart qui dit ce qui va ensemble. Le nom de l'élément vient sous
    ses trois icônes. Une sous-colonne sans objectif reste affichée, vide ;
  - sous chaque colonne (sous-colonne), ses chiffres : le **seuil** (runes,
    seulement s'il diffère d'une colonne à l'autre), le **visé**, le **max** du
    palier (efficience) ou la **plus rapide** (vitesse), et les
    **Intangibles** de la case (runes), hors score. Pas de total de pièces en
    pied de fiche : le score le dit déjà.
- **Niveaux** (`niveauScore`) : rouge sous 30 %, orange sous 50 %, jaune sous
  70 %, vert clair sous 100 %, vert à 100 % et au-delà — tokens `niveau-0` à
  `niveau-4` ([tokens-couleurs.md](../../03-developpeur/interface/design/tokens-couleurs.md)).
- **Une colonne** (`niveauCase`) : entamée en jaune, atteinte tout juste en
  vert clair, dépassée en vert ; vide, elle reste vide.
- Le chiffre reste écrit partout : la couleur ne porte jamais seule la valeur.
  ⚠️ Un niveau ne s'écrit qu'en aplat ou en barre, jamais en couleur de texte :
  ces pastels sont les mêmes dans les deux thèmes, illisibles sur le fond clair.
- Les fiches se rangent à la suite, chacune à la largeur de ses colonnes
  (2 rem par emplacement, 4 rem par élément ou style, qui portent un nom et
  trois sous-colonnes) : une par ligne au téléphone, où les colonnes se
  partagent la largeur.

## Où farmer (Résumé)

Sous les cartes du Résumé, **une carte par lieu visé, le moins avancé
d'abord** : chaque donjon de Cairos, et un **Raid des mondes par palier**
pour les meules — calcul pur [farmObjectifs.ts](src/lib/farmObjectifs.ts)
(`recosFarm`, lieux `LieuFarm`). Chaque carte est faite comme celles des
blocs : son rang et le nom du lieu (« #1 Raid des mondes · Premium » pour un
raid), le pourcentage, et la jauge verticale à la couleur du niveau de son
score — pas de bandeau. Un état, pas un raccourci : les cartes ne se cliquent
pas et n'ont pas de détail (retirés à la demande de Thomas : ils ne servaient
à rien).

- **Le score d'un lieu** : la part acquise des pièces qu'il vise,
  `(visé − manque) / visé`, sous 100 % tant qu'il manque quelque chose.
- Au-delà de 100 % quand tout est atteint, comme tous les scores (§ Les
  scores). Le raid s'arrête à 100 % — il vise ce que la meule peut atteindre,
  rien au-delà.
- ⚠️ **Le classement suit ce score, pas le nombre de pièces** : les artéfacts
  visent bien plus de pièces que les runes (≈ 200 contre ≈ 25 avec les
  défauts), en pièces ils passeraient toujours devant. Ex æquo : le plus gros
  manque d'abord, puis l'ordre de Cairos, puis les raids par palier.
- Un lieu fini reste, à 100 %. Un lieu sans rien de visé n'apparaît pas ;
  rien de visé du tout : « Aucun set ni artéfact visé : rien à farmer. »
- ⚠️ **La Forteresse d'Acier et la Crypte du Jugement valent exactement les
  cartes Attribut et Type** : mêmes cases, même plafond par case, même rapport
  des totaux, même surplus — un écart est un bogue.

- **Le manque d'une case** : `visé − actuel`, plafonné à zéro — le surplus d'une
  case ne comble pas une autre, comme pour les scores.
- ⚠️ **Ce que la meule comble se farme au Raid des mondes, pas au donjon** —
  le raid donne les meules (relevé de Thomas). En efficience, les pièces que
  le « si max » du palier fait passer existent déjà : elles comptent comme
  acquises pour le donjon, et manquent au raid du palier. Le raid vise les
  pièces que la meule peut atteindre, `min(visé, max(actuel, si max))`, et en
  a déjà `min(visé, actuel)`.
- **Un raid par palier** : chaque palier a son « si max » (meule héroïque ou
  légendaire). Un palier où la meule ne fait rien passer n'a pas de carte. La
  vitesse n'a pas de « si max » : pas de raid, tout son manque se farme au
  donjon.
- **Tous les paliers comptent pareil** au donjon, et la vitesse avec eux : leurs
  manques s'additionnent — une même rune peut manquer à deux paliers.
- Les artéfacts : le manque de toutes les sous-colonnes d'une sorte, rattaché à
  son donjon.
- Les noms des donjons et du raid sont ceux du jeu, déjà dans le dictionnaire
  (`equipes.decks.sousContenus`, `equipes.decks.contenus['raid-mondes']`).

### Les drops de Cairos (`RUNES_PAR_DONJON`, `ARTEFACTS_PAR_DONJON`)

| Donjon | Sets de runes | Artéfacts |
| --- | --- | --- |
| Castel du Géant | Désespoir, Énergie, Fatale, Lame, Rapide | — |
| Tanière du dragon | Violente, Vengeance, Endurance, Focus, Protection, Gardien | — |
| Nécropolis | Rage, Vampire, Némésis, Volonté, Destruction | — |
| Royaume spirituel | Sceau, Combat, Détermination, Amélioration, Précision, Tolérance | — |
| Forteresse d'Acier | — | d'attribut |
| Crypte du Jugement | — | de type |

- ⚠️ **Une mécanique du jeu, relevée en ligne** et recoupée : le wiki Fandom
  (« Cairos Dungeon »), Spokland (où obtenir chaque set), les guides Theria
  Games (Cairos, Royaume spirituel), les notes de mise à jour v8.1.5 et v8.1.9
  de Com2uS pour les artéfacts. Un set ne tombe que dans **un** donjon de
  Cairos (vérifié par test).
- Les sets du scénario, de la boutique, du boss mondial ou de la fabrication ne
  sont pas des recommandations de farm. L'Intangible (Abysses) n'est jamais un
  objectif.

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
- Artéfacts d'**attribut**, par élément :
  - dégâts reçus de chaque élément **≥ 22 %** : PV et DEF 2, **3 contre
    l'élément qui bat la colonne** (l'Eau contre un artéfact de Feu, le Feu
    contre le Vent, le Vent contre l'Eau, la Lumière contre les Ténèbres et
    l'inverse), ATQ 0 ;
  - dégâts infligés à chaque élément **≥ 18 %** : PV 1, ATQ 2, DEF 1.
- Artéfacts de **type** : dégâts CRIT des compétences 1 à 3 ≥ 22 %, soins des
  compétences 1 à 3 ≥ 22 %, précision des compétences 1 à 3 ≥ 22 %, effet
  renforcement ATQ ≥ 15 % (sur l'ATQ seulement), dégâts CRIT reçus ≥ 14 %,
  effet aug. VIT ≥ 22 % — quantités par style et par principale dans
  `TYPE_DEFAUT`.
- Un palier sans nom prend le nom de son rang dans la langue affichée
  (« Base », « Premium », « Palier 3 »…) : un nom écrit dans la donnée resterait
  en français pour un joueur anglais.

## Le réglage (Objectifs › Réglage)

- **Un réglage**, comme les builds les plus rapides : clé
  `swblacksmith-objectifs-compte-v1`, dans `CLES_DE_REGLAGE`
  ([persistance.md](../transverse/feat-import-compte/persistance.md)) — écrit
  même sans l'accord de conservation, épargné par « Tout supprimer », emporté par
  une session.
- **Une sous-section par onglet** (`Onglets`) : Profondeur par efficience,
  Vitesse par emplacement, Artéfacts, Monstres ; la première est ouverte à
  l'arrivée, et seul le bloc de l'onglet ouvert est rendu. L'onglet nomme le
  bloc, qui ne répète pas de titre. « Exporter », « Importer » et « Valeurs par
  défaut » restent au-dessus des onglets : ils choisissent leurs sous-sections
  dans une fenêtre (plus bas).
- Chaque geste s'applique tout de suite. Par set, une grille : une colonne par
  emplacement, une ligne « Seuil » et une ligne « Quantité », et une colonne
  « Tous » qui pose la même valeur partout (vide quand les valeurs diffèrent).
  Au doigt, la grille défile de côté.
- Paliers : nom (trimé à la sortie du champ), « si max » (héroïque ou
  légendaire ; un palier ajouté est héroïque), ajout (cinq au plus, bouton
  désactivé au-delà), retrait. Sets : ajout d'un set absent, retrait.
- Artéfacts, par sorte : les secondaires rangées par famille, comme la vue.
  Pour chacune, sa valeur minimale, son retrait, et une grille — une colonne
  par élément (ou par style), **une rangée par principale** avec son icône
  (PV, ATQ, DEF), et une colonne « Tous » par rangée. Puis l'ajout d'une
  secondaire de la sorte (quarante au plus par sorte). Une secondaire peut
  revenir à deux valeurs.
- La donnée : `quantites[colonne][principale]`, les principales dans l'ordre de
  `PRINCIPALES_ARTEFACT` (PV, ATQ, DEF).
- Monstres, par liste (à monter, à garder, à sniper en event) : un sélecteur
  de monstre, puis une rangée par monstre — portrait, nom, exemplaires 6★ visés
  pour « à monter », retrait. ⚠️ **Une collaboration et sa version SW sont UN
  monstre**, comme partout dans l'app (`idCanoniqueCollab`) : le sélecteur
  trouve les deux faces (« Angela » comme « Pure Vanilla Cookie »), la liste
  inscrit l'identifiant commun de la paire, la rangée montre le portrait
  partagé et les deux noms, et une face inscrite écarte l'autre du sélecteur.
  La mesure compte les deux faces dans la box, et une liste qui porterait les
  deux n'en fait qu'une ligne.
- **Le choix des sous-sections** : « Exporter », « Importer » et « Valeurs par
  défaut » ouvrent une fenêtre à cases, une par sous-section. Une sous-section
  indisponible reste affichée, désactivée, avec sa raison ; l'action attend au
  moins une case cochée.
  - **« Exporter »** : les quatre cochées d'office. Le fichier,
    `"format": "swblacksmith/objectifs-compte"`, `version` 1, ne porte que les
    sous-sections cochées (`paliers`, `vitesse`, `artefacts`, `monstres`).
  - **« Importer »** : le fichier est lu AVANT la fenêtre, et validé en entier ;
    un fichier qui n'est pas un fichier d'objectifs, qui n'en porte aucune
    sous-section, ou dont une sous-section est mal formée (set inconnu ou en
    double, Intangible, nombre de cases, de colonnes ou de principales, valeur
    hors bornes, quantité non entière, potentiel inconnu, secondaire inconnue
    ou que la sorte ne porte pas, liste de monstres illisible), est refusé avec
    la raison, sans fenêtre, et rien ne change. Sinon, la fenêtre coche les
    sous-sections du fichier ; les autres sont « absente du fichier ».
  - **« Valeurs par défaut »** : la fenêtre coche les sous-sections qui en
    diffèrent ; les autres sont « déjà aux valeurs par défaut ». Le bouton est
    désactivé quand rien ne diffère des défauts.
- ⚠️ **Seules les sous-sections cochées sont remplacées** ; les autres ne
  changent pas. Puis la notification « Annuler » rend les objectifs d'avant.

## Vérifié par

`tests/objectifs-compte.test.ts` (défauts, comptes, plafond, Intangible,
« si max » à la meule seule, vitesse, artéfacts par secondaire, principale et
famille, lecture du fichier ; export, import et valeurs par défaut par
sous-section ; une collaboration comptée comme un seul monstre),
`tests/rendu/objectifs.test.tsx` (les quatre vues de la section, les liens des
cartes, les sous-colonnes et leurs icônes, le Réglage sans compte, ses onglets
et le bloc de chacun, la fenêtre des sous-sections pour chaque geste, les deux
noms d'une collaboration), `tests/rendu/app.test.tsx` (chaque vue dans l'App,
son titre, son lien dans la barre) et `tests/navigation-adresses.test.ts` (les
adresses, la vue inconnue).
