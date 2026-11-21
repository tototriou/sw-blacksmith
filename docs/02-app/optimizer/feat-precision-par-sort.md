# Précision minimale par sort

Le minimum de Précision des conditions peut porter sur un ou plusieurs sorts
plutôt que sur la stat : « 85 % sur S1 », ou « 85 % sur S1 et S3 ». Un sort
coché tient la condition quand la Précision de la fiche, plus la ligne
« [Comp.N] Aug. Précision » de l'artéfact de type, atteint le minimum. Utile
quand un monstre n'a besoin de Précision que pour un ou deux sorts : la
recherche n'impose plus aux runes ce que l'artéfact peut apporter à ces
seuls sorts.

Voir aussi : [ecran/conditions-et-reglages.md](ecran/conditions-et-reglages.md) (la grille),
[feat-contrainte-speed-tune.md](feat-contrainte-speed-tune.md) (l'autre contrainte jugée sur la vraie paire),
[03-developpeur/optimizer/moteur/optimiseur-artefacts.md § Lignes bornées — la contrainte de speed tune](../../03-developpeur/optimizer/moteur/optimiseur-artefacts.md#lignes-bornées--la-contrainte-de-speed-tune).

Fichiers : [precisionParSort.ts](src/lib/precisionParSort.ts) (calcul pur :
relâchement, lignes d'un build, sorts disponibles),
[Conditions.tsx](src/components/outils/optimizer/Conditions.tsx) (les
pastilles), [relicQueue.ts](src/lib/relicQueue.ts)
(`entreeResolutionDuBuild`), [artifactFiche.ts](src/lib/artifactFiche.ts)
(`parametresArtefactsFiche`),
[recipeToSearchParams.ts](scripts/lib/recipeToSearchParams.ts) (le CLI).

## À l'écran

- Sous la ligne « Précision » de la grille des conditions, une rangée
  « Précision par sort » de trois pastilles, S1, S2 et S3, aux deux formats. La rangée
  est toujours là : cocher un sort ne déplace rien.
- Sorts cochés, le champ Min de Précision porte sur chacun d'eux, et son
  titre le dit (« Minimum sur S1, S3, artéfact de type compris »). Une seule
  valeur pour tous les sorts cochés. Le Max de Précision reste une condition
  sur la stat.
- Sans minimum de Précision saisi, les pastilles cochées n'exigent rien.
- **S1 à S3 seulement** : le jeu ne donne la ligne de précision qu'aux sorts
  1 à 3 (codes 407 à 409, artéfacts de type seulement). Une pastille est
  grisée quand le monstre n'a pas ce sort, ou que c'est un passif, qui ne se
  lance pas (`sortsPrecisionDisponibles`). Tant que la fiche du monstre n'est
  pas chargée, les trois restent disponibles. Un sort coché reste décochable
  même grisé (recette importée d'un autre monstre).
- Les sorts cochés sont un critère du membre, comme les conditions : remis à
  zéro au changement de monstre, gardés dans la mémoire du membre et dans la
  sauvegarde de session. « Réinitialiser les conditions » les décoche aussi.

## Ce que compte la précision d'un sort

- **La Précision de la fiche**, telle que la jugent les conditions
  (`precisionJugee`) : base, runes et sets, plus les points d'aura RES/PRE
  quand « Compter les auras RES/PRE » est actif (part externe et activations
  Accuracy propres du build). Ni artéfact ni relique ne porte la Précision de
  fiche.
- **Plus la ligne du sort** sur la paire d'artéfacts, c'est-à-dire sur
  l'artéfact de type. L'apport est additif, en points de Précision : c'est la
  lecture admise de la ligne « [Comp.N] Aug. Précision +X % ». (doute : non
  relevé en jeu.)
- Les leaders, les buffs et le plafond de 100 % n'y entrent pas. Une somme
  au-delà de 100 % reste un résultat légitime, comme pour le minimum sur la
  stat.

## Ce que fait la recherche

Deux étages, comme la contrainte de speed tune :

1. **Les runes ne voient qu'un minimum relâché** (`exigencePrecisionParSort`) :
   le minimum, moins le meilleur bonus qu'**une seule** pièce de type
   éligible apporte à **tous** les sorts cochés à la fois
   (`bonusPrecisionMax` : maximum sur les pièces du minimum sur les sorts).
   Les pièces lues sont celles de `candidatsParSorte` pour le Type, la vue
   complète : principale imposée, « Comme équipé » et réservations compris ;
   sans optimisation d'artéfacts, la pièce portée seule. Le relâchement est
   sûr : il ne rejette jamais un build qu'une vraie paire rendrait conforme.
   Retombé à zéro ou moins, le minimum disparaît pour les runes. La condition
   exacte voyage dans `BuildRequirement.precisionParSort`.
2. **La vraie paire de chaque build se juge à la résolution**
   (`entreeResolutionDuBuild`) : pour chaque sort coché, la ligne doit combler
   l'écart entre le minimum et la Précision jugée de ce build
   (`lignesPrecisionDuBuild`, une ligne bornée par sort, de l'écart à
   l'infini). Un build dont la fiche tient déjà le minimum n'exige rien de la
   paire. Les lignes 407–409 des sorts en jeu sont incomparables pour la
   dominance des artéfacts (`parametresArtefactsFiche`, `sortsPrecision`) :
   une pièce plus faible sur la note peut être la seule à tenir le sort.

Quand le Type est figé (« Comme équipé » ou optimisation coupée), le
relâchement est exact : la seule pièce possible donne le minimum des runes.

⚠️ Ne pas relâcher par le meilleur bonus de chaque sort pris à part : deux
sorts cochés seraient alors comptés avec deux pièces différentes, alors que
la paire n'a qu'un artéfact de type.

## Recette et CLI

- La recette porte les sorts dans `sortsPrecision` (liste parmi 1, 2 et 3),
  omis quand aucun n'est coché ; le minimum reste `requirement.minStats.acc`.
  Une recette sans ce champ se relit sans sort, et un sort hors de S1–S3 la
  fait refuser.
- Le CLI rejoue la même exigence (`exigenceDeLaRecette`, sur les pièces de
  `piecesTypeDuCli`) et la même résolution.
- La signature du cache des paires porte la précision par sort : changer de
  sort à relâchement égal relance la résolution.

## Limites

- Le quasi-succès et le diagnostic des conditions bloquantes jugent le
  minimum relâché des runes, nommé « Précision » : la condition par sort
  elle-même ne s'y lit pas (voir
  [limites-connues.md § Équipement d'un build et diagnostics de l'écran](limites-connues.md#équipement-dun-build-et-diagnostics-de-lécran)).
- Les cartes de résultat n'affichent pas la précision de chaque sort.
