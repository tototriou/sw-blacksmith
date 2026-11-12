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
   analysée, puis la réponse différée est remplacée par un message :
   - le leader et le pourcentage de son lead, s'il vaut en siège ;
   - l'**ordre de jeu** : chaque attaquant, sa VIT de combat, le tick de son
     premier tour, le sort de vitesse retenu par l'analyse ;
   - **à corriger** : la VIT de combat à atteindre (et l'écart) pour un allié
     coupé, ou « coupé quelle que soit sa VIT » ;
   - la **défense lue** (noms seulement : l'écran ne montre pas sa VIT) ;
   - ce qui reste **incertain** dans la lecture : deux portraits proches, une
     VIT lue avec une confiance faible.

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
   Information*). `DISCORD_CLIENT_ID` y est déjà.
2. Portail Discord, application de test, *Interactions Endpoint URL* :
   `<alias de la branche>/api/interactions?x-vercel-protection-bypass=<secret>`
   — l'aperçu est protégé, Discord ne passerait pas sans le secret de
   contournement. Discord vérifie l'adresse en l'enregistrant (un PING signé,
   puis un faux).
3. Déclarer la commande, une fois :
   `DISCORD_CLIENT_ID=… DISCORD_BOT_TOKEN=… node scripts/enregistrer-commande-speedtune.mjs --serveur <id>`
   ([le script](../../../scripts/enregistrer-commande-speedtune.mjs) ; sans
   `--serveur`, elle vaut partout où le bot est installé).

## Limites du prototype

- **Validé sur deux captures d'un seul téléphone** (2556 × 1179) : en pleine
  résolution, en JPEG, et réduites de moitié. Au tiers (843 × 389), les
  chiffres font 6 pixels et la VIT n'est plus lue — la commande le dit.
  Les autres formats d'écran (tablette, téléphone moins allongé) n'ont pas
  été vus : la mise à l'échelle « largeur » est une supposition.
- Les chiffres **0, 1, 4 et 9** n'apparaissaient sur aucune capture : ils ne
  sont lus qu'avec les gabarits d'Inter.
- Ni le set **Rapidité** ni le **bonus d'artéfact** « effet du buff de
  vitesse » ne se voient : le premier n'importe pas à l'ordre (la VIT de
  combat lue le contient), le second est compté à 0.
- Rien ne se corrige depuis Discord : un monstre mal reconnu ou une VIT mal
  lue fausse le résultat, que le message signale comme incertain.

## Vérifier

[tests/speedtune-capture.test.ts](../../../tests/speedtune-capture.test.ts),
sans aucune vraie capture : écrans recomposés aux positions réelles avec des
portraits synthétiques et des chiffres dessinés depuis les gabarits ; calcul
sur les vrais monstres et leurs vrais kits (Susano, Chilling, Tarq) ;
interactions signées, réponse différée et message final devant un Discord
simulé.
