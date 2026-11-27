# Système visuel — réglage du thème

Partie de [Système visuel](README.md).

## Réglage du thème

Dans le menu ⚙ ([SettingsMenu.tsx](../../../../src/components/SettingsMenu.tsx)), deux
`<Setting>` qui se suivent, chacun avec un `<Segmented>`
([useTheme.ts](../../../../src/hooks/useTheme.ts)).

**« Thème »**, trois options :

| Option | Comportement |
|--------|--------------|
| **Auto** (défaut) | Suit `prefers-color-scheme`, et **change à chaud** si le système bascule |
| **Clair** | Force le thème clair choisi ci-dessous |
| **Sombre** | Force Forge |

**« Thème clair »**, deux options :

| Option | Comportement |
|--------|--------------|
| **Givre** (défaut) | Le clair aux gris doux et aux cartes blanches |
| **Atelier** | Le clair au papier chaud |

⚠️ **Trois états, pas un interrupteur.** Un binaire clair/sombre force à choisir
une valeur qui cesse alors de suivre le système : quelqu'un dont le téléphone
bascule le soir perdrait ce comportement sans l'avoir demandé.

⚠️ **Deux réglages, pas quatre crans.** Un seul réglage `Auto` / `Givre` /
`Atelier` / `Sombre` ne laisserait pas dire « suis le système, et en clair
prends Atelier ». Le second réglage reste affiché sous un thème sombre : il
vaut pour le prochain passage au clair, et un réglage qui apparaît et
disparaît déplacerait ceux qui le suivent.

Givre et Atelier sont des noms propres, les mêmes dans chaque langue ; seule
leur aide se traduit.

### Deux attributs sur `<html>`

| Attribut | Valeurs | Absent |
|---|---|---|
| `data-theme` | `light`, `dark` | `Auto` : la media query décide |
| `data-theme-clair` | `atelier` | Givre, le `:root` nu |

Les deux sont posés **avant la première peinture** par un script inline dans
`index.html` — sinon la page apparaît dans le mauvais thème le temps d'un
frame — puis reposés au chargement de `useTheme.ts` : une session chargée au
démarrage de l'application de bureau écrit ses réglages entre les deux
([feat-sauvegarde-session.md](../../../02-app/transverse/feat-sauvegarde-session.md)).

| Réglage | Clé de `localStorage` | Valeurs |
|---|---|---|
| Thème | `swblacksmith-theme-v1` | `auto`, `light`, `dark` |
| Thème clair | `swblacksmith-theme-clair-v1` | `givre`, `atelier` ; toute autre valeur vaut Givre |
