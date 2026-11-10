# Recommandations — installer le bot sur un serveur Discord

Le guide d'un administrateur de serveur : le bot permet à une guilde de partager ses
recommandations de siège dans des salons, sans fichier à s'échanger. Le même guide est dans l'app,
page Recommandations : « Installer le bot sur ton serveur », dans l'encart Discord ou à côté du
compte connecté ([rendu-de-la-page.md](rendu-de-la-page.md#provenances-et-discord)).

## 1. Inviter le bot

« Inviter le bot » (dans le guide de l'app) ouvre l'invitation Discord. Il faut le droit **Gérer le
serveur**. Le bot arrive **sans aucun droit** : il ne voit que les salons où on l'ajoute.

⚠️ Ne lui donner **aucun rôle administrateur** : il verrait tous les salons. L'app le signale (un
triangle à côté du nom du serveur), sans rien bloquer.

## 2. Créer un salon par recommandation

Le nom du salon commence par **`blacksmith-reco`** (`blacksmith-reco-defenses`,
`blacksmith-reco-offs-g3`…). Un salon porte **une seule** recommandation
([ADR un-salon-une-reco](../../../04-decisions/adr/un-salon-une-reco.md)) ; pour plusieurs, plusieurs
salons.

## 3. Ajouter le bot au salon, avec quatre droits

Dans les permissions du salon, ajouter le bot avec :

- **Voir le salon** ;
- **Voir les anciens messages** ;
- **Envoyer des messages** ;
- **Joindre des fichiers**.

Aucun autre droit n'est nécessaire.

## 4. Réserver le salon aux recommandations

Chaque publication de l'app est un nouveau message du bot, qui porte le fichier de la
recommandation ; les anciens restent. L'app ne relit que les **100 derniers messages** : une
discussion dans le salon finit par repousser la recommandation hors de portée.

Un membre peut aussi y déposer à la main le fichier exporté par l'app : le **plus récent fichier
valide** fait foi, qu'il vienne du bot ou d'un membre
([service-discord.md § Publier](service-discord.md#publier)).

## 5. Les membres se connectent

Chaque membre se connecte à Discord depuis la page Recommandations. Il voit les salons
`blacksmith-reco…` qu'il peut lire, et publie dans ceux où il peut écrire : **ce sont les droits du
salon qui décident**, relus à chaque requête.

- Effacer une recommandation se fait dans Discord, par qui en a le droit : le message effacé, la
  version précédente revient. Depuis l'app, un membre ne fait que se détacher du salon.
- Retirer à un membre l'accès au salon retire la recommandation de son app à la lecture suivante ;
  ses modifications non publiées restent sur son appareil.

Le détail de la synchronisation : [synchronisation-discord.md](synchronisation-discord.md).
