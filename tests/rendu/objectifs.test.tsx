// La section Mon compte › Objectifs, rendue : ses quatre vues — Résumé, Runes,
// Artéfacts, Réglage. Ce qu'elles disent, pas leur forme ; le calcul est
// vérifié par objectifs-compte.test.ts, le branchement dans l'app par
// app.test.tsx et navigation-adresses.test.ts.

import { ArtifactDetail, RuneDetail } from '../../src/types';
import ObjectifsSection from '../../src/components/account/ObjectifsSection';
import ReglagesObjectifs, { FenetreSousSections, type Fenetre } from '../../src/components/ReglagesObjectifs';
import type { SousSection } from '../../src/lib/objectifsCompte';
import type { Monster } from '../../src/types';
import { setObjectifsCompte } from '../../src/hooks/useObjectifsCompte';
import { OBJECTIFS_DEFAUT } from '../../src/lib/objectifsCompte';
import { egal, ok, titre } from '../outils';
import { auTelephone, bouton, boutons, onglets, rendre, texteVisible, valeurs } from './outils-rendu';

// Une rune 6★ +15 à 100 % d'efficience (ATQ 160, VIT 30, TC 24).
const rune = (id: number, set: string, slot: number): RuneDetail => ({
  id, slot, set, rank: 6, rarity: 5, level: 15,
  main: { code: 3, value: 160 },
  subs: [{ code: 8, value: 30, grind: 0 }, { code: 9, value: 24 }],
});
// Un artéfact de Feu, ATQ, dégâts infligés à l'Eau +20 %.
const art: ArtifactDetail = { id: 9, kind: 'element', element: 'fire', level: 15, rarity: 5, main: { code: 101, value: 100 }, subs: [{ code: 301, value: 20 }] };

export function testRenduObjectifs() {
  titre('Rendu — la section Objectifs');
  setObjectifsCompte({
    ...OBJECTIFS_DEFAUT,
    paliers: [{ sets: [{ set: 'violent', cases: Array.from({ length: 6 }, () => ({ seuil: 100, quantite: 2 })) }] }],
  });
  const runes = [rune(1, 'violent', 1), rune(2, 'violent', 1), rune(3, 'violent', 2), rune(4, 'intangible', 1)];
  const vue = (v: 'resume' | 'runes' | 'artefacts' | 'reglage', r = runes, a = [art]) =>
    rendre(<ObjectifsSection vue={v} runes={r} artifacts={a} />);

  // ── Résumé ──
  const html = vue('resume');
  const t = texteVisible(html);
  ok(t.startsWith('Résumé Ton compte face à tes objectifs, bloc par bloc.'), 'le titre de la vue et ce qu’elle mesure');
  ok(!!bouton(html, 'Régler les objectifs'), 'le renvoi vers le réglage');
  // Une carte par bloc, son score et une barre à la couleur de son niveau,
  // sans les pièces visées. Vitesse : les deux Violentes de l'emplacement 1
  // ont 30 de VIT (2 / 55).
  ok(
    t.includes('Régler les objectifs Base 25,0 % Vitesse par emplacement 3,6 % Attribut 0,5 % Type 0,0 %'),
    'une carte par palier, la vitesse, l’Attribut et le Type — le score seul'
  );
  egal(
    valeurs(html, 'href'),
    ['#/compte/objectifs/runes', '#/compte/objectifs/runes', '#/compte/objectifs/artefacts', '#/compte/objectifs/artefacts'],
    'chaque carte mène à la vue qui la détaille'
  );
  ok(/bg-niveau-0" style="height:25%"/.test(html), 'la jauge verticale de la carte : remplie à 25 %, rouge');
  ok(
    t.includes('Violente 25,0 % 13,3 % Base Vitesse Désespoir — 0,0 % Base Vitesse Rapide — 0,0 % Base Vitesse Volonté — 0,0 % Base Vitesse'),
    'résumé par set : le score de chaque set dans chaque bloc, « — » quand le bloc ne le vise pas'
  );
  ok(/bg-niveau-0" style="height:13.3/.test(html), 'la jauge de Violente en vitesse : 13,3 %, rouge (sous 30 %)');
  ok(!t.includes('Profondeur par efficience ·') && !t.includes('Attribut ·'), 'le résumé seul : le détail est dans les autres vues');
  // Où farmer : une carte par lieu visé (donjon, raid par palier), le moins
  // avancé d'abord.
  ok(
    t.includes(
      'Type 0,0 % Où farmer La part des pièces visées que tu as déjà, donjon par donjon, tous blocs confondus, et raid par palier pour les meules : le moins avancé d’abord. #1 Crypte du Jugement 0,0 % #2 Castel du Géant 0,0 % #3 Nécropolis 0,0 % #4 Forteresse d’Acier 0,5 % #5 Tanière du dragon 18,5 % #6 Raid des mondes · Base 100,0 % Violente'
    ),
    'où farmer : les donjons et le raid du palier par part acquise, sans détail — avant le résumé par set'
  );
  ok(/<article[^>]*><span[^>]*><span[^>]*><span[^>]*>#1<\/span> Crypte du Jugement/.test(html), 'une carte : son rang avant son nom');
  ok(!html.includes('aria-pressed'), 'les cartes ne se choisissent pas');
  ok(/bg-niveau-0" style="height:18.5/.test(html), 'la jauge verticale de la Tanière : 18,5 %, comme les cartes des blocs');

  // ── Runes ──
  const htmlR = vue('runes');
  const tr = texteVisible(htmlR);
  ok(tr.startsWith('Runes Tes runes face à tes objectifs'), 'runes : le titre');
  egal(
    boutons(htmlR).filter((b) => /%$/.test(b.texte)).map((b) => [b.texte, b.presse]),
    [['Base 25,0 %', null], ['Vitesse par emplacement 3,6 %', null]],
    'ses cartes : des raccourcis vers leur section, pas un choix'
  );
  ok(
    tr.includes('Profondeur par efficience · Base Seuil 100 % 25,0 % Actuel Si max héroïque Objectif Par emplacement Empl. 1 100,0 % Empl. 2 50,0 % Empl. 3 0,0 %'),
    'titre, seuil commun, score, légende, score par emplacement'
  );
  ok(
    tr.includes('Violente 2 par emplacement · seuil 100 % 25,0 % 2 1 0 0 0 0 Actuel Empl. 1 2 3 4 5 6 Visé 2 2 2 2 2 2 Max héro 2 1 0 0 0 0 Intang. 1 — — — — —'),
    'la fiche : quantité et seuil, score, puis par emplacement l’actuel, le visé, le max héroïque et les Intangibles'
  );
  ok(/bg-niveau-3" style="height:100%"/.test(htmlR), 'colonne atteinte tout juste : vert clair, pleine');
  ok(/bg-niveau-2" style="height:50%"/.test(htmlR), 'colonne entamée : jaune, à moitié');
  ok(
    tr.includes('Vitesse par emplacement 3,6 % Actuel Objectif Par emplacement Empl. 1 18,2 % Empl. 3 0,0 %'),
    'la section vitesse, sans l’emplacement 2 ; seuils différents (28, 29) : pas de seuil commun'
  );
  ok(
    tr.includes('Violente 3 par emplacement · seuil 28 13,3 % 2 0 0 0 0 Actuel Empl. 1 3 4 5 6 Visé 3 3 3 3 3 Plus rapide 30 — — — — Intang. 1 — — — —'),
    'la fiche vitesse : la plus rapide par emplacement, sans max héroïque'
  );
  ok(tr.indexOf('Max héro') < tr.indexOf('Plus rapide'), 'max héroïque : seulement pour l’efficience');
  ok(['objectifs-palier-0', 'objectifs-vitesse'].every((id) => htmlR.includes(`id="${id}"`)), 'chaque section porte la cible de sa carte');
  ok(!tr.includes('Attribut ·'), 'les runes seules');

  // ── Artéfacts ──
  const htmlA = vue('artefacts');
  const ta = texteVisible(htmlA);
  ok(ta.startsWith('Artéfacts Tes artéfacts face à tes objectifs'), 'artéfacts : le titre');
  ok(ta.includes('Régler les objectifs Attribut 0,5 % Type 0,0 % Attribut · Réduction des dégâts reçus'), 'une carte par sorte, puis les sections');
  ok(
    ta.includes('Attribut · Augmentation des dégâts infligés 1,0 % Actuel Objectif Par élément Feu 5,0 % Eau 0,0 % Vent 0,0 %'),
    'une section par famille : son score, le score par élément (ses trois principales réunies) ; pas de seuil commun'
  );
  ok(
    ta.includes("Aug. des dgts infl. à l'Eau ≥ +18% 5,0 % 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 Actuel Feu Eau Vent Lumière Ténèbres Visé 1 2 1 1 2 1 1 2 1 1 2 1 1 2 1 Aug."),
    'une fiche par secondaire, « ≥ » devant la valeur ; trois sous-colonnes par élément (la pièce ATQ de Feu dans la deuxième) ; ni max héroïque ni Intangibles par colonne'
  );
  ok(
    ta.includes("Réd. dgts reçus de l'Eau ≥ -22% 0,0 %") && ta.includes('Visé 3 0 3 2 0 2 2 0 2 2 0 2 2 0 2'),
    'dégâts reçus : PV et DEF visés, ATQ à 0, une pièce de plus contre l’élément qui bat la colonne'
  );
  // Les sous-colonnes : PV, ATQ, DEF sous chaque élément, leur nom au survol.
  const icones = [...htmlA.matchAll(/role="img" aria-label="([^"]+)"/g)].map((m) => m[1]);
  egal(icones.slice(0, 6), ['PV', 'ATQ', 'DEF', 'PV', 'ATQ', 'DEF'], 'sous chaque élément, l’icône de chaque principale, nommée');
  egal(icones.length, 3 * (5 * 10 + 4 * 12), 'une icône par sous-colonne : 10 fiches d’attribut à 5 éléments, 12 de type à 4 styles');
  ok(/lucide-heart[^"]*text-fire/.test(htmlA) && /lucide-shield[^"]*text-water/.test(htmlA), 'les icônes du Top 10 : cœur rouge, bouclier bleu');
  egal(
    [...htmlA.matchAll(/id="(objectifs-[^"]+)"/g)].map((m) => m[1]),
    ['objectifs-attribut-0', 'objectifs-attribut-1', 'objectifs-type-0', 'objectifs-type-1', 'objectifs-type-2', 'objectifs-type-3', 'objectifs-type-4'],
    'une section par famille des objectifs par défaut : reçus, infligés ; dgts CRIT, soins, précision, renforcement, autres'
  );
  ok(!ta.includes('Profondeur par efficience ·'), 'les artéfacts seuls');
  setObjectifsCompte({ ...OBJECTIFS_DEFAUT, artefacts: { attribut: [], type: OBJECTIFS_DEFAUT.artefacts.type } });
  ok(texteVisible(vue('artefacts')).includes('Attribut — Aucun objectif dans ce bloc.'), 'une sorte sans objectif : sa section le dit, la carte y mène');

  // ── Le « si max » de chaque palier ──
  setObjectifsCompte(OBJECTIFS_DEFAUT);
  const td = texteVisible(vue('runes'));
  const premium = td.slice(td.indexOf('Profondeur par efficience · Premium'), td.indexOf('Vitesse par emplacement', td.indexOf('Profondeur par efficience · Premium')));
  const base = td.slice(td.indexOf('Profondeur par efficience · Base'), td.indexOf('Profondeur par efficience · Premium'));
  ok(base.includes('Si max héroïque') && base.includes('Max héro') && !base.includes('Max lég.'), 'Base : le si max héroïque');
  ok(premium.includes('Si max légendaire') && premium.includes('Max lég.') && !premium.includes('Max héro'), 'Premium : le si max légendaire');

  // ── Sans compte ──
  for (const v of ['resume', 'runes', 'artefacts'] as const)
    egal(texteVisible(vue(v, [], [])), 'Importe ton compte pour le comparer à tes objectifs.', `${v}, sans compte : l’invite`);

  // ── Réglage : il se fait sans compte ──
  const reglage = vue('reglage', [], []);
  const tg = texteVisible(reglage);
  ok(tg.startsWith('Réglage Ce que tu vises sur ton compte'), 'le titre et l’introduction, sans compte importé');
  ok(tg.includes('Exporter Importer Valeurs par défaut'), 'export, import, valeurs par défaut');
  ok(bouton(reglage, 'Valeurs par défaut')?.desactive === true, 'déjà aux valeurs par défaut : le bouton est désactivé, pas retiré');
  // Une sous-section par onglet, la première ouverte ; export, import et
  // valeurs par défaut au-dessus, pour toutes.
  egal(
    onglets(reglage).map((o) => `${o.texte}${o.ouvert ? ' (ouvert)' : ''}`),
    ['Profondeur par efficience (ouvert)', 'Vitesse par emplacement', 'Artéfacts', 'Monstres'],
    'une sous-section par onglet, l’efficience ouverte d’abord'
  );
  ok(reglage.includes('role="tablist" aria-label="Sous-sections des objectifs"'), 'la rangée d’onglets est nommée');
  ok(tg.indexOf('Valeurs par défaut') < tg.indexOf('Profondeur par efficience'), 'export, import et valeurs par défaut au-dessus des onglets');
  ok(reglage.includes('aria-label="Profondeur par efficience"') && !reglage.includes('<h2'), 'l’onglet nomme le bloc ouvert, sans titre répété dessous');
  ok(!tg.includes('Valeur min.') && !tg.includes('Emplacement 2'), 'seul le bloc de l’onglet ouvert est rendu');
  ok(tg.includes('Violente') && tg.includes('Seuil') && tg.includes('Quantité') && tg.includes('Tous'), 'les grilles de saisie');
  ok(!!bouton(reglage, 'Ajouter un palier') && !!bouton(reglage, 'Retirer le palier Base'), 'ajouter et retirer un palier');
  ok(reglage.includes('placeholder="Premium"'), 'le second palier porte son nom par défaut');

  const sousSection = (o: SousSection) => rendre(<ReglagesObjectifs ongletInitial={o} />);
  const vitesse = sousSection('vitesse');
  egal(onglets(vitesse).find((o) => o.ouvert)?.texte, 'Vitesse par emplacement', 'Vitesse : son onglet ouvert');
  ok(texteVisible(vitesse).includes('L’emplacement 2, qui porte la vitesse en principale') && !vitesse.includes('placeholder="Premium"'), 'Vitesse : son bloc seul');
  const artefacts = sousSection('artefacts');
  const tra = texteVisible(artefacts);
  ok(
    tra.includes('Attribut Réduction des dégâts reçus Réd. des dgts reçus du Feu Valeur min. Feu Eau Vent Lumière Ténèbres Tous PV ATQ DEF') &&
      tra.includes('Valeur min. Attaque Défense PV Support Tous PV ATQ DEF'),
    'artéfacts : rangés par famille ; par secondaire, une grille — une colonne par élément (ou par style), une rangée par principale'
  );
  ok(artefacts.includes('aria-label="Réd. des dgts reçus du Feu · Eau · DEF"'), 'chaque case nomme sa secondaire, sa colonne et sa principale');
  ok(!!bouton(artefacts, 'Ajouter une secondaire') && !bouton(artefacts, 'Ajouter un tableau'), 'ajouter une secondaire ; plus de tableaux');
  const tm = texteVisible(sousSection('monstres'));
  ok(tm.includes('À monter') && tm.includes('À garder') && tm.includes('À sniper en event'), 'Monstres : les trois listes');

  // ── Monstres : une collaboration est un monstre, ses deux noms affichés ──
  const face = (com2usId: number, name: string, jumeauCollab: number) =>
    ({ id: com2usId, com2usId, name, element: 'wind', secondAwaken: false, jumeauCollab, image: null }) as unknown as Monster;
  const cookie = face(26313, 'Pure Vanilla Cookie', 26813);
  const angela = face(26813, 'Angela', 26313);
  const parCom2us = new Map([cookie, angela].map((m) => [m.com2usId as number, m]));
  setObjectifsCompte({ ...OBJECTIFS_DEFAUT, monstres: { aMonter: [{ monstre: 26313, exemplaires: 2 }], aGarder: [], aSniper: [] } });
  const collab = rendre(<ReglagesObjectifs ongletInitial="monstres" monstres={[cookie, angela]} parCom2us={parCom2us} />);
  ok(texteVisible(collab).includes('Pure Vanilla Cookie, Angela'), 'Réglage : une collaboration porte ses deux noms');
  ok(!!bouton(collab, 'Retirer Pure Vanilla Cookie, Angela'), 'Réglage : son retrait la nomme entière');

  // ── La fenêtre des sous-sections : export, import, valeurs par défaut ──
  const fenetre = (f: Fenetre) =>
    auTelephone(() => rendre(<FenetreSousSections fenetre={f} titres={{ efficience: 'Profondeur par efficience', vitesse: 'Vitesse par emplacement', artefacts: 'Artéfacts', monstres: 'Monstres' }} onValider={() => {}} onFermer={() => {}} />));
  const cases = (html: string) =>
    [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map(([, c]) => ({
      texte: texteVisible(c),
      cochee: /checked=""/.test(c),
      desactivee: /disabled=""/.test(c),
    }));
  const exp = fenetre({ geste: 'exporter' });
  ok(texteVisible(exp).startsWith('Exporter les objectifs'), 'export : son titre');
  egal(cases(exp).map((c) => c.cochee && !c.desactivee), [true, true, true, true], 'export : les quatre sous-sections, cochées');
  egal(bouton(exp, 'Exporter')?.desactive, false, 'export : l’action');
  const imp = fenetre({ geste: 'importer', lu: {}, disponibles: ['vitesse', 'monstres'] });
  egal(
    cases(imp).map((c) => `${c.texte}${c.cochee ? ' ✓' : ''}${c.desactivee ? ' ✗' : ''}`),
    ['Profondeur par efficience · absente du fichier ✗', 'Vitesse par emplacement ✓', 'Artéfacts · absente du fichier ✗', 'Monstres ✓'],
    'import : les sous-sections du fichier cochées ; les absentes restent, désactivées, avec leur raison'
  );
  egal(bouton(imp, 'Importer')?.desactive, false, 'import : l’action');
  const ret = fenetre({ geste: 'retablir', disponibles: ['artefacts'] });
  egal(
    cases(ret).filter((c) => c.desactivee).map((c) => c.texte),
    ['Profondeur par efficience · déjà aux valeurs par défaut', 'Vitesse par emplacement · déjà aux valeurs par défaut', 'Monstres · déjà aux valeurs par défaut'],
    'valeurs par défaut : seules les sous-sections qui en diffèrent'
  );
  setObjectifsCompte(OBJECTIFS_DEFAUT);
  egal(
    [...reglage.matchAll(/<option value="(heroique|legendaire)" selected=""/g)].map((m) => m[1]),
    ['heroique', 'legendaire'],
    'un choix du « si max » par palier : héroïque pour Base, légendaire pour Premium'
  );
  ok(reglage.includes('max-w-[760px]'), 'le réglage plafonne sa largeur : ses grilles, pas la page');

  // ── Où farmer : ce que la meule comble ──
  // Une rune à 95,2 % que la meule héroïque porte à 100 % : au raid.
  setObjectifsCompte({
    paliers: [{ sets: [{ set: 'violent', cases: [{ seuil: 100, quantite: 1 }, ...Array.from({ length: 5 }, () => ({ seuil: 100, quantite: 0 }))] }] }],
    vitesse: [],
    artefacts: { attribut: [], type: [] },
    monstres: OBJECTIFS_DEFAUT.monstres,
  });
  const presque: RuneDetail = { ...rune(5, 'violent', 1), subs: [{ code: 8, value: 26, grind: 0 }, { code: 9, value: 24 }] };
  ok(
    texteVisible(vue('resume', [presque], [])).includes(
      '#1 Raid des mondes · Base 0,0 % #2 Tanière du dragon 100,0 % Violente'
    ),
    'ce que la meule comble : au Raid des mondes du palier, en tête ; le donjon est à 100 %'
  );
  setObjectifsCompte(OBJECTIFS_DEFAUT);
}
