// Le compte EN DIRECT : « Mon compte » pendant la partie, lu dans le fichier
// live du plugin SWEX (`compte.live.jsonl`, voir
// docs/02-app/bureau/feat-swex-direct.md). Application de bureau seulement :
// bureau/swex.ts lit le fichier et donne ses lignes à la page.
//
// ⚠️ **Seul ce qui est touché change.** Le premier envoi (`debut`) donne le
// fichier entier ; les suivants, les seules lignes ajoutées — une meule, une
// vente : quelques centaines d'octets. Chaque objet converti est retenu par
// son objet brut : une rune que la ligne ne touche pas garde le MÊME détail,
// et une liste qu'elle ne touche pas garde le MÊME tableau. Les écrans qui en
// dépendent (React, `useMemo`) ne recalculent rien pour elle.
//
// ⚠️ **Le résultat est celui de l'import.** L'état est tenu par le moteur du
// plugin lui-même (`poserChangement`), et chaque objet est converti par les
// fonctions de l'import (`runeToDetail`, `boxMonsterOf`…) dans l'ordre où
// l'import les lirait dans `versExport` : tests/compte-direct.test.ts compare
// les deux à chaque ligne.
//
// Le compte en direct n'est jamais enregistré : le fichier live l'est déjà, et
// se relit au lancement. « Mettre à jour » (page SW Exporter) le reporte sur le
// compte de l'app, comme un nouvel export.

import {
  REGISTRES,
  depuisLignesLive,
  poserChangement,
  versExport,
  type Changement,
  type EtatDirect,
  type Json,
  type NomRegistre,
} from '../../plugin-swex/source/etatDirect';
import type { ArtifactDetail, CraftLine, RuneDetail } from '../types';
import {
  artifactToDetail,
  boxMonsterOf,
  craftLineOf,
  indexRuneMarkers,
  parseAccountWizardName,
  parseRuneMarkerLabels,
  parseUsedRuneIdsParPerimetre,
  runeToDetail,
  type BoxMonster,
  type RunesUtilisees,
} from './importAccount';

export interface CompteDirect {
  wizardId: number;
  nom: string | null;
  // Heure serveur (secondes) du dernier changement : la fraîcheur.
  t: number | null;
  box: BoxMonster[];
  runes: RuneDetail[];
  artifacts: ArtifactDetail[];
  crafts: CraftLine[];
  usedRuneIds: RunesUtilisees;
  runeMarkerLabels: Record<number, string>;
}

// Ce qu'une ligne a touché : les registres, et s'il faut recalculer les runes
// utilisées (une rune a changé de porteur, un monstre est arrivé ou parti).
interface Touche {
  registres: Set<NomRegistre>;
  occupation: boolean;
}

const porteur = (r: Json | undefined) => (r && Number(r.occupied_type) === 1 ? Number(r.occupied_id) : 0);

// Le suivi : il garde l'état et ses conversions d'une ligne à l'autre.
// `recevoir` rend le compte, ou `null` si les lignes ne font pas un fichier
// live lisible (format inconnu, pas de connexion en tête).
export function creerSuiviDirect() {
  let etat: EtatDirect | null = null;
  let vue: CompteDirect | null = null;
  let marqueurs: ReadonlyMap<number, number> = new Map();
  const runes = new WeakMap<Json, RuneDetail>();
  const artefacts = new WeakMap<Json, ArtifactDetail>();
  const crafts = new WeakMap<Json, CraftLine | null>();
  // Un monstre se reconvertit si l'unité, ou l'une des runes ou des artéfacts
  // qu'elle porte, n'est plus le même objet.
  const monstres = new WeakMap<Json, { runes: Json[]; artefacts: Json[]; monstre: BoxMonster | null }>();

  const memo = <T>(cache: WeakMap<Json, T>, o: Json, faire: (o: Json) => T): T => {
    if (cache.has(o)) return cache.get(o) as T;
    const fait = faire(o);
    cache.set(o, fait);
    return fait;
  };
  const memes = (a: Json[], b: Json[]) => a.length === b.length && a.every((x, i) => x === b[i]);

  // Les runes et artéfacts portés, par monstre, dans l'ordre de `versExport`.
  function rangement(e: EtatDirect) {
    const portees = new Map<number, { runes: Json[]; artefacts: Json[] }>();
    for (const id of e.unites.keys()) portees.set(id, { runes: [], artefacts: [] });
    const runesInventaire: Json[] = [];
    for (const r of e.runes.values()) {
      const p = portees.get(porteur(r));
      if (p) p.runes.push(r);
      else runesInventaire.push(r);
    }
    const artefactsInventaire: Json[] = [];
    for (const a of e.artefacts.values()) {
      const p = Number(a.occupied_id) ? portees.get(Number(a.occupied_id)) : undefined;
      if (p) p.artefacts.push(a);
      else artefactsInventaire.push(a);
    }
    for (const p of portees.values()) {
      p.runes.sort((a, b) => a.slot_no - b.slot_no);
      p.artefacts.sort((a, b) => a.slot - b.slot);
    }
    return { portees, runesInventaire, artefactsInventaire };
  }

  function calculer(e: EtatDirect, touche: Touche | null) {
    const tout = touche === null || vue === null;
    const a = (nom: NomRegistre) => tout || touche!.registres.has(nom);
    // Le rangement dépend des runes, des artéfacts et des monstres.
    const range = tout || a('runes') || a('artefacts') || a('unites') ? rangement(e) : null;

    let listeRunes = vue?.runes ?? [];
    if (range && (a('runes') || a('unites'))) {
      // L'ordre de l'import : l'inventaire, puis chaque monstre (indexRunes).
      listeRunes = [...range.runesInventaire, ...[...range.portees.values()].flatMap((p) => p.runes)]
        .map((r) => memo(runes, r, (o) => runeToDetail(o, marqueurs)))
        .filter((r) => r.main.code !== 0);
    }
    let listeArtefacts = vue?.artifacts ?? [];
    if (range && (a('artefacts') || a('unites'))) {
      listeArtefacts = [...range.artefactsInventaire, ...[...range.portees.values()].flatMap((p) => p.artefacts)]
        .map((x) => memo(artefacts, x, artifactToDetail))
        .filter((x) => x.main.code !== 0);
    }
    let listeCrafts = vue?.crafts ?? [];
    if (a('crafts')) {
      listeCrafts = [...e.crafts.values()]
        .map((c) => memo(crafts, c, craftLineOf))
        .filter((c): c is CraftLine => c !== null);
    }
    let box = vue?.box ?? [];
    if (range) {
      // L'index des runes de l'import : toutes, portées ou non.
      const parId = new Map<number, Json>();
      for (const r of e.runes.values()) parId.set(Number(r.rune_id), r);
      const suivante: BoxMonster[] = [];
      let change = tout;
      let n = 0;
      for (const u of e.unites.values()) {
        const p = range.portees.get(u.unit_id)!;
        const connu = monstres.get(u);
        let monstre: BoxMonster | null;
        if (connu && memes(connu.runes, p.runes) && memes(connu.artefacts, p.artefacts)) monstre = connu.monstre;
        else {
          monstre = boxMonsterOf({ ...u, runes: p.runes, artifacts: p.artefacts }, parId, marqueurs);
          monstres.set(u, { runes: p.runes, artefacts: p.artefacts, monstre });
        }
        if (!monstre) continue;
        if (box[n] !== monstre) change = true;
        suivante.push(monstre);
        n++;
      }
      if (change || suivante.length !== box.length) box = suivante;
    }
    // ⚠️ Recalculées sur le compte entier (les decks sans préréglage jouent
    // avec les runes portées) : seulement quand une rune change de porteur,
    // jamais pour une meule.
    const usedRuneIds =
      tout || touche!.occupation ? parseUsedRuneIdsParPerimetre(versExport(e)) : vue!.usedRuneIds;

    vue = {
      wizardId: e.wizardId,
      nom: vue && !tout ? vue.nom : parseAccountWizardName(e.connexion),
      t: e.tvalue,
      box,
      runes: listeRunes,
      artifacts: listeArtefacts,
      crafts: listeCrafts,
      usedRuneIds,
      runeMarkerLabels: vue && !tout ? vue.runeMarkerLabels : parseRuneMarkerLabels(e.connexion),
    };
    return vue;
  }

  // Pose une ligne `changement` en notant ce qu'elle touche.
  function poser(e: EtatDirect, c: Changement, touche: Touche) {
    for (const nom of REGISTRES) {
      if (c.maj?.[nom]?.length || c.retires?.[nom]?.length) touche.registres.add(nom);
    }
    if (c.retires?.runes?.length || c.retires?.unites?.length) touche.occupation = true;
    for (const u of c.maj?.unites ?? []) if (!e.unites.has(Number(u.unit_id))) touche.occupation = true;
    for (const r of c.maj?.runes ?? []) if (porteur(e.runes.get(Number(r.rune_id))) !== porteur(r)) touche.occupation = true;
    poserChangement(e, c);
  }

  return {
    // `debut` : les lignes sont le fichier entier (première lecture, ou
    // nouvelle connexion) ; sinon, celles qui s'y sont ajoutées.
    recevoir(lignes: string[], debut: boolean): CompteDirect | null {
      if (debut || !etat) {
        etat = debut ? depuisLignesLive(lignes) : null;
        vue = null;
        if (!etat) return null;
        marqueurs = indexRuneMarkers(etat.connexion);
        return calculer(etat, null);
      }
      const touche: Touche = { registres: new Set(), occupation: false };
      for (const texte of lignes) {
        if (!texte.trim()) continue;
        let ligne: Json;
        try {
          ligne = JSON.parse(texte);
        } catch {
          break; // ligne abîmée : ce qui précède vaut, comme à la relecture
        }
        if (ligne.type === 'changement') poser(etat, ligne as Changement, touche);
      }
      if (!touche.registres.size) return vue;
      return calculer(etat, touche);
    },
    compte: () => vue,
  };
}
