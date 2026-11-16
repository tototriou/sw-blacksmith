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
   — seulement sur le CDN de Discord, 25 Mo au plus ; toute pièce jointe
   s'accepte, quel que soit son type annoncé (absent, ou quelconque pour une
   capture collée par Ctrl+V) : ses octets décident. Ni PNG ni JPEG (WebP
   d'une image copiée depuis Discord, GIF, AVIF…), elle est redemandée au
   proxy d'images de Discord, rendue en PNG
   (`format=png`) ; un refus est journalisé avec le type reçu et les premiers
   octets —, lue,
   analysée, puis la réponse différée est remplacée (si Discord refuse le
   message, le refus est journalisé et remplacé par le message de panne) par
   **un seul encart**
   compact, coloré selon le verdict, à la manière des bots de statistiques :
   - la **vignette** : l'icône de l'app (celle du site de production : Discord
     télécharge l'image lui-même, un aperçu protégé la lui refuserait) ;
   - deux **champs côte à côte** : l'**équipe** à régler (les trois icônes
     dans l'ordre de la capture, leader en premier, et son lead s'il vaut en
     siège) et la VIT de la défense à battre (l'adversaire de référence,
     passif compris) ;
   - l'**ordre de jeu**, une ligne par attaquant avec son icône **dans le
     texte** : rang, VIT de combat lue, ✅ ou ❌ cut (le mot des joueurs, en français aussi) ; en dessous, sa VIT de
     fiche (`base + runes`) ou la VIT de combat à viser — dans l'échelle
     de la VIT lue, sans le passif, comme l'écran de préparation — et la fiche
     correspondante, et le sort de vitesse retenu par l'analyse, par son
     **numéro** (S1, S2…) : peu de joueurs en connaissent le nom. Pas de
     tick : la simulation le calcule pour l'ordre, le message ne l'affiche
     pas ;
   - les autres valeurs **précisées** par le joueur (voir ci-dessous) ;
   - la **défense lue**, icônes et noms (l'écran ne montre pas sa VIT) ;
   - en description, ce qui reste **incertain** dans la lecture (deux
     portraits proches, une VIT lue avec une confiance faible) ;
   - en pied, que la fiche est calculée sans le set Rapide (voir plus bas) ;
   - sous l'encart, un bouton **« Ouvrir l'outil de speed tuning »** : l'outil
     du site de production (`#/outils/speed-tuning`), pour régler l'équipe à
     la main. Il s'ouvre vide : l'équipe lue n'y est pas reportée.

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
  chaque tranche vaut sa borne basse et donne exactement le même calcul.

Le **set Rapide** ne se demande pas : il ne change rien à l'ordre, ni à qui
se fait cut, ni à la VIT de combat à viser (la VIT lue le contient). Il ne
jouerait que sur la **VIT de fiche** (`base + runes`, le « +X » que le
monstre montre hors combat, Rapide compris comme dans l'app, voir
`swiftFlat` de [speed.ts](../../../src/lib/speed.ts)), d'un point au plus :
le jeu arrondit la somme des pourcentages (totem, lead, Rapide). La fiche
est donc calculée sans lui, et le pied du message le dit. Une première
version le demandait par des boutons sous le résultat ; retirés, ils
coûtaient un clic pour un point d'arrondi.

Le service reste **sans état** : la lecture entière (monstres, VIT, valeurs
déjà choisies, doutes, défense) voyage dans le `custom_id` de chaque menu
([etat.ts](../../../api/_source/speedtune/etat.ts), relu strictement). Chaque choix revient en interaction de composant
(type 3) : seul l'auteur de la commande peut répondre (les autres reçoivent un
message que seuls eux voient). ⚠️ Son identifiant voyage **dans l'état**,
écrit à la commande : les métadonnées du message que Discord renvoie avec un
clic peuvent manquer, et la première version, qui s'y fiait, laissait alors
répondre n'importe qui. Les nombres de l'état s'écrivent en base 36 pour
tenir, auteur compris, dans les 100 caractères ; le message est mis à jour en différé (type 6),
puis remplacé par le résultat une fois tout précisé — les menus disparaissent.

Le message est en français si Discord l'est (`locale`), sinon en anglais ;
aucune mention n'y est possible (`allowed_mentions` vide). Un refus dit
pourquoi : pièce jointe qui n'est pas une image, trop lourde, écran non
reconnu, VIT illisible (avec les monstres concernés).

## La lecture de la capture

`api/_source/capture/`, sans dépendance native (empaquetée par esbuild) :

- [image.ts](../../../api/_source/capture/image.ts) — décodage PNG
  (`pngjs`) et JPEG (`jpeg-js`), découpe, réduction par moyenne de surface.
  Plus de 40 millions de pixels : refusée avant décodage — pour un PNG, la
  taille se lit dans son en-tête IHDR (un PNG uni de 10 Mo peut annoncer des
  milliards de pixels). En deçà, toute capture passe, même de tout un bureau
  (`Win + Impr. écran` prend tous les écrans : deux écrans 4K font 16,6
  millions de pixels) ; un écran 8K se lit en 2,3 s avec 0,5 Go de mémoire.
- [cartes.ts](../../../api/_source/capture/cartes.ts) — les cartes
  **trouvées** dans l'image, quels que soient sa taille et son format :
  téléphone, tablette, fenêtre PC avec ou sans barre de titre, capture
  décentrée, recadrée sur les trois attaquants seuls, ou capture de tout
  l'écran où la fenêtre du jeu n'occupe qu'un coin. Aucune taille, aucune
  position n'est supposée.
  1. **Tous les cadres** de l'image, de toute taille (un bord de 12 pixels au
     moins : un seuil en pixels, pas en part de l'image). ⚠️ La couleur du
     cadre ne compte pas : elle varie (bleu d'un deck préréglé, doré d'un deck
     composé sur le moment, bronze sombre, emplacements vides éteints) ; seul
     son contour sert. Un bord est un écart de couleur de plus de 60 (somme R,
     V, B) entre deux pixels à deux pas l'un de l'autre. Un cadre : un bord
     haut horizontal, qui le couvre d'un côté à l'autre à ses coins arrondis
     près, des bords gauche et droit à mi-hauteur près de ses bouts (3 % de sa
     longueur : plus loin, on prend le bord de ce qui est posé à côté), et un
     bas là où ces bords s'arrêtent ; à peu près carré. Seconde source, pour
     un liseré peu contrasté que l'agrandissement rend flou : trois bords
     hauts de même longueur, à la même rangée et à pas régulier, dont les
     côtés se cherchent jusqu'à la moitié de l'espace entre deux cartes.
  2. **Les attaquants sont les cadres qui portent une VIT** (pastille.ts) :
     sur cet écran, seuls eux l'affichent ; la défense et la liste des
     monstres, aux vignettes presque de même taille, n'en ont pas. Il en faut
     trois de même taille, sur une même ligne, côte à côte à pas régulier,
     dont au moins deux où la pastille porte un nombre net. Plusieurs trios :
     les nombres nets disent **quelles** cartes (celui aux trois nombres
     nets, puis les plus grandes) ; pour ces mêmes cartes (le contour et le
     bord intérieur), ⚠️ le plus grand cadre est retenu — le portrait se
     reconnaît sur la carte entière, et le bord intérieur, plus petit d'un
     huitième et décalé, sortait des découpes essayées (un monstre à 0,41 sur
     une capture de téléphone réduite de moitié).
  3. **La défense** : les cadres de même taille, à droite, sur la même ligne ;
     sinon le symétrique des attaquants par rapport au centre ; une capture
     recadrée sur les attaquants n'en a pas.
  4. ⚠️ **Une grande image sans équipe trouvée est relue réduite**
     (`trouverCartesAToutesEchelles`) : de moitié, puis de moitié encore,
     tant que son plus grand côté fait 1 200 pixels ; les cartes trouvées sont
     ramenées à sa taille, et la pastille et les chiffres se lisent sur
     l'image entière. Les seuils de la détection sont au pixel près : agrandie
     ×3, une capture étale ses bords et arrondit ses coins au-delà de ce qu'ils
     couvrent. Une image dont les cartes se trouvent n'est jamais réduite — ni
     la fenêtre du jeu dans un coin d'un écran 4K, dont les petites cartes ne
     survivraient pas à la réduction. Coût : 5 à 9 s pour une image de 3 700
     à 7 900 pixels de large.
- [pastille.ts](../../../api/_source/capture/pastille.ts) — la pastille de
  VIT d'une carte, ce qui en fait un attaquant. La VIT est écrite en blanc
  dans une pastille sombre, en bas à droite de la carte ; la pastille est
  **trouvée** dans la carte, pas placée par des proportions. Son bas : la
  plus basse rangée sombre (plus sombre que 60) qui va jusqu'au bord droit de
  la carte, sur au moins 0,25 fois sa largeur. ⚠️ Cette rangée tolère des
  trous de 2,5 % de la largeur de la carte : en JPEG, les pixels près du cadre
  clair « sonnent » au-dessus du seuil (la fenêtre PC entière en qualité 50
  perdait la pastille d'une carte, et l'écran avec elle). Sans pastille
  trouvée sous 60, une seconde passe prend le sombre sous 90 : floutée, une
  pastille de 8 pixels de haut n'a plus une rangée sous 60 (cartes de
  49 pixels) ; une fausse pastille reste écartée par le nombre net et le
  trio. Au-dessus, les rangées qui
  portent du blanc (plus faible composante d'au moins 150) posé sur du
  sombre, des deux côtés à moins d'un dixième de la carte ; la première qui
  n'en porte plus est le haut. Un portrait n'a pas ce blanc encadré de
  sombre, même quand il est sombre lui-même ou blanc au coin de la pastille.
  À gauche, la zone part du premier blanc (l'icône de vitesse), avec une
  marge ; ⚠️ à droite, la même marge au-delà de la rangée sombre du bas : elle
  s'arrête au coin arrondi de la pastille, et le dernier chiffre la dépasse
  parfois (1 à 2 pixels sur une capture de téléphone en 2640 × 1080, qui
  coupaient le 8 de 328) ; en haut, un quart de la hauteur de la zone (une
  rangée au moins) : le haut d'un chiffre mêle blanc et fond, sous le seuil du
  clair — deux ou trois rangées sur une capture agrandie, qui perdait sinon le
  haut de ses chiffres. Une carte porte un **nombre net** quand sa zone se découpe en deux à
  quatre glyphes : un coin de portrait sombre au reflet clair ressemble à une
  pastille, surtout en JPEG, pas à un nombre.
- [ecranPreparation.ts](../../../api/_source/capture/ecranPreparation.ts) —
  la lecture des cartes trouvées. ⚠️ Aucune position n'est supposée : sans
  trois attaquants trouvés, l'écran n'est pas reconnu. ⚠️ Une VIT fausse est
  pire qu'un refus : hors de 100 à 450 (en
  siège, aucune vitesse réglée n'est sous 100 ; un chiffre perdu, « 66 »
  pour 314, y tombe), sous une confiance de 0,7, ou quand un de ses chiffres
  est presque à égalité avec un autre (écart sous 0,05) sans que la lecture
  agrandie donne le même nombre, la VIT n'est pas lue. Sous 7 pixels, seul
  l'accord des deux lectures vaut ; sous 6 pixels, la VIT n'est jamais lue —
  à 5 pixels, les deux lectures se sont accordées sur un « 340 » pour 349.
  Entre 0,7 et 0,75, le message la dit incertaine.
- [portraits.ts](../../../api/_source/capture/portraits.ts) — le monstre
  reconnu à son portrait, porté du projet « Youtube-to-offenses-decks »
  (portraits.py) : zone centrale ramenée à 24 × 24 en Lab, centrée-réduite,
  corrélée à chaque icône de la banque, moins une pénalité d'écart de teinte
  (même dessin, autre élément) ; découpe recalée sur 75 voisines. Les deux
  faces d'une paire collab comptent pour un monstre. Score d'un portrait
  juste : 0,8 à 0,93 ; sous 0,5, l'écran n'est pas reconnu.
- [chiffres.ts](../../../api/_source/capture/chiffres.ts) — la VIT : seuil
  d'Otsu sur la plus petite composante (l'écriture est claire), découpage par
  colonnes. La hauteur d'un chiffre est celle du glyphe notable le plus à
  droite (le dernier chiffre), pas du plus haut (l'icône de vitesse, grandie
  d'un bout de portrait) ; les colonnes se recomptent dans la seule bande de
  ses rangées, et chaque glyphe se borne à sa plus longue bande d'encre
  continue — un bout de portrait au-dessus ne relie ni ne grandit les
  chiffres. Un morceau collé au bord gauche est l'icône ; un glyphe plus
  large que 0,9 fois sa hauteur est coupé à sa colonne la moins encrée (deux
  chiffres soudés par l'anticrénelage, courant à la taille PC). Le nombre est
  le groupe de glyphes le plus à droite ; l'icône de vitesse en est séparée
  par plus de 0,8 fois la hauteur des chiffres, ou — dès qu'un écart entre
  deux chiffres est connu — par plus de 0,3 fois et le double de cet écart
  (sur un grand écran, l'icône n'est qu'à 0,4 fois, deux chiffres à 0,1).
  ⚠️ **Chaque chiffre se compare à sa taille d'origine** : agrandi à
  12 × 18, un chiffre de 7 pixels n'a plus sa forme (un 9 y ressemble à un
  3). Chaque gabarit est au contraire réduit à la taille exacte du glyphe,
  par moyenne de surface (l'anticrénelage du jeu), sous de petits décalages
  d'une fraction de pixel (hauteur ± 0,5, haut et centre ± 0,5), et corrélé
  à la luminosité brute de la zone (sans seuil), tel quel et flouté (noyau
  3 × 3 de poids 1-2-1), le meilleur des deux comptant : une capture repassée
  par une application qui la redimensionne n'a plus de bord net. La même
  méthode vaut à toutes les tailles. L'ancienne lecture (glyphe agrandi à 12 × 18, sous sa
  découpe et ses huit voisines d'un pixel) sert de second avis : un nombre
  que les deux donnent est lu même quand deux chiffres sont proches. Sous 5
  pixels de haut, un chiffre n'a plus que trois colonnes : il n'est pas lu,
  et la commande demande une capture plus grande.

Les données voyagent dans le paquet de la fonction :

| Fichier | Contenu | Reconstruit par |
| --- | --- | --- |
| `banque-portraits.json` (2,7 Mo) | une signature par icône SWARFARM de monstre obtenable et éveillé (1 171) | `node scripts/construire-banque-portraits.mjs`, après une mise à jour de `public/data/monsters.json` |
| `chiffres-gabarits.json` | les dix chiffres d'Inter 500/600/700, plus ceux relevés sur de vraies captures | `node scripts/construire-gabarits-chiffres.mjs [capture.png 357,367,385]…` (Chromium de Playwright, police Inter installée) ; `--ajouter capture.png 364,396,361` complète le fichier sans le refaire — les captures déjà relevées ne sont pas versionnées, une reconstruction perdrait leurs glyphes |

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

- **Validé sur des captures d'un téléphone** (2556 × 1179, français ; la
  gestion des decks en 2640 × 1080, chiffres de 17 pixels plus fins), **de la
  fenêtre PC** (1417 × 784, 1199 × 682, 1184 × 662 avec la barre de titre ;
  1187 × 646 sans elle ; en anglais et en français), **de l'écran recadré**
  (le milieu seul, les trois cartes seules, plus larges que hautes ou non),
  avec des attaquants à cadres bleus, dorés et bronze (1229 × 415, 596 × 249,
  en français), et de la gestion des decks d'attaque dans une petite fenêtre
  PC (705 × 276, chiffres de 7 pixels). Chaque capture a été lue avec des
  gabarits qui n'avaient pas ses chiffres, telle quelle, réduite, agrandie
  et en JPEG : les cartes sont toujours trouvées, aucune VIT fausse ne passe
  (168 justes, 18 refusées sur 186). Chacune a aussi été posée dans une
  capture de tout un écran (3840 × 2160, 5120 × 1440, 1080 × 2400) : toutes
  lues. Leurs chiffres servent ensuite de gabarits.
- **Une capture très réduite ou très compressée n'est pas toujours lue** :
  sous 6 pixels de haut, les chiffres ne sont pas lus ; à 6 pixels, ils ne le
  sont que si les deux lectures s'accordent ; un JPEG très compressé (qualité
  50 ou moins) de chiffres de 7 ou 8 pixels, ou une capture floutée à cette
  taille, peut être refusé. Agrandir une capture aux chiffres trop petits n'y
  ajoute rien. La commande demande alors une capture plus grande.
- **Banc de stress** (19 vraies captures, chacune réduite de ×0,4 à ×3,
  compressée, floutée, recadrée, posée dans un écran 4K — 1 197 VIT) :
  **aucune VIT fausse** ; les refus restants portent sur des chiffres sous
  7 pixels, des JPEG très compressés et des captures floutées.
- **Seul l'écran de siège est reconnu** : trois attaquants côte à côte. Les
  quatre monstres en losange d'un autre mode sont trouvés avec leurs VIT,
  mais l'écran est refusé.
- La conversion d'une image ni PNG ni JPEG compte sur le proxy d'images de
  Discord (`format=png`) ; s'il la refuse, le journal de la fonction donne le
  type reçu.
- La tablette et les autres formats de téléphone ne sont vérifiés que sur des
  écrans recomposés.
- Rien ne se corrige depuis Discord : un monstre mal reconnu ou une VIT mal
  lue fausse le résultat, que le message signale comme incertain.

## Vérifier

**Les vraies captures** se posent en local dans `tests/captures-speedtune/`
(gitignoré : le dépôt est public), et leurs valeurs attendues dans
[attendus.json](../../../tests/captures-speedtune/attendus.json), versionné.
`node tests/run.mjs testCapturesReelles` les lit toutes : telle quelle, chacune
rend ses trois VIT et ses trois monstres ; réduite, agrandie, en JPEG ou
posée dans un écran 4K, aucune VIT fausse. Deux captures aux chiffres de 5
pixels y sont inscrites avec leurs VIT refusées (`vit` à `null`, les vraies
dans `vitReelles`) : c'est la limite actuelle.

[tests/speedtune-capture.test.ts](../../../tests/speedtune-capture.test.ts),
sans aucune vraie capture : écrans recomposés aux positions réelles avec des
portraits synthétiques (sombres, jusque contre la pastille), des cadres de
plusieurs couleurs et des chiffres dessinés depuis les gabarits — téléphone,
fenêtre PC avec et sans barre de titre, tablette 4:3, téléphone 20:9, cartes
plus larges que hautes, attaquants seuls, attaquants à cadres dorés, bronze
et gris, liste des monstres sous l'équipe, rangée de six cartes sans VIT, cartes
plus grandes sans VIT au-dessus de l'équipe, capture de tout un écran 4K,
capture trop réduite, une seule carte, écran vide ; chiffres de 7 à 9 pixels
lus, de 4 non ; calcul
sur les vrais monstres et leurs vrais kits (Susano, Chilling, Tarq) ; état
des menus (aller-retour, pire cas sous 100 caractères, refus) ; interactions
signées, réponse différée, question, choix (y compris d'un autre que
l'auteur), capture collée (type annoncé absent ou quelconque) lue, capture
WebP rendue en PNG par Discord, GIF non converti refusé,
et message final devant un Discord simulé.
