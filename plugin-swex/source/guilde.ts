// Le contenu des combats de guilde, suivi EN DIRECT par le plugin SWEX : siège,
// guerre de guilde, labyrinthe, rivaux, boss de guilde. Rien de cela n'est dans
// l'export du compte : le jeu ne l'envoie qu'en le montrant (carte du siège,
// défenses d'une base, journaux de combat) ou en le jouant (début et fin d'un
// combat).
//
// Calcul PUR, comme etatDirect.ts. Le plugin écrit un ÉVÉNEMENT par échange
// de guilde (`evenementGuilde`) dans `guilde.live.jsonl` — la session en
// cours —, et archive chaque session finie dans `guilde.jsonl.gz` : ici,
// c'est l'HISTORIQUE qui compte, tout est gardé.
//
// Relire des lignes (`depuisLignesGuilde`, pour l'app) en tire deux parts :
//  - **les vues** : la DERNIÈRE réponse de chaque écran, une par jeu de
//    paramètres — la défense de la base 12 ne remplace pas celle de la base 8 ;
//  - **les combats** : chacun, à son début (`…Start…`) et à sa fin
//    (`…Result…`) quand le jeu l'envoie, reliés par `battle_key`. ⚠️ Le siège
//    n'envoie PAS de fin dans le journal relevé : son résultat se lit dans les
//    vues qui suivent (carte, journaux de combat).

import type { Json } from './etatDirect';

export const FORMAT_GUILDE_LIVE = 'swblacksmith/guilde-live';
export const VERSION_GUILDE_LIVE = 1;

// Les contenus de guilde, reconnus au nom de la commande.
const CONTENUS: [RegExp, string][] = [
  [/GuildWar/i, 'guerre'],
  [/Siege/i, 'siege'],
  [/Maze/i, 'labyrinthe'],
  [/Rival/i, 'rivaux'],
  [/GuildBoss/i, 'boss'],
];
const contenuDe = (commande: string) => CONTENUS.find(([m]) => m.test(commande))?.[1] ?? null;

// Une VUE : un écran que le jeu demande (`Get…`), d'un contenu de guilde, ou
// les informations de la guilde elle-même (membres).
const estVue = (c: string) => (/^get/i.test(c) && contenuDe(c) !== null) || /^GetGuild(Info|DataAll)$/.test(c);
const estDebut = (c: string) => /^battle/i.test(c) && /Start/.test(c) && !/Success/.test(c) && contenuDe(c) !== null;
const estFin = (c: string) => /^battle/i.test(c) && /Result/.test(c) && contenuDe(c) !== null;

// Les paramètres techniques d'une requête : ni la clé d'une vue, ni écrits.
const TECHNIQUES = new Set(['command', 'wizard_id', 'proto_ver', 'ts_val', 'loginextend_refcount', 'app_version']);
// ⚠️ Jamais écrits, à aucune profondeur : la session du jeu et ce qui
// identifie le client.
const SECRETS = /^(session_key|session_key_node|infocsv|css|reqid|channel_uid)$/;

function sansSecrets<T>(x: T): T {
  if (Array.isArray(x)) return x.map(sansSecrets) as T;
  if (!x || typeof x !== 'object') return x;
  const o: Json = {};
  for (const [k, v] of Object.entries(x as Json)) if (!SECRETS.test(k)) o[k] = sansSecrets(v);
  return o as T;
}

// Les paramètres qui distinguent deux vues d'une même commande (base, deck,
// joueur visé, case du labyrinthe…).
function paramsDe(req: Json): Json {
  const p: Json = {};
  for (const [k, v] of Object.entries(req ?? {})) if (!TECHNIQUES.has(k) && !SECRETS.test(k)) p[k] = v;
  return p;
}

// ── L'événement : une ligne du fichier live ─────────────────────────────

export interface EvenementGuilde {
  type: 'vue' | 'debut' | 'fin';
  t: number | null;
  commande: string;
  contenu: string;
  // La requête sans ses paramètres techniques : pour une vue, ce qui la
  // distingue d'une autre vue de la même commande.
  params: Json;
  battle_key?: number | null;
  reponse: Json;
}

// L'en-tête d'une session (première ligne du fichier live).
export interface SessionGuilde {
  type: 'session';
  format: typeof FORMAT_GUILDE_LIVE;
  version: number;
  wizard_id: number;
  t: number | null;
  plugin: string;
}

export function ligneSessionGuilde(wizardId: number, t: number | null, plugin: string): SessionGuilde {
  return { type: 'session', format: FORMAT_GUILDE_LIVE, version: VERSION_GUILDE_LIVE, wizard_id: wizardId, t, plugin };
}

// L'événement d'un échange réussi de l'invocateur suivi, ou `null` s'il n'est
// pas un contenu de guilde.
export function evenementGuilde(wizardId: number, commande: string, req: Json, res: Json): EvenementGuilde | null {
  if (!res || Number(res.ret_code) !== 0) return null;
  if (Number(req?.wizard_id ?? res.wizard_info?.wizard_id) !== wizardId) return null;
  const type = estVue(commande) ? 'vue' : estDebut(commande) ? 'debut' : estFin(commande) ? 'fin' : null;
  if (!type) return null;
  const ev: EvenementGuilde = {
    type,
    t: typeof res.tvalue === 'number' ? res.tvalue : null,
    commande,
    contenu: contenuDe(commande) ?? 'guilde',
    params: sansSecrets(paramsDe(req)),
    reponse: sansSecrets(res),
  };
  if (type !== 'vue') {
    // La clé du combat : donnée par la réponse au début, rappelée par la
    // requête à la fin.
    const cle = Number(type === 'debut' ? res.battle_key ?? req?.battle_key : req?.battle_key ?? res.battle_key);
    ev.battle_key = Number.isFinite(cle) ? cle : null;
  }
  return ev;
}

// ── Relire : les vues et les combats ────────────────────────────────────

export interface Vue {
  commande: string;
  contenu: string;
  params: Json;
  t: number | null;
  reponse: Json;
}

export interface Combat {
  contenu: string;
  battle_key: number | null;
  debut: EvenementGuilde | null;
  fin: EvenementGuilde | null;
}

export interface EtatGuilde {
  vues: Map<string, Vue>;
  combats: Combat[];
  // Heure serveur du dernier événement.
  t: number | null;
}

export const guildeVide = (): EtatGuilde => ({ vues: new Map(), combats: [], t: null });

const cleDe = (commande: string, params: Json) =>
  `${commande}${Object.keys(params).length ? ` ${JSON.stringify(params, Object.keys(params).sort())}` : ''}`;

export function poserEvenement(etat: EtatGuilde, ev: EvenementGuilde) {
  if (ev.type === 'vue') {
    const { commande, contenu, params, t, reponse } = ev;
    etat.vues.set(cleDe(commande, params), { commande, contenu, params, t, reponse });
  } else if (ev.type === 'debut') {
    etat.combats.push({ contenu: ev.contenu, battle_key: ev.battle_key ?? null, debut: ev, fin: null });
  } else {
    // La fin rejoint son début ; une fin sans début connu (plugin lancé en
    // plein combat) est gardée seule.
    const combat = [...etat.combats].reverse().find((c) => c.contenu === ev.contenu && c.battle_key === ev.battle_key && !c.fin);
    if (combat) combat.fin = ev;
    else etat.combats.push({ contenu: ev.contenu, battle_key: ev.battle_key ?? null, debut: null, fin: ev });
  }
  if (ev.t !== null) etat.t = ev.t;
}

// Les vues et combats tirés de lignes : un fichier live, ou le texte d'une
// archive (plusieurs sessions à la suite). Seules les sessions de
// l'invocateur `wizardId` comptent. Une ligne illisible (la dernière, à moitié
// écrite) arrête la lecture : ce qui précède vaut.
export function depuisLignesGuilde(lignes: string[], wizardId: number): EtatGuilde {
  const etat = guildeVide();
  let sienne = false;
  for (const texte of lignes) {
    if (!texte.trim()) continue;
    let ligne: Json;
    try {
      ligne = JSON.parse(texte);
    } catch {
      break;
    }
    if (ligne.type === 'session') {
      sienne = ligne.format === FORMAT_GUILDE_LIVE && ligne.version === VERSION_GUILDE_LIVE && Number(ligne.wizard_id) === wizardId;
    } else if (sienne && ['vue', 'debut', 'fin'].includes(ligne.type)) poserEvenement(etat, ligne as EvenementGuilde);
  }
  return etat;
}
