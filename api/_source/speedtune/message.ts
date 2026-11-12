// Le message Discord de `/speedtune` : ce qui a été lu sur la capture, puis le
// verdict et l'ordre de jeu. Dans la langue de l'interaction (`locale` de
// Discord) : français, sinon anglais — comme la ligne de publication des
// recommandations (recoSalon.ts).
//
// ⚠️ Rien n'y vient du texte de la capture : les noms sont ceux des données des
// monstres, les nombres ceux qu'on a lus et calculés.

import type { Monster } from '../../../src/types';
import type { ResultatSpeedTune } from './analyse';

export type Langue = 'fr' | 'en';
export const langueDe = (locale: string | undefined): Langue => ((locale ?? '').startsWith('fr') ? 'fr' : 'en');

const COULEUR_OK = 0x23a55a;
const COULEUR_KO = 0xf0b232;
const COULEUR_ERREUR = 0xf23f43;
// La carte d'un attaquant : vert s'il joue avant la défense, rouge s'il est
// coupé, gris s'il ne joue pas dans l'horizon simulé.
const COULEUR_COUPE = 0xf23f43;
const COULEUR_NEUTRE = 0x80848e;

export interface Embed {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  thumbnail?: { url: string };
  url?: string;
}

// Un menu déroulant (string select) dans sa rangée d'actions.
export interface Rangee {
  type: 1;
  components: {
    type: 3;
    custom_id: string;
    placeholder: string;
    options: { label: string; value: string; description?: string; default?: boolean }[];
  }[];
}

// Ce qui remplace le message : `components` vide retire les menus d'une
// question à laquelle on a répondu.
export interface Message {
  embeds: Embed[];
  components: Rangee[];
}

// Ce que la capture ne montre pas et qu'on demande, un menu chacun :
//   - `cumuls` : un passif de vitesse qui se cumule (Chilling, Miles…) ; chaque
//     option dit la VIT qu'elle ajoute ;
//   - `arte` : l'effet aug. VIT des artéfacts d'un monstre qui reçoit un buff de
//     VIT ; chaque option est une TRANCHE d'artéfact qui donne le même buff ;
//   - `swift` : qui porte le set Rapide, UN menu pour l'équipe (chaque
//     combinaison est une option) ; il donne la VIT de runes.
export type Demande = {
  nom: string; // le monstre (vide pour une question d'équipe)
  choisi: number | null;
  customId: string;
} & (
  | { sorte: 'cumuls'; passif: string; texte: string; options: { valeur: number; points: number }[] }
  | { sorte: 'arte'; options: { de: number; a: number; buff: number }[] }
  | { sorte: 'swift'; options: { masque: number; noms: string[] }[] }
);

// Ce qui a été précisé, rappelé dans le résultat.
export type Precision =
  | { sorte: 'cumuls'; nom: string; cumuls: number; points: number }
  | { sorte: 'arte'; nom: string; arte: number; buff: number }
  | { sorte: 'swift'; noms: string[] };

const TEXTES = {
  fr: {
    titreOk: '⚡ Speed tune — personne n\'est coupé',
    titreKo: '⚡ Speed tune — coupé',
    lead: (nom: string, p: number) => `Leader : **${nom}** · VIT d'attaque **+${p} %**`,
    sansLead: 'Aucun lead de vitesse actif en siège',
    reference: (v: number) => `Contre une défense aussi rapide que ton plus rapide (**${v}** de VIT de combat).`,
    carteTitre: (rang: number, nom: string) => `${rang}. ${nom}`,
    carteVit: (vit: number) => `**${vit}** de VIT de combat`,
    carteFiche: (base: number, runes: number) => `Fiche : ${base} + ${runes}`,
    carteSort: (s: string) => `Sort : **${s}**`,
    carteOk: '✅ Joue avant la défense',
    carteRequis: (requis: number, ecart: number) => `❌ Coupé — viser **${requis}** de VIT de combat (+${ecart})`,
    carteRequisRunes: (base: number, runes: number) => `soit une fiche à ${base} + ${runes}`,
    carteHors: '❌ Coupé quelle que soit sa VIT',
    carteNeJoue: '⏸️ Ne joue pas dans les premiers tours',
    defense: 'Défense lue',
    pied: 'Lecture automatique de la capture — vérifie les monstres et les VIT lus. Même calcul que l\'outil de speed tuning de SW Blacksmith.',
    douteux: (quoi: string) => `⚠️ Lecture incertaine : ${quoi}`,
    erreurTitre: '⚡ Speed tune — capture illisible',
    pasImage: 'La pièce jointe n\'est pas une image PNG ou JPEG.',
    tropLourde: 'L\'image est trop lourde (10 Mo au plus).',
    illisible: 'Je n\'ai pas reconnu l\'écran de préparation d\'un combat de siège : les trois attaquants à gauche, leur VIT sous chaque portrait.',
    vitIllisible: (noms: string) => `VIT illisible sous : ${noms}. Envoie une capture en pleine résolution, sans recadrage.`,
    panne: 'Le calcul a échoué. Réessaie dans un instant.',
    questionTitre: '⚡ Speed tune — une précision',
    questionIntro: 'La capture ne montre pas tout ce qui fait la VIT en combat. Précise-le dans les menus ci-dessous :',
    questionCumuls: (nom: string, passif: string, texte: string) => `**${nom}** — ${passif} : nombre de cumuls à son premier tour\n> ${texte}`,
    questionArte: (noms: string) => `**Effet aug. VIT** de leurs artéfacts (ils reçoivent un buff de VIT) : ${noms}`,
    questionSwift: '**Set Rapide** : qui le porte ? (pour retrouver la VIT de runes derrière la VIT lue)',
    menuSwift: 'Set Rapide : qui le porte ?',
    aucun: 'Aucun',
    lu: (equipe: string) => `Lu : ${equipe}`,
    menuCumuls: (nom: string) => `${nom} : nombre de cumuls`,
    menuArte: (nom: string) => `${nom} : Effet aug. VIT`,
    gain: (pts: number) => `+${pts} VIT`,
    tranche: (de: number, a: number) => (de === a ? `Effet aug. VIT +${de} %` : `Effet aug. VIT +${de} à ${a} %`),
    buff: (b: number) => `Buff de VIT : +${b} %`,
    cumulsRetenus: (nom: string, n: number, pts: number) => `Passif de **${nom}** : ${n} cumul${n > 1 ? 's' : ''} (+${pts} VIT)`,
    arteRetenu: (nom: string, a: number, b: number) => `**${nom}** : Effet aug. VIT +${a} % (buff de VIT +${b} %)`,
    swiftRetenu: (noms: string) => `Set Rapide : ${noms}`,
    pasAuteur: 'Seul l\'auteur de la commande peut répondre.',
    perime: 'Ce message ne correspond plus à une lecture valide. Relance /speedtune.',
  },
  en: {
    titreOk: '⚡ Speed tune — nobody gets cut',
    titreKo: '⚡ Speed tune — cut',
    lead: (nom: string, p: number) => `Leader: **${nom}** · Attack Speed **+${p}%**`,
    sansLead: 'No speed lead active in siege',
    reference: (v: number) => `Against a defense as fast as your fastest (**${v}** combat SPD).`,
    carteTitre: (rang: number, nom: string) => `${rang}. ${nom}`,
    carteVit: (vit: number) => `**${vit}** combat SPD`,
    carteFiche: (base: number, runes: number) => `Stats: ${base} + ${runes}`,
    carteSort: (s: string) => `Skill: **${s}**`,
    carteOk: '✅ Moves before the defense',
    carteRequis: (requis: number, ecart: number) => `❌ Cut — aim for **${requis}** combat SPD (+${ecart})`,
    carteRequisRunes: (base: number, runes: number) => `i.e. ${base} + ${runes} in stats`,
    carteHors: '❌ Cut whatever their SPD',
    carteNeJoue: '⏸️ Does not move in the first turns',
    defense: 'Defense read',
    pied: 'Automatic reading of the screenshot — check the monsters and SPD read. Same computation as the SW Blacksmith speed tuning tool.',
    douteux: (quoi: string) => `⚠️ Uncertain reading: ${quoi}`,
    erreurTitre: '⚡ Speed tune — unreadable screenshot',
    pasImage: 'The attachment is not a PNG or JPEG image.',
    tropLourde: 'The image is too large (10 MB max).',
    illisible: 'I did not recognize the battle preparation screen of a siege fight: the three attackers on the left, their SPD under each portrait.',
    vitIllisible: (noms: string) => `SPD unreadable under: ${noms}. Send a full-resolution screenshot, uncropped.`,
    panne: 'The computation failed. Try again in a moment.',
    questionTitre: '⚡ Speed tune — one detail',
    questionIntro: 'The screenshot does not show everything that makes combat SPD. Fill it in with the menus below:',
    questionCumuls: (nom: string, passif: string, texte: string) => `**${nom}** — ${passif}: number of stacks at their first turn\n> ${texte}`,
    questionArte: (noms: string) => `**SPD Increasing Effect** of their artifacts (they receive a SPD buff): ${noms}`,
    questionSwift: '**Swift set**: who wears it? (to find the rune SPD behind the SPD read)',
    menuSwift: 'Swift set: who wears it?',
    aucun: 'None',
    lu: (equipe: string) => `Read: ${equipe}`,
    menuCumuls: (nom: string) => `${nom}: number of stacks`,
    menuArte: (nom: string) => `${nom}: SPD Increasing Effect`,
    gain: (pts: number) => `+${pts} SPD`,
    tranche: (de: number, a: number) => (de === a ? `SPD Increasing Effect +${de}%` : `SPD Increasing Effect +${de} to ${a}%`),
    buff: (b: number) => `SPD buff: +${b}%`,
    cumulsRetenus: (nom: string, n: number, pts: number) => `**${nom}**'s passive: ${n} stack${n === 1 ? '' : 's'} (+${pts} SPD)`,
    arteRetenu: (nom: string, a: number, b: number) => `**${nom}**: SPD Increasing Effect +${a}% (SPD buff +${b}%)`,
    swiftRetenu: (noms: string) => `Swift set: ${noms}`,
    pasAuteur: 'Only the author of the command can answer.',
    perime: 'This message no longer matches a valid reading. Run /speedtune again.',
  },
} as const;

export type Erreur = 'pasImage' | 'tropLourde' | 'illisible' | 'panne';

export function embedErreur(langue: Langue, erreur: Erreur | { vitIllisible: string[] }): Embed {
  const t = TEXTES[langue];
  const description = typeof erreur === 'string' ? t[erreur] : t.vitIllisible(erreur.vitIllisible.join(', '));
  return { title: t.erreurTitre, description, color: COULEUR_ERREUR };
}

export const texteEphemere = (langue: Langue, quoi: 'pasAuteur' | 'perime') => TEXTES[langue][quoi];

const TEXTE_PASSIF_MAX = 300;
// Discord : 5 rangées d'actions au plus par message.
export const MENUS_MAX = 5;

export function messageQuestion(langue: Langue, equipe: { nom: string; combat: number }[], demandes: Demande[], douteux: string[]): Message {
  const t = TEXTES[langue];
  const raccourcir = (x: string) => (x.length > TEXTE_PASSIF_MAX ? `${x.slice(0, TEXTE_PASSIF_MAX - 1)}…` : x);
  const arte = demandes.filter((d) => d.sorte === 'arte').map((d) => d.nom);
  const description = [
    t.lu(equipe.map((e) => `**${e.nom}** ${e.combat}`).join(' · ')),
    ...douteux.map(t.douteux),
    '',
    t.questionIntro,
    ...demandes.flatMap((d) => (d.sorte === 'cumuls' ? [t.questionCumuls(d.nom, d.passif, raccourcir(d.texte))] : [])),
    ...(arte.length ? [t.questionArte(arte.join(', '))] : []),
    ...(demandes.some((d) => d.sorte === 'swift') ? [t.questionSwift] : []),
  ].join('\n');
  // Plus de menus que de rangées (rare : trois passifs cumulables et un buff
  // de VIT) : ceux qui attendent une réponse passent d'abord, les autres
  // reviennent une fois la place libérée.
  const visibles = [...demandes.filter((d) => d.choisi == null), ...demandes.filter((d) => d.choisi != null)].slice(0, MENUS_MAX);
  return {
    embeds: [{ title: t.questionTitre, description, color: COULEUR_KO, footer: { text: t.pied } }],
    components: demandes.filter((d) => visibles.includes(d)).map((d) => ({
      type: 1,
      components: [{
        type: 3,
        custom_id: d.customId,
        placeholder: d.sorte === 'cumuls' ? t.menuCumuls(d.nom) : d.sorte === 'arte' ? t.menuArte(d.nom) : t.menuSwift,
        options: d.sorte === 'cumuls'
          ? d.options.map((o) => ({ label: String(o.valeur), value: String(o.valeur), description: t.gain(o.points), ...(d.choisi === o.valeur ? { default: true } : {}) }))
          : d.sorte === 'arte'
            ? d.options.map((o) => ({ label: t.tranche(o.de, o.a), value: String(o.de), description: t.buff(o.buff), ...(d.choisi === o.de ? { default: true } : {}) }))
            : d.options.map((o) => ({ label: o.noms.join(' + ') || t.aucun, value: String(o.masque), ...(d.choisi === o.masque ? { default: true } : {}) })),
      }],
    })),
  };
}

// Le résultat en cartes : un en-tête (verdict, lead, valeurs précisées,
// doutes), une carte par attaquant DANS L'ORDRE DE JEU avec l'icône du monstre
// du jeu (celle de SWARFARM, comme dans l'app), puis la défense lue. Discord
// accepte dix cartes par message : on en envoie cinq au plus.
export function embedsResultat(langue: Langue, r: ResultatSpeedTune, defense: Monster[], douteux: string[], precisions: Precision[] = []): Embed[] {
  const t = TEXTES[langue];
  const plusRapide = r.reference ?? Math.max(...r.lignes.map((l) => l.combat));
  const entete: Embed = {
    title: r.ok ? t.titreOk : t.titreKo,
    description: [
      r.lead ? t.lead(r.lead.monster.name, r.lead.pourcent) : t.sansLead,
      t.reference(plusRapide),
      ...precisions.map((p) => (p.sorte === 'cumuls' ? t.cumulsRetenus(p.nom, p.cumuls, p.points)
        : p.sorte === 'arte' ? t.arteRetenu(p.nom, p.arte, p.buff)
        : t.swiftRetenu(p.noms.join(', ') || t.aucun))),
      ...douteux.map(t.douteux),
    ].join('\n'),
    color: r.ok ? COULEUR_OK : COULEUR_KO,
  };
  const cartes: Embed[] = r.lignes.map((l, i) => {
    const coupe = l.requis != null || l.horsDePortee;
    const fiche = l.base != null && l.runes != null;
    const lignes = [
      t.carteVit(l.combat) + (fiche ? ` · ${t.carteFiche(l.base!, l.runes!)}` : ''),
      ...(l.sort ? [t.carteSort(l.sort)] : []),
      l.tick == null ? t.carteNeJoue
        : l.requis != null
          // Chaque point de VIT de combat en plus est un point de runes en plus.
          ? t.carteRequis(l.requis, l.requis - l.combat) + (fiche ? `, ${t.carteRequisRunes(l.base!, l.runes! + l.requis - l.combat)}` : '')
          : l.horsDePortee ? t.carteHors : t.carteOk,
    ];
    return {
      title: t.carteTitre(i + 1, l.monster.name),
      description: lignes.join('\n'),
      color: l.tick == null ? COULEUR_NEUTRE : coupe ? COULEUR_COUPE : COULEUR_OK,
      ...(l.monster.image ? { thumbnail: { url: l.monster.image } } : {}),
    };
  });
  const pied: Embed = defense.length
    ? {
      title: t.defense,
      description: defense.map((m) => `**${m.name}**`).join(' · '),
      color: COULEUR_NEUTRE,
      ...(defense[0].image ? { thumbnail: { url: defense[0].image } } : {}),
      footer: { text: t.pied },
    }
    : { title: t.defense, description: '—', color: COULEUR_NEUTRE, footer: { text: t.pied } };
  return [entete, ...cartes, pied];
}
