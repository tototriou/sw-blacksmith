# Un salon Discord, une recommandation

## Décision

- **Un salon porte une seule recommandation.** Un salon de recommandations est un salon dont le
  nom commence par `blacksmith-reco` et que le bot voit. Une guilde qui partage plusieurs
  recommandations ouvre plusieurs salons. La provenance d'une recommandation liée est
  `discord:<serveur>:<salon>`, dans le champ `source` du format de partage.
- **Chaque publication est un nouveau message du bot**, qui ne contient que le fichier JSON de la
  recommandation. Les messages précédents restent dans le salon : l'historique vit dans Discord,
  et le bot ne supprime jamais rien de lui-même.
- **La version courante est le message du bot le plus récent** parmi les 100 derniers messages du
  salon ; l'app ne montre que celle-là. Au-delà de 100 messages écrits depuis la dernière
  publication, le salon est vu sans recommandation : le guide d'installation conseille de n'y
  laisser écrire que le bot, sans l'imposer.
- **Publie qui peut écrire dans le salon**, selon les droits Discord, sans administration dans
  l'app. Le fichier publié nomme son auteur (le premier membre qui l'a publié) et ses
  contributeurs (chaque membre qui l'a publié depuis), sous leur surnom du serveur.
- **La dernière publication gagne, après une fusion.** Avant de publier, l'app relit le salon : si
  une version plus récente que celle sur laquelle le membre a travaillé y est arrivée, il passe par
  une fusion à trois voies avant de publier. La base est la dernière version reçue : ce qui n'a
  changé que d'un côté passe seul, et un deck changé des deux côtés se choisit en entier, le sien
  ou celui du salon. Une version qui arrive sur une copie modifiée et non publiée ouvre la même
  fusion. Le résultat est une copie modifiée, que le membre relit puis publie.
- **Un membre ne supprime rien pour les autres.** Supprimer une recommandation liée rompt son lien
  pour lui seul : elle devient une recommandation locale, et celle du salon reparaît à la
  synchronisation suivante. Seuls les admins effacent, dans Discord ; un message du bot effacé
  rend la version précédente courante.
- **Les droits suivent ceux du salon.** Sans droit d'écrire, la recommandation liée est en lecture
  seule. Sans accès au salon, elle est supprimée de l'appareil ; des modifications non publiées
  restent, en recommandation locale.

## Raisons

- **Une lecture par salon suffit** : la version courante est le premier message du bot trouvé en
  remontant le salon, sans index à tenir ni identifiant de recommandation à rapprocher entre
  messages.
- **Un nouveau message par publication garde l'historique complet** dans le salon : un admin
  retrouve une version écrasée, et effacer la dernière revient à annuler une publication.
- **La fusion avant publication** évite d'écraser sans le voir le travail d'un autre membre, sans
  jamais bloquer la publication.
- **La fusion à trois voies distingue un ajout d'une suppression** : une fusion qui n'ajoute que ce
  qui manque ne ferait jamais passer un deck retiré par l'autre.
- **Le deck entier est le grain du choix** : deux versions d'un même deck se comparent côte à côte,
  au téléphone comme à l'ordinateur.
- **Les droits de Discord suffisent** : une guilde règle déjà qui écrit dans quel salon.

## Options écartées

- **Plusieurs recommandations par salon, un message réécrit à chaque publication** (possibilité
  écartée) : la version précédente serait perdue, Discord ne gardant pas l'ancienne pièce jointe.
- **Un nouveau message qui supprime l'ancien** (possibilité écartée) : l'historique serait perdu de
  même.
- **Une publication refusée quand la version a changé** (possibilité écartée) : la fusion avant
  publication montre l'autre version sans bloquer.
- **La fusion additive des imports de fichiers** ([recoFusion.ts](../../../src/lib/recoFusion.ts),
  possibilité écartée) : elle ajoute ce qui manque sans jamais retirer, ce qui convient à un
  fichier reçu, pas à deux versions d'une même source.
- **Le choix champ par champ dans un deck** (possibilité écartée) : un écran de fusion bien plus
  lourd, surtout au téléphone.
- **Publier réservé à l'auteur, ou à un rôle Discord** (possibilité écartée) : une règle de plus à
  tenir dans l'app, alors que les droits du salon la portent déjà.
- **Une recommandation figée « Plus accessible » quand l'accès est perdu** (possibilité écartée) :
  elle resterait sur l'appareil sans pouvoir jamais se mettre à jour.

## Conséquences

- **Le champ « auteur » ne se saisit plus**, pour toutes les recommandations : une recommandation
  jamais publiée n'a pas d'auteur ; un auteur déjà écrit reste affiché, en lecture seule.
- **L'app avertit, à la connexion à Discord**, qu'une recommandation synchronisée disparaît de
  l'appareil quand on perd l'accès à son salon ; la documentation et le guide d'installation le
  disent aussi.
- **Une recommandation liée garde sur l'appareil la dernière version reçue**, base de la fusion.
- **Un fichier exporté depuis une recommandation liée** perd son lien : chez celui qui l'importe,
  c'est une recommandation importée comme une autre.
