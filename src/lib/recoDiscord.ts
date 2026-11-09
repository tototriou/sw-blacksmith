// Recommandations liées à un salon Discord : leur état, la synchronisation
// avec les salons, et la fusion à trois voies d'une version arrivée sur une
// copie modifiée. Calcul pur, testé (tests/reco-discord.test.ts).
// Le modèle et ses raisons : docs/04-decisions/adr/un-salon-une-reco.md ; la
// fiche : docs/02-app/siege/feat-recommandations/synchronisation-discord.md.

import { emptyRecoDeck, type LienDiscord, type Reco, type RecoDeck, type RecoPayload, type VersionSalon } from '../types';
import { cleEquipe, type MonstresConnus } from './recoDefenses';
import { empreinteContenu, empreinteDeck } from './recoShare';

export type VersionValide = VersionSalon & { reco: RecoPayload };
export type EtatLien = 'a-jour' | 'modifiee' | 'conflit';

// Un salon que le membre peut lire, tel que le service le donne.
export interface SalonAccessible {
  serveurId: string;
  salonId: string;
  nomServeur: string;
  nomSalon: string;
  ecrire: boolean;
}

export const estValide = (v: VersionSalon | null | undefined): v is VersionValide => !!v && !!v.reco;

/* --------------------------------------------------------------------------
 * État d'une recommandation liée
 * ----------------------------------------------------------------------- */

// Modifiée : son contenu (nom, consignes, decks) diffère de la dernière
// version reçue. Comparé sous la forme normalisée de l'export, jamais champ à
// champ : une copie relue du stockage et la même version décodée d'un fichier
// doivent se reconnaître.
export function estModifiee(r: Reco): boolean {
  return !!r.lien && empreinteContenu(r) !== empreinteContenu(r.lien.base.reco);
}

export function etatLien(r: Reco): EtatLien | null {
  if (!r.lien) return null;
  if (r.lien.enAttente) return 'conflit';
  return estModifiee(r) ? 'modifiee' : 'a-jour';
}

/* --------------------------------------------------------------------------
 * Transitions
 * ----------------------------------------------------------------------- */

// Le contenu d'une version, posé sur une recommandation qui garde son id, son
// origine et son lien. Auteur, contributeurs et source viennent du salon.
function avecContenu(r: Reco, v: RecoPayload, lien: LienDiscord | undefined): Reco {
  const c = structuredClone(v);
  return {
    id: r.id,
    origin: r.origin,
    name: c.name,
    author: c.author,
    note: c.note,
    decks: c.decks.length ? c.decks : [emptyRecoDeck()],
    ...(c.source ? { source: c.source } : {}),
    ...(c.contributeurs ? { contributeurs: c.contributeurs } : {}),
    ...(lien ? { lien } : {}),
  };
}

function sansAttente(lien: LienDiscord): LienDiscord {
  const { enAttente: _, ...reste } = lien;
  return reste;
}

// La recommandation liée qui apparaît pour un salon : importée, à jour.
export function recoLiee(salon: SalonAccessible, v: VersionValide, newId: () => string): Reco {
  const lien: LienDiscord = { ...salon, base: structuredClone(v) };
  return avecContenu({ id: newId(), origin: 'imported', name: '', author: '', note: '', decks: [] }, v.reco, lien);
}

// Une version lue dans le salon :
// - rien de nouveau (même message que la base ou que l'attente, ou version
//   illisible) : seuls le droit d'écrire et les noms se mettent à jour ;
// - copie non modifiée : la version la remplace (la dernière fait foi) ;
// - copie modifiée : conflit, la version attend la fusion. Rien n'est écrasé.
export function recevoirVersion(r: Reco, salon: SalonAccessible, v: VersionSalon | null): Reco {
  if (!r.lien) return r;
  const lien: LienDiscord = { ...r.lien, nomServeur: salon.nomServeur, nomSalon: salon.nomSalon, ecrire: salon.ecrire };
  if (!estValide(v) || v.messageId === lien.base.messageId || v.messageId === lien.enAttente?.messageId) return { ...r, lien };
  if (!estModifiee(r)) return avecContenu(r, v.reco, { ...sansAttente(lien), base: structuredClone(v) });
  return { ...r, lien: { ...lien, enAttente: structuredClone(v) } };
}

// Rompre le lien : la recommandation devient locale, pour ce membre seul.
export function delier(r: Reco): Reco {
  const { lien: _, ...reste } = r;
  return reste;
}

// Après une publication réussie : la version publiée (auteur et contributeurs
// écrits par le service) devient le contenu et la base.
export function apresPublication(r: Reco, v: VersionValide): Reco {
  if (!r.lien) return r;
  return avecContenu(r, v.reco, { ...sansAttente(r.lien), base: structuredClone(v) });
}

// La publication refusée parce que le salon a changé (409) : la version
// courante attend la fusion. Illisible, elle ne peut pas se fusionner : elle
// devient seulement la base à citer, et la copie se republie telle quelle.
export function apresConflit(r: Reco, v: VersionSalon | null): Reco {
  if (!r.lien || !v) return r;
  if (!estValide(v)) return { ...r, lien: { ...r.lien, base: { ...r.lien.base, messageId: v.messageId, date: v.date } } };
  return { ...r, lien: { ...r.lien, enAttente: structuredClone(v) } };
}

export interface BilanSynchro {
  ajoutees: number; // nouveaux salons : une recommandation liée de plus
  misesAJour: number; // copie non modifiée remplacée par une version plus récente
  conflits: number; // version arrivée sur une copie modifiée
  retirees: number; // accès perdu, rien de non publié : retirée de l'appareil
  detachees: number; // accès perdu avec des modifications : devenue locale
}

// Les recommandations après une lecture des salons. `salons` : ceux que le
// membre peut lire ; `versions` : la version courante lue pour chacun.
// ⚠️ Un salon absent de `salons` est un accès perdu : sa recommandation est
// retirée de l'appareil, sauf des modifications non publiées, qui restent en
// recommandation locale. Un salon sans version valide n'en crée aucune.
export function synchroniser(
  recos: Reco[],
  salons: SalonAccessible[],
  versions: ReadonlyMap<string, VersionSalon | null>,
  newId: () => string,
): { recos: Reco[]; bilan: BilanSynchro } {
  const bilan: BilanSynchro = { ajoutees: 0, misesAJour: 0, conflits: 0, retirees: 0, detachees: 0 };
  const parSalon = new Map(salons.map((s) => [s.salonId, s]));
  const lies = new Set<string>();
  const out: Reco[] = [];
  for (const r of recos) {
    if (!r.lien) {
      out.push(r);
      continue;
    }
    const salon = parSalon.get(r.lien.salonId);
    // Un second lien vers le même salon se traite comme un accès perdu : un
    // salon ne porte qu'une recommandation.
    if (!salon || lies.has(salon.salonId)) {
      if (estModifiee(r) || r.lien.enAttente) {
        out.push(delier(r));
        bilan.detachees++;
      } else bilan.retirees++;
      continue;
    }
    lies.add(salon.salonId);
    const apres = recevoirVersion(r, salon, versions.get(salon.salonId) ?? null);
    if (apres.lien?.base.messageId !== r.lien.base.messageId) bilan.misesAJour++;
    if (apres.lien?.enAttente && apres.lien.enAttente.messageId !== r.lien.enAttente?.messageId) bilan.conflits++;
    out.push(apres);
  }
  for (const salon of salons) {
    const v = versions.get(salon.salonId);
    if (!lies.has(salon.salonId) && estValide(v)) {
      out.push(recoLiee(salon, v, newId));
      bilan.ajoutees++;
    }
  }
  return { recos: out, bilan };
}

/* --------------------------------------------------------------------------
 * Fusion à trois voies
 * ----------------------------------------------------------------------- */

// Un élément de la fusion : un deck (reconnu par son équipe) ou un texte (nom,
// consignes). `resolu` : ce que la fusion retient d'office ; absent, les deux
// côtés l'ont changé différemment et le membre choisit.
export interface ElementDeck { cle: string; mien: RecoDeck | null; leur: RecoDeck | null; resolu?: RecoDeck | null }
export interface ElementTexte { mien: string; leur: string; resolu?: string }
export interface Fusion { nom: ElementTexte; consignes: ElementTexte; decks: ElementDeck[] }

export type ChoixDeck = 'mien' | 'leur' | 'les-deux';
export interface ChoixFusion { nom?: 'mien' | 'leur'; consignes?: 'mien' | 'leur'; decks: Record<string, ChoixDeck> }

// Un deck se reconnaît par son ÉQUIPE (`cleEquipe`, la clé de la fusion des
// imports et de la vue Défense) : changer un monstre en fait un autre deck.
// Deux decks de la même équipe dans une recommandation se distinguent par leur
// rang (#0, #1…). Un deck sans monstre n'a pas d'équipe : « vide ».
function parEquipe(decks: RecoDeck[], connus: MonstresConnus): Map<string, RecoDeck> {
  const rangs = new Map<string, number>();
  const out = new Map<string, RecoDeck>();
  for (const d of decks) {
    const equipe = cleEquipe(d.slots, connus) ?? 'vide';
    const rang = rangs.get(equipe) ?? 0;
    rangs.set(equipe, rang + 1);
    out.set(`${equipe}#${rang}`, d);
  }
  return out;
}

function trois<T>(b: T, m: T, l: T, egal: (x: T, y: T) => boolean): T | undefined {
  if (egal(m, l)) return m;
  if (egal(m, b)) return l;
  if (egal(l, b)) return m;
  return undefined;
}

const empreinte = (d: RecoDeck | null) => (d ? empreinteDeck(d) : '∅');
const memeDeck = (x: RecoDeck | null, y: RecoDeck | null) => empreinte(x) === empreinte(y);

// Ce qui n'a changé que d'un côté passe seul (y compris un deck retiré) ; ce
// qui a changé des deux côtés, différemment, attend le choix du membre.
export function fusionner(base: RecoPayload, mien: Pick<Reco, 'name' | 'note' | 'decks'>, leur: RecoPayload, connus: MonstresConnus): Fusion {
  const texte = (b: string, m: string, l: string): ElementTexte => {
    const r = trois(b.trim(), m.trim(), l.trim(), (x, y) => x === y);
    return r === undefined ? { mien: m, leur: l } : { mien: m, leur: l, resolu: r === m.trim() ? m : l };
  };
  const b = parEquipe(base.decks, connus);
  const m = parEquipe(mien.decks, connus);
  const l = parEquipe(leur.decks, connus);
  // L'ordre du salon d'abord, puis les decks ajoutés de ce côté-ci.
  const cles = [...l.keys(), ...[...m.keys()].filter((k) => !l.has(k)), ...[...b.keys()].filter((k) => !l.has(k) && !m.has(k))];
  const decks = cles.map((cle): ElementDeck => {
    const md = m.get(cle) ?? null;
    const ld = l.get(cle) ?? null;
    const r = trois(b.get(cle) ?? null, md, ld, memeDeck);
    return r === undefined ? { cle, mien: md, leur: ld } : { cle, mien: md, leur: ld, resolu: r };
  });
  return { nom: texte(base.name, mien.name, leur.name), consignes: texte(base.note, mien.note, leur.note), decks };
}

// Ce qui reste à choisir.
export function aChoisir(f: Fusion): { nom: boolean; consignes: boolean; decks: string[] } {
  return { nom: f.nom.resolu === undefined, consignes: f.consignes.resolu === undefined, decks: f.decks.filter((d) => d.resolu === undefined).map((d) => d.cle) };
}

// La fusion de la version en attente d'une recommandation en conflit.
export function fusionEnAttente(r: Reco, connus: MonstresConnus): Fusion | null {
  return r.lien?.enAttente ? fusionner(r.lien.base.reco, r, r.lien.enAttente.reco, connus) : null;
}

// Le résultat d'une fusion, choix compris : la version en attente devient la
// base, la copie reste à publier. `null` tant qu'un choix manque.
export function appliquerFusion(r: Reco, f: Fusion, choix: ChoixFusion): Reco | null {
  const attente = r.lien?.enAttente;
  if (!r.lien || !attente) return null;
  const texte = (e: ElementTexte, c: 'mien' | 'leur' | undefined) => (e.resolu !== undefined ? e.resolu : c ? e[c] : undefined);
  const name = texte(f.nom, choix.nom);
  const note = texte(f.consignes, choix.consignes);
  if (name === undefined || note === undefined) return null;
  const decks: RecoDeck[] = [];
  for (const d of f.decks) {
    if (d.resolu !== undefined) {
      if (d.resolu) decks.push(structuredClone(d.resolu));
      continue;
    }
    const c = choix.decks[d.cle];
    if (!c) return null;
    if ((c === 'mien' || c === 'les-deux') && d.mien) decks.push(structuredClone(d.mien));
    if ((c === 'leur' || c === 'les-deux') && d.leur) decks.push(structuredClone(d.leur));
  }
  const lien = { ...sansAttente(r.lien), base: attente };
  return { ...avecContenu(r, attente.reco, lien), name, note, decks: decks.length ? decks : [emptyRecoDeck()] };
}

/* --------------------------------------------------------------------------
 * Favoris
 * ----------------------------------------------------------------------- */

// Les salons favoris d'abord, puis les autres ; chacun dans l'ordre reçu.
export function ordonnerSalons<T extends { salonId: string }>(salons: T[], favoris: readonly string[]): T[] {
  const f = new Set(favoris);
  return [...salons.filter((s) => f.has(s.salonId)), ...salons.filter((s) => !f.has(s.salonId))];
}

export function basculerFavori(favoris: readonly string[], salonId: string): string[] {
  return favoris.includes(salonId) ? favoris.filter((x) => x !== salonId) : [...favoris, salonId];
}

/* --------------------------------------------------------------------------
 * Relecture du stockage
 * ----------------------------------------------------------------------- */

const texte = (v: unknown): v is string => typeof v === 'string';

// Le lien relu du stockage local. Une forme inattendue le fait tomber : la
// recommandation reste, locale, et la synchronisation suivante recrée la
// recommandation liée de son salon.
export function lireLien(brut: unknown, lireReco: (r: unknown) => RecoPayload | null): LienDiscord | undefined {
  const l = brut as Partial<Record<keyof LienDiscord, unknown>> | null;
  if (!l || !texte(l.serveurId) || !texte(l.salonId) || !texte(l.nomServeur) || !texte(l.nomSalon) || typeof l.ecrire !== 'boolean') return undefined;
  const version = (v: unknown): VersionValide | undefined => {
    const x = v as Partial<Record<keyof VersionSalon, unknown>> | null;
    const reco = x && texte(x.messageId) && texte(x.date) ? lireReco(x.reco) : null;
    return reco && x ? { messageId: x.messageId as string, date: x.date as string, reco } : undefined;
  };
  const base = version(l.base);
  if (!base) return undefined;
  const enAttente = version(l.enAttente);
  return { serveurId: l.serveurId, salonId: l.salonId, nomServeur: l.nomServeur, nomSalon: l.nomSalon, ecrire: l.ecrire, base, ...(enAttente ? { enAttente } : {}) };
}
