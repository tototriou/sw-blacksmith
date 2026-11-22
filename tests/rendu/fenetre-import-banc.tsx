import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import FenetreImport from '../../src/components/FenetreImport';
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
  ...(bloc ? { bloc: { cle: bloc, nom: bloc } } : {}), creer: () => null });
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
// Les cases des équipes : celles du « Contenu » et des blocs (« Tout … ») écartées.
const lignes = () => [...dialogue().querySelectorAll('label')].filter(l => l.querySelector('input[type="checkbox"]:not([aria-label])'))
  .map(l => l.textContent?.trim() ?? '');
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
    mode="mixte" monstreParCom2us={new Map(monstres.map(m => [10100 + m.id, m]))} actions={() => []} onFermer={() => {}} />));
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
  verifier(!erreurs.some(e => e.includes('same key')), `aucune clé de rendu en double ${erreurs.filter(e => e.includes('key')).join(' | ')}`);
  console.error = consoleErreur;
  return preuves;
}
