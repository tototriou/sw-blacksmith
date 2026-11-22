# Runes — onglet Comparaison

Partie de [Mon compte — Runes](README.md).

## Onglet Comparaison — `RunesCompare`

Se comparer entre amis, ou à soi-même dans le temps, en superposant plusieurs
courbes.

Les trois sources sont de **vrais onglets** (`Onglets`, la librairie UI),
« Courbes partagées » · « Fichiers de compte » · « Historique » : chacune
affiche un écran à part, et l'onglet ouvert le coiffe. « Tout retirer » reste au-dessus, sur la
rangée du titre ; au doigt, cette rangée n'apparaît que s'il y a quelque chose
à retirer.

⚠️ **À la SOURIS** :
- le titre « Comparaison » en tête de page, au-dessus des sous-onglets ;
- dans chaque sous-onglet, le graphe et sa légende côte à côte, la
  légende dans une carte « Séries », comme l'onglet Courbes.

Au doigt, la légende est sous le graphe.

### ⚠️ Des sous-onglets séparés, parce que les sources ne portent pas la même chose

| Sous-onglet | Ce qu'il AFFICHE | Filtres disponibles |
|---|---|---|
| **Courbes partagées** | **tout l'importé** : courbes partagées **et** fichiers de compte | **nombre de runes** seulement |
| **Fichiers de compte** | **les fichiers de compte seulement** | **sets · slot · antiques · nombre de runes** |
| **Historique** | **mes états passés**, tirés de l'archive du plugin (application de bureau) | **sets · slot · antiques · nombre de runes** |

⚠️ **L'inclusion ne va que dans un sens.** Un fichier de compte se réduit
toujours à des points, donc il a sa place dans l'onglet Courbes. L'inverse est
impossible : une courbe partagée n'a pas les runes sur lesquelles les filtres de
l'onglet Comptes s'appliquent. « Courbes » est donc la **vue d'ensemble**,
« Comptes » la **vue filtrable**.

Pourquoi cette séparation plutôt qu'un onglet unique :

- Un **export de courbe ne contient que les points**, et c'est **volontaire** —
  il ne doit transporter **aucune donnée de compte**. Les sets, l'emplacement et
  la rareté n'y sont donc pas : un filtre par set y est **impossible**, pas
  seulement « pas encore fait ».
- Pire, l'appliquer à ma seule courbe **fausserait la comparaison** : on
  opposerait *mon top Violent* à *tout le stock* de l'autre.
- Avec un **fichier de compte**, les runes sont là : le **même filtre est
  appliqué à tout le monde**, donc la comparaison reste honnête.
- Un onglet unique aux filtres actifs une fois sur deux se lirait comme un bug.

Le sous-onglet « Courbes partagées » **explique l'absence** des autres filtres,
sinon on la prend pour un oubli.

### Courbes partagées

- **Exporter** (icône **Upload ↑**) : demande un nom, produit un **JSON lisible**
  (`format: "swblacksmith/courbe-runes"`, **version 2**, voir
  [runeCurveShare.ts](src/lib/runeCurveShare.ts) ; un fichier
  `sw-forge/courbe-runes` est relu aussi : la lecture reconnaît le contenu, pas
  l'identifiant) — **téléchargé** en `swblacksmith-runes-<nom>.json` **et
  copié** au presse-papier.
  - ⚠️ Le fichier porte **LES DEUX séries** : `efficiences` **et** `scores`.
    Celui qui l'importe la lit donc dans **sa** mesure, sans dépendre du réglage
    de l'expéditeur.
- **Importer une courbe** (icône **Download ↓**) : charge le fichier d'un ami.
  **JSON uniquement** : un code compact `SWF-RUNES-1:` n'est ni produit ni lu.

### Fichiers de compte

- **Importer un fichier de compte** : l'export SWEX brut d'un ami, runes
  extraites à la volée (`parseAccountInventory`). **Lu dans la page, jamais
  envoyé.**
- Filtres identiques à l'onglet **Courbes** (`SetFilter`, `SlotFilter`,
  `AncientFilter` **3 états**, nombre de runes), **appliqués à toutes les courbes
  à la fois**.
- ⚠️ Le filtre de sets propose les sets présents **chez moi OU chez un ami** :
  sinon on ne pourrait pas filtrer sur un set qu'on ne possède pas encore.
- Pas de « gemme + meule / meule seule » : la comparaison porte sur l'**état
  actuel** des runes, pas sur un potentiel — et un potentiel comparé entre deux
  comptes n'aurait pas de sens tant que chacun n'a pas posé ses meules.

### Historique — application de bureau

Ma courbe d'aujourd'hui (« Moi ») face à celle des jours passés. Les dates
viennent de l'**archive du compte** que tient le plugin SW Blacksmith Live
(`compte.jsonl.gz`, un état par connexion au jeu :
[feat-swex-direct.md](../../bureau/feat-swex-direct.md)), lue par
l'application de bureau (`bureau/swexHistorique.ts`), sans rien y écrire.

- **L'invocateur suivi** (Paramètres › Application, « Dossier SW Exporter »)
  désigne l'archive. Sans dossier, sans invocateur suivi ou sans dossier du
  plugin pour lui, l'onglet le dit ; sans connexion archivée encore, il dit que
  l'historique commencera à la prochaine.
- **Une liste à choix multiples** (`SelecteurMultiple`) des états, du plus
  récent au plus ancien, à la date et à l'heure de la connexion. Chaque état
  coché devient une courbe de sa couleur (`couleurLibre`), nommée par sa date
  dans la langue de l'interface.
- ⚠️ **Lister ne décompresse rien** : la liste vient des en-têtes des blocs de
  l'archive. Un état (~190 Ko compressé pour un gros compte) n'est lu qu'une
  fois coché ; pendant sa lecture, sa case est désactivée.
- ⚠️ **Les runes sont archivées BRUTES** : efficience et score se calculent
  avec la formule du jour (`runesDeLEtat`,
  [historiqueRunes.ts](src/lib/historiqueRunes.ts)), pour toute la
  chronologie. Une correction de formule vaut donc pour les dates passées.
- **Mêmes filtres que « Fichiers de compte »** (sets, emplacement, antiques,
  nombre de runes), sous leurs propres réglages, appliqués à toutes les dates
  à la fois. Les sets d'un état lu rejoignent la sélection, comme ceux d'un
  ami : un set vendu depuis reste filtrable.
- Les points s'ouvrent : la carte montre la rune **telle qu'elle était** ce
  jour-là.
- **Une connexion archivée** pendant que l'onglet est ouvert, ou un **autre
  invocateur suivi**, relit la liste (`bureau:swex-historique-change`) ; un
  état tracé qui n'y est plus quitte le graphe.
- **Sur le site**, l'onglet reste affiché, **désactivé**, et son infobulle dit
  qu'il faut l'application de bureau et le plugin.
- Rien n'est conservé : les états tracés vivent en mémoire, comme le reste de
  la Comparaison, et se relisent dans l'archive. « Tout retirer » ne les
  touche pas — ce ne sont pas des imports ; un état se décoche dans la liste,
  ou se retire par sa croix dans la légende.

### ⚠️ RIEN de ce qui est importé ici n'est conservé

Courbes partagées **et** fichiers de compte vivent **en mémoire seulement**
(`useStickyState` — un cache par clé, **pas** `localStorage`). Ils survivent à la
navigation entre onglets et **disparaissent au rechargement**.

C'est délibéré : ce sont les données **de quelqu'un d'autre**. Elles n'ont rien à
faire sur le disque de celui qui les consulte, et il ne doit pas avoir à y penser.

⚠️ Le réglage « Garder mes données » (menu ⚙) **ne change rien ici** : côté
compte, il ne conserve que celui **du joueur**. On ne stocke jamais le compte d'un tiers.
⚠️ **Ne pas** basculer cet état vers `localStorage` « pour le confort » — c'est la
seule partie de l'app où de la donnée tierce transite.

### « Tout retirer » — vider la comparaison

Bouton en haut à droite, **affiché seulement s'il y a quelque chose à retirer**,
avec le compte de ce qui partira, et une **confirmation**.

⚠️ Il ne touche **QUE ce qui a été importé ici** — les deux sous-onglets à la
fois. **Pas** le compte du joueur (box, runes, artéfacts), **pas** ses
recommandations, **pas** sa prépa RTA ni ses équipes. Le message de confirmation
**le dit explicitement** : sans ça, on n'ose pas cliquer, de peur d'effacer son
propre import.

> Pour tout effacer, c'est « Tout supprimer » dans le menu ⚙ — action distincte,
> à un autre endroit, et c'est voulu.

Les listes importées vivent donc dans `RunesCompare`, pas dans chaque
sous-onglet : c'est ce qui permet un bouton unique qui les vide toutes les deux.

### Communs aux sous-onglets

- **Superposition** : ma courbe (« Moi ») en bleu, les amis en couleurs vives.
  Bornes recalculées sur les courbes **visibles**.
- ⚠️ **Deux courbes ne portent jamais la même couleur** — sinon on ne les
  distingue plus, et la légende ment puisqu'elle donne un nom à chacune.
  `couleurLibre` ([curveColors.ts](src/components/account/curveColors.ts))
  choisit d'après les couleurs **réellement posées**, vérifié par
  [courbe-couleurs.test.ts](tests/courbe-couleurs.test.ts).
  - ⚠️ **La couleur du joueur (`OWN_COLOR`) est exclue de la palette
    d'import** : sinon la **première** courbe importée — le cas le plus
    courant — reprendrait exactement le bleu de « Moi ». Les deux constantes
    vivent dans le **même fichier**, seule place d'où l'on voit qu'elles ne
    doivent pas se croiser.
  - ⚠️ **Pas un modulo sur le NOMBRE de courbes** (`[n % palette.length]`) : le
    compte ne dit rien de ce qui est libre. Retirer la 1re puis importer
    redonnerait la couleur de la 2e, toujours affichée.
  - Les teintes sont **espacées** : deux bleus voisins se confondraient sur un
    tracé de 1 px. Au-delà de la palette (8 courbes), l'unicité n'est plus
    tenable et le cycle reprend — un doublon entre la 1re et la 9e vaut mieux
    qu'entre deux voisines.
- **Légende** : **sous le graphe**, en **rangée horizontale** (les entrées côte à
  côte), réduite à la **pastille de couleur + le nom** — pas de valeurs
  (max/médiane/nb), qui se lisent au survol du graphe et alourdiraient une zone
  servant seulement à identifier et masquer les courbes. **Cliquer le nom**
  masque/affiche ; la croix (✕) **retire** une courbe importée.
  - ⚠️ **Composant unique**, [CurveLegend.tsx](src/components/account/CurveLegend.tsx),
    partagé avec l'onglet **Courbes** : une seule source pour la même pastille
    (troncature, corps qui suit l'écran), pour que les deux ne divergent pas.
  - ⚠️ Chaque pastille est une **`ZoneCliquable`** (surface nue), pas un
    `Bouton` : une légende n'est pas une rangée de boutons encadrés. Il n'y a
    **aucun `<button>` custom** dans la Comparaison.
  - ⚠️ L'exemption tactile passe par **`data-cible-fine`**, pas par un `min-h-0` :
    la règle des 40 px vit **hors `@layer`** ([index.css](src/index.css)), donc
    elle bat toute classe utilitaire quelle que soit la spécificité — un `min-h-0`
    n'y peut rien, et une légende sans exemption serait **étirée à 40 px au
    doigt**. La cible fait déjà toute la largeur
    de son texte, on ne la rate pas à ~28 px de haut. Même exemption que les
    boutons du graphe, sans le `cible-tactile` (la largeur du texte suffit).
- Deux courbes homonymes sont **renommées** (« Ami (2) »), **en tenant compte des
  deux listes à la fois** puisqu'elles cohabitent dans l'onglet Courbes : sinon
  la légende serait illisible et la croix ambiguë.
- ⚠️ Le retrait est **attaché à chaque ligne**, pas déduit d'un index : l'onglet
  Courbes mélange deux listes, un index n'y désignerait plus rien de fiable.

> Convention d'icônes : **Exporter = Upload ↑**, **Importer = Download ↓**.
