import HelpPopover from '../../HelpPopover';
import { Pastille } from '../../../ui';
import RuneIcon from '../../RuneIcon';
import { runeSetIconFilter, choixEffetRune } from '../../../lib/effects';
import { useTraduction } from '../../../hooks/useLangue';
import { type Monster, type GearSet } from '../../../types';
import { type Dispatch, type SetStateAction } from 'react';

export interface RunesImposeesProps {
  selected: { monster: Monster; gear: GearSet; } | null;
  lockedRunes: Partial<Record<number, number>>;
  setLockedRunes: Dispatch<SetStateAction<Partial<Record<number, number>>>>;
  // Colonne « Aura, exclusion, avancés » du bureau : deux colonnes égales,
  // slots impairs puis pairs (1 · 2, 3 · 4, 5 · 6), chaque puce à la largeur
  // de sa colonne, libellé centré — six puces de même taille, emplacement
  // vide compris. Le téléphone garde la rangée qui
  // passe à la ligne, puces à la largeur de leur libellé.
  bureau?: boolean;
}

export default function RunesImposees({ selected, lockedRunes, setLockedRunes, bureau = false }: RunesImposeesProps) {
  const textes = useTraduction();
  const jeu = textes.jeu;
  const v = textes.optimizer.imposees;
  const c = textes.optimizer.criteres;
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-1.5">
        <p className="label" data-intitule-conserve>{v.titre}</p>
        <HelpPopover title={v.titre}>
          {v.aide}<b className="text-ink">{v.aideGras}</b>{v.aideFin}
        </HelpPopover>
      </div>
      {!selected || selected.gear.runes.length === 0 ? (
        <p className="text-micro text-ink-dim">{v.aucuneRune}</p>
      ) : (
        <div className={bureau ? 'grid grid-cols-2 gap-x-3 gap-y-1.5' : 'flex flex-wrap gap-1.5'}>
          {[1, 2, 3, 4, 5, 6].map((slot) => {
            const portee = selected.gear.runes.find((r) => r.slot === slot);
            const verrouille = lockedRunes[slot] != null;
            if (!portee) {
              return (
                <span
                  key={slot}
                  className={`rounded-full border border-border bg-panel2 px-2.5 py-1 text-micro text-ink-dimmer opacity-50${bureau ? ' flex items-center justify-center' : ''}`}
                  title={v.emplacementVide(slot)}
                >
                  {c.slot(slot)} —
                </span>
              );
            }
            return (
              <Pastille
                key={slot}
                actif={verrouille}
                className={bureau ? 'w-full justify-center' : ''}
                onClick={() =>
                  setLockedRunes((prev) => {
                    const next = { ...prev };
                    if (next[slot] != null) delete next[slot];
                    else next[slot] = portee.id;
                    return next;
                  })
                }
                icone={<RuneIcon setKey={portee.set} size={13} filter={runeSetIconFilter(verrouille)} />}
                libelle={`${c.slot(slot)} · ${choixEffetRune(portee.main.code, jeu)}`}
                title={verrouille ? v.liberer(slot) : v.imposer(slot)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
