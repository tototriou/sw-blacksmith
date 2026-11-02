import { nomNouvelleListeOptimizer } from '../src/lib/optimizerListNames';
import { monterListesOptimizer } from './optimizer-lists-harness';
import { faussLocalStorage, egal, titre } from './outils';
import { setPersistence } from '../src/hooks/usePersistence';
import { setChoixLangue } from '../src/hooks/useLangue';
import { fr } from '../src/i18n/fr';
import { en } from '../src/i18n/en';

export function testOptimizerCreationNomParDefaut() {
  titre('Optimizer · nom de création vide et premier numéro libre');
  const nom = fr.optimizer.listes.nomParDefaut;
  egal(nomNouvelleListeOptimizer([], nom), 'Liste 1', 'aucune liste : premier numéro');
  egal(nomNouvelleListeOptimizer([], en.optimizer.listes.nomParDefaut), 'List 1', 'en anglais : « List 1 »');
  const existantes = ['Liste 1', 'Liste 3', 'Autre', 'Liste 01'].map((name, i) => ({ id: String(i), name }));
  egal(nomNouvelleListeOptimizer(existantes, nom), 'Liste 2', 'premier trou, sans compter les noms libres');
  faussLocalStorage({ 'swblacksmith-optimizer-lists-v1': JSON.stringify({ lists: existantes, members: [], validated: [], activeListId: null }) });
  setPersistence(true);
  // Le harnais lit la langue du client, l'anglais sous Node : le nom par défaut suit le français choisi.
  setChoixLangue('fr');
  try {
  const h = monterListesOptimizer(); let listes = h.render();
  const id = listes.createList('  ', 'arene'); listes = h.render();
  egal(listes.lists.find(l => l.id === id)?.name, 'Liste 2', 'nom vide résolu par le vrai hook');
  egal(listes.listContents.get(id), 'arene', 'contenu choisi sans défaut ajouté');
  const suivant = listes.createList('', 'donjon'); listes = h.render();
  egal(listes.lists.find(l => l.id === suivant)?.name, 'Liste 4', 'numéro suivant réellement libre');
  const nomme = listes.createList('  Mon équipe  ', 'guilde'); listes = h.render();
  egal(listes.lists.find(l => l.id === nomme)?.name, 'Mon équipe', 'nom saisi conservé après trim');
  } finally { setPersistence(false); setChoixLangue('auto'); }
}
