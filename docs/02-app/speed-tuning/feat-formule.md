# Speed tuning — formule (modèle partagé)

Partie de [Outils · Speed tuning](README.md).

## Formule (modèle partagé)

Même modèle que la page Mécaniques et que les ticks de siège :

```
ΔATB par tick = vitesse_combat × taille du tick     (un monstre agit à 100)
vitesse_combat = base + runes + ⌈ base × (15 + lead) / 100 ⌉
```

- La **taille du tick** dépend du contenu choisi en tête de l'outil (voir
  « Contenu : siège, raid, RTA » plus bas) : **7 %** en siège et en arène,
  **4,5 %** en raid, **1,5 %** en RTA.
- Le **totem +15 %** est **toujours** inclus, dans les trois contenus — il est
  dans `combatSpeed` de speed.ts, pas un réglage. ⚠️ En **RTA et en raid**,
  c'est **affirmé par le mainteneur, non mesuré** ni cité : sans lui, une
  vitesse de base de 100 compterait 15 de moins.
- Le **lead** est saisi **par camp** (ton équipe / en face) : chaque camp a son
  leader.
- ⚠️ **Le set RAPIDITÉ (Swift) se coche par monstre**, et il compte. Ses 25 %
  entrent dans la **somme** des pourcentages (totem + lead + swift) alors que la
  « SPD runes » saisie les porte déjà **à plat** — `combatSpeed` retire donc le
  forfait avant de réinjecter le pourcentage (voir
  [../transverse/](../transverse/)). L'écart n'est que
  d'**un point**, et un point suffit à rater un tick : sur le deck de contrôle
  Mihyang / Adriana / Sonia, l'oublier donnerait 374 et 350 au lieu de 373 et 349.
  Un deck importé du siège coche la case tout seul (le slot porte ses sets).
- La **vitesse de combat minimale pour agir au tick n** est
  `⌈ 100 / (taille × n) ⌉` (`speedForTick`). En siège, `⌈ 10000 / (7n) ⌉` :
  130 au tick 11, **239 au tick 6** (« Lent » en siège), **286 au tick 5**
  (« Rapide »), 477 au tick 3. En RTA, 334 au tick 20 ; en raid, 318 au
  tick 7. Son inverse, le tick naturel d'une vitesse, est `tickDeVitesse`.

### Contenu : siège, raid, RTA

**Les 7 % par tick sont ceux du siège** (et de l'arène, de la guerre de
guilde). **La RTA remplit la barre de 1,5 % de la vitesse par tick**, les
raids de 4,5 % :

> « In most areas of the game the tick size is 7%, the only exceptions are
> in Raids (4.5%) and RTA (1.5%) » —
> [Ellia's Wiki](https://elliabot.neocities.org/game_mechanics/attack_bar/),
> même chose sur le [wiki Fandom](https://summonerswar.fandom.com/wiki/Attack_Bar).

Le contenu se choisit en tête de l'outil (« Siège · Arène », « Raid », « RTA »,
[feat-ecran.md](feat-ecran.md)), siège par défaut ; il est retenu comme les
autres réglages de l'outil (`speedTune.contenu`).

- **Le moteur** ([speedTune.ts](src/lib/speedTune.ts)) : la taille du tick
  est en dixièmes de pour cent (`TICK_DIXIEMES` : 70, 45, 15), pour que les
  seuils restent calculés en entiers jusqu'à leur dernière division — `1.5`
  en flottant ferait tomber un seuil juste sous son entier.
- **L'horloge** (`Horloge` : nombre de ticks et contenu) remplace le nombre
  de ticks partout où il passait : simulation, chaîne d'ouverture, vitesses et
  artéfacts requis, ordre voulu et fenêtres, analyse automatique. Un nombre
  seul reste un horizon de siège.
- **La même durée de jeu dans les trois contenus** (`horlogePour`) : 40 ticks
  en siège, 63 en raid, 187 en RTA. Un monstre à 100 de vitesse joue au tick
  67 en RTA : il reste dans le calcul comme il l'est en siège (tick 15).
- **Sans modificateur, l'ordre ne change pas** : tout le monde est ralenti
  dans la même proportion. Le contenu compte dès qu'un boost de barre ou un
  buff de vitesse entre en jeu, et pour les numéros de tick.
- ⚠️ **Une case de grille vaut UN tick du contenu.** Un buff saisi sur une
  seule case dure 4,7 fois moins longtemps en RTA qu'en siège : un buff qui
  dure plusieurs ticks se marque sur chacun d'eux, comme en siège.
- **Le plan exporté vers l'Optimizer** emporte son contenu
  ([feat-contrainte-speed-tune.md](../optimizer/feat-contrainte-speed-tune.md)).

Coût : en RTA, l'écran simule 187 ticks au lieu de 40 ; un changement y coûte
environ trois fois ce qu'il coûte en siège (mesure ponctuelle, 56 ms contre
18 ms sur une équipe de six avec boost, buff et artéfact).

Deux **modificateurs par tick** (saisis dans les grilles, voir plus bas) entrent
dans la simulation. ⚠️ **Une valeur saisie REMPLACE ce que les compétences
posent** pour ce monstre et ce tick — **0 annule** l'effet du sort, une case
**vide** lui rend la main :

- **Modification de barre d'attaque** (`atbMod[t]`) : variation **ponctuelle** de
  la barre au tick `t` — **positive** pour remplir (compétence de boost,
  artéfact…), **négative** pour vider (réduction d'ATB ennemie). ⚠️ La barre ne
  descend **jamais sous 0** (clampée dans la simulation). Une seule fois, ce
  tick-là. Bornée à ±100 dans la grille.
- **Buff de vitesse** (`speedMod[t]`) : +% de **vitesse** appliqué **uniquement
  au tick `t`** — ⚠️ **pas de report**, les ticks non marqués calculent l'ATB à
  la vitesse de base. C'est la **vitesse** qui change (l'ATB gagnée ce tick-là),
  pas la barre. Un buff qui dure plusieurs ticks se marque sur chacun d'eux.
- **Artéfact « Effet aug. VIT »** (`artefactBuff`) : il amplifie le **buff de
  vitesse**, et n'agit **que si un buff (> 0) est présent** ce tick-là (rien à
  amplifier sinon ; il ne s'applique **pas** à un ralenti).
  ⚠️ **MULTIPLICATIF sur la VALEUR DU BUFF**, pas additif à la vitesse :
  buff 30 % + artéfact 10 % → **buff 33 %**, pas 40 %.
  ⚠️ **Et la valeur du buff est un ENTIER de pourcentage** : le jeu affiche
  « +30 % », « +33 % », jamais 32,7 %. On **tronque** — 9 d'artéfact donne
  30 × 1,09 = 32,7 → **32 %**, quand 10 donne 33 % tout rond. Mesuré en jeu :
  9 ne passe pas, 10 oui, alors que le calcul décimal dit que 9 suffit.
  Arrondir au lieu de tronquer donnerait 33 % dès 9, ce que le jeu dément.
  Conséquence utile : l'artéfact avance **par paliers**, et l'outil propose le
  premier palier qui change quelque chose.
  ⚠️⚠️ **La troncature se calcule EN ENTIERS** — `(buff × (100 + artéfact)) / 100`,
  jamais `buff × (1 + artéfact / 100)` : le second passe par un flottant qui
  tombe juste sous l'entier (buff 25 + artéfact 16 → 28,999999999999996, tronqué
  en **28** au lieu de 29). Toujours dans le sens du MOINS, donc un outil qui
  réclame de la vitesse là où le jeu n'en demande pas.
  > « Increase SPD Effect +N% | Multiplicative | The buff value | 10% artifact
  > makes SPD buff being 33% instead of 30% » —
  > [Ellia's Wiki](https://elliabot.neocities.org/game_mechanics/artifacts/)

  ⚠️ **Multiplicatif, pas additif** : additif, l'artéfact vaudrait trois à
  quatre fois son effet réel, ce qui fausserait les vitesses proposées (un deck
  où 10 d'artéfact valent ~3 de vitesse, pas ~20). Une valeur de mécanique se
  relit à la source avant d'être écrite ici comme acquise.
