import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Download, Search, Square, Upload } from 'lucide-react';
import { Bouton } from '../../../../ui';
import Segmented from '../../../../ui/Segmented';
import ProgressionRecherche, { type ProgressionRechercheProps } from '../ProgressionRecherche';
import { ResumeCombat, TitreObjectifRecherche, useObjectifs, type ObjectifEtActionsProps } from '../ObjectifEtActions';
import { useTraduction } from '../../../../hooks/useLangue';
import { PANNEAU } from './panneau';

export const LARGEUR_OBJECTIF_LARGE_MIN = 328;
export const DELAI_ARRET_MS = 300;
const RANGEE_LARGE = 'flex flex-col-reverse gap-2 @[448px]/rangee:flex-row-reverse @[448px]/rangee:items-center @[448px]/rangee:justify-between';
const RECHERCHER_DANS_LA_RANGEE = 'w-full @[448px]/rangee:w-60 @[448px]/rangee:flex-none';

export interface ObjectifEtRechercherBureauProps extends ObjectifEtActionsProps {
  cadre?: boolean;
  estimation: ReactNode;
  messageImport: ReactNode;
  progression: Omit<ProgressionRechercheProps, 'status'>;
}

// Une seule forme, à la largeur reçue : les objectifs passent en 2 × 2
// quand la copie à texte normal ne tient pas sur une ligne. Ni le choix
// d'objectif ni le lancement de la recherche n'interviennent dans la mesure.
// docs/02-app/optimizer/ecran/README.md, « Bloc « Objectif et Rechercher » ».
export default function ObjectifEtRechercherBureau({
  cadre = true, estimation, messageImport, progression, objective, setObjective, setSetupOuvert, resumeCombat, handleSearch, selected, status,
  comboSets, exportRecipe, exportBloque = false, importFileRef, importRecipe, setStoppedManually, stop,
}: ObjectifEtRechercherBureauProps) {
  const a = useTraduction().optimizer.actions;
  const objectifs = useObjectifs();
  const enCours = status === 'running';
  const [arretActif, setArretActif] = useState(false);
  useEffect(() => {
    if (!enCours) return;
    const minuterie = window.setTimeout(() => setArretActif(true), DELAI_ARRET_MS);
    return () => { window.clearTimeout(minuterie); setArretActif(false); };
  }, [enCours]);
  const place = useRef<HTMLDivElement>(null);
  const copie = useRef<HTMLDivElement>(null);
  const [deuxColonnes, setDeuxColonnes] = useState(true);
  useLayoutEffect(() => {
    const p = place.current, c = copie.current;
    if (!p || !c || typeof ResizeObserver === 'undefined') return;
    const mesurer = () => setDeuxColonnes(c.getBoundingClientRect().width > p.clientWidth);
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(p); obs.observe(c);
    return () => obs.disconnect();
  }, []);
  const rechercher = (
    <div className={`grid ${RECHERCHER_DANS_LA_RANGEE}`}>
      {/* ⚠️ `comboSets.length === 0` hors de `disabled`, comme au téléphone
          (`ObjectifEtActions`) : le clic doit encore atteindre
          `handleSearch`, qui ramène au « Set de runes recherché ».
          ⚠️ **Braise pleine** (`fond="plein"`, le bouton principal de
          `Bouton`) dès qu'un set est choisi : l'action qu'on vient faire doit
          peser plus qu'un segment choisi, qui est lui aussi en braise pleine.
          Sans set, le fond `doux` d'avant et son grisé : une braise pleine à
          40 % d'opacité donne le brun boueux que `Bouton` écarte pour son
          état désactivé. Même taille et même contour de 1 px dans les deux
          fonds : le bouton ne bouge pas quand le premier set arrive. */}
      <Bouton
        taille="lg"
        ton="accent"
        fond={comboSets.length === 0 ? 'doux' : 'plein'}
        pleineLargeur
        onClick={handleSearch}
        disabled={!selected || enCours}
        title={selected && !enCours && comboSets.length === 0 ? a.setDabord : undefined}
        icone={<Search size={16} />}
        libelle={a.rechercher}
        className={`col-start-1 row-start-1 ${enCours ? 'invisible' : ''} ${comboSets.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
        {...(enCours ? { 'aria-hidden': true, tabIndex: -1 } : {})}
      />
      <Bouton
        taille="lg"
        ton="danger"
        fond="vide"
        pleineLargeur
        onClick={() => {
          setStoppedManually(true);
          stop();
        }}
        disabled={!enCours || !arretActif}
        title={a.arreterAide}
        icone={<Square size={14} fill="currentColor" />}
        libelle={a.arreter}
        className={`col-start-1 row-start-1 ${enCours ? '' : 'invisible'}`}
        {...(enCours ? {} : { 'aria-hidden': true, tabIndex: -1 })}
      />
    </div>
  );

  // Arrêter occupe la case exacte de Rechercher.
  const exporter = (
    <Bouton
      onClick={exportRecipe}
      disabled={!selected || comboSets.length === 0 || exportBloque}
      aria-label={a.exporterLong}
      title={a.exporterAide}
      icone={<Upload size={14} />}
      libelle={a.exporter}
    />
  );
  const importer = (
    <Bouton
      onClick={() => importFileRef.current?.click()}
      aria-label={a.importerLong}
      title={a.importerAide}
      icone={<Download size={14} />}
      libelle={a.importer}
    />
  );


  return (
    <section aria-label={a.objectifEtRechercher} className={`flex w-full flex-col gap-2 ${cadre ? PANNEAU : ''}`}>
      {estimation}
      <div ref={place}>
        <TitreObjectifRecherche />
        <Segmented options={objectifs} value={objective} onChange={(o) => {
          setObjective(o);
          if (o === 'degats_reels') setSetupOuvert(true);
        }} size="lg" colonnes={deuxColonnes ? 2 : undefined} dense={false} />
        <div aria-hidden className="pointer-events-none h-0 overflow-hidden">
          <div ref={copie} className="invisible w-max">
            <Segmented options={objectifs} value={null} onChange={() => {}} size="lg" dense={false} />
          </div>
        </div>
        {objective === 'degats_reels' && <ResumeCombat resumeCombat={resumeCombat} setSetupOuvert={setSetupOuvert} />}
      </div>
      <div className="@container/rangee"><div className={RANGEE_LARGE}>
        {rechercher}<div className="flex items-center gap-2">{exporter}{importer}</div>
      </div></div>
      <input ref={importFileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]; e.target.value = ''; if (f) importRecipe(f);
      }} />
      {messageImport}<ProgressionRecherche status={status} {...progression} compacte />
    </section>
  );
}
