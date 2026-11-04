# Dégâts réels — pistes futures

Voir aussi : pistes-degats-reels-stats.md, [../02-app/degats-reels/](../02-app/degats-reels/), pistes-optimizer.md.

Les pistes des dégâts réels se partagent en deux fichiers, selon la question
qu'elles posent. Celui-ci tient **quels coups sont comptés** : attaques
déclenchées et hors tour, nombre de coups, séquences, poses et comptes entre
les coups. [pistes-degats-reels-stats.md](pistes-degats-reels-stats.md)
tient **ce que vaut un coup** déjà compté : VIT, DEF ignorée, critique,
composantes, pertes de PV, stats des passifs, recherche des runes.

Une piste est ce qui n'est pas fait : le **constat** (ce que le code fait,
avec sa coordonnée), l'**idée** (la forme du réglage quand elle est déjà
choisie) et ce qui la **bloque**. Les valeurs de jeu fournies sont dans
[02-app/degats-reels/](../02-app/degats-reels/). Un relevé en jeu est
un rapport entre deux lancers qui ne diffèrent que d'une chose, avec sa
règle de décision posée d'avance (skill `game-data-curation`, § 6 bis), et
ne vaut que pour le sort mesuré. Un sort dont une part décidée n'est pas
codée porte « Calcul partiel »
([02-app/degats-reels/feat-formules-et-combat.md § Calcul partiel — l'étiquette par identifiant](../02-app/degats-reels/feat-formules-et-combat.md#calcul-partiel--létiquette-par-identifiant)).

## Attaques déclenchées et hors tour

### Contre-attaque : ligne d'artéfact 208

- **Constat** : aucune contre-attaque n'est modélisée ; 208 (« Dgts de
  contre-attaque ») vaut 0, et 225 ne compte que pour sa part d'attaque
  conjointe.
- **Idée** : un interrupteur de contre-attaque, sur le modèle de
  « Attaque conjointe ».
- **Bloque** : un chantier à cadrer (quels sorts, quelles lignes 224 et
  411 hors du tour).

### Passif « on your turn » après un S1 appelé par un allié

- **Constat** : l'interrupteur « Attaque conjointe » n'agit sur aucun
  autre réglage : Tempest (Teshar, Phoenix vent), qui frappe « after you
  attack the enemy on your turn », reste au choix de l'utilisateur quand
  le S1 est appelé hors de son tour.
- **Idée** : masquer ou éteindre l'interrupteur de Tempest quand
  « Attaque conjointe » est allumé.
- **Bloque** : une décision produit.

### Compétence active appelée par un sort

- **Constat** : `ATTAQUES_APPELEES_PAR_DECLENCHEUR` (`src/lib/damage.ts`)
  ne porte, après un sort qui frappe, que le S1 enchaîné de Shoryuken et
  d'Iron Uppercut ; les autres amorces acceptées (Drunken Kick, Phoenix
  Kick, Stork Kick, Snake Punch) ne sont pas curées, et aucun buff posé par
  un déclencheur n'est modélisé
  ([02-app/degats-reels/feat-attaque-apres-un-sort.md § Ce qu’il faudra fournir pour un autre cas](../02-app/degats-reels/feat-attaque-apres-un-sort.md#ce-quil-faudra-fournir-pour-un-autre-cas)).
- **Idée** : l'interrupteur d'une attaque appelée sous un en-tête à part,
  « Attaques déclenchées ». Seal Punch (`8111`) gardé : son Rolling Punch
  se calcule sans la VIT posée, l'écart (environ 0,5 %) dit à l'écran.
  Fire! de Bella suit son S1, S2 ou S4, interrupteur allumé par défaut.
  Tiger Punch (`8112`) : le buff d'ATQ posé avant l'attaque appelée.
- **Bloque** : un changement de code.

### Répétition du sort retenu

- **Constat** : Burning Whip (`6912`) et Forbidden Power (`4215`) n'ont
  aucune entrée dans `src/lib/damage.ts`, alors que leurs valeurs sont
  fournies ([02-app/degats-reels/](../02-app/degats-reels/),
  « Déclenchements de Hwa et Jackie », « Zeratu — Forbidden Power ») ; la
  répétition d'Elise sous 50 % de PV non plus, ni Chain Effect (`18132`,
  Vendhan feu : « uses the same skill again with reduced damage », taux non
  donné), ni les coups en plus de Severing Edge et Dimension Shatter
  (`25213`, `25713`, Übel et Wieb vent : « attacks the target 2 to 3 more
  times », `0.8*{ATK}`). Exploding Hands (`11015`) se
  répète par sa compétence auxiliaire, améliorations comprises, sans
  confirmation ([02-app/degats-reels/feat-competences-auxiliaires.md](../02-app/degats-reels/feat-competences-auxiliaires.md)) ;
  la clause de cette auxiliaire (`11016`), « 25% of the target's remaining
  HP as additional damage » contre une cible sous incapacité, n'est pas
  comptée, alors que la répétition n'a lieu que sur une cible étourdie :
  Exploding Hands porte « Calcul partiel » (`CALCUL_PARTIEL_PAR_ID`), qui
  en sort le jour où ce surplus se compte.
- **Idée** : répéter le profil du sort retenu, sans récursion, sous
  interrupteur, avec des clés de réglage distinctes de celles du sort. Les
  conditions sur la cible (Hwa, Blood Talon, Heaven's Might, Hunting Hawk)
  sont des interrupteurs. Les PV propres viennent d'une source unique ; un
  seuil de PV se règle par un interrupteur.
- **Bloque** : trois relevés. Elise sous 50 % de PV, répétition sur coup 1
  de la S1 : 1,00 → répétition pleine, 0,50 → demi. Burning Swing de Hwa
  sur une cible sans effet néfaste, répétition sur coup 1 : environ 1,15 →
  le dégât continu posé compte. Exploding Hands de Jackie, répétition sur
  coup 1 : 1,00 → les améliorations portent sur la répétition ; contre une
  cible aux PV connus (PV restants R), le surplus de la répétition comparé à
  0,25 × R, mitigé ou brut.

### Attaque sur un autre ennemi après une élimination

- **Constat** : Shadow Assault (`10713`, Tanya vent) attaque, si la cible
  meurt, l'ennemi au plus bas en PV, à +30 % de dégâts et sans effleurement ;
  sa compétence auxiliaire (`10716`) en donne le ratio, `7.7*{ATK}`, mais
  aucun calcul ne la lit : le coup frappe un autre ennemi que la cible
  configurée.
- **Idée** : le coup en plus sur la cible secondaire (« Dégâts sur les
  autres ennemis »), sous un interrupteur « la cible meurt ».
- **Bloque** : une décision produit (sur quelle cible le compter) et un
  relevé du +30 % (sur le ratio ou en multiplicateur à part).

### Chaînes ordonnées

- **Constat** : aucune chaîne de sorts n'est calculée. Kung Fu Girls :
  Energy Ball (S1, `8201` à `8205`) appelle Twist Kick ou Shadowless Kick
  (S2, `8216` à `8220`), qui appelle leur Dragon Attack (S3, `8211` à
  `8215`). Hwoarang ténèbres : Hunting Hawk (`22510`) frappe d'abord avec
  Backlash quand la cible n'a aucun effet bénéfique, et Trinity Claymore
  (`22515`) enchaîne Backlash, Hunting Hawk puis trois coups ; Taebaek
  ténèbres, son jumeau, porte Roundhouse Kick Combo (`23010`) et Endless
  Kick Combo (`23015`). Les versions feu, Hunting Hawk (`22507`, Hwoarang) et
  Roundhouse Kick Combo (`23007`, Taebaek), frappent de même d'abord avec
  Backlash ou Triple Kick contre une cible sans effet bénéfique : la Marque
  que leur passif (Blood Talon, Heaven's Might) pose pendant ce préfixe
  vaudrait pour leurs trois coups, alors que le calcul ne propose que la pose
  après leur coup 1 ([02-app/degats-reels/feat-poses-entre-les-coups.md](../02-app/degats-reels/feat-poses-entre-les-coups.md)).
  Leur passif lance aussi, contre une cible sous effet bénéfique, « [Hunting
  Hawk] / [Roundhouse Kick Combo] … in succession after the attack »
  (auxiliaires `22516` et `23016`, 3 coups, `{ATK}`), que rien ne calcule.
  Shoot n' Slash de Barque (`10223`, sans formule)
  enchaîne Backspin Slash et Pirate's Strike.
- **Idée** : ce que décide chaque chaîne
  ([02-app/degats-reels/](../02-app/degats-reels/)). Kung Fu Girls :
  chaque appel sous son interrupteur ; S3 choisi, un seul sort ; S1 choisi,
  la chaîne entière possible. Hunting Hawk : Backlash compté avant, la
  condition sur la cible en interrupteur. Trinity Claymore, choisi comme
  sort : toute la chaîne d'abord (S1 puis S2), puis ses 3 coups au ratio du
  sort ; aucun sort ne l'appelle. Barque : Backspin Slash puis Pirate's
  Strike, sans interrupteur de chaîne ; seul l'interrupteur du break DEF de
  la première frappe, qui profite à la seconde ; +35 % par effet nocif
  recalculé avant chaque frappe ; lignes 400 puis 401.
- **Bloque** : un changement de code, après la piste « Compétence active
  appelée par un sort ».

### Événements du monstre choisis seuls

- **Constat** : Tempest et trois passifs hors tour chiffrés par leur
  compétence auxiliaire (Rageful Return de Psamathe, les ripostes de
  Hollyberry Cookie et de Manon) sont `selectionnableCommeSort`
  (`src/lib/damage.ts`), sans facteur de riposte ; l'attaque d'état de
  Legolas et d'Elder Horn est leur S3, une fois. Un passif ne se choisit
  seul que sans
  ajustement propre à la boucle des passifs
  ([02-app/degats-reels/feat-attaque-apres-un-sort.md § Choisi seul — « Compétence utilisée](../02-app/degats-reels/feat-attaque-apres-un-sort.md#choisi-seul---compétence-utilisée-)).
- **Idée** : chaque événement du monstre choisissable seul (attaque à la
  mort, riposte, attaque d'état, passif qui frappe), sans les attaques
  d'alliés. Danu : un interrupteur « le passif se déclenche après ce sort »
  et le passif choisissable seul. Lob Ear de Gollum lumière : un état
  exclusif « cible étourdie ». Übel vent : deux coups ajoutés par défaut.
- **Bloque** : un changement de code, et des relevés, chacun un rapport à
  un sort du monstre sur la même cible. Sapsaree, tour gagné sous
  incapacité / S1 Bring It Here! (environ 1 → profil de la S1). Ripostes à
  formule propre de Hollyberry ou Manon, Isillen, Vritra (environ 1 →
  aucun facteur, environ 0,75 → facteur de `Counter`). Facteur de riposte
  du set Revenge, même S1 sur son tour puis en riposte, puis Aragorn ou
  Night Fang, Ursha, jamais étendu aux autres ripostes. Drogan 2A, Jultan,
  même effet contre ~500 puis ~2 500 de DEF (environ 1 → ignore la DEF).
  Legolas ou Elder Horn, attaque d'état / coup de Sindar's Volley ; Pure
  Vanilla ou Angela, riposte / bouclier absorbé ; Malite, riposte en
  statue / Earth Strike ; Madeleine Cookie feu ou Pavé, son jumeau,
  additionnelle / S1 ; Artamiel, S1 critique à k cumuls de Judge puis la
  contre-attaque ; Chakra, deux VIT puis Wild Bolt ; Übel vent, chaque
  coup ajouté sur une cible sans réduction de DEF. Danu : le passif
  peut-il critiquer ? Facultatifs : Jin et Kai feu, Frieren (écart de plus
  de 5 % → facteur hors tour).

## Coups et séquences

### Plages de coups à relever et coups « au hasard »

- **Constat** : `COUPS_VARIABLES_CONNUS` et `COUPS_VARIABLES_PAR_ID_CONNUS`
  (`src/lib/damage.ts`) ne portent ni Sindar's Volley ni Sylvan Volley
  (2 à 5 coups, valeur fournie), ni Wild Shot! (`13306`), Cleave
  (`19910`), Exorcism Orb (`20510`), Blade Dance of the Reaper (`10711`,
  Stella), Chain Fire, Arcane Discharge (`25412`, Freu feu, « Attacks all
  enemies 2 to 3 times », calculé à 2), ni les sorts de Lala et de Coco :
  ils frappent le nombre de coups de la donnée. Les coups au hasard d'un sort se règlent
  (`COUPS_AU_HASARD_PAR_ID`), mais pas l'attaque appelée au hasard
  (Rolling Punch), ni les tirs qui choisissent leur cible (Magic Shot,
  Full Burst).
- **Idée** : un compteur borné. Le défaut d'une plage est son minimum.
  Stella : coups selon la
  VIT totale de combat ([02-app/degats-reels/](../02-app/degats-reels/)).
  Chain Fire : salves de deux flèches, compteur par pas de 2. Lala : un
  sélecteur de 0 à 5 [Attack!], son S3 sans coup propre. Coco : compteur des
  sphères restantes sur S1 et S2, 5 par défaut, chaque sphère en dégâts
  fixes, valeur de la donnée.
- **Bloque** : un changement de code, et des relevés. Wild Shot! avec 4, 3,
  2 puis 1 ennemi vivant, coups reçus par un ennemi : une table, ou une
  somme constante répartie. Cleave et Exorcism Orb : la règle du nombre de
  coups, à tester d'abord en jeu, puis ATQ sous la DEF, à 1,5 fois, à 2
  fois. Hors inventaire : Rat Hunt sous Immunité.

### Séquences à valeur relevée

- **Constat** : `SEQUENCES_DE_COUPS_PAR_ID_CONNUS` (`src/lib/damage.ts`) ne
  porte ni Shoulder Smash (`22615`, Paul Phoenix) et Triple Break Combo
  (`23115`, Duke), ni Oathbreakers (`23815`, Aragorn) et Spirits of Wolf
  Warriors (`24315`, Night Fang), ni Triple Combo (`13913`, RYU vent) et
  Triple Crush (`14413`, Kashmir), chaque paire de jumeaux de même prose,
  ni Explosive Bullet : leur phase que la donnée ne chiffre pas manque au
  total. (Le coup en plus de Guilty Sentence
  s'ajoute sur interrupteur :
  [02-app/degats-reels/feat-competences-auxiliaires.md](../02-app/degats-reels/feat-competences-auxiliaires.md).)
- **Idée** : une séquence curée par sort
  ([02-app/degats-reels/feat-sequences-de-coups.md § La séquence curée — une table par identifiant](../02-app/degats-reels/feat-sequences-de-coups.md#la-séquence-curée--une-table-par-identifiant)).
  Un effet posé entre deux groupes se règle par le choix « après quel
  coup ».
- **Bloque** : des relevés, chacun sur la cible visée ; une mesure vaut
  pour une paire de jumeaux. Shoulder Smash ou Triple Break Combo, coup 3
  / coup 1 (deux nombres seulement → la zone exclut la cible).
  Oathbreakers ou Spirits of Wolf Warriors, chaque coup de zone / coup 1.
  Triple Combo ou Triple Crush, coup 3 / coup 2 avec la Brise DEF du
  coup 1 posée : 1,00 à 2 % → aucun coefficient final. Explosive Bullet,
  chaque phase / S1 Cross Fire.

### Skillups des séquences à valeur de l'API

- **Constat** : chaque groupe de `sequenceDeCoups` reçoit le profil entier
  du sort (`computeSkillDamageDetail`, `src/lib/damage.ts`), skillups compris :
  ils valent aux deux phases de Fatal Extinctive Bullet (`13311`, Abigail),
  Fatal Mortar Bullet (`13312`, Scarlett), Fatal Armor Bullet (`13314`,
  Emily), Head Press (`14113`, M. BISON), Great Sword of the End (`14613`,
  Sagar) et Undefeated Warrior (`9515`, Kuna), sans confirmation
  ([02-app/degats-reels/feat-sequences-de-coups.md § Séquences à valeur de l’API](../02-app/degats-reels/feat-sequences-de-coups.md#séquences-à-valeur-de-lapi)).
- **Idée** : les borner à la phase 1 si le relevé le dit.
- **Bloque** : un relevé, sort au maximum de skillups, deux coups non
  critiques sur la cible visée, phase 2 / phase 1 : Abigail ou Emily,
  environ 1,29 → les deux phases, environ 1,03 → la phase 1 seule ;
  M. BISON ou Sagar, environ 1,30 contre 1,13.

### Part copiée sur un autre ennemi

- **Constat** : Thunder Break (`2908`), Lightning of Cycle (`9413`) et
  Crush (`4211`) infligent à un autre ennemi une fraction des dégâts de la
  cible ; le calcul ne la compte pas, et « Autres ennemis »
  (`cibleDegatsParSort`) ne leur est pas proposé.
- **Idée** : proposer « Autres ennemis » pour ces sorts, avec la fraction.
- **Bloque** : un relevé, un sort à la fois : A visée, B autre ennemi de DEF
  et de PV très différents. D_B / D_A constant à 0,20, 0,75 ou 0,60
  (±1 %) malgré B → copie ; sinon recalcul par cible ; Crush : D_B critique
  → copie, et la ligne 224 porte-t-elle sur son coup principal ?

### Poses entre les coups : buff posé par le sort, Eightfold, poses au hasard

- **Constat** : Eightfold (`21607`, `21609`, `22207`, `22209`) ne compte pas
  son +50 % quand la jauge d'attaque de la cible est à 0. Un effet posé au
  dernier coup n'est proposé que pour le S1 enchaîné de Shoryuken et d'Iron
  Uppercut, pas pour un passif qui suit le sort. Les effets que pose une bête
  ou un disque « on a random enemy … when you attack on your turn » (Eagle
  Deception `17315`, Eye of the Desert `17815`) ne sont pas proposés : ni la
  cible ni l'instant ne sont dits. Un critique « si plus rapide » d'un
  passif reste jugé sur la VIT adverse du réglage, même après un
  ralentissement posé : il ne rend donc pas un ralentissement proposable
  (`lecteursDuMonstre`).
- **Idée** : Eightfold : à partir du coup choisi, comme l'ignore DEF des
  Blade Dancers ([02-app/degats-reels/](../02-app/degats-reels/)). Un buff
  que le sort se pose : un interrupteur allumé par défaut quand ce sort est
  choisi.
- **Bloque** : un changement de code, et des relevés. Buff posé par le
  sort : la prose le place avant l'attaque ; un relevé (monstre déjà sous
  ce buff puis sans, environ 1,00 → actif avant) seulement en cas de doute.
  Savannah sous k débuffs : environ 1 + 0,15k. Hellfire sans puis
  avec Brise DEF (~1 500 de DEF) : environ 1 → la Brise DEF précède le
  coup, environ 2,36 → après. Bayek ténèbres ou Salah, S2 à deux coups contre
  une cible seule à ~3 000 de DEF, coups non critiques : coup 2 / coup 1
  environ 2,7 → la Réduction de DEF de la bête précède le coup 2, environ 1
  → elle le suit.

### Comptes propres et jauge absorbée

- **Constat** : aucun compte des effets retirés aux alliés, ni de la jauge
  d'attaque absorbée (Xiana, Theodora) n'existe dans `src/lib/damage.ts`.
  (Les dégâts continus de la cible, eux, se comptent : `SourceEffetCible`
  `'degatsContinus'`.)
- **Idée** : les comptes sur le modèle du compteur de dégâts continus. Chaque
  lecteur ajouté rend proposables, sans autre curation, les effets nocifs que
  le sort pose entre ses coups (`effetsEntreCoupsDuSort`).
- **Bloque** : des relevés. Satoru Gojo ou Werner, alliés portant 0, 1, 2 puis 4
  effets néfastes. Xiana et Theodora, jauge de la cible vers 0 puis à 30 %
  ou plus. Bayek ou Omar eau, deux cibles de même DEF et de PV très
  différents. Eshir contre 0, 1 puis 3 buffs. Yuji et Rick eau et lumière,
  suites critique et non critique (environ 1,20 → règle confirmée). Hors
  inventaire : Mach Crush à 0, 1 puis 2 débuffs.

### Escalade d'un coup à l'autre

- **Constat** : trois S3 annoncent des dégâts qui croissent au fil des
  coups : Start of Apocalypse (`13112`, Baleygr, « the damage increases as
  you attack »), Shooting Star (`1311`, `1361`, Kacey, « increases as the
  same target gets hit again ») et Doomsday (`6215`, `6265`,
  Thrain, « increases with time » ; `6280`, porté par une forme non
  obtenable, hors curation). Aucun n'a d'entrée dans
  `src/lib/damage.ts` : chaque coup vaut le ratio de la donnée, sans
  croissance. Start of Apocalypse frappe autant de fois que Baleygr a de
  Connaissances (1 à 5) ; la donnée dit 5 coups.
- **Idée** : un incrément par coup, curé par identifiant ; pour Start of
  Apocalypse, le nombre de coups saisi selon les Connaissances ; pour
  Shooting Star, avec le compteur des coups qui touchent la cible.
- **Bloque** : un relevé en jeu par sort, sur une cible seule (donjon à un
  ennemi ou dernier ennemi vivant) à DEF élevée : les chiffres d'un même
  lancer. Coup k / coup 1 constant → aucune escalade ; croissance régulière
  → l'incrément. Pour Baleygr, compter aussi les coups selon le nombre de
  Connaissances.

## Ajouter une piste

1. Vérifier que l'idée n'est ni faite dans le code, ni écartée dans la spec
   du mécanisme, ni fournie dans [02-app/degats-reels/](../02-app/degats-reels/).
2. L'ajouter dans la section de son domaine : un titre, puis **Constat**
   (avec sa coordonnée), **Idée** et **Bloque** ; un relevé y porte son
   montage et sa règle de décision.
3. Une piste réalisée sort d'ici dans le commit qui la réalise, avec son
   entrée de `CALCUL_PARTIEL_PAR_ID` s'il y en a une. Une piste essayée puis
   écartée laisse dans la spec du mécanisme une ligne « ne pas… parce
   que… ».
