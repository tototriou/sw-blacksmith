import { useRef, useState } from 'react';
import { Download, Plus, RotateCcw, Upload, X } from 'lucide-react';
import {
  BORNES,
  COLONNES_ARTEFACT,
  CibleCase,
  EMPLACEMENTS,
  EMPLACEMENTS_VITESSE,
  FILTRES_PRINCIPALE,
  FiltrePrincipale,
  LIGNES_ARTEFACT_MAX,
  LigneArtefact,
  OBJECTIFS_DEFAUT,
  ObjectifSet,
  ObjectifsCompte,
  PALIERS_MAX,
  POTENTIELS,
  Potentiel,
  SETS_OBJECTIFS,
  SorteArtefact,
  TABLEAUX_ARTEFACT_MAX,
  TableauArtefact,
  effetsArtefact,
  fichierObjectifs,
  lireFichierObjectifs,
} from '../lib/objectifsCompte';
import { setObjectifsCompte, useObjectifsCompte } from '../hooks/useObjectifsCompte';
import { ARTIFACT_MAIN, artifactSubName, runeSetIconFilter } from '../lib/effects';
import { jourLocal, telechargerTexte } from '../lib/telechargement';
import { PREFIXE_FICHIER } from '../marque';
import { Bouton, BoutonIcone, Champ, NumberField, Selecteur, useNotifier } from '../ui';
import RuneIcon from './RuneIcon';
import { nomArchetype, nomElement, nomSet } from '../i18n/jeu';
import { useTraduction } from '../hooks/useLangue';

// L'onglet « Objectifs » des Paramètres : ce que le joueur vise, bloc par bloc,
// et l'import / export du réglage. Voir docs/02-app/compte/feat-objectifs.md.
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

// Les tableaux d'une sorte d'artéfact : pour chacun, sa principale (ou
// toutes), puis une ligne par secondaire — sa valeur minimale et la quantité
// visée par élément (ou par style), avec la colonne « Tous ».
function TableauxArtefacts({
  sorte,
  tableaux,
  onChange,
}: {
  sorte: SorteArtefact;
  tableaux: TableauArtefact[];
  onChange: (tableaux: TableauArtefact[]) => void;
}) {
  const textes = useTraduction();
  const t = textes.objectifs;
  const j = textes.jeu;
  const colonnes = COLONNES_ARTEFACT[sorte].map((c) => (sorte === 'attribut' ? nomElement(j, c) : nomArchetype(j, c)));
  const effets = effetsArtefact(sorte);
  const [choix, setChoix] = useState<Record<number, number>>({});
  const principale = (p: FiltrePrincipale) => (p === 0 ? t.toutesPrincipales : j.stats[ARTIFACT_MAIN[p].stat]);
  const changer = (i: number, x: TableauArtefact) => onChange(tableaux.map((y, k) => (k === i ? x : y)));
  return (
    <>
      {tableaux.map((tab, i) => {
        const changerLigne = (k: number, l: LigneArtefact) => changer(i, { ...tab, lignes: tab.lignes.map((y, m) => (m === k ? l : y)) });
        const plein = tab.lignes.length >= LIGNES_ARTEFACT_MAX;
        const aAjouter = choix[i] ?? effets[0];
        return (
          <div key={i} className="flex flex-col gap-2 border-t border-border/60 pt-3 first:border-0 first:pt-0">
            <div className="flex items-center gap-2">
              <Selecteur
                taille="sm"
                pleineLargeur={false}
                aria-label={t.principaleTableau}
                value={String(tab.principale)}
                onChange={(e) => changer(i, { ...tab, principale: Number(e.target.value) as FiltrePrincipale })}
              >
                {FILTRES_PRINCIPALE.map((p) => (
                  <option key={p} value={p}>
                    {principale(p)}
                  </option>
                ))}
              </Selecteur>
              <BoutonIcone
                libelle={t.retirerTableau(principale(tab.principale))}
                icone={<X size={14} />}
                onClick={() => onChange(tableaux.filter((_, k) => k !== i))}
                className="ml-auto"
              />
            </div>
            {tab.lignes.length > 0 && (
              // ⚠️ Au doigt, la grille défile de côté plutôt que d'écraser ses champs.
              <div className="overflow-x-auto">
                <table className="text-xs">
                  <thead>
                    <tr className="text-ink-dim">
                      <th className="pb-1 pr-2 text-left font-normal">{t.secondaire}</th>
                      <th className="px-1 pb-1 text-center font-normal">{t.valeurMin}</th>
                      {colonnes.map((c) => (
                        <th key={c} className="px-1 pb-1 text-center font-normal">
                          {c}
                        </th>
                      ))}
                      <th className="px-1 pb-1 text-center font-normal" title={t.tousAide}>
                        {t.tous}
                      </th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {tab.lignes.map((l, k) => {
                      const nom = artifactSubName(l.effet, j);
                      const commune = l.quantites.every((q) => q === l.quantites[0]) ? l.quantites[0] : null;
                      return (
                        <tr key={k}>
                          <th scope="row" className="max-w-[14rem] truncate pr-2 text-left font-normal text-ink" title={nom}>
                            {nom}
                          </th>
                          <td className="px-0.5 py-0.5">
                            <NumberField
                              sansBoutons
                              boxWidth="w-14"
                              value={l.seuil}
                              min={BORNES.sousPropriete.min}
                              max={BORNES.sousPropriete.max}
                              ariaLabel={`${t.valeurMin} · ${nom}`}
                              onChange={(v) => changerLigne(k, { ...l, seuil: v ?? 0 })}
                            />
                          </td>
                          {l.quantites.map((q, c) => (
                            <td key={c} className="px-0.5 py-0.5">
                              <NumberField
                                sansBoutons
                                boxWidth="w-12"
                                value={q}
                                min={BORNES.quantite.min}
                                max={BORNES.quantite.max}
                                ariaLabel={`${nom} · ${colonnes[c]}`}
                                onChange={(v) =>
                                  changerLigne(k, { ...l, quantites: l.quantites.map((x, m) => (m === c ? v ?? 0 : x)) })
                                }
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
                              ariaLabel={`${nom} · ${t.tous}`}
                              title={t.tousAide}
                              onChange={(v) => v !== null && changerLigne(k, { ...l, quantites: l.quantites.map(() => v) })}
                            />
                          </td>
                          <td className="pl-1">
                            <BoutonIcone
                              libelle={t.retirerSecondaire(nom)}
                              icone={<X size={12} />}
                              onClick={() => changer(i, { ...tab, lignes: tab.lignes.filter((_, m) => m !== k) })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {/* ⚠️ Toujours affiché : au plafond de lignes, désactivé avec la raison. */}
            <div className="flex flex-wrap items-center gap-2">
              <Selecteur
                taille="sm"
                pleineLargeur={false}
                aria-label={t.choisirSecondaire}
                value={String(aAjouter)}
                disabled={plein}
                onChange={(e) => setChoix({ ...choix, [i]: Number(e.target.value) })}
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
                  changer(i, {
                    ...tab,
                    lignes: [...tab.lignes, { effet: aAjouter, seuil: 0, quantites: colonnes.map(() => 0) }],
                  })
                }
              />
            </div>
          </div>
        );
      })}
      <Bouton
        taille="sm"
        trait="pointille"
        icone={<Plus size={14} />}
        libelle={t.ajouterTableau}
        disabled={tableaux.length >= TABLEAUX_ARTEFACT_MAX}
        title={tableaux.length >= TABLEAUX_ARTEFACT_MAX ? t.tableauMax(TABLEAUX_ARTEFACT_MAX) : undefined}
        onClick={() => onChange([...tableaux, { principale: 0, lignes: [] }])}
        className="self-start"
      />
    </>
  );
}

function Bloc({ titre, aide, children }: { titre: string; aide: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-panel px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">{titre}</h2>
        <p className="text-xs leading-relaxed text-ink-dim">{aide}</p>
      </div>
      {children}
    </section>
  );
}

export default function ReglagesObjectifs() {
  const textes = useTraduction();
  const t = textes.objectifs;
  const j = textes.jeu;
  const o = useObjectifsCompte();
  const notifier = useNotifier();
  const fichier = useRef<HTMLInputElement>(null);
  const [refus, setRefus] = useState<string | null>(null);

  const ecrire = (v: Partial<ObjectifsCompte>) => setObjectifsCompte({ ...o, ...v });
  // Remplace tout, et propose de revenir à ce qu'il y avait.
  const remplacer = (v: ObjectifsCompte, message: string) => {
    const avant = o;
    setObjectifsCompte(v);
    notifier({ message, action: () => setObjectifsCompte(avant) });
  };
  const importer = async (f: File) => {
    const lu = lireFichierObjectifs(await f.text());
    if (!lu.ok) return setRefus(t.refus[lu.raison]);
    setRefus(null);
    remplacer(lu.objectifs, t.importes);
  };

  const colonnesRunes = EMPLACEMENTS.map(String);
  const colonnesVitesse = EMPLACEMENTS_VITESSE.map(String);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-ink-dim">{t.intro}</p>
      <div className="flex flex-wrap gap-2">
        <Bouton
          taille="sm"
          icone={<Download size={14} />}
          libelle={t.exporter}
          onClick={() => telechargerTexte(`${PREFIXE_FICHIER}-objectifs-${jourLocal()}.json`, fichierObjectifs(o))}
        />
        <Bouton taille="sm" icone={<Upload size={14} />} libelle={t.importer} onClick={() => fichier.current?.click()} />
        <Bouton
          taille="sm"
          icone={<RotateCcw size={14} />}
          libelle={t.retablir}
          disabled={JSON.stringify(o) === JSON.stringify(OBJECTIFS_DEFAUT)}
          onClick={() => remplacer(OBJECTIFS_DEFAUT, t.retablis)}
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

      <Bloc titre={t.efficience} aide={t.efficienceAide}>
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

      <Bloc titre={t.vitesse} aide={t.vitesseAide}>
        <ListeSets
          sets={o.vitesse}
          colonnes={colonnesVitesse}
          bornesSeuil={BORNES.vitesse}
          seuilNeuf={28}
          onChange={(vitesse) => ecrire({ vitesse })}
        />
      </Bloc>

      <Bloc titre={t.artefacts} aide={t.artefactsAide}>
        {(['attribut', 'type'] as const).map((sorte) => (
          <div key={sorte} className="flex flex-col gap-3">
            <span className="label">{j.sortesArtefact[sorte === 'attribut' ? 'element' : 'archetype']}</span>
            <TableauxArtefacts
              sorte={sorte}
              tableaux={o.artefacts[sorte]}
              onChange={(tableaux) => ecrire({ artefacts: { ...o.artefacts, [sorte]: tableaux } })}
            />
          </div>
        ))}
      </Bloc>
    </div>
  );
}
