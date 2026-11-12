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

export interface Embed {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
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
//     VIT ; chaque option est une TRANCHE d'artéfact qui donne le même buff.
export type Demande = {
  nom: string; // le monstre
  choisi: number | null;
  customId: string;
} & (
  | { sorte: 'cumuls'; passif: string; texte: string; options: { valeur: number; points: number }[] }
  | { sorte: 'arte'; options: { de: number; a: number; buff: number }[] }
);

// Ce qui a été précisé, rappelé dans le résultat.
export type Precision =
  | { sorte: 'cumuls'; nom: string; cumuls: number; points: number }
  | { sorte: 'arte'; nom: string; arte: number; buff: number };

const TEXTES = {
  fr: {
    titreOk: '⚡ Speed tune — personne n\'est coupé',
    titreKo: '⚡ Speed tune — coupé',
    lead: (nom: string, p: number) => `Leader : **${nom}** · VIT d'attaque **+${p} %**`,
    sansLead: 'Aucun lead de vitesse actif en siège',
    reference: (v: number) => `Contre une défense aussi rapide que ton plus rapide (**${v}** de VIT de combat).`,
    ordre: 'Ordre de jeu',
    ligne: (rang: number, nom: string, vit: number, joue: boolean) => `${rang}. **${nom}** · ${vit} VIT${joue ? '' : ' · ne joue pas'}`,
    sort: (s: string) => ` · ${s}`,
    corriger: 'À corriger',
    requis: (nom: string, actuel: number, requis: number) => `**${nom}** : ${requis} de VIT de combat (**+${requis - actuel}**)`,
    horsDePortee: (nom: string) => `**${nom}** : coupé quelle que soit sa VIT`,
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
    lu: (equipe: string) => `Lu : ${equipe}`,
    menuCumuls: (nom: string) => `${nom} : nombre de cumuls`,
    menuArte: (nom: string) => `${nom} : Effet aug. VIT`,
    gain: (pts: number) => `+${pts} VIT`,
    tranche: (de: number, a: number) => (de === a ? `${de} %` : `${de} à ${a} %`),
    buff: (b: number) => `Buff de VIT : +${b} %`,
    cumulsRetenus: (nom: string, n: number, pts: number) => `Passif de **${nom}** : ${n} cumul${n > 1 ? 's' : ''} (+${pts} VIT)`,
    arteRetenu: (nom: string, a: number, b: number) => `**${nom}** : Effet aug. VIT +${a} % (buff de VIT +${b} %)`,
    pasAuteur: 'Seul l\'auteur de la commande peut répondre.',
    perime: 'Ce message ne correspond plus à une lecture valide. Relance /speedtune.',
  },
  en: {
    titreOk: '⚡ Speed tune — nobody gets cut',
    titreKo: '⚡ Speed tune — cut',
    lead: (nom: string, p: number) => `Leader: **${nom}** · Attack Speed **+${p}%**`,
    sansLead: 'No speed lead active in siege',
    reference: (v: number) => `Against a defense as fast as your fastest (**${v}** combat SPD).`,
    ordre: 'Turn order',
    ligne: (rang: number, nom: string, vit: number, joue: boolean) => `${rang}. **${nom}** · ${vit} SPD${joue ? '' : ' · does not act'}`,
    sort: (s: string) => ` · ${s}`,
    corriger: 'To fix',
    requis: (nom: string, actuel: number, requis: number) => `**${nom}**: ${requis} combat SPD (**+${requis - actuel}**)`,
    horsDePortee: (nom: string) => `**${nom}**: cut whatever their SPD`,
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
    lu: (equipe: string) => `Read: ${equipe}`,
    menuCumuls: (nom: string) => `${nom}: number of stacks`,
    menuArte: (nom: string) => `${nom}: SPD Increasing Effect`,
    gain: (pts: number) => `+${pts} SPD`,
    tranche: (de: number, a: number) => (de === a ? `${de}%` : `${de} to ${a}%`),
    buff: (b: number) => `SPD buff: +${b}%`,
    cumulsRetenus: (nom: string, n: number, pts: number) => `**${nom}**'s passive: ${n} stack${n === 1 ? '' : 's'} (+${pts} SPD)`,
    arteRetenu: (nom: string, a: number, b: number) => `**${nom}**: SPD Increasing Effect +${a}% (SPD buff +${b}%)`,
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
          : d.options.map((o) => ({ label: t.tranche(o.de, o.a), value: String(o.de), description: t.buff(o.buff), ...(d.choisi === o.de ? { default: true } : {}) })),
      }],
    })),
  };
}

export function embedResultat(langue: Langue, r: ResultatSpeedTune, defense: Monster[], douteux: string[], precisions: Precision[] = []): Embed {
  const t = TEXTES[langue];
  const plusRapide = r.reference ?? Math.max(...r.lignes.map((l) => l.combat));
  const description = [
    r.lead ? t.lead(r.lead.monster.name, r.lead.pourcent) : t.sansLead,
    t.reference(plusRapide),
    ...precisions.map((p) => (p.sorte === 'cumuls' ? t.cumulsRetenus(p.nom, p.cumuls, p.points) : t.arteRetenu(p.nom, p.arte, p.buff))),
    ...douteux.map(t.douteux),
  ].join('\n');
  const fields: NonNullable<Embed['fields']> = [{
    name: t.ordre,
    value: r.lignes.map((l, i) => t.ligne(i + 1, l.monster.name, l.combat, l.tick != null) + (l.sort ? t.sort(l.sort) : '')).join('\n'),
  }];
  const aCorriger = r.lignes.flatMap((l) => {
    if (l.requis != null) return [t.requis(l.monster.name, l.combat, l.requis)];
    if (l.horsDePortee) return [t.horsDePortee(l.monster.name)];
    return [];
  });
  if (aCorriger.length) fields.push({ name: t.corriger, value: aCorriger.join('\n') });
  if (defense.length) fields.push({ name: t.defense, value: defense.map((m) => m.name).join(' · ') });
  return { title: r.ok ? t.titreOk : t.titreKo, description, color: r.ok ? COULEUR_OK : COULEUR_KO, fields, footer: { text: t.pied } };
}
