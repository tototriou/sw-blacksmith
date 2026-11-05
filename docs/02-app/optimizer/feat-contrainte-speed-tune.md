# Contrainte de speed tune

Un membre exporté depuis le speed tuning ne vise plus une VIT minimum : la
recherche ne retient que les builds dont la vitesse et l'« Effet aug. VIT » de
la paire d'artéfacts gardent l'ordre de tour réglé dans l'outil.

Voir aussi : [../speed-tuning/feat-export-optimizer.md](../speed-tuning/feat-export-optimizer.md),
[../speed-tuning/feat-ordre-des-sorts.md](../speed-tuning/feat-ordre-des-sorts.md),
[feat-import-equipes.md](feat-import-equipes.md),
[feat-speed-tune-depuis-optimizer.md](feat-speed-tune-depuis-optimizer.md) (régler ou corriger le plan sans repasser par une liste),
[ecran/sous-proprietes-verrouillees.md](ecran/sous-proprietes-verrouillees.md).

Fichiers : `src/lib/planSpeedTune.ts` (le plan, son plateau, sa zone et son
verdict, calcul pur), `src/lib/contrainteSpeedTune.ts` (la contrainte d'un
membre telle que la recherche la lit), `src/lib/speedTuneEquipe.ts` (le speed
tune stocké sur l'équipe et ses liens), [speedTuneAuto.ts](src/lib/speedTuneAuto.ts) (le
producteur du plateau, partagé avec l'outil),
[speedTuneLignes.ts](src/lib/speedTuneLignes.ts) (la provenance des cases),
[speedTune.ts](src/lib/speedTune.ts) (la simulation),
[importSpeedTuneOptimizer.ts](src/lib/importSpeedTuneOptimizer.ts) (l'export),
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts) et
[artifactOptim.ts](src/lib/artifactOptim.ts) (l'élagage et le choix de la
paire), `src/lib/speedTuneMembre.ts` (les lignes de l'équipe, les bornes du
membre, le verdict, les écarts, Recalculer et Restaurer, calcul pur),
`src/hooks/useZoneSpeedTune.ts` et `src/workers/zoneSpeedTune.worker.ts` (les
kits du plan et la zone calculée hors du fil de l'interface),
`src/hooks/useSpeedTuneMembre.ts` (l'assemblage sur l'état de l'Optimizer),
`src/components/outils/optimizer/SpeedTuneEncart.tsx` (l'encart),
`scripts/lib/recipeToSearchParams.ts` (la recette rejouée par le CLI).

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
il est photographié en nombre et ne se réestime pas pendant la recherche. Ses
**préconditions** se gardent pourtant (section « Cumuls de passif et sets »).

### Le plateau

Le **plateau** d'un plan est la liste de `TuneMonstre` dont la simulation tire
le verdict. Il se construit comme l'analyse de l'outil le construit, en deux
passes, par une **projection** extraite de `analyseAutomatique` et partagée
avec l'outil :

1. une première simulation avec les sorts **écrits** des alliés (vitesse de
   combat avec lead, Swift et gain de passif sur les cumuls photographiés,
   amplification de camp), sans leurs cases saisies, les cases saisies des
   adversaires comprises — exactement les entrées de la première passe de
   l'analyse ;
2. l'écriture de ce que les sorts posent dans les grilles, décalé d'un tick
   comme dans l'analyse, **les cases saisies gardant la priorité** à leur tick,
   zéro compris ;
3. une seconde simulation sur ces grilles, qui donne le verdict.

À entrées inchangées depuis la dernière analyse, le plateau du plan est donc
celui de l'écran, case pour case : le plan juge ce que l'outil juge, avec ses
approximations. La projection ne devine rien : elle ne choisit aucun sort du kit
à la place d'un choix absent et n'ajoute aucun adversaire de référence. Un état
jamais analysé donne un plateau sans sorts, comme à l'écran. Le plateau n'a
aucune autre construction.

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
occurrence de rang inférieur du même monstre, qu'un monstre figure deux fois
dans un même camp (deux lignes d'un même uid ne se lieraient qu'à un membre),
ou qu'une case est de provenance inconnue. Les membres reçoivent alors la VIT minimum et le verrou de
[l'export](../speed-tuning/feat-export-optimizer.md).

### Portée

Le plan vaut pour le siège, comme le speed tuning, qui modélise 7 % de barre
par tick. La RTA n'est pas modélisée
([feat-formule.md](../speed-tuning/feat-formule.md)) et le plan ne prétend
rien pour elle.

## Membres et lignes

L'équipe garde la correspondance entre les lignes alliées du plan et ses
membres (`SpeedTuneEquipe.membres`, `src/lib/speedTuneEquipe.ts`) : chaque lien
nomme sa ligne et son membre par le **même sélecteur** que les membres de
l'équipe, et migre avec eux quand le réimport rattache un membre à un autre
exemplaire (`optimizerRattachement.ts`,
[feat-listes-equipes-et-sauvegarde.md](feat-listes-equipes-et-sauvegarde.md)) :
un rattachement ne casse pas le lien. L'export ne lie que les membres que la
liste accepte.

- Une ligne alliée du plan **avec membre** est un membre contraint.
- Une ligne alliée du plan **sans membre** (ignorée à l'export, membre retiré
  ensuite) reste dans le plateau à ses valeurs du plan, comme un allié figé.
  L'encart la nomme.
- Un membre sans ligne (ligne masquée, membre ajouté ensuite) n'est pas
  contraint et ne compte pas dans le plateau.
- Les occurrences `id#2` d'une ligne appartiennent au même membre : une seule
  vitesse, un seul artéfact.
- Deux copies d'une espèce sont deux lignes et deux membres.

Deux comportements de la simulation du speed tuning sont corrigés dans l'outil
avant d'être hérités par le plan : un « Aucun sort » choisi pour un tour
supplémentaire ne relance plus le sort du premier tour, et un tour rendu
(`rejoue`) ne suit que le tour où le sort qui le rend est réellement lancé.

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
- **Axe artéfact** : de 0 au plus fort cumul 206 qu'une paire de
  l'inventaire peut porter, `ARTE_MAX` par défaut.
- **Swift** : une zone par état que la recherche du membre peut produire ; un
  combo qui impose ou exclut Rapidité n'en calcule qu'une. Les autres sets ne
  changent pas le plateau : les cumuls de passif sont photographiés.

Le balayage est **exhaustif**, jamais une dichotomie : l'ordre tenu n'est pas
monotone en vitesse, puisqu'un seul monstre agit par tick et qu'aller plus vite
peut voler le tick d'un allié.

### Classes d'artéfact

Deux valeurs de 206 sont équivalentes quand elles donnent, pour **chaque**
valeur de buff positive que le plan peut poser sur ce membre (buffs d'équipe et
sur un allié des sorts écrits, ses propres buffs sur soi, cases de vitesse
saisies sur sa ligne), le même buff tronqué, calculé en entiers comme dans le moteur :
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

### Cumuls de passif et sets

Un cumul de passif estimé dépend des sets de l'équipe (Volonté, Bouclier) :
un Chilling dont un cumul vient de sa Volonté perd 20 de VIT dans un build sans
Volonté. Le plan garde donc, à l'export, une **référence** : pour chaque ligne
dont le passif est actif et dont le gain de vitesse dépend des cumuls, le
**gain effectif** (gain par cumul × cumuls, plafond du passif compris) que
`cumulsEstimes` donne avec les sets de toutes les lignes du plan.

Un **contexte** réunit les entrées de toutes les lignes alliées du plan : le
candidat pour sa ligne, le build validé exploitable des autres membres, le plan
ailleurs. La précondition est tenue quand, refaite sur ce contexte entier,
l'estimation donne à chaque ligne de la référence le même gain effectif. Une
ligne aux sets inconnus ne fournit aucune source, dans la référence comme dans
le contexte ; elle reste contrôlée si son passif en dépend. Une ligne sans
passif dépendant des cumuls n'est jamais contrôlée.

Le prédicat **contexte tenu** (précondition des cumuls, puis plateau tenu) est
le même au filtre final, à la validation d'un build et au verdict d'équipe. Un
build validé d'un autre membre qui casse la précondition est signalé comme un
écart (« cumuls du plan non tenus ») et le verdict d'équipe ne peut pas être
« tenu ».

Quand « Recalculer » change les sets d'une ligne au point de changer un gain
effectif, le bouton l'annonce, et le clic met à jour ensemble les sets, les
cumuls photographiés (décalés de la différence d'estimation) et la référence ;
« Restaurer » rend l'ensemble d'origine.

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

Coût mesuré (2026-11-05, conteneur cloud, un fil, script de mesure du chantier) :
environ 125 µs par point balayé, soit 1,3 s pour une zone de 19 classes et
1,8 s pour 28 classes, sur cinq alliés, un adversaire, deux états de Swift et
un domaine de 280 points de fiche. Le calcul tourne donc en arrière-plan :
l'encart dit « zone en cours de calcul » et la recherche attend la zone.

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
L'affichage des deux leads quand le lead effectif du membre dans l'Optimizer
diffère n'est pas encore fait (voir « Limites »).

## Conversion vers le build

Un build **tient la contrainte** quand une paire d'artéfacts réellement
équipable donne un cumul 206 dont la classe, pour la VIT de fiche et l'état de
Swift du build, est dans la zone, que **cette même paire** tient aussi les
autres conditions et verrous du membre, et que la précondition des cumuls est
tenue avec les sets du build. La paire de la carte se choisit parmi
ces paires seulement, par le régime habituel de l'objectif. Le build de runes
reste fixe pendant ce choix.

## Ce que fait la recherche

- **Élagage des runes** : la zone donne une enveloppe de VIT de fiche, minimum
  et maximum sur toutes ses classes et tous ses états de Swift. L'enveloppe ne
  fait qu'élargir : elle n'écarte jamais un build qui tiendrait la zone. Aucun
  seuil d'artéfact ne sert à élaguer les runes.
- **Réduction des artéfacts** : le 206 devient incomparable pour la dominance
  du préfiltre — deux pièces qui y diffèrent ne s'éliminent jamais, puisqu'un
  206 plus fort peut faire jouer trop tôt — et le verrou du 206 disparaît. Les
  apports atteignables de la recherche de runes ne suivent que les
  principales : ils ignorent le 206, restent optimistes et n'écartent aucun
  build.
- **Résolution même sans optimisation des artéfacts** : sous contrainte, la
  paire se juge à la résolution même quand « ignorer les artéfacts » est
  coché ; sans paire, le build n'est pas affiché.
- **Validation finale** : le test exact de la section précédente, à la
  résolution de l'équipement de chaque build, là où se juge déjà le filtre
  final des conditions sur la vraie paire. Seules les paires dont le 206 tombe
  dans une classe admissible pour la fiche et l'état de Swift du build sont
  notées ; aucune, et le build est rejeté comme un build sans paire conforme.
  Un build hors zone n'est jamais affiché.
- **Contexte photographié** : l'empreinte de la zone entre dans le contexte
  photographié au lancement et dans la signature de résolution. Quand la zone
  change après le lancement, les résultats restent ceux de leur contexte, et
  l'écran le dit (« la zone a changé depuis la recherche »).
- **Valider un build** juge le prédicat « contexte tenu » avec les entrées
  réelles du build et les valeurs actuelles des autres lignes, sans passer par
  la zone. Si l'ordre
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

- le nom du monstre du membre, dans le titre de l'encart (« Speed tune · Lushen ») et dans
  celui de la zone ;
- la zone en tableau, une ligne par classe utile et par état de Swift, aux colonnes « VIT.
  combat » (sous le lead du plan), « VIT totale » (la VIT de fiche), « Effet aug. VIT » (le
  206 de la classe, 0 pour la classe sans artéfact) et « Set Rapide » (oui ou non) ; les
  titres passent sur deux lignes plutôt que d'élargir la carte. Le titre de la zone
  (« Vitesses de Lushen qui respectent l'ordre et le speed tuning comme défini ») replie et
  déplie le tableau, déplié par défaut ;
- les autres lignes, leur origine (plan, build validé, figé faute de membre) et
  les écarts de la section dédiée, avec leurs boutons ;
- un bouton « Détacher le speed tune ».

Le verdict d'équipe s'affiche en tête de l'encart de chaque membre de l'équipe,
pas encore dans la liste des équipes. Tant que le membre est attaché, la case
« Min » de VIT dit « speed tune » et ne se saisit pas, et l'« Effet aug. VIT »
disparaît de l'éditeur des sous-propriétés verrouillées (sans être effacé des
critères) ; la VIT maximum reste saisissable et resserre l'enveloppe. Les
deux formats ont le même contenu ; l'encart suit la grille des conditions de
chaque format.

L'encart dit aussi les états d'attente : lecture des kits, zone en calcul, zone
vide (aucune vitesse ne tient l'ordre : la recherche ne part pas), aucun set
admis par la précondition des cumuls.

### Détacher et rattacher

Le rattachement possède deux champs des critères du membre : la VIT minimum et
le verrou 206. Tant qu'il est attaché, ils ne s'affichent pas et ne se
saisissent pas. Le rattachement garde lui-même ses **valeurs de repli** : la
VIT minimum de fiche de sa ligne et son 206, posées à l'export et mises à jour
par « Recalculer » et « Restaurer ». Détacher pose ces deux valeurs (le verrou
seulement s'il est positif) à la place de ces deux champs ; les autres critères
ne bougent pas. « Rattacher » repose la contrainte et masque de nouveau les
deux champs. Le plan reste sur l'équipe dans les deux cas.

## Recette et CLI

La recette exportée porte la contrainte calculée (`speedTune`, version 1),
validée à la lecture : une contrainte malformée refuse la recette et nomme le
champ. Le CLI la rejoue comme l'écran : exigence de VIT sous l'enveloppe, 206
incomparable et sans verrou, résolution même avec les artéfacts ignorés ; une
zone sans aucun set admis refuse la recherche. Tant que l'écran n'a pas de
contrainte publiée pour un membre attaché (kits, calcul, plan perdu, zone
vide), l'export de la recette est grisé comme la recherche : il donnerait au
CLI une recherche libre. L'écran, lui, ignore la
contrainte d'une recette importée et le dit : la zone se recalcule depuis le
plan de l'équipe, jamais depuis un fichier.

## Persistance

Le speed tune est un champ facultatif de l'équipe stockée
(`EquipeOptimizer.speedTune`), validé à la lecture comme ses autres champs
(`lireSpeedTuneEquipe`) : le plan et les liens. Le rattachement (attaché ou
détaché, valeurs de repli) vit sur le lien de chaque membre, à côté de sa
ligne. Une équipe sans speed tune se lit comme aujourd'hui.

Des liens malformés (ligne inconnue ou ennemie, sélecteur invalide, ligne ou
membre lié deux fois, repli négatif) écartent le speed tune entier ; l'équipe
reste, le rapport de lecture le dit et la valeur brute rejoint les rejets du
stockage. Un plan malformé seul, dont un ordre voulu que la construction aurait
refusé (vide, incomplet, occurrences inversées), est signalé et écarté, sans rejeter l'équipe
ni ses liens : il se relit `null`, sans rejet de plus aux lectures suivantes. Un membre
encore attaché à un plan absent ne devient pas une recherche libre : la
recherche refuse de partir, l'encart dit « plan de speed tune perdu » et ne
propose que « Détacher », qui lit les valeurs de repli du rattachement. Une
version qui ne connaît pas le champ l'ignore et peut le perdre en réécrivant le
stockage.

## Limites

- Le plan garde l'adversaire saisi dans le speed tuning, pas l'équipe adverse
  réelle.
- La zone suppose les sorts, cibles, cases saisies et cumuls de passif du plan.
  Un combat qui s'en écarte (un buff raté, un remplissage différent) n'est pas
  couvert.
- Les membres se cherchent un par un : un membre sans build validé compte pour
  ses valeurs du plan.
- Pas encore faits : l'affichage des deux leads quand le lead effectif diffère,
  l'annonce de « Recalculer » quand les gains d'une ligne changent, le verdict
  dans la liste des équipes ; un échec de lecture des kits laisse l'encart sur
  « lecture des kits ». Suivi :
  [pistes-optimizer.md § Contrainte de speed tune : ce qui reste à faire](../../05-feuille-de-route/pistes-optimizer.md#contrainte-de-speed-tune--ce-qui-reste-à-faire).
