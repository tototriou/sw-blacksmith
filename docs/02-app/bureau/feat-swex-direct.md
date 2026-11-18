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

Deux types de données, chacun en **deux fichiers** : la **session en cours**
(`….live.jsonl`, une ligne ajoutée aussitôt par changement) et son
**archive** (`….jsonl.gz`).

1. **À la connexion** (`HubUserLogin`), pour chaque invocateur (`wizard_id`),
   une **nouvelle session** commence : l'état allégé du compte s'ajoute à son
   archive et le fichier live du compte repart de la réponse du serveur ; la
   session de guilde finie s'archive en entier, et une nouvelle commence.
2. **À chaque commande** de cet invocateur, il applique le moteur ; si le compte
   a changé, une ligne s'ajoute **aussitôt** à son fichier live ; si c'est un
   contenu de guilde, une ligne s'ajoute au fichier live de la guilde.
3. Avant la première connexion vue depuis le lancement de SWEX, il ne fait
   rien : il n'a pas de compte de départ.

Ses fichiers, dans **son dossier** à lui (`plugin-swex/source/fichiers.ts`) :

```
Summoners War Exporter Files/          ← le dossier de SWEX (son réglage)
  tototriou-12889591.json              ← l'export de ProfileExport
  SWBlacksmith/
    tototriou-12889591/                ← un dossier par invocateur
      compte.live.jsonl                ← le compte : la session en cours
      compte.jsonl.gz                  ← son archive : un état par connexion
      guilde.live.jsonl                ← la guilde : la session en cours
      guilde.jsonl.gz                  ← son archive : chaque session, en entier
```

Pour le compte, c'est le **direct** qui compte (le stock de runes, de meules
et de gemmes pendant la partie), et l'archive n'en garde qu'un état par
connexion. Pour la guilde, c'est l'**historique** : tout est gardé.

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

- ⚠️ **Une seule file d'écritures**, compte et guilde ensemble : chaque ligne
  s'ajoute après la précédente et après l'en-tête de sa session ; une session
  s'archive avant que son fichier live ne reparte.

### La guilde : un fichier live, une archive complète

**`guilde.live.jsonl`** — la session en cours : un **en-tête**
(`type: 'session'`, format `swblacksmith/guilde-live`, version 1 :
l'invocateur, l'heure serveur de la connexion, la version du plugin), puis
**une ligne par événement** de guilde, ajoutée aussitôt (voir « Le contenu des
combats de guilde »).

**`guilde.jsonl.gz`** — l'archive : à la connexion suivante, la session finie
y est ajoutée **en entier**, en un bloc daté de sa plus ancienne à sa plus
récente heure serveur (`blocSessionGuilde`). Une dernière ligne à moitié
écrite est laissée ; une session sans événement n'est pas archivée. Rien
n'est plafonné : 3 sessions réelles (111 vues, 3 combats) pèsent 488 Ko
compressés.

- **Guilde désactivée dans SWEX** : aucun événement écrit ; à la connexion,
  la session finie s'archive et aucune autre ne commence. Réactivée en cours
  de session, le fichier live repart de son en-tête.

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

Ce qui disparaît a sa règle (`REGLES`) : runes et artéfacts vendus (lus
dans la requête), pierres vendues (le lot restant, ou retiré). Les monstres
retirés (mis en stock, sacrifiés, convertis) se lisent dans
`remove_unit_id_list` — ⚠️ **à toute profondeur** : rangés dans le stockage
(`MoveStorageFromTo`), ils sont dans `result_to.remove_unit_id_list` — et
dans `source_unit_list` (requête).

⚠️ **Le rachat** (`RepurchaseRune`) est hors lecture générale, comme tout ce
qui touche aux listes de rachat (des runes vendues) ; sa règle pose la rune
rachetée que donne sa réponse.

⚠️ **Une rune gagnée en combat** (`changed_item_list`) arrive avec des
sous-stats en deux cases, `[type, valeur]`, là où l'export en écrit quatre,
`[type, valeur, gemme, meule]` : le moteur complète par des zéros — une rune
qui vient de tomber n'est ni gemmée ni meulée.

### Vérifié par rejeu d'un journal réel

Un script hors dépôt rejoue le `full_log.txt` d'un compte réel dans le
plugin construit : à chaque connexion, le fichier live relu, puis l'état du
moteur, sont comparés au compte que renvoie le serveur (runes et leur place,
artéfacts, monstres, pierres, reliques). Le journal réel ne vient pas dans le
dépôt : il porte la clé de session du joueur. Les tests en reprennent chaque
piège sur un compte fabriqué.

Sur un journal de 3 885 échanges (trois intervalles entre connexions, 279, 192
et 994 lignes de changement) :

- **le fichier live relu est identique à l'état du moteur**, sur chaque
  intervalle ; le plugin écrit sans une erreur ;
- **le moteur est identique au serveur** sur les deux premiers intervalles
  (runes et leur place, artéfacts, monstres, pierres, reliques) ;
- sur le troisième, il garde 27 monstres (3★ et 4★, invoqués ou gagnés en
  donjon), 3 runes et un lot de pierres que le serveur n'a plus, et il lui
  manque 3 runes : **aucun échange du journal ne les mentionne** après leur
  arrivée — le journal n'a pourtant ni trou de temps ni échange illisible.
  Le moteur n'a rien à lire pour les suivre ; la connexion suivante remet
  tout à plat.

Trois écarts relevés ainsi ont été corrigés : les monstres rangés dans le
stockage, les runes gagnées en combat, le rachat (voir plus haut).

## Le contenu des combats de guilde — `plugin-swex/source/guilde.ts`

Siège, guerre de guilde, labyrinthe, rivaux, boss de guilde : rien de cela
n'est dans l'export. Le jeu ne l'envoie qu'en le **montrant** (carte du
siège, défenses d'une base, journaux de combat) ou en le **jouant** (début et
fin d'un combat). Le plugin le garde dans ses fichiers à part (« La guilde :
un fichier live, une archive complète »), pour ne pas mêler au compte des
données d'une autre nature, plus fréquentes et plus lourdes.

Calcul pur, testé par [tests/plugin-swex.test.ts](tests/plugin-swex.test.ts).
**L'écriture** — `evenementGuilde` fait, d'un échange réussi de l'invocateur
suivi, un **événement** : une ligne du fichier live, avec l'heure serveur, la
commande, le contenu, les paramètres de la requête et la réponse.

- **Trois sortes d'événements** : une **vue**, un écran que le jeu demande
  (`Get…` d'un contenu de guilde, plus les informations de la guilde) ; le
  **début** d'un combat (`battle…Start…`) et sa **fin** (`battle…Result…`),
  avec leur `battle_key`. Le contenu est reconnu au nom de la commande
  (`GuildWar`, `Siege`, `Maze`, `Rival`, `GuildBoss`).
- ⚠️ **Aucun secret, à aucune profondeur** : `session_key`,
  `session_key_node`, `infocsv`, `css`, `reqid`, `channel_uid` sont retirés
  des requêtes et des réponses gardées.

**La lecture** — `depuisLignesGuilde`, pour l'app : d'un fichier live ou du
texte de l'archive (plusieurs sessions à la suite ; seules celles de
l'invocateur demandé comptent), elle tire :

- **les vues** : la **dernière** réponse de chaque écran, **une par jeu de
  paramètres** — la défense de la base 12 ne remplace pas celle de la base 8 ;
- **les combats** : chacun à son début et à sa fin, reliés par `battle_key` ;
  une fin sans début connu (plugin lancé en plein combat) est gardée seule.
  ⚠️ **Le siège n'envoie pas de fin** dans le journal relevé : son résultat se
  lit dans les vues qui suivent (carte, journaux de combat par deck ou par
  joueur).

**L'app ne l'affiche pas encore** : ce sont les écrans d'un chantier à venir.

### Limites connues

- ⚠️ **Ce que le journal ne dit pas, le moteur ne le suit pas** : au rejeu
  d'un journal réel, des monstres, des runes et des pierres ont disparu ou
  sont apparus sans qu'aucun échange ne les mentionne (« Vérifié par rejeu
  d'un journal réel »). Rattrapé à la connexion suivante.
- L'expérience gagnée **hors combat** (bâtiments) n'apparaît qu'à la
  connexion suivante.
- Les préréglages de la RTA et du siège ne sont pas suivis ; l'app ne les relit
  qu'à l'import complet.
- Une commande renommée par Com2uS n'est plus suivie jusqu'à la connexion
  suivante, qui remet tout à plat.
