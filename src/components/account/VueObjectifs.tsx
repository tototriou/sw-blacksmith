import { CSSProperties, ReactNode, useMemo } from 'react';
import { Settings } from 'lucide-react';
import { ArtifactDetail, RuneDetail } from '../../types';
import {
  BlocProfondeur,
  COLONNES_ARTEFACT,
  FiltrePrincipale,
  LigneArtefact,
  LigneProfondeur,
  Niveau,
  Potentiel,
  SorteArtefact,
  TableauProfondeur,
  mesurerRunes,
  niveauCase,
  niveauScore,
  profondeurArtefacts,
  profondeurPalier,
  profondeurVitesse,
} from '../../lib/objectifsCompte';
import { ARTIFACT_MAIN, runeSetIconFilter, splitArtifactSub } from '../../lib/effects';
import { useObjectifsCompte } from '../../hooks/useObjectifsCompte';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import { formatNombre } from '../../i18n/format';
import type { Dictionnaire } from '../../i18n';
import { nomArchetype, nomElement, nomSet } from '../../i18n/jeu';
import { Bouton } from '../../ui';
import RuneIcon from '../RuneIcon';

// Vue « Objectifs » de Mon compte › Runes et › Artéfacts : le compte face aux
// objectifs réglés dans Paramètres › Objectifs. Rendu seul ; tout le calcul est
// dans src/lib/objectifsCompte.ts. Voir docs/02-app/compte/feat-objectifs.md.
//
// Deux temps :
//  - le RÉSUMÉ : une carte par bloc (chaque palier, la vitesse, les
//    artéfacts), son score et une barre qui se remplit à la couleur de son
//    niveau, raccourci vers sa section ; puis, pour les runes, le score de
//    chaque set dans chaque bloc ;
//  - les SECTIONS, une par bloc, toutes affichées : le score par emplacement,
//    puis une fiche par set (ou par élément, par style) — un histogramme de ses
//    emplacements, chaque colonne remplie vers l'objectif tracé en pointillés,
//    et sous chaque colonne ses chiffres (seuil, visé, max héroïque ou la plus
//    rapide, Intangibles).

// ⚠️ Classes ÉCRITES EN ENTIER : Tailwind n'émet que ce qu'il lit dans le
// source, une classe assemblée (`bg-niveau-${n}`) ne serait jamais produite.
const FOND: Record<Niveau, string> = {
  0: 'bg-niveau-0',
  1: 'bg-niveau-1',
  2: 'bg-niveau-2',
  3: 'bg-niveau-3',
  4: 'bg-niveau-4',
};
// ⚠️ Les niveaux ne s'écrivent qu'en APLAT, jamais en couleur de texte : ce
// sont des pastels, les mêmes dans les deux thèmes, illisibles sur le fond clair.
const aplat = (n: Niveau | null) => (n === null ? 'bg-panel2 text-ink-dim' : `${FOND[n]} text-niveau-ink`);

function usePourcent() {
  const langue = useLangue();
  return (v: number | null) =>
    v === null ? '—' : `${formatNombre(v * 100, langue, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;
}

// Le score d'un ou plusieurs blocs : rapport des totaux, toutes cases confondues.
function scoreDe(...blocs: BlocProfondeur[]): number | null {
  let compte = 0;
  let vise = 0;
  for (const b of blocs)
    for (const t of b.tableaux) {
      compte += t.compte;
      vise += t.vise;
    }
  return vise > 0 ? compte / vise : null;
}

// Une carte du résumé : le nom du bloc, son score, et une jauge verticale
// remplie jusqu'au score. Un raccourci : elle fait défiler jusqu'à sa section.
// ⚠️ Pas de lien `#…` : l'adresse porte la route de l'app (App.tsx).
function CarteBloc({ titre, score, section }: { titre: string; score: number | null; section: string }) {
  const pourcent = usePourcent();
  return (
    <button
      type="button"
      onClick={() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      className="flex min-w-[9rem] flex-1 items-stretch lg:w-40 lg:flex-none justify-between gap-3 rounded-xl border border-border bg-panel px-3.5 py-3 text-left transition-colors hover:border-ink-dim"
    >
      <span className="flex min-w-0 flex-col justify-between gap-2">
        <span className="font-mono text-micro font-semibold uppercase leading-tight tracking-wider text-ink-dim">{titre}</span>
        <span className="text-xl font-bold leading-none tabular-nums text-ink">{pourcent(score)}</span>
      </span>
      <Jauge score={score} className="h-12 w-3 shrink-0" />
    </button>
  );
}

// Une jauge verticale remplie jusqu'au score (plafonnée à 100 %), à la couleur
// de son niveau ; l'objectif, en pointillés, en haut.
function Jauge({ score, className }: { score: number | null; className: string }) {
  const n = niveauScore(score);
  return (
    <span className={`relative block rounded-b border-t border-dashed border-ink-dim bg-panel2 ${className}`} aria-hidden>
      {n !== null && score !== null && score > 0 && (
        <span className={`absolute inset-x-0 bottom-0 rounded-t ${FOND[n]}`} style={{ height: `${Math.min(1, score) * 100}%` }} />
      )}
    </span>
  );
}

// Le résumé par set : une petite fiche par set, une jauge par bloc de runes
// (chaque palier, la vitesse) — le score du set dans ce bloc au-dessus, le nom
// du bloc dessous. « — » et une jauge vide quand le bloc ne vise pas ce set.
// Les sets dans l'ordre de leur première apparition.
function ResumeParSet({ blocs }: { blocs: { titre: string; court: string; bloc: BlocProfondeur }[] }) {
  const textes = useTraduction();
  const pourcent = usePourcent();
  const sets: string[] = [];
  for (const { bloc } of blocs) for (const tab of bloc.tableaux) if (!sets.includes(tab.cle)) sets.push(tab.cle);
  if (sets.length === 0) return null;
  return (
    <section className="flex flex-wrap gap-2.5" aria-label={textes.objectifs.vue.resumeParSet}>
      {sets.map((set) => (
        <article key={set} className="flex flex-col gap-2 rounded-xl border border-border bg-panel px-3 py-2.5">
          <header className="flex items-center gap-1.5 text-xs font-bold text-ink">
            <RuneIcon setKey={set} size={18} filter={runeSetIconFilter(true)} />
            {nomSet(textes.jeu, set)}
          </header>
          <div
            className="grid items-end gap-x-1.5 gap-y-1 font-mono text-micro"
            style={{ gridTemplateColumns: `repeat(${blocs.length}, 3.75rem)` }}
          >
            {blocs.map((b, i) => {
              const tab = b.bloc.tableaux.find((x) => x.cle === set);
              return (
                <span key={i} className="whitespace-nowrap text-center tabular-nums text-ink">
                  {tab ? pourcent(tab.score) : '—'}
                </span>
              );
            })}
            {blocs.map((b, i) => (
              <Jauge key={i} score={b.bloc.tableaux.find((x) => x.cle === set)?.score ?? null} className="mx-auto h-10 w-4" />
            ))}
            {blocs.map((b, i) => (
              <span key={i} className="truncate text-center text-ink-dimmer" title={b.titre}>
                {b.court}
              </span>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

// La colonne d'un emplacement : remplie vers l'objectif (pointillés en haut),
// le fantôme « si max héroïque » derrière.
function Colonne({ ligne }: { ligne: LigneProfondeur }) {
  const part = (n: number) => (ligne.vise > 0 ? Math.min(1, n / ligne.vise) * 100 : 0);
  const n = niveauCase(ligne.actuel, ligne.vise);
  return (
    <div className="relative h-14 w-full rounded-b border-t border-dashed border-ink-dim bg-panel2">
      {ligne.siMax !== undefined && ligne.siMax > ligne.actuel && (
        <div className="absolute inset-x-0 bottom-0 rounded-t bg-border" style={{ height: `${part(ligne.siMax)}%` }} />
      )}
      {n !== null && ligne.actuel > 0 && (
        <div className={`absolute inset-x-0 bottom-0 rounded-t ${FOND[n]}`} style={{ height: `${part(ligne.actuel)}%` }} />
      )}
    </div>
  );
}

type Sorte = 'efficience' | 'vitesse' | 'artefact';

// Les libellés du « si max » d'un palier : meule et gemme héroïques, ou meule
// légendaire seule.
function libellesMax(t: Dictionnaire['objectifs']['vue'], p: Potentiel) {
  return p === 'legendaire'
    ? { ligne: t.lignes.maxLeg, legende: t.siMaxLeg, aide: t.siMaxLegAide }
    : { ligne: t.lignes.maxHero, legende: t.siMax, aide: t.siMaxAide };
}

// La fiche d'un set (ou d'un élément, d'un style) : en-tête, histogramme, et
// sous chaque colonne ses chiffres. Le seuil et la quantité visée montent dans
// l'en-tête quand ils sont les mêmes pour toutes les colonnes.
function Fiche({
  tableau,
  titre,
  icone,
  sorte,
  potentiel,
  suffixeSeuil,
  libelleColonne,
  quantiteParColonne,
  aideIntangible,
}: {
  tableau: TableauProfondeur;
  titre: string;
  icone?: ReactNode;
  sorte: Sorte;
  // Efficience : le « si max » du palier.
  potentiel?: Potentiel;
  suffixeSeuil: string;
  libelleColonne: (cle: number) => string;
  // « 20 par emplacement », « 2 par principale ».
  quantiteParColonne: (n: number) => string;
  aideIntangible: string;
}) {
  const t = useTraduction().objectifs.vue;
  const pourcent = usePourcent();
  const { lignes } = tableau;
  const quantites = new Set(lignes.map((l) => l.vise));
  const seuils = new Set(lignes.map((l) => l.seuil));
  const sousTitre = [
    quantites.size === 1 ? quantiteParColonne([...quantites][0]) : null,
    // Artéfacts : le seuil est déjà dans le titre, et les Intangibles, sans
    // élément ni style, se comptent pour la ligne entière.
    seuils.size === 1 && sorte !== 'artefact' ? t.seuilFiche(`${[...seuils][0]}${suffixeSeuil}`) : null,
    sorte === 'artefact' && tableau.intangible ? `${t.lignes.intangible} ${tableau.intangible}` : null,
  ].filter((x): x is string => x !== null);
  const rangees: { nom: string; aide?: string; valeurs: (number | string)[] }[] = [];
  if (seuils.size > 1) rangees.push({ nom: t.lignes.seuil, valeurs: lignes.map((l) => `${l.seuil}${suffixeSeuil}`) });
  rangees.push({ nom: t.lignes.vise, valeurs: lignes.map((l) => l.vise) });
  if (sorte === 'efficience') {
    const m = libellesMax(t, potentiel ?? 'heroique');
    rangees.push({ nom: m.ligne, aide: m.aide, valeurs: lignes.map((l) => l.siMax ?? '—') });
  }
  if (sorte === 'vitesse') rangees.push({ nom: t.lignes.plusRapide, valeurs: lignes.map((l) => l.plusRapide ?? '—') });
  if (sorte !== 'artefact')
    rangees.push({ nom: t.lignes.intangible, aide: aideIntangible, valeurs: lignes.map((l) => l.intangible || '—') });
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-panel px-4 py-3.5 lg:w-fit lg:min-w-[16rem]">
      <header className="flex items-center gap-2.5">
        {icone}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-bold text-ink">{titre}</span>
          {sousTitre.length > 0 && (
            <span className="font-mono text-micro text-ink-dim" title={sorte === 'artefact' ? aideIntangible : undefined}>
              {sousTitre.join(' · ')}
            </span>
          )}
        </div>
        <span className={`ml-auto rounded-md px-2 py-0.5 font-mono text-sm font-bold ${aplat(niveauScore(tableau.score))}`}>
          {pourcent(tableau.score)}
        </span>
      </header>
      <div
        className="grid items-end gap-x-1.5 gap-y-1 font-mono text-micro [grid-template-columns:4rem_repeat(var(--colonnes),minmax(0,1fr))] lg:[grid-template-columns:4rem_repeat(var(--colonnes),var(--largeur))]"
        // Une colonne d'artéfact porte un nom d'élément ou de style, pas un chiffre.
        style={{ '--colonnes': lignes.length, '--largeur': sorte === 'artefact' ? '3.75rem' : '2rem' } as CSSProperties}
      >
        <span />
        {lignes.map((l) => (
          <span key={l.cle} className="text-center text-xs font-semibold text-ink">
            {l.actuel}
          </span>
        ))}
        <span className="self-center text-ink-dimmer">{t.actuel}</span>
        {lignes.map((l) => (
          <Colonne key={l.cle} ligne={l} />
        ))}
        <span className="text-ink-dimmer">{sorte === 'artefact' ? '' : t.lignes.emplacement}</span>
        {lignes.map((l) => (
          <span key={l.cle} className="truncate text-center text-ink-dim">
            {libelleColonne(l.cle)}
          </span>
        ))}
        {rangees.map((r) => (
          <Rangee key={r.nom} {...r} cles={lignes.map((l) => l.cle)} />
        ))}
      </div>
    </article>
  );
}

// Une rangée de chiffres sous l'histogramme : son nom, puis une valeur par colonne.
function Rangee({ nom, aide, valeurs, cles }: { nom: string; aide?: string; valeurs: (number | string)[]; cles: number[] }) {
  return (
    <>
      <span className="truncate border-t border-border-soft pt-1 text-ink-dimmer" title={aide}>
        {nom}
      </span>
      {valeurs.map((v, i) => (
        <span key={cles[i]} className="border-t border-border-soft pt-1 text-center text-ink-dim">
          {v}
        </span>
      ))}
    </>
  );
}

// La légende de l'histogramme, au-dessus des fiches.
function Legende({ potentiel }: { potentiel?: Potentiel }) {
  const t = useTraduction().objectifs.vue;
  return (
    <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-ink-dim">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-niveau-2" aria-hidden />
        {t.actuel}
      </span>
      {potentiel && (
        <span className="flex items-center gap-1.5" title={libellesMax(t, potentiel).aide}>
          <span className="h-2.5 w-2.5 rounded-sm bg-border" aria-hidden />
          {libellesMax(t, potentiel).legende}
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="w-3.5 border-t border-dashed border-ink-dim" aria-hidden />
        {t.objectif}
      </span>
    </span>
  );
}

// Le détail d'un bloc : titre, seuil s'il est le même partout, score,
// légende, le score par emplacement (ou par principale), puis une fiche par set.
function Detail({
  id,
  titre,
  bloc,
  suffixeSeuil,
  sansSeuil = false,
  potentiel,
  titreBande,
  libelleBande,
  children,
}: {
  // La cible de sa carte du résumé.
  id: string;
  titre: string;
  bloc: BlocProfondeur;
  suffixeSeuil: string;
  // Artéfacts : chaque ligne porte son seuil dans son titre.
  sansSeuil?: boolean;
  // Efficience : le « si max » du palier, pour la légende.
  potentiel?: Potentiel;
  titreBande: string;
  libelleBande: (cle: number) => string;
  children: ReactNode;
}) {
  const t = useTraduction().objectifs.vue;
  const pourcent = usePourcent();
  const seuils = new Set(bloc.tableaux.flatMap((tab) => tab.lignes.map((l) => l.seuil)));
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-3 border-t border-border-soft pt-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h2 className="font-display text-base tracking-wide text-ink">{titre}</h2>
        {seuils.size === 1 && !sansSeuil && (
          <span className="rounded-full border border-border-soft px-2 py-0.5 font-mono text-micro text-ink-dim">
            {t.seuilCommun(`${[...seuils][0]}${suffixeSeuil}`)}
          </span>
        )}
        <span className={`rounded-md px-2 py-0.5 font-mono text-sm font-bold ${aplat(niveauScore(bloc.global))}`}>
          {pourcent(bloc.global)}
        </span>
        {bloc.tableaux.length > 0 && <Legende potentiel={potentiel} />}
      </div>
      {bloc.tableaux.length === 0 ? (
        <p className="text-sm text-ink-dim">{t.aucunObjectif}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-micro font-semibold uppercase tracking-wider text-ink-dimmer">{titreBande}</span>
            {bloc.parLigne.map((l) => (
              <span
                key={l.cle}
                className={`inline-flex items-baseline gap-2 rounded-lg px-2.5 py-1 font-mono text-xs ${aplat(niveauScore(l.score))}`}
              >
                <span className="opacity-75">{libelleBande(l.cle)}</span>
                <b>{pourcent(l.score)}</b>
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-start">{children}</div>
        </>
      )}
    </section>
  );
}

// L'en-tête : à la SOURIS, le titre de la vue et ce qu'elle mesure (comme les
// autres vues du compte ; au doigt, la barre du haut dit déjà la vue), puis,
// aux deux formats, le renvoi vers le réglage des objectifs.
function EnTete({ sousTitre }: { sousTitre: string }) {
  const textes = useTraduction();
  const t = textes.objectifs.vue;
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-baseline">
      <div className="hidden items-baseline gap-3 lg:flex">
        <h1 className="font-display text-xl tracking-wide text-ink">{textes.navigation.objectifs}</h1>
        <span className="text-sm text-ink-dim">{sousTitre}</span>
      </div>
      <Bouton
        taille="sm"
        icone={<Settings size={14} />}
        libelle={t.reglerObjectifs}
        onClick={() => {
          window.location.hash = '#/parametres/objectifs';
        }}
        className="self-start lg:ml-auto"
      />
    </div>
  );
}

// Les blocs d'artéfacts : un par tableau d'objectifs, dans l'ordre du réglage.
function useBlocsArtefacts(artifacts: readonly ArtifactDetail[]) {
  const objectifs = useObjectifsCompte();
  return useMemo(
    () => ({
      attribut: objectifs.artefacts.attribut.map((o) => ({ objectif: o, bloc: profondeurArtefacts(o, artifacts, 'attribut') })),
      type: objectifs.artefacts.type.map((o) => ({ objectif: o, bloc: profondeurArtefacts(o, artifacts, 'type') })),
    }),
    [objectifs.artefacts, artifacts]
  );
}
type BlocsArtefacts = ReturnType<typeof useBlocsArtefacts>;
const blocsDe = (b: BlocsArtefacts['attribut']) => b.map((x) => x.bloc);

// Le titre d'une ligne d'artéfact : le libellé du jeu, « ≥ » devant sa valeur
// (« Réd. dgts reçus de l'Eau ≥ -22% »).
function titreLigne(l: LigneArtefact, j: Dictionnaire['jeu']): string {
  const { avant, valeur, apres } = splitArtifactSub({ code: l.effet, value: l.seuil }, j);
  return valeur ? `${avant}≥ ${valeur}${apres}` : avant;
}

// Les sections d'une sorte d'artéfact : une par tableau, une fiche par
// secondaire, une colonne par élément (ou par style).
function SectionsArtefacts({ blocs, sorte }: { blocs: BlocsArtefacts['attribut']; sorte: SorteArtefact }) {
  const textes = useTraduction();
  const j = textes.jeu;
  const t = textes.objectifs;
  const colonnes = COLONNES_ARTEFACT[sorte];
  const nomColonne = (c: number) => (sorte === 'attribut' ? nomElement(j, colonnes[c]) : nomArchetype(j, colonnes[c]));
  const principale = (p: FiltrePrincipale) => (p === 0 ? t.toutesPrincipales : j.stats[ARTIFACT_MAIN[p].stat]);
  return (
    <>
      {blocs.map(({ objectif, bloc }, i) => (
        <Detail
          key={i}
          id={`objectifs-${sorte}-${i}`}
          titre={`${j.sortesArtefact[sorte === 'attribut' ? 'element' : 'archetype']} · ${principale(objectif.principale)}`}
          bloc={bloc}
          suffixeSeuil=""
          sansSeuil
          titreBande={sorte === 'attribut' ? t.vue.bande.element : t.vue.bande.style}
          libelleBande={nomColonne}
        >
          {bloc.tableaux.map((tab, k) => (
            <Fiche
              key={tab.cle}
              tableau={tab}
              titre={titreLigne(objectif.lignes[k], j)}
              sorte="artefact"
              suffixeSeuil=""
              libelleColonne={nomColonne}
              quantiteParColonne={sorte === 'attribut' ? t.vue.parElement : t.vue.parStyle}
              aideIntangible={t.vue.intangibleArtefactAide}
            />
          ))}
        </Detail>
      ))}
    </>
  );
}

export function ObjectifsRunes({ runes, artifacts = [] }: { runes: RuneDetail[]; artifacts?: ArtifactDetail[] }) {
  const textes = useTraduction();
  const t = textes.objectifs;
  const j = textes.jeu;
  const objectifs = useObjectifsCompte();
  // ⚠️ Le potentiel héroïque de chaque rune se calcule UNE fois par inventaire,
  // pas à chaque changement d'objectif : c'est la part coûteuse du calcul.
  const mesurees = useMemo(() => mesurerRunes(runes), [runes]);
  const paliers = useMemo(() => objectifs.paliers.map((p) => profondeurPalier(p, mesurees)), [objectifs.paliers, mesurees]);
  const vitesse = useMemo(() => profondeurVitesse(objectifs.vitesse, runes), [objectifs.vitesse, runes]);
  const artefacts = useBlocsArtefacts(artifacts);
  if (runes.length === 0) return <p className="text-sm text-ink-dim">{t.vue.sansCompte}</p>;
  const emplacement = (n: number) => String(n);
  const bandeEmplacement = (n: number) => `${t.vue.lignes.emplacement} ${n}`;
  const icone = (set: string) => <RuneIcon setKey={set} size={26} filter={runeSetIconFilter(true)} />;
  const nomPalier = (i: number) => objectifs.paliers[i].nom ?? t.palierParDefaut(i);
  const potentielDe = (i: number): Potentiel => objectifs.paliers[i].potentiel ?? 'heroique';
  const fichesSets = (bloc: BlocProfondeur, sorte: Sorte, suffixeSeuil: string, potentiel?: Potentiel) =>
    bloc.tableaux.map((tab) => (
      <Fiche
        key={tab.cle}
        tableau={tab}
        titre={nomSet(j, tab.cle)}
        icone={icone(tab.cle)}
        sorte={sorte}
        potentiel={potentiel}
        suffixeSeuil={suffixeSeuil}
        libelleColonne={emplacement}
        quantiteParColonne={t.vue.parEmplacement}
        aideIntangible={t.vue.intangibleAide}
      />
    ));
  return (
    <div className="flex flex-col gap-6">
      <EnTete sousTitre={t.vue.sousTitreRunes} />

      <section className="flex flex-wrap gap-2.5" aria-label={t.vue.resume}>
        {paliers.map((bloc, i) => (
          <CarteBloc key={i} titre={nomPalier(i)} score={scoreDe(bloc)} section={`objectifs-palier-${i}`} />
        ))}
        <CarteBloc titre={t.vitesse} score={scoreDe(vitesse)} section="objectifs-vitesse" />
        <CarteBloc
          titre={t.artefacts}
          score={scoreDe(...blocsDe(artefacts.attribut), ...blocsDe(artefacts.type))}
          section="objectifs-attribut-0"
        />
      </section>
      <ResumeParSet
        blocs={[
          ...paliers.map((bloc, i) => ({ titre: nomPalier(i), court: nomPalier(i), bloc })),
          { titre: t.vitesse, court: t.vue.vitesseCourt, bloc: vitesse },
        ]}
      />

      {paliers.map((bloc, i) => (
        <Detail
          key={i}
          id={`objectifs-palier-${i}`}
          titre={`${t.efficience} · ${nomPalier(i)}`}
          bloc={bloc}
          suffixeSeuil=" %"
          potentiel={potentielDe(i)}
          titreBande={t.vue.bande.emplacement}
          libelleBande={bandeEmplacement}
        >
          {fichesSets(bloc, 'efficience', ' %', potentielDe(i))}
        </Detail>
      ))}
      <Detail
        id="objectifs-vitesse"
        titre={t.vitesse}
        bloc={vitesse}
        suffixeSeuil=""
          titreBande={t.vue.bande.emplacement}
        libelleBande={bandeEmplacement}
      >
        {fichesSets(vitesse, 'vitesse', '')}
      </Detail>
      <SectionsArtefacts blocs={artefacts.attribut} sorte="attribut" />
      <SectionsArtefacts blocs={artefacts.type} sorte="type" />
    </div>
  );
}

export function ObjectifsArtefacts({ artifacts }: { artifacts: ArtifactDetail[] }) {
  const textes = useTraduction();
  const t = textes.objectifs;
  const j = textes.jeu;
  const blocs = useBlocsArtefacts(artifacts);
  if (artifacts.length === 0) return <p className="text-sm text-ink-dim">{t.vue.sansCompte}</p>;
  return (
    <div className="flex flex-col gap-6">
      <EnTete sousTitre={t.vue.sousTitreArtefacts} />
      <section className="flex flex-wrap gap-2.5" aria-label={t.vue.resume}>
        {(['attribut', 'type'] as const).map((sorte) => (
          <CarteBloc
            key={sorte}
            titre={j.sortesArtefact[sorte === 'attribut' ? 'element' : 'archetype']}
            score={scoreDe(...blocsDe(blocs[sorte]))}
            section={`objectifs-${sorte}-0`}
          />
        ))}
      </section>
      <SectionsArtefacts blocs={blocs.attribut} sorte="attribut" />
      <SectionsArtefacts blocs={blocs.type} sorte="type" />
    </div>
  );
}
