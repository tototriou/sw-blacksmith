// Parse un export de compte Summoners War (format SWEX) — 100% côté navigateur.
//
// Deux imports distincts sont exposés :
//  - parseAccountJson : la BOX RTA (World Arena) — favoris RTA + vitesse des
//    runes RTA (chaque monstre a son propre preset de runes World Arena).
//  - parseSiegeDefense : les DÉFENSES de combat de guilde (siège) — jusqu'à 6
//    decks de 3 monstres, avec les runes propres à chaque défense de siège.

import {
  ArtifactDetail,
  BaseStats,
  CraftKind,
  CraftLine,
  EffectLine,
  ElementKey,
  GearSet,
  RelicDetail,
  RuneDetail,
} from '../types';
import { activeSets } from './effects';
import type { Dictionnaire } from '../i18n/fr';

const RUNE_EFF_SPEED = 8; // type d'effet « Vitesse » dans les données com2us
const RUNE_SET_SWIFT = 3; // set_id du set Swift

/* --------------------------------------------------------------------------
 * Source d'un export — texte OU objet déjà parsé
 * ----------------------------------------------------------------------- */

// Un import de compte enchaîne CINQ extracteurs (RTA, box, inventaire, siège
// défense, siège attaque) sur le même fichier. Chacun recevait le texte brut et
// le reparsait : cinq `JSON.parse` d'un export de 8 Mo, ~80 ms jetés, et bien
// plus sur téléphone. Les extracteurs acceptent donc aussi l'objet **déjà
// parsé** — l'appelant parse une fois avec `parseAccountSource` et passe le
// résultat à tous. Le texte reste accepté pour les appels isolés.
export type AccountSource = string | Record<string, any>;

// Parse une fois pour toutes. `null` = fichier illisible (l'appelant produit
// alors son propre message, chaque extracteur ayant sa forme de résultat).
export function parseAccountSource(src: AccountSource): Record<string, any> | null {
  if (typeof src !== 'string') return src ?? null;
  try {
    const data = JSON.parse(src);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

// Date de l'EXPORT lui-même (epoch ms), depuis `tvalue` — l'heure serveur au
// moment où SWEX a récupéré le compte.
//
// ⚠️ **C'est cette date qu'il faut afficher, pas celle de l'import.** Réimporter
// un fichier de trois semaines afficherait sinon « aujourd'hui » sur des données
// périmées, ce qui est exactement le mensonge qu'on cherche à éviter. Vérifié sur
// des exports réels : `tvalue` colle à la seconde près à la création du fichier,
// et reste bien antérieur à sa date quand il a été recopié depuis.
//
// ⚠️ Ne pas confondre avec `tvaluelocal`, décalé de l'heure du serveur de jeu.
export function parseAccountExportDate(src: AccountSource): number | null {
  const data = parseAccountSource(src);
  const t = Number(data?.tvalue);
  if (!Number.isFinite(t) || t <= 0) return null;
  const ms = t * 1000;
  // Garde-fou : un champ absent ou dans une autre unité donnerait une date
  // absurde, affichée telle quelle. Le jeu est sorti en 2014.
  if (ms < Date.UTC(2014, 0, 1) || ms > Date.now() + 86_400_000) return null;
  return ms;
}

// Nom du joueur (`wizard_info.wizard_name`), pour dire QUEL compte est chargé.
//
// ⚠️ On peut jongler entre plusieurs exports — le sien, celui d'un ami dont on
// compare les runes — et rien ne disait lequel était affiché. Une date d'import
// ne suffit pas : deux comptes importés le même jour se ressemblent.
//
// ⚠️ **Le nom seulement, jamais l'identifiant.** `wizard_id` est un numéro de
// compte : il n'apprend rien à qui lit son propre écran, et c'est une donnée
// qu'on n'a aucune raison d'afficher.
export function parseAccountWizardName(src: AccountSource): string | null {
  const data = parseAccountSource(src);
  const nom = data?.wizard_info?.wizard_name;
  if (typeof nom !== 'string') return null;
  const propre = nom.trim();
  return propre.length > 0 ? propre : null;
}

// Identifiant STABLE du compte (pas de l'export) — le même joueur réexporté
// deux fois porte le même `wizard_id`, contrairement à `tvalue`
// (parseAccountExportDate) qui change à chaque export. Sert à distinguer
// « nouvelle version du même compte » (réexport, `wizard_id` inchangé) de
// « compte différent » (voir App.tsx, `appliquerImport` — réinitialise
// l'exclusion manuelle de runes de l'Optimizer uniquement dans ce second
// cas : des sélections qui référencent des monstres/runes d'un AUTRE compte
// n'ont plus de sens, alors qu'un simple réexport garde les mêmes ids).
// ⚠️ Racine `wizard_id`, pas `wizard_info.wizard_id` : les deux existent
// dans un export réel et portent la même valeur, mais la racine est plus
// courte à lire et déjà utilisée ailleurs dans le format SWEX (`tvalue`, cf.
// ci-dessus).
export function parseWizardId(src: AccountSource): number | null {
  const data = parseAccountSource(src);
  const id = Number(data?.wizard_id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

// Mémoïse un index dérivé de `data` : les extracteurs reconstruisent sinon les
// mêmes Maps (runes ×4, artéfacts ×3, unités ×2) sur des milliers d'entrées.
// Clé faible sur l'objet parsé → libéré avec lui, et jamais partagé entre deux
// imports différents.
//
// ⚠️ **Contrat : l'index renvoyé est partagé, donc en LECTURE SEULE.** Avant la
// mémoïsation chaque extracteur avait sa copie ; désormais un `.set()` sur
// l'index en corromprait quatre autres — et le bug n'apparaîtrait que dans un
// extracteur voisin, à des centaines de lignes de la faute. D'où le type
// `ReadonlyMap` en sortie : le compilateur refuse la mutation. Un extracteur qui
// a besoin d'un index à lui en fait une copie explicite (`new Map(index)`).
function memoByData<T>(build: (data: any) => T): (data: any) => T {
  const cache = new WeakMap<object, T>();
  return (data: any) => {
    if (!data || typeof data !== 'object') return build(data);
    const hit = cache.get(data);
    if (hit !== undefined) return hit;
    const made = build(data);
    cache.set(data, made);
    return made;
  };
}

/* --------------------------------------------------------------------------
 * Helpers partagés
 * ----------------------------------------------------------------------- */

// Somme des SPD apportées par une rune (mainstat + prefix + substats avec meule).
function runeSpeed(rune: any): number {
  let s = 0;
  const pri = rune?.pri_eff;
  if (Array.isArray(pri) && Number(pri[0]) === RUNE_EFF_SPEED) s += Number(pri[1]) || 0;
  const prefix = rune?.prefix_eff;
  if (Array.isArray(prefix) && Number(prefix[0]) === RUNE_EFF_SPEED) s += Number(prefix[1]) || 0;
  const sec = rune?.sec_eff;
  if (Array.isArray(sec)) {
    for (const e of sec) {
      if (Array.isArray(e) && Number(e[0]) === RUNE_EFF_SPEED) {
        s += (Number(e[1]) || 0) + (Number(e[3]) || 0); // valeur + meule
      }
    }
  }
  return s;
}

// Index de TOUTES les runes par rune_id : inventaire (top-level `runes`) +
// runes équipées dans les unités. Un preset (RTA ou siège) peut réutiliser n'importe laquelle.
const indexRunes = memoByData((data: any): ReadonlyMap<number, any> => {
  const runeById = new Map<number, any>();
  const add = (r: any) => {
    const id = Number(r?.rune_id);
    if (Number.isFinite(id)) runeById.set(id, r);
  };
  if (Array.isArray(data?.runes)) data.runes.forEach(add);
  if (Array.isArray(data?.unit_list)) {
    for (const u of data.unit_list) if (Array.isArray(u?.runes)) u.runes.forEach(add);
  }
  return runeById;
});

// Marqueur de chaque rune marquée : rune_id → `lock_type` (1..8), depuis
// `rune_lock_list` au premier niveau de l'export.
//
// ⚠️ **Le marqueur n'est PAS dans l'objet rune** — ses clés sont les mêmes
// partout, et `extra` y est la rareté. Il vit dans cette liste à part, de même
// forme que `unit_marker_list` (marqueurs des monstres). Malgré le mot
// « lock », ce n'est pas un simple verrou anti-vente : relevé sur un export
// réel, 563 entrées couvrent les 8 valeurs.
//
// ⚠️ **Aucune valeur ne dit « aucun marqueur »** : une rune sans marqueur est
// simplement ABSENTE de la liste. Chaque rune_id y figure au plus une fois
// (vérifié sur deux exports réels).
export const indexRuneMarkers = memoByData((data: any): ReadonlyMap<number, number> => {
  const m = new Map<number, number>();
  if (Array.isArray(data?.rune_lock_list)) {
    for (const e of data.rune_lock_list) {
      const id = Number(e?.rune_id);
      const type = Number(e?.lock_type);
      if (Number.isFinite(id) && Number.isInteger(type) && type > 0) m.set(id, type);
    }
  }
  return m;
});

// Index des unités possédées par unit_id.
const indexUnits = memoByData((data: any): ReadonlyMap<number, any> => {
  const unitById = new Map<number, any>();
  if (Array.isArray(data?.unit_list)) {
    for (const u of data.unit_list) {
      const uid = Number(u?.unit_id);
      if (Number.isFinite(uid)) unitById.set(uid, u);
    }
  }
  return unitById;
});

// SPD plate des runes pour un lot de rune_id donné.
//
// ⚠️ Ne décide PAS si le Swift est actif : c'est `activeSetsFromRuneIds` qui
// fait foi (voir `swiftActive`). Compter les runes Swift ici donnait un
// désaccord avec les sets affichés — bug réel, détaillé sous `swiftActive`.
function speedFromRuneIds(runeIds: any[], runeById: ReadonlyMap<number, any>): number {
  let flatRuneSpeed = 0;
  for (const rid of runeIds) {
    const rune = runeById.get(Number(rid));
    if (rune) flatRuneSpeed += runeSpeed(rune);
  }
  return flatRuneSpeed;
}

// set_id com2us → clé de RUNE_SETS. Le nombre de pièces requis et le joker
// Intangible sont gérés par `activeSets` (voir effects.ts).
const SET_ID_KEY: Record<number, string> = {
  1: 'energy', 2: 'guard', 3: 'swift', 4: 'blade', 5: 'rage', 6: 'focus', 7: 'endure',
  8: 'fatal', 10: 'despair', 11: 'vampire', 13: 'violent', 14: 'nemesis', 15: 'will',
  16: 'shield', 17: 'revenge', 18: 'destroy', 19: 'fight', 20: 'determination',
  21: 'enhance', 22: 'accuracy', 23: 'tolerance', 24: 'seal', 25: 'intangible',
};

// Sets de runes ACTIFS d'un build (ex. ['swift','will']). Un set 4 pièces
// s'active à 4 runes, les autres à 2. Une rune Intangible sert de joker,
// uniquement s'il y a exactement UN set incomplet (voir activeSets, effects.ts).
function activeSetsFromRuneIds(runeIds: any[], runeById: ReadonlyMap<number, any>): string[] {
  const keys: string[] = [];
  for (const rid of runeIds) {
    const rune = runeById.get(Number(rid));
    if (!rune) continue;
    const key = SET_ID_KEY[Number(rune?.set_id)];
    if (key) keys.push(key);
  }
  return activeSets(keys); // règles d'activation partagées (voir effects.ts)
}

// Le set Swift est-il actif ? **Une seule source de vérité : les sets actifs.**
//
// ⚠️ Ne surtout pas recompter les runes Swift à côté. On le faisait
// (`swiftCount >= 4`), et ça divergeait dès qu'une rune **Intangible** servait
// de joker : 3 Swift + 1 Intangible → `activeSets` renvoie bien `swift`, mais
// le comptage disait non. Le bonus de vitesse n'était alors pas intégré à la
// « SPD runes » alors que l'affichage, lui, le retirait — soit **26 points de
// vitesse en moins** sur un monstre à 101 de base, et lui seul dans son équipe.
function swiftActive(sets: string[]): boolean {
  return sets.includes('swift');
}

/* --------------------------------------------------------------------------
 * Extraction du DÉTAIL de l'équipement (runes / artéfacts / relique)
 * Sert à afficher les stats calculées d'un monstre (base + bonus) au clic.
 * ----------------------------------------------------------------------- */

// attribute d'artéfact d'attribut (element) → ElementKey (1 eau, 2 feu, 3 vent, 4 lum, 5 tén).
const ELEMENT_BY_ATTR: Record<number, ElementKey> = {
  1: 'water', 2: 'fire', 3: 'wind', 4: 'light', 5: 'dark',
};
// unit_style d'artéfact de type (archetype) → clé.
const ARCHETYPE_BY_STYLE: Record<number, 'attack' | 'defense' | 'hp' | 'support'> = {
  1: 'attack', 2: 'defense', 3: 'hp', 4: 'support',
};

// ⚠️ Valeur com2us de l'artéfact **INTANGIBLE**, la même pour `attribute`
// (sorte Attribut) et `unit_style` (sorte Type) : le joker, posable sur
// n'importe quel monstre. Relevée sur un compte réel — 17 attributs et 7 types
// sur 1 512 artéfacts.
//
// ⚠️ Sans ce cas, un intangible retombait sur `element: 'unknown'` /
// `archetype: undefined`, donc **indistinguable d'une donnée corrompue** — et
// jugé éligible à aucun monstre par `artifactFitsMonster`.
const ARTIFACT_INTANGIBLE = 98;

// Ligne d'effet simple [type, valeur, …] → EffectLine (undefined si type 0/absent).
function effLine(eff: any): EffectLine | undefined {
  if (!Array.isArray(eff) || !Number(eff[0])) return undefined;
  return { code: Number(eff[0]), value: Number(eff[1]) || 0 };
}

// Substat de rune [type, valeur, enchant, meule] → EffectLine (valeur + meule).
function subEffLine(eff: any): EffectLine {
  const grind = Number(eff?.[3]) || 0;
  return {
    code: Number(eff?.[0]) || 0,
    value: (Number(eff?.[1]) || 0) + (grind > 0 ? grind : 0),
    grind,
    enchant: !!Number(eff?.[2]),
  };
}

// `markers` : voir `indexRuneMarkers`. Une rune absente de l'index n'a pas de
// marqueur — le champ reste alors absent, jamais à 0.
export function runeToDetail(rune: any, markers: ReadonlyMap<number, number>): RuneDetail {
  const subs = Array.isArray(rune?.sec_eff)
    ? rune.sec_eff.filter((e: any) => Number(e?.[0])).map(subEffLine)
    : [];
  const rar = Number(rune?.extra) || 0; // rareté com2us (champ `extra`, +10 si antique)
  const marker = markers.get(Number(rune?.rune_id));
  return {
    id: Number(rune?.rune_id) || 0,
    slot: Number(rune?.slot_no) || 0,
    set: SET_ID_KEY[Number(rune?.set_id)] ?? 'unknown',
    rank: Number(rune?.class) || 0,
    rarity: rar > 10 ? rar - 10 : rar,
    level: Number(rune?.upgrade_curr) || 0,
    main: effLine(rune?.pri_eff) ?? { code: 0, value: 0 },
    innate: effLine(rune?.prefix_eff),
    subs,
    ...(marker !== undefined ? { marker } : {}),
  };
}

export function artifactToDetail(a: any): ArtifactDetail {
  const main = effLine(a?.pri_effect) ?? { code: 0, value: 0 };
  // ⚠️ `rid` était LU pour indexer les artéfacts (voir `artById`) mais jamais
  // conservé sur le détail. Sans lui, un artéfact ne peut être ni mémorisé
  // dans un build validé ni réservé pour une liste — voir `ArtifactDetail.id`.
  // sec_effect = [type, value, rolls, i3, i4]. Le substat « rollé » (amélioré/
  // converti) est celui dont i4 > 0.
  //
  // ⚠️ `e[2]` est le nombre d'AMÉLIORATIONS posées sur la ligne — vérifié sur
  // 2 120 artéfacts : la somme par artéfact vaut exactement ce que sa rareté
  // distribue au +15 (Rare 2, Héroïque 3, Légendaire 4). C'est la mesure de
  // qualité d'un artéfact, cf. docs/02-app/compte/.
  const subs: EffectLine[] = Array.isArray(a?.sec_effects)
    ? a.sec_effects
        .filter((e: any) => Number(e?.[0]))
        .map((e: any) => ({
          code: Number(e[0]),
          value: Number(e[1]) || 0,
          rolls: Number(e[2]) || 0,
          enchant: Number(e[4]) > 0,
        }))
    : [];
  const level = Number(a?.level) || 0;
  // Rareté = natural_rank (le champ `rank` vaut toujours 5, inutilisable).
  const rr = Number(a?.natural_rank) || 0;
  const rarity = rr > 10 ? rr - 10 : rr;
  if (Number(a?.type) === 1) {
    const intangible = Number(a?.attribute) === ARTIFACT_INTANGIBLE;
    return {
      id: Number(a?.rid) || 0,

      kind: 'element',
      element: ELEMENT_BY_ATTR[Number(a?.attribute)] ?? 'unknown',
      ...(intangible ? { intangible } : {}),
      level,
      rarity,
      main,
      subs,
    };
  }
  const intangible = Number(a?.unit_style) === ARTIFACT_INTANGIBLE;
  return {
    id: Number(a?.rid) || 0,

    kind: 'archetype',
    archetype: ARCHETYPE_BY_STYLE[Number(a?.unit_style)],
    ...(intangible ? { intangible } : {}),
    level,
    rarity,
    main,
    subs,
  };
}

// `sec_effect` = [type, tranche, pourcentage].
//
// ⚠️ **Relevé sur un compte réel** (15 reliques) : le premier nombre vaut
// TOUJOURS le `type` de la relique — ce n'est donc pas un code d'effet parmi
// d'autres, c'est la propriété unique de la pièce, fixée à l'obtention. Le
// deuxième est une TRANCHE de stat, et il DIMINUE quand la relique monte (un
// type 12 passe de 45 000 à +0 à 27 000 à +8) : plus la relique est forte, plus
// la tranche est petite, donc plus l'effet se déclenche souvent. Le troisième
// est le pourcentage accordé par tranche.
//
// ⚠️ La lire comme une substat (`{ code, value }`) affichait « Effet secondaire
// · 27000 » : le pourcentage était purement et simplement perdu, et le nombre
// affiché n'était pas une valeur mais un diviseur.
function relicToDetail(r: any): RelicDetail | undefined {
  const main = effLine(r?.pri_effect);
  if (!main) return undefined;
  const id = Number(r?.rid) || 0;
  const upgrade = Number(r?.upgrade_curr) || 0;
  const sec = r?.sec_effect;
  if (!Array.isArray(sec)) return { id, upgrade, main };
  // `type` de la pièce s'il est là, sinon le premier nombre — les deux sont
  // égaux sur tous les exports observés.
  const type = Number(r?.type) || Number(sec[0]) || 0;
  const tranche = Number(sec[1]) || 0;
  if (!type || !tranche) return { id, upgrade, main };
  const percent = Number(sec[2]) || 0;
  return { id, upgrade, main, unique: { type, tranche, ...(percent > 0 ? { percent } : {}) } };
}

// `pri_effect[1] = upgrade_curr + 3` (docs/03-developpeur/optimizer/ § Ce que le moteur lit d'une relique,
// vérifié sans exception sur 280 pièces réelles) : une RÈGLE qui SE VÉRIFIE,
// elle ne remplace jamais la donnée — `game-data-curation`. Un écart est
// compté, jamais corrigé silencieusement.
function relicUpgradeMismatch(r: any): boolean {
  const main = r?.pri_effect;
  if (!Array.isArray(main)) return false;
  const upgrade = Number(r?.upgrade_curr) || 0;
  return Number(main[1]) !== upgrade + 3;
}

// Stats de base de l'unité (naked, sans runes) : con×15 pour les PV.
function baseStatsOf(unit: any): BaseStats {
  return {
    hp: (Number(unit?.con) || 0) * 15,
    atk: Number(unit?.atk) || 0,
    def: Number(unit?.def) || 0,
    spd: Number(unit?.spd) || 0,
    cr: Number(unit?.critical_rate) || 0,
    cd: Number(unit?.critical_damage) || 0,
    res: Number(unit?.resist) || 0,
    acc: Number(unit?.accuracy) || 0,
  };
}

// Assemble le GearSet d'un monstre dans un contexte donné : runes du preset,
// artéfacts fournis (RTA ou box), relique de l'unité, stats de base.
function buildGear(
  unit: any,
  runeIds: any[],
  artifactObjs: any[],
  runeById: ReadonlyMap<number, any>,
  markers: ReadonlyMap<number, number>
): GearSet {
  const runes = runeIds
    .map((rid) => runeById.get(Number(rid)))
    .filter(Boolean)
    .map((r) => runeToDetail(r, markers))
    .sort((a, b) => a.slot - b.slot);
  const artifacts = (artifactObjs || []).filter(Boolean).map(artifactToDetail);
  const relic = relicToDetail((Array.isArray(unit?.relics) ? unit.relics : [])[0]);
  return { base: baseStatsOf(unit), runes, artifacts, relic };
}

// Index de TOUS les artéfacts par rid : inventaire (top-level `artifacts`) +
// artéfacts embarqués dans les unités. Les presets (RTA/siège) peuvent
// référencer l'un ou l'autre — comme pour les runes, il faut fusionner.
const indexArtifacts = memoByData((data: any): ReadonlyMap<number, any> => {
  const m = new Map<number, any>();
  const add = (a: any) => {
    const id = Number(a?.rid);
    if (Number.isFinite(id)) m.set(id, a);
  };
  if (Array.isArray(data?.artifacts)) data.artifacts.forEach(add);
  if (Array.isArray(data?.unit_list)) {
    for (const u of data.unit_list) if (Array.isArray(u?.artifacts)) u.artifacts.forEach(add);
  }
  return m;
});

// Index de TOUTES les reliques par rid : inventaire (top-level `data.relics`,
// source première — les équipées y figurent aussi) + reliques embarquées
// dans les unités (repli, exports anciens/incomplets). `data.relics` est
// ajouté en premier : `!m.has(id)` lui laisse la priorité, jamais écrasé par
// le repli (docs/02-app/transverse/ § Inventaire).
const indexRelics = memoByData((data: any): ReadonlyMap<number, any> => {
  const m = new Map<number, any>();
  const add = (r: any) => {
    const id = Number(r?.rid);
    if (Number.isFinite(id) && !m.has(id)) m.set(id, r);
  };
  if (Array.isArray(data?.relics)) data.relics.forEach(add);
  if (Array.isArray(data?.unit_list)) {
    for (const u of data.unit_list) if (Array.isArray(u?.relics)) u.relics.forEach(add);
  }
  return m;
});

// Occupation par rid : nombre d'UNITÉS dont la relique équipée (`relics[0]`)
// porte ce rid — jamais la taille de `data.relics` (une relique n'est pas
// exclusive, docs/03-developpeur/optimizer/
// § Ce que le moteur lit d'une relique ; jusqu'à 96 monstres pour un même rid).
function computeRelicUsage(data: any): Record<number, number> {
  const usage: Record<number, number> = {};
  if (Array.isArray(data?.unit_list)) {
    for (const u of data.unit_list) {
      const rid = Number((Array.isArray(u?.relics) ? u.relics : [])[0]?.rid);
      if (Number.isFinite(rid)) usage[rid] = (usage[rid] || 0) + 1;
    }
  }
  return usage;
}

// Artéfacts RTA équipés par monstre (world_arena_artifact_equip_list).
function rtaArtifactsByUnit(data: any, artById: ReadonlyMap<number, any>): Map<number, any[]> {
  const m = new Map<number, any[]>();
  const list = data?.world_arena_artifact_equip_list;
  if (Array.isArray(list)) {
    for (const e of list) {
      const uid = Number(e?.occupied_id);
      const a = artById.get(Number(e?.artifact_id));
      if (!Number.isFinite(uid) || !a) continue;
      if (!m.has(uid)) m.set(uid, []);
      m.get(uid)!.push(a);
    }
  }
  return m;
}

// Aplati récursivement une structure d'ids (gère les groupes imbriqués
// [[...],[...]]) et renvoie les nombres valides.
function flattenIds(value: any, out: Set<number>) {
  if (Array.isArray(value)) {
    for (const v of value) flattenIds(v, out);
  } else {
    const n = Number(value);
    if (Number.isFinite(n)) out.add(n);
  }
}

/* --------------------------------------------------------------------------
 * Import BOX RTA
 * ----------------------------------------------------------------------- */

export interface ImportedUnit {
  com2usId: number;
  flatRuneSpeed: number; // SPD plate cumulée des runes RTA
  swift: boolean; // set Swift complet (4 runes) équipé en RTA
  sets: string[]; // sets de runes actifs RTA (clés RUNE_SETS)
  runeCount: number; // nombre de runes RTA équipées (build complet = 6)
  gear?: GearSet; // détail runes/artéfacts/relique du preset RTA
}

export interface ParseResult {
  units: ImportedUnit[];
  error?: string;
}

// Collecte les unit_id des monstres « utilisés souvent » (favoris), en gérant
// les deux formats d'export connus :
//  - récent : favorite_unit_list = [{ type, unit_id_list }, …] (on privilégie type 1)
//  - ancien : world_arena_favorite_unit_id_list = [[…],[…]]
function collectFavoriteUnitIds(data: any): Set<number> {
  const ids = new Set<number>();

  const favList = data?.favorite_unit_list;
  if (Array.isArray(favList) && favList.length > 0) {
    const type1 = favList.filter((f) => Number(f?.type) === 1);
    const source = type1.length > 0 ? type1 : favList;
    for (const f of source) flattenIds(f?.unit_id_list, ids);
    if (ids.size > 0) return ids;
  }

  if (Array.isArray(data?.world_arena_favorite_unit_id_list)) {
    flattenIds(data.world_arena_favorite_unit_id_list, ids);
  }
  return ids;
}

// Localise la liste des runes de preset RTA, quelle que soit la variante de nom.
function findRtaEquipList(data: any): any[] | null {
  if (Array.isArray(data?.world_arena_rune_equip_list)) return data.world_arena_rune_equip_list;
  for (const [key, val] of Object.entries(data ?? {})) {
    if (
      /world_arena/i.test(key) &&
      /rune/i.test(key) &&
      Array.isArray(val) &&
      val.length > 0 &&
      val[0] &&
      typeof val[0] === 'object' &&
      'rune_id' in (val[0] as object) &&
      'occupied_id' in (val[0] as object)
    ) {
      return val as any[];
    }
  }
  return null;
}

// Les messages d'erreur sont écrits dans la langue de `t`.
export function parseAccountJson(src: AccountSource, t: Dictionnaire): ParseResult {
  const e = t.importCompte;
  const data = parseAccountSource(src);
  if (!data) return { units: [], error: e.illisible };

  const unitList = data?.unit_list;
  if (!Array.isArray(unitList)) {
    return { units: [], error: e.pasDeUnitList };
  }

  const runeById = indexRunes(data);
  const unitById = indexUnits(data);
  const artById = indexArtifacts(data);
  const rtaArts = rtaArtifactsByUnit(data, artById);

  // Regroupe les runes RTA par monstre (occupied_id = unit_id équipé en RTA).
  const rtaList = findRtaEquipList(data) ?? [];
  const runesByUnit = new Map<number, any[]>();
  for (const e of rtaList) {
    const uid = Number(e?.occupied_id);
    const rid = Number(e?.rune_id);
    if (!Number.isFinite(uid) || !Number.isFinite(rid)) continue;
    const rune = runeById.get(rid);
    if (!rune) continue;
    if (!runesByUnit.has(uid)) runesByUnit.set(uid, []);
    runesByUnit.get(uid)!.push(rune);
  }

  // Monstres « utilisés souvent » = favoris mémorisés par le jeu.
  const favIds = collectFavoriteUnitIds(data);

  // Cible : les favoris si présents, sinon repli sur tous les monstres runés RTA.
  const targetUnitIds = favIds.size > 0 ? Array.from(favIds) : Array.from(runesByUnit.keys());
  if (targetUnitIds.length === 0) {
    return { units: [], error: e.sansRta };
  }

  const units: ImportedUnit[] = [];
  for (const uid of targetUnitIds) {
    const unit = unitById.get(uid);
    if (!unit) continue;
    const com2usId = Number(unit?.unit_master_id);
    if (!Number.isFinite(com2usId)) continue;
    const runeIds = (runesByUnit.get(uid) ?? []).map((r) => r.rune_id);
    const flatRuneSpeed = speedFromRuneIds(runeIds, runeById);
    const sets = activeSetsFromRuneIds(runeIds, runeById);
    const swift = swiftActive(sets);
    // Artéfacts RTA si disponibles, sinon les artéfacts actuellement équipés.
    const artifactObjs = rtaArts.get(uid) ?? (Array.isArray(unit?.artifacts) ? unit.artifacts : []);
    const gear = buildGear(unit, runeIds, artifactObjs, runeById, indexRuneMarkers(data));
    units.push({ com2usId, flatRuneSpeed, swift, sets, runeCount: runeIds.length, gear });
  }

  return { units };
}

/* --------------------------------------------------------------------------
 * Import BOX de monstres (section « Mon compte »)
 * Tous les monstres montés 6★ possédés, avec leur équipement actuellement
 * équipé (runes / artéfacts / relique embarqués dans l'unité).
 * ----------------------------------------------------------------------- */

export interface BoxMonster {
  unitId: number;
  com2usId: number;
  stars: number; // grade actuel (class) — filtré à 6
  level: number; // niveau de l'unité
  gear?: GearSet; // détail des runes/artéfacts/relique actuellement équipés
}

export interface BoxParseResult {
  monsters: BoxMonster[];
  error?: string;
}

// Un monstre de la box, ou `null` s'il n'en est pas (pas 6★, espèce
// illisible). Partagé par l'import et le compte en direct (compteDirect.ts) :
// les deux doivent donner le même monstre.
export function boxMonsterOf(
  u: any,
  runeById: ReadonlyMap<number, any>,
  markers: ReadonlyMap<number, number>
): BoxMonster | null {
  if (Number(u?.class) !== 6) return null; // seuls les monstres montés 6★
  const com2usId = Number(u?.unit_master_id);
  const unitId = Number(u?.unit_id);
  if (!Number.isFinite(com2usId)) return null;
  const runeIds = Array.isArray(u?.runes) ? u.runes.map((r: any) => r?.rune_id) : [];
  const artifactObjs = Array.isArray(u?.artifacts) ? u.artifacts : [];
  const gear = buildGear(u, runeIds, artifactObjs, runeById, markers);
  return { unitId, com2usId, stars: 6, level: Number(u?.unit_level) || 0, gear };
}

// Extrait toute la box 6★. L'équipement vient de l'unité elle-même (runes et
// artéfacts embarqués) : c'est le build actuellement équipé en jeu.
export function parseAccountBox(src: AccountSource, t: Dictionnaire): BoxParseResult {
  const e = t.importCompte;
  const data = parseAccountSource(src);
  if (!data) return { monsters: [], error: e.illisible };
  const unitList = data?.unit_list;
  if (!Array.isArray(unitList)) {
    return { monsters: [], error: e.pasDeUnitList };
  }

  const runeById = indexRunes(data);
  const markers = indexRuneMarkers(data);
  const monsters: BoxMonster[] = [];
  for (const u of unitList) {
    const m = boxMonsterOf(u, runeById, markers);
    if (m) monsters.push(m);
  }

  if (monsters.length === 0) {
    return { monsters: [], error: e.sans6 };
  }
  return { monsters };
}

/* --------------------------------------------------------------------------
 * Import INVENTAIRE complet (sous-sections « Runes » & « Artéfacts »)
 * Toutes les runes et tous les artéfacts possédés (inventaire + équipés).
 * ----------------------------------------------------------------------- */

export interface InventoryParseResult {
  runes: RuneDetail[];
  artifacts: ArtifactDetail[];
  relics: RelicDetail[];
  crafts: CraftLine[];
  // Nombre d'unités portant chaque rid de relique (`relicUsageById`), jamais
  // déduit de `relics.length` — une relique n'est pas exclusive
  // (docs/03-developpeur/optimizer/ § Ce que le moteur lit d'une relique).
  relicUsageById: Record<number, number>;
  // Pièces où `pri_effect[1] ≠ upgrade_curr + 3` — avertissement d'import,
  // jamais une correction (`game-data-curation`).
  relicUpgradeMismatches: number;
  error?: string;
}

export function parseAccountInventory(src: AccountSource, t: Dictionnaire): InventoryParseResult {
  const e = t.importCompte;
  const data = parseAccountSource(src);
  if (!data)
    return {
      runes: [],
      artifacts: [],
      relics: [],
      crafts: [],
      relicUsageById: {},
      relicUpgradeMismatches: 0,
      error: e.illisible,
    };
  if (!Array.isArray(data?.unit_list)) {
    return {
      runes: [],
      artifacts: [],
      relics: [],
      crafts: [],
      relicUsageById: {},
      relicUpgradeMismatches: 0,
      error: e.pasDeUnitList,
    };
  }

  // indexRunes / indexArtifacts / indexRelics fusionnent déjà inventaire + équipés (dédup par id).
  const markers = indexRuneMarkers(data);
  const runes = Array.from(indexRunes(data).values())
    .map((r) => runeToDetail(r, markers))
    .filter((r) => r.main.code !== 0);
  const artifacts = Array.from(indexArtifacts(data).values())
    .map(artifactToDetail)
    .filter((a) => a.main.code !== 0);
  const relicRaws = Array.from(indexRelics(data).values());
  const relics = relicRaws.map(relicToDetail).filter((r): r is RelicDetail => r !== undefined);
  const relicUpgradeMismatches = relicRaws.filter(relicUpgradeMismatch).length;

  return {
    runes,
    artifacts,
    relics,
    crafts: parseCrafts(data),
    relicUsageById: computeRelicUsage(data),
    relicUpgradeMismatches,
  };
}

/* --------------------------------------------------------------------------
 * Runes UTILISÉES — posées sur un monstre d'un deck, ou en RTA
 *
 * ⚠️ « Utilisée » ne veut PAS dire « équipée ». Une rune peut être posée sur un
 * monstre qui ne joue nulle part (elle dort), et une rune de l'INVENTAIRE peut
 * très bien servir en RTA ou en siège : ces contenus ont leurs propres presets
 * de runes, indépendants de ce que l'unité porte en jeu. Se fier au seul
 * `occupied_id` aurait donc raté les presets et compté les monstres oubliés.
 *
 * On balaie donc TOUS les contenus où le joueur pose des monstres :
 *  - les presets **RTA** (`world_arena_rune_equip_list`) ;
 *  - les **défenses de siège** (`guildsiege_defense_deck_*`), preset par unité ;
 *  - **`deck_list`** — TOUS les `deck_type` confondus (arène, donjons, ToA,
 *    labyrinthe, attaques de siège…) : c'est là que le jeu enregistre les
 *    équipes de chaque contenu, et l'utilisateur les veut toutes ;
 *  - les **défenses d'arène** (`defense_deck_info`,
 *    `server_arena_defense_deck_info`), qui ne sont pas dans `deck_list`.
 *
 * Pour un monstre d'un deck SANS preset (la plupart des contenus), les runes
 * utilisées sont celles qu'il **porte actuellement** : c'est avec elles qu'il
 * combat.
 *
 * Le résultat est rangé PAR PÉRIMÈTRE (voir `PerimetreUtilise`) : l'écran
 * d'optimisation laisse choisir lesquels comptent. Une même rune peut figurer
 * dans plusieurs périmètres ; le filtre prend l'UNION des périmètres cochés.
 * ----------------------------------------------------------------------- */

// Les contenus que l'écran sait distinguer. ⚠️ `autres` n'est PAS un reste
// qu'on pourrait oublier : c'est là que tombe tout `deck_type` qui n'est ni
// l'attaque de siège ni l'attaque d'arène — donjons, ToA, labyrinthe… et tout
// contenu que Com2uS ajoutera. Une liste blanche de contenus ferait passer des
// runes qui jouent pour des runes qui dorment (19 types relevés sur un export).
export type PerimetreUtilise =
  | 'rta'
  | 'siege-attaque'
  | 'siege-defense'
  | 'arene-attaque'
  | 'arene-defense'
  | 'autres';

// Ordre d'affichage. Le libellé de chaque périmètre : `compte.perimetres` du
// dictionnaire.
export const PERIMETRES_UTILISES: { key: PerimetreUtilise }[] = [
  { key: 'rta' },
  { key: 'siege-attaque' },
  { key: 'siege-defense' },
  { key: 'arene-attaque' },
  { key: 'arene-defense' },
  { key: 'autres' },
];

// `rune_id` utilisés, triés, par périmètre.
export type RunesUtilisees = Record<PerimetreUtilise, number[]>;

// Aucune rune utilisée — compte absent, ou fichier illisible. Une fabrique et
// pas une constante : chaque appelant reçoit ses propres tableaux.
export function runesUtiliseesVides(): RunesUtilisees {
  return {
    rta: [],
    'siege-attaque': [],
    'siege-defense': [],
    'arene-attaque': [],
    'arene-defense': [],
    autres: [],
  };
}

export function parseUsedRuneIdsParPerimetre(src: AccountSource): RunesUtilisees {
  const data = parseAccountSource(src);
  if (!data) return runesUtiliseesVides();

  const runeById = indexRunes(data);
  const unitById = indexUnits(data);
  const used: Record<PerimetreUtilise, Set<number>> = {
    rta: new Set(),
    'siege-attaque': new Set(),
    'siege-defense': new Set(),
    'arene-attaque': new Set(),
    'arene-defense': new Set(),
    autres: new Set(),
  };

  // Une rune inconnue de l'index (preset qui référence un exemplaire vendu
  // depuis) n'est jamais ajoutée : elle ne pourrait correspondre à aucune rune
  // de l'inventaire affiché.
  const addRuneIds = (dest: Set<number>, ids: any) => {
    if (!Array.isArray(ids)) return;
    for (const rid of ids) {
      const id = Number(rid);
      if (runeById.has(id)) dest.add(id);
    }
  };

  // Les runes actuellement portées par une unité — le repli quand le contenu
  // n'a pas de preset propre.
  const addUnitRunes = (dest: Set<number>, uid: number) => {
    const unit = unitById.get(uid);
    if (!unit || !Array.isArray(unit.runes)) return;
    addRuneIds(dest, unit.runes.map((r: any) => r?.rune_id));
  };

  // Un monstre d'un deck : son preset s'il en a un, sinon ce qu'il porte.
  const addUnit = (dest: Set<number>, uid: any, presets: Map<number, any[]>) => {
    const id = Number(uid);
    if (!Number.isFinite(id) || id === 0) return;
    const preset = presets.get(id);
    if (preset && preset.length > 0) addRuneIds(dest, preset);
    else addUnitRunes(dest, id);
  };

  // RTA : le preset EST le build joué, quel que soit l'endroit où la rune dort.
  for (const e of findRtaEquipList(data) ?? []) {
    const id = Number(e?.rune_id);
    if (runeById.has(id)) used.rta.add(id);
  }

  // Défenses de siège : un preset par unité, dans une table indexée par deck_id.
  const defList = data?.guildsiege_defense_deck_unit_list;
  if (Array.isArray(defList)) {
    const equipList = data?.guildsiege_defense_deck_equip_list;
    for (const dk of defList) {
      const entry = equipList?.[String(dk?.deck_id)] ?? equipList?.[dk?.deck_id];
      const presets = equipArrayToMap(entry?.equip);
      const unitIds = Array.isArray(dk?.unit_id_list) ? dk.unit_id_list : [];
      for (const uid of unitIds) addUnit(used['siege-defense'], uid, presets);
    }
  }

  // Tous les decks enregistrés, tous contenus confondus : l'attaque de siège et
  // l'attaque d'arène ont leur périmètre, tout le reste tombe dans `autres`.
  const deckList = data?.deck_list;
  if (Array.isArray(deckList)) {
    for (const dk of deckList) {
      const type = Number(dk?.deck_type);
      const dest =
        type === SIEGE_OFFENSE_DECK_TYPE
          ? used['siege-attaque']
          : type === ARENA_OFFENSE_DECK_TYPE
            ? used['arene-attaque']
            : used.autres;
      const presets = equipArrayToMap(dk?.equip);
      const unitIds = Array.isArray(dk?.unit_id_list) ? dk.unit_id_list : [];
      for (const uid of unitIds) addUnit(dest, uid, presets);
      addUnit(dest, dk?.leader_unit_id, presets); // absent de unit_id_list sur certains exports
    }
  }

  // Défenses d'ARÈNE — deux decks uniques, en dehors de `deck_list`, avec leur
  // propre preset de runes : l'arène classique (`defense_deck_info`) et l'arène
  // de serveur (`server_arena_defense_deck_info`).
  //
  // ⚠️ Les deux ne portent PAS la même forme d'`unit_id_list` : des ids nus
  // pour la première, des objets `{ unit_id, pos_id }` pour la seconde. Relevé
  // sur un export réel — n'en lire qu'une aurait tu la moitié des défenses.
  for (const cle of ['defense_deck_info', 'server_arena_defense_deck_info']) {
    const info = data?.[cle];
    if (!info || typeof info !== 'object') continue;
    const presets = equipArrayToMap(info.equip);
    const unitIds = Array.isArray(info.unit_id_list) ? info.unit_id_list : [];
    for (const u of unitIds) {
      addUnit(used['arene-defense'], u && typeof u === 'object' ? u.unit_id : u, presets);
    }
  }

  // Trié : la liste part telle quelle dans IndexedDB et dans les tests — un
  // ordre d'insertion dépendant du fichier n'y apporterait rien.
  const trie = (s: Set<number>) => Array.from(s).sort((x, y) => x - y);
  return {
    rta: trie(used.rta),
    'siege-attaque': trie(used['siege-attaque']),
    'siege-defense': trie(used['siege-defense']),
    'arene-attaque': trie(used['arene-attaque']),
    'arene-defense': trie(used['arene-defense']),
    autres: trie(used.autres),
  };
}

// Union triée des périmètres cochés. Sans `perimetres`, TOUS : c'est la
// définition historique de « runes utilisées ».
export function unionRunesUtilisees(
  parPerimetre: RunesUtilisees,
  perimetres: Iterable<PerimetreUtilise> = PERIMETRES_UTILISES.map((p) => p.key)
): number[] {
  const union = new Set<number>();
  for (const p of perimetres) for (const id of parPerimetre[p] ?? []) union.add(id);
  return Array.from(union).sort((x, y) => x - y);
}

// Toutes les runes utilisées, tous périmètres confondus.
export function parseUsedRuneIds(src: AccountSource): number[] {
  return unionRunesUtilisees(parseUsedRuneIdsParPerimetre(src));
}

/* --------------------------------------------------------------------------
 * Libellés des marqueurs de runes (`markers`)
 *
 * Les marqueurs se renomment en jeu : le libellé vit dans `markers[]`, au
 * premier niveau. Ceux des RUNES ont `type: 1`, et leur `sub_type` est le
 * `lock_type` de `rune_lock_list` (voir `indexRuneMarkers`). `type: 3` sert
 * aux monstres ; `type: 2` n'a qu'un libellé sur les exports relevés
 * (probablement les artéfacts, non vérifié) — ni l'un ni l'autre n'est lu ici.
 *
 * ⚠️ Un marqueur peut n'avoir AUCUN libellé : le joueur ne l'a jamais nommé
 * (relevé : 7 numéros utilisés pour 6 libellés, et un libellé vide). Il est
 * alors absent du résultat, et l'écran affiche son numéro. Les espaces de
 * bord sont retirés (« raffinage␠ » relevé tel quel).
 * ----------------------------------------------------------------------- */

export function parseRuneMarkerLabels(src: AccountSource): Record<number, string> {
  const data = parseAccountSource(src);
  const labels: Record<number, string> = {};
  if (!data || !Array.isArray(data.markers)) return labels;
  for (const m of data.markers) {
    if (Number(m?.type) !== 1) continue;
    const n = Number(m?.sub_type);
    const texte = typeof m?.description === 'string' ? m.description.trim() : '';
    if (Number.isInteger(n) && n > 0 && texte) labels[n] = texte;
  }
  return labels;
}

/* --------------------------------------------------------------------------
 * Meules & gemmes en réserve (`rune_craft_item_list`)
 * ----------------------------------------------------------------------- */

// `craft_type` : impair = gemme, pair = meule. Trois familles se suivent —
// **normal** (1/2), **immémorial** (3/4, utilisable sur n'importe quel set),
// **antique** (5/6, réservé aux runes antiques).
//
// ⚠️ Relevé sur les 1 161 lots d'un compte réel : les types pairs ne portent que
// des stats meulables (PV/ATQ/DEF plats et %, VIT), les impairs portent aussi
// TC/DCC/RES/Précision — ce qui est exactement la différence entre une meule et
// une gemme. C'est ce qui identifie les deux familles, pas une table devinée.
const CRAFT_FAMILY: Record<number, { kind: CraftKind; immemorial: boolean; ancient: boolean }> = {
  1: { kind: 'gem', immemorial: false, ancient: false },
  2: { kind: 'grind', immemorial: false, ancient: false },
  3: { kind: 'gem', immemorial: true, ancient: false },
  4: { kind: 'grind', immemorial: true, ancient: false },
  5: { kind: 'gem', immemorial: false, ancient: true },
  6: { kind: 'grind', immemorial: false, ancient: true },
};

// `craft_type_id` empile trois nombres à position fixe : `<set><stat><grade>`,
// les deux derniers sur deux chiffres. 251204 → set 25, stat 12, grade 04.
//
// ⚠️ Le grade des consommables ANTIQUES est décalé de 10 (13/14/15), exactement
// comme le `rank` d'une rune antique — d'où le `- 10`, et non une seconde
// échelle de raretés.
function decodeCraftTypeId(id: number): { set: number; stat: number; grade: number } | null {
  const s = String(id);
  if (s.length < 5) return null;
  const set = Number(s.slice(0, -4));
  const stat = Number(s.slice(-4, -2));
  const grade = Number(s.slice(-2));
  if (!Number.isFinite(set) || !Number.isFinite(stat) || !Number.isFinite(grade)) return null;
  return { set, stat, grade: grade > 10 ? grade - 10 : grade };
}

// Les lots vides (`amount` 0) sont écartés : un consommable qu'on ne possède
// plus ne doit pas faire croire qu'un plan est réalisable.
export function parseCrafts(src: AccountSource): CraftLine[] {
  const data = parseAccountSource(src);
  const list = data?.rune_craft_item_list;
  if (!Array.isArray(list)) return [];
  const out: CraftLine[] = [];
  for (const c of list) {
    const ligne = craftLineOf(c);
    if (ligne) out.push(ligne);
  }
  return out;
}

// Un lot de pierres, ou `null` s'il ne se lit pas ou est vide. Partagé par
// l'import et le compte en direct (compteDirect.ts).
export function craftLineOf(c: any): CraftLine | null {
  const famille = CRAFT_FAMILY[Number(c?.craft_type)];
  if (!famille) return null;
  const dec = decodeCraftTypeId(Number(c?.craft_type_id));
  if (!dec) return null;
  const amount = Number(c?.amount) || 0;
  if (amount <= 0) return null;
  const setKey = famille.immemorial ? null : SET_ID_KEY[dec.set];
  if (setKey === undefined) return null; // set inconnu (nouveau set non encore mappé)
  return {
    kind: famille.kind,
    setKey,
    stat: dec.stat,
    grade: dec.grade,
    ancient: famille.ancient,
    amount,
  };
}

/* --------------------------------------------------------------------------
 * Import ÉQUIPES DE SIÈGE (combat de guilde) — défense & offense
 *
 * Les deux côtés partagent la même forme : des decks de 3 monstres (index 0 =
 * leader) où chaque monstre a son propre preset de runes de siège.
 *  - Défense : guildsiege_defense_deck_unit_list (+ …_equip_list). Le leader est
 *    le 1ᵉʳ de unit_id_list ; unit_id = 0 => slot vide.
 *  - Offense : deck_list filtré sur deck_type = 22 (équipes d'attaque
 *    sauvegardées). Le leader est donné par leader_unit_id ; runes dans dk.equip.
 * ----------------------------------------------------------------------- */

// deck_type des équipes d'attaque de siège sauvegardées (dans deck_list).
// Identifié sur des exports réels : 3 monstres/deck avec presets de runes.
const SIEGE_OFFENSE_DECK_TYPE = 22;

// deck_type des équipes d'attaque d'ARÈNE (dans deck_list). Relevé fourni par
// l'utilisateur, puis vérifié : 15 decks de ce type sur chacun de deux exports
// réels. Sert à `parseArenaOffense` et au périmètre `arene-attaque` de
// `parseUsedRuneIdsParPerimetre`.
const ARENA_OFFENSE_DECK_TYPE = 1;

// Un slot importé, ou null pour un slot vide (unit_id = 0).
export interface SiegeImportedSlot {
  com2usId: number;
  flatRuneSpeed: number; // SPD plate des runes de ce build de siège
  swift: boolean; // set Swift complet équipé sur ce build de siège
  sets: string[]; // sets de runes actifs (clés RUNE_SETS), ex. ['swift','will']
  gear?: GearSet; // détail runes/artéfacts/relique de ce build
}

// Un deck = ses slots ordonnés (index 0 = leader) : 3 au siège, 4 en arène.
export interface SiegeImportedDeck {
  deckId: number | string;
  slots: (SiegeImportedSlot | null)[]; // longueur 3 (siège) ou 4 (arène), null = slot vide
}

export interface SiegeParseResult {
  decks: SiegeImportedDeck[];
  error?: string;
}

// Convertit un tableau `equip` ([{ unit_id, rune_id_list }, …]) en Map unit_id → rune_id_list.
function equipArrayToMap(equip: any): Map<number, any[]> {
  const map = new Map<number, any[]>();
  if (!Array.isArray(equip)) return map;
  for (const e of equip) {
    const uid = Number(e?.unit_id);
    if (!Number.isFinite(uid)) continue;
    map.set(uid, Array.isArray(e?.rune_id_list) ? e.rune_id_list : []);
  }
  return map;
}

// Map unit_id → artifact_id_list depuis un tableau `equip` de deck de siège.
// Les artéfacts de siège sont un preset propre au deck (comme les runes), et
// non les artéfacts actuellement équipés sur l'unité.
function equipArtifactMap(equip: any): Map<number, any[]> {
  const map = new Map<number, any[]>();
  if (!Array.isArray(equip)) return map;
  for (const e of equip) {
    const uid = Number(e?.unit_id);
    if (!Number.isFinite(uid)) continue;
    map.set(uid, Array.isArray(e?.artifact_id_list) ? e.artifact_id_list : []);
  }
  return map;
}

// Définition brute d'un deck avant résolution en monstres/vitesses.
interface DeckDef {
  deckId: number | string;
  unitIds: any[]; // slots ordonnés, leader en tête ; 0 = vide
  runeIdsByUnit: Map<number, any[]>;
  artifactIdsByUnit: Map<number, any[]>;
}

// Les places d'une équipe : 3 au siège, 4 en arène.
const SLOTS_SIEGE = 3;
export const SLOTS_ARENE = 4;

// Résout des DeckDef en SiegeImportedDeck (mapping unité → monstre + vitesses),
// sur `nbSlots` places.
function buildSiegeDecks(
  defs: DeckDef[],
  runeById: ReadonlyMap<number, any>,
  unitById: ReadonlyMap<number, any>,
  artById: ReadonlyMap<number, any>,
  markers: ReadonlyMap<number, number>,
  nbSlots = SLOTS_SIEGE
): SiegeImportedDeck[] {
  const decks: SiegeImportedDeck[] = [];
  for (const def of defs) {
    const slots: (SiegeImportedSlot | null)[] = Array.from({ length: nbSlots }, (_, i) => i).map((i) => {
      const uid = Number(def.unitIds[i]);
      if (!Number.isFinite(uid) || uid === 0) return null;
      const unit = unitById.get(uid);
      if (!unit) return null;
      const com2usId = Number(unit?.unit_master_id);
      if (!Number.isFinite(com2usId)) return null;
      const runeIds = def.runeIdsByUnit.get(uid) ?? [];
      const flatRuneSpeed = speedFromRuneIds(runeIds, runeById);
      const sets = activeSetsFromRuneIds(runeIds, runeById);
      const swift = swiftActive(sets);
      // Artéfacts du preset de siège (artifact_id_list du deck), résolus via l'index global.
      const artIds = def.artifactIdsByUnit.get(uid) ?? [];
      const artifactObjs = artIds.map((aid) => artById.get(Number(aid))).filter(Boolean);
      const gear = buildGear(unit, runeIds, artifactObjs, runeById, markers);
      return { com2usId, flatRuneSpeed, swift, sets, gear };
    });
    // On ignore les decks totalement vides (jamais configurés).
    if (slots.some((s) => s !== null)) decks.push({ deckId: def.deckId, slots });
  }
  return decks;
}

// Import des DÉFENSES de siège.
export function parseSiegeDefense(src: AccountSource, t: Dictionnaire): SiegeParseResult {
  const e = t.importCompte;
  const data = parseAccountSource(src);
  if (!data) return { decks: [], error: e.illisible };
  if (!Array.isArray(data?.unit_list)) {
    return { decks: [], error: e.pasDeUnitList };
  }

  const deckList = data?.guildsiege_defense_deck_unit_list;
  if (!Array.isArray(deckList) || deckList.length === 0) {
    return { decks: [], error: e.sansDefense };
  }

  const runeById = indexRunes(data);
  const unitById = indexUnits(data);
  const artById = indexArtifacts(data);
  const equipList = data?.guildsiege_defense_deck_equip_list;

  const defs: DeckDef[] = deckList.map((dk: any, i: number) => {
    const entry = equipList?.[String(dk?.deck_id)] ?? equipList?.[dk?.deck_id];
    return {
      deckId: dk?.deck_id ?? i,
      // Positions conservées : le 1ᵉʳ slot est le leader ; 0 = vide.
      unitIds: Array.isArray(dk?.unit_id_list) ? dk.unit_id_list : [],
      runeIdsByUnit: equipArrayToMap(entry?.equip),
      artifactIdsByUnit: equipArtifactMap(entry?.equip),
    };
  });

  const decks = buildSiegeDecks(defs, runeById, unitById, artById, indexRuneMarkers(data));
  if (decks.length === 0) {
    return { decks: [], error: e.defenseVide };
  }
  return { decks };
}

// Import des ÉQUIPES D'ATTAQUE de siège (offense).
export function parseSiegeOffense(src: AccountSource, t: Dictionnaire): SiegeParseResult {
  const e = t.importCompte;
  const data = parseAccountSource(src);
  if (!data) return { decks: [], error: e.illisible };
  if (!Array.isArray(data?.unit_list)) {
    return { decks: [], error: e.pasDeUnitList };
  }

  const deckList = Array.isArray(data?.deck_list) ? data.deck_list : [];
  const offense = deckList.filter((dk: any) => Number(dk?.deck_type) === SIEGE_OFFENSE_DECK_TYPE);
  if (offense.length === 0) {
    return { decks: [], error: e.sansOffense };
  }

  const runeById = indexRunes(data);
  const unitById = indexUnits(data);
  const artById = indexArtifacts(data);

  const defs = offense.map((dk: any, i: number) => deckEnregistre(dk, i, SLOTS_SIEGE));
  const decks = buildSiegeDecks(defs, runeById, unitById, artById, indexRuneMarkers(data));
  if (decks.length === 0) {
    return { decks: [], error: e.offenseVide };
  }
  return { decks };
}

// Un deck de `deck_list` : le leader (`leader_unit_id`) en tête, puis les
// autres unités non nulles, sur `nbSlots` places ; runes et artéfacts du
// preset du deck.
function deckEnregistre(dk: any, i: number, nbSlots: number): DeckDef {
  const ids = (Array.isArray(dk?.unit_id_list) ? dk.unit_id_list : [])
    .map(Number)
    .filter((x: number) => Number.isFinite(x) && x !== 0);
  const lead = Number(dk?.leader_unit_id);
  const ordered = Number.isFinite(lead) && lead !== 0 ? [lead, ...ids.filter((x: number) => x !== lead)] : ids;
  return {
    deckId: dk?.deck_seq ?? i,
    unitIds: Array.from({ length: nbSlots }, (_, k) => ordered[k] ?? 0),
    runeIdsByUnit: equipArrayToMap(dk?.equip),
    artifactIdsByUnit: equipArtifactMap(dk?.equip),
  };
}

/* --------------------------------------------------------------------------
 * Import ÉQUIPES D'ARÈNE — défense, défense interserveur & offense
 *
 * Des decks de 4 monstres (index 0 = leader), chacun avec le preset de runes
 * et d'artéfacts du deck, comme au siège.
 *  - Défense : `defense_deck_info`, un deck unique. `unit_id_list` : des ids
 *    nus, dans l'ordre des places ; le leader est le 1ᵉʳ (relevé : un lead
 *    d'arène en tête sur deux exports réels) ; 0 = place vide.
 *  - Défense interserveur : `server_arena_defense_deck_info`, un deck
 *    unique. ⚠️ `unit_id_list` porte des objets `{ unit_id, pos_id }` :
 *    l'ordre est celui de `pos_id`, la position 1 est le leader (relevé : le
 *    même leader que la défense classique sur un export réel).
 *  - Offense : `deck_list` filtré sur `deck_type = 1`. Les équipes d'attaque
 *    servent aux deux arènes : l'interserveur n'a pas les siennes.
 * ----------------------------------------------------------------------- */

// Un deck unique de défense d'arène (`defense_deck_info` ou
// `server_arena_defense_deck_info`), ou null s'il est absent du fichier.
function defenseArene(info: any): DeckDef | null {
  if (!info || typeof info !== 'object' || !Array.isArray(info.unit_id_list)) return null;
  const places = info.unit_id_list.map((u: any, i: number) =>
    u && typeof u === 'object' ? { id: Number(u.unit_id), pos: Number(u.pos_id) } : { id: Number(u), pos: i + 1 }
  );
  places.sort((a: { pos: number }, b: { pos: number }) => a.pos - b.pos);
  return {
    deckId: 1,
    unitIds: Array.from({ length: SLOTS_ARENE }, (_, k) => places[k]?.id ?? 0),
    runeIdsByUnit: equipArrayToMap(info.equip),
    artifactIdsByUnit: equipArtifactMap(info.equip),
  };
}

function lireDefenseArene(
  src: AccountSource,
  t: Dictionnaire,
  cle: 'defense_deck_info' | 'server_arena_defense_deck_info',
  sans: string,
  vide: string
): SiegeParseResult {
  const e = t.importCompte;
  const data = parseAccountSource(src);
  if (!data) return { decks: [], error: e.illisible };
  if (!Array.isArray(data?.unit_list)) return { decks: [], error: e.pasDeUnitList };
  const def = defenseArene(data?.[cle]);
  if (!def) return { decks: [], error: sans };
  const decks = buildSiegeDecks([def], indexRunes(data), indexUnits(data), indexArtifacts(data), indexRuneMarkers(data), SLOTS_ARENE);
  return decks.length ? { decks } : { decks: [], error: vide };
}

// Import de la DÉFENSE d'arène.
export function parseArenaDefense(src: AccountSource, t: Dictionnaire): SiegeParseResult {
  const e = t.importCompte;
  return lireDefenseArene(src, t, 'defense_deck_info', e.sansDefenseArene, e.defenseAreneVide);
}

// Import de la DÉFENSE d'arène interserveur.
export function parseArenaInterserveurDefense(src: AccountSource, t: Dictionnaire): SiegeParseResult {
  const e = t.importCompte;
  return lireDefenseArene(src, t, 'server_arena_defense_deck_info', e.sansDefenseInterserveur, e.defenseInterserveurVide);
}

/* --------------------------------------------------------------------------
 * ARÈNE DIMENSIONNELLE — box, runes et équipes à part
 *
 * La box du mode n'est PAS dans l'export de compte : elle vient de la réponse
 * `dimensionarena_getSeasonInfo`, tenue à jour par le plugin SWEX
 * (plugin-swex/source/dimension.ts), de la même forme qu'un export — relevé
 * sur un journal réel (2026-11) :
 *  - `unit_list` : les monstres obtenus dans le mode, chacun avec les runes
 *    GAGNÉES qu'il porte (`runes`, de 0 à 6) ;
 *  - `rune_list` : les runes gagnées en inventaire ;
 *  - `default_unit_list` : un build de 6 runes par espèce (`is_default`),
 *    celui avec lequel un monstre est invoqué ;
 *  - `defense_deck_info.unit_id_list` : la défense, `[[id, id, id, id]]`,
 *    leader en tête comme la défense d'arène.
 * Pas d'artéfacts dans ce mode (`artifact_list` vide).
 *
 * ⚠️ **Un emplacement sans rune gagnée porte la rune du build par défaut de
 * l'espèce.** Un monstre sans aucune rune porte tout ce build : relevé de
 * l'utilisateur en jeu sur sa défense. Le complément emplacement par
 * emplacement (un monstre qui porte 4 runes gagnées) en est le prolongement,
 * non relevé.
 *
 * L'export, lui, garde la trace des équipes d'ATTAQUE jouées :
 * `deck_recent_list` de type 28, des identifiants de la box dimensionnelle,
 * sans runes (`equip` vide) — relevé : les 4 monstres de la dernière attaque,
 * dont celui qui porte une rune retrouvée dans le journal.
 * ----------------------------------------------------------------------- */

// Le type des équipes d'attaque d'arène dimensionnelle dans `deck_recent_list`.
const DIMENSION_OFFENSE_RECENT_TYPE = 28;

// La box dimensionnelle sous la forme d'un export, pour les index communs :
// les monstres de la box ET les builds par défaut (identifiants courts, 1001…,
// disjoints de ceux de la box), les runes en inventaire.
const donneesDimension = memoByData((saison: any) => ({
  unit_list: [
    ...(Array.isArray(saison?.unit_list) ? saison.unit_list : []),
    ...(Array.isArray(saison?.default_unit_list) ? saison.default_unit_list : []),
  ],
  runes: Array.isArray(saison?.rune_list) ? saison.rune_list : [],
}));

// Build par défaut de chaque espèce : unit_master_id → ses runes.
const buildsParDefaut = memoByData((saison: any): ReadonlyMap<number, any[]> => {
  const m = new Map<number, any[]>();
  for (const u of Array.isArray(saison?.default_unit_list) ? saison.default_unit_list : []) {
    if (Array.isArray(u?.runes)) m.set(Number(u.unit_master_id), u.runes);
  }
  return m;
});

// Les runes que porte un monstre de la box : les siennes, et pour chaque
// emplacement sans rune gagnée, celle du build par défaut de son espèce.
function runesDimension(unit: any, saison: any): number[] {
  const propres = Array.isArray(unit?.runes) ? unit.runes : [];
  const occupes = new Set(propres.map((r: any) => Number(r?.slot_no)));
  const defaut = (buildsParDefaut(saison).get(Number(unit?.unit_master_id)) ?? []).filter(
    (r: any) => !occupes.has(Number(r?.slot_no))
  );
  return [...propres, ...defaut].map((r: any) => Number(r?.rune_id)).filter(Number.isFinite);
}

// Résout des équipes de la box dimensionnelle (identifiants ordonnés, leader
// en tête) en decks de 4 places, chaque monstre avec ses runes du mode.
function decksDimension(equipes: { deckId: number | string; ids: number[] }[], saison: any): SiegeImportedDeck[] {
  const data = donneesDimension(saison);
  const unitById = indexUnits(data);
  const defs: DeckDef[] = equipes.map(({ deckId, ids }) => {
    const unitIds = Array.from({ length: SLOTS_ARENE }, (_, k) => ids[k] ?? 0);
    const runeIdsByUnit = new Map<number, any[]>();
    for (const id of unitIds) {
      const unit = unitById.get(id);
      if (unit) runeIdsByUnit.set(id, runesDimension(unit, saison));
    }
    return { deckId, unitIds, runeIdsByUnit, artifactIdsByUnit: new Map() };
  });
  return buildSiegeDecks(defs, indexRunes(data), unitById, new Map(), new Map(), SLOTS_ARENE);
}

const idsNonNuls = (liste: any[]): number[] =>
  liste.map(Number).filter((x: number) => Number.isFinite(x) && x !== 0);

// Les runes GAGNÉES dans l'arène dimensionnelle : en inventaire (`rune_list`)
// et portées par les monstres de la box. Pas celles des builds par défaut,
// que le joueur ne possède pas : elles comblent les emplacements libres.
export function parseDimensionRunes(saison: Record<string, any> | null): RuneDetail[] {
  const monstres = Array.isArray(saison?.unit_list) ? saison.unit_list : [];
  const toutes = [
    ...(Array.isArray(saison?.rune_list) ? saison.rune_list : []),
    ...monstres.flatMap((u: any) => (Array.isArray(u?.runes) ? u.runes : [])),
  ];
  const parId = new Map<number, any>();
  for (const r of toutes) if (Number.isFinite(Number(r?.rune_id))) parId.set(Number(r.rune_id), r);
  return [...parId.values()].map((r) => runeToDetail(r, new Map())).filter((r) => r.main.code !== 0);
}

// La DÉFENSE de l'arène dimensionnelle, depuis la saison lue dans le journal
// SWEX (`lireSaisonDimension`).
export function parseDimensionDefense(saison: Record<string, any> | null, t: Dictionnaire): SiegeParseResult {
  const e = t.importCompte;
  const liste = saison?.defense_deck_info?.unit_id_list;
  if (!Array.isArray(liste)) return { decks: [], error: e.sansDefenseDimension };
  // `[[…]]` relevé ; une liste à plat est lue de même.
  const ids = idsNonNuls(Array.isArray(liste[0]) ? liste[0] : liste);
  const decks = decksDimension([{ deckId: 1, ids }], saison);
  return decks.length ? { decks } : { decks: [], error: e.defenseDimensionVide };
}

// Les équipes d'ATTAQUE de l'arène dimensionnelle : celles de type 28 de
// `deck_recent_list` dans l'export (`leader_unit_id` en tête), résolues dans
// la box de la saison. Sans saison, leurs monstres sont inconnus.
export function parseDimensionOffense(
  src: AccountSource,
  saison: Record<string, any> | null,
  t: Dictionnaire
): SiegeParseResult {
  const e = t.importCompte;
  const data = parseAccountSource(src);
  if (!data) return { decks: [], error: e.illisible };
  const recents = Array.isArray(data?.deck_recent_list) ? data.deck_recent_list : [];
  const equipes = recents
    .filter((dk: any) => Number(dk?.type) === DIMENSION_OFFENSE_RECENT_TYPE)
    .map((dk: any, i: number) => {
      const ids = idsNonNuls(Array.isArray(dk?.unit_id_list) ? dk.unit_id_list : []);
      const lead = Number(dk?.leader_unit_id);
      return { deckId: i + 1, ids: ids.includes(lead) ? [lead, ...ids.filter((x) => x !== lead)] : ids };
    });
  if (equipes.length === 0) return { decks: [], error: e.sansOffenseDimension };
  if (!saison) return { decks: [], error: e.offenseDimensionSansSaison };
  const decks = decksDimension(equipes, saison);
  return decks.length ? { decks } : { decks: [], error: e.offenseDimensionInconnue };
}

// Import des ÉQUIPES D'ATTAQUE d'arène.
export function parseArenaOffense(src: AccountSource, t: Dictionnaire): SiegeParseResult {
  const e = t.importCompte;
  const data = parseAccountSource(src);
  if (!data) return { decks: [], error: e.illisible };
  if (!Array.isArray(data?.unit_list)) return { decks: [], error: e.pasDeUnitList };
  const deckList = Array.isArray(data?.deck_list) ? data.deck_list : [];
  const offense = deckList.filter((dk: any) => Number(dk?.deck_type) === ARENA_OFFENSE_DECK_TYPE);
  if (offense.length === 0) return { decks: [], error: e.sansOffenseArene };
  const defs = offense.map((dk: any, i: number) => deckEnregistre(dk, i, SLOTS_ARENE));
  const decks = buildSiegeDecks(defs, indexRunes(data), indexUnits(data), indexArtifacts(data), indexRuneMarkers(data), SLOTS_ARENE);
  return decks.length ? { decks } : { decks: [], error: e.offenseAreneVide };
}

/* --------------------------------------------------------------------------
 * Import de TOUS LES DECKS ENREGISTRÉS (`deck_list`), contenu par contenu
 *
 * Le jeu enregistre dans `deck_list` les équipes de chaque contenu : arène,
 * siège, guerre de guilde, donjons, ToA, labyrinthe… Un deck porte son
 * contenu (`deck_type`), son numéro (`deck_seq`), son leader et le preset de
 * runes et d'artéfacts de chaque monstre (`equip`, parfois absent : le
 * monstre combat alors avec ce qu'il porte).
 *
 * ⚠️ Le fichier ne NOMME pas les contenus : la table `CONTENUS_DECK` vient de
 * relevés. Un `deck_type` absent de la table n'est jamais écarté : il sort en
 * `autre`, avec son numéro, pour que l'écran le montre tel quel.
 *
 * ⚠️ `unit_id_list` a TOUJOURS 8 cases, 0 pour une case vide (relevé sur deux
 * exports réels, 131 et 133 decks). Les monstres d'un raid y sont placés sur
 * la grille du combat (cases 1, 2, 4, 5, 6, 7) : on ne garde que l'ordre,
 * leader en tête, comme pour les autres decks.
 *
 * ⚠️ Sur certains contenus, `deck_seq` vaut `catégorie × 100 + emplacement`
 * (101, 201, 202…, 1001) : relevé sur les `deck_type` 24 à 27 de deux
 * exports. `categorie` le décompose ; elle est null sous 100.
 * ----------------------------------------------------------------------- */

// Les contenus identifiés. La clé d'un contenu est stable (elle part dans les
// imports de l'écran) ; son libellé vit dans le dictionnaire.
export type ContenuDeck =
  | 'arene-offense'
  | 'guerre-guilde-offense'
  | 'raid-mondes'
  | 'labyrinthe-normal'
  | 'labyrinthe-sauvetage'
  | 'labyrinthe-temps-limite'
  | 'labyrinthe-boss'
  | 'labyrinthe-temps-pause'
  | 'labyrinthe-vitesse-limitee'
  | 'labyrinthe-explosion'
  | 'tribunal-ascension'
  | 'tour-eau'
  | 'tour-feu'
  | 'tour-vent'
  | 'tour-lumiere'
  | 'tour-tenebres'
  | 'tour-celeste'
  | 'raid-dimensionnel-1'
  | 'raid-dimensionnel-2'
  | 'raid-dimensionnel-3'
  | 'siege-offense'
  | 'temple-chaos'
  | 'cairos'
  | 'faille-mondes'
  | 'passage-dimensions'
  | 'subjugation'
  | 'autre';

// `deck_type` → contenu. Seuls les types relevés figurent ici : 1 et 22 sur
// des exports réels, les autres nommés par l'utilisateur d'après ses decks en
// jeu (2026-11-18 et 2026-11-21).
export const CONTENUS_DECK: Readonly<Record<number, ContenuDeck>> = {
  [ARENA_OFFENSE_DECK_TYPE]: 'arene-offense',
  2: 'guerre-guilde-offense',
  3: 'raid-mondes',
  4: 'labyrinthe-normal',
  5: 'labyrinthe-sauvetage',
  6: 'tribunal-ascension',
  7: 'labyrinthe-vitesse-limitee',
  8: 'labyrinthe-temps-limite',
  9: 'labyrinthe-temps-pause',
  10: 'labyrinthe-explosion',
  11: 'labyrinthe-boss',
  12: 'tour-eau',
  13: 'tour-feu',
  14: 'tour-vent',
  15: 'tour-lumiere',
  16: 'tour-tenebres',
  17: 'tour-celeste',
  19: 'raid-dimensionnel-1',
  20: 'raid-dimensionnel-2',
  21: 'raid-dimensionnel-3',
  [SIEGE_OFFENSE_DECK_TYPE]: 'siege-offense',
  23: 'temple-chaos',
  24: 'cairos',
  25: 'faille-mondes',
  26: 'passage-dimensions',
  27: 'subjugation',
};

export function contenuDuDeckType(deckType: number): ContenuDeck {
  return CONTENUS_DECK[deckType] ?? 'autre';
}

// Les contenus à sous-catégories : la catégorie de `deck_seq` (centaines)
// désigne un donjon ou une variante. Nommées par l'utilisateur ; une catégorie
// absente de la table sort en null, avec son numéro dans `categorie`.
export type SousContenuDeck =
  | 'castel-geant'
  | 'taniere-dragon'
  | 'necropolis'
  | 'royaume-spirituel'
  | 'forteresse-acier'
  | 'crypte-jugement'
  | 'bete-glace'
  | 'bete-enflammee'
  | 'bete-orage'
  | 'bete-radiance'
  | 'bete-marecage'
  | 'foret-fauves-rugissants'
  | 'sanctuaire-fees-reveuses'
  | 'falaise-hommes-betes'
  | 'ruines-mort-silencieuse'
  | 'chateau-heros-oublies'
  | 'terre-infernale-embrasee'
  | 'subjugation-eau'
  | 'subjugation-feu'
  | 'subjugation-vent'
  | 'subjugation-boss';

export const SOUS_CONTENUS_DECK: Readonly<Partial<Record<ContenuDeck, Readonly<Record<number, SousContenuDeck>>>>> = {
  cairos: {
    1: 'castel-geant',
    2: 'taniere-dragon',
    3: 'necropolis',
    4: 'royaume-spirituel',
    5: 'forteresse-acier',
    6: 'crypte-jugement',
  },
  'faille-mondes': { 1: 'bete-glace', 2: 'bete-enflammee', 3: 'bete-orage', 4: 'bete-radiance', 5: 'bete-marecage' },
  'passage-dimensions': {
    1: 'foret-fauves-rugissants',
    2: 'sanctuaire-fees-reveuses',
    3: 'falaise-hommes-betes',
    4: 'ruines-mort-silencieuse',
    5: 'chateau-heros-oublies',
    6: 'terre-infernale-embrasee',
  },
  subjugation: { 1: 'subjugation-eau', 2: 'subjugation-feu', 3: 'subjugation-vent', 10: 'subjugation-boss' },
};

export function sousContenuDuDeck(contenu: ContenuDeck, categorie: number | null): SousContenuDeck | null {
  return categorie === null ? null : (SOUS_CONTENUS_DECK[contenu]?.[categorie] ?? null);
}

// `deck_seq` → catégorie et emplacement, quand le numéro est en centaines.
export function decomposerDeckSeq(seq: number): { categorie: number | null; emplacement: number } {
  if (!Number.isInteger(seq) || seq < 100) return { categorie: null, emplacement: seq };
  return { categorie: Math.floor(seq / 100), emplacement: seq % 100 };
}

export interface DeckEnregistreImporte extends SiegeImportedDeck {
  deckType: number;
  contenu: ContenuDeck;
  sousContenu: SousContenuDeck | null;
  categorie: number | null;
  emplacement: number;
}

// Le plus grand deck enregistré : 6 monstres (raid, faille).
const SLOTS_DECK_MAX = 6;

// Tous les decks enregistrés, dans l'ordre du fichier. Un deck sans aucun
// monstre connu de la box est écarté (jamais configuré, ou monstres vendus).
// Chaque deck a autant de places que de monstres, leader en tête.
export function parseDecksEnregistres(src: AccountSource): DeckEnregistreImporte[] {
  const data = parseAccountSource(src);
  if (!data || !Array.isArray(data?.unit_list) || !Array.isArray(data?.deck_list)) return [];
  const runeById = indexRunes(data);
  const unitById = indexUnits(data);
  const artById = indexArtifacts(data);
  const markers = indexRuneMarkers(data);
  const out: DeckEnregistreImporte[] = [];
  data.deck_list.forEach((dk: any, i: number) => {
    const deckType = Number(dk?.deck_type);
    if (!Number.isFinite(deckType)) return;
    const brut = deckEnregistre(dk, i, SLOTS_DECK_MAX);
    const places = brut.unitIds.filter((id) => Number(id) !== 0).length;
    const [deck] = buildSiegeDecks(
      [{ ...brut, unitIds: brut.unitIds.slice(0, places) }],
      runeById,
      unitById,
      artById,
      markers,
      places
    );
    if (!deck) return;
    const seq = Number(dk?.deck_seq);
    const contenu = contenuDuDeckType(deckType);
    const numero = decomposerDeckSeq(Number.isFinite(seq) ? seq : i);
    out.push({ ...deck, deckType, contenu, sousContenu: sousContenuDuDeck(contenu, numero.categorie), ...numero });
  });
  return out;
}
