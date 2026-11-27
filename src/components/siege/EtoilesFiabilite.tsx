import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Minus, Plus, Star, StarHalf, X } from 'lucide-react';
import { BoutonIcone, Flottant, ZoneCliquable } from '../../ui';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import { formatNombre } from '../../i18n/format';
import { FIABILITE_MAX, FIABILITE_PAS, FIABILITE_PAS_SAISIE, fiabiliteValide, tonFiabilite, type TonFiabilite } from '../../lib/recoDefenses';

// La fiabilité d'un deck contre une défense, en étoiles : de 0 à 5, saisie
// par étoile entière ; une ancienne note en demi-étoile s'affiche telle quelle
// (voir recoDefenses.ts). Spec :
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

// La fiabilité NOTABLE sur place, depuis la ligne d'un deck : les étoiles (ou
// « Noter », sans note) ouvrent `ChoixFiabilite` dans un flottant — sans passer
// par l'édition du deck ni de la recommandation. ⚠️ Hors du flux : la ligne ne
// bouge pas à l'ouverture, et le flottant, aligné à gauche, ne bouge pas quand
// « Noter » devient des étoiles sous le clic.
// Deux axes, pour un deck qui vise PLUSIEURS défenses (vue Decks) :
//  - `apercu` : le déclencheur, à la place des étoiles seules — il montre
//    CONTRE QUOI on note (les portraits de la défense) ;
//  - `children` : le contenu du flottant, à la place d'un seul choix — une
//    rangée par défense, chacune sa note.
export function FiabiliteRapide({ note, onChange, taille = 12, apercu, libelle, children }: {
  note?: number | undefined;
  onChange?: (note: number | null) => void;
  taille?: number;
  apercu?: ReactNode;
  libelle?: string;
  children?: ReactNode;
}) {
  const cr = useTraduction().carteReco;
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('pointerdown', dehors);
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('pointerdown', dehors);
      document.removeEventListener('keydown', echap);
    };
  }, [ouvert]);
  const n = fiabiliteValide(note);
  return (
    <span ref={racine} className="relative inline-flex flex-none" data-fiabilite-rapide>
      <ZoneCliquable
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="dialog"
        aria-label={libelle ?? cr.fiabiliteModifier}
        title={libelle ?? cr.fiabiliteModifier}
        className="-mx-1 inline-flex min-h-7 min-w-0 flex-wrap items-center gap-1 rounded-md px-1 text-micro text-ink-dim hoverable:bg-panel2 hoverable:text-ink"
      >
        {apercu ?? <ApercuNote note={n} taille={taille} />}
      </ZoneCliquable>
      {ouvert && (
        <Flottant largeur="w-max max-w-[calc(100vw-24px)]" rembourrage="sm" cote="gauche" role="dialog" aria-label={libelle ?? cr.fiabiliteModifier}>
          {children ?? (onChange && <ChoixFiabilite note={note} onChange={onChange} />)}
        </Flottant>
      )}
    </span>
  );
}

// L'aperçu d'une note sur une ligne : ses étoiles, ou « ☆ Noter » sans note.
export function ApercuNote({ note, taille = 12 }: { note: number | undefined; taille?: number }) {
  const cr = useTraduction().carteReco;
  return note !== undefined ? (
    <EtoilesFiabilite note={note} taille={taille} />
  ) : (
    <span className="inline-flex items-center gap-1">
      <Star size={taille} className="text-ink-dim/60" aria-hidden />
      <span className="underline decoration-dotted underline-offset-2">{cr.fiabiliteNoterCourt}</span>
    </span>
  );
}

// Saisie : par étoile ENTIÈRE, de 0 à 5 — toucher la k-ième étoile note k ;
// 0 s'obtient par « − » depuis 1. `libelle` remplace « Fiabilité » en tête de
// rangée (les portraits de la défense, quand le flottant en liste plusieurs).
// ⚠️ Une étoile fait 20 px : au doigt, c'est juste pour viser — les boutons
// « − » et « + », de taille tactile, font le même geste étoile par étoile.
// « × » rend la défense « non notée », qui n'est pas 0. Une ancienne note en
// demi-étoile passe à l'entier voisin (« + » monte, « − » descend).
// `sansValeur` : sans le texte « 3,5 / 5 » ou « Non notée » — dans une liste
// de défenses, la rangée tient alors sur une ligne au téléphone, et les étoiles
// disent déjà la note (leur infobulle aussi).
export function ChoixFiabilite({ note, onChange, libelle, sansValeur = false }: {
  note: number | undefined;
  onChange: (note: number | null) => void;
  libelle?: ReactNode;
  sansValeur?: boolean;
}) {
  const cr = useTraduction().carteReco;
  const langue = useLangue();
  const n = fiabiliteValide(note);
  const ton = n === undefined ? '' : TEXTE[tonFiabilite(n)];
  const pas = (sens: 1 | -1) => {
    const base = n ?? 0;
    const voisin = sens > 0
      ? Math.floor(base / FIABILITE_PAS_SAISIE) * FIABILITE_PAS_SAISIE + FIABILITE_PAS_SAISIE
      : Math.ceil(base / FIABILITE_PAS_SAISIE) * FIABILITE_PAS_SAISIE - FIABILITE_PAS_SAISIE;
    onChange(Math.min(FIABILITE_MAX, Math.max(0, voisin)));
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-choix-fiabilite>
      {libelle ?? <span className="label">{cr.fiabilite}</span>}
      <span className="inline-flex items-center">
        {ETOILES.map((k) => (
          // Le nom passe par `aria-label` ; l'étoile dessinée est décorative.
          <ZoneCliquable
            key={k}
            onClick={() => onChange(k)}
            aria-label={cr.fiabiliteNoter(formatNombre(k, langue))}
            title={cr.fiabiliteNoter(formatNombre(k, langue))}
            aria-pressed={n === k}
            className="inline-flex"
          >
            <Etoile k={k} note={n ?? -1} taille={20} ton={ton} />
          </ZoneCliquable>
        ))}
      </span>
      {!sansValeur && (
        <span className={`min-w-[4.5rem] font-mono text-micro ${n === undefined ? 'text-ink-dim' : ton}`}>
          {n === undefined ? cr.fiabiliteNonNotee : `${formatNombre(n, langue)} / ${FIABILITE_MAX}`}
        </span>
      )}
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
