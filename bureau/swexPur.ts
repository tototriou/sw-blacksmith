// Le dossier SW Exporter — ce qui se décide sans toucher au disque (pur, testé
// par tests/bureau-swex.test.ts). Le disque et la
// surveillance : bureau/swex.ts.

// Un export de compte, tel que SW Exporter le nomme à la RACINE de son
// dossier : `<invocateur>-<identifiant>.json` (`tototriou-12889591.json`). Le
// nom peut contenir des tirets, des emojis, un `~` : l'identifiant est le
// DERNIER groupe de chiffres. Tout le reste (sous-dossiers `live`, `plugins`, `cert`,
// un `.json` sans identifiant) n'est pas un export de compte.
export interface ExportCompte {
  fichier: string;
  nom: string;
  id: string;
}

export function lireNomExport(fichier: string): ExportCompte | null {
  const m = /^(.+)-(\d+)\.json$/i.exec(fichier);
  if (!m || !m[1].trim()) return null;
  return { fichier, nom: m[1], id: m[2] };
}

// Les exports d'une liste de fichiers (la racine du dossier), triés par nom.
export function exportsDuDossier(fichiers: string[]): ExportCompte[] {
  return fichiers
    .map(lireNomExport)
    .filter((e): e is ExportCompte => e !== null)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.id.localeCompare(b.id));
}

// Le réglage retenu (`swex.json`, dossier des données de l'app), relu avec
// méfiance : un fichier abîmé ne doit ni planter l'app ni inventer un chemin.
export interface ReglageSwex {
  dossier: string | null;
  fichier: string | null;
  // Date de modification (ms) du dernier export APPLIQUÉ par la page.
  dernierLu: number | null;
  // Heure serveur (`tvalue`) de la dernière saison de l'arène dimensionnelle
  // APPLIQUÉE par la page, lue dans le journal SWEX (journalSwexDisque.ts).
  dimensionLue: number | null;
  // « Direct » : « Mon compte » suit le fichier live du plugin. Coupé par
  // défaut, retenu comme le dossier.
  direct: boolean;
}

export function lireReglage(brut: unknown): ReglageSwex {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const fichier = texte(o.fichier);
  return {
    dossier: texte(o.dossier),
    // ⚠️ Un nom de fichier, jamais un chemin : il se joint au dossier.
    fichier: fichier && lireNomExport(fichier) && !/[\\/]/.test(fichier) ? fichier : null,
    dernierLu: nombre(o.dernierLu),
    dimensionLue: nombre(o.dimensionLue),
    direct: o.direct === true,
  };
}

// ── Le direct : le plugin SWEX « SW Blacksmith Live » ────────────────────
//
// Le plugin écrit, pour chaque invocateur, `SWBlacksmith/<nom>-<id>/` dans le
// dossier de SWEX (plugin-swex/source/fichiers.ts). Le lien avec l'export est
// l'IDENTIFIANT : le nom du dossier vient de l'export, ou du pseudo s'il n'y
// en avait pas.

export const DOSSIER_PLUGIN = 'SWBlacksmith';
export const COMPTE_LIVE = 'compte.live.jsonl';

// Le dossier d'un invocateur : parmi ceux dont le nom finit par `-<id>`, celui
// dont le fichier live est le plus récent (`modifie`, `null` : pas de fichier
// live). Le pseudo peut avoir changé entre deux connexions.
export function dossierDeLInvocateur(dossiers: { nom: string; modifie: number | null }[], id: string): string | null {
  let choisi: { nom: string; modifie: number } | null = null;
  for (const d of dossiers) {
    if (d.modifie === null || !d.nom.endsWith(`-${id}`) || !d.nom.slice(0, -id.length - 1)) continue;
    if (!choisi || d.modifie > choisi.modifie) choisi = { nom: d.nom, modifie: d.modifie };
  }
  return choisi?.nom ?? null;
}

// L'en-tête d'un fichier live, lu dans ses premiers octets : la première ligne
// (la connexion, l'export entier) pèse plusieurs Mo, et ses premières clés
// sont écrites dans cet ordre (`ligneConnexion`).
export function enteteLive(debut: string): { wizardId: number; t: number | null; plugin: string } | null {
  const m = /^\{"type":"connexion","format":"swblacksmith\/compte-live","version":1,"wizard_id":(\d+),"t":(\d+|null),"plugin":"([^"]*)"/.exec(debut);
  if (!m) return null;
  return { wizardId: Number(m[1]), t: m[2] === 'null' ? null : Number(m[2]), plugin: m[3] };
}

// Le fichier live est-il celui de la DERNIÈRE connexion ? Sa connexion (heure
// serveur) n'est pas plus ancienne que l'export : SWEX et le plugin écrivent
// tous deux à la connexion. Plus ancienne, le plugin ne tournait pas à la
// dernière connexion (retiré, désactivé) : le compte du fichier est périmé.
export function liveAJour(tLive: number | null, tExport: number | null): boolean {
  if (tLive === null) return false;
  return tExport === null || tLive >= tExport;
}

// La version écrite en tête du plugin (bannière de
// scripts/lib/construirePluginSwex.mjs).
export function versionDuPlugin(debut: string): string | null {
  return /^\/\/ SW Blacksmith Live (\d+(?:\.\d+)*)\b/.exec(debut)?.[1] ?? null;
}

// Compare deux versions `x.y.z` nombre par nombre : < 0, 0 ou > 0.
export function comparerVersions(a: string, b: string): number {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d;
  }
  return 0;
}

// Le plugin installé, comparé à l'app : il porte la version de l'app qui l'a
// construit, et l'app sert le sien (la dernière version qu'elle connaît).
export type StatutPlugin = 'absent' | 'a-jour' | 'ancien' | 'plus-recent';
export function statutPlugin(installee: string | null, app: string): StatutPlugin {
  if (!installee) return 'absent';
  const d = comparerVersions(installee, app);
  return d === 0 ? 'a-jour' : d < 0 ? 'ancien' : 'plus-recent';
}

// Une saison de l'arène dimensionnelle est-elle à donner à la page ? Celle
// d'une heure serveur (`tvalue`) postérieure à la dernière appliquée — ou
// toute saison, si la page n'a rien de ce mode (`pageSansDimension` : données
// non gardées, ou arrivées avant l'onglet qui les montre), comme l'export
// d'une page sans compte (`aDonner`). Sans heure lisible, jamais : on ne
// saurait pas dire si elle est déjà appliquée.
export function dimensionADonner(tvalue: unknown, dimensionLue: number | null, pageSansDimension = false): boolean {
  if (typeof tvalue !== 'number' || !Number.isFinite(tvalue)) return false;
  return pageSansDimension || dimensionLue === null || tvalue > dimensionLue;
}

// Faut-il donner le fichier à la page ? `nouveau` : un export plus récent que
// le dernier appliqué (la page l'annonce). Sinon, au chargement d'une page
// SANS compte (conservation refusée), on le redonne en silence : le compte
// « se relit du dossier au lancement ».
export function aDonner(
  modifie: number,
  dernierLu: number | null,
  pageSansCompte: boolean
): { donner: boolean; nouveau: boolean } {
  if (dernierLu === null || modifie > dernierLu) return { donner: true, nouveau: true };
  return { donner: pageSansCompte, nouveau: false };
}
