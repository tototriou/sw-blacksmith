# Recommandations — gestes : déplier, ajouter un counter, éditer

Partie de [Siège · Recommandations](README.md). Le rendu de la page (les deux
vues, le volet d'une recommandation, la ligne d'un deck) :
[rendu-de-la-page.md](rendu-de-la-page.md).

## Déplier un deck

Dans la vue Decks, une recommandation choisie s'ouvre dans son volet, toujours
ouvert ; dans la vue Défenses, ses offenses s'ouvrent dans le volet de la
défense. **Chaque deck a son propre repli.**

- ⚠️ **Les decks sont repliés par défaut** : on voit la **liste des decks**,
  pas leur contenu, et on ouvre celui qui intéresse. Sans ça, une
  recommandation de 6 decks déroulait tout l'écran d'un coup.
- **Le chevron ET les portraits** forment une seule cible pour déplier
  (`aria-label` « Déplier ce deck » / « Replier ce deck »). ⚠️ **Aucun texte
  n'identifie le deck** : ses portraits (34 px, badge d'élément) portent seuls
  ce qu'un titre redoublerait, le nom en infobulle.
- **Déplier** montre, dessous, le détail : consignes du deck, les 3 monstres
  avec runage, stats et artéfacts (trois fiches côte à côte quand le volet a
  la place — requête de conteneur), « Fort contre » avec ses précisions.
- **Lead du leader** : affiché **sur le monstre** en slot 0, comme en siège et
  avec les mêmes composants ([LeadPill.tsx](../../../../src/components/siege/LeadPill.tsx)) —
  `LeadBadge` sur son portrait dans la ligne, `LeadPill` (icône + montant) sous
  son nom dans le détail. On doit voir de quel monstre vient le lead.
- ⚠️ **Une rangée qui finit sur un portrait garde la place de son icône
  d'élément**, qui dépasse de 4 px à droite (`-right-1` dans
  [MonsterAvatar](../../../../src/components/MonsterAvatar.tsx)) : `pr-1` sur
  l'enveloppe de chaque portrait (deck, défense, liste des défenses). Aucune
  icône ne chevauche sa voisine.
- **« Déplier / Replier tous les decks »** : en haut des decks, dès **2
  decks**. Au doigt, un lien souligné ; à la souris, un **bouton fantôme** de
  la librairie, toujours **au-dessus** des decks : en dessous, le clic le
  repousserait de toute la hauteur des decks dépliés.
- Un deck **en édition est toujours déplié**.
- État **local au volet** (`openDecks` = les decks ouverts), réinitialisé
  quand le **nombre de decks change** (les index se décalent à
  l'ajout/suppression).

« Exporter vers l'Optimizer » est présent sur chaque ligne de deck, repliée
ou dépliée, aux deux formats, dans les deux vues. Il importe ce seul deck avec
les exemplaires retenus par la confrontation, ouvre l'Optimizer et présente le
rapport en modale. Sans compte ou sans membre importable, il reste désactivé
avec sa raison ; un refus garde la page. Voir
[l'import d'équipes](../../optimizer/feat-import-equipes.md#exporter-la-pr%C3%A9pa-rta-et-un-deck-recommand%C3%A9).
⚠️ Ce qu'il dit (« Importe un compte… », « Aucun monstre importable ») se
calcule **à la lecture, pour les seuls decks affichés**, et se garde par deck
(identité de l'objet) : calculé pour tous les decks de toutes les
recommandations à chaque modification, il figeait la page sur un lot de
plusieurs centaines de decks.

## Ajouter un counter

⚠️ **Un bouton, « + Ajouter un counter », dans les deux vues, sans éditer la
recommandation** — au bout de la rangée des decks d'une recommandation (vue
Decks), au bout de la rangée au-dessus des offenses d'une défense (vue
Défenses : un deck contre CETTE défense ; désactivé sur « Sans défense
visée », avec sa raison). Il ouvre la fenêtre d'ajout
([AjoutCounter.tsx](../../../../src/components/siege/AjoutCounter.tsx)) :

- **Dans la recommandation** : un sélecteur, quand plusieurs recommandations
  visent la défense regardée.
- **Deux onglets**, de même hauteur réservée — la fenêtre est centrée, et un
  corps plus haut d'un onglet à l'autre la recentrait sous le clic :
  - **« Capture »** : une capture de l'écran de préparation d'un combat de
    siège, ou des trois attaquants seuls ;
  - **« Mes decks et équipes »** : un deck d'offense de siège ou une équipe de
    Mes équipes, pré-rempli
    ([import-deck-offense.md](import-deck-offense.md)) ; un clic ajoute.
- **« Deck vide »**, dans le pied, à côté d'« Ajouter ce counter » (toujours
  affiché, désactivé tant qu'aucune capture n'est lue).

### Depuis une capture

- ⚠️ **Coller d'abord** : une capture se prend dans le presse-papiers (Win +
  Maj + S, Impr. écran) bien plus souvent qu'elle ne se cherche dans un
  dossier. **Ctrl+V** marche dès que l'onglet est ouvert, sans rien viser ;
  le bouton **« Coller »** fait la même chose au doigt (le navigateur peut
  demander l'autorisation ; sans lecture du presse-papiers possible, il est
  désactivé et renvoie à Ctrl+V). **« Choisir un fichier »**, et le
  glisser-déposer sur la zone — avec son repli au doigt : toucher la zone
  ouvre le choix d'un fichier (la galerie, au téléphone).
- **La lecture** est celle du bot Discord, VIT facultative, dans un Web
  Worker : 1 à 3 s, l'écran ne fige pas
  ([feat-discord-capture.md](../../speed-tuning/feat-discord-capture.md#la-lecture-de-la-capture)).
  ⚠️ **La capture ne quitte jamais l'appareil.** Un refus dit pourquoi :
  écran non reconnu, pas une image, trop grande.
- **L'aperçu** : l'offense lue, la défense lue (ou ce que deviendra la
  défense visée sans elle). Un monstre presque à égalité avec un second
  candidat porte un ⚠, le second en infobulle.
- **Corriger** : toucher un portrait le sélectionne, et le sélecteur de
  monstre s'ouvre dans une rangée **réservée** sous la lecture (la fenêtre ne
  change pas de hauteur) ; un monstre choisi remplace celui de la place, sûr.
  Une **×** en bas à droite de chaque portrait vide sa place — en bas : en
  haut à droite il y a l'icône d'élément, en haut à gauche le ⚠. Dans la vue
  Decks, une capture sans défense montre trois places vides, à remplir pour
  donner une défense au deck.
- **Remplacer** : « Coller une autre capture », « Choisir un fichier » ou
  Ctrl+V, à tout moment — la lecture et ses corrections sont remplacées.
- **« Ajouter ce counter »** : un deck aux attaquants de la capture, dans
  l'ordre (leader en premier), **sans la VIT** (une recommandation décrit des
  minimums, pas les vitesses d'un compte). Sa défense visée :
  - **vue Decks** : la défense lue, s'il y en a une ;
  - **vue Défenses** : la défense regardée ; ⚠️ **si la capture en montre une
    autre**, une fenêtre la montre à côté de la défense regardée et propose
    **trois issues, aucune qui perde** : « Garder la défense regardée » (le
    défaut, qui reçoit le focus), « Prendre celle de la capture » (le volet
    passe alors sur cette défense) ou « Annuler ». Le même trio dans un autre
    ordre est la même défense (`cleEquipe`).

### Le deck ajouté

**Ajouté en fin de recommandation et ouvert en édition**, sans passer par
l'édition de la recommandation : sa page s'ouvre, puis il vient à l'écran.
⚠️ **Il reste affiché même si la recherche ou un filtre de verdict ne le
retiennent pas** : un counter tout juste ajouté s'édite à l'écran. Dans la vue
Défenses, rangée par reco, il prend place sous sa recommandation, après ses
autres offenses (l'ordre tenu, sinon, l'aurait mis dans une seconde bande).

## Une page de decks à la fois

⚠️ **Une recommandation n'a pas de taille plafond** : un lot importé d'un salon
Discord peut porter des centaines de decks. Les monter tous d'un coup
(portraits, pastilles, actions de chaque ligne) figeait la page et faisait
grimper la mémoire — 700 decks rendaient l'application inutilisable. Le calcul
est dans [pagesRecos.ts](../../../../src/lib/pagesRecos.ts) (pur, testé :
`pages-recos`).

- **20 decks par page** (`DECKS_PAR_PAGE`), aux deux formats, dans le volet
  d'une recommandation comme dans celui d'une défense ; 20 éléments par page
  dans les deux listes (`DEFENSES_PAR_PAGE`). Sous 21, **rien ne change** :
  aucune pagination n'apparaît.
- La barre de pages : **« 21–40 sur 700 »** puis le `Pager` de l'inventaire de
  runes (flèches, champ pour aller directement à une page — à 35 pages,
  avancer d'une flèche à la fois est intenable). **Au-dessus des decks**, à
  gauche de « Déplier tous les decks », sur la même rangée : elle ne bouge
  pas quand la page change de hauteur. **Répétée sous les decks**, sauf en
  édition.
- ⚠️ **Ce qui se pagine, ce sont les decks AFFICHÉS** : tous, ou ceux qu'une
  recherche ou un filtre de verdict retient. Une autre recherche repart de la
  première page. `di` reste l'index réel du deck (confrontation, édition,
  repli).
- ⚠️ **Le deck en édition est toujours rendu** : un deck ajouté ouvre la page
  qui le porte.
- Une liste qui raccourcit (deck supprimé) **retombe sur sa dernière page**
  (`pageBornee`) au lieu d'afficher une page vide.
- « Déplier tous les decks » déplie **tous** les decks affichés, pas
  seulement la page : on les retrouve dépliés en changeant de page.

## Trois niveaux d'édition, séparés

| Bouton | Où | Ce qu'il ouvre |
|--------|----|----------------|
| ✏️ « Éditer la recommandation » (en-tête du volet, ou menu de sa bande dans la vue Défenses) | recommandation | **nom, consignes générales** (l'auteur ne se saisit pas : [rendu-de-la-page.md](rendu-de-la-page.md#provenances-et-discord)) |
| ✏️ « Éditer ce deck » (sur sa ligne) | deck | **ses consignes, ses monstres, sets, artéfacts et stats** |
| **+ Défense** / ✏️ sur une vignette | défenses visées | **une** défense que ce deck bat — indépendant du deck |

⚠️ Le troisième est **volontairement détaché** du deuxième : ajouter une défense
qu'on vient d'affronter est un geste **de passage**, éditer les stats d'un deck
est un **travail de fond**. Il n'a d'ailleurs **pas de mode édition de bloc** —
juste un « + » qui ajoute et ouvre l'entrée créée
([defenses-visees.md](defenses-visees.md)). Ajouter un deck n'est pas non plus
un geste d'édition : « + Ajouter un counter » (plus haut).

- Éditer la recommandation **ne rend pas les decks modifiables** : les deux
  portées sont indépendantes.
- **Un seul deck en édition à la fois** (et une seule recommandation).
- **« Terminer » sur la recommandation termine aussi l'édition de ses decks** :
  un seul geste referme tout. Vaut également quand le board bascule l'édition
  vers **une autre** recommandation (effet sur `editing`, pas dans le
  `onClick`).
- **Créer une recommandation** l'ajoute avec un deck vide, ouvre la vue Decks
  sur elle, en édition (recommandation **et** son deck).
- La suppression d'un deck **se défait** (« Deck supprimé · Annuler ») au
  lieu de se confirmer ; celle d'une recommandation aussi.

### « Annuler les modifications » — sortir sans garder

Chaque modification s'enregistre **tout de suite** ; le ✓ termine l'édition en
gardant tout. Pendant une édition, un bouton **« Annuler les modifications »**
(icône ↶) termine l'édition en remettant ce qu'il y avait **à son ouverture**
— logique pure dans [annulerEdition.ts](../../../../src/lib/annulerEdition.ts) :

| Où | Ce qui revient | Ce qui reste |
|----|----------------|--------------|
| deck (sur sa ligne, juste avant le ✓) | consignes, monstres, sets, artéfacts, stats | les **défenses visées** — édition détachée, on ne défait pas l'une avec l'autre |
| recommandation (en-tête, juste avant le ✓) | nom, consignes générales, **et** le deck en cours d'édition s'il y en a un — symétrique de « Terminer », qui termine aussi le deck | les decks **ajoutés** pendant l'édition (on les retire avec « Supprimer ce deck ») |

- **Placé juste AVANT le ✓**, à une place **réservée** même hors édition : le
  ✓ qu'on vient de toucher ne bouge pas.
- **Grisé tant que rien n'a changé** (comparaison par valeur : retaper la même
  chose n'est pas une modification).
- ⚠️ **Ni confirmation, ni notification.** Une confirmation serait un « OK »
  qui détruit ; une notification « Modifications annulées · Rétablir » ferait
  une **annulation d'annulation**.
- **Un deck tout juste ajouté** (création d'une recommandation, « + Ajouter un
  counter ») s'ouvre en édition : annuler le remet **comme à l'ajout** (vide,
  pré-rempli ou tel que lu sur la capture), il ne le retire pas.
- ⚠️ **Le nombre de decks change pendant une édition** (un autre deck
  supprimé, ou remis par « Annuler ») : les index se décalent, le deck mémorisé
  ne serait plus le même. L'édition se **termine** alors, modifications
  gardées — sauf pour le deck qu'on vient d'ajouter en fin de liste
  (`deckEditeApresChangement`).
- **Supprimer un deck termine l'édition** avant de le retirer : supprimer le
  dernier le remplace par un deck vide sans changer leur nombre, et l'édition
  resterait sinon ouverte sur ce deck vide, prête à recopier une partie du
  deck supprimé.

⚠️ **Un monstre choisi, le curseur passe au monstre suivant** : dans les 3
slots d'un deck comme dans les 3 monstres d'une défense visée, le champ du
**slot vide suivant** prend le focus — en bouclant sur ceux d'avant si on a
commencé par le milieu ; trio complet, le focus ne bouge pas. Calcul dans
[slotVideSuivant.ts](../../../../src/components/siege/slotVideSuivant.ts) (testé :
`siege-slot-suivant`), focus par le `jetonFocus` de
[MonsterPicker](../../../../src/components/MonsterPicker.tsx) — un jeton qui change
à chaque demande, car le champ suivant est DÉJÀ affiché (`autoFocus` n'agit
qu'au montage).

## Les icônes d'action

**Icônes nues** (sans cadre ni fond) dans les en-têtes et sur les lignes ; le
sens passe par l'**infobulle** et l'`aria-label` (obligatoire : une icône seule
n'est pas lisible au lecteur d'écran). À la souris, des carrés de 28 px aux
coins arrondis ([rendu-de-la-page.md](rendu-de-la-page.md#boutons-dicône-et-boutons-à-libellé)).

- **Recommandation** : ✏️ Éditer, puis le menu « ⋯ » — « Exporter en
  fichier », puis « Supprimer cette recommandation » (ou « Détacher de ce
  salon »). « Publier dans… » à côté, en bouton à libellé à la souris.
- **Deck** : la place réservée d'↶ et de 🗑 (visibles en édition), Exporter
  vers l'Optimizer, ✏️ Éditer ce deck.
- Faute de cadre pour marquer l'état actif, l'**édition en cours** se lit à
  l'icône qui devient un **✓ doré** (`text-star`) + `aria-pressed`. La couleur
  dorée est posée sur l'**icône**, pas sur le bouton : deux classes de couleur
  rivales sur le même élément n'ont pas d'ordre garanti dans la feuille.
- Les actions d'un en-tête sont sur la **même rangée que le titre**, à un
  endroit fixe : dans un `flex-wrap` unique, elles retomberaient sous le titre
  dès que la ligne est pleine, et changeraient de place d'une recommandation à
  l'autre selon la longueur du nom.
