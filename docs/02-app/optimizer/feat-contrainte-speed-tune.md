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
[speedTuneLignes.ts](src/lib/speedTuneLignes.ts) (la provenance des cases),
[speedTune.ts](src/lib/speedTune.ts) (la simulation, inchangée),
[importSpeedTuneOptimizer.ts](src/lib/importSpeedTuneOptimizer.ts) (l'export),
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts) et
[artifactOptim.ts](src/lib/artifactOptim.ts) (l'élagage et le choix de la
paire).

## Le plan de speed tune

### Ce qui est photographié

L'export photographie le speed tune : c'est le **plan**, posé sur l'équipe
« Ton équipe » de la liste créée. Il contient :

- pour chaque ligne **visible** des deux camps : le monstre, la vitesse de
  runes saisie, Swift, les sets connus, « Effet aug. VIT », le passif actif ou
  non, le nombre de cumuls de passif tel que l'écran le compte
  (`cumulsPassif ?? 0`), le lead propre à la ligne, les cases **saisies** des
  deux grilles ;
- les choix **écrits** de l'ordre des sorts : sort de chaque tour (occurrences
  `id#2` comprises), second sort d'un tour rendu, cible, remplissage au choix ;
- le lead de chaque camp, avec sa portée et son élément ;
- l'**ordre voulu**.

Une ligne masquée ne participe pas au calcul de l'outil : elle n'entre pas dans
le plan. Son membre est créé dans la liste comme aujourd'hui, sans contrainte.

L'adversaire de référence est une ligne du camp d'en face : il entre dans le
plan comme un adversaire ordinaire, à ses valeurs du moment. Il ne suit plus
l'allié qu'il copiait.

### Provenance des cases

L'analyse écrit dans les grilles ce que les sorts posent, aux vitesses du
moment. Ces cases ne valent qu'à ces vitesses : si le lanceur ralentit, son
buff tombe à un autre tick. Le plan ne garde donc que les cases **saisies** ;
les effets des sorts se reposent là où le lanceur joue, à chaque vitesse
essayée.

L'outil connaît la provenance de chaque case, dans les deux camps : l'analyse
marque comme **automatiques** les cases qu'elle écrit (`atbAuto`, `speedAuto`),
et toute saisie dans une case la rend **saisie**, même à valeur identique
(`modifierMod`). Une ligne alliée qui porte des cases de provenance inconnue
(un état enregistré avant ce marquage) ne permet pas de plan : l'export se fait
sans plan, et le rapport demande de relancer l'analyse.

Le nombre de cumuls de passif est une entrée du scénario, comme dans l'outil :
il est photographié en nombre et ne se réestime pas pendant la recherche.

### Le plateau

Le **plateau** d'un plan est la liste de `TuneMonstre` que la simulation
reçoit. Il se construit par une **projection** des entrées du plan, extraite
de `analyseAutomatique` et partagée avec l'outil : vitesse de combat (lead,
Swift, gain de passif sur les cumuls photographiés), amplification de camp,
sorts **écrits** et cases saisies. La projection ne devine rien : elle ne
choisit aucun sort du kit à la place d'un choix absent et n'ajoute aucun
adversaire de référence. Un état jamais analysé donne un plateau sans sorts,
comme à l'écran. Le plateau n'a aucune autre construction.

Les kits (sorts, rechargements, passifs) se relisent dans les données de
l'app, comme dans l'outil.

À l'export, le verdict du plan se compare à celui de l'écran. S'ils diffèrent
(des vitesses changées depuis la dernière analyse, dont l'écran garde les
cases), le rapport le dit et invite à relancer l'analyse ; le plan est posé.

Le plan est figé : modifier ensuite le speed tuning ne le change pas.
Réexporter crée une nouvelle liste, comme aujourd'hui.

### Ce que « tenu » veut dire

Le speed tune est **tenu** quand :

1. chaque allié du plan figure au moins une fois dans l'ordre voulu ;
2. `diagnostiquerSequence(plateau, ordreVoulu)` répond `ok` : chaque
   occurrence joue après sa précédente, avant sa suivante, et avant le premier
   adversaire ;
3. les occurrences d'un même monstre gardent dans `Simulation.actions` l'ordre
   de leurs rangs (`id`, puis `id#2`…), y compris au même tick.

Les adversaires gardent leurs valeurs du plan : ils ne sont pas optimisés.

L'export se fait sans plan, avec la raison dans le rapport, quand l'ordre voulu
est vide, qu'il omet un allié du plan, qu'il range une occurrence avant une
occurrence de rang inférieur du même monstre, ou qu'une case est de provenance
inconnue. Les membres reçoivent alors la VIT minimum et le verrou de
[l'export](../speed-tuning/feat-export-optimizer.md).

### Portée

Le plan vaut pour le siège, comme le speed tuning, qui modélise 7 % de barre
par tick. La RTA n'est pas modélisée
([feat-formule.md](../speed-tuning/feat-formule.md)) et le plan ne prétend
rien pour elle.

## Membres et lignes

Le plan garde la correspondance entre ses lignes et les membres de l'équipe,
par l'**identité indépendante** des membres
([feat-listes-equipes-et-sauvegarde.md](feat-listes-equipes-et-sauvegarde.md)),
jamais par le sélecteur : un rattachement au réimport ne la casse pas.

- Une ligne alliée du plan **avec membre** est un membre contraint.
- Une ligne alliée du plan **sans membre** (ignorée à l'export, membre retiré
  ensuite) reste dans le plateau à ses valeurs du plan, comme un allié figé.
  L'encart la nomme.
- Un membre sans ligne (ligne masquée, membre ajouté ensuite) n'est pas
  contraint et ne compte pas dans le plateau.
- Les occurrences `id#2` d'une ligne appartiennent au même membre : une seule
  vitesse, un seul artéfact.
- Deux copies d'une espèce sont deux lignes et deux membres.

Une équipe demande au moins deux membres : un export qui ne garde qu'un seul
allié importable ne pose pas de plan, et le rapport le dit.

## Entrées d'un build

Un **adaptateur unique** traduit un build en entrées de sa ligne : vitesse de
runes `fiche − base`, Swift vrai si et seulement si le build active Rapidité,
sets activés, cumul 206 de la paire. L'amplification de camp n'y entre pas :
la projection l'ajoute une seule fois. Le même adaptateur sert à la zone, aux
builds validés des autres membres, à la validation et aux boutons
« Recalculer ».

## La zone d'un membre

### Axes

La **zone** d'un membre est l'ensemble des couples (VIT de fiche, cumul 206 de
la paire), pour chaque état de Swift, qui tiennent le speed tune, les autres
lignes étant fixées. Elle se calcule **sur les entrées** : le candidat remplace
celles de sa ligne par l'adaptateur, et le plateau est reconstruit. Vitesse de
combat, gain de passif et vitesse de départage en découlent par la projection.

- **Axe vitesse** : de la VIT de base à un majorant de la VIT de fiche
  atteignable, `base + Σ (meilleure VIT par emplacement dans le pool) +
  bonus plat Rapidité` (le bonus seulement dans l'état Swift). Le majorant peut
  surestimer, jamais sous-estimer.
- **Axe artéfact** : de 0 au plafond de paire (`ARTE_MAX`).
- **Swift** : une zone par état que la recherche du membre peut produire ; un
  combo qui impose ou exclut Rapidité n'en calcule qu'une. Les autres sets ne
  changent pas le plateau : les cumuls de passif sont photographiés.

Le balayage est **exhaustif**, jamais une dichotomie : l'ordre tenu n'est pas
monotone en vitesse, puisqu'un seul monstre agit par tick et qu'aller plus vite
peut voler le tick d'un allié.

### Classes d'artéfact

Deux valeurs de 206 sont équivalentes quand elles donnent, pour **chaque**
valeur de buff positive que le plan peut poser (sorts de tous les alliés,
cases saisies), le même buff tronqué, calculé en entiers comme dans le moteur :
`⌊buff × (100 + 206 + amplification) / 100⌋`. On simule un représentant par
classe. Sans aucune source de buff de vitesse positive dans le plan, l'axe
artéfact disparaît ; la présence d'un buff dans la seule simulation du plan ne
suffit pas, parce qu'une cible « barre la plus basse » change avec la vitesse.

### Forme et affichage

La zone se range, par état de Swift, en **intervalles de VIT de fiche par
classe d'artéfact** ; une classe peut porter plusieurs intervalles, ou aucun.
L'écran les montre en vitesse de combat, sous le lead du plan, avec la VIT de
fiche correspondante : c'est la forme décidée (« intervalles de vitesse de
combat par palier »), la fiche n'étant que l'index exact du calcul.

### Les autres lignes

Pour la zone d'un membre, chaque autre ligne alliée du plan prend :

1. les entrées du **build validé** de son membre, s'il est exploitable : toutes
   ses runes et ses artéfacts encore présents dans le compte ;
2. sinon ses entrées du **plan**.

Un build validé non exploitable est signalé, et sa ligne reprend le plan.

Une zone qui tiendrait pour toutes les combinaisons des autres serait presque
toujours vide : deux alliés voisins ne peuvent pas bouger indépendamment sans
risquer d'échanger leur tour. Les membres se construisent donc un par un : le
dernier cherché l'est contre les vrais builds de tous les autres.

### Calcul et cache

La zone se calcule hors du fil de l'interface, une fois par contexte : le plan,
les entrées retenues des autres lignes, le majorant de VIT du pool, les états de
Swift recherchés et l'identité des données de kits. Elle se garde en cache sous
l'empreinte de ce contexte et se recalcule quand il change (validation,
invalidation ou changement de build d'un autre membre, recalcul du plan,
réimport, reprise d'un point de sauvegarde). Tant que les kits ne sont pas
chargés, aucune zone n'est publiée et la recherche ne part pas. Un calcul en
cours est abandonné quand son contexte change. La recherche n'en relance aucun,
ni par candidat de runes, ni par paire.

Budget : une zone se calcule en moins d'une seconde sur le cas le plus lourd
mesuré (cinq alliés, adversaires, deux états de Swift), mesure nommée à
l'appui ; au-delà, le calcul se découpe avant d'être livré.

## Écart entre le plan et l'Optimizer

Une ligne peut avoir dans l'Optimizer d'autres entrées que dans le plan : le
build validé exploitable de son membre, ou, sans lui, l'équipement que le
monstre porte dans le compte. Un Chilling réglé à 396 de vitesse de combat dans
le speed tuning peut porter 401.

- Les vitesses comparées sont toutes deux calculées **sous le lead du plan**,
  et le libellé le dit. L'écart est **toujours affiché**, pour chaque ligne
  concernée, dans l'encart de chaque membre et avec le verdict : « Chilling :
  396 dans le plan, 401 dans l'Optimizer (build validé), lead du plan ». Même
  chose pour l'« Effet aug. VIT ».
- **« Recalculer avec 401 »** écrit dans le plan, en un clic, les entrées de la
  ligne données par l'adaptateur, jamais la vitesse de combat affichée. Après
  le clic, le plateau reconstruit donne exactement la valeur affichée. Toutes
  les zones de l'équipe et le verdict se recalculent. « Recalculer avec les
  valeurs de l'Optimizer » fait la même chose pour tous les écarts à la fois.
- Un build validé exploitable entre de toute façon dans les zones ; le bouton
  aligne alors le plan sur lui, pour que les valeurs retenues restent les
  mêmes si ce build est invalidé. Un équipement actuel n'entre dans le calcul
  que par ce bouton : le plan peut viser une autre vitesse que celle portée
  aujourd'hui. Un build validé non exploitable ne propose aucun bouton.
- La valeur remplacée reste affichée comme « valeur d'origine du speed
  tuning », et « Restaurer » rend exactement les entrées d'origine.

Le lead du plan reste celui du calcul : le speed tune a été réglé avec lui.
Quand le lead effectif du membre dans l'Optimizer diffère, l'encart affiche
les deux leads et la vitesse de combat sous chacun, sans bouton.

## Conversion vers le build

Un build **tient la contrainte** quand une paire d'artéfacts réellement
équipable donne un cumul 206 dont la classe, pour la VIT de fiche et l'état de
Swift du build, est dans la zone, et que **cette même paire** tient aussi les
autres conditions et verrous du membre. La paire de la carte se choisit parmi
ces paires seulement, par le régime habituel de l'objectif. Le build de runes
reste fixe pendant ce choix.

## Ce que fait la recherche

- **Élagage des runes** : la zone donne une enveloppe de VIT de fiche, minimum
  et maximum sur toutes ses classes et tous ses états de Swift. L'enveloppe ne
  fait qu'élargir : elle n'écarte jamais un build qui tiendrait la zone. Aucun
  seuil d'artéfact ne sert à élaguer les runes.
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
- **Valider un build** rejoue le plan avec les entrées réelles du build et les
  valeurs actuelles des autres lignes, sans passer par la zone. Si l'ordre
  casse, une confirmation l'annonce (« ce build casse l'ordre avec les builds
  actuels ») ; son défaut est d'annuler.
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

- la zone en clair, une ligne par classe utile et par état de Swift : la plage
  de vitesse de combat, la plage de VIT de fiche correspondante, et le 206 de
  la classe (« sans artéfact » pour la classe de 0) ;
- les autres lignes, leur origine (plan, build validé, figé faute de membre) et
  les écarts de la section dédiée, avec leurs boutons ;
- un bouton « Détacher le speed tune ».

Le verdict d'équipe s'affiche avec l'équipe. Les deux formats ont le même
contenu ; l'encart suit la grille des conditions de chaque format.

### Détacher et rattacher

Le rattachement possède deux champs des critères du membre : la VIT minimum et
le verrou 206. Tant qu'il est attaché, ils ne s'affichent pas et ne se
saisissent pas. Le rattachement garde lui-même ses **valeurs de repli** : la
VIT minimum de fiche de sa ligne et son 206, posées à l'export et mises à jour
par « Recalculer » et « Restaurer ». Détacher pose ces deux valeurs (le verrou
seulement s'il est positif) à la place de ces deux champs ; les autres critères
ne bougent pas. « Rattacher » repose la contrainte et masque de nouveau les
deux champs. Le plan reste sur l'équipe dans les deux cas.

## Persistance

Le plan est un champ facultatif de l'équipe stockée, validé à la lecture comme
ses autres champs ; le rattachement (attaché ou détaché, valeurs de repli) est
un critère personnel du membre. Une équipe sans plan se lit comme aujourd'hui.

Un plan malformé est signalé et écarté, sans rejeter l'équipe. Un membre
encore attaché à un plan absent ne devient pas une recherche libre : la
recherche refuse de partir, l'encart dit « plan de speed tune perdu » et ne
propose que « Détacher », qui lit les valeurs de repli du rattachement. Une
version qui ne connaît pas le champ l'ignore et peut le perdre en réécrivant le
stockage.

## Limites

- Le plan garde l'adversaire saisi dans le speed tuning, pas l'équipe adverse
  réelle.
- La zone suppose les sorts, cibles, cases saisies et cumuls de passif du plan.
  Un combat qui s'en écarte (un buff raté, un remplissage différent, un build
  qui ne porte plus la Volonté) n'est pas couvert.
- Les membres se cherchent un par un : un membre sans build validé compte pour
  ses valeurs du plan.
