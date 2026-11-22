# Dette

Ce qui est connu, mesuré et pas corrigé. Une ligne quitte ce registre quand la dette est payée ;
une mesure se redonne avec sa date quand on la refait.

## Code

| Dette | Mesure | Comment la retrouver | Depuis |
| --- | --- | --- | --- |
| **Code mort** : variables, imports et paramètres inutilisés | 153 avertissements `@typescript-eslint/no-unused-vars` (2026-10-13) | `npm run lint` | 2026-10-08 |
| **Types `any`** | 80 avertissements `@typescript-eslint/no-explicit-any`, dont 72 dans `src/lib/importAccount.ts` (la lecture de l'export SWEX) | `npm run lint` | 2026-10-13 |
| **Dépendances de hooks React incomplètes** | 17 avertissements `react-hooks/exhaustive-deps` | `npm run lint` | 2026-10-13 |
| **Affectations inutiles** | 7 avertissements `no-useless-assignment` | `npm run lint` | 2026-10-13 |
| **Alerte `npm audit` sans correctif : minimatch dans electron-builder** (GHSA-g3hv-75wg-m249, déni de service par un motif piégé). Les motifs ne viennent que de notre `electron-builder.yml`, lu à l'empaquetage : aucune entrée extérieure. Même la dernière version d'electron-builder tire minimatch 9 et 10, et `npm audit fix --force` le **rétrograderait** en 25.1 : ne pas le lancer. Se paie quand electron-builder passe à minimatch ≥ 11.0.1 | 6 alertes moyennes, toutes de cette seule cause (2026-11-18) | `npm audit` | 2026-11-18 |
| **Points de la revue de `release/v2.0.0`** | à relever : ils ne sont pas dans le dépôt | — | 2026-10-08 |

Au total, ESLint rend 0 erreur et 257 avertissements (2026-10-13). Deux fichiers en portent près
des deux tiers : `src/components/outils/SpeedTuningSection.tsx` (92) et `src/lib/importAccount.ts`
(72). Un avertissement ne bloque ni un commit ni la CI
([qualite-code.md](../03-developpeur/qualite-code.md)).

Les commentaires ne portent plus aucun « lot N » ni numéro de décision (2026-10-13 :
`git grep -E '\blots? [0-9]+|[Dd]écisions? [0-9]+' -- src scripts tests bureau`, aucun résultat) ;
une décision qui a son ADR y est citée par son chemin. Le récit sans numéro (« le mainteneur a
demandé… », « depuis le rebranding ») ne se compte pas : il se relève à la relecture.

## Recommandations volumineuses

Une recommandation tirée de vidéos YouTube réunit des centaines de decks : celle de toutes les
chaînes suivies fait 1,24 Mo en JSON compact (721 decks), les neuf chaînes seules 1,39 Mo à elles
toutes (2026-11-21). La publication Discord l'accepte jusqu'à 3,5 Mo : échappée dans un JSON
(+12 %), elle passe encore sous les 4,5 Mo de Vercel, pour la publication comme pour le cache des
salons ([service-discord.md](../02-app/siege/feat-recommandations/service-discord.md),
« Publier »). Deux chemins plafonnent pourtant ailleurs, sur le total et non sur une seule
recommandation. Aucun n'est atteint aujourd'hui.

| Dette | Mesure | Comment la retrouver | Depuis |
| --- | --- | --- | --- |
| **La lecture de tous les salons tient en une réponse.** La route `tout` rend la recommandation de chaque salon que le membre lit, tous serveurs confondus, et Vercel refuse une réponse de plus de 4,5 Mo. Au-delà, la synchronisation échoue en entier pour ce membre, à chaque ouverture (« Discord ne répond pas »), tant qu'aucune recommandation ne maigrit | toutes les sorties YouTube dans des salons qu'un même membre lit : 2,6 Mo compact (2026-11-21) | `api/_source/service/routeur.ts`, route `GET tout` | 2026-11-21 |
| **Les recommandations se gardent dans `localStorage`**, d'environ 5 Mo par site selon le navigateur, avec le reste de l'app (prépa RTA, Optimizer…). Un dépassement est avalé sans rien dire par `saveLocal` : les recommandations valent pour la session et disparaissent au prochain lancement, sans avertissement | toutes les sorties YouTube importées : environ 2,6 Mo à elles seules (2026-11-21) | `src/hooks/useSiegeRecos.ts`, `saveLocal` de `src/hooks/usePersistence.ts` | 2026-11-21 |

Pistes envisagées :

- **Ne rendre que les versions dans `tout`** : l'identifiant et la date de chaque salon, puis les
  seuls contenus qui ont changé, par une route qui en lit plusieurs avec une seule vérification
  des droits et un volume borné par appel (un appel par salon relirait serveur et membre chez
  Discord, dont les quotas sont serrés). Pour le joueur : rien ne change quand rien n'a changé ;
  à la première connexion ou après des publications, un temps de chargement de plus, et un salon
  dont le contenu échoue garde son ancienne version au lieu de faire échouer tout. Environ une
  demi-journée : service, synchronisation en deux temps, échecs partiels, tests.
- **Compresser le transport** (gzip, puis base64 : +33 %, mais un JSON de recommandations, fait
  des mêmes clés répétées, se compresse fortement) pour la publication et `tout`. Le fichier posté dans Discord
  reste un JSON lisible, pour qu'un membre puisse en déposer un à la main.
- **Garder les recommandations en IndexedDB**, comme le compte importé, ou au moins dire quand
  `localStorage` refuse d'écrire.
- **Côté usage** : découper une très grosse recommandation en plusieurs salons (un par chaîne, ou
  par période), chacun sous les plafonds.

Pour aller **au-delà de 3,5 Mo** par recommandation, une piste de plus : envoyer et servir le
fichier tel quel, sans l'échapper dans un JSON. La publication passerait le salon et la base dans
l'adresse et le fichier en corps brut ; `brut` rendrait le fichier seul, son identifiant et sa date
en en-têtes. Les 12 % disparaissent. À soigner : le service accepte un temps les deux formes de
publication (une page restée ouverte, une application de bureau pas à jour), et l'adresse de
`brut` change de version pour que le cache de 15 s ne serve pas l'ancien format.

## Vocabulaire

Le [glossaire](../01-presentation/04-glossaire.md) fixe les mots ; le dépôt et l'app ne le suivent
pas encore. Les remettre d'équerre est un chantier à part : les libellés affichés changent
l'écran, ils passent par le banc. Mesures hors du glossaire, dans `src/` et `docs/` (2026-10-14) :

| Écart au glossaire | Mesure | Comment la retrouver | Depuis |
| --- | --- | --- | --- |
| **« Taux Crit », « Dmg Crit »** au lieu de « Tx critiq. », « Dgts critiq. » (libellés du jeu), dont l'affichage (`src/lib/effects.ts`) | 113 occurrences, 35 fichiers | `git grep -E 'Taux Crit\|Dmg Crit' -- src docs` | 2026-10-14 |
| **« DCC », « Dgts CRIT »** pour la même stat | 72 occurrences, 28 fichiers | `git grep -E 'DCC\|Dgts CRIT' -- src docs` | 2026-10-14 |
| **« SWEX »** au lieu de « SW Exporter » | 67 occurrences, 30 fichiers | `git grep SWEX -- src docs` | 2026-10-14 |
| **« totem »** au lieu de « compétences d'invocateur » | 62 occurrences, 25 fichiers | `git grep -i totem -- src docs` | 2026-10-14 |
| **« moitié »** pour un demi-build, **« préréglage »** pour un deck, **« deck »** pour une équipe | à relever à la relecture | — | 2026-10-14 |

## Documentation

Aucune dette mesurée (2026-10-13) : plus aucun « lot N » ni numéro de décision dans `docs/`
(`git grep -E '\blots? [0-9]+|[Dd]écisions? [0-9]+' -- docs`), plus aucun en-tête hérité. Le récit
de l'avant sans numéro (« l'ancienne… », « a été retiré ») ne se compte pas : il se relève à la
relecture ([documentation.md](../03-developpeur/documentation.md)).
