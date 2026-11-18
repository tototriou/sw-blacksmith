import Segmented from '../../../ui/Segmented';
import { SLOT_FILTER_PRESETS, type SlotFilterPresetKey } from '../../../lib/runeBuildOptim';
import { formatBig } from '../../../lib/formatBig';
import HelpPopover from '../../HelpPopover';
import { Interrupteur } from '../../../ui';
import { type Dispatch, type SetStateAction, type RefObject, type ReactNode } from 'react';
import { SECTIONS } from './bureau/panneau';
import { useTraduction } from '../../../hooks/useLangue';

export interface ReglagesAvancesContenuProps {
  slotFilterPreset: SlotFilterPresetKey;
  handleSlotFilterPresetChange: (preset: SlotFilterPresetKey) => void;
  dansPanneau: boolean;
  estimate: { perSlot: number[]; product: number; } | null;
  exhaustiveSearch: boolean;
  setExhaustiveSearch: Dispatch<SetStateAction<boolean>>;
  diagnoseBlockingEnabled: boolean;
  setDiagnoseBlockingEnabled: Dispatch<SetStateAction<boolean>>;
  optimiserArtefacts: boolean;
  verifierToutesLesCombinaisons: boolean;
  setVerifierToutesLesCombinaisons: Dispatch<SetStateAction<boolean>>;
  simulerRunesMaxees: boolean;
  setSimulerRunesMaxees: Dispatch<SetStateAction<boolean>>;
  interrupteurResPrePanneauRef: RefObject<HTMLDivElement>;
  interrupteurResPreBureauRef: RefObject<HTMLDivElement>;
  attentionResPre: number | null;
  compterAurasResPre: boolean;
  setCompterAurasResPre: Dispatch<SetStateAction<boolean>>;
  // Dans la page de bureau : les sets d'aura des autres monstres se saisissent
  // dans la colonne « Aura, exclusion, avancés », plus dans « État de mon
  // monstre » (réduit aux buffs et au lead). Absent : le texte du téléphone.
  bureau?: boolean;
}

// Le libellé d'un interrupteur, son aide « ? » et l'interrupteur lui-même.
// ⚠️ **Au bureau, le « ? » est collé à l'interrupteur** : libellé à gauche,
// puis « ? » et interrupteur à droite, au même écart (12 px) dans toutes les
// rangées, pour que les « ? » s'alignent d'une rangée à l'autre, quelle que
// soit la longueur du libellé. Au téléphone, le « ? » suit le libellé, comme
// avant (`etire` : le libellé prend la place et passe à la ligne).
function LibelleEtAide({ bureau, etire = false, libelle, aide, interrupteur }: {
  bureau: boolean; etire?: boolean; libelle: string; aide: ReactNode; interrupteur: ReactNode;
}) {
  if (bureau) {
    return (
      <>
        <span className="min-w-0 flex-1 text-[11.5px] text-ink-dim">{libelle}</span>
        <span className="flex flex-none items-center gap-3">{aide}{interrupteur}</span>
      </>
    );
  }
  return (
    <>
      <div className={etire ? 'flex min-w-0 flex-1 items-center gap-1.5' : 'flex items-center gap-1.5'}>
        <span className={etire ? 'min-w-0 text-[11.5px] text-ink-dim' : 'text-[11.5px] text-ink-dim'}>{libelle}</span>
        {/* Le panneau autorise ses enfants flex à rétrécir : seule la légende
            cède de la place, jamais l'enveloppe du bouton d'aide de 28 px. */}
        <div className="flex-none">{aide}</div>
      </div>
      {etire ? <span className="flex-none">{interrupteur}</span> : interrupteur}
    </>
  );
}

export default function ReglagesAvancesContenu({ slotFilterPreset, handleSlotFilterPresetChange, dansPanneau, estimate, exhaustiveSearch, setExhaustiveSearch, diagnoseBlockingEnabled, setDiagnoseBlockingEnabled, optimiserArtefacts, verifierToutesLesCombinaisons, setVerifierToutesLesCombinaisons, simulerRunesMaxees, setSimulerRunesMaxees, interrupteurResPrePanneauRef, interrupteurResPreBureauRef, attentionResPre, compterAurasResPre, setCompterAurasResPre, bureau = false }: ReglagesAvancesContenuProps) {
  // ⚠️ **Au bureau, deux sections sans boîte**, empilées sous un trait fin
  // (`SECTIONS`, bureau/panneau.ts) : la colonne « Aura, exclusion, avancés »
  // est un panneau, et une boîte de plus y ferait la mosaïque que le trait
  // évite (docs/02-app/optimizer/ecran/README.md, « Panneaux et sections »).
  // À 314 px, la grille tenait déjà sur une colonne : rien ne change de place.
  const o = useTraduction().optimizer;
  const r = o.avances;
  const boite = bureau ? '' : 'rounded-lg border border-border-soft bg-panel2 px-2 py-1.5';
  return (
    <div className={bureau ? SECTIONS : 'grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3'}>
    {/* ⚠️ Mêmes classes de boîte que les trois groupes d'« État de mon
        monstre » (EtatMonstre.tsx) : deux façons de cadrer un groupe
        dans cet écran se liraient comme deux natures différentes. */}
    <div className={boite}>
      {/* « Profondeur de recherche » : le pré-filtrage par emplacement du
          moteur, nommé par ce qu'il change pour le joueur (décision de
          l'utilisateur). */}
      <p className="text-[11.5px] text-ink-dim mb-1">{r.profondeur}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          options={SLOT_FILTER_PRESETS.map((p) => ({ key: p.key, label: o.prereglages[p.key].libelle, hint: o.prereglages[p.key].aide }))}
          value={slotFilterPreset}
          onChange={handleSlotFilterPresetChange}
          // Dans le panneau « Options » : pleine largeur, comme les autres
          // contrôles du tiroir. En ligne au bureau : serré à son contenu.
          size={dansPanneau ? 'lg' : undefined}
          // Centrée dans sa carte au bureau (`mx-auto`, dans une rangée flex).
          className={dansPanneau ? '' : 'mx-auto w-fit'}
        />
        {dansPanneau && estimate && (
          <span className="text-micro text-ink-dim">
            {r.pool(formatBig(estimate.perSlot.reduce((a, b) => a + b, 0)))}
          </span>
        )}
      </div>
      <p className="mt-1 text-micro text-warn max-w-[280px]">
        ⚠️ {o.prereglages[slotFilterPreset].aide}
      </p>
    </div>

    {/* ⚠️ `divide-y` et non un `border-t` par interrupteur : un trait ne
        se pose qu'ENTRE deux voisins, jamais au-dessus du premier. Avec
        des bordures individuelles, le premier interrupteur portait un
        trait en tête de colonne — anodin quand tout était empilé sous le
        pré-filtrage, mais lu comme une ligne perdue une fois le groupe
        posé en colonne à côté. */}
    {/* Au bureau, le trait entre deux interrupteurs est celui des sections
        (`border-soft`) : plus appuyé, il dominerait le trait de section. */}
    <div className={`divide-y ${bureau ? 'divide-border-soft' : 'divide-border'} ${boite}`}>
      {/* « Simuler +15 et max meules/gemmes » : désactivé par défaut. Il
          change le pool de la recherche (`poolDeRecherche`, runesMaxees.ts),
          lu au clic sur « Rechercher » : un résultat affiché garde le pool
          de son lancement. En tête : rendu sans condition, rien au-dessus
          ne le décale. */}
      <div className="flex items-center justify-between gap-2 py-3 first:pt-0">
        <LibelleEtAide
          bureau={bureau}
          libelle={r.runesMaxees}
          interrupteur={
            <Interrupteur
              actif={simulerRunesMaxees}
              onChange={setSimulerRunesMaxees}
              aria-label={r.runesMaxees}
            />
          }
          aide={
          <HelpPopover title={r.runesMaxees}>
            {r.runesMaxeesAide.debut}<b className="text-ink">{r.runesMaxeesAide.niveau}</b>{r.runesMaxeesAide.meules}<b className="text-ink">{r.runesMaxeesAide.legendaire}</b>{r.runesMaxeesAide.fin}
            <br />
            <br />
            {r.runesMaxeesAide.couleur}
          </HelpPopover>
          }
        />
      </div>

      {/* Désactivé par défaut, lu par `handleSearch` au clic sur
          « Rechercher », jamais un bouton qui lance sa propre recherche. */}
      <div className="flex items-center justify-between gap-2 py-3">
        <LibelleEtAide
          bureau={bureau}
          libelle={r.exhaustif}
          interrupteur={
            <Interrupteur
              actif={exhaustiveSearch}
              onChange={setExhaustiveSearch}
              aria-label={r.exhaustif}
            />
          }
          aide={
          <HelpPopover title={r.exhaustif}>
            {r.exhaustifAide}<b className="text-ink">{r.exhaustifArreter}</b>{r.exhaustifAideFin}
          </HelpPopover>
          }
        />
      </div>

      <div className="flex items-center justify-between gap-2 py-3">
        <LibelleEtAide
          bureau={bureau}
          libelle={r.diagnostic}
          interrupteur={
            <Interrupteur
              actif={diagnoseBlockingEnabled}
              onChange={setDiagnoseBlockingEnabled}
              aria-label={r.diagnostic}
            />
          }
          aide={
          <HelpPopover title={r.diagnostic}>
            {r.diagnosticAide}<b className="text-ink">{r.diagnosticIndice}</b>.
          </HelpPopover>
          }
        />
      </div>

      {/* « Vérifier toutes les combinaisons trouvées » : désactivé par défaut, photographié au clic
          Rechercher dans le contexte du résultat, puis lu par la file
          (`cibleDeLaFile`) — il ne change pas la recherche de runes,
          seulement jusqu'où la file vérifie ; le changer après le lancement
          ne prépare que la prochaine recherche.
          MASQUÉ sans optimisation d'artéfacts : sans file, rien n'est
          vérifié, et une saisie sans effet est pire qu'une saisie
          absente. L'interrupteur qui le masque vit dans une autre
          carte : rien ne bouge sous le clic. */}
      {optimiserArtefacts && (
        <div className="flex items-center justify-between gap-2 py-3 last:pb-0">
          <LibelleEtAide
            bureau={bureau}
            libelle={r.toutVerifier}
            interrupteur={
              <Interrupteur
                actif={verifierToutesLesCombinaisons}
                onChange={setVerifierToutesLesCombinaisons}
                aria-label={r.toutVerifier}
              />
            }
            aide={
            <HelpPopover title={r.toutVerifier}>
              {r.toutVerifierAide}<b className="text-ink">{r.toutVerifierCent}</b>{r.toutVerifierAideSuite}
              <br />
              <br />
              {r.toutVerifierActive}
            </HelpPopover>
            }
          />
        </div>
      )}

      {/* « Compter les effets d'auras Tolerance et Précision dans les
          conditions » (libellé de l'utilisateur) :
          activé par défaut, branché sur `compterAurasResPre`, qu'une
          recette porte déjà et que la recherche lit au clic sur
          « Rechercher » (`avecAurasConditions`).
          ⚠️ **Rendu SANS condition**, même sans aucune aura RES/PRE
          saisie : les activations Tolerance/Accuracy PROPRES d'un build
          comptent aussi, et un réglage qui apparaît et disparaît avec
          la saisie d'une autre carte ne se retrouve pas. Ce contenu est
          commun aux deux formats — la section « Réglages avancés » de la
          colonne « Aura, exclusion, avancés » au bureau, le panneau
          « Options » au doigt.
          ⚠️ EN DERNIER : la rangée conditionnelle du dessus
          (« Vérifier toutes… ») ne le décale qu'au geste d'une autre
          carte, jamais sous le clic.
          ⚠️ **Cible de l'ouverture guidée** : le
          cadre intérieur porte le surlignage d'attention, au même token
          que le rappel (`warn` / `warn-soft`). Il existe EN PERMANENCE,
          transparent : se colorer ne bouge rien. Intérieur et non sur la
          rangée elle-même, dont le trait du haut vient de `divide-y` :
          un contour posé dessus en ferait deux superposés. `-mx-1` le
          tient à 4 px du cadre de la boîte ; `px-[3px]` + 1 px de bord
          gardent le libellé aligné sur ceux du dessus, et `py-2` +
          `py-[3px]` + 1 px refont les 12 px de `py-3`. Une ref par
          surface (colonne du bureau, panneau), pour y défiler. */}
      <div className="py-2 last:pb-0">
        <div
          ref={dansPanneau ? interrupteurResPrePanneauRef : interrupteurResPreBureauRef}
          className={`-mx-1 flex items-center justify-between gap-3 rounded-md border px-[3px] py-[3px] transition-colors duration-200 ${
            attentionResPre !== null ? 'border-warn bg-warn-soft' : 'border-transparent'
          }`}
        >
          <LibelleEtAide
            bureau={bureau}
            etire
            libelle={r.aurasResPre}
            interrupteur={
              <Interrupteur
                actif={compterAurasResPre}
                onChange={setCompterAurasResPre}
                aria-label={r.aurasResPre}
              />
            }
            aide={
            <HelpPopover title={r.aurasResPre}>
              {r.aurasResPreAide.debut}<b className="text-ink">{r.aurasResPreAide.tolerance}</b>{r.aurasResPreAide.ou}<b className="text-ink">{r.aurasResPreAide.accuracy}</b>{r.aurasResPreAide.ajoute}<b className="text-ink">{r.aurasResPreAide.minMax}</b>{r.aurasResPreAide.conditions(bureau ? r.aurasResPreAide.ouBureau : r.aurasResPreAide.ouTelephone)}
              <br />
              <br />
              {r.aurasResPreAide.desactive}
            </HelpPopover>
            }
          />
        </div>
      </div>
    </div>
    </div>
  );
}
