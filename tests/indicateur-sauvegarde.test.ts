// « Sauvegardé il y a … » — la durée écoulée, en mots (docs/02-app/rta/).

import { depuis } from '../src/components/rta/IndicateurSauvegarde';
import { fr } from '../src/i18n/fr';
import { en } from '../src/i18n/en';
import { egal, titre } from './outils';

export function testIndicateurSauvegarde() {
  titre('« Sauvegardé il y a … » — la durée en mots');
  egal(depuis(0, fr), "à l'instant", 'tout de suite : « à l\'instant »');
  egal(depuis(59_000, fr), "à l'instant", 'moins d\'une minute : « à l\'instant »');
  egal(depuis(60_000, fr), 'il y a 1 min', 'une minute');
  egal(depuis(59 * 60_000, fr), 'il y a 59 min', 'jusqu\'à 59 minutes');
  egal(depuis(60 * 60_000, fr), 'il y a 1 h', 'une heure');
  egal(depuis(23 * 3_600_000 + 59 * 60_000, fr), 'il y a 23 h', 'jusqu\'à 23 heures');
  egal(depuis(24 * 3_600_000, fr), 'il y a 1 j', 'un jour');
  egal(depuis(3 * 60_000, en), '3 min ago', 'en anglais : « 3 min ago »');
  egal(depuis(2 * 24 * 3_600_000, en), '2 d ago', 'en anglais : « 2 d ago »');
}
