import { CSSProperties, ReactNode, useMemo } from 'react';
import { Settings } from 'lucide-react';
import { ArtifactDetail, Monster, RuneDetail } from '../../types';
import {
  BlocProfondeur,
  COLONNES_ARTEFACT,
  FamilleObjectifs,
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
  scoreDesTableaux,
  scoreObjectif,
  LISTES_MONSTRES,
} from '../../lib/objectifsCompte';
import { LigneMonstre, jumeauConnu, mesurerMonstres, nomObjectifMonstre } from '../../lib/objectifsMonstres';
import type { BoxItem } from '../../lib/applyAccount';
import MonsterAvatar from '../MonsterAvatar';
import { ARTIFACT_MAIN, runeSetIconFilter, splitArtifactSub } from '../../lib/effects';
import { useObjectifsCompte } from '../../hooks/useObjectifsCompte';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import { formatNombre } from '../../i18n/format';
import type { Dictionnaire } from '../../i18n';
import { nomArchetype, nomElement, nomSet } from '../../i18n/jeu';
import { Bouton } from '../../ui';
import RuneIcon from '../RuneIcon';
import { hashVue } from '../../lib/accountViews';
import { LieuFarm, RecoFarm, idLieu, recosFarm } from '../../lib/farmObjectifs';
import { ICONE_PRINCIPALE } from '../IconePrincipale';

// Les vues de la section Mon compte › Objectifs : le compte face aux objectifs
// de la vue Réglage. Rendu seul ; tout le calcul est dans
// src/lib/objectifsCompte.ts. Voir docs/02-app/compte/feat-objectifs.md.
//
//  - le RÉSUMÉ (`ObjectifsResume`) : une carte par bloc (chaque palier, la
//    vitesse, l'Attribut, le Type), son score et une barre qui se remplit à la
//    couleur de son niveau, lien vers la vue qui le détaille ; puis le score de
//    chaque set dans chaque bloc de runes ;
//  - le détail des RUNES et des ARTÉFACTS (`ObjectifsRunes`,
//    `ObjectifsArtefacts`) : leurs cartes en raccourcis, puis une section par
//    bloc — le score par emplacement (élément, style), puis une fiche par set
//    (ou par secondaire) : un histogramme, chaque colonne remplie vers
//    l'objectif tracé en pointillés, et dessous ses chiffres.

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
const scoreDe = (...blocs: BlocProfondeur[]) => scoreDesTableaux(blocs.flatMap((b) => b.tableaux));

// Une carte du résumé : le nom du bloc, son score, et une jauge verticale
// remplie jusqu'au score. Un raccourci : elle fait défiler jusqu'à sa section
// de la même vue (`section`), ou mène à la vue qui la détaille (`href`).
// ⚠️ Pas d'ancre `#…` vers une section : l'adresse porte la route de l'app
// (App.tsx).
function CarteBloc({ titre, score, section, href }: { titre: string; score: number | null; section?: string; href?: string }) {
  const pourcent = usePourcent();
  const classe =
    'flex min-w-[9rem] flex-1 items-stretch lg:w-40 lg:flex-none justify-between gap-3 rounded-xl border border-border bg-panel px-3.5 py-3 text-left transition-colors hover:border-ink-dim';
  const contenu = (
    <>
      <span className="flex min-w-0 flex-col justify-between gap-2">
        <span className="font-mono text-micro font-semibold uppercase leading-tight tracking-wider text-ink-dim">{titre}</span>
        <span className="text-xl font-bold leading-none tabular-nums text-ink">{pourcent(score)}</span>
      </span>
      <Jauge score={score} className="h-12 w-3 shrink-0" />
    </>
  );
  if (href)
    return (
      <a href={href} className={classe}>
        {contenu}
      </a>
    );
  return (
    <button
      type="button"
      onClick={() => section && document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      className={classe}
    >
      {contenu}
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

type Sorte = 'efficience' | 'vitesse';

// Les libellés du « si max » d'un palier : meule héroïque, ou meule
// légendaire.
function libellesMax(t: Dictionnaire['objectifs']['vue'], p: Potentiel) {
  return p === 'legendaire'
    ? { ligne: t.lignes.maxLeg, legende: t.siMaxLeg, aide: t.siMaxLegAide }
    : { ligne: t.lignes.maxHero, legende: t.siMax, aide: t.siMaxAide };
}

// L'en-tête d'une fiche : son icône, son nom et ce qui vaut pour toute la
// fiche, puis son score sur l'aplat de son niveau.
function EnTeteFiche({ icone, titre, sousTitre, aide, score }: { icone?: ReactNode; titre: string; sousTitre: string[]; aide?: string; score: number | null }) {
  const pourcent = usePourcent();
  return (
    <header className="flex items-center gap-2.5">
      {icone}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-bold text-ink">{titre}</span>
        {sousTitre.length > 0 && (
          <span className="font-mono text-micro text-ink-dim" title={aide}>
            {sousTitre.join(' · ')}
          </span>
        )}
      </div>
      <span className={`ml-auto rounded-md px-2 py-0.5 font-mono text-sm font-bold ${aplat(niveauScore(score))}`}>{pourcent(score)}</span>
    </header>
  );
}

const CLASSE_FICHE = 'flex flex-col gap-3 rounded-xl border border-border bg-panel px-4 py-3.5 lg:w-fit lg:min-w-[16rem]';

// La fiche d'un set : en-tête, histogramme, et sous chaque emplacement ses
// chiffres. Le seuil et la quantité visée montent dans l'en-tête quand ils sont
// les mêmes pour tous les emplacements.
function Fiche({
  tableau,
  titre,
  icone,
  sorte,
  potentiel,
  suffixeSeuil,
  aideIntangible,
}: {
  tableau: TableauProfondeur;
  titre: string;
  icone?: ReactNode;
  sorte: Sorte;
  // Efficience : le « si max » du palier.
  potentiel?: Potentiel;
  suffixeSeuil: string;
  aideIntangible: string;
}) {
  const t = useTraduction().objectifs.vue;
  const { lignes } = tableau;
  const quantites = new Set(lignes.map((l) => l.vise));
  const seuils = new Set(lignes.map((l) => l.seuil));
  const sousTitre = [
    quantites.size === 1 ? t.parEmplacement([...quantites][0]) : null,
    seuils.size === 1 ? t.seuilFiche(`${[...seuils][0]}${suffixeSeuil}`) : null,
  ].filter((x): x is string => x !== null);
  const rangees: { nom: string; aide?: string; valeurs: (number | string)[] }[] = [];
  if (seuils.size > 1) rangees.push({ nom: t.lignes.seuil, valeurs: lignes.map((l) => `${l.seuil}${suffixeSeuil}`) });
  rangees.push({ nom: t.lignes.vise, valeurs: lignes.map((l) => l.vise) });
  if (sorte === 'efficience') {
    const m = libellesMax(t, potentiel ?? 'heroique');
    rangees.push({ nom: m.ligne, aide: m.aide, valeurs: lignes.map((l) => l.siMax ?? '—') });
  }
  if (sorte === 'vitesse') rangees.push({ nom: t.lignes.plusRapide, valeurs: lignes.map((l) => l.plusRapide ?? '—') });
  rangees.push({ nom: t.lignes.intangible, aide: aideIntangible, valeurs: lignes.map((l) => l.intangible || '—') });
  return (
    <article className={CLASSE_FICHE}>
      <EnTeteFiche icone={icone} titre={titre} sousTitre={sousTitre} score={tableau.score} />
      <div
        className="grid items-end gap-x-1.5 gap-y-1 font-mono text-micro [grid-template-columns:4rem_repeat(var(--colonnes),minmax(0,1fr))] lg:[grid-template-columns:4rem_repeat(var(--colonnes),2rem)]"
        style={{ '--colonnes': lignes.length } as CSSProperties}
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
        <span className="text-ink-dimmer">{t.lignes.emplacement}</span>
        {lignes.map((l) => (
          <span key={l.cle} className="truncate text-center text-ink-dim">
            {l.cle}
          </span>
        ))}
        {rangees.map((r) => (
          <Rangee key={r.nom} {...r} cles={lignes.map((l) => l.cle)} />
        ))}
      </div>
    </article>
  );
}

// Les trois sous-colonnes d'un élément (ou d'un style), une par principale.
// ⚠️ Serrées entre elles, écartées du groupe voisin (`gap-x-2.5` de la grille) :
// c'est l'écart qui dit quelles sous-colonnes vont ensemble.
function Trio({ children, bordure = false }: { children: ReactNode; bordure?: boolean }) {
  return <div className={`grid grid-cols-3 items-end gap-0.5 ${bordure ? 'border-t border-border-soft pt-1' : ''}`}>{children}</div>;
}

// La fiche d'une secondaire d'artéfact : une colonne par élément (ou style),
// chacune en trois sous-colonnes — PV, ATQ, DEF, leur icône dessous — puis le
// nom de l'élément sous le groupe, et le visé de chaque sous-colonne.
function FicheArtefact({ tableau, titre, sorte }: { tableau: TableauProfondeur; titre: string; sorte: SorteArtefact }) {
  const textes = useTraduction();
  const t = textes.objectifs.vue;
  const j = textes.jeu;
  const colonnes = COLONNES_ARTEFACT[sorte];
  const groupes = colonnes.map((_, c) => tableau.lignes.filter((l) => l.colonne === c));
  const quantites = new Set(tableau.lignes.map((l) => l.vise));
  const sousTitre = [
    quantites.size === 1 ? (sorte === 'attribut' ? t.parElementEtPrincipale : t.parStyleEtPrincipale)([...quantites][0]) : null,
    // Le seuil est déjà dans le titre ; les Intangibles, sans élément ni style,
    // se comptent pour la ligne entière.
    tableau.intangible ? `${t.lignes.intangible} ${tableau.intangible}` : null,
  ].filter((x): x is string => x !== null);
  return (
    <article className={CLASSE_FICHE}>
      <EnTeteFiche titre={titre} sousTitre={sousTitre} aide={t.intangibleArtefactAide} score={tableau.score} />
      <div
        className="grid items-end gap-x-2.5 gap-y-1 font-mono text-micro [grid-template-columns:3rem_repeat(var(--colonnes),minmax(0,1fr))] lg:[grid-template-columns:3rem_repeat(var(--colonnes),4rem)]"
        style={{ '--colonnes': colonnes.length } as CSSProperties}
      >
        <span />
        {groupes.map((g, c) => (
          <Trio key={c}>
            {g.map((l) => (
              <span key={l.cle} className="text-center text-xs font-semibold text-ink">
                {l.actuel}
              </span>
            ))}
          </Trio>
        ))}
        <span className="self-center text-ink-dimmer">{t.actuel}</span>
        {groupes.map((g, c) => (
          <Trio key={c}>
            {g.map((l) => (
              <Colonne key={l.cle} ligne={l} />
            ))}
          </Trio>
        ))}
        <span />
        {groupes.map((g, c) => (
          <Trio key={c}>
            {g.map((l) => {
              const { Icone, couleur } = ICONE_PRINCIPALE[l.principale ?? 100];
              const nom = j.stats[ARTIFACT_MAIN[l.principale ?? 100].stat];
              return (
                <span key={l.cle} role="img" aria-label={nom} title={nom} className="flex justify-center">
                  <Icone size={11} strokeWidth={2.5} aria-hidden className={couleur} />
                </span>
              );
            })}
          </Trio>
        ))}
        <span />
        {colonnes.map((c) => (
          <span key={c} className="truncate text-center text-ink-dim">
            {sorte === 'attribut' ? nomElement(j, c) : nomArchetype(j, c)}
          </span>
        ))}
        <span className="truncate border-t border-border-soft pt-1 text-ink-dimmer">{t.lignes.vise}</span>
        {groupes.map((g, c) => (
          <Trio key={c} bordure>
            {g.map((l) => (
              <span key={l.cle} className="text-center text-ink-dim">
                {l.vise}
              </span>
            ))}
          </Trio>
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
// légende, le score par emplacement (ou par élément, par style), puis une fiche
// par set (ou par secondaire).
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
function EnTete({ titre, sousTitre }: { titre: string; sousTitre: string }) {
  const textes = useTraduction();
  const t = textes.objectifs.vue;
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-baseline">
      <div className="hidden items-baseline gap-3 lg:flex">
        <h1 className="font-display text-xl tracking-wide text-ink">{titre}</h1>
        <span className="text-sm text-ink-dim">{sousTitre}</span>
      </div>
      <Bouton
        taille="sm"
        icone={<Settings size={14} />}
        libelle={t.reglerObjectifs}
        onClick={() => {
          window.location.hash = hashVue('objectifs', 'reglage');
        }}
        className="self-start lg:ml-auto"
      />
    </div>
  );
}

// Les blocs d'artéfacts : un par famille de secondaire, pour chaque sorte.
function useFamillesArtefacts(artifacts: readonly ArtifactDetail[]) {
  const objectifs = useObjectifsCompte();
  return useMemo(
    () => ({
      attribut: profondeurArtefacts(objectifs.artefacts.attribut, artifacts, 'attribut'),
      type: profondeurArtefacts(objectifs.artefacts.type, artifacts, 'type'),
    }),
    [objectifs.artefacts, artifacts]
  );
}
const blocsDe = (familles: FamilleObjectifs[]) => familles.map((f) => f.bloc);
const BLOC_VIDE: BlocProfondeur = { tableaux: [], parLigne: [], global: null };

// Le titre d'une ligne d'artéfact : le libellé du jeu, « ≥ » devant sa valeur
// (« Réd. dgts reçus de l'Eau ≥ -22% »).
function titreLigne(l: LigneArtefact, j: Dictionnaire['jeu']): string {
  const { avant, valeur, apres } = splitArtifactSub({ code: l.effet, value: l.seuil }, j);
  return valeur ? `${avant}≥ ${valeur}${apres}` : avant;
}

// Les sections d'une sorte d'artéfact : une par famille de secondaire, dans
// l'ordre du Top 10 par propriété (« Attribut · Réduction des dégâts reçus »),
// une fiche par secondaire. Sans aucun objectif, une section vide le dit : la
// carte du résumé y mène toujours.
function SectionsArtefacts({ familles, sorte }: { familles: FamilleObjectifs[]; sorte: SorteArtefact }) {
  const textes = useTraduction();
  const j = textes.jeu;
  const t = textes.objectifs;
  const lignes = useObjectifsCompte().artefacts[sorte];
  const colonnes = COLONNES_ARTEFACT[sorte];
  const nomSorte = j.sortesArtefact[sorte === 'attribut' ? 'element' : 'archetype'];
  const nomColonne = (c: number) => (sorte === 'attribut' ? nomElement(j, colonnes[c]) : nomArchetype(j, colonnes[c]));
  const bande = { titreBande: sorte === 'attribut' ? t.vue.bande.element : t.vue.bande.style, libelleBande: nomColonne };
  if (familles.length === 0)
    return (
      <Detail id={`objectifs-${sorte}-0`} titre={nomSorte} bloc={BLOC_VIDE} suffixeSeuil="" sansSeuil {...bande}>
        {null}
      </Detail>
    );
  return (
    <>
      {familles.map((f, i) => (
        <Detail
          key={f.famille}
          id={`objectifs-${sorte}-${i}`}
          titre={`${nomSorte} · ${textes.artefactsCompte.familles[f.famille]}`}
          bloc={f.bloc}
          suffixeSeuil=""
          sansSeuil
          {...bande}
        >
          {f.bloc.tableaux.map((tab, k) => (
            <FicheArtefact key={tab.cle} tableau={tab} titre={titreLigne(lignes[f.lignes[k]], j)} sorte={sorte} />
          ))}
        </Detail>
      ))}
    </>
  );
}

// Les blocs de runes : chaque palier et la vitesse.
// ⚠️ Le potentiel de chaque rune se calcule UNE fois par inventaire, pas à
// chaque changement d'objectif : c'est la part coûteuse du calcul.
function useBlocsRunes(runes: readonly RuneDetail[]) {
  const objectifs = useObjectifsCompte();
  const mesurees = useMemo(() => mesurerRunes(runes), [runes]);
  const paliers = useMemo(() => objectifs.paliers.map((p) => profondeurPalier(p, mesurees)), [objectifs.paliers, mesurees]);
  const vitesse = useMemo(() => profondeurVitesse(objectifs.vitesse, runes), [objectifs.vitesse, runes]);
  return { paliers, vitesse };
}

function useNomPalier() {
  const objectifs = useObjectifsCompte();
  const t = useTraduction().objectifs;
  return (i: number) => objectifs.paliers[i].nom ?? t.palierParDefaut(i);
}

const nomSorte = (j: Dictionnaire['jeu'], sorte: SorteArtefact) => j.sortesArtefact[sorte === 'attribut' ? 'element' : 'archetype'];

// OÙ FARMER : une carte par lieu visé — donjon de Cairos, ou Raid des mondes
// d'un palier pour ses meules —, le moins avancé d'abord : son rang, la part
// des pièces visées déjà acquise et sa jauge, comme les cartes des blocs. Un
// état, pas un raccourci : les cartes ne mènent nulle part.
function OuFarmer({ recos }: { recos: RecoFarm[] }) {
  const textes = useTraduction();
  const pourcent = usePourcent();
  const nomPalier = useNomPalier();
  const t = textes.objectifs.vue.farm;
  const nomLieu = (l: LieuFarm) =>
    'donjon' in l ? textes.equipes.decks.sousContenus[l.donjon] : t.raid(textes.equipes.decks.contenus['raid-mondes'], nomPalier(l.raid));
  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="objectifs-farm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="objectifs-farm" className="font-display text-base tracking-wide text-ink">
          {t.titre}
        </h2>
        <span className="text-xs text-ink-dim">{t.aide}</span>
      </div>
      {recos.length === 0 ? (
        <p className="text-sm text-ink-dim">{t.rien}</p>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {recos.map((r, i) => (
            <article
              key={idLieu(r.lieu)}
              className="flex min-w-[9rem] flex-1 items-stretch justify-between gap-3 rounded-xl border border-border bg-panel px-3.5 py-3 lg:w-44 lg:flex-none"
            >
              <span className="flex min-w-0 flex-col justify-between gap-2">
                <span className="font-mono text-micro font-semibold uppercase leading-tight tracking-wider text-ink-dim">
                  <span className="text-ink-dimmer">{t.rang(i + 1)}</span> {nomLieu(r.lieu)}
                </span>
                <span className="text-xl font-bold leading-none tabular-nums text-ink">{pourcent(r.score)}</span>
              </span>
              <Jauge score={r.score} className="h-12 w-3 shrink-0" />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// Les listes de monstres face à la box 6★.
function useMesureMonstres(box: readonly BoxItem[], parCom2us: ReadonlyMap<number, Monster>) {
  const objectifs = useObjectifsCompte();
  return useMemo(
    () => mesurerMonstres(objectifs.monstres, box.map((b) => b.monster), parCom2us),
    [objectifs.monstres, box, parCom2us]
  );
}

// Le RÉSUMÉ de la section : une carte par bloc — chaque palier, la vitesse,
// l'Attribut, le Type, les monstres à monter —, chacune menant à la vue qui la
// détaille, « Où farmer », puis le score de chaque set dans chaque bloc de
// runes.
export function ObjectifsResume({
  runes,
  artifacts,
  box,
  parCom2us,
}: {
  runes: RuneDetail[];
  artifacts: ArtifactDetail[];
  box: readonly BoxItem[];
  parCom2us: ReadonlyMap<number, Monster>;
}) {
  const textes = useTraduction();
  const t = textes.objectifs;
  const { paliers, vitesse } = useBlocsRunes(runes);
  const artefacts = useFamillesArtefacts(artifacts);
  const nomPalier = useNomPalier();
  const recos = useMemo(() => recosFarm(paliers, vitesse, artefacts), [paliers, vitesse, artefacts]);
  const monstres = useMesureMonstres(box, parCom2us);
  const versRunes = hashVue('objectifs', 'runes');
  const versArtefacts = hashVue('objectifs', 'artefacts');
  return (
    <div className="flex flex-col gap-6">
      <EnTete titre={textes.navigation.resume} sousTitre={t.vue.sousTitreResume} />
      <section className="flex flex-wrap gap-2.5" aria-label={t.vue.resume}>
        {paliers.map((bloc, i) => (
          <CarteBloc key={i} titre={nomPalier(i)} score={scoreDe(bloc)} href={versRunes} />
        ))}
        <CarteBloc titre={t.vitesse} score={scoreDe(vitesse)} href={versRunes} />
        {(['attribut', 'type'] as const).map((sorte) => (
          <CarteBloc key={sorte} titre={nomSorte(textes.jeu, sorte)} score={scoreDe(...blocsDe(artefacts[sorte]))} href={versArtefacts} />
        ))}
        <CarteBloc titre={t.monstres.aMonter} score={monstres.score} href={hashVue('objectifs', 'monstres')} />
      </section>
      <OuFarmer recos={recos} />
      <ResumeParSet
        blocs={[
          ...paliers.map((bloc, i) => ({ titre: nomPalier(i), court: nomPalier(i), bloc })),
          { titre: t.vitesse, court: t.vue.vitesseCourt, bloc: vitesse },
        ]}
      />
    </div>
  );
}

// Le détail des RUNES : une carte par palier et la vitesse, raccourcis vers
// leur section, puis les sections.
export function ObjectifsRunes({ runes }: { runes: RuneDetail[] }) {
  const textes = useTraduction();
  const t = textes.objectifs;
  const j = textes.jeu;
  const objectifs = useObjectifsCompte();
  const { paliers, vitesse } = useBlocsRunes(runes);
  const nomPalier = useNomPalier();
  const bandeEmplacement = (n: number) => `${t.vue.lignes.emplacement} ${n}`;
  const icone = (set: string) => <RuneIcon setKey={set} size={26} filter={runeSetIconFilter(true)} />;
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
        aideIntangible={t.vue.intangibleAide}
      />
    ));
  return (
    <div className="flex flex-col gap-6">
      <EnTete titre={textes.navigation.runes} sousTitre={t.vue.sousTitreRunes} />
      <section className="flex flex-wrap gap-2.5" aria-label={t.vue.resume}>
        {paliers.map((bloc, i) => (
          <CarteBloc key={i} titre={nomPalier(i)} score={scoreDe(bloc)} section={`objectifs-palier-${i}`} />
        ))}
        <CarteBloc titre={t.vitesse} score={scoreDe(vitesse)} section="objectifs-vitesse" />
      </section>
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
    </div>
  );
}

// Le détail des ARTÉFACTS : une carte par sorte, raccourci vers sa première
// section, puis les sections par famille.
export function ObjectifsArtefacts({ artifacts }: { artifacts: ArtifactDetail[] }) {
  const textes = useTraduction();
  const t = textes.objectifs;
  const blocs = useFamillesArtefacts(artifacts);
  return (
    <div className="flex flex-col gap-6">
      <EnTete titre={textes.navigation.artefacts} sousTitre={t.vue.sousTitreArtefacts} />
      <section className="flex flex-wrap gap-2.5" aria-label={t.vue.resume}>
        {(['attribut', 'type'] as const).map((sorte) => (
          <CarteBloc key={sorte} titre={nomSorte(textes.jeu, sorte)} score={scoreDe(...blocsDe(blocs[sorte]))} section={`objectifs-${sorte}-0`} />
        ))}
      </section>
      <SectionsArtefacts familles={blocs.attribut} sorte="attribut" />
      <SectionsArtefacts familles={blocs.type} sorte="type" />
    </div>
  );
}

// Un monstre d'une liste : son portrait, son nom, et ce que la box en a —
// « 2 / 3 » à la couleur de son niveau pour « à monter », « 6★ ×2 » pour les
// mémos (rien s'il n'y en a pas).
// ⚠️ Une collaboration : le portrait partagé et les deux noms, comme sa carte
// dans la box.
function TuileMonstre({ ligne, parCom2us }: { ligne: LigneMonstre; parCom2us: ReadonlyMap<number, Monster> }) {
  const t = useTraduction().objectifs.monstres;
  const nom = ligne.monstre ? nomObjectifMonstre(ligne.monstre, parCom2us) : `#${ligne.id}`;
  const jumeau = ligne.monstre ? jumeauConnu(ligne.monstre, parCom2us) : null;
  const score = ligne.vise !== undefined ? scoreObjectif(Math.min(ligne.possedes, ligne.vise), ligne.vise, Math.max(0, ligne.possedes - ligne.vise)) : null;
  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-border bg-panel px-3 py-2">
      <MonsterAvatar monster={ligne.monstre} fallback={nom} size={36} titre={nom} collab={jumeau ? { jumeau } : undefined} />
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{nom}</span>
      {ligne.vise !== undefined ? (
        <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${aplat(niveauScore(score))}`}>{t.exemplaires(ligne.possedes, ligne.vise)}</span>
      ) : (
        ligne.possedes > 0 && <span className="font-mono text-xs text-ink-dim">{t.possedes(ligne.possedes)}</span>
      )}
    </li>
  );
}

// Les MONSTRES : une section par liste — à monter, à garder, à sniper —, la
// carte de « à monter » en tête.
export function ObjectifsMonstres({ box, parCom2us }: { box: readonly BoxItem[]; parCom2us: ReadonlyMap<number, Monster> }) {
  const textes = useTraduction();
  const t = textes.objectifs;
  const mesure = useMesureMonstres(box, parCom2us);
  return (
    <div className="flex flex-col gap-6">
      <EnTete titre={textes.navigation.monstres} sousTitre={t.vue.sousTitreMonstres} />
      <section className="flex flex-wrap gap-2.5" aria-label={t.vue.resume}>
        <CarteBloc titre={t.monstres.aMonter} score={mesure.score} section="objectifs-monstres-aMonter" />
      </section>
      {LISTES_MONSTRES.map((liste) => (
        <section key={liste} id={`objectifs-monstres-${liste}`} className="flex scroll-mt-4 flex-col gap-2.5" aria-labelledby={`objectifs-monstres-${liste}-titre`}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id={`objectifs-monstres-${liste}-titre`} className="font-display text-base tracking-wide text-ink">
              {t.monstres[liste]}
            </h2>
            <span className="text-xs text-ink-dim">{t.monstres.aide[liste]}</span>
          </div>
          {mesure.listes[liste].length === 0 ? (
            <p className="text-sm text-ink-dim">{t.monstres.vide}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
              {mesure.listes[liste].map((l) => (
                <TuileMonstre key={l.id} ligne={l} parCom2us={parCom2us} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
