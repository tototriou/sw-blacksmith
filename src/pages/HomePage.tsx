import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, LayoutGrid, Download, ShieldCheck } from 'lucide-react';
// ⚠️ Les cartes de SECTION (outils, « Ton espace ») portent les icônes
// d'atelier de la navigation (rebranding R5 — le mainteneur : une section a la
// même icône partout).
import {
  IconeAmi,
  IconeArene,
  IconeArtefacts,
  IconeBestiaire,
  IconeDefense,
  IconeMecaniques,
  IconeNouveautes,
  IconeOffense,
  IconeTelecharger,
  IconeOptimizer,
  IconeRecos,
  IconeRta,
  IconeRunes,
  IconeSiege,
  IconeSpeedTuning,
} from '../components/IconesAtelier';

// Une icône d'atelier ou une icône lucide : le même contrat d'appel.
type Icone = (props: { size?: number; className?: string }) => ReactNode;
import ElementIcon from '../components/ElementIcon';
import { ElementKey, type Monster } from '../types';
import { journal, libelleVersion } from '../data/releases';
import { useLangue, useTraduction } from '../hooks/useLangue';
import { Bouton } from '../ui';
import { LIEN_DISCORD, NOM_APP } from '../marque';
import { estBureau, selonSupport } from '../lib/bureau';
import { LogoDiscord } from '../components/IconesSystemes';
import { CLASSE_NOM, SymboleLogo } from '../components/Logo';
import { ExempleOptimizer, ExempleRecos, ExempleRta, ExempleSpeed, type ParCom2us } from '../components/accueil/ExemplesAccueil';
import {
  COULEUR_SECTION,
  COULEUR_RTA_SUB,
  COULEUR_SIEGE_SUB,
  COULEUR_COMPTE_SUB,
  TEINTE_CLAIRE,
} from '../data/couleursSection';

const ELEMENT_ORDER: ElementKey[] = ['fire', 'water', 'wind', 'light', 'dark'];
const SW_EXPORTER = 'https://github.com/Xzandro/sw-exporter';
const DEPOT_GITHUB = 'https://github.com/tototriou/sw-forge';

// ⚠️ La MÊME courbe que le reste de l'app (`--ease-out` de index.css), écrite
// ici en points de Bézier : Framer ne lit pas les variables CSS dans `ease`.
// Voir la section « Mouvement » de docs/03-developpeur/interface/.
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

// Carte de l'accueil — fond de panneau, contour discret ; au survol, le fond
// s'appuie et le contour se précise.
const CARTE = 'rounded-xl border border-border-soft bg-panel';
const CARTE_LIEN = `${CARTE} transition-colors hoverable:border-border hoverable:bg-panel2`;

// Ce que l'accueil sait de l'état local du joueur. Tout vient de `App` : ce sont
// les mêmes états que les pages outils, sans calcul ni stockage supplémentaire.
export interface HomeStats {
  rta: number; // monstres en prépa RTA
  defense: number; // équipes de siège en défense
  offense: number; // équipes de siège en offense
  recos: number; // recommandations enregistrées
}

interface Props {
  stats: HomeStats;
  onImport: (text: string) => void;
  // Les données du jeu, pour les portraits des exemples. Absentes (premier
  // chargement, tests) : les initiales.
  monstres?: Monster[];
}

// ⚠️ L'accueil est une VITRINE et une PAGE D'ENTRÉE (docs/02-app/accueil/).
//
//  1. **Le premier geste, tout de suite** : le héros parle au joueur, propose
//     d'importer son compte, et la zone de dépôt est à côté ;
//  2. **« Ton espace »** : dès qu'il y a des données locales, les vrais
//     chiffres, qui renvoient dans la sous-section exacte ;
//  3. puis les trois gestes, les quatre outils phares MONTRÉS avec un exemple
//     figé (et les autres en pastilles), la communauté, un dernier appel.
export default function HomePage({ stats, onImport, monstres = [] }: Props) {
  const t = useTraduction();
  const a = t.accueil;
  const v = a.vitrine;
  // ⚠️ La dernière version PUBLIÉE, pas la tête du journal : une version en
  // préparation est en tête du journal sans être en ligne.
  const versions = journal(useLangue());
  const derniere = versions.find((r) => r.version !== null) ?? versions[0];
  const aDesDonnees = stats.rta > 0 || stats.defense > 0 || stats.offense > 0 || stats.recos > 0;
  const parCom2us: ParCom2us = useMemo(() => {
    const m: ParCom2us = new Map();
    for (const mon of monstres) if (mon.com2usId != null && !m.has(mon.com2usId)) m.set(mon.com2usId, mon);
    return m;
  }, [monstres]);
  // Le bouton du héros et celui du dernier appel ouvrent le sélecteur de
  // fichier, comme la zone de dépôt — même `onImport`, un seul chemin d'import.
  const ctaRef = useRef<HTMLInputElement>(null);
  const importer = () => ctaRef.current?.click();

  const OUTILS = [
    { cle: 'rta', href: '#/rta', icon: IconeRta, accent: COULEUR_SECTION.rta, rubrique: a.cartes.rta.rubrique, texte: v.outils.rta, exemple: <ExempleRta monstres={parCom2us} /> },
    { cle: 'recos', href: '#/siege/recommandations', icon: IconeRecos, accent: COULEUR_SIEGE_SUB.recos, rubrique: a.cartes.recos.rubrique, texte: v.outils.recos, exemple: <ExempleRecos monstres={parCom2us} liste={monstres} /> },
    { cle: 'optimizer', href: '#/outils/optimizer', icon: IconeOptimizer, accent: COULEUR_SECTION.outils, rubrique: a.cartes.optimizer.rubrique, texte: v.outils.optimizer, exemple: <ExempleOptimizer monstres={parCom2us} /> },
    { cle: 'speed', href: '#/outils/speed-tuning', icon: IconeSpeedTuning, accent: COULEUR_SECTION.outils, rubrique: a.cartes.speedTuning.rubrique, texte: v.outils.speed, exemple: <ExempleSpeed monstres={parCom2us} /> },
  ];

  return (
    // ⚠️ `@container` : les dispositions suivent la largeur RÉELLE de la page
    // (barre latérale ouverte ou repliée, écran partagé), pas celle de la
    // fenêtre — à 1366 px avec la barre, la page n'a plus que 1070 px.
    <motion.div variants={container} initial="hidden" animate="show" className="@container flex flex-col gap-6 pt-4 pb-6 max-lg:gap-4">
      {/* ---- Héros : le titre qui parle au joueur, les actions, la zone de dépôt */}
      <motion.header
        variants={item}
        // Deux colonnes seulement quand la page les tient (le nom sur une
        // ligne, les trois boutons sur une ligne) ; sinon le texte en pleine
        // largeur, puis la zone de dépôt, à l'horizontale.
        className="grid items-center gap-10 rounded-3xl border border-border-soft px-10 py-14 @[1200px]:grid-cols-[1.15fr_0.85fr]
                   max-lg:gap-6 max-lg:rounded-2xl max-lg:px-4 max-lg:py-7"
        // Deux lueurs de la palette (braise, violet du sombre) : l'ambiance,
        // sans couleur hors des jetons.
        style={{
          background:
            'radial-gradient(640px 360px at 6% 8%, rgb(var(--accent) / 0.14), transparent 70%),' +
            'radial-gradient(560px 340px at 96% 92%, rgb(var(--el-dark) / 0.12), transparent 70%), rgb(var(--panel))',
        }}
      >
        <div className="min-w-0">
          {/* ⚠️ Le logo et le NOM du site sont le titre : c'est la page
              d'entrée, le nom s'y lit en grand. L'accroche en sous-titre.
              Espace ORDINAIRE dans le nom : il passe sur deux lignes au
              téléphone plutôt que de déborder. */}
          <div className="flex items-center gap-3">
            <SymboleLogo className="h-[clamp(38px,6vw,64px)] w-[clamp(38px,6vw,64px)] flex-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />
            <h1 className={`${CLASSE_NOM} text-[clamp(32px,5vw,56px)] leading-[0.95] text-ink`}>{NOM_APP}</h1>
          </div>
          <p className="mt-3 max-w-lg font-display text-[clamp(18px,2.4vw,26px)] leading-tight tracking-wide text-ink">{a.accroche}</p>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-dim">
            {a.promesse}
            <b className="text-ink">{selonSupport(a.promesseNavigateur, a.promesseMachine)}</b>
            {a.promesseFin}
          </p>
          {/* ⚠️ Les boutons sur UNE ligne quand elle les tient, sinon un par
              ligne — jamais deux puis un (choix du mainteneur) : bascule par la
              largeur de la colonne (requête de conteneur), pas par `flex-wrap`. */}
          <div className="@container mt-6">
          <div className="flex flex-col items-stretch gap-2.5 @[640px]:flex-row @[640px]:items-center">
            <Bouton ton="accent" fond="plein" taille="lg" icone={<Download size={17} />} libelle={a.importerMonCompte} onClick={importer} />
            <Bouton taille="lg" href={LIEN_DISCORD} nouvelOnglet icone={<LogoDiscord size={17} />} libelle={a.rejoindreDiscord} data-discord-heros />
            {/* L'application de bureau : sur le SITE seulement. */}
            {!estBureau() && (
              <Bouton href="#/telecharger" fond="vide" trait="aucun" icone={<IconeTelecharger size={15} />} libelle={v.application} />
            )}
          </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <Dropzone onImport={onImport} />
          {/* Comment obtenir l'export : HORS de la zone de dépôt, qui est un
              bouton — un lien dedans serait un contrôle dans un contrôle. */}
          <p className="text-center text-sm text-ink-dim">
            {v.sansExport}{' '}
            <a href={SW_EXPORTER} target="_blank" rel="noreferrer" className="font-semibold text-accent-lisible hoverable:text-ink transition-colors">
              {v.swExporter}
            </a>
          </p>
        </div>
      </motion.header>

      {/* ---- Reprise (habitués) ------------------------------------------- */}
      {aDesDonnees && (
        <motion.section variants={item}>
          <SectionTitle icon={LayoutGrid} title={a.tonEspace} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Resume href="#/rta" icon={IconeRta} accent={COULEUR_SECTION.rta} value={stats.rta} unit={a.monstres(stats.rta)} label={a.prepaRta} />
            <Resume href="#/siege/defense" icon={IconeDefense} accent={COULEUR_SIEGE_SUB.defense} value={stats.defense} unit={a.equipes(stats.defense)} label={a.defenseSiege} />
            <Resume href="#/siege/offense" icon={IconeOffense} accent={COULEUR_SIEGE_SUB.offense} value={stats.offense} unit={a.equipes(stats.offense)} label={a.offenseSiege} />
            <Resume href="#/siege/recommandations" icon={IconeRecos} accent={COULEUR_SIEGE_SUB.recos} value={stats.recos} unit={a.recos(stats.recos)} label={a.recommandations} />
          </div>
        </motion.section>
      )}

      {/* ---- Les outils, montrés ------------------------------------------ */}
      <motion.section variants={item} id="features" className="px-2 py-10 max-lg:px-0 max-lg:py-4">
        <TitreSection debut={v.outilsTitre} accent={v.outilsAccent} />
        <p className="mx-auto mt-3 max-w-2xl text-center text-md text-ink-dim">{v.outilsChapeau}</p>
        <div className="mt-12 flex flex-col gap-16 max-lg:mt-6 max-lg:gap-10">
          {OUTILS.map((o, i) => (
            <Vitrine key={o.cle} {...o} inverse={i % 2 === 1} />
          ))}
        </div>
        {/* Les autres outils : une pastille chacun, dans l'ordre de la nav. */}
        <nav aria-label={a.fonctionnalites} className="mt-14 flex flex-wrap justify-center gap-2.5 max-lg:mt-8">
          <PastilleOutil href="#/rta/ami" icon={IconeAmi} accent={COULEUR_RTA_SUB.ami} titre={a.cartes.ami.titre} />
          <PastilleOutil href="#/siege/defense" icon={IconeSiege} accent={COULEUR_SECTION.siege} titre={a.cartes.siege.titre} />
          <PastilleOutil href="#/compte/runes" icon={IconeRunes} accent={COULEUR_COMPTE_SUB.runes} titre={a.cartes.runes.titre} />
          <PastilleOutil href="#/compte/artefacts" icon={IconeArtefacts} accent={COULEUR_COMPTE_SUB.artefacts} titre={a.cartes.artefacts.titre} />
          <PastilleOutil href="#/bestiary" icon={IconeBestiaire} accent={COULEUR_SECTION.bestiary} titre={a.cartes.bestiaire.titre} />
          <PastilleOutil href="#/mecaniques" icon={IconeMecaniques} accent={COULEUR_SECTION.mecaniques} titre={a.cartes.mecaniques.titre} />
          {!estBureau() && <PastilleOutil href="#/telecharger" icon={IconeTelecharger} accent={COULEUR_SECTION.telecharger} titre={a.application.titre} />}
          <PastilleOutil href="#/arene" icon={IconeArene} accent={COULEUR_SECTION.arene} titre={`${a.cartes.arene.titre}${a.bientot}`} attenue />
        </nav>
      </motion.section>

      {/* ---- La communauté ------------------------------------------------ */}
      {/* ⚠️ COMPACTE (le mainteneur : « trop grosse comparée au reste ») :
          trois cartes de même taille sur une rangée, sans grande bande ;
          le Discord se distingue par sa teinte, pas par sa taille. */}
      <motion.section variants={item} className="px-2 py-6 max-lg:px-0 max-lg:py-2">
        <h2 className="text-center font-display text-[clamp(22px,2.4vw,28px)] font-bold leading-tight text-ink">
          {v.commuTitre} <span className="text-accent-lisible">{v.commuAccent}</span>
        </h2>
        <div className="mt-5 grid gap-3 @[900px]:grid-cols-3" data-carte-discord>
          <div
            className="flex flex-col items-start gap-2 rounded-2xl border p-4"
            style={{
              background: 'radial-gradient(260px 140px at 100% 0%, rgb(var(--accent) / 0.16), transparent 70%), rgb(var(--accent-soft))',
              borderColor: 'rgb(var(--accent) / 0.4)',
            }}
          >
            <LogoDiscord size={26} className="text-accent-lisible" />
            <b className="text-md text-ink">{v.discordTitre(NOM_APP)}</b>
            <p className="text-sm text-ink-dim">{a.carteDiscord.texte}</p>
            <Bouton ton="accent" fond="plein" taille="sm" href={LIEN_DISCORD} nouvelOnglet icone={<LogoDiscord size={14} />} libelle={a.rejoindreDiscord} className="mt-auto max-lg:w-full" />
          </div>
          <div className="contents">
            <CarteCommu icon={IconeNouveautes} accent={COULEUR_SECTION.releases}>
              <b className="text-md text-ink">
                {libelleVersion(derniere.version, t.nouveautes.enPreparation)} · {derniere.title}
              </b>
              <p className="text-sm text-ink-dim">{v.nouveautesTexte}</p>
              <a href="#/releases" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-lisible hoverable:text-ink transition-colors">
                {a.voirNouveautes} <ArrowRight size={14} />
              </a>
            </CarteCommu>
            <CarteCommu icon={IconeGithub} accent={COULEUR_SECTION.mecaniques}>
              <b className="text-md text-ink">{v.githubTitre}</b>
              <p className="text-sm text-ink-dim">{v.githubTexte}</p>
              <a href={DEPOT_GITHUB} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-lisible hoverable:text-ink transition-colors">
                {v.voirGithub} <ArrowRight size={14} />
              </a>
            </CarteCommu>
          </div>
        </div>
      </motion.section>

      {/* ---- Dernier appel -------------------------------------------------- */}
      <motion.section variants={item} className="flex flex-col items-center gap-3 py-10 text-center max-lg:py-6">
        <h2 className="font-display text-[clamp(26px,3.4vw,38px)] font-bold leading-tight text-ink">{a.pretTitre}</h2>
        <p className="max-w-xl text-md text-ink-dim">{a.pretTexte}</p>
        <Bouton ton="accent" fond="plein" icone={<Download size={16} />} libelle={a.importerMonCompte} onClick={importer} className="mt-2 max-lg:w-full" />
        <input
          ref={ctaRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ''; // permet de recharger le même fichier
            if (f) f.text().then(onImport);
          }}
        />
      </motion.section>
    </motion.div>
  );
}

/* ---- Briques -------------------------------------------------------------- */

// Le titre d'une section de la vitrine : une phrase, la fin à l'accent.
function TitreSection({ debut, accent }: { debut: string; accent: string }) {
  return (
    <h2 className="text-center font-display text-[clamp(26px,3.4vw,38px)] font-bold leading-tight text-ink">
      {debut} <span className="text-accent-lisible">{accent}</span>
    </h2>
  );
}

// Un outil phare : le texte (tuile, rubrique, titre, phrase, puces, bouton) et
// son exemple, côte à côte à l'ordinateur — en alternance —, l'un sous
// l'autre au téléphone.
function Vitrine({
  href,
  icon: Icon,
  accent,
  rubrique,
  texte,
  exemple,
  inverse,
}: {
  href: string;
  icon: Icone;
  accent: string;
  rubrique: string;
  texte: { titre: string; texte: string; puces: string[]; aller: string };
  exemple: ReactNode;
  inverse: boolean;
}) {
  return (
    // ⚠️ `items-stretch` : l'exemple prend la hauteur du texte, et inversement
    // (choix du mainteneur : les deux de même taille, partout sur la page).
    // ⚠️ L'exemple prend les TROIS CINQUIÈMES : ce sont les vrais composants
    // des outils, pensés pour leur page — à mi-largeur, la carte de
    // recommandation tassait son en-tête de decks.
    <article
      className={`teinte-section grid items-stretch gap-10 max-lg:gap-5 ${
        inverse ? '@[900px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : '@[900px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'
      }`}
      style={varsTeinte(accent)}
    >
      <div className={`flex flex-col items-start justify-center gap-3 ${inverse ? '@[900px]:order-2' : ''}`}>
        <Tuile icon={Icon} accent={accent} grande />
        <span className="label" style={{ color: 'var(--teinte)' }}>{rubrique}</span>
        <h3 className="font-display text-[clamp(22px,2.4vw,30px)] font-bold leading-tight text-ink">{texte.titre}</h3>
        <p className="text-md leading-relaxed text-ink-dim">{texte.texte}</p>
        <ul className="flex flex-col gap-1.5">
          {texte.puces.map((p) => (
            <li key={p} className="flex items-baseline gap-2 text-sm text-ink-dim">
              <span className="h-1.5 w-1.5 flex-none -translate-y-0.5 rounded-sm" style={{ background: 'var(--teinte)' }} aria-hidden />
              {p}
            </li>
          ))}
        </ul>
        <Bouton href={href} icone={<ArrowRight size={15} />} libelle={texte.aller} className="mt-1 flex-row-reverse" />
      </div>
      <div
        className="relative overflow-hidden rounded-2xl border bg-panel p-5 max-lg:p-4"
        style={{ borderColor: 'color-mix(in srgb, var(--teinte) 35%, rgb(var(--border-soft)))' }}
      >
        <Halo accent={accent} />
        <div className="relative h-full">{exemple}</div>
      </div>
    </article>
  );
}

// Un autre outil, en pastille : la tuile ronde et le titre.
function PastilleOutil({ href, icon: Icon, accent, titre, attenue }: { href: string; icon: Icone; accent: string; titre: string; attenue?: boolean }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 rounded-full border border-border-soft bg-panel py-1.5 pl-1.5 pr-4 text-sm font-semibold text-ink
                  transition-colors hoverable:border-border hoverable:bg-panel2 ${attenue ? 'opacity-70' : ''}`}
    >
      <Tuile icon={Icon} accent={accent} ronde />
      {titre}
    </a>
  );
}

function CarteCommu({ icon, accent, children }: { icon: Icone; accent: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border border-border-soft bg-panel p-4">
      <Tuile icon={icon} accent={accent} />
      {children}
    </div>
  );
}

// GitHub, au trait comme les icônes de l'app (lucide `github`, sans le
// raccourci d'import : un seul usage ici).
function IconeGithub({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`flex-none ${className}`}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

// Zone de dépôt du fichier de compte, dans le héros, autour de la roue des
// runes du jeu.
//
// ⚠️ C'est le geste qui débloque tout l'outil : il ne doit pas être à chercher
// dans la barre de nav. Glisser-déposer ET clic — on ne sait pas lequel le
// visiteur tentera, et n'en proposer qu'un en laisse la moitié dehors.
function Dropzone({ onImport }: { onImport: (text: string) => void }) {
  const a = useTraduction().accueil;
  const ref = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);

  const lire = (f: File | undefined | null) => {
    if (!f) return;
    f.text().then(onImport);
  };

  return (
    <div
      id="depot"
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        lire(e.dataTransfer.files?.[0]);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ref.current?.click()}
      // ⚠️ À l'HORIZONTALE (roue à gauche, textes à droite) quand le héros
      // est sur une colonne et que la page a la place : debout, la zone
      // ferait 400 px de haut sous le texte. Debout au téléphone et dans la
      // colonne de droite du héros à deux colonnes.
      className={`flex cursor-pointer flex-col items-center justify-center gap-5 rounded-3xl border border-dashed px-6 py-8 text-center transition-colors
                  @[600px]:flex-row @[600px]:gap-8 @[1200px]:flex-col @[1200px]:gap-2.5
                  max-lg:rounded-2xl max-lg:py-6 ${
                    survol ? 'border-accent bg-panel2' : 'border-border bg-bg/70 hoverable:border-accent hoverable:bg-panel2'
                  }`}
    >
      {/* La roue des runes du jeu, telle quelle, dans une lueur de braise. */}
      <img
        src={`${import.meta.env.BASE_URL}rune-wheel.png`}
        alt=""
        className="h-auto w-[150px] flex-none max-lg:w-[120px] @[1200px]:w-[170px]"
        style={{ filter: 'drop-shadow(0 10px 26px rgb(var(--accent) / 0.45))' }}
      />
      <div className="flex flex-col items-center gap-2.5 @[600px]:items-start @[600px]:text-left @[1200px]:items-center @[1200px]:text-center">
        <div className="text-lg font-semibold text-ink">{a.deposerIci}</div>
        <div className="text-sm text-ink-dim">{a.cliquerPourParcourir}</div>
        <span className="rounded-full border border-border-soft bg-panel2 px-2.5 py-1 label">{a.exportSwex}</span>
        <span className="inline-flex items-center gap-1.5 text-micro text-ink-dim">
          <ShieldCheck size={12} /> {a.luDansLaPage}
        </span>
        {/* Les cinq éléments qui flottent (rendus du jeu, leur couleur reste). */}
        <div className="mt-1 flex items-center gap-3">
          {ELEMENT_ORDER.map((el, i) => (
            <motion.div key={el} animate={{ y: [0, -5, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}>
              <ElementIcon element={el} size={18} />
            </motion.div>
          ))}
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // permet de recharger le même fichier
          lire(f);
        }}
      />
    </div>
  );
}

// L'icône d'une carte, dans sa tuile, à la teinte de sa section.
// ⚠️ **Deux valeurs de la teinte, choisies en CSS selon le thème** : la
// couleur d'origine en sombre, sa variante assombrie en clair (`TEINTE_CLAIRE`).
// L'élément porte `teinte-section` et peint avec `var(--teinte)` — index.css.
function varsTeinte(accent: string): CSSProperties {
  return { '--teinte-sombre': accent, '--teinte-clair': TEINTE_CLAIRE[accent] ?? accent } as CSSProperties;
}

function Tuile({ icon: Icon, accent, grande, ronde }: { icon: Icone; accent: string; grande?: boolean; ronde?: boolean }) {
  return (
    <span
      className={`teinte-section flex flex-none items-center justify-center border ${
        grande ? 'h-11 w-11 rounded-xl' : ronde ? 'h-7 w-7 rounded-full' : 'h-8 w-8 rounded-lg'
      }`}
      style={{
        ...varsTeinte(accent),
        color: 'var(--teinte)',
        background: 'color-mix(in srgb, var(--teinte) 14%, transparent)',
        borderColor: 'color-mix(in srgb, var(--teinte) 32%, transparent)',
      }}
    >
      <Icon size={grande ? 21 : ronde ? 14 : 16} />
    </span>
  );
}

// Halo de la teinte, flouté dans le coin haut droit — l'identité colorée des
// cartes de l'accueil. Le parent doit être `relative overflow-hidden`.
function Halo({ accent }: { accent: string }) {
  return (
    <div
      aria-hidden
      className="teinte-section pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-20 blur-3xl"
      style={{ ...varsTeinte(accent), background: 'var(--teinte)' }}
    />
  );
}

function SectionTitle({ icon: Icon, title }: { icon: Icone; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={15} className="text-ink-dim" />
      <h2 className="font-display text-lg tracking-wide">{title}</h2>
    </div>
  );
}

// Tuile de reprise : le CHIFFRE d'abord, parce que c'est lui qu'on vient
// vérifier ; le lien mène directement dans la bonne sous-section.
function Resume({ href, icon, accent, value, unit, label }: { href: string; icon: Icone; accent: string; value: number; unit: string; label: string }) {
  return (
    <a
      href={href}
      // ⚠️ Une valeur à 0 est ATTÉNUÉE, pas masquée : sinon la rangée saute.
      className={`flex items-center gap-3 p-3 ${CARTE_LIEN} ${value === 0 ? 'opacity-60' : ''}`}
    >
      <Tuile icon={icon} accent={accent} />
      <div className="min-w-0">
        <div className="label truncate">{label}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[22px] font-bold leading-tight text-ink">{value}</span>
          <span className="text-micro text-ink-dim">{unit}</span>
        </div>
      </div>
    </a>
  );
}
