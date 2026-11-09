// Droits d'un membre sur un salon Discord, calculés comme Discord les calcule :
// les rôles du serveur, puis les exceptions du salon (@everyone, les rôles du
// membre, le membre lui-même). Pur, testé (tests/discord-service.test.ts).
//
// ⚠️ Recalculés à chaque requête par le service, jamais crus du client : c'est
// ce calcul qui décide qui lit et qui publie
// (docs/04-decisions/adr/un-salon-une-reco.md).

export const ADMINISTRATEUR = 1n << 3n;
export const VOIR_LE_SALON = 1n << 10n;
export const ENVOYER = 1n << 11n;
export const JOINDRE = 1n << 15n;
export const HISTORIQUE = 1n << 16n;
const TOUT = (1n << 64n) - 1n;

export interface Role { id: string; permissions: string }
export interface Exception { id: string; type: 0 | 1; allow: string; deny: string } // 0 = rôle, 1 = membre
export interface Salon { id: string; guild_id: string; name: string; type: number; permission_overwrites?: Exception[] }
export interface Membre { roles: string[]; userId: string }

export interface DroitsSalon {
  lire: boolean; // voir le salon ET lire l'historique
  ecrire: boolean; // lire ET envoyer des messages
  joindre: boolean; // envoyer ET joindre des fichiers (le bot en a besoin pour publier)
}

// Droits du membre sur le serveur, avant les exceptions du salon.
export function droitsServeur(serveurId: string, proprietaireId: string | null, roles: Role[], membre: Membre): bigint {
  if (proprietaireId && membre.userId === proprietaireId) return TOUT;
  const parId = new Map(roles.map((r) => [r.id, BigInt(r.permissions)]));
  let droits = parId.get(serveurId) ?? 0n; // le rôle @everyone porte l'identifiant du serveur
  for (const r of membre.roles) droits |= parId.get(r) ?? 0n;
  // Un administrateur a tous les droits, quelles que soient les exceptions.
  return estAdministrateur(droits) ? TOUT : droits;
}

export function droitsSurSalon(serveurId: string, proprietaireId: string | null, roles: Role[], salon: Salon, membre: Membre): bigint {
  const base = droitsServeur(serveurId, proprietaireId, roles, membre);
  if (base === TOUT) return TOUT;
  let droits = base;
  const exceptions = salon.permission_overwrites ?? [];
  const tous = exceptions.find((e) => e.type === 0 && e.id === serveurId);
  if (tous) droits = (droits & ~BigInt(tous.deny)) | BigInt(tous.allow);
  let refuse = 0n;
  let accorde = 0n;
  for (const e of exceptions) {
    if (e.type === 0 && e.id !== serveurId && membre.roles.includes(e.id)) {
      refuse |= BigInt(e.deny);
      accorde |= BigInt(e.allow);
    }
  }
  droits = (droits & ~refuse) | accorde;
  const lui = exceptions.find((e) => e.type === 1 && e.id === membre.userId);
  if (lui) droits = (droits & ~BigInt(lui.deny)) | BigInt(lui.allow);
  return droits;
}

// Ce que l'app retient des droits bruts. Sans « voir le salon », Discord n'en
// accorde aucun autre ; sans « envoyer », pas de pièce jointe.
export function resumeDroits(droits: bigint): DroitsSalon {
  const a = (bit: bigint) => (droits & bit) === bit;
  const lire = a(VOIR_LE_SALON) && a(HISTORIQUE);
  const ecrire = lire && a(ENVOYER);
  return { lire, ecrire, joindre: ecrire && a(JOINDRE) };
}

export function estAdministrateur(droits: bigint): boolean {
  return (droits & ADMINISTRATEUR) === ADMINISTRATEUR;
}
