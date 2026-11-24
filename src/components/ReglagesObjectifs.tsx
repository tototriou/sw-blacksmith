import { useId, useRef, useState } from 'react';
import { Download, Plus, RotateCcw, Upload, X } from 'lucide-react';
import {
  BORNES,
  COLONNES_ARTEFACT,
  CibleCase,
  EMPLACEMENTS,
  EMPLACEMENTS_VITESSE,
  LIGNES_ARTEFACT_MAX,
  LISTES_MONSTRES,
  LigneArtefact,
  ListeMonstres,
  MONSTRES_MAX,
  OBJECTIFS_DEFAUT,
  ObjectifsMonstres,
  ObjectifSet,
  ObjectifsCompte,
  ObjectifsPartiels,
  PALIERS_MAX,
  POTENTIELS,
  PRINCIPALES_ARTEFACT,
  Potentiel,
  SETS_OBJECTIFS,
  SOUS_SECTIONS,
  SorteArtefact,
  SousSection,
  effetsArtefact,
  fichierObjectifs,
  lireFichierObjectifs,
  remplacerSousSections,
  sousSectionsDifferentes,
} from '../lib/objectifsCompte';
import { setObjectifsCompte, useObjectifsCompte } from '../hooks/useObjectifsCompte';
import { ARTIFACT_MAIN, artifactSubName, runeSetIconFilter } from '../lib/effects';
import { jourLocal, telechargerTexte } from '../lib/telechargement';
import { PREFIXE_FICHIER } from '../marque';
import { Bouton, BoutonIcone, Case, Champ, Modale, NumberField, Onglets, Selecteur, useNotifier } from '../ui';
import RuneIcon from './RuneIcon';
import MonsterAvatar from './MonsterAvatar';
import MonsterPicker from './MonsterPicker';
import { idObjectifMonstre, jumeauConnu, nomObjectifMonstre } from '../lib/objectifsMonstres';
import type { Monster } from '../types';
import { ICONE_PRINCIPALE } from './IconePrincipale';
import { ORDRE_FAMILLES, familleArtefact } from '../lib/artifactsTop';
import { nomArchetype, nomElement, nomSet } from '../i18n/jeu';
import { useTraduction } from '../hooks/useLangue';

// La vue Réglage de Mon compte › Objectifs : ce que le joueur vise, bloc par
// bloc, et l'import / export du réglage. Voir docs/02-app/compte/feat-objectifs.md.
//
// Chaque geste s'applique tout de suite, comme les autres réglages. Les deux
// gestes qui remplacent TOUT (import, valeurs par défaut) se défont par la
// notification « Annuler » au lieu d'une confirmation : le défaut reste sans
// perte, et l'on voit le résultat avant de décider.

// Une grille de cases : une colonne par emplacement (ou par principale), une
// ligne pour le seuil, une pour la quantité, et une colonne « Tous ».
function GrilleCibles({
  colonnes,
  cases,
  bornesSeuil,
  suffixe,
  onChange,
}: {
  colonnes: string[];
  cases: CibleCase[];
  bornesSeuil: { min: number; max: number };
  suffixe?: string;
  onChange: (cases: CibleCase[]) => void;
}) {
  const t = useTraduction().objectifs;
  const lignes: { cle: keyof CibleCase; libelle: string; bornes: { min: number; max: number }; suffixe?: string }[] = [
    { cle: 'seuil', libelle: t.seuil, bornes: bornesSeuil, suffixe },
    { cle: 'quantite', libelle: t.quantite, bornes: BORNES.quantite },
  ];
  const commune = (cle: keyof CibleCase) => (cases.every((c) => c[cle] === cases[0][cle]) ? cases[0][cle] : null);
  return (
    // ⚠️ Au doigt, la grille défile de côté plutôt que d'écraser ses champs :
    // sept colonnes de saisie ne tiennent pas dans 360 px.
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th />
            {colonnes.map((c) => (
              <th key={c} className="px-1 pb-1 text-center font-normal text-ink-dim">
                {c}
              </th>
            ))}
            <th className="px-1 pb-1 text-center font-normal text-ink-dim" title={t.tousAide}>
              {t.tous}
            </th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.cle}>
              <th scope="row" className="pr-2 text-left font-normal text-ink-dim">
                {l.libelle}
              </th>
              {cases.map((c, i) => (
                <td key={i} className="px-0.5 py-0.5">
                  <NumberField
                    sansBoutons
                    boxWidth="w-14"
                    value={c[l.cle]}
                    min={l.bornes.min}
                    max={l.bornes.max}
                    suffix={l.suffixe}
                    ariaLabel={`${l.libelle} · ${colonnes[i]}`}
                    onChange={(v) => onChange(cases.map((x, j) => (j === i ? { ...x, [l.cle]: v ?? 0 } : x)))}
                  />
                </td>
              ))}
              <td className="px-0.5 py-0.5 pl-2">
                <NumberField
                  sansBoutons
                  allowEmpty
                  boxWidth="w-14"
                  value={commune(l.cle)}
                  min={l.bornes.min}
                  max={l.bornes.max}
                  suffix={l.suffixe}
                  ariaLabel={`${l.libelle} · ${t.tous}`}
                  title={t.tousAide}
                  onChange={(v) => v !== null && onChange(cases.map((x) => ({ ...x, [l.cle]: v })))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Les sets d'un bloc (un palier, ou la vitesse) : une grille par set, son
// retrait, et l'ajout d'un set absent.
function ListeSets({
  sets,
  colonnes,
  bornesSeuil,
  suffixe,
  seuilNeuf,
  onChange,
}: {
  sets: ObjectifSet[];
  colonnes: string[];
  bornesSeuil: { min: number; max: number };
  suffixe?: string;
  seuilNeuf: number;
  onChange: (sets: ObjectifSet[]) => void;
}) {
  const textes = useTraduction();
  const t = textes.objectifs;
  const absents = SETS_OBJECTIFS.filter((s) => !sets.some((o) => o.set === s));
  const [choix, setChoix] = useState('');
  const aAjouter = absents.includes(choix) ? choix : absents[0];
  return (
    <div className="flex flex-col gap-3">
      {sets.map((o, i) => {
        const nom = nomSet(textes.jeu, o.set);
        return (
          <div key={o.set} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <RuneIcon setKey={o.set} size={18} filter={runeSetIconFilter(true)} />
              <span className="text-sm font-semibold text-ink">{nom}</span>
              <BoutonIcone
                libelle={t.retirerSet(nom)}
                icone={<X size={14} />}
                onClick={() => onChange(sets.filter((_, j) => j !== i))}
                className="ml-auto"
              />
            </div>
            <GrilleCibles
              colonnes={colonnes}
              cases={o.cases}
              bornesSeuil={bornesSeuil}
              suffixe={suffixe}
              onChange={(cases) => onChange(sets.map((x, j) => (j === i ? { ...x, cases } : x)))}
            />
          </div>
        );
      })}
      {/* ⚠️ Toujours affiché : sans set à ajouter, désactivé avec la raison. */}
      <div className="flex items-center gap-2">
        <Selecteur
          taille="sm"
          pleineLargeur={false}
          aria-label={t.choisirSet}
          value={aAjouter ?? ''}
          disabled={!aAjouter}
          title={aAjouter ? undefined : t.tousLesSets}
          onChange={(e) => setChoix(e.target.value)}
        >
          {absents.map((s) => (
            <option key={s} value={s}>
              {nomSet(textes.jeu, s)}
            </option>
          ))}
        </Selecteur>
        <Bouton
          taille="sm"
          icone={<Plus size={14} />}
          libelle={t.ajouterSet}
          disabled={!aAjouter}
          title={aAjouter ? undefined : t.tousLesSets}
          onClick={() =>
            aAjouter &&
            onChange([...sets, { set: aAjouter, cases: colonnes.map(() => ({ seuil: seuilNeuf, quantite: 0 })) }])
          }
        />
      </div>
    </div>
  );
}

// Une secondaire d'artéfact : son nom, sa valeur minimale, son retrait, puis
// une grille — une rangée par principale (son icône, comme dans la vue), une
// colonne par élément (ou par style), et la colonne « Tous » de la rangée.
function LigneArtefactReglage({
  ligne,
  colonnes,
  onChange,
  onRetirer,
}: {
  ligne: LigneArtefact;
  colonnes: string[];
  onChange: (ligne: LigneArtefact) => void;
  onRetirer: () => void;
}) {
  const textes = useTraduction();
  const t = textes.objectifs;
  const j = textes.jeu;
  const nom = artifactSubName(ligne.effet, j);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-sm text-ink" title={nom}>
          {nom}
        </span>
        <span className="shrink-0 text-xs text-ink-dim">{t.valeurMin}</span>
        <NumberField
          sansBoutons
          boxWidth="w-14"
          value={ligne.seuil}
          min={BORNES.sousPropriete.min}
          max={BORNES.sousPropriete.max}
          ariaLabel={`${t.valeurMin} · ${nom}`}
          onChange={(v) => onChange({ ...ligne, seuil: v ?? 0 })}
        />
        <BoutonIcone libelle={t.retirerSecondaire(nom)} icone={<X size={14} />} onClick={onRetirer} className="ml-auto" />
      </div>
      {/* ⚠️ Au doigt, la grille défile de côté plutôt que d'écraser ses champs. */}
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr className="text-ink-dim">
              <th />
              {colonnes.map((c) => (
                <th key={c} className="px-1 pb-1 text-center font-normal">
                  {c}
                </th>
              ))}
              <th className="px-1 pb-1 text-center font-normal" title={t.tousAide}>
                {t.tous}
              </th>
            </tr>
          </thead>
          <tbody>
            {PRINCIPALES_ARTEFACT.map((p, k) => {
              const stat = j.stats[ARTIFACT_MAIN[p].stat];
              const { Icone, couleur } = ICONE_PRINCIPALE[p];
              const valeurs = ligne.quantites.map((q) => q[k]);
              const commune = valeurs.every((v) => v === valeurs[0]) ? valeurs[0] : null;
              // Une colonne, ou toutes (`null`) : la quantité de CETTE principale.
              const poser = (colonne: number | null, v: number) =>
                onChange({
                  ...ligne,
                  quantites: ligne.quantites.map((q, m) => (colonne === null || m === colonne ? q.map((x, n) => (n === k ? v : x)) : q)),
                });
              return (
                <tr key={p}>
                  <th scope="row" className="pr-2 text-left font-normal text-ink-dim">
                    <span className="inline-flex items-center gap-1">
                      <Icone size={12} strokeWidth={2.5} aria-hidden className={couleur} />
                      {stat}
                    </span>
                  </th>
                  {valeurs.map((v, c) => (
                    <td key={c} className="px-0.5 py-0.5">
                      <NumberField
                        sansBoutons
                        boxWidth="w-12"
                        value={v}
                        min={BORNES.quantite.min}
                        max={BORNES.quantite.max}
                        ariaLabel={`${nom} · ${colonnes[c]} · ${stat}`}
                        onChange={(x) => poser(c, x ?? 0)}
                      />
                    </td>
                  ))}
                  <td className="px-0.5 py-0.5 pl-2">
                    <NumberField
                      sansBoutons
                      allowEmpty
                      boxWidth="w-12"
                      value={commune}
                      min={BORNES.quantite.min}
                      max={BORNES.quantite.max}
                      ariaLabel={`${nom} · ${stat} · ${t.tous}`}
                      title={t.tousAide}
                      onChange={(x) => x !== null && poser(null, x)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Les secondaires d'une sorte d'artéfact, rangées par famille comme la vue
// (`familleArtefact`), puis l'ajout d'une secondaire de la sorte.
function LignesArtefacts({
  sorte,
  lignes,
  onChange,
}: {
  sorte: SorteArtefact;
  lignes: LigneArtefact[];
  onChange: (lignes: LigneArtefact[]) => void;
}) {
  const textes = useTraduction();
  const t = textes.objectifs;
  const j = textes.jeu;
  const colonnes = COLONNES_ARTEFACT[sorte].map((c) => (sorte === 'attribut' ? nomElement(j, c) : nomArchetype(j, c)));
  const effets = effetsArtefact(sorte);
  const [choix, setChoix] = useState(effets[0]);
  const plein = lignes.length >= LIGNES_ARTEFACT_MAX;
  const familles = ORDRE_FAMILLES.map((famille) => ({
    famille,
    rangs: lignes.map((_, i) => i).filter((i) => familleArtefact(lignes[i].effet) === famille),
  })).filter((f) => f.rangs.length > 0);
  return (
    <>
      {familles.map(({ famille, rangs }) => (
        <div key={famille} className="flex flex-col gap-3 border-t border-border/60 pt-3 first:border-0 first:pt-0">
          <span className="text-xs font-semibold text-ink-dim">{textes.artefactsCompte.familles[famille]}</span>
          {rangs.map((i) => (
            <LigneArtefactReglage
              key={i}
              ligne={lignes[i]}
              colonnes={colonnes}
              onChange={(l) => onChange(lignes.map((x, k) => (k === i ? l : x)))}
              onRetirer={() => onChange(lignes.filter((_, k) => k !== i))}
            />
          ))}
        </div>
      ))}
      {/* ⚠️ Toujours affiché : au plafond de lignes, désactivé avec la raison. */}
      <div className="flex flex-wrap items-center gap-2">
        <Selecteur
          taille="sm"
          pleineLargeur={false}
          aria-label={t.choisirSecondaire}
          value={String(choix)}
          disabled={plein}
          onChange={(e) => setChoix(Number(e.target.value))}
        >
          {effets.map((c) => (
            <option key={c} value={c}>
              {artifactSubName(c, j)}
            </option>
          ))}
        </Selecteur>
        <Bouton
          taille="sm"
          icone={<Plus size={14} />}
          libelle={t.ajouterSecondaire}
          disabled={plein}
          title={plein ? t.secondairesMax(LIGNES_ARTEFACT_MAX) : undefined}
          onClick={() =>
            onChange([
              ...lignes,
              { effet: choix, seuil: 0, quantites: colonnes.map(() => PRINCIPALES_ARTEFACT.map(() => 0)) },
            ])
          }
        />
      </div>
    </>
  );
}

// Une liste de monstres : un sélecteur pour en ajouter, puis une rangée par
// monstre — portrait, nom, les exemplaires visés pour « à monter », retrait.
// ⚠️ Les listes retiennent l'identifiant com2us (celui de la box), le
// sélecteur rend l'identifiant SWARFARM : on passe par le monstre.
// ⚠️ **Une collaboration est UN monstre** : le sélecteur trouve les deux faces
// (on cherche « Angela » comme « Pure Vanilla Cookie »), la liste inscrit
// l'identifiant commun de la paire (`idObjectifMonstre`), et la rangée montre
// le portrait partagé et les deux noms, comme la carte de la box. Une face
// inscrite écarte l'autre du sélecteur.
function ListeMonstresReglage({
  liste,
  objectifs,
  monstres,
  parCom2us,
  onChange,
}: {
  liste: ListeMonstres;
  objectifs: ObjectifsMonstres;
  monstres: Monster[];
  parCom2us: ReadonlyMap<number, Monster>;
  onChange: (o: ObjectifsMonstres) => void;
}) {
  const t = useTraduction().objectifs.monstres;
  const ids = liste === 'aMonter' ? objectifs.aMonter.map((m) => m.monstre) : objectifs[liste];
  const plein = ids.length >= MONSTRES_MAX;
  const inscrits = new Set(ids.map((id) => (parCom2us.has(id) ? idObjectifMonstre(parCom2us.get(id)!) : id)));
  const deja = new Set(monstres.filter((m) => inscrits.has(idObjectifMonstre(m))).map((m) => String(m.id)));
  const ajouter = (com2usId: number) =>
    onChange(
      liste === 'aMonter'
        ? { ...objectifs, aMonter: [...objectifs.aMonter, { monstre: com2usId, exemplaires: 1 }] }
        : { ...objectifs, [liste]: [...objectifs[liste], com2usId] }
    );
  const retirer = (com2usId: number) =>
    onChange(
      liste === 'aMonter'
        ? { ...objectifs, aMonter: objectifs.aMonter.filter((m) => m.monstre !== com2usId) }
        : { ...objectifs, [liste]: objectifs[liste].filter((id) => id !== com2usId) }
    );
  return (
    <div className="flex flex-col gap-2">
      <span className="label">{t[liste]}</span>
      <span className="text-xs text-ink-dim">{t.aide[liste]}</span>
      {ids.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {ids.map((id, i) => {
            const m = parCom2us.get(id) ?? null;
            const nom = m ? nomObjectifMonstre(m, parCom2us) : `#${id}`;
            const jumeau = m ? jumeauConnu(m, parCom2us) : null;
            return (
              <li key={id} className="flex items-center gap-2.5">
                <MonsterAvatar monster={m} fallback={nom} size={28} titre={nom} collab={jumeau ? { jumeau } : undefined} />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{nom}</span>
                {liste === 'aMonter' && (
                  <NumberField
                    // Largeur du contrôle ENTIER : les deux boutons de 24 px
                    // compris, il reste la place de « 20 ».
                    boxWidth="w-24"
                    value={objectifs.aMonter[i].exemplaires}
                    min={BORNES.exemplaires.min}
                    max={BORNES.exemplaires.max}
                    ariaLabel={t.exemplairesChamp(nom)}
                    onChange={(v) =>
                      onChange({
                        ...objectifs,
                        aMonter: objectifs.aMonter.map((x, k) => (k === i ? { ...x, exemplaires: v ?? BORNES.exemplaires.min } : x)),
                      })
                    }
                  />
                )}
                <BoutonIcone libelle={t.retirer(nom)} icone={<X size={14} />} onClick={() => retirer(id)} />
              </li>
            );
          })}
        </ul>
      )}
      {plein ? (
        <span className="text-xs text-ink-dim">{t.listeMax(MONSTRES_MAX)}</span>
      ) : (
        <MonsterPicker
          monsters={monstres.filter((m) => m.com2usId != null)}
          excludeIds={deja}
          placeholder={t.chercher(t[liste])}
          ariaLabel={t.chercher(t[liste])}
          onPick={(swarfarmId) => {
            const m = monstres.find((x) => String(x.id) === swarfarmId);
            const id = m ? idObjectifMonstre(m) : null;
            if (id != null && !inscrits.has(id)) ajouter(id);
          }}
        />
      )}
    </div>
  );
}

// Le bloc d'une sous-section, rendu seulement sous son onglet ouvert.
// ⚠️ Pas de titre : l'onglet le coiffe et le nomme (`Onglets`) ; un titre
// répété dessous se lirait comme une sous-partie.
function Bloc({
  ouvert,
  titre,
  aide,
  children,
}: {
  ouvert: boolean;
  titre: string;
  aide: string;
  children: React.ReactNode;
}) {
  if (!ouvert) return null;
  return (
    <section aria-label={titre} className="flex flex-col gap-3 rounded-xl border border-border bg-panel px-4 py-3">
      <p className="text-xs leading-relaxed text-ink-dim">{aide}</p>
      {children}
    </section>
  );
}

// Ce que fait la fenêtre des sous-sections, et ce qu'elle propose : à
// l'import, celles du fichier ; aux valeurs par défaut, celles qui en
// diffèrent.
export type Fenetre =
  | { geste: 'exporter' }
  | { geste: 'importer'; lu: ObjectifsPartiels; disponibles: SousSection[] }
  | { geste: 'retablir'; disponibles: SousSection[] };

// La fenêtre qui choisit les sous-sections d'un export, d'un import ou d'un
// retour aux valeurs par défaut. Toutes les disponibles cochées d'office.
// ⚠️ Une sous-section indisponible reste affichée, désactivée, avec sa raison :
// la liste ne change pas de forme d'un geste à l'autre.
export function FenetreSousSections({
  fenetre,
  titres,
  onValider,
  onFermer,
}: {
  fenetre: Fenetre;
  titres: Record<SousSection, string>;
  onValider: (choisies: SousSection[]) => void;
  onFermer: () => void;
}) {
  const textes = useTraduction();
  const t = textes.objectifs.fenetre[fenetre.geste];
  const id = useId();
  const disponibles = fenetre.geste === 'exporter' ? [...SOUS_SECTIONS] : fenetre.disponibles;
  const [choisies, setChoisies] = useState<SousSection[]>(disponibles);
  return (
    <Modale
      onClose={onFermer}
      labelledBy={id}
      titre={t.titre}
      sousTitre={t.texte}
      croix
      actions={
        <>
          <Bouton onClick={onFermer} fond="plein" libelle={textes.commun.annuler} />
          <Bouton
            ton="accent"
            fond="doux"
            libelle={t.action}
            disabled={choisies.length === 0}
            onClick={() => onValider(SOUS_SECTIONS.filter((s) => choisies.includes(s)))}
          />
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        {SOUS_SECTIONS.map((s) => {
          const dispo = disponibles.includes(s);
          return (
            <Case
              key={s}
              disabled={!dispo}
              checked={dispo && choisies.includes(s)}
              onChange={(e) => setChoisies((c) => (e.target.checked ? [...c, s] : c.filter((x) => x !== s)))}
              className="!text-sm !text-ink"
              libelle={
                <span>
                  {titres[s]}
                  {!dispo && 'indisponible' in t && <span className="text-ink-dimmer"> · {t.indisponible}</span>}
                </span>
              }
            />
          );
        })}
      </div>
    </Modale>
  );
}

export default function ReglagesObjectifs({
  monstres = [],
  parCom2us = new Map(),
  ongletInitial = 'efficience',
}: {
  // Les monstres à choisir pour les listes, et l'index de leurs identifiants
  // com2us.
  monstres?: Monster[];
  parCom2us?: ReadonlyMap<number, Monster>;
  // L'onglet ouvert au montage ; ensuite, celui qu'on choisit.
  ongletInitial?: SousSection;
}) {
  const textes = useTraduction();
  const t = textes.objectifs;
  const j = textes.jeu;
  const [onglet, setOnglet] = useState<SousSection>(ongletInitial);
  const [fenetre, setFenetre] = useState<Fenetre | null>(null);
  const titres: Record<SousSection, string> = {
    efficience: t.efficience,
    vitesse: t.vitesse,
    artefacts: t.artefacts,
    monstres: t.monstres.titre,
  };
  const o = useObjectifsCompte();
  const notifier = useNotifier();
  const fichier = useRef<HTMLInputElement>(null);
  const [refus, setRefus] = useState<string | null>(null);

  const ecrire = (v: Partial<ObjectifsCompte>) => setObjectifsCompte({ ...o, ...v });
  // Remplace les sous-sections choisies, et propose de revenir à ce qu'il y
  // avait.
  const remplacer = (source: ObjectifsPartiels, choisies: SousSection[], message: string) => {
    const avant = o;
    setObjectifsCompte(remplacerSousSections(o, source, choisies));
    notifier({ message, action: () => setObjectifsCompte(avant) });
  };
  // Le fichier est lu avant la fenêtre : un fichier refusé ne l'ouvre pas, et
  // elle ne propose que les sous-sections qu'il porte.
  const importer = async (f: File) => {
    const lu = lireFichierObjectifs(await f.text());
    if (!lu.ok) return setRefus(t.refus[lu.raison]);
    setRefus(null);
    setFenetre({ geste: 'importer', lu: lu.objectifs, disponibles: lu.sousSections });
  };
  const aRetablir = sousSectionsDifferentes(o, OBJECTIFS_DEFAUT);
  const valider = (choisies: SousSection[]) => {
    if (!fenetre) return;
    setFenetre(null);
    if (fenetre.geste === 'exporter')
      telechargerTexte(`${PREFIXE_FICHIER}-objectifs-${jourLocal()}.json`, fichierObjectifs(o, choisies));
    else if (fenetre.geste === 'importer') remplacer(fenetre.lu, choisies, t.importes);
    else remplacer(OBJECTIFS_DEFAUT, choisies, t.retablis);
  };

  const colonnesRunes = EMPLACEMENTS.map(String);
  const colonnesVitesse = EMPLACEMENTS_VITESSE.map(String);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-ink-dim">{t.intro}</p>
      <div className="flex flex-wrap gap-2">
        {/* L'icône dit le sens du fichier : il SORT de l'app (↑), il y ENTRE (↓). */}
        <Bouton taille="sm" icone={<Upload size={14} />} libelle={t.exporter} onClick={() => setFenetre({ geste: 'exporter' })} />
        <Bouton taille="sm" icone={<Download size={14} />} libelle={t.importer} onClick={() => fichier.current?.click()} />
        <Bouton
          taille="sm"
          icone={<RotateCcw size={14} />}
          libelle={t.retablir}
          disabled={aRetablir.length === 0}
          onClick={() => setFenetre({ geste: 'retablir', disponibles: aRetablir })}
        />
        <input
          ref={fichier}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = '';
            if (f) void importer(f);
          }}
        />
      </div>
      {refus && (
        <p role="alert" className="text-sm text-bad">
          {refus}
        </p>
      )}
      {fenetre && (
        <FenetreSousSections fenetre={fenetre} titres={titres} onValider={valider} onFermer={() => setFenetre(null)} />
      )}

      {/* ⚠️ Des ONGLETS (`Onglets`) : une sous-section à la fois, et l'onglet
          en est le titre. Export, import et valeurs par défaut restent au-dessus :
          ils valent pour toutes. */}
      <Onglets
        aria-label={t.sousSections}
        valeur={onglet}
        onChange={setOnglet}
        options={SOUS_SECTIONS.map((cle) => ({ cle, libelle: titres[cle] }))}
      />

      <Bloc ouvert={onglet === 'efficience'} titre={titres.efficience} aide={t.efficienceAide}>
        {o.paliers.map((p, i) => {
          const nom = p.nom ?? t.palierParDefaut(i);
          return (
            <div key={i} className="flex flex-col gap-3 border-t border-border/60 pt-3 first:border-0 first:pt-0">
              <div className="flex items-center gap-2">
                <Champ
                  // La clé suit le nom stocké : un import ou un retrait de palier
                  // remonte le champ avec la nouvelle valeur.
                  key={`${i}-${p.nom ?? ''}`}
                  defaultValue={p.nom ?? ''}
                  placeholder={t.palierParDefaut(i)}
                  aria-label={t.nomPalier}
                  pleineLargeur={false}
                  className="w-48"
                  // Trimé à la sortie du champ, jamais à la frappe.
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === (p.nom ?? '')) return;
                    ecrire({
                      paliers: o.paliers.map((x, k) => {
                        if (k !== i) return x;
                        const { nom: _ancien, ...reste } = x;
                        return v ? { ...reste, nom: v } : reste;
                      }),
                    });
                  }}
                />
                <Selecteur
                  taille="sm"
                  pleineLargeur={false}
                  aria-label={t.potentiel}
                  title={t.potentielAide}
                  value={p.potentiel ?? 'heroique'}
                  onChange={(e) =>
                    ecrire({
                      paliers: o.paliers.map((x, k) => (k === i ? { ...x, potentiel: e.target.value as Potentiel } : x)),
                    })
                  }
                >
                  {POTENTIELS.map((v) => (
                    <option key={v} value={v}>
                      {t.potentiels[v]}
                    </option>
                  ))}
                </Selecteur>
                <BoutonIcone
                  libelle={t.retirerPalier(nom)}
                  icone={<X size={14} />}
                  onClick={() => ecrire({ paliers: o.paliers.filter((_, k) => k !== i) })}
                  className="ml-auto"
                />
              </div>
              <ListeSets
                sets={p.sets}
                colonnes={colonnesRunes}
                bornesSeuil={BORNES.efficience}
                suffixe="%"
                seuilNeuf={100}
                onChange={(sets) => ecrire({ paliers: o.paliers.map((x, k) => (k === i ? { ...x, sets } : x)) })}
              />
            </div>
          );
        })}
        <Bouton
          taille="sm"
          trait="pointille"
          icone={<Plus size={14} />}
          libelle={t.ajouterPalier}
          disabled={o.paliers.length >= PALIERS_MAX}
          title={o.paliers.length >= PALIERS_MAX ? t.palierMax(PALIERS_MAX) : undefined}
          onClick={() => ecrire({ paliers: [...o.paliers, { sets: [] }] })}
          className="self-start"
        />
      </Bloc>

      <Bloc ouvert={onglet === 'vitesse'} titre={titres.vitesse} aide={t.vitesseAide}>
        <ListeSets
          sets={o.vitesse}
          colonnes={colonnesVitesse}
          bornesSeuil={BORNES.vitesse}
          seuilNeuf={28}
          onChange={(vitesse) => ecrire({ vitesse })}
        />
      </Bloc>

      <Bloc ouvert={onglet === 'artefacts'} titre={titres.artefacts} aide={t.artefactsAide}>
        {(['attribut', 'type'] as const).map((sorte) => (
          <div key={sorte} className="flex flex-col gap-3">
            <span className="label">{j.sortesArtefact[sorte === 'attribut' ? 'element' : 'archetype']}</span>
            <LignesArtefacts
              sorte={sorte}
              lignes={o.artefacts[sorte]}
              onChange={(lignes) => ecrire({ artefacts: { ...o.artefacts, [sorte]: lignes } })}
            />
          </div>
        ))}
      </Bloc>

      <Bloc ouvert={onglet === 'monstres'} titre={titres.monstres} aide={t.monstres.reglageAide}>
        {LISTES_MONSTRES.map((liste) => (
          <ListeMonstresReglage
            key={liste}
            liste={liste}
            objectifs={o.monstres}
            monstres={monstres}
            parCom2us={parCom2us}
            onChange={(m) => ecrire({ monstres: m })}
          />
        ))}
      </Bloc>
    </div>
  );
}
