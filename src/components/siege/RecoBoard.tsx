import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Download, Upload, Trash2, AlertTriangle, XCircle, X, ArrowLeft } from 'lucide-react';
import { IconeRecos } from '../IconesAtelier';
import { Monster, Reco, RecoDeck, RecoPayload } from '../../types';
import { UseRecoState } from '../../hooks/useSiegeRecos';
import { UseSiegeState } from '../../hooks/useSiegeState';
import { useStickyState } from '../../hooks/useStickyState';
import { teamSummary, isTeamUsable, deckFromEquipeEnregistree, equipeProposable } from '../../lib/recoFromSiege';
import { categorieDe, libelleRangement, type EquipeEnregistree } from '../../lib/equipesEnregistrees';
import type { EquipeChoix } from './AjoutCounter';
import { encodeRecosJson, validateRecosImport, ImportReport, slugify } from '../../lib/recoShare';
import { appliquerImport, BilanImport, messageFusion, trouverCorrespondances } from '../../lib/recoFusion';
import ChoixFusionRecos from './ChoixFusionRecos';
import { contexteConfrontationReco, matchReco, RecoMatch } from '../../lib/recoMatch';
import { chercheMonstre, type RecoHit, type TriRecherche } from '../../lib/recoSearch';
import { defensesDesRecos, type VueRecos } from '../../lib/recoDefenses';
import { ConfirmDialog } from '../../ui/Dialogs';
import { useTraduction } from '../../hooks/useLangue';
import { OwnedBuild, OwnedTeam } from '../../lib/ownedBuilds';
import { formesJouables } from '../../lib/monsterForms';
import { telechargerTexte } from '../../lib/telechargement';
import Segmented from '../../ui/Segmented';
import MobileSheet from '../../ui/MobileSheet';
import MonsterAvatar from '../MonsterAvatar';
import MonsterPicker from '../MonsterPicker';
import RecoCard from './RecoCard';
import VoletDefenses from './VoletDefenses';
import ListeRecos from './ListeRecos';
import { BarreActions, Bouton, BoutonIcone, Interrupteur, ZoneCliquable } from '../../ui';
import { PREFIXE_FICHIER } from '../../marque';
import type { ActionImportOptimizer } from '../../lib/actionImportOptimizer';
import type { ExclusionSourceData } from '../../lib/optimizerExclusion';
import { importerRecoOptimizer } from '../../lib/importRecoOptimizer';
import { useDiscord } from '../../hooks/useDiscord';
import { basculerSalonFavori } from '../../hooks/useReglagesDiscord';
import { useNotifier } from '../../ui/Notification';
import { estBureau } from '../../lib/bureau';
import { fusionEnAttente, type Fusion } from '../../lib/recoDiscord';
import {
  etatAffiche, groupesSalons, provenanceValide, recosDeProvenance, recosFavorites, salonsDePublication, TOUTES,
  type Provenance, type SalonDePublication,
} from '../../lib/provenancesRecos';
import type { VersionSalon } from '../../types';
import { ColonneProvenances, ProvenancesTelephone, type PropsProvenances } from './discord/Provenances';
import BandeauSalon from './discord/BandeauSalon';
import {
  DialogueCodeBureau, DialogueCodeSite, DialogueConnexion, DialogueFusion, DialogueInstallation, DialoguePublierDans,
} from './discord/DialoguesDiscord';

interface Props {
  onImporterEquipe: ActionImportOptimizer;
  sourcesOptimizer: ExclusionSourceData;
  compteCharge: boolean;
  recos: UseRecoState;
  monsters: Monster[];
  builds: OwnedBuild[]; // tous les builds connus (box + RTA + siège) → « je possède ce monstre »
  teams: OwnedTeam[]; // équipes réellement composées → « j'ai un deck avec ces monstres »
  // Exemplaires 6★ possédés, par com2usId → « combien de fois puis-je monter ce
  // deck en parallèle ». Vient de la BOX seule (voir countCopiesByCom2us).
  copies6: Map<number, number>;
  offense: UseSiegeState; // équipes d'attaque de siège, réutilisables comme decks
  // Les équipes de « Mes équipes », elles aussi point de départ d'un counter.
  equipesEnregistrees: EquipeEnregistree[];
  // Panneau d'actions mobile — piloté par le bouton « Options » (voir App.tsx).
  menuOuvert: boolean;
  onFermerMenu: () => void;
}

// ⚠️ **Deux VUES des mêmes recommandations, et UN seul choix** :
// - Défenses : chaque défense visée, toutes recommandations confondues, et qui
//   la bat (VoletDefenses.tsx) ;
// - Decks : les cartes des recommandations, leurs decks, l'édition.
// La vue décide AUSSI où cherche le champ (les défenses visées, ou les monstres
// des decks) : la vue Attaque/Défense et le rôle Partout/Défense à taper/
// Offense à runer disaient deux fois la même chose, et se contredisaient
// (vue Défense + Offense à runer). Libellés : `recos.vues` du dictionnaire.
const VUES: VueRecos[] = ['defense', 'attaque'];
const MODE_DE = { defense: 'defense', attaque: 'offense' } as const;
const AUTRE: Record<VueRecos, VueRecos> = { defense: 'attaque', attaque: 'defense' };

// Le message quand la recherche ne renvoie rien nomme la vue où l'on vient de
// chercher, et renvoie vers l'autre quand elle a des résultats.
// ⚠️ Formulé au SINGULIER et sans accord à porter par la suite de la phrase
// (« … ne réunit X », « … ne contient X ») : le libellé change, pas la
// grammaire autour.

export default function RecoBoard({
  onImporterEquipe,
  sourcesOptimizer,
  compteCharge,
  recos,
  monsters,
  builds,
  teams,
  copies6,
  offense,
  equipesEnregistrees,
  menuOuvert,
  onFermerMenu,
}: Props) {
  const textes = useTraduction();
  const r = textes.recos;
  // Pourquoi un deck ne part pas dans l'Optimizer (`undefined` : il part).
  // ⚠️ **À la lecture, mémorisé par deck** (identité de l'objet, comme la
  // confrontation) : calculé pour TOUS les decks de TOUTES les recos à chaque
  // modification, il faisait ramer la page dès qu'on notait ou tapait — un
  // lot de salon Discord compte des centaines de decks. Seules les lignes
  // affichées le demandent ; un deck inchangé garde son résultat.
  const raisonExportDe = useMemo(() => {
    const cache = new WeakMap<RecoDeck, { raison: string | undefined }>();
    return (deck: RecoDeck): string | undefined => {
      if (!compteCharge) return r.exportSansCompte;
      let c = cache.get(deck);
      if (!c) {
        c = { raison: importerRecoOptimizer(deck, sourcesOptimizer, textes).membres.length ? undefined : r.exportDeckVide };
        cache.set(deck, c);
      }
      return c.raison;
    };
  }, [r, sourcesOptimizer, compteCharge, textes]);
  // Mémorisée comme l'était le filtre qu'elle remplace : on retrouve la vue
  // qu'on avait choisie. Clé NEUVE — l'ancienne (`recos.filter`) portait une
  // origine, pas une vue.
  // À l'arrivée : Défenses, la question qu'on se pose devant une défense
  // rencontrée (« qui la bat ? »).
  const [vue, setVue] = useStickyState<VueRecos>('recos.vue', 'defense');
  // Recherche par monstre : jusqu'à TROIS, autant qu'une composition.
  //
  // ⚠️ Les trois se cumulent en ET (voir recoSearch.ts) : on décrit la défense
  // qu'on affronte, monstre par monstre, et chaque ajout précise au lieu
  // d'élargir. D'où trois champs et non un seul où l'on séparerait par des
  // espaces — un nom du jeu en contient (« Dark Cow Girl »), la séparation
  // serait donc ambiguë.
  // ⚠️ On stocke les NOMS, pas des `com2usId` : la recherche compare des noms
  // (voir recoSearch.ts), et un monstre d'une reco importée peut être absent des
  // données chargées — il ne porterait alors aucun id local.
  const [queries, setQueries] = useStickyState<string[]>('recos.queries', ['', '', '']);
  const searchMode = MODE_DE[vue];
  // Le rangement des offenses d'une défense, dans son volet : par
  // recommandation, ou par fiabilité.
  const [triRecherche, setTriRecherche] = useStickyState<TriRecherche>('recos.tri', 'ordre');
  // « Confronter à mon compte » : les verdicts sur tous les decks de la page,
  // ou nulle part. Remplace l'analyse à la demande, carte par carte.
  const [confronter, setConfronter] = useStickyState<boolean>('recos.confronter', false);
  const termesPoses = queries.map((q) => q.trim()).filter(Boolean);
  const aUneRecherche = termesPoses.length > 0;
  // Vide les trois cases d'un coup.
  const effacerRecherche = () => setQueries(['', '', '']);
  // Pose un monstre dans la PREMIÈRE case libre : un seul champ sert les trois,
  // on enchaîne donc les noms sans avoir à viser une case avant chaque saisie.
  const poserMonstre = (nom: string) =>
    setQueries((cur) => {
      const i = cur.findIndex((q) => !q.trim());
      if (i < 0) return cur; // les trois sont prises
      return cur.map((q, k) => (k === i ? nom : q));
    });
  // Retire un monstre. ⚠️ Les cases restantes ne sont PAS tassées : chacune garde
  // sa place, sinon les portraits sautent d'une case à l'autre sous le curseur.
  const retirerMonstre = (i: number) =>
    setQueries((cur) => cur.map((q, k) => (k === i ? '' : q)));
  const casesPleines = queries.every((q) => q.trim());
  // ⚠️ LA MÊME liste que celle du sélecteur (voir lib/monsterForms.ts) : les
  // cases doivent afficher le portrait de la forme réellement proposée, pas
  // celui d'une homonyme non éveillée restée dans les données brutes.
  const monstresJouables = useMemo(() => formesJouables(monsters), [monsters]);
  // Ids locaux des monstres déjà posés, pour les retirer des suggestions.
  const dejaPoses = useMemo(() => {
    const noms = new Set(queries.filter(Boolean));
    const ids = new Set<string>();
    for (const m of monstresJouables) if (noms.has(m.name)) ids.add(String(m.id));
    return ids;
  }, [queries, monstresJouables]);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  // Rapport de validation du dernier import : NON éphémère (il faut pouvoir le lire).
  const [report, setReport] = useState<ImportReport | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // ⚠️ **Vue Decks : UNE recommandation ouverte à la fois**, celle qu'on
  // choisit dans la liste (la première tant qu'on n'en a pas choisi). Étroit
  // (téléphone, fenêtre étroite), la liste, puis la recommandation touchée à
  // sa place, avec un retour (`detailDecks`).
  const [choixReco, setChoixReco] = useState<string | null>(null);
  const [detailDecks, setDetailDecks] = useState(false);
  const voletDecks = useRef<HTMLDivElement>(null);
  const choisirReco = (id: string) => {
    setChoixReco(id);
    setDetailDecks(true);
    // Étroit, le volet remplace la liste : on remonte à son début. Créée ou
    // ouverte en édition depuis la vue Défenses, la recommandation est là où
    // l'on regarde.
    requestAnimationFrame(() => {
      const el = voletDecks.current;
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
    });
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const [effacementAConfirmer, setEffacementAConfirmer] = useState(false);

  // Message éphémère (même convention que l'import de compte).
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.error ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [msg]);

  const monsterByCom2us = useMemo(() => {
    const m = new Map<number, Monster>();
    for (const mon of monsters) if (mon.com2usId != null) m.set(mon.com2usId, mon);
    return m;
  }, [monsters]);

  // Index par id local : c'est ce que référencent les slots de siège.
  const monsterById = useMemo(() => {
    const m = new Map<string, Monster>();
    for (const mon of monsters) m.set(String(mon.id), mon);
    return m;
  }, [monsters]);

  // Équipes d'offense proposables comme point de départ d'un deck (celles qui
  // contiennent au moins un monstre partageable).
  const offenseTeams = useMemo(
    () =>
      offense.state.teams
        .map((team, index) => ({
          team,
          index,
          summary: teamSummary(team, monsterById, textes.siege.equipeVide),
          monsters: team.slots.map((s) => (s.monsterId ? monsterById.get(s.monsterId) ?? null : null)),
        }))
        .filter(({ team }) => isTeamUsable(team, monsterById)),
    [offense.state.teams, monsterById, textes.siege.equipeVide]
  );

  // Les équipes de « Mes équipes » proposables comme counter : les offenses de
  // siège d'abord, puis le reste du combat de guilde, puis les autres contenus
  // (tri stable : l'ordre de « Mes équipes » dans chaque rang). Le deck n'est
  // construit qu'au clic (`creer`).
  const equipesChoix = useMemo<EquipeChoix[]>(() => {
    const rang = (e: EquipeEnregistree) => (e.onglet === 'guilde/offense-siege' ? 0 : categorieDe(e.onglet) === 'guilde' ? 1 : 2);
    return equipesEnregistrees
      .filter((e) => equipeProposable(e, monsterByCom2us))
      .sort((a, b) => rang(a) - rang(b))
      .map((e) => {
        const ordre = e.leader
          ? [...e.monstres.filter((m) => m.uid === e.leader), ...e.monstres.filter((m) => m.uid !== e.leader)]
          : e.monstres;
        const trio = ordre.slice(0, 3).map((m) => monsterByCom2us.get(m.com2usId) ?? null);
        return {
          id: e.id,
          nom: e.nom,
          rangement: libelleRangement(e.onglet, textes),
          monstres: trio,
          resume: [e.nom, ...trio.map((m) => m?.name ?? '')].join(' · '),
          creer: () => deckFromEquipeEnregistree(e, monsterByCom2us),
        };
      });
  }, [equipesEnregistrees, monsterByCom2us, textes]);

  const matchCtx = useMemo(
    () => contexteConfrontationReco(builds, teams, copies6),
    [builds, teams, copies6]
  );

  // ⚠️ **Confrontation de toute la page, tenue à jour seule** : le résultat de
  // chaque recommandation est mémorisé par IDENTITÉ (une édition recrée
  // l'objet, un autre compte recrée le contexte) — rien n'est recalculé tant
  // que rien ne change, et aucun résultat n'est jamais « périmé ». Calculé à
  // la lecture : seules les recommandations affichées le sont.
  const peutConfronter = builds.length > 0;
  const actif = confronter && peutConfronter;
  const confronterReco = useMemo(() => {
    const cache = new WeakMap<Reco, RecoMatch>();
    return (reco: Reco) => {
      let m = cache.get(reco);
      if (!m) {
        m = matchReco(reco, matchCtx);
        cache.set(reco, m);
      }
      return m;
    };
  }, [matchCtx]);
  const matchOf = (reco: Reco): RecoMatch | null => (actif ? confronterReco(reco) : null);

  // ⚠️ **Confirmation avant l'export**, même s'il ne détruit rien sur place :
  // c'est un geste vers l'EXTÉRIEUR (un fichier qui part sur le disque, prêt à
  // être partagé), et la confirmation dit CE QUI VA SORTIR — combien de
  // recommandations, combien de decks — avant que ça parte, plutôt qu'un
  // message après coup qu'on ne lit qu'une fois le fichier déjà écrit.
  const [exportAConfirmer, setExportAConfirmer] = useState<{
    list: Reco[];
    label: string;
    usable: Reco[];
    decks: number;
  } | null>(null);

  function requestExport(list: Reco[], label: string) {
    // Une reco n'est exportable que si au moins un de ses decks a un monstre.
    const usable = list.filter((r) =>
      r.decks.some((d) => d.slots.some((s) => s.com2usId != null))
    );
    if (usable.length === 0) {
      // Rien à confirmer : l'export échouerait de toute façon.
      setMsg({ text: r.rienAExporter, error: true });
      return;
    }
    const decks = usable.reduce(
      (n, r) => n + r.decks.filter((d) => d.slots.some((s) => s.com2usId != null)).length,
      0
    );
    setExportAConfirmer({ list, label, usable, decks });
  }

  function handleExport() {
    if (!exportAConfirmer) return;
    const { usable, label, decks } = exportAConfirmer;
    // Un seul format ET un seul support : le fichier .json. Plus de copie au
    // presse-papier — l'import ne lit que des fichiers, un contenu collé
    // n'aurait nulle part où aller.
    telechargerTexte(`${PREFIXE_FICHIER}-reco-${slugify(label)}.json`, encodeRecosJson(usable));
    setMsg({ text: r.exportees(usable.length, decks) });
    setExportAConfirmer(null);
  }

  // JSON uniquement, et **par fichier uniquement** : pas de zone de collage.
  // Une recommandation se transmet comme une pièce jointe ; un champ de texte
  // libre n'apportait qu'une seconde voie à valider et à expliquer.
  // Le contenu est VALIDÉ :
  // rien n'est importé en cas d'erreur bloquante, et les corrections appliquées
  // sont remontées à l'utilisateur.
  function applyImport(text: string) {
    const rep = validateRecosImport(text, textes);

    // Monstres absents des données chargées : signalés ici (le validateur de
    // format ne connaît pas le bestiaire).
    if (rep.recos) {
      const inconnus = new Set<number>();
      for (const r of rep.recos)
        for (const d of r.decks)
          for (const s of d.slots)
            if (s.com2usId != null && !monsterByCom2us.has(s.com2usId)) inconnus.add(s.com2usId);
      if (inconnus.size > 0) {
        rep.warnings.push(
          r.inconnus(inconnus.size, `${[...inconnus].slice(0, 5).join(', ')}${inconnus.size > 5 ? '…' : ''}`)
        );
      }
    }

    setReport(rep);
    if (!rep.recos) return; // erreurs bloquantes : on n'importe rien

    // Le fichier complète-t-il une recommandation qu'on a déjà ? Alors on
    // DEMANDE : fusionner ou ajouter à part (ChoixFusionRecos). Sinon, rien à
    // choisir, l'import ajoute comme toujours.
    const cibles = trouverCorrespondances(all, rep.recos);
    const paires = rep.recos.flatMap((entrante, i) => {
      const existante = cibles[i];
      return existante ? [{ entrante, existante }] : [];
    });
    if (paires.length > 0) {
      const apercu = appliquerImport(all, rep.recos, true, () => '', monsterByCom2us).bilan;
      setFusionAProposer({ recos: rep.recos, counts: rep.counts, paires, apercu });
      return;
    }
    importer(rep.recos, rep.counts, false);
  }

  // Un import ne remplace jamais : il ajoute à la suite, ou fusionne dans la
  // recommandation qu'il complète, qui n'y perd rien. Les recommandations sont
  // du contenu créé à la main, non re-dérivable. Pour repartir de zéro,
  // « Tout effacer » est là — c'est un geste explicite et séparé.
  function importer(payloads: RecoPayload[], counts: ImportReport['counts'], fusionner: boolean) {
    const bilan = recos.importRecos(payloads, fusionner, monsterByCom2us);
    setMsg({
      text: fusionner
        ? messageFusion(bilan, textes)
        : r.importees(bilan.recosAjoutees, counts.decks, counts.monstres),
    });
  }
  const [fusionAProposer, setFusionAProposer] = useState<{
    recos: RecoPayload[];
    counts: ImportReport['counts'];
    paires: { entrante: RecoPayload; existante: Reco }[];
    apercu: BilanImport;
  } | null>(null);

  const all = recos.state.recos;

  // ── Synchronisation Discord et provenances ──────────────────────────────
  // (docs/02-app/siege/feat-recommandations/rendu-de-la-page.md, « Provenances »)
  const td = textes.recosDiscord;
  const notifier = useNotifier();
  const discord = useDiscord(recos);
  const connecte = discord.etat.utilisateur !== null && discord.etat.statut !== 'inactif';
  // Les favoris n'existent que dans l'application de bureau.
  const favorisActifs = estBureau();
  const groupes = useMemo(
    () => groupesSalons(all, discord.etat.sources?.serveurs ?? null, favorisActifs ? discord.favoris : []),
    [all, discord.etat.sources, discord.favoris, favorisActifs]
  );
  // À l'arrivée sur la page : « Toutes les recommandations » (décision du
  // 2026-11-09). Un salon qui disparaît y ramène.
  const [provenanceChoisie, setProvenance] = useState<Provenance>(TOUTES);
  const provenance = provenanceValide(provenanceChoisie, groupes, favorisActifs);
  const deLaProvenance = useMemo(() => recosDeProvenance(all, provenance, groupes), [all, provenance, groupes]);
  const [enCours, setEnCours] = useState(false);
  const [connexionOuverte, setConnexionOuverte] = useState(false);
  const [installationOuverte, setInstallationOuverte] = useState(false);
  const [aPublierDans, setAPublierDans] = useState<Reco | null>(null);
  const [aRemplacer, setARemplacer] = useState<{ reco: Reco; salon: SalonDePublication; version: VersionSalon | null } | null>(null);
  const [aDetacher, setADetacher] = useState<Reco | null>(null);
  const [aFusionner, setAFusionner] = useState<{ reco: Reco; fusion: Fusion } | null>(null);

  const ouvrirFusion = (reco: Reco) => {
    const fusion = fusionEnAttente(reco, monsterByCom2us);
    if (fusion) setAFusionner({ reco, fusion });
  };
  // Le salon a changé pendant qu'on modifiait : la fusion s'ouvre dès que la
  // version reçue est dans l'état (un rendu après la réponse du service).
  const [fusionDemandee, setFusionDemandee] = useState<string | null>(null);
  useEffect(() => {
    if (!fusionDemandee) return;
    const r = all.find((x) => x.id === fusionDemandee);
    if (r?.lien?.enAttente) ouvrirFusion(r);
    setFusionDemandee(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, fusionDemandee]);
  async function publierLiee(reco: Reco) {
    setEnCours(true);
    const type = await discord.publier(reco);
    setEnCours(false);
    if (type === 'conflit') setFusionDemandee(reco.id);
  }
  async function publierDansSalon(reco: Reco, salon: SalonDePublication, base: string | null) {
    setEnCours(true);
    const r = await discord.publierDans(reco, salon, base);
    setEnCours(false);
    setAPublierDans(null);
    setARemplacer(null);
    // Le salon porte déjà une recommandation : la remplacer se confirme.
    if (r.type === 'conflit') setARemplacer({ reco, salon, version: r.version });
  }
  const propsProvenances: PropsProvenances = {
    groupes,
    compteToutes: all.length,
    compteAppareil: all.filter((x) => !x.lien).length,
    compteSuivis: groupes.reduce((n, g) => n + g.salons.length, 0),
    compteFavoris: recosFavorites(groupes).length,
    provenance,
    onChoisir: setProvenance,
    discord: discord.etat,
    favoris: favorisActifs,
    onFavori: basculerSalonFavori,
    onConnecter: () => setConnexionOuverte(true),
    onActualiser: () => void discord.actualiser(),
    onDeconnecter: () => void discord.deconnecter(),
    onAideInstallation: () => setInstallationOuverte(true),
  };

  // Ce que la carte (vue Decks) et le bandeau d'une recommandation (vue
  // Défenses) disent et font de la même façon.
  // La provenance, dans « Toutes », seulement quand il y a des salons : sans
  // Discord, toutes viennent d'ici. Et dans « Suivis » et « Favoris », qui
  // réunissent plusieurs salons.
  const provenanceDe = (reco: Reco) =>
    (provenance.type === 'suivis' || provenance.type === 'favoris' || (provenance.type === 'toutes' && groupes.length > 0))
      ? { nom: reco.lien ? reco.lien.nomSalon : td.appareil, etat: etatAffiche(reco) }
      : undefined;
  const publierDansDe = (reco: Reco) => (reco.lien ? undefined : {
    raison: connecte ? null : td.publierDansHorsConnexion,
    onClick: () => setAPublierDans(reco),
  });
  const exporterDeckOptimizer = (deck: RecoDeck) => onImporterEquipe((data, t) => importerRecoOptimizer(deck, data, t));
  // Supprimer une recommandation SE DÉFAIT au lieu de se confirmer (même geste
  // que sur sa carte).
  const supprimerReco = (reco: Reco) => {
    const index = all.findIndex((x) => x.id === reco.id);
    recos.removeReco(reco.id);
    notifier({ message: textes.carteReco.supprimee, action: () => recos.restaurerReco(reco, index) });
  };
  // « Éditer la recommandation » depuis le volet Défenses : on passe en vue
  // Decks, la recommandation ouverte en édition.
  const editerDepuisVolet = (reco: Reco) => {
    setVue('attaque');
    setEditingId(reco.id);
    choisirReco(reco.id);
  };

  // Recherche par monstre. `null` = aucune recherche en cours (état neutre de la
  // page : rien n'est filtré, rien n'est déplié d'office). Elle porte sur la
  // provenance choisie.
  const hits = useMemo(
    () => chercheMonstre(deLaProvenance, queries, searchMode, monsterByCom2us),
    [deLaProvenance, queries, searchMode, monsterByCom2us]
  );
  // ⚠️ Mémorisée : un tableau neuf à chaque rendu relançait l'agrégation des
  // défenses (vue Défenses) pendant une recherche.
  const list = useMemo(() => (hits ? hits.map((h) => h.reco) : deLaProvenance), [hits, deLaProvenance]);
  // La recommandation ouverte dans la vue Decks : celle qu'on a choisie si elle
  // est encore dans la liste (provenance, recherche), sinon la première.
  const recoChoisie = list.find((x) => x.id === choixReco) ?? list[0] ?? null;
  // Rien trouvé dans cette vue : combien dans l'autre, pour le renvoi
  // « Voir dans Decks (N) ». Calculé seulement dans ce cas.
  const dansAutreVue = useMemo(() => {
    if (!hits || hits.length > 0) return 0;
    const autres = chercheMonstre(deLaProvenance, queries, MODE_DE[AUTRE[vue]], monsterByCom2us) ?? [];
    if (AUTRE[vue] === 'attaque') return autres.reduce((n, h) => n + h.decks.length, 0);
    const parReco = new Map(autres.map((h) => [h.reco.id, h]));
    return defensesDesRecos(autres.map((h) => h.reco), monsterByCom2us, (reco, di, ci) =>
      ci != null && !!parReco.get(reco.id)?.decks.find((d) => d.deckIndex === di)?.counters.includes(ci)).defenses.length;
  }, [hits, deLaProvenance, queries, vue, monsterByCom2us]);
  // Où se trouve le monstre, par recommandation — le volet s'en sert pour ne
  // montrer que les decks trouvés et surligner les bons portraits.
  const hitPar = useMemo(() => {
    const m = new Map<string, RecoHit>();
    for (const h of hits ?? []) m.set(h.reco.id, h);
    return m;
  }, [hits]);

  // ⚠️ Rendues une seule fois, posées à DEUX endroits selon la largeur. Deux
  // copies auraient divergé au premier bouton ajouté.
  // ⚠️ Boutons de la librairie, pas des `<button>` redessinés — même geste que
  // SiegeBoard (`Bouton` porte déjà `icone`+`libelle`+`libelleCourt`).
  const actions = (
    <>
      <Bouton
        onClick={() => {
          const id = recos.addReco();
          // Une recommandation se compose dans sa carte : vue Decks.
          setVue('attaque');
          setEditingId(id);
          choisirReco(id);
          // ⚠️ Même geste que « Ajouter une équipe » (SiegeBoard) : le panneau
          // « Options » se referme et la nouvelle recommandation est ouverte.
          // Créer une reco est le geste principal de cet écran, comme composer
          // une équipe l'est en défense/offense — il doit se voir tout de suite,
          // pas rester caché derrière un panneau resté ouvert.
          onFermerMenu();
        }}
        icone={<Plus size={15} />}
        libelle={r.creer}
        libelleCourt={textes.commun.creer}
      />

      <Bouton
        onClick={() => fileRef.current?.click()}
        icone={<Download size={15} />}
        libelle={textes.commun.importer}
        title={r.importerAide}
      />

      {/* ⚠️ **Toujours affiché, désactivé plutôt que retiré.** Un bouton qui
          apparaît une fois la première recommandation créée surprend : on ne
          comprend pas D'OÙ il sort, puisqu'on ne l'a jamais vu absent d'un
          geste volontaire. Désactivé, il reste un repère fixe de la barre —
          on sait qu'exporter est possible, juste pas encore. Même règle
          partout dans l'app : voir `boutonEffacer` ci-dessous. */}
      <Bouton
        onClick={() => requestExport(list, 'toutes')}
        disabled={list.length === 0}
        icone={<Upload size={15} />}
        libelle={r.toutExporter}
        libelleCourt={textes.commun.exporter}
        title={list.length === 0 ? r.aucuneAExporter : r.toutExporterAide}
      />
    </>
  );

  // Défenses · Decks — le VRAI Segmented, pas une copie. Sur la PAGE aux deux
  // formats : c'est lui qui décide ce qu'on voit et où cherche le champ, il
  // ne se cache pas dans un panneau. ⚠️ `pleineLargeur` : au doigt, seul sur
  // sa ligne, chaque cran prend la moitié de la largeur (`size="lg"`).
  const vueFilter = (pleineLargeur: boolean) => (
    <Segmented
      value={vue}
      onChange={setVue}
      size={pleineLargeur ? 'lg' : 'md'}
      options={VUES.map((key) => ({ key, label: r.vues[key].label, hint: r.vues[key].hint }))}
    />
  );

  // « Confronter à mon compte » : toujours affiché, désactivé sans compte
  // importé, avec sa raison.
  const interrupteur = (
    <Interrupteur
      actif={actif}
      onChange={setConfronter}
      disabled={!peutConfronter}
      libelle={r.confronter}
      title={peutConfronter ? r.confronterAide : r.importerPourAnalyser}
      className="disabled:cursor-not-allowed disabled:opacity-50"
      data-confronter
    />
  );

  // ⚠️ « Tout effacer » reste SÉPARÉ : dans la page il se pose à l'opposé
  // (`ml-auto`), loin des gestes de construction. Un bouton destructeur ne se
  // met pas à côté de celui qu'on presse en boucle — dans le panneau il garde
  // cette distance, détaché en bas.
  // ⚠️ Même habillage à deux visages que RTA/SiegeBoard (`boutonEffacer`) :
  // nu dans la page, fond + contour rouges et pleine largeur dans le panneau.
  // ⚠️ **Toujours affiché, désactivé s'il n'y a rien à effacer** — jamais
  // retiré. Un bouton qui surgit dès qu'on a créé une première recommandation
  // ne s'explique pas : on ne l'a jamais vu apparaître d'un geste, il était
  // juste absent. Désactivé, c'est un repère fixe de la page, dont l'état
  // dit lui-même pourquoi il ne répond pas — même règle partout dans l'app.
  const effacer = (dansLePanneau: boolean) => (
    <Bouton
      onClick={() => {
        setEffacementAConfirmer(true);
        onFermerMenu();
      }}
      disabled={all.length === 0}
      ton="danger"
      fond={dansLePanneau ? 'doux' : 'vide'}
      trait={dansLePanneau ? 'plein' : 'aucun'}
      pleineLargeur={dansLePanneau}
      taille="sm"
      icone={<Trash2 size={13} />}
      libelle={textes.commun.toutEffacer}
      title={all.length === 0 ? r.aucuneAEffacer : undefined}
      className="leading-none"
    />
  );

  return (
    <div>
      {/* ⚠️ Sous `lg`, les actions descendent dans le panneau « Options » :
          quatre boutons à libellé complet remplissaient deux rangées avant la
          première recommandation. */}
      {/* ---- En-tête BUREAU --------------------
          Comme la RTA et Défense / Offense : le titre,
          le compteur, puis les actions — toutes en boutons quand elles
          tiennent sur la ligne, sinon Importer et « Créer une
          recommandation » visibles et le reste (Tout exporter, Tout effacer —
          séparé) dans le menu « ⋯ », comme dans la maquette. Aucune action mise en avant. Les
          libellés, désactivations et infobulles sont ceux des boutons
          d'avant. Le téléphone garde son panneau « Options ». */}
      <div className="mt-5 hidden flex-wrap items-center gap-x-3 gap-y-1 lg:flex">
        <h1 className="font-display text-xl tracking-wide text-ink">{r.titre}</h1>
        <span className="rounded-full border border-border-soft bg-panel2 px-2 py-0.5 font-mono text-micro text-ink-dim">
          {r.compte(all.length)}
        </span>
        <BarreActions
          libelleMenu={textes.sauvegardeRta.plusActions}
          // ⚠️ **Importer ET Créer toujours visibles, dans cet ordre** (Le mainteneur :
          // « l'organisation des boutons comme sur la maquette ») :
          // la maquette les pose tous deux en boutons, Tout exporter et Tout
          // effacer derrière le « ⋯ ». Ces deux-là restent en boutons quand la
          // ligne a la place.
          toujours={[
            {
              cle: 'importer',
              libelle: textes.commun.importer,
              icone: <Download size={15} />,
              title: r.importerAide,
              onClick: () => fileRef.current?.click(),
            },
            {
              cle: 'creer',
              libelle: r.creer,
              icone: <Plus size={15} />,
              onClick: () => {
                const id = recos.addReco();
                setVue('attaque');
                setEditingId(id);
                choisirReco(id);
              },
            },
          ]}
          autres={[
            {
              cle: 'exporter',
              libelle: r.toutExporter,
              icone: <Upload size={15} />,
              disabled: list.length === 0,
              title: list.length === 0 ? r.aucuneAExporter : r.toutExporterAide,
              onClick: () => requestExport(list, 'toutes'),
            },
            {
              cle: 'effacer',
              libelle: textes.commun.toutEffacer,
              icone: <Trash2 size={13} />,
              danger: true,
              disabled: all.length === 0,
              title: all.length === 0 ? r.aucuneAEffacer : undefined,
              onClick: () => setEffacementAConfirmer(true),
            },
          ]}
        />
      </div>

      <MobileSheet ouvert={menuOuvert} onFermer={onFermerMenu} titre={r.actions}>
        <div data-rangee-actions>{actions}</div>

        {/* « Confronter à mon compte », AU DOIGT : un réglage de la page, pas
            un geste qu'on refait — sa place est avec les actions, la page
            garde la vue et la recherche sous le pouce. */}
        <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
          {interrupteur}
          <span className="text-micro text-ink-dim">{peutConfronter ? r.confronterAide : r.importerPourAnalyser}</span>
        </div>
        <div data-zone-destructive className="mt-4 border-t border-border pt-3">
          {effacer(true)}
        </div>
      </MobileSheet>

      {effacementAConfirmer && (
        <ConfirmDialog
          titre={r.effacerTitre}
          message={r.effacerMessage}
          libelleAction={textes.commun.toutEffacer}
          destructif
          onCancel={() => setEffacementAConfirmer(false)}
          onConfirm={() => {
            setEffacementAConfirmer(false);
            recos.clearAll();
          }}
        />
      )}

      {/* ⚠️ Pas `destructif` : rien ne disparaît sur cet appareil, un fichier
          part seulement sur le disque. Le ton neutre le distingue d'un
          effacement — même si les deux se confirment. */}
      {exportAConfirmer && (
        <ConfirmDialog
          titre={
            exportAConfirmer.usable.length > 1
              ? r.exporterTitrePlusieurs(exportAConfirmer.usable.length)
              : r.exporterTitreUne(exportAConfirmer.usable[0].name || r.cetteReco)
          }
          message={r.exporterMessage(exportAConfirmer.usable.length, exportAConfirmer.decks)}
          libelleAction={textes.commun.exporter}
          onCancel={() => setExportAConfirmer(null)}
          onConfirm={handleExport}
        />
      )}

      {fusionAProposer && (
        <ChoixFusionRecos
          paires={fusionAProposer.paires}
          apercu={fusionAProposer.apercu}
          onChoisir={(fusionner) => {
            importer(fusionAProposer.recos, fusionAProposer.counts, fusionner);
            setFusionAProposer(null);
          }}
          onAnnuler={() => {
            setFusionAProposer(null);
            setMsg({ text: r.importAnnule });
          }}
        />
      )}

      {/* Import : un seul chemin, le fichier .json (input déclenché par le
          bouton « Importer » ci-dessus). */}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // permet de recharger le même fichier
          if (!f) return;
          f.text().then(applyImport);
        }}
      />

      {/* Au téléphone, EN TÊTE de la page : les provenances à plat et le
          compte Discord — aucun sélecteur à dérouler (choix du mainteneur,
          2026-11-10). À l'ordinateur, la colonne plus bas. */}
      <div className="mt-3 lg:hidden">
        <ProvenancesTelephone {...propsProvenances} />
      </div>

      {msg && (
        <p className={`mt-3 text-sm ${msg.error ? 'text-bad' : 'text-good'}`}>{msg.text}</p>
      )}

      {report && (report.errors.length > 0 || report.warnings.length > 0) && (
        <ValidationReport report={report} onClose={() => setReport(null)} />
      )}

      {/* ⚠️ **La vue : toujours affichée et active**, même sans
          recommandation — contrairement à la recherche par composition, qui
          n'a rien à filtrer sur une liste vide.
          ⚠️ **À la souris, UNE barre d'outils** : Défenses · Decks · filet ·
          champ et cases · Vider, et « Confronter à mon compte » au bout. Plus
          de rangées Rôle ni Tri dessous. Au doigt, la vue pleine largeur,
          puis la recherche en colonne ; l'interrupteur est dans « Options ». */}
      <div className="mt-3 lg:mt-4 lg:flex lg:flex-wrap lg:items-center lg:gap-2">
      <div className="lg:hidden" data-vue-telephone>{vueFilter(true)}</div>
      <div className="hidden lg:contents">
        {vueFilter(false)}
      </div>
      {all.length > 0 && <span className="mx-1 hidden h-5 w-px flex-none bg-border-soft lg:block" aria-hidden />}

      {/* Bloc de recherche — la composition cherchée.
          ⚠️ **Sans cadre ni intitulé « Monstres »** : les trois cases ET le
          champ de recherche disent déjà par leur FORME ce qu'on y fait — une
          composition de 3 monstres à composer —, un mot devant n'ajoutait
          rien. Le texte du champ dit OÙ il cherche (« Monstre de la
          défense… », « Monstre d'un deck… ») : c'est la vue qui en décide.
          ⚠️ N'apparaît que s'il y a des recommandations : à la différence
          d'Origine, il n'y a RIEN à chercher dans une liste vide — poser le
          bloc quand même laisserait croire qu'on n'a rien trouvé alors qu'il
          n'y a rien. */}
      {all.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-2.5 lg:contents">
          {/* Composition cherchée. */}
          <div className="flex flex-wrap items-center gap-2 lg:flex-1">
            {/* ⚠️ **La recherche à GAUCHE, les portraits à DROITE.** C'est le
                champ qu'on utilise en premier — le regard commence par lui,
                pas par des cases encore vides. Les cases suivent CE QU'ON A
                TAPÉ, elles se lisent après.
                ⚠️ `min(180px, 100%)` et non `180px` nu : un minimum rigide
                empêche le champ de se réduire dans un conteneur plus étroit,
                et c'est toute la page qui gagne un défilement latéral. Même
                garde que RecoCard et ReleasesPage.
                ⚠️ **Sous `lg`, le champ prend TOUTE la place** (plafond de
                260 px à partir de `lg` seulement) : plafonné dès `sm`, il
                laissait un grand vide entre lui et les cases, repoussées au
                bord droit — les cases se lisaient comme un contrôle à part
                (relevé par le mainteneur, capture en fenêtre étroite). Désormais
                champ et cases forment un seul bloc sur toute la largeur. */}
            {!casesPleines ? (
              <div className="min-w-[min(180px,100%)] flex-1 lg:max-w-[260px]">
                <MonsterPicker
                  monsters={monsters}
                  // ⚠️ Les monstres déjà posés sont retirés des suggestions : le
                  // ET exige des monstres DISTINCTS (voir recoSearch.ts), poser
                  // deux fois le même garantirait zéro résultat.
                  excludeIds={dejaPoses}
                  placeholder={r.chercheDans[vue]}
                  onPick={(id) => {
                    const m = monsters.find((x) => String(x.id) === id);
                    if (m) poserMonstre(m.name);
                  }}
                />
              </div>
            ) : (
              // ⚠️ **La boîte du champ qu'il remplace**, plafond de 260 px
              // compris : en `flex-1` nu, le message prenait toute la rangée à
              // la souris et poussait les trois cases et « Vider » au bord
              // droit de la page dès le troisième monstre posé — les cases
              // bougeaient sous le clic qui les remplissait.
              <p className="min-w-[min(180px,100%)] flex-1 text-xs text-ink-dim lg:max-w-[260px]" data-trois-poses>
                {r.troisPoses}
              </p>
            )}

            {/* TROIS CASES, et non trois champs texte : elles montrent la
                forme de ce qu'on cherche — une composition de 3 monstres —, et
                reprennent le langage des slots de deck de la page.
                ⚠️ **Collées au champ, à toutes les largeurs** — elles sont le
                résultat de ce qu'on y tape. L'ancien `ml-auto` (sous `lg`) les
                envoyait au bord droit, loin du champ plafonné. `flex-none` :
                trois cases de 40 px ne se compriment pas. */}
            <div className="flex flex-none items-center gap-1.5">
              {queries.map((nom, i) => {
                // ⚠️ Résolu dans les formes JOUABLES, pas dans la liste
                // complète : plusieurs entrées portent le même nom (forme
                // éveillée, 2A, entrées techniques de SWARFARM). Chercher dans
                // `monsters` retombait sur la première venue — d'où un portrait
                // qui ne correspondait pas à celui choisi dans les suggestions.
                const mon = nom ? monstresJouables.find((m) => m.name === nom) ?? null : null;
                if (!nom) {
                  return (
                    <div
                      key={i}
                      className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-lg
                                 border border-dashed border-border text-ink-dim"
                      aria-hidden
                    >
                      <Plus size={15} />
                    </div>
                  );
                }
                return (
                  <ZoneCliquable
                    key={i}
                    onClick={() => retirerMonstre(i)}
                    className="group relative flex h-[40px] w-[40px] flex-none items-center justify-center
                               rounded-lg border border-accent bg-accent/[0.08] transition
                               hoverable:border-bad"
                    title={textes.carteRta.retirer(nom)}
                    aria-label={textes.carteRta.retirer(nom)}
                  >
                    {/* Le portrait, pas le nom : plusieurs monstres portent le
                        même nom (formes 2A) — voir MonsterAvatar. Le repli sur
                        les initiales couvre un monstre absent des données. */}
                    <MonsterAvatar monster={mon} fallback={nom} size={32} />
                    <span
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full
                                 bg-panel2 text-ink-dim opacity-0 transition-opacity
                                 no-hover:opacity-100 group-hoverable:opacity-100"
                    >
                      <X size={10} />
                    </span>
                  </ZoneCliquable>
                );
              })}
            </div>

            {/* Vider les trois cases d'un coup — distinct du retrait d'un seul
                portrait, qui sert à affiner. Il vit AVEC les cases qu'il vide. */}
            {/* ⚠️ Ton NEUTRE, pas `danger` : vider une recherche se repose en un
                geste, ça ne se confirme pas (voir docs/03-developpeur/) — la
                surestimer en rouge permanent la ferait paraître plus grave
                qu'elle ne l'est. */}
            {aUneRecherche && (
              <Bouton
                onClick={effacerRecherche}
                taille="sm"
                icone={<X size={13} />}
                libelle={textes.commun.vider}
                title={textes.siege.board.viderRecherche}
                aria-label={textes.siege.board.viderRecherche}
                className="flex-none"
              />
            )}
          </div>
        </div>
      )}
      {/* Au bout de la barre, à la souris : posé à droite, il ne bouge pas
          quand « Vider » apparaît. Au doigt : dans « Options ». */}
      <div className="hidden lg:ml-auto lg:flex">{interrupteur}</div>
      </div>

      {/* ⚠️ **Les provenances** : à l'ordinateur, une COLONNE à gauche du
          contenu ; au téléphone, en tête de la page (plus haut). Le compte
          Discord est en pied de l'une et de l'autre. */}
      <div className="mt-4 lg:grid lg:grid-cols-[256px_minmax(0,1fr)] lg:items-start lg:gap-4">
      <div className="hidden lg:block">
        <ColonneProvenances {...propsProvenances} />
      </div>
      <div className="min-w-0">
      {all.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-border bg-panel/40 py-16 px-6 lg:mt-0">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-panel2 border border-border mb-4">
            {/* L'icône de la section dans la nav. */}
            <IconeRecos size={26} className="text-ink-dim" />
          </div>
          <p className="text-ink-dim text-sm max-w-md">
            {r.vide1} <b className="text-ink">{r.vide2}</b> {r.vide3}{' '}
            <b className="text-ink">{r.vide4}</b> {r.vide5} <b className="text-ink">{r.vide6}</b>{' '}
            {r.vide7}
          </p>
        </div>
      ) : list.length === 0 && !hits && provenance.type === 'favoris' ? (
        // « Favoris » sans salon étoilé : dire comment le remplir, plutôt
        // qu'une page vide qui se lit comme une perte.
        <div className="mt-4 rounded-xl border border-dashed border-border bg-panel/40 py-8 px-6 text-center lg:mt-0" data-favoris-vide>
          <p className="text-sm text-ink-dim">{td.favorisVide}</p>
        </div>
      ) : list.length === 0 && hits ? (
        // ⚠️ La RECHERCHE ne renvoie rien — message distinct de celui du filtre.
        // Dire « tu n'as créé aucune recommandation » alors qu'on vient de taper
        // un nom ferait croire à une perte de données.
        <div className="mt-4 rounded-xl border border-dashed border-border bg-panel/40 py-8 px-6 text-center lg:mt-0">
          <p className="text-sm text-ink-dim">
            {/* ⚠️ Le message dit LA RÈGLE quand il y a plusieurs monstres : les
                trois doivent être dans la MÊME composition. Sans ça, une
                recherche à trois termes qui ne renvoie rien se lit comme un bug
                — on voit bien chaque monstre à l'écran, séparément. */}
            {/* ⚠️ Le message nomme aussi la VUE où l'on a cherché : « aucune
                défense visée ne contient X » — le deck existe peut-être, et
                le renvoi le dit. */}
            {termesPoses.length > 1 ? (
              <>
                {r.videSelon[vue]} {r.neReunit}{' '}
                <b className="text-ink">{termesPoses.join(' + ')}</b>
              </>
            ) : (
              <>
                {r.videSelon[vue]} {r.neContient}{' '}
                <b className="text-ink">{termesPoses[0]}</b> {r.guillemetFermant}
              </>
            )}
.{' '}
            {/* ⚠️ La porte de sortie utile n'est pas d'effacer mais de
                regarder dans l'AUTRE vue, quand elle a des résultats : un
                clic, qui garde la recherche. Effacer reste proposé à côté. */}
            {dansAutreVue > 0 && (
              <>
                <button
                  onClick={() => setVue(AUTRE[vue])}
                  className="text-ink underline transition hoverable:text-star"
                  data-renvoi-vue
                >
                  {r.voirDans(r.vues[AUTRE[vue]].label, dansAutreVue)}
                </button>
                {' · '}
              </>
            )}
            <button
              onClick={effacerRecherche}
              className="text-ink underline transition hoverable:text-star"
            >
              {textes.siege.board.effacerRecherche}
            </button>
          </p>
        </div>
      ) : vue === 'defense' ? (
        <div className="mt-4 lg:mt-0">
          <VoletDefenses
            recos={recos}
            liste={list}
            hits={hits}
            termes={termesPoses}
            monsters={monsters}
            monsterByCom2us={monsterByCom2us}
            monsterById={monsterById}
            offenseTeams={offenseTeams}
            equipesChoix={equipesChoix}
            matchOf={matchOf}
            raisonExportDe={raisonExportDe}
            onExporterDeckOptimizer={exporterDeckOptimizer}
            tri={triRecherche}
            onTri={setTriRecherche}
            provenanceDe={provenanceDe}
            actionsReco={(reco) => ({
              onEditer: () => editerDepuisVolet(reco),
              onExporter: () => requestExport([reco], reco.name || r.cetteReco),
              onSupprimer: () => supprimerReco(reco),
              onDetacher: reco.lien ? () => setADetacher(reco) : undefined,
              publierDans: publierDansDe(reco),
            })}
          />
        </div>
      ) : (
        // ⚠️ **Vue Decks : deux volets, comme la vue Défenses** — à gauche les
        // recommandations, à droite celle qu'on a choisie. Selon la place du
        // CONTENEUR (`@3xl`) : étroit, la liste, puis la recommandation
        // touchée à sa place, avec un retour.
        <div className="@container mt-4 lg:mt-0" data-volet-decks>
          <div className="flex flex-col gap-4 @3xl:grid @3xl:grid-cols-[minmax(230px,280px)_minmax(0,1fr)] @3xl:items-start">
            <div className={`min-w-0 ${detailDecks ? 'hidden @3xl:block' : ''}`}>
              <ListeRecos
                liste={list}
                choisie={recoChoisie?.id ?? null}
                onChoisir={choisirReco}
                hitDe={(id) => hitPar.get(id)}
                matchOf={matchOf}
                provenanceDe={provenanceDe}
                rangDe={(reco) => list.indexOf(reco)}
              />
            </div>
            <div ref={voletDecks} className={`min-w-0 ${detailDecks ? '' : 'hidden @3xl:block'}`}>
              {recoChoisie && (
                <>
                  {/* Le bandeau du salon, au-dessus du volet, quand on regarde un salon. */}
                  {recoChoisie.lien && provenance.type === 'salon' && (
                    <BandeauSalon
                      reco={recoChoisie}
                      connecte={connecte}
                      enCours={enCours}
                      onPublier={() => void publierLiee(recoChoisie)}
                      onFusionner={() => ouvrirFusion(recoChoisie)}
                    />
                  )}
                  <RecoCard
                    // Une autre recommandation : son volet repart de zéro
                    // (page, decks ouverts, édition d'un deck).
                    key={recoChoisie.id}
                    sousBandeau={!!recoChoisie.lien && provenance.type === 'salon'}
                    provenance={provenanceDe(recoChoisie)}
                    onDetacher={recoChoisie.lien ? () => setADetacher(recoChoisie) : undefined}
                    publierDans={publierDansDe(recoChoisie)}
                    raisonExportDe={raisonExportDe}
                    onExporterDeckOptimizer={exporterDeckOptimizer}
                    reco={recoChoisie}
                    index={list.indexOf(recoChoisie)}
                    monsters={monsters}
                    monsterByCom2us={monsterByCom2us}
                    monsterById={monsterById}
                    offenseTeams={offenseTeams}
                    equipesChoix={equipesChoix}
                    match={matchOf(recoChoisie)}
                    retour={(
                      <BoutonIcone
                        onClick={() => setDetailDecks(false)}
                        icone={<ArrowLeft size={16} />}
                        libelle={r.toutesLesRecos}
                        className="flex-none @3xl:hidden"
                      />
                    )}
                    hit={hitPar.get(recoChoisie.id) ?? null}
                    editing={editingId === recoChoisie.id}
                    onToggleEdit={(id) => setEditingId((cur) => (cur === id ? null : id))}
                    onExport={(x) => requestExport([x], x.name || r.cetteReco)}
                    recos={recos}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
      </div>

      {/* ── Dialogues Discord ── */}
      {connexionOuverte && (
        <DialogueConnexion
          onFermer={() => setConnexionOuverte(false)}
          onContinuer={() => { setConnexionOuverte(false); discord.connecter(); }}
        />
      )}
      {/* Application de bureau : le code que le site affiche, collé ici. */}
      {discord.etat.statut === 'code' && (
        <DialogueCodeBureau onValider={discord.validerCode} onRelancer={discord.connecter} onFermer={discord.annulerCode} />
      )}
      {/* Site : le code à copier dans l'application de bureau. */}
      {discord.codeAffiche && <DialogueCodeSite code={discord.codeAffiche} onFermer={discord.fermerCode} />}
      {installationOuverte && <DialogueInstallation onFermer={() => setInstallationOuverte(false)} />}
      {aPublierDans && (
        <DialoguePublierDans
          reco={aPublierDans}
          salons={salonsDePublication(discord.etat.sources?.serveurs ?? [], all)}
          enCours={enCours}
          onFermer={() => setAPublierDans(null)}
          onPublier={(salon) => void publierDansSalon(aPublierDans, salon, null)}
        />
      )}
      {/* ⚠️ Remplacer la recommandation d'un salon se confirme, et le défaut
          est l'action SANS PERTE : « Annuler » garde celle du salon. */}
      {aRemplacer && (
        <ConfirmDialog
          titre={td.remplacer.titre}
          message={td.remplacer.message(aRemplacer.salon.nomSalon, aRemplacer.version?.reco?.name || aRemplacer.salon.porte || '')}
          libelleAction={td.remplacer.remplacer}
          destructif
          onCancel={() => setARemplacer(null)}
          onConfirm={() => void publierDansSalon(aRemplacer.reco, aRemplacer.salon, aRemplacer.version?.messageId ?? null)}
        />
      )}
      {aDetacher && (
        <ConfirmDialog
          titre={td.detacherDialogue.titre(aDetacher.name || td.appareil)}
          message={td.detacherDialogue.message}
          libelleAction={td.detacherDialogue.action}
          onCancel={() => setADetacher(null)}
          onConfirm={() => {
            const reco = aDetacher;
            setADetacher(null);
            recos.delierReco(reco.id);
            notifier({ message: td.notif.detachee(reco.name || td.appareil) });
            // Celle du salon reparaît aussitôt : une relecture des salons.
            if (connecte) void discord.actualiser();
          }}
        />
      )}
      {aFusionner && (
        <DialogueFusion
          reco={aFusionner.reco}
          fusion={aFusionner.fusion}
          monsterByCom2us={monsterByCom2us}
          onFermer={() => setAFusionner(null)}
          onAppliquer={(choix) => {
            if (recos.fusionnerDiscord(aFusionner.reco.id, aFusionner.fusion, choix)) {
              setAFusionner(null);
              notifier({ message: td.notif.fusionnee });
            }
          }}
        />
      )}
    </div>
  );
}

// Rapport de validation du dernier import. Reste affiché jusqu'à fermeture :
// contrairement au message de succès, il y a quelque chose à LIRE.
function ValidationReport({ report, onClose }: { report: ImportReport; onClose: () => void }) {
  const rapport = useTraduction().rapportImport;
  const bloque = report.errors.length > 0;
  return (
    <div
      className={`mt-3 rounded-xl border px-3 py-2.5 ${
        // Fonds DOUX (voir `AURA` dans RecoCard) : l'aplat saturé à
        // 20-35 % se lisait mal ; l'icône et le titre portent la couleur.
        bloque ? 'border-bad/50 bg-bad-soft' : 'border-warn/50 bg-warn-soft'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {bloque ? (
          <XCircle size={15} className="flex-none text-bad" />
        ) : (
          <AlertTriangle size={15} className="flex-none text-warn" />
        )}
        <span className={`text-xs font-semibold ${bloque ? 'text-bad' : 'text-warn'}`}>
          {bloque ? rapport.importRefuse : rapport.importAvec(report.warnings.length)}
        </span>
        <BoutonIcone
          onClick={onClose}
          libelle={rapport.fermer}
          icone={<X size={14} />}
          className="ml-auto"
        />
      </div>

      <ul className="space-y-0.5 max-h-[220px] overflow-y-auto">
        {report.errors.map((e, i) => (
          <li key={`e${i}`} className="text-xs text-bad leading-snug">
            • {e}
          </li>
        ))}
        {report.warnings.map((w, i) => (
          <li key={`w${i}`} className="text-xs text-warn/90 leading-snug">
            • {w}
          </li>
        ))}
      </ul>

      {!bloque && (
        <p className="mt-1.5 font-mono text-micro text-ink-dim">
          {rapport.bilanRecos(report.counts.recos, report.counts.decks, report.counts.monstres)}
        </p>
      )}
    </div>
  );
}
