import {
  Trash2,
  Send,
  Link2Off,
  Hash,
  Smartphone,
  Pencil,
  Upload,
  X,
  Check,
  AlertTriangle,
  Plus,
  StickyNote,
  Download,
  ChevronDown,
  Undo2,
  MoreHorizontal,
} from 'lucide-react';
// L'épée de la section Offense, à la place des deux épées de lucide :
// « Fort contre ».
import { IconeOffense, IconeOptimizer } from '../IconesAtelier';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ARTIFACT_KINDS,
  sortesArtefact,
  ArtifactKind,
  LeaderSkill,
  MAX_ARTIFACT_SUBS,
  Monster,
  Reco,
  RecoCounter,
  RecoDeck,
  RECO_STATS,
  RecoSlot,
  RecoStatKey,
  RUNE_SETS,
  SiegeTeam,
} from '../../types';
import { DeckMatch, FaultCause, RecoMatch, SlotMatch, deckFaults, fmtStat, slotFaults } from '../../lib/recoMatch';
import { DeckHit, RecoHit } from '../../lib/recoSearch';
import { fiabiliteValide, parFiabilite } from '../../lib/recoDefenses';
import { decksModifies } from '../../lib/recoModifies';
import { Bouton, BoutonIcone, Champ, Flottant, Menu, Selecteur, ZoneCliquable, useNotifier } from '../../ui';
import type { ElementMenu } from '../../ui';
import { NOTE_MAX, DECK_NOTE_MAX, COUNTER_NOTE_MAX } from '../../lib/recoShare';
import AjoutCounter, { type EquipeChoix } from './AjoutCounter';
import { compterLignes, etapeRecherche, rechercheInitiale } from '../../lib/apercuDeuxLignes';
import {
  DECKS_PAR_PAGE,
  nombrePages,
  pageBornee,
  pageDeLaPosition,
  plageDeLaPage,
  tranche,
} from '../../lib/pagesRecos';
import Pager from '../account/Pager';
import {
  artifactSubLabel,
  artifactSubsFor,
  setPieces,
  setsCost,
  canAddSet,
  INTANGIBLE_SET,
  MAX_SET_PIECES,
} from '../../lib/effects';
import { UseRecoState } from '../../hooks/useSiegeRecos';
import { useTraduction } from '../../hooks/useLangue';
import type { EtatAffiche } from '../../lib/provenancesRecos';
import { PastilleEtat } from './discord/Provenances';
import { nomSet } from '../../i18n/jeu';
import { libelleSource } from '../../lib/ownedBuilds';
import type { Dictionnaire } from '../../i18n/fr';
import RuneIcon from '../RuneIcon';
import { STATS_AVEC_BASE } from '../../lib/stats';
import MonsterPicker from '../MonsterPicker';
import { JetonSlot, prochainFocus } from './slotVideSuivant';
import MonsterAvatar from '../MonsterAvatar';
import LeadPill from './LeadPill';
import { ApercuNote, ChoixFiabilite, FiabiliteRapide } from './EtoilesFiabilite';
import { SIEGE_TICKS, TICK_ABOVE_MARGIN, ficheSpeedForTick, siegeLeadFor, speedLeadOf } from '../../lib/speed';
import {
  ContenuDeck,
  MetaReco,
  contenuDeck,
  deckEditeApresChangement,
  memeContenu,
  metaReco,
} from '../../lib/annulerEdition';


// ⚠️ **UNE reco affiche des stats de FICHE** : celles que le jeu montre sur la
// carte du monstre, runes posées, AVANT le combat. Rien d'autre n'y entre.
//
// La colonne « total » de la VIT ajoutait le bonus de siège (totem de guilde
// +15 % et lead du deck), pour y lire la vitesse de combat des cartes d'équipe.
// Trois conséquences, toutes mauvaises :
//
//  - le total ne valait plus base + bonus — « 107 + 105 » s'affichait « 245 »,
//    et la ligne se lisait comme une erreur de calcul ;
//  - la colonne « actuel » recevait le même bonus, alors que le VERDICT
//    (`ok`/`ko`, voir recoMatch.ts) se calcule sur la stat de fiche : on
//    pouvait lire deux nombres égaux sur une ligne marquée en rouge ;
//  - c'est la stat de fiche qu'on relève dans le jeu quand on rune un monstre,
//    et c'est elle que l'Optimiseur cherche à atteindre.
//
// La vitesse de COMBAT reste affichée là où elle décide de quelque chose : sur
// les cartes d'équipe de siège et dans le speed tuning, où l'ordre de tour se
// joue. Voir docs/02-app/siege/.


// Nom d'un deck : les noms de ses monstres séparés par un tiret
// (« Trevor - Bella - Loren »), sinon « Deck N » tant qu'il est vide. On se
// rabat sur le nom stocké dans le slot si le monstre est absent des données
// chargées.
//
// ⚠️ **Plus de titre saisi par l'auteur.** `deck.name` existait pour un titre
// libre (« Def anti-Chloé ») ; il pouvait dater une fois le deck modifié,
// redoubler ce que les portraits montrent déjà, ou rester vide et donc
// identique à ce nom automatique. `deckLabel` calcule toujours ce nom, sans
// jamais lire `deck.name` — le champ reste dans le TYPE et le stockage pour
// la rétrocompatibilité d'un import, mais n'est plus affiché.
export function deckLabel(deck: RecoDeck, byCom2us: Map<number, Monster>, index: number): string {
  const noms = deck.slots
    .map((s) => (s.com2usId != null ? byCom2us.get(s.com2usId)?.name ?? s.name : ''))
    .filter(Boolean);
  return noms.length ? noms.join(' - ') : `Deck ${index + 1}`;
}

// Une équipe d'offense proposée à l'import : son rang, ses 3 monstres résolus
// (pour les icônes) et un résumé texte (recherche + infobulle).
export interface OffenseChoice {
  team: SiegeTeam;
  index: number;
  summary: string;
  monsters: (Monster | null)[];
}

interface Props {
  // Pourquoi un deck ne part pas dans l'Optimizer (`undefined` : il part).
  // Une fonction, appelée pour les seuls decks affichés (voir RecoBoard).
  raisonExportDe: (deck: RecoDeck) => string | undefined;
  onExporterDeckOptimizer: (deck: RecoDeck) => void;
  reco: Reco;
  index: number;
  monsters: Monster[];
  monsterByCom2us: Map<number, Monster>;
  monsterById: Map<string, Monster>; // par id local (slots de siège)
  offenseTeams: OffenseChoice[]; // équipes d'offense proposables à l'import
  // Les équipes de « Mes équipes » proposables (la fenêtre d'ajout d'un counter).
  equipesChoix: EquipeChoix[];
  // La confrontation au compte, `null` quand « Confronter à mon compte » est
  // éteint (ou sans compte) : la carte reste neutre.
  match: RecoMatch | null;
  // Le retour à la liste des recommandations, posé devant le titre quand le
  // volet remplace la liste (téléphone, fenêtre étroite).
  retour?: React.ReactNode;
  editing: boolean;
  onToggleEdit: (id: string) => void;
  onExport: (reco: Reco) => void;
  recos: UseRecoState;
  // Où le monstre cherché se trouve dans CETTE recommandation, `null` hors
  // recherche. Sert à déplier les bons decks et à surligner les bons portraits.
  hit?: RecoHit | null;
  // Synchronisation Discord (docs/02-app/siege/feat-recommandations/rendu-de-la-page.md) :
  // - `provenance` : dans « Toutes les recommandations », d'où vient la carte ;
  // - `onDetacher` : recommandation LIÉE, sa corbeille devient « Détacher de ce salon » ;
  // - `publierDans` : recommandation de cet appareil, « Publier dans… » (raison du
  //   refus, ou `null` s'il est permis) ;
  // - `sousBandeau` : le bandeau du salon est posé juste au-dessus.
  provenance?: { nom: string; etat: EtatAffiche | null };
  onDetacher?: () => void;
  publierDans?: { raison: string | null; onClick: () => void };
  sousBandeau?: boolean;
}

// Carte d'une recommandation — ⚠️ **NEUTRE, quel que soit le résultat de
// l'analyse**. Elle se teintait en entier (vert, orange, rouge à 25-45 %),
// et chaque deck, chaque monstre, l'encart de synthèse se teintaient à leur
// tour : une page analysée devenait un patchwork où plus rien ne ressortait.
// Le statut se lit désormais aux PASTILLES et aux CONTOURS — la même règle que
// les équipes de siège —, jamais à un aplat. La table est gardée,
// par statut, pour qu'un ajustement ultérieur reste local.
const AURA: Record<string, string> = {
  ok: 'border-border-soft bg-panel',
  partial: 'border-border-soft bg-panel',
  missing: 'border-border-soft bg-panel',
  unknown: 'border-border-soft bg-panel',
};

export default function RecoCard({
  raisonExportDe,
  onExporterDeckOptimizer,
  reco,
  index,
  monsters,
  monsterByCom2us,
  monsterById,
  offenseTeams,
  equipesChoix,
  match,
  retour,
  hit,
  editing,
  onToggleEdit,
  onExport,
  recos,
  provenance,
  onDetacher,
  publierDans,
  sousBandeau = false,
}: Props) {
  const textes = useTraduction();
  const cr = textes.carteReco;
  const td = textes.recosDiscord;
  const status = match?.status ?? 'unknown';

  // Deux niveaux d'édition distincts :
  //  - `editing` (reco) : titre, auteur, consignes générales, ajout de decks ;
  //  - `editingDeck` (deck) : son nom, ses consignes, ses monstres/sets/stats.
  // Une reco tout juste créée (un seul deck, vide) ouvre directement ce deck.
  const [editingDeck, setEditingDeck] = useState<number | null>(() =>
    editing && reco.decks.length === 1 && reco.decks[0].slots.every((s) => s.com2usId == null)
      ? 0
      : null
  );
  // « Terminer » sur la recommandation termine AUSSI l'édition de ses decks :
  // un effet (et non le onClick) pour couvrir tous les chemins — y compris quand
  // le board bascule l'édition vers une autre recommandation.
  useEffect(() => {
    if (!editing) setEditingDeck(null);
  }, [editing]);


  // Decks DÉPLIÉS (par index) : par défaut aucun, donc déplier la recommandation
  // montre la liste de ses decks sans dérouler leur contenu — on ouvre ensuite
  // celui qui nous intéresse. Réinitialisé si le nombre de decks change (les
  // index se décalent à l'ajout/suppression).
  const [openDecks, setOpenDecks] = useState<Set<number>>(new Set());
  // Supprimer une recommandation SE DÉFAIT au lieu de se confirmer :
  // immédiat, puis « Recommandation supprimée · Annuler » la
  // remet à SA place, avec tous ses decks et ses consignes.
  const notifier = useNotifier();
  function supprimerReco() {
    const index = recos.state.recos.findIndex((r) => r.id === reco.id);
    recos.removeReco(reco.id);
    notifier({ message: cr.supprimee, action: () => recos.restaurerReco(reco, index) });
  }
  const deckCount = reco.decks.length;
  // ⚠️ Un deck retiré ou remis en place DÉCALE les index : le deck en édition
  // ne serait plus le même, et « Annuler » recopierait le contenu d'un autre.
  // Voir `deckEditeApresChangement` — seul un deck tout juste AJOUTÉ (en fin
  // de liste) reste ouvert.
  const deckCountAvant = useRef(deckCount);
  useEffect(() => {
    setOpenDecks(new Set());
    const avant = deckCountAvant.current;
    deckCountAvant.current = deckCount;
    setEditingDeck((cur) => deckEditeApresChangement(cur, avant, deckCount));
  }, [deckCount]);

  // ── Annuler une édition ─────────────────────────────────────────────────
  //
  // Chaque modification s'enregistre tout de suite : annuler, c'est REMETTRE
  // ce qu'on a mémorisé à l'ouverture de l'édition (voir annulerEdition.ts).
  // ⚠️ **Ni confirmation, ni notification** : une confirmation serait un « OK »
  // qui détruit ; une notification « … · Rétablir » ferait une annulation
  // d'annulation, déroutante. La sortie du mode édition dit
  // assez ce qui s'est passé.
  const [avantReco, setAvantReco] = useState<MetaReco | null>(null);
  const [avantDeck, setAvantDeck] = useState<{ index: number; contenu: ContenuDeck } | null>(null);
  // ⚠️ Mémorisé quand l'édition S'OUVRE, et seulement là : `reco` n'est pas
  // dans les dépendances, sinon chaque frappe réécrirait l'état « d'avant ».
  useEffect(() => {
    setAvantReco(editing ? metaReco(reco) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  useEffect(() => {
    const d = editingDeck == null ? undefined : reco.decks[editingDeck];
    setAvantDeck(d && editingDeck != null ? { index: editingDeck, contenu: contenuDeck(d) } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingDeck]);

  const deckEnCours = avantDeck ? reco.decks[avantDeck.index] : undefined;
  const deckModifie = !!avantDeck && !!deckEnCours && !memeContenu(contenuDeck(deckEnCours), avantDeck.contenu);
  const recoModifiee = !!avantReco && !memeContenu(metaReco(reco), avantReco);

  // Le deck en édition revient à son état d'ouverture.
  function annulerDeck() {
    if (!avantDeck) return;
    recos.remettreContenuDeck(reco.id, avantDeck.index, avantDeck.contenu);
    setEditingDeck(null);
  }

  // ⚠️ Symétrique de « Terminer » sur la recommandation, qui termine aussi
  // l'édition de son deck : « Annuler » y revient sur le nom, l'auteur, les
  // consignes générales ET sur le deck en cours d'édition. Les decks ajoutés
  // pendant l'édition restent.
  function annulerReco() {
    if (!avantReco) return;
    recos.setMeta(reco.id, avantReco);
    if (deckModifie && avantDeck) recos.remettreContenuDeck(reco.id, avantDeck.index, avantDeck.contenu);
    onToggleEdit(reco.id);
  }
  const toggleDeck = (i: number) =>
    setOpenDecks((s) => {
      const next = new Set(s);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  // Decks contenant le monstre cherché : les seuls affichés pendant la
  // recherche, REPLIÉS comme les autres. Les déplier d'office ouvrait d'un
  // coup des dizaines de decks sur un gros lot ; leurs portraits suffisent à
  // choisir lequel ouvrir.
  const decksTrouves = useMemo(
    () => new Set((hit?.decks ?? []).map((d) => d.deckIndex)),
    [hit]
  );
  // Une recherche est en cours sur CETTE carte → on masque les decks qui n'y
  // répondent pas. `hit` vaut `null` hors recherche : rien n'est alors masqué.
  const decksFiltres = hit != null;
  // Positions du monstre dans un deck donné, pour le surlignage.
  const hitDeDeck = (di: number) => hit?.decks.find((d) => d.deckIndex === di) ?? null;
  // Les decks qui diffèrent de la version du salon : une empreinte par deck,
  // une fois par modification de la recommandation.
  const modifies = useMemo(() => decksModifies(reco), [reco]);

  // ── Une page de decks à la fois ─────────────────────────────────────────
  //
  // ⚠️ Une recommandation peut porter des centaines de decks (un lot de
  // salon Discord) : les monter tous figeait la page. On n'en rend qu'une page
  // (voir pagesRecos.ts). Les decks AFFICHÉS, dans l'ordre : tous, ou ceux
  // qu'une recherche trouve, DANS L'ORDRE DE SES RÉSULTATS (celui de la
  // recommandation, ou la fiabilité si on trie par elle) — c'est cette liste
  // qui se pagine, et `di` reste l'index réel du deck.
  const indexCherches = useMemo(
    () => (hit ? hit.decks.map((d) => d.deckIndex) : reco.decks.map((_, i) => i)),
    [reco.decks, hit]
  );
  // ⚠️ **Les pastilles du bilan filtrent LE TABLEAU** : rien d'enclenché =
  // tout est montré ; enclencher restreint, cumulable (plusieurs verdicts à la
  // fois). Elles listaient leurs decks dans une seconde liste, au-dessus du
  // tableau qui redisait les mêmes verdicts.
  const [verdictsVus, setVerdictsVus] = useState<Set<VerdictKey>>(new Set());
  const filtreVerdict = match && verdictsVus.size > 0;
  // ⚠️ Le deck en édition reste affiché même si la recherche ou le filtre ne
  // le retiennent pas : un counter tout juste ajouté (vide) s'édite à l'écran.
  const indexAffiches = useMemo(() => {
    const filtres = filtreVerdict
      ? indexCherches.filter((di) => {
          const v = VERDICT_DE[match.decks[di]?.status ?? 'unknown'];
          return v != null && verdictsVus.has(v);
        })
      : indexCherches;
    return editingDeck != null && editingDeck < reco.decks.length && !filtres.includes(editingDeck)
      ? [...filtres, editingDeck]
      : filtres;
  }, [indexCherches, filtreVerdict, match, verdictsVus, editingDeck, reco.decks.length]);
  const [pageDecks, setPageDecks] = useState(0);
  const pageDecksBornee = pageBornee(pageDecks, indexAffiches.length, DECKS_PAR_PAGE);
  const decksDeLaPage = tranche(indexAffiches, pageDecks, DECKS_PAR_PAGE);
  // « Déplier / Replier tous les decks » — un geste, deux boutons (lien au
  // doigt, bouton fantôme à la souris). Il porte sur les decks AFFICHÉS :
  // pendant une recherche, ceux qu'elle trouve, pas ceux qu'elle masque.
  const tousOuverts = indexAffiches.every((i) => openDecks.has(i));
  const basculerTousLesDecks = () =>
    setOpenDecks((s) => {
      const next = new Set(s);
      for (const i of indexAffiches) tousOuverts ? next.delete(i) : next.add(i);
      return next;
    });
  // Une autre recherche, ou un autre tri : la liste change, on repart de sa
  // première page. ⚠️ Clé = les decks affichés dans leur ordre, pas l'objet
  // `hit` : celui-ci est recalculé à chaque modification de la recommandation,
  // et éditer un deck de la page 3 ramenait à la page 1.
  const cleListe = hit || filtreVerdict ? indexCherches.join(',') + '|' + [...verdictsVus].join(',') : '';
  useEffect(() => setPageDecks(0), [cleListe]);
  // Le deck en édition est TOUJOURS à l'écran : un deck ajouté (en fin de
  // liste) ouvre la dernière page, sinon on l'éditerait sans le voir.
  // ⚠️ Déclaré APRÈS le retour à la première page : il passe en dernier.
  const posEdition = editingDeck == null ? -1 : indexAffiches.indexOf(editingDeck);
  useEffect(() => {
    if (posEdition >= 0) setPageDecks(pageDeLaPosition(posEdition, DECKS_PAR_PAGE));
  }, [editingDeck, posEdition]);

  // « + Ajouter un counter » ouvre la fenêtre d'ajout (capture, mes decks,
  // deck vide — AjoutCounter.tsx) ; le deck ajouté s'ouvre en édition, sans
  // passer par l'édition de la recommandation. On le fait venir à l'écran une
  // fois rendu (sa page peut changer d'abord, d'où l'effet à chaque rendu).
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const racine = useRef<HTMLElement>(null);
  const aMontrer = useRef(false);
  useEffect(() => {
    if (!aMontrer.current) return;
    const el = racine.current?.querySelector('[data-deck-ligne][data-edition]');
    if (el) {
      aMontrer.current = false;
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
  function ajouterCounter(deck: RecoDeck) {
    recos.addDeckWith(reco.id, deck);
    setEditingDeck(reco.decks.length);
    aMontrer.current = true;
  }

  // La source de la recommandation et ses autres étiquettes (provenance, état
  // du salon, Importée), quand il y en a : la 3ᵉ rangée de l'en-tête, sous le
  // nombre de decks et l'auteur. Les actions, à la souris, couvrent toutes les
  // rangées. ⚠️ Classes écrites EN TOUTES LETTRES : Tailwind lit le source
  // comme du texte.
  const aSource = !!provenance || reco.origin === 'imported';
  const rangTitre = 'lg:row-start-1';
  const rangMeta = 'lg:row-start-2';
  const hauteurActions = aSource ? 'lg:row-span-3' : 'lg:row-span-2';

  return (
    // ⚠️ `compact:p-2.5` : même resserrement qu'une équipe de siège
    // (SiegeTeam.tsx) — au doigt, la page empile plusieurs recommandations,
    // et chaque `p-4` coûte 32 px de haut multipliés par leur nombre.
    // Gabarit des cartes de la refonte : rayon 12, contour discret (`AURA`).
    // Sous le bandeau d'un salon, la carte en est la suite : coins du haut droits.
    // ⚠️ **Le volet d'UNE recommandation** (vue Decks, à droite de la liste) :
    // toujours ouvert, en bandes séparées d'un filet — en-tête, consignes,
    // bilan, pagination, puis les lignes de decks, bord à bord.
    <section ref={racine} className={`${sousBandeau ? 'rounded-b-xl' : 'rounded-xl'} min-w-0 border transition-colors ${AURA[status]}`} data-volet-reco>
      <div className="border-b border-border-soft px-4 py-3 compact:px-3">
      {/* En-tête de la recommandation.
          ⚠️ **TROIS zones, pas deux.** Le titre et les icônes d'action
          vivaient chacun dans leur propre bloc (titre + badges à gauche,
          actions à droite), alignés `items-start` — mais dès que les badges
          poussaient le titre à occuper toute sa ligne à lui, l'alignement ne
          répondait plus qu'à une COÏNCIDENCE de hauteurs entre deux éléments
          sans rapport (la boîte de ligne du texte, la boîte de l'icône).
          Le titre et les icônes sont maintenant sur LEUR PROPRE rangée
          (`items-center`), toujours à deux, jamais perturbée par la longueur
          des badges — qui passent en dessous, sur une deuxième rangée qui
          leur est propre et peut s'enrouler librement. */}
      {/* ⚠️ **L'en-tête se lit de haut en bas, aux deux formats** : le NOM
          de la recommandation en titre ; dessous, le nombre de decks, l'auteur
          et les contributeurs ; enfin la source et les autres étiquettes (son
          salon ou « Sur cet appareil », l'état du salon, « Importée »). À la
          souris, une grille : le chevron devant le titre, et au bout, sur
          toute la hauteur, Analyser, Publier dans… et les actions. Au doigt,
          les actions restent à côté du titre. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-3 lg:gap-y-1">
      <div className="mb-1.5 flex items-center gap-2 lg:contents">
        {/* Le retour à la liste, quand le volet la remplace (téléphone,
            fenêtre étroite) : `retour` est posé par la page, DEVANT le titre,
            dans la même cellule. */}
        <div className={`flex min-w-0 flex-1 items-center gap-2 lg:col-start-1 ${rangTitre}`}>
        {retour}
        {editing ? (
          <Champ
            value={reco.name}
            onChange={(e) => recos.setMeta(reco.id, { name: e.target.value })}
            // ⚠️ Trim à la SORTIE du champ, jamais à la frappe : trimer pendant
            // qu'on tape empêche d'écrire une espace entre deux mots.
            onBlur={(e) => {
              const t = e.target.value.trim();
              if (t !== reco.name) recos.setMeta(reco.id, { name: t });
            }}
            placeholder={textes.partage.reco.recommandation(index + 1)}
            pleineLargeur={false}
            className="min-w-[min(160px,100%)] flex-1 bg-panel py-1 text-base font-semibold"
          />
        ) : (
          // ⚠️ `compact:text-base` : même resserrement que le titre d'une
          // équipe de siège (SiegeTeam.tsx). Deux lignes au plus : à côté des
          // actions, dans un volet, une seule coupait les noms longs.
          <h3 className="line-clamp-2 min-w-0 flex-1 break-words font-display text-lg leading-tight tracking-wide compact:text-base">
            {reco.name || textes.partage.reco.recommandation(index + 1)}
          </h3>
        )}
        </div>

        {/* Actions — sur la MÊME rangée que le titre, à sa hauteur ; à la
            souris, au BOUT de l'en-tête, sur la hauteur de ses rangées. */}
        <div className={`flex flex-none items-center gap-1.5 lg:col-start-2 lg:row-start-1 ${hauteurActions}`}>
          {/* « Publier dans… » : à la souris, un bouton à libellé ; au doigt,
              une icône du groupe (plus bas). Pas en édition : on publie ce
              qu'on a fini d'écrire. */}
          {!editing && publierDans && (
            <Bouton
              onClick={publierDans.onClick}
              disabled={!!publierDans.raison}
              title={publierDans.raison ?? undefined}
              taille="sm"
              icone={<Send size={13} />}
              libelle={td.publierDans}
              className={`compact:hidden max-lg:hidden ${BOUTON_LG}`}
            />
          )}
          {/* Filet vertical entre les informations et les actions — à la
              souris seulement. */}
          <span className="hidden h-5 w-px bg-border-soft lg:block" aria-hidden />
          {/* Exporter / Éditer / Supprimer : icônes nues (ni cadre ni fond), comme
              la corbeille — l'en-tête est déjà chargé. Groupées pour se lire
              comme UNE barre d'outils, pas comme trois actions éparses. Le sens
              passe par l'infobulle et l'`aria-label`.
              ⚠️ `taille="serre"` sur les quatre (garde `data-cible-fine`, donc
              l'exemption de la règle tactile des 40 px) — mais la BOÎTE est
              élargie à 24 px (`h-6 w-6`, contre 20 par défaut) pour leur
              redonner un peu d'air autour de l'icône. `h-6` gagne sur le `h-5`
              du composant car il est plus loin dans la feuille de style
              (valeurs Tailwind rangées par ordre croissant) — vérifié dans le
              CSS construit, pas supposé.
              ⚠️ **À la souris, carrés de 28 px aux coins arrondis**
              (`lg:h-7 lg:w-7 lg:rounded-lg`) : la taille et la forme
              des boutons d'icône de la page, les mêmes que les chevrons —
              toute la page n'a plus qu'un seul bouton d'icône. Les variantes
              `lg:` passent après les classes de base dans la feuille : l'ordre
              est garanti, pas supposé. */}
          <div className="flex items-center gap-1 -mr-1 lg:mr-0 lg:gap-0.5">
            {/* ⚠️ Pas `actif` (le marqueur d'état standard) : le ✓ DORÉ
                (`text-star`) est la convention DOCUMENTÉE de l'édition en
                cours sur cette page entière (voir docs/02-app/siege/
                §« icônes d'action »), reprise plus bas sur chaque deck et
                chaque défense — la changer ici la briserait partout ailleurs.
                La couleur est posée sur l'ICÔNE, pas sur le bouton : le bouton
                de la librairie garde ses propres couleurs, et l'ordre de deux
                classes de couleur rivales dans la feuille ne serait pas
                garanti. `aria-pressed` passe directement. */}
            {/* « Annuler les modifications » — en édition
                seulement, À GAUCHE du ✓ : le groupe est en bout de ligne, il
                s'allonge vers la gauche et le ✓ qu'on vient de toucher ne
                bouge pas. Grisé tant que rien n'a changé. */}
            {editing && (
              <BoutonIcone
                onClick={annulerReco}
                disabled={!recoModifiee && !deckModifie}
                taille="serre"
                icone={<Undo2 size={13} />}
                libelle={cr.annulerModifs}
                className={ICONE_ACTION}
              />
            )}
            <BoutonIcone
              onClick={() => onToggleEdit(reco.id)}
              aria-pressed={editing}
              taille="serre"
              icone={editing ? <Check size={14} className="text-star" /> : <Pencil size={13} />}
              libelle={editing ? textes.equipeSiege.terminerEdition : cr.editer}
              className={ICONE_ACTION}
            />
            {/* « Publier dans… » au DOIGT : une icône du groupe ; à la souris,
                le bouton à libellé près d'« Analyser » (plus bas). Toujours
                affiché, désactivé avec sa raison. */}
            {publierDans && !editing && (
              <BoutonIcone
                onClick={publierDans.onClick}
                disabled={!!publierDans.raison}
                taille="serre"
                icone={<Send size={13} />}
                libelle={publierDans.raison ?? td.publierDans}
                className={`lg:hidden ${ICONE_ACTION}`}
              />
            )}
            {/* ⋯ : l'export en fichier, puis Supprimer — ou, pour une
                recommandation LIÉE, « Détacher de ce salon » (elle ne se
                supprime pas). Rares et lourds, ces gestes ne restent pas sous
                le pouce à côté du crayon. */}
            <MenuReco
              libelle={cr.plusActions}
              elements={actionsMenuReco({ cr, td, onExport: () => onExport(reco), onDetacher, onSupprimer: supprimerReco })}
            />
          </div>
        </div>
      </div>

      {/* Métadonnées — SOUS le titre, aux deux formats, sur leur propre rangée
          qui s'enroule librement sans jamais perturber l'alignement
          titre/icônes : provenance, Importée, nombre de decks, auteur et
          contributeurs. À la souris, la 2ᵉ rangée de la grille de l'en-tête,
          sous le titre. */}
      <div className={`${aSource ? 'mb-1.5' : ''} flex flex-wrap items-center gap-2 lg:col-start-1 lg:mb-0 lg:gap-y-1 ${rangMeta}`}>
        {/* ⚠️ Pendant une recherche, le compteur dit « N sur M » : afficher le
            total alors qu'un seul deck est à l'écran se lit comme un bug
            d'affichage — on cherche les cinq autres. Même règle que le compteur
            filtré de l'inventaire d'artéfacts. */}
        <span className="font-mono text-micro text-ink-dim">
          {decksFiltres ? cr.decksSur(decksTrouves.size, reco.decks.length) : cr.decks(reco.decks.length)}
        </span>
        {/* ⚠️ L'auteur ne se SAISIT plus (docs/04-decisions/adr/un-salon-une-reco.md) :
            écrit par Discord à la publication, avec les contributeurs ; un
            auteur déjà présent reste affiché, en lecture seule. */}
        {reco.author && (
          <span className="font-mono text-micro text-ink-dim" data-auteur-reco
            title={reco.contributeurs?.length ? td.ecritsParDiscord : undefined}>
            · {textes.vueAmi.par(reco.author)}
            {reco.contributeurs && reco.contributeurs.filter((n) => n !== reco.author).length > 0
              && ` · ${td.avec(reco.contributeurs.filter((n) => n !== reco.author).join(', '))}`}
          </span>
        )}
      </div>
      {/* Enfin la source et les autres étiquettes, sous les decks et l'auteur. */}
      {aSource && (
        <div className="flex flex-wrap items-center gap-1.5 lg:col-start-1 lg:row-start-3" data-source-reco>
          {/* Dans « Toutes les recommandations » : d'où vient la carte, et
              l'état de son salon. */}
          {provenance && (
            <span className="inline-flex items-center gap-1.5" data-provenance-carte>
              <span className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-panel2 px-2 py-0.5 label">
                {reco.lien ? <Hash size={10} /> : <Smartphone size={10} />} {provenance.nom}
              </span>
              {provenance.etat && <PastilleEtat etat={provenance.etat} />}
            </span>
          )}
          {reco.origin === 'imported' && (
            // Pastille NEUTRE : l'origine est une information, pas un
            // état à signaler — le contour d'accent la faisait passer pour un
            // élément sélectionné.
            <span
              className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-panel2 px-2 py-0.5 label"
              title={cr.importeeAide}
            >
              <Download size={10} /> {cr.importee}
            </span>
          )}
        </div>
      )}
      </div>
      </div>

      {editing && (
        <div className="border-b border-border-soft px-4 py-3 compact:px-3">
          <NoteEditor
            value={reco.note}
            max={NOTE_MAX}
            rows={3}
            label={cr.consignesGenerales}
            placeholder={cr.consignesGeneralesAide}
            onChange={(v) => recos.setMeta(reco.id, { note: v })}
          />
        </div>
      )}

      {/* Les consignes générales sur UNE ligne ; « lire » les ouvre en entier. */}
      {!editing && reco.note && <ConsignesLigne note={reco.note} />}

      {/* Le bilan de la confrontation, dans la rangée des filtres : son résumé
          et ses pastilles, qui filtrent les decks juste en dessous. */}
      {!editing && match && (
        <BilanAnalyse
          match={match}
          decks={indexCherches}
          vus={verdictsVus}
          onChange={setVerdictsVus}
        />
      )}

      {/* Les decks de la recommandation */}
        <>
          {/* ⚠️ La pagination À GAUCHE de « Déplier tous », sur la même
              rangée : au-dessus des decks, elle ne bouge pas quand la page
              change de hauteur (un clic ne déplace jamais ce qu'on vient de
              cliquer). */}
          {/* ⚠️ La rangée est TOUJOURS là, pour « + Ajouter un counter » : au
              bout à droite, il ne bouge pas quand la pagination ou « Déplier
              tous » apparaissent à sa gauche après un ajout. */}
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 border-b border-border-soft px-4 py-1.5 compact:px-3">
              <BarrePages
                page={pageDecksBornee}
                n={indexAffiches.length}
                parPage={DECKS_PAR_PAGE}
                onChange={setPageDecks}
                className="mr-auto"
              />
              {indexAffiches.length > 1 && (<>
              {/* Au doigt : le lien souligné d'avant, inchangé. */}
              <button
                onClick={basculerTousLesDecks}
                className="font-mono text-micro text-ink-dim hoverable:text-ink transition underline lg:hidden"
              >
                {tousOuverts ? cr.replierTous : cr.deplierTous}
              </button>
              {/* ⚠️ **À la souris, un bouton fantôme de la librairie**, plus
                  un lien souligné. Il reste AU-DESSUS du tableau, pas en
                  dessous : en bas, le
                  clic l'aurait repoussé de toute la hauteur des decks dépliés
                  (un clic ne déplace jamais ce qu'on vient de cliquer). */}
              <Bouton
                onClick={basculerTousLesDecks}
                fond="vide"
                trait="aucun"
                taille="sm"
                libelle={tousOuverts ? cr.replierTous : cr.deplierTous}
                className={`hidden lg:inline-flex ${BOUTON_LG}`}
              />
              </>)}
              <Bouton
                onClick={() => setAjoutOuvert(true)}
                trait="pointille"
                taille="sm"
                icone={<Plus size={14} />}
                libelle={cr.ajouterCounter}
                title={cr.ajouterCounterAide}
                className={BOUTON_LG}
                data-ajouter-counter
              />
          </div>
          {/* Les decks se posent au dépliage plutôt que d'apparaître d'un bloc.
              ⚠️ L'animation est sur CE conteneur, déjà présent, et non sur un
              `<div>` ajouté autour du fragment : un wrapper de plus casserait
              l'espacement du parent pour un simple effet.
              ⚠️ **À la souris, un TABLEAU** : une seule colonne
              de lignes, dans un cadre commun, sous une rangée d'intitulés. Il a
              remplacé une grille de cartes à deux colonnes (`lg:grid-cols-2`),
              où le deck en édition prenait les deux (`lg:col-span-2`).
              ⚠️ **Ce `col-span-2` était resté** sur le deck en édition : dans
              une grille à UNE colonne, il en créait une seconde, implicite —
              la rangée d'intitulés et les lignes se tassaient dans la
              première, « Offense · sets visés » passait sur trois lignes et
              « Fort contre » chevauchait dès qu'on éditait un deck. Retiré. */}
          {/* ⚠️ Les lignes bord à bord, sans rangée d'intitulés : chaque ligne
              se lit d'elle-même (portraits, défense battue, verdict,
              actions), et une rangée de colonnes ne tient pas dans un volet
              dont la largeur varie. */}
          <div className="animate-[apparition_180ms_var(--ease-out)]" data-decks-reco>
            {/* ⚠️ Pendant une recherche, SEULS les decks trouvés sont rendus —
                les autres disparaissent complètement. Sans ça la carte remontait
                dans les résultats en affichant ses six decks, et il fallait
                encore chercher à l'œil lequel répondait. Le filtre porte donc
                sur les deux niveaux : quelles recos, et quels decks dedans.
                ⚠️ On itère sur les decks D'ORIGINE et on filtre : `di` doit
                rester l'index réel, il indexe le match, l'édition et le repli.
                ⚠️ Seule la PAGE courante est rendue (`decksDeLaPage`). */}
            {decksDeLaPage.map((di) => {
              const deck = reco.decks[di];
              return (
                  <DeckBlock
                    key={di}
                    raisonExportOptimizer={raisonExportDe(deck)}
                    onExporterOptimizer={() => onExporterDeckOptimizer(deck)}
                    reco={reco}
                    deck={deck}
                    deckIndex={di}
                    monsters={monsters}
                    monsterByCom2us={monsterByCom2us}
                    match={match?.decks[di] ?? null}
                    editing={editingDeck === di}
                    onToggleEdit={() => setEditingDeck((cur) => (cur === di ? null : di))}
                    onAnnulerEdition={annulerDeck}
                    annulable={editingDeck === di && deckModifie}
                    folded={!openDecks.has(di) && editingDeck !== di}
                    onToggleFold={() => toggleDeck(di)}
                    hit={hitDeDeck(di)}
                    recos={recos}
                    onSupprime={() => setEditingDeck(null)}
                    modifie={modifies.has(di)}
                  />
              );
            })}
          </div>
          {/* La même pagination au bas des decks, pour ne pas remonter toute
              la liste. ⚠️ Pas en édition : le pied d'ajout des decks est
              collé sous les decks, rien ne s'intercale. */}
          {!editing && nombrePages(indexAffiches.length, DECKS_PAR_PAGE) > 1 && (
            <div className="border-t border-border-soft px-4 py-2">
              <BarrePages
                page={pageDecksBornee}
                n={indexAffiches.length}
                parPage={DECKS_PAR_PAGE}
                onChange={setPageDecks}
                className="justify-center"
              />
            </div>
          )}
        </>

      {/* L'ajout d'un counter : capture, mes decks ou deck vide. Partir d'une
          de ses équipes s'y fait aussi, hors du mode édition. */}
      {ajoutOuvert && (
        <AjoutCounter
          recos={[{ id: reco.id, nom: reco.name || textes.partage.reco.recommandation(index + 1) }]}
          defenseVisee={null}
          offenseTeams={offenseTeams}
          equipes={equipesChoix}
          monsters={monsters}
          monsterById={monsterById}
          monsterByCom2us={monsterByCom2us}
          onAjouter={(_, deck) => ajouterCounter(deck)}
          onClose={() => setAjoutOuvert(false)}
        />
      )}
    </section>
  );
}


/* ---- Consignes générales, bilan en miniature ---------------------------- */

// Les consignes générales sur UNE ligne, tronquée ; « lire » les ouvre en
// entier, à la même place (le bouton reste au bout de la première ligne).
function ConsignesLigne({ note }: { note: string }) {
  const textes = useTraduction();
  const cr = textes.carteReco;
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="flex items-start gap-2 border-b border-border-soft px-4 py-2 text-sm compact:px-3" data-consignes-reco>
      <StickyNote size={13} className="mt-1 flex-none text-star" />
      <p className={`min-w-0 flex-1 text-ink-dim ${ouvert ? 'whitespace-pre-line' : 'truncate'}`}>
        <b className="font-semibold text-ink">{cr.consignesGenerales}</b> · {note}
      </p>
      <button
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex-none text-xs text-ink-dim underline transition hoverable:text-ink"
      >
        {ouvert ? cr.replier : cr.lire}
      </button>
    </div>
  );
}

// Le bilan d'une recommandation en miniature, dans la liste de la vue Decks :
// un compte par verdict, le point de sa couleur (creux pour « monstre
// manquant »), le libellé en infobulle. Rien sans confrontation.
export function BilanMini({ match }: { match: RecoMatch }) {
  const cr = useTraduction().carteReco;
  const comptes = new Map<VerdictKey, number>();
  for (const d of match.decks) {
    const v = VERDICT_DE[d.status];
    if (v) comptes.set(v, (comptes.get(v) ?? 0) + 1);
  }
  return (
    <span className="inline-flex items-center gap-2 font-mono text-micro text-ink-dim" data-bilan-mini>
      {VERDICTS.map((v) => (
        <span key={v.key} className="inline-flex items-center gap-1" title={cr.verdicts[v.key]}>
          <span className={`h-1.5 w-1.5 flex-none rounded-full ${v.dot}`} />
          {comptes.get(v.key) ?? 0}
        </span>
      ))}
    </span>
  );
}

/* ---- Le ⋯ d'une recommandation ----------------------------------------- */

// Les gestes rares d'une recommandation, derrière son ⋯ : sur sa carte (vue
// Decks) comme sur son bandeau dans le volet Défenses. `avant` : ce que le
// volet y ajoute (Publier dans…, Éditer), en tête.
export function actionsMenuReco({ cr, td, onExport, onDetacher, onSupprimer, avant = [] }: {
  cr: Dictionnaire['carteReco'];
  td: Dictionnaire['recosDiscord'];
  onExport: () => void;
  onDetacher?: () => void;
  onSupprimer: () => void;
  avant?: ElementMenu[];
}): ElementMenu[] {
  return [
    ...avant,
    { cle: 'exporter', libelle: cr.exporter, title: cr.exporterAide, icone: <Upload size={14} />, onClick: onExport },
    // Une recommandation LIÉE ne se supprime pas : elle se détache de son
    // salon, pour ce membre seul (un dialogue le dit) — rien n'est perdu, d'où
    // pas de `danger`.
    onDetacher
      ? { cle: 'detacher', libelle: td.detacher, icone: <Link2Off size={14} />, onClick: onDetacher }
      : { cle: 'supprimer', libelle: cr.supprimer, icone: <Trash2 size={14} />, danger: true, onClick: onSupprimer },
  ];
}

// Le ⋯ : le bouton d'icône de la page (28 px à la souris), pas le « ⋯ » des
// en-têtes d'écran, plus haut.
// ⚠️ Enveloppé dans une boîte à sa taille : avec un déclencheur fourni, le
// menu prend `w-full`, et dans une rangée d'icônes il s'étirerait.
export function MenuReco({ libelle, elements, grand = false }: { libelle: string; elements: ElementMenu[]; grand?: boolean }) {
  return (
    <div className="flex-none" data-menu-reco>
      <Menu
        libelle={libelle}
        elements={elements}
        declencheur={({ ref, ...p }) => (
          <BoutonIcone ref={ref} {...p} taille="serre" icone={<MoreHorizontal size={15} />} libelle={libelle}
            className={grand ? 'h-10 w-10 lg:h-7 lg:w-7 lg:rounded-lg' : ICONE_ACTION} />
        )}
      />
    </div>
  );
}

/* ---- Pagination --------------------------------------------------------- */

// « 21–40 sur 700 » puis le `Pager` de l'inventaire (flèches et champ de
// page). Rien sous une page : une recommandation ordinaire n'en voit rien.
export function BarrePages({ page, n, parPage, onChange, className = '' }: {
  page: number;
  n: number;
  parPage: number;
  onChange: (p: number) => void;
  className?: string;
}) {
  const cr = useTraduction().carteReco;
  const pages = nombrePages(n, parPage);
  if (pages <= 1) return null;
  const { debut, fin } = plageDeLaPage(page, n, parPage);
  return (
    <div className={`flex items-center gap-2 ${className}`} data-pages-reco>
      <span className="font-mono text-micro text-ink-dim">{cr.plage(debut, fin, n)}</span>
      <Pager page={page} pageCount={pages} onChange={onChange} />
    </div>
  );
}

/* ---- Aperçu replié ------------------------------------------------------ */

// L'aperçu d'une recommandation repliée — une pastille par deck (ou par
// défense, en vue Défense) — tient sur DEUX LIGNES au plus : ce qui ne tient
// pas se résume en « +N », les noms cachés en infobulle. `fin` (consignes,
// decks sans défense) suit toujours, dans les deux lignes.
//
// ⚠️ **On MESURE, on ne devine pas** (même principe que BarreActions) : la
// place dépend de la largeur de la carte et de la longueur de chaque nom. On
// cherche, par dichotomie, le plus grand nombre de pastilles qui tient sur
// deux lignes avec le « +N » et la fin — avant la première peinture
// (`useLayoutEffect`) : rien ne saute à l'écran. ⚠️ Jamais une pastille de
// moins par rendu : au-delà de 50 rendus imbriqués, React démonte toute l'app
// (src/lib/apercuDeuxLignes.ts). Un redimensionnement relance la recherche.
// En rendu serveur, tout est rendu.
// ⚠️ **La recherche ne porte que sur les PLAFOND_APERCU premières pastilles.**
// Deux lignes n'en tiennent jamais autant (une pastille fait au moins ~40 px) ;
// le premier essai les rendait pourtant TOUTES — sept cents pour un lot de
// sept cents decks, à chaque dépliage ou redimensionnement. Le « +N » compte,
// lui, toutes les autres.
const PLAFOND_APERCU = 60;

export function ApercuDeuxLignes({ pastilles, fin }: {
  pastilles: { cle: string; nom: string; noeud: React.ReactNode }[];
  fin: React.ReactNode;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);

  // Le contenu, en une chaîne : une pastille renommée relance la recherche,
  // comme un changement de largeur. Le total y entre : un deck de plus, au-delà
  // du plafond, change le « +N ».
  const candidates = pastilles.slice(0, PLAFOND_APERCU);
  const signature = `${pastilles.length}|${candidates.map((p) => `${p.cle}:${p.nom}`).join('|')}`;
  const cle = `${largeur}|${signature}`;
  const [etat, setEtat] = useState(() => rechercheInitiale(cle, candidates.length));
  // Une autre clé : la recherche repart de toutes les candidates dès ce rendu.
  const recherche = etat.cle === cle ? etat : rechercheInitiale(cle, candidates.length);
  const visibles = recherche.essai;

  // Chaque essai rendu est mesuré (chaque pastille, le « +N » et la fin
  // comptés à leur rangée) ; l'essai suivant n'est rendu que s'il y en a un.
  // `fin` en dépendance : elle prend de la place sans entrer dans la clé.
  useLayoutEffect(() => {
    const el = zone.current;
    if (!el) return;
    const tient = compterLignes(Array.from(el.children, (c) => c.getBoundingClientRect())) <= 2;
    const suivante = etapeRecherche(recherche, tient);
    if (suivante) setEtat(suivante);
  }, [recherche, fin]);

  useLayoutEffect(() => {
    const el = zone.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setLargeur(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cachees = pastilles.slice(visibles);
  return (
    <div ref={zone} className="flex w-full flex-wrap items-center gap-1.5" data-apercu-reco>
      {pastilles.slice(0, visibles).map((p) => <Fragment key={p.cle}>{p.noeud}</Fragment>)}
      {cachees.length > 0 && (
        <span className="inline-flex items-center rounded-full border border-border-soft bg-panel2 px-2 py-0.5 font-mono text-micro text-ink-dim"
          title={cachees.map((p) => p.nom).join('\n')} data-apercu-plus>
          +{cachees.length}
        </span>
      )}
      {fin}
    </div>
  );
}

/* ---- Rapport d'analyse -------------------------------------------------- */

// Pourquoi un slot ne passe pas, en une ligne lisible.
// Les libellés du jeu (stats, sets, propriétés d'artéfact) viennent du lexique
// de la langue affichée, jamais des `label` du match (écrits en français).
function slotProblem(
  slot: RecoSlot,
  sm: SlotMatch,
  byCom2us: Map<number, Monster>,
  t: Dictionnaire
): string | null {
  if (sm.status === 'ok' || sm.status === 'empty' || sm.status === 'unknown') return null;
  const p = t.carteReco.probleme;
  const nom = (slot.com2usId != null ? byCom2us.get(slot.com2usId)?.name : null) ?? slot.name ?? '?';
  if (sm.status === 'absent') return p.indisponible(nom);

  const bouts: string[] = [];
  // Le runage d'abord : reruner change les stats, l'inverse n'est pas vrai.
  if (sm.missingSets.length) bouts.push(p.setManquant(sm.missingSets.map((k) => nomSet(t.jeu, k)).join(' + ')));
  for (const c of sm.artifactChecks) {
    if (!c.ok) bouts.push(p.artefactAbsent(p.sorte[c.kind], artifactSubLabel(c.code, t.jeu)));
  }
  for (const c of sm.checks) {
    if (!c.ok && c.actual !== null) {
      bouts.push(p.statInsuffisante(t.jeu.stats[c.key], `${fmtStat(c.actual)}${c.suffix}`, `${fmtStat(c.required)}${c.suffix}`));
    }
  }
  return `${nom} — ${bouts.join(' · ')}`;
}

// Verdict d'un deck qui ne passe pas. On dit toujours si c'est **faisable** ou
// non : « à composer » (tu as les monstres) vs « impossible » (il t'en manque).
// ⚠️ `ko` n'a pas de libellé fixe : la cause dépend du deck (runage, stats, ou
// les deux) — voir `deckFault`.
function deckProblem(dm: DeckMatch, t: Dictionnaire): string {
  const p = t.carteReco.probleme;
  if (dm.status === 'missing') return p.deckImpossible;
  if (dm.status === 'nodeck') return p.aComposer;
  if (dm.status === 'ko') return libelleCausesDeck(deckFaults(dm.slots), t) || p.criteres;
  return '';
}

// Les QUATRE familles de verdict de l'analyse — une par statut réel.
//
// ⚠️ Le rouge est SCINDÉ en deux, alors qu'il ne l'était pas au départ : « à
// revoir » et « monstre manquant » partagent la couleur mais pas du tout le
// geste. L'un se répare en rerunant ce qu'on possède déjà ; l'autre demande
// d'invoquer et de monter un monstre qu'on n'a pas — ce n'est plus le même
// horizon, ni la même décision. Les fondre obligeait à parcourir la liste rouge
// pour trier à l'œil ce sur quoi on pouvait agir ce soir.
//
// Les deux gardent le même rouge, `bad` : ils sont bloquants tous les deux, et
// c'est bien ce que la couleur dit. Ce sont deux FILTRES sur un même rouge, pas
// deux couleurs de plus.
// ⚠️ `bad`, le rouge d'ÉTAT, et non plus `fire`, celui de l'élément Feu :
// un rouge de faute ne doit pas se lire comme un
// monstre Feu, et « Tout effacer » était déjà en `bad` sur la même page.
type VerdictKey = 'ok' | 'nodeck' | 'ko' | 'missing';

// Le libellé de chaque verdict : `carteReco.verdicts` du dictionnaire.
const VERDICTS: {
  key: VerdictKey;
  statuts: DeckMatch['status'][];
  dot: string;
  texte: string;
  actif: string;
  // ⚠️ Rang de TRI de la liste, distinct de l'ordre des pastilles ci-dessous.
  // La liste va du plus urgent au plus tranquille — rouge, orange, vert : ce
  // qui demande du travail se lit en premier, les decks déjà jouables closent
  // et n'ont pas à être dépassés pour atteindre les problèmes.
  rang: number;
}[] = [
  // L'ordre du TABLEAU est celui des PASTILLES, qui se lisent comme une
  // légende, du meilleur au pire — l'inverse de la liste, et c'est voulu :
  // une légende ordonne des catégories, une liste hiérarchise l'urgence.
  {
    key: 'ok',
    statuts: ['ok'],
    dot: 'bg-good',
    texte: 'text-good',
    // `actif` : la pastille COLORÉE de repos (`PASTILLE_STATUT`, la même que
    // sur les decks) + le CONTOUR du ton, qui seul dit « enclenché » — voir
    // le filtre dans `AnalysisSummary`.
    actif: 'border-good bg-good-soft text-good',
    rang: 3,
  },
  {
    key: 'nodeck',
    statuts: ['nodeck'],
    dot: 'bg-warn',
    texte: 'text-warn',
    actif: 'border-warn bg-warn-soft text-warn',
    rang: 2,
  },
  {
    key: 'ko',
    statuts: ['ko'],
    dot: 'bg-bad',
    texte: 'text-bad',
    actif: 'border-bad bg-bad-soft text-bad',
    rang: 1,
  },
  {
    // ⚠️ Le plus bloquant en tête de liste : rien de ce qu'on possède ne
    // répare un monstre absent, alors qu'un « à revoir » se corrige le soir
    // même avec les runes qu'on a déjà.
    key: 'missing',
    statuts: ['missing'],
    // ⚠️ Point CREUX, même rouge : deux pastilles de la même couleur côte à
    // côte ne se distinguent plus que par leur texte, qu'on ne relit pas une
    // fois la barre connue. Le creux dit « il manque quelque chose » sans
    // introduire une cinquième couleur qui mentirait sur la gravité.
    dot: 'border border-bad',
    texte: 'text-bad',
    actif: 'border-bad bg-bad-soft text-bad',
    rang: 0,
  },
];

// ⚠️ **Pastille de statut COLORÉE** (fond doux du ton, texte du ton, pas de
// contour) : réduite à un point de 6 px, la couleur ne se voyait pas assez
// sur les pastilles de validation des decks. La CARTE reste neutre, mais la
// pastille qui dit le verdict porte sa couleur en entier. Contrastes mesurés,
// texte sur fond doux, deux thèmes : 4.91 au plus bas (`warn` ocre sur
// `warn-soft`, Atelier ; `bad` sur `bad-soft` fait 5.53 en Forge).
// Par STATUT de deck (celui de `DOT`), pas par verdict : les puces de la carte
// repliée et la ligne du tableau disent la même chose de la même façon.
const PASTILLE_STATUT: Record<string, string> = {
  ok: 'border-transparent bg-good-soft text-good',
  partial: 'border-transparent bg-warn-soft text-warn',
  nodeck: 'border-transparent bg-warn-soft text-warn',
  ko: 'border-transparent bg-bad-soft text-bad',
  missing: 'border-transparent bg-bad-soft text-bad',
  // Non analysé : neutre — rien à dire encore.
  unknown: 'border-border bg-panel2/60 text-ink-dim',
};

const VERDICT_DE: Record<string, VerdictKey | null> = {
  ok: 'ok',
  nodeck: 'nodeck',
  ko: 'ko',
  missing: 'missing',
  unknown: null,
};

// La cause d'un verdict, en clair, écrite SOUS la pastille du deck : ce qui
// le rend jouable (l'équipe retenue), ou ce qui cloche. Le détail monstre par
// monstre va dans l'infobulle (`detailVerdict`) et dans les fiches du deck
// ouvert. Elle n'était lisible que dans la liste du bilan.
function causeVerdict(dm: DeckMatch, t: Dictionnaire, byCom2us: Map<number, Monster>, deck: RecoDeck): string {
  const cr = t.carteReco;
  if (dm.status === 'ok') return dm.team ? cr.jouableAvec(libelleSource(dm.team, cr.sources)) : cr.jouable;
  if (dm.status === 'nodeck') return cr.probleme.aComposerCourt;
  if (dm.status === 'missing') {
    const absents = deck.slots.flatMap((s, i) => (dm.slots[i]?.status === 'absent'
      ? [(s.com2usId != null ? byCom2us.get(s.com2usId)?.name : null) ?? s.name ?? '?'] : []));
    return absents.length ? `${absents.join(', ')} — ${cr.indisponible}` : cr.probleme.deckImpossible;
  }
  return deckProblem(dm, t);
}

function detailVerdict(dm: DeckMatch, t: Dictionnaire, byCom2us: Map<number, Monster>, deck: RecoDeck): string {
  const lignes = deck.slots.flatMap((slot, si) => {
    const txt = dm.slots[si] ? slotProblem(slot, dm.slots[si], byCom2us, t) : null;
    return txt ? [txt] : [];
  });
  return [verdictDeck(dm, t)?.text, ...lignes].filter(Boolean).join('\n');
}

// Le verdict d'un deck, le même partout (ligne du tableau, volet Défenses) :
// la pastille, combien de fois il se monte, et sa cause dessous.
export function VerdictDeck({ dm, deck, monsterByCom2us, aDroite = false }: {
  dm: DeckMatch;
  deck: RecoDeck;
  monsterByCom2us: Map<number, Monster>;
  aDroite?: boolean;
}) {
  const textes = useTraduction();
  const cle = VERDICT_DE[dm.status];
  const v = cle ? VERDICTS.find((x) => x.key === cle) : null;
  if (!v) return null;
  return (
    // La pastille, puis sur une ligne : la cause (tronquée, entière en
    // infobulle) et combien de fois le deck se monte.
    <span className={`flex min-w-0 max-w-full flex-col gap-0.5 ${aDroite ? 'lg:items-end' : 'items-start'}`} title={detailVerdict(dm, textes, monsterByCom2us, deck)} data-verdict-deck>
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-micro font-semibold ${PASTILLE_STATUT[dm.status] ?? PASTILLE_STATUT.unknown}`}>
        <span className={`h-1.5 w-1.5 flex-none rounded-full ${v.dot}`} />
        {textes.carteReco.verdicts[v.key]}
      </span>
      <span className={`flex min-w-0 max-w-full items-baseline gap-1 text-micro leading-tight ${aDroite ? 'lg:justify-end' : ''}`}>
        <span className="min-w-0 truncate text-ink-dim" data-cause-verdict>{causeVerdict(dm, textes, monsterByCom2us, deck)}</span>
        <span className="flex-none whitespace-nowrap"><CopiesBadge copies={dm.copies} /></span>
      </span>
    </span>
  );
}

// Le bilan de la confrontation, carte dépliée : le résumé, puis une pastille
// par verdict qui FILTRE le tableau des decks (rien d'enclenché = tout).
// ⚠️ Cumulables (plusieurs verdicts à la fois) : des pastilles indépendantes,
// pas un `Segmented`, qui dirait que les choix s'excluent. Leurs comptes
// portent sur les decks AFFICHÉS (une recherche en cours compte).
function BilanAnalyse({
  match,
  decks,
  vus,
  onChange,
}: {
  match: RecoMatch;
  decks: number[];
  vus: Set<VerdictKey>;
  onChange: (vus: Set<VerdictKey>) => void;
}) {
  const textes = useTraduction();
  const cr = textes.carteReco;
  const verdicts = decks.flatMap((di) => {
    const v = VERDICT_DE[match.decks[di]?.status ?? 'unknown'];
    return v ? [v] : [];
  });
  const compte = (k: VerdictKey) => verdicts.filter((v) => v === k).length;
  const rates = match.totalDecks - match.okDecks;
  const bascule = (k: VerdictKey) => {
    const next = new Set(vus);
    if (!next.delete(k)) next.add(k);
    onChange(next);
  };

  if (match.totalDecks === 0) {
    return (
      <div className="border-b border-border-soft px-4 py-2 compact:px-3" data-bilan-analyse>
        <p className="text-sm text-ink-dim">{cr.rienAAnalyser}</p>
      </div>
    );
  }

  // L'icône et le titre de l'encart prennent la couleur du pire verdict
  // présent : vert si tout passe, orange sinon — le rouge reste porté par les
  // lignes, pour ne pas alarmer sur une reco dont il ne manque qu'une équipe à
  // composer. ⚠️ Le FOND reste neutre (voir `AURA`) : un encart teinté
  // posé dans une carte teintée ne ressortait plus.
  const toutPasse = rates === 0;

  return (
    // ⚠️ **Une rangée, pas un encart** : le résumé puis les pastilles qui
    // filtrent, entre deux filets — un encart de plus dans le volet pesait
    // autant que les decks qu'il résume.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border-soft px-4 py-2 compact:px-3" data-bilan-analyse>
      <div className="flex items-center gap-2">
        {toutPasse ? (
          <Check size={15} className="flex-none text-good" />
        ) : (
          <AlertTriangle size={15} className="flex-none text-warn" />
        )}
        <p className={`text-sm font-semibold ${toutPasse ? 'text-good' : 'text-warn'}`}>
          {toutPasse ? cr.toutRespecte(match.totalDecks) : cr.bilan(match.okDecks, match.totalDecks, rates)}
        </p>
      </div>

      {/* Filtres de verdict — pastilles CUMULABLES (plusieurs couleurs à la
          fois), d'où des boutons indépendants et non un `Segmented`, qui dirait
          que les choix s'excluent (voir ui/Segmented.tsx).
          ⚠️ La BORDURE marque l'actif, jamais un aplat plein : c'est la règle
          des pastilles de filtre (voir docs/03-developpeur/interface/).
          Un verdict sans aucun deck est affiché GRISÉ et non retiré : on voit
          qu'il n'y en a aucun, au lieu de chercher un bouton disparu.
          ⚠️ **Colorées AU REPOS, comme les pastilles des decks en dessous**
          (`PASTILLE_STATUT`) — la même couleur dans le résumé d'analyse et
          dans les cartes en dessous : fond doux et
          texte du ton. Elles étaient neutres au repos, seul le point coloré.
          Enclenchée, la pastille garde ces couleurs et prend le CONTOUR de son
          ton — la bordure reste le seul marqueur d'état.
          ⚠️ Pas un `Bouton` de la librairie : chaque verdict porte SA couleur
          sémantique (bon/à composer/à revoir/manquant), et aucune n'est un ton
          de bouton (accent, danger…) — même exception que les pastilles
          manque/surplus de siège et « Recommandation ignorée ». */}
      <div className="flex flex-wrap items-center gap-1.5">
        {VERDICTS.map((v) => {
          const n = compte(v.key);
          const actif = vus.has(v.key);
          return (
            <button
              key={v.key}
              onClick={() => bascule(v.key)}
              disabled={n === 0}
              aria-pressed={actif}
              title={
                n === 0
                  ? cr.aucunDeck(cr.verdicts[v.key])
                  : actif
                    ? cr.nePlusIsoler(cr.verdicts[v.key])
                    : cr.isoler(cr.verdicts[v.key])
              }
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs
                          font-semibold transition ${BOUTON_LG} ${
                            n === 0
                              ? 'border-border text-ink-dim opacity-40 cursor-not-allowed'
                              : actif
                                ? v.actif
                                : `${PASTILLE_STATUT[v.key]} hoverable:border-border`
                          }`}
            >
              {/* 2 px de plus que le point des lignes : un cercle CREUX de
                  1.5 px ne se lit pas, son intérieur disparaît. */}
              <span className={`h-2 w-2 flex-none rounded-full ${v.dot}`} />
              {cr.verdicts[v.key]}
              <span className="font-mono text-micro text-ink-dim">{n}</span>
            </button>
          );
        })}
        {/* « Tout afficher », après les pastilles : il apparaît sans déplacer
            celle qu'on vient d'enclencher. Au doigt : le lien souligné ; à la
            souris : un bouton fantôme de la librairie, comme « Déplier tous
            les decks ». */}
        {vus.size > 0 && (
          <>
            <button
              onClick={() => onChange(new Set())}
              className="text-xs text-ink-dim underline transition hoverable:text-ink lg:hidden"
            >
              {textes.commun.toutAfficher}
            </button>
            <Bouton
              onClick={() => onChange(new Set())}
              fond="vide"
              trait="aucun"
              taille="sm"
              libelle={textes.commun.toutAfficher}
              className={`hidden lg:inline-flex ${BOUTON_LG}`}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Un deck (3 monstres) ---------------------------------------------- */


// ⚠️ **UN seul bouton d'icône sur toute la page, à la souris** : un carré de 28 px aux coins arrondis, sans cadre ni fond —
// chevrons, Exporter, Éditer, Supprimer, en-tête de recommandation comme ligne
// de deck. Au doigt, chacun garde sa taille d'avant (24 px dans l'en-tête de la
// recommandation, 20 px dans celui du deck) : `taille="serre"` et son exemption
// tactile ne changent pas.
const ICONE_LG = 'lg:h-7 lg:w-7 lg:rounded-lg';
const ICONE_ACTION = `h-6 w-6 ${ICONE_LG}`;
// Même règle pour les boutons à LIBELLÉ et les pastilles de filtre : 28 px de
// haut à la souris, la hauteur des boutons d'icône. Seul « + Défense » y
// échappe — il prend la hauteur des vignettes de défense qu'il prolonge.
const BOUTON_LG = 'lg:h-7';
// ⚠️ Plus de bouton d'ajout FANTÔME : « Ajouter un counter », « Importer un
// deck d'offense » et « + Défense » l'ont été un temps, et ne
// ressortaient pas. Ils gardent le fond d'un bouton et le bord POINTILLÉ d'un ajout.

// Supprimer un deck SE DÉFAIT au lieu de se confirmer : immédiat, puis
// « Deck supprimé · Annuler » le remet à SA place. Le même geste depuis la
// carte et depuis le volet Défenses.
export function supprimerDeckAnnulable(
  recos: UseRecoState,
  notifier: ReturnType<typeof useNotifier>,
  cr: Dictionnaire['carteReco'],
  recoId: string,
  deck: RecoDeck,
  deckIndex: number,
) {
  recos.removeDeck(recoId, deckIndex);
  notifier({ message: cr.deckSupprime, action: () => recos.restaurerDeck(recoId, deck, deckIndex) });
}

export function DeckBlock({
  raisonExportOptimizer,
  onExporterOptimizer,
  reco,
  deck,
  deckIndex,
  monsters,
  monsterByCom2us,
  match,
  editing,
  onToggleEdit,
  onAnnulerEdition,
  annulable,
  folded,
  onToggleFold,
  hit,
  recos,
  onSupprime,
  contre,
  modifie = false,
}: {
  // Le deck diffère de la version de son salon : le tag « Modifié »
  // (recoModifies.ts, calculé une fois par recommandation par l'appelant).
  modifie?: boolean;
  raisonExportOptimizer?: string;
  onExporterOptimizer: () => void;
  reco: Reco;
  deck: RecoDeck;
  deckIndex: number;
  monsters: Monster[];
  monsterByCom2us: Map<number, Monster>;
  match: DeckMatch | null;
  // Dans le volet Défenses : la défense est déjà nommée au-dessus. La ligne
  // dit à sa place la fiabilité de CE deck contre elle, sa précision, ses
  // consignes, et sa recommandation quand les offenses sont à plat.
  // `counterIndex` : la défense dans `deck.counters`, pour la noter sur place
  // (-1 : le deck ne la vise pas).
  contre?: { fiabilite?: number; note: string; vise: boolean; counterIndex: number; reco?: string };
  editing: boolean; // édition de CE deck (indépendante de celle de la reco)
  onToggleEdit: () => void;
  // Sortir de l'édition en remettant le deck tel qu'il était à son ouverture.
  onAnnulerEdition: () => void;
  annulable: boolean; // quelque chose a changé depuis l'ouverture
  folded: boolean;
  onToggleFold: () => void;
  // Positions du monstre cherché dans CE deck, `null` hors recherche.
  hit: DeckHit | null;
  recos: UseRecoState;
  // Termine l'édition du deck avant sa suppression.
  onSupprime: () => void;
}) {
  const textes = useTraduction();
  const cr = textes.carteReco;
  // Supprimer un deck SE DÉFAIT au lieu de se confirmer : immédiat, puis
  // « Deck supprimé · Annuler » le remet à SA place — le dernier deck remplace
  // alors le deck vide laissé derrière lui (voir `decksApresRestauration`).
  // ⚠️ L'édition se termine AVANT : supprimer le dernier deck le remplace par
  // un deck vide sans changer leur nombre, et l'édition resterait ouverte sur
  // ce deck vide avec le contenu d'avant mémorisé — « Annuler les
  // modifications » recopierait alors à moitié le deck supprimé.
  const notifier = useNotifier();
  function supprimerDeck() {
    onSupprime();
    supprimerDeckAnnulable(recos, notifier, cr, reco.id, deck, deckIndex);
  }
  const status = match?.status ?? 'unknown';
  const empty = deck.slots.every((s) => s.com2usId == null);
  // Le verdict de la ligne, le même aux deux formats : la pastille des filtres,
  // combien de fois le deck est montable, et sa cause dessous (le détail en
  // infobulle). Sans confrontation, ou en édition : rien.
  const verdict = (aDroite: boolean) => (!editing && match && !empty
    ? <VerdictDeck dm={match} deck={deck} monsterByCom2us={monsterByCom2us} aDroite={aDroite} />
    : null);
  // Lead porté par le slot 0 du deck recommandé.
  const leaderId = deck.slots[0]?.com2usId;
  const leaderLead = leaderId != null ? monsterByCom2us.get(leaderId)?.leaderSkill ?? null : null;
  // L'ordre des défenses de la ligne : pendant une recherche, celles qui
  // répondent d'abord, la plus fiable en tête ; sinon celui du deck.
  const ordreDefenses = hit?.counters.length && !hit.filtre
    ? [
        ...[...hit.counters].sort((a, b) => parFiabilite(deck.counters[a], deck.counters[b])),
        ...deck.counters.map((_, ci) => ci).filter((ci) => !hit.counters.includes(ci)),
      ]
    : deck.counters.map((_, ci) => ci);
  // La fiabilité se note SUR la ligne (étoiles ou « Noter ») : un flottant,
  // sans ouvrir l'édition du deck.
  const noter = (ci: number) => (n: number | null) => recos.setCounterFiabilite(reco.id, deckIndex, ci, n);

  // Les défenses battues, en petit : la note au-dessus, les portraits dessous.
  const portraitsDefense = (c: RecoCounter, taille: number) => (
    <span className="flex flex-none items-center gap-1 pr-1">
      {c.monsters
        .filter((cm) => cm.com2usId != null || cm.name)
        .map((cm, i) => (
          <MiniMonster key={i} monster={cm.com2usId != null ? monsterByCom2us.get(cm.com2usId) ?? null : null} fallback={cm.name} size={taille} />
        ))}
    </span>
  );
  const libelleChoix = (c: RecoCounter) => (
    <span className="flex w-[88px] flex-none items-center">{portraitsDefense(c, 24)}</span>
  );
  // ⚠️ **Plusieurs défenses sur la ligne, autant que la place en laisse** :
  // une, deux ou trois vignettes selon la largeur de la colonne (requêtes de
  // CONTENEUR : la ligne vit dans un volet dont la largeur varie), puis « … »
  // quand il en reste. Chaque vignette note SA défense (un deck n'est pas
  // aussi fort contre toutes) ; « … » ouvre la liste de toutes, chacune sa
  // note en face. Classes écrites EN TOUTES LETTRES : Tailwind lit le source.
  // Une vignette fait environ 84 px (trois portraits de 22) : deux tiennent
  // dans 11rem, trois dans 17rem, « … » compris quand il en reste.
  const VISIBILITE = ['flex', 'hidden @[11rem]:flex', 'hidden @[17rem]:flex'];
  const n = deck.counters.length;
  const visibiliteSuite = n > 3 ? 'flex' : n === 3 ? 'flex @[17rem]:hidden' : n === 2 ? 'flex @[11rem]:hidden' : 'hidden';
  const bat = n > 0 ? (
    <span className="flex min-w-0 items-center gap-x-1.5" data-fort-contre>
      {ordreDefenses.slice(0, 3).map((ci, rang) => {
        const c = deck.counters[ci];
        return (
          <span key={ci} className={`${VISIBILITE[rang]} flex-none`} data-defense-ligne>
            <FiabiliteRapide
              libelle={cr.fiabiliteModifier}
              apercu={(
                // `gap-1.5` : l'icône d'élément d'un portrait dépasse de 4 px
                // vers le haut, elle ne touche pas les étoiles au-dessus.
                <span className="flex flex-col items-start gap-1.5">
                  <ApercuNote note={fiabiliteValide(c.fiabilite)} taille={10} />
                  {portraitsDefense(c, 22)}
                </span>
              )}
            >
              <ChoixFiabilite note={c.fiabilite} onChange={noter(ci)} libelle={libelleChoix(c)} sansValeur />
            </FiabiliteRapide>
          </span>
        );
      })}
      <span className={`${visibiliteSuite} flex-none`} data-defenses-suite>
        <FiabiliteRapide
          libelle={cr.fiabiliteToutes(n)}
          apercu={<span className="px-0.5 font-mono text-sm leading-none text-ink-dim">…</span>}
        >
          <div className="flex flex-col gap-2" data-fiabilites-deck>
            <span className="label">{cr.fiabiliteParDefense}</span>
            {ordreDefenses.map((ci) => (
              <ChoixFiabilite
                key={ci}
                note={deck.counters[ci].fiabilite}
                onChange={noter(ci)}
                sansValeur
                libelle={libelleChoix(deck.counters[ci])}
              />
            ))}
          </div>
        </FiabiliteRapide>
      </span>
    </span>
  ) : (
    <span className="text-micro text-ink-dimmer">—</span>
  );

  return (
    // ⚠️ **UNE rangée souple, aux deux formats et dans les deux vues** :
    // chevron et portraits · la défense battue (ou, dans le volet Défenses,
    // la fiabilité contre celle qu'on regarde) · le verdict et sa cause · les
    // actions, poussées au bout. Ce qui ne tient pas passe à la ligne
    // (`flex-wrap`) au lieu de se comprimer : la ligne vit dans un volet dont
    // la largeur dépend de l'écran ET de la colonne des provenances, et une
    // grille de colonnes fixes y faisait se chevaucher les portraits.
    <div className="border-t border-border-soft px-3 py-2.5 first:border-t-0" data-deck-ligne={status} data-edition={editing || undefined}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Le chevron ET les portraits : une seule cible pour déplier. Les
            portraits identifient le deck (le nom en infobulle). `pr-1` sur
            chacun : son icône d'élément dépasse de 4 px à droite. */}
        <ZoneCliquable
          onClick={onToggleFold}
          aria-expanded={!folded}
          aria-label={folded ? cr.deplierDeck : cr.replierDeck}
          title={folded ? cr.deplierDeck : cr.replierDeck}
          className="group/ligne flex flex-none items-center gap-2"
        >
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-ink-dim transition group-hover/ligne:bg-panel2" aria-hidden>
            <ChevronDown size={14} className={`transition-transform ${folded ? '-rotate-90' : ''}`} />
          </span>
          <span className="flex flex-none items-center gap-1">
            {deck.slots.map((sl, i) => {
              const m = sl.com2usId != null ? monsterByCom2us.get(sl.com2usId) ?? null : null;
              return (
                <span key={i} className="flex flex-none items-center pr-1" title={m?.name ?? sl.name ?? undefined}>
                  <MiniMonster monster={m} fallback={sl.name} size={34} lead={i === 0 ? leaderLead : null} />
                </span>
              );
            })}
          </span>
        </ZoneCliquable>

        {/* `@container` : les défenses de la ligne se montrent selon SA
            largeur (voir `bat`).
            ⚠️ **Au téléphone, sur sa propre ligne, pleine largeur**
            (`compact:order-last compact:basis-full`) : à côté des actions,
            dont deux places sont réservées, il ne restait la place que d'une
            défense. Les portraits et les actions restent sur la première. */}
        <div className="@container flex min-w-0 flex-1 basis-[150px] flex-col gap-1 compact:order-last compact:basis-full">
          {contre ? (
            <>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {contre.vise && contre.counterIndex >= 0 && (
                  <FiabiliteRapide note={contre.fiabilite} onChange={noter(contre.counterIndex)} />
                )}
                {contre.reco && (
                  <span className="inline-flex min-w-0 max-w-full items-center rounded-full border border-border-soft bg-panel2 px-2 py-0.5 text-micro text-ink-dim" data-reco-offense>
                    <span className="truncate">{contre.reco}</span>
                  </span>
                )}
              </span>
              {contre.note && (
                <p className="text-xs leading-snug text-ink-dim">
                  <em className="not-italic text-ink">{textes.recos.contreCetteDefense}</em> <span>{contre.note}</span>
                </p>
              )}
              {deck.note && (
                <p className="flex items-start gap-1.5 text-xs leading-snug text-ink-dim">
                  <StickyNote size={11} className="mt-0.5 flex-none text-star" />
                  <span className="line-clamp-2">{deck.note}</span>
                </p>
              )}
            </>
          ) : bat}
        </div>

        {verdict(false) && <div className="flex min-w-0 max-w-[220px] flex-none">{verdict(false)}</div>}

        {/* ⚠️ **Les actions du deck sur SA LIGNE, replié ou non**, au bout.
            Deux places RÉSERVÉES devant Optimizer et ✎ : « Annuler les
            modifications » et « Supprimer ce deck », visibles en édition
            seulement ; ✎ devient ✓ à la même place — aucun bouton ne bouge
            sous le clic. Le ✓ doré est la convention de l'édition en cours
            sur cette page. */}
        <div className="ml-auto flex flex-none items-center gap-2">
          {modifie && <TagModifie />}
          <ActionsDeck
            editing={editing}
            annulable={annulable}
            onAnnuler={onAnnulerEdition}
            onSupprimer={supprimerDeck}
            raisonExportOptimizer={raisonExportOptimizer}
            onExporterOptimizer={onExporterOptimizer}
            onToggleEdit={onToggleEdit}
          />
        </div>
      </div>

      {!folded && (
        <div className="mt-2 rounded-xl border border-border-soft bg-panel p-3 compact:p-2">
          <DetailDeck
            reco={reco}
            deck={deck}
            deckIndex={deckIndex}
            monsters={monsters}
            monsterByCom2us={monsterByCom2us}
            match={match}
            editing={editing}
            hit={hit}
            recos={recos}
          />
        </div>
      )}
    </div>
  );
}

// « Modifié » sur la ligne d'un deck d'une recommandation de salon qui diffère
// de la dernière version reçue : pas encore publié (recoModifies.ts). Le
// dessin de l'état « modifiée » d'une recommandation (`PastilleEtat`) : on
// lit d'un coup d'œil que c'est la même chose, deck par deck. Pas un bouton :
// il part en publiant.
export function TagModifie() {
  const cr = useTraduction().carteReco;
  return (
    <span
      title={cr.modifieAide}
      className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full bg-warn-soft px-2 py-0.5 text-micro font-semibold text-warn"
      data-deck-modifie
    >
      <span className="h-1.5 w-1.5 flex-none rounded-full bg-warn" aria-hidden />
      {cr.modifie}
    </span>
  );
}

// Les actions d'un deck, le même groupe sur sa ligne de la carte et dans le
// volet Défenses : Annuler et Supprimer (places réservées, visibles en
// édition), Exporter vers l'Optimizer, ✎/✓.
export function ActionsDeck({ editing, annulable, onAnnuler, onSupprimer, raisonExportOptimizer, onExporterOptimizer, onToggleEdit, className = '' }: {
  editing: boolean;
  annulable: boolean;
  onAnnuler: () => void;
  onSupprimer: () => void;
  raisonExportOptimizer?: string;
  onExporterOptimizer: () => void;
  onToggleEdit: () => void;
  className?: string;
}) {
  const textes = useTraduction();
  const cr = textes.carteReco;
  const reserve = (visible: boolean) => ({
    className: visible ? ICONE_LG : `invisible ${ICONE_LG}`,
    tabIndex: visible ? undefined : -1,
    'aria-hidden': visible ? undefined : true,
  });
  return (
    <div className={`flex flex-none items-center gap-0.5 ${className}`} data-actions-deck>
      <BoutonIcone onClick={onAnnuler} disabled={!annulable} icone={<Undo2 size={13} />} libelle={cr.annulerModifs} {...reserve(editing)} />
      {/* La suppression se défait par la notification. */}
      <BoutonIcone onClick={onSupprimer} ton="danger" icone={<Trash2 size={13} />} libelle={cr.supprimerDeck} {...reserve(editing)} />
      <Bouton aria-label={textes.commun.exporterOptimizer} icone={<IconeOptimizer size={14} />} taille="carre" trait="aucun" fond="vide"
        disabled={!!raisonExportOptimizer} title={raisonExportOptimizer ?? textes.commun.exporterOptimizer}
        onClick={onExporterOptimizer} className={`h-7 w-7 ${ICONE_LG}`} />
      <BoutonIcone
        onClick={onToggleEdit}
        aria-pressed={editing}
        icone={editing ? <Check size={14} className="text-star" /> : <Pencil size={13} />}
        libelle={editing ? cr.terminerDeck : cr.editerDeck}
        className={ICONE_LG}
      />
    </div>
  );
}

// Le détail d'un deck ouvert : ses consignes, la fiche de chacun de ses trois
// monstres (lecture ou édition), puis les défenses qu'il bat. Le même dans la
// carte (vue Decks) et dans le volet Défenses.
// ⚠️ Les trois fiches se rangent selon la largeur du CONTENEUR
// (`@container`), pas de l'écran : le deck ouvert vit dans un volet dont la
// largeur dépend de l'écran, de la barre latérale et de la colonne des
// provenances. Trois fiches de 140 px y débordaient.
export function DetailDeck({ reco, deck, deckIndex, monsters, monsterByCom2us, match, editing, hit, recos }: {
  reco: Reco;
  deck: RecoDeck;
  deckIndex: number;
  monsters: Monster[];
  monsterByCom2us: Map<number, Monster>;
  match: DeckMatch | null;
  editing: boolean;
  hit: DeckHit | null;
  recos: UseRecoState;
}) {
  const textes = useTraduction();
  const cr = textes.carteReco;
  // Un monstre choisi → le curseur passe au slot vide suivant (voir
  // `slotVideSuivant`) : on compose les trois d'affilée, sans la souris.
  const [focus, setFocus] = useState<JetonSlot | null>(null);
  // Un monstre ne peut pas occuper deux slots du MÊME deck (il peut revenir
  // dans un autre deck de la recommandation).
  const usedIds = new Set(
    deck.slots
      .map((s) => (s.com2usId != null ? monsterByCom2us.get(s.com2usId) : null))
      .filter((m): m is Monster => !!m)
      .map((m) => String(m.id))
  );
  // Lead porté par le slot 0 du deck recommandé.
  const leaderId = deck.slots[0]?.com2usId;
  const leaderLead = leaderId != null ? monsterByCom2us.get(leaderId)?.leaderSkill ?? null : null;
  // Lead de VITESSE du deck (slot 0), pour le raccourci « Rapide / Lent » de la
  // saisie : la VIT de fiche qui tombe sur un tick dépend du lead.
  const leadVitesse = speedLeadOf(leaderId != null ? monsterByCom2us.get(leaderId) : null);
  return (
    <div className="@container">
      {/* Consignes propres à ce deck */}
      {editing ? (
        <div className="mb-2">
          <NoteEditor
            value={deck.note}
            max={DECK_NOTE_MAX}
            rows={2}
            label={cr.consignesDeck}
            placeholder={cr.consignesDeckAide}
            onChange={(v) => recos.setDeckMeta(reco.id, deckIndex, { note: v })}
          />
        </div>
      ) : (
        deck.note && <NoteBlock text={deck.note} label={cr.consignesDeck} compact />
      )}

      <div className="grid grid-cols-1 gap-2.5 @2xl:grid-cols-3">
        {deck.slots.map((slot, idx) => {
          const monster = slot.com2usId != null ? monsterByCom2us.get(slot.com2usId) ?? null : null;
          const sm = match?.slots[idx] ?? null;
          return (
            <div
              key={idx}
              // `min-w-0` : sans lui une cellule de grille refuse de descendre
              // sous la largeur de son contenu, et la carte déborde sur sa
              // voisine au lieu de laisser la table défiler à l'intérieur.
              className={`min-w-0 rounded-xl border p-2.5 compact:p-2 ${
                // Indisponible ET stats insuffisantes sont tous deux bloquants → rouge.
                // Statut au CONTOUR seul, fond neutre (voir `AURA`) : le badge
                // sous le nom dit déjà ce qui cloche.
                sm?.status === 'absent' || sm?.status === 'ko'
                  ? 'border-bad/60 bg-panel2'
                  : sm?.status === 'ok'
                    ? 'border-good/60 bg-panel2'
                    : 'border-border-soft bg-panel2'
              } ${
                // ⚠️ Le monstre CHERCHÉ prend un fond d'accent léger, jamais une
                // bordure : celle-ci porte déjà le résultat de l'analyse
                // (rouge/vert), et la remplacer effacerait cette information au
                // moment où on parcourt la page. Deux langages distincts, deux
                // supports distincts. Même écho de filtre que les propriétés
                // recherchées d'un artéfact — voir docs/03-developpeur/interface/.
                hit?.slots.includes(idx) ? 'bg-accent/[0.10]' : ''
              }`}
            >
              {slot.com2usId == null ? (
                editing ? (
                  <div>
                    <div className="label mb-1.5">
                      {idx === 0 ? textes.equipeSiege.leader : `${textes.equipeSiege.slot} ${idx + 1}`}
                    </div>
                    <MonsterPicker
                      monsters={monsters}
                      excludeIds={usedIds}
                      placeholder={textes.equipeSiege.choisirMonstre}
                      jetonFocus={focus?.slot === idx ? focus.n : undefined}
                      onPick={(id) => {
                        const m = monsters.find((x) => String(x.id) === id);
                        if (m && m.com2usId != null) {
                          recos.setSlotMonster(reco.id, deckIndex, idx, m.com2usId, m.name);
                          setFocus((f) =>
                            prochainFocus(f, deck.slots.map((s) => s.com2usId != null), idx)
                          );
                        }
                      }}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-ink-dim py-4 text-center">
                    {cr.slotVide(idx === 0 ? textes.equipeSiege.leader : textes.equipeSiege.slot)}
                  </p>
                )
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <MonsterAvatar
                      monster={monster}
                      fallback={slot.name}
                      size={40}
                      lead={idx === 0 ? leaderLead : null}
                      tailleLead={20}
                      couronne={idx === 0 && !leaderLead}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold leading-tight truncate">
                        {monster?.name ?? slot.name ?? '—'}
                      </div>
                      {/* Pastille complète sous le nom du leader : ici on a la
                          place de montrer le montant, pas juste le badge. */}
                      {idx === 0 && leaderLead && (
                        <div className="mt-1">
                          <LeadPill ls={leaderLead} />
                        </div>
                      )}
                      {sm && <SlotBadge sm={sm} />}
                      {!monster && <div className="font-mono text-micro text-ink-dim">{cr.monstreInconnu}</div>}
                    </div>
                    {editing && (
                      <BoutonIcone
                        onClick={() => recos.setSlotMonster(reco.id, deckIndex, idx, null, '')}
                        ton="danger"
                        libelle={cr.viderSlot}
                        icone={<X size={14} />}
                      />
                    )}
                  </div>

                  {/* Sets de runes recommandés. ⚠️ Chaque partie de la fiche
                      porte son titre (Runes, Stats, Artéfacts) : un filet seul
                      ne disait pas ce qu'on lisait. */}
                  <div className="mt-2 pt-2 border-t border-border/50">
                    {!editing && <span className="label mb-1 block">{cr.runage}</span>}
                    {editing ? (
                      <SetEditor
                        options={slot.setOptions}
                        onAdd={(opt, k) => recos.addSlotSet(reco.id, deckIndex, idx, opt, k)}
                        onRemove={(opt, pos) =>
                          recos.removeSlotSet(reco.id, deckIndex, idx, opt, pos)
                        }
                        onAddOption={() => recos.addSetOption(reco.id, deckIndex, idx)}
                        onRemoveOption={(opt) => recos.removeSetOption(reco.id, deckIndex, idx, opt)}
                      />
                    ) : (
                      <SetList options={slot.setOptions} sm={sm} />
                    )}
                  </div>

                  {/* Stats recommandées */}
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <span className="label mb-1 block">{cr.stats}</span>
                    {editing ? (
                      <StatEditor
                        slot={slot}
                        monster={monster}
                        lead={monster ? siegeLeadFor(leadVitesse, monster.element) : 0}
                        onSet={(key, total) =>
                          recos.setSlotStat(reco.id, deckIndex, idx, key, total)
                        }
                      />
                    ) : (
                      <StatList
                        slot={slot}
                        monster={monster}
                        sm={sm}
                      />
                    )}
                  </div>

                  {/* Propriétés d'artéfact recommandées, EN DERNIER : c'est le
                      critère le plus rarement renseigné, et la table de stats
                      reste ainsi à la même hauteur d'un slot à l'autre.
                      En lecture, le bloc disparaît si rien n'est exigé — en
                      édition il reste, sinon il n'y aurait aucun moyen d'en
                      ajouter. */}
                  {editing ? (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <ArtifactEditor
                        artifacts={slot.artifacts}
                        onAdd={(kind, code) =>
                          recos.addSlotArtifact(reco.id, deckIndex, idx, kind, code)
                        }
                        onRemove={(kind, code) =>
                          recos.removeSlotArtifact(reco.id, deckIndex, idx, kind, code)
                        }
                      />
                    </div>
                  ) : (
                    ARTIFACT_KINDS.some(({ key }) => (slot.artifacts?.[key] ?? []).length > 0) && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <ArtifactList artifacts={slot.artifacts} sm={sm} />
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Défenses adverses que ce deck bat. Sous les 3 monstres : c'est une
          information sur le DECK ENTIER, pas sur un slot — et le deck garde sa
          structure habituelle au-dessus. */}
      <CounterBlock
        deck={deck}
        reco={reco}
        deckIndex={deckIndex}
        monsters={monsters}
        monsterByCom2us={monsterByCom2us}
        recos={recos}
        // Retenu par « Modifiés » : rien n'a été cherché, rien à surligner.
        hitCounters={hit && !hit.filtre ? hit.counters : []}
      />
    </div>
  );
}

// « Fort contre » — les défenses adverses face auxquelles ce deck fonctionne.
//
// ⚠️ **Purement informatif : rien n'est confronté au compte.** L'app ne connaît
// que MES équipes, pas celles des adversaires — il n'y a rien à quoi comparer.
// C'est un message de l'auteur vers le lecteur, comme une consigne, et il ne
// porte donc ni statut, ni badge, ni couleur de résultat.
//
// ⚠️ **En lecture, le bloc disparaît s'il est vide** : la plupart des decks n'en
// portent aucune, et un intitulé suivi de rien se lit comme une donnée manquante.
function CounterBlock({
  deck,
  reco,
  deckIndex,
  monsters,
  monsterByCom2us,
  recos,
  hitCounters,
}: {
  deck: RecoDeck;
  reco: Reco;
  deckIndex: number;
  monsters: Monster[];
  monsterByCom2us: Map<number, Monster>;
  recos: UseRecoState;
  // Index des défenses qui contiennent le monstre cherché.
  hitCounters: number[];
}) {
  const cr = useTraduction().carteReco;
  // ⚠️ Édition PAR DÉFENSE, et non pour le bloc entier.
  //
  // Le bloc n'a plus de bouton « Éditer » : noter la défense qu'on vient
  // d'affronter est un geste DE PASSAGE, et le crayon ajoutait une étape
  // (ouvrir le mode, ajouter, refermer) là où le geste réel est « + ». Le « + »
  // ajoute donc directement une défense, et c'est ELLE qui s'ouvre en édition —
  // les autres restent en lecture, en vignettes, à côté.
  //
  // `null` = aucune en édition. On n'en édite qu'une à la fois : on note une
  // composition, pas six.
  const [enEdition, setEnEdition] = useState<number | null>(null);

  // Précision affichée : `null` = aucune. Une seule à la fois.
  //
  // ⚠️ **La note s'affiche en POPOVER**, ancré sur sa vignette. Un panneau posé
  // dans le flux devait s'aligner sous une vignette qui, en `flex-wrap`, peut
  // être n'importe où sur n'importe quelle ligne : le trait du cran et celui du
  // panneau ne se rejoignaient pas, et le rattachement mentait. Un flottant naît
  // de son ancre, il n'a rien à aligner. Il ne pousse rien non plus — la rangée
  // de vignettes ne bouge plus quand on lit une note.
  //
  // ⚠️ **Aucune ouverture automatique à la recherche.** Une défense trouvée
  // s'ouvrait d'office : sur une recherche qui remonte plusieurs défenses, cela
  // dépliait des notes qu'on n'avait pas demandées, et le surlignage de la
  // vignette suffit à dire laquelle répond. On ouvre si on veut lire.
  const [noteOuverte, setNoteOuverte] = useState<number | null>(null);

  // Un flottant se referme au clic extérieur et à Échap — même motif que le menu
  // de réglages et les autres popovers de l'app (voir SettingsMenu.tsx).
  const rangeeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (noteOuverte == null) return;
    const onDown = (e: MouseEvent) => {
      if (rangeeRef.current && !rangeeRef.current.contains(e.target as Node)) setNoteOuverte(null);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setNoteOuverte(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [noteOuverte]);

  // ⚠️ Les index se décalent à la suppression : une défense retirée laisserait
  // l'édition (ou la note ouverte) pointer sur sa voisine, ou dans le vide.
  const nbCounters = deck.counters.length;
  useEffect(() => {
    setEnEdition((cur) => (cur != null && cur >= nbCounters ? null : cur));
    setNoteOuverte((cur) => (cur != null && cur >= nbCounters ? null : cur));
  }, [nbCounters]);

  const estVide = (ci: number) =>
    (deck.counters[ci]?.monsters ?? []).every((m) => m.com2usId == null);

  // ⚠️ Le bloc vit dans la partie DÉPLIÉE du deck : replier le démonte sans
  // passer par « Terminer ». Sans ce nettoyage, une défense ouverte et laissée
  // vide survivait au repli — exactement ce qu'on refuse d'enregistrer.
  // Les valeurs sont lues dans une ref : l'effet de démontage ne s'exécute
  // qu'une fois, et capturerait sinon l'état du premier rendu.
  const etatAuDemontage = useRef({ enEdition, estVide, reco, deckIndex, recos });
  etatAuDemontage.current = { enEdition, estVide, reco, deckIndex, recos };
  useEffect(
    () => () => {
      const s = etatAuDemontage.current;
      if (s.enEdition != null && s.estVide(s.enEdition))
        s.recos.removeCounter(s.reco.id, s.deckIndex, s.enEdition);
    },
    []
  );

  const ajouter = () => {
    // ⚠️ Si une défense est déjà ouverte et restée vide, on ne l'empile pas :
    // cliquer « + » deux fois de suite ne doit pas laisser une entrée vide
    // derrière soi. On la réutilise plutôt que d'en créer une seconde.
    if (enEdition != null && estVide(enEdition)) return;
    recos.addCounter(reco.id, deckIndex);
    // La nouvelle est ajoutée en fin de liste : elle s'ouvre en édition, sinon
    // on aurait ajouté une vignette vide sans moyen de la remplir.
    setEnEdition(nbCounters);
  };

  // ⚠️ **Une défense sans AUCUN monstre n'est pas conservée.** L'entrée est bien
  // créée au « + » — c'est le formulaire qu'on remplit —, mais si on la referme
  // sans avoir rien choisi, elle est retirée : elle ne décrit aucune
  // composition, ne se lit pas en vignette, et voyagerait telle quelle dans
  // l'export. Refermer sans rien poser vaut donc « j'abandonne », pas
  // « j'enregistre du vide ».
  //
  // ⚠️ La note seule ne suffit PAS à la retenir : une précision sans les
  // portraits qu'elle qualifie (« si le Chloe est en lead ») ne veut rien dire.
  // Ce sont les 3 monstres qui font la défense.
  const fermerEdition = (ci: number) => {
    if (estVide(ci)) recos.removeCounter(reco.id, deckIndex, ci);
    setEnEdition(null);
  };

  // Passer d'une défense à une autre referme la précédente — et l'abandonne si
  // elle est restée vide, exactement comme le bouton « Terminer ».
  const basculerEdition = (ci: number) => {
    if (enEdition === ci) {
      fermerEdition(ci);
      return;
    }
    if (enEdition != null && estVide(enEdition)) {
      recos.removeCounter(reco.id, deckIndex, enEdition);
      // ⚠️ Retirer une entrée AVANT celle qu'on vise décale son index d'un cran.
      setEnEdition(enEdition < ci ? ci - 1 : ci);
      return;
    }
    setEnEdition(ci);
  };

  return (
    <div className="mt-2.5 pt-2.5 border-t border-border/50">
      <div className="mb-1.5 flex items-center gap-1.5">
        <IconeOffense size={13} className="text-ink-dim" />
        <span className="label">{cr.colFortContre}</span>
        {deck.counters.length > 1 && (
          <span className="font-mono text-micro text-ink-dim">{deck.counters.length}</span>
        )}
      </div>

      {/* ⚠️ Les défenses côte à côte, en `flex-wrap` : ce sont des vignettes de
          3 portraits, empilées elles gaspillaient une ligne entière chacune
          pour 90 px de contenu. On en voit maintenant plusieurs d'un coup, ce
          qui est le point : reconnaître la composition qu'on affronte.
          Celle EN ÉDITION reprend toute la largeur — elle porte alors 3
          sélecteurs et un champ de texte —, d'où le `w-full` qu'elle se donne
          elle-même dans la rangée. */}
      <div ref={rangeeRef} className="flex flex-wrap items-start gap-1.5">
        {deck.counters.map((counter, ci) => (
          <CounterRow
            key={ci}
            counter={counter}
            reco={reco}
            deckIndex={deckIndex}
            counterIndex={ci}
            monsters={monsters}
            monsterByCom2us={monsterByCom2us}
            recos={recos}
            editing={enEdition === ci}
            onToggleEdit={() => basculerEdition(ci)}
            trouve={hitCounters.includes(ci)}
            noteOuverte={noteOuverte === ci}
            onToggleNote={() => setNoteOuverte((cur) => (cur === ci ? null : ci))}
          />
        ))}

        {/* ⚠️ UN SEUL bouton, toujours visible : le « + ». Il vit DANS la
            rangée, à la suite des défenses — c'est là qu'on ajoute, et il montre
            où la prochaine se posera. Le bloc restant visible même vide, c'est
            aussi lui qui rend la fonctionnalité découvrable sur un deck qui n'en
            porte encore aucune.
            ⚠️ **À la souris, un bouton `sm` POINTILLÉ à fond**, au bout de la
            rangée (`lg:ml-auto`) — le bord pointillé d'un ajout, le fond d'un
            bouton. Il a été fantôme un temps, et ne ressortait
            pas. Au doigt,
            la tuile pointillée de 44 px d'avant, à la hauteur des vignettes :
            `taille="sm"` + `max-lg:px-3.5 max-lg:text-sm` redonnent
            exactement son dessin SOUS `lg` seulement. ⚠️ Pas `px-3.5 text-sm`
            nus : `text-xs` (de `sm`) passe APRÈS `text-sm` dans la feuille
            construite, il aurait gagné — vérifié dans le CSS. */}
        <Bouton
          onClick={ajouter}
          trait="pointille"
          taille="sm"
          className="h-[44px] max-lg:px-3.5 max-lg:text-sm lg:ml-auto lg:h-7 lg:self-center"
          icone={<Plus size={14} />}
          libelle={cr.defense}
          aria-label={cr.ajouterDefense}
          title={cr.ajouterDefense}
        />
      </div>
    </div>
  );
}

// Une défense adverse : ses 3 monstres, et la condition éventuelle.
function CounterRow({
  counter,
  reco,
  deckIndex,
  counterIndex,
  monsters,
  monsterByCom2us,
  recos,
  editing,
  onToggleEdit,
  trouve,
  noteOuverte,
  onToggleNote,
}: {
  counter: RecoCounter;
  reco: Reco;
  deckIndex: number;
  counterIndex: number;
  monsters: Monster[];
  monsterByCom2us: Map<number, Monster>;
  recos: UseRecoState;
  editing: boolean;
  onToggleEdit: () => void; // ouvre/ferme l'édition de CETTE défense
  trouve: boolean; // contient le monstre cherché
  // ⚠️ L'état de la précision vit dans le BLOC, pas ici : une seule ouverte à la
  // fois sur toute la rangée. Voir CounterBlock.
  noteOuverte: boolean;
  onToggleNote: () => void;
}) {
  const textes = useTraduction();
  const cr = textes.carteReco;

  // Un même monstre ne peut pas occuper deux emplacements de LA MÊME défense —
  // même règle que les slots d'un deck. Il peut revenir dans une autre défense.
  const usedIds = new Set(
    counter.monsters
      .map((m) => (m.com2usId != null ? monsterByCom2us.get(m.com2usId)?.id : null))
      .filter((id): id is string => id != null)
      .map(String)
  );
  // Un monstre choisi → le curseur passe au monstre vide suivant (voir
  // `slotVideSuivant`), comme dans les slots d'un deck.
  const [focus, setFocus] = useState<JetonSlot | null>(null);

  if (!editing) {
    // Une vignette sans note n'a rien à déplier : elle ne devient donc pas
    // cliquable. Un bouton qui ne fait rien au clic se lit comme un défaut.
    const aUneNote = counter.note.trim() !== '';

    // La rangée finit toujours par le chevron ou, sans note, par une place
    // vide de même taille : le crayon posé en coin tombe dessus, jamais sur
    // l'icône d'élément du dernier portrait, qui reste dans la rangée.
    const portraits = (
      <div className="flex flex-none items-center gap-1">
        {counter.monsters.map((m, i) =>
          m.com2usId == null ? null : (
            <MiniMonster
              key={i}
              monster={monsterByCom2us.get(m.com2usId) ?? null}
              fallback={m.name}
              size={30}
            />
          )
        )}
        {/* ⚠️ Le repère de note est TOUJOURS là quand il y en a une, ouverte ou
            non : sans lui, rien ne distingue une vignette qui cache une
            précision d'une vignette qui n'en a pas — on cliquerait au hasard. */}
        {aUneNote ? (
          <ChevronDown
            size={12}
            className={`ml-0.5 flex-none text-ink-dim transition-transform ${
              noteOuverte ? 'rotate-180' : ''
            }`}
          />
        ) : (
          <span aria-hidden className="ml-0.5 h-3 w-3 flex-none" />
        )}
      </div>
    );
    // La fiabilité, sous les portraits : la vignette garde sa largeur (cinq
    // étoiles de 12 px tiennent sous trois portraits de 30). ⚠️ HORS de la zone
    // qui ouvre la précision : elle se note sur place (un bouton dans un
    // bouton serait invalide).
    const contenu = portraits;
    const fiabilite = (
      <div className="px-2 pb-1">
        <FiabiliteRapide
          note={counter.fiabilite}
          onChange={(n) => recos.setCounterFiabilite(reco.id, deckIndex, counterIndex, n)}
        />
      </div>
    );

    // La vignette dont la précision est ouverte prend la bordure d'accent, comme
    // le monstre sélectionné d'une équipe de siège dont on consulte les runes
    // (voir SiegeTeam.tsx) : elle dit d'où sort le popover.
    const cran = noteOuverte
      ? 'border-accent bg-panel2'
      : trouve
        ? // Même écho de recherche que sur un slot : un fond d'accent, rien de plus.
          'border-transparent bg-accent/[0.10]'
        : 'border-transparent bg-panel2/50';

    return (
      // `group` : le crayon n'apparaît qu'au survol de SA vignette.
      // `relative` : ancre du popover de précision. ⚠️ `z-20` quand il est
      // ouvert : les vignettes suivantes sont peintes APRÈS dans le flux et
      // passeraient sinon par-dessus le flottant.
      <div className={`group relative min-w-0 rounded-lg border ${noteOuverte ? 'z-20' : ''} ${cran}`}>
        {/* ⚠️ Une défense posée doit rester modifiable : sans le bouton
            « Éditer » du bloc, c'est la vignette qui porte son propre crayon.
            Discret (il ne se montre qu'au survol) pour ne pas alourdir une
            rangée qu'on parcourt du regard, mais TOUJOURS visible au tactile,
            où il n'y a pas de survol — voir la règle « un élément atteignable
            ne dépend jamais du survol » de docs/03-developpeur/interface/. */}
        {/* ⚠️ `taille="serre"` + `cadre` + `auSurvol` : posé SUR le coin de la
            vignette, hors du flux — agrandi par la règle tactile, il la
            déborde et recouvre le portrait, même cas que la croix de
            suppression d'une carte RTA. `auSurvol` reproduit exactement le
            même trio de classes qu'avant (masqué au repos, visible au survol,
            au focus, et D'OFFICE sans survol possible — voir BoutonIcone.tsx). */}
        <BoutonIcone
          onClick={onToggleEdit}
          taille="serre"
          cadre
          auSurvol
          icone={<Pencil size={10} />}
          libelle={cr.modifierDefense}
          // Repère du banc d'affichage (tests/banc/mesure.ts, « bouton en
          // coin ») : le dépassement de ce coin sur la vignette est voulu. Posé
          // sur le `<button>` positionné lui-même ; le retirer rend ses
          // signalements.
          data-bouton-coin="modifier-defense"
          className="absolute -right-1 -top-1 z-10"
        />

        {aUneNote ? (
          <ZoneCliquable
            onClick={onToggleNote}
            aria-expanded={noteOuverte}
            className="flex w-full items-center rounded-lg px-2 pb-0.5 pt-1.5 transition hoverable:brightness-110"
            title={noteOuverte ? cr.masquerPrecision : cr.voirPrecision}
          >
            {contenu}
          </ZoneCliquable>
        ) : (
          <div className="px-2 pb-0.5 pt-1.5">{contenu}</div>
        )}
        {fiabilite}

        {/* La précision, en POPOVER ancré sous SA vignette.
            ⚠️ Flottant et non posé dans le flux : il naît de son ancre, donc il
            n'a rien à aligner — et il ne pousse pas la rangée, qui reste
            immobile pendant qu'on lit.
            ⚠️ `origin-top-left` : un flottant ancré grandit DEPUIS son ancre,
            jamais depuis son centre (voir docs/03-developpeur/interface/).
            `min-w-full` : au moins aussi large que la vignette, pour se lire
            comme sa suite ; `w-max` + plafond au-delà, la note étant courte. */}
        {/* ⚠️ **Le `Flottant` de la librairie**, comme partout dans l'app :
            même fond, même contour neutre, même ombre et même
            rembourrage que toutes les bulles de l'app. C'était une boîte
            maison au contour d'ACCENT (réservé à l'état enclenché), à l'ombre
            et aux marges à elle. */}
        {noteOuverte && (
          <Flottant
            // ⚠️ Ancrée à gauche d'une vignette qui peut être la DERNIÈRE de sa
            // rangée : le `max-w` borne sa largeur, et `Flottant` borne sa
            // position à l'écran.
            largeur="w-max min-w-full max-w-[280px]"
            rembourrage="sm"
          >
            <p className="text-xs leading-snug text-ink-dim">{counter.note}</p>
          </Flottant>
        )}
      </div>
    );
  }

  return (
    // ⚠️ `w-full` : la rangée est en `flex-wrap` (les autres défenses restent en
    // vignettes à côté), et celle qu'on édite porte 3 sélecteurs plus un champ
    // de texte — elle prend donc toute la largeur pour elle seule.
    // La bordure d'accent dit LAQUELLE est en cours d'édition.
    <div className="w-full rounded-lg border border-accent bg-panel2/50 p-2">
      <div className="flex items-start gap-1.5">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 sm:grid-cols-3">
          {counter.monsters.map((m, i) => {
            const monster = m.com2usId != null ? monsterByCom2us.get(m.com2usId) ?? null : null;
            return (
              <div key={i} className="min-w-0">
                {m.com2usId == null ? (
                  <MonsterPicker
                    monsters={monsters}
                    excludeIds={usedIds}
                    placeholder={cr.monstreN(i + 1)}
                    jetonFocus={focus?.slot === i ? focus.n : undefined}
                    onPick={(id) => {
                      const mon = monsters.find((x) => String(x.id) === id);
                      // ⚠️ Même clé stable que partout : un monstre perso
                      // (`com2usId` nul) n'est pas partageable, donc pas retenu.
                      if (mon && mon.com2usId != null) {
                        recos.setCounterMonster(
                          reco.id,
                          deckIndex,
                          counterIndex,
                          i,
                          mon.com2usId,
                          mon.name
                        );
                        setFocus((f) =>
                          prochainFocus(f, counter.monsters.map((x) => x.com2usId != null), i)
                        );
                      }
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-1.5 rounded border border-border bg-panel px-1.5 py-1">
                    <MiniMonster monster={monster} fallback={m.name} size={26} />
                    <span className="min-w-0 flex-1 truncate text-micro text-ink">
                      {monster?.name ?? m.name}
                    </span>
                    <BoutonIcone
                      onClick={() =>
                        recos.setCounterMonster(reco.id, deckIndex, counterIndex, i, null, '')
                      }
                      ton="danger"
                      taille="serre"
                      icone={<X size={12} />}
                      libelle={cr.retirerMonstre}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Terminer, puis supprimer — l'ordre du geste courant d'abord.
            ⚠️ Le ✓ doré est la convention de l'édition en cours dans toute la
            page (voir docs/02-app/siege/) — posé sur l'icône d'un
            `BoutonIcone`, comme les crayons de la recommandation et du deck,
            et de la même taille que la corbeille voisine. */}
        <div className="mt-1 flex flex-none items-center gap-1.5">
          <BoutonIcone
            onClick={onToggleEdit}
            aria-pressed
            icone={<Check size={14} className="text-star" />}
            libelle={textes.commun.terminer}
          />
          <BoutonIcone
            onClick={() => recos.removeCounter(reco.id, deckIndex, counterIndex)}
            ton="danger"
            libelle={cr.retirerDefense}
            icone={<Trash2 size={13} />}
          />
        </div>
      </div>

      {/* Condition éventuelle — une ligne, pas un pavé : elle précise QUAND ça
          marche, elle ne redit pas comment jouer (c'est la consigne du deck). */}
      <Champ
        value={counter.note}
        maxLength={COUNTER_NOTE_MAX}
        onChange={(e) =>
          recos.setCounterNote(reco.id, deckIndex, counterIndex, e.target.value)
        }
        onBlur={(e) => {
          const t = e.target.value.trim();
          if (t !== counter.note) recos.setCounterNote(reco.id, deckIndex, counterIndex, t);
        }}
        placeholder={cr.precisionAide}
        className="mt-1.5 bg-panel py-1 text-micro"
      />
      {/* La fiabilité de CE deck contre CETTE défense : classe les offenses
          d'une même défense en vue Défense, la plus fiable d'abord. */}
      <div className="mt-1.5">
        <ChoixFiabilite
          note={counter.fiabilite}
          onChange={(n) => recos.setCounterFiabilite(reco.id, deckIndex, counterIndex, n)}
        />
      </div>
    </div>
  );
}

// « Galleon - Belladeon », même forme que le nom d'un deck (`deckLabel`).
export function defenseLabel(monsters: RecoCounter['monsters'], byCom2us: Map<number, Monster>): string {
  return monsters
    .map((m) => (m.com2usId != null ? byCom2us.get(m.com2usId)?.name ?? m.name : m.name).trim())
    .filter(Boolean)
    .join(' - ');
}

// Petit portrait hexagonal, sans nom — pour les aperçus compacts, badge de
// lead réduit avec le portrait.
export function MiniMonster({
  monster,
  fallback,
  size,
  lead,
}: {
  monster: Monster | null;
  fallback?: string;
  size: number;
  lead?: LeaderSkill | null;
}) {
  return (
    <MonsterAvatar
      monster={monster}
      fallback={fallback}
      size={size}
      lead={lead}
      tailleLead={Math.round(size * 0.62)}
    />
  );
}

/* ---- Stats recommandées (édition) --------------------------------------- */

// Stat de recommandation → champ correspondant dans les données SWARFARM.
const BASE_OF: Record<RecoStatKey, keyof Monster['stats']> = {
  hp: 'hp',
  atk: 'attack',
  def: 'defense',
  spd: 'speed',
  cr: 'critRate',
  cd: 'critDamage',
  res: 'resistance',
  acc: 'accuracy',
};

// Base d'un monstre **6★ nu** (voir ../shared/donnees-monstres.md : les données
// portent les stats `max_lvl_*`, cohérentes avec le `con × 15` des exports SWEX).
// null = donnée absente (monstre perso) → le champ vaut alors le total.
function baseFor(key: RecoStatKey, monster: Monster | null): number | null {
  const raw = monster?.stats?.[BASE_OF[key]];
  return typeof raw === 'number' ? raw : null;
}

// Saisie des stats : **une seule colonne**, avec la stat de BASE du monstre
// rappelée, et un champ où l'on ne met que le **bonus à ajouter**. Le total
// (base + bonus) est affiché à droite — c'est lui qui est stocké et comparé,
// pour rester une valeur absolue même si les données de base évoluent.
// Exporté pour les tests de rendu : sans clic, le rendu serveur n'ouvre jamais
// l'édition d'un deck.
export function StatEditor({
  slot,
  monster,
  lead,
  onSet,
}: {
  slot: RecoSlot;
  monster: Monster | null;
  // Lead de vitesse effectif EN SIÈGE pour ce monstre (0 = aucun).
  lead: number;
  onSet: (key: RecoStatKey, total: number | null) => void;
}) {
  const textes = useTraduction();
  const jeu = textes.jeu;
  const cr = textes.carteReco;
  // Raccourci « Tick rapide / Tick lent », comme sur les cartes d'équipe du
  // siège : un clic met la VIT de FICHE qui tombe pile sur le tick, totem et
  // lead du deck compris. ⚠️ **Rien n'est stocké** : seule la VIT l'est, et on
  // y ajoute ensuite soi-même +1, +2… pour régler l'ordre de jeu. Le bouton
  // reste allumé tant que la VIT tombe dans le tick (de pile à +15, la marge
  // de `tickDanger`).
  //
  // ⚠️ **Désactivé quand TOUTES les possibilités de runage portent Swift** :
  // une équipe Swift ne se cale pas au tick, elle se speed tune
  // (docs/02-app/siege/). Une seule option sans Swift suffit : le calcul
  // se fait alors sans lui.
  const baseVit = baseFor('spd', monster);
  const options = slot.setOptions.filter((o) => o.length > 0);
  const toutSwift = options.length > 0 && options.every((o) => o.includes('swift'));
  const vit = slot.stats.spd;
  const ticks = (
    // Calés à DROITE, sous le champ et le total qu'ils remplissent : à gauche,
    // sous la base, ils ne s'alignaient sur rien de ce qu'ils modifient.
    <div className="flex basis-full items-center justify-end gap-1.5">
      {SIEGE_TICKS.map((t) => {
        const cible = ficheSpeedForTick(baseVit, lead, t.value);
        const atteint = cible != null && vit != null && vit >= cible && vit <= cible + TICK_ABOVE_MARGIN;
        return (
          <Bouton
            key={t.key}
            onClick={() => cible != null && onSet('spd', cible)}
            actif={atteint}
            disabled={cible == null || toutSwift}
            forme="pilule"
            taille="xs"
            // ⚠️ « Tick rapide », pas « Rapide 286 » comme au siège : ici la
            // VIT écrite est celle de FICHE (269 sans lead), et un bouton qui
            // annonçait 286 pour écrire 269 se lisait comme une erreur. Le
            // tick visé reste dans l'infobulle.
            libelle={cr.tick[t.key]}
            title={toutSwift ? cr.tickSwift : cible == null ? cr.tickSansBase : cr.tickMettre(jeu.stats.spd, cible, t.value)}
            // Même pastille que les ticks d'une équipe de siège (`TickBtn`) :
            // deux côte à côte, sans zone tactile étendue qui les ferait se
            // chevaucher — c'est l'espacement qui protège du ratage. Sans
            // `font-mono` : au siège il servait des chiffres, ici ce sont des mots.
            data-cible-fine
            className="select-none compact:px-1.5 compact:py-0 compact:text-nano"
          />
        );
      })}
    </div>
  );

  // ⚠️ **PLUS de table qui défile.** Une table à colonnes fixes, sous sa
  // largeur mini, faisait défiler HORIZONTALEMENT dans la carte — et une
  // barre de défilement horizontale, sur trois ou quatre chiffres, est
  // illisible : on ne voit plus la ligne entière d'un coup d'œil. Chaque
  // stat est maintenant une ligne `flex-wrap` : label, base, bonus, total —
  // si la largeur manque, le TOTAL passe à la ligne suivante plutôt que de
  // sortir du cadre. Chaque valeur porte son propre petit mot (« base »,
  // « total ») puisqu'il n'y a plus d'en-tête de colonne au-dessus pour le
  // dire.
  return (
    <div className="flex flex-col">
      {RECO_STATS.map((st) => {
        // Taux Crit, Dmg Crit, RES et Précision se saisissent et s'affichent
        // en total (`STATS_AVEC_BASE`) : ni base rappelée, le champ vaut le total.
        const avecBase = STATS_AVEC_BASE.has(st.key);
        const known = avecBase ? baseFor(st.key, monster) : null;
        const base = known ?? 0; // base inconnue → le champ vaut le total
        const total = slot.stats[st.key];
        const bonus = total != null ? total - base : null;
        return (
          <div
            key={st.key}
            data-stat-reco={st.key}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/40 py-1 text-micro last:border-0"
          >
            <span className="w-14 flex-none text-ink-dim">{jeu.stats[st.key]}</span>
            <span className="flex-none font-mono text-ink-dim tabular-nums">
              {known != null ? fmtStat(known) : '—'}
            </span>
            <span className="flex flex-none items-center gap-1">
              {/* « + » : un bonus qui s'ajoute à la base ; pas pour une stat saisie en total. */}
              {avecBase && <span className="font-mono text-micro text-good/70">+</span>}
              {/* Champ texte (et non `type=number`) : pas de boutons +/- à
                  droite, qui mangent la largeur d'une colonne déjà étroite.
                  `inputMode=numeric` garde le pavé numérique sur mobile.
                  ⚠️ **Largeur en `ch`, pas en pixels** : six chiffres de la
                  police mono du champ, plus son rembourrage (`px-3` de `Champ`,
                  qui l'emporte sur un `px-1` ajouté — ordre de la feuille) et
                  son contour. L'ancien `w-14` (56 px) annonçait cinq chiffres
                  mais n'en montrait que trois : le rembourrage en mangeait 24,
                  et `ch` suit la taille de police quel que soit le format.
                  Six et non cinq : un bonus négatif porte un signe. */}
              {/* Largeur : `6ch` + 24 px de rembourrage + 2 px de contour.
                  ⚠️ **`pleineLargeur={false}` obligatoire ici.** `Champ` vaut
                  `w-full` par défaut : posé tel quel dans une ligne
                  `flex-wrap`, sans largeur de colonne pour le contenir, il
                  s'étirait sur presque toute la carte — un champ numérique de
                  cinq chiffres large comme la ligne entière. */}
              <Champ
                inputMode="numeric"
                value={bonus ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '' || raw === '-') return onSet(st.key, null);
                  if (!/^-?\d+$/.test(raw)) return; // on ignore la frappe invalide
                  onSet(st.key, base + Number(raw));
                }}
                placeholder="—"
                pleineLargeur={false}
                className="w-[calc(6ch+26px)] bg-panel py-0.5 text-micro font-mono tabular-nums text-good"
              />
            </span>
            <span
              className={`ml-auto flex-none font-mono tabular-nums ${
                total != null ? 'font-semibold text-ink' : 'text-ink-dim'
              }`}
            >
              {total != null ? `= ${fmtStat(total)}${st.suffix}` : '—'}
            </span>
            {/* `basis-full` : les ticks prennent leur propre ligne sous la VIT,
                à une place fixe — le total qui change de largeur au clic ne
                les déplace pas. */}
            {st.key === 'spd' && ticks}
          </div>
        );
      })}
    </div>
  );
}

/* ---- Consignes ---------------------------------------------------------- */

// Saisie d'une consigne : multi-lignes, avec compteur de caractères (le texte
// voyage dans le code partagé, d'où une longueur bornée).
function NoteEditor({
  value,
  onChange,
  label,
  placeholder,
  max,
  rows,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  max: number;
  rows: number;
}) {
  const textes = useTraduction();
  const left = max - value.length;
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="label">{label}</span>
        {left < max / 4 && (
          <span className={`font-mono text-micro ${left <= 0 ? 'text-bad' : 'text-ink-dim'}`}>
            {textes.carteReco.caracteres(left)}
          </span>
        )}
      </div>
      <textarea
        value={value}
        maxLength={max}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        // ⚠️ Trim à la SORTIE du champ, jamais à la frappe : trimer pendant
        // qu'on tape empêcherait d'écrire une espace ou un retour à la ligne.
        // Les retours à la ligne INTÉRIEURS sont conservés — ils font partie de
        // la mise en forme voulue par l'auteur (voir NoteBlock).
        onBlur={(e) => {
          const t = e.target.value.trim();
          if (t !== value) onChange(t);
        }}
        placeholder={placeholder}
        className="w-full bg-panel border border-border rounded-lg px-2.5 py-1.5 text-xs text-ink
                   outline-none focus:border-accent resize-y"
      />
    </div>
  );
}

// Affichage d'une consigne (les retours à la ligne de l'auteur sont conservés).
function NoteBlock({ text, label, compact }: { text: string; label: string; compact?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-border bg-panel/60 px-2.5 py-1.5 ${compact ? 'mb-2' : 'mb-3'}`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <StickyNote size={11} className="flex-none text-star" />
        <span className="label">{label}</span>
      </div>
      <p className="text-xs text-ink leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  );
}

/* ---- Sets de runes recommandés ----------------------------------------- */

// Édition des runages recommandés : **plusieurs possibilités au choix**
// (« Violent/Némésis | Violent/Vengeance »). La confrontation n'en exige
// qu'UNE, d'où le séparateur « | » entre les combinaisons.
//
// Les sets ajoutés vont toujours dans la DERNIÈRE possibilité : on construit
// une combinaison, on clique « + Possibilité », et les clics suivants
// alimentent la nouvelle. Pas de notion de « possibilité sélectionnée » à gérer.
/**
 * ⚠️ **L'INTANGIBLE n'est pas un set qu'on recommande.**
 *
 * Joker à UNE pièce (`SET_INFO.intangible = { pieces: 1 }`, effects.ts) qui
 * complète n'importe quel set : on recommande « Violent + Will », jamais
 * « Intangible ». Le proposer revenait à réclamer un set de 2 pièces qui
 * n'existe pas.
 *
 * ⚠️ Même défaut, corrigé en même temps, dans le picker de l'Optimizer
 * (`outils/SetComboPicker.tsx`) — c'est là qu'il a été signalé. Les deux
 * grilles partaient de `RUNE_SETS` entier.
 *
 * ⚠️ Le rendu des sets DÉJÀ posés continue de lire `RUNE_SETS` : une reco
 * enregistrée avant ce correctif peut en contenir un, et il doit rester
 * affichable et retirable.
 */
const SETS_CHOISISSABLES = RUNE_SETS.filter((s) => s.key !== INTANGIBLE_SET);

function SetEditor({
  options,
  onAdd,
  onRemove,
  onAddOption,
}: {
  options: string[][];
  onAdd: (option: number, key: string) => void;
  onRemove: (option: number, position: number) => void;
  onAddOption: () => void;
  onRemoveOption: (option: number) => void;
}) {
  const textes = useTraduction();
  const jeu = textes.jeu;
  const cr = textes.carteReco;
  // Possibilité VISÉE par les ajouts. Par défaut la dernière — on construit la
  // combinaison en cours. Cliquer une chip d'une autre possibilité la vise, ce
  // qui permet de revenir compléter une combinaison laissée incomplète
  // (« Violent » seul à côté d'un « Violent | Will » terminé).
  const [focus, setFocus] = useState<number | null>(null);
  const last = options.length - 1;
  const target = focus != null && focus <= last ? focus : last;
  const current = options[target] ?? [];
  const used = setsCost(current);
  const full = !SETS_CHOISISSABLES.some((st) => canAddSet(current, st.key)); // plus rien ne rentre
  const [open, setOpen] = useState(false);

  // Le panneau se referme dès qu'il n'y a plus de set possible, sinon on
  // laisserait une grille entièrement grisée à l'écran.
  useEffect(() => {
    if (full) setOpen(false);
  }, [full]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="label">
          {cr.runage}{options.length > 1 ? cr.possibilites(options.length) : ''}
        </span>
        <span className="font-mono text-micro text-ink-dim">
          {cr.runesUtilisees(used, MAX_SET_PIECES)}
        </span>
      </div>

      {options.some((o) => o.length > 0) && (
        <div className="flex flex-wrap items-center gap-1 mb-1">
          {options.map((sets, oi) => {
            const vise = oi === target && options.length > 1;
            return (
              <span key={oi} className="flex flex-wrap items-center gap-1">
                {oi > 0 && <span className="px-0.5 font-mono text-xs text-ink-dim">|</span>}
                <span
                  className={`flex flex-wrap items-center gap-1 rounded-md ${
                    vise ? 'ring-1 ring-accent px-1 py-0.5' : ''
                  }`}
                >
                  {sets.length === 0 ? (
                    <span className="font-mono text-micro text-ink-dim italic">{textes.equipeSiege.vide}</span>
                  ) : (
                    sets.map((key, pos) => (
                      <span
                        key={pos}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-panel pl-1 pr-1.5 py-0.5"
                      >
                        {/* Cliquer la chip VISE sa possibilité : c'est ainsi
                            qu'on revient compléter une combinaison laissée
                            incomplète. Bouton distinct du ✕ (pas de bouton
                            imbriqué — les deux sont SIBLINGS dans la puce). */}
                        <ZoneCliquable
                          onClick={() => setFocus(oi)}
                          title={
                            oi === target ? cr.possibiliteVisee : cr.editerPossibilite
                          }
                          className="inline-flex items-center gap-1"
                        >
                          <RuneIcon setKey={key} size={14} />
                          <span className="text-micro text-ink">×{setPieces(key)}</span>
                        </ZoneCliquable>
                        {/* ⚠️ Pas `BoutonIcone` : sa plus petite taille
                            (`serre`, 20 px) est le plancher du BOUTON de la
                            librairie, mais reste plus haute que cette
                            puce (~16 px) — posée dedans, elle étirait toute
                            la puce à sa propre hauteur. Un bouton nu, sans
                            boîte imposée, épouse la hauteur du texte à côté
                            duquel il vit — exactement ce que cette puce
                            demande. */}
                        <button
                          onClick={() => onRemove(oi, pos)}
                          data-cible-fine
                          className="flex-none text-ink-dim transition hoverable:text-bad"
                          title={cr.retirerSet}
                          aria-label={cr.retirerSet}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))
                  )}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Les deux actions sur la MÊME ligne, à égalité : chacune la moitié de
          la largeur de la carte, plutôt que sa largeur de contenu.
          ⚠️ **`grid grid-cols-2` + `pleineLargeur` sur chaque bouton, pas
          `flex` + `flex-1`.** `Bouton` pose `flex-none` dans son SOCLE (voir
          Bouton.tsx) : un `flex-1` posé en `className` ne le bat pas,
          `flex-none` vient APRÈS dans la feuille de style construite
          (vérifié, pas supposé). `pleineLargeur` pose `w-full`, qui lui
          s'applique bien malgré `flex-none` — dans une grille à 2 colonnes
          égales, chaque bouton remplit alors exactement sa moitié. */}
      <div className="grid grid-cols-2 gap-1">
        {/* ⚠️ `icone`, pas un « + » écrit dans le texte : c'était la seule
            incohérence entre les deux boutons de cette rangée, l'un portait
            son symbole dans l'icône (comme partout ailleurs dans l'app),
            l'autre dans le libellé. */}
        <Bouton
          onClick={() => setOpen((o) => !o)}
          disabled={full}
          aria-expanded={open}
          taille="xs"
          pleineLargeur
          icone={!full ? <Plus size={11} /> : undefined}
          libelle={full ? cr.plusDePlace : cr.set}
          className={BOUTON_LG}
        />
        <Bouton
          onClick={() => {
            onAddOption();
            setFocus(null); // la nouvelle possibilité (la dernière) devient la cible
            setOpen(true); // on enchaîne directement sur le choix des sets
          }}
          disabled={(options[last] ?? []).length === 0}
          title={
            (options[last] ?? []).length === 0 ? cr.completerAvant : cr.autrePossibilite
          }
          taille="xs"
          pleineLargeur
          icone={<Plus size={11} />}
          libelle={cr.possibilite}
          className={BOUTON_LG}
        />
      </div>

      {/* Choix par ICÔNES plutôt que par menu déroulant : on reconnaît un set du
          jeu à son symbole, pas à son nom dans une liste. Le panneau reste
          ouvert pour enchaîner les ajouts, et se referme tout seul dès que les
          6 runes sont prises — il n'y a alors plus rien à cliquer.
          ⚠️ Pas `BoutonIcone` : cette grille est un CHOIX D'ICÔNES DE JEU (les
          symboles de set), pas une action d'interface — même famille que la
          roue de runes et les emplacements d'artéfacts, qui restent hors de la
          librairie.
          ⚠️ **28 px, pas 32** : le jeu compte plus de vingt sets. À 32 px +
          `gap-1`, la grille pesait lourd sur une carte de siège déjà étroite —
          un pavé de cases pour un choix qu'on fait une fois par slot. `RuneIcon`
          descend à 16 px avec la case, le symbole restant net à cette taille
          (voir la roue de runes, qui le dessine déjà aussi petit). */}
      {open && !full && (
        <div className="mt-1 rounded-lg border border-border bg-panel p-1.5">
          <div className="flex flex-wrap gap-1">
            {SETS_CHOISISSABLES.map((st) => {
              const fits = canAddSet(current, st.key);
              return (
                <button
                  key={st.key}
                  onClick={() => onAdd(target, st.key)}
                  disabled={!fits}
                  title={
                    fits
                      ? cr.setRunes(nomSet(jeu, st.key), setPieces(st.key))
                      : cr.setSansPlace(nomSet(jeu, st.key), setPieces(st.key))
                  }
                  aria-label={nomSet(jeu, st.key)}
                  // ⚠️ `data-cible-fine` : grille serrée d'icônes de set, où une
                  // cible de 44 px déborderait sur la voisine.
                  data-cible-fine
                  className={`flex items-center justify-center w-7 h-7 rounded-md border transition
                    ${
                      fits
                        ? 'bg-panel2 border-border hoverable:border-accent'
                        : 'bg-panel border-border opacity-25 cursor-not-allowed'
                    }`}
                >
                  <RuneIcon setKey={st.key} size={16} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Artéfacts ---------------------------------------------------------- */

// Édition des propriétés secondaires exigées, **une liste par sorte
// d'artéfact** (attribut, type), 4 au plus chacune — les 4 emplacements du jeu.
//
// ⚠️ Liste DÉROULANTE et non grille d'icônes comme les sets : il y a une
// quarantaine de propriétés, toutes textuelles, et aucune n'a de symbole dans
// le jeu. Une grille serait un mur de texte ; un `<select>` natif se filtre au
// clavier et se manipule au doigt.
//
// ⚠️ Les propriétés déjà exigées sont retirées de la liste, et celles qui
// n'existent pas sur cette sorte d'artéfact n'y ont jamais figuré
// (`artifactSubsFor`) : on ne propose pas « Dégâts sur le Feu » sur un artéfact
// de type, où il ne pourrait jamais être satisfait.
function ArtifactEditor({
  artifacts,
  onAdd,
  onRemove,
}: {
  artifacts: Record<ArtifactKind, number[]>;
  onAdd: (kind: ArtifactKind, code: number) => void;
  onRemove: (kind: ArtifactKind, code: number) => void;
}) {
  const textes = useTraduction();
  const jeu = textes.jeu;
  return (
    <div className="space-y-1.5">
      <span className="label">{textes.carteReco.artefacts}</span>
      {sortesArtefact(textes).map(({ key, label }) => {
        const choisis = artifacts?.[key] ?? [];
        const plein = choisis.length >= MAX_ARTIFACT_SUBS;
        const dispo = artifactSubsFor(key, jeu).filter((o) => !choisis.includes(o.code));
        return (
          <div key={key}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-micro text-ink-dim">{label}</span>
              <span className="font-mono text-micro text-ink-dim">
                {choisis.length}/{MAX_ARTIFACT_SUBS}
              </span>
            </div>

            {choisis.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 my-1">
                {choisis.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-panel pl-1.5 pr-1 py-0.5"
                  >
                    <span className="text-micro text-ink">{artifactSubLabel(code, jeu)}</span>
                    <BoutonIcone
                      onClick={() => onRemove(key, code)}
                      ton="danger"
                      taille="serre"
                      icone={<X size={10} />}
                      libelle={textes.carteReco.retirerPropriete}
                    />
                  </span>
                ))}
              </div>
            )}

            {/* `value=""` en permanence : le menu sert à AJOUTER, pas à porter
                une sélection courante — sinon le dernier ajout resterait
                affiché comme s'il était encore modifiable là. */}
            <Selecteur
              value=""
              disabled={plein || dispo.length === 0}
              onChange={(e) => {
                const code = Number(e.target.value);
                if (code) onAdd(key, code);
              }}
              taille="dense"
              surface="panel"
              className="mt-0.5 text-ink-dim hoverable:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="">
                {plein ? textes.carteReco.proprietesPrises(MAX_ARTIFACT_SUBS) : textes.carteReco.ajouterPropriete}
              </option>
              {/* `artifactSubsFor` les rend déjà dans l'ordre du JEU — le même
                  que le filtre de l'inventaire d'artéfacts. */}
              {dispo.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </Selecteur>
          </div>
        );
      })}
    </div>
  );
}

// Vue : les propriétés d'artéfact exigées, marquées ✓/✗ après analyse. Rien
// n'est affiché si aucune n'est exigée — la majorité des recommandations ne
// portent que sur les runes et les stats, ce bloc ne doit pas les alourdir.
function ArtifactList({
  artifacts,
  sm,
}: {
  artifacts: Record<ArtifactKind, number[]>;
  sm: SlotMatch | null;
}) {
  const textes = useTraduction();
  const jeu = textes.jeu;
  const rien = ARTIFACT_KINDS.every(({ key }) => (artifacts?.[key] ?? []).length === 0);
  if (rien) return null;
  // Après analyse seulement : sans build confronté, un ✗ sur chaque ligne
  // ferait croire à un manque alors que rien n'a été vérifié.
  const analyse = !!sm && sm.status !== 'empty' && sm.status !== 'unknown' && !!sm.owned;
  const etat = new Map(sm?.artifactChecks.map((c) => [`${c.kind}:${c.code}`, c.ok]) ?? []);

  return (
    <div className="space-y-1">
      <span className="label">{textes.carteReco.artefacts}</span>
      {sortesArtefact(textes).map(({ key, label }) => {
        const codes = artifacts?.[key] ?? [];
        if (codes.length === 0) return null;
        return (
          <div key={key} className="flex flex-wrap items-center gap-1">
            <span className="font-mono text-micro text-ink-dim">{label}</span>
            {codes.map((code) => {
              const ok = analyse ? etat.get(`${key}:${code}`) ?? false : null;
              return (
                <span
                  key={code}
                  title={
                    ok === null
                      ? undefined
                      : ok
                        ? textes.carteReco.proprietePresente
                        : textes.carteReco.proprieteAbsente(textes.carteReco.probleme.sorte[key])
                  }
                  // Fonds DOUX du jeton (`good-soft`/`bad-soft`), texte à l'encre :
                  // un aplat saturé à 20-25 % se lisait mal.
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${
                    ok === null
                      ? 'border-border-soft bg-panel'
                      : ok
                        ? 'border-good/50 bg-good-soft'
                        : 'border-bad/50 bg-bad-soft'
                  }`}
                >
                  <span className="text-micro text-ink">
                    {artifactSubLabel(code, jeu)}
                  </span>
                  {ok === true && <Check size={10} className="text-good" />}
                  {ok === false && <X size={10} className="text-bad" />}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Vue : les runages recommandés. Plusieurs possibilités sont séparées par
// « ou » — **une seule suffit**. Après analyse, seule la possibilité RETENUE
// (`matchedOption`, la plus proche d'être satisfaite) est marquée ✓/✗ ; les
// autres restent neutres, sinon on afficherait des manques sur un runage que le
// joueur n'a pas choisi.
function SetList({ options, sm }: { options: string[][]; sm: SlotMatch | null }) {
  const textes = useTraduction();
  const cr = textes.carteReco;
  const opts = options?.length ? options : [[]];
  if (opts.every((o) => o.length === 0)) {
    return <p className="font-mono text-micro text-ink-dim">{cr.aucunSetRecommande}</p>;
  }
  const analysed = !!sm && sm.status !== 'empty';
  const retenue = sm?.matchedOption ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {opts.map((sets, oi) => {
        // On consomme la liste des manquants pour marquer les bonnes occurrences.
        const pool = analysed && oi === retenue ? [...(sm?.missingSets ?? [])] : null;
        return (
          <span key={oi} className="flex flex-wrap items-center gap-1">
            {oi > 0 && <span className="px-0.5 font-mono text-xs text-ink-dim">|</span>}
            {sets.length === 0 ? (
              <span className="font-mono text-micro text-ink-dim italic">{cr.aucunSet}</span>
            ) : (
              <span className="flex flex-wrap items-center gap-1">
                {sets.map((key, i) => {
                  let ok: boolean | null = null;
                  if (pool) {
                    const j = pool.indexOf(key);
                    if (j >= 0) {
                      pool.splice(j, 1);
                      ok = false; // manquant
                    } else ok = true; // porté
                  }
                  return (
                    <span
                      key={i}
                      title={
                        ok === null ? undefined : ok ? cr.setPorte : cr.setManquant(nomSet(textes.jeu, key))
                      }
                      // Fonds DOUX, texte à l'encre — comme les
                      // propriétés d'artéfact.
                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${
                        ok === null
                          ? 'border-border-soft bg-panel'
                          : ok
                            ? 'border-good/50 bg-good-soft'
                            : 'border-bad/50 bg-bad-soft'
                      }`}
                    >
                      <RuneIcon setKey={key} size={14} />
                      <span className="text-micro text-ink">
                        ×{setPieces(key)}
                      </span>
                      {ok === true && <Check size={10} className="text-good" />}
                      {ok === false && <X size={10} className="text-bad" />}
                    </span>
                  );
                })}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/* ---- Badges de statut --------------------------------------------------- */

// La phrase du verdict d'un deck — l'infobulle de la pastille de la ligne,
// aux deux formats.
function verdictDeck(match: DeckMatch, t: Dictionnaire): { cls: string; text: string } | null {
  const p = t.carteReco.probleme;
  const equipe = match.team ? ` · ${libelleSource(match.team, t.carteReco.sources)}` : '';
  const map: Record<string, { cls: string; text: string }> = {
    ok: { cls: 'text-good', text: `${t.carteReco.jouable}${equipe}` },
    nodeck: { cls: 'text-warn', text: p.aComposerCourt },
    ko: {
      cls: 'text-bad',
      text: `${libelleCausesDeck(deckFaults(match.slots), t) || p.criteres}${equipe}`,
    },
    missing: { cls: 'text-bad', text: p.deckImpossible },
  };
  return map[match.status] ?? null;
}

// Combien de fois le deck est montable EN PARALLÈLE avec la réserve 6★.
//
// ⚠️ Une pastille DISTINCTE du badge de statut : ce n'est pas un verdict sur le
// deck (« jouable », « à revoir ») mais une information de stock. Les fondre
// ferait lire « jouable ×2 » comme un degré de conformité.
//
// ⚠️ **6★ uniquement** — la box n'en contient pas d'autres (voir
// `countCopiesByCom2us`). Un monstre en réserve à 5★ ne se joue pas tel quel.
function CopiesBadge({ copies }: { copies: number | null }) {
  const c = useTraduction().carteReco.copies;
  // `null` = pas de compte importé, ou deck vide : on ne dit rien plutôt que
  // d'annoncer « 0 fois », qui affirmerait quelque chose de faux.
  if (copies === null) return null;

  // ⚠️ Zéro se dit, et se dit en ROUGE : c'est l'information la plus utile de
  // la pastille — le deck ne peut pas être monté, faute d'exemplaires 6★.
  if (copies === 0) {
    return (
      <span
        className="font-mono text-micro text-bad"
        title={c.zeroAide}
      >
        · {c.realisable(0)}
      </span>
    );
  }
  return (
    <span
      className="font-mono text-micro text-ink-dim"
      title={
        copies > 1 ? c.plusieursAide(copies) : c.uneAide
      }
    >
      · {c.realisable(copies)}
    </span>
  );
}

// Libellés d'une cause de rejet — voir `slotFaults` dans recoMatch.ts, et
// `carteReco.causes` du dictionnaire. Les causes sont déjà rendues dans l'ordre
// du geste à faire (runage, artéfacts, puis stats) ; il n'y a plus qu'à les
// joindre.
// ⚠️ Côté deck, un NOM suivi de « à revoir » plutôt que « non respecté(e)s » :
// la formule est invariable, donc elle se combine sans accord — « runage,
// artéfacts et stats à revoir » se construit tout seul, quel que soit le
// nombre de causes.
function enumerer(morceaux: string[], et: string): string {
  if (morceaux.length <= 1) return morceaux[0] ?? '';
  return `${morceaux.slice(0, -1).join(', ')} ${et} ${morceaux[morceaux.length - 1]}`;
}

function libelleCausesSlot(causes: FaultCause[], t: Dictionnaire): string {
  return causes.map((c) => t.carteReco.causes.slot[c]).join(' · ');
}

function libelleCausesDeck(causes: FaultCause[], t: Dictionnaire): string {
  const k = t.carteReco.causes;
  return causes.length ? k.aRevoir(enumerer(causes.map((c) => k.deck[c]), t.siege.fautes.et)) : '';
}

// Badge sous le nom du monstre : possédé ? au niveau ? et d'après quel build
// (box, RTA, défense/offense de siège) — utile quand plusieurs presets existent.
function SlotBadge({ sm }: { sm: SlotMatch }) {
  const textes = useTraduction();
  const cr = textes.carteReco;
  if (sm.status === 'absent')
    return <div className="font-mono text-micro text-bad">{cr.indisponible}</div>;
  if (sm.status === 'unknown')
    // Possédé, mais aucun deck existant ne le réunit aux autres → rien à comparer.
    return <div className="font-mono text-micro text-ink-dim">{cr.possede}</div>;
  if (sm.status === 'ok')
    return (
      <div className="font-mono text-micro text-good" title={cr.deckRetenu(libelleSource(sm.owned?.label ?? '', cr.sources))}>
        {cr.auNiveau}
      </div>
    );
  if (sm.status === 'ko')
    return (
      <div className="font-mono text-micro text-bad" title={cr.deckRetenu(libelleSource(sm.owned?.label ?? '', cr.sources))}>
        {libelleCausesSlot(slotFaults(sm), textes) || cr.probleme.criteres}
      </div>
    );
  return null;
}

// Liste « stat : minimum » avec, si un compte est chargé, la valeur réelle et
// l'écart (vert = atteint, rouge = il manque X).
//
// ⚠️ **Pas de colonne « total » permanente.** Base et bonus se lisent
// séparément par défaut ; un clic sur la table bascule vers le total —
// même geste que le détail d'une rune ou d'un artéfact équipé
// (`RuneDetailBox`/`ArtifactDetailBox` dans PieceDetail.tsx) : la carte du
// jeu montre « VIT +26 +5 » au repos, le total au clic. Trois colonnes
// affichées en permanence pour dire la même chose deux fois (bonus ET total)
// pesaient plus lourd que ce qu'elles ajoutaient.
function StatList({
  slot,
  monster,
  sm,
}: {
  slot: RecoSlot;
  monster: Monster | null;
  sm: SlotMatch | null;
}) {
  const textes = useTraduction();
  const jeu = textes.jeu;
  const entries = RECO_STATS.filter((st) => (slot.stats[st.key] ?? 0) > 0);
  const [total, setTotal] = useState(false);
  if (entries.length === 0) {
    return <p className="font-mono text-micro text-ink-dim">{textes.carteReco.aucuneStat}</p>;
  }
  const checkOf = (key: RecoStatKey) => sm?.checks.find((c) => c.key === key) ?? null;
  // La colonne « toi » n'a de sens qu'après une analyse.
  const analyse = !!sm && sm.checks.some((c) => c.actual !== null);

  // ⚠️ **PLUS de table qui défile** — même règle que `StatEditor` juste
  // au-dessus : chaque stat est une ligne `flex-wrap`, et la colonne
  // « actuel » passe à la ligne suivante plutôt que de sortir du cadre.
  // ⚠️ **Un seul en-tête « actuel », pas un mot répété à chaque ligne.**
  // Écrire « toi » devant chaque valeur pesait plus lourd que la colonne
  // qu'il remplaçait ; une seule étiquette au-dessus, alignée comme la
  // colonne l'était dans la table, suffit à la nommer une fois pour toutes.
  return (
    <ZoneCliquable
      onClick={() => setTotal((v) => !v)}
      aria-pressed={total}
      title={total ? textes.carteReco.voirDetail : textes.carteReco.voirTotaux}
      className="flex w-full flex-col text-left"
    >
      {/* L'en-tête du petit tableau : ce que dit chaque colonne. La colonne
          des valeurs dit si elle montre base + bonus ou le total (le clic
          bascule) ; « actuel » n'apparaît qu'après une analyse. */}
      <div className="flex items-center gap-x-2 pb-1" data-entete-stats>
        <span className="w-14 flex-none label">{textes.carteReco.statsEnTete.stat}</span>
        <span className="label">{total ? textes.carteReco.statsEnTete.total : textes.carteReco.statsEnTete.baseBonus}</span>
        {analyse && <span className="ml-auto label">{textes.carteReco.actuel}</span>}
      </div>
      {entries.map((st) => {
        const req = slot.stats[st.key]!;
        const known = baseFor(st.key, monster);
        const bonus = known != null ? req - known : null;
        const c = checkOf(st.key);
        // Stat non respectée → ligne mise en évidence (fond rouge léger), pour
        // qu'on voie d'un coup CE qui bloque sans lire les chiffres.
        const rate = analyse && c && c.actual !== null && !c.ok;
        return (
          <div
            key={st.key}
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/40 py-1
              text-micro last:border-0 ${rate ? 'bg-bad-soft' : ''}`}
          >
            <span className={`w-14 flex-none ${rate ? 'text-bad font-semibold' : 'text-ink-dim'}`}>
              {jeu.stats[st.key]}
            </span>
            {/* Taux Crit, Dmg Crit, RES et Précision : toujours le total
                (`STATS_AVEC_BASE`, décision de l'utilisateur pour toute l'app). */}
            {total || !STATS_AVEC_BASE.has(st.key) ? (
              <span className="flex-none font-mono font-semibold text-ink tabular-nums">
                {fmtStat(req)}
                {st.suffix}
              </span>
            ) : (
              <>
                <span className="flex-none font-mono text-ink-dim tabular-nums">
                  {known != null ? fmtStat(known) : '—'}
                </span>
                <span className="flex-none font-mono text-good tabular-nums">
                  {bonus != null ? `+${fmtStat(bonus)}` : '—'}
                </span>
              </>
            )}
            {analyse && (
              <span
                className={`ml-auto flex-none font-mono tabular-nums ${
                  c ? (c.ok ? 'text-good' : 'text-bad') : 'text-ink-dim'
                }`}
                title={
                  c && c.actual !== null && !c.ok
                    ? textes.carteReco.ilTeManque(`${fmtStat(-c.diff)}${st.suffix}`)
                    : undefined
                }
              >
                {c && c.actual !== null ? (
                  <>
                    {fmtStat(c.actual)}
                    {st.suffix}
                    {!c.ok && <span className="text-bad/70"> (−{fmtStat(-c.diff)})</span>}
                  </>
                ) : (
                  '—'
                )}
              </span>
            )}
          </div>
        );
      })}
    </ZoneCliquable>
  );
}
