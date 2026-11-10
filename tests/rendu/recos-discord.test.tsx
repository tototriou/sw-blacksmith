// Rendu — Recommandations synchronisées avec Discord : la page avec des
// recommandations liées (colonne des provenances, « Toutes » à l'ouverture,
// provenance sur les cartes, « Détacher de ce salon », « Publier dans… »
// désactivé hors connexion, encart de connexion), puis chaque composant seul
// — colonne connectée, bandeau d'un salon, corps de « Publier dans… » et de
// la fusion. Principe : tests/rendu/outils-rendu.tsx.

import { ColonneProvenances, type PropsProvenances } from '../../src/components/siege/discord/Provenances';
import BandeauSalon from '../../src/components/siege/discord/BandeauSalon';
import { CorpsCodeBureau, CorpsCodeSite, CorpsFusion, CorpsInstallation, ListeSalonsPublication } from '../../src/components/siege/discord/DialoguesDiscord';
import { fusionEnAttente, recevoirVersion, recoLiee, type SalonAccessible } from '../../src/lib/recoDiscord';
import { groupesSalons } from '../../src/lib/provenancesRecos';
import type { Monster, Reco, RecoDeck, RecoPayload } from '../../src/types';
import { egal, monstersJson, ok, titre } from '../outils';
import { boutons, rendre, texteVisible } from './outils-rendu';
import { RECOS, rendreRecos } from './recos.test';

const MONSTRES = monstersJson() as Monster[];
const parCom2us = new Map(MONSTRES.filter((m) => m.com2usId != null).map((m) => [m.com2usId!, m]));
const ids = MONSTRES.filter((m) => m.com2usId != null).slice(0, 9).map((m) => m.com2usId!);
const deck = (i: number[], note = ''): RecoDeck => ({
  name: '', note, counters: [],
  slots: [0, 1, 2].map((k) => ({ com2usId: i[k] ?? null, name: '', stats: {}, setOptions: [[]], artifacts: { element: [], archetype: [] } })),
});
const contenu = (name: string, decks: RecoDeck[], extra: Partial<RecoPayload> = {}): RecoPayload =>
  ({ name, author: 'Toto', note: '', decks, contributeurs: ['Toto', 'Lulu'], ...extra });
const salon = (salonId: string, ecrire = true): SalonAccessible => ({ serveurId: 'G1', salonId, nomServeur: 'Ma guilde', nomSalon: `blacksmith-reco-${salonId}`, ecrire });
const liee = (s: SalonAccessible, p: RecoPayload) => recoLiee(s, { messageId: `m-${s.salonId}`, date: '2026-11-09T15:38:00Z', reco: p }, () => `id-${s.salonId}`);

export function testRenduRecosDiscordPage() {
  titre('rendu · Recommandations — page avec des recommandations liées, hors connexion');
  const lieeSiege = liee(salon('siege'), contenu('Défenses GvO', [deck(ids.slice(0, 3))]));
  const html = rendreRecos({ recos: [...RECOS.recos, lieeSiege] });
  const t = texteVisible(html);
  ok(t.includes('Toutes les recommandations 3') && t.includes('Sur cet appareil 2'), 'colonne : « Toutes » et « Sur cet appareil », avec leurs comptes');
  ok(t.includes('Ma guilde') && t.includes('blacksmith-reco-siege À jour'), 'colonne : le serveur, son salon et son état');
  ok(/aria-current="true"[^>]*>(?:(?!<\/button>)[\s\S])*Toutes les recommandations/.test(html), '« Toutes les recommandations » choisie à l\'ouverture');
  ok(t.includes('Contres des défenses feu') && t.includes('Defs de guilde') && t.includes('Défenses GvO'), '« Toutes » montre les recommandations locales et celle du salon');
  ok(html.includes('data-provenance-carte'), 'les cartes portent leur provenance quand il y a des salons');
  ok(t.includes('Défenses GvO Consulter Analyser mes decks 1 deck · par Toto · avec Lulu blacksmith-reco-siege À jour Importée'),
    'l\'en-tête se lit de haut en bas : le nom, puis les decks et l\'auteur, enfin la source et les étiquettes');
  const b = boutons(html);
  ok(b.some((x) => x.ariaLabel === 'Détacher de ce salon'), 'la recommandation liée se détache, elle ne se supprime pas');
  ok(b.filter((x) => x.texte === 'Publier dans…').every((x) => x.desactive && x.title === 'Connecte-toi à Discord pour publier'),
    '« Publier dans… » toujours affiché, désactivé hors connexion avec sa raison');
  ok(b.some((x) => x.texte === 'Se connecter à Discord' && !x.desactive), 'encart : « Se connecter à Discord »');
  ok(b.some((x) => x.texte === 'Installer le bot sur ton serveur'), 'encart : l\'aide d\'installation');
  ok(t.includes('par Toto · avec Lulu'), 'auteur et contributeurs en lecture seule');
  // Au téléphone : les provenances et le compte EN TÊTE de la page, à plat.
  const tel = html.indexOf('data-provenances-telephone');
  ok(tel >= 0 && tel < html.indexOf('data-colonne-provenances') && tel < html.indexOf('placeholder="'),
    'téléphone : les provenances en tête de la page, avant la recherche');
  ok(!html.includes('data-selecteur-provenance') && !html.includes('aria-haspopup="dialog"'), 'téléphone : aucun sélecteur à dérouler');
  const blocTel = html.slice(tel, html.indexOf('</section>', tel));
  ok(texteVisible(blocTel).includes('Toutes les recommandations 3') && blocTel.includes('min-h-10') && blocTel.includes('data-compte-discord="deconnecte"'),
    'téléphone : les lignes au doigt, puis l\'encart Discord');
  ok(!html.includes('placeholder="Pseudo'), 'l\'auteur ne se saisit plus');
}

// ⚠️ Créé au moment du rendu : « lus à l'instant » se calcule sur l'heure
// courante, et la série de tests peut durer des minutes.
const etatConnecte = () => ({ statut: 'connecte' as const, utilisateur: { id: 'U', nom: 'tototriou15' }, sources: null, salons: [], luA: Date.now(), conservable: true });

function props(recos: Reco[], extra: Partial<PropsProvenances> = {}): PropsProvenances {
  return {
    groupes: groupesSalons(recos, null, ['b']), compteToutes: recos.length, compteAppareil: 0, provenance: { type: 'salon', salonId: 'b' },
    onChoisir: () => {}, discord: etatConnecte(), favoris: true, onFavori: () => {}, onConnecter: () => {}, onActualiser: () => {},
    onDeconnecter: () => {}, onAideInstallation: () => {}, ...extra,
  };
}

export function testRenduRecosDiscordComposants() {
  titre('rendu · Recommandations — colonne connectée, bandeau, publier dans, fusion');
  const a = liee(salon('a'), contenu('A', [deck(ids.slice(0, 3))]));
  const b = { ...liee(salon('b'), contenu('B', [deck(ids.slice(3, 6))])), note: 'modifiée' };
  const colonne = rendre(<ColonneProvenances {...props([a, b])} />);
  const tc = texteVisible(colonne);
  ok(tc.includes('tototriou15') && tc.includes('Salons lus à l\'instant'), 'compte connecté : qui, et quand les salons ont été lus');
  const bc = boutons(colonne);
  ok(bc.some((x) => x.ariaLabel === 'Relire les salons') && bc.some((x) => x.ariaLabel === 'Se déconnecter de Discord'), 'Actualiser et Se déconnecter');
  ok(bc.some((x) => x.ariaLabel === 'Installer le bot sur ton serveur'), 'connecté aussi : l\'aide d\'installation');

  // Le guide d'installation : l'invitation publique, puis le salon et ses droits.
  let invite = 0;
  const guide = rendre(<CorpsInstallation onInviter={() => { invite++; }} />);
  const tg = texteVisible(guide);
  ok(tg.includes('Invite le bot sur ton serveur') && tg.includes('blacksmith-reco') && tg.includes('joindre des fichiers'),
    'guide : inviter le bot, nommer le salon, lui donner ses quatre droits');
  ok(!tg.includes('quelques guildes'), 'guide : le bot n\'est plus réservé à quelques serveurs');
  ok(boutons(guide).some((x) => x.texte === 'Inviter le bot'), 'guide : le bouton « Inviter le bot »');
  egal(invite, 0, 'guide : rien n\'est ouvert au rendu');
  egal(bc.filter((x) => x.ariaLabel === 'Retirer des favoris' || x.ariaLabel === 'Mettre en favori').map((x) => [x.ariaLabel, x.presse]),
    [['Retirer des favoris', true], ['Mettre en favori', false]], 'application de bureau : une étoile par salon, le favori en tête');
  ok(!boutons(rendre(<ColonneProvenances {...props([a, b], { favoris: false })} />)).some((x) => x.ariaLabel === 'Mettre en favori'), 'sur le site : pas d\'étoile');
  ok(!colonne.includes('data-connexion-non-gardee'), 'connexion gardée : rien à dire');
  ok(texteVisible(rendre(<ColonneProvenances {...props([a], { discord: { ...etatConnecte(), conservable: false } })} />))
    .includes('Connexion gardée jusqu\'à la fermeture : ce système ne sait pas la chiffrer.'),
  'application de bureau sans trousseau : la connexion ne survit pas à la fermeture, et c\'est dit');
  ok(boutons(rendre(<ColonneProvenances {...props([a], { discord: { ...etatConnecte(), statut: 'code', utilisateur: null } })} />))
    .some((x) => x.texte === 'Se connecter à Discord' && !x.desactive), 'en attente du code : l\'encart reste, la connexion se relance');

  // Application de bureau : le code collé ; site : le code à copier.
  const code = rendre(<CorpsCodeBureau code="" erreur={null} onCode={() => {}} onRelancer={() => {}} />);
  ok(texteVisible(code).includes('Le site affiche alors un code : copie-le. Colle-le ici.') && code.includes('aria-label="Code de connexion"'),
    'bureau : les étapes, puis le champ du code');
  ok(boutons(code).some((x) => x.texte === 'Rouvrir la page dans le navigateur'), 'bureau : la page de connexion se rouvre');
  ok(texteVisible(rendre(<CorpsCodeBureau code="x" erreur="invalide" onCode={() => {}} onRelancer={() => {}} />)).includes('il a plus de 10 minutes'),
    'bureau : un code refusé, et pourquoi');
  const site = rendre(<CorpsCodeSite code="abc-123_XYZ" />);
  ok(site.includes('value="abc-123_XYZ"') && /readOnly=""|readonly=""/.test(site), 'site : le code, en lecture seule');
  ok(boutons(site).some((x) => x.texte === 'Copier le code'), 'site : « Copier le code »');
  ok(texteVisible(site).includes('Ne donne ce code à personne') && site.indexOf('data-avertissement-code') < site.indexOf('value="abc-123_XYZ"'),
    'site : l\'avertissement contre l\'hameçonnage, avant le code');

  const publier = (r: Reco, connecte = true) => boutons(rendre(<BandeauSalon reco={r} connecte={connecte} enCours={false} onPublier={() => {}} onFusionner={() => {}} />));
  egal(publier(a).map((x) => [x.texte, x.desactive, x.title]), [['Publier', true, 'Rien à publier : la recommandation est celle du salon']], 'à jour : « Publier » désactivé, avec sa raison');
  egal(publier(b).map((x) => [x.texte, x.desactive]), [['Publier', false]], 'modifiée : publiable');
  egal(publier(b, false)[0].title, 'Connecte-toi à Discord pour publier', 'hors connexion : la raison');
  const lecture = { ...liee(salon('c', false), contenu('C', [deck(ids.slice(0, 3))])), note: 'x' };
  egal(publier(lecture)[0].title, 'Tu ne peux pas publier dans ce salon', 'lecture seule : la raison');
  const conflit = recevoirVersion(b, salon('b'), { messageId: 'm2', date: '2026-11-09T16:02:00Z', reco: contenu('B', [deck(ids.slice(3, 6), 'du salon')]) });
  egal(publier(conflit).map((x) => [x.texte, x.desactive]), [['Fusionner', false]], 'conflit : « Fusionner » à la place de « Publier »');
  ok(texteVisible(rendre(<BandeauSalon reco={b} connecte enCours={false} onPublier={() => {}} onFusionner={() => {}} />)).includes('Ma guilde › #blacksmith-reco-b Modifiée'),
    'bandeau : serveur › salon et état');

  const liste = rendre(<ListeSalonsPublication choisi="n" onChoisir={() => {}} salons={[
    { serveurId: 'G1', salonId: 'a', nomServeur: 'Ma guilde', nomSalon: 'blacksmith-reco-a', ecrire: true, porte: 'A' },
    { serveurId: 'G1', salonId: 'n', nomServeur: 'Ma guilde', nomSalon: 'blacksmith-reco-neuf', ecrire: true, porte: null },
    { serveurId: 'G1', salonId: 'c', nomServeur: 'Ma guilde', nomSalon: 'blacksmith-reco-c', ecrire: false, porte: 'C' },
  ]} />);
  const tl = texteVisible(liste);
  ok(tl.includes('blacksmith-reco-a Ma guilde · porte « A »') && tl.includes('blacksmith-reco-neuf Ma guilde · vide') && tl.includes('blacksmith-reco-c Ma guilde · lecture seule'),
    '« Publier dans… » : chaque salon et ce qu\'il porte');
  ok(boutons(liste).filter((x) => x.desactive).length === 1, 'un salon en lecture seule ne se choisit pas');
  ok(texteVisible(rendre(<ListeSalonsPublication choisi={null} onChoisir={() => {}} salons={[]} />)).includes('Aucun salon blacksmith-reco… accessible'), 'aucun salon : dit');

  // Fusion : B changé des deux côtés (consignes), nom changé au salon, un deck ajouté chez moi.
  const base = contenu('B', [deck(ids.slice(3, 6))]);
  const r0 = liee(salon('b'), base);
  const mien: Reco = { ...r0, decks: [deck(ids.slice(3, 6), 'ma note'), deck(ids.slice(6, 9))] };
  const r = recevoirVersion(mien, salon('b'), { messageId: 'm2', date: 'd', reco: contenu('B S12', [deck(ids.slice(3, 6), 'note du salon')]) });
  const fusion = fusionEnAttente(r, parCom2us)!;
  const corps = rendre(<CorpsFusion fusion={fusion} choix={{ decks: {} }} onChoix={() => {}} monsterByCom2us={parCom2us} />);
  const tf = texteVisible(corps);
  ok(tf.includes('Déjà fusionné, 1 changement') && tf.includes('ta version'), 'ce qui a passé seul est dit (le deck ajouté chez moi)');
  ok(tf.includes('À choisir, 1') && tf.includes('« ma note »') && tf.includes('« note du salon »'), 'le deck changé des deux côtés : les deux versions');
  egal(boutons(corps).filter((x) => ['Le mien', 'Celui du salon', 'Les deux'].includes(x.texte)).length, 3, 'le choix : le mien, celui du salon, les deux');
}
