import { Minus, Plus, Star, StarHalf, X } from 'lucide-react';
import { BoutonIcone, ZoneCliquable } from '../../ui';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import { formatNombre } from '../../i18n/format';
import { FIABILITE_MAX, FIABILITE_PAS, fiabiliteValide, tonFiabilite, type TonFiabilite } from '../../lib/recoDefenses';

// La fiabilité d'un deck contre une défense, en étoiles : de 0 à 5 par
// demi-étoile (voir recoDefenses.ts). Spec :
// docs/02-app/siege/feat-recommandations/defenses-visees.md § Fiabilité.

// La couleur suit la note : rouge en bas, jaune au milieu, vert en haut.
const TEXTE: Record<TonFiabilite, string> = { bad: 'text-bad', warn: 'text-warn', good: 'text-good' };

const ETOILES = Array.from({ length: FIABILITE_MAX }, (_, i) => i + 1);

// Une étoile : pleine, à moitié, ou vide. La moitié se pose SUR une étoile
// vide, pour que la seconde moitié reste dessinée.
function Etoile({ k, note, taille, ton }: { k: number; note: number; taille: number; ton: string }) {
  const vide = <Star size={taille} className="text-ink-dim/40" aria-hidden />;
  if (note >= k) return <Star size={taille} className={`fill-current ${ton}`} aria-hidden />;
  if (note >= k - FIABILITE_PAS) {
    return (
      <span className="relative inline-flex">
        {vide}
        <StarHalf size={taille} className={`absolute inset-0 fill-current ${ton}`} aria-hidden />
      </span>
    );
  }
  return vide;
}

// Lecture seule : cinq étoiles, colorées selon la note.
export function EtoilesFiabilite({ note, taille = 12 }: { note: number; taille?: number }) {
  const cr = useTraduction().carteReco;
  const langue = useLangue();
  const libelle = cr.fiabiliteNote(formatNombre(note, langue));
  return (
    <span role="img" aria-label={libelle} title={libelle} className="inline-flex flex-none items-center" data-fiabilite={note}>
      {ETOILES.map((k) => (
        <Etoile key={k} k={k} note={note} taille={taille} ton={TEXTE[tonFiabilite(note)]} />
      ))}
    </span>
  );
}

// Saisie : chaque étoile se touche par MOITIÉ (gauche = demi-étoile, droite =
// étoile entière). ⚠️ Une demi-étoile fait 10 px : au doigt, c'est trop petit
// pour viser juste — les boutons « − » et « + », de taille tactile, font le
// même geste demi-étoile par demi-étoile. « × » rend la défense « non notée »,
// qui n'est pas 0.
export function ChoixFiabilite({ note, onChange }: { note: number | undefined; onChange: (note: number | null) => void }) {
  const cr = useTraduction().carteReco;
  const langue = useLangue();
  const n = fiabiliteValide(note);
  const ton = n === undefined ? '' : TEXTE[tonFiabilite(n)];
  const pas = (sens: 1 | -1) =>
    onChange(Math.min(FIABILITE_MAX, Math.max(0, (n ?? 0) + sens * FIABILITE_PAS)));
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-choix-fiabilite>
      <span className="label">{cr.fiabilite}</span>
      <span className="inline-flex items-center">
        {ETOILES.map((k) => (
          <span key={k} className="relative inline-flex">
            <Etoile k={k} note={n ?? -1} taille={20} ton={ton} />
            {[k - FIABILITE_PAS, k].map((valeur, moitie) => (
              <ZoneCliquable
                key={valeur}
                onClick={() => onChange(valeur)}
                aria-label={cr.fiabiliteNoter(formatNombre(valeur, langue))}
                title={cr.fiabiliteNoter(formatNombre(valeur, langue))}
                className={`absolute inset-y-0 w-1/2 ${moitie === 0 ? 'left-0' : 'right-0'}`}
              >
                <span className="sr-only">{formatNombre(valeur, langue)}</span>
              </ZoneCliquable>
            ))}
          </span>
        ))}
      </span>
      <span className={`min-w-[4.5rem] font-mono text-micro ${n === undefined ? 'text-ink-dim' : ton}`}>
        {n === undefined ? cr.fiabiliteNonNotee : `${formatNombre(n, langue)} / ${FIABILITE_MAX}`}
      </span>
      <BoutonIcone
        onClick={() => pas(-1)}
        disabled={n === undefined || n <= 0}
        icone={<Minus size={13} />}
        libelle={cr.fiabiliteMoins}
      />
      <BoutonIcone
        onClick={() => pas(1)}
        disabled={n !== undefined && n >= FIABILITE_MAX}
        icone={<Plus size={13} />}
        libelle={cr.fiabilitePlus}
      />
      {/* ⚠️ Toujours rendu, désactivé sans note : il apparaissait au premier
          clic sur une étoile et décalait la rangée. */}
      <BoutonIcone
        onClick={() => onChange(null)}
        disabled={n === undefined}
        icone={<X size={13} />}
        libelle={cr.fiabiliteEffacer}
      />
    </div>
  );
}
