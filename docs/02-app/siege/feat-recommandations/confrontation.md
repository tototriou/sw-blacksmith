# Recommandations — confrontation avec mon compte

Partie de [Siège · Recommandations](README.md).

## Confronter à mon compte — un interrupteur pour toute la page

Calcul pur dans [recoMatch.ts](../../../../src/lib/recoMatch.ts) → stats
réelles via `computeStats` ([stats.ts](../../../../src/lib/stats.ts)).

### Un interrupteur, pas un bouton par recommandation

⚠️ **« Confronter à mon compte »** : un interrupteur, à la souris au bout de la
barre d'outils, au doigt dans le panneau « Options ». Allumé, **chaque deck de
la page** porte son verdict, dans les deux vues ; éteint, tout est neutre (pas
de pastille, pas de badge sur les monstres). Mémorisé (`useStickyState`, clé
`recos.confronter`).

- **Désactivé sans compte importé** (rien à quoi comparer), avec sa raison.
- ⚠️ **Calculé à la lecture, gardé par identité** : le résultat de chaque
  recommandation est mémorisé par l'objet lui-même (`WeakMap`) — une édition
  recrée l'objet, un autre compte recrée le contexte. Rien n'est recalculé tant
  que rien ne change, aucun résultat n'est jamais « périmé », et seules les
  recommandations affichées sont confrontées.

### Ce que la confrontation affiche

- **Sur la ligne de chaque deck** : la pastille du verdict, avec les libellés
  des filtres, et dessous sa **cause** (la phrase entière en infobulle) et
  « réalisable N fois » :
  - **Bon** · « jouable · Offense 3 » ;
  - **À composer** · « aucun deck avec ces monstres — tu peux le composer » ;
  - **Monstre manquant** · « Tarq — monstre indisponible » ;
  - **À revoir** · « Bella — set Violent manquant · VIT 117 au lieu de 212 ».
- **Dans le volet d'une recommandation, le bilan** : une rangée sous les
  consignes, « N/M deck(s) au niveau · K à corriger », puis les **pastilles de
  verdict, qui filtrent les decks juste en dessous** (plus bas). Aucun deck
  rempli : « Rien à analyser ».
- **Dans la liste de la vue Decks** : un bilan en miniature par
  recommandation, un point et un compte par verdict (`BilanMini`).
- **Dans le deck ouvert** : le build retenu sous chaque monstre, et la
  comparaison stat par stat (plus bas).

#### Filtres de verdict — Bon · À composer · À revoir · Monstre manquant

**Quatre pastilles** dans la rangée du bilan, une par statut réel, avec
l'effectif de chacune :

| Pastille | Couleur | Statut | Point |
|----------|---------|--------|-------|
| **Bon** | vert | `ok` | plein |
| **À composer** | orange | `nodeck` | plein |
| **À revoir** | rouge | `ko` | plein |
| **Monstre manquant** | rouge | `missing` | **creux** |

- ⚠️ **Le rouge est SCINDÉ en deux.** « À revoir » et « monstre manquant »
  partagent la couleur mais **pas le geste** : l'un se répare en rerunant ce
  qu'on possède déjà, l'autre demande d'invoquer et de monter un monstre qu'on
  n'a pas. Ce n'est ni le même horizon, ni la même décision. Fondus, il
  faudrait parcourir toute la liste rouge pour trier à l'œil ce sur quoi on
  peut agir le soir même.
- ⚠️ **Deux filtres, un seul rouge.** Les deux gardent la même couleur, `bad` :
  ils sont bloquants tous les deux, et c'est ce que la couleur dit. On
  n'introduit pas une cinquième couleur qui mentirait sur la gravité.
- ⚠️ **Le point de « Monstre manquant » est CREUX.** Deux pastilles de la même
  couleur côte à côte ne se distinguent plus que par leur texte, qu'on ne relit
  pas une fois la barre connue. Le creux dit « il manque quelque chose » ; la
  pastille du verdict de chaque ligne de deck le reprend.
- La **cause** est écrite sur **les deux verdicts rouges** : « à revoir » dit
  quoi corriger, « monstre manquant » dit **lequel** manque — sans quoi on
  saurait le deck bloqué sans savoir par qui.
- ⚠️ **Les pastilles filtrent les decks juste en dessous** : rien enclenché,
  tout est montré ; enclencher **restreint**. Une seconde liste qui redirait
  les verdicts au-dessus des decks qui les portent déjà ferait lire la même
  chose deux fois.
- ⚠️ **Cumulables** : on peut isoler vert **et** rouge à la fois. D'où des
  **pastilles indépendantes** et non un `Segmented`, dont le cadre commun dirait
  que les choix s'excluent.
- **« Tout afficher »** rétablit, seulement quand un filtre est posé : réservé
  sans filtre, il laissait une bande vide dans le bilan.
- Un verdict **sans aucun deck** est **grisé, jamais retiré** : on voit qu'il n'y
  en a aucun au lieu de chercher un bouton disparu. Même règle que les pastilles
  d'attribut de l'inventaire d'artéfacts.
- Le marqueur d'actif est la **bordure** (règle des pastilles de filtre, voir
  [../../03-developpeur/interface/](../../../03-developpeur/interface/)).
- Les decks filtrés se paginent comme les autres
  ([interactions.md](interactions.md#une-page-de-decks-à-la-fois)) ; un deck en
  édition reste affiché même si le filtre ne le retient pas.
- État **local au volet** de la recommandation.

#### Combien de fois le deck est montable — « réalisable N fois »

Chaque deck analysé affiche combien de fois il peut être monté **en parallèle**
avec la réserve du joueur (`deckCopies` dans
[recoMatch.ts](src/lib/recoMatch.ts)). C'est ce qui dit si on peut poser le même
deck sur plusieurs défenses de guilde.

**Sur la ligne de chaque deck**, à côté de sa cause — c'est là qu'on arbitre
entre six défenses de guilde à remplir, et un deck jouable une seule fois n'en
couvre qu'une. Sur **tous les verdicts**, pas seulement les bons : savoir qu'un
deck à revoir n'existe de toute façon qu'en un exemplaire change ce qu'on
décide d'aller corriger.

- ⚠️ **Les 6★ UNIQUEMENT**, et depuis la **box seule**
  (`countCopiesByCom2us` dans [ownedBuilds.ts](src/lib/ownedBuilds.ts)) :
  - `collectOwnedBuilds` **agrège les presets** (RTA, défense, offense) : un
    même monstre y figure une fois par contexte. Compter dessus multiplierait
    les exemplaires par le nombre d'usages ;
  - la box ne retient que `class === 6` (voir
    [../transverse/](../../transverse/)), et chaque entrée
    est un `unit_id` distinct — donc une unité réelle. Un monstre en réserve à
    5★ ne se joue pas tel quel en siège.
- ⚠️ Le deck est limité par son **monstre le plus rare** (`min`, jamais une
  moyenne) : trois exemplaires de l'un ne servent à rien si le second n'existe
  qu'en un seul.
- ⚠️ Un monstre placé **deux fois dans le même deck** consomme **deux**
  exemplaires : les occurrences sont comptées avant division.
- ⚠️ **Rien n'est affiché** faute de compte importé ou sur un deck vide — un
  « 0 fois » affirmerait que le deck est immontable, ce qui est tout autre chose
  que « je ne sais pas ». **Zéro se dit en revanche**, et **en rouge** : c'est
  l'information la plus utile de la pastille.
- La pastille est **distincte du badge de statut** : ce n'est pas un verdict sur
  le deck mais une information de **stock**. Les fondre ferait lire
  « jouable ×2 » comme un degré de conformité.

**Ne plus voir le résultat** : éteindre l'interrupteur. Toute la page
**redevient neutre** d'un coup — pastilles, bilans et badges disparaissent.

⚠️ **Pas de pastille en-tête redondante.** Une seconde pastille dans l'en-tête
du volet (« 1/4 decks au niveau ») reprendrait, un cran plus haut, exactement
ce que dit déjà le bilan juste en dessous.

### ⚠️ Source : TOUS les builds, pas seulement la box

Dans SW, un monstre a **un preset de runes par contexte**. La box ne contient que
l'**équipement actuellement porté** : s'y limiter ferait échouer la
confrontation d'un deck… que le joueur possède exactement tel quel en siège
(« monstre non trouvé » et « à améliorer » juste après avoir importé son
propre deck d'offense).

`collectOwnedBuilds` ([ownedBuilds.ts](src/lib/ownedBuilds.ts)) rassemble donc
**tous les builds connus**, assemblés dans [App.tsx](src/App.tsx) :

| Source | Origine | Libellé affiché |
|--------|---------|-----------------|
| `box` | équipement porté (`BoxItem.gear`) | « Box » |
| `rta` | preset RTA (`RtaEntry.gear`) | « RTA » |
| `defense` | presets des équipes de défense | « Défense N » |
| `offense` | presets des équipes d'attaque | « Offense N » |

Conséquences :
- un monstre **présent dans un deck est possédé**, même s'il n'est pas dans la
  box 6★ → plus de faux « non possédé » ;
- la comparaison se fait sur le **meilleur build disponible**, pas sur celui qui
  se trouve être équipé au moment de l'export.

- **Plusieurs builds** pour un même monstre (exemplaires multiples × presets) :
  on retient le **meilleur** — celui qui satisfait le plus de critères (**stats
  atteintes + sets portés**, à poids égal), départagé par le **pire ratio
  atteint/exigé** le moins mauvais (le plus proche du build demandé). Ex. une
  reco Swift+Focus choisira le preset runé Swift, pas celui runé Violent.
- Le **build retenu est affiché** sous le monstre (« au niveau · Offense 3 »).
- Statut **par slot** :

| Statut | Sens | Rendu |
|--------|------|-------|
| `empty` | pas de monstre dans la reco | neutre |
| `absent` | **aucun build connu** pour ce monstre | bordure rouge, « monstre non trouvé » |
| `ko` | possédé mais ≥ 1 stat sous le minimum **ou** ≥ 1 set manquant | bordure orange, « à améliorer » |
| `ok` | possédé, **toutes** les stats atteintes **et** tous les sets portés | bordure verte, « au niveau » |

### ⚠️ Une collaboration vaut sa version SW

Satoru Gojo, c'est Werner (`jumeauCollab`, voir
[bestiaire/](../../bestiaire/README.md), d'où vient le lien) : un
deck qui demande l'un **se joue avec l'autre**. `contexteConfrontationReco`
([recoMatch.ts](src/lib/recoMatch.ts)) range donc builds, équipes et
exemplaires 6★ sous l'identifiant commun de la paire (`idCanoniqueCollab`,
[monsterForms.ts](src/lib/monsterForms.ts)) :

- un Werner possédé n'est pas un « monstre indisponible » pour le Gojo du
  deck, et l'équipe qui le réunit aux deux autres est retenue ;
- un Werner et un Gojo font **deux exemplaires** du même monstre pour
  « réalisable N fois » — et les deux dans un même deck en demandent deux ;
- les paires viennent des monstres **possédés** : un monstre qu'on n'a sous
  aucune de ses faces n'a rien à confronter.

### Trois questions, dans cet ordre

L'analyse d'un deck répond à : **ai-je un deck ? est-il correct ? sinon, puis-je
le faire ?**

1. **Ai-je les monstres ?** Non → `missing` : le deck est **impossible**.
2. **Ai-je une équipe existante qui les réunit** (défense ou offense) ? Non →
   `nodeck` : tu as les monstres, **il reste à composer l'équipe**.
3. **Dans cette équipe, les stats/sets suivent-ils ?** Non → `ko`.

Le point 2 est la nuance qui compte : posséder les monstres ne veut pas dire
avoir le deck. `OwnedTeam` ([ownedBuilds.ts](src/lib/ownedBuilds.ts)) recense les
**équipes réellement composées** ; une équipe « correspond » si elle contient
**tous** les monstres du deck recommandé. À plusieurs candidates, on retient
celle qui satisfait le plus de critères. Les stats sont alors comparées **au
build de cette équipe-là**, pas au meilleur build tous contextes confondus.

| Statut | Couleur | Condition | Badge |
|--------|---------|-----------|-------|
| `missing` | `bad` | au moins un monstre **non possédé** | « monstre indisponible — deck impossible » |
| `ko` | `bad` | l'équipe existe mais **stats/sets insuffisants** | selon la cause, voir ci-dessous |
| `nodeck` | `warn` | monstres possédés, **aucune équipe ne les réunit** | « aucun deck avec ces monstres — à composer » |
| `ok` | `good` | l'équipe existe et tout est au niveau | « jouable · Offense 3 » |
| `unknown` | neutre | deck **vide** | — |

Statut **par slot** : `absent` (rouge, « monstre indisponible ») · `ko` (rouge,
libellé selon la cause) · `ok` (vert, « au niveau ») · `unknown` (neutre,
« possédé » — rien à confronter faute d'équipe) · `empty` (slot vide).

### ⚠️ Un `ko` dit LAQUELLE des causes

`slotFaults` / `deckFaults` ([recoMatch.ts](src/lib/recoMatch.ts)) séparent trois
défauts qui ne se réparent pas du tout pareil :

| Cause | Ce qui cloche | Badge du slot | Nom côté deck |
|-------|---------------|---------------|---------------|
| `sets` | pas le **runage demandé** → à reruner | « mauvais set de runes » | runage |
| `artifacts` | pas les **propriétés d'artéfact** demandées → à changer d'artéfact | « mauvaise statistique » | artéfacts |
| `stats` | le reste est bon, les **minimums** ne sont pas atteints → à améliorer | « stats insuffisantes » | stats |

Tout afficher sous « stats insuffisantes » enverrait le joueur optimiser des
sous-stats alors que le set lui-même n'est pas le bon — et, symétriquement, un
monstre bien runé mais trop lent se lirait comme un problème de runage.

⚠️ **Une LISTE de causes, pas une cause unique.** Les trois peuvent coexister ;
n'en annoncer qu'une masquerait le reste du travail. Le slot les joint par
` · ` ; le **deck** prend l'union de celles de ses slots.

⚠️ Côté deck, la formule est **« … à revoir »** et non « … non respectés » :
elle est **invariable**, donc elle se combine sans accord — « runage et stats à
revoir », « runage, artéfacts et stats à revoir » se construisent tout seuls quel
que soit le nombre de causes.

L'ordre est celui du **geste à faire** — runage, artéfacts, puis stats : reruner
change les stats, l'inverse n'est pas vrai. Même ordre dans le détail par
monstre.

**Mise en évidence** : dans un slot `ko`, les **lignes de stats non respectées**
sont surlignées (fond rouge léger, libellé rouge) — on voit ce qui bloque sans
lire les chiffres. Le slot fautif prend une bordure rouge, comme un slot dont le
monstre est indisponible : les deux sont bloquants.

- Statut **de la recommandation** (`matchReco`) = **agrégat de ses decks non
  vides**. ⚠️ Le volet reste **neutre** quel que soit le statut (`AURA` dans
  RecoCard.tsx, la même valeur pour tous) : le statut se lit au bilan et aux
  pastilles, jamais à un aplat ([rendu-de-la-page.md](rendu-de-la-page.md#couleurs-et-pastilles-de-statut)).

| Statut | Couleur | Condition |
|--------|---------|-----------|
| `ok` | `good` | **tous** les decks jouables |
| `partial` | `warn` | une partie seulement |
| `missing` | `bad` | **aucun** deck jouable, tous bloqués par un monstre manquant |
| `unknown` | neutre | **non confrontée**, ou aucun deck rempli |

- Sans compte importé : interrupteur « Confronter à mon compte »
  **désactivé**, page neutre. Les recommandations restent consultables,
  éditables et exportables.
- Par stat, la vue affiche `minimum` puis **ta valeur** : verte avec ✓ si
  atteinte, rouge avec l'écart `(−X)` sinon.
- Par set, une puce **icône + ×2/×4** : verte avec ✓ si le set est porté, rouge
  avec ✗ sinon. Un set demandé 2× mais actif 1× → la **seconde** puce est rouge.
