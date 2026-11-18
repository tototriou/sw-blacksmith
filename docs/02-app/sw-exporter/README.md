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
- **Ce que fait le plugin**, trois cartes : le compte en direct (meules,
  gemmes, améliorations, ventes, équipement, deux secondes plus tard) ; les
  combats de guilde (siège, guerre, labyrinthe), gardés pour les écrans de
  guilde à venir ; « Rien ne quitte ta machine » (deux fichiers dans un
  dossier `SWBlacksmith` du dossier de SWEX, rien d'envoyé, jamais la clé de
  session).
- **À l'ordinateur** : « Télécharger le plugin » (`Bouton href` +
  `telechargement`), et à côté le fichier et sa version
  (`SWBlacksmithLive.js · version X.Y.Z`, celle de l'app).
- **Au téléphone, pas de bouton** : « À installer depuis un ordinateur, à
  côté de SW Exporter. »
- **Sur le site seulement** : une phrase dit qu'il sert avec l'application de
  bureau — un navigateur ne peut pas lire un dossier de l'ordinateur — et
  « Télécharger l'application » mène à [Télécharger](../telecharger/). Dans
  l'app, ni la phrase ni le lien (la page Télécharger n'y existe pas).
- **Installer le plugin**, cinq étapes numérotées : installer SW Exporter
  (lien « SW Exporter sur GitHub », nouvel onglet ; garder ProfileExport
  activé) ; télécharger le plugin ; le déposer dans le dossier `plugins` de
  « Summoners War Exporter Files » ; redémarrer SWEX (le plugin apparaît
  activé, les combats de guilde se désactivent au même endroit) ; suivre le
  dossier dans l'app (Paramètres › Dossier SW Exporter).
- Deux cartes : **Mettre à jour le plugin** (il porte la version de l'app :
  le retélécharger à chaque version) et **Ce qui attend la connexion
  suivante** (l'expérience hors combat, les préréglages RTA et siège).

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
