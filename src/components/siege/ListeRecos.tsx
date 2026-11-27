// La liste des recommandations, à gauche de la vue Decks : une ligne par
// recommandation, qu'on touche pour l'ouvrir dans le volet de droite.
// docs/02-app/siege/feat-recommandations/rendu-de-la-page.md, « La vue Decks ».
//
// ⚠️ Chaque ligne dit d'un coup d'œil ce qu'il faut pour choisir : le nom, le
// nombre de decks (« N sur M » pendant une recherche), la provenance et l'état
// de son salon, « Importée », le bilan en miniature quand le compte est
// confronté, et un repère quand il y a des consignes générales.

import { useState } from 'react';
import { ChevronRight, Download, Hash, Smartphone, StickyNote } from 'lucide-react';
import type { Reco } from '../../types';
import type { RecoHit } from '../../lib/recoSearch';
import type { RecoMatch } from '../../lib/recoMatch';
import type { EtatAffiche } from '../../lib/provenancesRecos';
import { DEFENSES_PAR_PAGE, pageBornee, tranche } from '../../lib/pagesRecos';
import { useTraduction } from '../../hooks/useLangue';
import { ZoneCliquable } from '../../ui';
import { PastilleEtat } from './discord/Provenances';
import { BarrePages, BilanMini } from './RecoCard';

export default function ListeRecos({ liste, choisie, onChoisir, hitDe, matchOf, provenanceDe, rangDe }: {
  liste: Reco[];
  choisie: string | null;
  onChoisir: (id: string) => void;
  hitDe: (id: string) => RecoHit | undefined;
  matchOf: (reco: Reco) => RecoMatch | null;
  provenanceDe: (reco: Reco) => { nom: string; etat: EtatAffiche | null } | undefined;
  // Le rang de la recommandation dans la page, pour son nom par défaut.
  rangDe: (reco: Reco) => number;
}) {
  const textes = useTraduction();
  const r = textes.recos;
  const cr = textes.carteReco;
  // Une page de la liste à la fois : un compte peut suivre des dizaines de
  // salons.
  const [page, setPage] = useState(0);
  const pageAffichee = pageBornee(page, liste.length, DEFENSES_PAR_PAGE);
  const deLaPage = tranche(liste, page, DEFENSES_PAR_PAGE);
  const totalDecks = liste.reduce((n, x) => n + (hitDe(x.id)?.decks.length ?? x.decks.length), 0);

  return (
    <div data-liste-recos>
      <p className="mb-2 font-mono text-micro text-ink-dim">{r.resultatsDecks(liste.length, totalDecks)}</p>
      <BarrePages page={pageAffichee} n={liste.length} parPage={DEFENSES_PAR_PAGE} onChange={setPage} className="mb-2" />
      <div className="flex flex-col gap-1.5">
        {deLaPage.map((reco) => {
          const sel = reco.id === choisie;
          const hit = hitDe(reco.id);
          const prov = provenanceDe(reco);
          const match = matchOf(reco);
          return (
            <ZoneCliquable
              key={reco.id}
              onClick={() => onChoisir(reco.id)}
              aria-current={sel ? 'true' : undefined}
              title={cr.voirDecks(reco.decks.length)}
              className={`flex w-full min-w-0 flex-col gap-1.5 rounded-lg border px-2.5 py-2 text-left transition ${
                sel ? '@3xl:border-accent @3xl:bg-accent/[0.08] border-border-soft bg-panel' : 'border-border-soft bg-panel hoverable:border-border'
              }`}
              data-reco-liste
            >
              <span className="flex w-full min-w-0 items-center gap-2">
                <b className="min-w-0 truncate text-sm font-semibold text-ink">
                  {reco.name || textes.partage.reco.recommandation(rangDe(reco) + 1)}
                </b>
                <span className="ml-auto flex-none whitespace-nowrap font-mono text-micro text-ink-dim">
                  {hit ? cr.decksSur(hit.decks.length, reco.decks.length) : cr.decks(reco.decks.length)}
                </span>
                <ChevronRight size={15} className="flex-none text-ink-dim @3xl:hidden" aria-hidden />
              </span>
              {(prov || reco.origin === 'imported' || match || reco.note) && (
                <span className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  {prov && (
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5" data-provenance-liste>
                      <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-border-soft bg-panel2 px-2 py-0.5 label">
                        {reco.lien ? <Hash size={10} className="flex-none" /> : <Smartphone size={10} className="flex-none" />}
                        <span className="truncate">{prov.nom}</span>
                      </span>
                      {prov.etat && <PastilleEtat etat={prov.etat} />}
                    </span>
                  )}
                  {reco.origin === 'imported' && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-panel2 px-2 py-0.5 label" title={cr.importeeAide}>
                      <Download size={10} /> {cr.importee}
                    </span>
                  )}
                  {match && <BilanMini match={match} />}
                  {reco.note && <StickyNote size={12} className="flex-none text-star" aria-label={cr.consignesGenerales} />}
                </span>
              )}
            </ZoneCliquable>
          );
        })}
      </div>
    </div>
  );
}
