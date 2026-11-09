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
Vue (Attaque / Défense) · filet vertical · recherche par monstre et ses trois
cases, sur la même ligne ; « Rôle » passe dessous quand une recherche est
posée.

## Provenances et Discord

Fichiers : [Provenances.tsx](../../../../src/components/siege/discord/Provenances.tsx),
[BandeauSalon.tsx](../../../../src/components/siege/discord/BandeauSalon.tsx),
[DialoguesDiscord.tsx](../../../../src/components/siege/discord/DialoguesDiscord.tsx),
[provenancesRecos.ts](../../../../src/lib/provenancesRecos.ts) (calcul pur),
[useDiscord.ts](../../../../src/hooks/useDiscord.ts). Ce que devient une
recommandation liée sur l'appareil :
[synchronisation-discord.md](synchronisation-discord.md).

- **Les provenances** : « Toutes les recommandations », « Sur cet appareil »,
  puis un groupe par serveur Discord, une ligne par salon qui porte une
  recommandation, avec l'état de celle-ci (À jour, Modifiée, Conflit, Lecture
  seule ; pastilles colorées comme celles des decks). ⚠️ **À l'ordinateur, une
  colonne** à gauche du contenu ; **au téléphone, un sélecteur** pleine
  largeur au-dessus de la liste (salon, serveur, état), qui ouvre la même
  liste dans une feuille. La barre d'outils (vue, recherche) reste au-dessus
  des deux et porte sur la provenance choisie.
- **À l'arrivée sur la page : « Toutes les recommandations »**, une liste à
  plat : celles de cet appareil d'abord, puis celles des salons dans l'ordre
  de la colonne. Quand il y a des salons, chaque carte porte sa provenance
  (le salon, ou « Sur cet appareil ») et l'état de son salon ; sans Discord,
  rien ne change sur les cartes. Un salon qui disparaît ramène à « Toutes ».
- **Favoris** : dans l'application de bureau seulement, une étoile devant
  chaque salon ; les favoris passent en tête de leur serveur. Aucun salon ne
  se masque.
- **Le compte Discord, en pied de la colonne et de la feuille** : connecté,
  le nom, « Actualiser » (relit les salons) et « Se déconnecter », avec
  l'heure de la dernière lecture ; sinon l'encart « Discord » : une phrase,
  « Se connecter à Discord » et « Installer le bot sur ton serveur ». ⚠️ Dans
  l'application de bureau, « Se connecter » reste affiché, désactivé avec sa
  raison, jusqu'à ce qu'elle ait sa propre session.
- **Le bandeau d'un salon**, au-dessus de la carte quand on regarde un salon :
  serveur › salon, état, date de la version reçue et ce que l'état veut dire,
  puis « Publier » — « Fusionner » en conflit. « Publier » est toujours
  affiché, désactivé avec sa raison (à jour, lecture seule, hors connexion).
  Au téléphone, le bouton passe pleine largeur sous le texte.
- **Une recommandation liée ne se supprime pas** : sa corbeille devient
  « Détacher de ce salon » (icône de chaîne rompue), avec un dialogue ; elle
  passe dans « Sur cet appareil » et celle du salon reparaît.
- **« Publier dans… »** sur chaque recommandation de cet appareil : à la
  souris, un bouton à libellé près d'« Analyser mes decks » ; au doigt, une
  icône du groupe d'actions. Toujours affiché, désactivé hors connexion avec
  sa raison. Son dialogue liste les salons lisibles et ce que chacun porte ;
  un salon en lecture seule y est visible, désactivé. Un salon qui porte déjà
  une recommandation demande confirmation, dont le défaut est « Annuler » (on
  garde celle du salon).
- **L'auteur ne se saisit plus** : écrit par Discord à la publication, avec
  les contributeurs (« par Toto · avec Lulu ») ; un auteur déjà présent reste
  affiché, en lecture seule.
- **Dialogues** : « Se connecter à Discord » (ce qui est partagé, et
  l'avertissement sur la perte d'accès) avant de partir vers Discord ;
  l'installation du bot ; la fusion (ce qui a passé seul, puis chaque
  élément à choisir, les deux versions côte à côte à l'ordinateur, l'une sous
  l'autre au téléphone ; « Appliquer » désactivé tant qu'un choix manque).
  Une publication refusée parce que le salon a changé ouvre la fusion.
- **Notifications** : une par lecture des salons, qui regroupe ce qui a
  changé, et rien quand rien n'a changé ; une par publication, refus ou
  panne. Le retour de l'autorisation (`?discord=refus`, `?discord=erreur`)
  se dit une fois, puis s'efface de l'adresse.

## En-tête d'une recommandation et actions d'un deck

⚠️ **À la souris, l'en-tête d'une recommandation tient sur UNE ligne** :
chevron · titre · Importée · decks · auteur, un ressort, puis **au bout**
« Analyser mes decks » (bouton **à cadre**, comme les autres boutons à libellé
de la page : fantôme, il ne se lirait pas comme un bouton parmi les icônes
nues), un filet vertical et Exporter / Éditer / Supprimer. Au doigt, l'en-tête
tient sur deux rangées.

⚠️ **À la souris, le crayon d'un deck n'est pas dans la ligne** : la ligne n'a
que ses quatre colonnes (chevron · offense · fort contre · verdict, ce dernier
aligné à droite), et l'édition est **« Éditer ce deck » écrit en toutes
lettres, en PIED du détail déplié**, à droite, sous un filet (en édition :
« Terminer l'édition de ce deck »), avec **« Supprimer ce deck » à l'autre
bout, TOUJOURS présent** — la confirmation est le garde-fou. Au doigt aussi,
la corbeille suit le crayon en permanence. Ces boutons ont un **CADRE** à la
souris, comme les autres boutons à libellé : `BoutonIcone`
`libelleALaSouris`. Replié, un deck ne montre donc pas d'action d'édition : on
le déplie d'abord. C'est le MÊME bouton qu'au doigt, placé sur la 3ᵉ rangée de
la grille du deck. **En édition de la recommandation**, Ajouter un deck vide
et Importer un deck d'offense forment le **pied du tableau des decks**, à
droite, en boutons **pointillés à fond**. **« + Défense »** est un bouton `sm`
pointillé à fond au bout de la rangée des défenses visées : fantômes, ces
trois boutons ne ressortiraient pas. « Déplier tous les decks » est en HAUT du
tableau — en bas, son clic le repousserait de toute la hauteur des decks
dépliés (un clic ne déplace jamais ce qu'on vient de cliquer).

## Boutons d'icône et boutons à libellé

⚠️ **À la souris, UN seul bouton d'icône sur toute la page** : un carré de
28 px aux coins arrondis, sans cadre ni fond, voile au survol — chevron de la
recommandation, chevron de chaque deck, Exporter, Éditer, Supprimer
(`ICONE_LG` dans
[RecoCard.tsx](../../../../src/components/siege/RecoCard.tsx)). Les deux
crayons sont des `BoutonIcone`, le ✓ doré posé sur l'icône. « Analyser mes
decks » et « Déplier tous les decks » (bouton fantôme de la librairie) ont la
même hauteur de 28 px. Cette règle ne vaut qu'à la souris.

En édition : **28 px de haut pour tout bouton à libellé et toute pastille de
filtre**, à la souris (`BOUTON_LG`) — Ajouter un deck vide, Importer un deck
d'offense, + Set, + Possibilité, les pastilles de verdict, « Tout afficher »
(bouton fantôme). Le ✓ « Terminer » d'une défense est un `BoutonIcone`, de la
taille de la corbeille voisine. Restent à part, et c'est
voulu : **« + Défense »** au doigt (la hauteur des vignettes qu'il prolonge ;
à la souris, bouton `sm` pointillé à fond, voir plus haut), les
**croix posées dans une puce** (set, propriété d'artéfact, monstre d'une
défense — `serre`, 20 px, la puce est plus petite qu'un bouton), le **crayon
posé sur le coin d'une vignette**, la **grille des sets** (icônes du jeu) et
les **liens dans une phrase** (« Chercher partout », « Effacer la
recherche »).

## Couleurs et pastilles de statut

⚠️ **Couleurs : pas d'aplats teintés.** Si la carte d'une recommandation,
chaque deck, chaque monstre et l'encart de synthèse se teintaient chacun en
vert / orange / rouge, une page analysée deviendrait un patchwork :

- cartes **neutres** (fond de panneau, contour discret) ; le statut d'un deck
  ou d'un monstre se lit au **contour** (au doigt) et aux **pastilles** —
  même règle que les équipes de siège ;
- ⚠️ **les pastilles de statut sont COLORÉES en entier**
  (`.pill.good/.warn/.bad` : fond doux du ton, texte du ton, sans contour) —
  la pastille Verdict de chaque ligne de deck, les puces de la carte repliée
  (un deck, ou une défense en vue Défense) **et les pastilles de filtre du
  résumé d'analyse**, colorées dès le repos pour que le résumé et les decks en
  dessous parlent la même couleur — enclenchée, une pastille de filtre prend
  en plus le contour de son ton, seul marqueur d'état. Une couleur réduite à
  un point de 6 px ne serait pas assez vive. Non analysé : neutre. Le point
  reste dedans (son creux distingue « monstre manquant » de « à revoir »).
  `PASTILLE_STATUT` dans RecoCard.tsx ; contrastes texte / fond doux mesurés
  dans les deux thèmes, 4,63:1 au plus bas ;
- l'encart de synthèse est neutre, son icône et son titre portent la couleur ;
- jetons de sets et de propriétés d'artéfact, rapport d'import : les **fonds
  doux** (`good-soft`, `warn-soft`, `bad-soft`) avec le texte à l'encre (les
  filtres de verdict ont le texte de leur ton, voir ci-dessus). Contrastes
  mesurés, 4,91:1 au plus bas (`warn` ocre sur `warn-soft`, Atelier ; le rouge
  `bad` fait 5,53 sur `bad-soft` en Forge) ;
- « Importée » : pastille neutre (un contour d'accent la ferait passer pour
  un élément sélectionné).
