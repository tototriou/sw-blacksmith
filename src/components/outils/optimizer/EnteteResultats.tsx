import { useEffect, useRef, useState } from 'react';
import { Filter, PinOff } from 'lucide-react';
import HelpPopover from '../../HelpPopover';
import BoutonSensTri from '../../BoutonSensTri';
import { Bouton, Flottant, MobileSheet, Segmented, Selecteur } from '../../../ui';
import { COLONNES_RESULTATS, type ColonneResultat } from '../../../lib/colonnesResultats';
import type { BornesResultats } from '../../../lib/filtresResultats';
import type { FiltrePublie } from '../../../lib/classementCompact';
import type { OptimMetric } from '../../../lib/runeOptim';
import type { StatKey } from '../../../lib/effects';
import { colonnesBornees, libelleColonne, ligneDesComptes, resumeDesBornes } from '../../../lib/filtresAffichage';
import { type CompteConfirme, type CompteAffichable } from '../../../lib/artifactQueue';
import { type BilanRecherche } from '../../../hooks/useBuildOptimSearch';
import type { FormeResultats } from '../../../hooks/useFormeResultats';
import FiltresResultats, { BoutonEffacerFiltres } from './FiltresResultats';
import type { TriResultats } from './TetesDeTri';
import { INVISIBLE_AVEC_LE_TABLEAU, VISIBLE_AVEC_LE_TABLEAU } from './TableauResultats';
import { useLangue, useTraduction } from '../../../hooks/useLangue';
import { formatNombre } from '../../../i18n/format';

/** Les filtres d'affichage tels que l'en-tête les pose et les dit. */
export interface FiltresEntete {
  bornes: BornesResultats;
  poserBorne: (colonne: ColonneResultat, cote: 'min' | 'max', valeur: number | null) => void;
  effacer: () => void;
  // Ce que le classeur a publié : comptes de la vue, bornes actives.
  filtre: FiltrePublie | null;
  // « Stats de base exclues » de la grille (FiltresResultats.tsx) : le même
  // réglage d'affichage que « Stats totales / Stats bonus » du tableau.
  enBonus?: boolean;
  setBonus?: (bonus: boolean) => void;
  base?: Partial<Record<StatKey, number>>;
}

export interface EnteteResultatsProps {
  result: BilanRecherche | null;
  compteConfirmes: CompteConfirme;
  // Une file vérifie l'équipement (optimisation d'artéfacts active).
  avecFile: boolean;
  // Le tri affiché (colonne et sens) ; `trier` repart de la page 1.
  tri: TriResultats;
  trier: (suivant: TriResultats) => void;
  metric: OptimMetric;
  // Une colonne a-t-elle une valeur ? « Dégâts réels » exige un sort calculable.
  disponible: (colonne: ColonneResultat) => boolean;
  // Le reste de la file du classeur (instantané).
  enAttente: number;
  // Le classeur est perdu : la page affichée est la dernière reçue, sans geste possible.
  interrompu?: boolean;
  compteAffiche: CompteAffichable;
  // L'en-tête resserré du bureau (voir plus bas) ; le téléphone garde le sien.
  bureau?: boolean;
  filtres?: FiltresEntete;
  // Cartes ou tableau, au bureau seulement (le téléphone garde les cartes).
  forme?: FormeResultats;
  setForme?: (forme: FormeResultats) => void;
  // « Stats totales / Stats bonus » du tableau (bureau, forme tableau) : en
  // bonus, PV, ATQ, DEF et VIT sans la base du monstre. Un réglage
  // d'affichage, pas « Stats de base exclues ».
  bonus?: boolean;
  setBonus?: (bonus: boolean) => void;
  // « Libérer tous les builds épinglés » : toujours présent avec les
  // résultats, désactivé sans épinglé — épingler un build ne fait pas
  // apparaître un bouton qui décalerait l'en-tête. `demander` ouvre la
  // confirmation (OptimizerSection.tsx).
  libererEpingles?: { nombre: number; demander: () => void };
}

export default function EnteteResultats({ result, compteConfirmes, avecFile, tri, trier, metric, disponible, enAttente, interrompu = false,
  compteAffiche, bureau = false, filtres, forme = 'cartes', setForme, bonus = false, setBonus, libererEpingles }: EnteteResultatsProps) {
  // ⚠️ Le compte des CONFIRMÉES (`compteConfirmes`) : seulement les builds
  // vérifiés (résolus et conformes), un compte qui ne baisse jamais pendant
  // une recherche — les filtres d'affichage ne le changent pas, ils répartissent
  // les confirmées entre visibles et masquées. « Aucune combinaison… »
  // seulement quand tout est vérifié sans aucune confirmée. Avec une file, le
  // compte des trouvées (`compteAffiche`, celui de la ligne de progression)
  // suit tant qu'il en reste à vérifier : une fois tout vérifié, les deux
  // nombres sont égaux et le « sur M » se retire, comme sans file.
  const textes = useTraduction();
  const langue = useLangue();
  const r = textes.optimizer.resultats;
  const n = (v: number) => formatNombre(v, langue);
  const resteAVerifier = !result || compteConfirmes.nonVerifies > 0;
  const confirmees = r.confirmees(n(compteConfirmes.confirmees))
    + (avecFile && resteAVerifier ? r.surTrouvees(n(compteAffiche.compte)) : '');
  const compte = (
    <p className="label">
      {result
        ? compteConfirmes.aucune
          ? r.aucune
          : confirmees
        : r.enCours(confirmees)}
    </p>
  );
  // Seulement quand une file vérifie : sans elle, confirmées et trouvées sont
  // le même nombre.
  const aide = avecFile && !compteConfirmes.aucune && (
    <HelpPopover title={r.aideConfirmees.titre}>
      {r.aideConfirmees.debut}<b className="text-ink">{r.aideConfirmees.confirmee}</b>{r.aideConfirmees.suite}
      <br />
      <br />
      {r.aideConfirmees.trouvees}
      <br />
      <br />
      {r.aideConfirmees.ordre}
    </HelpPopover>
  );
  // Masqués seulement quand tout est vérifié sans aucune confirmée : le tri et
  // les filtres réordonnent et masquent les combinaisons confirmées ; ils ne
  // résolvent aucun équipement.
  const reglable = !compteConfirmes.aucune;

  // Au téléphone, le tri garde sa liste et prend le sens à côté : la bande de
  // onze têtes y ferait quatre lignes de 40 px. Une autre colonne repart en
  // décroissant, comme une autre tête au bureau.
  const triTelephone = reglable && (
    <div className="flex items-center gap-1.5">
      <Selecteur
        value={tri.tri}
        onChange={(e) => trier({ tri: e.target.value as ColonneResultat, sens: 'desc' })}
        disabled={interrompu}
        taille="sm"
        surface="panel"
        pleineLargeur={false}
        aria-label={r.trierResultats}
      >
        <optgroup label={r.groupeStats}>
          {COLONNES_RESULTATS.slice(0, 8).map((c) => (
            <option key={c} value={c}>
              {r.trierPar(libelleColonne(c, metric, textes))}
            </option>
          ))}
        </optgroup>
        <optgroup label={r.groupeObjectifs}>
          {/* ⚠️ « Dégâts réels » n'est proposé que si un sort est
              réellement calculable pour ce monstre. Vitesse n'est pas un
              tri : la colonne VIT, dans le groupe « Stats ». */}
          {COLONNES_RESULTATS.slice(8).filter(disponible).map((c) => (
            <option key={c} value={c}>
              {libelleColonne(c, metric, textes)}
            </option>
          ))}
        </optgroup>
      </Selecteur>
      <BoutonSensTri sens={tri.sens} onChange={(sens) => trier({ tri: tri.tri, sens })} />
    </div>
  );

  // Combien la file doit encore vérifier : les builds des places en attente
  // de la page, puis l'avance de fond vers K confirmées — le compte ci-dessus
  // les inclut, la page ne les montre qu'une fois vérifiés. `enAttente` est le
  // reste de la file, tenu par le hook pour l'affichage. ⚠️ Ligne TOUJOURS
  // présente quand la file tourne : quand elle se vide, l'espace insécable
  // garde sa hauteur, et la grille ne remonte pas.
  // ⚠️ Classeur perdu : la même place porte l'avis de page interrompue, même
  // sans file — rien ne bouge sous la ligne qui l'annonce.
  const ligneFile = avecFile || interrompu;
  const tonLigne = interrompu ? 'text-bad' : 'text-ink-dim';
  const enVerification = interrompu
    ? r.interrompu
    : enAttente > 0
      ? r.enVerification(n(enAttente))
      : ' ';

  // ── Filtres d'affichage ────────────────────────────────────────────────
  const [ouvert, setOuvert] = useState(false);
  const ancre = useRef<HTMLDivElement>(null);
  // Le flottant du bureau se ferme au clic dehors et à Échap, comme les autres
  // surfaces ancrées de l'Optimizer ; le panneau du téléphone porte sa croix.
  useEffect(() => {
    if (!ouvert || !bureau) return;
    const dehors = (e: MouseEvent) => { if (!ancre.current?.contains(e.target as Node)) setOuvert(false); };
    const clavier = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', dehors); document.addEventListener('keydown', clavier);
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', clavier); };
  }, [ouvert, bureau]);
  const posees = filtres ? colonnesBornees(filtres.bornes).length : 0;
  const libelleFiltrer = `${r.filtrer}${posees ? ` (${posees})` : ''}`;
  const grille = filtres && (
    <FiltresResultats bornes={filtres.bornes} poserBorne={filtres.poserBorne} effacer={filtres.effacer} metric={metric} disponible={disponible}
      enBonus={filtres.enBonus} setBonus={filtres.setBonus} base={filtres.base} />
  );
  // Ligne de comptes TOUJOURS présente (« Aucun filtre » sans borne) : poser
  // une borne n'ajoute pas de ligne au-dessus des cartes, et rien ne descend.
  const actives = filtres?.filtre?.bornes.actives.length ?? 0;
  const resume = filtres ? resumeDesBornes(filtres.bornes, metric, disponible, textes) : '';
  const comptes = ligneDesComptes(filtres?.filtre?.comptes ?? null, actives, !bureau, textes);

  const boutonFiltrerBureau = filtres && reglable && (
    // Sous le tableau large, sa ligne de bornes remplace le flottant : le
    // bouton ne sert qu'aux cartes ; avec le tableau, il s'efface sans rendre
    // sa place (`INVISIBLE_AVEC_LE_TABLEAU`, voir la place partagée plus bas).
    <div className={`relative col-start-1 row-start-1 ${forme === 'tableau' ? INVISIBLE_AVEC_LE_TABLEAU : ''}`} ref={ancre}>
      <Bouton
        taille="sm"
        icone={<Filter size={13} />}
        libelle={libelleFiltrer}
        disabled={interrompu}
        aria-expanded={ouvert}
        aria-haspopup="dialog"
        onClick={() => setOuvert((o) => !o)}
      />
      {ouvert && (
        <Flottant rembourrage="md" ancrage="dessous" cote="droite" largeur="w-auto" role="dialog" aria-label={r.filtrer}>
          <p className="label mb-1">{r.filtrer}</p>
          {grille}
        </Flottant>
      )}
    </div>
  );

  // Deux lignes au plus (`max-w`) : le libellé est long, l'en-tête du bureau
  // tient sur une rangée.
  const boutonLibererEpingles = libererEpingles && (
    <Bouton
      taille="sm"
      icone={<PinOff size={13} />}
      libelle={<span className="block max-w-[9rem] whitespace-normal text-left leading-tight">{textes.optimizer.section.libererEpingles}</span>}
      aria-label={textes.optimizer.section.libererEpingles}
      disabled={libererEpingles.nombre === 0}
      onClick={libererEpingles.demander}
      pleineLargeur={!bureau}
      data-liberer-epingles=""
    />
  );

  return (
    <>
      {bureau ? (
        // ⚠️ **Au bureau, l'en-tête tient sur une rangée** (décision de
        // l'utilisateur : la première carte remonte) : à gauche le compte et,
        // SOUS lui, la ligne « en vérification » (sa place reste réservée,
        // même vide), l'aide à leur droite ; à droite la forme (cartes ou
        // tableau), « Filtrer l'affichage » ou « Stats totales / Stats bonus »
        // (une seule place pour les deux), et « Effacer les filtres ».
        // Quand la colonne est étroite, la rangée passe à la ligne d'elle-même :
        // ce passage ne dépend que de la largeur, jamais d'un clic.
        <>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col">
                {compte}
                {ligneFile && <p className={`text-xs leading-4 ${tonLigne}`}>{enVerification}</p>}
              </div>
              {aide}
            </div>
            {reglable && (
              <div className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                {setForme && (
                  <Segmented<FormeResultats>
                    options={[{ key: 'cartes', label: r.cartes }, { key: 'tableau', label: r.tableau }]}
                    value={forme}
                    onChange={setForme}
                    disabled={interrompu}
                  />
                )}
                {/* ⚠️ **Une place partagée, de largeur fixe** : « Filtrer
                    l'affichage » (les cartes) et « Stats totales / Stats
                    bonus » (le tableau) y sont TOUS LES DEUX, superposés dans
                    la même case de grille, l'un invisible. La place vaut la
                    plus large des deux quelle que soit la forme : choisir
                    « Cartes » ou « Tableau » ne déplace ni le choix cliqué, ni
                    rien d'autre, et ne fait jamais passer la rangée à la ligne. */}
                {/* À gauche de « Filtrer l'affichage » (cartes) ou de « Stats
                    totales / Stats bonus » (tableau) : la même place dans les
                    deux formes. */}
                {boutonLibererEpingles}
                <div className="grid items-center justify-items-start" data-place-forme="">
                  {boutonFiltrerBureau}
                  {setBonus && (
                    // Deux choix exclusifs, de la forme du choix cartes / tableau voisin.
                    <div className={`col-start-1 row-start-1 ${forme === 'tableau' ? VISIBLE_AVEC_LE_TABLEAU : 'invisible'}`}>
                      <Segmented<'total' | 'bonus'>
                        options={[
                          { key: 'total', label: r.statsTotales, hint: r.statsTotalesAide },
                          { key: 'bonus', label: r.statsBonus, hint: r.statsBonusAide },
                        ]}
                        value={bonus ? 'bonus' : 'total'}
                        onChange={(v) => setBonus(v === 'bonus')}
                        disabled={interrompu}
                      />
                    </div>
                  )}
                </div>
                {filtres && <BoutonEffacerFiltres effacer={filtres.effacer} actif={posees > 0 && !interrompu} />}
              </div>
            )}
          </div>
          {filtres && reglable && (
            <p className="mb-2 truncate text-xs leading-4 text-ink-dim" title={resume || undefined} data-ligne-comptes="">
              <span className="text-ink">{comptes}</span>
              {resume && <> — {resume}</>}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              {compte}
              {aide}
            </div>
            {triTelephone}
          </div>
          {ligneFile && <p className={`mb-2 text-xs ${tonLigne}`}>{enVerification}</p>}
          {filtres && reglable && (
            <>
              <div className="mb-2 text-xs leading-4 text-ink-dim" data-ligne-comptes="">
                <p className="text-ink">{comptes}</p>
                {resume && <p className="truncate" title={resume}>{resume}</p>}
              </div>
              {/* Au téléphone, « Libérer tous les builds épinglés » à gauche de
                  « Filtrer l'affichage », les deux à parts égales. */}
              <div className="mb-3 flex items-stretch gap-2">
                {boutonLibererEpingles && <div className="flex min-w-0 flex-1">{boutonLibererEpingles}</div>}
                <div className="flex min-w-0 flex-1">
                  <Bouton taille="md" pleineLargeur icone={<Filter size={15} />} libelle={libelleFiltrer}
                    disabled={interrompu} onClick={() => setOuvert(true)} />
                </div>
              </div>
              <MobileSheet ouvert={ouvert} onFermer={() => setOuvert(false)} titre={r.filtrer}>
                {grille}
              </MobileSheet>
            </>
          )}
        </>
      )}

      {/* ⚠️ Zéro dû aux seuls builds écartés par la résolution :
          le moteur a trouvé, aucun couple réel ne tient. Sous « Aucune combinaison… » seulement — tout vérifié, aucune
          confirmée —, la ligne qu'elle explique. Les blocs ci-dessous
          (diagnostic, « suffirait ») gardent leur condition, moteur vide :
          leurs chiffres viennent des bornes du moteur. */}
      {compteConfirmes.aucune && compteAffiche.raison && (
        <p className="mb-3 text-xs text-ink-dim">{compteAffiche.raison}</p>
      )}
    </>
  );
}
