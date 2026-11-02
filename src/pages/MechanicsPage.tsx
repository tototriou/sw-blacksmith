import { ReactNode } from 'react';
import type { ArticleMecaniques } from '../components/mecaniques/blocs';
import { useLangue } from '../hooks/useLangue';
import { mecaniquesEn } from '../i18n/articles/mecaniques.en';
import { mecaniquesFr } from '../i18n/articles/mecaniques.fr';
import type { Langue } from '../i18n/langue';

// Doc de mécaniques de jeu (Summoners War). Formules issues des modèles
// communautaires (swcalc.cz, swarfarm) — valeurs prédictives, pas le code source.
//
// ⚠️ **Le texte vit dans un article par langue** (src/i18n/articles/) : la
// page n'en porte que la mise en page — titre, sommaire, sections.
const ARTICLES: Record<Langue, ArticleMecaniques> = { fr: mecaniquesFr, en: mecaniquesEn };

function goTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ⚠️ Plus de carte : un filet au-dessus de chaque section, comme la maquette —
// un article qui se lit d'un trait, pas sept panneaux empilés. Aux deux
// formats.
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border-soft pt-5">
      <h2 className="font-display text-[22px] tracking-wide mb-3">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink-dim">{children}</div>
    </section>
  );
}

export default function MechanicsPage() {
  const article = ARTICLES[useLangue()];
  // ⚠️ Colonne BORNÉE, contrairement aux autres pages : c'est du texte suivi,
  // pas une grille. Une ligne de 2 000 px se lit mal — l'œil perd le début de
  // la suivante. Voir docs/03-developpeur/interface/.
  // ⚠️ **À la SOURIS, deux colonnes** (la
  // maquette) : le sommaire FIXE à gauche, qui reste sous la main pendant la
  // lecture, et l'article à droite, borné à 720 px. L'ordre du DOM ne change
  // pas — titre, sommaire, sections — seule la grille les place.
  return (
    <div
      className="mx-auto max-w-[1100px]
                 lg:grid lg:grid-cols-[220px_minmax(0,720px)] lg:justify-center lg:gap-x-12"
    >
      <header className="lg:col-start-2 lg:row-start-1">
        {/* Encre unie, plus de dégradé — comme les
            titres des autres écrans ; le grand titre reste, c'est une page de
            lecture. */}
        <h1 className="font-display font-black text-[clamp(28px,4vw,42px)] text-ink mb-1.5">
          {article.titre}
        </h1>
        <p className="text-ink-dim text-sm leading-relaxed max-w-2xl">{article.intro}</p>
      </header>

      {/* Sommaire */}
      <nav
        className="mt-5 rounded-2xl border border-border bg-panel p-4
                   lg:sticky lg:top-6 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mt-1 lg:self-start
                   lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
      >
        <div className="label mb-2 lg:px-2.5">{article.sommaire}</div>
        <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1 list-decimal list-inside lg:grid-cols-1 lg:gap-y-0.5 lg:list-none">
          {article.sections.map((s) => (
            <li key={s.id} className="text-sm text-ink-dim">
              <button
                onClick={() => goTo(s.id)}
                className="text-left hoverable:text-ink transition lg:w-full lg:rounded-lg lg:px-2.5 lg:py-1.5 lg:hoverable:bg-panel2"
              >
                {s.titre}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-5 flex flex-col gap-5 lg:col-start-2 lg:row-start-2">
        {article.sections.map((s) => (
          <Section key={s.id} id={s.id} title={s.titre}>
            {s.contenu}
          </Section>
        ))}
      </div>
    </div>
  );
}
