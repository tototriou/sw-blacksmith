import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Onglets } from '../../../../ui';
import { CADRE, COIN_RACCORD, DEFILEMENT, SECTIONS } from './panneau';
import { SetDeplieContext } from './setDeplie';
import { HauteurListeContext, MIN_LISTE_BUREAU, hauteurEquipeMinimale } from './hauteurListe';
import { configurationBureau, ongletOuvert, LARGEURS_BUREAU, RETRAIT_PANNEAU, SEUILS_BUREAU, type ColonneReglage, type OngletBureau } from '../../../../lib/optimizerColonnes';
import { useTraduction } from '../../../../hooks/useLangue';

// Bureau seulement : « Monstre », les réglages en un seul groupe d'onglets,
// les résultats, ou un quatrième onglet sous le seuil ; chaque colonne défile
// seule. docs/02-app/optimizer/ecran/README.md, « Les trois configurations ».
const MARGE_BAS = 16;

// Ce que la page reprend, à gauche et à droite, sur le rembourrage de ce qui
// la porte (`-mx-3`, voir la racine).
const EMPIETEMENT = 12;

// L'empiètement possible de chaque côté : la place entre le contenu du parent
// et le bord de ce qui défile (sa boîte de rembourrage), ou de la fenêtre,
// au plus `EMPIETEMENT`. ⚠️ Sans rembourrage autour (la page montée seule), la
// page empiéterait hors de la partie visible et ferait défiler en largeur.
function empietement(el: HTMLElement, defile: HTMLElement | null): { gauche: number; droite: number } {
  const parent = el.parentElement;
  if (!parent) return { gauche: 0, droite: 0 };
  const r = parent.getBoundingClientRect();
  const s = getComputedStyle(parent);
  const contenuG = r.left + (parseFloat(s.borderLeftWidth) || 0) + (parseFloat(s.paddingLeft) || 0);
  const contenuD = r.right - (parseFloat(s.borderRightWidth) || 0) - (parseFloat(s.paddingRight) || 0);
  let bordG = 0;
  let bordD = document.documentElement.clientWidth;
  if (defile) {
    const d = defile.getBoundingClientRect();
    bordG = d.left + defile.clientLeft;
    bordD = bordG + defile.clientWidth;
  }
  const borne = (v: number) => Math.max(0, Math.min(EMPIETEMENT, Math.floor(v)));
  return { gauche: borne(contenuG - bordG), droite: borne(bordD - contenuD) };
}

interface Mesure {
  largeur: number | null;
  style: CSSProperties;
}

function parentQuiDefile(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') return p;
  }
  return null;
}

// Ce qui suit la racine jusqu'au bas de ce qui défile (rembourrages, contours
// et marges des ancêtres) : la racine le rend par une marge négative, pour que
// la page finisse à `MARGE_BAS` du bas de la partie visible, sans la faire
// défiler. ⚠️ La racine est le dernier élément de la page dans le flux.
function espaceApres(el: HTMLElement, defile: HTMLElement | null): number {
  let total = 0;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const s = getComputedStyle(p);
    total += parseFloat(s.paddingBottom) || 0;
    if (p === defile) break;
    total += (parseFloat(s.borderBottomWidth) || 0) + (parseFloat(s.marginBottom) || 0);
  }
  return total;
}


// La hauteur visible vaut pour toutes les configurations, pleine page et volet.
function useHauteurVisible(racine: RefObject<HTMLDivElement>): Mesure {
  const [mesure, setMesure] = useState<Mesure>({ largeur: null, style: {} });
  useLayoutEffect(() => {
    const el = racine.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const defile = parentQuiDefile(el);
    const mesurer = () => {
      const largeur = el.getBoundingClientRect().width;
      const { gauche, droite } = empietement(el, defile);
      const haut = el.getBoundingClientRect().top;
      const dessus = defile
        ? haut - defile.getBoundingClientRect().top - defile.clientTop + defile.scrollTop
        : haut + window.scrollY;
      const visible = defile ? defile.clientHeight : window.innerHeight;
      const style: CSSProperties = {
        marginLeft: `${-gauche}px`, marginRight: `${-droite}px`,
        height: `${Math.max(0, Math.round(visible - dessus - MARGE_BAS))}px`,
        marginBottom: `${-Math.round(espaceApres(el, defile))}px`,
      };
      setMesure(avant => avant.largeur === largeur && JSON.stringify(avant.style) === JSON.stringify(style) ? avant : { largeur, style });
    };
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    obs.observe(defile ?? document.body);
    window.addEventListener('resize', mesurer);
    return () => { obs.disconnect(); window.removeEventListener('resize', mesurer); };
  }, [racine]);
  return mesure;
}

export interface PresentationObjectif { cadre: boolean }
export interface PageBureauProps {
  liste: ReactNode;
  set: ReactNode;
  conditions: ReactNode;
  principales: ReactNode;
  etat: ReactNode;
  artefacts: ReactNode;
  meilleurs: ReactNode;
  auras: ReactNode;
  exclusion: ReactNode;
  avances: ReactNode;
  exemplaire: ReactNode;
  objectif: (presentation: PresentationObjectif) => ReactNode;
  resultats: ReactNode;
  onglet: OngletBureau | null;
  onOnglet: (suivant: OngletBureau | null) => void;
  rappelAuras: boolean;
  guideComplements?: number | null;
  guideCriteres?: number | null;
  // Le réglage « Résultats de l'Optimizer » vaut « Tableau » : la page range
  // ses réglages pour laisser au tableau sa largeur (`configurationBureau`).
  tableau?: boolean;
}

// `boite` : la hauteur visible du contenu ; `naturelle` : celle qu'il prend.
export interface MesureColonne { boite: number; naturelle: number; interieur: HTMLElement }

// ⚠️ Le cadre de la colonne ne défile jamais (décision de l'utilisateur) : il
// prend la hauteur de la colonne et sa place moins `RETRAIT_PANNEAU` (toute
// la piste sans place), et son contenu défile À L'INTÉRIEUR (`DEFILEMENT`,
// `data-defilement`), la barre dans le panneau.
function Colonne({ place, children, surMesure, zone, colonne, raccord = false }: {
  place?: number; children: ReactNode; surMesure?: (mesure: MesureColonne) => void;
  zone?: string; colonne?: ColonneReglage; raccord?: boolean;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const interieur = useRef<HTMLDivElement>(null);
  const mesureRef = useRef(surMesure);
  mesureRef.current = surMesure;
  useLayoutEffect(() => {
    const b = boite.current, i = interieur.current;
    if (!b || !i || typeof ResizeObserver === 'undefined') return;
    const lire = () => {
      const dernier = i.lastElementChild;
      if (!dernier) return;
      const s = getComputedStyle(i);
      mesureRef.current?.({ boite: b.clientHeight, naturelle: dernier.getBoundingClientRect().bottom - i.getBoundingClientRect().top
        + (parseFloat(s.paddingBottom) || 0), interieur: i });
    };
    lire();
    const obs = new ResizeObserver(lire);
    obs.observe(b); obs.observe(i);
    return () => obs.disconnect();
  }, [colonne]);
  return (
    <div data-zone={zone} data-colonne={colonne}
      className={`h-full min-h-0 min-w-0 ${CADRE} ${raccord ? COIN_RACCORD : ''}`}
      style={{ width: place == null ? '100%' : place - RETRAIT_PANNEAU }}>
      <div ref={boite} data-defilement="" className={`${DEFILEMENT} ${raccord ? 'rounded-tl-none' : ''}`}>
        <div ref={interieur} className={`flex min-h-full flex-col p-2 ${SECTIONS}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

// La décision se reprend à hauteur ou écart changés, jamais à contenu changé :
// choisir un set ou une principale ne replie pas la grille sous le pointeur.
// Déplié avant la mesure (rendu serveur, premier rendu) : la mesure, prise
// avant le premier affichage, replie aussitôt s'il ne tient pas.
function useSetDeplie() {
  const [deplie, setDeplie] = useState(true);
  const deplieRendu = useRef(deplie);
  deplieRendu.current = deplie;
  const ecart = useRef<number | null>(null);
  const derniere = useRef<MesureColonne | null>(null);
  const evaluee = useRef('');
  const decider = useCallback(() => {
    const m = derniere.current;
    if (!m) return;
    const e = ecart.current;
    const cle = `${Math.round(m.boite)}|${e == null ? '' : Math.round(e)}`;
    if (cle === evaluee.current) return;
    evaluee.current = cle;
    const compacte = m.naturelle - (deplieRendu.current && e != null ? e : 0);
    const cible = e != null && compacte + e <= m.boite + 0.5;
    // `deplieRendu` ne suit que le rendu : une mesure prise avant que la
    // nouvelle forme soit dessinée se rapporte encore à l'ancienne.
    if (cible !== deplieRendu.current) setDeplie(cible);
  }, []);
  const surMesure = useCallback((m: MesureColonne) => { derniere.current = m; decider(); }, [decider]);
  const reporterEcart = useCallback((e: number) => { ecart.current = e; decider(); }, [decider]);
  const contexte = useMemo(() => ({ deplie, reporterEcart }), [deplie, reporterEcart]);
  return { contexte, surMesure };
}

export type OngletMonstre = 'liste' | 'exemplaire';

// ⚠️ « Monstre » ne défile pas (décision de l'utilisateur). L'exemplaire
// reste sous la liste tant qu'il tient sous une liste réduite à la plus
// petite équipe, trois monstres (`hauteurEquipeMinimale`, ou la liste
// entière si elle est plus courte) : sur la plupart des écrans, la liste
// défile et l'exemplaire reste dessous. Seulement quand même ce minimum ne
// tient pas, l'exemplaire passe dans un onglet (« Liste active » ·
// « Exemplaire ») ; décisions de l'utilisateur.
// Dans les deux formes, la liste des membres (`data-liste-membres`) prend au
// plus la hauteur que le reste de la colonne lui laisse, jamais moins de ce
// minimum, et défile seule au-delà (une liste très longue, même seule dans
// son onglet) ; sous ce minimum, la colonne défile en dernier recours.
// Stable : la liste changeant de hauteur, le contenu change d'autant.
// ⚠️ Le passage aux onglets se fait dès que l'empilement ne tient plus ; le
// retour, seulement quand la hauteur de la colonne change, jamais quand le
// contenu rétrécit : retirer un membre ne fait pas remonter la liste sous le
// pointeur (un clic ne déplace jamais ce qu'on vient de cliquer).
function useMonstre(colonne: RefObject<HTMLDivElement>) {
  const [enOnglets, setEnOnglets] = useState(false);
  const [hauteurListe, setHauteurListe] = useState<number | null>(null);
  const enOngletsRendu = useRef(enOnglets);
  enOngletsRendu.current = enOnglets;
  // Mesurés empilés : tout ce qui n'est pas la liste ; et, la liste
  // affichée, sa hauteur minimale (une équipe de trois, ou elle entière).
  const horsListe = useRef<number | null>(null);
  const minimumListe = useRef<number | null>(null);
  const hauteurEvaluee = useRef<number | null>(null);
  const surMesure = useCallback(({ boite, naturelle, interieur }: MesureColonne) => {
    const liste = interieur.querySelector<HTMLElement>('[data-liste-membres]');
    const listeAffichee = !!interieur.querySelector('[data-liste-travail]');
    const hauteur = liste?.getBoundingClientRect().height ?? 0;
    if (listeAffichee) minimumListe.current = liste ? Math.min(hauteurEquipeMinimale(liste), liste.scrollHeight) : 0;
    if (!enOngletsRendu.current) horsListe.current = naturelle - hauteur;
    const suivante = liste ? Math.max(minimumListe.current ?? MIN_LISTE_BUREAU, Math.floor(boite - (naturelle - hauteur))) : null;
    setHauteurListe(avant => avant === suivante ? avant : suivante);
    const h = colonne.current?.getBoundingClientRect().height;
    if (h == null || horsListe.current == null || minimumListe.current == null) return;
    // Empilés, la liste réduite à son minimum et l'exemplaire tiennent dans
    // le panneau (contour de 2 px).
    const tient = horsListe.current + minimumListe.current <= h - 2 + 0.5;
    const hauteurChangee = hauteurEvaluee.current == null || Math.round(h) !== hauteurEvaluee.current;
    hauteurEvaluee.current = Math.round(h);
    if (!tient && !enOngletsRendu.current) setEnOnglets(true);
    else if (tient && enOngletsRendu.current && hauteurChangee) setEnOnglets(false);
  }, [colonne]);
  return { enOnglets, hauteurListe, surMesure };
}



export default function PageBureau(props: PageBureauProps) {
  const o = useTraduction().optimizer;
  // Le nom court de chaque onglet, et son nom complet en infobulle.
  const noms = o.onglets;
  const racine = useRef<HTMLDivElement>(null);
  const { largeur, style } = useHauteurVisible(racine);
  const tableau = props.tableau ?? false;
  // Avant la mesure (rendu serveur, premier rendu) : le groupe de trois
  // onglets, où l'objectif et les résultats restent à l'écran. La mesure, prise
  // avant le premier affichage, corrige aussitôt.
  const disposition = useMemo(() => configurationBureau(largeur ?? SEUILS_BUREAU.groupe, tableau), [largeur, tableau]);
  const actif = ongletOuvert(disposition.groupe, props.onglet);
  const { onOnglet, guideComplements, guideCriteres } = props;
  const courant = useRef({ groupe: disposition.groupe, actif });
  courant.current = { groupe: disposition.groupe, actif };
  // Mémoriser aussi les remplacements au redimensionnement : revenir à un
  // groupe n'y ressuscite pas un onglet qui n'en faisait plus partie.
  useLayoutEffect(() => { if (props.onglet !== actif) onOnglet(actif); }, [actif, props.onglet, onOnglet]);
  useLayoutEffect(() => {
    if (guideComplements != null) onOnglet(ongletOuvert(courant.current.groupe, courant.current.actif, 'complements'));
  }, [guideComplements, onOnglet]);
  useLayoutEffect(() => {
    if (guideCriteres != null) onOnglet(ongletOuvert(courant.current.groupe, courant.current.actif, 'criteres'));
  }, [guideCriteres, onOnglet]);
  // ⚠️ Dans chaque onglet, les sections restent l'une sous l'autre, quelle
  // que soit la largeur du groupe (décision de l'utilisateur) : le groupe
  // large et les quatre onglets élargissent la colonne, jamais en rangées.
  // Le set s'y déplie selon la hauteur.
  const setDeplie = useSetDeplie();
  const colonneMonstre = useRef<HTMLDivElement>(null);
  const monstre = useMonstre(colonneMonstre);
  // L'onglet ouvert de « Monstre » : local à l'écran, la liste au départ.
  const [ongletMonstre, setOngletMonstre] = useState<OngletMonstre>('liste');
  const om = o.ongletsMonstre;
  const voirListe = !monstre.enOnglets || ongletMonstre === 'liste';
  const voirExemplaire = !monstre.enOnglets || ongletMonstre === 'exemplaire';
  const contenus: Record<ColonneReglage, ReactNode> = {
    criteres: <><SetDeplieContext.Provider value={setDeplie.contexte}>{props.set}</SetDeplieContext.Provider>{props.conditions}{props.principales}{props.etat}</>,
    artefacts: <>{props.artefacts}{props.meilleurs}</>,
    complements: <>{props.auras}{props.exclusion}{props.avances}</>,
  };
  // La ligne de base des onglets s'arrête au rayon du coin haut droit du
  // panneau, qui la prolonge en arrondi (`COIN_RACCORD`).
  const onglets = <Onglets aria-label={o.reglagesRecherche} valeur={actif ?? 'criteres'} className="pr-[var(--radius-xl)]"
    options={disposition.groupe.map(cle => ({ cle, ...noms[cle] }))} onChange={onOnglet} />;
  // L'objectif, « Rechercher » et les résultats : leur colonne, ou leur
  // onglet quand la place manque.
  const resultats = <><div data-zone="objectif">{props.objectif({ cadre: false })}</div><div>{props.resultats}</div></>;
  const contenuOnglet = (cle: OngletBureau) =>
    cle === 'resultats' ? resultats : contenus[cle];
  // Comme une colonne fixe, le groupe prend sa place moins le retrait, la
  // rangée des onglets à la largeur du panneau. Sans place (quatre onglets),
  // il prend la largeur de sa piste.
  const place = disposition.reglage || undefined;
  const groupe = actif && (
    <div data-zone="onglets" className="flex h-full min-h-0 min-w-0 flex-col" style={place ? { width: place - RETRAIT_PANNEAU } : undefined}>
      <div className="flex-none">{onglets}</div>
      <div role="tabpanel" aria-label={noms[actif].title} className="min-h-0 flex-1">
        <Colonne key={actif} place={place} raccord
          colonne={actif === 'resultats' ? undefined : actif} zone={actif === 'resultats' ? 'resultats' : undefined}
          surMesure={actif === 'criteres' ? setDeplie.surMesure : undefined}>
          {contenuOnglet(actif)}
        </Colonne>
      </div>
    </div>
  );
  const pistes = place ? `${place}px minmax(0,1fr)` : 'minmax(0,1fr)';
  return (
    <div ref={racine} className="-mx-3 @container" style={style} data-configuration={largeur != null ? disposition.configuration : undefined} data-page-fenetre="">
      <p className="sr-only" aria-live="polite">{props.rappelAuras ? o.auras.rappel : ''}</p>
      <div className="grid h-full min-h-0" style={{ gap: LARGEURS_BUREAU.gouttiere, gridTemplateColumns: `${LARGEURS_BUREAU.monstre}px ${pistes}` }}>
        {/* ⚠️ « Monstre » ne défile pas : empilé, ou en onglets (`useMonstre`).
            Les deux sections gardent leur clé : passer aux onglets ne remonte
            ni la liste ni l'exemplaire. */}
        <div ref={colonneMonstre} className="flex h-full min-h-0 min-w-0 flex-col" style={{ width: LARGEURS_BUREAU.monstre - RETRAIT_PANNEAU }}>
          {monstre.enOnglets && (
            <div className="flex-none">
              <Onglets aria-label={om.nom} valeur={ongletMonstre} className="pr-[var(--radius-xl)]"
                options={(['liste', 'exemplaire'] as const).map(cle => ({ cle, ...om[cle] }))} onChange={setOngletMonstre} />
            </div>
          )}
          <div role={monstre.enOnglets ? 'tabpanel' : undefined} aria-label={monstre.enOnglets ? om[ongletMonstre].title : undefined} className="min-h-0 flex-1">
            <Colonne place={LARGEURS_BUREAU.monstre} zone="monstre" raccord={monstre.enOnglets} surMesure={monstre.surMesure}>
              {voirListe && <div key="liste" data-liste-travail=""><HauteurListeContext.Provider value={monstre.hauteurListe}>{props.liste}</HauteurListeContext.Provider></div>}
              {voirExemplaire && <div key="exemplaire" data-zone="exemplaire">{props.exemplaire}</div>}
            </Colonne>
          </div>
        </div>
        {groupe}
        {place && <Colonne zone="resultats">{resultats}</Colonne>}
      </div>
    </div>
  );
}
