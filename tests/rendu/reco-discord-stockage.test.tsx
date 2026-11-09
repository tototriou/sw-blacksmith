// Recommandations liées à Discord — relecture du stockage par le hook
// `useSiegeRecos` : le lien à un salon et les contributeurs survivent à un
// rechargement ; un lien illisible tombe sans emporter la recommandation.

import { useSiegeRecos } from '../../src/hooks/useSiegeRecos';
import { etatLien, recoLiee } from '../../src/lib/recoDiscord';
import type { Reco, RecoDeck } from '../../src/types';
import { egal, faussLocalStorage, ok, titre } from '../outils';
import { rendre } from './outils-rendu';

const deck = (ids: number[]): RecoDeck => ({
  name: '', note: '', counters: [],
  slots: [0, 1, 2].map((i) => ({ com2usId: ids[i] ?? null, name: ids[i] ? `M${ids[i]}` : '', stats: {}, setOptions: [[]], artifacts: { element: [], archetype: [] } })),
});

function Capture({ sortie }: { sortie: { recos?: Reco[] } }) {
  sortie.recos = useSiegeRecos().state.recos;
  return null;
}

export function testRenduRecoDiscordStockage() {
  titre('Recos Discord — relecture du stockage');
  const salon = { serveurId: 'G', salonId: 'C1', nomServeur: 'Guilde', nomSalon: 'blacksmith-reco', ecrire: true };
  const contenu = { name: 'Défenses', author: 'Toto', note: '', decks: [deck([1, 2, 3])], contributeurs: ['Toto', 'Lulu'], source: 'discord:G:C1' };
  const liee = { ...recoLiee(salon, { messageId: 'm1', date: 'd1', reco: contenu }, () => 'r1'), note: 'modifiée ici' };
  const casse = { ...recoLiee({ ...salon, salonId: 'C2' }, { messageId: 'm2', date: 'd2', reco: contenu }, () => 'r2'), lien: { salonId: 'C2' } };
  faussLocalStorage({ 'swblacksmith-siege-recos-v1': JSON.stringify({ recos: [liee, casse] }) });
  const sortie: { recos?: Reco[] } = {};
  rendre(<Capture sortie={sortie} />);
  const [a, b] = sortie.recos ?? [];
  egal([a?.lien?.salonId, a?.lien?.base.messageId, a?.contributeurs, etatLien(a)], ['C1', 'm1', ['Toto', 'Lulu'], 'modifiee'],
    'lien, base et contributeurs relus : la copie reste « modifiée » après un rechargement');
  ok(!!b && !b.lien && b.name === 'Défenses', 'un lien illisible tombe ; la recommandation reste, locale');
}
