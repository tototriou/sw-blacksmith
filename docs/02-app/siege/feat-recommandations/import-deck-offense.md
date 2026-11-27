# Recommandations — partir d'un deck d'offense ou d'une équipe

Partie de [Siège · Recommandations](README.md).

## Partir d'une équipe existante

Écrire un deck à la main est fastidieux : dans la fenêtre « + Ajouter un
counter » ([interactions.md](interactions.md#ajouter-un-counter)), l'onglet
**« Mes decks et équipes »** liste, sous une recherche par monstre :

1. **« Decks d'offense »** : les **équipes d'attaque de siège** du joueur
   (page Decks d'offense) ;
2. **« Mes équipes »** : les équipes de
   [Mes équipes](../../compte/feat-equipes.md), « Combat de guilde · Offense
   siège » d'abord, puis le reste du combat de guilde, puis les autres
   contenus (dans chaque rang, l'ordre de Mes équipes). Les **prépas RTA** n'y
   sont pas : un ensemble de monstres, pas une équipe.

En choisir une **ajoute un deck pré-rempli**, ouvert en édition ; dans la vue
Défenses, il vise d'office la défense regardée.

Conversion — [recoFromSiege.ts](../../../../src/lib/recoFromSiege.ts), calcul pur :

| Élément | Deck d'offense (`deckFromSiegeTeam`) | Équipe de Mes équipes (`deckFromEquipeEnregistree`) |
|---------|--------------------------------------|-----------------------------------------------------|
| Monstres | `SiegeSlot.monsterId` → `Monster`, mêmes positions (slot 0 = leader) | le **leader** de l'équipe en tête, puis les autres dans l'ordre de l'équipe ; **trois au plus** (une équipe d'arène en a quatre) |
| Sets | `SiegeSlot.sets` : déjà les **sets actifs** calculés à l'import | les **sets actifs** des runes de l'équipement copié (`activeSets`) |
| Artéfacts | les **propriétés réellement portées**, 4 max par sorte. Pré-remplir puis élaguer demande moins de travail que retrouver huit lignes dans une liste de 45 | idem, sur l'équipement copié |
| Stats | `computeStats` de l'équipement : **valeurs réelles du build** posées comme minimums ; les stats à **0 sont omises** (ex. précision d'un build sans précision) | idem |
| Nom du deck | **laissé vide** → prend les noms des monstres (« Trevor - Bella - Loren ») | idem |

- C'est un **point de départ éditable** : l'auteur ajuste ou vide les stats et
  les propriétés d'artéfact qu'il ne veut pas exiger. Sets bornés à 6 runes
  par sécurité. Aucune défense visée : une équipe dit ce qu'on JOUE, jamais
  contre quoi.
- Un monstre **sans équipement** arrive **sans stats** ; un **monstre perso**
  (`com2usId = null`, non partageable) ou absent des données laisse le **slot
  vide**.
- Sont proposées les équipes qui ont **au moins un monstre partageable**
  (`isTeamUsable`, `equipeProposable`).
- **Rendu d'une ligne** : les **3 monstres en icônes** (portrait hexagonal +
  badge d'élément), puis le rang (`#N`) pour un deck d'offense, le nom et le
  rangement pour une équipe ; le résumé texte sert d'**infobulle** et à la
  **recherche par monstre** — avec ~50 attaques sauvegardées, c'est le seul
  moyen de retrouver une équipe. Message dédié si le filtre ne renvoie rien.
- Sans deck d'offense ni équipe, l'onglet le dit, avec la marche à suivre
  (importer son compte après avoir **sauvegardé ses attaques en jeu**, ou
  enregistrer des équipes dans Mes équipes).
- Câblage : l'état d'**offense** et les **équipes enregistrées** sont passés
  explicitement à `RecoBoard` (props `offense` et `equipesEnregistrees`, depuis
  [App.tsx](../../../../src/App.tsx) via
  [SiegePage.tsx](../../../../src/pages/SiegePage.tsx)) — l'onglet
  « Recommandations » n'a pas de « côté » actif. La liste des équipes
  proposables est calculée une fois par le board ; le deck d'une équipe ne se
  construit qu'au clic.
