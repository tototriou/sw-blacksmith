// Le compte tenu à jour EN DIRECT par le plugin SWEX « SW Blacksmith Live » :
// on part de la réponse de connexion (`HubUserLogin`, exactement ce qu'écrit
// ProfileExport), puis on applique ce que le serveur renvoie à chaque commande
// — runes, artéfacts, monstres, pierres de meule et gemmes.
//
// Calcul PUR (aucun accès disque, aucun Electron) : le plugin l'assemble en un
// seul fichier (plugin-swex/), les tests le rejouent sur un journal fabriqué.
//
// ⚠️ **Un registre, pas l'arbre de l'export.** Le jeu renvoie une rune seule
// (meule, amélioration), un monstre complet avec ses runes (équipement,
// combat), ou une liste à retirer (vente). Tenir l'arbre (runes DANS les
// monstres, ou dans l'inventaire) obligerait chaque règle à chercher où vit
// l'objet. On tient donc un registre par identifiant, et c'est l'ÉCRITURE
// (`versExport`) qui range : une rune dont `occupied_type` vaut 1 et dont le
// monstre existe est portée par lui, toute autre est dans l'inventaire.
//
// ⚠️ **Une règle par commande pour ce qui DISPARAÎT, une lecture générale
// pour ce qui change ou arrive.** Le serveur renvoie l'état courant de tout
// objet touché : une rune, un monstre, un lot de pierres vus dans une réponse
// remplacent ceux du registre. Mais certaines réponses montrent des objets qui
// ne sont PAS l'état du compte :
//  - `SellRune` renvoie les runes VENDUES (pour le rachat), `SellArtifacts` les
//    artéfacts vendus : les reprendre les ressusciterait ;
//  - le siège, la guilde, la RTA, l'arène dimensionnelle montrent des
//    INSTANTANÉS de monstres (défense posée il y a trois jours, préréglages de
//    runes de la RTA, box dimensionnelle) : les reprendre écraserait les vrais.
// Ces commandes sont écartées de la lecture générale (`HORS_LECTURE`), et ce
// qu'elles retirent est appliqué par leur règle (`RETRAITS`).

export type Json = Record<string, any>;

export interface EtatDirect {
  wizardId: number;
  // La réponse de connexion, dont on remplace à l'écriture les listes tenues
  // ci-dessous. Jamais modifiée.
  connexion: Json;
  // Registres, dans l'ordre de la connexion (une Map garde l'ordre d'insertion,
  // et remplacer une clé garde sa place) : un objet nouveau va à la fin.
  runes: Map<number, Json>;
  artefacts: Map<number, Json>;
  unites: Map<number, Json>;
  crafts: Map<number, Json>;
  // ⚠️ Une relique n'est PAS exclusive : plusieurs monstres portent la même.
  // La liste du compte (`relics`) les contient TOUTES, portées ou non ; un
  // monstre en garde sa copie. Elle se tient donc à part, sans rangement.
  reliques: Map<number, Json>;
  // Heure serveur de la dernière réponse appliquée : la fraîcheur affichée.
  tvalue: number | null;
  // Nombre d'écritures dans les registres : dit si une commande a changé le
  // compte (le plugin ne réécrit le fichier que dans ce cas).
  version: number;
}

function mettre(etat: EtatDirect, registre: Map<number, Json>, id: number, objet: Json) {
  registre.set(id, objet);
  etat.version++;
}
function oter(etat: EtatDirect, registre: Map<number, Json>, id: number) {
  if (registre.delete(id)) etat.version++;
}

// Les clés qui ne doivent JAMAIS sortir dans le fichier écrit : la session du
// jeu (ProfileExport, lui, les écrit).
const SECRETS = ['session_key', 'session_key_node', 'reqid'];

// Commandes dont la réponse ne décrit pas l'état du compte (voir en tête).
// ⚠️ `RewardInfo` : l'aperçu des récompenses de l'arène serveur montre encore
// une rune reçue puis VENDUE dans la foulée — relue, elle revenait.
const HORS_LECTURE =
  /^(Sell|sell)|Repurchase|RewardInfo|dimensionarena|guild(?!maze)|siege|rival|rtpvp|worldarena|world_arena|snapshot|stats|visit|friend|draft|test|ranking|replay|getUnit/i;

// Clés d'une réponse à ne jamais lire, quelle que soit la commande : listes de
// rachat (objets vendus), états « avant » d'une modification, historiques.
// ⚠️ `reward_result` : l'arène serveur renvoie, à chaque récompense reçue,
// l'historique de TOUTES celles de la saison — une rune reçue puis vendue y
// figure encore. Seule l'entrée de la récompense reçue est lue
// (`LECTURES_CIBLEES`).
const CLES_IGNOREES = /repurchase|prev|before|history|reward_result/i;

// Commandes dont on ne lit QU'UNE partie de la réponse.
const LECTURES_CIBLEES: Record<string, (res: Json) => unknown> = {
  receiveServerArenaReward_v2: (res) =>
    (res.user_reward_info?.reward_result ?? []).filter((r: Json) => Number(r.reward_id) === Number(res.reward_id)),
};

// Les objets DU COMPTE, reconnus à leur forme. ⚠️ Le `wizard_id` est exigé (et
// comparé, voir `parcourir`) : sans lui passaient les monstres ennemis d'un
// donjon et ceux des decks recommandés par la communauté. Une rune doit être
// portée (1) ou en inventaire (2) : `occupied_type` 3, c'est une rune EN VENTE
// au marché noir, au nom du joueur.
const estRune = (o: Json) =>
  'rune_id' in o && 'slot_no' in o && 'set_id' in o && Array.isArray(o.sec_eff) && [1, 2].includes(Number(o.occupied_type));
const estArtefact = (o: Json) => 'rid' in o && 'pri_effect' in o && Array.isArray(o.sec_effects) && 'natural_rank' in o;
// Un monstre COMPLET : ses runes sont des objets (un deck n'en donne que les
// identifiants), et il a son niveau.
const estUnite = (o: Json) =>
  'unit_id' in o &&
  'unit_master_id' in o &&
  'unit_level' in o &&
  Array.isArray(o.runes) &&
  o.runes.every((r: unknown) => !!r && typeof r === 'object');
const estCraft = (o: Json) => 'craft_item_id' in o && 'craft_type' in o && 'craft_type_id' in o && 'amount' in o;
const estRelique = (o: Json) => 'rid' in o && 'durability' in o && Array.isArray(o.sec_effect) && Array.isArray(o.pri_effect);

export function depuisConnexion(connexion: Json): EtatDirect {
  const etat: EtatDirect = {
    wizardId: Number(connexion.wizard_info?.wizard_id ?? connexion.wizard_id),
    connexion,
    runes: new Map(),
    artefacts: new Map(),
    unites: new Map(),
    crafts: new Map(),
    reliques: new Map(),
    tvalue: typeof connexion.tvalue === 'number' ? connexion.tvalue : null,
    version: 0,
  };
  for (const u of connexion.unit_list ?? []) poserUnite(etat, u, false);
  for (const r of connexion.runes ?? []) etat.runes.set(r.rune_id, r);
  for (const a of connexion.artifacts ?? []) etat.artefacts.set(a.rid, a);
  for (const c of connexion.rune_craft_item_list ?? []) etat.crafts.set(c.craft_item_id, c);
  for (const r of connexion.relics ?? []) etat.reliques.set(r.rid, r);
  etat.version = 0;
  return etat;
}

// Un monstre complet : il remplace l'ancien, et ses runes et artéfacts entrent
// au registre avec lui (ils disent qui les porte).
//
// ⚠️ Ce qu'il portait et ne porte plus est RENDU à l'inventaire : sans quoi
// une rune retirée garderait `occupied_id` = ce monstre et lui serait
// rattachée à l'écriture. Une rune passée à un autre monstre de la même
// réponse est reprise par lui, avant ou après : son objet dit son nouveau
// porteur, il ne correspond plus à celui-ci.
// `rendre` : faux à la connexion, où rien n'a encore été porté.
function poserUnite(etat: EtatDirect, u: Json, rendre = true) {
  const id = Number(u.unit_id);
  if (rendre) {
    const runes = new Set((u.runes ?? []).map((r: Json) => Number(r.rune_id)));
    const artefacts = new Set((u.artifacts ?? []).map((a: Json) => Number(a.rid)));
    for (const [rid, r] of etat.runes)
      if (Number(r.occupied_type) === 1 && Number(r.occupied_id) === id && !runes.has(rid))
        mettre(etat, etat.runes, rid, { ...r, occupied_type: 2, occupied_id: 0 });
    for (const [aid, a] of etat.artefacts)
      if (Number(a.occupied_id) === id && !artefacts.has(aid)) mettre(etat, etat.artefacts, aid, { ...a, occupied_id: 0, slot: 0 });
  }
  mettre(etat, etat.unites, id, u);
  for (const r of u.runes ?? []) mettre(etat, etat.runes, r.rune_id, r);
  for (const a of u.artifacts ?? []) mettre(etat, etat.artefacts, a.rid, a);
}

// Les objets du compte vus dans une réponse, en profondeur. Seuls ceux de
// l'invocateur suivi comptent : une réponse peut montrer ceux d'un autre
// (ami, adversaire).
interface Vus {
  runes: Json[];
  artefacts: Json[];
  unites: Json[];
  crafts: Json[];
  reliques: Json[];
}

function parcourir(x: unknown, moi: number, vus: Vus) {
  if (Array.isArray(x)) {
    for (const y of x) parcourir(y, moi, vus);
    return;
  }
  if (!x || typeof x !== 'object') return;
  const o = x as Json;
  // Un identifiant nul (`rune_id: 0`) : un APERÇU de récompense (passe de
  // combat), pas un objet du compte.
  const id = Number(o.rune_id ?? o.rid ?? o.unit_id ?? o.craft_item_id ?? 0);
  if (Number(o.wizard_id) === moi && id > 0) {
    if (estUnite(o)) {
      vus.unites.push(o);
      // Ses runes et artéfacts entrent avec lui ; ses reliques, copies de
      // celles du compte, en donnent l'état courant.
      for (const r of o.relics ?? []) if (r && typeof r === 'object' && estRelique(r)) vus.reliques.push(r);
      return;
    }
    if (estRelique(o)) {
      vus.reliques.push(o);
      return;
    }
    if (estRune(o)) {
      vus.runes.push(o);
      return;
    }
    if (estArtefact(o)) {
      vus.artefacts.push(o);
      return;
    }
    if (estCraft(o)) {
      vus.crafts.push(o);
      return;
    }
  }
  for (const [k, v] of Object.entries(o)) if (!CLES_IGNOREES.test(k)) parcourir(v, moi, vus);
}

// Ce que chaque commande RETIRE du compte : lu dans la requête (ce que le
// joueur a vendu) ou dans la réponse (ce que le serveur dit avoir retiré).
const RETRAITS: Record<string, (etat: EtatDirect, req: Json, res: Json) => void> = {
  SellRune: (e, req) => {
    for (const id of req.rune_id_list ?? []) oter(e, e.runes, Number(id));
  },
  SellArtifacts: (e, req) => {
    for (const id of req.artifact_ids ?? []) oter(e, e.artefacts, Number(id));
  },
  // Une pierre vendue : la réponse donne le lot restant (lu plus bas, même
  // pour ces commandes hors lecture générale).
  SellRuneCraftItem_v2: (e, _req, res) => {
    if (res.rune_craft_item) poserCraft(e, res.rune_craft_item);
  },
  SellRuneCraftItemList: (e, req, res) => {
    const restants = new Map<number, Json>((res.rune_craft_item_list ?? []).map((c: Json) => [c.craft_item_id, c]));
    for (const c of req.craft_item_list ?? []) {
      const reste = restants.get(c.craft_item_id);
      if (reste) poserCraft(e, reste);
      else oter(e, e.crafts, Number(c.craft_item_id));
    }
  },
};

function poserCraft(etat: EtatDirect, c: Json) {
  if (Number(c.amount) > 0) mettre(etat, etat.crafts, Number(c.craft_item_id), c);
  else oter(etat, etat.crafts, Number(c.craft_item_id));
}

// Les monstres que le serveur dit avoir retirés (sacrifiés, mis en stock,
// convertis), quelle que soit la commande.
function retirerUnites(etat: EtatDirect, req: Json, res: Json) {
  const ids: number[] = [...(res.remove_unit_id_list ?? []), ...(res.removed_unit_id_list ?? [])];
  for (const s of req.source_unit_list ?? []) ids.push(typeof s === 'object' ? s.unit_id : s);
  for (const id of ids) oter(etat, etat.unites, Number(id));
}

// Applique une commande réussie de l'invocateur suivi. `true` si le compte a
// changé (le plugin réécrit alors le fichier).
export function appliquer(etat: EtatDirect, commande: string, req: Json, res: Json): boolean {
  if (!res || Number(res.ret_code) !== 0) return false;
  if (Number(req?.wizard_id ?? res.wizard_info?.wizard_id) !== etat.wizardId) return false;
  const avant = etat.version;

  RETRAITS[commande]?.(etat, req ?? {}, res);
  if (!HORS_LECTURE.test(commande)) {
    const vus: Vus = { runes: [], artefacts: [], unites: [], crafts: [], reliques: [] };
    parcourir(res, etat.wizardId, vus);
    const ciblee = LECTURES_CIBLEES[commande];
    if (ciblee) parcourir(ciblee(res), etat.wizardId, vus);
    // Monstres d'abord : les runes qu'ils portent disent où elles sont. Les
    // runes vues seules ensuite (meule, amélioration d'une rune portée), qui
    // gardent leur porteur dans `occupied_id`.
    for (const u of vus.unites) poserUnite(etat, u);
    for (const r of vus.runes) mettre(etat, etat.runes, Number(r.rune_id), r);
    for (const a of vus.artefacts) mettre(etat, etat.artefacts, Number(a.rid), a);
    for (const c of vus.crafts) poserCraft(etat, c);
    for (const r of vus.reliques) mettre(etat, etat.reliques, Number(r.rid), r);
    retirerUnites(etat, req ?? {}, res);
  }
  if (typeof res.tvalue === 'number') etat.tvalue = res.tvalue;
  return etat.version !== avant;
}

// Le compte à écrire : la connexion, dont les listes tenues sont remplacées
// par le registre rangé, et sans les clés de session.
export function versExport(etat: EtatDirect): Json {
  const portees = new Map<number, { runes: Json[]; artefacts: Json[] }>();
  for (const id of etat.unites.keys()) portees.set(id, { runes: [], artefacts: [] });
  const runesInventaire: Json[] = [];
  for (const r of etat.runes.values()) {
    const p = Number(r.occupied_type) === 1 ? portees.get(Number(r.occupied_id)) : undefined;
    if (p) p.runes.push(r);
    else runesInventaire.push(Number(r.occupied_type) === 1 ? { ...r, occupied_type: 2, occupied_id: 0 } : r);
  }
  const artefactsInventaire: Json[] = [];
  for (const a of etat.artefacts.values()) {
    const p = Number(a.occupied_id) ? portees.get(Number(a.occupied_id)) : undefined;
    if (p) p.artefacts.push(a);
    else artefactsInventaire.push(a);
  }
  const unit_list = [...etat.unites.values()].map((u) => {
    const p = portees.get(u.unit_id)!;
    return {
      ...u,
      runes: p.runes.sort((a, b) => a.slot_no - b.slot_no),
      artifacts: p.artefacts.sort((a, b) => a.slot - b.slot),
    };
  });
  const sortie: Json = {
    ...etat.connexion,
    unit_list,
    runes: runesInventaire,
    artifacts: artefactsInventaire,
    rune_craft_item_list: [...etat.crafts.values()],
    relics: [...etat.reliques.values()],
  };
  if (etat.tvalue !== null) sortie.tvalue = etat.tvalue;
  for (const k of SECRETS) delete sortie[k];
  return sortie;
}
