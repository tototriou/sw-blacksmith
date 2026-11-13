import { Pin, PinOff } from 'lucide-react';
import type { RuneDetail } from '../../../types';
import { type BuildCandidate, candidateMetricTotal } from '../../../lib/runeBuildOptim';
import { activeSets } from '../../../lib/effects';
import { moyenneParRune } from '../../../lib/valeursAffichees';
import { type RuneMetric, formatRuneMetric } from '../../../hooks/useRuneMetric';
import { BoutonIcone, ZoneCliquable } from '../../../ui';
import { useTraduction } from '../../../hooks/useLangue';
import { nomSet } from '../../../i18n/jeu';

// Les builds épinglés, en mode cartes : une ligne compacte par épinglé, en
// tête des résultats (resultats.md, § Builds épinglés). Dix cartes entières
// repoussaient la page de quatre écrans ; une ligne garde les épinglés sous
// les yeux et la page juste en dessous (choix de l'utilisateur). La ligne dit
// le numéro, les sets et la valeur moyenne ; un clic ouvre la carte entière
// dans la modale « Build épinglé n° N », comme une ligne du tableau.

export interface LigneEpingleCompacte {
  readonly cle: string;
  readonly numero: number;
  readonly candidat: BuildCandidate;
  // Les runes de SA recherche : la valeur se calcule sur elles.
  readonly runeById: Map<number, RuneDetail>;
}

interface Props {
  epingles: readonly LigneEpingleCompacte[];
  // La mesure courante : la valeur moyenne la suit, comme sur toute carte.
  metric: RuneMetric;
  ouvrir: (cle: string) => void;
  liberer: (cle: string) => void;
}

export default function ListeEpingles({ epingles, metric, ouvrir, liberer }: Props) {
  const textes = useTraduction();
  const ca = textes.optimizer.carte;
  const r = textes.optimizer.resultats;
  if (epingles.length === 0) return null;
  const libelleMoyenne = metric === 'eff' ? r.quasi.efficienceMoyenne : r.quasi.scoreMoyen;
  return (
    <ul className="mb-3 overflow-hidden rounded-lg border border-border" data-liste-epingles="">
      {epingles.map((e) => {
        const runes = e.candidat.runeIds.map((id) => e.runeById.get(id)).filter((x): x is RuneDetail => !!x);
        const sets = activeSets(runes.map((x) => x.set));
        const moyenne = formatRuneMetric(moyenneParRune(candidateMetricTotal(e.candidat, e.runeById, metric)), metric);
        return (
          <li key={e.cle} data-ligne-epinglee="" className="flex items-center gap-2 border-b border-border-soft pr-1.5 last:border-b-0 hoverable:bg-panel2">
            <ZoneCliquable
              onClick={() => ouvrir(e.cle)}
              aria-label={r.detailEpingle(e.numero)}
              className="flex min-w-0 flex-1 items-baseline gap-2 py-1.5 pl-2.5 text-left"
            >
              <span className="inline-flex w-7 flex-none items-center gap-0.5 font-mono text-xs font-bold text-accent">
                <Pin size={11} aria-hidden />
                {e.numero}
              </span>
              <span className="min-w-0 flex-1 truncate text-micro text-ink-dim">
                {sets.map((s) => nomSet(textes.jeu, s)).join(' · ')}
              </span>
              <span className="flex-none text-xs tabular-nums text-ink">{ca.moyenne(libelleMoyenne, moyenne)}</span>
            </ZoneCliquable>
            <BoutonIcone icone={<PinOff size={13} />} libelle={ca.liberer} onClick={() => liberer(e.cle)} />
          </li>
        );
      })}
    </ul>
  );
}
