# Speed tuning — `/speedtune` sur Discord, depuis une capture

⚠️ **Prototype.** Une commande Discord qui lit une capture de l'écran de
préparation d'un combat de siège et répond par le speed tune de l'équipe,
calculé par le moteur de l'outil. Construit pour être essayé avec
l'application Discord de test ; ses limites sont listées plus bas.

Voir aussi : README.md, feat-competences.md, feat-deux-camps.md,
[service-discord.md](../siege/feat-recommandations/service-discord.md).

## Ce que fait la commande

`/speedtune capture:<image>`, dans un serveur où est le bot :

1. Discord appelle `POST /api/interactions` ; la signature Ed25519 de la
   requête est vérifiée (clé publique de l'application), sinon 401.
2. Réponse différée tout de suite (« réfléchit… ») : Discord n'attend que
   3 s. ⚠️ Le calcul n'est lancé qu'après 50 ms : sinon, en occupant le
   processeur 1 à 3 s, il passait avant l'envoi de la réponse.
3. En tâche de fond (`waitUntil` de Vercel) : la pièce jointe est téléchargée
   — seulement sur le CDN de Discord, en PNG ou JPEG, 10 Mo au plus —, lue,
   analysée, puis la réponse différée est remplacée par **un seul encart**
   compact, coloré selon le verdict, à la manière des bots de statistiques :
   - la **vignette** : l'icône du leader ;
   - trois **champs côte à côte** : le leader et son lead s'il vaut en
     siège, la VIT de la défense à battre (l'adversaire de référence, passif
     compris), le set Rapide ;
   - l'**ordre de jeu**, une ligne par attaquant avec son icône **dans le
     texte** : rang, VIT de combat lue, ✅ ou ❌ coupé ; en dessous, sa VIT de
     fiche (`base + runes`) ou la VIT de combat à viser et la fiche
     correspondante, et le sort de vitesse retenu par l'analyse. Pas de
     tick : la simulation le calcule pour l'ordre, le message ne l'affiche
     pas ;
   - les autres valeurs **précisées** par le joueur (voir ci-dessous) ;
   - la **défense lue**, icônes et noms (l'écran ne montre pas sa VIT) ;
   - en description, ce qui reste **incertain** dans la lecture (deux
     portraits proches, une VIT lue avec une confiance faible).

   Les icônes dans le texte sont des **émojis d'application** du bot
   ([emojis.ts](../../../api/_source/speedtune/emojis.ts)) : nommés
   `m<com2usId>`, utilisables sur tous les serveurs où le bot est installé.
   Ils sont créés à la demande : la première fois qu'un monstre paraît, son
   icône SWARFARM (celle de l'app) est téléversée ; la liste se lit une fois
   par instance. Une application en porte 2 000 au plus, plus que les
   monstres reconnaissables (1 171). Il faut pour cela `DISCORD_BOT_TOKEN`
   (celui du service des recos) ; sans lui, ou si Discord refuse, le monstre
   s'écrit sans icône — la réponse ne dépend jamais des émojis.

### Ce que la capture ne montre pas : la question

Deux choses font la VIT en combat sans se voir sur l'écran de préparation.
Quand l'une compte, le message pose d'abord la question, avec un menu
déroulant par valeur manquante (cinq au plus, la limite de Discord ; ceux qui
attendent une réponse passent d'abord) :

- un **passif de vitesse qui se cumule** (`gain.parCumul` de
  [speedTunePassif.ts](../../../src/lib/speedTunePassif.ts)) : buffs portés
  (Chilling), buffs posés (Miles, Elsharion), tours adverses (Monkey King)…
  48 monstres. Le menu propose le **nombre de cumuls au premier tour**, de 0
  au plafond du passif (10 sans plafond, 24 au plus), chacun avec la VIT qu'il
  ajoute. C'est la case « cumuls » de l'outil
  ([feat-passifs-vitesse.md](feat-passifs-vitesse.md)). Les passifs qui dépendent des PV
  (Shumar, Hellhound…) ne sont pas demandés : au premier tour, les PV sont
  pleins ;
- l'**Effet aug. VIT** des artéfacts, pour chaque attaquant qui **reçoit un
  buff de VIT** d'un sort retenu par l'analyse (de toute l'équipe, sur soi, ou
  sur un allié — n'importe lequel, le lanceur compris). Le menu propose des
  **tranches** : le buff de 30 % ne prend que 19 valeurs de 0 à 60 %
  d'artéfact (`⌊30 × (100 + a) / 100⌋`, la troncature de la simulation),
  chaque tranche vaut sa borne basse et donne exactement le même calcul ;
- le **set Rapide** : un seul menu pour l'équipe, une option par combinaison
  (« Aucun », « Tarq », « Susano + Tarq »… huit pour trois attaquants),
  toujours demandé. Il ne change rien à l'ordre (la VIT de combat lue le
  contient) : il sert à retrouver la **VIT de fiche** (`base + runes`, le
  « +X » que le monstre montre hors combat, Rapide compris comme dans l'app,
  voir `swiftFlat` de [speed.ts](../../../src/lib/speed.ts)), donnée pour
  chaque attaquant et pour la VIT à viser. Sans lui, elle pourrait être
  fausse d'un point : le jeu arrondit la somme des pourcentages (totem, lead,
  Rapide), pas chacun.

Le service reste **sans état** : la lecture entière (monstres, VIT, valeurs
déjà choisies, doutes, défense) voyage dans le `custom_id` de chaque menu
([etat.ts](../../../api/_source/speedtune/etat.ts), 100 caractères au plus,
relu strictement). Chaque choix revient en interaction de composant
(type 3) : seul l'auteur de la commande peut répondre (les autres reçoivent un
message que seuls eux voient), le message est mis à jour en différé (type 6),
puis remplacé par le résultat une fois tout précisé — les menus disparaissent.

Le message est en français si Discord l'est (`locale`), sinon en anglais ;
aucune mention n'y est possible (`allowed_mentions` vide). Un refus dit
pourquoi : pièce jointe qui n'est pas une image, trop lourde, écran non
reconnu, VIT illisible (avec les monstres concernés).

## La lecture de la capture

`api/_source/capture/`, sans dépendance native (empaquetée par esbuild) :

- [image.ts](../../../api/_source/capture/image.ts) — décodage PNG
  (`pngjs`) et JPEG (`jpeg-js`), découpe, réduction par moyenne de surface.
  Plus de 16 millions de pixels : refusée avant décodage.
- [ecranPreparation.ts](../../../api/_source/capture/ecranPreparation.ts) —
  les six cartes de l'écran (trois attaquants à gauche, leader en premier ;
  la défense à droite) placées par des proportions de l'écran. Deux mises à
  l'échelle : à la **hauteur** (centré en largeur, relevé sur un téléphone
  2556 × 1179) et à la **largeur** (centré en hauteur) ; le premier portrait
  départage. La VIT se lit en bas à droite de chaque carte d'attaquant ; hors
  de 50 à 450, elle est écartée.
- [portraits.ts](../../../api/_source/capture/portraits.ts) — le monstre
  reconnu à son portrait, porté du projet « Youtube-to-offenses-decks »
  (portraits.py) : zone centrale ramenée à 24 × 24 en Lab, centrée-réduite,
  corrélée à chaque icône de la banque, moins une pénalité d'écart de teinte
  (même dessin, autre élément) ; découpe recalée sur 75 voisines. Les deux
  faces d'une paire collab comptent pour un monstre. Score d'un portrait
  juste : 0,8 à 0,93 ; sous 0,5, l'écran n'est pas reconnu.
- [chiffres.ts](../../../api/_source/capture/chiffres.ts) — la VIT : seuil
  d'Otsu sur la plus petite composante (l'écriture est claire), découpage par
  colonnes (un morceau collé au bord gauche est l'icône de vitesse), chaque
  glyphe ramené à 12 × 18 et comparé aux gabarits.

Les données voyagent dans le paquet de la fonction :

| Fichier | Contenu | Reconstruit par |
| --- | --- | --- |
| `banque-portraits.json` (2,7 Mo) | une signature par icône SWARFARM de monstre obtenable et éveillé (1 171) | `node scripts/construire-banque-portraits.mjs`, après une mise à jour de `public/data/monsters.json` |
| `chiffres-gabarits.json` | les dix chiffres d'Inter 500/600/700, plus ceux relevés sur de vraies captures | `node scripts/construire-gabarits-chiffres.mjs [capture.png 357,367,385]…` (Chromium de Playwright, police Inter installée) |

⚠️ **Inter** est la police installée la plus proche de celle du jeu : seule,
parmi onze familles et quatre graisses, à lire sans erreur les 18 chiffres
relevés sur deux vraies captures (score minimal 0,80). Les captures restent
hors du dépôt (public) : seuls les glyphes normalisés le sont.

## Le calcul

[analyse.ts](../../../api/_source/speedtune/analyse.ts) reprend
l'enchaînement de l'outil ([feat-ecran.md](feat-ecran.md)) : une ligne
vierge par attaquant, le lead du premier filtré par élément
(`siegeLeadFor`), `plateauDeLignes`, puis `analyseAutomatique` avec les kits
(sorts de barre et de buff de vitesse, passifs), adversaire de référence
compris ([feat-deux-camps.md](feat-deux-camps.md)). La VIT de runes vient de
la VIT de combat lue (`runeSpeedForTarget`) : la vitesse de combat
reconstituée est exactement celle lue. Les kits sont lus sur le site lui-même
(`/data/skills/<id>.json`, avec le secret de contournement sur un aperçu
protégé).

## Configurer l'essai

1. Variable d'environnement Vercel (Preview) : `DISCORD_PUBLIC_KEY`, la clé
   publique de l'application de test (portail Discord, *General
   Information*). `DISCORD_CLIENT_ID` et `DISCORD_BOT_TOKEN` y sont déjà
   (le second sert aux icônes des monstres).
2. Portail Discord, application de test, *Interactions Endpoint URL* :
   `<alias de la branche>/api/interactions?x-vercel-protection-bypass=<secret>`
   — l'aperçu est protégé, Discord ne passerait pas sans le secret de
   contournement. Discord vérifie l'adresse en l'enregistrant (un PING signé,
   puis un faux).
3. Déclarer la commande, une fois, **globalement** — comme en prod :
   `DISCORD_CLIENT_ID=… DISCORD_BOT_TOKEN=… node scripts/enregistrer-commande-speedtune.mjs`
   ([le script](../../../scripts/enregistrer-commande-speedtune.mjs)). Elle
   vaut sur tous les serveurs où le bot est installé, présents et à venir
   (quelques minutes pour apparaître) ; à refaire seulement si la commande
   change (nom, description, options), pas pour un changement du traitement.
   `--serveur <id>` la limite à un serveur, où elle apparaît aussitôt ;
   `--retirer` (avec ou sans `--serveur`) la retire — une commande déclarée
   sur un serveur ET globalement y apparaît deux fois.
4. Un serveur l'obtient en invitant le bot avec les scopes `bot` et
   `applications.commands` (portail Discord, *OAuth2 → URL Generator*).

## Limites du prototype

- **Validé sur deux captures d'un seul téléphone** (2556 × 1179) : en pleine
  résolution, en JPEG, et réduites de moitié. Au tiers (843 × 389), les
  chiffres font 6 pixels et la VIT n'est plus lue — la commande le dit.
  Les autres formats d'écran (tablette, téléphone moins allongé) n'ont pas
  été vus : la mise à l'échelle « largeur » est une supposition.
- Les chiffres **0, 1, 4 et 9** n'apparaissaient sur aucune capture : ils ne
  sont lus qu'avec les gabarits d'Inter.
- Rien ne se corrige depuis Discord : un monstre mal reconnu ou une VIT mal
  lue fausse le résultat, que le message signale comme incertain.

## Vérifier

[tests/speedtune-capture.test.ts](../../../tests/speedtune-capture.test.ts),
sans aucune vraie capture : écrans recomposés aux positions réelles avec des
portraits synthétiques et des chiffres dessinés depuis les gabarits ; calcul
sur les vrais monstres et leurs vrais kits (Susano, Chilling, Tarq) ; état
des menus (aller-retour, pire cas sous 100 caractères, refus) ; interactions
signées, réponse différée, question, choix (y compris d'un autre que
l'auteur) et message final devant un Discord simulé.
