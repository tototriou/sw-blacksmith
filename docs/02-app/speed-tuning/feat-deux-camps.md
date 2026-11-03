# Speed tuning — les deux camps se voient

Partie de [Outils · Speed tuning](README.md).

## Les deux camps se voient

### ⚠️ « Ordre raté » et « équipe coupée » sont deux problèmes

Un seul message — « Les vitesses de tes monstres ne permettent pas de jouer
dans l'ordre demandé. » — ne suffit pas : `diagnostiquerSequence`
distingue les raisons, et deux d'entre elles ne disent pas la même chose :

| Raison | Ce qui se passe |
|---|---|
| `trop-tot` / `trop-tard` | l'ordre **entre alliés** n'est pas celui demandé |
| `apres-adverse` | l'ordre est **bon**, mais un adverse s'intercale — l'équipe se fait **couper** |

⚠️ Quand **tous** les ennuis sont des `apres-adverse`, les alliés jouent bel et
bien dans l'ordre demandé. Le titre le dit : « Ton équipe joue dans l'ordre
demandé, mais elle se fait couper. » Le message d'ordre raté enverrait corriger
un ordre qui n'a rien à se reprocher.

Et le monstre concerné **se fait couper** plutôt qu'il n'« est trop lent » : il
peut parfaitement tenir son rang parmi les alliés — ce qu'il rate, c'est de
passer avant l'adverse. C'est le même mot que l'autre branche de l'écran
(« pour ne pas se faire cut ») : un même défaut doit se dire pareil partout.

### Copier un monstre en face

Chaque ligne porte un bouton **« Copier en face »** (« Copier dans ton équipe »
depuis le camp adverse) : il duplique le monstre dans l'autre camp, pour se
mesurer à lui. Le monstre **reste** dans le sien — le déplacer viderait l'équipe
qu'on est en train de régler.

La copie emporte **tout ce qui fait sa vitesse** : runes, Swift, artéfact, sets
et compte de buffs. Elle court donc exactement aussi vite que son modèle, ce qui
est tout l'objet du geste.

⚠️ **Le compte de buffs est estimé depuis le camp d'ORIGINE.** Estimé dans son
nouveau camp, il n'y verrait que lui : la copie serait plus lente que le monstre
qu'elle copie, et la comparaison ne voudrait plus rien dire. C'est le même piège
que celui documenté pour l'adversaire de référence.

⚠️ **Les grilles ne suivent pas** (`atbMod`, `speedMod`) : elles disent ce qu'un
sort a posé sur ce monstre **dans son camp**, tick par tick. Transportées telles
quelles, elles annonceraient des boosts que personne n'a lancés en face.

⚠️ **Ce n'est pas un repère** : contrairement à l'adversaire de référence, la
copie ne suit pas l'équipe et n'est pas remplacée à chaque analyse. Poser un vrai
adversaire fait d'ailleurs disparaître le repère automatique — on ne compare plus
à un étalon, on affronte quelqu'un.

⚠️ Une ligne du **même monstre déjà présente** en face est **remplacée**. Ne rien
faire aurait donné un bouton qui, parfois, ne produit rien à l'écran : le geste
est explicite, sa réponse doit l'être aussi.

### ⚠️ La vitesse de runes annoncée doit atteindre la cible

Le solveur cherche une **vitesse de combat** ; l'écran, lui, affiche une
**vitesse de runes** (« +18 SPD »). Deux sens du même calcul, qui doivent se
répondre exactement :

`combatSpeed(base, runeSpeedForTarget(base, lead, T, swift), lead, swift) === T`

⚠️ **Le Swift doit voyager jusqu'à la conversion** (`runesPour`) : la vitesse
de combat de la même ligne se calcule avec le Swift de la ligne. Sans lui, ce
seraient deux descriptions du même monstre : comme la Rapidité apporte 25 % de
la base et que `combatSpeed` la retire à plat avant de la remettre dans la
somme des pourcentages, l'écart tombe sur un arrondi et vaut **0 ou 1**.

Mesuré sur les cas réalistes (base 85→135, leads du jeu, cibles 200→420) : sans
le Swift, **40 % demanderaient un point de trop peu**. On appliquerait
« +18 SPD », on resterait à 1 du compte, et l'outil réclamerait ce dernier
point — un « il manque 1 de SPD » qui ne s'en va jamais.

⚠️ **Le GAIN DE PASSIF se retire de la cible.** La vitesse que le solveur vise
est celle que la card affiche, gain compris (`combatDe` = vitesse de combat +
`gainPassifDe`) ; les runes, elles, ne portent que la première part. Viser la
cible entière reviendrait à demander en runes ce que le passif donne déjà —
**+40 de trop** sur un Chilling à deux buffs.

⚠️ **« Il manque 0 » est une contradiction** : si un monstre doit aller plus
vite, le plus petit conseil possible est **+1**. Le calcul ne rend pas 0
— le solveur ne réclame qu'une vitesse strictement supérieure à l'actuelle, et
l'aller-retour est exact, Swift et passif compris. Un plancher
à 1 reste posé en **filet**, pas comme correctif : il empêche qu'un arrondi futur
affiche « +0 SPD », ce qui enverrait chercher une correction déjà faite.

Quatre vérifications tiennent la règle : l'**aller-retour exact** sur les 135 252
combinaisons, l'**absence de conseil nul** sur toute la plage, le **retrait du
gain de passif**, et deux **contrôles de source** sur l'appelant — les invariants
ne valent que si le Swift et le passif lui sont transmis.

### ⚠️ Le plus rapide se juge GAIN DE PASSIF COMPRIS

L'adversaire de référence est une **copie du plus rapide allié**. Encore
faut-il désigner le bon.

`gainPassifDe` lit `cumulsPassif ?? 0` : tant que le **compte de buffs** n'est
pas écrit, un monstre à passif de vitesse vaut sa vitesse **sans son gain**.
Chilling à 404 (364 + 40 pour 2 buffs portés) se lirait donc 364, et Ciri à 375
lui passerait devant — la référence copierait le mauvais monstre.

⚠️ **Et le compte s'écrit par un EFFET** (`estimerCumuls`), donc au rendu
**suivant**, alors que l'analyse part dans le même rendu. Le résultat
dépendrait de l'ordre d'arrivée des données : bonne référence quand les kits
sont déjà en cache, mauvaise à la **première ouverture** de la modale.

`plusRapideAllie` compare donc sur les lignes **dont les cumuls sont estimés**
— en réutilisant `estimerCumuls`, jamais un calcul recopié : c'est lui qui porte
la règle (une case **jamais touchée** s'estime, une case **vidée à la main**
reste vide). Deux écritures de cette règle, et le modèle cesserait de suivre
l'écran.

### ⚠️ Un boost de barre SOUS CONDITION ne se compte pas

Le S2 de Sylvia augmente la barre de tout le camp — mais seulement **si** le
retrait de buffs en a enlevé au moins deux :

> « … removes all beneficial effects on the target. **If** there are 2 or more
> beneficial effects removed, the Attack Bar of all allies will be increased by
> 20% each. »

Un speed tune est ce qui tient **sans rien attendre de l'adverse** : annoncer ce
boost, c'est promettre un tick qu'on n'aura pas toujours. Il n'est donc pas
détecté.

⚠️ **Ni la `chance` ni un « if » quelque part dans le texte ne suffisent à le
dire.** Mesuré sur les 498 effets « Increase ATB » du corpus :

- **269** portent `chance: 0`, dont **220 sans aucune condition** — le champ ne
  veut rien dire ici ;
- **145** compétences contiennent un « if », qui gouverne le plus souvent une
  **autre** phrase que celle du boost.

Seule la **phrase qui porte l'augmentation** fait foi. Et on n'écarte que si
**toutes** ses phrases d'augmentation sont conditionnelles : deux compétences du
corpus (Mega Impulse Gun) en mêlent une conditionnelle et une qui ne l'est pas,
leur boost reste annoncé. **112 compétences** sont concernées.

⚠️ **Exception : une action IRRÉSISTIBLE se produit toujours**, donc la condition
qu'elle porte est acquise et le boost compte. Aucun cas aujourd'hui — 64
compétences emploient le mot, aucune n'est parmi les 112. La règle garde l'avenir.

⚠️ Sans description (fiche incomplète), aucune condition ne peut être lue : le
boost reste annoncé. On ne suppose pas une condition qu'on n'a pas vue.

### À barre égale, priorité fixée à l'ouverture

Quand plusieurs monstres atteignent 100 % de barre au même tick, un seul prend
le tour. Le départage suit cet ordre :

1. la **barre** la plus haute ;
2. la **vitesse de combat avant les buffs de départ** la plus haute ;
3. le **camp attaquant**, si ces vitesses initiales sont égales ;
4. l'**ordre de placement** dans le camp.

Le gain de Chilling activé par Volonté/Bouclier remplit sa barre, mais ne
modifie pas le classement initial. Le moteur le transporte dans
`gainApresBuffs` et le retire seulement de la vitesse de départage.
Les gains permanents, comme les +15 de Shumar, restent dans cette vitesse.
Un buff VIT ou un ralenti reçu pendant le combat ne reclasse pas non plus
les priorités initiales.

**Contrôles en arène, totem +15 %, deux buffs sur Chilling :**

| Chilling | Adversaire | Premier tour |
| --- | --- | --- |
| Swift +54, sans lead : 170 +40 | Rina sans Swift +96 : 210 | Rina |
| Sans Swift +53, sans lead : 170 +40 | Même Rina : 210 | Rina |
| Sans Swift +54, sans lead : 171 +40 | Même Rina : 210 | Chilling |
| Swift +225, lead 24 % : 365 +40 | Rosemary Swift +233, lead 33 % : 405 | Rosemary |

Source de la règle de classement avant les buffs :
[SWCalc, Speed Calculation](https://swcalc.cz/game-mechanics).
Le départage compte dans le tableau, l'analyse automatique et la référence
copiée en face. Les solveurs conservent le gain après buffs quand ils changent
la vitesse de runes : ce gain ne devient pas une vitesse initiale.

⚠️ **Ton équipe et « En face » se distinguent à la COULEUR, pas à la position.**
`good` pour le tien, `bad` pour l'adverse — la sémantique de l'app, où `bad` dit
déjà « ce qui te coupe ». ⚠️ **Pas `accent`** : il dit « ceci est actif ou
sélectionné », pas à qui appartient une ligne, et sur le thème Forge il est
cuivre — « ton équipe » y virait à l'orange, à un cheveu du `warn` voisin.

- **Le panneau d'un camp** porte son contour (`border-good/45` /
  `border-bad/45`) et son bandeau de titre (`good-soft` / `bad-soft`).
  ⚠️ Le contour **remplace** celui du panneau au lieu de s'y ajouter : deux
  contours concentriques sont interdits par la charte.
- **La colonne des noms** des trois tableaux porte la même teinte. C'est la seule
  qui reste à l'écran quand on défile les 40 ticks : sans elle, on lit une ligne
  de chiffres sans savoir si elle est à soi ou en face. ⚠️ Fond **solide**
  (`-soft`), jamais une transparence — la colonne est collante et passe
  par-dessus le tableau qui défile dessous.
- Le repère des ticks garde son contour `bad` sur les portraits adverses, et la
  pastille « adv » reste : une couleur seule ne se lit pas en niveaux de gris.
