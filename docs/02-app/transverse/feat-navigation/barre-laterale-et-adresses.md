# Navigation — barre latérale et adresses

Partie de [Navigation](README.md).

## La barre latérale

À l'ordinateur, la navigation est une barre latérale. Pourquoi une barre
latérale plutôt qu'une rangée d'onglets :
[barre-laterale.md](../../../04-decisions/adr/barre-laterale.md).

### L'ordre d'importance

**Accueil → RTA → Siège → Mon compte → Outils → Arène**, puis les ressources.
C'est celui de [02-app/README.md](../../README.md) (« Ordre des pages »), issu de l'usage.

**Sur bureau, le premier niveau est REGROUPÉ** :

```
Accueil
JOUER        RTA ›  Siège ›  Arène ›  Arène dimensionnelle ›
MON COMPTE   Monstres  Runes ›  Artéfacts ›
OUTILS       Optimizer  Speed tuning
RESSOURCES   Bestiaire  Bot Discord  Mécaniques  Nouveautés  SW Exporter  Télécharger
```

« SW Exporter » (le plugin SWEX) est sur le site **et** dans l'app de
bureau, qui s'en sert. Voir [sw-exporter/](../../sw-exporter/).

« Télécharger » n'existe que sur le
**site** : `RESOURCES` d'App.tsx l'omet dans l'app de bureau (`estBureau()`),
et la barre latérale, le panneau mobile, la palette et le titre, qui en
dérivent tous, le perdent d'un coup. Voir [telecharger/](../../telecharger/).

Une exception à cet ordre : **Arène est dans « Jouer »**, à côté du siège —
c'est un mode de jeu. Les inventaires et les outils sont des entrées
DIRECTES : Monstres (une seule vue) et les deux outils mènent à leur page ;
Runes et Artéfacts (plusieurs vues) ouvrent leur niveau, comme RTA et Siège.
Toutes les destinations y sont — vérifié par `tests/rendu/app.test.tsx`. Les
onglets mobiles ont cinq entrées : l'Arène n'y a pas la sienne, le panneau
« Outils » porte un groupe « Arène » (ses trois sous-sections) et un groupe
« Arène dimensionnelle » (ses trois sous-sections).

## Adresses — ce que lit la barre d'adresse

Routage par hash, sans routeur : `parseHash` ([App.tsx](src/App.tsx)) lit
l'adresse et en déduit la page et ses sous-niveaux.

| Adresse | Page |
| --- | --- |
| `#/` | Accueil |
| `#/rta`, `#/rta/ami` | RTA · Ma prépa, Ami |
| `#/siege/defense`, `/offense`, `/recommandations` | Siège |
| `#/compte/<inventaire>/<vue>` | Mon compte — vues de [accountViews.ts](src/lib/accountViews.ts) |
| `#/outils/optimizer`, `/speed-tuning` | Outils |
| `#/arene/defense`, `/offense`, `/interserveur` | Arène |
| `#/arene-dimensionnelle/defense`, `/offense`, `/runes` | Arène dimensionnelle |
| `#/bestiary`, `#/mecaniques`, `#/releases`, `#/sw-exporter` | une page chacune |
| `#/parametres`, `#/parametres/objectifs` | Paramètres, onglets « Général » et « Objectifs » ; un onglet inconnu mène à « Général » |
| `#/bot-discord/installation`, `/recommandations`, `/commandes` | Bot Discord, un onglet chacune ; `#/bot-discord` mène à l'installation |
| `#/telecharger` | Télécharger — **site seulement** ; dans l'app de bureau, l'accueil |

- ⚠️ **Une adresse tronquée mène au défaut de sa section**, jamais à un écran
  vide : `#/siege` → Défense, `#/arene` et `#/arene-dimensionnelle` → Défense, `#/compte` → Monstres, `#/compte/runes` →
  Résumé, `#/outils` → Optimizer. L'accueil s'en sert (`#/compte/runes`).
- ⚠️ **Une sous-page inconnue retombe sur le défaut de SA section**
  (`#/compte/artefacts/courbes` → Artéfacts · Résumé, par `vueValide`) ; une
  **section inconnue** retombe sur l'accueil. Jamais d'exception.
- ⚠️ **Garde-fou** : `tests/navigation-adresses.test.ts`
  tient la table de toutes les adresses et de leur page. Tout lien `#/…`
  affiché par l'app doit y figurer — un lien ajouté sans y être inscrit, ou qui
  ne mène plus où la table le dit, fait échouer `npm test`.
