import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, Download, FolderInput, Layers, Pencil, Plus, Send, Upload } from 'lucide-react';
import type { Monster } from '../../../types';
import { Bouton, Champ, ConfirmDialog, Jeton, Menu, MobileSheet, Modale, Onglets, PiedDeDialogue, Segmented, Selecteur, type ElementMenu } from '../../../ui';
import MonsterPicker from '../../MonsterPicker';
import MonsterAvatar from '../../MonsterAvatar';
import Pager from '../Pager';
import SelecteurRangement from './SelecteurRangement';
import CarteEquipe from './CarteEquipe';
import EnTeteGroupe from './EnTeteGroupe';
import ModaleGroupe from './ModaleGroupe';
import DetailEquipe from './DetailEquipe';
import AjoutMonstreModale from './AjoutMonstreModale';
import ImportEquipeModale from './ImportEquipeModale';
import NouvelleEquipeModale from './NouvelleEquipeModale';
import { useTraduction } from '../../../hooks/useLangue';
import { useStickyState } from '../../../hooks/useStickyState';
import { SOUS_LG, useMediaQuery } from '../../../hooks/useMediaQuery';
import type { EquipesEnregistreesApi } from '../../../hooks/useEquipesEnregistrees';
import type { ActionImportOptimizer } from '../../../lib/actionImportOptimizer';
import type { ExclusionSourceData } from '../../../lib/optimizerExclusion';
import type { StockageOptimizer } from '../../../lib/optimizerMemberStorage';
import { telechargerTexte } from '../../../lib/telechargement';
import { ecrireFichierEquipes, lireFichierEquipes, nomFichierEquipes } from '../../../lib/equipesFichier';
import {
  creerDepuisEquipeOptimizer, disponibiliteRetourOptimizer, equipeLieeA, lienApresExportOptimizer, liensApresExportGroupe, preparerExportEquipeOptimizer, preparerExportGroupeOptimizer,
  preparerRetourOptimizer, type DemandeEquipeOptimizer, type ExportEquipeOptimizer, type ExportGroupeOptimizer, type RetourOptimizer,
} from '../../../lib/importEquipesEnregistrees';
import { sourcesImportEquipes, type ContexteSourcesEquipes, type SourceEquipement, type SourceImportEquipe } from '../../../lib/sourcesEquipesEnregistrees';
import {
  CATEGORIES_EQUIPES, SOUS_CATEGORIES_EQUIPES, ajouterMonstre, categorieDe, compteParCategorie, compteParOnglet, libelleRangement, libelleSousCategorie, sousCategorieDe,
  appliquerGroupe, conflitsGroupe, creerEquipe, deplacerVersOnglet, dupliquerEquipe, equipesDuGroupe, equipesFiltrees, gesteSurBrouillon, groupesDeLOnglet, nomEquipeLibre, rangement,
  monstresMax, nomGroupeLibre, regrouper, resumeEcarts, tireurIdentifiants, tropDeMonstres,
  type CategorieEquipes, type EquipeEnregistree, type InventaireCompte, type OngletEquipes, type SousCategorieEquipes,
} from '../../../lib/equipesEnregistrees';

// Au-delà, la grille se pagine.
export const EQUIPES_PAR_PAGE = 24;

const tirerIdEquipe = tireurIdentifiants('eq');
const tirerUid = tireurIdentifiants('m');

interface Props {
  api: EquipesEnregistreesApi;
  ctx: ContexteSourcesEquipes;
  // `null` sans compte : ni comparaison, ni imports qui lisent le compte.
  inventaire: InventaireCompte | null;
  allMonsters: Monster[];
  optimizer: { stockage: StockageOptimizer; data: ExclusionSourceData } | null;
  // L'action commune d'import de l'Optimizer, qui l'ouvre après acceptation.
  onImporterOptimizer: ActionImportOptimizer | null;
  // La première équipe créée pose la question de conservation (App).
  onEquipeCreee: () => void;
  // « Enregistrer dans Mes équipes » sur une équipe de l'Optimizer : la mise à
  // jour de l'équipe liée, ou la création d'une nouvelle, à confirmer ici.
  demandeOptimizer?: DemandeEquipeOptimizer | null;
  onDemandeTraitee?: () => void;
  menuOuvert: boolean;
  onFermerMenu: () => void;
}

interface Rapport { titre: string; lignes: string[] }

// La page « Mes équipes » (docs/02-app/compte/feat-equipes.md) : les onglets,
// la recherche par monstre dans l'onglet ouvert, la grille de cartes, le
// détail, les imports et le fichier.
export default function EquipesSection({ api, ctx, inventaire, allMonsters, optimizer, onImporterOptimizer, onEquipeCreee, demandeOptimizer = null, onDemandeTraitee, menuOuvert, onFermerMenu }: Props) {
  const t = useTraduction();
  const e = t.equipes;
  const g = e.groupes;
  const telephone = useMediaQuery(SOUS_LG);
  const idRapport = useId();
  // Onglet ouvert, catégorie filtrée dans chaque onglet et recherche : gardés
  // pour la session, jamais sur le disque.
  const [categorieGardee, setCategorie] = useStickyState<CategorieEquipes>('equipes.categorie', CATEGORIES_EQUIPES[0]);
  const categorie = CATEGORIES_EQUIPES.includes(categorieGardee) ? categorieGardee : CATEGORIES_EQUIPES[0];
  const [filtres, setFiltres] = useStickyState<Partial<Record<CategorieEquipes, string>>>('equipes.filtres', {});
  const sousCategories: readonly SousCategorieEquipes[] = SOUS_CATEGORIES_EQUIPES[categorie];
  const filtreGarde = filtres[categorie];
  const sous = sousCategories.find((x) => x === filtreGarde) ?? null;
  const setSous = (c: CategorieEquipes, x: string | null) => setFiltres((f) => ({ ...f, [c]: x ?? undefined }));
  // Le rangement d'une équipe créée ou importée ici : l'onglet ouvert, dans la
  // catégorie filtrée (aucune sous « Tout »).
  const onglet = rangement(categorie, sous);
  // Montrer une équipe : son onglet, et sa catégorie si une autre est filtrée.
  const setOnglet = (o: OngletEquipes) => {
    const c = categorieDe(o);
    setCategorie(c);
    const x = sousCategorieDe(o);
    if (filtres[c] !== undefined && filtres[c] !== x) setSous(c, x);
  };
  const [rechercheIds, setRechercheIds] = useStickyState<number[]>('equipes.recherche', []);
  const [page, setPage] = useState(0);
  const [ouverte, setOuverte] = useState<string | null>(null);
  // « Nouvelle équipe » : un brouillon, enregistré dès son deuxième monstre ;
  // le fermer avant l'abandonne.
  const [brouillon, setBrouillon] = useState<EquipeEnregistree | null>(null);
  const [ajout, setAjout] = useState(false);
  // « Nouvelle équipe » demande d'abord le nom.
  const [nommage, setNommage] = useState(false);
  const [imports, setImports] = useState(false);
  const [aSupprimer, setASupprimer] = useState<EquipeEnregistree | null>(null);
  // Le groupe formé (`null`) ou modifié depuis la grille.
  const [groupeEdite, setGroupeEdite] = useState<{ groupe: string | null } | null>(null);
  const [groupeASupprimer, setGroupeASupprimer] = useState<string | null>(null);
  // Un déplacement vers un rangement où l'équipe a trop de monstres : à confirmer.
  const [deplacement, setDeplacement] = useState<{ equipe: EquipeEnregistree; onglet: OngletEquipes } | null>(null);
  const [retour, setRetour] = useState<RetourOptimizer | null>(null);
  const [creation, setCreation] = useState<RetourOptimizer | null>(null);
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const vueEquipe = useRef<HTMLDivElement>(null);

  const monstreDe = (com2usId: number) => ctx.monsterByCom2us.get(com2usId);
  const recherche = rechercheIds.map(monstreDe).filter((m): m is Monster => !!m);
  const comptes = useMemo(() => compteParCategorie(api.equipes), [api.equipes]);
  const comptesRangements = useMemo(() => compteParOnglet(api.equipes), [api.equipes]);
  // Les équipes d'un groupe se suivent, sous l'en-tête du groupe.
  const visibles = useMemo(() => regrouper(equipesFiltrees(api.equipes, categorie, sous, recherche, ctx.monsterByCom2us)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api.equipes, categorie, sous, rechercheIds.join(','), ctx.monsterByCom2us]);
  const pages = Math.max(1, Math.ceil(visibles.length / EQUIPES_PAR_PAGE));
  const pageSure = Math.min(page, pages - 1);
  const affichees = visibles.slice(pageSure * EQUIPES_PAR_PAGE, (pageSure + 1) * EQUIPES_PAR_PAGE);
  const equipeOuverte = ouverte ? api.equipes.find((x) => x.id === ouverte) ?? (brouillon?.id === ouverte ? brouillon : null) : null;
  // Refermée, la grille revient sur l'onglet de l'équipe (elle a pu y être déplacée).
  const fermerDetail = () => { if (equipeOuverte) setOnglet(equipeOuverte.onglet); setOuverte(null); setBrouillon(null); };
  const enRelecture = api.relecture === 'en-cours';
  // L'équipe ouverte prend la place de la grille : on la montre depuis son
  // haut, la carte cliquée pouvait être loin dans la grille.
  useEffect(() => {
    if (ouverte) vueEquipe.current?.scrollIntoView?.({ block: 'nearest' });
  }, [ouverte]);

  const ajouterEquipes = (nouvelles: EquipeEnregistree[]) => {
    if (!nouvelles.length) return;
    api.appliquer((l) => [...nouvelles, ...l]);
    onEquipeCreee();
  };
  const changerEquipe = (id: string, f: (x: EquipeEnregistree, maintenant: Date) => EquipeEnregistree) => {
    if (brouillon?.id !== id) return api.appliquer((l) => l.map((x) => (x.id === id ? f(x, new Date()) : x)));
    const r = gesteSurBrouillon(brouillon, f, new Date());
    setBrouillon(r.brouillon);
    if (r.aEnregistrer) ajouterEquipes([r.aEnregistrer]);
  };

  const nouvelle = () => { setNommage(true); onFermerMenu(); };
  const creerBrouillon = (nom: string) => {
    const id = tirerIdEquipe();
    setNommage(false);
    setBrouillon(creerEquipe(id, onglet, nom, new Date()));
    setOuverte(id);
  };

  const exporterFichier = () => {
    const maintenant = new Date();
    telechargerTexte(nomFichierEquipes(maintenant), ecrireFichierEquipes(api.equipes, maintenant));
    onFermerMenu();
  };
  const importerFichier = async (f: File) => {
    const texte = await f.text();
    // Les identifiants pris : les équipes présentes ET les entrées illisibles
    // de la base, qu'un import écraserait.
    const pris = (l: readonly EquipeEnregistree[]) => new Set([...l.map((x) => x.id), ...api.clesReservees]);
    const lu = lireFichierEquipes(texte, pris(api.equipes), tirerIdEquipe);
    if (!lu.ok) return setRapport({ titre: e.fichier.titre, lignes: [e.fichier.refus[lu.raison]] });
    // ⚠️ Les collisions se résolvent contre l'état COURANT, au moment d'ajouter :
    // deux fichiers lus en même temps ne se donnent pas le même identifiant.
    let ajout = lu;
    api.appliquer((l) => {
      const relu = lireFichierEquipes(texte, pris(l), tirerIdEquipe);
      if (!relu.ok) return l;
      ajout = relu;
      return [...relu.equipes, ...l];
    });
    if (ajout.ok) api.signaler(ajout.signalements);
    onEquipeCreee();
    setRapport({ titre: e.fichier.titre, lignes: [e.fichier.ajoutees(lu.equipes.length),
      ...(lu.nouveauxId ? [e.fichier.nouveauxId(lu.nouveauxId)] : []), ...(lu.ignorees ? [e.fichier.ignorees(lu.ignorees)] : [])] });
  };

  const importer = (s: SourceImportEquipe) => {
    setImports(false);
    const cree = s.creer(tirerIdEquipe(), tirerUid, new Date());
    if (!cree) return;
    ajouterEquipes([cree.equipe]);
    setOnglet(cree.equipe.onglet);
    setPage(0);
    setRapport({ titre: e.imports.titre, lignes: [e.imports.cree(cree.equipe.nom, libelleRangement(cree.equipe.onglet, t)),
      ...(cree.ignores ? [e.imports.ignores(cree.ignores)] : [])] });
  };

  const exporterOptimizer = (x: EquipeEnregistree) => {
    if (!onImporterOptimizer || !inventaire) return;
    let prep: ExportEquipeOptimizer | null = null;
    const rapportImport = onImporterOptimizer((data, tt) => {
      prep = preparerExportEquipeOptimizer(x, data, inventaire, tt);
      return prep.proposition;
    });
    const lien = prep && lienApresExportOptimizer(prep, rapportImport);
    if (lien) changerEquipe(x.id, (eq) => ({ ...eq, lienOptimizer: lien }));
  };

  // Le groupe entier, quel que soit le filtre : une liste où ses équipes se
  // partagent les runes. Chaque équipe créée se lie à la sienne.
  const exporterGroupe = (groupe: string) => {
    if (!onImporterOptimizer || !inventaire) return;
    const membres = equipesDuGroupe(api.equipes, categorie, groupe);
    let prep: ExportGroupeOptimizer | null = null;
    const rapportImport = onImporterOptimizer((data, tt) => {
      prep = preparerExportGroupeOptimizer(groupe, membres, data, inventaire, tt);
      return prep.proposition;
    });
    if (!prep) return;
    const liens = new Map(liensApresExportGroupe(prep, rapportImport).map((l, i) => [membres[i].id, l]));
    api.appliquer((l) => l.map((x) => { const lien = liens.get(x.id); return lien ? { ...x, lienOptimizer: lien } : x; }));
  };

  const refusRetour = (x: EquipeEnregistree): string | null => {
    if (!optimizer || !x.lienOptimizer) return e.retour.refus.sansLien;
    // Sans compte relu, les membres Box ne se résolvent pas : rien n'est repris.
    if (!inventaire) return e.retour.sansCompte;
    const r = disponibiliteRetourOptimizer(x, optimizer.stockage, optimizer.data);
    return r ? e.retour.refus[r] : null;
  };
  const demanderRetour = (x: EquipeEnregistree) => {
    const refus = refusRetour(x);
    if (refus || !optimizer || !inventaire) return setRapport({ titre: e.retour.titre, lignes: [refus ?? e.retour.sansCompte] });
    const r = preparerRetourOptimizer(x, optimizer.stockage, optimizer.data, inventaire, tirerUid, new Date());
    if (typeof r === 'string') return setRapport({ titre: e.retour.titre, lignes: [e.retour.refus[r]] });
    setRetour(r);
  };

  // La demande venue de l'Optimizer attend la relecture des équipes : une
  // équipe déjà liée se met à jour, sinon une nouvelle se crée, liée à son tour.
  useEffect(() => {
    if (!demandeOptimizer || enRelecture) return;
    onDemandeTraitee?.();
    const liee = equipeLieeA(api.equipes, demandeOptimizer.listId, demandeOptimizer.equipeId);
    if (liee) {
      setOnglet(liee.onglet);
      demanderRetour(liee);
      return;
    }
    if (!optimizer || !inventaire) return setRapport({ titre: e.creation.titre, lignes: [e.retour.sansCompte] });
    const liste = optimizer.stockage.lists.find((l) => l.id === demandeOptimizer.listId);
    const rang = optimizer.stockage.teams.filter((x) => x.listId === demandeOptimizer.listId).findIndex((x) => x.id === demandeOptimizer.equipeId);
    if (!liste || rang < 0) return setRapport({ titre: e.creation.titre, lignes: [e.retour.refus.equipeAbsente] });
    const r = creerDepuisEquipeOptimizer({ ...demandeOptimizer, nom: nomEquipeLibre(api.equipes, e.nomParDefaut), onglet },
      optimizer.stockage, optimizer.data, inventaire, tirerIdEquipe(), tirerUid, new Date());
    if (typeof r === 'string') return setRapport({ titre: e.creation.titre, lignes: [e.retour.refus[r]] });
    setCreation(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandeOptimizer, enRelecture]);

  const actions = (x: EquipeEnregistree): ElementMenu[] => {
    const c = e.carte;
    const exportImpossible = !inventaire || !onImporterOptimizer ? e.export.sansCompte  : null;
    const retourImpossible = refusRetour(x);
    return [
      { cle: 'ouvrir', libelle: c.ouvrir, onClick: () => setOuverte(x.id) },
      { cle: 'exporter', libelle: c.exporterOptimizer, disabled: exportImpossible !== null, title: exportImpossible ?? undefined, onClick: () => exporterOptimizer(x) },
      { cle: 'retour', libelle: c.mettreAJour, disabled: retourImpossible !== null, title: retourImpossible ?? undefined, onClick: () => demanderRetour(x) },
      { cle: 'dupliquer', libelle: c.dupliquer, onClick: () => ajouterEquipes([dupliquerEquipe(x, tirerIdEquipe(), e.copie(x.nom), tirerUid, new Date())]) },
      // Vers un autre onglet, sans catégorie ; la catégorie se choisit dans le détail.
      ...CATEGORIES_EQUIPES.filter((o) => o !== categorieDe(x.onglet)).map((o) => ({
        cle: `deplacer-${o}`, libelle: c.deplacer(e.categories[o]),
        onClick: () => (tropDeMonstres(x, o) ? setDeplacement({ equipe: x, onglet: o }) : changerEquipe(x.id, (eq, n) => deplacerVersOnglet(eq, o, n))),
      })),
      { cle: 'supprimer', libelle: c.supprimer, danger: true, onClick: () => setASupprimer(x) },
    ];
  };

  const ajouterMonstreChoisi = (com2usId: number, s: SourceEquipement) => {
    if (!equipeOuverte) return;
    setAjout(false);
    changerEquipe(equipeOuverte.id, (eq, n) => ajouterMonstre(eq, { uid: tirerUid(), com2usId, unitId: s.unitId, provenance: s.provenance,
      equipement: s.equipement ? structuredClone(s.equipement) : null }, n) ?? eq);
  };

  const recherchePicker = (
    <MonsterPicker monsters={allMonsters.filter((m) => m.com2usId != null)} placeholder={e.recherche} ariaLabel={e.recherche}
      excludeIds={new Set(recherche.map((m) => String(m.id)))}
      onPick={(id) => {
        const m = allMonsters.find((x) => String(x.id) === id);
        if (m?.com2usId != null && !rechercheIds.includes(m.com2usId)) setRechercheIds([...rechercheIds, m.com2usId]);
        setPage(0);
      }} />
  );
  const jetons = recherche.length > 0 && (
    <div className="flex flex-wrap gap-1.5">
      {recherche.map((m) => (
        <Jeton key={m.com2usId} icone={<MonsterAvatar monster={m} size={18} element={false} />} libelle={m.name}
          libelleRetrait={e.retirerRecherche(m.name)} onRetirer={() => { setRechercheIds(rechercheIds.filter((c) => c !== m.com2usId)); setPage(0); }} />
      ))}
    </div>
  );
  const boutonsImports: ReactNode = (
    <>
      <Bouton icone={<FolderInput size={14} />} libelle={e.importer} pleineLargeur={telephone} onClick={() => { setImports(true); onFermerMenu(); }} />
      <Bouton icone={<Download size={14} />} libelle={e.exporterFichier} pleineLargeur={telephone} disabled={api.equipes.length === 0} onClick={exporterFichier} />
      <Bouton icone={<Upload size={14} />} libelle={e.importerFichier} pleineLargeur={telephone} disabled={enRelecture}
        title={enRelecture ? e.fichier.enLecture : undefined} onClick={() => { fichier.current?.click(); onFermerMenu(); }} />
    </>
  );

  const equipesOnglet = api.equipes.filter((x) => categorieDe(x.onglet) === categorie);
  const groupesOnglet = groupesDeLOnglet(api.equipes, categorie);
  const boutonNouveauGroupe = (
    <Bouton icone={<Layers size={14} />} libelle={g.creer} pleineLargeur={telephone} disabled={equipesOnglet.length === 0}
      title={equipesOnglet.length === 0 ? e.aucune : undefined} onClick={() => setGroupeEdite({ groupe: null })} />
  );
  const nomDe = (com2usId: number) => monstreDe(com2usId)?.name ?? String(com2usId);
  const exportImpossible = !inventaire || !onImporterOptimizer ? e.export.sansCompte : null;

  const detail = equipeOuverte && (
    <DetailEquipe equipe={equipeOuverte} brouillon={brouillon?.id === equipeOuverte.id} onChanger={(f) => changerEquipe(equipeOuverte.id, f)} monstreDe={monstreDe}
      box={ctx.box} inventaire={inventaire} groupes={groupesDeLOnglet(api.equipes, categorieDe(equipeOuverte.onglet))} onAjouter={() => setAjout(true)}
      retour={<Bouton icone={<ChevronLeft size={14} />} libelle={e.detail.retour} onClick={fermerDetail} />}
      // Le brouillon n'est pas encore une équipe : rien à exporter, déplacer ni supprimer.
      menu={brouillon?.id !== equipeOuverte.id && <Menu libelle={e.carte.actions} elements={actions(equipeOuverte).filter((a) => a.cle !== 'ouvrir')} />} />
  );

  return (
    <div className="flex flex-col gap-3">
      <input ref={fichier} type="file" accept=".json,application/json" className="hidden" aria-hidden tabIndex={-1}
        onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) void importerFichier(f); }} />

      <div className="overflow-x-auto">
        {/* Une équipe ouverte montre son onglet ; en changer referme l'équipe. */}
        <Onglets aria-label={e.ongletsAria} valeur={equipeOuverte ? categorieDe(equipeOuverte.onglet) : categorie}
          onChange={(o) => { fermerDetail(); setCategorie(o); setPage(0); }}
          options={CATEGORIES_EQUIPES.map((o) => ({ cle: o, libelle: <>{e.categories[o]} <span className="font-mono text-ink-dimmer">{comptes[o]}</span></> }))} />
      </div>

      {equipeOuverte ? (
        <div ref={vueEquipe} className="scroll-mt-4">
          {detail}
        </div>
      ) : (<>
      {telephone ? (
        <div className="flex flex-col gap-2">
          {recherchePicker}
          {jetons}
          <div className="grid grid-cols-2 gap-2">
            <Bouton icone={<Plus size={14} />} libelle={e.nouvelle} pleineLargeur onClick={nouvelle} />
            {boutonNouveauGroupe}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-72">{recherchePicker}</div>
            <Bouton icone={<Plus size={14} />} libelle={e.nouvelle} onClick={nouvelle} />
            {boutonNouveauGroupe}
            <div className="ml-auto flex flex-wrap gap-2">{boutonsImports}</div>
          </div>
          {jetons}
        </div>
      )}

      {/* Les catégories de l'onglet, filtrables ; sous « Tout », chaque carte
          dit la sienne. Au téléphone un menu : sept crans ne tiendraient pas. */}
      {sousCategories.length > 0 && (telephone ? (
        <Selecteur aria-label={e.filtre.aria} value={sous ?? ''} onChange={(ev) => { setSous(categorie, ev.target.value || null); setPage(0); }}>
          <option value="">{`${e.filtre.tout} (${comptes[categorie]})`}</option>
          {sousCategories.map((x) => (
            <option key={x} value={x}>{`${libelleSousCategorie(categorie, x, t)} (${comptesRangements[rangement(categorie, x)]})`}</option>
          ))}
        </Selecteur>
      ) : (
        <div role="group" aria-label={e.filtre.aria} className="self-start">
          <Segmented<string> value={sous ?? ''} onChange={(v) => { setSous(categorie, v || null); setPage(0); }}
            options={[{ key: '', label: e.filtre.tout, suffix: <span className="font-mono text-ink-dimmer">{comptes[categorie]}</span> },
              ...sousCategories.map((x) => ({ key: x, label: libelleSousCategorie(categorie, x, t),
                suffix: <span className="font-mono text-ink-dimmer">{comptesRangements[rangement(categorie, x)]}</span> }))]} />
        </div>
      ))}

      {api.illisibles > 0 && <p className="text-xs text-warn">{e.illisibles(api.illisibles)}</p>}

      {enRelecture && api.equipes.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-dim">{e.chargement}</p>
      ) : visibles.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-dim">{recherche.length ? e.aucuneRecherche : e.aucune}</p>
      ) : (
        <div className="@container">
          {/* Au-dessus de la grille : dessous, il bougerait avec la hauteur de la page. */}
          {pages > 1 && <div className="mb-3"><Pager page={pageSure} pageCount={pages} onChange={setPage} /></div>}
          <div className="grid grid-cols-1 gap-3 @[640px]:grid-cols-2 @[960px]:grid-cols-3 @[1280px]:grid-cols-4">
            {affichees.map((x, i) => {
              // Chaque bloc s'ouvre sur son en-tête, repris en haut d'une page :
              // les groupes, puis les équipes non groupées (s'il y a un groupe).
              const debut = i === 0 || affichees[i - 1].groupe !== x.groupe;
              const groupe = x.groupe && debut ? x.groupe : null;
              const tout = groupe ? equipesDuGroupe(api.equipes, categorie, groupe) : [];
              const conflits = groupe ? conflitsGroupe(tout) : null;
              return (
                <Fragment key={x.id}>
                  {groupe && conflits && (
                    <EnTeteGroupe nom={groupe} detail={g.equipes(tout.length)} signaux={[
                      ...(conflits.especes.length ? [g.conflitsEspeces(conflits.especes.map(nomDe).join(', '))] : []),
                      ...(conflits.pieces ? [g.conflitsPieces(conflits.pieces)] : [])]}>
                      <Bouton taille="sm" icone={<Pencil size={14} />} libelle={g.modifier} onClick={() => setGroupeEdite({ groupe })} />
                      <Bouton taille="sm" icone={<Send size={14} />} libelle={g.exporter} disabled={exportImpossible !== null}
                        title={exportImpossible ?? undefined} onClick={() => exporterGroupe(groupe)} />
                    </EnTeteGroupe>
                  )}
                  {!x.groupe && debut && visibles.some((v) => v.groupe) && <EnTeteGroupe nom={g.sansGroupe} />}
                  <CarteEquipe equipe={x} monstreDe={monstreDe} ecarts={inventaire ? resumeEcarts(x, inventaire) : null}
                    speedTuneIncomplet={api.signalements.some((sg) => sg.id === x.id && sg.signalements.includes('speedTuneIncomplet'))}
                    categorie={sous === null && sousCategorieDe(x.onglet) ? libelleSousCategorie(categorie, sousCategorieDe(x.onglet)!, t) : null}
                    alerte={tropDeMonstres(x) ? e.carte.tropDeMonstres(x.monstres.length, monstresMax(x.onglet)) : null}
                    actions={actions(x)} onOuvrir={() => setOuverte(x.id)} />
                </Fragment>
              );
            })}
          </div>
        </div>
      )}
      </>)}

      {telephone && (
        <MobileSheet ouvert={menuOuvert} onFermer={onFermerMenu} titre={e.options}>
          <div className="flex flex-col gap-2">{boutonsImports}</div>
        </MobileSheet>
      )}

      {nommage && (
        <NouvelleEquipeModale nomParDefaut={nomEquipeLibre(api.equipes, e.nomParDefaut)} onCreer={creerBrouillon} onFermer={() => setNommage(false)} />
      )}
      {ajout && equipeOuverte && (
        <AjoutMonstreModale monstres={allMonsters} ctx={ctx} onChoisir={ajouterMonstreChoisi} onFermer={() => setAjout(false)} />
      )}
      {imports && (
        <ImportEquipeModale sources={sourcesImportEquipes(ctx, optimizer, inventaire ?? { runes: new Map(), artefacts: new Map(), reliques: new Map() }, onglet, t)}
          onChoisir={importer} onFermer={() => setImports(false)} />
      )}
      {groupeEdite && (
        <ModaleGroupe equipes={regrouper(equipesOnglet)} groupe={groupeEdite.groupe}
          nomParDefaut={nomGroupeLibre(groupesOnglet, g.nomParDefaut)} autresGroupes={groupesOnglet.filter((x) => x !== groupeEdite.groupe)}
          onFermer={() => setGroupeEdite(null)}
          onSupprimer={() => { setGroupeASupprimer(groupeEdite.groupe); setGroupeEdite(null); }}
          onValider={(nom, ids) => {
            setGroupeEdite(null);
            api.appliquer((l) => appliquerGroupe(l, categorie, groupeEdite.groupe, nom, ids, new Date()));
          }} />
      )}
      {groupeASupprimer !== null && (
        <ConfirmDialog titre={g.supprimer.titre} message={g.supprimer.message(groupeASupprimer)} libelleAction={g.supprimer.action} destructif
          onCancel={() => setGroupeASupprimer(null)}
          onConfirm={() => {
            const nom = groupeASupprimer;
            setGroupeASupprimer(null);
            api.appliquer((l) => appliquerGroupe(l, categorie, nom, '', new Set(), new Date()));
          }} />
      )}
      {deplacement && (
        <ConfirmDialog titre={e.taille.deplacer.titre} libelleAction={e.taille.deplacer.action}
          message={e.taille.deplacer.message(deplacement.equipe.nom, deplacement.equipe.monstres.length, libelleRangement(deplacement.onglet, t), monstresMax(deplacement.onglet))}
          onCancel={() => setDeplacement(null)}
          onConfirm={() => { const { equipe: x, onglet: o } = deplacement; setDeplacement(null); changerEquipe(x.id, (eq, n) => deplacerVersOnglet(eq, o, n)); }} />
      )}
      {aSupprimer && (
        <ConfirmDialog titre={e.suppression.titre} message={e.suppression.message(aSupprimer.nom)} libelleAction={e.suppression.action} destructif
          onCancel={() => setASupprimer(null)}
          onConfirm={() => { const id = aSupprimer.id; setASupprimer(null); if (ouverte === id) setOuverte(null); api.appliquer((l) => l.filter((x) => x.id !== id)); }} />
      )}
      {retour && (
        <ConfirmDialog titre={e.retour.titre} libelleAction={e.retour.action}
          message={<LignesRetour retour={retour} />}
          onCancel={() => setRetour(null)}
          onConfirm={() => { const r = retour; setRetour(null); changerEquipe(r.equipe.id, () => r.equipe); setRapport({ titre: e.retour.titre, lignes: [e.retour.fait(r.equipe.nom)] }); }} />
      )}
      {creation && (
        <ConfirmationCreation creation={creation} onChanger={setCreation} onAnnuler={() => setCreation(null)}
          onConfirmer={(x) => {
            setCreation(null);
            ajouterEquipes([x]);
            setOnglet(x.onglet);
            setPage(0);
            setRapport({ titre: e.creation.titre, lignes: [e.imports.cree(x.nom, libelleRangement(x.onglet, t))] });
          }} />
      )}
      {rapport && (
        <Modale onClose={() => setRapport(null)} labelledBy={idRapport} titre={rapport.titre}
          actions={<PiedDeDialogue><Bouton ton="accent" fond="plein" libelle={t.commun.fermer} onClick={() => setRapport(null)} /></PiedDeDialogue>}>
          <ul className="flex flex-col gap-1 text-sm text-ink">{rapport.lignes.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </Modale>
      )}
    </div>
  );
}

// « Enregistrer dans Mes équipes » sur une équipe de l'Optimizer qu'aucune
// équipe enregistrée ne suit : son onglet se choisit (le contenu d'une liste de
// l'Optimizer ne le désigne pas), l'onglet ouvert par défaut.
export function ConfirmationCreation({ creation, onChanger, onAnnuler, onConfirmer }: {
  creation: RetourOptimizer; onChanger: (r: RetourOptimizer) => void; onAnnuler: () => void; onConfirmer: (e: EquipeEnregistree) => void;
}) {
  const t = useTraduction();
  const e = t.equipes;
  const o = creation.equipe.onglet;
  // Le nom proposé (« Équipe N ») : repris si le champ est laissé vide.
  const [nomParDefaut] = useState(creation.equipe.nom);
  const [nom, setNom] = useState(creation.equipe.nom);
  return (
    <ConfirmDialog titre={e.creation.titre} libelleAction={e.creation.action}
      message={<div className="flex flex-col gap-3">
        <p>{e.creation.message}</p>
        <label className="flex flex-col gap-1 text-xs text-ink-dim">
          {e.creation.nom}
          <Champ value={nom} onChange={(ev) => setNom(ev.target.value)} onBlur={() => setNom((v) => v.trim())} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-dim">
          {e.creation.onglet}
          <SelecteurRangement valeur={o} onChange={(onglet) => onChanger({ ...creation, equipe: { ...creation.equipe, onglet } })} />
        </label>
        {tropDeMonstres(creation.equipe) && (
          <p role="status" className="text-xs text-warn">{e.taille.trop(creation.equipe.monstres.length, libelleRangement(o, t), monstresMax(o))}</p>
        )}
        <LignesRetour retour={creation} resume={false} />
      </div>}
      onCancel={onAnnuler} onConfirm={() => onConfirmer({ ...creation.equipe, nom: nom.trim() || nomParDefaut })} />
  );
}

// Ce que la mise à jour change, et chaque pièce manquante avec son monstre.
function LignesRetour({ retour, resume = true }: { retour: RetourOptimizer; resume?: boolean }) {
  const r = useTraduction().equipes.retour;
  const lignes = [
    ...retour.manquantes.map((m) => r.manquante(m.libelle, r.pieces[m.type], m.id)),
    ...retour.reliquesGardees.map(r.reliqueGardee),
    ...retour.artefactsGardes.map(r.artefactsGardes),
    ...retour.copiesAmbigues.map((c) => r.ambigue(r.pieceN(r.pieces[c.type], c.id))),
    ...retour.retires.map(r.retire),
  ];
  return (
    <div className="flex flex-col gap-2">
      {resume && <p>{r.resume(retour.monstresChanges, retour.piecesChangees)}</p>}
      {lignes.length > 0 && <ul className="flex list-disc flex-col gap-1 pl-4 text-xs">{lignes.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  );
}
