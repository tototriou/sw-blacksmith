# Siège · Recommandations (`#/siege/recommandations`)

Troisième sous-onglet du siège. Permet à un joueur de composer une
**recommandation = un ENSEMBLE de decks** (ex. « mes 6 défenses de guilde »),
chaque deck portant 3 monstres avec les **sets**, les **propriétés d'artéfact**
et les **stats à viser** sur chacun ; de **l'exporter** d'un bloc pour la partager ; et à un autre joueur de
**l'importer** puis de voir **immédiatement quels decks il peut jouer**.

Fichiers :
- [RecoBoard.tsx](src/components/siege/RecoBoard.tsx) — barre d'actions, import/export, les deux vues.
- [VoletDefenses.tsx](src/components/siege/VoletDefenses.tsx) — la vue Défenses : la liste des défenses visées, le volet d'une défense et ses offenses.
- [ListeRecos.tsx](src/components/siege/ListeRecos.tsx) — la liste des recommandations de la vue Decks.
- [RecoCard.tsx](src/components/siege/RecoCard.tsx) — le volet d'une recommandation (vue & édition), la ligne d'un deck (`DeckBlock`).
- [AjoutCounter.tsx](src/components/siege/AjoutCounter.tsx) — la fenêtre « + Ajouter un counter » : capture, mes decks et équipes, deck vide.
- [EtoilesFiabilite.tsx](src/components/siege/EtoilesFiabilite.tsx) — la fiabilité d'un deck contre une défense, en étoiles : affichage, saisie, notation sur place.
- [counterDepuisCapture.ts](src/lib/capture/counterDepuisCapture.ts), [lectureNavigateur.ts](src/lib/capture/lectureNavigateur.ts) — un counter lu sur une capture, dans le navigateur (la lecture du bot : [feat-discord-capture.md](../../speed-tuning/feat-discord-capture.md)).
- [useSiegeRecos.ts](src/hooks/useSiegeRecos.ts) — état + persistance.
- [recoShare.ts](src/lib/recoShare.ts) — export/import JSON + validation.
- [recoFusion.ts](src/lib/recoFusion.ts) — import qui fusionne dans la recommandation qu'il complète (calcul pur).
- [ChoixFusionRecos.tsx](src/components/siege/ChoixFusionRecos.tsx) — le choix « fusionner » ou « ajouter à part » à l'import.
- [recoMatch.ts](src/lib/recoMatch.ts) — confrontation avec le compte (calcul pur).
- [ownedBuilds.ts](src/lib/ownedBuilds.ts) — collecte de tous les builds du joueur.
- [recoFromSiege.ts](src/lib/recoFromSiege.ts) — deck pré-rempli depuis un deck d'offense ou une équipe de Mes équipes.
- [ajoutOffenseReco.ts](../../../../src/lib/ajoutOffenseReco.ts), [AjoutOffenseReco.tsx](../../../../src/components/siege/AjoutOffenseReco.tsx) — une offense venue d'ailleurs ajoutée à une recommandation en un geste, sans doublon : un combat gagné de Siège › Statistiques ([statistiques.md](../statistiques.md)), une équipe de Mes équipes ([feat-equipes.md](../../compte/feat-equipes.md)).
- [recoSearch.ts](src/lib/recoSearch.ts) — recherche d'un monstre dans les recos (calcul pur).
- [pagesRecos.ts](src/lib/pagesRecos.ts) — une page de decks, de lignes d'analyse ou de défenses à la fois (calcul pur).
- [recoDiscord.ts](src/lib/recoDiscord.ts) — recommandations liées à un salon Discord : état, synchronisation, fusion à trois voies (calcul pur).
- [provenancesRecos.ts](src/lib/provenancesRecos.ts) — les provenances de la page, ce que chacune montre, l'état affiché, les raisons de ne pas publier (calcul pur).
- [discordClient.ts](src/lib/discordClient.ts), [useDiscord.ts](src/hooks/useDiscord.ts), [useReglagesDiscord.ts](src/hooks/useReglagesDiscord.ts) — appels au service, lecture et publication, réglages « Discord activé » et favoris.
- [discord/](../../../../src/components/siege/discord/Provenances.tsx) — colonne et sélecteur des provenances, bandeau d'un salon, dialogues (connexion, installation, publier dans, fusion).
- [api/_source/](../../../../api/_source/discord.ts) — le service qui synchronise les recommandations avec Discord.

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| l'en-tête, la barre d'outils, les deux vues, le volet d'une recommandation, la ligne d'un deck, les boutons et couleurs de `src/components/siege/RecoCard.tsx`, `src/components/siege/RecoBoard.tsx` ou `src/components/siege/ListeRecos.tsx` | [rendu-de-la-page.md](rendu-de-la-page.md) |
| le type d'une recommandation, l'origine, les vues Défenses / Decks, l'identité d'une défense (`cleEquipe`) | [modele.md](modele.md) |
| `src/components/siege/VoletDefenses.tsx`, `src/lib/recoDefenses.ts` (`defensesDesRecos`, `ordonnerOffenses`), `src/lib/recoSearch.ts`, la vue Défenses, la recherche par monstre | [recherche-par-monstre.md](recherche-par-monstre.md) |
| `src/components/siege/AjoutCounter.tsx`, `src/lib/capture/counterDepuisCapture.ts`, « + Ajouter un counter », un counter lu sur une capture | [interactions.md](interactions.md#ajouter-un-counter) |
| les consignes, l'affichage ou la saisie des stats d'un monstre recommandé | [consignes.md](consignes.md) |
| les sets de runes recommandés | [sets-de-runes.md](sets-de-runes.md) |
| les défenses visées (« Fort contre »), leur fiabilité, `src/components/siege/EtoilesFiabilite.tsx` | [defenses-visees.md](defenses-visees.md) |
| les propriétés d'artéfact recommandées | [proprietes-artefact.md](proprietes-artefact.md) |
| `src/lib/recoShare.ts`, `src/hooks/useSiegeRecos.ts`, `src/lib/recoFusion.ts`, `src/components/siege/ChoixFusionRecos.tsx`, l'export, l'import, sa validation et sa fusion | [persistance-et-partage.md](persistance-et-partage.md) |
| `src/lib/recoMatch.ts`, `src/lib/ownedBuilds.ts`, « Confronter à mon compte », le bilan | [confrontation.md](confrontation.md) |
| le repli d'un deck, l'édition, `src/lib/annulerEdition.ts`, la pagination des decks, `src/lib/pagesRecos.ts` | [interactions.md](interactions.md) |
| `src/lib/recoFromSiege.ts`, partir d'un deck d'offense ou d'une équipe de Mes équipes | [import-deck-offense.md](import-deck-offense.md) |
| `src/lib/ajoutOffenseReco.ts`, `src/components/siege/AjoutOffenseReco.tsx`, ajouter une offense depuis les statistiques ou Mes équipes | [../statistiques.md](../statistiques.md) (« Ajouter une offense à une recommandation »), [feat-equipes.md](../../compte/feat-equipes.md) (« Ajouter à une recommandation ») |
| `api/`, `vercel.json`, `scripts/construire-api.mjs`, le service Discord, ses routes, droits, cache et variables | [service-discord.md](service-discord.md) |
| `src/lib/recoDiscord.ts`, `src/lib/discordClient.ts`, `src/hooks/useDiscord.ts`, `src/hooks/useReglagesDiscord.ts`, une recommandation liée à un salon, son état, la synchronisation, la fusion à trois voies, les favoris | [synchronisation-discord.md](synchronisation-discord.md) |
| `src/components/siege/discord/`, `src/lib/provenancesRecos.ts`, la colonne des provenances, le bandeau d'un salon, « Publier dans… », les dialogues Discord | [rendu-de-la-page.md](rendu-de-la-page.md#provenances-et-discord) |

## Parties

| Document | Contenu |
| --- | --- |
| [rendu-de-la-page.md](rendu-de-la-page.md) | Le rendu à la souris et au doigt : en-tête, barre d'outils, les deux vues (une liste, un volet), le volet d'une recommandation, la ligne d'un deck, boutons d'icône et à libellé, couleurs et pastilles de statut. |
| [modele.md](modele.md) | Le modèle (une recommandation = un lot de decks), l'origine, les vues Défenses / Decks, l'identité d'une défense. |
| [recherche-par-monstre.md](recherche-par-monstre.md) | La vue qui décide où l'on cherche, la vue Défenses (liste, volet, rangement par reco ou par fiabilité), la recherche par composition (cumul en ET, trois cases). |
| [consignes.md](consignes.md) | Les consignes à deux niveaux et l'affichage des stats : lignes `flex-wrap`, stats de fiche seulement, raccourci « Tick rapide / Tick lent ». |
| [sets-de-runes.md](sets-de-runes.md) | Les sets de runes recommandés : plusieurs runages au choix, choix par icônes, activation côté joueur. |
| [defenses-visees.md](defenses-visees.md) | Les défenses visées (« Fort contre ») : précision en popover, recherche sans précision ouverte, bouton « + », défense vide non conservée, fiabilité en étoiles. |
| [proprietes-artefact.md](proprietes-artefact.md) | Les propriétés d'artéfact recommandées : présence seule exigée, quelle propriété sur quelle sorte d'artéfact, choix par liste déroulante, confrontation. |
| [persistance-et-partage.md](persistance-et-partage.md) | La persistance (`localStorage`), le partage par fichier JSON (format et versions), la validation d'un fichier importé, et sa fusion dans la recommandation qu'il complète (champ `source`). |
| [confrontation.md](confrontation.md) | « Confronter à mon compte » : un interrupteur pour la page, verdicts sur les lignes, bilan et filtres de verdict, « réalisable N fois », source des builds, causes d'un `ko`. |
| [interactions.md](interactions.md) | Déplier un deck, « + Ajouter un counter » (capture, mes decks et équipes, deck vide), la pagination, les trois niveaux d'édition, « Annuler les modifications », les icônes d'action. |
| [import-deck-offense.md](import-deck-offense.md) | Partir d'un deck d'offense ou d'une équipe de Mes équipes : un deck pré-rempli, sa conversion. |
| [installer-le-bot.md](installer-le-bot.md) | Le guide d'un administrateur de serveur : inviter le bot, nommer les salons, leurs quatre droits, ce que voient les membres. Le même guide est dans l'app. |
| [synchronisation-discord.md](synchronisation-discord.md) | Une recommandation liée à un salon Discord, sur l'appareil : le lien, l'état (à jour, modifiée, conflit), la lecture des salons, délier, publier, la fusion à trois voies, les favoris, le stockage. |
| [service-discord.md](service-discord.md) | Le service qui synchronise les recommandations avec les salons Discord : routes, droits, publication et conflit, session, cache, empaquetage, variables d'environnement. |

## Limites connues / évolutions possibles

- La confrontation ne voit que les builds **présents dans l'export** : un
  monstre au niveau mais déruné (et absent de tout deck) apparaîtra « à
  améliorer ».
- Aucune notion de tolérance : le test est un **`≥` strict** sur chaque stat.
