# Recommandations — synchronisation avec Discord

Ce document décrit ce que devient, sur l'appareil, une recommandation liée à
un salon Discord : son état, ce que change une lecture des salons, la
publication, et la fusion d'une version arrivée sur une copie modifiée. Le
service qui lit et publie : [service-discord.md](service-discord.md). Le
modèle et ses raisons :
[un-salon-une-reco.md](../../../04-decisions/adr/un-salon-une-reco.md).

Fichiers :
- [recoDiscord.ts](src/lib/recoDiscord.ts) — état, synchronisation, publication, fusion à trois voies, favoris (calcul pur).
- [useSiegeRecos.ts](src/hooks/useSiegeRecos.ts) — les gestes sur une recommandation liée, et la relecture du lien.
- Tests : [tests/reco-discord.test.ts](tests/reco-discord.test.ts), [tests/rendu/reco-discord-stockage.test.tsx](tests/rendu/reco-discord-stockage.test.tsx).

## Le lien

Une recommandation liée porte un champ `lien`, **propre à l'appareil**, jamais
exporté (`RecoPayload` l'exclut) :

| Champ | Contenu |
| --- | --- |
| `serveurId`, `salonId`, `nomServeur`, `nomSalon` | Le salon. Un salon porte une seule recommandation. |
| `base` | La dernière version reçue du salon (message, date, recommandation) : la référence qui dit si la copie est modifiée, et la base d'une fusion. |
| `ecrire` | Le dernier droit connu de publier dans le salon. |
| `enAttente` | Une version arrivée sur une copie modifiée et non publiée, à fusionner. |

Une recommandation liée est **importée** (`origin`), et son auteur, ses
contributeurs et sa source viennent du salon.

## État

| État | Quand |
| --- | --- |
| À jour | Le contenu (nom, consignes, decks) est celui de la base. |
| Modifiée | Le contenu diffère de la base : à publier. |
| Conflit | Une version attend la fusion (`enAttente`). |

Le droit d'écrire s'y ajoute : sans lui, la recommandation se lit et se
modifie sur l'appareil, mais ne se publie pas.

⚠️ **Le contenu se compare sous la forme normalisée de l'export**
(`empreinteContenu`, [recoShare.ts](src/lib/recoShare.ts)), jamais champ à
champ : une copie relue du stockage (une possibilité de runage vide s'y écrit
`[[]]`) et la même version décodée d'un fichier (`[]`) doivent se reconnaître.
Un deck sans monstre n'est jamais publié : l'ajouter ne rend pas la
recommandation modifiée.

## Lire les salons

`synchroniser` prend les salons que le membre peut lire et la version courante
de chacun :

- **Nouveau salon** avec une version valide : une recommandation liée de plus,
  à la fin. Un salon sans version valide (jamais publié, ou fichier illisible)
  n'en crée aucune.
- **Version reçue** : même message que la base, ou illisible, rien ne change
  sauf le droit d'écrire et les noms ; copie non modifiée, la version la
  remplace (la dernière fait foi) ; copie modifiée, **conflit** — rien n'est
  écrasé. Un message effacé par un admin rend la version précédente courante :
  elle arrive comme une autre.
- **Accès perdu** (le salon n'est plus dans la liste) : la recommandation est
  retirée de l'appareil ; avec des modifications non publiées ou un conflit,
  elle devient une **recommandation locale**, qui les garde.
- Deux liens vers le même salon : le second se traite comme un accès perdu.

Le bilan (ajoutées, mises à jour, conflits, retirées, détachées) dit à la
page ce qui a changé.

## Délier

« Supprimer » une recommandation liée rompt son lien, pour ce membre seul :
elle devient locale, et celle du salon reparaît à la lecture suivante. Rien
ne change dans le salon ni pour les autres membres.

## Publier

- **Réussie** : la version rendue par le service, auteur et contributeurs
  compris, devient le contenu et la base (`apresPublication`).
- **Refusée parce que le salon a changé** (409) : la version courante attend
  la fusion (`apresConflit`). Illisible, elle ne peut pas se fusionner : elle
  devient seulement la base à citer, et la copie se republie telle quelle.

## Fusion à trois voies

`fusionner(base, la mienne, celle du salon)` compare chaque élément à la base :

- **Un deck se reconnaît par son équipe** (`cleEquipe`, la clé de la fusion
  des imports et de la vue Défense, [modele.md](modele.md)) ; deux decks de la
  même équipe se distinguent par leur rang. Changer un monstre en fait donc un
  autre deck : l'ancien est retiré, le nouveau ajouté.
- **Changé d'un seul côté** : passe seul, y compris un deck retiré.
- **Changé des deux côtés, différemment** : le membre choisit, pour un deck,
  « le mien », « celui du salon » ou « les deux » ; pour le nom et les
  consignes, « le mien » ou « celui du salon ». Un deck retiré d'un côté et
  modifié de l'autre se choisit aussi.
- **Ordre** : celui du salon, puis les decks ajoutés de ce côté-ci.

`appliquerFusion` rend la recommandation fusionnée, ou rien tant qu'un choix
manque. La version du salon devient la base ; la recommandation est alors
« modifiée », à relire puis publier. Auteur, contributeurs et source sont
ceux du salon.

## Quand la page lit les salons

[useDiscord.ts](src/hooks/useDiscord.ts), avec le client du service
([discordClient.ts](src/lib/discordClient.ts)) :

- ⚠️ **Rien ne part sans un geste de l'utilisateur.** Le réglage « Discord
  activé » ([useReglagesDiscord.ts](src/hooks/useReglagesDiscord.ts)) s'allume
  au clic sur « Se connecter à Discord » et s'éteint à la déconnexion, à une
  session échue ou à une connexion refusée. Éteint, la page n'appelle jamais
  le service. La session elle-même vit dans un cookie que la page ne lit pas.
- **À l'ouverture de la page**, Discord activé, puis sur « Actualiser » :
  les sources, puis la version de chaque salon, en parallèle, et la
  synchronisation. Un salon refusé compte comme un accès perdu ; un salon en
  panne garde sa recommandation telle quelle.
- **« Publier dans… »** pose aussitôt la version publiée comme recommandation
  liée du salon, sans attendre une relecture que le cache de 15 s du service
  pourrait encore servir à l'ancienne. **Détacher** relit les salons, pour que
  celle du salon reparaisse.
- **L'application de bureau** n'a pas encore de session Discord : la
  connexion y reste désactivée.

L'écran : [rendu-de-la-page.md](rendu-de-la-page.md#provenances-et-discord).

## Favoris

Les salons favoris s'affichent d'abord, puis les autres, chacun dans l'ordre
reçu (`ordonnerSalons`, `basculerFavori`). Aucun salon ne se masque. Ils
n'existent que dans l'application de bureau, et se gardent comme un réglage,
même sans « Garder mes données ».

## Stockage

Le lien se garde avec la recommandation, sous la même clé et le même accord
que les autres recommandations
([persistance-et-partage.md](persistance-et-partage.md)) : sans « Garder mes
données », rien n'est gardé, et tout se relit des salons à l'ouverture. Un
lien illisible au chargement tombe : la recommandation reste, locale, et la
lecture suivante recrée celle de son salon.

Un fichier importé ne complète jamais une recommandation liée, même s'il en
porte la source : il s'ajoute à part.
