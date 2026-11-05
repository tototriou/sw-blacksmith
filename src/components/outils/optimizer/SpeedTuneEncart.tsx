// L'encart « Speed tune » d'un membre contraint, dans ses conditions
// (feat-contrainte-speed-tune.md, « Écran ») : la zone en clair, les autres
// lignes et leurs écarts, le verdict d'équipe, et les gestes Détacher,
// Rattacher, Recalculer et Restaurer. Le même contenu dans les deux formats :
// il suit la grille des conditions qui le porte.
import { Bouton } from '../../../ui';
import { useLangue, useTraduction } from '../../../hooks/useLangue';
import { formatNombre } from '../../../i18n/format';
import type { Dictionnaire } from '../../../i18n/fr';
import { litOccurrence, type ProblemeOrdre } from '../../../lib/speedTune';
import type { Bestiaire } from '../../../lib/planSpeedTune';
import { ligneModifiee, plagesAffichees, type EcartLigne, type VerdictEquipe } from '../../../lib/speedTuneMembre';
import type { SpeedTuneDuMembre } from '../../../hooks/useSpeedTuneMembre';
import type { DonneesKit } from '../../../lib/speedTuneAuto';
import { autresPour } from '../../../lib/speedTuneMembre';

// Le défaut d'un allié dans les mots de l'écran du speed tuning.
export function phraseProbleme(p: ProblemeOrdre, t: Dictionnaire): string {
  const a = t.speedTuning.analyse;
  const { n } = litOccurrence(p.id);
  if (p.raison === 'nagit-pas') return n > 1 ? a.neJouePas(n) : a.nAgitPas;
  if (p.raison === 'apres-adverse') return a.seFaitCouper;
  return p.raison === 'trop-tot' ? a.tropRapide : a.tropLent;
}

export function VerdictSpeedTune({ verdict, nom }: { verdict: VerdictEquipe | null; nom: (uid: string) => string }) {
  const t = useTraduction();
  const s = t.optimizer.speedTune;
  if (!verdict) return <p className="text-xs text-ink-dim">{s.verdictCalcul}</p>;
  if (verdict.etat === 'tenu') return <p className="text-xs font-semibold text-good">{s.verdictTenu}</p>;
  if (verdict.etat === 'incomplet') return <p className="text-xs text-ink-dim">{s.verdictIncomplet(verdict.lignes.map(nom).join(', '))}</p>;
  const raison = verdict.cumuls.length
    ? s.cumulsNonTenus(verdict.cumuls.map(nom).join(', '))
    : verdict.probleme ? `${nom(litOccurrence(verdict.probleme.id).id)} ${phraseProbleme(verdict.probleme, t)}` : s.ordreCasse;
  return <p className="text-xs font-semibold text-bad">{s.verdictCasse(raison)}</p>;
}

export default function SpeedTuneEncart({ m, monstres, donnees, zoneChangee = false }: {
  m: SpeedTuneDuMembre & { detacher: () => void; rattacher: () => void; recalculer: (e: readonly EcartLigne[]) => void; restaurer: (uid: string) => void };
  monstres: Bestiaire;
  donnees: DonneesKit | null;
  // Les résultats affichés viennent d'une autre zone que l'actuelle.
  zoneChangee?: boolean;
}) {
  const t = useTraduction();
  const langue = useLangue();
  const s = t.optimizer.speedTune;
  const n = (v: number | null) => (v == null ? '—' : formatNombre(v, langue));
  const nom = (uid: string) => {
    const l = m.plan?.lignes.find((x) => x.uid === uid);
    return (l && monstres.get(l.monsterId)?.name) ?? uid;
  };
  const plage = (a: number, b: number) => (a === b ? n(a) : s.plage(n(a), n(b)));
  return (
    <section aria-label={s.titre} className="mt-3 border-t border-border-soft pt-3">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
        <p className="label">{s.titre}</p>
        {m.lien.attache
          ? <Bouton fond="vide" taille="sm" onClick={m.detacher} libelle={s.detacher} />
          : m.plan && <Bouton fond="vide" taille="sm" onClick={m.rattacher} libelle={s.rattacher} />}
      </div>
      {!m.plan ? (
        <p className="text-xs text-bad">{s.planPerdu}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <VerdictSpeedTune verdict={m.verdict} nom={nom} />
          {zoneChangee && <p className="text-xs text-ink-dim">{s.zoneChangee}</p>}
          {!m.lien.attache ? (
            <p className="text-xs text-ink-dim">{s.detache}</p>
          ) : m.zone.etat === 'kits' ? (
            <p className="text-xs text-ink-dim">{s.kitsEnCours}</p>
          ) : m.zone.etat === 'calcul' ? (
            <p className="text-xs text-ink-dim">{s.zoneEnCours}</p>
          ) : m.zone.etat === 'prete' && (!m.zone.contrainte || !m.zone.contrainte.zone.parSwift.some((z) => z.classes.some((c) => c.intervalles.length))) ? (
            <p className="text-xs text-bad">{s.zoneVide}</p>
          ) : m.zone.etat === 'prete' && m.zone.contrainte && donnees ? (
            <div>
              <p className="text-micro text-ink-dim mb-1">{s.zoneTitre}</p>
              <ul className="flex flex-col gap-0.5">
                {plagesAffichees(m.plan, donnees, monstres, m.zone.contrainte.zone, autresPour(m.lignes, m.lien.uid)).map((p, i) => (
                  <li key={i} className="text-xs text-ink">
                    {s.ligneZone(plage(p.combatMin ?? 0, p.combatMax ?? 0), plage(p.ficheMin, p.ficheMax),
                      p.arteMax === 0 ? s.sansArtefact : plage(p.arteMin, p.arteMax), p.swift ? t.jeu.sets.swift : null)}
                  </li>
                ))}
              </ul>
              {!m.zone.contrainte.setsAdmis.length && <p className="text-xs text-bad">{s.setsImpossibles}</p>}
            </div>
          ) : null}
          <div>
            <p className="text-micro text-ink-dim mb-1">{s.autresLignes}</p>
            <ul className="flex flex-col gap-1">
              {m.lignes.filter((l) => l.uid !== m.lien.uid).map((l) => {
                const e = m.ecarts.find((x) => x.uid === l.uid);
                return (
                  <li key={l.uid} className="text-xs text-ink">
                    <span>{nom(l.uid)} · {s.origines[l.origine]}</span>
                    {m.plan && ligneModifiee(m.plan, l.uid) && (
                      <span className="ml-1 text-ink-dim">· {s.modifiee}{' '}
                        <Bouton fond="vide" trait="aucun" taille="sm" onClick={() => m.restaurer(l.uid)} libelle={s.restaurer} />
                      </span>
                    )}
                    {e && <Ecart e={e} nom={nom(l.uid)} n={n} onRecalculer={() => m.recalculer([e])} />}
                  </li>
                );
              })}
            </ul>
            {(() => {
              // « Restaurer » reste offert après un recalcul qui a fait disparaître l'écart.
              const propre = m.ecarts.find((x) => x.uid === m.lien.uid);
              const modifiee = !!m.plan && ligneModifiee(m.plan, m.lien.uid);
              return (propre || modifiee) && (
                <div className="mt-1 text-xs text-ink">
                  {propre && <Ecart e={propre} nom={nom(propre.uid)} n={n} onRecalculer={() => m.recalculer([propre])} />}
                  {modifiee && (
                    <span className="text-ink-dim">{nom(m.lien.uid)} · {s.modifiee}{' '}
                      <Bouton fond="vide" trait="aucun" taille="sm" onClick={() => m.restaurer(m.lien.uid)} libelle={s.restaurer} />
                    </span>
                  )}
                </div>
              );
            })()}
            {m.ecarts.length > 1 && (
              <Bouton className="mt-1.5" fond="vide" taille="sm" onClick={() => m.recalculer(m.ecarts)} libelle={s.recalculerTout} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Ecart({ e, nom, n, onRecalculer }: { e: EcartLigne; nom: string; n: (v: number | null) => string; onRecalculer: () => void }) {
  const s = useTraduction().optimizer.speedTune;
  return (
    <div className="flex items-center gap-1.5 flex-wrap text-ink-dim">
      <span>{s.ecart(nom, n(e.combatPlan), n(e.combatOptimizer), e.source === 'build' ? s.sourceBuild : s.sourceEquipement)}</span>
      {e.artePlan !== e.arteOptimizer && <span>{s.ecartArte(n(e.artePlan), n(e.arteOptimizer))}</span>}
      <Bouton fond="vide" trait="aucun" taille="sm" onClick={onRecalculer} libelle={s.recalculer(n(e.combatOptimizer))} />
    </div>
  );
}
