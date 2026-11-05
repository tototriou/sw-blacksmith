# Contrainte de speed tune

Un membre exporté depuis le speed tuning ne vise plus une VIT minimum : la
recherche ne retient que les builds dont la vitesse de combat et l'« Effet aug.
VIT » de la paire d'artéfacts gardent l'ordre de tour réglé dans l'outil.

Voir aussi : [../speed-tuning/feat-export-optimizer.md](../speed-tuning/feat-export-optimizer.md),
[../speed-tuning/feat-ordre-des-sorts.md](../speed-tuning/feat-ordre-des-sorts.md),
[feat-import-equipes.md](feat-import-equipes.md),
[ecran/sous-proprietes-verrouillees.md](ecran/sous-proprietes-verrouillees.md).

Fichiers : `src/lib/planSpeedTune.ts` (le plan et sa zone, calcul pur),
[speedTune.ts](src/lib/speedTune.ts) (la simulation, inchangée),
[importSpeedTuneOptimizer.ts](src/lib/importSpeedTuneOptimizer.ts) (le
producteur), [runeBuildOptim.ts](src/lib/runeBuildOptim.ts) et
[artifactOptim.ts](src/lib/artifactOptim.ts) (l'élagage et le choix de la paire).

## Le plan de speed tune

L'export photographie le speed tune entier : c'est le **plan**, posé sur
l'équipe « Ton équipe » de la liste créée. Il contient, pour les deux camps,
chaque ligne telle que la simulation la lit (monstre, VIT de base, vitesse de
runes saisie, Swift, « Effet aug. VIT », amplification de camp, grilles de
barre et de vitesse, sort de chaque tour, cible, remplissage au choix), le lead
de chaque camp et l'**ordre voulu**. Le plateau se reconstruit depuis le plan
par le même producteur pur que l'écran du speed tuning, jamais par une copie
de sa logique.

Le plan est figé : modifier ensuite le speed tuning ne le change pas.
Réexporter crée une nouvelle liste, comme aujourd'hui.

Le speed tune est **tenu** quand `diagnostiquerSequence(plateau, ordreVoulu)`
répond `ok`, c'est-à-dire le verdict que l'écran du speed tuning affiche :
chaque allié de l'ordre joue après son prédécesseur, avant son successeur, et
avant le premier adversaire. Les adversaires gardent leurs valeurs du plan :
ils ne sont pas optimisés.

Le plan vaut pour le siège, l'arène et la guerre de guilde (7 % par tick). La
RTA n'est pas modélisée par le speed tuning
([feat-formule.md](../speed-tuning/feat-formule.md)),
et le plan ne prétend rien pour elle.

## La zone d'un membre

La **zone** d'un allié est l'ensemble des couples (vitesse de combat,
« Effet aug. VIT » cumulé) qui tiennent le speed tune, **les autres monstres
étant fixés**. Elle se calcule par balayage exhaustif, jamais par dichotomie :
l'ordre tenu n'est pas monotone en vitesse, puisqu'un seul monstre agit par
tick et qu'aller plus vite peut voler le tick d'un allié.

- **Axe vitesse** : de la VIT de base du monstre (combat sans rune) au plafond
  de vitesse du speed tuning.
- **Axe artéfact** : de 0 à `ARTE_MAX`, plus l'amplification de camp. Seuls les
  **paliers** comptent : la valeur du buff est un entier tronqué, donc
  plusieurs valeurs d'artéfact donnent le même buff et la même simulation. On
  simule un représentant par palier.
- **Sans buff de vitesse reçu** dans le plan, l'artéfact n'agit jamais : la zone
  ne dépend que de la vitesse, et aucune exigence d'artéfact n'est posée.

La zone se range en **intervalles de vitesse de combat par palier
d'artéfact**. Un palier peut porter plusieurs intervalles, ou aucun.

### Les autres monstres : plan, puis builds validés

Pour la zone d'un membre, chaque autre allié de l'équipe prend :

1. sa vitesse de combat et son artéfact du **build validé** dans la liste,
   s'il en a un ;
2. sinon ses valeurs du **plan**.

La zone se recalcule donc à chaque validation, invalidation ou changement de
build d'un autre membre. C'est voulu : une zone qui tiendrait pour toutes les
combinaisons des autres serait presque toujours vide, parce que deux alliés
voisins ne peuvent pas bouger indépendamment sans risquer d'échanger leur tour.
Construire les membres un par un, en validant chaque build, garantit l'ordre à
la fin : le dernier membre est cherché contre les vrais builds de tous les
autres.

### Écart entre le plan et l'Optimizer

Un allié peut avoir dans l'Optimizer une vitesse différente de celle du plan :
son build validé, ou, sans build validé, l'équipement qu'il porte dans le
compte (sa vitesse de combat actuelle, Swift et lead du plan compris). Un
Chilling réglé à 396 dans le speed tuning peut porter 401 dans le compte.

- L'écart est **toujours affiché**, pour chaque allié concerné, dans l'encart
  de chaque membre de l'équipe et avec le verdict : « Chilling : 396 dans le
  plan, 401 dans l'Optimizer (build validé) » ou « (équipement actuel) ». Même
  chose pour l'« Effet aug. VIT ».
- Un bouton **« Recalculer avec 401 »** réécrit cette valeur dans le plan, en
  un clic : toutes les zones de l'équipe et le verdict se recalculent avec
  elle. Le bouton « Recalculer avec les valeurs de l'Optimizer » fait la même
  chose pour tous les écarts à la fois.
- Un build validé entre de toute façon dans le calcul (section précédente) ;
  le bouton sert alors à aligner le plan sur lui, pour que les valeurs
  retenues restent les mêmes si ce build est invalidé. Un équipement actuel,
  lui, n'entre dans le calcul que par ce bouton : le plan peut viser une autre
  vitesse que celle portée aujourd'hui.
- Réécrire le plan est sans perte au sens de l'app : la valeur remplacée
  reste affichée comme « valeur d'origine du speed tuning » et un bouton la
  restaure.

### Verdict d'équipe

L'équipe affiche un verdict sur l'ordre : **tenu** avec les builds validés,
**cassé** (le premier allié en défaut et sa raison, dans les mots de l'écran du
speed tuning), ou **incomplet** tant qu'un membre n'a pas de build validé
(ses valeurs du plan sont alors utilisées, et le verdict le dit). Un build
validé peut casser l'ordre d'un membre validé avant lui : le verdict le
signale, rien n'est invalidé automatiquement.

## Conversion vers le build

Un build donne une VIT de fiche (base + runes). Sa vitesse de combat est
`combatSpeed(base, fiche − base, lead, swift)`, avec le **lead du plan** pour
le camp allié et `swift` vrai seulement si le build active le set Rapidité.
L'« Effet aug. VIT » d'un build est le cumul du code 206 sur sa paire
d'artéfacts, plus l'amplification de camp du plan.

Un build tient la contrainte quand **une paire d'artéfacts réellement
équipable** donne un cumul dont le palier, à la vitesse de combat du build,
est dans la zone. La paire retenue pour la carte est choisie parmi ces paires
seulement, par le régime habituel de l'objectif.

## Ce que fait la recherche

- **Élagage** : la zone donne une **enveloppe** de VIT de fiche, minimum et
  maximum, élargie aux deux conversions (avec et sans Rapidité), et un
  minimum d'artéfact à la plus haute vitesse de la zone. L'enveloppe ne fait
  qu'élargir : elle n'écarte jamais un build qui tiendrait la zone.
- **Validation finale** : le test exact de la section précédente, sur les
  vraies paires (`artPossibles`), au même endroit que le filtre final des
  conditions. Un build hors zone n'est jamais affiché.
- **Diagnostic « 0 résultat »** : la contrainte de speed tune est une condition
  bloquante comme une autre, nommée comme telle.

La contrainte remplace la VIT minimum et le verrou « Effet aug. VIT » que
l'export posait. Les autres conditions, verrous et sets du membre restent
saisis comme d'habitude et se cumulent avec elle.

## Écran

Dans les conditions du membre, un encart « Speed tune » remplace le champ de VIT
minimum :

- la zone en clair, une ligne par palier utile : « 367–396 avec 35 d'Effet aug.
  VIT », « 374–396 sans artéfact » ;
- l'origine des autres valeurs (plan ou build validé) ;
- un bouton « Détacher le speed tune » qui retire la contrainte du membre et
  repose, dans les critères, la VIT minimum et le verrou que l'export posait.
  Détacher est sans perte : le plan reste sur l'équipe, et « Rattacher » le
  repose.

Le verdict d'équipe s'affiche avec l'équipe. Les deux formats ont le même
contenu ; l'encart suit la grille des conditions de chaque format.

## Persistance

Le plan est un champ facultatif de l'équipe stockée, validé à la lecture comme
ses autres champs : un plan malformé est signalé et écarté, sans rejeter
l'équipe. La contrainte d'un membre (attachée ou détachée) est un critère
personnel. Une équipe sans plan se lit comme aujourd'hui. Une version qui ne
connaît pas le champ l'ignore et peut le perdre en réécrivant le stockage.

## Limites

- Le plan ne suit pas l'équipe adverse réelle : il garde l'adversaire saisi
  dans le speed tuning.
- La zone suppose les sorts, cibles et grilles du plan. Un combat qui s'en
  écarte (un buff raté, un remplissage différent) n'est pas couvert.
- Les membres se cherchent un par un : sans validation d'un membre, les autres
  sont cherchés contre ses valeurs du plan.
