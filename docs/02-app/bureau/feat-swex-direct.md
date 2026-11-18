# Le compte en direct : le plugin SWEX « SW Blacksmith Live »

Partie de [L'application de bureau](README.md), § « Le dossier SW Exporter ».

SW Exporter (SWEX) n'écrit l'export du compte qu'à la **connexion** au jeu
(plugin ProfileExport). Une session de meulage, des runes vendues ou
équipées n'apparaissent donc dans « Mon compte » qu'à la connexion suivante.
Le plugin **SW Blacksmith Live** tient le compte à jour **pendant la partie**,
à partir de ce que le serveur renvoie à chaque commande.

Code : **`plugin-swex/`**, à la racine du dépôt, versionné avec l'app.

## Le plugin — `plugin-swex/source/plugin.ts`

Ce que SW Exporter charge depuis son dossier `plugins` : un **seul fichier**,
`SWBlacksmithLive.js`, assemblé par esbuild
(`scripts/lib/construirePluginSwex.mjs`, CommonJS, cible `node16` : SWEX
embarque son propre Electron, parfois ancien).

- **Émis par Vite** ([vite.config.ts](vite.config.ts), `pluginSwex`) : à la
  construction dans `dist/plugin-swex/SWBlacksmithLive.js` (non suivi, comme
  tout `dist/`) — le site le sert, l'app de bureau l'embarque —, et en
  développement à la même adresse, reconstruit à chaque demande. La page
  [SW Exporter](../sw-exporter/) le donne à télécharger. `npm run plugin-swex`
  le construit seul ; `node scripts/construire-plugin-swex.mjs <dossier>`
  l'écrit ailleurs.
- ⚠️ **Sa version est celle de l'app** (`package.json`), injectée à la
  construction (`__VERSION_PLUGIN__`), écrite dans sa description, en tête
  du fichier et dans la première ligne de chaque session (`plugin`) : de quoi
  la comparer, côté app, à celle de l'app. Un test le vérifie sur le fichier
  construit.
- Réglages dans SWEX : **activé**, et **combats de guilde** (tous deux par
  défaut). Description et libellés en anglais et en français : SWEX n'a qu'une
  langue.

Ce qu'il fait :

1. **À la connexion** (`HubUserLogin`), pour chaque invocateur (`wizard_id`),
   il repart de la réponse du serveur : l'état allégé du compte s'ajoute à
   l'**archive**, et une **nouvelle session** commence — le fichier live
   repart de cette connexion. Il reprend aussi le fichier de guilde déjà écrit.
2. **À chaque commande** de cet invocateur, il applique le moteur ; si le compte
   a changé, une ligne s'ajoute **aussitôt** au fichier live ; si le contenu de
   guilde a changé, il réécrit le fichier de guilde.
3. Avant la première connexion vue depuis le lancement de SWEX, il ne fait
   rien : il n'a pas de compte de départ.

Ses fichiers, dans **son dossier** à lui (`plugin-swex/source/fichiers.ts`) :

```
Summoners War Exporter Files/          ← le dossier de SWEX (son réglage)
  tototriou-12889591.json              ← l'export de ProfileExport
  SWBlacksmith/
    tototriou-12889591/                ← un dossier par invocateur
      compte.live.jsonl                ← la session en cours
      compte.jsonl.gz                  ← l'archive : un état par connexion
      guilde.json                      ← les combats de guilde
```

- ⚠️ **Hors de la racine** : l'app ne lit les exports (`<nom>-<id>.json`) qu'à
  la racine, les fichiers du plugin ne s'ajoutent jamais à la liste des
  comptes.
- **Le nom du dossier** d'un invocateur est celui de son export s'il est là
  (ProfileExport nettoie le pseudo à sa façon) — le plus récent s'il y en a
  plusieurs, après un changement de pseudo —, sinon le pseudo sans les
  caractères interdits.
- ⚠️ **Le lien est l'identifiant, pas le nom** : le nom n'est qu'une
  étiquette, qui peut différer de celui de l'export (première connexion avant
  que ProfileExport n'écrive, pseudo changé). C'est par le `-<id>` final que le
  dossier se relie à l'export. Le plugin tient **un dossier par
  identifiant** : si le nom a changé, l'ancien dossier est renommé, avec
  l'historique des combats de guilde ; si le renommage échoue (Windows, un
  fichier ouvert), il garde l'ancien.

### Le compte : un fichier live, une archive

**`compte.live.jsonl`** — la session en cours, en JSON Lines (un objet JSON
par ligne) :

- la **première ligne** (`type: 'connexion'`, format
  `swblacksmith/compte-live`, version 1) : le compte à la connexion — l'export
  **compact** (3,4 Mo là où ProfileExport, indenté, en écrit 8,2) et **sans
  la clé de session** —, l'invocateur, l'heure serveur et la version du
  plugin ;
- puis **une ligne par commande** qui a changé le compte
  (`type: 'changement'`) : l'heure serveur, la commande, l'**état final** de
  chaque objet touché (`maj`) et ce qui a disparu (`retires`). Quelques
  centaines d'octets — un monstre y figure sans les runes ni les artéfacts
  qu'il porte, qui y sont pour eux-mêmes.

L'app le relit en repartant de la connexion et en posant chaque changement
(`depuisLignesLive`, pur) : l'état final est celui que tient le plugin.

- ⚠️ **Écrit aussitôt, ligne à ligne** : rien n'est temporisé, une meule
  arrive dans le fichier dans la foulée. Seule la première ligne remplace le
  fichier, en **atomique** (`ecrireAtomique` : un fichier temporaire, puis
  renommé ; sous Windows, le renommage échoue tant qu'un autre programme lit
  le fichier — `EBUSY`, `EPERM`, `EACCES` — : on réessaie, de plus en plus
  tard). Une ligne qui s'ajoute n'en a pas besoin : **une dernière ligne
  incomplète s'ignore** à la lecture.
- ⚠️ **Une seule file d'écritures** : chaque ligne s'ajoute après la
  précédente, et après la première ligne de sa session, jamais avant. Les
  textes sont faits au moment de la commande, pas au tour d'écriture : le
  compte aura bougé entre-temps.
- ⚠️ **Le fichier a disparu** (dossier supprimé pendant la partie) : il repart
  de l'état tenu. Les lignes encore en file disent l'état final de ce qu'elles
  touchent : reposées après, elles ne changent rien.

**`compte.jsonl.gz`** — l'archive, **un état par connexion**, pour retracer
l'évolution du compte (courbes de runes, score, stock de meules et de
gemmes) :

- l'**état allégé** (`versEtatArchive`, format `swblacksmith/compte-archive`) :
  les runes, les artéfacts, les pierres et les monstres réduits (identifiant,
  espèce, étoiles, niveau). Les objets **bruts**, pas un score calculé : un
  changement de formule dans l'app vaut pour toute la timeline. Environ
  190 Ko compressé pour un compte de 3 253 runes ;
- pas le détail des actions : il ne sert qu'au direct ;
- ⚠️ **une reconnexion sans rien de changé n'ajoute rien** : l'empreinte de
  l'état, heure exclue, est celle du dernier bloc.

### L'archive — `plugin-swex/source/archive.ts`

Un fichier, fait de **blocs gzip ajoutés à la suite**, un par session. Le
format gzip permet d'enchaîner des blocs : `zcat`, 7-Zip ou le `zlib` de Node
relisent le tout comme un seul texte JSON Lines. La compression, d'un bloc
entier, divise la taille par dix (ligne par ligne, on perdrait plus de la
moitié du gain).

- ⚠️ **Chaque bloc dit sa taille, ses dates et son empreinte** dans un champ
  prévu par le format gzip (FEXTRA, sous-champ `SB` : version, taille du bloc,
  heures serveur de début et de fin, 8 octets de SHA-1), que les outils
  ignorent — le principe du format BGZF. En sautant d'en-tête en en-tête,
  lister les sessions coûte quelques octets lus par session, et on ne
  décompresse que celles qu'on demande (`parcourirArchive`, `lireEntete`).
- ⚠️ **Un ajout interrompu ne perd rien.** Un dernier bloc tronqué rendrait
  toute l'archive illisible d'un seul `gunzip` (`Z_BUF_ERROR`). Avant chaque
  ajout (`ajouterAuFichier`), la chaîne des en-têtes est parcourue : là où un
  bloc annonce plus d'octets qu'il n'en reste, ou n'a pas d'en-tête valide,
  l'archive est coupée. Un bloc dont l'empreinte est celle du dernier bloc
  n'est pas ajouté deux fois.
- **Pas de SQLite ni de format binaire** : le plugin tourne dans l'Electron de
  SWEX, ancien et de version inconnue — un module natif peut ne pas s'y
  charger, la version WebAssembly réécrit toute la base. Les formats binaires
  (MessagePack, CBOR) gagnent bien moins que la compression, et ne se lisent
  plus.

### Pour tous les fichiers

- ⚠️ **Jamais d'exception vers SWEX** : une erreur est écrite dans le journal
  de SWEX, et le plugin continue. Une commande qu'il ne comprend pas ne doit
  gêner ni le jeu ni les autres plugins.
- Le plugin construit est vérifié sous Node 18 : SWEX embarque un Electron
  ancien.

### Le fichier de guilde

`guilde.json`, réécrit en entier, **2 s** après le dernier changement, en
atomique, **une écriture à la fois** : deux écritures qui se chevauchent
partageraient le fichier temporaire, et la seconde ne le trouverait plus.
Demandée pendant une écriture, la suivante attend sa fin et écrit l'état le
plus récent.

**Installer à la main** : déposer `SWBlacksmithLive.js` dans
`Summoners War Exporter Files\plugins`, puis redémarrer SWEX. ProfileExport
doit rester activé : c'est lui qui écrit l'export de départ.

## Le moteur — `plugin-swex/source/etatDirect.ts`

Calcul pur, sans disque ni Electron, testé par
[tests/plugin-swex.test.ts](tests/plugin-swex.test.ts).

- **`depuisConnexion(réponse)`** part de la réponse de `HubUserLogin`.
  ⚠️ C'est **exactement** l'export de ProfileExport : mêmes clés, mêmes runes,
  monstres et pierres (vérifié sur un compte réel).
- **`appliquer(état, commande, requête, réponse)`** applique une commande
  réussie (`ret_code` 0) de l'invocateur suivi ; rend **ce qui a changé** (la
  ligne du fichier live), ou `null` si rien n'a bougé.
- **`versExport(état)`** rend le compte : la connexion, dont les monstres, les
  runes, les artéfacts, les pierres (`rune_craft_item_list`) et les reliques
  sont remplacés par l'état tenu. ⚠️ **Sans `session_key`,
  `session_key_node` ni `reqid`** : ProfileExport les écrit, le plugin jamais.
- **`ligneConnexion`**, **`depuisLignesLive`**, **`versEtatArchive`** : la
  première ligne du fichier live, sa relecture, l'état allégé archivé.

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

Un script hors dépôt rejoue le `full_log.txt` d'un compte réel dans le
plugin construit : à chaque connexion, le fichier live relu, puis l'état du
moteur, sont comparés au compte que renvoie le serveur (runes et leur place,
artéfacts, monstres, pierres, reliques). Le journal réel ne vient pas dans le
dépôt : il porte la clé de session du joueur. Les tests en reprennent chaque
piège sur un compte fabriqué.

Sur un journal de 3 885 échanges (trois intervalles entre connexions, 276, 192
et 990 lignes de changement) :

- **le fichier live relu est identique à l'état du moteur**, sur chaque
  intervalle ; le plugin écrit sans une erreur ;
- **le moteur s'écarte du serveur** sur quelques objets (voir « Limites
  connues ») : artéfacts et reliques exacts ; jusqu'à 27 monstres en trop
  sur 825, 25 runes sur 4 426, 5 lots de pierres sur 968.

## Le contenu des combats de guilde — `plugin-swex/source/guilde.ts`

Siège, guerre de guilde, labyrinthe, rivaux, boss de guilde : rien de cela
n'est dans l'export. Le jeu ne l'envoie qu'en le **montrant** (carte du
siège, défenses d'une base, journaux de combat) ou en le **jouant** (début et
fin d'un combat). Le plugin le garde dans un fichier à part,
**`guilde.json`**, à côté des fichiers du compte (format `swblacksmith/guilde-direct`, version 1),
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

- ⚠️ **Écarts du moteur relevés au rejeu d'un journal réel**, rattrapés à la
  connexion suivante :
  - un monstre invoqué puis rangé dans le stockage (`MoveStorageFromTo`)
    reste dans la box ;
  - après certains combats (`BattleDungeonResult_V2`), les runes de l'équipe
    diffèrent de celles du serveur (cause à établir) ;
  - une rune rachetée (`RepurchaseRune`, hors lecture) ne revient pas, et les
    meules qui la suivent non plus.
- L'expérience gagnée **hors combat** (bâtiments) n'apparaît qu'à la
  connexion suivante.
- Les préréglages de la RTA et du siège ne sont pas suivis ; l'app ne les relit
  qu'à l'import complet.
- Une commande renommée par Com2uS n'est plus suivie jusqu'à la connexion
  suivante, qui remet tout à plat.
