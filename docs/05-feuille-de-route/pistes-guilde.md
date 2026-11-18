# Guilde — pistes futures

Les écrans de guilde nourris par le plugin SWEX « SW Blacksmith Live », qui enregistre déjà tout ce
que le jeu montre des contenus de guilde
([feat-swex-direct.md](../02-app/bureau/feat-swex-direct.md) § « Le contenu des combats de
guilde ») : rien ne l'affiche encore. Une piste est ce qui n'est pas fait : avant de s'y fier,
vérifier dans le code qu'elle ne l'a pas été depuis. Une piste réalisée quitte ce registre ; ce
qu'elle produit se décrit dans la fiche de l'écran.

| Piste | Bloquée par | Fiche à écrire |
| --- | --- | --- |
| Siège : renommer « Défense » et « Offense » | rien | [siege/](../02-app/siege/README.md) |
| Siège : la sous-section « Statistiques », sur les données relevées | rien | « Statistiques », nouvelle fiche du dossier siege |
| Statistiques : les monstres de chaque attaque et de la défense attaquée | un journal SWEX d'un siège joué | la même |

## Siège : renommer « Défense » et « Offense »

- Libellés : **« Decks de défense »** et **« Decks d'offense »** (anglais : « Defense decks »,
  « Offense decks »), pour le **Siège seulement**. L'Arène et l'Arène dimensionnelle gardent
  « Défense » et « Offense ».
- ⚠️ Les clés `navigation.defense` et `navigation.offense` de `src/i18n/fr.ts` et `en.ts` sont
  partagées avec l'Arène (`ARENE_SUBS`, `ARENE_DIMENSION_SUBS` de `src/App.tsx`) : le Siège prend
  deux clés à lui (`decksDefense`, `decksOffense`), pointées par `SIEGE_SUBS`.
- Les adresses ne changent pas (`#/siege/defense`, `#/siege/offense`).
- Se répercute dans le même commit : le titre de l'en-tête de la page Siège, l'accueil, la nav de
  `src/App.tsx`, [docs/02-app/README.md](../02-app/README.md), la fiche
  [siege/](../02-app/siege/README.md), les tests de rendu et la preuve de l'app de bureau qui
  cherchent ces libellés (`grep -rn "Défense\|Offense" tests bureau/preuve.ts`).

## Siège : la sous-section « Statistiques »

Lire tout ce que les sièges ont remonté : ceux de la guilde **et** ceux du joueur.

### Où, et pour qui

- Quatrième sous-section du Siège, **`#/siege/statistiques`** : `SiegeTab` gagne `'stats'`
  (`src/pages/SiegePage.tsx`), `SIEGE_SUBS` une entrée, `parseHash` l'adresse, avec son icône et
  sa couleur de sous-section.
- **Application de bureau seulement** : les données sont les fichiers du plugin, sur le disque.
  **Sur le site**, la sous-section dit qu'il faut l'application de bureau et le plugin, et renvoie
  vers [Télécharger](../02-app/telecharger/README.md) (`#/telecharger`) et la page
  [SW Exporter](../02-app/sw-exporter/README.md).
- Ce que la page montre :
  - **la liste des sièges** relevés, du plus récent au plus ancien : date, position de la guilde
    (1ʳᵉ, 2ᵉ, 3ᵉ), score ;
  - **un siège** : les trois guildes (position, score, membres ayant joué, attaques, monstres
    utilisés) ; **les attaques** — qui a attaqué qui, victoire ou défaite, à quelle heure, et
    (piste suivante) avec quels monstres, contre quelle défense ; **les défenses** — chaque deck,
    sa base, ses victoires, nuls et défaites ;
  - **deux angles**, sur les mêmes données : **la guilde** (tous les membres, par membre) et
    **moi** (l'invocateur suivi) ;
  - **la saison** : classement, victoires, nuls, défaites de la guilde, et le meilleur classement.
- ⚠️ **Le plugin n'enregistre que ce que le jeu montre** : un écran de siège jamais ouvert en jeu
  n'a rien laissé. La page dit, pour chaque siège, ce qui manque (« carte de fin de siège non
  ouverte »…), jamais un zéro inventé.
- **Maquette d'abord**, aux deux formats, sur le design réel de l'app (captures du banc
  d'affichage : `node tests/banc/run.mjs --ecrans <id> --tailles ordinateur,telephone`).

### Les données — lire les fichiers de guilde

- Fichiers de l'invocateur suivi, dans le dossier de SWEX :
  `SWBlacksmith/<nom>-<id>/guilde.live.jsonl` (la session en cours) et `guilde.jsonl.gz` (chaque
  session finie, en entier). Trouvés comme le fichier live du compte (`cheminLive` de
  [bureau/swexLive.ts](../../bureau/swexLive.ts), même règle par l'identifiant).
- **Le processus principal** les lit et les donne à la page, sur demande à l'ouverture de la
  sous-section et à chaque ligne ajoutée au fichier live (la surveillance du dossier
  `SWBlacksmith` existe déjà dans [bureau/swex.ts](../../bureau/swex.ts)) : un canal à ajouter au
  pont ([bureau/preload.ts](../../bureau/preload.ts), [src/lib/bureau.ts](../../src/lib/bureau.ts)).
  L'archive se lit bloc par bloc (`parcourirArchive` de
  [plugin-swex/source/archive.ts](../../plugin-swex/source/archive.ts), puis `gunzip` de chaque
  bloc), chaque session relue par `depuisLignesGuilde`
  ([plugin-swex/source/guilde.ts](../../plugin-swex/source/guilde.ts)) : ses **vues** (la dernière
  réponse par commande et paramètres) et ses **combats** (début et fin, par `battle_key`). Rien
  n'est écrit, ni dans le dossier de SWEX ni dans l'app.
- **Les statistiques se calculent dans `src/lib/`** (calcul pur, testé), jamais dans le composant :
  un siège est identifié par `siege_id` et `match_id` ; plusieurs sessions en montrent le même
  siège, la vue la plus récente l'emporte.

Ce que les réponses relevées contiennent (forme vérifiée sur un journal réel ; les sens des codes
restent à établir sur données réelles, sans les supposer — skill `game-data-curation`) :

| Commande (vue) | Ce qu'on en tire |
| --- | --- |
| `GetGuildSiegeStatusInfo` | le siège en cours (`guildsiege_status` : `siege_id`, `status`), la saison (`season_id`, `season_number`, dates), `round` |
| `GetGuildSiegeParticipatedSiegeIdList` | les sièges joués par la guilde (`recv_info_list` : `siege_id`, `match_id`, `round`, `season_type`) |
| `GetGuildSiegeMatchupInfo` (paramètre `siege_id`) | le match (`match_info` : début, fin) ; les trois guildes (`guild_list` : `guild_name`, `pos_id`, `match_score`, `match_rank`, `play_member_count`, `attack_count`, `attack_unit_count`) ; les bases (`base_list` : `base_number`, `guild_id`, `base_status`) ; les joueurs (`wizard_info_list` : `wizard_id`, `wizard_name`, `guild_id`) ; les défenses (`defense_deck_list` : `deck_id`, `wizard_id`, victoires, nuls, défaites, `winning_rate`) et leurs bases (`defense_deck_assign_list`) |
| `GetGuildSiegeMatchupInfoForFinished` (`siege_id`) | la carte en fin de siège : en plus, `defense_deck_status_list` (`base_number`, `deck_id`, `status`, guilde et joueur attaquants, heure) |
| `GetGuildSiegeParticipationInfo` | les défenses du joueur : `my_defense_deck_unit_list` (`deck_id`, les trois `unit_id`), leurs bases, les compteurs de toutes les défenses de la guilde |
| `getGuildSiegeMatchBattleLogSummary_v2` (`siege_id`) | **toutes les attaques du match** (`wizard_battle_log_list` : `log_type`, `wizard_id` et `guild_id` de l'attaquant, `opp_wizard_id` et `opp_guild_id`, `win_lose`, `log_timestamp`), sans les monstres ; les monstres utilisés par joueur (`used_unit_count_list`) et par guilde visée (`guild_used_unit_count_list`) |
| `getGuildSiegeMatchResult` | la position finale (`match_rank`, `guild_count`) et le score (`guildsiege_score_curr`, `guildsiege_score_var`) |
| `GetGuildSiegeRankingInfo` | la saison de la guilde : `guildsiege_stat_info` (`prev`, `curr`, `best` : rang, score, victoires, nuls, défaites, `winning_rate`) |

- ⚠️ Les noms des joueurs et des guildes viennent du jeu : jamais dans un test, une fixture ni la
  documentation du dépôt (public). Les fixtures sont fabriquées, avec la forme ci-dessus.

## Statistiques : les monstres de chaque attaque et de la défense attaquée

Savoir **qui a tapé qui, avec quoi, contre quoi** : les trois monstres de chaque attaque et ceux
de la défense attaquée ; les runes des monstres de l'attaque si le jeu les donne. Les runes d'une
défense adverse ne sont pas connues : la page ne les cherche pas.

- **Bloquée** : aucun journal relevé ne contient de combat de siège ni de journal de combat
  détaillé. Il faut un journal SWEX (`full_log.txt`, plugin Full Logger) d'un siège joué, plugin
  installé, où le joueur : attaque au moins une base (gagnée ou perdue) ; ouvre une base ennemie
  (ses défenses) ; ouvre les journaux de combat d'un deck et d'un joueur ; ouvre la carte en fin
  de siège ; puis se déconnecte et se reconnecte.
- Sur ce journal, établir les commandes et leur forme (même méthode que le tableau ci-dessus :
  noms et clés, jamais les valeurs), puis :
  - vérifier que le plugin les enregistre (`estVue`, `estDebut`, `estFin` de `guilde.ts`
    reconnaissent les commandes au nom : `Get…Siege…`, `battle…Siege…Start…`) — sinon, une
    mise à jour du plugin ;
  - relier l'attaque à sa défense (base, deck) et à son résultat ;
  - les runes des monstres de l'attaque du joueur : celles de la réponse si elle les porte, sinon
    celles du compte à l'heure de l'attaque (fichier live du compte) — à dire sur l'écran.
- Les tests rejouent des fixtures fabriquées de même forme ; le journal réel reste hors du dépôt.

## Ce que chaque piste emporte

La définition de fini ([definition-de-fini.md](../03-developpeur/definition-de-fini.md)) : la fiche
« Statistiques » du dossier siege et les fiches voisines (siège, bureau, SW Exporter, architecture),
les textes en français et en anglais, les tests du calcul, du rendu (deux formats, site et app)
et du branchement — la preuve de l'app de bureau (`npm run bureau:preuve -- --swex`) sur un
dossier de fixtures avec des fichiers de guilde.
