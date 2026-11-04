// Les textes des boîtes du système que le processus principal ouvre
// (enregistrer un fichier, sauvegarder la session sous…, choisir un dossier),
// dans la langue de l'APP : la page l'envoie au chargement et à chaque
// changement (`habillerBureau`, src/lib/bureau.ts). Avant le premier envoi,
// la langue du système, par la même règle que l'app (fr* → français, sinon
// anglais).
//
// ⚠️ Pur : aucun import d'Electron, pour être testable sous Node. Les autres
// textes du bureau s'affichent dans la page et viennent de src/i18n/.

import { estUneLangue, resoudreLangue, type Langue } from '../src/i18n/langue';

const fr = {
  enregistrerFichier: 'Enregistrer le fichier',
  dossierSwblacksmith: 'Dossier SW Blacksmith',
  choisirCeDossier: 'Choisir ce dossier',
  sauvegarderSous: 'Sauvegarder la session sous',
  filtreSession: 'Session SW Blacksmith',
  existeDeja: (nom: string) => `« ${nom} » existe déjà.`,
  remplacerEfface: 'Le remplacer efface la session qu’il contient.',
  annuler: 'Annuler',
  remplacer: 'Remplacer',
  dossierSwex: 'Dossier SW Exporter',
};

const en: typeof fr = {
  enregistrerFichier: 'Save the file',
  dossierSwblacksmith: 'SW Blacksmith folder',
  choisirCeDossier: 'Choose this folder',
  sauvegarderSous: 'Save the session as',
  filtreSession: 'SW Blacksmith session',
  existeDeja: (nom: string) => `“${nom}” already exists.`,
  remplacerEfface: 'Replacing it erases the session it contains.',
  annuler: 'Cancel',
  remplacer: 'Replace',
  dossierSwex: 'SW Exporter folder',
};

export const TEXTES_BUREAU: Record<Langue, typeof fr> = { fr, en };

let courante: Langue = 'fr';

// La langue du système (`app.getLocale()`), avant que la page ait parlé.
export function langueDuSysteme(locale: string): Langue {
  return resoudreLangue('auto', [locale]);
}

// La langue envoyée par la page ; une valeur inconnue est ignorée.
export function definirLangue(brut: unknown): void {
  if (estUneLangue(brut)) courante = brut;
}

export function textesBureau(): typeof fr {
  return TEXTES_BUREAU[courante];
}
