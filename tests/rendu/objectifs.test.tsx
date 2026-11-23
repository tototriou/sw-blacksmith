// Les objectifs du compte, rendus : la vue « Objectifs » des runes et des
// artéfacts, et l'onglet « Objectifs » des Paramètres. Ce qu'ils disent, pas
// leur forme ; le calcul est vérifié par objectifs-compte.test.ts.

import { ArtifactDetail, RuneDetail } from '../../src/types';
import { ObjectifsArtefacts, ObjectifsRunes } from '../../src/components/account/VueObjectifs';
import SettingsPage from '../../src/pages/SettingsPage';
import { setObjectifsCompte } from '../../src/hooks/useObjectifsCompte';
import { OBJECTIFS_DEFAUT } from '../../src/lib/objectifsCompte';
import { egal, ok, titre } from '../outils';
import { bouton, boutons, onglets, rendre, texteVisible } from './outils-rendu';

// Une rune 6★ +15 à 100 % d'efficience (ATQ 160, VIT 30, TC 24).
const rune = (id: number, set: string, slot: number): RuneDetail => ({
  id, slot, set, rank: 6, rarity: 5, level: 15,
  main: { code: 3, value: 160 },
  subs: [{ code: 8, value: 30, grind: 0 }, { code: 9, value: 24 }],
});

export function testRenduObjectifs() {
  titre('Rendu — objectifs du compte');
  setObjectifsCompte({
    ...OBJECTIFS_DEFAUT,
    paliers: [{ sets: [{ set: 'violent', cases: Array.from({ length: 6 }, () => ({ seuil: 100, quantite: 2 })) }] }],
  });

  // ── Vue des runes ──
  const runes = [rune(1, 'violent', 1), rune(2, 'violent', 1), rune(3, 'violent', 2), rune(4, 'intangible', 1)];
  const html = rendre(<ObjectifsRunes runes={runes} />);
  const t = texteVisible(html);
  ok(t.startsWith('Objectifs Tes runes face à tes objectifs'), 'le titre de la vue et ce qu’elle mesure');
  ok(!!bouton(html, 'Régler les objectifs'), 'le renvoi vers le réglage');
  // Le résumé : une carte par bloc, son score et une barre à la couleur de son
  // niveau, sans les pièces visées.
  ok(
    // Vitesse : les deux Violentes de l'emplacement 1 ont 30 de VIT (2 / 55).
    t.includes('Régler les objectifs Base 25,0 % Vitesse par emplacement 3,6 % Artéfacts 0,0 %'),
    'résumé : une carte par palier, la vitesse, les artéfacts — le score seul'
  );
  egal(
    boutons(html).filter((b) => /%$/.test(b.texte)).map((b) => [b.texte, b.presse]),
    [['Base 25,0 %', null], ['Vitesse par emplacement 3,6 %', null], ['Artéfacts 0,0 %', null]],
    'les cartes : des raccourcis vers leur section, pas un choix'
  );
  ok(/bg-niveau-0" style="height:25%"/.test(html), 'la jauge verticale de la carte : remplie à 25 %, rouge');
  // Puis le résumé par set : une fiche par set, une jauge par bloc de runes.
  ok(
    t.includes('Artéfacts 0,0 % Violente 25,0 % 13,3 % Base Vitesse Désespoir — 0,0 % Base Vitesse Rapide — 0,0 % Base Vitesse Volonté — 0,0 % Base Vitesse Profondeur'),
    'résumé par set : le score de chaque set dans chaque bloc, « — » quand le bloc ne le vise pas'
  );
  ok(/bg-niveau-0" style="height:13.3/.test(html), 'la jauge de Violente en vitesse : 13,3 %, rouge (sous 30 %)');
  // Puis toutes les sections, l'une sous l'autre : le score par emplacement,
  // une fiche par set.
  ok(
    t.includes('Profondeur par efficience · Base Seuil 100 % 25,0 % Actuel Si max héroïque Objectif Par emplacement Empl. 1 100,0 % Empl. 2 50,0 % Empl. 3 0,0 %'),
    'titre, seuil commun, score, légende, score par emplacement'
  );
  ok(
    t.includes('Violente 2 par emplacement · seuil 100 % 25,0 % 2 1 0 0 0 0 Actuel Empl. 1 2 3 4 5 6 Visé 2 2 2 2 2 2 Max héro 2 1 0 0 0 0 Intang. 1 — — — — —'),
    'la fiche : quantité et seuil, score, puis par emplacement l’actuel, le visé, le max héroïque et les Intangibles'
  );
  ok(/bg-niveau-3" style="height:100%"/.test(html), 'colonne atteinte tout juste : vert clair, pleine');
  ok(/bg-niveau-2" style="height:50%"/.test(html), 'colonne entamée : jaune, à moitié');
  ok(
    t.includes('Vitesse par emplacement 3,6 % Actuel Objectif Par emplacement Empl. 1 18,2 % Empl. 3 0,0 %'),
    'la section vitesse, sans l’emplacement 2 ; seuils différents (28, 29) : pas de seuil commun'
  );
  ok(
    t.includes('Violente 3 par emplacement · seuil 28 13,3 % 2 0 0 0 0 Actuel Empl. 1 3 4 5 6 Visé 3 3 3 3 3 Plus rapide 30 — — — — Intang. 1 — — — —'),
    'la fiche vitesse : la plus rapide par emplacement, sans max héroïque'
  );
  ok(t.indexOf('Max héro') < t.indexOf('Plus rapide') && t.lastIndexOf('Max héro') < t.indexOf('Vitesse par emplacement 3,6 % Actuel'), 'max héroïque : seulement pour l’efficience');
  ok(
    t.indexOf('Attribut · Toutes les principales') > 0 && t.indexOf('Type · PV') > t.indexOf('Attribut · Toutes les principales'),
    'les sections artéfacts, une par tableau : Attribut puis Type'
  );
  ok(['objectifs-palier-0', 'objectifs-vitesse', 'objectifs-attribut-0', 'objectifs-type-0'].every((id) => html.includes(`id="${id}"`)), 'chaque section porte la cible de sa carte');
  ok(texteVisible(rendre(<ObjectifsRunes runes={[]} />)) === 'Importe ton compte pour le comparer à tes objectifs.', 'sans compte : l’invite');

  // ── Vue des artéfacts ──
  // Un artéfact de Feu, ATQ, dégâts infligés à l'Eau +20 %.
  const art: ArtifactDetail = { id: 9, kind: 'element', element: 'fire', level: 15, rarity: 5, main: { code: 101, value: 100 }, subs: [{ code: 301, value: 20 }] };
  const htmlA = rendre(<ObjectifsArtefacts artifacts={[art]} />);
  const ta = texteVisible(htmlA);
  ok(ta.startsWith('Objectifs Tes artéfacts face à tes objectifs'), 'artéfacts : le titre');
  ok(ta.includes('Régler les objectifs Attribut 0,6 % Type 0,0 % Attribut · Toutes les principales'), 'résumé : une carte par sorte');
  ok(
    ta.includes('Attribut · Toutes les principales 2,0 % Actuel Objectif Par élément Feu 10,0 % Eau 0,0 % Vent 0,0 %'),
    'un tableau : sa principale, son score, le score par élément ; pas de seuil commun'
  );
  ok(
    ta.includes("Aug. des dgts infl. à l'Eau ≥ +18% 2 par élément 10,0 % 1 0 0 0 0 Actuel Feu Eau Vent Lumière Ténèbres Visé 2 2 2 2 2 Aug."),
    'une fiche par secondaire, « ≥ » devant la valeur ; une colonne par élément ; ni max héroïque ni Intangibles par colonne'
  );
  ok(ta.includes('Attribut · PV') && ta.includes('Type · ATQ'), 'un tableau par principale');
  egal(
    [...htmlA.matchAll(/id="(objectifs-[^"]+)"/g)].map((m) => m[1]),
    ['objectifs-attribut-0', 'objectifs-attribut-1', 'objectifs-attribut-2', 'objectifs-attribut-3', 'objectifs-attribut-4', 'objectifs-attribut-5', 'objectifs-attribut-6', 'objectifs-type-0', 'objectifs-type-1', 'objectifs-type-2', 'objectifs-type-3'],
    'une section par tableau des objectifs par défaut'
  );

  // ── Le « si max » de chaque palier ──
  setObjectifsCompte(OBJECTIFS_DEFAUT);
  const td = texteVisible(rendre(<ObjectifsRunes runes={runes} />));
  const premium = td.slice(td.indexOf('Profondeur par efficience · Premium'), td.indexOf('Vitesse par emplacement', td.indexOf('Profondeur par efficience · Premium')));
  const base = td.slice(td.indexOf('Profondeur par efficience · Base'), td.indexOf('Profondeur par efficience · Premium'));
  ok(base.includes('Si max héroïque') && base.includes('Max héro') && !base.includes('Max lég.'), 'Base : le si max héroïque');
  ok(premium.includes('Si max légendaire') && premium.includes('Max lég.') && !premium.includes('Max héro'), 'Premium : le si max légendaire');

  // ── Paramètres ──
  const general = rendre(<SettingsPage onImport={() => {}} />);
  egal(onglets(general).map((o) => [o.texte, o.ouvert]), [['Général', true], ['Objectifs', false]], 'deux onglets, « Général » ouvert par défaut');
  ok(texteVisible(general).includes('Ces réglages valent pour toute l’application') || texteVisible(general).includes("Ces réglages valent pour toute l'application"), 'Général : les réglages d’avant');

  const reglage = rendre(<SettingsPage onglet="objectifs" onImport={() => {}} />);
  const tr = texteVisible(reglage);
  egal(onglets(reglage).filter((o) => o.ouvert).map((o) => o.texte), ['Objectifs'], 'l’onglet Objectifs ouvert');
  ok(tr.includes('Exporter Importer Valeurs par défaut'), 'export, import, valeurs par défaut');
  ok(bouton(reglage, 'Valeurs par défaut')?.desactive === true, 'déjà aux valeurs par défaut : le bouton est désactivé, pas retiré');
  ok(tr.includes('Profondeur par efficience') && tr.includes('Vitesse par emplacement') && tr.includes('Artéfacts'), 'les trois blocs');
  ok(tr.includes('Violente') && tr.includes('Seuil') && tr.includes('Quantité') && tr.includes('Tous'), 'les grilles de saisie');
  ok(!!bouton(reglage, 'Ajouter un palier') && !!bouton(reglage, 'Retirer le palier Base'), 'ajouter et retirer un palier');
  ok(reglage.includes('placeholder="Premium"'), 'le second palier porte son nom par défaut');
  ok(
    tr.includes('Secondaire Valeur min. Feu Eau Vent Lumière Ténèbres Tous') && tr.includes('Secondaire Valeur min. Attaque Défense PV Support Tous'),
    'artéfacts : une grille par tableau, une colonne par élément (ou par style)'
  );
  ok(!!bouton(reglage, 'Ajouter un tableau') && !!bouton(reglage, 'Ajouter une secondaire'), 'ajouter un tableau, une secondaire');
  egal(
    [...reglage.matchAll(/<option value="(heroique|legendaire)" selected=""/g)].map((m) => m[1]),
    ['heroique', 'legendaire'],
    'un choix du « si max » par palier : héroïque pour Base, légendaire pour Premium'
  );
  ok(!general.includes('max-w-[760px]') && reglage.includes('max-w-[760px]'), 'seul l’onglet Objectifs s’élargit');
}
