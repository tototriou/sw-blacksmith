# Recommandations — modèle, origine et vue

Partie de [Siège · Recommandations](README.md).

## Modèle

```ts
type RecoStatKey = 'hp'|'atk'|'def'|'spd'|'cr'|'cd'|'res'|'acc';

interface RecoSlot {
  com2usId: number | null;                    // null = slot vide
  name: string;                               // repli d'affichage
  stats: Partial<Record<RecoStatKey, number>>;// minimums (absent = non exigé)
  setOptions: string[][];                     // POSSIBILITÉS de runage, une seule suffit
  artifacts: Record<'element'|'archetype', number[]>; // propriétés d'artéfact exigées, 4 max chacune
}
interface RecoCounter {                        // une défense adverse que le deck bat
  monsters: { com2usId: number|null; name: string }[]; // toujours 3
  note: string;                                // « si le Chloe est en lead »
  fiabilite?: number;                          // 0 à 5, saisie par étoile entière, relue par demi-étoile ; absente = non notée (defenses-visees.md)
}
interface RecoDeck { name: string; note: string; slots: RecoSlot[]; counters: RecoCounter[] } // 3 slots, index 0 = leader
interface Reco { id: string; origin: 'mine'|'imported'; name: string; author: string; note: string; decks: RecoDeck[];
                 source?: string;          // provenance stable, sert à la fusion d'un import (persistance-et-partage.md)
                 contributeurs?: string[]; // publieurs dans le salon Discord, écrits par le service (persistance-et-partage.md)
                 lien?: LienDiscord }      // recommandation liée à un salon, locale (synchronisation-discord.md)
type RecoPayload = Omit<Reco, 'id' | 'origin' | 'lien'>; // ce qui voyage dans un export
```

**Une recommandation est un lot de decks**, pas un deck isolé : on partage
« mes défenses de siège » en un seul fichier, et le destinataire voit d'un coup
lesquelles il peut jouer.

- Une recommandation garde **toujours au moins un deck** (supprimer le dernier
  en recrée un vide).
- Un même monstre ne peut pas occuper deux slots **du même deck**, mais peut
  revenir dans **un autre deck** de la recommandation.
- Chaque deck se nomme par **les noms de ses monstres, séparés par un tiret**
  (« Trevor - Bella - Loren ») ; « Deck N » tant qu'aucun monstre n'est choisi.
  **Pas de titre libre à saisir** — `deckLabel` (dans
  [RecoCard.tsx](src/components/siege/RecoCard.tsx)) calcule toujours ce nom,
  **dérivé à l'affichage, jamais stocké** : il suit les changements de
  monstres, et se recalcule chez celui qui importe (mêmes `com2usId` → mêmes
  noms).
  - Si un monstre est absent des données chargées, on retombe sur le nom stocké
    dans le slot au moment du partage.
  - ⚠️ **Ce nom calculé sert de TEXTE** là où un deck se nomme en mots (le
    nom d'une défense dans la vue Défenses, la liste à l'export) — jamais sur
    la ligne du deck : aux deux formats, elle montre les **portraits des
    monstres**, le nom en infobulle
    ([interactions.md](interactions.md#déplier-un-deck)).
  - ⚠️ **`RecoDeck.name` existe dans le type et le stockage, pour la
    RÉTROCOMPATIBILITÉ d'un import** : une recommandation reçue d'une app qui
    n'est pas à jour peut porter un titre dans ce champ. Il n'est **jamais
    rejeté** par le validateur d'import ([recoShare.ts](src/lib/recoShare.ts)),
    simplement **ni lu ni affiché** : `deckLabel` ne le consulte pas. Un titre
    libre peut dater une fois le deck modifié, redoubler ce que les portraits
    montrent déjà, ou rester vide et donc identique au nom automatique — trois
    façons de ne rien apporter.
- Les **decks totalement vides** ne sont ni exportés ni comptés dans les statuts.

## Origine

Chaque recommandation porte une **origine** :

| Origine | Attribuée quand | Rendu |
|---------|-----------------|-------|
| `mine` | créée via « Créer une recommandation » | — |
| `imported` | reçue via un import, ou apparue d'un salon Discord ([synchronisation-discord.md](synchronisation-discord.md)) | puce **« Importée »** (icône ↓) dans l'en-tête |

⚠️ L'origine est **purement locale** : elle **n'est jamais transportée** dans un
export (d'où `RecoPayload`, qui exclut `id` **et** `origin`). Ce qui est « à moi »
chez l'auteur devient « importée » chez celui qui la reçoit — y compris si je
réimporte mon propre export.

⚠️ **Pas de filtre par origine.** L'origine reste une donnée de la carte : la
puce « Importée » dit ce qu'on a reçu.

## Vues Défenses / Decks

Les mêmes recommandations, lues dans les deux sens :

| Vue | La liste | Le volet | Rôle |
|-----|----------|----------|------|
| **Défenses** (à l'arrivée) | chaque défense visée, toutes recommandations confondues | les offenses qui la battent, par recommandation ou par fiabilité | qui bat cette défense ? on y note, édite et ajoute des counters |
| **Decks** | les recommandations | une recommandation, ses decks et ce qu'ils battent (« Fort contre ») | qui joue quoi ? on y édite la recommandation |

Le rendu des deux : [rendu-de-la-page.md](rendu-de-la-page.md#les-deux-vues--une-liste-un-volet)
et [recherche-par-monstre.md](recherche-par-monstre.md#la-vue-défenses).

⚠️ **La vue ne touche pas au format exporté.** La vue Défenses est
**calculée** à partir des `counters` de chaque deck
([recoDefenses.ts](../../../../src/lib/recoDefenses.ts), calcul pur, testé :
`reco-defenses`, `reco-counter`) — rien n'est stocké en plus, un fichier de
n'importe quelle version s'affiche dans les deux vues sans conversion.

Règles de l'identité d'une défense :
- **Même défense = même équipe** (`cleEquipe`, la clé que reprend la fusion
  d'un import, [persistance-et-partage.md](persistance-et-partage.md)). Le
  **chef** d'une équipe est son premier monstre, **s'il a un lead actif en
  siège** : seul ce lead change l'équipe en jeu.
  - avec chef : même chef et mêmes deux autres monstres, dans n'importe quel
    ordre (clé `chef|les deux autres triés`) ;
  - sans chef : mêmes trois monstres, dans n'importe quel ordre (clé
    `|les trois triés`) ;
  - une collaboration et sa version SW sont le **même monstre** : leur clé
    est l'identifiant commun de la paire (`idCanoniqueCollab`,
    [monsterForms.ts](../../../../src/lib/monsterForms.ts)), si bien
    qu'Eivor-Pure Vanilla Cookie-Odin et Solveig-Adriana-Odin sont une seule
    défense, et un seul deck à la fusion.

  Solveig-Adriana-Odin et Solveig-Odin-Adriana : une seule défense (chef
  Solveig). Odin-Adriana-Solveig en est une autre (chef Odin). Kinki-Windy-Lulu
  et Windy-Lulu-Kinki : une seule, ni Kinki (pas de leader skill) ni Windy
  (portée Dungeon) n'ayant de lead actif en siège.
- **Lead actif en siège** (`leadActifEnSiege`, la règle de portée de
  `siegeLeadFor` pour la VIT, étendue à toute leader skill) : portée General
  ou Guild ; ou portée Element, si au moins un monstre de l'équipe est de cet
  élément. Arena, Dungeon ou pas de leader skill : pas de lead actif. Dans les
  données SWARFARM, un lead d'élément porte toujours l'élément de son monstre,
  qui le remplit seul. Le leader skill et l'élément viennent des données
  chargées (l'index `monsterByCom2us` de l'écran).
- ⚠️ **Lead inconnu = chef**, par prudence : un premier monstre saisi à la
  main, ou absent des données chargées, compte pour chef. La clé distingue
  alors autant d'équipes que si son lead était actif, jamais moins : deux
  défenses qui pourraient différer en jeu ne se regroupent pas, au pire une
  même défense fait deux lignes. Même prudence pour un lead d'élément qu'un
  allié inconnu pourrait remplir. Un premier emplacement vide : pas de chef.
- Un monstre saisi à la main se reconnaît à son nom, sans casse. Défense
  entièrement vide : ignorée. Les monstres affichés sont ceux de sa première
  saisie.
- Un deck qui vise deux fois la même défense n'en est qu'**une** offense.
- **Les decks sans défense visée** ne disparaissent pas : ils sont rangés à
  part, sous « Sans défense visée ».

La vue est **mémorisée** (`useStickyState`, clé `recos.vue`).
