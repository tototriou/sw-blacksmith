// Pastille de statut d'une équipe de siège :
// chaque état a SON libellé, tiré des phrases de l'app.

import { pastilleStatut, EntreePastille } from '../src/components/siege/pastilleStatut';
import { fr } from '../src/i18n/fr';
import { en } from '../src/i18n/en';
import { egal, titre } from './outils';

const BASE: EntreePastille = { statut: 'neutre', validee: false, swift: false, manqueRunes: false, manqueArtes: false };

export default function testSiegePastille() {
  titre('Siège — pastille de statut d\'une équipe');

  egal(pastilleStatut(BASE, fr), null, 'neutre (mode éteint, équipe vide…) : pas de pastille');
  egal(pastilleStatut({ ...BASE, statut: 'vert' }, fr), { libelle: 'Tous au tick', ton: 'good' }, 'vert, équipe normale : « Tous au tick »');
  egal(pastilleStatut({ ...BASE, statut: 'vert', swift: true }, fr), { libelle: 'Speed tune', ton: 'good' }, 'vert, équipe Swift : « Speed tune »');
  egal(pastilleStatut({ ...BASE, statut: 'vert', validee: true }, fr), { libelle: 'Tick validé', ton: 'good' }, 'vert validé à la main : « Tick validé »');
  egal(pastilleStatut({ ...BASE, statut: 'vert', validee: true, swift: true }, fr), { libelle: 'Speed tune validé', ton: 'good' }, 'vert validé, Swift : « Speed tune validé »');
  egal(pastilleStatut({ ...BASE, statut: 'orange' }, fr), { libelle: 'À vérifier', ton: 'warn' }, 'orange : « À vérifier »');
  egal(pastilleStatut({ ...BASE, statut: 'rouge' }, fr), { libelle: 'Pas au tick', ton: 'bad' }, 'rouge : « Pas au tick »');

  // L'équipement passe avant tout, et dit CE qui manque.
  egal(pastilleStatut({ ...BASE, statut: 'vert', manqueRunes: true }, fr), { libelle: 'Runes incomplètes', ton: 'bad' }, 'runes manquantes, même sur une équipe verte : « Runes incomplètes »');
  egal(pastilleStatut({ ...BASE, manqueArtes: true }, fr), { libelle: 'Artéfacts incomplets', ton: 'bad' }, 'seulement des artéfacts manquants : « Artéfacts incomplets », pas « Runes »');
  egal(pastilleStatut({ ...BASE, manqueRunes: true, manqueArtes: true }, fr), { libelle: 'Runes incomplètes', ton: 'bad' }, 'runes et artéfacts manquants : « Runes incomplètes »');
  egal(pastilleStatut({ ...BASE, statut: 'rouge' }, en), { libelle: 'Not on tick', ton: 'bad' }, 'en anglais : « Not on tick »');
}
