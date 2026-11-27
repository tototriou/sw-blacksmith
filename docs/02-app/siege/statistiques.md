# Siège — les statistiques des sièges

Partie de [Siège](README.md). Ce que les sièges ont remonté, ceux de la guilde et ceux du joueur,
lu dans les fichiers de guilde du plugin SWEX « SW Blacksmith Live »
([feat-swex-direct.md](../bureau/feat-swex-direct.md) § « Le contenu des combats de guilde »).
**Application de bureau seulement** : les données sont des fichiers sur le disque.

Piste encore ouverte (les runes de mes attaques) :
[pistes-guilde.md](../../05-feuille-de-route/pistes-guilde.md).

## La page — `#/siege/statistiques`

Quatrième sous-section du Siège (`SiegeTab` `'stats'`, `SIEGE_SUBS` de [App.tsx](src/App.tsx)),
écrite dans [SiegeStatistiques.tsx](src/components/siege/SiegeStatistiques.tsx) ; ses données par
[useSiegesSwex.ts](src/hooks/useSiegesSwex.ts), relues à chaque changement d'un fichier de guilde
tant qu'elle est ouverte. Pas de panneau « Options » : aucune action de page (`aPanneau`).

- **Sur le site** : il faut l'application de bureau et le plugin — liens vers
  [Télécharger](../telecharger/README.md) et la page [SW Exporter](../sw-exporter/README.md).
- **Dans l'app, sans sièges à lire** : sans dossier SW Exporter, invocateur suivi ou dossier du
  plugin, la page dit de choisir le dossier et d'installer le plugin ; sans siège relevé, d'ouvrir
  la carte du siège en jeu.
- **La saison** en tête : classement (sur combien de guildes), score, victoires, nuls, défaites,
  taux de victoire, et le meilleur classement.
- **Le siège** se choisit dans une liste, du plus récent au plus ancien : sa date et ses
  adversaires (« contre … »), « en cours » tant qu'il n'est pas fini — c'est ainsi qu'on le
  reconnaît, pas à ses points. **« Tous les sièges »**, en tête de la liste et choisi à
  l'ouverture, les cumule tous
  (`siegesCumules`) : chaque vue les lit comme un seul siège — combats et monstres utilisés
  additionnés, chaque joueur et chaque deck dans sa dernière version ; ni guildes, ni résultat, ni
  courbe heure par heure ; la vue d'ensemble y montre le nombre de sièges à la place du rang et du
  score. Si le résumé des combats manque à un siège, la page dit le cumul incomplet.
  - ⚠️ **Un joueur qui a changé de guilde** garde, dans le cumul, sa dernière version **chez
    nous** : un ancien membre retrouvé chez un adversaire reste dans nos tableaux. Partout, **un
    membre, ce sont ses combats POUR la guilde** (en attaque, en défense) : ceux qu'il a menés
    contre nous, avant d'arriver ou après être parti, ne comptent ni dans sa ligne, ni dans sa vue,
    ni dans son détail ; ses monstres utilisés et ses attaques attendues ne s'additionnent que sur
    les sièges où il était chez nous. Les lignes des membres retombent ainsi sur le bilan de la
    guilde.
  - **Les anciens membres** (`anciensMembres`) : vus chez nous pendant un siège, absents de la
    dernière liste des membres de la guilde (`GetGuildInfo`). ⚠️ Seulement si cette liste date
    d'**après** le dernier siège où on les a vus chez nous : un membre arrivé depuis la dernière
    ouverture de la fiche de guilde n'y figure pas encore, il n'est pas parti. Sans liste relevée,
    aucun. Dans « Tous les sièges » seulement (dans un siège seul, chacun était membre), ils
    **restent** — c'est l'historique de la guilde — mais **à part, après les membres actuels**,
    comme un second tableau : en fin de chaque tableau sous l'intertitre « Anciens membres », quel
    que soit le tri (il s'applique dans chaque groupe) ; dans leur propre grille « Anciens
    membres » au détail ; dans leur groupe du sélecteur « Membre ». Leur nom se distingue aussi :
    encre pâle et icône devant, « Ancien membre » dans l'infobulle et le nom accessible.

  Sous lui, **ce qui manque** (`manquesDuSiege` :
  carte, défenses, journal des combats, résultat jamais vus en jeu).
- **Les guildes du siège** (`comparatifDesGuildes`,
  [SiegeComparatif.tsx](src/components/siege/SiegeComparatif.tsx)), un siège choisi, sous l'angle
  « Guilde » seulement (ces chiffres sont ceux des guildes) : dans la vue d'ensemble **sous nos
  chiffres** (rang, score…), en tête du détail. Deux blocs, côte à côte à la souris, empilés au
  doigt :
  - **le classement** : une ligne par guilde, au rang une fois le siège fini (« provisoire, au
    score » avant) — le rang, l'emblème de la guilde (la forme de son territoire : bouclier,
    rond, carré), son nom (la mienne marquée), son score et **une barre de score à sa couleur** ;
    sous elle, sa participation en petit (joueurs, attaques sur attendues, monstres sur le
    maximum) ;
  - **le face-à-face** avec chaque AUTRE guilde : **nos attaques sur elle** et **les siennes sur
    nous**, chacune en barre — gagnées pleines, perdues pâles — à la couleur de la guilde qui
    attaque, les deux à la même échelle ; le compte et le taux à côté. ⚠️ Le journal ne montre
    que les combats qui nous concernent : ceux entre les deux autres guildes ne s'y comptent pas
    (la page le dit) ; score, attaques faites et monstres viennent de la carte, pour tout le
    siège. Les deux cadres, côte à côte, sont **alignés et de même hauteur** (`Bloc aligne` :
    titres, aide et cadres sur les rangées de la grille) — l'aide du face-à-face ne décale pas
    son cadre.
- ⚠️ **Trois guildes par siège en saison, deux en tournoi** : rien ne suppose un seul
  adversaire — une courbe par guilde, les défenses adverses de toutes les autres guildes, nos
  défenses contre les attaques de toutes ; les équipes jouées et les défenses les plus dures à battre ne
  comptent que NOS attaques (testé sur un siège à trois guildes).
- **Deux angles, chacun en deux vues** (deux `Segmented`) : **Guilde** ou **Membre** ; puis
  **Vue d'ensemble** (chiffres et graphes) ou **Détail** (combats et défenses, filtrables). La
  vue d'ensemble de la guilde s'ouvre par défaut ; un nom cliqué ouvre la vue d'ensemble du
  membre.
  - **Guilde › Vue d'ensemble** ([SiegeVueEnsemble.tsx](src/components/siege/SiegeVueEnsemble.tsx)) :
    - **les chiffres de ma guilde** (`bilanDeLaGuilde`) — rang, score, attaques (gagnées,
      perdues), victoires en attaque, victoires en défense ;
    - **la tendance de chaque WR, sous lui** (`wrGlissant`, `Tendance`), sur « Tous les sièges »
      seulement (un siège dure deux jours) — pour la guilde, et pour un membre dans sa vue
      d'ensemble : l'**écart en points** entre le WR des `JOURS_GLISSANTS` (30) derniers jours
      et celui des 30 jours d'avant — « +2 % » en vert, flèche montante ; « −0,5 % » en rouge,
      flèche descendante ; un écart arrondi à zéro reste neutre ; le détail en infobulle. Pas de
      chiffre de plus : la flèche s'ajoute au WR déjà affiché. ⚠️ Jamais la couleur seule : la
      flèche et le signe disent le sens. ⚠️ **« Aujourd'hui », c'est le dernier combat relevé**,
      pas l'horloge : des relevés anciens donnent leur dernier mois, pas un mois vide. Sans
      combat au résultat connu sur l'une des deux périodes, pas de flèche ; en défense, seuls les
      sièges au résumé des combats comptent (comme `bilanDeLaGuilde`) ;
    - **le WR de la guilde au fil des sièges** (`evolutionDeLaGuilde`) — la même courbe que celle
      d'un membre (`GrapheEvolution`, [SiegeGraphes.tsx](src/components/siege/SiegeGraphes.tsx)) :
      un point par siège relevé, WR en attaque et en défense. ⚠️ **Sur « Tous les sièges »
      seulement** : un siège choisi, on veut SES chiffres (de même pour celle d'un membre). Ici
      seulement, l'infobulle nomme les **adversaires** du siège survolé (une guilde en tournoi, deux
      en saison) et un **clic ouvre ce siège** (le sélecteur le suit) ;
    - **les attaques au fil du siège** (`courbesDuSiege`) — un graphe en deux bandes sur le même
      axe des heures : en haut, les attaques **faites** (pointillé) et **gagnées** (trait plein) de
      chaque guilde, cumulées, en escalier ; en bas, leur **WR** au fil du siège, sur une échelle **centrée sur ses valeurs**
      (`bornesWr` : de la dizaine sous le plus bas WR à celle au-dessus du plus haut, tous les points
      comptés, sur au moins 20 points — 50 à 100 % sur le siège relevé). ⚠️
      **Deux bandes, jamais deux échelles sur un même tracé** : un WR posé sur l'axe des attaques
      inventerait des croisements qui n'existent pas. Au survol, un trait vertical sur les deux
      bandes et l'infobulle de l'heure (attaques, gagnées, WR de chaque guilde) ; en bout de ligne,
      les attaques gagnées et le WR final ;
    - **le tableau des attaques par membre** (`tableauAttaques`) : V, D,
      attaques manquées, **WR** (win rate : victoires sur les attaques jouées), **5★** et **4★** (par
      tour : « gagnées/toutes », le WR en infobulle) ; et **le tableau des défenses par
      membre** (`tableauDefenses`) : decks, combats subis, gagnés, perdus, **WR** (combats gagnés sur les combats subis) — d'après
      les combats, pas les compteurs des decks
      ([SiegeTableauxMembres.tsx](src/components/siege/SiegeTableauxMembres.tsx)). ⚠️ **Compacts** :
      aucune colonne qui se déduit des autres (attaques faites = V + D, monstres utilisés = 3 par
      attaque), ni performance ni points (retirés à la demande de l'utilisateur ; `tableauAttaques`
      les calcule encore). Dessinés par le `Tableau` de la librairie
      ([composants.md](../../03-developpeur/interface/librairie-ui/composants.md), « `Tableau` »),
      tiré du tableau des résultats de l'Optimizer : ils s'ouvrent par **ordre alphabétique** des joueurs, l'ordre de base où ils reviennent au troisième clic sur un en-tête ; chaque colonne se trie (un inconnu toujours en
      dernier), la colonne triée est teintée, ma ligne est marquée, une
      ligne ouvre la vue d'ensemble du membre ; le tableau défile sur le côté au téléphone, la colonne du
      joueur fixée. Les deux tableaux, **moitié-moitié** quand la place le permet (deux colonnes d'au moins
      30 rem), l'un sous l'autre sinon ; ⚠️ **alignés** : titres, aides et tableaux partagent les
      rangées de la grille (`grid-rows-subgrid`, `Section aligne`), une aide plus longue d'un côté
      ne décale plus le tableau de l'autre. Vérifié sur le siège relevé contre le tableau d'un autre outil : la même ligne
      (9 V, 1 D, 90 %, 9/10 en 5★, et 90 % de performance, 135 points — calculés) et la même répartition par tour ;
    - **les équipes les plus jouées en attaque** (`equipesJouees`) et **les défenses les plus
      dures à battre** (`equipesQuiNousBattent` : les défenses adverses contre lesquelles ma
      guilde a perdu le plus d'attaques ; la barre, « nos attaques perdues contre elle ») — les
      trois portraits, la barre, combats et taux. ⚠️ **Toujours des équipes, jamais
      un monstre seul** : en siège, c'est l'équipe de trois qui se joue et se bat, un monstre isolé
      ne dit rien. Une équipe = ses trois monstres, quel que soit leur ordre (le leader n'est pas
      distingué : rien dans les données n'établit quelle place le porte), montrée dans l'ordre le
      plus vu ;
    - **le score de la guilde par siège** (`historiqueDesSieges`), dès deux sièges relevés ;
      sans infobulle (date, score et rang sont écrits sur la ligne).
    - ⚠️ **Couleurs** ([tokens-couleurs.md](../../03-developpeur/interface/design/tokens-couleurs.md)),
      toutes validées pour les daltoniens ; les pièces communes des graphes (cadre, légende,
      interrupteur, barres d'équipes) dans [SiegeGraphes.tsx](src/components/siege/SiegeGraphes.tsx) :
      - **une guilde prend la couleur de sa place sur la carte du jeu** (`couleurDeGuilde`, tokens
        `guilde-bleue`, `guilde-rouge`, `guilde-jaune`) : **ma guilde toujours en bleu**, en bas
        à gauche — le jeu la montre toujours là (dit le joueur) ; les autres se lisent par leur
        place (`pos_id`) à partir de la mienne (`maPosition`) : la suivante en rouge (en haut),
        l'autre en jaune (à droite) — courbes, légende, cartes des guildes, territoire d'une tour.
        Établi sur le siège relevé (ma guilde en position 1, l'autre en 2 et en rouge). ⚠️
        SUPPOSÉ : que la carte tourne ainsi quand ma guilde a une autre place ; un tel siège le
        dira ;
      - **ce qui n'est pas une guilde** (WR en attaque, en défense ; un graphe à une seule série) :
        les tokens `serie-1..3` (bleu, orange, aqua).
      Le texte reste aux encres de l'app. La courbe se dessine en pixels réels (largeur mesurée),
      pour que ses textes gardent leur taille au téléphone.
    - **Une légende sur chaque graphe** : la courbe nomme ses guildes (pastilles de couleur) et ses
      traits (pointillé : attaques faites ; plein : attaques gagnées, et WR en dessous) ; les graphes
      d'équipes et de score disent ce que mesure leur barre. ⚠️ **Une légende à plusieurs entrées
      se clique** (`Pastille` de la librairie) : chaque entrée affiche ou masque sa guilde ou sa
      mesure ; elle porte la couleur de ce qu'elle désigne (contour, et fond teinté tant qu'elle
      est affichée) — on lit d'un coup d'œil qui est qui ; masquée, son nom est barré. La dernière entrée affichée d'un groupe (les guildes, les
      traits) ne se masque pas — désactivée, à sa place. Le choix est retenu par graphe le temps de
      la session. Les axes de la courbe du siège restent ceux de toutes les guildes (une échelle
      qui sauterait à chaque clic se lirait mal) ; celle du WR au fil des sièges se resserre sur
      les séries affichées.
    - **Chaque graphe porte l'interrupteur de ses infobulles**, d'office, dans la ligne de sa
      légende (« Infobulles », activé par défaut, retenu par graphe le temps de la session :
      `useStickyState`) : coupées, la courbe n'a plus de repère au survol. Les classements
      d'équipes ne sont pas des graphes : pas d'interrupteur, l'infobulle (les noms des trois
      monstres) reste. Le score par siège n'a **ni infobulle ni interrupteur** : sa date, son
      score et son rang sont écrits sur chaque ligne. Les tableaux gardent les leurs (le sens des
      en-têtes).
    - Pas de filtres sur les vues d'ensemble : ils servent le détail.
  - **Guilde › Détail** : chaque membre (`bilanParJoueur`) — attaques, victoires, défaites, decks en
    défense ; un membre s'ouvre sur sa vue d'ensemble. Puis **les combats de la
    guilde** aux monstres connus (`combatsDeLaGuilde`), **ses défenses** (`defensesDeLaGuilde`) et
    **les défenses adverses** (`defensesAdverses`), les plus attaquées d'abord.
  - **Membre** : moi par défaut, choisi dans une liste (« Membre »).
    - **Membre › Vue d'ensemble** ([SiegeVueMembre.tsx](src/components/siege/SiegeVueMembre.tsx)) :
      ses chiffres du siège choisi (`bilanDuMembre` : attaques, victoires en attaque, victoires
      en défense) ; **son WR au fil des sièges** (`evolutionDuMembre`, sur « Tous les sièges »
      seulement) — une courbe, un point par siège relevé où il était de la guilde, WR en attaque
      (série 1) et en défense (série 2) sur une même échelle de %, centrée sur leurs valeurs
      (`bornesDesValeurs`) ; un siège sans combat au résultat connu n'a pas de point ; un seul
      siège relevé, la page le dit ; **ses offenses les plus jouées** sur les tours **5★** et sur
      les tours **4★** (`offensesDuMembre`, par le type de la tour attaquée) ; **les défenses les
      plus dures à battre pour lui** (`defensesQuiBattentLeMembre` : celles contre lesquelles il a
      perdu le plus d'attaques). Sur le siège relevé, le type de tour est connu
      pour toutes les attaques de la guilde.
    - **Membre › Détail** : ses attaques, puis ses défenses.
  - **Les combats du détail, siège par siège** (`combatsParSiege`, des deux angles) : sur « Tous
    les sièges », un groupe par siège, du plus récent au plus ancien, sous sa date, ses
    adversaires et son bilan ; sur un siège seul, ses combats sans en-tête. Un siège sans combat
    retenu par les filtres n'a pas de groupe.
  - ⚠️ **Des pages d'un nombre BORNÉ de cartes, jamais d'un nombre de sièges** : au plus
    `COMBATS_PAR_PAGE` (30) combats par page (`pagesDeCombats`), `DEFENSES_PAR_PAGE` (24)
    défenses par bloc (`pageDe`). Un siège relevé compte 204 combats aux monstres connus (six
    portraits chacun), 101 défenses de la guilde et 89 adverses : trois sièges par page rendaient
    des milliers de portraits, et la page ramait. Un siège plus long qu'une page reprend sur la
    suivante sous son en-tête, marqué « suite » ; son bilan reste celui du siège entier. Le pager
    est en tête de chaque bloc et répété au pied — depuis le pied, changer de page remonte en tête
    du bloc. Un autre siège, angle, membre ou filtre ramène à la première page. Les défenses
    restent cumulées sur les sièges : une défense se juge sur tous ses combats.
- ⚠️ **Fluide à tout instant** : le DOM du détail reste borné à une page par bloc ; les calculs se
  font une fois par siège, angle ou filtre (`useMemo`), les noms des
  joueurs d'un siège sont indexés une fois (`nomDuJoueur`), une carte de combat ne se redessine
  pas si elle n'a pas changé. Les contrôles (siège, angle, vue, membre, filtres) suivent le geste
  tout de suite ; le contenu suit en différé (`useDeferredValue`) et pâlit le temps qu'il arrive.
- **La base d'un combat se lit comme sur la carte du jeu** (`tourDeBase`, `EcussonTour`) :
  l'écusson de la tour — bouclier bleu, rond rouge, carré jaune selon le territoire (la forme
  double la couleur), son numéro ou « QG » au centre, fond sombre dans les deux thèmes comme en
  jeu ; le détail et le numéro de base de la carte en infobulle. ⚠️ Les bases vont par **blocs
  de 13**, un par position, QG en tête (établi) ; mais **le numéro d'une tour n'est pas le rang
  de sa base** : le jeu suit sa propre table (`NUMERO_PAR_RANG`), relevée en jeu en comparant le
  journal des combats aux bases relevées — rangs 4, 8, 9, 11, 12 → tours 4, 5, 9, 12, 10. Un rang
  pas encore relevé (1, 2, 3, 5, 6, 7, 10) s'affiche « Base n », à la couleur de son territoire :
  rien d'inventé. SUPPOSÉ : la même table pour les trois territoires.
- **Un combat** : en tête l'heure, la base si elle est connue et le résultat ; les trois monstres de
  l'attaque **face** aux trois de la défense (portraits, dans l'ordre du jeu) ; qui contre qui,
  **un joueur adverse suivi du nom de sa guilde à sa couleur** (`guildeDe` : sa place dans ce
  siège, sinon `guildesDesSieges` pour le cumul) — de même pour le joueur d'une défense ; ma
  guilde n'est jamais nommée, elle va de soi. ⚠️ Ce nom est
  le seul texte à la couleur d'une guilde (demande de l'utilisateur), en gras : le jaune n'atteint
  que 3:1 sur le clair.
- **Ajouter une offense à une recommandation** : chaque carte de combat (les combats de la guilde,
  les attaques d'un membre) porte, au bout de sa ligne d'en-tête, le bouton « Ajouter à une
  recommandation » (icône liste +). Il ouvre une fenêtre
  ([AjoutOffenseReco.tsx](../../../src/components/siege/AjoutOffenseReco.tsx), calcul dans
  [ajoutOffenseReco.ts](../../../src/lib/ajoutOffenseReco.ts), la même fenêtre que depuis
  [Mes équipes](../compte/feat-equipes.md)) : les trois monstres de l'attaque deviennent
  un deck, les trois de la défense battue sa **défense visée**, sans note de fiabilité (un jugement
  de l'auteur, pas un taux de victoire) ; ni runes, ni stats, ni sets : les combats ne les donnent
  pas.
  - ⚠️ **Toujours affiché, actif sur une VICTOIRE aux six monstres connus** — seule une victoire
    dit que l'offense bat la défense, et un deck se compose de monstres des données chargées. Sur
    une défaite, un résultat inconnu ou un monstre absent (journal jamais ouvert, monstre hors des
    données), désactivé, la raison en infobulle.
  - **La fenêtre** montre le combat, puis une ligne par recommandation qui dit d'avance ce que fera
    le clic : **« Nouveau deck »** ; **« Défense ajoutée à son deck »** quand l'offense y est déjà
    (même équipe au sens de `cleEquipe`, [modele.md](feat-recommandations/modele.md)) ;
    **« Déjà dedans »**, désactivée, quand elle y bat déjà cette défense. ⚠️ **Jamais de doublon** :
    une offense déjà recommandée ne refait pas de deck. Une recommandation neuve (« Nouvelle
    recommandation », dans le pied) reçoit le deck à la place de son deck vide.
  - La fenêtre **reste ouverte** après un ajout : la ligne passe à « Ajoutée », on peut ajouter
    ailleurs ; « Voir les recommandations » mène à `#/siege/recommandations`. La liste a une
    **hauteur fixe** : une recommandation créée ne regrandit pas la fenêtre (recentrée, elle ferait
    bouger le bouton touché).
  - ⚠️ **Les recommandations partagées viennent de Discord.** La page lit les salons **en
    arrière-plan** à son ouverture (`useDiscord`, comme la page Recommandations,
    [synchronisation-discord.md](feat-recommandations/synchronisation-discord.md)) quand Discord
    est activé : la fenêtre les propose déjà, chacune avec le nom de son salon. Éteint, rien ne
    part. Une zone à **hauteur réservée**, sous le combat, dit l'état de Discord :
    - **pas connecté** (jamais connecté, déconnecté, connexion en attente de son code) : la phrase
      le dit, et « Se connecter à Discord » mène à la page Recommandations, où l'on se connecte ;
    - **lecture des salons** en cours ; **Discord injoignable** (les recommandations partagées sont
      celles de la dernière lecture) ;
    - **connecté** : une recommandation d'un salon se publie ensuite depuis la page
      Recommandations. L'ajout est une modification de la copie locale (état « modifiée »),
      **jamais publiée d'office**.
  - ⚠️ **SUPPOSÉ : le premier monstre d'une équipe du journal est son leader.** Le deck garde
    l'ordre du combat, et le slot 0 d'un deck porte le lead ; rien dans les données relevées ne
    l'établit (« Une équipe = ses trois monstres », plus haut). La fenêtre dit de vérifier le
    leader. Si c'est faux, une offense déjà recommandée avec un autre chef ne se reconnaît pas :
    elle fait un deck de plus, sans rien perdre. Un relevé en jeu le tranchera : sur un combat dont
    le leader de l'attaque n'est pas le premier monstre affiché par la carte, comparer la carte à
    l'écran du jeu.
  **Une défense** : ses trois monstres, son joueur, ses combats gagnés sur les combats
  subis, son WR. ⚠️ Côté défense, la page dit **gagnés** ou **perdus**, jamais « tenus ». Des monstres jamais montrés par le jeu : « monstres non vus en jeu » (une équipe
  inconnue dans un combat : « ? »).
- ⚠️ **Les défenses se reconstituent d'après les COMBATS du siège** (`DefenseCombats`), jamais
  d'après les decks : une défense = un défenseur et une équipe (ses trois monstres, quel que soit
  leur ordre), et les combats où elle a été attaquée. Pas besoin d'ouvrir en jeu les défenses de
  chaque joueur : les monstres viennent du journal de chaque combat ; les combats sans journal
  forment, par défenseur, une défense aux monstres inconnus. Sur le siège relevé : 101 défenses
  de la guilde (100 aux monstres connus) sur 235 combats, 89 défenses adverses sur 204.
- **Les filtres**, sous les guildes (`FiltreSiege`, `filtrerCombats`, `filtrerDefenses`) : le
  **résultat** (tous, victoires, défaites), des **monstres** — choisis parmi ceux vus dans ce
  siège, les plus fréquents d'abord (`monstresDuSiege`) ; ils doivent TOUS être dans la même
  équipe — et le **côté** où les chercher (attaque ou défense, en attaque, en défense ; désactivé
  sans monstre choisi). Ils s'appliquent aux combats et aux défenses du détail, des deux angles, et restent
  d'un siège à l'autre. Au-dessus des combats, leur **bilan** (`bilanDesCombats`) : combien, gagnés,
  perdus, taux de victoire sur les résultats connus.
  - ⚠️ Un combat ou une défense aux monstres **inconnus** ne passe jamais un filtre de monstres :
    on ne sait pas s'il les contient. Le résultat ne filtre pas les défenses (chacune a des
    victoires ET des défaites), ni « en attaque ».
- ⚠️ **Decks inconnus** (`sources.defenses` faux : la carte vue après la fin du siège ne les donne
  plus) : aucun membre n'affiche « 0 déf. », la colonne Decks dit « — ». Les défenses, elles, se
  reconstituent quand même d'après les combats.
- ⚠️ **Toute la largeur, en grilles de cartes** (`Grille`) : autant de colonnes que la place en
  permet, d'une largeur minimale par sorte de carte (12 rem un membre, 14 une défense, 19 un
  combat) — trois à six à la souris, une ou deux au doigt. Une ligne par membre étalée sur la
  largeur laissait tout son milieu vide. Les chiffres des cartes sont abrégés (« 10 att. », « 9 V »,
  « 1 D ») ; le texte entier est dans l'infobulle. Un seul rendu pour les deux formats, vérifié aux
  deux ([tests/rendu/siege-statistiques.test.tsx](tests/rendu/siege-statistiques.test.tsx)).

## Les données

### Lire les fichiers — [bureau/swexGuilde.ts](bureau/swexGuilde.ts)

- **Les fichiers** de l'invocateur suivi : `SWBlacksmith/<nom>-<id>/guilde.jsonl.gz` (l'archive,
  une session finie par bloc) puis `guilde.live.jsonl` (la session en cours), dans le dossier du
  plugin trouvé comme celui du compte live (`dossierDuPlugin` de
  [bureau/swexLive.ts](bureau/swexLive.ts) : par l'identifiant, jamais un autre invocateur). Seules
  les sessions de cet invocateur comptent (`parcourirLignesGuilde`), et seuls les événements de
  siège (`estEvenementSiege`).
- ⚠️ **Rien ne se relit deux fois.** Une session de siège pèse plusieurs Mo (le plugin n'écrit plus
  une vue inchangée, mais la carte change à chaque attaque).
  - **L'archive** se lit bloc par bloc : un bloc ne change plus une fois écrit, l'accumulateur des
    blocs déjà lus est gardé (`CacheGuilde.accu`), seuls les blocs ajoutés depuis sont posés. Une
    archive qui ne commence plus par les blocs connus se relit en entier.
  - **La session en cours** se lit comme le compte live (`lireLive`) : seules les lignes ajoutées,
    posées sur un accumulateur à elle (`CacheGuilde.live`), parti d'une **copie** de celui de
    l'archive — elle n'entre jamais dans celui-ci, sinon elle serait comptée une seconde fois
    quand elle s'archive. Elle repart de zéro si le fichier est réécrit (connexion) ou que
    l'archive a changé. Son en-tête n'étant que dans le premier morceau, la lecture retient d'un
    morceau à l'autre que la session est celle de l'invocateur (`suite` de `parcourirLignesGuilde`).
- Sur un dossier réel (une session de 39 Mo) : 170 ms la première lecture, 2 ms ensuite.
- **Le processus principal** ([bureau/swex.ts](bureau/swex.ts)) lit à la demande de la page
  (`bureau:swex-sieges`), une lecture à la fois, et lui signale tout changement d'un fichier de
  guilde (`bureau:swex-sieges-changes`, 0,3 s après la dernière écriture) ou du dossier suivi. Rien
  n'est écrit, ni dans le dossier de SWEX ni dans l'app.

### Les relever — [siegeStatistiques.ts](src/lib/siegeStatistiques.ts)

Calcul pur, testé par [tests/siege-statistiques.test.ts](tests/siege-statistiques.test.ts) ; la
lecture, par [tests/bureau-swex-guilde.test.ts](tests/bureau-swex-guilde.test.ts). Un siège est
identifié par son `match_id` ; chaque écran qui en parle le complète.

| Écran (commande) | Ce qu'on en tire |
| --- | --- |
| `GetGuildSiegeMatchupInfo`, `…ForFinished` | le match (début, fin), les guildes (place, rang, score, membres ayant joué, attaques, monstres utilisés), les joueurs, les défenses (victoires, nuls, défaites de ce siège) et leurs bases |
| `getGuildSiegeMatchBattleLogSummary_v2` | **tous les combats du match**, sans monstres ; les monstres utilisés par joueur |
| `GetGuildSiegeBattleLogByWizardId`, `…ByDeckId` | les combats ouverts en détail : leur base, les monstres de l'attaque et de la défense |
| `GetGuildSiegeParticipationInfo` | les défenses de **ma** guilde (victoires, nuls, défaites, bases) ; le match dont elles parlent (`participation_info.match_id`) — la seule source des défenses après la fin du siège |
| `GetGuildSiegeBaseDefenseUnitList`, `GetGuildSiegeDefenseDeckByWizardId` | les monstres d'une défense |
| `BattleGuildSiegeStart_v2` (début de combat, mes attaques seulement) | mes monstres, ceux de la défense et son joueur, la base — même si le journal du combat n'a jamais été ouvert |
| `getGuildSiegeMatchResult` | le rang final, le nombre de guildes, le score de siège et sa variation |
| `GetGuildSiegeRankingInfo`, `GetGuildInfo` | la saison : classement, score, victoires, nuls, défaites — courante, précédente, meilleure |
| `GetGuildInfo` (fiche de la guilde) | la liste de ses membres (`guild.guild_members`, `wizard_id`), celle de **ma** guilde à la dernière ouverture (`RelevesSiege.membres`) |

- ⚠️ **Rien d'inventé** : un écran jamais ouvert en jeu n'a rien laissé. Chaque siège dit ses
  sources (`sources` : carte, résumé, nombre de combats détaillés) ; un combat dont le journal
  n'a pas été ouvert n'a ni base ni monstres ; sans le résumé, les monstres utilisés sont inconnus
  (`null`), pas zéro.
- **Les combats** : ceux du résumé s'il a été ouvert, complétés par le détail du même combat ;
  sinon les seuls combats détaillés.
- ⚠️ **La carte se complète liste par liste**, et seulement par une liste non vide : la carte de fin
  de siège (`…ForFinished`) arrive sans les défenses, elle effaçait celles de la carte d'avant.
- ⚠️ **Après la fin du siège, la carte ne donne plus les défenses** (relevé : une carte ouverte le
  lendemain, liste vide). Celles de ma guilde viennent alors de `GetGuildSiegeParticipationInfo`,
  qui l'emporte sur la carte quand il est plus récent ; celles des autres guildes restent celles de
  la carte vue pendant le siège. Aucun deck connu : `sources.defenses` faux, et le bilan par
  joueur dit « inconnu » pour ses decks (`decks: null`). Ces decks ne servent plus qu'à leur
  nombre : les défenses de l'écran se reconstituent d'après les combats (plus haut).
- **Les attaques attendues** (`attendues`) : `max_attack_unit_count` du résumé divisé par 3 (une
  attaque de siège = 3 monstres) — 30 sur le siège relevé, soit 10 attaques par membre, ce que
  compte aussi le jeu. Additionnées sur les sièges où le joueur était, pour « Tous les sièges ».
- **La tour d'une attaque** (`AttaqueSiege.tour`) : en siège, les tours 5★ n'ont pas de
  restriction, les tours 4★ n'acceptent que des monstres 4★ naturels et moins. Le type de la base
  attaquée (`base_list[].base_type` de la carte de CE siège — la disposition peut changer) donne la
  tour (`TOUR_PAR_TYPE`) : **2 → 5★, 3 → 4★**, établi sur données — les 69 défenses vues sur des
  bases de type 3 n'ont que des monstres 4★ naturels ou moins, celles de type 2 ont des 5★ ; le
  type 1 (une base par guilde, sans défense vue) est le QG, d'après le joueur : il ne compte pas. Vérifié contre le
  tableau d'un autre outil sur le siège relevé : la même répartition, membre par membre. Une
  attaque dont la base est inconnue n'a pas de tour.
- **Les points d'une attaque** (`AttaqueSiege.points`) : `match_score_var` de l'entrée de journal
  vue de l'ATTAQUANT (`log_type` 1) — vue du défenseur, c'est le gain du défenseur. Une victoire
  dont le journal n'a pas été ouvert n'a pas ses points : le tableau dit alors « — », jamais une
  somme partielle.
- **Le bilan par joueur** (`bilanParJoueur`) : pour chaque joueur d'une guilde, ses attaques, ses
  victoires et défaites, ses monstres utilisés, ses decks en défense, et les combats où il
  défendait (gagnés, perdus) — pour cette guilde seulement.
- ⚠️ **Les compteurs des decks ne sont PAS ceux du siège.** `win_count`, `draw_count`,
  `lose_count` des défenses : sur le siège relevé, 527 défaites comptées sur les decks d'une guilde
  que l'autre n'avait attaquée que 237 fois. Ce sont les compteurs du jeu pour chaque deck (le
  journal montre une commande qui les remet à zéro, `ResetGuildSiegeDefenseDeckStat` ; leur
  période exacte n'est pas établie). Les cartes de défense les affichent, avec une phrase qui le
  dit ; **les défenses d'un siège** (victoires en défense de la guilde, d'un joueur) se comptent sur les
  **combats** du siège, où le défenseur est connu (`combatsEnDefense`).

### ⚠️ Le sens des codes du jeu

Établi par recoupement sur le journal d'un siège joué (439 combats, deux guildes de 25), jamais
supposé — skill `game-data-curation`. Un code mal lu inverse victoires et défaites, ou prête au
défenseur les monstres de l'attaquant.

- **`win_lose`** : 1 victoire, 2 défaite, du point de vue de `wizard_id`. Seul 1 rapporte des
  points (`match_score_var` : 15 en attaque, 5 en défense), 2 jamais. Aucun autre code n'a été
  vu : il reste inconnu (ni victoire ni défaite).
- **`log_type`** : 1 une attaque, 2 une défense. Le résumé donne chaque combat deux fois, une ligne
  de chaque type, au résultat inversé (439 sur 439). Dans une ligne de défense, `wizard_id` est le
  défenseur et `opp_wizard_id` l'attaquant ; `guild_id` est toujours la guilde de `wizard_id`.
  La somme des attaques des joueurs d'une guilde est son `attack_count` (204 sur 204).
- **`view_battle_deck_info`, en objet à une seule équipe** (`{"1": [...]}`, journaux des défenses
  de la guilde, `GetGuildSiegeBattleLog` log_type 2) : c'est la **défense** — 132 des 150 combats
  dont le défenseur avait des decks connus portent l'un de ces decks (les 18 autres, des decks
  vraisemblablement changés pendant le siège). L'attaque n'y est pas : elle reste inconnue, et un
  autre journal du même combat la complète s'il la donne.
- **`view_battle_deck_info`** : [monstres de l'attaque, monstres de la défense], dans les deux
  types — vérifié sur quatre combats vus des deux côtés, et sur les dix attaques du joueur
  (identiques à leur `BattleGuildSiegeStart_v2`). Les runes de la défense ne sont pas données.
- **Le début de mes attaques** (`BattleGuildSiegeStart_v2`) se relie à la **première** de mes
  attaques qui le suit, contre le **même défenseur** (`unit_info.wizard_id` des monstres
  adverses) : dix sur dix, de 12 à 93 s plus tard. Ses deux listes de monstres sont dans l'ordre du
  journal du même combat — gardées telles quelles, sans tri. Un début sans attaque après lui
  (abandonné) ne se relie à rien.
- **L'heure** d'un combat est la même, à la seconde, dans le résumé et dans son journal détaillé
  (75 sur 75) : c'est par elle, l'attaquant et le défenseur qu'ils se relient.
- **`getGuildSiegeMatchResult` ne dit pas de quel siège il parle** : c'est le dernier siège fini à
  son heure (relevé après la fin, avant le début du suivant). Avant la fin du premier siège vu, il
  arrive sans rang : il ne compte pas.
- **Pas de fin de combat** : aucun `BattleGuildSiegeResult` dans les journaux relevés — le jeu ne
  l'envoie plus par les commandes que SWEX voit. Le résultat se lit dans le résumé et les journaux.
- **Un match peut n'avoir que deux guildes** (`match_type` 4 sur le siège relevé) : rien ne
  suppose trois guildes.
- Non lus, sens non établi : `base_status`, `base_type`, le `status` des défenses et le `status` de
  `GetGuildSiegeStatusInfo`.

Les noms des joueurs et des guildes viennent du jeu : jamais dans un test, une fixture ni la
documentation du dépôt. Les fixtures sont fabriquées, de la forme relevée.
