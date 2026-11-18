// Le contenu des combats de guilde, suivi EN DIRECT par le plugin SWEX : siège,
// guerre de guilde, labyrinthe, rivaux, boss de guilde. Rien de cela n'est dans
// l'export du compte : le jeu ne l'envoie qu'en le montrant (carte du siège,
// défenses d'une base, journaux de combat) ou en le jouant (début et fin d'un
// combat).
//
// Calcul PUR, comme etatDirect.ts : le plugin écrit `versFichierGuilde` dans
// `SWBlacksmith/<nom>-<id>/guilde.json`, dans le dossier de SWEX.
//
// Deux parts :
//  - **les vues** : la DERNIÈRE réponse de chaque écran, une par jeu de
//    paramètres — la défense de la base 12 ne remplace pas celle de la base 8 ;
//  - **les combats** : chacun, à son début (`…Start…`) et à sa fin
//    (`…Result…`) quand le jeu l'envoie, reliés par `battle_key`. ⚠️ Le siège
//    n'envoie PAS de fin dans le journal relevé : son résultat se lit dans les
//    vues qui suivent (carte, journaux de combat).

import type { Json } from './etatDirect';

export const FORMAT_GUILDE = 'swblacksmith/guilde-direct';
export const VERSION_GUILDE = 1;

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

// Combien de combats on garde : les plus récents.
export const COMBATS_MAX = 300;

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

export interface Vue {
  commande: string;
  contenu: string;
  params: Json;
  tvalue: number | null;
  reponse: Json;
}

export interface Combat {
  contenu: string;
  battle_key: number | null;
  debut: { commande: string; tvalue: number | null; requete: Json; reponse: Json } | null;
  fin: { commande: string; tvalue: number | null; requete: Json; reponse: Json } | null;
}

export interface EtatGuilde {
  wizardId: number;
  vues: Map<string, Vue>;
  combats: Combat[];
  tvalue: number | null;
}

export function guildeVide(wizardId: number): EtatGuilde {
  return { wizardId, vues: new Map(), combats: [], tvalue: null };
}

// Reprend un fichier écrit plus tôt (le plugin redémarré garde l'historique
// des combats). Un fichier d'un autre format, d'une autre version ou d'un autre
// invocateur repart de zéro.
export function depuisFichierGuilde(fichier: unknown, wizardId: number): EtatGuilde {
  const f = fichier as Json | null;
  if (!f || f.format !== FORMAT_GUILDE || f.version !== VERSION_GUILDE || Number(f.wizard_id) !== wizardId)
    return guildeVide(wizardId);
  const vues = new Map<string, Vue>();
  for (const [cle, v] of Object.entries((f.vues ?? {}) as Record<string, Vue>)) vues.set(cle, v);
  return {
    wizardId,
    vues,
    combats: Array.isArray(f.combats) ? f.combats : [],
    tvalue: typeof f.tvalue === 'number' ? f.tvalue : null,
  };
}

// Les paramètres qui distinguent deux vues d'une même commande (base, deck,
// joueur visé, case du labyrinthe…).
function paramsDe(req: Json): Json {
  const p: Json = {};
  for (const [k, v] of Object.entries(req ?? {})) if (!TECHNIQUES.has(k) && !SECRETS.test(k)) p[k] = v;
  return p;
}
const cleDe = (commande: string, params: Json) =>
  `${commande}${Object.keys(params).length ? ` ${JSON.stringify(params, Object.keys(params).sort())}` : ''}`;

// Applique une commande réussie de l'invocateur suivi. `true` si le contenu
// de guilde a changé.
export function appliquerGuilde(etat: EtatGuilde, commande: string, req: Json, res: Json): boolean {
  if (!res || Number(res.ret_code) !== 0) return false;
  if (Number(req?.wizard_id ?? res.wizard_info?.wizard_id) !== etat.wizardId) return false;
  const contenu = contenuDe(commande);
  const tvalue = typeof res.tvalue === 'number' ? res.tvalue : null;
  const trace = () => ({ commande, tvalue, requete: sansSecrets(paramsDe(req)), reponse: sansSecrets(res) });

  if (estVue(commande)) {
    const params = sansSecrets(paramsDe(req));
    etat.vues.set(cleDe(commande, params), { commande, contenu: contenu ?? 'guilde', params, tvalue, reponse: sansSecrets(res) });
  } else if (estDebut(commande)) {
    const cle = Number(res.battle_key ?? req?.battle_key ?? NaN);
    etat.combats.push({ contenu: contenu!, battle_key: Number.isFinite(cle) ? cle : null, debut: trace(), fin: null });
    if (etat.combats.length > COMBATS_MAX) etat.combats.splice(0, etat.combats.length - COMBATS_MAX);
  } else if (estFin(commande)) {
    const cle = Number(req?.battle_key ?? res.battle_key ?? NaN);
    // La fin rejoint son début ; une fin sans début connu (plugin lancé en
    // plein combat) est gardée seule.
    const combat = [...etat.combats].reverse().find((c) => c.contenu === contenu && c.battle_key === cle && !c.fin);
    if (combat) combat.fin = trace();
    else etat.combats.push({ contenu: contenu!, battle_key: Number.isFinite(cle) ? cle : null, debut: null, fin: trace() });
  } else return false;

  if (tvalue !== null) etat.tvalue = tvalue;
  return true;
}

export function versFichierGuilde(etat: EtatGuilde): Json {
  return {
    format: FORMAT_GUILDE,
    version: VERSION_GUILDE,
    wizard_id: etat.wizardId,
    tvalue: etat.tvalue,
    vues: Object.fromEntries(etat.vues),
    combats: etat.combats,
  };
}
