import { ajouterLeadEquipe } from './import-lead-equipe';
import { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import OutilsPage from '../../src/pages/OutilsPage';
import SpeedTuneModale from '../../src/components/outils/SpeedTuneModale';
import OptimizerImportRapport from '../../src/components/outils/OptimizerImportRapport';
import { useOptimizerState, type OptimizerState } from '../../src/hooks/useOptimizerState';
import { useOptimizerLists, type UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { reinitialiserSticky } from '../../src/hooks/useStickyState';
import { setPersistence } from '../../src/hooks/usePersistence';
import { avecNavigationImportOptimizer } from '../../src/lib/actionImportOptimizer';
import { baseCompleteCriteres, photoCriteres } from '../../src/lib/criteresOptimizer';
import { exclusionSelectorKey, type ExclusionSourceData } from '../../src/lib/optimizerExclusion';
import { OPTIMIZER_BACKUP_STORAGE_KEY } from '../../src/lib/optimizerBackup';
import type { RapportImportOptimizer } from '../../src/lib/importEquipes';
import type { GearSet, Monster, SiegeTeam } from '../../src/types';

const gear: GearSet = { base: { hp: 10000, atk: 800, def: 700, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] };
const monstres: Monster[] = [1, 2, 3].map(id => ({ id, com2usId: 10200 + id, name: `Allié ${id}`, element: 'water', archetype: 'attack',
  stars: 6, naturalStars: 5, secondAwaken: false, image: null,
  stats: { hp: 10000, attack: 800, defense: 700, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 },
  leaderSkill: id === 1 ? { stat: 'Attack Speed', amount: 24, area: 'Guild', element: null } : null }));
const box = monstres.map(monster => ({ key: `b${monster.id}`, monster, stars: 6, level: 40, gear }));
const deck = (id: string, vitesse: number): SiegeTeam => ({ id, lead: 0, tickAlertDismissed: false,
  slots: [1, 2, 3].map((m, i) => ({ monsterId: String(m), runeSpeed: vitesse + i, tick: 0, sets: i === 0 ? ['swift'] : [],
    gear: { ...gear, artifacts: [{ id: 2060 + i, kind: 'element', element: 'water', main: { code: 100, value: 100 },
      subs: [{ code: 206, value: 8 + i }], level: 15, rarity: 5 }] } })) });
const initiales = (): ExclusionSourceData => ({ box, rtaEntries: {}, monsterById: new Map(monstres.map(m => [String(m.id), m])),
  siegeDefenseTeams: [deck('d1', 90)], siegeOffenseTeams: [deck('o1', 150)] });
let etat: OptimizerState, listes: UseOptimizerLists, racine: Root | undefined;
let modale = false, attente = false, refus = '', fermetures = 0, appels = 0;
let changerCompte: (v: boolean) => void;

function Banc() {
  const [data] = useState(initiales), [charge, setCharge] = useState(true);
  const [route, setRoute] = useState(location.hash), [ouverte, setOuverte] = useState(modale);
  const [rapport, setRapport] = useState<RapportImportOptimizer | null>(null);
  changerCompte = setCharge;
  listes = useOptimizerLists();
  etat = useOptimizerState({ lists: listes, data, runeIds: new Set(), reverificationEnAttente: () => attente });
  useEffect(() => {
    const naviguer = () => setRoute(location.hash);
    window.addEventListener('hashchange', naviguer);
    return () => window.removeEventListener('hashchange', naviguer);
  }, []);
  const importerFlottant = avecNavigationImportOptimizer(produire => {
    appels++;
    return etat.importerEquipe((courantes, t) => {
      if (refus === 'collision') {
        const uuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
        Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => 'import' });
        try { const active = listes.activeListId; listes.createList('Concurrente', 'donjon'); listes.setActiveListId(active); }
        finally { if (uuid) Object.defineProperty(crypto, 'randomUUID', uuid); else delete (crypto as Partial<Crypto>).randomUUID; }
      }
      return produire(refus === 'vide' ? { ...courantes, monsterById: new Map() } : courantes, t);
    });
  }, () => { location.hash = '#/outils/optimizer'; });
  const exporterEquipe: OptimizerState['importerEquipe'] = produire => {
    const resultat = importerFlottant(produire);
    setRapport(resultat);
    return resultat;
  };
  return <>
    <OutilsPage sub={route === '#/outils/optimizer' ? 'optimizer' : 'speed-tuning'} box={charge ? box : []}
      runes={[]} artifacts={[]} relics={[]} relicUsageById={{}} loadState="live" optimizer={etat}
      onImporterEquipe={importerFlottant} onExporterEquipe={exporterEquipe}
      allMonsters={monstres} rtaEntries={{}} siegeDefenseTeams={data.siegeDefenseTeams} siegeOffenseTeams={data.siegeOffenseTeams}
      lists={listes} accountName="Synthétique" menuOuvert={false} onFermerMenu={() => {}} onOuvrirMenu={() => {}} />
    {ouverte && <SpeedTuneModale deck={{ source: 'offense', teamId: 'o1' }} allMonsters={monstres}
      siegeDefenseTeams={data.siegeDefenseTeams} siegeOffenseTeams={data.siegeOffenseTeams}
      sourcesOptimizer={data} compteCharge={charge} onImporterEquipe={exporterEquipe}
      onClose={() => { fermetures++; setOuverte(false); }} />}
    {rapport && <OptimizerImportRapport rapport={rapport} onFermer={() => setRapport(null)} />}
  </>;
}
async function geste(action: () => void) { flushSync(action); await new Promise(r => setTimeout(r, 40)); flushSync(() => {}); }
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const outil = () => modale ? document.querySelector<HTMLElement>('[aria-labelledby="speed-tune-modale"]')! : document.getElementById('racine')!;
const boutons = (texte: string) => [...outil().querySelectorAll<HTMLButtonElement>('button')].filter(e => visible(e) && e.textContent?.trim() === texte);
const exporter = () => boutons("Exporter vers l'Optimizer")[0];
const geometrie = (e: Element) => { const { x, y, width, height } = e.getBoundingClientRect(); return JSON.stringify({ x, y, width, height }); };
const texteRapport = () => document.querySelector<HTMLElement>('[aria-label="Rapport d’import"]')?.innerText ?? '';

export async function scenario(nom: string, telephone: boolean): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (v: boolean, m: string) => preuves.push([v, `${nom} : ${m}`]);
  if (racine) await geste(() => racine!.unmount());
  reinitialiserSticky('speedTune.'); localStorage.clear(); setPersistence(true);
  modale = nom.startsWith('modale'); attente = false; refus = ''; fermetures = 0; appels = 0;
  location.hash = modale ? '#/siege/offense' : '#/outils/speed-tuning';
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  racine = createRoot(document.getElementById('racine')!);
  await geste(() => racine!.render(<Banc />));
  verifier(window.matchMedia('(pointer: coarse)').matches === telephone, 'format attendu');
  if (!modale) {
    verifier(!!exporter() && exporter().disabled && exporter().title.includes('Aucun monstre importable'), 'bouton présent sans ligne, raison dite');
    // Le vrai import de deck remplit les lignes ; la page ne stocke pas son origine.
    await geste(() => boutons('Importer un deck de siège')[0].click());
    const options = [...outil().querySelectorAll<HTMLElement>('[role="option"]')];
    const option = options[options.length - 1];
    if (!option) throw new Error('Deck d’offense absent du flottant.');
    await geste(() => option.click());
    if (nom === 'page') {
      const masquer = outil().querySelector<HTMLButtonElement>('[aria-label="Masquer Allié 3"]');
      if (!masquer) throw new Error('Masquage de la troisième ligne absent.');
      await geste(() => masquer.click());
      verifier(!!outil().querySelector('[aria-label="Afficher Allié 3"]'), 'ligne masquée gardée dans la composition exportée');
    }
    if (nom === 'page-composition') {
      const retirer = outil().querySelector<HTMLButtonElement>('[aria-label="Retirer Allié 3"]');
      if (!retirer) throw new Error('Retrait de la troisième ligne absent.');
      await geste(() => retirer.click());
    }
  }
  verifier(!!exporter() && !exporter().disabled && exporter().textContent?.trim() === "Exporter vers l'Optimizer", 'export réel visible et disponible dans Ton équipe');
  verifier(outil().innerText.includes('Vitesse des runes') || outil().querySelector('[aria-label="Vitesse des runes de Allié 1"]') !== null, 'saisies du speed tuning rendues');
  let ancienne = '';
  await geste(() => { ancienne = listes.createList('Ancienne', 'donjon'); });
  await geste(() => { listes.addMember(ancienne, { source: 'box', unitKey: 'b1' }, 10201); etat.choisirMembre(ancienne, { source: 'box', unitKey: 'b1' }); });
  await geste(() => { etat.setMinStats({ spd: 999 }); listes.sauvegarderPoint({ listId: ancienne, selector: { source: 'box', unitKey: 'b1' } }, initiales()); });
  const point = localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY), avantStockage = JSON.stringify(listes.lireStockageCourant());
  const affichage = () => JSON.stringify({ criteres: photoCriteres(etat, { type: 'personnel' }), proprietaire: etat.proprietaireCriteres, selection: etat.sourceSelector });
  const avantAffichage = affichage(), routeAvant = location.hash;
  if (nom.endsWith('indisponible')) {
    await geste(() => changerCompte(false));
    verifier(exporter().disabled && exporter().title.includes('compte'), 'sans compte : export désactivé avec raison');
    await geste(() => exporter().click());
    verifier(appels === 0 && fermetures === 0 && location.hash === routeAvant && JSON.stringify(listes.lireStockageCourant()) === avantStockage,
      'aucune action, navigation, fermeture ou écriture sans compte');
  } else {
    const motif = ['attente', 'collision', 'vide'].find(m => nom.endsWith(m));
    attente = motif === 'attente'; refus = motif ?? '';
    await new Promise(r => setTimeout(r, 350));
    const ancre = exporter(); ancre.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 350));
    const position = geometrie(ancre);
    await geste(() => ancre.click());
    await new Promise(r => setTimeout(r, 350));
    verifier(appels === 1, 'un clic appelle une seule fois l’action commune');
    if (motif) {
      verifier(location.hash === routeAvant && fermetures === 0, 'refus sans navigation ni fermeture');
      verifier(!modale || !!document.querySelector('[aria-labelledby="speed-tune-modale"]'), 'modale conservée sur refus');
      verifier(texteRapport().includes(motif === 'attente' ? 'revérification' : motif === 'collision' ? 'déjà occupé' : 'Aucune liste créée'), 'motif du rapport lu à l’écran');
      verifier(affichage() === avantAffichage, 'critères et propriétaire intacts sur refus');
      verifier(geometrie(ancre) === position, `le rapport ne déplace pas le bouton cliqué : ${position} → ${geometrie(ancre)}`);
      verifier(motif === 'collision' ? listes.lists.length === 2 && listes.activeListId === ancienne
        : JSON.stringify(listes.lireStockageCourant()) === avantStockage, 'aucune écriture d’import sur refus');
    } else {
      verifier(location.hash === '#/outils/optimizer', 'route Optimizer atteinte par le clic');
      verifier(fermetures === (modale ? 1 : 0) && !document.querySelector('[aria-labelledby="speed-tune-modale"]'), 'fermeture seulement après acceptation en modale');
      const id = listes.activeListId!, membres = listes.members.filter(m => m.listId === id), equipe = listes.teams.find(e => e.listId === id);
      const repli = nom === 'page-composition', prefixe = repli ? 'box:b' : modale ? 'siege-offense:o1:' : 'siege-defense:d1:';
      verifier(listes.lists.length === 2 && id !== ancienne && listes.listContents.get(id) === 'guilde', 'nouvelle liste Speed tuning active, Guilde, ancienne conservée');
      verifier(membres.length === (repli ? 2 : 3) && membres.every((m, i) => exclusionSelectorKey(m.selector) === `${prefixe}${repli ? i + 1 : i}`),
        repli ? 'composition changée : exemplaires Box' : modale ? 'modale : exemplaires du deck d’origine' : 'page : premier deck de composition exacte, malgré l’offense importée');
      verifier(equipe?.members.length === membres.length && equipe?.lead?.stat === 'Attack Speed' && equipe.lead.amount === 24 && equipe.lead.area === 'Guild'
        && (repli ? !equipe.leader : exclusionSelectorKey(equipe.leader!) === `${prefixe}0`), 'équipe, lead actuel et leader exacts');
      verifier(exclusionSelectorKey(etat.sourceSelector!) === `${prefixe}${repli ? 1 : 0}` && etat.proprietaireCriteres?.listId === id, 'premier membre choisi et propriétaire après réconciliation');
      // Le plan de speed tune est posé : un membre d'une ligne visible est
      // attaché, sans VIT minimum ni verrou 206 ; la ligne masquée garde
      // l'export d'avant (feat-contrainte-speed-tune.md).
      const masquee = (i: number) => nom === 'page' && i === 2;
      const attendus = baseCompleteCriteres(gear); attendus.comboSets = ['swift'];
      ajouterLeadEquipe(attendus, { stat: 'Attack Speed', pct: 24 });
      verifier(JSON.stringify(photoCriteres(etat, { type: 'personnel' })) === JSON.stringify(attendus), 'attaché : Swift et critères personnels de base, sans VIT minimum ni ligne 206');
      verifier(membres.every((m, i) => {
        const photo = [...listes.memories.values()].find(p => p.listId === id && exclusionSelectorKey(p.selector) === exclusionSelectorKey(m.selector));
        return photo?.criteres.minStats.spd === (masquee(i) ? 250 + i : undefined)
          && photo?.criteres.lignesVerrouillees[0]?.min === (masquee(i) ? 8 + i : undefined)
          && photo?.criteres.comboSets.length === (i === 0 ? 1 : 0);
      }), 'critères attribués à chaque membre, jamais ceux du voisin');
      const liens = equipe?.speedTune?.membres ?? [];
      verifier(liens.length === membres.filter((_, i) => !masquee(i)).length && liens.every(l => l.attache)
        && liens[0]?.repli.vitesseMin === 250 && liens[0]?.repli.effet206 === 8, 'plan posé sur l’équipe, membres visibles liés avec leurs valeurs de repli');
      verifier(texteRapport().includes('Le plan de speed tune est posé') && texteRapport().includes(`${membres.length} monstre(s), 1 équipe(s)`), 'rapport de conversion rendu par l’action');
      await geste(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
      const minimum = [...document.querySelectorAll<HTMLInputElement>('[aria-label="VIT minimum"]')].find(visible);
      const encart = [...document.querySelectorAll<HTMLElement>('section[aria-label="Speed tune"]')].find(visible);
      verifier(!minimum && !!encart && encart.innerText.includes('Détacher le speed tune'), 'Optimizer après atterrissage : encart Speed tune à la place de la VIT minimum');
      const detacher = [...(encart?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(e => e.textContent?.trim() === 'Détacher le speed tune');
      if (detacher) await geste(() => detacher.click());
      const champRepli = [...document.querySelectorAll<HTMLInputElement>('[aria-label="VIT minimum"]')].find(visible);
      verifier(champRepli?.value === '150' && JSON.stringify(etat.lignesVerrouillees) === JSON.stringify([{ code: 206, min: 8 }])
        && listes.teams.find(e => e.listId === id)?.speedTune?.membres[0]?.attache === false, 'Détacher : VIT minimum et verrou 206 de repli posés, lien détaché');
      const rattacher = [...document.querySelectorAll<HTMLButtonElement>('section[aria-label="Speed tune"] button')].find(e => visible(e) && e.textContent?.trim() === 'Rattacher');
      if (rattacher) await geste(() => rattacher.click());
      verifier(![...document.querySelectorAll<HTMLInputElement>('[aria-label="VIT minimum"]')].some(visible)
        && listes.teams.find(e => e.listId === id)?.speedTune?.membres[0]?.attache === true, 'Rattacher : la VIT minimum ne se saisit plus');
      verifier(etat.search.result === null && etat.search.status === 'idle', 'aucune recherche lancée');
    }
  }
  verifier(localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY) === point, 'point de sauvegarde inchangé');
  verifier(document.documentElement.scrollWidth <= window.innerWidth, 'aucun débordement horizontal');
  return preuves;
}
