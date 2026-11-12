// L'état d'un `/speedtune` en cours, porté par les `custom_id` des menus du
// message : le service reste sans état. Quand l'équipe compte un monstre dont
// le passif de vitesse se CUMULE (Chilling, Miles…), ou qui reçoit un buff de
// VIT, le bot demande ce que la capture ne montre pas (nombre de cumuls, effet
// aug. VIT des artéfacts, set Rapide) ; chaque choix revient avec la lecture entière, sans
// base de données ni nouvelle lecture de la capture.
//
// ⚠️ Un `custom_id` fait 100 caractères au plus (Discord). Au pire —
// trois attaquants à identifiant de 5 chiffres, VIT à 3, 2 chiffres de cumuls,
// 2 d'artéfact, deux doutes chacun, trois défenseurs, le set Rapide — on en
// écrit 98 ; au-delà,
// les doutes tombent (voir `encoderEtat`).
//
// ⚠️ Un `custom_id` revient du client : il se relit strictement (chiffres,
// bornes) et un monstre inconnu est refusé par l'appelant, comme une lecture
// ratée.

export interface AttaquantEtat {
  id: number; // com2usId reconnu
  combat: number; // VIT de combat lue
  cumuls: number | null; // cumuls du passif, `null` tant que non précisés
  arte: number | null; // effet aug. VIT des artéfacts (%), `null` tant que non précisé
  vitDouteuse: boolean;
  autrePortrait: number | null; // le candidat trop proche, s'il y en a un
}

export interface Etat {
  attaquants: AttaquantEtat[];
  defense: number[];
  // Les attaquants en set Rapide (Swift), un bit par place ; `null` tant que
  // non précisé. Sans effet sur l'ordre (la VIT de combat lue le contient),
  // il dit la VIT de RUNES derrière la VIT lue.
  swift: number | null;
}

export const PREFIXE_ETAT = 'st1';
export const LONGUEUR_MAX = 100;
export const CUMULS_MAX = 24; // 25 options au plus dans un menu Discord
export const ARTE_MAX = 60; // deux artéfacts à 30 % au plus (ARTE_MAX de speedTune.ts)

export function encoderEtat(action: string, e: Etat): string {
  const ecrire = (doutes: boolean) =>
    [
      PREFIXE_ETAT,
      action,
      e.attaquants
        .map((a) => [a.id, a.combat, a.cumuls ?? '', a.arte ?? '', doutes && a.vitDouteuse ? 'v' : '', doutes ? (a.autrePortrait ?? '') : ''].join('.'))
        .join(','),
      e.defense.join(','),
      e.swift ?? '',
    ].join(':');
  const complet = ecrire(true);
  // Les doutes sont un avertissement, pas l'état : on les perd plutôt que
  // de dépasser la limite.
  return complet.length <= LONGUEUR_MAX ? complet : ecrire(false);
}

const ATTAQUANT = /^(\d{1,6})\.(\d{1,3})\.(\d{0,2})\.(\d{0,2})\.(v?)\.(\d{0,6})$/;

export function decoderEtat(customId: string): { action: string; etat: Etat } | null {
  const parts = customId.split(':');
  if (parts.length !== 5 || parts[0] !== PREFIXE_ETAT || !/^[a-z]\d?$/.test(parts[1])) return null;
  const attaquants: AttaquantEtat[] = [];
  for (const brut of parts[2].split(',')) {
    const m = ATTAQUANT.exec(brut);
    if (!m) return null;
    const cumuls = m[3] === '' ? null : Number(m[3]);
    const arte = m[4] === '' ? null : Number(m[4]);
    if ((cumuls != null && cumuls > CUMULS_MAX) || (arte != null && arte > ARTE_MAX)) return null;
    attaquants.push({ id: Number(m[1]), combat: Number(m[2]), cumuls, arte, vitDouteuse: m[5] === 'v', autrePortrait: m[6] === '' ? null : Number(m[6]) });
  }
  if (attaquants.length < 1 || attaquants.length > 3) return null;
  const defense = parts[3] === '' ? [] : parts[3].split(',');
  if (defense.length > 3 || defense.some((x) => !/^\d{1,6}$/.test(x))) return null;
  if (!/^\d?$/.test(parts[4])) return null;
  const swift = parts[4] === '' ? null : Number(parts[4]);
  if (swift != null && swift >= 1 << attaquants.length) return null;
  return { action: parts[1], etat: { attaquants, defense: defense.map(Number), swift } };
}
