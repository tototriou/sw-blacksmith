import { type BuildOptimProgress, type BuildOptimStatus } from '../../../hooks/useBuildOptimSearch';
import { type RelicVide } from '../../../lib/relicOptim';
import { useLangue, useTraduction } from '../../../hooks/useLangue';
import { formatNombre } from '../../../i18n/format';

export interface ProgressionRechercheProps {
  status: BuildOptimStatus;
  progress: BuildOptimProgress | null;
  refusal: { motif: 'relique-pool-vide'; vide: RelicVide } | null;
  // Le compte des trouvées de la ligne d'appariement (`compteAffichable`).
  compteAffiche: { compte: number };
  // Forme compacte du bloc « Objectif et Rechercher » du bureau (décision de
  // l'utilisateur) : sans barre, les lignes de texte seules — à l'appariement,
  // « … combinaisons examinées · … trouvée(s) » et « Attendez la fin… ». Le
  // téléphone ne la passe pas.
  compacte?: boolean;
}

export default function ProgressionRecherche({ status, progress, refusal, compteAffiche, compacte = false }: ProgressionRechercheProps) {
  const pr = useTraduction().optimizer.resultats.progression;
  const langue = useLangue();
  const n = (v: number) => formatNombre(v, langue);
  return (
    <>
      {/* ⚠️ Deux phases distinctes affichées différemment, pas une seule
          barre continue : `building` (construction des compartiments, avant
          même de savoir combien de paires il y aura à explorer) et `pairing`
          (l'ancienne barre, inchangée) ne partagent pas la même notion de
          progression — les mélanger sous un seul repère aurait été plus
          trompeur qu'utile (la barre aurait pu reculer en changeant de
          phase). Avant ce correctif, `progress` restait `null` pendant toute
          la phase `building` (jusqu'à ~1 minute sur un compte réel à
          beaucoup de conditions) : la barre affichait 0 % sans bouger et le
          texte « 0 combinaisons examinées », sans dire qu'un TRAVAIL était
          en cours — voir docs/02-app/optimizer/,
          « Barre de progression ». */}
      {/* ⚠️ Deux barres empilées, une par moitié, pas une seule — depuis leur
          construction EN PARALLÈLE (deux Workers, voir
          runeBuildOptim.worker.ts), A et B avancent en même temps ; une seule
          barre ne pourrait montrer que la dernière moitié à avoir posté un
          message, faisant croire à tort que l'autre est à l'arrêt. */}
      {status === 'running' && progress?.phase === 'building' && (
        <div className={compacte ? 'space-y-0.5' : 'space-y-2'}>
          {(['A', 'B'] as const).map((half) => {
            const h = progress.halves[half];
            return (
              <div key={half}>
                {!compacte && (
                  <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-panel2">
                    <div
                      className="h-full bg-accent/60 transition-[width] duration-150 ease-out"
                      style={{ width: `${Math.round((h?.pct ?? 0) * 100)}%` }}
                    />
                  </div>
                )}
                {/* Phrases en police du texte (la mono ne sert qu'aux
                    chiffres seuls) ; `tabular-nums` : les compteurs changent
                    en place sans faire danser la ligne. */}
                <p className={`${compacte ? '' : 'mt-1 '}text-micro tabular-nums text-ink-dim`}>
                  {pr.moitie(half)}{' '}
                  {h ? pr.runes(n(h.scanned), n(h.total)) : pr.enAttente}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {status === 'running' && (progress === null || progress.phase === 'pairing') && (
        <div>
          {!compacte && (
            <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-panel2">
              <div
                className="h-full bg-accent transition-[width] duration-150 ease-out"
                style={{ width: `${Math.round((progress?.pct ?? 0) * 100)}%` }}
              />
            </div>
          )}
          {/* ⚠️ Le dénominateur ici est `totalPairs` (voir `totalPairCount`),
              la taille EXACTE de l'espace à épuiser — un plafond de nœuds a
              longtemps coexisté avec lui, écarté d'ici parce qu'il
              grandissait en cours de route et aurait fait RECULER la barre.
              C'est ce choix de l'interface qui a fini par emporter sa
              suppression du moteur. */}
          <p className={`${compacte ? '' : 'mt-1 '}text-micro tabular-nums text-ink-dim`}>
            {progress === null
              ? pr.preparation
              : pr.examinees(n(progress.explored), n(progress.totalPairs), n(compteAffiche.compte))}
          </p>
          {progress !== null && (
            <p className="mt-0.5 text-[11px] font-bold text-star">
              {pr.attendez}
            </p>
          )}
          {/* ⚠️ Plus de phrase sur un budget qui s'élargit : l'escalade du
              budget de paires n'existe plus dans le moteur (runeBuildOptim.ts,
              « Il n'existe PLUS de budget de PAIRES »). */}
        </div>
      )}

      {status === 'error' && (
        <p className="text-xs text-bad">{pr.echec}</p>
      )}

      {/* ⚠️ Refus NOMMÉ : `search.status ===
          'refused'` et `search.refusal.vide` sont la SEULE source de ce
          texte — un par raison, jamais un pool recalculé pour deviner
          pourquoi. `'refused'` se traite ici comme `'error'` l'est
          juste au-dessus, à la place du lancement. */}
      {status === 'refused' && refusal && (
        <p className="text-xs text-bad">
          {pr.refus[refusal.vide]}
        </p>
      )}
    </>
  );
}
