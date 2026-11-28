// Tests de rendu — la fenêtre « Ajouter à une recommandation » d'un combat de
// Siège › Statistiques ou d'une équipe de Mes équipes
// (src/components/siege/AjoutOffenseReco.tsx). La `Modale` se monte dans
// `<body>` et ne rend rien côté serveur : le corps se rend par son composant
// exporté. Données fabriquées : aucun nom réel.

import { ChoixRecoOffense } from '../../src/components/siege/AjoutOffenseReco';
import type { StatutDiscord } from '../../src/hooks/useDiscord';
import { offenseDuDeck, recoAvecOffense, trioDe, type OffenseAAjouter } from '../../src/lib/ajoutOffenseReco';
import { emptyRecoDeck, emptyRecoSlot, type Monster, type Reco } from '../../src/types';
import { fr } from '../../src/i18n/fr';
import { ok, titre } from '../outils';
import { boutons, rendre, texteVisible } from './outils-rendu';

const a = fr.siegeStats.ajoutReco;
const monstre = (com2usId: number, name: string): Monster =>
  ({ id: com2usId, com2usId, name, element: 'fire', stars: 6, naturalStars: 5, secondAwaken: false, image: null,
    stats: { hp: 1, attack: 1, defense: 1, speed: 1, critRate: 0, critDamage: 0, resistance: 0, accuracy: 0 }, leaderSkill: null }) as Monster;
const PAR_COM2US = new Map(
  [monstre(101, 'Gardien Un'), monstre(102, 'Gardien Deux'), monstre(103, 'Gardien Trois'), monstre(201, 'Défenseur Un'), monstre(202, 'Défenseur Deux'), monstre(203, 'Défenseur Trois')].map(
    (m) => [m.com2usId!, m],
  ),
);
const nom = (id: number) => PAR_COM2US.get(id)!.name;
const OFF = trioDe([101, 102, 103], nom);
const DEF = trioDe([201, 202, 203], nom);
const reco = (id: string, name: string, decks: Reco['decks']): Reco => ({ id, origin: 'mine', name, author: '', note: '', decks });
const COMBAT: OffenseAAjouter = { offense: OFF, defense: DEF };

export function testRenduAjoutOffenseReco() {
  titre('rendu · Siège › Statistiques — ajouter une offense à une recommandation');
  const vide = reco('a', 'Vide', [emptyRecoDeck()]);
  // La même offense, contre une AUTRE défense.
  const avecOffense = recoAvecOffense(reco('b', 'Avec offense', [emptyRecoDeck()]), { offense: OFF, defense: trioDe([301, 302, 303], (id) => `Autre ${id}`) }, PAR_COM2US);
  const complete = recoAvecOffense(reco('c', 'Complète', [emptyRecoDeck()]), COMBAT, PAR_COM2US);
  // Une recommandation partagée, lue d'un salon Discord.
  const partagee: Reco = {
    ...reco('d', 'Partagée', [emptyRecoDeck()]),
    origin: 'imported',
    lien: { serveurId: 's', salonId: 'c', nomServeur: 'Serveur', nomSalon: 'blacksmith-reco-siege', ecrire: true, base: { messageId: 'm', auteur: 'a', modifieLe: 0, reco: { name: 'Partagée', author: '', note: '', decks: [] } } as never },
  };
  const recos = [vide, avecOffense, complete, partagee];
  const corps = (o: { recos?: Reco[]; ajoutees?: string[]; statut?: StatutDiscord; ajout?: OffenseAAjouter } = {}) =>
    rendre(
      <ChoixRecoOffense ajout={o.ajout ?? COMBAT} recos={o.recos ?? recos} parCom2us={PAR_COM2US} ajoutees={new Set(o.ajoutees ?? [])}
        statutDiscord={o.statut ?? 'connecte'} onAjouter={() => {}} />,
    );

  const html = corps();
  const texte = texteVisible(html);
  ok(html.includes('title="Gardien Un"') && html.includes('title="Défenseur Un"'), 'le combat : l’offense face à la défense battue');
  ok(texte.includes(a.leader), 'la fenêtre dit que le premier monstre devient le leader, à vérifier');
  const lignes = boutons(html);
  const ligne = (n: string) => lignes.find((b) => b.texte.includes(n));
  ok(ligne('Vide')?.texte.includes(a.nouveauDeck) === true && !ligne('Vide')!.desactive, 'offense absente : « Nouveau deck »');
  ok(ligne('Avec offense')?.texte.includes(a.nouvelleDefense) === true && ligne('Avec offense')!.title === a.nouvelleDefenseAide, 'offense déjà là : la défense s’ajoute à son deck, l’infobulle le dit');
  ok(ligne('Complète')?.desactive === true && ligne('Complète')!.texte.includes(a.dejaDedans), 'déjà dedans : désactivée — pas de doublon');

  const apres = texteVisible(corps({ ajoutees: ['c'] }));
  ok(apres.includes(a.ajoutee) && !apres.includes(a.dejaDedans), 'ajoutée depuis la fenêtre : la ligne dit « Ajoutée »');

  ok(texteVisible(corps({ recos: [] })).includes(a.aucune), 'aucune recommandation : la fenêtre dit d’en créer une');

  // Discord : les recommandations partagées, et la connexion.
  ok(texte.includes('blacksmith-reco-siege') && ligne('Partagée')?.texte.includes(a.nouveauDeck) === true,
    'une recommandation partagée : son salon sur sa ligne, et elle reçoit l’offense comme une autre');
  ok(texte.includes(a.discord.connecte) && !texte.includes(fr.recosDiscord.connexion.bouton), 'connecté : la fenêtre dit où publier ensuite, sans bouton de connexion');
  for (const statut of ['inactif', 'code'] as const) {
    const hors = corps({ statut });
    const lien = [...hors.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].find(([, , contenu]) => texteVisible(contenu).includes(fr.recosDiscord.connexion.bouton));
    ok(
      texteVisible(hors).includes(a.discord.horsConnexion) && lien?.[1].includes('href="#/siege/recommandations"') === true,
      `hors connexion (${statut}) : la fenêtre le dit, et « ${fr.recosDiscord.connexion.bouton} » mène à la page Recommandations`,
    );
  }
  ok(texteVisible(corps({ statut: 'lecture' })).includes(a.discord.lecture), 'lecture des salons en cours : la fenêtre le dit');
  ok(texteVisible(corps({ statut: 'indisponible' })).includes(a.discord.indisponible), 'Discord injoignable : la fenêtre le dit');
  ok(
    ['inactif', 'lecture', 'connecte'].every((st) => corps({ statut: st as StatutDiscord }).includes('min-h-[4.5rem]')),
    'la zone de Discord a sa hauteur réservée dans chaque état : la lecture qui finit ne déplace pas la liste',
  );

  // Une équipe de Mes équipes : l'équipe seule, son leader connu, sans défense.
  const equipe = offenseDuDeck({ ...emptyRecoDeck(), slots: [101, 102, 103].map((id) => ({ ...emptyRecoSlot(), com2usId: id, name: nom(id) })) });
  const html2 = corps({ ajout: equipe });
  const t2 = texteVisible(html2);
  ok(html2.includes('title="Gardien Un"') && !html2.includes('title="Défenseur Un"') && !t2.includes(` ${fr.siegeStats.versus} `),
    'une équipe : ses monstres seuls, aucune défense en face');
  ok(t2.includes(a.leaderEquipe) && !t2.includes(a.leader), 'une équipe : la fenêtre dit qu’elle n’a pas de défense visée, pas de leader supposé');
  const lignes2 = boutons(html2);
  const l2 = (n: string) => lignes2.find((b) => b.texte.includes(n));
  ok(l2('Vide')?.texte.includes(a.nouveauDeck) === true, 'une équipe absente : « Nouveau deck »');
  ok(l2('Complète')?.desactive === true && l2('Complète')!.title === a.dejaDedansEquipeAide && l2('Avec offense')?.desactive === true,
    'une équipe déjà recommandée (avec n’importe quelle défense) : « Déjà dedans », pas de doublon');
}
