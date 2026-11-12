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
// L'icône de l'app en vignette du résultat. ⚠️ Celle du site de PRODUCTION,
// même depuis un aperçu : Discord télécharge l'image lui-même, et un aperçu
// protégé la lui refuserait.
export const SITE = 'https://sw-blacksmith.vercel.app';
export const ICONE_APP = `${SITE}/favicon.png?v=2`;
// L'outil de speed tuning du site, où l'on règle l'équipe à la main. Celui de
// PRODUCTION, comme l'icône : un aperçu protégé demanderait une connexion
// Vercel.
export const LIEN_OUTIL = `${SITE}/#/outils/speed-tuning`;


export interface Embed {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  thumbnail?: { url: string };
  url?: string;
}

// Une rangée d'actions : un menu déroulant (string select), ou un bouton lien.
export interface Menu {
  type: 3;
  custom_id: string;
  placeholder: string;
  options: { label: string; value: string; description?: string; default?: boolean }[];
}
export interface BoutonLien { type: 2; style: 5; label: string; url: string }
// Un bouton à bascule : vert (3, « success ») allumé, gris (2) éteint.
export interface BoutonBascule { type: 2; style: 2 | 3; label: string; custom_id: string; emoji?: { id: string; name: string } }
export interface Rangee {
  type: 1;
  components: (Menu | BoutonLien | BoutonBascule)[];
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
export type Demande = {
  nom: string; // le monstre (vide pour une question d'équipe)
  choisi: number | null;
  customId: string;
} & (
  | { sorte: 'cumuls'; passif: string; texte: string; options: { valeur: number; points: number }[] }
  // ⚠️ Sans la valeur du buff qui en résulte : à côté de l'Effet aug. VIT
  // qu'on saisit, un second pourcentage embrouillait le choix.
  | { sorte: 'arte'; options: { de: number; a: number }[] }
);

// Ce qui a été précisé, rappelé dans le résultat.
export type Precision =
  | { sorte: 'cumuls'; nom: string; cumuls: number; points: number }
  | { sorte: 'arte'; nom: string; de: number; a: number }
  | { sorte: 'swift'; noms: string[] };

const TEXTES = {
  fr: {
    // Le vocabulaire des joueurs : on « se fait cut », on n'est pas « coupé ».
    titreOk: '⚡ Speed tune — personne ne se fait cut',
    titreKo: '⚡ Speed tune — quelqu\'un se fait cut',
    champEquipe: 'Équipe',
    leadEquipe: (p: number) => `Lead +${p} %`,
    sansLeadCourt: 'Sans lead de VIT',
    champReference: 'Défense à battre',
    champSwift: 'Set Rapide',
    champOrdre: 'Ordre de jeu',
    champPrecise: 'Précisé',
    vit: (v: number) => `${v} VIT`,
    ligneOrdre: (rang: number, icone: string, nom: string, vit: number, verdict: string) => `**${rang}.** ${icone}**${nom}** · **${vit}** VIT · ${verdict}`,
    detail: (morceaux: string[]) => `\u3000↳ ${morceaux.join(' · ')}`,
    fiche: (base: number, runes: number) => `fiche ${base} + ${runes}`,
    ok: '✅',
    coupe: '❌ cut',
    neJoue: '⏸️ ne joue pas',
    viser: (requis: number, ecart: number) => `viser **${requis}** (+${ecart})`,
    viserFiche: (base: number, runes: number) => `soit ${base} + ${runes}`,
    horsDePortee: 'quelle que soit sa VIT',
    defense: 'Défense lue',
    ouvrirOutil: 'Ouvrir l\'outil de speed tuning',
    boutonSwift: (nom: string) => `${nom} en Rapide`,
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
    aucun: 'Aucun',
    lu: (equipe: string) => `Lu : ${equipe}`,
    menuCumuls: (nom: string) => `${nom} : nombre de cumuls`,
    menuArte: (nom: string) => `${nom} : Effet aug. VIT`,
    gain: (pts: number) => `+${pts} VIT`,
    tranche: (de: number, a: number) => (de === a ? `Effet aug. VIT +${de} %` : `Effet aug. VIT +${de} à ${a} %`),
    cumulsRetenus: (nom: string, n: number, pts: number) => `Passif de **${nom}** : ${n} cumul${n > 1 ? 's' : ''} (+${pts} VIT)`,
    arteRetenu: (nom: string, de: number, a: number) => `**${nom}** : Effet aug. VIT +${de === a ? de : `${de} à ${a}`} %`,
    swiftRetenu: (noms: string) => `Set Rapide : ${noms}`,
    pasAuteur: 'Seul l\'auteur de la commande peut répondre.',
    perime: 'Ce message ne correspond plus à une lecture valide. Relance /speedtune.',
  },
  en: {
    titreOk: '⚡ Speed tune — nobody gets cut',
    titreKo: '⚡ Speed tune — cut',
    champEquipe: 'Team',
    leadEquipe: (p: number) => `Lead +${p}%`,
    sansLeadCourt: 'No SPD lead',
    champReference: 'Defense to beat',
    champSwift: 'Swift set',
    champOrdre: 'Turn order',
    champPrecise: 'Filled in',
    vit: (v: number) => `${v} SPD`,
    ligneOrdre: (rang: number, icone: string, nom: string, vit: number, verdict: string) => `**${rang}.** ${icone}**${nom}** · **${vit}** SPD · ${verdict}`,
    detail: (morceaux: string[]) => `\u3000↳ ${morceaux.join(' · ')}`,
    fiche: (base: number, runes: number) => `stats ${base} + ${runes}`,
    ok: '✅',
    coupe: '❌ cut',
    neJoue: '⏸️ does not move',
    viser: (requis: number, ecart: number) => `aim for **${requis}** (+${ecart})`,
    viserFiche: (base: number, runes: number) => `i.e. ${base} + ${runes}`,
    horsDePortee: 'whatever their SPD',
    defense: 'Defense read',
    ouvrirOutil: 'Open the speed tuning tool',
    boutonSwift: (nom: string) => `${nom} on Swift`,
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
    aucun: 'None',
    lu: (equipe: string) => `Read: ${equipe}`,
    menuCumuls: (nom: string) => `${nom}: number of stacks`,
    menuArte: (nom: string) => `${nom}: SPD Increasing Effect`,
    gain: (pts: number) => `+${pts} SPD`,
    tranche: (de: number, a: number) => (de === a ? `SPD Increasing Effect +${de}%` : `SPD Increasing Effect +${de} to ${a}%`),
    cumulsRetenus: (nom: string, n: number, pts: number) => `**${nom}**'s passive: ${n} stack${n === 1 ? '' : 's'} (+${pts} SPD)`,
    arteRetenu: (nom: string, de: number, a: number) => `**${nom}**: SPD Increasing Effect +${de === a ? de : `${de} to ${a}`}%`,
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

// Sous le résultat, un bouton par attaquant pour le set Rapide : vert s'il le
// porte, gris sinon ; un clic bascule et recalcule. Rapide ne change que la
// VIT de fiche (d'un point au plus) : « aucun » par défaut, sans rien demander
// avant le résultat.
export function rangeeSwift(
  langue: Langue,
  attaquants: { monster: Monster; swift: boolean; customId: string }[],
  icones: Map<number, string>
): Rangee {
  return {
    type: 1,
    components: attaquants.map(({ monster, swift, customId }) => {
      const emoji = /^<:(\w+):(\d+)>$/.exec(monster.com2usId != null ? (icones.get(monster.com2usId) ?? '') : '');
      return {
        type: 2,
        style: swift ? 3 : 2,
        label: TEXTES[langue].boutonSwift(monster.name),
        custom_id: customId,
        ...(emoji ? { emoji: { name: emoji[1], id: emoji[2] } } : {}),
      };
    }),
  };
}

// Le bouton sous le résultat : l'outil de l'app, pour aller plus loin.
export const rangeeOutil = (langue: Langue): Rangee => ({
  type: 1,
  components: [{ type: 2, style: 5, label: TEXTES[langue].ouvrirOutil, url: LIEN_OUTIL }],
});

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
        placeholder: d.sorte === 'cumuls' ? t.menuCumuls(d.nom) : t.menuArte(d.nom),
        options: d.sorte === 'cumuls'
          ? d.options.map((o) => ({ label: String(o.valeur), value: String(o.valeur), description: t.gain(o.points), ...(d.choisi === o.valeur ? { default: true } : {}) }))
          : d.options.map((o) => ({ label: t.tranche(o.de, o.a), value: String(o.de), ...(d.choisi === o.de ? { default: true } : {}) })),
      }],
    })),
  };
}

// Le résultat en UN encart compact, à la manière des bots de statistiques :
// l'icône de l'app en vignette, champs côte à côte (leader, défense de référence, set
// Rapide), l'ordre de jeu une ligne par monstre avec son icône DANS le texte
// (émojis du bot, voir emojis.ts), puis la défense lue. Sans émoji, le nom
// seul : le message reste juste.
export function embedResultat(
  langue: Langue,
  r: ResultatSpeedTune,
  defense: Monster[],
  douteux: string[],
  precisions: Precision[] = [],
  icones: Map<number, string> = new Map()
): Embed {
  const t = TEXTES[langue];
  const icone = (m: Monster) => (m.com2usId != null && icones.has(m.com2usId) ? `${icones.get(m.com2usId)} ` : '');
  const plusRapide = r.reference ?? Math.max(...r.lignes.map((l) => l.combat));
  const swift = precisions.find((p) => p.sorte === 'swift');
  const autres = precisions.filter((p) => p.sorte !== 'swift');

  const ordre = r.lignes.flatMap((l, i) => {
    const fiche = l.base != null && l.runes != null;
    const verdict = l.tick == null ? t.neJoue : l.requis != null || l.horsDePortee ? t.coupe : t.ok;
    const details = [
      ...(l.requis != null
        // Chaque point de VIT de combat en plus est un point de runes en plus.
        ? [t.viser(l.requis, l.requis - l.combat), ...(fiche ? [t.viserFiche(l.base!, l.runes! + l.requis - l.combat)] : [])]
        : l.horsDePortee ? [t.horsDePortee] : fiche ? [t.fiche(l.base!, l.runes!)] : []),
      ...(l.sort ? [l.sort.slot != null ? `S${l.sort.slot}` : l.sort.nom] : []),
    ];
    return [t.ligneOrdre(i + 1, icone(l.monster), l.monster.name, l.combat, verdict), ...(details.length ? [t.detail(details)] : [])];
  });

  const fields: NonNullable<Embed['fields']> = [
    // L'équipe à régler, dans l'ordre de la capture (leader en premier) : les
    // trois icônes, sinon les noms ; son lead dessous.
    {
      name: t.champEquipe,
      value: [
        r.equipe.every((m) => icone(m)) ? r.equipe.map((m) => icone(m).trim()).join(' ') : r.equipe.map((m) => m.name).join(', '),
        r.lead ? t.leadEquipe(r.lead.pourcent) : t.sansLeadCourt,
      ].join('\n'),
      inline: true,
    },
    { name: t.champReference, value: t.vit(plusRapide), inline: true },
    ...(swift ? [{ name: t.champSwift, value: swift.noms.join(', ') || t.aucun, inline: true }] : []),
    { name: t.champOrdre, value: ordre.join('\n') },
    ...(autres.length ? [{
      name: t.champPrecise,
      value: autres.map((p) => (p.sorte === 'cumuls' ? t.cumulsRetenus(p.nom, p.cumuls, p.points) : p.sorte === 'arte' ? t.arteRetenu(p.nom, p.de, p.a) : '')).join('\n'),
    }] : []),
    { name: t.defense, value: defense.length ? defense.map((m) => `${icone(m)}${m.name}`).join(' · ') : '—' },
  ];
  return {
    title: r.ok ? t.titreOk : t.titreKo,
    ...(douteux.length ? { description: douteux.map(t.douteux).join('\n') } : {}),
    color: r.ok ? COULEUR_OK : COULEUR_KO,
    fields,
    thumbnail: { url: ICONE_APP },
    footer: { text: t.pied },
  };
}
