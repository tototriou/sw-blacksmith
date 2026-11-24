# La sauvegarde de session

Voir aussi : [feat-import-compte/](feat-import-compte/README.md) (le compte importé), [../optimizer/ecran/equipement-actuel.md](../optimizer/ecran/equipement-actuel.md#équipement-actuel) (l'exemplaire, « Équipement actuel »).

Une session est l'état de l'app à un instant donné, dans un fichier que
l'utilisateur garde où il veut : de quoi reprendre plus tard là où il
s'était arrêté.

⚠️ **Dans l'application de bureau seulement.** Sur le site, aucun des accès
ci-dessous n'existe : ni bouton dans la barre du haut (aux deux formats), ni
ligne « Session » dans les Paramètres, ni action dans la palette, et Ctrl+S
y reste « Enregistrer la page » du navigateur, Ctrl+O « Ouvrir un fichier ».
`App.tsx` ne passe les actions de sauvegarde et de chargement que si
`estBureau()`.

## Sauvegarder

Quatre accès à « Sauvegarder », qui font tous la même chose
(`sauvegarderSession`, `src/App.tsx`) :

- **Barre du haut** (`src/components/TopBar.tsx`) : à l'ordinateur, le
  bouton « **Sauvegarder** » (icône `Save`) en tête de la zone droite, avant
  « Sauvegarder sous… » ; au téléphone, l'icône seule, nommée « Sauvegarder
  la session (Ctrl+S) », avant la loupe et le ⚙. Infobulle : « Sauvegarder
  dans <nom>.json (Ctrl+S) » quand une session est en cours, sinon
  « Sauvegarder la session dans un fichier (Ctrl+S) ». Sans `onSauvegarder`
  (le site), les deux ne sont pas rendus.
- **Ctrl+S** (⌘S) : l'écouteur clavier d'`App.tsx`, à côté de Ctrl K, sans
  Maj ni Alt ; une touche tenue ne sauvegarde qu'une fois.
- **Paramètres**, bloc « Mes données » (`SettingsList`,
  `src/components/SettingsMenu.tsx`) : une ligne « **Session** » et son
  bouton « **Sauvegarder** » (infobulle « Sauvegarder la session dans un
  fichier »), avant « Tout supprimer », qui reste la dernière ligne du
  bloc. Texte d'aide : « Tout l'état de l'app dans un fichier, enregistré où
  tu veux : le compte, ton travail, les réglages et l'état des outils. »
  Sans `onSauvegarderSession`, la ligne n'est pas rendue.
- **Palette Ctrl K** : l'action « **Sauvegarder la session** », sous-titrée
  « Tout l'état de l'app dans un fichier ».

**Tant que le compte conservé se relit**, au lancement (`accountHydrating`,
`src/App.tsx`), la sauvegarde attend : « Sauvegarder » et « Sauvegarder
sous… » de la barre du haut, et « Sauvegarder » des Paramètres, restent
affichés, désactivés, avec l'infobulle « Ton compte se charge encore : la
sauvegarde attend qu'il soit relu. » (`sauvegardeIndisponible`) ; l'icône
du téléphone est désactivée aussi, son nom inchangé. Ctrl+S et l'action de
la palette ne font rien. Sinon la session écrite n'aurait pas de
compte, et elle remplacerait la session en cours, que le bureau a déjà
reprise.

`sauvegarderSession` compose la session, l'écrit (`ecrireSession`), puis
réécrit la session en cours (section suivante). Sans le pont du bureau
(`sessionBureau()`), elle ne fait rien.

Nom proposé : `swblacksmith-session-AAAA-MM-JJ-HHhMM.json`, à l'heure locale
du clic (`nomFichierSession`). Environ 2,7 Mo avec un vrai compte.

## La session en cours (application de bureau)

Le fichier que « Sauvegarder » réécrit sans rien demander. Les sessions
s'enregistrent dans le sous-dossier `sessions` du **dossier SW Blacksmith**.
Côté page : `useSessionEnCours` et `useEtatSession`
(`src/hooks/useSessionEnCours.ts`), le pont `sessionBureau()`
(`src/lib/bureau.ts`), la ligne « Dossier SW Blacksmith »
(`ReglageDossierSwblacksmith`, `src/components/SettingsMenu.tsx`) ; côté
bureau : `bureau/session.ts`
(boîtes de dialogue, messages, réglage) et `bureau/sessionPur.ts` (pur,
testé).

- **Le dossier SW Blacksmith** : Paramètres, bloc « Mes données », ligne
  « Dossier SW Blacksmith », juste après « Session », dans l'application de
  bureau seulement : « Retirer »
  (désactivé sans dossier, infobulle « Ne plus utiliser ce dossier : la
  prochaine session le redemandera ») et « Choisir… » (boîte « Dossier SW
  Blacksmith » du système, bouton « Choisir ce dossier », création de
  dossier permise). Dessous : le chemin, sinon « Choisis le dossier de SW
  Blacksmith : les sessions s'enregistrent dans son sous-dossier
  « sessions ». » (`presentationDossierSwblacksmith`). C'est un **réglage** :
  retenu dans `dossier-swblacksmith.json` (dossier des données,
  `{ "dossier": … }`) même sans « Garder mes données », et gardé par
  « Tout supprimer ». En changer ou le retirer ne change pas la session en
  cours : seules les sessions suivantes vont dans le nouveau dossier.
- **Aucune session au départ** : la première sauvegarde demande le dossier
  SW Blacksmith s'il n'y en a pas (la même boîte ; annulée, rien ne se
  passe), crée `sessions` au besoin, puis y écrit le nom daté proposé, sans
  autre question ; ce fichier devient la session en cours. Un nom déjà pris
  (deux sauvegardes dans la même minute) devient `<nom> (2).json`,
  `(3)`… (`cheminLibre`) : jamais d'écrasement.
- **« Sauvegarder »** réécrit la session en cours, sans boîte.
- **« Sauvegarder sous… »** (barre du haut à l'ordinateur, après
  « Sauvegarder », infobulle « Enregistrer la session dans un autre
  fichier, qui devient la session en cours (l'ancien n'est plus
  modifié) » ; palette, sous-titrée « Un autre fichier, qui devient la
  session en cours ») demande le dossier SW Blacksmith s'il n'y en a pas,
  puis ouvre la boîte « Sauvegarder la session sous » dans son dossier
  `sessions` (filtre `.json`, nom daté proposé, confirmation avant
  d'écraser) ; le fichier choisi devient la session en cours, l'ancien
  n'est plus touché. Absent du site. Un nom tapé sans `.json` le reçoit
  (`avecExtension`) ; si ce fichier-là existe déjà, la boîte n'a rien vu
  (sous Linux, elle n'ajoute pas l'extension du filtre) : une seconde
  question, « « <nom>.json » existe déjà. », demande « Annuler » (le défaut)
  ou « Remplacer » (`confirmationApresExtension`).
- **Après l'écriture**, la notification « Session enregistrée · <nom>.json »
  (`useNotifier`). **Un échec** (dossier disparu, accès refusé, disque
  plein…) ouvre une modale « La session n'a pas été enregistrée » avec la
  cause et « Fermer » ; la session en cours ne change pas. Le bureau rend le
  MOTIF de l'échec et le code d'erreur du système (`codeErreur`) ; la page
  rédige la cause dans sa langue (`messageEchecSession`, src/lib/bureau.ts) :
  celle de l'écriture (un dossier de session disparu renvoie vers
  « Sauvegarder sous… »), ou, quand le dossier SW Blacksmith ne peut pas
  recevoir `sessions`, « Le dossier SW Blacksmith ne peut pas recevoir la
  session : <raison>. Choisis-en un autre dans Paramètres › « Dossier SW
  Blacksmith ». » — « Sauvegarder sous… » échouerait pareil.
- **Écriture sûre** (`ecrireSansRisque`) : un fichier temporaire caché dans
  le même dossier, vidé sur le disque, puis renommé par-dessus l'ancien
  (renommage retenté cinq fois sur `EPERM`, `EBUSY`, `EACCES`). Un échec
  retire le temporaire et laisse l'ancien fichier intact.
- **La session en cours n'est retenue après fermeture qu'avec « Garder mes
  données »** : dans `session.json` du dossier des données
  (`{ "chemin": … }`). La page redit la conservation au chargement et à
  chaque changement (`retenir`) ; le fichier retenu n'est repris qu'à la
  première réponse, si elle est oui, et si le fichier existe encore.
  Introuvable (support pas encore monté, fichier déplacé), il n'est pas la
  session en cours mais **reste retenu** pour l'ouverture suivante, jusqu'à
  ce qu'une sauvegarde ou « Tout supprimer » le remplace.
  Conservation refusée : `session.json` est effacé, la session en cours ne
  vaut que jusqu'à la fermeture.
- **« Tout supprimer »** (Paramètres ; l'application de bureau n'a pas
  « Se déconnecter ») oublie la session en cours avant de recharger
  (`oublier`) : l'app repart vide, un Ctrl+S réécrirait la sauvegarde avec
  ce vide. Les fichiers de sessions et le dossier SW Blacksmith restent.
- **Une sauvegarde à la fois** : un Ctrl+S pendant une boîte ou l'écriture
  est ignoré, comme « Choisir… » pendant une sauvegarde.
- **Ce que le bureau vérifie** : l'expéditeur (la page de sa fenêtre) ; le
  texte, une session (`texteSessionValide` : JSON de format
  `swblacksmith/session`, 64 Mo au plus) ; le nom proposé, un nom de fichier
  `.json` sans séparateur ni caractère interdit (`nomProposeValide`) ; le
  chemin relu de `session.json`, absolu et en `.json`
  (`lireSessionRetenue`) ; le dossier relu, absolu (`lireDossierRetenu`).
  `FORMAT_FICHIER_SESSION` recopie `FORMAT_SESSION`, un test vérifie qu'ils
  concordent.
- **Messages** (`bureau/preload.ts`, objet `session`) : `etat()`,
  `surEtat(rappel)`, `retenir(oui)`, `sauvegarder(texte, nomPropose)`,
  `sauvegarderSous(texte, nomPropose)`, `charger()`,
  `confirmerChargement()`, `aCharger()`, `choisirDossier()`,
  `oublierDossier()`, `oublier()`. L'état vaut `{ chemin, nom, dossier }`
  et il est diffusé à chaque changement ; `sauvegarder` et
  `sauvegarderSous` rendent `enregistree` (avec l'état), `annulee` ou
  `echec` (avec le message) ; `charger` rend `lue` (le texte et le nom),
  `annulee` ou `echec` (`pas-une-session`, `lecture` et son code). Le
  fichier lu ne vit qu'en mémoire du processus principal, jusqu'à ce que la
  page redémarrée le demande (`aCharger`, une seule fois).

## Charger (application de bureau)

Quatre accès à « **Charger…** », qui font tous la même chose
(`chargerSession`, `src/App.tsx`) :

- **Barre du haut** : à l'ordinateur, le bouton « Charger… » (icône
  `FolderOpen`), avant « Sauvegarder », infobulle « Charger une session
  enregistrée, qui remplace l'état de l'app (Ctrl+O) » ; au téléphone,
  l'icône seule, nommée « Charger une session (Ctrl+O) », avant celle de
  « Sauvegarder ». Toujours disponible, même pendant que le compte conservé
  se relit.
- **Ctrl+O** (⌘O), sans Maj ni Alt ; une touche tenue ne charge qu'une fois.
- **Paramètres**, ligne « Session » : « Charger… » à côté de « Sauvegarder ».
- **Palette Ctrl K** : « Charger une session », sous-titrée « Reprendre une
  session enregistrée ».

Le geste :

1. Le bureau ouvre la boîte « Charger une session » dans le sous-dossier
   `sessions` du dossier SW Blacksmith (les Documents sans dossier), filtre
   `.json`, et lit le fichier (64 Mo au plus, format `swblacksmith/session`).
   Annulée : rien. Illisible : une modale « La session n'a pas été chargée »
   avec la cause, et rien ne change.
2. La page valide le fichier ENTIER (`lireSession`) avant que rien ne change ;
   refusé, la même modale dit pourquoi.
3. Si le travail a changé depuis la dernière sauvegarde, « Sauvegarder ta
   session ? » s'ouvre d'abord, avec ses mots à elle (« La session choisie va
   remplacer… ») : « Charger sans sauvegarder », « Annuler », « Sauvegarder
   et charger » (le défaut, qui ne perd rien).
4. ⚠️ **Une session qui porte un compte lâche l'invocateur suivi** du dossier
   SW Exporter (`aucunInvocateur`), comme un import par fichier : sinon son
   prochain export remplacerait le compte de la session.
5. Le fichier devient la **session en cours** (Ctrl+S le réécrit, retenu dans
   `session.json` avec « Garder mes données »), puis **la page redémarre**.

⚠️ **La session s'applique au redémarrage, AVANT le premier rendu**
(`src/lib/chargementSession.ts`, appelé par `main.tsx`, qui n'importe l'app
qu'ensuite) : des réglages se lisent au chargement de leur module (thème,
langue, mesure…), et recoller une quinzaine d'états à chaud aurait été
fragile. Au démarrage, la page demande au bureau la session choisie
(`aCharger`, une seule fois), la relit, puis :

- **le stockage** : TOUTES les clés de `CLES_SESSION`, une clé absente du
  fichier effaçant la valeur d'avant (`ecrireDepuisSession`,
  `usePersistence.ts`). Un réglage s'écrit tel quel ; le travail suit
  « Garder mes données » — accepté, sur le disque ; refusé, dans le miroir
  seulement. ⚠️ Les hooks du travail relisent donc leur état au démarrage
  par `lireTravail` (le miroir d'abord), jamais par `localStorage` seul ;
- **le compte** : écrit dans IndexedDB si la conservation est acceptée
  (effacé si la session n'en a pas), et relu par `App.tsx` depuis
  `sessionChargee()` dans les deux cas ;
- **la mémoire des outils** : posée dans `useStickyState`
  (`amorcerMemoire`) ;
- **l'Optimizer** : rejoué une fois le compte relu, par les `set…` de ses
  champs (`restaurerOptimizer`, `sessionOptimizer.ts`), dans l'ordre de
  `CHAMPS_OPTIMIZER_SESSION` ; une valeur d'une autre forme que l'état de
  l'écran est laissée.

Puis la notification « Session chargée · <nom>.json ». Ce qui n'a pas pu être
repris (compte d'un schéma périmé, critères de l'Optimizer illisibles ou d'une
autre forme) s'affiche dans une modale « Session chargée, en partie ».
L'empreinte de la dernière sauvegarde devient celle de la session chargée :
rien n'est à sauvegarder juste après.

## Changements non enregistrés (application de bureau)

Avant un changement de compte — choisir un autre invocateur du dossier SW
Exporter, ou un dossier —, l'app propose « Sauvegarder ta session ? » si le
travail a changé depuis la dernière sauvegarde ; « Sauvegarder et changer »
passe par `sauvegarderSession`, et ne change de compte que si la session
est écrite. Détail : [feat-import-compte/bouton-import.md](feat-import-compte/bouton-import.md), § « Le dossier SW
Exporter ».

- Chaque sauvegarde réussie retient l'**empreinte** de la session (`empreinteTravail`,
  `src/lib/session.ts`) : le stockage et les outils, sans la date, la
  version de l'app ni le compte. Elle n'est retenue qu'en mémoire, pour la
  durée de l'ouverture.
- Le travail a changé (`travailNonSauvegarde`) quand l'empreinte du moment
  diffère de la retenue ; sans sauvegarde depuis le lancement, dès qu'il y
  a une prépa RTA ou des équipes de siège.

## Ce que contient le fichier

**Ce que l'app garde quand on passe d'une page à l'autre, tel qu'il est au
moment du clic**, que « Garder mes données » soit activé ou refusé. Du JSON
compact (`composerSession`, `ecrireSession`, `src/lib/session.ts`) :

| Champ | Contenu | Lu dans l'app par |
|-------|---------|-------------------|
| `format`, `version` | `swblacksmith/session`, `2` pour toute session écrite | — |
| `enregistreeLe`, `versionApp` | date ISO du clic ; version de l'app | — |
| `stockage` | clé → valeur brute, pour les clés de `CLES_SESSION` : prépa RTA, ses catégories, ses deux points de retour ; siège défense et offense ; recommandations ; monstres perso ; listes de l'Optimizer ; thème, langue, score, overcap, adversaire de référence, builds les plus rapides (du JSON, relu et validé par `lireReglageBuildsRapides`), objectifs du compte (du JSON, relu par `lireObjectifsStockes`) | `lireTravail` (`usePersistence.ts`) : la dernière valeur écrite par `saveLocal`, gardée en mémoire même conservation refusée (`saveLocal` n'écrit alors rien sur le disque), sinon le stockage local ; `oublierLocal` efface les deux |
| `compte` | le compte importé (`StoredAccount`, schéma 7), ou `null` | le compte en mémoire de `App.tsx`, pas IndexedDB |
| `equipes` | les équipes de « Mes équipes » ([feat-equipes.md](../compte/feat-equipes.md)) ; absent d'une session plus ancienne, relu comme un tableau vide | `useEquipesEnregistrees` (`App.tsx`), en mémoire, pas IndexedDB |
| `outils.memoire` | clé → valeur de chaque `useStickyState`, sauf `STICKY_HORS_SESSION` (`sidebar.retractee`, `mobileNotice.ferme`, `ecranPartage.volets`) | `photographierMemoire` (`useStickyState.ts`) |
| `outils.optimizer` | les champs `CHAMPS_OPTIMIZER_SESSION` de `useOptimizerState` : monstre choisi et son exemplaire, set, conditions min/max, principales imposées, runes imposées, sous-propriétés verrouillées, artéfacts, relique, objectif et réglages de combat, exclusions, réglages avancés, tri | `photoOptimizer` (`sessionOptimizer.ts`) |

- `Set` et `Map` s'écrivent `{"$set": […]}` et `{"$map": [[clé, valeur]…]}`,
  à toute profondeur (`encoder`, `decoder`).
- Chaque champ de données d'`OptimizerState` est classé dans
  `CHAMPS_OPTIMIZER_SESSION` ou `CHAMPS_OPTIMIZER_HORS_SESSION` (interface,
  état passager, recherche et résultats) ; `tsc` échoue sur un champ non
  classé, un champ classé disparu, ou un champ de la session sans `set…`.
- **Pas dans le fichier** : la page affichée ; « Garder mes données » ; la
  barre latérale repliée et l'avertissement mobile fermé ; les résultats de
  l'Optimizer et ses builds épinglés (`epingles`, photographies de cartes
  et de leur recherche) ; ce qu'un écran oublie déjà en changeant de page.
- Une clé de stockage ou un état `useStickyState` ajoutés entrent dans
  `CLES_SESSION`, ou dans `STICKY_HORS_SESSION` s'ils ne doivent pas
  voyager.

Les mémoires de critères par membre et les équipes de l’Optimizer voyagent dans
`swblacksmith-optimizer-members-v1`, en plus de la clé historique des listes.
Le point unique de toutes les listes voyage aussi, dans
`swblacksmith-optimizer-backup-v1`, avec ses identités, contenus et rejets conservés.
Cette clé voyage comme texte opaque, même avec un JSON cassé : les listes et
les autres clés de la session restent relisibles. Le lecteur spécialisé du point
le conserve tel quel, le signale et désactive sa reprise s’il est illisible.
Toute session écrite porte la version 2, même sans mémoire ni équipe : un lecteur
de version 1 la refuse avec la demande de mise à jour existante, au lieu de
reprendre une partie du travail. Une session de version 1 reste relue par le
lecteur actuel ; réécrite, elle porte la version 2.

## Relire

`lireSession(texte)` lit et valide le fichier entier, et rend une session
avec ses avertissements, ou une erreur.

Les champs retirés `adaptiveTrancheWeighting` et `adapterArtefactsAuTri`
(« Adapter les artéfacts et reliques au tri ») d'une session historique sont
ignorés sans erreur ni avertissement, vrais ou faux : `garderChampsOptimizer`
ne conserve que `CHAMPS_OPTIMIZER_SESSION`. Il ne repart pas dans une
sauvegarde suivante. Un tri `vitesse` (objectif Vitesse, qui ne se trie
plus que par la colonne VIT) s'y relit `spd`, sans avertissement, par
`triDesResultats` (colonnesResultats.ts), à l'écriture comme à la lecture.

- **Refusé** : un texte qui n'est pas du JSON ou pas un objet ; un autre
  format ; une version qui n'est pas un entier ≥ 1, ou plus récente que
  `VERSION_SESSION` (« mets-la à jour pour la charger ») ; un `stockage`
  qui n'est pas un objet ; une valeur de stockage qui n'est pas un texte de
  la forme que son hook relit (`valeurStockageValide` : thème `auto`,
  `light`, `dark` ; score `eff`, `score` ; overcap et adversaire `0`, `1` ;
  le reste du JSON, sauf le texte opaque du point de sauvegarde Optimizer).
- **Lu, avec un avertissement** : un compte qui ne passe pas `compteValide`
  (schéma périmé) devient `null` ; une équipe qui ne passe pas
  `lireEquipeEnregistree` est laissée ; un `outils.optimizer` qui n'est pas un
  objet devient `null`.
- **Ignoré** : un champ inconnu ; une clé de stockage hors `CLES_SESSION` ;
  une clé de mémoire de `STICKY_HORS_SESSION` ; dans l'Optimizer, un champ
  hors `CHAMPS_OPTIMIZER_SESSION`.

Les codes d'erreur (`ErreurSession`) et d'avertissement
(`AvertissementSession`) sont rédigés par la page, dans sa langue
(`messageEchecChargement`, `src/lib/bureau.ts`).

Les compétences d'invocateur de l'Optimizer sont enregistrées sous `normal`
ou `guilde` (« Contenu normal » ou « Contenu de guilde »). La lecture traduit
la valeur `combat` en `normal`, comme les recettes et mémoires de membres.

## Vérifier

```
node tests/run.mjs session chargementsession allerretoursession restaureroptimizer messageechecchargement persistance optimizerexemplairemontage renduparametres rendubureautextes rendubarresession renduchangementcompte bureausession bureauswex
npm run bureau:preuve -- --session       # l'app, conservation refusée (après vite build et bureau:construire)
npm run bureau:preuve -- --conservation  # l'app, conservation activée : la session en cours survit à la fermeture
```

Tests unitaires : le format (aller-retour, refus, avertissements, compte
réel), `compteDeSession`, la photo de l'Optimizer, le miroir de
`saveLocal`, `exemplaireAuMontage`, et `bureau/sessionPur.ts` (relecture
de `session.json` et de `dossier-swblacksmith.json`, sous-dossier
`sessions`, nom libre, nom proposé, texte, ligne des Paramètres, messages
d'échec, écriture sûre sur un dossier temporaire, session la plus récente du
mode preuve). Le chargement (`tests/chargement-session.test.ts`) : la session
appliquée, conservation refusée (miroir seul, réglages écrits, clé absente
effacée, mémoire posée) puis acceptée (disque et IndexedDB) ; l'aller-retour
complet (écrite, relue, appliquée, recomposée : identique, `Set` et `Map`
compris) ; l'Optimizer
rejoué dans l'ordre, une valeur d'une autre forme laissée ; les messages d'un
chargement refusé. Tests de rendu : la ligne « Session » et son texte ;
« Charger… », « Sauvegarder » et « Sauvegarder sous… » de la barre du haut,
leur ordre et leurs infobulles dans l'app ; la garde « Sauvegarder ta
session ? » avant un chargement ; sur le site, l'absence de « Charger… » et
de « Sauvegarder » dans la barre (aux deux formats) et de la ligne
« Session » des Paramètres.

`--session` part d'un `session.json` laissé par une ouverture précédente
(il doit être oublié, son fichier jamais réécrit), sans dossier SW
Blacksmith, puis enchaîne Paramètres (le dossier est demandé), palette,
Ctrl+S, « Sauvegarder sous… » et « Sauvegarder » de la barre, « Retirer »
le dossier et Ctrl+S, puis un rechargement (la page repart vide) et Ctrl+O,
qui reprend la session la plus récente — prépa RTA et compte revenus, rien
sur le disque. ⚠️ **L'aller-retour complet** : avant le rechargement, de
vrais gestes enrichissent l'état (thème sombre par la palette, « Autoriser un
regemme différent » à l'onglet Optimisation, un monstre choisi dans
l'Optimizer), Ctrl+S écrit la RÉFÉRENCE ; après le chargement, les mêmes
écrans revisités, Ctrl+S la réécrit, et le script compare les deux fichiers
partie par partie — travail et réglages, compte, mémoire des écrans, critères
de l'Optimizer — en nommant chaque clé qui diffère. Après chaque geste, il
relève les fichiers écrits
et leur date, l'infobulle, la notification, la ligne « Dossier SW
Blacksmith », `session.json` et `dossier-swblacksmith.json`. En mode
preuve, aucune boîte ne s'ouvre : le dossier SW Blacksmith « choisi » est
`<dossier>/swblacksmith`, et « Sauvegarder sous… » rend
`<n>-<nom proposé>` dans son `sessions`. `--conservation` choisit une
session en cours au premier lancement, la retrouve au second et la
réécrit par Ctrl+S. Chaque fichier est relu par `lireSession`, sans
capture d'écran.
