# Le compte en direct : le plugin SWEX « SW Blacksmith Live »

Partie de [L'application de bureau](README.md), § « Le dossier SW Exporter ».

SW Exporter (SWEX) n'écrit l'export du compte qu'à la **connexion** au jeu
(plugin ProfileExport). Une session de meulage, des runes vendues ou
équipées n'apparaissent donc dans « Mon compte » qu'à la connexion suivante.
Le plugin **SW Blacksmith Live** tient le compte à jour **pendant la partie**,
à partir de ce que le serveur renvoie à chaque commande.

Code : **`plugin-swex/`**, à la racine du dépôt, versionné avec l'app.

## Le moteur — `plugin-swex/source/etatDirect.ts`

Calcul pur, sans disque ni Electron, testé par
[tests/plugin-swex.test.ts](tests/plugin-swex.test.ts).

- **`depuisConnexion(réponse)`** part de la réponse de `HubUserLogin`.
  ⚠️ C'est **exactement** l'export de ProfileExport : mêmes clés, mêmes runes,
  monstres et pierres (vérifié sur un compte réel).
- **`appliquer(état, commande, requête, réponse)`** applique une commande
  réussie (`ret_code` 0) de l'invocateur suivi ; `true` si le compte a changé.
- **`versExport(état)`** rend le compte à écrire : la connexion, dont les
  monstres, les runes, les artéfacts, les pierres (`rune_craft_item_list`) et
  les reliques sont remplacés par l'état tenu. ⚠️ **Sans `session_key`,
  `session_key_node` ni `reqid`** : ProfileExport les écrit, le plugin jamais.

### ⚠️ Un registre, pas l'arbre de l'export

Le jeu renvoie une rune seule (meule, amélioration), un monstre **complet**
avec ses runes, artéfacts et reliques (équipement, combat), ou une liste à
retirer (vente). Le moteur tient un **registre par identifiant** (runes,
artéfacts, monstres, pierres, reliques), et c'est l'écriture qui range : une
rune dont `occupied_type` vaut 1 et dont le monstre existe est portée par lui,
toute autre est dans l'inventaire ; de même pour un artéfact (`occupied_id`).

- Un monstre reçu **rend à l'inventaire** ce qu'il portait et ne porte plus.
  Une rune passée à un autre monstre dans la même réponse est reprise par
  lui : son objet dit son nouveau porteur.
- ⚠️ **Une relique n'est pas exclusive** : plusieurs monstres portent la même,
  et la liste du compte (`relics`) les contient toutes, portées ou non. Elle se
  tient à part, mise à jour à chaque relique vue.

### ⚠️ Une lecture générale pour ce qui change, une règle pour ce qui disparaît

Le serveur renvoie l'**état courant** de tout objet touché : une rune, un
monstre, un lot de pierres vus dans une réponse remplacent ceux du registre.
C'est ce qui couvre, sans règle par commande, les meules et gemmes, les
améliorations, réévaluations et raffinages, l'équipement, les combats, les
explorations, la faille dimensionnelle, le courrier, la boutique et les
invocations.

Un objet n'est retenu que s'il est **du compte** : son `wizard_id` est celui
de l'invocateur (sans lui passaient les monstres ennemis d'un donjon et ceux
des decks recommandés par la communauté), son identifiant n'est pas nul (un
`rune_id` 0 est un aperçu de récompense), et une rune est portée (1) ou en
inventaire (2) — `occupied_type` 3, c'est une rune **en vente** au marché noir.

Certaines réponses montrent des objets qui ne sont **pas** l'état du compte ;
elles sont écartées de la lecture générale (`HORS_LECTURE`) :

| Réponse | Ce qu'elle montre |
|---|---|
| `SellRune`, `SellArtifacts` | les objets **vendus**, pour le rachat |
| siège, guilde (hors labyrinthe), rivaux, RTA, arène dimensionnelle | des **instantanés** de monstres : défense posée il y a des jours, préréglages de runes, box dimensionnelle |
| aperçus de récompense (`…RewardInfo…`) | une rune reçue **puis vendue** y figure encore |

De même, certaines clés ne sont jamais lues (`CLES_IGNOREES`) : listes de
rachat, états « avant », historiques. ⚠️ `reward_result` de l'arène serveur est
l'historique de **toutes** les récompenses de la saison : seule l'entrée de la
récompense reçue est lue (`LECTURES_CIBLEES`).

Ce qui disparaît a sa règle (`RETRAITS`) : runes et artéfacts vendus (lus
dans la requête), pierres vendues (le lot restant, ou retiré). Les monstres
retirés (mis en stock, sacrifiés, convertis) se lisent dans
`remove_unit_id_list` et `source_unit_list`.

### Vérifié par rejeu d'un journal réel

Un script hors dépôt rejoue le `full_log.txt` d'un compte réel : entre deux
connexions, l'état reconstruit est comparé à celui de la connexion suivante
(runes et leur place, artéfacts, monstres, pierres, reliques). Sur trois
intervalles de jeu (99, 85 et 761 commandes appliquées), il est
**identique**. Le journal réel ne vient pas dans le dépôt : il porte la clé de
session du joueur. Les tests en reprennent chaque piège sur un compte
fabriqué.

## Le contenu des combats de guilde — `plugin-swex/source/guilde.ts`

Siège, guerre de guilde, labyrinthe, rivaux, boss de guilde : rien de cela
n'est dans l'export. Le jeu ne l'envoie qu'en le **montrant** (carte du
siège, défenses d'une base, journaux de combat) ou en le **jouant** (début et
fin d'un combat). Le plugin le garde dans un fichier à part,
**`<nom>-<id>.guilde.json`** (format `swblacksmith/guilde-direct`, version 1),
pour ne pas mêler à l'export du compte des données d'une autre nature, plus
fréquentes et plus lourdes (2,3 Mo pour une journée de siège).

Calcul pur, testé par [tests/plugin-swex.test.ts](tests/plugin-swex.test.ts) :

- **Les vues** : la **dernière** réponse de chaque écran (`Get…` d'un contenu
  de guilde, plus les informations de la guilde), **une par jeu de
  paramètres** — la défense de la base 12 ne remplace pas celle de la base 8.
  Le contenu est reconnu au nom de la commande (`GuildWar`, `Siege`, `Maze`,
  `Rival`, `GuildBoss`).
- **Les combats** : chacun à son début (`battle…Start…`) et à sa fin
  (`battle…Result…`), reliés par `battle_key` ; une fin sans début connu
  (plugin lancé en plein combat) est gardée seule. Les **300** plus récents.
  ⚠️ **Le siège n'envoie pas de fin** dans le journal relevé : son résultat se
  lit dans les vues qui suivent (carte, journaux de combat par deck ou par
  joueur).
- ⚠️ **Aucun secret, à aucune profondeur** : `session_key`,
  `session_key_node`, `infocsv`, `css`, `reqid`, `channel_uid` sont retirés
  des requêtes et des réponses gardées.
- **`depuisFichierGuilde`** reprend le fichier écrit plus tôt : le plugin
  redémarré garde l'historique des combats. Un autre format, une autre
  version ou un autre invocateur repart de zéro.

Sur une journée réelle de jeu : 96 vues (carte du siège, défenses de 19 bases,
journaux de combat, défenses alliées, guerre, labyrinthe, rivaux) et 18
combats. **L'app ne l'affiche pas encore** : ce sont les écrans d'un chantier
à venir.

### Limites connues

- L'expérience gagnée **hors combat** (bâtiments) n'apparaît qu'à la
  connexion suivante.
- Les préréglages de la RTA et du siège ne sont pas suivis ; l'app ne les relit
  qu'à l'import complet.
- Une commande renommée par Com2uS n'est plus suivie jusqu'à la connexion
  suivante, qui remet tout à plat.
