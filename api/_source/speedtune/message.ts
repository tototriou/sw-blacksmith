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
// Un bouton qui revient au bot (style secondaire) : il ouvre la saisie d'une VIT.
export interface Bouton { type: 2; style: 2; label: string; custom_id: string }
export interface Rangee {
  type: 1;
  components: (Menu | BoutonLien | Bouton)[];
}

// Une VIT mal lue, à saisir : un bouton chacune.
export interface Saisie { nom: string; customId: string }

// La fenêtre de saisie d'une VIT (modale Discord) : un champ texte, prérempli
// de la lecture la plus probable s'il y en a une.
export interface Modale {
  custom_id: string;
  title: string;
  components: { type: 1; components: { type: 4; custom_id: string; label: string; style: 1; min_length: number; max_length: number; required: true; value?: string; placeholder?: string }[] }[];
}
export const CHAMP_VIT = 'vit';

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
  | { sorte: 'arte'; nom: string; de: number; a: number };

const TEXTES = {
  fr: {
    // Le vocabulaire des joueurs : on « se fait cut », on n'est pas « coupé ».
    titreOk: '⚡ Speed tune — personne ne se fait cut',
    titreKo: '⚡ Speed tune — quelqu\'un se fait cut',
    champEquipe: 'Équipe',
    leadEquipe: (p: number) => `Lead +${p} %`,
    sansLeadCourt: 'Sans lead de VIT',
    champReference: 'Défense à battre',
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
    pied: 'Lecture automatique de la capture — vérifie les monstres et les VIT lus. Même calcul que l\'outil de speed tuning de SW Blacksmith.',
    // Le set Rapide ne se voit pas sur la capture et ne change pas l'ordre : la
    // fiche le suppose absent, à un point d'arrondi près s'il est porté.
    piedResultat: 'Fiche calculée sans le set Rapide (un point d\'écart possible s\'il est porté). Lecture automatique de la capture : vérifie les monstres et les VIT lus.',
    douteux: (quoi: string) => `⚠️ Lecture incertaine : ${quoi}`,
    erreurTitre: '⚡ Speed tune — capture illisible',
    pasImage: 'La pièce jointe n\'est pas une image lisible.',
    tropLourde: 'L\'image est trop lourde (25 Mo au plus).',
    illisible: 'Je n\'ai pas trouvé les trois attaquants d\'un combat de siège : leurs cartes, avec la VIT sous chaque portrait. L\'écran entier ou les trois cartes seules conviennent.',
    panne: 'Le calcul a échoué. Réessaie dans un instant.',
    questionVit: (noms: string) => `**VIT** mal lue sur la capture : ${noms}. Saisis-la avec le bouton ci-dessous (la VIT de combat, sous le portrait) ; la lecture la plus probable y est proposée.`,
    boutonSaisir: (nom: string) => `Saisir la VIT de ${nom}`,
    modaleTitre: 'VIT de combat',
    modaleChamp: (nom: string) => `VIT de ${nom}`,
    modaleAide: 'La VIT sous le portrait, ex. 312',
    vitInvalide: 'Une VIT est un nombre de 1 à 999.',
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
    pied: 'Automatic reading of the screenshot — check the monsters and SPD read. Same computation as the SW Blacksmith speed tuning tool.',
    piedResultat: 'Stats assume no Swift set (one point off if it is worn). Automatic reading of the screenshot: check the monsters and SPD read.',
    douteux: (quoi: string) => `⚠️ Uncertain reading: ${quoi}`,
    erreurTitre: '⚡ Speed tune — unreadable screenshot',
    pasImage: 'The attachment is not a readable image.',
    tropLourde: 'The image is too large (25 MB max).',
    illisible: 'I did not find the three attackers of a siege fight: their cards, with the SPD under each portrait. The whole screen or just the three cards both work.',
    panne: 'The computation failed. Try again in a moment.',
    questionVit: (noms: string) => `**SPD** misread on the screenshot: ${noms}. Enter it with the button below (the combat SPD, under the portrait); the most likely reading is suggested.`,
    boutonSaisir: (nom: string) => `Enter ${nom}'s SPD`,
    modaleTitre: 'Combat SPD',
    modaleChamp: (nom: string) => `${nom}'s SPD`,
    modaleAide: 'The SPD under the portrait, e.g. 312',
    vitInvalide: 'SPD is a number from 1 to 999.',
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
    pasAuteur: 'Only the author of the command can answer.',
    perime: 'This message no longer matches a valid reading. Run /speedtune again.',
  },
} as const;

export type Erreur = 'pasImage' | 'tropLourde' | 'illisible' | 'panne';

export function embedErreur(langue: Langue, erreur: Erreur): Embed {
  const t = TEXTES[langue];
  return { title: t.erreurTitre, description: t[erreur], color: COULEUR_ERREUR };
}

// Le bouton sous le résultat : l'outil de l'app, pour aller plus loin.
export const rangeeOutil = (langue: Langue): Rangee => ({
  type: 1,
  components: [{ type: 2, style: 5, label: TEXTES[langue].ouvrirOutil, url: LIEN_OUTIL }],
});

// Discord : 80 caractères au plus pour un libellé de bouton, 45 pour le titre
// et le libellé d'une modale.
const tronquer = (x: string, max: number) => (x.length > max ? `${x.slice(0, max - 1)}…` : x);

// Les boutons de saisie des VIT : une rangée (trois attaquants au plus, cinq
// boutons par rangée).
export const rangeeSaisies = (langue: Langue, saisies: Saisie[]): Rangee => ({
  type: 1,
  components: saisies.map((s) => ({ type: 2, style: 2, custom_id: s.customId, label: tronquer(TEXTES[langue].boutonSaisir(s.nom), 80) })),
});

export function modaleVit(langue: Langue, nom: string, combat: number | null, customId: string): Modale {
  const t = TEXTES[langue];
  return {
    custom_id: customId,
    title: t.modaleTitre,
    components: [{
      type: 1,
      components: [{
        type: 4, custom_id: CHAMP_VIT, label: tronquer(t.modaleChamp(nom), 45), style: 1, min_length: 1, max_length: 3, required: true,
        placeholder: t.modaleAide, ...(combat != null ? { value: String(combat) } : {}),
      }],
    }],
  };
}

export const texteEphemere = (langue: Langue, quoi: 'pasAuteur' | 'perime' | 'vitInvalide') => TEXTES[langue][quoi];

const TEXTE_PASSIF_MAX = 300;
// Discord : 5 rangées d'actions au plus par message.
export const MENUS_MAX = 5;

// `equipe` : `combat` null pour une VIT mal lue, que `saisies` demande.
export function messageQuestion(
  langue: Langue,
  equipe: { nom: string; combat: number | null }[],
  demandes: Demande[],
  douteux: string[],
  saisies: Saisie[] = []
): Message {
  const t = TEXTES[langue];
  const raccourcir = (x: string) => (x.length > TEXTE_PASSIF_MAX ? `${x.slice(0, TEXTE_PASSIF_MAX - 1)}…` : x);
  const arte = demandes.filter((d) => d.sorte === 'arte').map((d) => d.nom);
  const inconnues = equipe.filter((e) => e.combat == null).map((e) => `**${e.nom}**`);
  const description = [
    t.lu(equipe.map((e) => `**${e.nom}** ${e.combat ?? '?'}`).join(' · ')),
    ...douteux.map(t.douteux),
    '',
    ...(inconnues.length ? [t.questionVit(inconnues.join(', '))] : []),
    ...(demandes.length ? [t.questionIntro] : []),
    ...demandes.flatMap((d) => (d.sorte === 'cumuls' ? [t.questionCumuls(d.nom, d.passif, raccourcir(d.texte))] : [])),
    ...(arte.length ? [t.questionArte(arte.join(', '))] : []),
  ].join('\n');
  // Plus de menus que de rangées (rare : trois passifs cumulables et un buff
  // de VIT) : ceux qui attendent une réponse passent d'abord, les autres
  // reviennent une fois la place libérée. La rangée des saisies de VIT prend
  // une place.
  const places = MENUS_MAX - (saisies.length ? 1 : 0);
  const visibles = [...demandes.filter((d) => d.choisi == null), ...demandes.filter((d) => d.choisi != null)].slice(0, places);
  return {
    embeds: [{ title: t.questionTitre, description, color: COULEUR_KO, footer: { text: t.pied } }],
    components: [...(saisies.length ? [rangeeSaisies(langue, saisies)] : []), ...demandes.filter((d) => visibles.includes(d)).map((d): Rangee => ({
      type: 1,
      components: [{
        type: 3,
        custom_id: d.customId,
        placeholder: d.sorte === 'cumuls' ? t.menuCumuls(d.nom) : t.menuArte(d.nom),
        options: d.sorte === 'cumuls'
          ? d.options.map((o) => ({ label: String(o.valeur), value: String(o.valeur), description: t.gain(o.points), ...(d.choisi === o.valeur ? { default: true } : {}) }))
          : d.options.map((o) => ({ label: t.tranche(o.de, o.a), value: String(o.de), ...(d.choisi === o.de ? { default: true } : {}) })),
      }],
    }))],
  };
}

// Le résultat en UN encart compact, à la manière des bots de statistiques :
// l'icône de l'app en vignette, champs côte à côte (équipe, défense à battre),
// l'ordre de jeu une ligne par monstre avec son icône DANS le texte
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
    { name: t.champOrdre, value: ordre.join('\n') },
    ...(precisions.length ? [{
      name: t.champPrecise,
      value: precisions.map((p) => (p.sorte === 'cumuls' ? t.cumulsRetenus(p.nom, p.cumuls, p.points) : t.arteRetenu(p.nom, p.de, p.a))).join('\n'),
    }] : []),
    { name: t.defense, value: defense.length ? defense.map((m) => `${icone(m)}${m.name}`).join(' · ') : '—' },
  ];
  return {
    title: r.ok ? t.titreOk : t.titreKo,
    ...(douteux.length ? { description: douteux.map(t.douteux).join('\n') } : {}),
    color: r.ok ? COULEUR_OK : COULEUR_KO,
    fields,
    thumbnail: { url: ICONE_APP },
    footer: { text: t.piedResultat },
  };
}
