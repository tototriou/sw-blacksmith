// Les provenances de la page Recommandations — « Toutes les recommandations »,
// « Sur cet appareil », puis un groupe par serveur Discord avec ses salons —,
// ce que chacune montre, l'état affiché d'un salon et ce qui empêche de
// publier. Calcul pur, testé (tests/provenances-recos.test.ts).
// L'écran : docs/02-app/siege/feat-recommandations/rendu-de-la-page.md.

import type { Reco } from '../types';
import { etatLien, estModifiee, ordonnerSalons, type BilanSynchro } from './recoDiscord';
import type { ServeurDuService } from './discordClient';

export type Provenance = { type: 'toutes' } | { type: 'appareil' } | { type: 'salon'; salonId: string };

export const TOUTES: Provenance = { type: 'toutes' };

export function memeProvenance(a: Provenance, b: Provenance): boolean {
  return a.type === b.type && (a.type !== 'salon' || a.salonId === (b as { salonId: string }).salonId);
}

// L'état qu'affiche un salon : le conflit d'abord, puis une copie modifiée,
// puis la lecture seule, enfin « à jour ».
export type EtatAffiche = 'conflit' | 'modifiee' | 'lecture-seule' | 'a-jour';

export function etatAffiche(r: Reco): EtatAffiche | null {
  const e = etatLien(r);
  if (!e || !r.lien) return null;
  if (e !== 'a-jour') return e;
  return r.lien.ecrire ? 'a-jour' : 'lecture-seule';
}

export interface LigneSalon { serveurId: string; salonId: string; nom: string; reco: Reco; etat: EtatAffiche; favori: boolean }
export interface GroupeServeur { serveurId: string; nom: string; botAdmin: boolean; salons: LigneSalon[] }

// Un groupe par serveur, une ligne par salon qui porte une recommandation liée
// — un salon sans recommandation valide n'en a pas, il ne paraît pas. Les
// serveurs dans l'ordre où le service les donne, puis ceux qu'on ne connaît
// plus que par leurs recommandations (hors connexion) ; dans un serveur, les
// favoris d'abord (application de bureau), puis l'ordre des recommandations.
export function groupesSalons(recos: Reco[], serveurs: ServeurDuService[] | null, favoris: readonly string[]): GroupeServeur[] {
  const groupes = new Map<string, GroupeServeur>();
  for (const s of serveurs ?? []) groupes.set(s.id, { serveurId: s.id, nom: s.nom, botAdmin: s.botAdmin, salons: [] });
  for (const r of recos) {
    const lien = r.lien;
    const etat = etatAffiche(r);
    if (!lien || !etat) continue;
    let g = groupes.get(lien.serveurId);
    if (!g) {
      g = { serveurId: lien.serveurId, nom: lien.nomServeur, botAdmin: false, salons: [] };
      groupes.set(lien.serveurId, g);
    }
    if (g.salons.some((l) => l.salonId === lien.salonId)) continue;
    g.salons.push({ serveurId: lien.serveurId, salonId: lien.salonId, nom: lien.nomSalon, reco: r, etat, favori: favoris.includes(lien.salonId) });
  }
  return [...groupes.values()]
    .map((g) => ({ ...g, salons: ordonnerSalons(g.salons, favoris) }))
    .filter((g) => g.salons.length > 0);
}

// Ce que montre une provenance. « Toutes » : celles de cet appareil, puis
// celles des salons, dans l'ordre de la colonne (décision du 2026-11-09).
export function recosDeProvenance(recos: Reco[], p: Provenance, groupes: GroupeServeur[]): Reco[] {
  const locales = recos.filter((r) => !r.lien);
  const liees = groupes.flatMap((g) => g.salons.map((l) => l.reco));
  if (p.type === 'appareil') return locales;
  if (p.type === 'salon') return liees.filter((r) => r.lien?.salonId === p.salonId);
  return [...locales, ...liees];
}

// Une provenance qui n'existe plus (salon retiré, déconnexion) retombe sur
// « Toutes les recommandations ».
export function provenanceValide(p: Provenance, groupes: GroupeServeur[]): Provenance {
  if (p.type !== 'salon') return p;
  return groupes.some((g) => g.salons.some((l) => l.salonId === p.salonId)) ? p : TOUTES;
}

// Pourquoi « Publier » est désactivé, ou `null` s'il est permis. En conflit,
// le bouton devient « Fusionner » : ce n'est pas une raison de refus.
export type RaisonPublier = 'non-connecte' | 'a-jour' | 'lecture-seule';
export function raisonPublier(r: Reco, connecte: boolean): RaisonPublier | null {
  if (!r.lien) return null;
  if (!connecte) return 'non-connecte';
  if (!r.lien.ecrire) return 'lecture-seule';
  if (!r.lien.enAttente && !estModifiee(r)) return 'a-jour';
  return null;
}

// Un salon proposé par « Publier dans… » : tous ceux que le membre peut lire,
// avec ce qu'il porte déjà ; ceux où il ne peut pas écrire restent visibles,
// désactivés.
export interface SalonDePublication { serveurId: string; salonId: string; nomServeur: string; nomSalon: string; ecrire: boolean; porte: string | null }

export function salonsDePublication(serveurs: ServeurDuService[], recos: Reco[]): SalonDePublication[] {
  return serveurs.flatMap((g) => g.salons.map((c) => {
    const liee = recos.find((r) => r.lien?.salonId === c.id);
    return { serveurId: g.id, salonId: c.id, nomServeur: g.nom, nomSalon: c.nom, ecrire: c.ecrire, porte: liee ? liee.name : null };
  }));
}

// Rien de neuf : pas de notification.
export function bilanVide(b: BilanSynchro): boolean {
  return !b.ajoutees && !b.misesAJour && !b.conflits && !b.retirees && !b.detachees;
}
