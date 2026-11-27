# Recommandations — la vue Défenses et la recherche par monstre

Partie de [Siège · Recommandations](README.md). Fichiers :
[VoletDefenses.tsx](../../../../src/components/siege/VoletDefenses.tsx) (la vue
Défenses), [recoDefenses.ts](../../../../src/lib/recoDefenses.ts) (les défenses
de toutes les recommandations, l'ordre des offenses — calcul pur),
[recoSearch.ts](../../../../src/lib/recoSearch.ts) (la recherche — calcul pur).

## La vue décide où l'on cherche

Deux questions se posent devant des recommandations, et elles n'ont pas la même
réponse : « **qui bat** cette défense ? » et « **qui joue** ce monstre ? ». La
vue y répond, et le champ de recherche cherche là où elle regarde :

| Vue | Ce qu'elle montre | Où le monstre est cherché | Le champ |
| --- | --- | --- | --- |
| **Défenses** (à l'arrivée) | chaque défense visée, et les offenses qui la battent | dans les **défenses visées** (`counters`) | « Monstre de la défense… » |
| **Decks** | les recommandations, et leurs decks | dans les **decks** (`slots`) | « Monstre d'un deck… » |

⚠️ **Un seul choix, pas deux** : un sélecteur de rôle à côté d'une vue
redirait la même chose, et pourrait la contredire. Ce qui relève de l'autre vue
**n'est pas affiché** : demander une défense et voir remonter des offenses
n'est pas un classement, c'est du bruit.

⚠️ **La vue est toujours affichée et active**, même sans recommandation :
c'est un choix qui a un sens dès qu'on **crée** la première, et un bouton
d'action qui apparaît une fois qu'on en a besoin surprend (règle générale :
[mouvement-et-gestes.md](../../../03-developpeur/interface/design/mouvement-et-gestes.md#%EF%B8%8F-un-bouton-daction-ne-disparaît-jamais--il-se-désactive)).
Elle utilise le vrai [Segmented](../../../../src/ui/Segmented.tsx) ; ses crans
ne portent pas d'effectif (les deux vues montrent les MÊMES recommandations).
Mémorisée (`useStickyState`, clé `recos.vue`), comme la recherche.

**Rien dans cette vue, mais dans l'autre** : le message d'absence de résultat
le dit (« Voir dans Decks (N) ») — sans ça, on conclut que la composition
n'existe pas alors qu'elle est peut-être de l'autre côté.

## La vue Défenses

**La liste** (`defensesDesRecos`) : chaque défense visée **une fois**, toutes
recommandations de la provenance confondues, **les plus jouées d'abord** (celle
que le plus d'offenses battent, celle qu'on rencontre le plus) ; à égalité,
l'ordre de première apparition. Chaque ligne : les trois portraits, la meilleure
fiabilité de ses offenses, « N offenses · M recos ». Puis **« Sans défense
visée »** : les decks qui n'en visent aucune restent atteignables — rien n'est
caché en changeant de vue. Même identité d'équipe que partout (`cleEquipe` :
le chef, s'il a un lead actif en siège, puis les deux autres triés —
[defenses-visees.md](defenses-visees.md)).

**Le volet de la défense choisie** :

- **L'en-tête** : la défense, son nom, « N offenses · M recommandations », et
  le **rangement** de ses offenses, là où il agit :
  - **Par reco** (à l'arrivée) : une bande par recommandation, dans l'ordre de
    la page, puis l'ordre de ses decks — celui de son auteur ;
  - **Par fiabilité** : la plus fiable contre CETTE défense d'abord, à plat, la
    recommandation en étiquette de ligne ; non notées à la fin, 0 avant elles ;
    à égalité, l'ordre par reco. Mémorisé (clé `recos.tri`).
- **« + Ajouter un counter »**, au bout de la rangée de la pagination : un deck
  contre CETTE défense ([interactions.md](interactions.md#ajouter-un-counter)).
- **La bande d'une recommandation** : son nom, sa provenance et l'état de son
  salon, son auteur, « N decks ici · M au total », ses **consignes**
  (une bulle, qui se lit sans quitter la défense) et son menu « ⋯ » :
  « Publier dans… », « Éditer la recommandation » (qui passe en vue Decks, la
  recommandation ouverte en édition), « Exporter en fichier », « Supprimer
  cette recommandation » — « Détacher de ce salon » pour une recommandation
  liée.
- **Une offense** : la ligne d'un deck, la même que dans la vue Decks
  ([rendu-de-la-page.md](rendu-de-la-page.md#la-ligne-dun-deck)) ; à la place
  des défenses battues, la **fiabilité contre CETTE défense** (notable depuis
  la ligne), la précision que ce deck donne contre elle (« Contre cette
  défense : … ») et ses consignes. ⚠️ **Elle s'ouvre et s'édite sur place** :
  il fallait repasser en vue Decks, retrouver la recommandation puis le deck.
- ⚠️ **L'ordre est pris au choix de la défense, du rangement ou de la
  recherche, puis TENU** (`ordonnerOffenses`, `fige`) : noter un deck pendant
  qu'on l'édite le déplaçait sous le clic. Ce que l'ordre ne connaît pas (un
  counter ajouté) vient après — dans sa bande, par reco. L'offense en édition
  reste dans le volet même si l'édition lui fait quitter cette défense.

## La recherche par composition

**Jusqu'à trois monstres**, dans la barre d'outils, à côté de la vue. Elle
porte sur la provenance choisie.

### ⚠️ Plusieurs monstres se cumulent en ET, dans la MÊME composition

Chaque monstre ajouté **précise** la recherche au lieu de l'élargir : c'est ce
qui permet de retrouver une défense qu'on affronte — « Chloé + Trevor + Bella »
sort le deck qui bat **exactement** cette composition, pas les trois listes de
decks qui jouent l'un des trois.

- Le « tous présents » vaut **par composition** : les 3 slots d'un deck (vue
  Decks), ou une **même** défense visée (vue Défenses).
- ⚠️ Une position déjà retenue **ne compte pas deux fois** : chercher deux fois
  le même nom exige **deux** monstres. Sans ça, « chloe chloe » passerait sur un
  deck n'en portant qu'une.
- **Un champ vide n'exige rien** : sinon ouvrir un champ viderait la page.
- ⚠️ **Une collaboration répond aussi au nom de sa version SW**, et
  inversement (`jumeauCollab`) : « Werner » trouve le deck noté Satoru Gojo.
  C'est le même monstre, et qui a recruté l'un ne connaît pas forcément le nom
  de l'autre.
- **Casse et accents ignorés** : « chloe » trouve « Chloé ».
- Le nom comparé est celui du **bestiaire** s'il est chargé, sinon celui **figé
  au partage** — même repli que partout pour un monstre absent des données.

### Rendu — trois cases, un champ

⚠️ **Trois CASES, et non trois champs texte** : elles montrent la forme de ce
qu'on cherche — une composition de 3 monstres — **avant même d'avoir tapé**, et
reprennent le langage des slots de deck de la page. Une case vide porte un `+`
en tireté.

- ⚠️ **Le champ à GAUCHE, les cases à sa DROITE, collées à lui** : c'est le
  champ qu'on utilise en premier, et les portraits sont son RÉSULTAT. Sous
  `lg`, il prend toute la largeur restante ; plafonné (260 px) à partir de
  `lg`.
- **Un champ unique** (`MonsterPicker`, celui des slots de deck) remplit la
  **première case libre** : on enchaîne les trois noms sans viser une case
  entre chaque.
- **Portrait, jamais le nom seul** : plusieurs monstres portent le même nom
  (formes 2A) — voir [MonsterAvatar](../../../../src/components/MonsterAvatar.tsx).
  Repli sur les initiales si le monstre est absent des données chargées.
- ⚠️ **Les monstres posés sont retirés des suggestions** : le ET exige des
  monstres **distincts**.
- ⚠️ **Trois monstres posés : le message « Trois monstres posés — … » prend la
  boîte du champ**, plafond compris — laissé libre de s'étendre, il poussait
  les cases sous le clic qui les remplissait.
- ⚠️ **Retirer ne tasse pas les cases restantes** : chacune garde sa place,
  sinon les portraits sautent d'une case à l'autre sous le curseur.
- On stocke les **noms** et non des `com2usId` : la recherche compare des noms,
  et un monstre d'une reco importée peut être absent des données chargées.
- **Deux effacements, deux portées** : **cliquer un portrait** retire ce
  monstre (on affine), **« Vider »** abandonne la recherche entière.
- Le message d'absence de résultat **énonce la règle** (« … ne réunit A + B »)
  et nomme ce que la vue cherchait (« Aucune défense visée… », « Aucun
  deck… ») : sans ça, une recherche à trois qui ne renvoie rien se lit comme un
  bug, puisqu'on voit chaque monstre à l'écran.
- Persistée via `useStickyState` (survit à la navigation, repartie à vide au
  reload).

### Ce qu'une recherche montre

- **Vue Défenses** : seulement les défenses qui réunissent les monstres
  cherchés, et leurs offenses.
- **Vue Decks** : seulement les recommandations qui répondent, et ⚠️ **dans
  chacune, seulement les decks trouvés** — sans ça, une recommandation
  remonterait en montrant ses six decks, et il resterait à chercher à l'œil
  lequel répond.
  - Les decks sont parcourus dans leur ordre **d'origine** et simplement
    omis : l'index réel indexe la confrontation, l'édition et le repli.
  - Le compteur passe à **« N sur M decks »**, dans la liste comme dans le
    volet.
  - ⚠️ **Les decks trouvés restent REPLIÉS** : les déplier ouvrait d'un coup
    des dizaines de decks sur un gros lot (un salon Discord) ; leurs portraits,
    slot cherché surligné, suffisent à choisir lequel ouvrir. « Déplier tous
    les decks » porte sur les decks affichés.
  - Un deck en édition reste affiché même si la recherche ne le retient pas
    (un counter tout juste ajouté s'édite à l'écran).
- **Surlignage** : le slot ou la défense qui contient le monstre prend un
  **fond d'accent léger** — ⚠️ un fond, jamais une bordure : celle-ci porte
  déjà le verdict de la confrontation.

### Effet du filtre sur les actions

- **Export global** : exporte **ce qui est affiché**. ⚠️ Le bouton s'intitule
  **« Tout exporter » en permanence** : un libellé qui change avec le filtre se
  lit comme un autre bouton. Ce qui part réellement est dit par
  l'**infobulle**, et récapitulé par le message de retour (« N
  recommandation(s) · M deck(s) »).
- **Tout effacer** : efface **tout**, filtre ou non (la modale le dit
  explicitement).
