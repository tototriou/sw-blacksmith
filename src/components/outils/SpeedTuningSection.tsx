import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, Plus, Users, Swords, X, Zap, Gauge, Eye, EyeOff, Download, Check, Scissors, Play, ChevronUp, ChevronDown, Sparkles, CopyPlus } from 'lucide-react';
// Le chronomètre de l'entrée « Speed tuning » de la nav.
import { IconeOptimizer, IconeSpeedTuning } from '../IconesAtelier';
import { Monster, SiegeTeam } from '../../types';
import { LeadInfo, combatSpeed, leadsDeVitesse, runeSpeedForTarget } from '../../lib/speed';
import {
  simuler,
  premiersTours,
  diagnostiquerChaine,
  vitessesRequises,
  artefactsRequis,
  diagnostiquerSequence,
  fenetresRequises,
  Fenetre,
  HORIZON_TICKS,
  Camp,
  TuneMonstre,
  ModParTick,
  litOccurrence,
} from '../../lib/speedTune';
import { deckPourSpeedTune } from '../../lib/speedTuneDeck';
import {
  Ligne,
  Leads,
  aLaMain,
  ampliDe as ampliDeLignes,
  appliquerMods,
  combatDe as combatDeLigne,
  duCamp,
  entreeDe as entreeDeLigne,
  estimerCumuls,
  gainPassifDe as gainPassifDeLigne,
  leadDe as leadDeCamp,
  ligneReference as ligneReferenceDe,
  ligneVierge,
  lignesDeDeck,
  majMod,
  oublierCamp,
  passifActifDe as passifActifDeLigne,
  passifDe as passifDeLigne,
  plusRapideAllie as plusRapideAllieDe,
  sortActif as sortActifDe,
  sortSecondDe,
  sortsDe as sortsDeLigne,
  tuneDe,
  uidDe,
  visibles,
} from '../../lib/speedTuneLignes';
import { kitVitesse, sortsVitesse, KitVitesse, SortVitesse, KIT_VIDE } from '../../lib/speedTuneKit';
import { passifsVitesse, pointsDeGain, PassifVitesse } from '../../lib/speedTunePassif';
import { analyseAutomatique, cumulsEstimes, sortRetenu, sortSecondRetenu, EntreeAuto } from '../../lib/speedTuneAuto';
import { chargerDetail } from '../../lib/monsterSkills';
import { teamSummary } from '../../lib/recoFromSiege';
import { formesJouables } from '../../lib/monsterForms';
import LeadPill from '../siege/LeadPill';
import { useComboboxNav } from '../../hooks/useComboboxNav';
import { useSpeedTune, DeckDispo, ChampMod, DeckInitial, type OuvertureOptimizer } from '../../hooks/useSpeedTune';
import type { PlanSpeedTune } from '../../lib/planSpeedTune';
import { Colonnes, OrdreDeTour, RepereTicks, TableauBarres, TeteTicks, largeurTable } from './speedTune/VuesSpeedTune';
import { jugerApplication, perdOrigine } from '../../lib/speedTuneDepuisPlan';
import type { ActionImportOptimizer } from '../../lib/actionImportOptimizer';
import type { ExclusionSourceData } from '../../lib/optimizerExclusion';
import { importerSpeedTuneOptimizer, raisonRefus } from '../../lib/importSpeedTuneOptimizer';

import { useAdversaireReference } from '../../hooks/useAdversaireReference';
import { useStickyState } from '../../hooks/useStickyState';
import MonsterAvatar from '../MonsterAvatar';
import RuneIcon from '../RuneIcon';
import { runeSetIconFilter } from '../../lib/effects';
import {
  Bouton,
  Champ,
  FlottantAuto,
  Interrupteur,
  Flottant,
  NumberField,
  Selecteur,
  BoutonIcone,
  ZoneCliquable,
  ConfirmDialog,
} from '../../ui';
import { useTraduction } from '../../hooks/useLangue';
import { nomElement } from '../../i18n/jeu';
import { formatNombre } from '../../i18n/format';
import type { Dictionnaire } from '../../i18n/fr';

// Icône de vitesse du jeu, celle des cartes RTA/Siège. Sert de repère au buff
// de vitesse dans la grille dédiée.
const SPD_ICON = `${import.meta.env.BASE_URL}stats/spd.png`;
// Valeur du buff de vitesse du jeu (+30 %), posée d'un clic.
const BUFF_SPD = 30;

// Outils › Speed tuning — voir docs/02-app/speed-tuning/.
//
// À chaque tick, la barre d'action monte de `vitesse × 7 %` ; un seul monstre
// agit par tick (règle du jeu). L'écran répond à « est-ce que je joue AVANT tel
// monstre ? » — d'où les deux camps (ton équipe / en face) et l'ordre de tour
// qui les entrelace. Deux grilles éditables (même rendu que la barre d'action)
// posent, par monstre/par tick ou pour toute une équipe, un BOOST de barre
// d'attaque (ponctuel) et un BUFF de vitesse (soutenu). Tout le calcul vit dans
// lib/speedTune.ts (pur, testé) ; ce composant assemble saisie et affichage.

interface Props {
  onImporterEquipe?: ActionImportOptimizer;
  sourcesOptimizer?: ExclusionSourceData;
  compteCharge?: boolean;
  allMonsters: Monster[];
  // Équipes de siège du compte : elles s'importent dans « Ton équipe » (voir
  // DECKS plus bas). Vides tant qu'aucun compte n'est chargé — le reste de
  // l'outil marche sans.
  siegeDefenseTeams: SiegeTeam[];
  siegeOffenseTeams: SiegeTeam[];
  // Équipe chargée d'office à l'ouverture — l'outil ouvert DEPUIS un deck (voir
  // SpeedTuneModale). Absent sur la page d'outil, qui s'ouvre sur ce qu'on y a
  // laissé.
  deckInitial?: DeckInitial | null;
  // L'en-tête de la page (titre + rappel de la règle des ticks). ⚠️ Coupé en
  // modale, qui porte déjà les deux : deux titres « Speed tuning » l'un sous
  // l'autre, et on cherche lequel des deux se ferme.
  entete?: boolean;
  // Ouvert depuis une équipe de l'Optimizer (feat-speed-tune-depuis-optimizer.md) :
  // un état à part, prérempli depuis l'équipe, et « Appliquer à l'équipe » à la
  // place de l'export.
  appliquer?: { ouverture: OuvertureOptimizer; onAppliquer: (plan: PlanSpeedTune) => void };
}

// Le rappel de la règle, en une phrase. ⚠️ Écrit UNE fois : la page le met sous
// son titre, la modale sous le sien — il ne doit pas exister deux versions qui
// se mettent à diverger.
export function RegleTicks() {
  const r = useTraduction().speedTuning.regle;
  return (
    <>
      {r.debut}<span className="text-ink">{r.formule}</span>{r.fin}
    </>
  );
}

// Un modificateur signé, tel qu'il se lit dans une grille : « +45 », « −50 ».
// ⚠️ Les effets posés par les compétences peuvent être NÉGATIFS (une barre
// vidée, un ralenti) — « +-50 » serait illisible.
const signe = (v: number) => (v > 0 ? `+${v}` : `−${Math.abs(v)}`);

// Un pourcentage de barre au dixième, comme `pourcentBarre`, mais dans la
// langue de l'écran : « 34,5 » en français, « 34.5 » en anglais.
const barre = (n: number, t: Dictionnaire) =>
  formatNombre(Math.round(n * 10) / 10, t.codeLangue, { maximumFractionDigits: 1 });

// Ce qu'un sort fait, en une ligne, pour le menu de l'analyse poussée. Un sort
// sans effet sur la vitesse reste proposable — c'est un tour où l'on ne fait
// rien pour le tune, et c'est une information.
function libelleSort(x: SortVitesse, t: Dictionnaire): string {
  const s = t.speedTuning.sort;
  const bouts: string[] = [];
  const e = x.effet;
  if (e.atbTousAZero) bouts.push(s.barresAZero);
  if (e.atbTous) bouts.push(s.barreTous(barre(e.atbTous, t)));
  if (e.atbEquipe) bouts.push(s.barreEquipe(barre(e.atbEquipe, t)));
  if (e.atbAllie) bouts.push(s.barreAllie(barre(e.atbAllie, t)));
  if (e.atbSoi) bouts.push(s.barreSoi(barre(e.atbSoi, t)));
  if (x.atbAuChoix?.unite === 'retrait') bouts.push(s.barreParRetrait(barre(x.atbAuChoix.pas, t)));
  if (x.atbAuChoix?.unite === 'pourcent') bouts.push(s.barreJusqua(x.atbAuChoix.max));
  // ⚠️ Annoncé, mais annoncé comme NON COMPTÉ : le tune se juge sans ce qu'on
  // retire à l'adverse (voir `sansReductionAdverse`). Le taire laisserait croire
  // que le calcul en tient compte.
  if (e.atbEnnemi)
    bouts.push(s.barreAdverse(e.atbEnnemi, !!e.atbEnnemiTous));
  if (e.buffEquipe) bouts.push(e.buffEquipeSansSoi ? s.buffAutresAllies : s.buffEquipe);
  if (e.buffSoi) bouts.push(s.buffSoi);
  if (e.buffAllie) bouts.push(s.buffAllie);
  if (e.ralenti) bouts.push(s.ralenti(!!e.ralentiTous));
  if (x.optionArbre) bouts.push(s.optionArbre);
  if (x.rejoue) bouts.push(s.rejoue);
  if (x.cooldown > 0) bouts.push(s.recharge(x.cooldown));
  if (x.chance != null) bouts.push(`${x.chance} %`);
  const quoi = bouts.length ? bouts.join(' · ') : s.sansEffet;
  return `${x.slot ? `S${x.slot} ` : ''}${x.nom} — ${quoi}`;
}

// ⚠️ **Les barres se lisent à TROIS décimales.** À deux, une barre à 99,996 %
// s'affichait « 100.00 » sans que le monstre agisse : on cherchait un bug là où
// il n'y en avait pas. Le tick se joue à un millième près, l'affichage doit le
// montrer.
// Les colonnes communes aux trois tableaux (même grille, défilement
// synchronisé) et les vues de résultat vivent dans speedTune/VuesSpeedTune.tsx.
const TICKS = Array.from({ length: HORIZON_TICKS }, (_, i) => i + 1);
const LARGEUR_TABLE = largeurTable();

export default function SpeedTuningSection({
  onImporterEquipe,
  sourcesOptimizer,
  compteCharge = false,
  allMonsters,
  siegeDefenseTeams,
  siegeOffenseTeams,
  deckInitial,
  entete = true,
  appliquer,
}: Props) {
  const textes = useTraduction();
  const st = textes.speedTuning;
  // ⚠️ **Ce composant NE CALCULE RIEN.** Tout le métier — vitesses, sorts,
  // analyse, adversaire de référence — vit dans `useSpeedTune` et les libs
  // qu'il appelle. Ne restent ici que le rendu et ce qui n'a de sens qu'à
  // l'écran : le défilement synchronisé des tableaux et les pastilles.
  const {
    aAllie,
    aEnnemi,
    nomDe,
    parTick,
    rien,
    rienVisible,
    runesPour,
    ajouter,
    alliesVisibles,
    ampliDe,
    analyseAuto,
    analyser,
    arrivee,
    arteParUid,
    arteRequis,
    auto,
    basculerMasque,
    copierEnFace,
    basculerPassif,
    basculerSwift,
    chaine,
    choisirCible,
    choisirAtb,
    ajouterOccurrence,
    retirerOccurrence,
    choisirSecond,
    choisirSort,
    choixSorts,
    cibleFenetre,
    cibleSort,
    atbChoisi,
    combatDe,
    decks,
    deplacer,
    donneesKit,
    entreeDe,
    fenetreArteParUid,
    fenetreParUid,
    fenetres,
    fenetresArte,
    gainPassifDe,
    importerDeck,
    jouables,
    kits,
    leadAllie,
    leadDe,
    leadEnnemi,
    poserLead,
    leads,
    ligneParUid,
    ligneReference,
    lignes,
    lignesTableau,
    lignesVisibles,
    monsterById,
    montrerAnalyse,
    numAction,
    ordreRange,
    ordreVoulu,
    passifActifDe,
    passifDe,
    passifs,
    plusRapideAllie,
    poussee,
    premiereSignature,
    premiers,
    problemeParUid,
    requis,
    deplacerLigne,
    retirer,
    sequence,
    setArtefact,
    setAuto,
    setCibleSort,
    setCumuls,
    setKits,
    setLeadAllie,
    setLeadEnnemi,
    setLignes,
    setMod,
    setModEquipe,
    setMontrerAnalyse,
    setOrdreRange,
    setOrdreVoulu,
    setPassifs,
    setPoussee,
    setRuneSpeed,
    setSortChoisi,
    setSortChoisi2,
    setSorts,
    sim,
    sortActif,
    sortAuto,
    sortChoisi,
    sortChoisi2,
    sortSecond,
    sorts,
    sortsDe,
    sortsSignature,
    toujoursReference,
    tune,
    restauration,
    bestiaire,
    kitsLus,
  } = useSpeedTune({ allMonsters, siegeDefenseTeams, siegeOffenseTeams, deckInitial, ouverture: appliquer?.ouverture });

  const raisonExportOptimizer = useMemo(() => {
    if (!compteCharge) return st.export.sansCompte;
    if (!onImporterEquipe || !sourcesOptimizer) return st.export.indisponible;
    return importerSpeedTuneOptimizer(lignes, leadAllie, sourcesOptimizer, textes, deckInitial ?? undefined).membres.length
      ? undefined : st.export.vide;
  }, [compteCharge, onImporterEquipe, sourcesOptimizer, lignes, leadAllie, deckInitial, textes, st]);
  // Le plan photographié à l'export : l'état de l'outil au geste
  // (feat-contrainte-speed-tune.md, « Le plan de speed tune »).
  const etatPlan = { leads, choix: choixSorts, ordre: ordreVoulu, donnees: donneesKit, verdictEcran: sequence.ok };
  const exporterOptimizer = () => onImporterEquipe?.((data, t) => importerSpeedTuneOptimizer(lignes, leadAllie, data, t, deckInitial ?? undefined, etatPlan));

  // « Appliquer à l'équipe » : refus dit sous le bouton, verdict différent de
  // l'écran confirmé (défaut : annuler), sinon le plan part à l'équipe.
  const [refusAppliquer, setRefusAppliquer] = useState<string | null>(null);
  const [aConfirmer, setAConfirmer] = useState<PlanSpeedTune | null>(null);
  useEffect(() => setRefusAppliquer(null), [lignes, ordreVoulu]);
  const appliquerALEquipe = () => {
    if (!appliquer) return;
    const r = jugerApplication(lignes, leads, choixSorts, ordreVoulu, donneesKit, bestiaire, sequence.ok);
    if ('manque' in r) return setRefusAppliquer(st.camp.vitesseManquante(r.manque.monster.name));
    if ('refus' in r) return setRefusAppliquer(raisonRefus(r.refus, lignes, textes));
    setRefusAppliquer(null);
    if (r.verdictDifferent) setAConfirmer(r.plan);
    else appliquer.onAppliquer(r.plan);
  };
  const actionAppliquer = appliquer && {
    onClick: appliquerALEquipe,
    raison: restauration === 'prete' && kitsLus ? undefined : st.camp.lectureKits,
    refus: refusAppliquer,
    perteOrigine: 'plan' in appliquer.ouverture && perdOrigine(appliquer.ouverture.plan),
  };

  function besoin(l: Ligne, combatCible: number | null, arteCible: number | null, arteActuel: number) {
    const runes = combatCible == null ? null : runesPour(l, combatCible);
    const arte = arteCible == null ? null : arteCible - arteActuel;
    if (runes == null && arte == null) {
      return <span className="text-xs text-ink-dim">{st.analyse.horsDePortee}</span>;
    }
    return (
      <span className="flex items-center gap-1.5">
        {runes != null && (
          <span className="rounded border border-accent/50 px-1.5 py-0.5 font-mono text-micro font-bold text-accent">
            {st.analyse.runesSpd(signe(runes))}
          </span>
        )}
        {runes != null && arte != null && <span className="text-micro text-ink-dim">{st.analyse.ou}</span>}
        {arte != null && (
          <span
            className="rounded border border-accent/50 px-1.5 py-0.5 font-mono text-micro font-bold text-accent"
            title={st.analyse.artefactAide}
          >
            {signe(arte)} {st.analyse.effetBuff}
          </span>
        )}
      </span>
    );
  }

  // La borne à viser sur une fenêtre, ou `null` si la vitesse actuelle la tient
  // déjà — et `undefined` si la fenêtre est VIDE (les bornes se croisent : on ne
  // s'en sortira pas sans toucher aux autres).
  // Défilement horizontal SYNCHRONISÉ entre les trois tableaux : bouger l'un
  // aligne les deux autres, pour que la colonne d'un tick reste sous la même.
  const conteneurs = useRef<HTMLDivElement[]>([]);
  const enregistrer = (i: number) => (el: HTMLDivElement | null) => {
    if (el) conteneurs.current[i] = el;
  };
  const synchro = (e: React.UIEvent<HTMLDivElement>) => {
    const x = e.currentTarget.scrollLeft;
    for (const el of conteneurs.current) {
      if (el && el !== e.currentTarget && el.scrollLeft !== x) el.scrollLeft = x;
    }
  };

  // L'ordre de tour, posé à DEUX endroits selon le format (un seul visible) :
  // tout en bas au doigt, sous l'analyse à la souris.
  const ordreDeTour = (className: string) => (
    <OrdreDeTour premiers={premiers} ligneParUid={ligneParUid} className={className} />
  );

  return (
    <div className="space-y-4">
      {entete && (
        // ⚠️ **À la SOURIS, le titre au gabarit des autres pages** (la maquette) :
        // titre en police d'affichage, sans
        // la pastille d'icône, la règle des ticks dessous.
        <header className="flex items-start gap-3">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded bg-accent-soft text-accent lg:hidden">
            <IconeSpeedTuning size={18} />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight lg:font-display lg:text-xl lg:font-normal lg:tracking-wide lg:text-ink">
              {st.titre}
            </h1>
            <p className="mt-0.5 text-sm text-ink-dim"><RegleTicks /></p>
          </div>
        </header>
      )}

      {/* Repère des ticks */}
      <RepereTicks parTick={parTick} />

      {/* Camps — flex-wrap : côte à côte quand il y a la place, empilés sinon.
          ⚠️ **Au TÉLÉPHONE, toujours empilés** (`max-lg:flex-col`) :
          dès 560 px de large, deux camps de 280 px tenaient côte à côte, et
          chacun devenait trop étroit — le lead débordait de l'en-tête et les
          trois réglages de chaque monstre s'empilaient (relevé par le mainteneur en
          mode appareil). Pleine largeur, la card retrouve sa rangée. */}
      <div className="flex flex-wrap gap-4 max-lg:flex-col">
        <CampPanneau
          camp="allie"
          titre={st.tonEquipe}
          icone={<Users size={15} />}
          lead={leadAllie}
          onLead={poserLead('allie')}
          lignes={lignes.filter((l) => l.camp === 'allie')}
          jouables={jouables}
          combatDe={combatDe}
          onAjouter={(id) => ajouter('allie', id)}
          onRetirer={retirer}
          onMasquer={basculerMasque}
          onCopier={copierEnFace}
          onDeplacer={deplacerLigne}
          onRuneSpeed={setRuneSpeed}
          onSwift={basculerSwift}
          onCumuls={setCumuls}
          onPassif={basculerPassif}
          passifDe={passifDe}
          passifActifDe={passifActifDe}
          gainPassifDe={gainPassifDe}
          kits={kits}
          onArtefact={setArtefact}
          decks={decks}
          onImporterDeck={(team) => importerDeck('allie', team)}
          onExporterOptimizer={appliquer ? undefined : exporterOptimizer}
          raisonExportOptimizer={raisonExportOptimizer}
          appliquer={actionAppliquer || undefined}
        />
        <CampPanneau
          camp="ennemi"
          titre={st.enFace}
          icone={<Swords size={15} />}
          lead={leadEnnemi}
          onLead={poserLead('ennemi')}
          lignes={lignes.filter((l) => l.camp === 'ennemi')}
          jouables={jouables}
          combatDe={combatDe}
          onAjouter={(id) => ajouter('ennemi', id)}
          onRetirer={retirer}
          onMasquer={basculerMasque}
          onCopier={copierEnFace}
          onDeplacer={deplacerLigne}
          onRuneSpeed={setRuneSpeed}
          onSwift={basculerSwift}
          onCumuls={setCumuls}
          onPassif={basculerPassif}
          passifDe={passifDe}
          passifActifDe={passifActifDe}
          gainPassifDe={gainPassifDe}
          kits={kits}
          onArtefact={setArtefact}
          decks={decks}
          onImporterDeck={(team) => importerDeck('ennemi', team)}
        />
      </div>

      {rien ? (
        <div className="rounded-lg border border-dashed border-border/70 py-10 text-center text-sm text-ink-dim">
          {st.vide}
        </div>
      ) : rienVisible ? (
        <div className="rounded-lg border border-dashed border-border/70 py-10 text-center text-sm text-ink-dim">
          {st.tousMasques}
        </div>
      ) : (
        <>
            {/* ⚠️ **Côte à côte quand il y a la place, empilées sinon** — même
                idiome que les deux camps plus haut, et pour la même raison : un
                `flex-wrap` avec une largeur plancher suit la place RÉELLE
                (pleine page, ou modale), là où un point de rupture ne connaît
                que la fenêtre. L'ordre des sorts reste à GAUCHE : c'est la
                cause, l'analyse à droite en est l'effet.
                ⚠️ `items-start` : sans lui, la card courte s'étirerait à la
                hauteur de la longue et laisserait un grand vide encadré. */}
            <div className="flex flex-wrap items-start gap-4">
            {/* ⚠️ Une card INDÉPENDANTE : elle ne s'ouvre ni ne se ferme depuis
                l'analyse, elle est là comme les grilles. L'analyse la REMPLIT — elle
                y écrit l'ordre des vitesses et le sort de chacun — mais les deux
                se lisent et se règlent séparément.
                ⚠️ **Et elle passe EN PREMIER** : c'est ici qu'on désigne ce que
                chacun lance, et le verdict de l'analyse en découle. */}
          <section className="min-w-[440px] flex-1 rounded-lg border border-border bg-panel">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-soft px-4 py-2.5">
                  <span className="text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
                    {st.ordreSorts.titre}
                  </span>
                  <span className="ml-auto">
                    <Interrupteur
                      actif={poussee}
                      onChange={setPoussee}
                      libelle={<span className="text-xs font-semibold">{st.ordreSorts.afficher}</span>}
                      title={st.ordreSorts.afficherAide}
                    />
                  </span>
                </div>
                {poussee && (
                <div className="px-4 py-3.5">
                      {ordreVoulu.length === 0 ? (
                        <p className="text-sm text-ink-dim">{st.ordreSorts.vide}</p>
                      ) : (
                        <>
                          <ul className="space-y-2">
                            {ordreVoulu.map((cle, i) => {
                              // ⚠️ Une ligne est une OCCURRENCE (« le 2ᵉ tour de
                              // Racuni »), pas un monstre : la clé porte le rang,
                              // le monstre se retrouve par sa base. La 1ʳᵉ garde
                              // l'identifiant nu, donc rien ne change pour qui ne
                              // joue qu'une fois.
                              const { id: uid, n: rang } = litOccurrence(cle);
                              const l = ligneParUid.get(uid);
                              if (!l) return null;
                              const liste = sortsDe(l);
                              const choix = sortChoisi[cle];
                              // ⚠️ `sortActif` lit le sort du 1ᵉʳ tour. Pour un
                              // tour supplémentaire, c'est la clé d'occurrence
                              // qui fait foi — sinon la ligne du 2ᵉ tour
                              // affichait les options du 1ᵉʳ.
                              const sortDeLaLigne =
                                rang > 1 ? liste.find((x) => x.nom === choix) ?? null : sortActif(l);
                              return (
                                <li
                                  key={cle}
                                  className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-lg border border-border bg-panel2 px-2.5 py-2"
                                >
                                  <span className="flex flex-none items-center gap-1">
                                    <BoutonIcone
                                      taille="serre"
                                      onClick={() => deplacer(cle, -1)}
                                      disabled={i === 0}
                                      libelle={st.ordreSorts.monter(l.monster.name)}
                                      icone={<ChevronUp size={13} />}
                                    />
                                    <BoutonIcone
                                      taille="serre"
                                      onClick={() => deplacer(cle, 1)}
                                      disabled={i === ordreVoulu.length - 1}
                                      libelle={st.ordreSorts.descendre(l.monster.name)}
                                      icone={<ChevronDown size={13} />}
                                    />
                                  </span>
                                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-micro font-bold text-bg">
                                    {i + 1}
                                  </span>
                                  <MonsterAvatar monster={l.monster} size={24} element={false} />
                                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                    {l.monster.name}
                                    {/* ⚠️ Sans ce rang, deux lignes identiques se
                                        suivent et on ne sait plus laquelle on
                                        règle. Le libellé dit le TOUR, pas le rang
                                        dans la liste — celui-ci est déjà dans la
                                        pastille à gauche. */}
                                    {rang > 1 && (
                                      <span className="ml-1.5 font-normal text-ink-dim">· {st.ordreSorts.tour(rang)}</span>
                                    )}
                                  </span>
                                  {/* Ce qu'il LANCE à son tour, dans un menu à
                                      icônes : la ligne reste lisible d'un coup
                                      d'œil, et le détail s'ouvre à la demande. */}
                                  <ChoixSort
                                    sorts={liste}
                                    valeur={choix ?? ''}
                                    onChoisir={(v) => choisirSort(cle, v)}
                                    nomMonstre={l.monster.name}
                                  />
                                  {/* ⚠️ Certains sorts ne touchent QU'UN allié et
                                      laissent le joueur viser (S3 de Sapsaree :
                                      « the target ally »). La barre la plus basse
                                      est un défaut raisonnable, pas une règle du
                                      jeu : on doit pouvoir désigner.

                                      ⚠️ Affiché aussi pour un sort qui ne fait que
                                      BUFFER un allié : lui aussi vise, et c'est la
                                      même cible que la barre — un seul sort. */}
                                  {(sortDeLaLigne?.effet.atbAllie || sortDeLaLigne?.effet.buffAllie) && (
                                    <label className="flex items-center gap-1.5">
                                      <span className="text-micro uppercase tracking-wide text-ink-dimmer">{st.ordreSorts.sur}</span>
                                      <Selecteur
                                        taille="sm"
                                        pleineLargeur={false}
                                        value={cibleSort[cle] ?? ''}
                                        onChange={(e) => choisirCible(cle, e.target.value)}
                                        aria-label={st.ordreSorts.allieVise(l.monster.name)}
                                      >
                                        <option value="">{st.ordreSorts.barreLaPlusBasse}</option>
                                        {/* ⚠️ **Le lanceur EST dans la liste.** Le jeu
                                            autorise à se viser soi-même avec un sort
                                            « sur un allié », et c'est même le geste
                                            recherché quand il porte un buff de vitesse
                                            (Rabbit's Agility). Il reste hors du DÉFAUT
                                            « barre la plus basse » — la sienne vient de
                                            retomber à 0, il gagnerait toujours. */}
                                        {lignesVisibles
                                          .filter((x) => x.camp === l.camp)
                                          .map((x) => (
                                            <option key={x.uid} value={x.uid}>
                                              {x.monster.name}
                                              {x.uid === uid ? st.ordreSorts.luiMeme : ''}
                                            </option>
                                          ))}
                                      </Selecteur>
                                    </label>
                                  )}
                                  {/* ⚠️ Un sort dont le remplissage d'équipe DÉPEND
                                      DU COMBAT : buffs retirés (Blade Fan), PV
                                      ôtés à l'ennemi (Start of Attacking). Le
                                      défaut est zéro — un speed tune ne l'attend
                                      pas ; on désigne ce qu'on veut tester. */}
                                  {sortDeLaLigne?.atbAuChoix?.unite === 'retrait' && (
                                    <label className="flex items-center gap-1.5">
                                      <span className="text-micro uppercase tracking-wide text-ink-dimmer">
                                        {st.ordreSorts.buffsRetires}
                                      </span>
                                      <Selecteur
                                        taille="sm"
                                        pleineLargeur={false}
                                        value={String(atbChoisi[cle] ?? 0)}
                                        onChange={(e) => choisirAtb(cle, Number(e.target.value))}
                                        aria-label={st.ordreSorts.buffsRetiresAria(l.monster.name)}
                                      >
                                        {Array.from({ length: sortDeLaLigne.atbAuChoix.max + 1 }, (_, n) => (
                                          <option key={n} value={n}>
                                            {st.ordreSorts.optionRetrait(n, barre(n * sortDeLaLigne.atbAuChoix!.pas, textes))}
                                          </option>
                                        ))}
                                      </Selecteur>
                                    </label>
                                  )}
                                  {sortDeLaLigne?.atbAuChoix?.unite === 'pourcent' && (
                                    <label className="flex items-center gap-1.5">
                                      <span className="text-micro uppercase tracking-wide text-ink-dimmer">
                                        {st.ordreSorts.barreEquipe}
                                      </span>
                                      <NumberField
                                        value={atbChoisi[cle] ?? 0}
                                        onChange={(v) => choisirAtb(cle, v ?? 0)}
                                        min={0}
                                        max={sortDeLaLigne.atbAuChoix.max}
                                        step={5}
                                        suffix="%"
                                        ariaLabel={st.ordreSorts.barreEquipeAria(l.monster.name)}
                                      />
                                    </label>
                                  )}
                                  {/* ⚠️ Sa compétence lui REND son tour (Kroa) : il
                                      rejoue au même tick, et lance autre chose. */}
                                  {/* ⚠️ **UN TOUR DE PLUS**, sur la ligne du monstre
                                      concerné : la nouvelle ligne naît JUSTE EN
                                      DESSOUS, là où le tour se joue. Un « + » en
                                      pied de liste aurait demandé de rechoisir le
                                      monstre, puis de remonter la ligne à sa
                                      place — deux gestes pour un. */}
                                  <BoutonIcone
                                    taille="serre"
                                    onClick={() => ajouterOccurrence(cle)}
                                    libelle={st.ordreSorts.tourDePlus(l.monster.name)}
                                    icone={<Plus size={13} />}
                                  />
                                  {/* ⚠️ Seul un tour AJOUTÉ se retire. Le 1ᵉʳ n'est
                                      pas un ajout : c'est la présence du monstre
                                      dans l'ordre, et la retirer voudrait dire le
                                      sortir de l'équipe. */}
                                  {rang > 1 && (
                                    <BoutonIcone
                                      taille="serre"
                                      onClick={() => retirerOccurrence(cle)}
                                      libelle={st.ordreSorts.retirerTour(rang, l.monster.name)}
                                      icone={<X size={13} />}
                                    />
                                  )}
                                  {rang === 1 && sortActif(l)?.rejoue && (
                                    <span className="flex items-center gap-1.5">
                                      <span
                                        className="flex-none rounded border border-accent/50 px-1 text-micro font-bold uppercase tracking-wide text-accent"
                                        title={st.ordreSorts.rejoueAide}
                                      >
                                        {st.sort.rejoue}
                                      </span>
                                      <ChoixSort
                                        sorts={liste.filter((x) => x.nom !== sortActif(l)?.nom)}
                                        valeur={sortChoisi2[uid] ?? ''}
                                        onChoisir={(v) => choisirSecond(uid, v)}
                                        prefixe={st.ordreSorts.puis}
                                        nomMonstre={l.monster.name}
                                      />
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}
              </div>
              )}
            </section>

            {/* ⚠️ **L'analyse vient APRÈS l'ordre des sorts**, parce que c'est
                l'ordre de la CAUSE et de l'effet : on désigne ce que chacun
                lance, et le verdict en découle. Changer un sort est d'ailleurs
                le seul geste qui relance l'écriture des grilles. Lire le verdict
                d'abord obligeait à remonter pour comprendre d'où il sortait. */}
          <section className="min-w-[440px] flex-1 rounded-lg border border-border bg-panel">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-soft px-4 py-2.5">
                <span className="text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
                  {st.analyse.titre}
                </span>
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  {/* ⚠️ Une ACTION, pas un mode : l'analyse ÉCRIT dans les grilles
                      puis s'arrête. Un interrupteur laissait croire à une couche
                      qui tourne en fond et qui repasserait sur ce qu'on règle. */}
                  <Bouton
                    icone={<Play size={14} />}
                    libelle={auto ? st.analyse.relancer : st.analyse.analyser}
                    disabled={!aAllie}
                    title={!aAllie ? st.analyse.equipeVide : st.analyse.analyserAide}
                    onClick={analyser}
                  />
                </span>
              </div>
              <div className="px-4 py-3.5 space-y-3">
                {!auto ? null : !aAllie ? (
                  <p className="text-sm text-ink-dim">
                    {st.analyse.ajouterPourVerifier}
                  </p>
                ) : (
                  <>
                    {ordreVoulu.length > 0 && !sequence.ok ? (
                      <>
                        {/* ⚠️ **L'ordre respecté et l'équipe coupée sont DEUX
                            problèmes**, et le titre les confondait. Quand tous
                            les ennuis sont des `apres-adverse`, les alliés
                            jouent bel et bien dans l'ordre demandé — ils se font
                            simplement couper. Annoncer « tes vitesses ne
                            permettent pas de jouer dans l'ordre demandé »
                            envoyait alors corriger un ordre qui n'avait rien à
                            se reprocher, et laissait chercher longtemps. */}
                        <p className="flex items-center gap-2 text-sm font-semibold text-bad">
                          <Scissors size={16} className="flex-none" />
                          {sequence.problemes.every((p) => p.raison === 'apres-adverse')
                            ? st.analyse.coupee
                            : st.analyse.ordreImpossible}
                        </p>
                        <ul className="flex flex-col gap-y-1.5">
                          {ordreVoulu.map((cle) => {
                            // ⚠️ Le monstre se retrouve par la BASE de la clé :
                            // un tour supplémentaire (`allie:12#2`) n'a pas de
                            // ligne à lui. Chercher la clé nue rendait `null`, et
                            // le problème disparaissait sans un mot — un ordre
                            // impossible passait alors pour tenu.
                            const { id: uid, n: rang } = litOccurrence(cle);
                            const l = ligneParUid.get(uid);
                            if (!l) return null;
                            const p = problemeParUid.get(cle);
                            if (!p) return null;
                            const f = fenetreParUid.get(cle);
                            const cible = cibleFenetre(f);
                            const arte = cibleFenetre(fenetreArteParUid.get(cle));
                            const runes = cible != null ? runesPour(l, cible) : null;
                            const arteActuel = fenetreArteParUid.get(cle)?.combatActuel ?? 0;
                            // ⚠️ **Un tour qui n'a pas lieu ne se dit pas « trop
                            // lent ».** Le combo demandé ne se produit pas du
                            // tout : ce n'est pas un rang raté de peu, et
                            // envoyer corriger une vitesse serait un faux
                            // conseil.
                            // ⚠️ « se fait cut » plutôt que « est trop lent »
                            // pour un `apres-adverse` : le monstre peut très bien
                            // tenir son rang parmi les alliés — ce qu'il rate,
                            // c'est de passer avant l'adverse. Le même mot que
                            // l'autre branche (« pour ne pas se faire cut »),
                            // pour que le même défaut se dise pareil partout.
                            const verdict =
                              p.raison === 'nagit-pas'
                                ? rang > 1
                                  ? st.analyse.neJouePas(rang)
                                  : st.analyse.nAgitPas
                                : p.raison === 'apres-adverse'
                                  ? st.analyse.seFaitCouper
                                  : p.raison === 'trop-tot'
                                    ? st.analyse.tropRapide
                                    : st.analyse.tropLent;
                            const peutCalculer = runes != null || arte != null;
                            return (
                              <li key={cle} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                <MonsterAvatar monster={l.monster} size={22} element={false} />
                                <span className="font-semibold">
                                  {l.monster.name}
                                  {rang > 1 && <span className="ml-1 font-normal text-ink-dim">· {st.ordreSorts.tour(rang)}</span>}
                                </span>
                                <span className="text-ink-dim">{verdict}</span>
                                {peutCalculer && besoin(l, cible ?? null, arte ?? null, arteActuel)}
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : !chaine.ok ? (
                      <>
                        <p className="flex items-center gap-2 text-sm font-semibold text-bad">
                          <Scissors size={16} className="flex-none" />
                          {st.analyse.pasTune}
                        </p>
                        {/* ⚠️ On liste ce que le solveur DEMANDE, pas ce qui est
                            coupé — un monstre qui passe déjà peut recevoir une
                            demande (il achète un tick au suivant), un monstre coupé
                            peut n'en recevoir aucune (un autre le sauve). */}
                        <ul className="flex flex-col gap-y-1.5">
                          {requis.map((c) => {
                            const l = ligneParUid.get(c.id);
                            if (!l) return null;
                            const cible = c.combatRequis;
                            const a = arteParUid.get(c.id);
                            const arte = a?.artefactRequis ?? null;
                            return (
                              <li key={c.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                <MonsterAvatar monster={l.monster} size={22} element={false} />
                                <span className="font-semibold">{l.monster.name}</span>
                                <span className="text-ink-dim">{st.analyse.manque}</span>
                                {besoin(l, cible, arte, a?.artefactActuel ?? 0)}
                                <span className="text-ink-dim">{st.analyse.pourNePasCut}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : (
                      <p className="flex items-center gap-2 text-sm font-semibold text-good">
                        <Check size={16} className="flex-none" />
                        {st.analyse.tune}
                      </p>
                    )}
                  </>
                )}
              </div>
            </section>
            </div>

          {/* ⚠️ **À la SOURIS, l'ordre de tour vient ICI**, sous l'ordre des
              sorts et l'analyse, avant les tableaux (le mainteneur) : c'est la
              conclusion qu'on vient lire, pas un
              pied de page sous trois tableaux de 40 colonnes. */}
          {ordreDeTour('hidden lg:block')}

          {/* Barre d'action par tick (résultat, lecture seule) */}
          <TableauBarres
            lignesTableau={lignesTableau}
            ligneParUid={ligneParUid}
            numAction={numAction}
            refConteneur={enregistrer(0)}
            onScroll={synchro}
          />

          {/* Grille éditable : boost de barre d'attaque (ponctuel) */}
          <GrilleMod
            champ="atbMod"
            mode="nombre"
            titre={st.grilles.barreTitre}
            sousTitre={st.grilles.barreSousTitre}
            icone={<Zap size={15} />}
            lignes={lignesVisibles}
            aAllie={aAllie}
            aEnnemi={aEnnemi}
            onSet={setMod}
            onSetEquipe={setModEquipe}
            refConteneur={enregistrer(1)}
            onScrollSync={synchro}
          />

          {/* Grille éditable : buff de vitesse (soutenu à partir du tick) */}
          <GrilleMod
            champ="speedMod"
            mode="buff"
            titre={st.grilles.buffTitre}
            sousTitre={st.grilles.buffSousTitre}
            icone={<Gauge size={15} />}
            lignes={lignesVisibles}
            aAllie={aAllie}
            aEnnemi={aEnnemi}
            onSet={setMod}
            onSetEquipe={setModEquipe}
            refConteneur={enregistrer(2)}
            onScrollSync={synchro}
          />

          {/* Ordre de tour — au doigt, tout en bas ; à la souris, plus haut. */}
          {ordreDeTour('lg:hidden')}
        </>
      )}
      {aConfirmer && appliquer && (
        <ConfirmDialog
          titre={st.camp.verdictDifferent.titre}
          message={st.camp.verdictDifferent.message}
          libelleAction={st.camp.verdictDifferent.action}
          onConfirm={() => {
            const plan = aConfirmer;
            setAConfirmer(null);
            appliquer.onAppliquer(plan);
          }}
          onCancel={() => setAConfirmer(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Camp ---- */

interface CampProps {
  camp: Camp;
  titre: string;
  icone: React.ReactNode;
  lead: LeadInfo | null;
  onLead: (v: LeadInfo | null) => void;
  lignes: Ligne[];
  jouables: Monster[];
  combatDe: (l: Ligne) => number | null;
  onAjouter: (id: string) => void;
  onRetirer: (uid: string) => void;
  onMasquer: (uid: string) => void;
  onCopier: (uid: string) => void;
  onDeplacer: (uid: string, sens: -1 | 1) => void;
  onRuneSpeed: (uid: string, v: number | null) => void;
  onSwift: (uid: string) => void;
  onCumuls: (uid: string, v: number | null) => void;
  onPassif: (uid: string) => void;
  passifActifDe: (l: Ligne) => boolean;
  // Le passif de vitesse d'une ligne, et ce qu'il ajoute — lus par le parent,
  // qui seul connaît l'état de l'analyse.
  passifDe: (l: Ligne) => PassifVitesse | null;
  gainPassifDe: (l: Ligne) => number;
  // Ce que le kit de chaque monstre pose (par com2usId) : sert à dire d'OÙ vient
  // la valeur pré-remplie.
  kits: Map<number, KitVitesse>;
  // Saisie « bonus d'artéfact au buff de vitesse », dans les DEUX camps.
  //
  // ⚠️ Il fut un temps réservé aux alliés (« on ne connaît pas les artéfacts
  // d'en face ») : ça ne tient plus, puisqu'un deck importé ou l'adversaire de
  // référence y POSENT une valeur lue sur nos propres artéfacts. Un chiffre qui
  // compte dans le calcul doit se voir et se corriger là où il est.
  onArtefact: (uid: string, v: number | null) => void;
  // Le bouton d'import d'un deck de siège, dans les DEUX camps : on reprend sa
  // propre compo d'un côté, la défense qu'on affronte de l'autre.
  decks?: DeckDispo[];
  onImporterDeck?: (team: SiegeTeam) => void;
  onExporterOptimizer?: () => void;
  raisonExportOptimizer?: string;
  // Ouvert depuis l'Optimizer : « Appliquer à l'équipe » remplace l'export.
  appliquer?: { onClick: () => void; raison?: string; refus: string | null; perteOrigine: boolean };
}

function CampPanneau({
  camp,
  titre,
  icone,
  lead,
  onLead,
  lignes,
  jouables,
  combatDe,
  onAjouter,
  onRetirer,
  onMasquer,
  onCopier,
  onDeplacer,
  onRuneSpeed,
  onSwift,
  onCumuls,
  onPassif,
  passifDe,
  passifActifDe,
  gainPassifDe,
  kits,
  onArtefact,
  decks,
  onImporterDeck,
  onExporterOptimizer,
  raisonExportOptimizer,
  appliquer,
}: CampProps) {
  const textes = useTraduction();
  const jeu = textes.jeu;
  const c = textes.speedTuning.camp;
  const adv = camp === 'ennemi';
  const dejaAjoutes = useMemo(() => new Set(lignes.map((l) => String(l.monster.id))), [lignes]);

  // ⚠️ **Tous les leads du jeu**, lus dans les données (`leadsDeVitesse`) et non
  // dans une liste écrite à la main : le jeu a des +10, +15, +16, +17, et des
  // leads d'ÉLÉMENT à +23 et +30 qu'aucun pourcentage seul ne sait dire.
  // Choisir le lead qu'on a vraiment ne doit pas dépendre de ce qu'on a pensé à
  // recopier.
  const leads = useMemo(() => leadsDeVitesse(jouables), [jouables]);
  // Un lead importé d'un deck figure forcément dans la liste (elle vient des
  // mêmes données) — mais on ne PARIE pas là-dessus : une valeur absente du menu
  // s'y afficherait vide, sans que rien ne dise pourquoi.
  const cleDe = (l: LeadInfo | null) => (l ? `${l.amount}|${l.element ?? ''}` : '');
  const tous = useMemo(
    () => (lead && !leads.some((l) => cleDe(l) === cleDe(lead)) ? [...leads, lead] : leads),
    [leads, lead]
  );

  return (
    // ⚠️ **Le contour REMPLACE celui du panneau, il ne s'y ajoute pas** : un
    // cadre de camp par-dessus le cadre neutre ferait deux contours
    // concentriques, ce que la charte interdit. Même règle pour le bandeau, qui
    // teinte une bande existante au lieu d'en ajouter une.
    <section
      className={`min-w-[280px] flex-1 rounded-lg border bg-panel max-lg:min-w-0 ${
        adv ? 'border-bad/45' : 'border-good/45'
      }`}
    >
      <div
        // ⚠️ `rounded-t-lg-inner` : le fond du bandeau débordait dans l'arrondi
        // du panneau et lui redonnait des coins carrés. Le rayon intérieur vaut
        // celui du panneau MOINS son contour d'un pixel (voir tailwind.config).
        // ⚠️ `flex-wrap` aux deux formats : au téléphone, sur un écran étroit,
        // le lead passe sous le titre au lieu de déborder de la carte.
        className={`flex flex-wrap items-center gap-2 rounded-t-lg-inner border-b px-3.5 py-2.5 ${
          adv ? 'border-bad/30 bg-bad-soft' : 'border-good/30 bg-good-soft'
        }`}
      >
        {/* ⚠️ **À la SOURIS, le titre prend TOUTE sa ligne** (`lg:w-full`),
            lead et import passent dessous, calés à droite — dans les DEUX
            camps. Laissé au hasard de la largeur, « Ton équipe » (plus long
            qu'« En face ») renvoyait ses réglages à la ligne et pas l'autre :
            deux cartes voisines rendues différemment (le mainteneur : « il faut que
            le rendu soit le même »). Une seule ligne ne tient pas : la
            pastille d'un lead posé l'élargit encore. */}
        <span className={`flex items-center gap-1.5 text-sm font-bold lg:w-full ${adv ? 'text-bad' : 'text-ink'}`}>
          <span className={adv ? 'text-bad' : 'text-good'}>{icone}</span>
          {titre}
        </span>
        <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          <span className="text-micro font-semibold uppercase tracking-wide text-ink-dimmer">{c.lead}</span>
          {/* ⚠️ **Un lead d'ÉLÉMENT s'affiche ICI, pas sur chaque monstre.** Le
              sélecteur n'a qu'une valeur : il ne sait pas dire « +33 % pour les
              alliés Eau seulement ». Il cède donc sa place — deux contrôles de
              lead côte à côte laisseraient croire qu'ils s'additionnent. Le
              calcul, lui, passe par le lead que chaque monstre porte. */}
          {/* ⚠️ **La MÊME pastille que dans les decks** (`LeadPill`) : icône
              officielle du jeu, montant, icône d'élément. En redessiner une ici
              aurait donné deux façons d'afficher un lead dans la même app, pour
              la même donnée. Elle ne s'affiche que s'il y a un lead — un
              emplacement vide n'apprend rien. */}
          {lead && <LeadPill ls={{ stat: 'Attack Speed', ...lead }} />}
          {/* ⚠️ **UN seul menu.** Un lead est une chose — « +23 % alliés Eau »
              n'est pas « +23 % » plus « Eau » : séparer le montant de la portée
              laissait composer des leads qui n'existent pas dans le jeu. Les
              deux groupes suffisent à s'y retrouver. */}
          <Selecteur
            taille="sm"
            pleineLargeur={false}
            value={cleDe(lead)}
            onChange={(e) => onLead(tous.find((l) => cleDe(l) === e.target.value) ?? null)}
            aria-label={c.leadAria(titre)}
          >
            <option value="">{c.sansLead}</option>
            <optgroup label={c.tousAllies}>
              {tous
                .filter((l) => !l.element)
                .map((l) => (
                  <option key={cleDe(l)} value={cleDe(l)}>
                    +{l.amount}%
                  </option>
                ))}
            </optgroup>
            <optgroup label={c.parElement}>
              {tous
                .filter((l) => l.element)
                .map((l) => (
                  <option key={cleDe(l)} value={cleDe(l)}>
                    +{l.amount}% · {l.element ? nomElement(jeu, l.element) : '—'}
                  </option>
                ))}
            </optgroup>
          </Selecteur>
          {/* ⚠️ **À la SOURIS, l'import du camp vit ICI**, à côté du lead
              (le mainteneur) : dans l'en-tête de la carte qu'il
              remplace, on voit sans lire quel camp il touche. Au doigt, il
              reste sous la recherche. */}
          {decks && onImporterDeck && (
            <span className="hidden lg:block">
              <ImportDeck decks={decks} onImporter={onImporterDeck} adv={adv} enTete />
            </span>
          )}
        </span>
      </div>

      {lignes.length > 0 && (
        <div className="space-y-2 p-2.5 pb-0">
          {lignes.map((l, index) => {
            const combat = combatDe(l);
            const masque = l.masque;
            // ⚠️ Ce que le monstre pose sur son camp (barre d'attaque, buff de
            // vitesse) ne se SAISIT PAS : c'est lu dans son kit. La card ne
            // montre que ce qui reste à décider — vitesse de runes et artéfact —
            // plus l'avertissement de skill-up quand le chiffre le suppose.
            const kit = (l.monster.com2usId != null ? kits.get(l.monster.com2usId) : null) ?? KIT_VIDE;
            const passif = passifDe(l);
            const passifActif = passifActifDe(l);
            const gainPassif = gainPassifDe(l);
            return (
              <div
                key={l.uid}
                // ⚠️ **Le rembourrage droit RÉSERVE la place de la rangée de
                // boutons**, qui est en `absolute` : c'est lui, et lui seul, qui
                // empêche les icônes de recouvrir la vitesse de combat alignée à
                // droite. Cinq boutons `serre` de 20 px avec `gap-0.5` font
                // 108 px, plus les 4 px de `right-1` : 112, soit `pr-28`. Il
                // valait `pr-24` (96) du temps où ils étaient quatre — ajouter
                // le bouton « copier » sans toucher à cette valeur les faisait
                // mordre sur le nombre.
                className="relative rounded-lg border border-border bg-panel2 px-3 py-2 pr-28"
              >
                {/* Cluster en haut à droite de la card : monter/descendre,
                    masquer, supprimer — la croix à sa place habituelle dans
                    l'app.
                    ⚠️ **L'ordre de l'équipe n'est pas décoratif** : deux monstres
                    à la même vitesse de combat sont départagés par leur place
                    dans la liste, le premier joue le premier. C'est le levier
                    qu'on cherche quand un tune fait finir deux monstres à la même
                    vitesse.
                    ⚠️ Les flèches restent AFFICHÉES aux extrémités, désactivées :
                    un bouton qui disparaît selon les données fait sauter le
                    cluster d'une card à l'autre. */}
                <div className="absolute right-1 top-1 flex items-center gap-0.5">
                  <BoutonIcone
                    taille="serre"
                    disabled={index === 0}
                    onClick={() => onDeplacer(l.uid, -1)}
                    libelle={
                      index === 0
                        ? c.dejaPremier(l.monster.name)
                        : c.monter(l.monster.name)
                    }
                    icone={<ChevronUp size={13} />}
                  />
                  <BoutonIcone
                    taille="serre"
                    disabled={index === lignes.length - 1}
                    onClick={() => onDeplacer(l.uid, 1)}
                    libelle={
                      index === lignes.length - 1
                        ? c.dejaDernier(l.monster.name)
                        : c.descendre(l.monster.name)
                    }
                    icone={<ChevronDown size={13} />}
                  />
                  <BoutonIcone
                    taille="serre"
                    actif={masque}
                    onClick={() => onMasquer(l.uid)}
                    libelle={masque ? c.afficher(l.monster.name) : c.masquer(l.monster.name)}
                    icone={masque ? <Eye size={13} /> : <EyeOff size={13} />}
                  />
                  {/* ⚠️ **Copier en face, pas déplacer** : le monstre reste dans
                      son camp. On se mesure à une copie de soi — « est-ce que je
                      passe devant un monstre aussi rapide que le mien ? » — et
                      le déplacer viderait l'équipe qu'on est en train de régler.
                      ⚠️ Le libellé nomme le camp d'ARRIVÉE : la même icône sert
                      des deux côtés, et « copier en face » depuis le camp adverse
                      voudrait dire l'inverse. */}
                  <BoutonIcone
                    taille="serre"
                    onClick={() => onCopier(l.uid)}
                    libelle={
                      l.camp === 'allie'
                        ? c.copierEnFace(l.monster.name)
                        : c.copierEquipe(l.monster.name)
                    }
                    icone={<CopyPlus size={13} />}
                  />
                  <BoutonIcone
                    taille="serre"
                    onClick={() => onRetirer(l.uid)}
                    libelle={c.retirer(l.monster.name)}
                    icone={<X size={13} />}
                    className="hoverable:text-bad"
                  />
                </div>

                <div className={masque ? 'opacity-45' : ''}>
                  {/* ⚠️ **UNE SEULE RANGÉE**, portrait compris. Le nom et les
                      trois réglages tenaient sur deux lignes empilées alors que
                      la card est large : l'en-tête laissait toute sa droite vide
                      et coûtait 44 px par monstre, soit une ligne du tableau de
                      ticks par card. `flex-wrap` rend l'empilement au format
                      étroit — le mobile retrouve exactement la mise en page
                      d'avant, il n'y perd rien.
                      ⚠️ `items-end` : tout s'aligne sur le BAS des champs. Les
                      libellés des réglages sont au-dessus de leur champ, le nom
                      n'en a pas — les aligner par le haut décalerait le nom d'une
                      ligne au-dessus du portrait. */}
                  <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <MonsterAvatar monster={l.monster} size={30} />
                      <div className="flex min-w-0 flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{l.monster.name}</span>
                          {l.reference && (
                            <span
                              className="flex-none rounded border border-border px-1 text-micro font-bold uppercase tracking-wide text-ink-dim"
                              title={c.referenceAide}
                            >
                              {c.reference}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-micro leading-tight text-ink-dim">
                          {c.base(l.monster.stats.speed ?? '—')}
                        </div>
                      </div>
                    </div>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-micro font-semibold uppercase tracking-wide text-ink-dimmer">{c.runes}</span>
                      <NumberField
                        value={l.runeSpeed}
                        onChange={(v) => onRuneSpeed(l.uid, v)}
                        min={0}
                        allowEmpty
                        width="w-12"
                        placeholder="+"
                        ariaLabel={c.runesAria(l.monster.name)}
                      />
                    </label>
                    {/* ⚠️ Set RAPIDITÉ : ses 25 % entrent dans la somme des
                        pourcentages alors que la « SPD runes » les porte déjà à
                        plat — d'où un point d'écart sur la vitesse de combat, et
                        un point suffit à rater un tick. */}
                    <label className="flex flex-col gap-0.5">
                      <span className="text-micro font-semibold uppercase tracking-wide text-ink-dimmer">
                        {c.set}
                      </span>
                      {/* ⚠️ **L'ICÔNE DU SET, pas le mot.** C'est comme ça qu'un
                          joueur reconnaît Rapidité — instantanément, comme dans
                          le jeu et comme partout ailleurs dans l'app (filtre de
                          sets, choix de combo). Le mot « Swift » demandait de
                          lire là où un dessin suffit, et prenait trois fois la
                          largeur sur une rangée qu'on cherche justement à
                          resserrer. Le libellé de la colonne (« Set ») reste
                          au-dessus, et l'infobulle dit ce que ça change. */}
                      <Bouton
                        taille="sm"
                        actif={!!l.swift}
                        onClick={() => onSwift(l.uid)}
                        icone={<RuneIcon setKey="swift" size={16} filter={runeSetIconFilter(!!l.swift)} />}
                        aria-label={c.setAria(l.monster.name)}
                        title={c.setAide}
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span
                        className="text-micro font-semibold uppercase tracking-wide text-ink-dimmer"
                        title={c.artefactAide}
                      >
                        {c.artefact}
                      </span>
                      <NumberField
                        value={l.artefactBuff}
                        onChange={(v) => onArtefact(l.uid, v)}
                        min={0}
                        max={99}
                        allowEmpty
                        width="w-12"
                        placeholder="+%"
                        ariaLabel={c.artefactAria(l.monster.name)}
                      />
                    </label>
                    {/* ⚠️ La vitesse de combat est le CHIFFRE de la card : elle
                        garde sa taille et sa place à droite. On gagne de la
                        hauteur en resserrant ce qui l'entoure, pas en rendant
                        illisible ce qu'on vient lire. */}
                    <div className="ml-auto text-right">
                      <div className={`font-mono text-lg font-black leading-none ${adv ? 'text-bad' : 'text-ink'}`}>
                        {combat ?? '—'}
                      </div>
                      <div className="text-micro uppercase tracking-wide text-ink-dimmer">{c.combat}</div>
                    </div>
                  </div>

                  {/* Passif de vitesse — une RANGÉE à part, sous les réglages :
                      c'est une propriété du monstre, pas une saisie de plus.
                      ⚠️ Le bouton est TOUJOURS là dès qu'un passif touche la
                      vitesse : on doit pouvoir l'appliquer, ou l'écarter pour
                      voir ce que vaut le tune sans lui. */}
                  {passif && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded border border-border-soft bg-panel px-2 py-1">
                      <Bouton
                        taille="sm"
                        icone={<Zap size={12} />}
                        libelle={c.passif}
                        actif={(!!passif.gain || !!passif.amplifieBuff) && passifActif}
                        disabled={!passif.gain && !passif.amplifieBuff}
                        title={
                          passif.gain
                            ? `${passif.nom} — ${passif.texte}`
                            : c.passifSansValeur(passif.nom, passif.texte)
                        }
                        onClick={() => onPassif(l.uid)}
                      />
                      {passif.amplifieBuff && (
                        <span className="font-mono text-micro text-ink-dim">
                          {c.amplifieBuff(passif.amplifieBuff.valeur, !!passif.amplifieBuff.equipe)}
                        </span>
                      )}
                      {passif.gain ? (
                        <>
                          <span className="font-mono text-micro text-ink-dim">
                            +{passif.gain.valeur}
                            {passif.gain.pourcent ? ' %' : ''}
                            {passif.gain.parCumul ? ' ×' : ''}
                          </span>
                          {passif.gain.parCumul && passifActif && (
                            <NumberField
                              value={l.cumulsPassif ?? null}
                              onChange={(v) => onCumuls(l.uid, v)}
                              min={0}
                              max={99}
                              allowEmpty
                              width="w-12"
                              placeholder="0"
                              ariaLabel={c.cumulsAria(l.monster.name)}
                            />
                          )}
                          <span
                            className={`ml-auto font-mono text-micro font-bold ${
                              gainPassif > 0 ? 'text-accent' : 'text-ink-dimmer'
                            }`}
                          >
                            {gainPassif > 0 ? c.gainVit(gainPassif) : '—'}
                          </span>
                        </>
                      ) : passif.amplifieBuff ? null : (
                        <span className="min-w-0 flex-1 text-micro leading-snug text-warn">
                          {c.valeurInconnue}
                        </span>
                      )}
                    </div>
                  )}

                  {/* ⚠️ Le gain de barre retenu suppose la compétence MONTÉE
                      (Tailwind de Bernard : 30 % au niveau 1, 34,5 % maxé). On le
                      dit à l'écran : autrement on règle sa vitesse sur un gain
                      qu'on n'a pas encore. */}
                  {kit.atbSkillUp > 0 && (
                    <p className="mt-1.5 text-micro leading-snug text-warn">
                      {c.skillUp(
                        kit.atbCompetence,
                        barre(kit.atb, textes),
                        barre(kit.atbSkillUp, textes),
                        barre(kit.atbNiveau1, textes)
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2 p-2.5">
        <RechercheMonstre
          monsters={jouables}
          dejaAjoutes={dejaAjoutes}
          onAdd={onAjouter}
          placeholder={adv ? c.ajouterAdverse : c.ajouterEquipe}
        />
        {decks && onImporterDeck && (
          <div className="lg:hidden">
            <ImportDeck decks={decks} onImporter={onImporterDeck} adv={adv} />
          </div>
        )}
        {onExporterOptimizer && (
          <Bouton pleineLargeur icone={<IconeOptimizer size={14} />} libelle={c.exporter}
            disabled={!!raisonExportOptimizer} title={raisonExportOptimizer ?? c.exporterAide}
            onClick={onExporterOptimizer} />
        )}
        {appliquer && (
          <>
            {appliquer.perteOrigine && <p className="text-xs text-ink-dim">{c.perteOrigine}</p>}
            <Bouton pleineLargeur ton="accent" fond="doux" icone={<Check size={14} />} libelle={c.appliquer}
              disabled={!!appliquer.raison} title={appliquer.raison ?? c.appliquerAide}
              onClick={appliquer.onClick} />
            {appliquer.raison && <p className="text-xs text-ink-dim">{appliquer.raison}</p>}
            {appliquer.refus && <p role="alert" className="text-xs text-bad">{appliquer.refus}</p>}
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------- Grille de mods -- */

interface GrilleModProps {
  champ: ChampMod;
  // 'nombre' : cellule NumberField (boost d'ATB, valeurs variables).
  // 'buff'   : cellule cliquable qui pose/retire un buff de vitesse (+30 %).
  mode: 'nombre' | 'buff';
  titre: string;
  sousTitre: string;
  icone: React.ReactNode;
  lignes: Ligne[];
  aAllie: boolean;
  aEnnemi: boolean;
  onSet: (champ: ChampMod, uid: string, tick: number, v: number | null) => void;
  onSetEquipe: (champ: ChampMod, camp: Camp, tick: number, v: number | null) => void;
  refConteneur: (el: HTMLDivElement | null) => void;
  onScrollSync: (e: React.UIEvent<HTMLDivElement>) => void;
}

// Grille éditable au MÊME rendu que la barre d'action : lignes = monstres,
// colonnes = ticks. Chaque camp présent ouvre sur une ligne « Toute l'équipe »
// qui écrit la même valeur sur tous ses monstres au tick visé.
function GrilleMod({
  champ,
  mode,
  titre,
  sousTitre,
  icone,
  lignes,
  aAllie,
  aEnnemi,
  onSet,
  onSetEquipe,
  refConteneur,
  onScrollSync,
}: GrilleModProps) {
  const st = useTraduction().speedTuning;
  // Valeur commune d'un camp à un tick (pour la ligne « Toute l'équipe ») :
  // la valeur partagée si tous l'ont, sinon null (mélange).
  const valeurEquipe = (camp: Camp, tick: number): number | null => {
    // ⚠️ `undefined` (case vide, la compétence décide) et `0` (compétence
    // annulée) sont DEUX états distincts : les confondre effaçait l'annulation.
    const vals = lignes.filter((l) => l.camp === camp).map((l) => l[champ][tick]);
    if (vals.length === 0) return null;
    return vals.every((v) => v === vals[0]) ? (vals[0] ?? null) : null;
  };

  const camps: { camp: Camp; label: string; present: boolean }[] = [
    { camp: 'allie', label: st.grilles.touteEquipe, present: aAllie },
    { camp: 'ennemi', label: st.grilles.toutEnFace, present: aEnnemi },
  ];

  // Une cellule. Boost d'ATB : simple champ numérique. Buff de vitesse : le
  // raccourci (icône SPD, pose/retire +30 % d'un clic) ET le champ pour saisir
  // une autre valeur (33 %, un ralenti −30 %…).
  const cellule = (value: number | null, onChange: (v: number | null) => void, aria: string) =>
    mode === 'buff' ? (
      <div className="mx-auto flex w-[86px] items-center gap-1">
        <BoutonIcone
          cadre
          actif={!!value}
          onClick={() => onChange(value ? null : BUFF_SPD)}
          libelle={st.grilles.buffClic(aria)}
          icone={
            <img src={SPD_ICON} alt="" width={13} height={13} className={value ? '' : 'opacity-40'} />
          }
        />
        <NumberField
          sansBoutons
          value={value}
          onChange={onChange}
          allowEmpty
          boxWidth="w-14"
          suffix="%"
          placeholder="·"
          // Un buff est un gain, un ralenti une perte : même lecture que la
          // grille des barres.
          ton={value == null || value === 0 ? 'neutre' : value > 0 ? 'good' : 'bad'}
          ariaLabel={st.grilles.valeur(aria)}
        />
      </div>
    ) : (
      // Boost d'ATB : positif pour remplir, négatif pour vider (la barre ne
      // descend jamais sous 0, garanti par la simulation). De −999 à +100 %.
      //
      // ⚠️ La cellule porte le TON de sa valeur : une grille mêle des gains et
      // des pertes, et le signe seul — en mono 12 px, au milieu de quarante
      // colonnes — ne saute pas aux yeux.
      <NumberField
        sansBoutons
        value={value}
        onChange={onChange}
        allowEmpty
        min={-999}
        max={100}
        // ⚠️ Élargi d'un cran avec le suffixe : « −100 % » doit tenir sans que
        // le champ ne rétrécisse le chiffre. La colonne fait 92 px, on y est.
        boxWidth="w-16"
        suffix="%"
        placeholder="·"
        ton={value == null || value === 0 ? 'neutre' : value > 0 ? 'good' : 'bad'}
        ariaLabel={aria}
      />
    );

  return (
    <section className="rounded-lg border border-border bg-panel">
      <div className="flex items-center gap-2 border-b border-border-soft px-4 py-2.5">
        <span className="text-accent">{icone}</span>
        <span className="text-micro font-semibold uppercase tracking-wider text-ink-dimmer">{titre}</span>
        <span className="text-xs font-normal text-ink-dimmer">· {sousTitre}</span>
      </div>
      {/* ⚠️ Même arrondi intérieur qu'en haut du panneau : la colonne des noms a
          un fond SOLIDE et c'est elle qui touche le coin bas-gauche de la card.
          Sans ça, le coin redevient carré sous l'arrondi du contour. */}
      <div
        className="overflow-x-auto rounded-b-lg-inner"
        ref={refConteneur}
        onScroll={onScrollSync}
      >
        <table
          className="table-fixed border-collapse [font-variant-numeric:tabular-nums]"
          style={{ width: LARGEUR_TABLE }}
        >
          <Colonnes />
          <TeteTicks premiere={st.grilles.cible} />
          <tbody>
            {camps.map(({ camp, label, present }) => {
              if (!present) return null;
              const adv = camp === 'ennemi';
              const monstres = lignes.filter((l) => l.camp === camp);
              return (
                <FragmentCamp key={camp}>
                  {/* Ligne équipe */}
                  <tr className="border-b border-border-soft bg-panel2/40">
                    <th
                      className={`sticky left-0 z-[2] border-r border-border-soft px-3 py-1.5 text-left ${
                        adv ? 'bg-bad-soft' : 'bg-good-soft'
                      }`}
                    >
                      <span className={`flex items-center gap-1.5 text-xs font-bold ${adv ? 'text-bad' : 'text-good'}`}>
                        <span className={`h-2 w-2 rounded-full ${adv ? 'bg-bad' : 'bg-good'}`} />
                        {label}
                      </span>
                    </th>
                    {TICKS.map((t) => (
                      <td key={t} className="py-1 text-center">
                        {cellule(
                          valeurEquipe(camp, t),
                          (v) => onSetEquipe(champ, camp, t, v),
                          `${label} — ${st.tick(t)}`
                        )}
                      </td>
                    ))}
                  </tr>
                  {/* Lignes monstres */}
                  {monstres.map((l) => (
                    <tr key={l.uid} className="border-b border-border-soft">
                      {/* Même repère que dans le tableau des barres : la colonne
                          collante dit à quel camp la ligne appartient. */}
                      <th
                        className={`sticky left-0 z-[2] border-r border-border-soft px-3 py-1.5 text-left font-normal ${
                          adv ? 'bg-bad-soft' : 'bg-good-soft'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <MonsterAvatar monster={l.monster} size={22} element={false} />
                          <span className="text-sm">{l.monster.name}</span>
                        </span>
                      </th>
                      {TICKS.map((t) => (
                        <td key={t} className="py-1 text-center">
                          {cellule(
                            l[champ][t] ?? null,
                            (v) => onSet(champ, l.uid, t, v),
                            `${l.monster.name} — ${st.tick(t)}`
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </FragmentCamp>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Regroupe la ligne équipe et ses monstres sans nœud DOM (un <tbody> par camp
// romprait la grille visuelle).
function FragmentCamp({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* ------------------------------------------------------- Choix du sort --- */

// Choisir le sort qu'un monstre lance, AVEC son icône — un joueur reconnaît une
// compétence à son icône avant d'en lire le nom.
//
// ⚠️ Pas un `Selecteur` : un `<select>` natif ne montre que du texte. D'où la
// même grammaire que l'import de deck (Bouton + Flottant + `Option`), qui est
// déjà celle de l'app pour une liste ancrée à ce qui l'ouvre.
function ChoixSort({
  sorts,
  valeur,
  onChoisir,
  prefixe,
  nomMonstre,
}: {
  sorts: SortVitesse[];
  // '' = aucun sort, sinon le nom du sort lancé.
  valeur: string;
  onChoisir: (v: string) => void;
  prefixe?: string;
  nomMonstre: string;
}) {
  const textes = useTraduction();
  const cs = textes.speedTuning.choixSort;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const choisi = valeur === '' ? null : (sorts.find((x) => x.nom === valeur) ?? null);
  // ⚠️ « Sort détecté » ne veut rien dire quand RIEN n'a été détecté : ce qui
  // compte, c'est ce que le monstre lance — et il ne lance rien.
  const libelle = choisi?.nom ?? cs.aucun;

  const icone = (x: SortVitesse | null, taille: number) =>
    x?.icone ? (
      <img src={x.icone} alt="" width={taille} height={taille} className="rounded-sm" loading="lazy" />
    ) : (
      <Sparkles size={taille} className="text-ink-dimmer" />
    );

  return (
    <div ref={ref} className="relative">
      <Bouton
        taille="sm"
        icone={icone(choisi, 16)}
        libelle={`${prefixe ?? ''}${libelle}`}
        aria-expanded={open}
        title={choisi ? libelleSort(choisi, textes) : cs.lancePar(nomMonstre)}
        onClick={() => setOpen((v) => !v)}
      />
      {/* ⚠️ **FlottantAuto**, pas `Flottant` : ce menu est ancré à un bouton qui
          se promène dans une rangée — au bout d'une ligne, un flottant posé
          toujours du même côté sortait de la page par la droite. Celui-ci mesure
          la place autour de son ancre et choisit son côté. */}
      <FlottantAuto
        ouvert={open}
        ancre={ref}
        largeur={290}
        hauteur={320}
        rembourrage="aucun"
        className="max-h-[320px] overflow-y-auto"
      >
        <div role="listbox" aria-label={cs.lancePar(nomMonstre)}>
          {/* ⚠️ Des RANGÉES à plat, pas des cartes : `Option` porte son propre
              cadre arrondi, fait pour un choix empilé dans un dialogue. Dans une
              surface flottante, l'app pose des rangées qui touchent les bords —
              même grammaire que l'import de deck et la recherche de monstre. */}
          <Rangee
            icone={<Sparkles size={22} className="text-ink-dimmer" />}
            titre={cs.aucun}
            detail={cs.aucunDetail}
            actif={valeur === ''}
            onClick={() => {
              onChoisir('');
              setOpen(false);
            }}
          />
          {sorts.map((x) => (
            <Rangee
              key={x.nom}
              icone={icone(x, 22)}
              titre={`${x.slot ? `S${x.slot} · ` : ''}${x.nom}`}
              detail={libelleSort(x, textes).split(' — ')[1]}
              actif={valeur === x.nom}
              onClick={() => {
                onChoisir(x.nom);
                setOpen(false);
              }}
            />
          ))}
        </div>
      </FlottantAuto>
    </div>
  );
}

/* ------------------------------------------------------- Import deck ----- */

// Une rangée de liste flottante : icône, titre, et ce que ça fait en dessous.
// Sans cadre ni coins arrondis — c'est la surface flottante qui porte la forme,
// les rangées la remplissent bord à bord.
function Rangee({
  icone,
  titre,
  detail,
  actif,
  onClick,
}: {
  icone: React.ReactNode;
  titre: string;
  detail?: string;
  actif?: boolean;
  onClick: () => void;
}) {
  return (
    <ZoneCliquable
      role="option"
      aria-selected={actif}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 border-b border-border-soft px-3 py-2 text-left last:border-b-0 hoverable:bg-accent-soft ${
        actif ? 'bg-accent-soft' : ''
      }`}
    >
      <span className="flex-none">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${actif ? 'font-semibold text-accent' : 'font-medium'}`}>
          {titre}
        </span>
        {detail && <span className="block truncate text-micro text-ink-dim">{detail}</span>}
      </span>
    </ZoneCliquable>
  );
}

// Reprendre une équipe de siège telle quelle plutôt que de retaper trois
// monstres et trois vitesses de runes. Le bouton reste TOUJOURS affiché, même
// sans compte chargé : désactivé, il dit que la possibilité existe (voir
// docs/03-developpeur/interface/).
function ImportDeck({
  decks,
  onImporter,
  adv,
  enTete = false,
}: {
  decks: DeckDispo[];
  onImporter: (team: SiegeTeam) => void;
  adv: boolean;
  // Posé dans l'en-tête du camp (à la souris) : bouton compact,
  // liste calée à DROITE — le bouton est au bord droit de la carte, une liste
  // calée à gauche déborderait de l'écran.
  enTete?: boolean;
}) {
  const d = useTraduction().speedTuning.importDeck;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Fermeture au clic ailleurs et à Échap — même patron que les autres
  // flottants de l'app (DesyncBadge, SettingsMenu).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const vide = decks.length === 0;

  return (
    <div ref={ref} className="relative">
      <Bouton
        pleineLargeur={!enTete}
        taille={enTete ? 'sm' : 'md'}
        icone={<Download size={14} />}
        libelle={d.libelle}
        disabled={vide}
        title={vide ? d.vide : adv ? d.aideAdverse : d.aideEquipe}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && !vide && (
        <Flottant
          rembourrage="aucun"
          cote={enTete ? 'droite' : 'gauche'}
          largeur={enTete ? 'w-80' : 'w-full'}
          className="max-h-[320px] overflow-y-auto"
          role="listbox"
          aria-label={d.liste}
        >
          {decks.map((deck, i) => {
            const nouvelleSource = i === 0 || decks[i - 1].source !== deck.source;
            return (
              <div key={deck.cle}>
                {nouvelleSource && (
                  <div className="border-b border-border-soft bg-panel2 px-3 py-1.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
                    {d.sources[deck.source]}
                  </div>
                )}
                <ZoneCliquable
                  role="option"
                  onClick={() => {
                    onImporter(deck.team);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hoverable:bg-accent-soft"
                >
                  <span className="flex flex-none items-center gap-1">
                    {deck.monstres.map((m, j) => (
                      <MonsterAvatar key={`${m.id}-${j}`} monster={m} size={26} element={false} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{deck.libelle}</span>
                  <Plus size={14} className="flex-none text-ink-dim" />
                </ZoneCliquable>
              </div>
            );
          })}
        </Flottant>
      )}
    </div>
  );
}

/* ------------------------------------------------------- Recherche ------- */

const MAX_RESULTS = 25;

// Combobox d'ajout — même grammaire que RtaSearch/MonsterGearPicker
// (Champ + Flottant + useComboboxNav), voir docs/02-app/transverse/.
function RechercheMonstre({
  monsters,
  dejaAjoutes,
  onAdd,
  placeholder,
}: {
  monsters: Monster[];
  dejaAjoutes: Set<string>;
  onAdd: (id: string) => void;
  placeholder: string;
}) {
  const r = useTraduction().speedTuning.recherche;
  const [query, setQuery] = useState('');
  const idBase = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Monster[] = [];
    for (const m of monsters) {
      if (m.name.toLowerCase().includes(q)) {
        out.push(m);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [monsters, query]);

  const nav = useComboboxNav<Monster>({
    results,
    query,
    setQuery,
    idBase,
    estDesactive: (m) => dejaAjoutes.has(String(m.id)),
    onValider: (m) => onAdd(String(m.id)),
  });

  return (
    <div className="relative">
      <Champ
        {...nav.inputProps}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        icone={<Search className="h-4 w-4" />}
      />
      {nav.open && (
        <Flottant
          {...nav.listProps}
          aria-label={r.resultats}
          rembourrage="aucun"
          className="max-h-[300px] overflow-y-auto"
        >
          {results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-ink-dim">{r.aucun}</div>
          ) : (
            results.map((m, i) => {
              const added = dejaAjoutes.has(String(m.id));
              const estActif = i === nav.actif;
              return (
                <div
                  key={m.id}
                  {...nav.optionProps(i)}
                  aria-disabled={added}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (added) return;
                    onAdd(String(m.id));
                    nav.reinitialiser();
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition ${
                    added ? 'cursor-default opacity-50' : 'cursor-pointer'
                  } ${estActif && !added ? 'bg-accent-soft' : ''}`}
                >
                  <MonsterAvatar monster={m} size={26} />
                  <span className="flex-1 truncate text-sm font-medium">{m.name}</span>
                  <span className="font-mono text-micro text-ink-dim">{r.vitesse(m.stats.speed ?? '—')}</span>
                  {!added && <Plus size={14} className={estActif ? 'text-accent' : 'text-ink-dim'} />}
                </div>
              );
            })
          )}
        </Flottant>
      )}
    </div>
  );
}
