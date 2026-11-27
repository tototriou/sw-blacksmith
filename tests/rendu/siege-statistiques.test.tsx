// Tests de rendu — Siège › Statistiques (src/components/siege/SiegeStatistiques.tsx) :
// le site renvoie vers l'application de bureau ; dans l'app, les sièges relevés,
// aux deux formats. Données fabriquées : aucun nom réel. Principe dans
// tests/rendu/outils-rendu.tsx.

import SiegeStatistiques, { Releves } from '../../src/components/siege/SiegeStatistiques';
import { COMBATS_PAR_PAGE, JOURS_GLISSANTS, TOUS_LES_SIEGES, type RelevesSiege, type SiegeReleve } from '../../src/lib/siegeStatistiques';
import { Tendance } from '../../src/components/siege/SiegeStatsElements';
import type { RecosPourAjout } from '../../src/components/siege/AjoutOffenseReco';
import { fr } from '../../src/i18n/fr';
import Tableau from '../../src/ui/Tableau';
import { Legende } from '../../src/components/siege/SiegeGraphes';
import type { Monster } from '../../src/types';
import { ok, titre } from '../outils';
import { auTelephone, boutons, rendre, texteVisible, valeurs } from './outils-rendu';

const s = fr.siegeStats;
const MOI = 1;
const siege = (resume: boolean): SiegeReleve => ({
  siegeId: 2026110302,
  matchId: 2026110302000001,
  debut: Date.UTC(2026, 10, 17, 11) / 1000,
  fin: Date.UTC(2026, 10, 17, 18) / 1000,
  vu: Date.UTC(2026, 10, 17, 18) / 1000,
  guildes: [
    { id: 10, nom: 'Les Forgerons', position: 1, rang: 2, score: 8269, membres: 25, attaques: 204, monstresUtilises: 612, mienne: true },
    { id: 20, nom: 'Les Autres', position: 2, rang: 1, score: 20000, membres: 25, attaques: 237, monstresUtilises: 705, mienne: false },
  ],
  joueurs: [
    { id: MOI, nom: 'Moi-même', guilde: 10 },
    { id: 2, nom: 'Allié', guilde: 10 },
    { id: 3, nom: 'Adversaire', guilde: 20 },
  ],
  attaques: [
    { t: Date.UTC(2026, 10, 17, 12, 2) / 1000, attaquant: MOI, guildeAttaquante: 10, defenseur: 3, guildeDefense: 20, victoire: true, base: 23, monstres: { attaque: [101, 102, 103], defense: [201, 202, 203] }, points: 15, tour: 5 },
    { t: Date.UTC(2026, 10, 17, 12, 4) / 1000, attaquant: MOI, guildeAttaquante: 10, defenseur: 3, guildeDefense: 20, victoire: false, base: null, monstres: null, points: 0, tour: null },
    // L'adversaire attaque l'allié, et perd : un combat gagné en défense.
    { t: Date.UTC(2026, 10, 17, 13, 0) / 1000, attaquant: 3, guildeAttaquante: 20, defenseur: 2, guildeDefense: 10, victoire: false, base: 4, monstres: null, points: null, tour: 5 },
  ],
  defenses: [
    { deck: 71, joueur: 2, guilde: 10, bases: [4], victoires: 1, nuls: 0, defaites: 3, monstres: null },
    { deck: 72, joueur: 3, guilde: 20, bases: [12], victoires: 5, nuls: 0, defaites: 1, monstres: [201, 202, 203] },
  ],
  monstresUtilises: resume ? [{ joueur: MOI, n: 6 }] : [],
  attendues: resume ? [MOI, 2, 3].map((joueur) => ({ joueur, n: 10 })) : [],
  resultat: { rang: 2, nbGuildes: 2, score: 1461, variation: 0 },
  sources: { carte: true, resume, journaux: 1, defenses: true },
});
const releves = (resume = true): RelevesSiege => ({
  moi: MOI,
  maGuilde: 10,
  sieges: [siege(resume)],
  saison: {
    t: 0,
    courante: { numero: 22, classement: 96, nbGuildes: 20402, score: 1461, victoires: 11, nuls: 11, defaites: 6, tauxVictoire: 39.3 },
    precedente: null,
    meilleure: { numero: 21, classement: 31, nbGuildes: 20836, score: 1482, victoires: 12, nuls: 10, defaites: 4, tauxVictoire: 46.2 },
  },
  membres: null,
});
const APRES = Date.UTC(2026, 10, 18) / 1000;
// Aucune recommandation : la page ne les touche qu'au clic, jamais au rendu ;
// Discord éteint, rien n'est lu.
const RECOS: RecosPourAjout = {
  state: { recos: [] }, addReco: () => '', ajouterOffense: () => {},
  synchroniserDiscord: () => ({ ajoutees: 0, misesAJour: 0, conflits: 0, retirees: 0, detachees: 0 }), apresPublicationDiscord: () => {}, apresConflitDiscord: () => {},
};

export function testRenduSiegeStatistiquesSite() {
  titre('rendu · Siège › Statistiques — sur le site, et au chargement dans l’app');
  const html = rendre(<SiegeStatistiques monsters={[]} recos={RECOS} />);
  ok(texteVisible(html).includes(s.site), 'sur le site : il faut l’application de bureau et le plugin');
  const liens = valeurs(html, 'href');
  ok(liens.includes('#/telecharger') && liens.includes('#/sw-exporter'), 'et la page renvoie vers Télécharger et la page du plugin');

  const pont = globalThis as { swblacksmithBureau?: unknown };
  pont.swblacksmithBureau = { bureau: true, plateforme: 'win32', swex: { sieges: async () => null, surSiegesChanges: () => () => {} } };
  try {
    ok(texteVisible(rendre(<SiegeStatistiques monsters={[]} recos={RECOS} />)).includes(s.chargement), 'dans l’app : la lecture des sièges s’annonce');
  } finally {
    delete pont.swblacksmithBureau;
  }
}

function verifier(html: string, format: string) {
  const texte = texteVisible(html);
  ok(texte.includes(s.saison(22)) && texte.includes(s.place(96)), `${format} : la saison et son classement`);
  ok(texte.includes(s.meilleur(21, s.place(31))), `${format} : le meilleur classement`);
  ok(texte.includes('Les Forgerons') && texte.includes('Les Autres') && texte.includes(s.maGuilde), `${format} : les guildes, la mienne marquée`);
  ok(html.includes(s.contreGuildes(['Les Autres'])) && !html.includes('pts</option>'), `${format} : la liste des sièges dit la date et l’adversaire, pas les points`);
  const c = s.comparatif;
  ok(texte.includes(c.titre) && texte.includes(c.classement) && texte.includes(c.faceAFace), `${format} : les guildes du siège — classement et face-à-face`);
  const classement = texte.slice(texte.indexOf(c.classement), texte.indexOf(c.faceAFace));
  ok(
    classement.indexOf('Les Autres') < classement.indexOf('Les Forgerons') && classement.includes(s.place(1)) && classement.includes(c.attaques('204', '20')),
    `${format} : le classement au rang final (les autres 1re, nous 2e), la participation sous chaque guilde`
  );
  ok(html.includes('bg-guilde-bleue') && html.includes('bg-guilde-rouge') && html.includes('<circle cx="10" cy="10" r="8"'), `${format} : une barre et un emblème à la couleur de chaque guilde`);
  ok(
    texte.includes(c.contre('Les Autres')) && texte.includes(c.resumeDuel('2', '1', '50')) && texte.includes(c.resumeDuel('1', '0', '0')) && !texte.includes(c.contre('Les Forgerons')),
    `${format} : face-à-face avec chaque AUTRE guilde — nos 2 attaques (1 gagnée), sa 1 attaque sur nous (perdue)`
  );
  ok(html.includes(s.tousLesSieges(1)), `${format} : « Tous les sièges » en tête de la liste`);
  ok(texte.includes(s.membresTitre) && texte.includes('Moi-même') && texte.includes(s.abr.attaques(2)), `${format} : ma guilde, membre par membre, en abrégé`);
  ok(html.includes(`title="${s.voirJoueur('Allié')}`) && html.includes(s.attaques(2)), `${format} : un membre s’ouvre sur ses statistiques ; le texte entier est dans l’infobulle`);
  ok(texte.includes(s.defensesTitre) && texte.includes(s.abr.tenues(1, 1)) && texte.includes(s.defensesDepuisCombats), `${format} : les défenses de la guilde, d’après les combats — l’allié a gagné son seul combat`);
  ok(texte.includes(s.combatsTitre) && texte.includes('Moi-même') && texte.includes(s.fleche) && texte.includes(s.versus), `${format} : les combats aux monstres connus, qui contre qui, face à face`);
  ok(
    !html.includes('text-guilde-bleue">Les Forgerons<') && html.includes('text-guilde-rouge">Les Autres<'),
    `${format} : à côté d’un joueur adverse, le nom de sa guilde à sa couleur ; jamais la mienne`
  );
  ok(html.includes('title="Gardien Un"') && html.includes('title="Défenseur Un"'), `${format} : les portraits de l’attaque et de la défense`);
  ok(texte.includes(s.defensesAdversesTitre) && html.includes('title="Défenseur Un"') && texte.includes(s.abr.tenues(0, 1)), `${format} : les défenses adverses, avec les monstres vus dans le journal du combat`);
  ok(
    texte.includes(s.filtres.resultat.victoires) && html.includes(`aria-label="${s.filtres.monstre}"`) && texte.includes(s.filtres.cote.defense),
    `${format} : les filtres — résultat, monstre, côté`
  );
  ok(texte.includes(s.bilanCombats(1, 1, 0, '100')), `${format} : le bilan des combats affichés`);
  ok(
    html.includes(`aria-label="${s.tourDetail(s.tour(9), s.couleursGuilde.rouge, 23)}"`) && html.includes('rgb(var(--forge-guilde-rouge))') && html.includes('<circle cx="10" cy="10" r="8"'),
    `${format} : la base 23 se lit comme sur la carte du jeu — l’écusson rond de la tour 9 du territoire rouge`
  );
}

// Trois monstres d'attaque et trois de défense, fabriqués (portraits sans image).
const monstre = (com2usId: number, name: string): Monster =>
  ({ id: com2usId, com2usId, name, element: 'fire', stars: 6, naturalStars: 5, secondAwaken: false, image: null,
    stats: { hp: 1, attack: 1, defense: 1, speed: 1, critRate: 0, critDamage: 0, resistance: 0, accuracy: 0 }, leaderSkill: null }) as Monster;
const MONSTRES: Monster[] = [
  monstre(101, 'Gardien Un'), monstre(102, 'Gardien Deux'), monstre(103, 'Gardien Trois'),
  monstre(201, 'Défenseur Un'), monstre(202, 'Défenseur Deux'), monstre(203, 'Défenseur Trois'),
];

// La vue d'ensemble, ouverte par défaut : les chiffres et les graphes.
function verifierEnsemble(html: string, format: string) {
  const texte = texteVisible(html);
  const e = s.ensemble;
  ok(
    [s.angles.guilde, s.angles.membre, s.vues.ensemble, s.vues.detail].every((l) => texte.includes(l)) && !texte.includes('Un joueur'),
    `${format} : deux angles, Guilde et Membre, chacun en vue d’ensemble ou en détail`
  );
  ok(texte.includes(e.tauxAttaque) && texte.includes('50 %') && texte.includes(e.surAttaques(1, 1)), `${format} : les chiffres de ma guilde — victoires en attaque, une gagnée, une perdue`);
  ok(
    texte.includes(e.tenue) && texte.includes('100 %') && !texte.includes('combats gagnés sur'),
    `${format} : les victoires en défense, d’après les combats du siège (pas les compteurs des decks) — le WR seul, sans « n combats gagnés sur m »`
  );
  ok(
    texte.indexOf(e.tauxAttaque) < texte.indexOf(s.comparatif.titre) && texte.indexOf(s.comparatif.titre) < texte.indexOf(e.courbeTitre),
    `${format} : les guildes du siège sous nos chiffres, avant les graphes`
  );
  ok(
    texte.includes(e.courbeTitre) && html.includes('<svg') && html.includes('rgb(var(--guilde-bleue))') && html.includes('rgb(var(--guilde-rouge))'),
    `${format} : la courbe des victoires, aux couleurs des guildes sur la carte du jeu (position 1 bleue, 2 rouge)`
  );
  ok(
    [e.legendeFaites, e.legendeGagnees, e.legendeCombats, e.legendeAttaquesPerdues].every((l) => texte.includes(l)) && texte.includes('Les Forgerons'),
    `${format} : les légendes — les guildes, les styles de trait de la courbe, la mesure des barres`
  );
  ok(
    ['Les Forgerons', 'Les Autres', e.legendeFaites, e.legendeGagnees].every((nom) => html.includes(`title="${e.legendeMasquer(nom)}"`)) && html.includes('bg-guilde-rouge'),
    `${format} : la légende de la courbe se clique — chaque guilde, chaque mesure`
  );
  ok(!texte.includes(e.evolutionTitre), `${format} : un siège choisi — pas de WR au fil des sièges, on veut SES chiffres`);
  // L'interrupteur des infobulles est celui des GRAPHES, dans leur cadre : ici
  // la courbe du siège (l'historique n'a qu'un siège) — pas les classements
  // d'équipes.
  ok(texte.split(e.infobulles).length - 1 === 1 && html.split('role="switch"').length - 1 === 1, `${format} : la courbe porte l’interrupteur de ses infobulles, les classements d’équipes non`);
  ok(
    texte.includes(e.tableauAttaquesTitre) &&
      [e.colonnes.victoires, e.colonnes.defaites, e.colonnes.manquees, e.colonnes.taux].every((c) => texte.includes(c)),
    `${format} : le tableau des attaques et ses colonnes`
  );
  ok(!texte.includes('Perf.') && !texte.includes('Pts'), `${format} : ni performance ni points (retirés à la demande)`);
  ok(
    [e.colonnes.tour5, e.colonnes.tour4].every((c) => texte.includes(c)) && html.includes(`title="${e.titresColonnes.tour4}`),
    `${format} : les colonnes par tour, 5★ et 4★, expliquées en infobulle`
  );
  ok(texte.includes('1 /1') && html.includes(`title="100 %"`), `${format} : ma victoire sur une tour 5★ — 1/1, son taux en infobulle`);
  ok(texte.includes('50 %') && html.includes('>8<'), `${format} : ma ligne — 50 % de WR, 8 attaques manquées`);
  ok(
    !html.includes('aria-sort="descending"') && !html.includes('aria-sort="ascending"') && html.includes(`aria-label="${e.trier(e.titresColonnes.victoires)}"`),
    `${format} : le tableau de la librairie s’ouvre sans colonne triée, chaque en-tête triable`
  );
  const tableau = html.slice(html.indexOf(e.tableauAttaquesTitre), html.indexOf(e.tableauDefensesTitre));
  ok(
    tableau.indexOf(`aria-label="${s.voirJoueur('Allié')}"`) < tableau.indexOf(`aria-label="${s.voirJoueur('Moi-même')}"`),
    `${format} : l’ordre de base, alphabétique`
  );
  ok(e.colonnes.taux === 'WR' && e.colonnes.tenue === 'WR' && texte.includes('WR'), `${format} : le win rate s’appelle WR`);
  ok(html.includes(`aria-label="${s.voirJoueur('Allié')}"`), `${format} : un nom ouvre les statistiques du membre`);
  ok(texte.includes(e.tableauDefensesTitre) && texte.includes('100 %') && texte.includes(e.colonnes.tenue), `${format} : le tableau des défenses — l’allié a gagné son seul combat`);
  ok(
    texte.includes(e.jouesTitre) && texte.includes(e.combatsEquipe(1, '100')) && html.includes('Gardien Un, Gardien Deux, Gardien Trois'),
    `${format} : les équipes les plus jouées en attaque — trois portraits, leurs noms en infobulle`
  );
  ok(texte.includes(e.battentTitre) && texte.includes(e.aucuneEquipe), `${format} : aucune défense ne nous a battus aux monstres connus — la page le dit`);
  ok(!texte.includes(s.filtres.monstre) && !html.includes(`aria-label="${s.filtres.monstre}"`), `${format} : pas de filtres sur la vue d’ensemble`);
}

// La vue d'ensemble d'un membre (moi) : ses chiffres, son WR au fil des
// sièges, ses offenses par tour, les défenses qui le battent.
function verifierMembre(html: string, format: string) {
  const texte = texteVisible(html);
  const e = s.ensemble;
  const m = s.membre;
  ok(texte.includes(s.choixJoueur) && html.includes(`aria-label="${s.choixJoueur}"`), `${format} : le choix du membre`);
  ok(texte.includes(e.tauxAttaque) && texte.includes('50 %') && texte.includes(e.surAttaques(1, 1)), `${format} : ses chiffres — une attaque gagnée, une perdue`);
  ok(
    texte.includes(m.evolutionTitre) && texte.includes(m.unSeulSiege) && [m.legendeAttaque, m.legendeDefense].every((l) => texte.includes(l)) && html.includes('rgb(var(--serie-2))'),
    `${format} : son WR au fil des sièges — un seul siège relevé, la page le dit ; attaque et défense légendées`
  );
  ok(texte.split(e.infobulles).length - 1 === 1, `${format} : la courbe porte l’interrupteur de ses infobulles`);
  ok(!html.includes('touch-pan-y cursor-pointer'), `${format} : sa courbe n’ouvre pas de siège (celle de la guilde seulement)`);
  ok([m.legendeAttaque, m.legendeDefense].every((nom) => html.includes(`title="${e.legendeMasquer(nom)}"`)), `${format} : attaque et défense se masquent depuis la légende`);
  ok(
    texte.includes(m.offenses5Titre) && texte.includes(e.combatsEquipe(1, '100')) && html.includes('Gardien Un, Gardien Deux, Gardien Trois'),
    `${format} : ses offenses sur les tours 5★ — son équipe gagnante`
  );
  ok(texte.includes(m.offenses4Titre) && texte.includes(m.aucuneOffense), `${format} : aucune offense sur les tours 4★ — la page le dit`);
  ok(texte.includes(m.battentTitre) && texte.includes(m.aucuneDefaite), `${format} : sa défaite est contre une défense aux monstres inconnus — aucune équipe nommée`);
  ok(!html.includes(`aria-label="${s.filtres.monstre}"`) && !texte.includes(s.combatsTitre), `${format} : ni filtres ni combats sur la vue d’ensemble`);
}

// Le siège relevé, ouvert seul : ce qui n'a de sens que pour UN siège (courbe
// heure par heure, cartes des guildes) s'y vérifie.
const UN = siege(true).matchId;

export function testRenduSiegeStatistiques() {
  titre('rendu · Siège › Statistiques — les sièges relevés, à l’ordinateur');
  const parDefaut = rendre(<Releves recos={RECOS} releves={releves()} monsters={MONSTRES} maintenant={APRES} />);
  ok(
    parDefaut.includes(`<option value="${TOUS_LES_SIEGES}" selected="">`) && !texteVisible(parDefaut).includes(s.ensemble.courbeTitre) && texteVisible(parDefaut).includes(s.ensemble.sieges),
    'la page s’ouvre sur « Tous les sièges » : le nombre de sièges, pas de courbe heure par heure'
  );
  ok(
    texteVisible(parDefaut).includes(s.ensemble.evolutionTitre) && texteVisible(parDefaut).includes(s.membre.unSeulSiege) && parDefaut.includes('touch-pan-y cursor-pointer'),
    '« Tous les sièges » : le WR de la guilde siège par siège, qui ouvre un siège au clic — un seul siège relevé, la page le dit'
  );
  ok(
    !texteVisible(rendre(<Releves recos={RECOS} releves={releves()} monsters={MONSTRES} maintenant={APRES} angleDepart="membre" siegeDepart={UN} />)).includes(s.membre.evolutionTitre),
    'un membre, un siège choisi : pas de WR au fil des sièges non plus'
  );
  // La tendance des WR, sous eux : sur « Tous les sièges », pour la guilde et
  // pour un membre ; jamais sur un siège choisi (il dure deux jours). Un siège
  // 40 jours plus tôt : j'y ai gagné mon attaque (WR 100 → 50, en baisse) et
  // l'allié y a perdu sa défense (0 → 100, en hausse).
  const J = 86_400;
  const ancien: SiegeReleve = {
    ...siege(true),
    siegeId: 2026100801,
    matchId: 2026100801000001,
    debut: siege(true).debut! - 40 * J,
    fin: siege(true).fin! - 40 * J,
    vu: siege(true).vu! - 40 * J,
    attaques: [
      { t: siege(true).debut! - 40 * J + 60, attaquant: MOI, guildeAttaquante: 10, defenseur: 3, guildeDefense: 20, victoire: true, base: null, monstres: null, points: 0, tour: null },
      { t: siege(true).debut! - 40 * J + 120, attaquant: 3, guildeAttaquante: 20, defenseur: 2, guildeDefense: 10, victoire: true, base: null, monstres: null, points: null, tour: null },
    ],
  };
  const deuxMois: RelevesSiege = { ...releves(), sieges: [siege(true), ancien] };
  const ecart = s.ensemble.glissantEcart(JOURS_GLISSANTS);
  const signe = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })} %`;
  const enHausse = (html: string, texte: string) => new RegExp(`text-good"><svg[^]*?</svg>${texte.replace('+', '\\+')}`).test(html);
  const enBaisse = (html: string, texte: string) => new RegExp(`text-bad"><svg[^]*?</svg>${texte}`).test(html);
  const guilde = rendre(<Releves recos={RECOS} releves={deuxMois} monsters={MONSTRES} maintenant={APRES} />);
  const chiffres = guilde.slice(guilde.indexOf(s.ensemble.tauxAttaque), guilde.indexOf(s.ensemble.evolutionTitre));
  ok(
    enBaisse(chiffres, signe(-50)) && enHausse(chiffres, signe(100)) && chiffres.indexOf(signe(-50)) < chiffres.indexOf(s.ensemble.tenue),
    '« Tous les sièges » : sous le WR en attaque, « -50 % » en rouge ; sous celui en défense, « +100 % » en vert — chacun avec sa flèche, jamais la couleur seule'
  );
  ok(!texteVisible(chiffres).includes(`${s.ensemble.tauxAttaque} ·`) && texteVisible(chiffres).includes(ecart), 'pas de chiffre de plus : la flèche s’ajoute aux WR déjà affichés');
  const membre = rendre(<Releves recos={RECOS} releves={deuxMois} monsters={MONSTRES} maintenant={APRES} angleDepart="membre" />);
  ok(enBaisse(membre, signe(-50)), '« Tous les sièges » : la tendance d’un membre aussi — mon WR en attaque baisse');
  ok(!texteVisible(parDefaut).includes(ecart), 'un seul siège relevé : rien le mois d’avant, pas de flèche');
  ok(
    ![rendre(<Releves recos={RECOS} releves={deuxMois} monsters={MONSTRES} maintenant={APRES} siegeDepart={UN} />), rendre(<Releves recos={RECOS} releves={deuxMois} monsters={MONSTRES} maintenant={APRES} angleDepart="membre" siegeDepart={UN} />)].some((h) =>
      texteVisible(h).includes(ecart)
    ),
    'un siège choisi : pas de tendance, ni pour la guilde ni pour un membre'
  );
  const stable = rendre(<Tendance wr={{ taux: 92, n: 40, ecart: 0.04 }} />);
  ok(!/text-(good|bad)/.test(stable) && texteVisible(stable).includes(ecart), 'un écart arrondi à zéro : ni vert ni rouge');
  ok(
    !guilde.slice(guilde.indexOf(s.ensemble.historiqueTitre)).includes('role="switch"') && !guilde.includes(' pts'),
    'le score par siège : ni infobulle ni interrupteur — tout est écrit sur la ligne'
  );
  // Une légende dont une série est masquée : barrée, relâchée ; la dernière
  // affichée ne se masque pas.
  const legende = rendre(
    <Legende
      elements={[
        { couleur: 0, nom: 'Attaque', cle: 'a' },
        { couleur: 1, nom: 'Défense', cle: 'd' },
      ]}
      masques={['d']}
      onBasculer={() => {}}
    />
  );
  ok(
    legende.includes('aria-pressed="false"') && legende.includes('line-through') && legende.includes(`title="${s.ensemble.legendeAfficher('Défense')}"`),
    'légende : une série masquée se dit relâchée, son nom barré, et se réaffiche au clic'
  );
  ok(legende.includes('disabled=""') && legende.includes(`title="${s.ensemble.legendeDerniere}"`), 'légende : la dernière série affichée ne se masque pas, désactivée à sa place');
  ok(!rendre(<Legende elements={[{ couleur: 0, nom: 'Score', cle: 's' }]} onBasculer={() => {}} />).includes('<button'), 'légende : une seule entrée ne se clique pas');
  verifierEnsemble(rendre(<Releves recos={RECOS} releves={releves()} monsters={MONSTRES} maintenant={APRES} siegeDepart={UN} />), 'ordinateur');
  verifier(rendre(<Releves recos={RECOS} releves={releves()} monsters={MONSTRES} maintenant={APRES} vueDepart="detail" siegeDepart={UN} />), 'ordinateur');
  verifierMembre(rendre(<Releves recos={RECOS} releves={releves()} monsters={MONSTRES} maintenant={APRES} angleDepart="membre" />), 'ordinateur');
  const detailMembreHtml = rendre(<Releves recos={RECOS} releves={releves()} monsters={MONSTRES} maintenant={APRES} angleDepart="membre" vueDepart="detail" />);
  const detailMembre = texteVisible(detailMembreHtml);
  ok(
    detailMembre.includes(s.attaquesTitre) && detailMembre.includes(s.filtres.resultat.victoires) && !detailMembre.includes(s.membre.evolutionTitre),
    'le détail d’un membre : ses combats, filtrables, sans les graphes'
  );
  // « Ajouter à une recommandation » : sur chaque carte de combat, actif sur
  // une victoire aux six monstres connus, désactivé avec sa raison sinon.
  const a = s.ajoutReco;
  const ajouts = boutons(detailMembreHtml).filter((b) => b.ariaLabel?.startsWith(a.bouton));
  ok(
    ajouts.length === 2 && ajouts.some((b) => b.ariaLabel === a.bouton && !b.desactive),
    'ajout à une recommandation : un bouton par combat, actif sur la victoire aux monstres connus'
  );
  ok(
    ajouts.some((b) => b.desactive && b.title === `${a.bouton} — ${a.raisons.defaite}`),
    'ajout à une recommandation : toujours affiché sur une défaite, désactivé, la raison en infobulle'
  );
  const sansMonstres = boutons(
    rendre(<Releves recos={RECOS} releves={releves()} monsters={MONSTRES.slice(0, 5)} maintenant={APRES} vueDepart="detail" siegeDepart={UN} />)
  ).filter((b) => b.ariaLabel?.startsWith(a.bouton));
  ok(
    sansMonstres.length === 1 && sansMonstres[0].desactive && sansMonstres[0].title === `${a.bouton} — ${a.raisons.monstresInconnus}`,
    'ajout à une recommandation : un monstre du combat absent des données, désactivé — un deck ne se compose que de monstres connus'
  );
  const sansResume = rendre(<Releves recos={RECOS} releves={releves(false)} monsters={MONSTRES} maintenant={APRES} vueDepart="detail" siegeDepart={UN} />);
  ok(texteVisible(sansResume).includes(s.manques.resume), 'le journal des combats jamais ouvert : la page le dit');
  ok(sansResume.includes(s.monstresInconnus), 'et les monstres utilisés restent inconnus, pas zéro');
  const r = releves();
  const sansDefenses = texteVisible(
    rendre(<Releves recos={RECOS} releves={{ ...r, sieges: [{ ...r.sieges[0], defenses: [], sources: { ...r.sieges[0].sources, defenses: false } }] }} monsters={MONSTRES} maintenant={APRES} vueDepart="detail" />)
  );
  ok(!sansDefenses.includes(s.abr.decks(0)), 'decks inconnus : aucun membre n’affiche « 0 déf. »');
  ok(sansDefenses.includes(s.defensesAdversesTitre) && sansDefenses.includes(s.abr.tenues(0, 1)), 'sans les decks de la carte, les défenses se reconstituent quand même d’après les combats');

  ok(
    texteVisible(rendre(<Releves recos={RECOS} releves={releves()} monsters={MONSTRES} maintenant={APRES} siegeDepart={UN} />)).includes(s.maGuilde) &&
      !texteVisible(rendre(<Releves recos={RECOS} releves={releves()} monsters={MONSTRES} maintenant={APRES} siegeDepart={UN} angleDepart="membre" />)).includes(s.maGuilde),
    'les cartes des guildes du siège (score, rang) sous l’angle « Guilde » seulement'
  );

  // Quatre sièges de dix combats aux monstres connus : 40 combats, plus d'une page.
  const quatre: RelevesSiege = {
    ...releves(),
    sieges: [0, 1, 2, 3].map((k) => {
      const x = siege(true);
      const dix = Array.from({ length: 10 }, (_, i) => ({ ...x.attaques[0], t: x.attaques[0].t + i * 60 }));
      return { ...x, matchId: x.matchId - k, debut: x.debut! - k * 3.5 * 86400, fin: x.fin! - k * 3.5 * 86400, attaques: [...dix, ...x.attaques.slice(1)] };
    }),
  };
  const detailTous = rendre(<Releves recos={RECOS} releves={quatre} monsters={MONSTRES} maintenant={APRES} vueDepart="detail" />);
  ok(
    detailTous.split('<h3').length - 1 === 3 && detailTous.split(`>${s.fleche}<`).length - 1 === COMBATS_PAR_PAGE,
    `« Tous les sièges », détail : les combats siège par siège, ${COMBATS_PAR_PAGE} combats par page (ici trois sièges)`
  );
  ok(detailTous.split(`aria-label="${fr.pagination.allerA}"`).length - 1 === 2, 'le pager des combats, en tête et au pied');
  ok(
    detailTous.includes(s.bilanCombats(40, 40, 0, '100')) && detailTous.split(s.bilanCombats(10, 10, 0, '100')).length - 1 === 3,
    'le bilan de tous les combats en tête, celui de chaque siège sous sa date'
  );
  // Ses attaques : onze par siège (dix, plus une sans monstres) — le troisième siège est coupé.
  const membreTous = rendre(<Releves recos={RECOS} releves={quatre} monsters={MONSTRES} maintenant={APRES} vueDepart="detail" angleDepart="membre" />);
  ok(membreTous.split('<h3').length - 1 === 3 && !membreTous.includes(`(${s.suite})`), 'le détail d’un membre : ses attaques siège par siège aussi, la suite d’un siège coupé sur la page suivante');
  const detailUn = rendre(<Releves recos={RECOS} releves={quatre} monsters={MONSTRES} maintenant={APRES} vueDepart="detail" siegeDepart={quatre.sieges[0].matchId} />);
  ok(!detailUn.includes('<h3') && !detailUn.includes(`aria-label="${fr.pagination.allerA}"`), 'un siège seul de dix combats : sans en-tête de siège, une seule page');

  // L'allié a quitté la guilde : absent de la liste des membres, relevée après le siège.
  const parti: RelevesSiege = { ...releves(), membres: { t: APRES, ids: [MOI] } };
  const tous = rendre(<Releves recos={RECOS} releves={parti} monsters={MONSTRES} maintenant={APRES} />);
  ok(
    tous.split(`title="${s.ancienMembre}"`).length - 1 === 2 && tous.includes(`aria-label="${s.voirJoueur('Allié')} (${s.ancienMembre})"`),
    '« Tous les sièges » : l’ancien membre reste dans les deux tableaux, marqué comme tel'
  );
  // « Allié » précède « Moi-même » dans l'ordre alphabétique : à part, il passe après.
  const tableaux = tous.split('<table').slice(1).map((t) => t.slice(0, t.indexOf('</table>')));
  ok(
    tableaux.length === 2 &&
      tableaux.every((t) => {
        const intertitre = t.indexOf(`${s.anciensMembres}</span></th>`);
        return t.indexOf('Moi-même') < intertitre && t.indexOf('Allié') > intertitre;
      }),
    'l’ancien membre en fin de chaque tableau, sous l’intertitre « Anciens membres », même s’il venait avant dans l’ordre de base'
  );
  const tableauTrie = rendre(
    <Tableau
      lignes={[
        { nom: 'Actuel', n: 1 },
        { nom: 'Parti', n: 9 },
      ]}
      colonnes={[
        { cle: 'nom', libelle: 'Nom', fixe: true, valeur: (l) => l.nom },
        { cle: 'n', libelle: 'N', valeur: (l) => l.n },
      ]}
      cleLigne={(l) => l.nom}
      triDepart={{ cle: 'n', sens: 'desc' }}
      libelleTri={(c) => c}
      aPart={{ ligne: (l) => l.nom === 'Parti', titre: 'À part' }}
    />
  );
  ok(
    tableauTrie.indexOf('Actuel') < tableauTrie.indexOf('À part') && tableauTrie.indexOf('À part') < tableauTrie.indexOf('Parti'),
    'Tableau : trié par une colonne, une ligne à part reste après l’intertitre, même avec la plus grande valeur'
  );
  ok(!rendre(<Tableau lignes={[{ nom: 'Actuel' }]} colonnes={[{ cle: 'nom', libelle: 'Nom', fixe: true, valeur: (l) => l.nom }]} cleLigne={(l) => l.nom} libelleTri={(c) => c} aPart={{ ligne: () => false, titre: 'À part' }} />).includes('À part'), 'Tableau : aucune ligne à part, aucun intertitre');
  ok(!rendre(<Releves recos={RECOS} releves={parti} monsters={MONSTRES} maintenant={APRES} siegeDepart={UN} />).includes(s.ancienMembre), 'dans un siège seul, il était membre : aucune marque');
  ok(!rendre(<Releves recos={RECOS} releves={releves()} monsters={MONSTRES} maintenant={APRES} />).includes(s.ancienMembre), 'sans liste des membres relevée : aucun ancien membre supposé');
  const selecteur = rendre(<Releves recos={RECOS} releves={parti} monsters={MONSTRES} maintenant={APRES} angleDepart="membre" />);
  ok(
    selecteur.indexOf(`<optgroup label="${s.anciensMembres}">`) > selecteur.indexOf('>Moi-même</option>') && selecteur.indexOf('>Allié</option>') > selecteur.indexOf(`<optgroup label="${s.anciensMembres}">`),
    'le sélecteur « Membre » : les membres actuels, puis les anciens à part'
  );
  const cartes = rendre(<Releves recos={RECOS} releves={parti} monsters={MONSTRES} maintenant={APRES} vueDepart="detail" />);
  const grilleMembres = cartes.indexOf(`>${s.membresTitre}</h2>`);
  const grilleAnciens = cartes.indexOf(`>${s.anciensMembres}</h2>`);
  ok(
    cartes.includes(s.ancienMembre) &&
      grilleMembres >= 0 &&
      cartes.indexOf('Moi-même', grilleMembres) < grilleAnciens &&
      !cartes.slice(grilleMembres, grilleAnciens).includes('Allié') &&
      cartes.indexOf('Allié', grilleAnciens) > grilleAnciens,
    'le détail de la guilde : la carte de l’ancien membre, dans sa propre grille après celle des membres'
  );
}

export function testRenduTelephoneSiegeStatistiques() {
  titre('rendu · Siège › Statistiques — les sièges relevés, au téléphone');
  verifierEnsemble(auTelephone(() => rendre(<Releves recos={RECOS} releves={releves()} monsters={MONSTRES} maintenant={APRES} siegeDepart={UN} />)), 'téléphone');
  verifier(auTelephone(() => rendre(<Releves recos={RECOS} releves={releves()} monsters={MONSTRES} maintenant={APRES} vueDepart="detail" siegeDepart={UN} />)), 'téléphone');
  verifierMembre(auTelephone(() => rendre(<Releves recos={RECOS} releves={releves()} monsters={MONSTRES} maintenant={APRES} angleDepart="membre" />)), 'téléphone');
}
