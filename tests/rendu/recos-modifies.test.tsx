// Tests de rendu — Siège · Recommandations, « Modifiés » : l'interrupteur et
// son compte, le tag sur la ligne d'un deck, et la page filtrée
// (src/components/siege/RecoBoard.tsx, RecoCard.tsx, VoletDefenses.tsx ;
// calcul dans src/lib/recoModifies.ts). Même page et mêmes données que
// recos.test.tsx, la première recommandation liée à un salon.

import { fr } from '../../src/i18n/fr';
import { CLE_FILTRE_MODIFIES } from '../../src/lib/recoModifies';
import { ok, titre } from '../outils';
import { boutons, texteVisible } from './outils-rendu';
import { RECOS, rendreRecos } from './recos.test';

const r = fr.recos;
const cr = fr.carteReco;
// La première recommandation, liée à un salon dont la dernière version porte
// ses decks — sauf ceux d'index `changes` (modifiés depuis, sur l'appareil).
const premiere = RECOS.recos[0];
const liee = (changes: number[] = []) => ({
  recos: [
    {
      ...premiere,
      origin: 'imported',
      lien: {
        serveurId: 's', salonId: 'c', nomServeur: 'Serveur', nomSalon: 'blacksmith-reco-siege', ecrire: true,
        base: {
          messageId: 'm', date: '2026-11-27',
          reco: { name: premiere.name, author: premiere.author, note: premiere.note, decks: premiere.decks.filter((_, i) => !changes.includes(i)) },
        },
      },
    },
    RECOS.recos[1],
  ],
});
// L'interrupteur (`role="switch"`) : son texte, son état, désactivé, son infobulle.
const filtre = (html: string) => {
  const m = html.match(/<button\b([^>]*data-filtre-modifies[^>]*)>([\s\S]*?)<\/button>/);
  if (!m) return null;
  const attr = (nom: string) => m[1].match(new RegExp(`\\s${nom}="([^"]*)"`))?.[1] ?? null;
  return { texte: texteVisible(m[2]), actif: attr('aria-checked') === 'true', desactive: /\sdisabled(=""|\s|$)/.test(m[1]), title: attr('title') };
};
const tags = (html: string) => html.split('data-deck-modifie').length - 1;

export function testRenduRecosModifies() {
  titre('rendu · Siège · Recommandations — « Modifiés » : ce qui n’est pas publié');

  const aJour = rendreRecos(liee(), 'attaque');
  const f0 = filtre(aJour);
  ok(!!f0 && f0.texte === r.modifies(0) && f0.desactive && f0.title === r.modifiesAucun,
    'tout est publié : « Modifiés (0) », toujours affiché, désactivé, et pourquoi');
  ok(tags(aJour) === 0, 'aucun tag « Modifié » sur une recommandation à jour');
  ok(tags(rendreRecos(RECOS, 'attaque')) === 0, 'une recommandation de l’appareil n’a pas de version de salon : aucun tag');

  // Le second deck (Galleon, Belladeon, Chasun) ajouté sur l'appareil.
  const modifiee = rendreRecos(liee([1]), 'attaque');
  const f1 = filtre(modifiee);
  ok(!!f1 && f1.texte === r.modifies(1) && !f1.desactive && !f1.actif && f1.title === r.modifiesAide, 'un deck modifié : « Modifiés (1) », actif, éteint');
  ok(/data-modifies-telephone/.test(modifiee) && modifiee.split('data-filtre-modifies').length - 1 === 2,
    'dans la page aux deux formats : sous la recherche au doigt, au bout de la barre à la souris');

  // Allumé : la recommandation au deck modifié, et ce deck seulement, tagué.
  // (Éteint, « Toutes » ouvre d'abord les recommandations de l'appareil.)
  const filtree = rendreRecos(liee([1]), 'attaque', { [CLE_FILTRE_MODIFIES]: true });
  const t = texteVisible(filtree);
  ok(filtre(filtree)?.actif === true, 'allumé');
  ok(t.includes(cr.decksSur(1, 2)) && !t.includes('Defs de guilde'), 'la liste : la recommandation au deck modifié, « 1 sur 2 decks »');
  ok(tags(filtree) === 1 && t.includes(cr.modifie) && filtree.includes(`title="${cr.modifieAide}"`),
    'sa ligne porte « Modifié », l’infobulle dit qu’il n’est pas publié');
  ok(!boutons(filtree).some((b) => b.texte === cr.modifie), 'le tag n’est pas un bouton : il part en publiant');

  // Éteint, vue Défenses : seul le deck modifié porte le tag.
  ok(tags(rendreRecos(liee([0]), 'defense')) === 1 && tags(rendreRecos(liee([1]), 'defense')) === 0,
    'éteint : le tag sur la ligne du deck modifié, pas sur les autres');

  // Vue Défenses : la défense que vise le deck modifié (le premier), et son tag.
  const defenses = rendreRecos(liee([0]), 'defense', { [CLE_FILTRE_MODIFIES]: true });
  ok(texteVisible(defenses).includes(r.defensesVisees(1, 1)) && tags(defenses) === 1, 'vue Défenses : la défense que vise le deck modifié, et « Modifié » sur sa ligne');

  // Allumé, tout publié : la page le dit, et propose de tout afficher.
  const vide = rendreRecos(liee(), 'attaque', { [CLE_FILTRE_MODIFIES]: true });
  ok(texteVisible(vide).includes(r.modifiesVide) && texteVisible(vide).includes(r.modifiesEteindre), 'allumé, tout publié : la page le dit, « Tout afficher »');
  ok(filtre(vide)?.actif === true && !filtre(vide)?.desactive, 'allumé à zéro : l’interrupteur s’éteint encore');
}
