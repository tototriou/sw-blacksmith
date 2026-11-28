// La vue Défenses de la page Recommandations : à gauche chaque défense visée,
// toutes recommandations confondues ; à droite celle qu'on choisit, et les
// offenses qui la battent, rangées par recommandation ou par fiabilité.
// docs/02-app/siege/feat-recommandations/recherche-par-monstre.md, « La vue
// Défenses ».
//
// ⚠️ **Deux volets quand le CONTENEUR a la place, une liste puis un volet
// sinon** (`@container`, seuil `@3xl`) : la colonne des provenances prend déjà
// sa largeur à côté, et la place dépend de l'écran ET de la barre latérale.
// Étroit (téléphone, fenêtre étroite), toucher une défense ouvre son volet à
// la place de la liste, avec un retour.
//
// ⚠️ **Une offense s'y ouvre et s'y édite sur place**, avec les gestes d'une
// ligne de deck (`DeckBlock`, la même que dans la vue Decks) : il fallait repasser en vue
// Attaque, retrouver la carte puis le deck.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Hash, Pencil, Plus, Send, Smartphone, StickyNote } from 'lucide-react';
import type { Monster, Reco, RecoDeck } from '../../types';
import type { UseRecoState } from '../../hooks/useSiegeRecos';
import type { RecoMatch } from '../../lib/recoMatch';
import type { RecoHit, TriRecherche } from '../../lib/recoSearch';
import { cleEquipe, cleOffense, defensesDesRecos, ordonnerOffenses, type OffenseDesRecos } from '../../lib/recoDefenses';
import { decksModifies } from '../../lib/recoModifies';
import { DECKS_PAR_PAGE, DEFENSES_PAR_PAGE, pageBornee, pageDeLaPosition, tranche } from '../../lib/pagesRecos';
import { contenuDeck, memeContenu, type ContenuDeck } from '../../lib/annulerEdition';
import type { EtatAffiche } from '../../lib/provenancesRecos';
import { useTraduction } from '../../hooks/useLangue';
import { Bouton, BoutonIcone, Flottant, Segmented, ZoneCliquable } from '../../ui';
import type { ElementMenu } from '../../ui';
import { PastilleEtat } from './discord/Provenances';
import { EtoilesFiabilite } from './EtoilesFiabilite';
import { BarrePages, DeckBlock, MenuReco, MiniMonster, actionsMenuReco, defenseLabel, type OffenseChoice } from './RecoCard';
import AjoutCounter, { type EquipeChoix } from './AjoutCounter';

// La provenance « sans défense visée » : les decks qui n'en visent aucune
// restent atteignables (rien n'est caché en changeant de vue).
const SANS = '\0sans';
const TRIS: TriRecherche[] = ['ordre', 'fiabilite'];

export interface ActionsRecoVolet {
  onEditer: () => void;
  onExporter: () => void;
  onSupprimer: () => void;
  onDetacher?: () => void;
  publierDans?: { raison: string | null; onClick: () => void };
}

interface Props {
  recos: UseRecoState;
  // Les recommandations de la provenance, dans l'ordre de la page ; pendant
  // une recherche, celles qui répondent.
  liste: Reco[];
  // La recherche en cours (mode défense), `null` sans recherche.
  hits: RecoHit[] | null;
  // Les monstres cherchés, pour surligner leurs portraits.
  termes: string[];
  monsters: Monster[];
  monsterByCom2us: Map<number, Monster>;
  // « Depuis mes decks » de la fenêtre d'ajout : les équipes d'offense, et
  // l'index des monstres par id local qui les résout.
  monsterById: Map<string, Monster>;
  offenseTeams: OffenseChoice[];
  equipesChoix: EquipeChoix[];
  matchOf: (reco: Reco) => RecoMatch | null;
  // Pourquoi un deck ne part pas dans l'Optimizer, calculé à la lecture.
  raisonExportDe: (deck: RecoDeck) => string | undefined;
  onExporterDeckOptimizer: (deck: RecoDeck) => void;
  tri: TriRecherche;
  onTri: (tri: TriRecherche) => void;
  provenanceDe: (reco: Reco) => { nom: string; etat: EtatAffiche | null } | undefined;
  actionsReco: (reco: Reco) => ActionsRecoVolet;
}

export default function VoletDefenses({
  recos, liste, hits, termes, monsters, monsterByCom2us, monsterById, offenseTeams, equipesChoix, matchOf, raisonExportDe, onExporterDeckOptimizer,
  tri, onTri, provenanceDe, actionsReco,
}: Props) {
  const textes = useTraduction();
  const r = textes.recos;
  const cr = textes.carteReco;

  // ── Les défenses ────────────────────────────────────────────────────────
  // Pendant une recherche, seules les défenses qui réunissent les monstres
  // cherchés (`hits`, mode défense).
  const agg = useMemo(() => {
    const parReco = hits ? new Map(hits.map((h) => [h.reco.id, h])) : null;
    return defensesDesRecos(liste, monsterByCom2us, parReco
      ? (reco, di, ci) => ci != null && !!parReco.get(reco.id)?.decks.find((d) => d.deckIndex === di)?.counters.includes(ci)
      : undefined);
  }, [liste, hits, monsterByCom2us]);
  const recoDe = useMemo(() => new Map(liste.map((x, i) => [x.id, { reco: x, rang: i }])), [liste]);
  const cles = useMemo(
    () => [...agg.defenses.map((d) => d.cle), ...(agg.sansDefense.length ? [SANS] : [])],
    [agg],
  );
  const totalOffenses = agg.defenses.reduce((n, d) => n + d.offenses.length, 0);

  const [choix, setChoix] = useState<string | null>(null);
  // Étroit : la liste, ou le volet de la défense touchée.
  const [detail, setDetail] = useState(false);
  const choisie = choix != null && cles.includes(choix) ? choix : cles[0] ?? null;
  const defense = choisie && choisie !== SANS ? agg.defenses.find((d) => d.cle === choisie) ?? null : null;

  const [pageListe, setPageListe] = useState(0);
  const [pageVolet, setPageVolet] = useState(0);
  const cleRecherche = termes.join('\0');
  useEffect(() => {
    setPageListe(0);
    setDetail(false);
  }, [cleRecherche]);
  useEffect(() => setPageVolet(0), [choisie, tri]);

  // ── L'offense ouverte, l'offense en édition ─────────────────────────────
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const [edition, setEdition] = useState<{ cle: string; recoId: string; deckIndex: number; avant: ContenuDeck } | null>(null);
  const basculer = (cle: string) => setOuverts((s) => {
    const n = new Set(s);
    if (!n.delete(cle)) n.add(cle);
    return n;
  });

  // Les offenses de la défense choisie ; celle qu'on édite reste là même si
  // l'édition lui fait quitter cette défense (un clic ne déplace jamais ce
  // qu'on vient de cliquer).
  const offensesBrutes: OffenseDesRecos[] = useMemo(() => {
    const base: OffenseDesRecos[] = choisie === SANS
      ? agg.sansDefense.map((s) => ({ ...s, counterIndex: -1, note: '' }))
      : defense?.offenses ?? [];
    if (edition && !base.some((o) => cleOffense(o) === edition.cle) && recoDe.has(edition.recoId)) {
      return [...base, { recoId: edition.recoId, deckIndex: edition.deckIndex, counterIndex: -1, note: '' }];
    }
    return base;
  }, [choisie, agg, defense, edition, recoDe]);

  // ⚠️ L'ordre est pris au choix de la défense, du rangement ou de la
  // recherche, puis TENU : noter un deck pendant qu'on l'édite le déplaçait
  // sous le clic. `ordonnerOffenses` remet ce qui est nouveau à la fin.
  const cleOrdre = JSON.stringify([choisie, tri, cleRecherche]);
  const ordreFige = useRef<{ cle: string; ordre: string[] } | null>(null);
  const offenses = useMemo(() => {
    if (ordreFige.current?.cle === cleOrdre) return ordonnerOffenses(offensesBrutes, tri, ordreFige.current.ordre);
    const o = ordonnerOffenses(offensesBrutes, tri);
    ordreFige.current = { cle: cleOrdre, ordre: o.map(cleOffense) };
    return o;
  }, [offensesBrutes, tri, cleOrdre]);
  const pageVoletBornee = pageBornee(pageVolet, offenses.length, DECKS_PAR_PAGE);
  const offensesDeLaPage = tranche(offenses, pageVolet, DECKS_PAR_PAGE);
  const pageListeBornee = pageBornee(pageListe, cles.length, DEFENSES_PAR_PAGE);
  const clesDeLaPage = tranche(cles, pageListe, DEFENSES_PAR_PAGE);

  // Par reco : les offenses de la page en bandes, une par recommandation (les
  // decks sans défense aussi : ils n'ont pas de fiabilité à trier). Par
  // fiabilité : une liste à plat, la recommandation en étiquette de ligne.
  const parReco = tri === 'ordre' || !defense;
  const groupes = useMemo(() => {
    const g: { recoId: string; offenses: OffenseDesRecos[] }[] = [];
    for (const o of offensesDeLaPage) {
      const dernier = g[g.length - 1];
      if (parReco && dernier?.recoId === o.recoId) dernier.offenses.push(o);
      else g.push({ recoId: o.recoId, offenses: [o] });
    }
    return g;
  }, [offensesDeLaPage, parReco]);
  const nombreDansDefense = (recoId: string) => offenses.filter((o) => o.recoId === recoId).length;

  // L'offense en édition est toujours à l'écran : sa page s'ouvre (un counter
  // ajouté arrive en fin de liste). ⚠️ Déclaré APRÈS le retour à la première
  // page : il passe en dernier.
  const posEdition = edition ? offenses.findIndex((o) => cleOffense(o) === edition.cle) : -1;
  useEffect(() => {
    if (posEdition >= 0) setPageVolet(pageDeLaPosition(posEdition, DECKS_PAR_PAGE));
  }, [edition?.cle, posEdition]);

  const volet = useRef<HTMLDivElement>(null);
  // Un counter ajouté vient à l'écran une fois rendu, sur sa page.
  const aMontrer = useRef(false);
  useEffect(() => {
    if (!aMontrer.current) return;
    const el = volet.current?.querySelector('[data-deck-ligne][data-edition]');
    if (el) {
      aMontrer.current = false;
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });

  // ── « + Ajouter un counter » ────────────────────────────────────────────
  // La fenêtre d'ajout (AjoutCounter.tsx) : capture, mes decks ou deck vide,
  // dans une recommandation qui vise déjà CETTE défense. Le deck la vise
  // d'office ; il s'ouvre en édition — sans passer par la vue Decks ni par
  // l'édition de la recommandation.
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const recosDeLaDefense = useMemo(
    () => (defense ? [...new Set(defense.offenses.map((o) => o.recoId))] : []),
    [defense],
  );
  const ajouterCounter = (recoId: string, deck: RecoDeck) => {
    const entree = recoDe.get(recoId);
    if (!defense || !entree) return;
    const deckIndex = entree.reco.decks.length;
    recos.addDeckWith(recoId, deck);
    const cle = cleOffense({ recoId, deckIndex });
    // La défense de la capture a été préférée à celle qu'on regarde : le
    // volet passe sur elle, où le deck ajouté se trouve.
    const autre = deck.counters[0] ? cleEquipe(deck.counters[0].monsters, monsterByCom2us) : null;
    if (autre && autre !== defense.cle) {
      setChoix(autre);
      setEdition({ cle, recoId, deckIndex, avant: contenuDeck(deck) });
      aMontrer.current = true;
      return;
    }
    // Rangé par reco : il prend place après les autres offenses de SA
    // recommandation, sinon (ordre tenu) il ouvrirait un second bandeau à la
    // fin. Par fiabilité, un deck non noté va de toute façon à la fin.
    const fige = ordreFige.current;
    if (fige && tri === 'ordre') {
      const derniere = fige.ordre.map((c) => c.slice(0, c.lastIndexOf(':')) === recoId).lastIndexOf(true);
      fige.ordre.splice(derniere >= 0 ? derniere + 1 : fige.ordre.length, 0, cle);
    }
    setEdition({ cle, recoId, deckIndex, avant: contenuDeck(deck) });
    aMontrer.current = true;
  };
  const nomReco = (recoId: string) => {
    const entree = recoDe.get(recoId);
    return entree ? entree.reco.name || textes.partage.reco.recommandation(entree.rang + 1) : '';
  };
  const choisir = (cle: string) => {
    setChoix(cle);
    setDetail(true);
    // Étroit, le volet remplace la liste : on remonte à son début.
    requestAnimationFrame(() => {
      const el = volet.current;
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
    });
  };

  // ⚠️ Aucun portrait surligné : pendant une recherche, chaque défense de la
  // liste réunit déjà les monstres cherchés.
  const trio = (monstres: { com2usId: number | null; name: string }[], taille: number) => (
    // `pr-1` sur chaque portrait : son icône d'élément dépasse de 4 px à
    // droite, la place entre dans sa boîte (aucune icône ne chevauche sa
    // voisine) — comme dans la ligne d'un deck.
    <span className="flex flex-none items-center gap-1">
      {monstres.map((m, i) => {
        const mon = m.com2usId != null ? monsterByCom2us.get(m.com2usId) ?? null : null;
        return (
          <span key={i} className="flex flex-none items-center pr-1" title={mon?.name ?? m.name}>
            <MiniMonster monster={mon} fallback={m.name} size={taille} lead={i === 0 ? mon?.leaderSkill ?? null : null} />
          </span>
        );
      })}
    </span>
  );

  if (cles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-panel/40 px-6 py-8 text-center" data-volet-vide>
        <p className="text-sm text-ink-dim">{r.aucuneDefense}</p>
      </div>
    );
  }

  // ── Une offense ─────────────────────────────────────────────────────────
  const ligne = (o: OffenseDesRecos, avecReco: boolean) => {
    const entree = recoDe.get(o.recoId);
    const deck = entree?.reco.decks[o.deckIndex];
    if (!entree || !deck) return null;
    const { reco } = entree;
    const cle = cleOffense(o);
    const enEdition = edition?.cle === cle;
    const ouvert = enEdition || ouverts.has(cle);
    const annulable = enEdition && !memeContenu(contenuDeck(deck), edition!.avant);
    // La même ligne que dans la vue Decks ; `contre` y remplace la défense
    // battue par la fiabilité et la précision contre CELLE-CI.
    // ⚠️ Sans enveloppe : le filet entre deux lignes est leur `border-t`,
    // retiré sur la première de son groupe (`first:`).
    return (
        <DeckBlock
          key={cle}
          raisonExportOptimizer={raisonExportDe(deck)}
          onExporterOptimizer={() => onExporterDeckOptimizer(deck)}
          reco={reco}
          deck={deck}
          deckIndex={o.deckIndex}
          monsters={monsters}
          monsterByCom2us={monsterByCom2us}
          match={matchOf(reco)?.decks[o.deckIndex] ?? null}
          contre={{
            vise: o.counterIndex >= 0,
            counterIndex: o.counterIndex,
            fiabilite: o.fiabilite,
            note: o.note,
            reco: avecReco ? reco.name || textes.partage.reco.recommandation(entree.rang + 1) : undefined,
          }}
          editing={enEdition}
          onToggleEdit={() => setEdition(enEdition ? null : { cle, recoId: reco.id, deckIndex: o.deckIndex, avant: contenuDeck(deck) })}
          onAnnulerEdition={() => {
            if (edition) recos.remettreContenuDeck(edition.recoId, edition.deckIndex, edition.avant);
            setEdition(null);
          }}
          annulable={annulable}
          folded={!ouvert}
          onToggleFold={() => basculer(cle)}
          hit={o.counterIndex >= 0 ? { deckIndex: o.deckIndex, slots: [], counters: [o.counterIndex] } : null}
          recos={recos}
          onSupprime={() => setEdition(null)}
          modifie={decksModifies(reco).has(o.deckIndex)}
        />
    );
  };

  // ── Le bandeau d'une recommandation ─────────────────────────────────────
  const bandeau = (recoId: string) => {
    const entree = recoDe.get(recoId);
    if (!entree) return null;
    const { reco, rang } = entree;
    const prov = provenanceDe(reco);
    const a = actionsReco(reco);
    const avant: ElementMenu[] = [
      ...(a.publierDans ? [{
        cle: 'publier', libelle: textes.recosDiscord.publierDans, icone: <Send size={14} />,
        disabled: !!a.publierDans.raison, title: a.publierDans.raison ?? undefined, onClick: a.publierDans.onClick,
      }] : []),
      { cle: 'editer', libelle: cr.editer, icone: <Pencil size={14} />, onClick: a.onEditer },
    ];
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-soft bg-panel2/60 px-3 py-2 first:border-t-0" data-groupe-reco>
        <div className="flex min-w-0 flex-1 basis-[200px] flex-col gap-0.5">
          <b className="truncate text-sm text-ink">{reco.name || textes.partage.reco.recommandation(rang + 1)}</b>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-ink-dim">
            {prov && (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-panel2 px-2 py-0.5 label">
                  {reco.lien ? <Hash size={10} /> : <Smartphone size={10} />} {prov.nom}
                </span>
                {prov.etat && <PastilleEtat etat={prov.etat} />}
              </span>
            )}
            {reco.author && <span>{textes.vueAmi.par(reco.author)} ·</span>}
            <span className="font-mono">{r.decksIci(nombreDansDefense(recoId), reco.decks.length)}</span>
          </span>
        </div>
        {reco.note && <Consignes note={reco.note} />}
        <MenuReco
          libelle={cr.plusActions}
          grand
          elements={actionsMenuReco({ cr, td: textes.recosDiscord, onExport: a.onExporter, onDetacher: a.onDetacher, onSupprimer: a.onSupprimer, avant })}
        />
      </div>
    );
  };

  const recosVisees = defense ? defense.recos : new Set(agg.sansDefense.map((s) => s.recoId)).size;

  return (
    <div className="@container" data-volet-defenses>
      <div className="flex flex-col gap-4 @3xl:grid @3xl:grid-cols-[minmax(250px,300px)_minmax(0,1fr)] @3xl:items-start">
        {/* La liste des défenses. Étroit : cachée pendant qu'un volet est ouvert. */}
        <div className={`min-w-0 ${detail ? 'hidden @3xl:block' : ''}`} data-liste-defenses>
          <p className="mb-2 text-micro text-ink-dim">
            {r.defensesVisees(agg.defenses.length, totalOffenses)}
            {agg.defenses.length > 1 && <span className="text-ink-dimmer"> · {r.plusJouees}</span>}
          </p>
          <BarrePages page={pageListeBornee} n={cles.length} parPage={DEFENSES_PAR_PAGE} onChange={setPageListe} className="mb-2" />
          <div className="flex flex-col gap-1.5">
            {clesDeLaPage.map((cle) => {
              const sel = cle === choisie;
              const d = cle === SANS ? null : agg.defenses.find((x) => x.cle === cle)!;
              return (
                <ZoneCliquable
                  key={cle}
                  onClick={() => choisir(cle)}
                  aria-current={sel ? 'true' : undefined}
                  title={r.voirDefense}
                  className={`flex w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                    sel ? '@3xl:border-accent @3xl:bg-accent/[0.08] border-border-soft bg-panel' : 'border-border-soft bg-panel hoverable:border-border'
                  }`}
                  data-defense-liste
                >
                  {d ? trio(d.monsters, 30) : (
                    <span className="min-w-0 truncate text-xs text-ink-dim">{r.sansDefenseVisee}</span>
                  )}
                  <span className="ml-auto flex flex-none flex-col items-end gap-0.5">
                    {d?.meilleure !== undefined && <EtoilesFiabilite note={d.meilleure} taille={11} />}
                    <span className="whitespace-nowrap font-mono text-micro text-ink-dim">
                      {d ? r.offensesEtRecos(d.offenses.length, d.recos) : cr.decks(agg.sansDefense.length)}
                    </span>
                  </span>
                  <ChevronRight size={15} className="flex-none text-ink-dim @3xl:hidden" aria-hidden />
                </ZoneCliquable>
              );
            })}
          </div>
        </div>

        {/* Le volet de la défense choisie. Étroit : seulement quand on en a
            touché une. ⚠️ Pas d'`overflow-hidden` : les menus ⋯ des bandeaux
            s'ouvrent par-dessus. */}
        <div ref={volet} className={`min-w-0 rounded-xl border border-border-soft bg-panel ${detail ? '' : 'hidden @3xl:block'}`} data-volet-defense>
          <div className="flex flex-wrap items-center gap-3 border-b border-border-soft px-3 py-3">
            <BoutonIcone
              onClick={() => setDetail(false)}
              icone={<ArrowLeft size={16} />}
              libelle={r.toutesLesDefenses}
              className="@3xl:hidden"
            />
            {defense ? trio(defense.monsters, 44) : null}
            <div className="flex min-w-0 flex-1 basis-[140px] flex-col gap-0.5">
              <b className="truncate text-sm text-ink">
                {defense ? defenseLabel(defense.monsters, monsterByCom2us) : r.sansDefenseVisee}
              </b>
              <span className="text-micro text-ink-dim">
                {defense ? r.offensesEtRecommandations(defense.offenses.length, recosVisees) : r.sansDefenseDecks(agg.sansDefense.length)}
              </span>
            </div>
            {/* Le rangement des offenses, là où il agit. Étroit : sur sa
                propre rangée, il garde ses crans sur une ligne. */}
            {defense && (
              <div className="flex w-full items-center @3xl:w-auto @3xl:flex-none" title={r.rangement}>
                <Segmented
                  value={tri}
                  onChange={onTri}
                  options={TRIS.map((key) => ({ key, label: r.tris[key].label, hint: r.tris[key].hint }))}
                />
              </div>
            )}
          </div>
          {/* La pagination et « + Ajouter un counter », sur une rangée au-dessus
              des offenses, comme dans la vue Decks : le « + » ouvre la fenêtre
              d'ajout, qui demande la recommandation quand plusieurs visent la
              défense. ⚠️ Toujours là ; sans défense choisie, désactivé et il
              dit pourquoi. Au bout à droite, il ne bouge pas quand la
              pagination apparaît à sa gauche. */}
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 border-b border-border-soft px-3 py-1.5">
            <BarrePages page={pageVoletBornee} n={offenses.length} parPage={DECKS_PAR_PAGE} onChange={setPageVolet} className="mr-auto" />
            <Bouton
              onClick={() => setAjoutOuvert(true)}
              disabled={!defense}
              trait="pointille"
              taille="sm"
              icone={<Plus size={14} />}
              libelle={cr.ajouterCounter}
              title={defense ? r.ajouterCounterDefense : r.ajouterCounterSansDefense}
              className="lg:h-7"
              data-ajouter-counter
            />
          </div>
          {ajoutOuvert && defense && (
            <AjoutCounter
              recos={recosDeLaDefense.map((id) => ({ id, nom: nomReco(id) }))}
              defenseVisee={defense.monsters}
              offenseTeams={offenseTeams}
              equipes={equipesChoix}
              monsters={monsters}
              monsterById={monsterById}
              monsterByCom2us={monsterByCom2us}
              onAjouter={ajouterCounter}
              onClose={() => setAjoutOuvert(false)}
            />
          )}
          <div className="pb-1">
            {groupes.map((g) => (
              <div key={`${g.recoId}:${g.offenses[0] ? cleOffense(g.offenses[0]) : ''}`} className="border-t border-border-soft first:border-t-0">
                {parReco && bandeau(g.recoId)}
                {g.offenses.map((o) => ligne(o, !parReco))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Les consignes générales d'une recommandation, en bulle depuis son bandeau :
// elles se lisent sans quitter la défense.
function Consignes({ note }: { note: string }) {
  const textes = useTraduction();
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('pointerdown', dehors);
    return () => document.removeEventListener('pointerdown', dehors);
  }, [ouvert]);
  return (
    <div ref={racine} className="relative flex-none">
      <Bouton
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        fond="vide"
        trait="aucun"
        taille="sm"
        icone={<StickyNote size={13} className="text-star" />}
        libelle={textes.carteReco.consignes}
        title={textes.recos.voirConsignes}
        className="lg:h-7"
      />
      {ouvert && (
        <Flottant largeur="w-max max-w-[320px]" rembourrage="sm" cote="droite">
          <span className="label mb-1 block">{textes.carteReco.consignesGenerales}</span>
          <p className="whitespace-pre-line text-xs leading-relaxed text-ink">{note}</p>
        </Flottant>
      )}
    </div>
  );
}
