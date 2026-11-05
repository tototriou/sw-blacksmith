# Régler le speed tune depuis l'Optimizer

Une équipe d'une liste de siège ouvre l'outil de speed tuning en modale, prérempli avec son
plan ou ses membres. « Appliquer à l'équipe » remplace son plan sans créer de liste : la zone et
le verdict de chaque membre se recalculent. Le même geste corrige un plan mal réglé.

Voir aussi : [feat-contrainte-speed-tune.md](feat-contrainte-speed-tune.md) (le plan, les liens,
la zone), [../speed-tuning/feat-export-optimizer.md](../speed-tuning/feat-export-optimizer.md)
(l'export qui crée une liste).

## Points d'entrée

- **Sur l'équipe** (tête de l'équipe d'une liste au contenu Guilde, celui du siège) : un bouton
  icône (jauge), nommé « Régler le speed tune » quand l'équipe n'a pas de plan, « Modifier le
  speed tune » quand elle en a un ; une icône, pour tenir dans la tête de l'équipe au téléphone.
  Absent pour une liste Arène, Donjon ou sans contenu : la portée reste le siège. Sa place reste
  réservée, pour que changer le contenu de la liste ne déplace pas « Modifier l'équipe ».
- **Dans l'encart « Speed tune »** d'un membre : « Modifier le speed tune », à côté de
  « Détacher ». Il ouvre la modale de l'équipe du membre.

## État de la modale

La modale travaille sur un **état à part**, jamais sur celui de la page Speed tuning : ouvrir,
régler puis fermer ne change rien à ce que la page contient. Ses clés portent le préfixe de
l'outil (`speedTune.optimizer.`) pour être remises à zéro avec lui au changement de compte, et
sont vidées à chaque ouverture : la modale repart toujours de l'équipe, jamais d'une ouverture
précédente.

### Préremplissage depuis le plan

L'équipe a un plan : chaque ligne du plan redevient une ligne de l'outil.

- Monstre (par son identifiant, dans le bestiaire), camp, vitesse de runes, Rapidité, sets,
  Effet aug. VIT, cumuls de passif, passif actif : ceux du plan, **recalculs compris** (ce que
  « Recalculer » ou « Restaurer » y a écrit).
- Les cases saisies des deux grilles reviennent comme saisies. Les cases automatiques sont
  celles de la **projection du plan** (`projecteur` : choix tels quels, `deviner: false`, saisies
  prioritaires, zéro compris), posées comme automatiques : l'outil ne relance **pas**
  l'analyse à l'ouverture, qui compléterait les choix absents depuis les kits et poserait un
  adversaire de référence. La projection attend les kits de **toutes** les lignes du plan, des
  deux camps ; d'ici là, la modale dit « lecture des kits ». Ainsi l'outil rouvert donne le
  plateau du plan, donc son verdict.
- Leads des deux camps, sorts, sorts du second tour, cibles et remplissages choisis, ordre voulu
  (rangé, donc figé) : ceux du plan. Une ligne sans sort choisi dans le plan reçoit le choix
  explicite « aucun sort » (chaîne vide) : l'outil ne lui prête pas le sort de son kit, que la
  projection (`deviner: false`) n'a pas compté.
- Un adversaire de référence revient **tel quel**, référence comprise (`ennemi:ref:<id>`, aux
  valeurs du plan) : l'ouverture ne le repose pas. Sans sort choisi, il reçoit lui aussi « aucun sort ». Relancer l'analyse le repose comme dans la
  page. Un plan sans adversaire revient sans adversaire.
- Une ligne dont le monstre manque au bestiaire ne peut pas revenir : la modale ne s'ouvre pas
  et dit lequel (appliquer sans lui supprimerait sa ligne du plan).

Relancer l'analyse reste un geste de l'utilisateur, comme dans la page.

### Préremplissage sans plan

L'équipe n'a pas de plan : « Ton équipe » reçoit ses membres, dans l'ordre de l'équipe, avec les
entrées de leur build validé exploitable, sinon de l'équipement porté (le même adaptateur que la
zone : vitesse de runes `fiche − base`, Rapidité des sets activés, sets, Effet aug. VIT de la
paire). Un membre sans équipement complet (moins de six runes) et sans build validé exploitable
arrive avec une vitesse de runes vide, à saisir, comme une ligne ajoutée à la main ; l'outil
refuse l'application tant qu'une vitesse de runes alliée manque (nouveau motif de refus,
« vitesse de runes de X à saisir » : le plan compterait sinon 0). Le lead de l'équipe devient le lead allié. Le camp adverse est vide ; l'analyse pose
l'adversaire de référence comme à l'ordinaire.

## Appliquer à l'équipe

Dans la modale ouverte depuis l'Optimizer, le bouton « Exporter vers l'Optimizer » devient
« Appliquer à l'équipe ». Il construit le plan par le même constructeur que l'export
(`planDepuisSpeedTune`) :

- **refus** (ordre vide ou incomplet, occurrences inversées, monstre en double, case de
  provenance inconnue, moins de deux alliés) : rien n'est écrit, la modale reste ouverte et dit
  la raison dans les mots du rapport d'export ;
- **verdict différent** : le verdict du plan construit n'est pas celui que l'outil affiche (une
  vitesse changée sans relancer l'analyse laisse des cases automatiques d'avant) : une
  confirmation le dit (« le verdict affiché n'est pas celui du plan : relance l'analyse ou
  applique quand même »), son défaut est d'annuler ;
- **kits en lecture** : « Appliquer » attend les kits de toutes les lignes de l'outil, une ligne
  ajoutée comprise (sans eux, le plan perdrait sorts et gains de passif) ; la modale dit « lecture
  des kits » ;
- **plan construit** : il remplace celui de l'équipe, et la modale se ferme.

Les liens se reconstruisent sur le nouveau plan :

- un lien existant est gardé, sélecteur et état (attaché ou détaché) compris, tant que sa ligne
  (même uid) existe dans le nouveau plan **et** que son membre est encore dans l'équipe ; le lien
  d'un membre retiré de l'équipe tombe ;
- chaque ligne alliée restée sans lien reçoit le membre de l'équipe non encore lié dont le monstre
  (identifiant du bestiaire, `allie:<id>`) est celui de la ligne, au plus un ; ce lien est attaché.
  Un camp ne porte jamais deux fois le même monstre (le constructeur refuse), donc l'affectation
  est unique ;
- les valeurs de repli suivent la ligne (`base + vitesse de runes`, son Effet aug. VIT), comme
  après « Recalculer » ;
- une ligne alliée sans membre reste figée faute de membre ;
- un membre sans ligne (son monstre retiré de « Ton équipe ») perd son lien : s'il était
  attaché, ses critères reçoivent ses valeurs de repli comme par « Détacher » : dans l'écran s'il
  est le membre affiché, sinon dans sa mémoire (la base complète des critères s'il n'en a pas
  encore) ; s'il était détaché, ses critères ne bougent pas.

L'origine du plan (« Restaurer ») devient celle du nouveau plan : appliquer est un nouveau
réglage, pas un recalcul. Une ligne recalculée perd donc la valeur d'origine qu'elle gardait ;
quand le plan chargé en porte, la modale le dit au-dessus du bouton (« Appliquer remplace les
valeurs d'origine du speed tuning »). Les builds validés ne sont pas touchés ; le verdict et les
écarts se recalculent avec eux.

## Code

- `src/lib/speedTuneDepuisPlan.ts` : l'état rouvert (`etatDepuisPlan`, `etatDepuisMembres`,
  `ouvertureDeLEquipe`), le geste jugé (`jugerApplication`, `perdOrigine`), le plan appliqué
  (`appliquerPlanALEquipe`, `criteresAvecRepli`). Tests : `tests/speed-tune-depuis-plan.test.ts`.
- `src/hooks/useSpeedTune.ts` : l'espace `speedTune.optimizer.` et le chargement à l'ouverture ;
  `src/components/outils/SpeedTuningSection.tsx` : « Appliquer à l'équipe » et sa confirmation.
  Rendu : `testRenduSpeedTuneAppliquer` (`tests/rendu/speed-tune.test.tsx`).
- `src/hooks/useSpeedTuneDepuisOptimizer.ts` : ouvrir, appliquer, poser les replis ; monté par
  `OptimizerSection.tsx`, bouton dans `MonstresDeLaListe.tsx` et dans `SpeedTuneEncart.tsx`.
  Branchement aux deux formats : `tests/rendu/optimizer-speed-tune-outil-preuves.ts`.

## Limites

- Un seul plan par équipe ; la modale ne garde pas d'historique.
- Deux exemplaires du même monstre dans l'équipe : l'outil n'en porte qu'un (une ligne par monstre
  et par camp), le second reste sans lien.
- Les membres hors siège (liste Arène) ne s'ouvrent pas.
