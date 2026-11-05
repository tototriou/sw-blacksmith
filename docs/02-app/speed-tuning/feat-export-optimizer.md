# Speed tuning — exporter vers l’Optimizer

Export de « Ton équipe » depuis la page et la modale.

Voir aussi : README.md, ../optimizer/feat-import-equipes.md.

## Action et disponibilité

« Exporter vers l'Optimizer » reste affiché dans « Ton équipe », sous la
recherche de monstres. Le contrôle `Bouton` de la librairie UI prend toute
la largeur au bureau et au téléphone ; les deux formats partagent le même
contenu. Il exporte toutes les lignes alliées, même masquées, sans les
adversaires. La disponibilité est dérivée du producteur existant, sur les
lignes, le lead, le deck d’origine éventuel et les sources actuelles.

Sans compte chargé (ni Box ni runes), le bouton est désactivé et son `title`
demande de charger un compte. Sans membre importable, il reste désactivé avec
la raison : choisir un monstre et sa vitesse de runes. L’outil reste utilisable
sans compte pour ses autres fonctions.

Un clic appelle `importerSpeedTuneOptimizer` par l’action commune
`importerEquipe`, avec les sources relues au geste. Une liste créée devient
active, son premier membre est choisi avec ses critères et la route passe à
`#/outils/optimizer`. Aucun build n’est validé et aucune recherche n’est lancée.
Un refus ne navigue pas ; son rapport donne la raison. Le rapport sort du flux,
sans déplacer le bouton, au bureau comme au téléphone.
La page et les deux modales reçoivent l’action qui ouvre le rapport global
porté par `App.tsx`, après acceptation comme après refus. Cet aiguillage dépend
du point d’entrée : ouvrir la modale par la palette alors que la route est
l’Optimizer conserve ses avertissements et ses motifs de refus à l’écran.

## Page et modale

La page passe l’action depuis `App.tsx` par `OutilsPage`. Sans provenance
stockée dans les lignes, le producteur retrouve le premier deck de siège de
composition exactement égale au camp allié actuel, copies comprises, défenses
puis offenses. Ses slots donnent les exemplaires et le leader. Après changement
de composition, faute de deck correspondant, le repli suit Box, RTA, défense,
offense ; seule une espèce absente de toutes les sources devient non possédée.

La modale reçoit l’action depuis ses deux parents, `App.tsx` et `SiegeBoard`.
Elle transmet son `DeckInitial` au même producteur : les exemplaires sont
ceux du deck d’origine. Elle se ferme seulement après un export accepté
(`listeCreee` présente). Un refus laisse la modale ouverte avec ses saisies.

## Critères transmis

La liste « Speed tuning » porte le contenu Guilde et l’équipe « Ton équipe »
porte le lead actuel du camp, avec sa portée et son élément, et le **plan de
speed tune** : les deux camps, les sorts, les grilles et l’ordre voulu, figés au
moment de l’export. Chaque membre d’une ligne visible reçoit la **contrainte de
speed tune** à la place d’une VIT minimum : la recherche ne retient que les builds dont la vitesse
de combat et l’« Effet aug. VIT » de la paire gardent l’ordre voulu, les autres
alliés pris à leur build validé ou, faute de build, à leurs valeurs du plan
([contrainte de speed tune](../optimizer/feat-contrainte-speed-tune.md)). Le plan d'une équipe déjà
importée se règle ensuite depuis l'Optimizer, sans créer de liste
([feat-speed-tune-depuis-optimizer.md](../optimizer/feat-speed-tune-depuis-optimizer.md)).
Swift est sélectionné si la ligne le porte ; les autres critères viennent de la
base complète de l’exemplaire. Détacher la contrainte dans l’Optimizer repose
la VIT minimum de fiche (base + vitesse de runes saisie) et le verrou de paire
« Effet aug. VIT » (code 206) si sa valeur est positive. Les lignes ignorées et
les membres sans set se disent dans le rapport. Les règles de conversion et de
filtrage restent dans
[l’import d’équipes](../optimizer/feat-import-equipes.md#f3--conversion-du-speed-tuning).
