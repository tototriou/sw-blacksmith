# Dégâts réels — effets posés entre les coups

Un sort à plusieurs coups peut poser un effet néfaste (Marque, Réduction de
DEF…) dès un de ses premiers coups : les coups suivants le subissent. Ce
document dit quels sorts le proposent, quels coups posent, ce que le calcul lit
de la cible, comment le joueur le règle, et ce que le calcul en fait. Code :
`effetsEntreCoupsDuSort`, `EFFETS_ENTRE_COUPS_EXCEPTIONS_PAR_ID`,
`EFFETS_ENTRE_COUPS_PAR_PASSIF_PAR_ID`, `BRUT_PAR_EFFET_CIBLE_PAR_ID`,
`BRUT_PAR_EFFET_CIBLE_PAR_PASSIF_PAR_ID`, `COUPS_AU_HASARD_PAR_ID`,
`rangsDePoseProposes` et `calculerChronologie` dans
[damage.ts](../../../src/lib/damage.ts) ; écran :
[DamageSetupCard.tsx](../../../src/components/outils/DamageSetupCard.tsx).

La liste des sorts, sort par sort, est dans
[inventaire-effets-entre-coups.md](inventaire-effets-entre-coups.md). Les
valeurs fournies par l'utilisateur pour ces mécaniques (2026-11-02) sont dans
[valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md).

Voir aussi : [feat-conditions-et-audit.md](feat-conditions-et-audit.md)
(compteurs de débuffs, conditions « la cible porte un effet nocif »),
[feat-passifs-offensifs.md](feat-passifs-offensifs.md) (ce qu'un passif qui
suit le sort lit après ses coups), [feat-sequences-de-coups.md](feat-sequences-de-coups.md)
(séquences curées et cible secondaire).

## Quels sorts

Un sort **actif calculé** à **plusieurs coups** (au moins deux, plage de coups
et groupes d'une séquence curée comptés) propose chaque effet néfaste que **sa
donnée** pose sur l'ennemi (`type: 'Debuff'`, `surSoi: false`), plus ceux
qu'un passif du monstre pose à chaque attaque (plus bas). Un effet n'est
proposé que s'il change un chiffre :

- **toujours** la Réduction de DEF (`Decrease DEF`) et la Marque (`Brand`) :
  elles changent la DEF ou les dégâts subis des coups suivants (et, pour Sin
  feu, l'écart de DEF de Martial Arts Specialist, pris sur la DEF réduite :
  utilisateur, 2026-11-02) ;
- **un autre effet néfaste** (Étourdissement, Irrécupérable, Gel…) quand le
  compte ou la présence des effets nocifs de la cible est **lu** : par le
  sort (bonus par effet nocif, condition « la cible porte un effet nocif »,
  dégâts bruts par effet nocif) ou par le monstre (Spirit's Wrath d'Aeilene,
  Tiger's Appearance de Naomi, Ancient Power de Tesarion, King of the Ruins de
  Manannan, Backup Code de 570RM, Start of Pain de Kiki, Nano Vision d'Amber) ;
- **un dégât continu** aussi quand seuls les dégâts continus sont comptés
  (Yoga Sunburst, Chemical Gas Spray, les deux « Havoc ») — un Étourdissement
  n'y est alors pas proposé ;
- **une baisse de VIT** quand la VIT de la cible est lue (bonus selon l'écart
  de VIT de Chun-Li et Leah lumière et de Sonia, formule à VIT de la cible,
  ignore DEF selon l'écart de VIT, critique si plus rapide) ;
- **un Étourdissement** qui allume le bonus « cible sous un effet
  d'incapacité » du sort (Arrow of Water de Sharron, Dark Storm de Grogen).

La règle lit la donnée de **chaque identifiant**, jamais un nom : « Blackout
Kick » compte quinze homonymes au texte différent, et seul 3454 (Sia) pose une
Réduction de DEF. Elle suit le corpus sans curation : un sort ajouté par des
données régénérées est proposé s'il porte l'effet, et l'inventaire figé
(`testInventaireEffetsEntreCoups`) le signale pour relecture.

Les sorts du mode archer des anges jumeaux (Focus Shot, Air Shot), venus de
leur compétence auxiliaire, suivent la même règle, comme les séquences curées.

### Effets posés par un passif à chaque attaque

Un passif qui pose un effet à chaque attaque le rend posable entre les coups
de chaque sort du monstre (`EFFETS_ENTRE_COUPS_PAR_PASSIF_PAR_ID`, lu dans la
prose du passif) ; le libellé nomme le passif :

| Passif | Monstre | Effet |
| --- | --- | --- |
| Chaser | Loren lumière | Réduction de DEF |
| Feast of Blood | Cadiz ténèbres | Marque |
| Precision | Shaina feu | Réduction de DEF |
| Contaminated Blood | Jultan ténèbres | Réduction de DEF (ses dégâts continus, sans lecteur, ne sont pas proposés) |
| Wild Chase | Narsha lumière | Réduction de DEF |
| Might · Thunder | Dyeus lumière | Réduction de DEF en état Thunderer (son Étourdissement, sans lecteur, n'est pas proposé) |
| Blood Talon, Heaven's Might | Hwoarang feu, Taebaek feu | Marque |
| Nano Vision | Amber eau | Irrécupérable, compté par sa règle brute |
| Empathy, Dimensional Memory | Übel ténèbres, Wieb ténèbres | Marque ou Réduction de DEF, au choix du joueur (« 1 random harmful effect that was applied in the current battle ») |

Ne sont pas retenus : Ancient Power (Tesarion), dont l'Oubli est posé à la fin
de l'attaque ; King of the Ruins (Manannan), dont les dégâts continus « after
each hit » touchent les autres ennemis, pas la cible (utilisateur,
2026-11-02) ; Eagle Deception (Bayek ténèbres) et Eye of the Desert (Salah),
dont la bête frappe « a random enemy … when you attack on your turn » sans
dire ni la cible ni l'instant ; Severing Edge et Dimension Shatter (Übel et
Wieb vent), dont les coups en plus sont ceux du passif ; Blessing of Curse
(Jessica lumière), qui donne à la cible « 1 of the harmful effects granted on
yourself », inconnu d'avance.

## Ce que le calcul lit de la cible

Les lecteurs propres à ces sorts, codés le 2026-11-02 (valeurs de
l'utilisateur), chacun avec son compteur à l'écran :

| Sort ou passif | Ce qu'il lit | Comment |
| --- | --- | --- |
| Yoga Sunburst (DHALSIM vent 14213), Chemical Gas Spray (Jarrett 14728) | les dégâts continus de la cible | +50 % par dégât continu (`source: 'degatsContinus'`) |
| Reelseiden・Havoc (Übel feu 25212), Dimension Slash・Havoc (Wieb feu 25712) | les dégâts continus de la cible | dégâts bruts : 5 % des PV max de la cible par dégât continu, à chaque coup |
| Start of Pain (Kiki ténèbres, sur chacun de ses sorts) | les effets néfastes de la cible, 2 au plus | dégâts bruts : 4 % des PV max de Kiki par effet, à chaque coup |
| Nano Vision (Amber eau, sur chacun de ses sorts) | les effets néfastes de la cible, 3 au plus | dégâts bruts : 4 % des PV max de la cible par effet, à chaque coup |
| Bullet Assassination (Nina lumière 22714), Shining Butterfly (Shasha lumière 23214) | la présence d'un effet néfaste | dégâts bruts : 25 % des PV max de la cible, au dernier coup seul |
| Critical Link (Savannah 13608, Narsha 13609) | les effets néfastes de la cible | +15 % par effet, au coup du cavalier (le 2ᵉ) seul ; la bête convertit au coup 1 chaque effet bénéfique en un dégât continu, et le joueur saisit combien |
| Fatal Mortar Bullet (Scarlett 13312) | les effets bénéfiques et néfastes de la cible | +25 % par effet, phase de zone seule ; la Réduction de DEF et la Marque du coup 1 y comptent sur la cible visée |
| Hairpin: Black Flash (Nobara ténèbres 20315), Exorcist Shuriken Formation (Aya ténèbres 20915) | la présence d'un effet néfaste | +100 % au coup 2 seul ; la Réduction de DEF du coup 1 le déclenche |

Les dégâts bruts vont au seau Additionnel : ni critiques, ni mitigés par la
DEF, ni majorés par les artéfacts de dégâts élémentaires, Marque comprise
(`BrutParEffetCibleProfile`). La cible est supposée hors boss : l'écran ne la
décrit pas comme telle. Le compteur de Start of Pain et de Nano Vision vit sous
la clé du passif, partagé par tous les sorts du monstre ; la présence (Nina,
Shasha) se règle par un interrupteur, que Brise DEF et Marque allument aussi.
Les PV max de Kiki entrent dans les stats que la recherche privilégie.

Le coup qui seul lit les effets (Critical Link, Hairpin, Bullet Assassination,
Fatal Mortar Bullet) vient d'une séquence curée dont les autres groupes sont
`horsLecteurs`.

## Quels coups posent

- **La note de l'effet**, quand elle nomme un rang (« 1st hit », « 2nd and
  3rd hit », « First 3 hits », « 4th hit only », « Only first hit »…) :
  chaîne exacte de la donnée (`RANGS_PAR_NOTE`), jamais une expression
  régulière.
- **Sinon la prose**, quand elle le dit et que la donnée ne le dit pas : une
  entrée de `EFFETS_ENTRE_COUPS_EXCEPTIONS_PAR_ID` (Crushed Hopes, « the second
  attack decreases the Defense » : coup 2).
- **Sinon chaque coup** : une prose qui ne précise pas le coup pose à chacun
  (règle de l'utilisateur, 2026-11-02), et le joueur choisit après lequel la
  pose réussit. Un passif qui pose à chaque attaque rend lui aussi l'effet
  posable à chaque coup.

Un effet posé au **seul dernier coup** ne change rien au sort et n'est pas
proposé (Domain Expansion de Megumi, Continuous Summoning Technique de
Tetsuya, Crushing Swipe de Daisy et Christine : « the last hit decreases… »),
sauf s'il vaut pour l'attaque que le sort enchaîne (Shoryuken, plus bas). Le
Gel de Grinding (Espresso Cookie eau) et de Spinning Tea Spoon (Rosemary eau),
« attacks once more to freeze them », vient lui aussi au dernier coup. La
donnée n'ayant pas de note de rang, c'est l'absence de lecteur qui l'écarte :
le +200 % de Cold Brew et d'Iced Tea contre une cible gelée est un
interrupteur de passif (`BONUS_DEGATS_CONDITIONNEL_CONNUS`), qu'aucune pose
n'allume. Relier un jour ce Gel à l'interrupteur, comme l'Étourdissement
d'Arrow of Water, demanderait d'abord l'exception « dernier coup » : le
résultat ne changerait pas.

Un coup en plus **déduit des stats** compte dans les rangs proposés : Brutal
Fists (Mayasura, Varuna, Usha, Danu, Vritra) propose une pose après le coup 3,
qui ne change rien quand le 4ᵉ coup n'a pas lieu (ATQ sous celle de la
cible). La recherche le décide build par build, l'écran ne peut pas le
savoir d'avance.

Une note qui pose une **condition** plutôt qu'un rang s'affiche après le
libellé (`PRECISION_PAR_NOTE`) : « un seul des effets possibles par coup, au
hasard » (Virus), « en état Thunderer » (Wild Bolt), les deux branches de
Divine Judgment (Arella), « un par effet bénéfique converti » (Critical Link) ;
un effet de la donnée marqué `surCritique` porte « sur coup critique » (Triple
Attack de Cogma). Une condition de la note que la prose n'écrit pas est
ignorée, la prose faisant foi : « 5th hit if removed buff » (PPK Combo, Chain
Combo Attack) ne garde que son rang. Un effet posé aussi sans condition (par
un passif, par exemple) ne garde pas de condition.

Deux entrées du même effet s'unissent : des rangs différents donnent tous
leurs rangs (Triple Combo de RYU : coups 1 et 2) ; deux entrées identiques
d'un effet cumulable posent chacune le leur (Meteor Strike de Triss et Black
Meteor de Celestara : deux dégâts continus par coup, `nombre: 2`).

## Exceptions lues dans la prose

`EFFETS_ENTRE_COUPS_EXCEPTIONS_PAR_ID` corrige la donnée d'un identifiant,
jamais ne complète la règle :

| Sort | Correction | Prose |
| --- | --- | --- |
| Shoryuken (RYU 13907, 13908, 13910), Iron Uppercut (Douglas 14407, Kashmir 14408, Vancliffe 14410) | Marque au dernier (et seul) coup, pour le S1 enchaîné | « leaves a Branding effect … [Hadoken] will be activated in succession » |
| Critical Link (Savannah 13608, Narsha 13609) | dégâts continus au coup 1, nombre saisi | « The beast's attack changes all beneficial effects granted on the target to Continuous Damage » |
| Arrow of Water (Sharron 6811), Dark Storm (Grogen 2910) | Étourdissement proposé ; posé, il allume le +50 % du sort pour les coups suivants | « each having a 25% chance to stun the enemy. The damage increases by 50% if the target is under inability effects » |
| Undefeated Warrior (Kuna 9515, séquence) | aucune Réduction de DEF | « You sequentially attack all enemies and decrease their Defense » : la phase de zone, la dernière |
| Ghost Appearance (Smokey 11507, Misty 11509) | « un seul des effets possibles par coup, au hasard » | « Each hit has a 50% chance to cast one random effect among … » |
| Roll Dice (Reno 12101, Ludo 12102, Morris 12103, Tablo 12104, Monte 12105) | Réduction de DEF « sur un 5 au dé » | « grants an effect according to each number you get … 5: Decrease DEF » |
| Fatal Mortar Bullet (Scarlett 13312, séquence) | Réduction de DEF au coup 1, comme la Marque (note « Only first hit ») | « Attacks the enemy with a cannon gun and weakens the Defense and leaves a Branding effect … Afterwards, attacks all enemies » |
| Soul Summoning (Rigel 7501, Fuco 7503) | pas de Réduction de DEF, une Réduction de VIT | « Each attack has a 40% chance to decrease the enemy's Attack Speed » (la donnée dit `Decrease DEF`) |
| Crushed Hopes (Cichlid 10413) | Réduction de DEF au coup 2 | « the second attack decreases the Defense » |
| Fast Link (Barbara 13606, Masha 13607, Xiana 13610) | Réduction de DEF au coup 1, pour le coup 2 seul | « The beast's attack decreases the enemy's Defense » ; la bête attaque en premier (utilisateur) |
| Weakness Shot (Carlos 15507, Dominic 15508, Benedict 15509) | Marque au coup 1 | « Attacks the enemy to leave a Branding effect … and attacks 3 more times » |
| Axe Technique of the Mercenary Queen (Solveig 18007, Berghild 18009) | Marque au coup 1, absente de la donnée | « The first attack leaves a Branding effect for 1 turn with a 100% chance » |
| Wild Bolt (Vendhan 18127, Dyeus 18129) | Marque « en état Thunderer » | « When used during the Thunderer state, leaves a Branding effect » (la note ne figure que sur Chakra, 18128) |
| Whirlpool (Tanjiro 21311), Water Dragon Surge (Azure Dragon Swordsman 21911) | Gel au coup 1 ; les dégâts continus des coups en plus ne sont pas proposés | « Attacks all enemies to Freeze them … Deals additional damage 2 more times to targets with harmful effects » |

## Coups au hasard, ignore DEF par coup

Un sort dont des coups frappent des ennemis **au hasard**
(`COUPS_AU_HASARD_PAR_ID` : Kung Fu Girls S3, Katarina, Zenitsu et Qilin
Slasher, Arrow Storm, Wolf Hunt, Shooting Star, Hairpin: 4 Nails, Splash
Splash…) se règle par « Coups qui touchent la cible » : de 1 aux coups du sort,
**tous par défaut** (utilisateur, 2026-11-02 : aucun total d'avant ne change).
Katarina et Splash Splash, « 2 to 3 times » au hasard après un coup sur la
cible : 3 par défaut, 4 au plus. Splash (Maris, Noctaris) frappe la cible puis
« a random enemy » : 2 par défaut. Les coups proposés pour une pose suivent le
nombre retenu.

Ne sont pas des coups au hasard : un effet tiré au hasard (Ghost Appearance,
Surprise Box, Dice Trick), une attaque appelée au hasard (Rolling Punch,
Giant's Punch), un tir qui choisit sa cible (Magic Shot, Full Burst).

**Dark Dragon Attack (Fei)** : chacun des quatre coups ignore la DEF « with a
25% chance each » — un interrupteur par coup retenu (« Coups qui ignorent la
DEF »), aucun coché par défaut (`DamageSetup.coupsIgnorantDefParSort`).
**Sword of Discharge (Katarina)** : « The enemy's Defense is ignored when used
in invincible state » — l'interrupteur « Katarina est sous Invincibilité »
fait ignorer la DEF à tous ses coups, aucun sinon.

## Séquences et cible secondaire

PPK Combo (RYU ténèbres) et Chain Combo Attack (Vancliffe) frappent 4 fois la
cible puis 2 fois en zone ; Tempest Sword (Lupinus) 2 fois la cible puis une
fois en zone, au même ratio. Les trois proposent « Dégâts sur les autres
ennemis », qui ne reçoivent que les coups de zone. Une pose n'atteint la cible
secondaire que si elle vient d'un coup de zone : sur PPK Combo, la Réduction de
DEF se pose aux coups 4 ou 5 sur la cible visée, au coup 5 seul pour les autres
ennemis ; la Marque de Fatal Mortar Bullet (coup 1, mono-cible) ne les touche
jamais. Détail des séquences : [feat-sequences-de-coups.md](feat-sequences-de-coups.md).

## Le réglage à l'écran

Dans la fenêtre « Dégâts réels », parmi les réglages du sort, l'interrupteur
« Prendre en compte les débuffs posés entre les coups » ouvre une ligne par
effet proposé :

- **un seul coup pose** l'effet : un interrupteur « Posé au coup N » ;
- **plusieurs coups** le posent : un sélecteur « Aucune réussite », puis
  « Après le coup N » pour ces seuls coups (`rangsDePoseProposes`, toujours
  avant le dernier coup que le réglage retient, et pour la cible secondaire
  les seuls coups de zone) ;
- un effet non cumulable que la cible peut déjà porter garde son
  interrupteur « déjà présent » ; la Réduction de DEF et la Marque lisent
  « Brise DEF » et « Marque » du réglage ;
- Critical Link ajoute « Effets bénéfiques convertis » (0 à 10).

Un sort sans aucun effet proposable n'affiche pas la section. Les compteurs
des lecteurs (« Start of Pain : effets néfastes sur la cible (0 à 2) »,
« Effets de dégâts continus sur la cible »…) s'affichent avec les autres
réglages du sort.

## Le calcul

Rien n'est jamais supposé posé : sans scénario actif, ou actif sans réussite,
le total ne change pas. Sous scénario, chaque coup lit l'état qui le précède
(`calculerChronologie`) : après le coup choisi, la Réduction de DEF et la
Marque s'appliquent aux coups suivants ; un autre effet ajoute un effet nocif
aux compteurs qui le comptent (le nombre de la pose pour un effet cumulable,
celui que le joueur saisit pour Critical Link, rien pour un effet non cumulable
déjà présent), un dégât continu seul aux compteurs de dégâts continus. Une
pose demandée à un coup qui ne pose pas l'effet (recette importée, données
régénérées) n'a pas lieu.

Un ralentissement baisse de 30 % la VIT adverse saisie pour les coups
suivants, le pendant exact du buff de VIT (utilisateur, 2026-11-02) ; le bonus
selon l'écart de VIT se calcule alors part par part (`partsVit`), le reste du
total gardant la VIT du réglage.

Un effet qui allume l'interrupteur propre au sort (Arrow of Water, Dark
Storm) l'allume pour les coups qui suivent la pose seulement, sans toucher au
réglage.

Une séquence curée se calcule groupe par groupe ; sous scénario, chaque coup
d'un groupe lit l'état qui le précède.

Whirlpool et Water Dragon Surge n'ont qu'un coup de base : leurs deux coups en
plus ne frappent qu'une cible affligée. Le Gel posé au coup 1 les donne
(`poseAvantLesCoupsEnPlus`), exactement comme l'interrupteur « La cible porte
un effet nocif » : même total.

Une contribution qui suit le sort (passif, attaque appelée) lit l'état après
son dernier coup, poses comprises
([feat-conditions-et-audit.md](feat-conditions-et-audit.md#correctifs-de-contexte-et-de-dégâts-fixes)).
C'est par là que la Marque de Shoryuken et d'Iron Uppercut, posée à leur seul
coup (`pourLaSuite`), vaut pour [Hadoken] et [Mach Punch] enchaînés, sous leur
interrupteur d'attaque appelée
([feat-attaque-apres-un-sort.md](feat-attaque-apres-un-sort.md)).

## Écartés

- **Sans dégâts calculés** : Harmless Prank d'Orion (8811), qui pose sans
  frapper ; Rolling Cannon de Christina (13313), qui frappe mais dont la
  formule (`5.7*{Alive Allies %}*{ATK}`) n'est pas prise en charge ; Shoot
  n' Slash de Barque vent (10223), sans formule : il enchaîne Backspin Slash,
  qui baisse la DEF, et Pirate's Strike, qui pose une Marque, à +35 % par
  effet nocif de la cible. Sa règle est décidée (break DEF de la première
  frappe pour la seconde, bonus recalculé avant chaque frappe :
  [valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md), 2026-09-24), la
  chaîne n'est pas codée
  ([piste](../../05-feuille-de-route/pistes-degats-reels.md#chaînes-ordonnées)).
- **Couvert autrement** : Guilty Sentence (Agrenia feu 23507, Driana vent
  23508, Theonia ténèbres 23510) n'a qu'un coup ; son attaque en plus est une
  attaque auxiliaire qui suit le sort et lit la Réduction de DEF qu'il pose
  par le réglage « Ce sort pose le def break »
  ([feat-passifs-offensifs.md](feat-passifs-offensifs.md#la-réduction-de-défense--avant-nest-pas-après)).
  De même, Exploding Hands de Jackie ténèbres (11015) n'a qu'un coup, qui
  étourdit ; son attaque en plus (auxiliaire 11016) se règle par
  l'interrupteur « l'étourdissement de ce sort réussit ». La clause de
  l'auxiliaire, « if the enemy is under inability effects, this attack will
  deal 25% of the target's remaining HP as additional damage », n'est pas
  comptée ([piste](../../05-feuille-de-route/pistes-degats-reels.md#répétition-du-sort-retenu)).
- **Préfixe d'enchaînement** : Hunting Hawk (Hwoarang feu, 22507) et
  Roundhouse Kick Combo (Taebaek feu, 23007) frappent d'abord avec Backlash
  ou Triple Kick contre une cible sans effet bénéfique ; ce préfixe n'est pas
  compté, la Marque de leur passif n'est proposée qu'après leur coup 1
  ([piste](../../05-feuille-de-route/pistes-degats-reels.md#chaînes-ordonnées)).
- **Lecteur inverse** : Hammer Punch (Tractor, Bulldozer, Crane, Driller,
  Crawler ; 11651 à 11655) frappe une fois de plus « If the target is not
  suffering any harmful effects » ; le nombre de coups se décide avant
  l'attaque, jamais pendant (utilisateur, 2026-11-02) : un Étourdissement posé
  par un coup n'y change rien.
- **Spear of Thunder** (Asbolus ténèbres, 23415) lit l'écart de VIT, mais ce
  bonus n'est pas compté du tout (formule `1.4*{ATK}` seule) : sa baisse de VIT
  n'est pas proposée.
- **Écart d'ATQ non compté** : Hellfire Trespass Slayer (Jin Kazama vent,
  22413) et Thunderous Killer Strike (Kai vent, 22913) baissent l'ATQ de la
  cible à chacun de leurs 5 coups et « Deals additional damage in proportion
  to your Attack Power if your Attack Power is higher than the target's ».
  Ce bonus n'est pas calculé, faute de formule (utilisateur, 2026-11-02 ;
  [piste](../../05-feuille-de-route/pistes-degats-reels-stats.md#composantes-conditionnelles-et-comptées)) :
  la baisse d'ATQ n'est pas proposée.
- **Compte après l'attaque** : Moonlight Blow (Belita ténèbres, 12615) ôte
  5 % des PV de la cible par dégât continu « afterwards », après ses deux
  coups : le compte se prend une fois le sort fini, jamais entre les coups.
  Cette perte n'est d'ailleurs pas comptée (`CALCUL_PARTIEL_PAR_ID`).
- **Détonation des dégâts continus** : Rage of Helheim (Eivor vent, 17513) et
  Stormy Axe (Astrid vent, 18013) posent des dégâts continus aux coups 1 à 3,
  que le coup 4 fait exploser ; la détonation est hors du total par décision
  (écartée de `CALCUL_PARTIEL_PAR_ID`, le total étant complet), les dégâts
  continus ne changent donc rien.
- **Coups non comptés** : Cleave (19910) et Exorcism Orb (20510), « the number
  of hits increases up to 6 times », se calculent sur 2 coups
  ([piste](../../05-feuille-de-route/pistes-degats-reels.md#plages-de-coups-à-relever-et-coups--au-hasard-)).
- **Enchaînement vers un autre sort** : Energy Ball et Wield vers un sort à un
  coup ; Twist Kick des Kung Fu Girls (Xiao Lin 8216, Hong Hua 8217, Liu Mei
  8219), dont la baisse de VIT et l'Étourdissement précéderaient les 4 coups
  de leur [Dragon Attack] (celui de Xiao Lin lit +15 % par effet nocif). Une
  pose ne vaut qu'entre les coups d'un même sort, et ces enchaînements ne sont
  pas calculés ([piste](../../05-feuille-de-route/pistes-degats-reels.md#chaînes-ordonnées)).
- **Répétition du sort par un passif** : Burning Whip de Hwa (6912) « strikes
  again » ; la répétition n'est pas calculée, l'effet posé par le premier
  passage n'a donc rien à majorer
  ([piste](../../05-feuille-de-route/pistes-degats-reels.md#répétition-du-sort-retenu)).

## Vérification

- `testInventaireEffetsEntreCoups` fige l'inventaire des formes jouables
  (`tests/fixtures/effets-entre-coups-inventaire.json`) : sorts, effets,
  rangs, porteurs ; toute note d'un effet proposé est classée.
- `testEffetsPosablesConnus` : chaque effet `Debuff` du corpus a son libellé.
- `testEffetsEntreCoupsRegle` : rangs, exceptions, interrupteur allumé par
  l'Étourdissement, passifs poseurs, coups saisis, coups en plus, compte et
  invariance sans réussite sur tout l'inventaire.
- `testEffetsEntreCoupsMecaniques` : coups au hasard, Fei et Katarina,
  séquences et cible secondaire, lecteurs (Yoga Sunburst, Havoc, Kiki, Amber,
  Bullet Assassination, Critical Link, Hairpin, Fatal Mortar Bullet),
  ralentissement, Empathy, Marque de Shoryuken pour [Hadoken].
- `testRenduEffetsEntreCoupsEcran` : interrupteur, sélecteur limité, section
  absente, compteurs, aux deux formats.

Tests : [tests/degats-effets-entre-coups.test.ts](../../../tests/degats-effets-entre-coups.test.ts),
[tests/rendu/effets-entre-coups-ecran.test.tsx](../../../tests/rendu/effets-entre-coups-ecran.test.tsx).
