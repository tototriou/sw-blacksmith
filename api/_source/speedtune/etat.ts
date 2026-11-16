// L'état d'un `/speedtune` en cours, porté par les `custom_id` des menus du
// message : le service reste sans état. Quand l'équipe compte un monstre dont
// le passif de vitesse se CUMULE (Chilling, Miles…), ou qui reçoit un buff de
// VIT, le bot demande ce que la capture ne montre pas (nombre de cumuls, effet
// aug. VIT des artéfacts) ; chaque choix revient avec la lecture entière, sans
// base de données ni nouvelle lecture de la capture.
//
// ⚠️ **L'auteur de la commande voyage avec l'état** : seul lui peut répondre
// aux menus d'un message que tout le salon voit. Les métadonnées du message
// renvoyées par Discord ne suffisaient pas : quand elles manquaient, tout le
// monde pouvait répondre.
//
// ⚠️ Un `custom_id` fait 100 caractères au plus (Discord) : les nombres s'y
// écrivent en base 36. Au pire — trois attaquants et leurs doutes, trois
// défenseurs, l'auteur — on en écrit 94 ; au-delà, les portraits voisins
// tombent (voir `encoderEtat`).
//
// ⚠️ Un `custom_id` revient du client : il se relit strictement (chiffres,
// bornes) et un monstre inconnu est refusé par l'appelant, comme une lecture
// ratée.

// Une VIT à saisir sans lecture probable à proposer.
export const VIT_INCONNUE = 0;
// Une VIT saisie à la main : au-delà, ce n'est pas une VIT de combat.
export const VIT_SAISIE_MAX = 999;

export interface AttaquantEtat {
  id: number; // com2usId reconnu
  // VIT de combat lue ou saisie ; tant qu'elle est à saisir, la lecture la
  // plus probable (qui préremplit la saisie), ou VIT_INCONNUE.
  combat: number;
  cumuls: number | null; // cumuls du passif, `null` tant que non précisés
  arte: number | null; // effet aug. VIT des artéfacts (%), `null` tant que non précisé
  vitDouteuse: boolean; // VIT mal lue : demandée au joueur avant tout calcul
  autrePortrait: number | null; // le candidat trop proche, s'il y en a un
}

export interface Etat {
  attaquants: AttaquantEtat[];
  defense: number[];
  auteur: string; // l'identifiant Discord de qui a lancé la commande
}

// st3 : sans le set Rapide (st2 le portait, st1 n'avait pas l'auteur).
export const PREFIXE_ETAT = 'st3';
export const LONGUEUR_MAX = 100;
export const CUMULS_MAX = 24; // 25 options au plus dans un menu Discord
export const ARTE_MAX = 60; // deux artéfacts à 30 % au plus (ARTE_MAX de speedTune.ts)

const b36 = (n: number) => n.toString(36);
const deB36 = (x: string) => parseInt(x, 36);
// Un identifiant Discord (snowflake) dépasse la précision d'un `number`.
const idEnB36 = (id: string) => BigInt(id).toString(36);
function idDeB36(x: string): string {
  let n = 0n;
  for (const c of x) n = n * 36n + BigInt(parseInt(c, 36));
  return n.toString();
}

export function encoderEtat(action: string, e: Etat): string {
  const ecrire = (portraits: boolean) =>
    [
      PREFIXE_ETAT,
      action,
      e.attaquants
        .map((a) => [
          b36(a.id), b36(a.combat), a.cumuls == null ? '' : b36(a.cumuls), a.arte == null ? '' : b36(a.arte),
          a.vitDouteuse ? 'v' : '', portraits && a.autrePortrait != null ? b36(a.autrePortrait) : '',
        ].join('.'))
        .join(','),
      e.defense.map(b36).join(','),
      idEnB36(e.auteur),
    ].join(':');
  const complet = ecrire(true);
  // Le portrait voisin est un avertissement, pas l'état : on le perd plutôt
  // que de dépasser la limite. ⚠️ Jamais le doute sur la VIT : il la fait
  // demander, et une VIT mal lue ne doit pas passer pour lue. Sans les
  // portraits voisins, le pire cas tient en 82 caractères.
  return complet.length <= LONGUEUR_MAX ? complet : ecrire(false);
}

const ATTAQUANT = /^([0-9a-z]{1,4})\.([0-9a-z]{1,2})\.([0-9a-z]?)\.([0-9a-z]{0,2})\.(v?)\.([0-9a-z]{0,4})$/;

export function decoderEtat(customId: string): { action: string; etat: Etat } | null {
  const parts = customId.split(':');
  if (parts.length !== 5 || parts[0] !== PREFIXE_ETAT || !/^[a-z]\d?$/.test(parts[1])) return null;
  const attaquants: AttaquantEtat[] = [];
  for (const brut of parts[2].split(',')) {
    const m = ATTAQUANT.exec(brut);
    if (!m) return null;
    const cumuls = m[3] === '' ? null : deB36(m[3]);
    const arte = m[4] === '' ? null : deB36(m[4]);
    if ((cumuls != null && cumuls > CUMULS_MAX) || (arte != null && arte > ARTE_MAX) || deB36(m[2]) > VIT_SAISIE_MAX) return null;
    attaquants.push({ id: deB36(m[1]), combat: deB36(m[2]), cumuls, arte, vitDouteuse: m[5] === 'v', autrePortrait: m[6] === '' ? null : deB36(m[6]) });
  }
  if (attaquants.length < 1 || attaquants.length > 3) return null;
  const defense = parts[3] === '' ? [] : parts[3].split(',');
  if (defense.length > 3 || defense.some((x) => !/^[0-9a-z]{1,4}$/.test(x))) return null;
  if (!/^[0-9a-z]{1,13}$/.test(parts[4])) return null;
  return { action: parts[1], etat: { attaquants, defense: defense.map(deB36), auteur: idDeB36(parts[4]) } };
}
