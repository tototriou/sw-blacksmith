import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import FenetreImport from '../../src/components/FenetreImport';
import { creerEquipe } from '../../src/lib/equipesEnregistrees';
import type { SourceImportEquipe } from '../../src/lib/sourcesEquipesEnregistrees';
import type { Monster } from '../../src/types';

// La fenêtre d'import seule, dans un vrai navigateur : changer de source doit
// remplacer la liste. Mes équipes revient plusieurs fois au même contenu
// (« Combat de guilde » entre deux équipes d'arène), et un groupe y est coupé
// par une autre équipe : le cas qui laissait des sections périmées à l'écran.
const monstre = (id: number): Monster => ({ id, com2usId: 10100 + id, name: `Monstre ${id}`, element: 'fire', archetype: 'attack',
  stars: 6, naturalStars: 5, secondAwaken: false, image: null,
  stats: { hp: 10000, attack: 800, defense: 700, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 }, leaderSkill: null });
const monstres = [1, 2, 3].map(monstre);
const source = (cle: string, src: SourceImportEquipe['source'], groupe: string, libelle: string, bloc?: string): SourceImportEquipe => ({
  cle, source: src, groupe, libelle, monstres, raison: null, rangement: groupe === 'Arène' ? 'arene' : 'guilde',
  ...(bloc ? { bloc: { cle: bloc, nom: bloc } } : {}),
  // Une équipe créée, pour que les conflits du pied se calculent.
  creer: (id, tirerUid, maintenant) => ({ ignores: 0, equipe: { ...creerEquipe(id, groupe === 'Arène' ? 'arene' : 'guilde', libelle, maintenant),
    monstres: monstres.map(m => ({ uid: tirerUid(), com2usId: m.com2usId!, unitId: null, provenance: 'aucun' as const, equipement: null })) } }) });
const sources: SourceImportEquipe[] = [
  source('equipe:1', 'equipes', 'Combat de guilde', 'Attaque 3', 'Groupe A'),
  source('equipe:2', 'equipes', 'Arène', 'Arène 1'),
  source('equipe:3', 'equipes', 'Combat de guilde', 'Défense 1', 'Groupe A'),
  source('equipe:4', 'equipes', 'Combat de guilde', 'Équipe 2'),
  source('equipe:5', 'equipes', 'Arène', 'Arène 2'),
  source('deck:1', 'jeu', 'Combat de guilde', 'Deck du jeu 1'),
  source('deck:2', 'jeu', 'Arène', 'Deck du jeu 2'),
  source('deck:3', 'jeu', 'Combat de guilde', 'Deck du jeu 3'),
  source('reco:1', 'recos', 'Ma reco', 'Deck reco 1'),
];

async function geste(action: () => void) { flushSync(action); await new Promise(r => setTimeout(r, 0)); flushSync(() => {}); }
const dialogue = () => document.querySelector('[role="dialog"]')!;
// Les cases des équipes, par leur nom accessible : celles des blocs (« Tout … ») écartées.
const casesEquipes = () => [...dialogue().querySelectorAll<HTMLInputElement>('input[type="checkbox"][aria-label]')]
  .filter(c => !c.getAttribute('aria-label')!.startsWith('Tout '));
const lignes = () => casesEquipes().map(c => c.getAttribute('aria-label') ?? '');
const caseEquipe = (nom: string) => casesEquipes().find(c => c.getAttribute('aria-label') === nom)!;
const entetes = () => [...dialogue().querySelectorAll('.uppercase')].map(e => e.textContent?.trim() ?? '');
const segment = (nom: string) => [...dialogue().querySelectorAll<HTMLButtonElement>('[role="group"] button')].find(b => b.textContent?.trim() === nom)!;

export async function scenario(): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [];
  const verifier = (condition: boolean, texte: string) => preuves.push([condition, texte]);
  const erreurs: string[] = [];
  const consoleErreur = console.error;
  console.error = (...args: unknown[]) => { erreurs.push(args.map(String).join(' ')); consoleErreur(...args); };
  const root = createRoot(document.getElementById('racine')!);
  await geste(() => root.render(<FenetreImport titre="Importer" sources={sources} ordre={['equipes', 'jeu', 'recos']} ongletInitial={null}
    mode="mixte" monstreParCom2us={new Map(monstres.map((m, i) => [10101 + i, m]))} actions={() => []} onFermer={() => {}} />));
  verifier(JSON.stringify(entetes()) === JSON.stringify(['Combat de guilde', 'Arène']), `Mes équipes : une section par contenu ${JSON.stringify(entetes())}`);
  verifier(JSON.stringify(lignes()) === JSON.stringify(['Attaque 3', 'Défense 1', 'Équipe 2', 'Arène 1', 'Arène 2']),
    `Mes équipes : chaque équipe une fois, le groupe réuni ${JSON.stringify(lignes())}`);
  await geste(() => segment('Decks du jeu').click());
  verifier(JSON.stringify(lignes()) === JSON.stringify(['Deck du jeu 1', 'Deck du jeu 3', 'Deck du jeu 2']),
    `Decks du jeu : la liste remplacée ${JSON.stringify(lignes())}`);
  await geste(() => segment('Recommandations').click());
  verifier(JSON.stringify(lignes()) === JSON.stringify(['Deck reco 1']) && JSON.stringify(entetes()) === JSON.stringify(['Ma reco']),
    `Recommandations : la liste remplacée ${JSON.stringify(lignes())}`);
  await geste(() => segment('Mes équipes').click());
  verifier(lignes().length === 5, 'retour à Mes équipes : ses cinq équipes, sans reste');
  // La case à gauche prend l'équipe entière ; son nom affiché la coche aussi.
  const attaque = caseEquipe('Attaque 3');
  const ligne = attaque.closest('label')!.parentElement!;
  verifier(ligne.firstElementChild === attaque.closest('label'), 'la case de l’équipe est à gauche de la ligne');
  await geste(() => attaque.click());
  verifier(attaque.checked, 'la case coche l’équipe');
  const nomDefense = dialogue().querySelector<HTMLLabelElement>(`label[for="${caseEquipe('Défense 1').id}"]`)!;
  await geste(() => nomDefense.click());
  verifier(caseEquipe('Défense 1').checked, 'un clic sur le nom de l’équipe la coche');
  // Un portrait prend ce monstre seul, sans décocher les équipes : les deux s'importent ensemble.
  const portrait = ligne.querySelector<HTMLButtonElement>('button[aria-pressed][title]')!;
  verifier(!!portrait, 'les portraits d’une équipe cochable sont des boutons');
  await geste(() => portrait.click());
  verifier(portrait.getAttribute('aria-pressed') === 'true' && !!portrait.querySelector('span[aria-hidden] svg'),
    'un monstre choisi porte sa coche en coin');
  verifier(caseEquipe('Attaque 3').checked && caseEquipe('Défense 1').checked, 'choisir un monstre garde les équipes cochées');
  verifier(!segment('Des monstres'), 'plus de bascule entre équipes et monstres');
  // Un monstre choisi seul dans une équipe non cochée entre dans les conflits listés au pied.
  const conflits = () => dialogue().querySelector('ul')?.textContent ?? '';
  verifier(!conflits().includes('Équipe 2'), 'avant : les conflits ne nomment que les équipes cochées');
  const ligneEquipe2 = caseEquipe('Équipe 2').closest('label')!.parentElement!;
  await geste(() => ligneEquipe2.querySelector<HTMLButtonElement>('button[aria-pressed][title]')!.click());
  verifier(conflits().includes('Équipe 2'), `un monstre choisi seul est compté dans les conflits ${conflits()}`);
  verifier(!erreurs.some(e => e.includes('same key')), `aucune clé de rendu en double ${erreurs.filter(e => e.includes('key')).join(' | ')}`);
  console.error = consoleErreur;
  return preuves;
}
