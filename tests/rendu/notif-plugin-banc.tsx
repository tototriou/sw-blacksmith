// Banc navigateur de la notification du plugin SWEX à remplacer
// (src/components/MiseAJourPlugin.tsx) : le vrai composant, le vrai
// fournisseur de notifications, et un faux état du direct que le scénario
// fait évoluer comme le processus principal.
import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import MiseAJourPlugin from '../../src/components/MiseAJourPlugin';
import { DirectSwexContext, type DirectSwex } from '../../src/hooks/useCompteDirect';
import type { EtatDirectSwex } from '../../src/lib/bureau';
import { FournisseurNotification, useNotifier } from '../../src/ui/Notification';

const etat = (plugin: Partial<EtatDirectSwex['plugin']>, maj = 1): EtatDirectSwex => ({
  actif: false,
  disponible: true,
  maj,
  plugin: { installee: '2.5.1', app: '2.6.0', statut: 'ancien', ...plugin },
});

let poser: (e: EtatDirectSwex | null) => void = () => {};
let annoncer: ReturnType<typeof useNotifier> = () => {};
let root: Root | null = null;

function Annonceur() {
  annoncer = useNotifier();
  return null;
}

function Banc() {
  const [e, setE] = useState<EtatDirectSwex | null>(null);
  poser = setE;
  const direct: DirectSwex = { etat: e, activer: () => {}, relire: () => {}, mettreAJour: async () => ({ ok: true, nom: null }) };
  return (
    <FournisseurNotification>
      <DirectSwexContext.Provider value={direct}>
        <MiseAJourPlugin />
        <Annonceur />
      </DirectSwexContext.Provider>
    </FournisseurNotification>
  );
}

async function geste(action: () => void) {
  flushSync(action);
  await new Promise((r) => setTimeout(r, 0));
  flushSync(() => {});
}

const bandeau = () => document.querySelector<HTMLElement>('[role="status"]');
const texte = () => bandeau()?.textContent ?? null;
const bouton = (nom: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="status"] button')].find(
    (b) => b.textContent === nom || b.getAttribute('aria-label') === nom
  ) ?? null;

async function monter() {
  if (root) await geste(() => root!.unmount());
  document.body.innerHTML = '<div id="racine"></div>';
  window.location.hash = '';
  root = createRoot(document.getElementById('racine')!);
  await geste(() => root!.render(<Banc />));
}

export async function scenario(): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [];
  const verifier = (condition: boolean, libelle: string) => preuves.push([condition, libelle]);
  const MESSAGE = 'Nouvelle version du plugin SW Blacksmith Live disponible';

  await monter();
  verifier(bandeau() === null, 'sur le site (aucun état du direct) : rien');
  await geste(() => poser(etat({ statut: 'a-jour', installee: '2.6.0' })));
  verifier(bandeau() === null, 'plugin à jour : rien');
  await geste(() => poser(etat({ statut: 'plus-recent', installee: '2.7.0' })));
  verifier(bandeau() === null, 'plugin plus récent que l’app : rien');
  await geste(() => poser(etat({ statut: 'absent', installee: null })));
  verifier(bandeau() === null, 'plugin absent : rien');

  await geste(() => poser(etat({})));
  verifier(texte()?.startsWith(MESSAGE) === true, 'plugin ancien : la notification le dit');
  verifier(!!bouton('Mettre à jour'), 'avec son action « Mettre à jour »');
  await new Promise((r) => setTimeout(r, 6500));
  verifier(texte()?.startsWith(MESSAGE) === true, 'une question : toujours là après 6 s');

  await geste(() => bouton('Fermer la notification')!.click());
  verifier(bandeau() === null, 'la croix la ferme');
  await geste(() => poser(etat({}, 2)));
  verifier(bandeau() === null, 'l’état revient (une action en jeu) : elle ne revient pas');
  await geste(() => poser(etat({ installee: '2.4.0' }, 3)));
  verifier(texte()?.startsWith(MESSAGE) === true, 'une autre copie ancienne : elle se redit');

  await geste(() => bouton('Mettre à jour')!.click());
  verifier(window.location.hash === '#/sw-exporter' && bandeau() === null, '« Mettre à jour » ouvre la page SW Exporter et la ferme');

  // Une annonce passagère (un export appliqué) arrive pendant la question.
  await monter();
  await geste(() => poser(etat({})));
  await geste(() => annoncer({ message: 'Compte mis à jour depuis SW Exporter' }));
  verifier(texte()?.startsWith('Compte mis à jour') === true, 'une annonce passagère prend la place de la question');
  await geste(() => bouton('Fermer la notification')!.click());
  verifier(texte()?.startsWith(MESSAGE) === true, 'fermée, elle rend la place à la question');
  await geste(() => annoncer({ message: 'Compte mis à jour depuis SW Exporter' }));
  await new Promise((r) => setTimeout(r, 6500));
  verifier(texte()?.startsWith(MESSAGE) === true, 'partie seule après 6 s : la question revient aussi');
  await geste(() => annoncer({ message: 'Nouvelle version 2.6.1 disponible', persistante: true }));
  await geste(() => bouton('Fermer la notification')!.click());
  verifier(bandeau() === null, 'une autre question la remplace pour de bon');

  await geste(() => root!.unmount());
  root = null;
  return preuves;
}
