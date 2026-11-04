import HelpPopover from '../../HelpPopover';
import Segmented from '../../../ui/Segmented';
import { OBJECTIVE_LABELS, type Objective } from '../../../lib/runeBuildOptim';
import { ZoneCliquable, Bouton } from '../../../ui';
import { Swords, Pencil, Search, Upload, Download, Square } from 'lucide-react';
import { type Dispatch, type SetStateAction, type RefObject } from 'react';
import { type Monster, type GearSet } from '../../../types';
import { type BuildOptimStatus } from '../../../hooks/useBuildOptimSearch';
import { useTraduction } from '../../../hooks/useLangue';

/** Les objectifs dans leur ordre, nommés dans la langue de l'interface. */
export function useObjectifs() {
  const noms = useTraduction().optimizer.objectifs;
  return OBJECTIVE_LABELS.map((o) => ({ key: o.key, label: noms[o.key] }));
}

export interface ObjectifEtActionsProps {
  objective: Objective;
  setObjective: Dispatch<SetStateAction<Objective>>;
  setSetupOuvert: Dispatch<SetStateAction<boolean>>;
  resumeCombat: string;
  handleSearch: () => void;
  selected: { monster: Monster; gear: GearSet; } | null;
  status: BuildOptimStatus;
  comboSets: string[];
  exportRecipe: () => void;
  importFileRef: RefObject<HTMLInputElement>;
  importRecipe: (file: File) => void;
  setStoppedManually: Dispatch<SetStateAction<boolean>>;
  stop: () => void;
}

// Le titre de l'objectif et son aide, partagés avec le bloc « Objectif et
// Rechercher » du bureau (bureau/ObjectifEtRechercherBureau.tsx).
export function TitreObjectifRecherche() {
  const o = useTraduction().optimizer;
  const a = o.actions;
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <p className="label">{a.objectif}</p>
      <HelpPopover title={a.objectif}>
        {a.objectifAide}<b className="text-ink">{o.objectifs.degats_reels}</b>{a.objectifAideFin}
      </HelpPopover>
    </div>
  );
}

// Le résumé de « Dégâts réels », porte de réouverture de la description du
// combat, rendu seulement sous cet objectif, aux deux formats. Au bureau, sa
// place n'est pas réservée (décision de l'utilisateur) : il paraît sous les
// objectifs, jamais au-dessus du clic.
export function ResumeCombat({ resumeCombat, setSetupOuvert }: { resumeCombat: string; setSetupOuvert: Dispatch<SetStateAction<boolean>> }) {
  const a = useTraduction().optimizer.actions;
  return (
    <ZoneCliquable
      onClick={() => setSetupOuvert(true)}
      className="mt-2.5 flex w-full items-center gap-1.5 rounded-lg border border-border-soft bg-panel2 px-2 py-1.5 text-left"
      aria-label={a.modifierCombat}
    >
      <Swords size={13} className="flex-none text-ink-dim" />
      <span className="text-micro leading-tight text-ink-dim">{resumeCombat}</span>
      <Pencil size={12} className="ml-auto flex-none text-ink-dim" />
    </ZoneCliquable>
  );
}

export default function ObjectifEtActions({ objective, setObjective, setSetupOuvert, resumeCombat, handleSearch, selected, status, comboSets, exportRecipe, importFileRef, importRecipe, setStoppedManually, stop }: ObjectifEtActionsProps) {
  const a = useTraduction().optimizer.actions;
  const objectifs = useObjectifs();
  return (
    <div className="rounded-xl border border-border bg-panel p-3 shadow-lg">
      {/* ⚠️ **L'objectif vit avec le bouton qui lance la recherche**, plus
          dans une cellule de la grille de réglages. Il y était « une carte
          À PART » parce qu'il portait AUSSI la description du combat, qui
          réclamait de la place ; celle-ci partie en fenêtre, il ne reste
          qu'un segmenté à quatre crans — et *quoi* chercher se lit mieux
          juste au-dessus de *chercher* que parmi les critères.
          ⚠️ Titre en `label`, sans le carré d'icône accentué qu'il portait
          comme en-tête de carte : ce n'en est plus une, c'est une section
          dans celle des actions — même traitement que « Set de runes
          recherché » ou « Conditions ». */}
      <div className="mb-3">
        <TitreObjectifRecherche />
        {/* ⚠️ Choisir « Dégâts réels » OUVRE la description du combat, il ne
            fait pas que la révéler. La carte apparaissait auparavant sous
            l'objectif, et rien n'obligeait à la regarder : on pouvait classer
            des milliers de builds sur un sort, une cible et un mode de
            critique jamais choisis. Le geste devient explicite — cet objectif
            ne se choisit plus sans voir ses hypothèses. */}
        <Segmented
          options={objectifs}
          value={objective}
          onChange={(o) => {
            setObjective(o);
            if (o === 'degats_reels') setSetupOuvert(true);
          }}
          size="lg"
        />
        {/* Le résumé remplace la carte dans le flux ET sert de porte de
            réouverture : sans lui, une fenêtre fermée rendrait les
            hypothèses inatteignables autant qu'invisibles. */}
        {objective === 'degats_reels' && <ResumeCombat resumeCombat={resumeCombat} setSetupOuvert={setSetupOuvert} />}
      </div>

      {/* ⚠️ Rangée d'actions inchangée — mêmes classes qu'avant que
          l'objectif ne la rejoigne : elle était la carte entière, elle en
          devient la seconde moitié. Une rangée à part, et non un `flex-wrap`
          commun avec l'objectif : le segmenté et les boutons se seraient
          réarrangés l'un autour de l'autre au gré de la largeur. */}
      <div className="flex flex-wrap items-center gap-3">
      {/* ⚠️ `comboSets.length === 0` reste HORS de `disabled` — un bouton
          HTML natif `disabled` ne déclenche JAMAIS `onClick` (règle du
          DOM, pas un oubli), ce qui aurait rendu le défilement vers « Set
          de runes recherché » plus haut inatteignable : plus aucun clic
          ne pouvait jamais arriver jusqu'à `handleSearch`. Grisé
          visuellement à la place (mêmes classes que `disabled:*`,
          appliquées manuellement) tout en restant cliquable, pour que le
          clic sur un set manquant décale toujours vers la section fautive
          plutôt que de ne rien faire silencieusement. */}
      <Bouton
        ton="accent"
        onClick={handleSearch}
        disabled={!selected || status === 'running'}
        title={selected && status !== 'running' && comboSets.length === 0 ? a.setDabord : undefined}
        icone={<Search size={15} />}
        libelle={status === 'running' ? a.rechercheEnCours : a.rechercher}
        className={comboSets.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}
      />

      {/* Exporte les réglages de CETTE recherche (set, minimums, objectif…),
          jamais le pool de runes ni le compte — pour reproduire fidèlement
          un cas signalé, partager une recherche entre joueurs (chacun
          l'applique à son propre inventaire), ou la réutiliser depuis un
          script. Voir src/lib/optimizerRecipe.ts. */}
      <Bouton
        onClick={exportRecipe}
        disabled={!selected || comboSets.length === 0}
        title={a.exporterAide}
        icone={<Upload size={14} />}
        libelle={a.exporterLong}
        libelleCourt={a.exporter}
      />

      {/* Reprend une recette importée (fichier reçu d'un autre joueur, ou
          gardée de côté) — remplit les réglages et sélectionne le monstre
          si son com2usId existe dans CETTE box. Aucune confirmation :
          remplacer les réglages en cours n'est pas plus destructeur que
          les modifier à la main un par un. */}
      <Bouton
        onClick={() => importFileRef.current?.click()}
        title={a.importerAide}
        icone={<Download size={14} />}
        libelle={a.importerLong}
        libelleCourt={a.importer}
      />
      <input
        ref={importFileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // permet de réimporter le même fichier
          if (f) importRecipe(f);
        }}
      />

      {status === 'running' && (
        <Bouton
          ton="danger"
          fond="vide"
          onClick={() => {
            setStoppedManually(true);
            stop();
          }}
          title={a.arreterAide}
          icone={<Square size={13} />}
          libelle={a.arreter}
        />
      )}
      </div>
    </div>
  );
}
