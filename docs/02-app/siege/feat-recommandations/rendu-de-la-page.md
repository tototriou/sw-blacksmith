# Recommandations — rendu de la page

Partie de [Siège · Recommandations](README.md).

## En-tête de la page et barre d'outils

⚠️ **En-tête BUREAU** — même règle que la RTA et Défense / Offense : le titre
« Recommandations », le compteur, puis les actions par `BarreActions` —
**toutes en boutons quand elles tiennent sur la ligne**, sinon **Importer** et
**Créer une recommandation** visibles, dans cet ordre, et **Tout exporter**,
**Tout effacer** (séparé, en `bad`) dans le menu « ⋯ » Plus d'actions. Aucune
action mise en avant. Au doigt, les actions sont dans le panneau « Options ».

⚠️ **À la souris, une seule barre d'outils sous l'en-tête** :
Vue (« Défenses » / « Decks ») · filet vertical · recherche par monstre et ses
trois cases · au bout, l'interrupteur « Confronter à mon compte »
([confrontation.md](confrontation.md)). Au doigt, la vue est un `Segmented`
pleine largeur sur la page (`data-vue-telephone`), et l'interrupteur passe dans
le panneau « Options ». La vue et l'interrupteur sont mémorisés ; à la toute
première arrivée, la vue Défenses.

## Les deux vues : une liste, un volet

⚠️ **Deux volets, dans les deux vues** — à gauche une liste, à droite le volet
de ce qu'on y a choisi (le premier tant qu'on n'a rien choisi) :

- **Défenses** ([VoletDefenses.tsx](../../../../src/components/siege/VoletDefenses.tsx)) :
  la liste des défenses visées, toutes recommandations confondues, les plus
  jouées d'abord, puis « Sans défense visée » ; le volet de la défense choisie
  et les offenses qui la battent — détail :
  [recherche-par-monstre.md](recherche-par-monstre.md#la-vue-défenses) ;
- **Decks** ([ListeRecos.tsx](../../../../src/components/siege/ListeRecos.tsx)) :
  la liste des recommandations (nom, nombre de decks — « N sur M » pendant une
  recherche —, provenance et état du salon, « Importée », bilan en miniature
  quand « Confronter » est allumé, repère des consignes) ; le volet de la
  recommandation choisie ([RecoCard.tsx](../../../../src/components/siege/RecoCard.tsx)),
  toujours ouvert.

⚠️ **Selon la place du CONTENEUR, pas de l'écran** (`@container`, seuil
`@3xl`) : la colonne des provenances prend déjà sa largeur à côté. Étroit
(téléphone, fenêtre étroite), la liste, puis l'élément touché à sa place, avec
un retour (← « Toutes les défenses », « Toutes les recommandations ») devant
son titre. Les deux listes se paginent (`DEFENSES_PAR_PAGE`, `pagesRecos.ts`).
Créer une recommandation, ou « Éditer la recommandation » depuis la vue
Défenses, ouvre la vue Decks sur elle, en édition.

## Provenances et Discord

Fichiers : [Provenances.tsx](../../../../src/components/siege/discord/Provenances.tsx),
[BandeauSalon.tsx](../../../../src/components/siege/discord/BandeauSalon.tsx),
[DialoguesDiscord.tsx](../../../../src/components/siege/discord/DialoguesDiscord.tsx),
[provenancesRecos.ts](../../../../src/lib/provenancesRecos.ts) (calcul pur),
[useDiscord.ts](../../../../src/hooks/useDiscord.ts). Ce que devient une
recommandation liée sur l'appareil :
[synchronisation-discord.md](synchronisation-discord.md).

- **Les provenances** : « Toutes les recommandations », « Sur cet appareil »,
  « Suivis », « Favoris » (application de bureau), puis un groupe par serveur Discord, une ligne par salon qui porte une
  recommandation, avec l'état de celle-ci (À jour, Modifiée, Conflit, Lecture
  seule ; pastilles colorées comme celles des decks). ⚠️ **À l'ordinateur, une
  colonne** à gauche du contenu, sous la barre d'outils (vue, recherche) ;
  **au téléphone, le même bloc EN TÊTE de la page**, au-dessus de la
  recherche, à plat (lignes de 40 px) avec le compte Discord en pied —
  ⚠️ aucun sélecteur à dérouler : la provenance choisie et les autres se
  voient d'un coup d'œil. La recherche porte sur la provenance choisie.
- **À l'arrivée sur la page : « Toutes les recommandations »**, une liste à
  plat : celles de cet appareil d'abord, puis celles des salons dans l'ordre
  de la colonne. Quand il y a des salons, chaque recommandation porte sa
  provenance (le salon, ou « Sur cet appareil ») et l'état de son salon — dans
  la liste de la vue Decks, dans son volet, et sur son bandeau dans la vue
  Défenses ; sans Discord, rien ne change. Un salon qui disparaît ramène à
  « Toutes ».
- **La provenance « Suivis »**, juste sous « Sur cet appareil », avec son
  compte : seulement les recommandations liées à un salon, tous salons
  confondus, serveur par serveur dans l'ordre de la colonne. Chaque carte y
  porte son salon et son état, comme dans « Toutes ». Sur le site comme dans
  l'application de bureau, **dès que la colonne a un salon** — jamais vide,
  donc ; le dernier salon détaché (depuis sa carte) la retire et ramène à
  « Toutes » (`provenanceValide`).
- **Favoris** : dans l'application de bureau seulement, une étoile devant
  chaque salon ; les favoris passent en tête de leur serveur. Aucun salon ne
  se masque.
  - **La provenance « Favoris »**, juste sous « Suivis », avec son
    compte : les recommandations des salons étoilés seulement, serveur par
    serveur dans l'ordre de la colonne (`recosFavorites`). Chaque carte y
    porte son salon et son état, comme dans « Toutes ».
  - ⚠️ **Toujours affichée dans l'application de bureau, même à 0** :
    apparaître à la première étoile, ou disparaître à la dernière retirée,
    décalerait les salons sous le clic de l'étoile. Vide, la page dit comment
    la remplir (« clique l'étoile d'un salon… »).
  - Sur le site, pas de favoris, donc pas de « Favoris » : une provenance
    « Favoris » y retombe sur « Toutes » (`provenanceValide`).
- **Le compte Discord, en pied de la colonne et du bloc du téléphone** : connecté,
  le nom, « Installer le bot sur ton serveur » (icône d'aide), « Actualiser »
  (relit les salons) et « Se déconnecter », avec l'heure de la dernière
  lecture ; sinon l'encart « Discord » : une phrase,
  « Se connecter à Discord » et « Installer le bot sur ton serveur ». Dans
  l'application de bureau sans chiffrement sûr (Linux sans trousseau), une
  ligne sous le nom dit que la connexion ne survivra pas à la fermeture.
- **Le bandeau d'un salon**, au-dessus de la carte quand on regarde un salon :
  serveur › salon, état, date de la version reçue et ce que l'état veut dire,
  puis « Publier » — « Fusionner » en conflit. « Publier » est toujours
  affiché, désactivé avec sa raison (à jour, lecture seule, hors connexion).
  Au téléphone, le bouton passe pleine largeur sous le texte.
- **Une recommandation liée ne se supprime pas** : dans son menu « ⋯ »,
  « Supprimer » devient « Détacher de ce salon » (icône de chaîne rompue),
  avec un dialogue ; elle passe dans « Sur cet appareil » et celle du salon
  reparaît.
- **« Publier dans… »** sur chaque recommandation de cet appareil : dans son
  volet, à la souris, un bouton à libellé au bout de l'en-tête ; au doigt, une
  icône du groupe d'actions ; dans la vue Défenses, la première entrée du menu
  « ⋯ » de son bandeau. Toujours affiché, désactivé hors connexion avec
  sa raison. Son dialogue liste les salons lisibles et ce que chacun porte ;
  un salon en lecture seule y est visible, désactivé. Un salon qui porte déjà
  une recommandation demande confirmation, dont le défaut est « Annuler » (on
  garde celle du salon).
- **L'auteur ne se saisit plus** : écrit par Discord à la publication, avec
  les contributeurs (« par Toto · avec Lulu ») ; un auteur déjà présent reste
  affiché, en lecture seule.
- **Dialogues** : « Se connecter à Discord » (ce qui est partagé, et
  l'avertissement sur la perte d'accès) avant de partir vers Discord ; dans
  l'application de bureau, « Coller le code de connexion » (les trois étapes,
  le champ, une ligne réservée pour un code refusé, « Rouvrir la page dans le
  navigateur » ; « Annuler » abandonne la connexion) ; sur le site, au retour
  d'une connexion demandée par l'application, l'avertissement « Ne donne ce
  code à personne », le code en lecture seule et « Copier le code » ; l'installation du bot (les cinq étapes du
  [guide](installer-le-bot.md), « Inviter le bot », qui ouvre l'invitation
  dans un nouvel onglet — dans le navigateur du système pour l'application de
  bureau —, « Le guide pas à pas, avec captures », qui mène à la page
  [Bot Discord](../../bot-discord/README.md), le lien vers le Discord de
  l'app, « Fermer ») ; la fusion (ce qui a passé seul, puis chaque
  élément à choisir, les deux versions côte à côte à l'ordinateur, l'une sous
  l'autre au téléphone ; « Appliquer » désactivé tant qu'un choix manque).
  Une publication refusée parce que le salon a changé ouvre la fusion.
- **Notifications** : une par lecture des salons, qui regroupe ce qui a
  changé, et rien quand rien n'a changé ; une par publication, refus ou
  panne. Le retour de l'autorisation (`?discord=refus`, `?discord=erreur`,
  leurs variantes `-bureau`, et `?discord-bureau=<code>`) se dit une fois,
  puis s'efface de l'adresse.

## Le volet d'une recommandation

Le volet ([RecoCard.tsx](../../../../src/components/siege/RecoCard.tsx)), en
bandes séparées d'un filet, de haut en bas :

1. ⚠️ **L'en-tête se lit de haut en bas, aux deux formats** : le **nom** en
   titre (deux lignes au plus) ; **dessous**, le nombre de decks, l'auteur et
   les contributeurs ; **enfin** la source et les autres étiquettes (son salon
   ou « Sur cet appareil » avec l'état du salon, « Importée »), quand il y en
   a. À la souris, une grille : au bout, sur toute la hauteur, « Publier
   dans… » (bouton **à cadre**), un filet vertical, ✎ « Éditer la
   recommandation » et le menu « ⋯ » (« Exporter en fichier », puis
   « Supprimer cette recommandation » — « Détacher de ce salon » pour une
   recommandation liée). Au doigt, les icônes restent à côté du titre. Le
   retour à la liste, quand le volet la remplace, se pose devant le titre.
2. **Les consignes générales, sur UNE ligne**, « lire » les ouvre en entier à
   la même place.
3. **Le bilan de la confrontation**, quand « Confronter » est allumé : une
   rangée de pastilles de verdict qui filtrent les decks juste en dessous
   ([confrontation.md](confrontation.md)).
4. **La rangée des decks**, toujours là : la pagination à gauche, « Déplier
   tous les decks » et, au bout à droite, **« + Ajouter un counter »** — au
   bout, il ne bouge pas quand la pagination ou « Déplier tous » apparaissent
   à sa gauche ([interactions.md](interactions.md#ajouter-un-counter)).
   « Déplier tous les decks » est en HAUT des decks — en bas, son clic le
   repousserait de toute la hauteur des decks dépliés (un clic ne déplace
   jamais ce qu'on vient de cliquer).
5. **Les lignes des decks**, bord à bord, sans rangée d'intitulés ; la même
   pagination en bas quand il y a plusieurs pages.

## La ligne d'un deck

⚠️ **UNE rangée souple, aux deux formats et dans les deux vues**
(`DeckBlock`) : chevron et portraits · les défenses battues (ou, dans la vue
Défenses, la fiabilité et la précision contre la défense regardée) · le
verdict et sa cause · les actions, au bout. Ce qui ne tient pas passe à la
ligne au lieu de se comprimer : la ligne vit dans un volet dont la largeur
dépend de l'écran ET de la colonne des provenances.

- ⚠️ **Un deck réduit est compact : ses portraits seuls**, ni noms ni runes —
  le nom passe en infobulle du portrait, et noms et runage s'écrivent dans le
  deck ouvert, sur la fiche de chaque monstre (parties titrées : Runage, Stats,
  Artéfacts ; le tableau des stats a son en-tête : Stat, Base + bonus ou
  Total, Actuel après une analyse).
- ⚠️ **Plusieurs défenses battues, autant que la place en laisse** : une
  vignette par défense — la note au-dessus (étoiles, ou « ☆ Noter »), les
  portraits dessous —, une, deux ou trois selon la largeur de la colonne
  (requêtes de conteneur), puis « … » quand il en reste. Toucher une vignette
  note SA défense ; « … » liste toutes les défenses du deck, chacune sa note
  ([defenses-visees.md](defenses-visees.md#fiabilité--quelle-offense-jouer-dabord)). Pendant une recherche,
  celles qui répondent passent d'abord.
- **Au téléphone, les défenses passent sur leur propre ligne**, pleine
  largeur, sous les portraits et les actions : à côté des actions, dont deux
  places sont réservées, il n'en tenait qu'une.
- ⚠️ **Les actions d'un deck sont sur SA LIGNE, replié ou non** : Exporter
  vers l'Optimizer, Éditer ce deck, Supprimer ce deck (toujours présent : la
  suppression se défait par la notification). **« Éditer ce deck » ouvre le
  deck en édition directement**, sans éditer la recommandation ni le déplier
  d'abord. Une place est **réservée** à « Annuler les modifications » et à la
  corbeille devant elles : invisibles hors édition, elles apparaissent en
  édition, et ✎ devient ✓ à la même place — aucun bouton ne bouge sous le
  clic. Aucune icône ne chevauche sa voisine.
- **« + Défense »** est un bouton `sm` pointillé à fond au bout de la rangée
  des défenses visées, dans le deck ouvert en édition : fantôme, il ne
  ressortirait pas.

## Boutons d'icône et boutons à libellé

⚠️ **À la souris, UN seul bouton d'icône sur toute la page** : un carré de
28 px aux coins arrondis, sans cadre ni fond, voile au survol — chevron de
chaque deck, Exporter, Éditer, Supprimer, retour à la liste. Les deux crayons
sont des `BoutonIcone`, le ✓ doré posé sur l'icône. « Publier dans… »,
« Déplier tous les decks » (bouton fantôme de la librairie) et « + Ajouter un
counter » ont la même hauteur de 28 px. Cette règle ne vaut qu'à la souris.

**28 px de haut pour tout bouton à libellé et toute pastille de filtre**, à la
souris (`BOUTON_LG`) — « + Ajouter un counter », + Set, + Possibilité, les
pastilles de verdict, « Tout afficher » (bouton fantôme). Le ✓ « Terminer » d'une défense est un `BoutonIcone`, de la
taille de la corbeille voisine. Restent à part, et c'est
voulu : **« + Défense »** au doigt (la hauteur des vignettes qu'il prolonge ;
à la souris, bouton `sm` pointillé à fond, voir plus haut), les
**croix posées dans une puce** (set, propriété d'artéfact, monstre d'une
défense — `serre`, 20 px, la puce est plus petite qu'un bouton), le **crayon
posé sur le coin d'une vignette**, la **grille des sets** (icônes du jeu) et
les **liens dans une phrase** (« Chercher partout », « Effacer la
recherche »).

## Couleurs et pastilles de statut

⚠️ **Couleurs : pas d'aplats teintés.** Si le volet d'une recommandation,
chaque deck et chaque monstre se teintaient chacun en vert / orange / rouge,
une page confrontée deviendrait un patchwork :

- volets **neutres** (fond de panneau, contour discret) ; le statut d'un deck
  ou d'un monstre se lit au **contour** (au doigt) et aux **pastilles** —
  même règle que les équipes de siège ;
- ⚠️ **les pastilles de statut sont COLORÉES en entier**
  (`.pill.good/.warn/.bad` : fond doux du ton, texte du ton, sans contour) —
  la pastille Verdict de chaque ligne de deck **et les pastilles de filtre du
  bilan**, colorées dès le repos pour que le bilan et les decks en
  dessous parlent la même couleur — enclenchée, une pastille de filtre prend
  en plus le contour de son ton, seul marqueur d'état. Une couleur réduite à
  un point de 6 px ne serait pas assez vive. Non analysé : neutre. Le point
  reste dedans (son creux distingue « monstre manquant » de « à revoir »).
  `PASTILLE_STATUT` dans RecoCard.tsx ; contrastes texte / fond doux mesurés
  dans les deux thèmes, 4,63:1 au plus bas ;
- le bilan dans la liste de la vue Decks : un point et un compte par verdict
  (`BilanMini`) ;
- jetons de sets et de propriétés d'artéfact, rapport d'import : les **fonds
  doux** (`good-soft`, `warn-soft`, `bad-soft`) avec le texte à l'encre (les
  filtres de verdict ont le texte de leur ton, voir ci-dessus). Contrastes
  mesurés, 4,91:1 au plus bas (`warn` ocre sur `warn-soft`, Atelier ; le rouge
  `bad` fait 5,53 sur `bad-soft` en Forge) ;
- « Importée » : pastille neutre (un contour d'accent la ferait passer pour
  un élément sélectionné).
