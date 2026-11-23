# Ressources · SW Exporter (`#/sw-exporter`)

Page qui présente le **plugin SWEX « SW Blacksmith Live »**, le donne à
télécharger et explique son installation pas à pas. Rangée sous
**Ressources**, après « Nouveautés ». **Sur le site ET dans l'app de
bureau** : c'est l'app de bureau qui se sert du plugin (elle suit le dossier
de SWEX), le site ne fait que l'expliquer.

Fichiers : [SwExporterPage.tsx](src/pages/SwExporterPage.tsx) ·
[pluginSwex.ts](src/lib/pluginSwex.ts) (adresse du fichier, lien vers SWEX) ·
[App.tsx](src/App.tsx) (route, `RESOURCES`). Le plugin lui-même :
[bureau/feat-swex-direct.md](../bureau/feat-swex-direct.md).

## Contenu (de haut en bas)

- Titre « SW Exporter », une phrase : SWEX lit le compte depuis le jeu et
  l'enregistre dans un fichier, que l'app importe ; son plugin le tient à jour
  pendant la partie.
- **Ce que fait le plugin**, quatre cartes, deux par ligne à partir de
  640 px, l'une sous l'autre au téléphone : le compte en direct (meules,
  gemmes, améliorations, ventes, équipement, pendant la partie) ; les
  combats de guilde (siège, guerre, labyrinthe), d'où viennent les
  statistiques de siège ; l'arène dimensionnelle (sa box, gardée à
  l'ouverture du mode puis suivie) ; « Rien ne quitte ta machine » (ses
  fichiers dans un dossier `SWBlacksmith` du dossier de SWEX, rien d'envoyé,
  jamais la clé de session).
- **À l'ordinateur** : « Télécharger le plugin » (`Bouton href` +
  `telechargement`), et à côté le fichier et sa version
  (`SWBlacksmithLive.js · version X.Y.Z`, celle de l'app).
- **Au téléphone, pas de bouton** : « À installer depuis un ordinateur, à
  côté de SW Exporter. »
- **Sur le site seulement** : une phrase dit qu'il sert avec l'application de
  bureau — un navigateur ne peut pas lire un dossier de l'ordinateur — et
  « Télécharger l'application » mène à [Télécharger](../telecharger/). Dans
  l'app, ni la phrase ni le lien (la page Télécharger n'y existe pas).
- **Dans l'app de bureau seulement**, la carte **« Le plugin sur cet
  ordinateur »** (`EtatPlugin`, `CartePlugin`) :
  - le plugin installé dans le dossier `plugins` de SWEX, comparé à l'app :
    « Installé · version X · à jour », « … · la version Y est disponible »,
    « … plus récente que l'application », ou « Pas trouvé » ; ancien ou
    absent, **« Télécharger la dernière version »** (le fichier que sert
    l'app, enregistré sous son nom) ;
  - la session en direct et l'heure de sa dernière action, ou comment en
    avoir une ;
  - **« Mettre à jour mon compte »** : reporte la session sur le compte de
    l'app, sans se reconnecter — désactivé sans session ; le résultat s'écrit
    sous le bouton, à une place réservée, sans notification. Détail :
    [feat-swex-direct.md](../bureau/feat-swex-direct.md) § « Mettre à jour mon
    compte ».
  - Sans dossier SWEX ni invocateur suivis : une ligne dit que le plugin et le
    direct n'en marchent pas, et renvoie aux Paramètres (étapes 6 et 7).

  L'état est redemandé à l'ouverture de la page : un plugin installé depuis
  le lancement compte.
- **Installer le plugin**, ouvert par un **avertissement** : les étapes 6 et 7
  sont indispensables — sans dossier ni invocateur choisis, l'application ne
  lit rien de ce que le plugin enregistre (ni direct, ni guilde, ni arène
  dimensionnelle). Puis sept étapes numérotées, chacune un seul geste :
  1. installer SW Exporter (lien « SW Exporter sur GitHub », nouvel onglet ;
     garder ProfileExport activé) ;
  2. télécharger le plugin ;
  3. le déposer dans le sous-dossier `plugins` de « Summoners War Exporter
     Files » (par défaut dans les Documents) ;
  4. redémarrer SWEX (le plugin apparaît activé ; le suivi des combats de
     guilde s'y coupe) ;
  5. se connecter au jeu : SWEX écrit l'export du compte, le plugin commence
     à suivre ;
  6. choisir le dossier dans l'app (Paramètres › Application › Dossier SW
     Exporter › « Choisir… ») — « Summoners War Exporter Files » lui-même,
     pas `plugins` ;
  7. choisir l'invocateur juste en dessous ; une liste vide renvoie à
     l'étape 5.
- **Utiliser le plugin**, trois étapes, sur le site comme dans l'app :
  activer « Direct » dans « Mon compte » (coupé par défaut, sans
  notification) ; le direct ne change que « Mon compte » ; « Mettre à jour mon
  compte » reporte la session sans reconnexion, et rien n'est écrit dans le
  dossier de SWEX.
- **Ça ne marche pas ?**, quatre cas, chacun titré par le message que
  l'utilisateur voit : « Aucun export de compte à la racine de ce dossier. »
  (mauvais dossier, ou pas encore connecté) ; « Pas trouvé dans le dossier
  plugins de SW Exporter. » (fichier hors du `plugins` du dossier choisi) ;
  « Aucune session en direct » (redémarrer SWEX, vérifier le plugin activé,
  se reconnecter) ; une erreur « SWBlacksmithLive » dans le journal de SWEX
  (plugin plus ancien que l'app). Un test vérifie que les titres reprennent
  les messages de l'app.
- Deux cartes : **Mettre à jour le plugin** (il porte la version de l'app :
  le retélécharger à chaque version) et **Ce qui attend la connexion
  suivante** (ce que le plugin ne suit pas encore : favoris et préréglages
  RTA, decks, défense de siège, verrous de runes, expérience hors combat).

## Règles

- ⚠️ **Le bouton ENREGISTRE le fichier** (`download`, l'axe `telechargement`
  du `Bouton`) : un `.js`, le navigateur l'ouvrirait comme du texte à la place
  de l'app.
- ⚠️ **L'adresse du fichier** (`CHEMIN_PLUGIN_SWEX`, dans le dossier
  `plugin-swex` du site) est celle où
  Vite l'émet à la construction et le sert en développement
  ([vite.config.ts](vite.config.ts)) ; l'app de bureau sert le même `dist`.
  Un test vérifie que la page et la construction donnent la même.
- Les noms de SWEX (« SW Exporter », « ProfileExport », « plugins »,
  « Summoners War Exporter Files ») ne se traduisent pas.
- **Accueil** : une pastille « SW Exporter en direct », sur le site comme dans
  l'app — voir [accueil/](../accueil/).
