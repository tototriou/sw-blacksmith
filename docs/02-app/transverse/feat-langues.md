# Langues de l'interface

L'app s'affiche en français ou en anglais. Ce document dit comment la langue se choisit, d'où
viennent les textes, et comment écrire un texte nouveau. Pourquoi des dictionnaires typés et pas
une bibliothèque : [traductions-par-dictionnaires.md](../../04-decisions/adr/traductions-par-dictionnaires.md).

Fichiers : [src/i18n/](../../../src/i18n/index.ts) (`fr.ts`, `en.ts`, `langue.ts`, `format.ts`),
[useLangue.ts](../../../src/hooks/useLangue.ts), le réglage dans
[SettingsMenu.tsx](../../../src/components/SettingsMenu.tsx) et ses drapeaux dans
[DrapeauLangue.tsx](../../../src/components/DrapeauLangue.tsx), la règle ESLint dans
[regleTexteEnDur.mjs](../../../scripts/lib/regleTexteEnDur.mjs).

## Le réglage « Langue »

Le premier réglage des Paramètres, avant « Thème » ([compte-et-parametres.md](feat-navigation/compte-et-parametres.md#les-réglages)) :
un `Segmented` à trois choix.

| Choix | Langue affichée |
| --- | --- |
| **Auto** (défaut) | la première des langues préférées du navigateur que l'app sait afficher (« de-DE, fr-FR » donne le français), sinon l'anglais ; elle **change à chaud** si le navigateur change de langue (`languagechange`) |
| **Français** | le français |
| **English** | l'anglais |

- Une étiquette se compare par son sous-tag principal : « fr-CA », « fr-BE » et « fr » sont du
  français (`resoudreLangue`, [langue.ts](../../../src/i18n/langue.ts)).
- « Français » et « English » s'écrivent dans leur propre langue, quelle que soit la langue
  affichée (`NOM_LANGUE`), précédés de leur drapeau — la France, le Royaume-Uni pour l'anglais
  ([DrapeauLangue.tsx](../../../src/components/DrapeauLangue.tsx)) ; « Auto » n'en a pas. Le drapeau
  est un SVG à ses propres couleurs, pas un émoji, que Windows affiche en lettres (« FR »). L'infobulle d'« Auto » dit « ton navigateur » sur le site et « ton
  système » dans l'application de bureau (`selonSupport`).
- La palette Ctrl K propose aussi « Langue : Français » et « Langue : English », avec leur drapeau.
- **`<html lang>`** suit la langue affichée : lecteurs d'écran, césure et correcteur du navigateur
  la lisent.
- **Un réglage, pas une donnée** : `swblacksmith-langue-v1` (`auto`, `fr` ou `en`), écrit même
  quand la conservation est refusée, gardé par « Tout supprimer », repris par la session
  ([persistance.md](feat-import-compte/persistance.md),
  [feat-sauvegarde-session.md](feat-sauvegarde-session.md)).

## D'où viennent les textes

- **Un dictionnaire par langue** : `fr.ts`, la langue source, dont la forme fait le type
  `Dictionnaire`, et `en.ts`, typé par lui. Ils sont rangés par zone de l'écran (`navigation`,
  `barreHaut`, `parametres`, `palette`…).
- **Un composant** lit ses textes par `useTraduction()` (le dictionnaire de la langue affichée) et
  la langue par `useLangue()`, pour un nombre ou une date. Les deux suivent un changement de langue
  sans rechargement, composants mémoïsés compris.
- **Un texte qui dépend d'une valeur** est une fonction : `exportDu(date)`, `monstres(n)`,
  `resumeBuildsRapides(combinaisons, builds)` — le pluriel et l'ordre des mots se décident dans la
  langue.
- **Les nombres et les dates** passent par `formatNombre`, `formatDate` et `formatDateHeure`
  ([format.ts](../../../src/i18n/format.ts)), qui reçoivent la langue : « 12 345 » et « 9 août
  2026 » en français, « 12,345 » et « August 9, 2026 » en anglais.
- **Une constante de navigation** (destinations, vues du compte) porte la CLÉ de son libellé
  (`texte: 'resume'`), pas le libellé : `VUES_INVENTAIRE`, et dans [App.tsx](../../../src/App.tsx)
  `NAV`, `RTA_SUBS`, `SIEGE_SUBS`, `ACCOUNT_SUBS`, `OUTILS_SUBS`, `RESOURCES`. Les choix du thème
  et de la mesure se construisent avec leurs textes (`choixTheme(t)`, `choixMesure(t)`).
- **Le vocabulaire du jeu** a son propre lexique, `jeu` dans le dictionnaire : voir ci-dessous.
- **Un long texte suivi s'écrit d'un trait, un par langue** (décision de l'utilisateur) : l'article
  des Mécaniques vit dans [src/i18n/articles/](../../../src/i18n/articles/)
  (`mecaniques.fr.tsx`, `mecaniques.en.tsx`), avec ses formules et ses termes mis en avant ; la
  page n'en garde que la mise en page. Mêmes sections, même ordre, mêmes ancres d'une langue à
  l'autre. Ces fichiers SONT le texte d'une langue : ils restent hors de `FICHIERS_TRADUITS`.
- **Le journal des versions** a lui aussi une version par langue : [releases.ts](../../../src/data/releases.ts)
  en français, [releases.en.ts](../../../src/data/releases.en.ts) en anglais, de même forme
  entrée pour entrée ; `journal(langue)` rend le bon. Détail :
  [nouveautes/](../nouveautes/README.md).

## Le vocabulaire du jeu

Les termes du jeu (sets, stats, grades, éléments, archétypes, sortes d'artéfact, zones de leader
skill, effets de set, sous-propriétés d'artéfact, effets de compétence) sont ceux du **client du
jeu dans la langue choisie**, jamais une traduction de l'app. Ils vivent dans
[src/i18n/jeu/](../../../src/i18n/jeu/index.ts) (`fr.ts`, `en.ts`), lus par
`useTraduction().jeu`.

| Langue | Source |
| --- | --- |
| Français | le relevé de Thomas dans le jeu : ses réponses, et les captures des filtres du jeu ; **ses réponses priment** (« Étourdi », pas le « Assommer » du filtre) |
| Anglais | SWARFARM, qui reprend le client anglais : ses données (sets, effets de compétence) et son code source (stats, grades, sous-propriétés d'artéfact, effets de set) |

- **Forme longue, forme courte** : en toutes lettres quand il y a la place, la forme réduite du
  jeu quand il n'y en a pas (`court` : « Suppr. eff. amélior. enn. », l'abréviation d'un grade sur
  une tuile étroite) — `nomEffet(jeu, nom, true)`, `nomGrade(jeu, grade, true)`.
- **Une stat dans un choix** (filtre, sélecteur) s'écrit comme le filtre du jeu : « PV + » pour la
  valeur fixe, « PV % » (`choixEffetRune`) ; sur une ligne de rune, la stat seule
  (`libelleEffetRune`). **La stat d'un leader skill** s'écrit comme celle d'une rune (« VIT »,
  « Tx critiq. ») : `nomStatLead` ([LeadPill.tsx](../../../src/components/siege/LeadPill.tsx)),
  et sa zone par `nomZoneLead` (Général, Élément, Arène, Guilde, Donjon).
- **Les tables du code portent des clés, pas des libellés** : `RUNE_SETS`, `ELEMENTS`,
  `ARTIFACT_KINDS`, `RUNE_EFFECT`, `ARTIFACT_MAIN`, `RELIC_MAIN`, `RARITY_META`, `SET_BONUS`,
  `RECO_STATS`. Le nom vient de `nomSet`, `nomElement`, `nomArchetype`, `nomGrade`, `bonusSet`,
  `jeu.stats[clé]`, `sortesArtefact(t)`. Les fonctions de [effects.ts](../../../src/lib/effects.ts)
  qui écrivent un libellé (`formatRuneEffect`, `formatArtifactSub`, `artifactSubName`…) reçoivent
  le lexique.
- ⚠️ **Une exception, `StatRow.label`** ([stats.ts](../../../src/lib/stats.ts)) : le libellé
  français de la stat reste dans la ligne, parce que le moteur de l'Optimizer s'en sert pour
  reconnaître une ligne (colonnes compactes). L'affichage ne le lit pas : il nomme la stat par
  `jeu.stats[clé]`.
- **Un texte que `src/lib/` rédige pour l'écran reçoit sa langue en paramètre** (décision de
  l'utilisateur) : la fonction prend le dictionnaire (`t: Dictionnaire`) et y lit ses phrases —
  rapports d'import de la prépa RTA, des recommandations et des équipes de siège
  (`validateRtaImport`, `validateRecosImport`, `lireEquipes`, `cleanGear`), raison d'une équipe
  sans verdict (`raisonSansVerdict`), alerte de tick (`tickTeamMessage`), résumé d'une équipe
  (`teamSummary`), erreurs de l'import d'un compte (`parseAccountJson`, `parseAccountBox`,
  `parseAccountInventory`, `parseSiegeDefense`, `parseSiegeOffense`), titres et en-têtes du top
  des artéfacts par propriété (`topParPropriete`). Le calcul reste pur ; un test ou un script
  passe `fr`. Les **fichiers partagés**
  restent en français, la langue du fichier : clés, champ `propriete` d'une recommandation
  (`fr.jeu`). Un libellé que `src/lib/` fabrique comme une donnée (« Défense 3 », la source d'un
  build) se traduit à l'affichage par `libelleSource`.
- ⚠️ **Une clé MÉMORISÉE ne suit pas la langue** : les courbes masquées du Compte
  (`runesCurve.hidden`, `runesCompare.hidden`) gardent leurs clés françaises (« Actuelle »,
  « Moi »…) et seul le nom affiché change — sinon changer de langue réafficherait ce qu'on avait
  masqué. Une donnée créée par l'app (la catégorie « Lead VIT », une courbe exportée « Moi »)
  prend la langue du moment de sa création, puis appartient au joueur.
- **Les noms de monstres et les compétences** (nom, description, améliorations) viennent de
  SWARFARM, en anglais, et le restent dans toutes les langues.
- **Les effets de compétence** sont indexés par leur nom SWARFARM. Un effet qui n'a pas de nom
  français s'affiche sous son nom anglais ; le test du lexique échoue tant qu'il n'est pas relevé
  ou inscrit au **registre des manques** (`EFFETS_SANS_TRADUCTION`,
  [lexique-jeu.test.ts](../../../tests/lexique-jeu.test.ts)). Une mise à jour des données qui
  apporte un effet nouveau ne passe donc pas inaperçue.
- **Effets de set à valeur curée** : Précision et Tolérance y valent les +8 % du calcul des dégâts
  réels, pour ne jamais afficher un chiffre que le calcul n'applique pas
  ([valeurs-de-jeu-curees.md](../degats-reels/valeurs-de-jeu-curees.md)).

## Ce qui est traduit

Les fichiers traduits sont ceux de `FICHIERS_TRADUITS` (`eslint.config.js`) : la navigation
(barre latérale, carte du compte, recherche, onglets du bas, panneau de navigation mobile), la
barre du haut, la palette Ctrl K, l'écran partagé, la page et le popover des Paramètres, la date de
l'export chargé ; l'accueil, les Nouveautés (journal compris), Télécharger, les Mécaniques, le
Bestiaire (filtres, grille, pagination), la fiche d'un monstre et la création d'un monstre ; la
RTA (prépa, catégories, ordre de tour, sauvegarde et partage, prépa d'un ami) et le Siège
(équipes de défense et d'offense, recommandations, leader skills) ; le Compte (box, runes,
artéfacts, courbes, comparaison, optimisation, builds rapides), l'import d'un compte, la
question de conservation, les fenêtres de dialogue communes et [App.tsx](../../../src/App.tsx) en
entier (pied de page, remplacement et suppression des données, session).

Le **vocabulaire du jeu** suit la langue choisie dans toute l'app : fiches de rune, d'artéfact et
de relique, inventaires, Optimizer, recommandations de siège, prépa RTA, Bestiaire, fiche d'un
monstre.

Les autres textes des écrans s'affichent encore en français, quelle que soit la langue choisie.

## Écrire un texte nouveau

1. L'ajouter à `fr.ts`, dans la zone de son écran, puis à `en.ts` : `tsc` refuse tant qu'une
   langue n'a pas la clé.
2. L'afficher par `useTraduction()`. Dans un fichier traduit, un texte en dur est refusé par la
   règle ESLint `swblacksmith/texte-en-dur` : texte entre balises, chaîne en enfant
   (`{ok ? 'Oui' : 'Non'}`), ou dans un attribut qui s'affiche (`title`, `aria-label`,
   `placeholder`, `alt`, `libelle`, `label`, `hint`, `titre`, `invite`, `aide`). Un symbole, un
   nombre, une classe passent. Détail : [qualite-code.md](../../03-developpeur/qualite-code.md).
3. Un terme du jeu reprend le libellé officiel du client dans chaque langue, jamais une traduction.

Un écran qu'on traduit entre dans `FICHIERS_TRADUITS` dans le même commit.

## Tests

- [langue.test.ts](../../../tests/langue.test.ts) : la règle du premier lancement, les mêmes clés
  dans chaque langue (natures et paramètres compris), les formats, la clé de réglage et la
  session, la règle ESLint lancée sur la vraie configuration.
- [lexique-jeu.test.ts](../../../tests/lexique-jeu.test.ts) : chaque effet des données a son nom
  français (ou figure au registre des manques), chaque set, élément et sous-propriété connue du
  moteur a son nom dans chaque langue, les libellés relevés en jeu, le nom d'une sous-propriété
  sans sa valeur dans les deux langues.
- [rendu/langue.test.tsx](../../../tests/rendu/langue.test.tsx) : le réglage, les Paramètres et
  l'app entière (`#/parametres`) en anglais, puis de retour en français ; la fiche d'une rune
  dans le vocabulaire du jeu de chaque langue ; l'accueil, les Nouveautés, Télécharger, les
  Mécaniques, le Bestiaire et la fiche d'un monstre en anglais ; les deux articles des Mécaniques,
  mêmes sections dans le même ordre ; la RTA (prépa, prépa d'un ami) et le Siège (défense,
  offense, recommandations) en anglais ; le Compte vide, la box, le résumé et le top des
  artéfacts, le pied de page en anglais.
- [partage-langues.test.ts](../../../tests/partage-langues.test.ts) : les messages de `src/lib/`
  (imports, statut d'équipe, alerte de tick, source d'un build, import d'un compte, top des
  artéfacts) dans la langue reçue.
- [journal-langues.test.ts](../../../tests/journal-langues.test.ts) : le journal anglais a la
  forme du français (versions, dates, tags, points mis en avant, changements), aucun texte vide ni
  resté en français.
- Le rendu serveur n'a pas de navigateur : « Auto » y donne le français, langue des tests
  existants. Un test qui vérifie l'anglais choisit la langue, puis revient à « Auto ».
- ⚠️ **Un vrai navigateur, lui, a une langue** : tout Chromium piloté par les tests, le banc
  d'affichage ou le skill `run-swblacksmith` s'ouvre avec `locale: 'fr-FR'`. Sans elle, celui de
  la CI, en anglais, afficherait l'app en anglais, et les libellés français cherchés
  n'existeraient plus (`optimizer-navigable-banc.ts`, `tests/banc/session.mjs`,
  `.claude/skills/run-swblacksmith/session.mjs`).
