import { ReactNode } from 'react';

// Les briques de l'article « Mécaniques », partagées par ses versions de chaque
// langue (src/i18n/articles/) : l'article écrit le texte, ces briques le
// mettent en forme.

// Bloc de formule (mono, défilable en X sur mobile).
export function F({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-panel2 px-3.5 py-2.5">
      <code className="font-mono text-sm text-ink whitespace-pre">{children}</code>
    </div>
  );
}

// Terme mis en avant dans le texte.
export function K({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-ink">{children}</span>;
}

// Mot appuyé dans une phrase.
export function Fort({ children }: { children: ReactNode }) {
  return <b className="text-ink">{children}</b>;
}

// Une liste à puces de l'article ; `aere` pour les listes à formules.
export function Liste({ children, aere = false }: { children: ReactNode; aere?: boolean }) {
  return <ul className={`list-disc list-inside ${aere ? 'space-y-1.5' : 'space-y-1'}`}>{children}</ul>;
}

// La forme d'un article de mécaniques, dans une langue.
export interface ArticleMecaniques {
  titre: string;
  intro: ReactNode;
  sommaire: string;
  // Les sections, dans l'ordre ; l'`id` sert d'ancre au sommaire et reste le
  // même d'une langue à l'autre.
  sections: { id: string; titre: string; contenu: ReactNode }[];
}
