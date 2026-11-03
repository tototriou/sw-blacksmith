// Le vocabulaire du JEU en français — les libellés du client français de
// Summoners War, jamais une traduction faite par l'app.
// Décision : docs/04-decisions/adr/traductions-par-dictionnaires.md.
// Fonctionnement : docs/02-app/transverse/feat-langues.md.
//
// ⚠️ **Source : le relevé de Thomas dans le jeu (2026-10-31)**, ses réponses
// et les captures des filtres du jeu ; ses réponses priment sur les captures
// (« Étourdi », pas « Assommer »). Un terme qu'on n'a pas relevé ne s'invente
// pas : il garde le libellé anglais de SWARFARM et va au registre des manques
// (`EFFETS_SANS_TRADUCTION`, tests/lexique-jeu.test.ts).
//
// ⚠️ Forme longue quand il y a la place, forme courte quand il n'y en a pas
// (`court`), comme dans le jeu : la courte est celle des filtres du jeu.

import type { StatKey } from '../../lib/effects';

// Un terme et, s'il en a une, sa forme courte.
export interface Terme {
  long: string;
  court?: string;
}

// Les sets de runes, par clé (`RUNE_SETS`, src/types.ts). Féminins, comme
// « rune » : « Violente », « Fatale ».
const sets = {
  swift: 'Rapide',
  violent: 'Violente',
  despair: 'Désespoir',
  will: 'Volonté',
  rage: 'Rage',
  fatal: 'Fatale',
  blade: 'Lame',
  energy: 'Énergie',
  guard: 'Gardien',
  focus: 'Focus',
  endure: 'Endurance',
  vampire: 'Vampire',
  nemesis: 'Némésis',
  shield: 'Protection',
  revenge: 'Vengeance',
  destroy: 'Destruction',
  fight: 'Combat',
  determination: 'Détermination',
  enhance: 'Amélioration',
  accuracy: 'Précision',
  tolerance: 'Tolérance',
  seal: 'Sceau',
  intangible: 'Intangible',
};

export type CleSet = keyof typeof sets;

export const jeuFr = {
  sets,

  // Les objets d'amélioration des runes (sous-pages du Compte).
  objets: { meules: 'Meules', gemmes: 'Gemmes' },

  // Les stats, par clé. Le filtre de runes du jeu écrit « Tx critiq. » et
  // « Dgts critiq. ».
  stats: {
    hp: 'PV',
    atk: 'ATQ',
    def: 'DEF',
    spd: 'VIT',
    cr: 'Tx critiq.',
    cd: 'Dgts critiq.',
    res: 'RES',
    acc: 'Précision',
  } satisfies Record<StatKey, string>,

  // Une stat de rune dans un CHOIX (filtre, sélecteur), par code d'effet com2us :
  // le filtre du jeu distingue la valeur fixe (« PV + ») du pourcentage
  // (« PV % »). Sur la ligne d'une rune, c'est le nom de la stat (`stats`).
  choixStat: {
    1: 'PV +',
    2: 'PV %',
    3: 'ATQ +',
    4: 'ATQ %',
    5: 'DEF +',
    6: 'DEF %',
    8: 'VIT',
    9: 'Tx critiq.',
    10: 'Dgts critiq.',
    11: 'RES',
    12: 'Précision',
  } as Record<number, string>,

  // Les grades : le mot du jeu, et l'abréviation des tuiles trop étroites.
  grades: {
    1: { long: 'Commun', court: 'Com' },
    2: { long: 'Magique', court: 'Mag' },
    3: { long: 'Rare', court: 'Rare' },
    4: { long: 'Héroïque', court: 'Hér' },
    5: { long: 'Légendaire', court: 'Lég' },
  } as Record<number, Terme>,

  elements: {
    fire: 'Feu',
    water: 'Eau',
    wind: 'Vent',
    light: 'Lumière',
    dark: 'Ténèbres',
    unknown: 'Autre',
  },

  archetypes: {
    attack: 'Attaque',
    defense: 'Défense',
    hp: 'PV',
    support: 'Support',
    material: 'Matériau',
  },

  // Les deux sortes d'artéfact.
  sortesArtefact: { element: 'Attribut', archetype: 'Type' },

  // Les zones d'un leader skill (`area` de SWARFARM).
  zonesLead: {
    General: 'Général',
    Element: 'Élément',
    Arena: 'Arène',
    Guild: 'Guilde',
    Dungeon: 'Donjon',
  },

  // L'effet d'un set, pour la ligne « 4 Set : … » d'une rune : le texte de
  // l'app, sauf Vampire (« Drain de vie ») et Sceau, relevés en jeu. ⚠️ Les valeurs
  // sont celles du CALCUL de l'app : Précision et Tolérance y valent encore
  // +8 % (le jeu affiche +10 % : correction du calcul à part, voir
  // docs/02-app/degats-reels/valeurs-de-jeu-curees.md).
  bonusSets: {
    swift: 'VIT +25%',
    violent: 'Chance de tour supplémentaire 22%',
    despair: "Chance d'étourdissement 25%",
    rage: 'Dégâts critiques +40%',
    fatal: 'ATQ +35%',
    vampire: 'Drain de vie 35%',
    energy: 'PV +15%',
    guard: 'DEF +15%',
    blade: 'Taux critique +12%',
    focus: 'Précision +20%',
    endure: 'Résistance +20%',
    will: 'Immunité 1 tour',
    nemesis: "Barre d'action +4% par 7% de PV perdus",
    shield: 'Bouclier 3 tours (15% PV)',
    revenge: 'Chance de contre-attaque +15%',
    destroy: 'Détruit 4% des PV max ennemi',
    fight: 'ATQ alliés +8%',
    determination: 'DEF alliés +8%',
    enhance: 'PV alliés +8%',
    accuracy: 'Précision alliés +8%',
    tolerance: 'Résistance alliés +8%',
    seal: 'Scellement au premier coup, 25% de chance',
    // Pas un texte du jeu : l'Intangible n'a pas d'effet propre, l'app dit ce
    // qu'il fait.
    intangible: 'Joker (complète un set)',
  } as Record<string, string>,
  // « 4 Set : VIT +25% ».
  piedSet: (pieces: number, bonus: string) => `${pieces} Set : ${bonus}`,

  // Les sous-propriétés d'artéfact, par code com2us : les libellés de
  // l'inventaire du jeu, abréviations comprises (« Drain de vie », « Dgts supp.
  // en prop. de »). `v` = la valeur.
  sousProprietes: {
    200: (v: number) => `ATQ + selon PV perdus, jusqu'à +${v}%`,
    201: (v: number) => `DEF + selon PV perdus, jusqu'à +${v}%`,
    202: (v: number) => `VIT + selon PV perdus, jusqu'à +${v}%`,
    203: (v: number) => `VIT sous effet d'incapacité +${v}%`,
    204: (v: number) => `Effet renforcement ATQ +${v}%`,
    205: (v: number) => `Effet renforcement DEF +${v}%`,
    206: (v: number) => `Effet aug. VIT +${v}%`,
    207: (v: number) => `Effet aug. taux CRIT +${v}%`,
    208: (v: number) => `Dgts de contre-attaque +${v}%`,
    209: (v: number) => `Dgts d'attaque conjointe +${v}%`,
    210: (v: number) => `Dgts de bombe +${v}%`,
    211: (v: number) => `Dgts de réflexion +${v}%`,
    212: (v: number) => `Dgts de coup dévastateur +${v}%`,
    213: (v: number) => `Dgts reçus sous incapacité -${v}%`,
    214: (v: number) => `Dgts CRIT reçus -${v}%`,
    215: (v: number) => `Drain de vie +${v}%`,
    216: (v: number) => `PV à la résurrection +${v}%`,
    217: (v: number) => `Barre d'action à la résurrection +${v}%`,
    218: (v: number) => `Dgts supp. en prop. des PV : ${v}%`,
    219: (v: number) => `Dgts supp. en prop. de ATQ : ${v}%`,
    220: (v: number) => `Dgts supp. en prop. de DEF : ${v}%`,
    221: (v: number) => `Dgts supp. en prop. de VIT : ${v}%`,
    222: (v: number) => `D.CRIT+ selon bon état PV enn. +${v}%`,
    223: (v: number) => `D.CRIT+ sel. mauv. étt PV enn. +${v}%`,
    224: (v: number) => `D.CRIT+ comp cib uniq pdt tour +${v}%`,
    225: (v: number) => `Dgts de contre-attaque/attaque conjointe +${v}%`,
    226: (v: number) => `Effet renforcement ATQ/DEF +${v}%`,
    300: (v: number) => `Aug. des dgts infl. au Feu +${v}%`,
    301: (v: number) => `Aug. des dgts infl. à l'Eau +${v}%`,
    302: (v: number) => `Aug. des dgts infl. au Vent +${v}%`,
    303: (v: number) => `Aug. des dgts infl. à Lum. +${v}%`,
    304: (v: number) => `Aug. dgts infl. aux Tén. +${v}%`,
    305: (v: number) => `Réd. des dgts reçus du Feu -${v}%`,
    306: (v: number) => `Réd. dgts reçus de l'Eau -${v}%`,
    307: (v: number) => `Réd. dgts reçus du Vent -${v}%`,
    308: (v: number) => `Réd. dgts reçus de la Lum. -${v}%`,
    309: (v: number) => `Réd. dgts reçus des Tén. -${v}%`,
    400: (v: number) => `[Comp.1] Aug. Dgts CRIT +${v}%`,
    401: (v: number) => `[Comp.2] Aug. Dgts CRIT +${v}%`,
    402: (v: number) => `[Comp.3] Aug. Dgts CRIT +${v}%`,
    403: (v: number) => `[Comp.4] Aug. Dgts CRIT +${v}%`,
    404: (v: number) => `[Comp.1] Aug. des soins +${v}%`,
    405: (v: number) => `[Comp.2] Aug. des soins +${v}%`,
    406: (v: number) => `[Comp.3] Aug. des soins +${v}%`,
    407: (v: number) => `[Comp.1] Aug. Précision +${v}%`,
    408: (v: number) => `[Comp.2] Aug. Précision +${v}%`,
    409: (v: number) => `[Comp.3] Aug. Précision +${v}%`,
    410: (v: number) => `Dgts CRIT [compétence 3/4] +${v}%`,
    411: (v: number) => `Dgts CRIT 1re attaque +${v}%`,
  } as Record<number, (v: number) => string>,

  // Les effets de compétence, par leur nom SWARFARM (anglais, la clé des
  // données). Un effet absent garde son nom anglais (`nomEffet`).
  effets: {
    Stun: { long: 'Étourdi' },
    'Decrease DEF': { long: 'Réduction de DEF' },
    'Increase ATB': { long: "Augmentation de la jauge d'attaque" },
    'Remove Buff': { long: "Suppression des effets de renforcement de l'ennemi", court: 'Suppr. eff. amélior. enn.' },
    'Decrease ATB': { long: "Réduction de la jauge d'attaque de l'ennemi", court: 'Réd. jauge ATQ enn.' },
    Heal: { long: 'Soin' },
    'Continuous DMG': { long: 'Dégâts constants', court: 'DEG constants' },
    'Decrease ATK SPD': { long: 'Réduction de Vit ATQ' },
    'Increase Damage': { long: 'Augmentation des dégâts' },
    'Decrease ATK': { long: "Réduction d'ATQ" },
    'Absorb ATB': { long: "Absorption de la jauge d'attaque", court: 'Absorbe jauge ATQ' },
    Unrecoverable: { long: 'Irrécupérable' },
    Cleanse: { long: 'Suppression des effets nocifs', court: 'Suppr. eff. nocifs' },
    Provoke: { long: 'Provoqué' },
    'Increase Glancing Hit Chance': { long: 'Chances augmentées de coup glancing' },
    'Additional Attack': { long: 'Attaque supplémentaire' },
    'Additional Turn': { long: 'Tour supplémentaire' },
    'Increase ATK': { long: "Augmentation d'ATQ" },
    'Self-Heal': { long: 'Récupération de ses PV' },
    Brand: { long: 'Marque' },
    'Reduce Cooltime': { long: 'Réduction du temps de pause' },
    Immunity: { long: 'Immunité' },
    'Increase ATK SPD': { long: 'Augmentation de Vit ATQ' },
    Shield: { long: 'Bouclier' },
    'Decrease Damage': { long: 'Réduction des dégâts', court: 'Réduit dgts.' },
    'Ignore DEF': { long: 'Dégâts ignorant la DEF', court: 'Dgts. (ign. DÉF)' },
    Counter: { long: 'Contre' },
    'Increase DEF': { long: 'Augmentation de DEF' },
    'Beneficial Effects Blocked': { long: 'Effets de renforcement bloqués' },
    Silence: { long: 'Silence' },
    Sleep: { long: 'Endormi' },
    'Ignore Damage Reduction': { long: 'Dégâts ignorant la réduction des dégâts', court: 'DGTS (ign. eff. réd. DGTS)' },
    'Increase Cooltime': { long: 'Augmentation du temps de pause', court: 'Augm. tps pause' },
    'Guaranteed Critical Hit': { long: 'Inflige toujours des dégâts critiques', court: 'Inflige tjrs DGTS CRIT' },
    Revive: { long: 'Réanimation' },
    'Increase CRI Rate': { long: 'Augmentation du tx critique' },
    'Steal Buff': { long: 'Vol des effets de renforcement' },
    'Ally Attack': { long: 'Attaque conjointe' },
    'Immune to Inability Effects': { long: "Immunité aux effets d'incapacité" },
    'Debuff Bonus Damage': { long: 'Dégâts selon les effets nocifs', court: 'Dgts. (% eff. nocifs)' },
    'Increase Attack Critical Chance': { long: 'Augmentation des chances de coup critique' },
    'Harmful Effect Removal Blocked': { long: 'Suppression impossible' },
    Freeze: { long: 'Gelé' },
    Invincible: { long: 'Invincible' },
    'Anti-Revive': { long: 'Réanimation impossible', court: 'Réanim. impossible' },
    Oblivion: { long: 'Oubli' },
    Threat: { long: 'Menace' },
    'Destroy HP': { long: "Destruction des PV de l'ennemi" },
    Recovery: { long: 'Récupération' },
    Endure: { long: 'Endurer' },
    'Ignore Resistance': { long: 'Ignore la RES' },
    Bomb: { long: 'Bombe' },
    'Elemental Advantage': { long: "Avantage d'élément" },
    'Guaranteed Not Glance Hit': { long: 'Attaques sans coups glancing' },
    'Transfer Debuff': { long: 'Transfert des effets nocifs' },
    'Self-Harm': { long: 'Perte de ses PV' },
    'Ignores Resist Death': { long: 'Dégâts ignorant les effets de refus de la mort', court: 'DGTS ignorant eff. ref. mort' },
    'Reflect DMG': { long: 'Réfléchir DEG' },
    'Increase CRI Resist': { long: 'Augmentation de la résistance aux critiques' },
    'Redistribute HP': { long: 'Répartition des PV' },
    'Increase Debuff Duration': { long: 'Augmentation de la durée des effets nocifs' },
    Defend: { long: 'Défendre' },
    'Cannot Critical Hit': { long: 'Coup critique impossible' },
    'Accumulate ATK': { long: "Accumulation d'ATQ" },
    Irresistible: { long: 'Résistance impossible' },
    Knowledge: { long: 'Savoir' },
    'HP reduction': { long: 'Réduction des PV' },
    'Immune to ATB decreasing effects': { long: "Immunité à la réduction de la jauge d'attaque" },
    'Accumulate DEF': { long: 'Accumulation de DEF' },
    'Increase Buff Duration': { long: 'Augmentation de la durée des effets de renforcement' },
    'Offset Damage': { long: 'Compensation des dégâts' },
    'Skill Limit per Battle': { long: 'Utilisations limitées par combat' },
    'Soul Protection': { long: "Protection de l'âme" },
    'Increase Accuracy': { long: 'Augmentation de la Précision' },
    'Accumulate SPD': { long: 'Accumulation de VIT' },
    Suppression: { long: 'Oppression' },
    'Passive Reflect DMG': { long: 'Réflexion passive des DEG' },
    Vampire: { long: 'Vampire' },
    'Immune to Defense Decreasing Effects': { long: 'Immunité à la réduction de DEF' },
    'Reflect Harmful Effect': { long: 'Réflexion des effets nocifs' },
    Unrevivable: { long: 'Réanimation impossible' },
    Seal: { long: 'Sceau' },
    'Decrease Debuff Duration': { long: 'Réduction de la durée des effets nocifs' },
    'Immune to Continuous DMG': { long: 'Immunité aux dégâts constants' },
    Stealth: { long: 'Camouflage' },
    'Magic Power Explosion': { long: 'Explosion de puissance magique' },
    'Decrease Buff Duration': { long: 'Réduction de la durée des effets de renforcement' },
    Berserk: { long: 'Berserk' },
    'Spend Knowledge': { long: 'Dépense du savoir' },
    'Increase Critical Damage': { long: 'Augmentation des dgts critiq.' },
    'Detonate Continuous Damage': { long: 'Détonation des dégâts continus' },
    'Accumulate MAX HP': { long: 'Accumulation de PV max' },
    'Receive Glancing Hit Increased': { long: 'Coups glancing reçus augmentés' },
    'Decrease Critical Hit Chance': { long: 'Réduction des chances de coup critique' },
    'Immune to Harmful Effects': { long: 'Immunité aux effets nocifs' },
    'Buff Bonus Damage': { long: 'Dégâts selon les effets bénéfiques' },
    'Detonate Bomb': { long: 'Explosion des bombes' },
    'Decrease ATB effects': { long: "Réduction des effets sur la jauge d'attaque" },
    'Increased Skill Activation Rate': { long: "Augmentation du taux d'activation" },
    'Blocked Attack Bar Increasing Effects': { long: "Augmentation de la jauge d'attaque bloquée" },
    'Immune to Freeze': { long: 'Immunité au gel' },
    'Immune to Stun': { long: "Immunité à l'étourdissement" },
    'Scroll Seal': { long: 'Sceau du parchemin' },
    'Transfer Buff': { long: 'Transfert des effets de renforcement' },
    'Shadow Tie': { long: "Lien d'ombre" },
    'Increase Buff': { long: 'Renforcement des effets de renforcement' },
    'Immune to Sleep': { long: 'Immunité au sommeil' },
    'Demon Bag': { long: 'Sac du démon' },
    'Immune to Oblivion': { long: "Immunité à l'oubli" },
    Sacrifice: { long: 'Sacrifice' },
    'Decrease Harmful Effect Chance': { long: "Réduction des chances d'effets nocifs" },
    'Decrease ATB Ignores Immunity': { long: "Réduction de la jauge d'attaque ignorant l'immunité" },
    "Enemy can't counterattack": { long: 'Contre-attaque ennemie impossible' },
    Mark: { long: 'Marque' },
    'Enhanced Immortal Light': { long: 'Lumière immortelle renforcée' },
    'Leave Battle': { long: 'Quitte le combat' },
    'Random Harmful Effect in Battle': { long: 'Effet nocif aléatoire en combat' },
    'Immune to HP Recovery Disturbance': { long: "Immunité à l'empêchement de soin" },
    'Curse of Death': { long: 'Malédiction de la mort' },
    'Cannot be Critical Hit': { long: 'Ne peut pas subir de coup critique' },
    'Soul Stone': { long: "Pierre d'âme" },
    'Increases ATB effects': { long: "Augmentation des effets sur la jauge d'attaque" },
    'Remove inability effect': { long: "Suppression des effets d'incapacité" },
    'Shadow Trap': { long: "Piège d'ombre" },
    'Increase Heal Amount': { long: 'Augmentation des soins' },
    'Limit Harmful Effects': { long: 'Limitation des effets nocifs' },
    'Prevent Harmful Effect Reapply': { long: 'Effets nocifs non réapplicables' },
    'Initiate 1v1 Duel': { long: 'Duel en 1 contre 1' },
    'Share ally damage': { long: 'Partage des dégâts des alliés' },
    'Share MAX HP': { long: 'Partage des PV max' },
    'Cursed Tombstone': { long: 'Pierre tombale maudite' },
    'Cherished Tombstone': { long: 'Pierre tombale chérie' },
    'Mechanical Frame State': { long: 'État de carcasse mécanique' },
    'Immune against cool down effects': { long: 'Immunité aux effets sur le temps de pause' },
  } as Record<string, Terme>,
};

export type LexiqueJeu = typeof jeuFr;
