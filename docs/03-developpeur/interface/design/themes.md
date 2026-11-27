# Système visuel — trois thèmes

Partie de [Système visuel](README.md).

## Un sombre, deux clairs

| Thème | Nom | Quand |
|-------|-----|-------|
| Sombre | **Forge** | `prefers-color-scheme: dark` |
| Clair | **Givre** | `prefers-color-scheme: light`, et défaut si non exprimé |
| Clair, au choix | **Atelier** | à la place de Givre, pour qui l'a choisi |

Le thème suit le navigateur **par défaut**, et se force depuis le menu ⚙
(`Auto` / `Clair` / `Sombre`). Un second réglage, « Thème clair », dit lequel
des deux clairs s'applique quand le thème est clair (voir
[Réglage](reglage-du-theme.md#réglage-du-thème)).

⚠️ **Les deux choix se stockent comme des réglages, pas comme des données.**
Ils s'écrivent toujours dans `localStorage`, même persistance refusée — comme
le choix de conservation lui-même et la mesure de score (voir
[persistance.md](../../../02-app/transverse/feat-import-compte/persistance.md), « Un seul interrupteur pour toute l'app »). Un thème oublié à
chaque visite serait un bug, pas une protection.

### Pourquoi des directions nommées et pas une palette inversée

Une inversion mécanique produit un thème clair délavé : les gris qui portaient la
profondeur en sombre deviennent des gris sales sur blanc. Forge, Givre et
Atelier sont **trois systèmes cohérents chacun**, qui partagent leur structure
de tokens mais pas leurs valeurs.

- **Forge** — charbon brun presque noir, **braise** (`#FF7A1A`) en accent
  unique, laiton pour les étoiles, données chiffrées en mono. La braise reste à
  distance du rouge de l'élément Feu : ΔE 9,7 (OKLab ×100).
- **Givre** — page gris-bleu très pâle (`#F6F8FA`), cartes et barres blanches,
  encre anthracite froide, bordures gris-bleu. La même braise en aplat, et une
  **braise foncée** (`#AD4D0B`) pour tout ce qui se lit ou se trace : la vive
  tombe sous 2,7 sur fond clair (voir « Deux braises » dans
  [tokens-couleurs.md](tokens-couleurs.md)). Aucune surface n'y est chaude : la
  seule chaleur de l'écran est la braise, qui en ressort d'autant.
- **Atelier** — papier chaud, encre de l'atelier, la même braise en aplat et
  sa braise foncée (`#A64F11`).

### Ce que les deux clairs partagent

Givre est le `:root` nu d'[index.css](../../../../src/index.css) ; Atelier
n'y redéfinit que ce qui fait sa chaleur : surfaces, bordures, encres, braise
lisible, sémantique et fonds doux. Tout le reste est commun aux deux clairs —
la braise vive et son encre, les couleurs d'élément, le laiton, les séries et
les guildes des graphes, les raretés, les paliers du résumé de compte, les
rayons.

⚠️ **Un jeton commun se mesure sur les deux clairs** : le blanc de Givre et le
papier d'Atelier ne lui donnent pas le même contraste
([contraste.md](contraste.md)).

### Trois blocs, un ordre

| Bloc d'`index.css` | Sélecteur | Porte |
|---|---|---|
| Givre | `:root` | toutes les valeurs du clair par défaut |
| Atelier | `:root[data-theme-clair='atelier']` | les seuls jetons qui diffèrent de Givre |
| Forge | `@media (prefers-color-scheme: dark)` sous `:root:not([data-theme='light'])`, et `:root[data-theme='dark']` | des renvois aux variables `--forge-*` |

⚠️ **Le bloc d'Atelier précède les déclencheurs de Forge.** Les trois
sélecteurs ont la même spécificité : c'est leur place dans la feuille qui fait
gagner Forge quand `data-theme-clair="atelier"` reste posé sous un thème
sombre. Forge redéfinit tout jeton qu'Atelier redéfinit, sinon une couleur
d'Atelier traverserait en sombre. Les deux règles sont vérifiées, avec les
contrastes de chaque thème, par `node tests/run.mjs themes`.
