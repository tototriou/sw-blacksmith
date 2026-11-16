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

// Ce qui se SAISIT dans une fenêtre, un champ par monstre : `vit`, sa VIT de
// combat mal lue ; `arte`, l'Effet aug. VIT de ses artéfacts quand il reçoit
// un buff de VIT. Deux boutons, un par sorte, chacun sa fenêtre. `index` : sa
// place dans l'équipe ; `valeur` : ce qui préremplit le champ (la lecture la
// plus probable, ou la valeur déjà donnée), null pour un champ vide.
export type SorteSaisie = 'vit' | 'arte';
export interface Saisie { sorte: SorteSaisie; nom: string; index: number; valeur: number | null }

// La fenêtre de saisie (modale Discord) : un champ texte par monstre (cinq au
// plus, la limite de Discord ; trois attaquants ici).
export interface Modale {
  custom_id: string;
  title: string;
  components: { type: 1; components: { type: 4; custom_id: string; label: string; style: 1; min_length: number; max_length: number; required: true; value?: string; placeholder?: string }[] }[];
}
// Le champ d'une saisie du monstre à la place `index`.
export const champSaisie = (sorte: SorteSaisie, index: number) => `${sorte}${index}`;

// Ce qui remplace le message : `components` vide retire les menus d'une
// question à laquelle on a répondu.
export interface Message {
  embeds: Embed[];
  components: Rangee[];
}

// Ce que la capture ne montre pas et qu'on demande par un MENU : le nombre de
// cumuls d'un passif de vitesse qui se cumule (Chilling, Miles…) ; chaque
// option dit la VIT qu'elle ajoute. (L'Effet aug. VIT se saisit : `Saisie`.)
export interface Demande {
  sorte: 'cumuls';
  nom: string;
  choisi: number | null;
  customId: string;
  passif: string;
  texte: string;
  options: { valeur: number; points: number }[];
}

// Ce qui a été précisé, rappelé dans le résultat.
export type Precision =
  | { sorte: 'cumuls'; nom: string; cumuls: number; points: number }
  | { sorte: 'arte'; nom: string; arte: number };

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
    douteux: (quoi: string) => `⚠️ Lecture incertaine : ${quoi}`,
    erreurTitre: '⚡ Speed tune — capture illisible',
    pasImage: 'La pièce jointe n\'est pas une image lisible.',
    tropLourde: 'L\'image est trop lourde (25 Mo au plus).',
    illisible: 'Je n\'ai pas trouvé les trois attaquants d\'un combat de siège : leurs cartes, avec la VIT sous chaque portrait. L\'écran entier ou les trois cartes seules conviennent.',
    panne: 'Le calcul a échoué. Réessaie dans un instant.',
    questionVit: (noms: string) => `**VIT de combat** mal lue sur la capture : ${noms}. Saisis-la avec le bouton ci-dessous (la VIT sous chaque portrait) ; la lecture la plus probable y est proposée.`,
    boutonVit: (noms: string[]) => (noms.length === 1 ? `Saisir la VIT de ${noms[0]}` : `Saisir les VIT (${noms.join(', ')})`),
    boutonArte: (noms: string[]) => (noms.length === 1 ? `Saisir l'Effet aug. VIT de ${noms[0]}` : `Saisir l'Effet aug. VIT (${noms.join(', ')})`),
    modaleVit: 'VIT de combat',
    modaleArte: 'Effet aug. VIT des artéfacts',
    champVit: (nom: string) => `VIT de combat de ${nom}`,
    champArte: (nom: string) => `Effet aug. VIT de ${nom} (%)`,
    aideVit: 'La VIT sous le portrait, ex. 312',
    aideArte: 'De 0 à 60, ex. 15',
    vitInvalide: 'Une VIT de combat est un nombre de 1 à 999.',
    arteInvalide: 'Un Effet aug. VIT est un pourcentage de 0 à 60.',
    questionTitre: '⚡ Speed tune — une précision',
    questionIntro: 'La capture ne montre pas tout ce qui fait la VIT en combat. Précise-le dans les menus ci-dessous :',
    questionCumuls: (nom: string, passif: string, texte: string) => `**${nom}** — ${passif} : nombre de cumuls à son premier tour\n> ${texte}`,
    questionArte: (noms: string) => `**Effet aug. VIT** de leurs artéfacts, à saisir avec le bouton (ils reçoivent un buff de VIT) : ${noms}`,
    aucun: 'Aucun',
    lu: (equipe: string) => `Lu : ${equipe}`,
    menuCumuls: (nom: string) => `${nom} : nombre de cumuls`,
    gain: (pts: number) => `+${pts} VIT`,
    cumulsRetenus: (nom: string, n: number, pts: number) => `Passif de **${nom}** : ${n} cumul${n > 1 ? 's' : ''} (+${pts} VIT)`,
    arteRetenu: (nom: string, arte: number) => `**${nom}** : Effet aug. VIT +${arte} %`,
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
    douteux: (quoi: string) => `⚠️ Uncertain reading: ${quoi}`,
    erreurTitre: '⚡ Speed tune — unreadable screenshot',
    pasImage: 'The attachment is not a readable image.',
    tropLourde: 'The image is too large (25 MB max).',
    illisible: 'I did not find the three attackers of a siege fight: their cards, with the SPD under each portrait. The whole screen or just the three cards both work.',
    panne: 'The computation failed. Try again in a moment.',
    questionVit: (noms: string) => `**Combat SPD** misread on the screenshot: ${noms}. Enter it with the button below (the SPD under each portrait); the most likely reading is suggested.`,
    boutonVit: (noms: string[]) => (noms.length === 1 ? `Enter ${noms[0]}'s SPD` : `Enter the SPD (${noms.join(', ')})`),
    boutonArte: (noms: string[]) => (noms.length === 1 ? `Enter ${noms[0]}'s SPD Increasing Effect` : `Enter the SPD Increasing Effect (${noms.join(', ')})`),
    modaleVit: 'Combat SPD',
    modaleArte: 'Artifact SPD Increasing Effect',
    champVit: (nom: string) => `${nom}'s combat SPD`,
    champArte: (nom: string) => `${nom}'s SPD Increasing Effect (%)`,
    aideVit: 'The SPD under the portrait, e.g. 312',
    aideArte: 'From 0 to 60, e.g. 15',
    vitInvalide: 'Combat SPD is a number from 1 to 999.',
    arteInvalide: 'SPD Increasing Effect is a percentage from 0 to 60.',
    questionTitre: '⚡ Speed tune — one detail',
    questionIntro: 'The screenshot does not show everything that makes combat SPD. Fill it in with the menus below:',
    questionCumuls: (nom: string, passif: string, texte: string) => `**${nom}** — ${passif}: number of stacks at their first turn\n> ${texte}`,
    questionArte: (noms: string) => `**SPD Increasing Effect** of their artifacts, to enter with the button (they receive a SPD buff): ${noms}`,
    aucun: 'None',
    lu: (equipe: string) => `Read: ${equipe}`,
    menuCumuls: (nom: string) => `${nom}: number of stacks`,
    gain: (pts: number) => `+${pts} SPD`,
    cumulsRetenus: (nom: string, n: number, pts: number) => `**${nom}**'s passive: ${n} stack${n === 1 ? '' : 's'} (+${pts} SPD)`,
    arteRetenu: (nom: string, arte: number) => `**${nom}**: SPD Increasing Effect +${arte}%`,
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

// Un bouton par sorte de saisie : les VIT mal lues, l'Effet aug. VIT des
// monstres qui reçoivent un buff de VIT. Chacun ouvre sa fenêtre.
export interface BoutonSaisie { sorte: SorteSaisie; noms: string[]; customId: string }
export const rangeeSaisie = (langue: Langue, boutons: BoutonSaisie[]): Rangee => ({
  type: 1,
  components: boutons.map((b) => ({
    type: 2, style: 2, custom_id: b.customId,
    label: tronquer(b.sorte === 'vit' ? TEXTES[langue].boutonVit(b.noms) : TEXTES[langue].boutonArte(b.noms), 80),
  })),
});

// Un champ par saisie, chacun dans sa rangée (la forme des modales) ; la
// fenêtre prend le titre de la sorte de ses champs.
export function modaleSaisie(langue: Langue, champs: Saisie[], customId: string): Modale {
  const t = TEXTES[langue];
  return {
    custom_id: customId,
    title: champs[0]?.sorte === 'arte' ? t.modaleArte : t.modaleVit,
    components: champs.map((c) => ({
      type: 1,
      components: [{
        type: 4, custom_id: champSaisie(c.sorte, c.index), style: 1, min_length: 1, max_length: c.sorte === 'vit' ? 3 : 2, required: true,
        label: tronquer(c.sorte === 'vit' ? t.champVit(c.nom) : t.champArte(c.nom), 45),
        placeholder: c.sorte === 'vit' ? t.aideVit : t.aideArte,
        ...(c.valeur != null ? { value: String(c.valeur) } : {}),
      }],
    })),
  };
}

export const texteEphemere = (langue: Langue, quoi: 'pasAuteur' | 'perime' | 'vitInvalide' | 'arteInvalide') => TEXTES[langue][quoi];

const TEXTE_PASSIF_MAX = 300;
// Discord : 5 rangées d'actions au plus par message.
export const MENUS_MAX = 5;

// `equipe` : `combat` null pour une VIT mal lue, que le bouton des VIT
// demande ; `boutons` : les saisies (VIT, Effet aug. VIT), en tête.
export function messageQuestion(
  langue: Langue,
  equipe: { nom: string; combat: number | null }[],
  demandes: Demande[],
  douteux: string[],
  boutons: BoutonSaisie[] = []
): Message {
  const t = TEXTES[langue];
  const raccourcir = (x: string) => (x.length > TEXTE_PASSIF_MAX ? `${x.slice(0, TEXTE_PASSIF_MAX - 1)}…` : x);
  const arte = boutons.find((b) => b.sorte === 'arte')?.noms ?? [];
  const inconnues = equipe.filter((e) => e.combat == null).map((e) => `**${e.nom}**`);
  const description = [
    t.lu(equipe.map((e) => `**${e.nom}** ${e.combat ?? '?'}`).join(' · ')),
    ...douteux.map(t.douteux),
    '',
    ...(inconnues.length ? [t.questionVit(inconnues.join(', '))] : []),
    ...(demandes.length ? [t.questionIntro] : []),
    ...demandes.map((d) => t.questionCumuls(d.nom, d.passif, raccourcir(d.texte))),
    ...(arte.length ? [t.questionArte(arte.join(', '))] : []),
  ].join('\n');
  // Plus de menus que de rangées (trois passifs cumulables et les boutons :
  // quatre rangées, sous la limite de cinq) : ceux qui attendent une réponse
  // passent d'abord. Les boutons de saisie prennent une rangée.
  const places = MENUS_MAX - (boutons.length ? 1 : 0);
  const visibles = [...demandes.filter((d) => d.choisi == null), ...demandes.filter((d) => d.choisi != null)].slice(0, places);
  return {
    embeds: [{ title: t.questionTitre, description, color: COULEUR_KO, footer: { text: t.pied } }],
    components: [...(boutons.length ? [rangeeSaisie(langue, boutons)] : []), ...demandes.filter((d) => visibles.includes(d)).map((d): Rangee => ({
      type: 1,
      components: [{
        type: 3,
        custom_id: d.customId,
        placeholder: t.menuCumuls(d.nom),
        options: d.options.map((o) => ({ label: String(o.valeur), value: String(o.valeur), description: t.gain(o.points), ...(d.choisi === o.valeur ? { default: true } : {}) })),
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
        ? [t.viser(l.requis, l.requis - l.combat), ...(l.base != null && l.runesRequis != null ? [t.viserFiche(l.base, l.runesRequis)] : [])]
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
      value: precisions.map((p) => (p.sorte === 'cumuls' ? t.cumulsRetenus(p.nom, p.cumuls, p.points) : t.arteRetenu(p.nom, p.arte))).join('\n'),
    }] : []),
    { name: t.defense, value: defense.length ? defense.map((m) => `${icone(m)}${m.name}`).join(' · ') : '—' },
  ];
  return {
    title: r.ok ? t.titreOk : t.titreKo,
    ...(douteux.length ? { description: douteux.map(t.douteux).join('\n') } : {}),
    color: r.ok ? COULEUR_OK : COULEUR_KO,
    fields,
    thumbnail: { url: ICONE_APP },
  };
}
