# Contrainte de speed tune

Un membre exporté depuis le speed tuning ne vise plus une VIT minimum : la
recherche ne retient que les builds dont la vitesse et l'« Effet aug. VIT » de
la paire d'artéfacts gardent l'ordre de tour réglé dans l'outil.

Voir aussi : [../speed-tuning/feat-export-optimizer.md](../speed-tuning/feat-export-optimizer.md),
[../speed-tuning/feat-ordre-des-sorts.md](../speed-tuning/feat-ordre-des-sorts.md),
[feat-import-equipes.md](feat-import-equipes.md),
[ecran/sous-proprietes-verrouillees.md](ecran/sous-proprietes-verrouillees.md).

Fichiers : `src/lib/planSpeedTune.ts` (le plan, son plateau, sa zone et son
verdict, calcul pur), [speedTuneAuto.ts](src/lib/speedTuneAuto.ts) (le
producteur du plateau, partagé avec l'outil),
[speedTune.ts](src/lib/speedTune.ts) (la simulation, inchangée),
[importSpeedTuneOptimizer.ts](src/lib/importSpeedTuneOptimizer.ts) (l'export),
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts) et
[artifactOptim.ts](src/lib/artifactOptim.ts) (l'élagage et le choix de la
paire).

## Le plan de speed tune

### Ce qui est photographié

L'export photographie le speed tune : c'est le **plan**, posé sur l'équipe
« Ton équipe » de la liste créée. Il contient :

- pour chaque ligne des deux camps, masquées comprises : le monstre, la vitesse
  de runes saisie, Swift, les sets connus, « Effet aug. VIT », les cumuls de
  passif saisis, le lead propre à la ligne, les cases **saisies** des deux
  grilles ;
- les choix de l'ordre des sorts : sort de chaque tour (occurrences `id#2`
  comprises), second sort d'un tour rendu, cible, remplissage au choix ;
- le lead de chaque camp, avec sa portée et son élément ;
- l'**ordre voulu** ;
- l'adversaire de référence, s'il y en a un, **à sa vitesse de combat du
  moment** : c'est un repère figé, il ne suit plus l'allié qu'il copiait.

Une case de grille d'un allié est **saisie** quand elle diffère de ce que
l'analyse automatique y écrit avec les vitesses du plan : l'export rejoue
l'analyse sur les valeurs du plan et ne garde que la différence. Les effets
des sorts ne sont donc jamais figés à un tick : ils se reposent là où le
lanceur joue, à chaque vitesse essayée.

Le plan est figé : modifier ensuite le speed tuning ne le change pas.
Réexporter crée une nouvelle liste, comme aujourd'hui. Les kits (sorts,
rechargements, passifs) se relisent dans les données de l'app, comme dans
l'outil.

### Le plateau

Le **plateau** d'un plan est la liste de `TuneMonstre` que la simulation
reçoit. Il se construit depuis le plan par le producteur de
`analyseAutomatique` (vitesse de combat avec lead, Swift et gain de passif,
amplification de camp, sorts du kit ou choisis, cases saisies), extrait en
fonction pure partagée par l'outil et l'Optimizer. Le plateau n'a aucune
autre construction.

### Ce que « tenu » veut dire

Le speed tune est **tenu** quand :

1. chaque allié exporté figure au moins une fois dans l'ordre voulu ;
2. `diagnostiquerSequence(plateau, ordreVoulu)` répond `ok` : chaque
   occurrence joue après sa précédente, avant sa suivante, et avant le premier
   adversaire ;
3. les occurrences d'un même monstre gardent dans `Simulation.actions` l'ordre
   de leurs rangs (`id`, puis `id#2`…), y compris au même tick.

Les adversaires gardent leurs valeurs du plan : ils ne sont pas optimisés.

L'export refuse le plan, avec la raison dans le rapport, quand l'ordre voulu
est vide, qu'il omet un allié exporté, ou qu'il range une occurrence avant une
occurrence de rang inférieur du même monstre. La liste est alors créée comme
sans plan (VIT minimum et verrou, voir
[l'export](../speed-tuning/feat-export-optimizer.md)).

### Portée

Le plan vaut pour les contenus à 7 % par tick, ceux que le speed tuning
modélise : siège, arène, guerre de guilde. La RTA n'est pas modélisée
([feat-formule.md](../speed-tuning/feat-formule.md)) et le plan ne prétend
rien pour elle.

## Membres et lignes

Le plan garde la correspondance entre ses lignes et les membres de l'équipe,
par l'**identité indépendante** des membres
([feat-listes-equipes-et-sauvegarde.md](feat-listes-equipes-et-sauvegarde.md)),
jamais par le sélecteur : un rattachement au réimport ne la casse pas.

- Une ligne alliée **avec membre** est un membre contraint.
- Une ligne alliée **sans membre** (ignorée à l'export, membre retiré ensuite)
  reste dans le plateau à ses valeurs du plan, comme un allié figé. L'encart la
  nomme.
- Un membre ajouté ensuite à l'équipe n'a pas de ligne : il n'est pas contraint
  et ne compte pas dans le plateau.
- Les occurrences `id#2` d'une ligne appartiennent au même membre : une seule
  vitesse, un seul artéfact.
- Deux copies d'une espèce sont deux lignes et deux membres.

Une équipe demande au moins deux membres : un export qui ne garde qu'un seul
allié importable ne pose pas de plan, et le rapport le dit.

## La zone d'un membre

### Axes

La **zone** d'un membre est l'ensemble des couples (VIT de fiche, « Effet aug.
VIT » de la paire) qui tiennent le speed tune, les autres monstres étant fixés.
Elle se calcule **sur l'entrée du producteur**, pas sur la vitesse de combat :
le candidat remplace dans le plan la vitesse de runes de sa ligne
(`fiche − base`), ses sets connus et son artéfact, et le plateau est reconstruit.
Lead, Swift, gain de passif et vitesse de départage en découlent par le même
chemin que dans l'outil.

- **Axe vitesse** : de la VIT de base à la VIT de fiche la plus haute que les
  runes du pool peuvent donner (somme, par emplacement, de la meilleure
  contribution de VIT possible), bornée par le plafond du speed tuning.
- **Axe artéfact** : le cumul 206 de la paire, de 0 au plafond de paire
  (`ARTE_MAX`) ; l'amplification de camp s'ajoute une seule fois, par le
  producteur.
- **Sets** : une zone par combinaison des sets que le producteur lit (Rapidité,
  Volonté) que la recherche du membre peut produire. Un set imposé ou exclu par
  le combo recherché ne se calcule pas.

Le balayage est **exhaustif**, jamais une dichotomie : l'ordre tenu n'est pas
monotone en vitesse, puisqu'un seul monstre agit par tick et qu'aller plus vite
peut voler le tick d'un allié.

### Paliers d'artéfact

Deux valeurs d'artéfact sont équivalentes quand elles donnent, pour **chaque**
valeur de buff que le plan peut poser (sorts de tous les alliés, cases saisies),
la même valeur tronquée, calculée en entiers comme dans le moteur. On simule un
représentant par classe. Sans aucune source de buff de vitesse positive dans le
plan, l'axe artéfact disparaît ; la présence d'un buff dans la seule simulation
du plan ne suffit pas à conclure, parce qu'une cible « barre la plus basse »
peut changer avec la vitesse.

### Forme

La zone se range, par combinaison de sets, en **intervalles de VIT de fiche
par classe d'artéfact**. Une classe peut porter plusieurs intervalles, ou
aucun.

### Les autres monstres

Pour la zone d'un membre, chaque autre ligne alliée prend :

1. les valeurs du **build validé** de son membre, s'il est exploitable :
   toutes ses runes et ses artéfacts encore présents dans le compte ;
2. sinon ses valeurs du **plan**.

Un build validé non exploitable (rune ou artéfact disparu) est signalé, et sa
ligne reprend les valeurs du plan.

Une zone qui tiendrait pour toutes les combinaisons des autres serait presque
toujours vide : deux alliés voisins ne peuvent pas bouger indépendamment sans
risquer d'échanger leur tour. Les membres se construisent donc un par un : le
dernier cherché l'est contre les vrais builds de tous les autres.

### Calcul et cache

La zone se calcule hors du fil de l'interface, une fois par contexte : le plan,
les valeurs retenues des autres lignes, le pool de runes du membre et ses sets
recherchés. Elle se garde en cache sous l'empreinte de ce contexte et se
recalcule quand il change (validation, invalidation ou changement de build d'un
autre membre, recalcul du plan, réimport, reprise d'un point de sauvegarde). Un
calcul en cours est abandonné quand son contexte change. La recherche n'en
relance aucun, ni par candidat de runes, ni par paire.

## Écart entre le plan et l'Optimizer

Une ligne peut avoir dans l'Optimizer d'autres valeurs que dans le plan : le
build validé de son membre, ou, sans build validé, l'équipement que le monstre
porte dans le compte. Un Chilling réglé à 396 de vitesse de combat dans le
speed tuning peut porter 401.

- L'écart est **toujours affiché**, pour chaque ligne concernée, dans l'encart
  de chaque membre et avec le verdict : « Chilling : 396 dans le plan, 401 dans
  l'Optimizer (build validé) » ou « (équipement actuel) ». Même chose pour
  l'« Effet aug. VIT » et pour le lead, quand le lead effectif du membre dans
  l'Optimizer n'est pas celui du plan.
- **« Recalculer avec 401 »** écrit dans le plan, en un clic, les **entrées**
  de la ligne : vitesse de runes (`fiche − base`), sets, cumul 206 de la paire
  sans l'amplification de camp. Jamais la vitesse de combat affichée : c'est le
  producteur qui la redonne. Après le clic, le plateau reconstruit donne
  exactement la valeur affichée. Toutes les zones de l'équipe et le verdict se
  recalculent. « Recalculer avec les valeurs de l'Optimizer » fait la même
  chose pour tous les écarts à la fois.
- Un build validé exploitable entre de toute façon dans les zones (section
  précédente) ; le bouton aligne alors le plan sur lui, pour que les valeurs
  retenues restent les mêmes si ce build est invalidé. Un équipement actuel
  n'entre dans le calcul que par ce bouton : le plan peut viser une autre
  vitesse que celle portée aujourd'hui.
- La valeur remplacée reste affichée comme « valeur d'origine du speed
  tuning », et « Restaurer » rend exactement les entrées d'origine.

Le lead du plan reste celui du calcul : le speed tune a été réglé avec lui.
Son écart avec l'Optimizer est affiché, sans bouton.

## Conversion vers le build

Un build de runes donne une VIT de fiche et des sets ; une paire donne un cumul
206. Le build **tient la contrainte** quand une paire d'artéfacts réellement
équipable donne un cumul dont la classe, pour la VIT de fiche et les sets du
build, est dans la zone, et que **cette même paire** tient aussi les autres
conditions et verrous du membre. La paire de la carte se choisit parmi ces
paires seulement, par le régime habituel de l'objectif. Le build de runes reste
fixe pendant ce choix.

## Ce que fait la recherche

- **Élagage des runes** : la zone donne une enveloppe de VIT de fiche, minimum
  et maximum sur toutes ses classes et toutes ses combinaisons de sets.
  L'enveloppe ne fait qu'élargir : elle n'écarte jamais un build qui tiendrait
  la zone. Aucun seuil d'artéfact ne sert à élaguer les runes.
- **Réduction des artéfacts** : la contrainte suit le 206 comme une stat sous
  minimum **et** maximum — la pertinence, la dominance et les apports
  atteignables gardent toutes les valeurs distinctes du 206, puisqu'un 206 plus
  fort peut faire jouer trop tôt. Les réductions qui ne voient pas la
  contrainte ne s'appliquent pas au 206 d'un membre contraint.
- **Validation finale** : le test exact de la section précédente, sur les
  vraies paires, au même endroit que le filtre final des conditions. Un build
  hors zone n'est jamais affiché.
- **Contexte photographié** : l'empreinte de la zone entre dans le contexte
  photographié au lancement et dans la signature de résolution. Quand la zone
  change après le lancement, les résultats restent ceux de leur contexte, et
  l'écran le dit (« la zone a changé depuis la recherche »).
- **Valider un build** le rejuge contre la zone **actuelle**. Hors zone, une
  confirmation l'annonce (« ce build casse l'ordre avec les builds actuels ») ;
  son défaut est d'annuler.
- **Diagnostic « 0 résultat »** : la contrainte de speed tune est une condition
  bloquante comme une autre, nommée comme telle.

## Verdict d'équipe

L'équipe affiche un verdict sur l'ordre :

- **tenu** : chaque ligne avec membre a un build validé exploitable et le
  plateau tient ;
- **cassé** : le premier allié en défaut et sa raison, dans les mots de l'écran
  du speed tuning ;
- **incomplet** : une ligne avec membre n'a pas de build validé exploitable ;
  ses valeurs du plan sont utilisées et le verdict le dit.

Un build validé peut casser l'ordre d'un membre validé avant lui (plan
recalculé, résultat ancien, membre détaché) : le verdict le signale, rien n'est
invalidé automatiquement.

## Écran

Dans les conditions du membre, un encart « Speed tune » remplace le champ de VIT
minimum et le verrou « Effet aug. VIT » :

- la zone en clair, une ligne par classe utile : « VIT 225–244 avec 35 d'Effet
  aug. VIT », « VIT 232–244 sans artéfact » ;
- les autres lignes, leur origine (plan, build validé, figé faute de membre) et
  les écarts de la section dédiée, avec leurs boutons ;
- un bouton « Détacher le speed tune ».

Le verdict d'équipe s'affiche avec l'équipe. Les deux formats ont le même
contenu ; l'encart suit la grille des conditions de chaque format.

### Détacher et rattacher

Le rattachement possède deux champs des critères du membre : la VIT minimum et
le verrou 206. Tant qu'il est attaché, ils ne s'affichent pas et ne se
saisissent pas. Détacher pose la VIT minimum de fiche de sa ligne dans le plan
(recalculs compris) et le verrou 206 de cette ligne s'il est positif, à la
place de ces deux champs seulement ; les autres critères ne bougent pas.
« Rattacher » repose la contrainte et masque de nouveau les deux champs. Le
plan reste sur l'équipe dans les deux cas.

## Persistance

Le plan est un champ facultatif de l'équipe stockée, validé à la lecture comme
ses autres champs ; l'état attaché ou détaché est un critère personnel du
membre. Une équipe sans plan se lit comme aujourd'hui.

Un plan malformé est signalé et écarté, sans rejeter l'équipe. Un membre
encore attaché à un plan absent ne devient pas une recherche libre : la
recherche refuse de partir, l'encart dit « plan de speed tune perdu » et ne
propose que « Détacher ». Une version qui ne connaît pas le champ l'ignore et
peut le perdre en réécrivant le stockage.

## Limites

- Le plan garde l'adversaire saisi dans le speed tuning, pas l'équipe adverse
  réelle.
- La zone suppose les sorts, cibles et cases du plan. Un combat qui s'en écarte
  (un buff raté, un remplissage différent) n'est pas couvert.
- Les membres se cherchent un par un : un membre sans build validé compte pour
  ses valeurs du plan.
