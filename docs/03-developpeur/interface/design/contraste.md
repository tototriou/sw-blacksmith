# Système visuel — contraste

Partie de [Système visuel](README.md).

## Contraste — mesuré, jamais estimé

⚠️ **Toute valeur de couleur se vérifie au ratio WCAG avant d'être posée.** Un
thème clair peut « paraître » correct et mesurer 2,65 sur `ink-dimmer`, 3,39
sur le vent et 3,14 sur `star` — qui porte les maxima d'efficience. Rien de
tout cela ne se voit à l'œil sur un écran calibré.

| Rôle | Seuil | Tenu par |
|------|-------|----------|
| Texte courant | **4,5** | `ink`, `ink-dim`, `ink-dimmer`, `accent-lisible`, `good`, `warn`, `bad`, `star` |
| Couleurs d'élément | **4,5** | les six, sur `panel` (voir l'arbitrage plus bas) |
| Bordure porteuse de sens | **3,0** | `accent-lisible` (champ actif, sélection, focus) |
| Aplat | *son libellé* | `accent` (bouton plein : `accent-ink` dessus, 6,66) |
| Bordure décorative | *aucun* | `border`, `border-soft` |

**Les trois surfaces comptent.** Un token doit passer sur `bg`, `panel` **et**
`panel2` — c'est `panel2` la plus exigeante : la plus sombre des trois en
clair, la plus claire en sombre.

**Les trois thèmes comptent.** Un jeton commun à Givre et à Atelier (la braise,
les éléments, le laiton, les séries) se mesure sur les surfaces de chacun : le
blanc de Givre lui donne plus de contraste que le papier d'Atelier. Les seuils
de ce tableau sont vérifiés sur les trois thèmes par
`node tests/run.mjs themes`.

### Le ratio ne suffit pas : la saturation aussi

⚠️ **Un ratio conforme ne garantit pas qu'on voie la couleur.** WCAG mesure la
luminance, pas la présence d'une teinte. Le vent est passé à 5,12 sur blanc tout
en restant pâle et indistinct — conforme, invisible.

Les couleurs d'élément visent donc **deux critères** : ratio ≥ 4,5 **et**
saturation ≥ 45 %. Assombrir une couleur vers le gris satisfait le premier et
trahit le second ; il faut saturer, pas seulement foncer.

| Élément | Clair | Sombre | Note |
|---------|-------|--------|------|
| Feu | 85 % | 77 % | — |
| Eau | 100 % | 74 % | — |
| Vent | 100 % | 79 % | Jaune franc, jamais kaki |
| Lumière | 70 % | 17 % | Doré en clair ; en sombre c'est du blanc, la couleur du jeu |
| Ténèbres | 68 % | 71 % | — |
| Inconnu | 17 % | 16 % | Gris par nature — un monstre non identifié |

⚠️ **Vent et Lumière : arbitrage assumé.** Un jaune reste jaune tant qu'il est
clair ; l'assombrir jusqu'à 4,5 sur `bg` le fait virer au kaki, et le joueur ne
reconnaît plus son élément. On tient donc **4,5 sur `panel`** — la surface des
cartes et des listes, où ces libellés apparaissent réellement — et on accepte
moins sur `bg`, qui ne porte quasiment aucun texte d'élément. Ce sont des
libellés courts et gras, pas du texte courant. Même tolérance pour les paliers
du résumé de compte et pour le laiton (`star`).
**La règle** : 4,5 sur `panel`, rien de plus.

| Jeton | Givre : `panel` / `bg` / `panel2` | Atelier : `panel` / `bg` / `panel2` |
|-------|-----------------------------------|-------------------------------------|
| Vent | 4,63 / 4,35 / 3,98 | 4,56 / 4,08 / 3,74 |
| Lumière | 5,29 / 4,97 / 4,55 | 5,21 / 4,66 / 4,27 |
| `star` | 4,87 / 4,58 / 4,19 | 4,79 / 4,29 / 3,93 |

### Les trois surfaces se distinguent deux à deux

`panel2` sert **à la fois** de fond enfoncé sur `panel` (détail de rune, piste de
barre) et de surface posée sur `bg`. Il lui faut donc un écart perceptible avec
les deux — ni confondu avec le blanc, ni avec le fond de page.

| Paire | Forge | Givre | Atelier |
|-------|-------|-------|---------|
| `panel2` / `panel` | 1,15 | 1,16 | 1,22 |
| `panel2` / `bg` | 1,31 | **1,09** | **1,09** |
| `panel` / `bg` | 1,14 | **1,06** | **1,12** |

L'écart `panel2` / `panel` est tenu : à 1,08, le détail d'une rune « semblerait
n'avoir aucun fond ».
⚠️ En clair, `panel2` ne se distingue presque pas de `bg` : une surface
`panel2` posée directement sur la page est séparée par sa BORDURE, pas par son
fond. De même, une carte `panel` ne se détache du fond qu'à 1,06 en Givre (une
carte blanche sur une page gris-bleu très pâle) et 1,12 en Atelier (un papier
clair sur un papier chaud) : c'est son contour qui la dessine.

### Raretés : deux couleurs, deux usages

`RARITY_META` ([effects.ts](../../../../src/lib/effects.ts)) porte **deux** couleurs
par rareté, parce qu'elles servent à deux choses :

- **`color`** — la couleur vive du jeu, posée sur la **bannière** dont le fond
  est un dégradé sombre dans les deux thèmes. Elle ne change jamais.
- **`ink`** — la couleur de **texte** sur un panneau (valeur d'efficience d'une
  tuile, légende du résumé). Elle suit le thème via `--rarity-1..5`.

⚠️ Utiliser `color` comme couleur de texte est le bug qu'il faut éviter : le vert
magique `#7cf0a6` sur fond blanc est illisible.

⚠️ **`border` et `border-soft` sont volontairement sous 3,0** (en Givre
`border` 1,30 à 1,51, `border-soft` 1,10 à 1,28 ; en Atelier 1,50 à 1,83 et
1,13 à 1,37 ; en Forge 1,86 à 2,44 et 1,18 à 1,54 — `border-soft` pour les
cadres, `border` un cran plus marquée pour qu'on voie où taper). Ce
seuil vaut pour un contour qui *porte une information* — un champ de saisie, un
élément sélectionné. Une bordure de carte est décorative : la monter à 3,0
quadrillerait une interface qui affiche 60 tuiles par écran. Ce qui distingue
une carte, c'est sa surface (`panel` sur `bg`), pas son trait.

### Une seule source par thème

Givre est le `:root` nu ; Atelier ne redéfinit, dans son bloc, que les jetons
qui diffèrent de Givre ([themes.md](themes.md), « Trois blocs, un ordre »).
Les valeurs de Forge vivent dans des variables `--forge-*` déclarées **une fois**,
que les deux déclencheurs (media query et `[data-theme="dark"]`) se contentent de
référencer.

⚠️ **Ne jamais recopier la liste dans les deux blocs.** Deux copies divergent :
le thème forcé garderait des couleurs sous le seuil pendant que celui du
système est corrigé. Un thème qui change selon la façon dont on l'a activé est
un bug indétectable à la lecture.
