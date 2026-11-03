import { Fragment } from 'react';
import { RotateCcw } from 'lucide-react';
import HelpPopover from '../../HelpPopover';
import { Bouton, Interrupteur, NumberField } from '../../../ui';
import { COLONNES_RESULTATS, type ColonneResultat } from '../../../lib/colonnesResultats';
import type { BornesResultats } from '../../../lib/filtresResultats';
import type { OptimMetric } from '../../../lib/runeOptim';
import type { StatKey } from '../../../lib/effects';
import { colonneContradictoire, decimalesColonne, depuisAffichage, libelleColonne, suffixeColonne, versAffichage } from '../../../lib/filtresAffichage';
import { useTraduction } from '../../../hooks/useLangue';

// « Filtrer l'affichage » : une borne minimum et une borne maximum par colonne
// des résultats, la grille de `Conditions` (libellé, Min, Max, `NumberField`).
// ⚠️ **Un seul JSX, deux contenants** (deux-formats.md) : le `Flottant` ancré
// au bouton au bureau, le `MobileSheet` au téléphone.
// ⚠️ Des filtres d'AFFICHAGE, séparés des conditions de recherche auxquelles
// la grille ressemble trait pour trait : la phrase fixe le dit, et la grille
// vit dans l'en-tête des résultats, jamais dans « Critères de recherche ».


export interface FiltresResultatsProps {
  bornes: BornesResultats;
  poserBorne: (colonne: ColonneResultat, cote: 'min' | 'max', valeur: number | null) => void;
  effacer: () => void;
  metric: OptimMetric;
  disponible: (colonne: ColonneResultat) => boolean;
  // « Stats de base exclues » des bornes : le réglage d'affichage que porte
  // aussi « Stats totales / Stats bonus » du tableau, jamais celui de la
  // recherche. Le classeur garde les bornes en total ; activé, PV, ATQ, DEF
  // et VIT se saisissent et s'écrivent sans la base du monstre (`base`).
  enBonus?: boolean;
  setBonus?: (bonus: boolean) => void;
  base?: Partial<Record<StatKey, number>>;
}

export function BoutonEffacerFiltres({ effacer, actif }: { effacer: () => void; actif: boolean }) {
  const r = useTraduction().optimizer.resultats;
  return (
    <Bouton
      fond="vide"
      trait="aucun"
      taille="sm"
      onClick={effacer}
      disabled={!actif}
      icone={<RotateCcw size={13} />}
      libelle={r.effacerFiltres}
    />
  );
}

export default function FiltresResultats({ bornes, poserBorne, effacer, metric, disponible, enBonus = false, setBonus, base = {} }: FiltresResultatsProps) {
  const textes = useTraduction();
  const r = textes.optimizer.resultats;
  const k = textes.optimizer.conditions;
  const actif = COLONNES_RESULTATS.some((c) => bornes[c]?.min != null || bornes[c]?.max != null);
  return (
    <div>
      <p className="mb-2 text-xs text-ink-dim">{r.filtresAide}</p>
      {setBonus && (
        // Le même interrupteur que « Conditions », à la même place au-dessus de la grille.
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-xs font-semibold text-ink-dim">{k.baseExclue}</span>
          <HelpPopover title={k.baseExclue}>
            <b className="text-ink">{k.aideBase.statsDeBase}</b>{r.aideBaseFiltres.active}
            <b className="text-ink">{k.aideBase.auDessus}</b>{r.aideBaseFiltres.desactive}
            <b className="text-ink">{k.aideBase.statsTotales}</b>{r.aideBaseFiltres.toujoursTotal}
          </HelpPopover>
          <Interrupteur actif={enBonus} onChange={setBonus} aria-label={r.baseExclueFiltresAria} />
        </div>
      )}
      {/* `w-fit` : la grille garde ses colonnes serrées, comme `Conditions`. */}
      <div className="grid w-fit grid-cols-[minmax(76px,auto)_auto_auto] items-center gap-x-2 gap-y-1.5 lg:gap-x-3">
        <span aria-hidden />
        {/* Pas `.label` : le panneau du téléphone (`data-tiroir`) le masque, et la grille se décalerait. */}
        <span className="text-center text-micro font-semibold uppercase tracking-wider text-ink-dim">{textes.optimizer.conditions.min}</span>
        <span className="text-center text-micro font-semibold uppercase tracking-wider text-ink-dim">{textes.optimizer.conditions.max}</span>
        {COLONNES_RESULTATS.map((c) => {
          const libre = disponible(c);
          const nom = libelleColonne(c, metric, textes);
          const ton = libre && colonneContradictoire(bornes, c) ? 'bad' : 'neutre';
          return (
            <Fragment key={c}>
              <span className={`text-xs ${libre ? 'text-ink' : 'text-ink-dimmer'}`} title={libre ? undefined : r.colonneIndisponible}>
                {nom}
              </span>
              {(['min', 'max'] as const).map((cote) => {
                const total = bornes[c]?.[cote] ?? null;
                return (
                  <NumberField
                    key={cote}
                    value={total === null ? null : versAffichage(c, total, base, enBonus)}
                    onChange={(v) => poserBorne(c, cote, v === null ? null : depuisAffichage(c, v, base, enBonus))}
                    allowEmpty
                    // Aucune colonne n'est négative : « − » s'arrête à un total
                    // de 0 (−base sans la base, comme le tableau).
                    min={versAffichage(c, 0, base, enBonus)}
                    // Une décimale pour l'Efficience, comme la carte l'écrit.
                    decimales={decimalesColonne(c, metric)}
                    disabled={!libre}
                    ton={ton}
                    placeholder="—"
                    suffix={suffixeColonne(c, metric) || undefined}
                    // Six chiffres et le suffixe sans rogner (« 150000 »).
                    boxWidth="w-28"
                    ariaLabel={r.borneAffichee(nom, cote)}
                    title={libre ? (cote === 'min' ? k.minimum : k.maximum) : r.colonneIndisponible}
                  />
                );
              })}
            </Fragment>
          );
        })}
      </div>
      <div className="mt-2 flex justify-end">
        <BoutonEffacerFiltres effacer={effacer} actif={actif} />
      </div>
    </div>
  );
}
