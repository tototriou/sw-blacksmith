import { useId, useMemo, useState, type ReactNode } from 'react';
import { Check, Layers, Search } from 'lucide-react';
import type { Monster } from '../types';
import { Bouton, Case, Champ, Modale, Pastille, PiedDeDialogue, Segmented, Selecteur, ZoneCliquable } from '../ui';
import MonsterAvatar from './MonsterAvatar';
import { useTraduction } from '../hooks/useLangue';
import { SOUS_LG, useMediaQuery } from '../hooks/useMediaQuery';
import type { SourceFenetre, SourceImportEquipe } from '../lib/sourcesEquipesEnregistrees';
import {
  SELECTION_VIDE, basculerBloc, basculerEquipe, basculerMonstre, comptesParContenu, conflitsSelection, filtrableParContenu, filtreInitial,
  monstreChoisi, sectionsFenetre, sourceInitiale, sourcesVisibles, type FiltreFenetre, type SelectionImport,
} from '../lib/fenetreImport';
import {
  CATEGORIES_EQUIPES, SOUS_CATEGORIES_EQUIPES, libelleSousCategorie, libellePieceEnConflit, rangement,
  type CategorieEquipes, type OngletEquipes, type SousCategorieEquipes,
} from '../lib/equipesEnregistrees';

export interface ActionFenetreImport {
  cle: string;
  libelle: string;
  // L'action mise en avant, à droite du pied.
  principale?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: (selection: SelectionImport) => void;
}

interface Props {
  titre: string;
  // Toutes les sources, de tous les onglets « Source » montrés.
  sources: readonly SourceImportEquipe[];
  // Les onglets « Source », dans l'ordre ; le premier est ouvert.
  ordre: readonly SourceFenetre[];
  // Le contenu ouvert au départ (l'onglet de Mes équipes) ; `null` : tous.
  ongletInitial: OngletEquipes | null;
  // `equipes` : des équipes ; `monstres` : des monstres ; `mixte` : l'un ou
  // l'autre (l'Optimizer).
  mode: 'equipes' | 'monstres' | 'mixte';
  // La place libre de l'équipe ouverte (`monstres`).
  maxMonstres?: number;
  monstreParCom2us: ReadonlyMap<number, Monster>;
  actions: (selection: SelectionImport) => ActionFenetreImport[];
  // Le rapport d'un import refusé, lu sans refermer.
  rapport?: ReactNode;
  onFermer: () => void;
}

// Au-delà, une équipe dit combien d'autres monstres elle compte (une prépa RTA).
const PORTRAITS_MAX = 6;

// La fenêtre d'import commune (docs/02-app/transverse/feat-fenetre-import.md) :
// une source, un contenu et ses catégories, une recherche, puis les équipes
// sous leur section, les blocs (une liste, un groupe, les défenses de siège)
// d'une case. Les gestes du choix sont ceux de l'écran qui l'ouvre.
export default function FenetreImport({ titre, sources, ordre, ongletInitial, mode, maxMonstres = Infinity, monstreParCom2us, actions, rapport, onFermer }: Props) {
  const t = useTraduction();
  const f = t.fenetreImport;
  const g = t.equipes.groupes;
  const id = useId();
  const telephone = useMediaQuery(SOUS_LG);
  // S'ouvre sur la première source qui a de quoi importer.
  const [filtre, setFiltre] = useState<FiltreFenetre>(() => filtreInitial(sourceInitiale(sources, ordre), ongletInitial));
  const [selection, setSelection] = useState<SelectionImport>(SELECTION_VIDE);
  const visibles = useMemo(() => sourcesVisibles(sources, filtre), [sources, filtre]);
  const sections = useMemo(() => sectionsFenetre(visibles), [visibles]);
  const comptes = useMemo(() => comptesParContenu(sources, filtre.source), [sources, filtre.source]);
  const conflits = useMemo(() => conflitsSelection(sources, selection, monstreParCom2us), [sources, selection, monstreParCom2us]);
  // Deux gestes distincts sur une ligne : la case à gauche prend l'équipe
  // entière (son nom aussi), un portrait prend ce monstre seul (mode mixte,
  // l'Optimizer). Ils s'ajoutent, aucun ne défait l'autre.
  const equipesCochables = mode !== 'monstres';
  const monstresCliquables = mode !== 'equipes';
  const placesRestantes = maxMonstres - selection.monstres.length;

  const nomSource = (cle: string) => sources.find((s) => s.cle === cle)?.libelle ?? cle;
  const nomEspece = (com2usId: number) => monstreParCom2us.get(com2usId)?.name ?? String(com2usId);
  const lignesConflits = [
    ...conflits.especes.map((x) => g.detailEspece(x.formes.map(nomEspece).join(' / '), x.equipes.map(nomSource))),
    ...conflits.pieces.map((x) => g.detailPieces(x.porteurs.map((p) => g.porteur(nomEspece(p.com2usId), nomSource(p.equipe))),
      x.pieces.map((p) => libellePieceEnConflit(p, t)))),
  ];

  const sousCategories: readonly SousCategorieEquipes[] = filtre.categorie ? SOUS_CATEGORIES_EQUIPES[filtre.categorie] : [];
  const compte = (cle: string) => comptes.get(cle) ?? 0;
  const aide = mode === 'equipes' ? f.aide.equipes : mode === 'mixte' ? f.aide.mixte : maxMonstres > 0 ? f.aide.monstres(maxMonstres) : f.aide.complete;
  const resume = [selection.equipes.length ? f.equipesChoisies(selection.equipes.length) : '',
    selection.monstres.length ? f.monstresChoisis(selection.monstres.length) : ''].filter(Boolean).join(' · ') || aide;

  // Au téléphone, le nom d'un deck (« Cairos — Tanière du dragon · 2 ») passe
  // sur deux lignes : tronqué à une, il ne disait plus lequel c'était.
  const libelleLigne = telephone ? 'line-clamp-2 break-words' : 'truncate';
  const ligne = (s: SourceImportEquipe) => {
    const utilisable = s.raison === null;
    const tousPortraits = monstresCliquables || s.monstres.length <= PORTRAITS_MAX;
    const portraits = tousPortraits ? s.monstres : s.monstres.slice(0, PORTRAITS_MAX);
    const nom = (
      // La raison sous le nom : à côté, elle le tronquerait au téléphone.
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`${libelleLigne} text-sm`} title={s.libelle}>{s.libelle}</span>
        {s.raison && <span className="text-xs text-ink-dimmer">{s.raison}</span>}
      </span>
    );
    const rangee = (
      portraits.length > 0 && (
        <span className={`flex min-w-0 items-center gap-1 ${monstresCliquables ? 'flex-wrap' : 'flex-none'}`}>
          {portraits.map((m, i) => {
            const choix = { cle: s.cle, index: i };
            if (!monstresCliquables || !utilisable) return <MonsterAvatar key={`${m.id}-${i}`} monster={m} size={28} element={false} />;
            const choisi = monstreChoisi(selection, choix);
            return (
              // Le contour est réservé au repos (transparent) : choisir ne déplace rien.
              // Choisi, le portrait porte en plus une coche d'accent en coin,
              // hors du flux : le contour seul se perdait sur un portrait coloré.
              <ZoneCliquable key={`${m.id}-${i}`} aria-pressed={choisi} aria-label={f.monstre(m.name, s.libelle)} title={m.name}
                disabled={!choisi && placesRestantes <= 0}
                onClick={() => setSelection((x) => basculerMonstre(x, choix, maxMonstres))}
                className={`relative flex flex-none rounded-md border p-px ${choisi ? 'border-accent bg-accent-soft' : 'border-transparent hoverable:border-border'}`}>
                <MonsterAvatar monster={m} size={28} element={false} />
                {choisi && (
                  <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-ink">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
              </ZoneCliquable>
            );
          })}
          {!tousPortraits && <span className="text-micro text-ink-dim">+{s.monstres.length - PORTRAITS_MAX}</span>}
        </span>
      )
    );
    const teinte = utilisable ? 'text-ink' : 'text-ink-dimmer';
    // La case d'abord, à gauche : son nom accessible est celui de l'équipe, et
    // le nom affiché la coche aussi (son `label`).
    const idCase = `${id}-${s.cle}`;
    return (
      <div key={s.cle} className={`flex items-center gap-2.5 px-4 py-2 ${teinte}`}>
        {equipesCochables && (
          <Case id={idCase} libelle={null} aria-label={s.libelle} checked={selection.equipes.includes(s.cle)} disabled={!utilisable}
            onChange={() => setSelection((x) => basculerEquipe(x, s.cle))} />
        )}
        {rangee}
        {equipesCochables
          ? <label htmlFor={idCase} className={`flex min-w-0 flex-1 ${utilisable ? 'cursor-pointer' : ''}`}>{nom}</label>
          : nom}
      </div>
    );
  };

  const choixContenu = filtrableParContenu(filtre.source) && (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-xs text-ink-dim">
        <span className="flex-none">{f.contenu}</span>
        <Selecteur aria-label={f.contenu} value={filtre.categorie ?? ''}
          onChange={(ev) => setFiltre((x) => ({ ...x, categorie: (ev.target.value || null) as CategorieEquipes | null, sous: null }))}>
          <option value="">{`${f.tousContenus} (${compte('')})`}</option>
          {CATEGORIES_EQUIPES.map((c) => <option key={c} value={c}>{`${t.equipes.categories[c]} (${compte(c)})`}</option>)}
        </Selecteur>
      </label>
      {filtre.categorie && sousCategories.length > 0 && (
        // Une rangée qui défile au téléphone : sept catégories ne tiennent pas en largeur.
        <div role="group" aria-label={t.equipes.filtre.aria} className={`flex gap-1.5 ${telephone ? 'overflow-x-auto pb-1' : 'flex-wrap'}`}>
          <Pastille actif={filtre.sous === null} libelle={`${f.tout} ${compte(filtre.categorie)}`} onClick={() => setFiltre((x) => ({ ...x, sous: null }))} />
          {sousCategories.map((x) => (
            <Pastille key={x} actif={filtre.sous === x} libelle={`${libelleSousCategorie(filtre.categorie!, x, t)} ${compte(rangement(filtre.categorie!, x))}`}
              onClick={() => setFiltre((v) => ({ ...v, sous: x }))} />
          ))}
        </div>
      )}
    </div>
  );

  const pied = (
    <div className="flex flex-col gap-1.5 text-xs">
      <p role="status" className="text-ink-dim">{resume}</p>
      {lignesConflits.length > 0 && (
        <div className="text-warn">
          <p>{f.conflits}</p>
          <ul aria-label={g.detailAria} className="flex max-h-24 list-disc flex-col gap-0.5 overflow-y-auto pl-4">
            {lignesConflits.map((l) => <li key={l} className="break-words">{l}</li>)}
          </ul>
        </div>
      )}
      {rapport}
    </div>
  );

  return (
    // Au téléphone, la fenêtre prend toute la hauteur permise et la liste le
    // reste : elle ne se réduit plus à quelques lignes, et la fenêtre ne change
    // pas de taille (ni les filtres de place) quand un filtre vide la liste.
    <Modale onClose={onFermer} labelledBy={id} titre={titre} croix largeur={telephone ? 'max-w-[720px] h-[90dvh]' : 'max-w-[720px]'} corpsFixeBas={pied}
      actions={<PiedDeDialogue>
        {actions(selection).map((a) => (
          <Bouton key={a.cle} libelle={a.libelle} disabled={a.disabled} title={a.title}
            {...(a.principale ? { ton: 'accent' as const, fond: 'plein' as const } : {})} onClick={() => a.onClick(selection)} />
        ))}
      </PiedDeDialogue>}>
      <div className={`flex flex-col gap-3 ${telephone ? 'min-h-0 flex-1' : ''}`}>
        {ordre.length > 1 && (
          <div role="group" aria-label={f.source}>
            <Segmented<SourceFenetre> value={filtre.source} onChange={(source) => setFiltre((x) => ({ ...x, source }))}
              options={ordre.map((o) => ({ key: o, label: f.sources[o] }))} />
          </div>
        )}
        {choixContenu}
        <Champ icone={<Search size={14} />} placeholder={f.chercher} aria-label={f.chercher} value={filtre.texte}
          onChange={(ev) => setFiltre((x) => ({ ...x, texte: ev.target.value }))} onBlur={() => setFiltre((x) => ({ ...x, texte: x.texte.trim() }))} />
        {/* La liste sort du rembourrage : ses bandes touchent les bords. */}
        <div className={`-mx-5 overflow-y-auto border-t border-border-soft ${telephone ? 'min-h-0 flex-1' : 'max-h-[50dvh]'}`}>
          {sections.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-dim">{f.aucunResultat}</p>}
          {sections.map((section) => (
            <div key={section.groupe}>
              <div className="border-b border-border-soft bg-panel2 px-4 py-1.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
                {section.groupe}
              </div>
              {section.blocs.map((b, n) => {
                if (!b.bloc || b.sources.length < 2) return <div key={`${b.bloc?.cle ?? 'seul'}-${n}`}>{b.sources.map(ligne)}</div>;
                const cles = b.sources.filter((s) => s.raison === null).map((s) => s.cle);
                const tous = cles.length > 0 && cles.every((c) => selection.equipes.includes(c));
                return (
                  <div key={b.bloc.cle} role="group" aria-label={b.bloc.nom} className="mx-3 my-2 rounded-lg border border-border-soft">
                    <div className="flex items-center gap-2 border-b border-border-soft bg-panel2/40 px-3 py-1.5 text-sm">
                      <Layers size={14} className="flex-none text-ink-dim" aria-hidden />
                      {equipesCochables ? (
                        <Case checked={tous} disabled={cles.length === 0} aria-label={f.toutLeBloc(b.bloc.nom)} className="min-w-0 flex-1 !text-sm !text-ink"
                          onChange={() => setSelection((x) => basculerBloc(x, cles))}
                          libelle={<span className="truncate font-semibold">{b.bloc.nom} <span className="font-normal text-ink-dim">· {f.equipes(b.sources.length)}</span></span>} />
                      ) : <span className="truncate font-semibold">{b.bloc.nom}</span>}
                    </div>
                    {b.sources.map(ligne)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Modale>
  );
}
