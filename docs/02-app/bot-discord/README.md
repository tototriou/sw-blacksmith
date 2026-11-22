# Ressources · Bot Discord (`#/bot-discord/<onglet>`)

Le guide du bot Discord, avec captures, en trois onglets : **Installation**,
**Recommandations** (la synchronisation des salons), **Commandes**. Rangée
sous **Ressources**, après « Bestiaire ». **Sur le site ET dans l'app de
bureau** : les deux se connectent à Discord.

Fichiers : [BotDiscordPage.tsx](src/pages/BotDiscordPage.tsx) ·
[botDiscord.ts](src/lib/botDiscord.ts) (captures, dimensions, ordre des
étapes) · [App.tsx](src/App.tsx) (route, `RESOURCES`) · les captures dans
`public/bot-discord/`. Ce que fait le bot :
[installer-le-bot.md](../siege/feat-recommandations/installer-le-bot.md),
[service-discord.md](../siege/feat-recommandations/service-discord.md),
[feat-discord-capture.md](../speed-tuning/feat-discord-capture.md)
(`/speedtune`).

## Contenu

En tête, sur chaque onglet : le titre « Bot Discord », une phrase (le bot
fait le lien entre l'app et un ou plusieurs serveurs Discord : il partage les
recommandations de siège et répond à ses commandes ; une synchronisation sans
serveur, tout passe par Discord), puis les **onglets** (`Onglets` de la
librairie). En pied :
« Une autre question ? Le Discord de l'app » (nouvel onglet).

⚠️ **L'onglet est dans l'adresse** (`#/bot-discord/installation`,
`/recommandations`, `/commandes`), comme les sous-sections du siège : il se
partage par un lien, et en écran partagé chaque volet garde le sien.
`#/bot-discord` et un onglet inconnu mènent à l'installation
(`ongletBotValide`).

### Installation

- **Ce qu'il faut savoir**, trois cartes (trois colonnes à partir de
  640 px) : avec ses commandes (et celles qui viendront) ; sans aucun droit ;
  jamais administrateur.
- Pour un administrateur (droit « Gérer le serveur ») : **« Inviter le
  bot »** — le même geste que la modale des recommandations : l'invitation
  dans un nouvel onglet, dans le navigateur du système pour l'app de bureau.
  L'invitation porte les scopes `bot` et `applications.commands`
  ([service-discord.md](../siege/feat-recommandations/service-discord.md)).
- Trois étapes : inviter le bot ; ses commandes sont là (« / » dans un
  salon) ; pour les recommandations, ses salons (renvoi à l'onglet).
- **Ça ne marche pas ?** : les commandes ne s'affichent pas (réinviter le
  bot, qui reste sur le serveur) ; le triangle à côté du serveur dans l'app
  (rôle administrateur).

### Recommandations

- Une phrase, puis deux cartes : un salon, une recommandation ; les droits
  de Discord décident.
- **Mettre en place les salons** (administrateur, bot déjà invité) : créer
  le salon `blacksmith-reco…`, ajouter le bot au salon, lui donner les
  quatre droits (sous leur nom dans Discord, cochés), réserver le salon aux
  recommandations (100 derniers messages).
- **Côté membres**, quatre étapes, chacune avec sa capture : se connecter
  (et le code à coller dans l'app de bureau), retrouver les salons, publier,
  le message du bot dans Discord.
- **Ça ne marche pas ?** : le salon n'apparaît pas, la publication échoue,
  une recommandation disparue.

### Commandes

- Comment lancer une commande : « / » puis son nom, dans tout salon d'un
  serveur où est le bot ; aucun droit du bot n'est requis dans le salon.
- Une section par commande (`COMMANDES_BOT`), dans l'ordre : son nom, « En
  essai » s'il y a lieu, ce qu'elle fait, ses étapes avec leurs captures, une
  note. Aujourd'hui **`/speedtune`**, en essai : envoyer la capture, répondre
  à ses questions, lire le résultat.
- ⚠️ **Une commande de plus** : ses textes sous
  `botDiscord.commandes.liste.<clé>` dans chaque langue (la clé devient
  valide pour `COMMANDES_BOT`), une entrée dans `COMMANDES_BOT` (sa clé, en
  essai ou non, ses captures par numéro d'étape), ses captures dans
  `CAPTURES_BOT` s'il y en a.

La modale « Installer le bot sur ton serveur » des recommandations garde ses
étapes et mène ici (Installation) par « Le guide pas à pas, avec captures ».

## Les captures

| Capture | Sorte | Prise |
| --- | --- | --- |
| `app-connexion`, `app-salons`, `app-salon-choisi` | app | Chromium de test, thème sombre, service Discord simulé (« Guilde de test », « Membre de test ») ; une par langue, à l'ordinateur (fenêtre de 1 180 px) et au téléphone (390 px), à l'échelle ×2 |
| `message-bot`, `speedtune-reponse` | Discord | Un vrai serveur, Discord en anglais ; pseudo, avatar et identifiant Discord du nom de fichier floutés |
| `speedtune-capture` | jeu | L'écran de préparation recadré sur les trois attaquants |

- ⚠️ **Une capture est facultative** : c'est un guide d'utilisation, une
  étape s'en passe quand le texte suffit. Une étape porte sa capture
  (`capture` d'une étape, ou numéro d'étape dans `captures` d'une commande),
  sinon rien ne s'affiche à sa place. Un test vérifie que chaque capture
  rangée sert à une étape, et que celle d'une commande désigne une étape qui
  existe.
- ⚠️ **Le dépôt est public** : aucune capture ne montre un pseudo, un
  avatar, un serveur ou un identifiant Discord réel. Un vrai serveur passe
  par le flou ; l'app, par le service simulé.
- ⚠️ **Au téléphone, les captures de l'app sont celles de sa disposition**
  (`<picture>`, sous 1 024 px) : une capture d'ordinateur réduite à 360 px
  ne se lirait plus.
- ⚠️ **Chaque capture réserve sa place** : largeur et hauteur sont écrites
  dans `CAPTURES_BOT`, et un test relit l'en-tête de chaque fichier. Une
  capture remplacée change ses dimensions dans la même modification.
- Les captures de Discord sont en anglais : dans une autre langue de
  l'interface, une ligne le dit sous chacune ; celle du jeu n'en a pas.
- Rangement : `public/bot-discord/<langue>/<nom>[-telephone].png` pour
  l'app, `public/bot-discord/communes/<nom>.png` pour Discord et le jeu.

## Vérifier

[tests/rendu/bot-discord.test.tsx](tests/rendu/bot-discord.test.tsx) : chaque
capture existe dans chaque langue et chaque format, aux dimensions écrites ;
chaque onglet dit et permet ce qui est décrit ci-dessus, en français et en
anglais ; la modale des recommandations y mène.
[tests/navigation-adresses.test.ts](tests/navigation-adresses.test.ts) :
l'adresse de chaque onglet, et les défauts.
