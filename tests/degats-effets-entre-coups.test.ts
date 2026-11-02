// Effets néfastes posés ENTRE les coups d'un sort — la règle dérivée de la
// donnée de chaque identifiant (`effetsEntreCoupsDuSort`, src/lib/damage.ts),
// ses exceptions lues dans la prose, les rangs des coups qui posent, et
// l'inventaire complet des formes jouables (celles que l'Optimizer propose,
// `formesJouables`).
//
// Spec : docs/02-app/degats-reels/feat-conditions-et-audit.md (« Poses entre
// les coups ») ; liste sort par sort :
// docs/02-app/degats-reels/inventaire-effets-entre-coups.md, figée par
// tests/fixtures/effets-entre-coups-inventaire.json.

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import type { OptimizerRecipe } from '../src/lib/optimizerRecipe';
import {
  AUCUNE_AURA_PROPRE,
  DEFAULT_DAMAGE_SETUP,
  cibleSecondairePriseEnCharge,
  computeSkillDamage,
  computeTotalDamage,
  coupsAuHasard,
  statsDuLanceurLuesParLaNote,
  estPrisEnCharge,
  idEffetPosable,
  libelleEffetEntreCoups,
  monsterDamageSkills,
  nomsEffetsPosables,
  notesEffetsEntreCoupsConnues,
  rangsDePoseProposes,
  resolvedHits,
  type DamageSetup,
  type EffetEntreCoupsProfile,
  type SkillDamageProfile,
} from '../src/lib/damage';
import { StatKey } from '../src/lib/effects';
import { DetailMonstre } from '../src/lib/monsterSkills';
import { formesJouables } from '../src/lib/monsterForms';
import { StatRow } from '../src/lib/stats';
import { egal, monstersJson, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dossierSorts = resolve(racine, 'public/data/skills');

interface EntreeInventaire {
  sort: number;
  nom: string;
  porteurs: string[];
  effets: string[];
}

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(dossierSorts, `${com2usId}.json`), 'utf8'));
}

// Les formes que l'Optimizer propose, avec leur fiche — lues une fois.
type Forme = { nom: string; element: string; com2usId: number; detail: DetailMonstre };
let formesLues: Forme[] | null = null;
function formes(): Forme[] {
  if (formesLues) return formesLues;
  const out: Forme[] = [];
  for (const m of formesJouables(monstersJson())) {
    if (m.com2usId == null) continue;
    let detail: DetailMonstre;
    try {
      detail = fiche(m.com2usId);
    } catch {
      continue;
    }
    out.push({ nom: m.name, element: m.element, com2usId: m.com2usId, detail });
  }
  formesLues = out;
  return out;
}

// Le profil du sort sur la PREMIÈRE forme jouable qui le porte.
function profil(sortId: number): SkillDamageProfile {
  for (const f of formes()) {
    const p = monsterDamageSkills(f.detail).find((s) => s.skillCom2usId === sortId);
    if (p && estPrisEnCharge(p)) return p;
  }
  throw new Error(`Sort ${sortId} introuvable sur une forme jouable`);
}

// La compétence telle que la fiche de sa première forme jouable la porte.
function competence(sortId: number) {
  for (const f of formes()) {
    const c = f.detail.competences.find((x) => x.com2usId === sortId);
    if (c) return c;
  }
  throw new Error(`Compétence ${sortId} introuvable sur une forme jouable`);
}

function signature(e: EffetEntreCoupsProfile): string {
  return `${e.id}${e.coups ? `@${e.coups.join(',')}` : ''}${e.nombre ? `x${e.nombre}` : ''}`;
}

function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

const BUILD = stats({ hp: 20000, atk: 1000, def: 800, spd: 200, cr: 25, cd: 100 });
const CIBLE: DamageSetup = {
  ...DEFAULT_DAMAGE_SETUP,
  enemyDef: 1500,
  enemyHp: 1_000_000,
  enemyHpPct: 100,
  critMode: 'normal',
  summonerSkills: 'normal',
};
const total = (p: SkillDamageProfile, setup: DamageSetup) => computeSkillDamage(p, BUILD, setup, AUCUNE_AURA_PROPRE);
const avecPose = (p: SkillDamageProfile, apresCoup: Record<string, number | null>, base: DamageSetup = CIBLE): DamageSetup => ({
  ...base,
  scenariosEffetsEntreCoups: { [p.skillCom2usId]: { actif: true, apresCoup } },
});

/**
 * L'inventaire des formes jouables est figé : chaque sort qui propose une pose
 * entre ses coups, avec ses effets et leurs rangs. Un sort ajouté ou retiré par
 * des données régénérées fait échouer ce test : on relit sa prose, puis on met
 * à jour la fixture ET l'inventaire de la documentation.
 */
export function testInventaireEffetsEntreCoups() {
  titre('Effets entre les coups — inventaire des formes jouables');
  const attendu: EntreeInventaire[] = JSON.parse(
    readFileSync(resolve(racine, 'tests/fixtures/effets-entre-coups-inventaire.json'), 'utf8')
  );
  const trouve = new Map<number, { nom: string; effets: string[]; porteurs: Set<string> }>();
  const divergents: string[] = [];
  const notesInconnues: string[] = [];
  const horsFiche: string[] = [];
  const notes = new Set(notesEffetsEntreCoupsConnues());
  for (const f of formes()) {
    const competences = new Map(f.detail.competences.map((c) => [c.com2usId, c]));
    for (const p of monsterDamageSkills(f.detail)) {
      if (!estPrisEnCharge(p) || !p.effetsEntreCoups?.length) continue;
      const effets = p.effetsEntreCoups.map(signature);
      const vu = trouve.get(p.skillCom2usId);
      if (vu && vu.effets.join(' ') !== effets.join(' ')) divergents.push(`${p.skillCom2usId} sur ${f.com2usId}`);
      if (vu) vu.porteurs.add(`${f.nom} (${f.element})`);
      else trouve.set(p.skillCom2usId, { nom: p.nom, effets, porteurs: new Set([`${f.nom} (${f.element})`]) });
      // Toute note d'un effet proposé est classée (rang ou condition).
      const c = competences.get(p.skillCom2usId);
      if (!c) {
        // Sort venu d'une autre forme ou d'une auxiliaire : seuls la Réduction
        // de DEF et la Marque, ou un lecteur propre au sort.
        if (p.effetsEntreCoups.some((e) => !e.effetCombat) && !p.bonusParEffetCible && !p.conditionsCombat?.length) {
          horsFiche.push(`${p.skillCom2usId} sur ${f.com2usId}`);
        }
        continue;
      }
      const proposes = new Set(p.effetsEntreCoups.map((x) => x.id));
      for (const e of c.effets) {
        if (e.type !== 'Debuff' || e.surSoi || !e.nom || !e.note || notes.has(e.note)) continue;
        const id = idEffetPosable(e.nom);
        if (id && proposes.has(id)) notesInconnues.push(`${c.com2usId} ${e.nom} « ${e.note} »`);
      }
    }
  }
  egal(divergents, [], 'un même sort propose les mêmes poses sur toutes ses formes jouables');
  egal(notesInconnues, [], 'chaque note d’un effet proposé est classée (rang ou condition)');
  egal(horsFiche, [], 'un sort hors de la fiche ne propose un effet qui ne fait que compter qu’avec son propre lecteur');

  const attenduParId = new Map(attendu.map((e) => [e.sort, e]));
  const manquants = attendu.filter((e) => !trouve.has(e.sort)).map((e) => `${e.sort} ${e.nom}`);
  const enTrop = [...trouve.keys()].filter((id) => !attenduParId.has(id)).map((id) => `${id} ${trouve.get(id)!.nom}`);
  egal(manquants, [], 'aucun sort de l’inventaire ne perd ses poses entre les coups');
  egal(enTrop, [], 'aucun sort hors de l’inventaire ne gagne de poses entre les coups (relire sa prose, puis l’ajouter)');
  const ecarts: string[] = [];
  for (const [id, v] of trouve) {
    const a = attenduParId.get(id);
    if (!a) continue;
    if (a.effets.join(' ') !== v.effets.join(' ')) ecarts.push(`${id} ${v.nom} : ${v.effets.join(' ')} au lieu de ${a.effets.join(' ')}`);
    const porteurs = [...v.porteurs].sort();
    if (porteurs.join('|') !== [...a.porteurs].sort().join('|')) ecarts.push(`${id} ${v.nom} : porteurs ${porteurs.join(', ')}`);
  }
  egal(ecarts, [], 'chaque sort de l’inventaire garde ses effets, leurs rangs et ses porteurs');
  egal(trouve.size, 279, 'témoin : 279 sorts des formes jouables proposent une pose entre leurs coups');
}

/** Chaque effet néfaste du corpus entier a sa traduction dans le calcul. */
export function testEffetsPosablesConnus() {
  titre('Effets entre les coups — tout effet néfaste du corpus est connu');
  const connus = new Set(nomsEffetsPosables());
  const inconnus = new Set<string>();
  for (const f of readdirSync(dossierSorts)) {
    if (!f.endsWith('.json')) continue;
    const d: DetailMonstre = JSON.parse(readFileSync(resolve(dossierSorts, f), 'utf8'));
    for (const c of d.competences) {
      for (const e of c.effets) if (e.type === 'Debuff' && e.nom && !connus.has(e.nom)) inconnus.add(e.nom);
    }
  }
  egal([...inconnus].sort(), [], 'aucun effet `Debuff` du corpus n’échappe à la règle faute de libellé');
}

/** Rangs, exceptions de la prose, coups en plus et calcul. */
export function testEffetsEntreCoupsRegle() {
  titre('Effets entre les coups — rangs, exceptions et calcul');

  // Sans rang écrit, chaque coup avant le dernier pose.
  const ratHunt = profil(1601);
  egal(rangsDePoseProposes(ratHunt, ratHunt.effetsEntreCoups![0], CIBLE), [1], 'Rat Hunt (2 coups) : après le coup 1 seulement');
  const crushing = profil(4006);
  egal(rangsDePoseProposes(crushing, crushing.effetsEntreCoups![0], CIBLE), [1, 2, 3], 'Crushing Rocks (4 coups) : après les coups 1, 2 ou 3');

  // Rang de la prose (Cichlid) : une pose ailleurs n'a pas lieu.
  const cichlid = profil(10413);
  const cichlidSans = total(cichlid, CIBLE);
  egal(rangsDePoseProposes(cichlid, cichlid.effetsEntreCoups![0], CIBLE), [2], 'Crushed Hopes : seul le coup 2 pose (prose)');
  egal(total(cichlid, avecPose(cichlid, { 'decrease-def': 1 })), cichlidSans, 'Crushed Hopes : une pose demandée après le coup 1 est ignorée');
  ok(total(cichlid, avecPose(cichlid, { 'decrease-def': 2 })) > cichlidSans, 'Crushed Hopes : posée après le coup 2, le coup 3 la subit');

  // Rangs de la note, unis (PPK Combo : « 4th hit only », « 5th hit if removed buff »).
  const ppk = profil(13915);
  const ppkDef = ppk.effetsEntreCoups!.find((e) => e.id === 'decrease-def')!;
  egal(rangsDePoseProposes(ppk, ppkDef, CIBLE), [4, 5], 'PPK Combo : après le coup 4 ou 5 seulement');
  egal(libelleEffetEntreCoups(ppkDef), 'Réduction de DEF', 'PPK Combo : la note « 5th hit if removed buff » pose une condition que la prose n’a pas (la prose fait foi)');
  const ppkSans = total(ppk, CIBLE);
  egal(total(ppk, avecPose(ppk, { 'decrease-def': 1 })), ppkSans, 'PPK Combo : une pose après le coup 1 est ignorée');
  ok(total(ppk, avecPose(ppk, { 'decrease-def': 4 })) > ppkSans, 'PPK Combo : posée après le coup 4, les coups 5 et 6 la subissent');

  // Posé au DERNIER coup seulement : rien à proposer.
  for (const id of [20215, 20815, 23308, 23309]) {
    ok(!profil(id).effetsEntreCoups?.length, `${id} ${profil(id).nom} : l’effet du dernier coup n’est pas proposé`);
  }

  // Prose contre donnée : Soul Summoning (« decrease the enemy's Attack Speed »).
  for (const id of [7501, 7503]) {
    const c = competence(id);
    ok(!!c?.effets.some((e) => e.nom === 'Decrease DEF'), `Soul Summoning ${id} : témoin, la donnée porte \`Decrease DEF\``);
    ok(!profil(id).effetsEntreCoups?.some((e) => e.id === 'decrease-def'), `Soul Summoning ${id} : la prose fait foi, aucune Réduction de DEF`);
  }

  // Prose seule : Solveig et Berghild, Marque au coup 1.
  for (const id of [18007, 18009]) {
    const c = competence(id);
    ok(!c?.effets.some((e) => e.nom === 'Brand'), `Axe Technique ${id} : témoin, la donnée n’a pas \`Brand\``);
    const p = profil(id);
    const marque = p.effetsEntreCoups?.find((e) => e.id === 'brand');
    egal(marque?.coups, [1], `Axe Technique ${id} : Marque posée au coup 1 (prose)`);
    ok(total(p, avecPose(p, { brand: 1 })) > total(p, CIBLE), `Axe Technique ${id} : la Marque du coup 1 majore le coup 2`);
  }

  // Effets qui ne font que compter : proposés seulement avec un lecteur.
  ok(!!profil(1153).effetsEntreCoups?.some((e) => e.id === 'stun'), 'Gust (Aeilene) : l’Étourdissement compte pour Spirit’s Wrath, monstre-wide');
  egal(profil(19708).effetsEntreCoups?.map((e) => e.id), ['decrease-def', 'decrease-spd', 'beneficial-effects-blocked'],
    'Virus de 570RM : les trois effets comptent pour Backup Code');
  egal(profil(19707).effetsEntreCoups?.map((e) => e.id), ['decrease-def'], 'Virus de 7R1X : sans lecteur, la Réduction de DEF seule');
  egal(profil(3454).effetsEntreCoups?.map(signature), ['decrease-def@1'], 'Blackout Kick (Sia) : la Réduction d’ATQ du coup 2 ne compte pour rien');

  // Précisions : coup critique (donnée), état Thunderer (note ou prose).
  egal(libelleEffetEntreCoups(profil(1212).effetsEntreCoups![0]), 'Réduction de DEF (sur coup critique)', 'Triple Attack (Cogma) : sur coup critique');
  for (const id of [18127, 18128, 18129]) {
    egal(libelleEffetEntreCoups(profil(id).effetsEntreCoups![0]), 'Marque (en état Thunderer)', `Wild Bolt ${id} : en état Thunderer`);
  }

  // Deux dégâts continus par coup (Meteor Strike, Black Meteor) : `nombre: 2`.
  egal(profil(19215).effetsEntreCoups?.map(signature), ['continuous-damagex2'], 'Meteor Strike : deux dégâts continus par coup');
  // … et le compte en tient : Full Burst (+10 % par effet nocif) avec une pose
  // qui en ajoute deux vaut une cible qui en porte deux de plus.
  const fullBurst = profil(15315);
  const double: SkillDamageProfile = {
    ...fullBurst,
    effetsEntreCoups: fullBurst.effetsEntreCoups!.map((e) => ({ ...e, nombre: 2 })),
  };
  const un = total(fullBurst, avecPose(fullBurst, { 'continuous-damage': 1 }));
  const deux = total(double, avecPose(double, { 'continuous-damage': 1 }));
  const temoin = total(double, {
    ...avecPose(double, { 'continuous-damage': 1 }),
    effetsCibleCount: { [fullBurst.skillCom2usId]: 0 },
    effetsCibleCountAutres: true,
  });
  ok(deux > un, 'Full Burst : une pose de deux dégâts continus pèse plus qu’une pose d’un seul');
  egal(deux, temoin, 'Full Burst : témoin, même total avec le compte explicite à zéro');

  // Coups variables saisis : les rangs suivent le nombre de coups retenu.
  const pluie = profil(10512);
  egal(rangsDePoseProposes(pluie, pluie.effetsEntreCoups![0], CIBLE), [1, 2], 'Rain of Stones, 3 coups : après le coup 1 ou 2');
  egal(rangsDePoseProposes(pluie, pluie.effetsEntreCoups![0], { ...CIBLE, coupsPersonnalises: { 10512: 5 } }), [1, 2, 3, 4],
    'Rain of Stones, 5 coups : après les coups 1 à 4');

  // Coups en plus créés par la pose (Whirlpool, Water Dragon Surge) : le Gel du
  // coup 1 donne deux coups contre une cible affligée.
  for (const id of [21311, 21911]) {
    const p = profil(id);
    const gel = p.effetsEntreCoups!.find((e) => e.id === 'freeze')!;
    egal(p.effetsEntreCoups?.map(signature), ['freeze@1'], `${p.nom} : le Gel du coup 1 seul (les dégâts continus des coups en plus ne changent rien)`);
    egal(rangsDePoseProposes(p, gel, CIBLE), [1], `${p.nom} : le Gel se pose au coup 1, même si le sort n’a qu’un coup de base`);
    egal(resolvedHits(p, CIBLE), 1, `${p.nom} : sans scénario, un coup`);
    const pose = avecPose(p, { freeze: 1 });
    egal(resolvedHits(p, pose), 3, `${p.nom} : Gel posé au coup 1, trois coups`);
    egal(resolvedHits(p, { ...pose, scenariosEffetsEntreCoups: { [id]: { actif: false, apresCoup: { freeze: 1 } } } }), 1,
      `${p.nom} : scénario éteint, rien n’est supposé posé`);
    const interrupteur = total(p, { ...CIBLE, passifsOffensifs: { [id]: true } });
    ok(Math.abs(total(p, pose) - interrupteur) < 1e-6, `${p.nom} : Gel posé au coup 1 = l’interrupteur « la cible porte un effet nocif »`);
  }

  // Water Dragon Attack : le premier coup pose aussi la Réduction de DEF
  // (utilisateur, 2026-11-02) ; ses coups au hasard se règlent à part.
  const xiaoLin = profil(8211);
  egal(rangsDePoseProposes(xiaoLin, xiaoLin.effetsEntreCoups![0], CIBLE), [1, 2, 3], 'Water Dragon Attack : après le coup 1, 2 ou 3');
  egal(libelleEffetEntreCoups(profil(11507).effetsEntreCoups![0]), 'Réduction de DEF (un seul des effets possibles par coup, au hasard)',
    'Ghost Appearance : un seul effet au hasard par coup, comme Virus');

  // Séquence curée : Fatal Mortar Bullet (Scarlett) pose Réduction de DEF et
  // Marque au coup 1, mono-cible ; la phase de zone (coup 2) les subit.
  const scarlett = profil(13312);
  egal(scarlett.effetsEntreCoups?.map(signature), ['decrease-def@1', 'brand@1'], 'Fatal Mortar Bullet : Réduction de DEF et Marque au coup 1, avant la phase de zone');
  egal(rangsDePoseProposes(scarlett, scarlett.effetsEntreCoups![1], CIBLE), [1], 'Fatal Mortar Bullet : la séquence compte deux coups');
  const scarlettSans = total(scarlett, CIBLE);
  const scarlettMarque = total(scarlett, avecPose(scarlett, { brand: 1 }));
  ok(scarlettMarque > scarlettSans, 'Fatal Mortar Bullet : la Marque du coup 1 majore la phase de zone');
  ok(scarlettMarque < total(scarlett, { ...CIBLE, brand: true }), 'Fatal Mortar Bullet : … mais pas le coup 1 lui-même');
  const secondaire: DamageSetup = { ...CIBLE, cibleDegatsParSort: { 13312: 'secondaire' } };
  egal(total(scarlett, avecPose(scarlett, { brand: 1 }, secondaire)), total(scarlett, secondaire),
    'Fatal Mortar Bullet, autres ennemis : la Marque posée sur la cible visée ne les touche pas');
  ok(!profil(9515).effetsEntreCoups?.length, 'Undefeated Warrior : la Réduction de DEF de la phase de zone, la dernière, n’est pas proposée');

  // L'Étourdissement d'un coup allume le +50 % « cible sous incapacité » des suivants.
  for (const id of [6811, 2910]) {
    const p = profil(id);
    const stun = p.effetsEntreCoups?.find((e) => e.id === 'stun');
    ok(!!stun?.allumeLeBoutonDuSort, `${p.nom} : l’Étourdissement est proposé et allume le bonus du sort`);
    const sans = total(p, CIBLE);
    const bonus = total(p, { ...CIBLE, passifsOffensifs: { [id]: true } });
    const pose = total(p, avecPose(p, { stun: 1 }));
    // Coups égaux : coup 1 sans bonus, les (n − 1) suivants avec.
    ok(Math.abs(pose - (sans + (p.hits - 1) * bonus) / p.hits) < 1e-6 * sans,
      `${p.nom} : Étourdissement posé au coup 1 = coup 1 sans le +50 %, les ${p.hits - 1} suivants avec`);
  }

  // Effets posés par un PASSIF à chaque attaque.
  const shaina = profil(12602);
  egal(shaina.effetsEntreCoups?.map((e) => libelleEffetEntreCoups(e)), ['Réduction de DEF (par Precision)'], 'Crescent Moon Slash (Shaina) : la Réduction de DEF de Precision');
  ok(total(shaina, avecPose(shaina, { 'decrease-def': 1 })) > total(shaina, CIBLE), 'Crescent Moon Slash : posée au coup 1, le coup 2 la subit');
  egal(profil(10007).effetsEntreCoups?.map((e) => e.id), ['decrease-def'],
    'Triple Crush (Tesarion) : l’Oubli d’Ancient Power, posé à la fin de l’attaque, n’est pas proposé (utilisateur)');
  egal(profil(5660).effetsEntreCoups?.map((e) => e.id), ['decrease-def'], 'Surprise Attack (Jultan) : sans lecteur, les dégâts continus du passif ne sont pas proposés');
  ok(!profil(10510).effetsEntreCoups?.length,
    'Spear of Devastation (Manannan) : les dégâts continus de King of the Ruins, qui visent les autres ennemis (utilisateur, 2026-11-02), ne sont pas proposés');
  egal(libelleEffetEntreCoups(profil(12101).effetsEntreCoups![0]), 'Réduction de DEF (sur un 5 au dé)', 'Roll Dice : la Réduction de DEF sur un 5 au dé');
  egal(profil(18129).effetsEntreCoups?.map((e) => libelleEffetEntreCoups(e)),
    ['Marque (en état Thunderer)', 'Réduction de DEF (par Might · Thunder, en état Thunderer)'], 'Wild Bolt (Dyeus) : la Marque du sort et la Réduction de DEF du passif');

  // Scratch (Raoq) : 1 à 10 coups saisis, la réduction de DEF à chaque coup.
  const scratch = profil(2052);
  egal(rangsDePoseProposes(scratch, scratch.effetsEntreCoups![0], CIBLE), [], 'Scratch : un coup par défaut, rien à poser');
  egal(rangsDePoseProposes(scratch, scratch.effetsEntreCoups![0], { ...CIBLE, coupsPersonnalises: { 2052: 4 } }), [1, 2, 3],
    'Scratch, 4 coups saisis : après les coups 1 à 3');

  // Sans pose réussie, rien ne change, sur tout l'inventaire.
  const ecarts: string[] = [];
  const vus = new Set<number>();
  for (const f of formes()) {
    for (const p of monsterDamageSkills(f.detail)) {
      if (!estPrisEnCharge(p) || !p.effetsEntreCoups?.length || vus.has(p.skillCom2usId)) continue;
      vus.add(p.skillCom2usId);
      const sans = total(p, CIBLE);
      const actifSansReussite = total(p, { ...CIBLE, scenariosEffetsEntreCoups: { [p.skillCom2usId]: { actif: true } } });
      // Sous scénario actif, le sort se calcule coup par coup : une somme de
      // tronçons, pas une multiplication (Wild Shot! : 8 coups, rapport
      // 0,9999999999999998) — d'où la tolérance relative.
      if (Math.abs(sans - actifSansReussite) > 1e-12 * Math.abs(sans)) ecarts.push(`${p.skillCom2usId} ${p.nom}`);
    }
  }
  egal(ecarts, [], 'scénario actif sans réussite : total inchangé, pour chaque sort de l’inventaire');
}

// Le score complet d'un réglage, comme le moteur et le CLI : sort, passifs et
// modificateurs du monstre (`buildRealDamageContext`).
function scoreComplet(forme: number, setup: Partial<DamageSetup>): number {
  const recette = { objective: 'degats_reels', damageSetup: { ...CIBLE, ...setup } } as unknown as OptimizerRecipe;
  const ctx = buildRealDamageContext(recette, forme, []);
  if (!ctx) throw new Error(`aucun contexte « Dégâts réels » pour ${forme}`);
  return computeTotalDamage(
    ctx.profile, ctx.passifs, BUILD, ctx.setup, AUCUNE_AURA_PROPRE, ctx.element, ctx.artefacts, ctx.critSiPlusRapide,
    ctx.bonusDegatsSelonVit, ctx.bonusDegatsStack, ctx.monsterWide, ctx.bonusDegatsConditionnel, ctx.bonusDegatsSelonCr,
    ctx.bonusDegatsSelonDef, ctx.bonusSiAtqSeuil
  );
}
const proche = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

// Le même score, le bonus d'écart de DEF de Martial Arts Specialist retiré.
function scoreSansEcartDeDef(forme: number, setup: Partial<DamageSetup>): number {
  const recette = { objective: 'degats_reels', damageSetup: { ...CIBLE, ...setup } } as unknown as OptimizerRecipe;
  const ctx = buildRealDamageContext(recette, forme, []);
  if (!ctx) throw new Error(`aucun contexte « Dégâts réels » pour ${forme}`);
  return computeTotalDamage(
    ctx.profile, ctx.passifs, BUILD, ctx.setup, AUCUNE_AURA_PROPRE, ctx.element, ctx.artefacts, ctx.critSiPlusRapide,
    ctx.bonusDegatsSelonVit, ctx.bonusDegatsStack, { ...ctx.monsterWide, bonusEcartDef: undefined }, ctx.bonusDegatsConditionnel, ctx.bonusDegatsSelonCr,
    ctx.bonusDegatsSelonDef, ctx.bonusSiAtqSeuil
  );
}

/** Les mécaniques ajoutées à la demande de l'utilisateur (2026-11-02). */
export function testEffetsEntreCoupsMecaniques() {
  titre('Effets entre les coups — coups au hasard, séquences, lecteurs, ralentissement, attaque enchaînée');

  // ── Coups au hasard : le joueur choisit combien touchent la cible ──
  const xiaoLin = profil(8211);
  egal([xiaoLin.hits, xiaoLin.hitsRange], [4, { min: 1, max: 4, defaut: 4 }], 'Water Dragon Attack : 1 à 4 coups sur la cible, tous par défaut');
  ok(coupsAuHasard(8211) && !coupsAuHasard(8113), 'coups au hasard : Water Dragon Attack oui, Phoenix Kick non');
  egal([profil(6013).hits, profil(6013).hitsRange?.max], [3, 4], 'Katarina : 3 coups par défaut (1 + 2), 4 au plus');
  egal([profil(25815).hits, profil(25815).hitsRange?.max], [3, 4], 'Splash Splash : 3 coups par défaut (1 + 2), 4 au plus');
  const un = total(xiaoLin, { ...CIBLE, coupsPersonnalises: { 8211: 1 } });
  ok(proche(total(xiaoLin, CIBLE), 4 * un), 'Water Dragon Attack : 4 coups sur la cible = 4 fois le coup seul');

  // Katarina : sous Invincibilité tous les coups ignorent la DEF, sinon aucun.
  const katarina = profil(6013);
  ok(!katarina.ignoreDef, 'Katarina : pas d’ignore DEF permanent');
  ok(total(katarina, { ...CIBLE, passifsOffensifs: { 6013: true } }) > total(katarina, CIBLE), 'Katarina : « sous Invincibilité » allumé, la DEF est ignorée');

  // Fei : chaque coup coché ignore la DEF.
  const fei = profil(8215);
  ok(!!fei.ignoreDefParCoupChoisi && !fei.ignoreDef, 'Fei : ignore DEF choisi coup par coup, aucun par défaut');
  const feiSans = total(fei, CIBLE);
  const feiTous = total(fei, { ...CIBLE, coupsIgnorantDefParSort: { 8215: [1, 2, 3, 4] } });
  const feiDeux = total(fei, { ...CIBLE, coupsIgnorantDefParSort: { 8215: [2, 4] } });
  ok(proche(feiDeux, (feiSans + feiTous) / 2), 'Fei : deux coups cochés sur quatre = la moitié du chemin entre aucun et tous');
  ok(proche(total(fei, { ...CIBLE, coupsPersonnalises: { 8215: 2 }, coupsIgnorantDefParSort: { 8215: [3, 4] } }), total(fei, { ...CIBLE, coupsPersonnalises: { 8215: 2 } })),
    'Fei : un coup coché au-delà des coups sur la cible n’a pas lieu');

  // ── Séquences : PPK Combo, cible visée et autres ennemis ──
  const ppk = profil(13915);
  egal(ppk.sequenceDeCoups?.map((g) => [g.coups, g.zone]), [[4, false], [2, true]], 'PPK Combo : 4 coups sur la cible, puis 2 en zone');
  ok(cibleSecondairePriseEnCharge(13915) && cibleSecondairePriseEnCharge(14415) && cibleSecondairePriseEnCharge(10613), 'PPK Combo, Chain Combo Attack et Tempest Sword : « autres ennemis » proposé');
  ok(!cibleSecondairePriseEnCharge(22714), 'Bullet Assassination, toute en zone : pas de cible secondaire');
  const autres: DamageSetup = { ...CIBLE, cibleDegatsParSort: { 13915: 'secondaire' } };
  const ppkDef = ppk.effetsEntreCoups!.find((e) => e.id === 'decrease-def')!;
  egal(rangsDePoseProposes(ppk, ppkDef, autres), [5], 'PPK Combo, autres ennemis : seule la Réduction de DEF du coup 5 les touche');
  egal(total(ppk, avecPose(ppk, { 'decrease-def': 4 }, autres)), total(ppk, autres), 'PPK Combo, autres ennemis : la pose du coup 4 ne les atteint pas');
  ok(total(ppk, avecPose(ppk, { 'decrease-def': 5 }, autres)) > total(ppk, autres), 'PPK Combo, autres ennemis : la pose du coup 5 majore le coup 6');
  const tempest = profil(10613);
  egal(tempest.sequenceDeCoups?.map((g) => [g.coups, g.zone]), [[2, false], [1, true]], 'Tempest Sword : 2 coups sur la cible, le 3ᵉ en zone');
  egal(rangsDePoseProposes(tempest, tempest.effetsEntreCoups![0], CIBLE), [1, 2], 'Tempest Sword : la Marque aux coups 1 et 2');

  // ── Fatal Mortar Bullet : +25 % par effet sur la cible, phase de zone seule ──
  const scarlett = profil(13312);
  const zone = scarlett.sequenceDeCoups!;
  ok(zone[0].horsLecteurs === true && !zone[1].horsLecteurs, 'Fatal Mortar Bullet : seule la phase de zone lit les effets de la cible');
  const s0 = total(scarlett, CIBLE);
  const s2 = total(scarlett, { ...CIBLE, effetsCibleCount: { 13312: 2 }, effetsCibleCountAutres: true });
  ok(s2 > s0, 'Fatal Mortar Bullet : deux effets sur la cible majorent le total');
  ok(total(scarlett, avecPose(scarlett, { brand: 1, 'decrease-def': 1 })) > total(scarlett, avecPose(scarlett, { brand: 1 })),
    'Fatal Mortar Bullet : Marque et Réduction de DEF du coup 1 comptent toutes deux pour la phase de zone');

  // ── Lecteurs ──
  // Yoga Sunburst : +50 % par dégât continu, les seuls dégâts continus.
  const yoga = profil(14213);
  egal(yoga.bonusParEffetCible?.source, 'degatsContinus', 'Yoga Sunburst : compte des dégâts continus seuls');
  egal(yoga.effetsEntreCoups?.map((e) => e.id), ['continuous-damage'], 'Yoga Sunburst : l’Étourdissement, qui ne compte pas, n’est pas proposé');
  egal(total(yoga, { ...CIBLE, brand: true }), total(yoga, { ...CIBLE, brand: true, effetsCibleCount: {} }), 'Yoga Sunburst : la Marque n’entre pas dans le compte');
  ok(total(yoga, avecPose(yoga, { 'continuous-damage': 1 })) > total(yoga, CIBLE), 'Yoga Sunburst : un dégât continu posé au coup 1 majore les coups 2 et 3');

  // Havoc : 5 % des PV max de la cible par dégât continu, à chaque coup, en brut.
  const havoc = profil(25212);
  egal(havoc.brutParEffetCible?.source, 'degatsContinus', 'Reelseiden・Havoc : dégâts bruts par dégât continu');
  const h0 = total(havoc, CIBLE);
  const h1 = total(havoc, { ...CIBLE, effetsCibleCount: { 25212: 1 } });
  ok(proche(h1 - h0, 3 * 0.05 * CIBLE.enemyHp), 'Reelseiden・Havoc : un dégât continu = 5 % des PV max de la cible à chacun des 3 coups');

  // Kiki : 4 % de SES PV max par effet nocif, 2 au plus, à chaque coup.
  const kiki = profil(15105);
  egal(kiki.brutParEffetCible?.cle, 15115, 'Magical Eye (Kiki) : règle de Start of Pain, compteur sous la clé du passif');
  const k0 = total(kiki, CIBLE);
  const k3 = total(kiki, { ...CIBLE, effetsCibleCount: { 15115: 3 }, effetsCibleCountAutres: true });
  ok(proche(k3 - k0, kiki.hits * 2 * 0.04 * 20000), 'Kiki : trois effets saisis, deux comptés : 8 % de ses PV max à chaque coup');
  const kPose = total(kiki, { ...avecPose(kiki, { 'decrease-atk': 1 }), effetsCibleCount: { 15115: 1 }, effetsCibleCountAutres: true });
  const k1 = total(kiki, { ...CIBLE, effetsCibleCount: { 15115: 1 }, effetsCibleCountAutres: true });
  ok(proche(kPose - k1, 0.04 * 20000), 'Kiki : la baisse d’ATQ posée au coup 1 ajoute 4 % de ses PV max au coup 2');
  ok(statsPrivilegiees(25215, 15105).includes('hp'), 'Kiki : ses PV max sont une stat que la recherche privilégie');

  // Amber : 4 % des PV max de la cible par effet nocif, 3 au plus ; Irrécupérable à chaque attaque.
  const amber = profil(15901);
  egal(amber.effetsEntreCoups?.map((e) => e.id).sort(), ['decrease-spd', 'unrecoverable'], 'Swift Slash (Amber) : ralentissement du sort, Irrécupérable de Nano Vision');
  ok(total(amber, avecPose(amber, { unrecoverable: 1 })) > total(amber, CIBLE), 'Amber : l’Irrécupérable du coup 1 ajoute 4 % des PV max de la cible au coup 2');

  // Bullet Assassination : +25 % des PV max de la cible au dernier coup, si un effet nocif.
  const nina = profil(22714);
  egal(nina.sequenceDeCoups?.map((g) => [g.coups, !!g.horsLecteurs]), [[3, true], [1, false]], 'Bullet Assassination : le dernier coup seul lit l’effet nocif');
  const n0 = total(nina, CIBLE);
  ok(proche(total(nina, avecPose(nina, { seal: 1 })) - n0, 0.25 * CIBLE.enemyHp), 'Bullet Assassination : le Sceau du coup 1 déclenche 25 % des PV max au dernier coup');

  // Critical Link : la bête convertit les effets bénéfiques en dégâts continus.
  const savannah = profil(13608);
  const cl = (nombre: number) => total(savannah, {
    ...CIBLE, scenariosEffetsEntreCoups: { 13608: { actif: true, apresCoup: { 'continuous-damage': 1 }, nombres: { 'continuous-damage': nombre } } },
  });
  ok(cl(2) > cl(1) && cl(1) > cl(0) && proche(cl(0), total(savannah, CIBLE)), 'Critical Link : chaque effet bénéfique converti ajoute un effet nocif au coup du cavalier');

  // Hairpin: Black Flash : +100 % au coup 2 seul si un effet nocif.
  const nobara = profil(20315);
  const nSans = total(nobara, CIBLE);
  ok(proche(total(nobara, { ...CIBLE, passifsOffensifs: { 20315: true } }), nSans * 1.5), 'Hairpin: Black Flash : « la cible porte un effet nocif » double le seul coup 2 (× 1,5 sur deux coups égaux)');

  // Arrow of Water : l'Étourdissement allume le +50 % des coups suivants.
  // (vérifié dans `testEffetsEntreCoupsRegle`.)

  // ── Ralentissement : −30 % de la VIT adverse pour les coups suivants ──
  const chunLi = 24414;
  const vit = { ...CIBLE, skillCom2usId: 14309, enemySpd: 150 };
  const sansSlow = scoreComplet(chunLi, vit);
  const slow = scoreComplet(chunLi, { ...vit, scenariosEffetsEntreCoups: { 14309: { actif: true, apresCoup: { 'decrease-spd': 1 } } } });
  ok(slow > sansSlow, 'Spinning Bird Kick (Chun-Li lumière) : le ralentissement du coup 1 creuse l’écart de VIT pour le coup 2');
  ok(slow < scoreComplet(chunLi, { ...vit, enemySpd: 105 }), 'Spinning Bird Kick : … mais le coup 1 garde la VIT d’avant');

  // ── Empathy (Übel ténèbres) : Marque ou Réduction de DEF, au choix ──
  egal(profil(25210).effetsEntreCoups?.map((e) => e.id).sort(), ['brand', 'decrease-def'], 'Reelseiden・Flurry (Übel ténèbres) : Marque ou Réduction de DEF d’Empathy');

  // ── Shoryuken : Marque posée pour [Hadoken] enchaîné ──
  const ryu = 24012;
  const avecHadoken: Partial<DamageSetup> = { skillCom2usId: 13907, passifsOffensifs: { 13902: true } };
  const sansMarque = scoreComplet(ryu, avecHadoken);
  const avecMarque = scoreComplet(ryu, { ...avecHadoken, scenariosEffetsEntreCoups: { 13907: { actif: true, apresCoup: { brand: 1 } } } });
  ok(avecMarque > sansMarque, 'Shoryuken : « Marque posée » majore [Hadoken] enchaîné');
  const sansHadoken = scoreComplet(ryu, { skillCom2usId: 13907 });
  egal(scoreComplet(ryu, { skillCom2usId: 13907, scenariosEffetsEntreCoups: { 13907: { actif: true, apresCoup: { brand: 1 } } } }), sansHadoken,
    'Shoryuken : sans [Hadoken], la Marque posée au dernier coup ne change rien au sort');

  // ── Sin feu : l'écart de DEF de Martial Arts Specialist se prend sur la DEF
  // réduite (utilisateur, 2026-11-02). DEF 800 contre 1 500 : aucun écart sans
  // Réduction de DEF, 800 − 450 = 350 sous elle.
  const SIN = 20212;
  const comboSans = { skillCom2usId: 11007 };
  const comboPose = { skillCom2usId: 11007, scenariosEffetsEntreCoups: { 11007: { actif: true, apresCoup: { 'decrease-def': 1 } } } };
  ok(proche(scoreComplet(SIN, comboSans), scoreSansEcartDeDef(SIN, comboSans)), 'Sin feu : DEF de la cible plus haute, aucun bonus d’écart');
  ok(scoreComplet(SIN, comboPose) > scoreSansEcartDeDef(SIN, comboPose) + 1, 'Sin feu : la Réduction de DEF posée au coup 1 ouvre l’écart de DEF pour les coups 2 et 3');
  ok(scoreComplet(SIN, { ...comboSans, defBreak: true }) > scoreSansEcartDeDef(SIN, { ...comboSans, defBreak: true }) + 1, 'Sin feu : l’interrupteur Brise DEF ouvre lui aussi l’écart');
}

// Les stats que la recherche privilégie pour ce sort (`damageRelevantStats`).
function statsPrivilegiees(forme: number, sort: number): string[] {
  const recette = { objective: 'degats_reels', damageSetup: { ...CIBLE, skillCom2usId: sort } } as unknown as OptimizerRecipe;
  const ctx = buildRealDamageContext(recette, forme, []);
  if (!ctx) return [];
  return statsDuLanceurLuesParLaNote(ctx);
}
