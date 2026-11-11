// Banc navigateur de l'aperçu replié d'une recommandation (`ApercuDeuxLignes`,
// RecoCard.tsx) : des pastilles par centaines dans une boîte dont on change la
// largeur. Monté par `navigateurOptimizer` (sources réelles compilées,
// Chromium) ; les contrôles sont dans apercu-recos.test.ts.
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ApercuDeuxLignes } from '../../src/components/siege/RecoCard';

let racine: Root | null = null;

function rendre(n: number, largeur: number) {
  const pastilles = Array.from({ length: n }, (_, i) => ({
    cle: `deck-${i}`,
    nom: `Deck ${i + 1}`,
    noeud: <span className="rounded-full border border-border-soft px-2 py-0.5 text-micro" data-pastille>Deck {i + 1}</span>,
  }));
  const fin = <span className="text-micro" data-fin>Consignes</span>;
  flushSync(() => racine!.render(
    <div data-boite style={{ width: largeur, padding: 8 }}>
      <ApercuDeuxLignes pastilles={pastilles} fin={fin} />
    </div>
  ));
}

export function monter(n: number, largeur: number) {
  racine ??= createRoot(document.getElementById('racine')!);
  rendre(n, largeur);
}

// Change la largeur de la boîte sans rien rendre : le ResizeObserver relance
// la recherche, comme un redimensionnement de la fenêtre.
export function elargir(largeur: number) {
  document.querySelector<HTMLElement>('[data-boite]')!.style.width = `${largeur}px`;
}
