# Ressources · Télécharger (`#/telecharger`)

Page du **site** qui propose l'**application de bureau** (Windows, Linux).
Rangée sous **Ressources**, sous « Nouveautés ». **Absente de l'app de
bureau** : ni entrée de navigation, ni lien, et l'adresse y retombe sur
l'accueil (`estBureau()`).

Fichiers : [TelechargerPage.tsx](src/pages/TelechargerPage.tsx) ·
[bureau.ts](src/lib/bureau.ts) (`TELECHARGEMENTS`, `DEPOT`) ·
[IconesSystemes.tsx](src/components/IconesSystemes.tsx) (logos) ·
[App.tsx](src/App.tsx) (route, `RESOURCES`). Application de bureau :
[bureau/](../bureau/).

## Contenu (de haut en bas)

- Titre « Télécharger », une phrase : l'app existe pour Windows et Linux,
  la même boîte à outils dans sa propre fenêtre.
- **Ce que l'app apporte**, trois cartes : sa propre fenêtre ; la mise à
  jour proposée — « c'est toi qui décides quand » ; « Local par
  défaut », comme le site : rien ne quitte la machine sans un geste de
  l'utilisateur.
- **À l'ordinateur** : « Télécharger pour Windows » et « Télécharger pour
  Linux (.deb) », boutons principaux (`Bouton href`, le **logo du système**
  en icône), puis la phrase SmartScreen avec les libellés de Windows —
  « Windows a protégé votre ordinateur », « Informations complémentaires »,
  « Exécuter quand même » (installeur non signé) —, puis la ligne Linux :
  « Le .deb s'installe sur Debian, Ubuntu et leurs dérivées. Pour une autre
  distribution : l'AppImage », dont « l'AppImage » est le lien du fichier.
- **Au téléphone, pas de boutons** : « À installer depuis un ordinateur
  Windows ou Linux. » — rien ne s'installe sur un téléphone.
- « Version proposée : vX.Y.Z » (la dernière **publiée** de
  `src/data/releases.ts`) et « Toutes les versions sur GitHub » (nouvel onglet).

## Règles

- ⚠️ **Un clic télécharge le FICHIER**, pas la page de la release :
  `…/releases/latest/download/SW-Blacksmith-Setup.exe`,
  `…/SW-Blacksmith.deb` et `…/SW-Blacksmith.AppImage`. Ces adresses ne sont
  fixes que parce que les fichiers n'ont **pas de numéro de version**
  (`artifactName` de `electron-builder.yml`) ; `tests/bureau-mise-a-jour.test.ts`
  vérifie qu'ils concordent.
- **Linux : le `.deb` en tête.** Il s'installe sans rien d'autre sur Debian
  et Ubuntu, où l'AppImage demande `libfuse2` et, sous Ubuntu 24.04, bute
  sur le bac à sable d'Electron ([bureau/](../bureau/) § « L'installeur »).
- Les liens répondent 404 tant que la dernière release publiée n'a pas
  d'installeur (avant la v2.0.0, ou les minutes où l'action GitHub les
  construit).
- Non retenus : expliquer la séparation des données site /
  app, l'aide Linux (installer le `.deb`, rendre l'AppImage exécutable).
- **Accueil** : un bouton « Télécharger l'application » dans le héros et la
  carte « Application de bureau » de la grille mènent ici — voir
  [accueil/](../accueil/).
