// L'encart « Speed tune » d'un membre contraint, dans ses conditions
// (feat-contrainte-speed-tune.md, « Écran ») : la zone en clair, les autres
// lignes et leurs écarts, le verdict d'équipe, et les gestes Détacher,
// Rattacher, Recalculer et Restaurer. Le même contenu dans les deux formats :
// il suit la grille des conditions qui le porte.
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Bouton, ZoneCliquable } from '../../../ui';
import { useLangue, useTraduction } from '../../../hooks/useLangue';
import { formatNombre } from '../../../i18n/format';
import type { Dictionnaire } from '../../../i18n/fr';
import { litOccurrence, type ProblemeOrdre } from '../../../lib/speedTune';
import type { Bestiaire } from '../../../lib/planSpeedTune';
import { ligneModifiee, plagesAffichees, type EcartLigne, type VerdictEquipe } from '../../../lib/speedTuneMembre';
import type { SpeedTuneDuMembre } from '../../../hooks/useSpeedTuneMembre';
import type { DonneesKit } from '../../../lib/speedTuneAuto';
import { autresPour } from '../../../lib/speedTuneMembre';
import { artifactSubName } from '../../../lib/effects';
import { CODE_AMPLI_VIT } from '../../../lib/damage';

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

export default function SpeedTuneEncart({ m, monstres, donnees, zoneChangee = false, onModifier }: {
  m: SpeedTuneDuMembre & { detacher: () => void; rattacher: () => void; recalculer: (e: readonly EcartLigne[]) => void; restaurer: (uid: string) => void };
  monstres: Bestiaire;
  donnees: DonneesKit | null;
  // Les résultats affichés viennent d'une autre zone que l'actuelle.
  zoneChangee?: boolean;
  // Ouvre l'outil de speed tuning sur l'équipe du membre.
  onModifier?: () => void;
}) {
  const t = useTraduction();
  const langue = useLangue();
  const s = t.optimizer.speedTune;
  // Déplié par défaut : la zone est la raison d'être de l'encart.
  const [zoneOuverte, setZoneOuverte] = useState(true);
  const n = (v: number | null) => (v == null ? '—' : formatNombre(v, langue));
  const nom = (uid: string) => {
    const l = m.plan?.lignes.find((x) => x.uid === uid);
    return (l && monstres.get(l.monsterId)?.name) ?? uid;
  };
  const plage = (a: number, b: number) => (a === b ? n(a) : s.plage(n(a), n(b)));
  return (
    <section aria-label={s.titre} className="mt-3 border-t border-border-soft pt-3">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
        <p className="label">{s.titreMembre(nom(m.lien.uid))}</p>
        <span className="flex flex-wrap items-center gap-1">
          {onModifier && <Bouton fond="vide" taille="sm" onClick={onModifier} libelle={s.modifier} />}
          {m.lien.attache
            ? <Bouton fond="vide" taille="sm" onClick={m.detacher} libelle={s.detacher} />
            : m.plan && <Bouton fond="vide" taille="sm" onClick={m.rattacher} libelle={s.rattacher} />}
        </span>
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
              {/* Le titre replie le tableau ; il reste en place, seul ce qui
                  suit bouge. */}
              <ZoneCliquable onClick={() => setZoneOuverte((v) => !v)} aria-expanded={zoneOuverte}
                className="mb-1 flex w-full items-center gap-2 text-left">
                <span className="min-w-0 flex-1 text-micro text-ink-dim">{s.zoneTitre(nom(m.lien.uid))}</span>
                <ChevronDown size={13} className={`flex-none text-ink-dim transition-transform ${zoneOuverte ? 'rotate-180' : ''}`} />
              </ZoneCliquable>
              {/* Une ligne par classe d'artéfact et état de Rapidité ; les
                  titres passent sur deux lignes plutôt que d'élargir la carte. */}
              {zoneOuverte && <table className="w-full table-fixed border-collapse text-xs [font-variant-numeric:tabular-nums]">
                <thead>
                  <tr className="border-b border-border-soft text-ink-dim">
                    {[s.colonnes.combat, s.colonnes.totale, artifactSubName(CODE_AMPLI_VIT, t.jeu), s.colonnes.swift(t.jeu.sets.swift)].map((c) => (
                      <th key={c} scope="col" className="px-1 pb-1 text-left align-bottom text-micro font-semibold leading-tight">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plagesAffichees(m.plan, donnees, monstres, m.zone.contrainte.zone, autresPour(m.lignes, m.lien.uid)).map((p, i) => (
                    <tr key={i} className="border-b border-border-soft last:border-b-0 text-ink">
                      <td className="px-1 py-0.5">{plage(p.combatMin ?? 0, p.combatMax ?? 0)}</td>
                      <td className="px-1 py-0.5">{plage(p.ficheMin, p.ficheMax)}</td>
                      <td className="px-1 py-0.5">{plage(p.arteMin, p.arteMax)}</td>
                      <td className="px-1 py-0.5">{p.swift ? s.oui : s.non}</td>
                    </tr>
                  ))}
                </tbody>
              </table>}
              {!m.zone.contrainte.setsAdmis.length && <p className="text-xs text-bad">{s.setsImpossibles}</p>}
            </div>
          ) : null}
          <div>
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
