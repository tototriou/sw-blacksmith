import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import TurnOrder from '../rta/TurnOrder';
import RecoCard from '../siege/RecoCard';
import GrilleResultats from '../outils/optimizer/GrilleResultats';
import MonsterAvatar from '../MonsterAvatar';
import { useRuneMetric } from '../../hooks/useRuneMetric';
import { OrdreDeTour, TableauBarres } from '../outils/speedTune/VuesSpeedTune';
import { useTraduction } from '../../hooks/useLangue';
import { demoOptimizer, demoReco, demoRta, demoSpeedTune, recosFigees } from '../../lib/demoAccueil';
import type { Monster } from '../../types';

// Les exemples de l'accueil « vitrine » : les VRAIS composants des outils —
// ordre de tour RTA, carte de recommandation, grille de résultats de l'Optimizer,
// vues du speed tuning —, sur des équipes de démonstration passées par les
// mêmes calculs (lib/demoAccueil.ts). Ce qu'on voit ici, l'app l'affiche
// (choix du mainteneur : « des images réalisables avec l'appli »).
// ⚠️ INERTES : on regarde, on ne modifie rien — un exemple n'a pas d'état à
// garder, et ses gestes toucheraient sinon aux réglages du joueur.
// Sans les données du jeu (premier chargement, tests), rien : un exemple faux
// vaut moins qu'aucun. docs/02-app/accueil/README.md.

export type ParCom2us = Map<number, Monster>;

function Inerte({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // `inert` posé par le DOM : React 18 ne connaît pas l'attribut.
  useEffect(() => ref.current?.setAttribute('inert', ''), []);
  // ⚠️ À 80 % : un APERÇU qui donne envie, pas le détail (choix du
  // mainteneur). `zoom` et non `transform` : la mise en page suit, le
  // composant se dispose comme dans une colonne plus large.
  return (
    <div ref={ref} className="select-none" style={{ zoom: 0.8 }}>
      {children}
    </div>
  );
}

// Le cadre commun : l'étiquette « Exemple · … », puis le composant de l'outil.
function CadreExemple({ etiquette, data, children }: { etiquette: string; data: string; children: ReactNode }) {
  const v = useTraduction().accueil.vitrine;
  return (
    <div className="flex h-full flex-col gap-4" data-exemple={data}>
      <span className="label">
        {v.exemple} · {etiquette}
      </span>
      <Inerte>{children}</Inerte>
    </div>
  );
}

export function ExempleRta({ monstres }: { monstres: ParCom2us }) {
  const v = useTraduction().accueil.vitrine.outils.rta;
  const items = useMemo(() => demoRta(monstres), [monstres]);
  if (!items) return null;
  return (
    <CadreExemple etiquette={v.etiquette} data="rta">
      <TurnOrder items={items} />
    </CadreExemple>
  );
}

export function ExempleRecos({ monstres, liste }: { monstres: ParCom2us; liste: Monster[] }) {
  const v = useTraduction().accueil.vitrine.outils.recos;
  const reco = useMemo(() => demoReco(monstres, { nom: v.nom, auteur: v.auteur, contributeur: v.contributeur }), [monstres, v]);
  const parId = useMemo(() => new Map(liste.map((m) => [String(m.id), m])), [liste]);
  if (!reco) return null;
  return (
    <CadreExemple etiquette={v.etiquette} data="recos">
      <RecoCard
        raisonsExportOptimizer={reco.decks.map(() => undefined)}
        onExporterDeckOptimizer={() => {}}
        reco={reco}
        index={0}
        monsters={liste}
        monsterByCom2us={monstres}
        monsterById={parId}
        offenseTeams={[]}
        match={null}
        canAnalyze={false}
        onAnalyze={() => {}}
        onClearAnalysis={() => {}}
        open
        onToggleOpen={() => {}}
        editing={false}
        onToggleEdit={() => {}}
        onExport={() => {}}
        recos={recosFigees(reco)}
      />
    </CadreExemple>
  );
}

export function ExempleOptimizer({ monstres }: { monstres: ParCom2us }) {
  const v = useTraduction().accueil.vitrine.outils.optimizer;
  const metric = useRuneMetric();
  const grille = useRef<HTMLDivElement>(null);
  const demo = useMemo(() => demoOptimizer(monstres), [monstres]);
  const runeById = useMemo(() => new Map((demo?.runes ?? []).map((r) => [r.id, r])), [demo]);
  if (!demo) return null;
  // La page de résultats, ses deux premières places : la grille de l'écran,
  // telle quelle, au rendu du bureau.
  return (
    <CadreExemple etiquette={v.etiquette} data="optimizer">
      <div className="mb-3 flex items-center gap-2.5">
        <MonsterAvatar monster={demo.monster} size={36} element={false} titre={null} />
        <b className="text-md text-ink">{demo.monster.name}</b>
      </div>
      <GrilleResultats
        grilleResultatsRef={grille}
        composition={{ cartes: demo.candidats, premierRang: 1, placesEnAttente: 0, aVerifier: [] }}
        runeById={runeById}
        relicUsageById={undefined}
        metric={metric}
        openDetailKey={null}
        onToggleDetail={() => {}}
        proprietesCarte={() => ({ artifacts: [] })}
        hauteurCarte={null}
        bureau
      />
    </CadreExemple>
  );
}

export function ExempleSpeed({ monstres }: { monstres: ParCom2us }) {
  const v = useTraduction().accueil.vitrine.outils.speed;
  const demo = useMemo(() => demoSpeedTune(monstres), [monstres]);
  if (!demo) return null;
  return (
    <CadreExemple etiquette={v.etiquette} data="speed">
      {/* L'ordre de tour et la barre d'action : l'essentiel de l'outil, à la
          hauteur de son texte (le repère des ticks reste dans l'outil). */}
      <div className="flex flex-col gap-3">
        <OrdreDeTour premiers={demo.premiers} ligneParUid={demo.ligneParUid} />
        <TableauBarres lignesTableau={demo.lignesTableau} ligneParUid={demo.ligneParUid} numAction={demo.numAction} nbTicks={8} />
      </div>
    </CadreExemple>
  );
}
