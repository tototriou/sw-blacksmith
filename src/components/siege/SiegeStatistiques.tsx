// Siège › Statistiques (#/siege/statistiques) : les sièges relevés par le
// plugin SWEX, lus par l'application de bureau (docs/02-app/siege/statistiques.md).
//
// ⚠️ **Rien de calculé ici** : tout vient de src/lib/siegeStatistiques.ts. Le
// composant choisit un siège, un angle (la guilde, un membre) et, dans cet
// angle, une vue (d'ensemble : chiffres et graphes ; détail : les combats et
// les défenses, filtrables), et affiche.
//
// ⚠️ **Un seul JSX pour les deux formats** : tuiles et lignes passent à la
// ligne d'elles-mêmes (`flex-wrap`, une base de largeur) — côte à côte à la
// souris, empilées au doigt. Aucune requête de largeur, aucun tableau qui
// déborderait d'un écran de téléphone.
//
// ⚠️ **Rien d'inventé** : ce que le jeu n'a pas montré reste absent, et la
// page dit pourquoi (`manquesDuSiege`, « monstres non vus en jeu »).

import { ReactNode, memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ListPlus, UserMinus } from 'lucide-react';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import { useSiegesSwex } from '../../hooks/useSiegesSwex';
import { useDiscord } from '../../hooks/useDiscord';
import { formatDate, formatDateHeure, formatNombre } from '../../i18n/format';
import {
  anciensMembres,
  attaquesDuJoueur,
  bilanDesCombats,
  bilanParJoueur,
  combatsDeLaGuilde,
  combatsParSiege,
  couleurDePosition,
  maPosition,
  guildeDe,
  guildesDesSieges,
  tourDeBase,
  type InfoGuilde,
  DEFENSES_PAR_PAGE,
  pageDe,
  pagesDeCombats,
  type CombatsDuSiege,
  defensesAdverses,
  defensesDeLaGuilde,
  defensesDuJoueur,
  FILTRE_VIDE,
  filtreActif,
  filtrerDefenses,
  manquesDuSiege,
  monstresDuSiege,
  nomDuJoueur,
  siegeFini,
  siegesCumules,
  TOUS_LES_SIEGES,
  type AttaqueSiege,
  type BilanSaison,
  type DefenseCombats,
  type FiltreSiege,
  type RelevesSiege,
  type SiegeReleve,
} from '../../lib/siegeStatistiques';
import type { Monster } from '../../types';
import ComingSoon from '../../pages/ComingSoon';
import MonsterAvatar from '../MonsterAvatar';
import MonsterPicker from '../MonsterPicker';
import { IconeStatistiques } from '../IconesAtelier';
import { Bloc, EcussonTour, Equipe, Tuile, type ParCom2us } from './SiegeStatsElements';
import SiegeVueEnsemble from './SiegeVueEnsemble';
import SiegeVueMembre from './SiegeVueMembre';
import Pager from '../account/Pager';
import { FOND_GUILDE, TEXTE_GUILDE } from './SiegeGraphes';
import SiegeComparatif from './SiegeComparatif';
import { Bouton, BoutonIcone, Jeton, Segmented, Selecteur, ZoneCliquable } from '../../ui';
import { raisonNonAjoutable, trioDe, type OffenseAAjouter } from '../../lib/ajoutOffenseReco';
import AjoutOffenseReco, { type RecosPourAjout } from './AjoutOffenseReco';

export type AngleStats = 'guilde' | 'membre';
export type VueStats = 'ensemble' | 'detail';

export default function SiegeStatistiques({ monsters, recos }: { monsters: Monster[]; recos: RecosPourAjout }) {
  const textes = useTraduction();
  const s = textes.siegeStats;
  const etat = useSiegesSwex();

  if (etat.etat === 'site') {
    return (
      <>
        <ComingSoon title={textes.navigation.statistiquesSiege} icon={IconeStatistiques} description={s.site} />
        <p className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
          <a href="#/telecharger" className="text-accent transition hoverable:text-ink">
            {s.telechargerApp}
          </a>
          <a href="#/sw-exporter" className="text-accent transition hoverable:text-ink">
            {s.pagePlugin}
          </a>
        </p>
      </>
    );
  }
  if (etat.etat === 'chargement') return <p className="mt-4 text-sm text-ink-dim">{s.chargement}</p>;
  if (!etat.releves) return <Note>{s.sansPlugin}</Note>;
  if (etat.releves.sieges.length === 0) return <Note>{s.aucunSiege}</Note>;
  return <Releves releves={etat.releves} monsters={monsters} recos={recos} />;
}

// Le contenu, une fois les sièges lus. Exporté pour les tests de rendu.
export function Releves({
  releves,
  monsters,
  recos,
  maintenant = Date.now() / 1000,
  angleDepart = 'guilde',
  vueDepart = 'ensemble',
  siegeDepart = TOUS_LES_SIEGES,
}: {
  releves: RelevesSiege;
  monsters: Monster[];
  // Un combat gagné s'ajoute à une recommandation (AjoutOffenseReco.tsx).
  recos: RecosPourAjout;
  maintenant?: number;
  // L'angle et la vue à l'ouverture (les tests de rendu ouvrent les quatre).
  angleDepart?: AngleStats;
  vueDepart?: VueStats;
  // Le siège à l'ouverture : tous les sièges, cumulés (choix de
  // l'utilisateur) ; les tests de rendu ouvrent aussi un siège seul.
  siegeDepart?: number;
}) {
  const textes = useTraduction();
  const langue = useLangue();
  const s = textes.siegeStats;
  const [matchId, setMatchId] = useState(siegeDepart);
  // La vue d'ensemble de la guilde d'abord : c'est la première page de la
  // sous-section.
  const [angle, setAngle] = useState<AngleStats>(angleDepart);
  const [vue, setVue] = useState<VueStats>(vueDepart);
  const [joueur, setJoueur] = useState(releves.moi);
  // Les filtres des combats et des défenses ; ils restent d'un siège à l'autre.
  const [filtre, setFiltre] = useState<FiltreSiege>(FILTRE_VIDE);
  // Le combat dont on ajoute l'offense à une recommandation. Le setter est
  // stable : les cartes de combat, mémorisées, ne se redessinent pas pour lui.
  const [combatAjout, setCombatAjout] = useState<OffenseAAjouter | null>(null);
  // ⚠️ **Discord en arrière-plan** : les recommandations partagées viennent
  // des salons. Discord activé, la page les lit à son ouverture, comme la page
  // Recommandations — la fenêtre d'ajout les propose déjà. Éteint, rien ne part
  // (useDiscord.ts) : la fenêtre renvoie à la connexion.
  const discord = useDiscord(recos);
  // « Tous les sièges » : un siège cumulé (`siegesCumules`), que chaque vue lit
  // comme les autres.
  const cumul = useMemo(() => siegesCumules(releves), [releves]);
  // Un siège qui n'est plus relevé (dossier changé) : le plus récent.
  const siegeDe = (id: number) => (id === TOUS_LES_SIEGES ? cumul : null) ?? releves.sieges.find((x) => x.matchId === id) ?? releves.sieges[0];
  const siegeChoisi = siegeDe(matchId);
  useEffect(() => {
    if (siegeChoisi.matchId !== matchId) setMatchId(siegeChoisi.matchId);
  }, [siegeChoisi.matchId, matchId]);

  // ⚠️ **Fluide à tout instant** : les contrôles (siège, angle, vue, membre,
  // filtres) suivent le geste tout de suite ; le CONTENU suit le choix en
  // différé (`useDeferredValue`) — React le recalcule sans bloquer la page, et
  // le contenu encore à l'ancien choix pâlit le temps qu'il arrive.
  const choix = useMemo(() => ({ matchId, angle, vue, joueur, filtre }), [matchId, angle, vue, joueur, filtre]);
  const affiche = useDeferredValue(choix);
  const enRetard = affiche !== choix;
  const siege = siegeDe(affiche.matchId);
  const tous = siege.matchId === TOUS_LES_SIEGES;

  const parCom2us: ParCom2us = useMemo(() => {
    const m: ParCom2us = new Map();
    for (const mon of monsters) if (mon.com2usId != null && !m.has(mon.com2usId)) m.set(mon.com2usId, mon);
    return m;
  }, [monsters]);
  // Ma guilde par son identifiant : le siège cumulé n'a pas de liste de guildes.
  const maGuilde = releves.maGuilde;
  const membres = useMemo(
    () => (releves.maGuilde === null ? [] : bilanParJoueur(siege, releves.maGuilde)),
    [siege, releves.maGuilde]
  );
  const fini = siegeFini(siege, maintenant);
  // « Tous les sièges » : les anciens membres se distinguent des actuels
  // (tableaux, cartes, sélecteur). Dans un siège seul, chacun était membre.
  const anciens = useMemo(() => (tous ? anciensMembres(releves) : new Set<number>()), [tous, releves]);
  const listeMembres = membres.length ? membres.map((m) => m.joueur) : siege.joueurs;

  // Le détail : les combats siège par siège (un seul groupe pour un siège
  // seul), et les défenses — calculés seulement quand le détail s'affiche.
  const detail = useMemo(() => {
    if (affiche.vue !== 'detail') return null;
    const sieges = tous ? releves.sieges : [siege];
    if (affiche.angle === 'guilde') {
      if (maGuilde === null) return null;
      return {
        combats: combatsParSiege(sieges, (x) => combatsDeLaGuilde(x, maGuilde), affiche.filtre),
        defenses: defensesDeLaGuilde(siege, maGuilde),
        adverses: defensesAdverses(siege, maGuilde),
      };
    }
    return {
      combats: combatsParSiege(sieges, (x) => attaquesDuJoueur(x, affiche.joueur, maGuilde), affiche.filtre),
      defenses: defensesDuJoueur(siege, affiche.joueur, maGuilde),
      adverses: [],
    };
  }, [affiche, tous, siege, releves.sieges, maGuilde]);
  // Le nom et la couleur de chaque guilde, pour la nommer à côté d'un joueur
  // (le cumul n'a pas de liste de guildes).
  const guildesConnues = useMemo(() => guildesDesSieges(releves.sieges), [releves.sieges]);
  // Un autre siège, angle, membre ou filtre : retour à la première page.
  const clePages = `${siege.matchId}-${affiche.angle}-${affiche.joueur}-${JSON.stringify(affiche.filtre)}`;

  // Un siège dans la liste : sa date et ses adversaires (« en cours » s'il
  // n'est pas fini) — c'est ainsi qu'on le reconnaît, pas à ses points.
  const libelleSiege = (x: SiegeReleve) => {
    const date = x.debut !== null ? formatDate(x.debut * 1000, langue, { weekday: 'short', day: 'numeric', month: 'short' }) : String(x.siegeId);
    const adversaires = x.guildes.filter((g) => !g.mienne && g.nom).map((g) => g.nom);
    return [date, adversaires.length ? s.contreGuildes(adversaires) : null, siegeFini(x, maintenant) ? null : s.enCours].filter(Boolean).join(' · ');
  };

  // Un nom cliqué ouvre la vue d'ensemble du membre.
  const voirJoueur = (id: number) => {
    setJoueur(id);
    setAngle('membre');
    setVue('ensemble');
  };

  return (
    <div className="mt-4 flex flex-col gap-5">
      {releves.saison?.courante && <Saison saison={releves.saison.courante} meilleure={releves.saison.meilleure} />}

      <div className="flex flex-wrap items-center gap-2">
        <Selecteur aria-label={s.choixSiege} value={String(siegeChoisi.matchId)} onChange={(e) => setMatchId(Number(e.target.value))}>
          <option value={String(TOUS_LES_SIEGES)}>{s.tousLesSieges(releves.sieges.length)}</option>
          {releves.sieges.map((x) => (
            <option key={x.matchId} value={String(x.matchId)}>
              {libelleSiege(x)}
            </option>
          ))}
        </Selecteur>
        <Segmented<AngleStats>
          value={angle}
          onChange={setAngle}
          options={[
            { key: 'guilde', label: s.angles.guilde },
            { key: 'membre', label: s.angles.membre },
          ]}
        />
        <Segmented<VueStats>
          value={vue}
          onChange={setVue}
          options={[
            { key: 'ensemble', label: s.vues.ensemble },
            { key: 'detail', label: s.vues.detail },
          ]}
        />
        {angle === 'membre' && (
          <Selecteur aria-label={s.choixJoueur} value={String(joueur)} onChange={(e) => setJoueur(Number(e.target.value))}>
            {/* Les membres actuels, puis les anciens, à part. */}
            {listeMembres
              .filter((j) => !anciens.has(j.id))
              .map((j) => (
                <option key={j.id} value={String(j.id)}>
                  {j.nom || s.joueurInconnu}
                </option>
              ))}
            {anciens.size > 0 && (
              <optgroup label={s.anciensMembres}>
                {listeMembres
                  .filter((j) => anciens.has(j.id))
                  .map((j) => (
                    <option key={j.id} value={String(j.id)}>
                      {j.nom || s.joueurInconnu}
                    </option>
                  ))}
              </optgroup>
            )}
          </Selecteur>
        )}
      </div>

      {tous && !siege.sources.resume && <p className={`-mt-3 text-xs text-ink-dim ${PALIT(enRetard)}`}>{s.cumulIncomplet}</p>}
      {!tous && manquesDuSiege(siege, maintenant).map((m) => (
        <p key={m} className={`-mt-3 text-xs text-ink-dim ${PALIT(enRetard)}`}>
          {s.manques[m]}
        </p>
      ))}

      {/* Le score et le rang du siège sont ceux de la guilde : pas sous l'angle
          « Membre », où ils prendraient la place du membre. */}
      {/* Les guildes du siège, en tête du détail ; dans la vue d'ensemble,
          elles viennent sous nos chiffres (SiegeVueEnsemble). */}
      {affiche.angle === 'guilde' && affiche.vue === 'detail' && siege.guildes.length > 0 && maGuilde !== null && (
        <div className={PALIT(enRetard)}>
          <SiegeComparatif siege={siege} maGuilde={maGuilde} fini={fini} />
        </div>
      )}

      {/* Les filtres servent le détail : les combats et les défenses. Ce sont
          des contrôles : ils suivent le choix immédiat. */}
      {vue === 'detail' && <Filtres siege={siege} filtre={filtre} onFiltre={setFiltre} parCom2us={parCom2us} />}

      <div className={`flex flex-col gap-5 ${PALIT(enRetard)}`}>
      {affiche.vue === 'ensemble' ? (
        affiche.angle === 'guilde' ? (
          <SiegeVueEnsemble siege={siege} releves={releves} parCom2us={parCom2us} anciens={anciens} fini={fini} onJoueur={voirJoueur} onSiege={setMatchId} />
        ) : (
          <SiegeVueMembre siege={siege} releves={releves} joueur={affiche.joueur} parCom2us={parCom2us} />
        )
      ) : affiche.angle === 'guilde' ? (
        <>
          {/* Les membres actuels, puis les anciens dans leur propre grille. */}
          {[
            { titre: s.membresTitre, liste: membres.filter((m) => !anciens.has(m.joueur.id)) },
            { titre: s.anciensMembres, liste: membres.filter((m) => anciens.has(m.joueur.id)) },
          ].map(({ titre, liste }) =>
            liste.length > 0 && (
            <Grille key={titre} titre={titre} largeur="petite">
              {liste.map((m) => (
                <ZoneCliquable
                  key={m.joueur.id}
                  onClick={() => voirJoueur(m.joueur.id)}
                  title={[
                    s.voirJoueur(m.joueur.nom),
                    ...(anciens.has(m.joueur.id) ? [s.ancienMembre] : []),
                    s.attaques(m.attaques),
                    s.victoires(m.victoires),
                    s.defaites(m.defaites),
                    m.monstresUtilises !== null ? s.monstres(m.monstresUtilises) : s.monstresInconnus,
                    m.decks !== null ? s.decksEnDefense(m.decks) : s.defensesInconnues,
                    ...(m.enDefense ? [s.defensesTenues(m.enDefense.tenus, m.enDefense.n)] : []),
                  ].join('\n')}
                  className={`${CARTE} hoverable:border-accent ${m.joueur.id === releves.moi ? 'border-accent bg-accent-soft' : ''}`}
                >
                  <span className={`block truncate text-sm ${anciens.has(m.joueur.id) ? 'text-ink-dim' : 'text-ink'}`}>
                    {anciens.has(m.joueur.id) && <UserMinus size={12} aria-hidden="true" className="mr-1 inline-block align-[-1px]" />}
                    {m.joueur.nom || s.joueurInconnu}
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs tabular-nums text-ink-dim">
                    <span className="text-ink">{s.abr.attaques(m.attaques)}</span>
                    <span className="text-good">{s.abr.victoires(m.victoires)}</span>
                    <span className="text-bad">{s.abr.defaites(m.defaites)}</span>
                    {m.enDefense && m.enDefense.n > 0 && <span>{s.abr.tenues(m.enDefense.tenus, m.enDefense.n)}</span>}
                  </span>
                </ZoneCliquable>
              ))}
            </Grille>
            )
          )}
          {detail && (
            <>
              <Combats key={clePages} titre={s.combatsTitre} aide={s.combatsAide} groupes={detail.combats} plusieurs={tous} libelleSiege={libelleSiege}
                guildes={guildesConnues} parCom2us={parCom2us} filtre={affiche.filtre} vide={s.aucunCombat} onAjouterReco={setCombatAjout} avecAttaquant />
              <Defenses key={`d-${clePages}`} titre={s.defensesTitre} siege={siege} defenses={detail.defenses} guildes={guildesConnues} parCom2us={parCom2us} filtre={affiche.filtre} avecJoueur />
              <Defenses key={`a-${clePages}`} titre={s.defensesAdversesTitre} siege={siege} defenses={detail.adverses} guildes={guildesConnues} parCom2us={parCom2us} filtre={affiche.filtre} avecJoueur />
            </>
          )}
        </>
      ) : (
        detail && (
          <>
            <Combats key={clePages} titre={s.attaquesTitre} groupes={detail.combats} plusieurs={tous} libelleSiege={libelleSiege}
              guildes={guildesConnues} parCom2us={parCom2us} filtre={affiche.filtre} vide={s.aucuneAttaque} onAjouterReco={setCombatAjout} />
            <Defenses key={`d-${clePages}`} titre={s.defensesTitre} siege={siege} defenses={detail.defenses} guildes={guildesConnues} parCom2us={parCom2us} filtre={affiche.filtre} />
          </>
        )
      )}
      </div>
      {combatAjout && (
        <AjoutOffenseReco ajout={combatAjout} recos={recos} parCom2us={parCom2us} statutDiscord={discord.etat.statut} onClose={() => setCombatAjout(null)} />
      )}
    </div>
  );
}

function Saison({ saison, meilleure }: { saison: BilanSaison; meilleure: BilanSaison | null }) {
  const textes = useTraduction();
  const langue = useLangue();
  const s = textes.siegeStats;
  const nombre = (n: number) => formatNombre(n, langue, { maximumFractionDigits: 1 });
  return (
    <Bloc titre={s.saison(saison.numero)}>
      <div className="flex flex-wrap gap-x-6 gap-y-3 px-4 py-3">
        <Tuile libelle={s.classement} valeur={saison.classement !== null ? s.place(saison.classement) : '—'}
          detail={saison.nbGuildes !== null ? s.surGuildes(nombre(saison.nbGuildes)) : undefined} />
        {saison.score !== null && <Tuile libelle={s.score} valeur={nombre(saison.score)} />}
        <Tuile
          libelle={s.resultat}
          valeur={
            <>
              <span className="text-good">{saison.victoires}</span>
              <span className="text-ink-dimmer"> / </span>
              <span>{saison.nuls}</span>
              <span className="text-ink-dimmer"> / </span>
              <span className="text-bad">{saison.defaites}</span>
            </>
          }
          detail={[s.victoires(saison.victoires), s.nuls(saison.nuls), s.defaites(saison.defaites)].join(' · ')}
        />
        {saison.tauxVictoire !== null && <Tuile libelle={s.tauxVictoire} valeur={`${nombre(saison.tauxVictoire)} %`} />}
      </div>
      {meilleure?.classement != null && (
        <p className="px-4 pb-3 text-xs text-ink-dim">{s.meilleur(meilleure.numero, s.place(meilleure.classement))}</p>
      )}
    </Bloc>
  );
}


// Les filtres des combats et des défenses : le résultat, des monstres (qui
// doivent TOUS être dans l'équipe), et le côté où les chercher. Les monstres
// proposés sont ceux vus dans ce siège, les plus fréquents d'abord.
// ⚠️ Le côté reste affiché sans monstre choisi, désactivé : il n'a de sens
// qu'avec un monstre, et le retirer du rendu ferait bouger la barre.
function Filtres({
  siege,
  filtre,
  onFiltre,
  parCom2us,
}: {
  siege: SiegeReleve;
  filtre: FiltreSiege;
  onFiltre: (f: FiltreSiege) => void;
  parCom2us: ParCom2us;
}) {
  const f = useTraduction().siegeStats.filtres;
  const proposes = useMemo(
    () => monstresDuSiege(siege).flatMap((id) => (parCom2us.has(id) ? [parCom2us.get(id)!] : [])),
    [siege, parCom2us]
  );
  const choisis = filtre.monstres.map((id) => ({ id, monstre: parCom2us.get(id) ?? null }));
  // Mémorisé : un nouvel ensemble à chaque rendu relancerait la recherche du sélecteur.
  const exclus = useMemo(
    () => new Set(filtre.monstres.flatMap((id) => (parCom2us.has(id) ? [String(parCom2us.get(id)!.id)] : []))),
    [filtre.monstres, parCom2us]
  );
  return (
    <div className="-mt-2 flex flex-wrap items-center gap-2">
      <Segmented<FiltreSiege['resultat']>
        value={filtre.resultat}
        onChange={(resultat) => onFiltre({ ...filtre, resultat })}
        options={[
          { key: 'tous', label: f.resultat.tous },
          { key: 'victoires', label: f.resultat.victoires },
          { key: 'defaites', label: f.resultat.defaites },
        ]}
      />
      <div className="min-w-[min(180px,100%)] flex-1 lg:max-w-[240px]">
        <MonsterPicker
          monsters={proposes}
          excludeIds={exclus}
          placeholder={f.monstre}
          ariaLabel={f.monstre}
          onPick={(id) => {
            const m = proposes.find((x) => String(x.id) === id);
            if (m?.com2usId != null && !filtre.monstres.includes(m.com2usId)) onFiltre({ ...filtre, monstres: [...filtre.monstres, m.com2usId] });
          }}
        />
      </div>
      <span title={filtre.monstres.length ? undefined : f.coteAide}>
        <Segmented<FiltreSiege['cote']>
          value={filtre.cote}
          onChange={(cote) => onFiltre({ ...filtre, cote })}
          disabled={filtre.monstres.length === 0}
          options={[
            { key: 'tous', label: f.cote.tous },
            { key: 'attaque', label: f.cote.attaque },
            { key: 'defense', label: f.cote.defense },
          ]}
        />
      </span>
      {choisis.map((c) => (
        <Jeton
          key={c.id}
          icone={<MonsterAvatar monster={c.monstre} fallback={c.monstre ? undefined : String(c.id)} size={18} element={false} />}
          libelle={c.monstre?.name ?? String(c.id)}
          libelleRetrait={f.retirer(c.monstre?.name ?? String(c.id))}
          onRetirer={() => onFiltre({ ...filtre, monstres: filtre.monstres.filter((m) => m !== c.id) })}
        />
      ))}
      <Bouton taille="sm" fond="vide" libelle={f.effacer} disabled={!filtreActif(filtre)} onClick={() => onFiltre(FILTRE_VIDE)} />
    </div>
  );
}

// Un bloc paginé : la page courante, et le pager — en tête du bloc et répété au
// pied ; depuis le pied, changer de page remonte en tête du bloc (sinon on
// arrive à la fin de la page suivante). Une seule page : pas de pager.
function usePages(pages: number) {
  const [page, setPage] = useState(0);
  const haut = useRef<HTMLElement>(null);
  const courante = Math.min(Math.max(0, pages - 1), page);
  const pager = (depuisLeBas: boolean) =>
    pages > 1 && (
      <Pager
        page={courante}
        pageCount={pages}
        onChange={(p) => {
          setPage(p);
          if (depuisLeBas) haut.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />
    );
  return { page: courante, haut, pager };
}

// Des combats, SIÈGE PAR SIÈGE (`combatsParSiege`) : sur « Tous les sièges »,
// un groupe par siège sous sa date, ses adversaires et son bilan ; sur un
// siège seul, ses combats sans en-tête.
// ⚠️ **Pages d'au plus `COMBATS_PAR_PAGE` combats** (`pagesDeCombats`), pas
// d'un nombre de sièges : un siège en compte deux cents, de six portraits
// chacun. Un siège coupé reprend sur la page suivante sous son en-tête
// (« suite »).
function Combats({
  titre,
  aide,
  groupes,
  plusieurs,
  libelleSiege,
  guildes,
  parCom2us,
  filtre,
  vide,
  onAjouterReco,
  avecAttaquant = false,
}: {
  titre: string;
  aide?: string;
  groupes: CombatsDuSiege[];
  // Plusieurs sièges : un en-tête par siège, et des pages.
  plusieurs: boolean;
  libelleSiege: (x: SiegeReleve) => string;
  guildes: Map<number, InfoGuilde>;
  parCom2us: ParCom2us;
  filtre: FiltreSiege;
  vide: string;
  onAjouterReco: (ajout: OffenseAAjouter) => void;
  avecAttaquant?: boolean;
}) {
  const textes = useTraduction();
  const langue = useLangue();
  const s = textes.siegeStats;
  const b = useMemo(() => bilanDesCombats(groupes.flatMap((g) => g.attaques)), [groupes]);
  const pages = useMemo(() => pagesDeCombats(groupes), [groupes]);
  const { page, haut, pager } = usePages(pages.length);
  const taux = (t: number | null) => (t === null ? null : formatNombre(t, langue, { maximumFractionDigits: 0 }));
  const bilan = b.n > 0 ? s.bilanCombats(b.n, b.victoires, b.defaites, taux(b.taux)) : undefined;
  return (
    <section ref={haut} className="scroll-mt-24">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="label text-ink-dim">{titre}</h2>
        <div className="ml-auto">{pager(false)}</div>
      </div>
      {(aide || bilan) && <p className="mb-1.5 text-xs text-ink-dim">{bilan ? `${aide ? `${aide} ` : ''}${bilan}` : aide}</p>}
      {groupes.length === 0 ? (
        <p className="rounded-xl border border-border bg-panel px-4 py-3 text-sm text-ink-dim">{filtreActif(filtre) ? s.filtres.aucunCombat : vide}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {(pages[page] ?? []).map(({ groupe: g, attaques, suite }) => {
            const bg = plusieurs ? bilanDesCombats(g.attaques) : null;
            return (
              <div key={g.siege.matchId}>
                {bg && (
                  <h3 className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-sm text-ink">
                    <span className="font-semibold">{libelleSiege(g.siege)}</span>
                    {suite && <span className="text-xs text-ink-dim">({s.suite})</span>}
                    <span className="text-xs text-ink-dim">{s.bilanCombats(bg.n, bg.victoires, bg.defaites, taux(bg.taux))}</span>
                  </h3>
                )}
                <div className={`grid gap-2 ${COLONNES.grande}`}>
                  {attaques.map((x) => (
                    <CarteCombat key={`${x.t}-${x.attaquant}-${x.defenseur}`} combat={x} siege={g.siege} guildes={guildes} parCom2us={parCom2us} avecAttaquant={avecAttaquant} onAjouterReco={onAjouterReco} />
                  ))}
                </div>
              </div>
            );
          })}
          {pages.length > 1 && <div className="flex justify-center">{pager(true)}</div>}
        </div>
      )}
    </section>
  );
}

// Un combat : en tête l'heure, la base, le résultat et « Ajouter à une
// recommandation » ; puis les deux équipes face à face ; puis qui contre qui.
// Mémorisé : un changement de page ou de filtre ne redessine pas les cartes
// qui restent.
const CarteCombat = memo(function CarteCombat({
  combat: x,
  siege,
  guildes,
  parCom2us,
  avecAttaquant,
  onAjouterReco,
}: {
  combat: AttaqueSiege;
  siege: SiegeReleve;
  guildes: Map<number, InfoGuilde>;
  parCom2us: ParCom2us;
  avecAttaquant: boolean;
  onAjouterReco: (ajout: OffenseAAjouter) => void;
}) {
  const s = useTraduction().siegeStats;
  const langue = useLangue();
  const nom = (id: number) => nomDuJoueur(siege, id) || s.joueurInconnu;
  // ⚠️ Toujours affiché, désactivé avec sa raison : seule une victoire aux six
  // monstres connus dit qu'une offense bat une défense.
  const raison = raisonNonAjoutable(x, (id) => parCom2us.has(id));
  return (
    <div className={CARTE}>
      <div className="flex items-center gap-2 text-xs text-ink-dim">
        <span className="font-mono">{formatDateHeure(x.t * 1000, langue, { hour: '2-digit', minute: '2-digit' })}</span>
        {x.base !== null && <Tour base={x.base} mienne={maPosition(siege)} />}
        <span className="ml-auto">
          <Resultat victoire={x.victoire} />
        </span>
        <BoutonIcone
          icone={<ListPlus size={15} />}
          libelle={raison ? `${s.ajoutReco.bouton} — ${s.ajoutReco.raisons[raison]}` : s.ajoutReco.bouton}
          disabled={raison !== null}
          onClick={() => {
            if (!x.monstres) return;
            const nom = (id: number) => parCom2us.get(id)?.name ?? '';
            onAjouterReco({ offense: trioDe(x.monstres.attaque, nom), defense: trioDe(x.monstres.defense, nom) });
          }}
          zoneEtendue
          className="-my-1"
          data-ajout-reco
        />
      </div>
      {x.monstres ? (
        <div className="mt-2 flex items-center gap-2">
          {/* Une équipe que le journal ne donne pas (l'attaque, dans les
              journaux des défenses de la guilde) : « ? ». */}
          {x.monstres.attaque.length ? (
            <Equipe ids={x.monstres.attaque} parCom2us={parCom2us} />
          ) : (
            <span className="w-[7.5rem] text-center text-xs italic text-ink-dimmer" title={s.monstresNonVus}>?</span>
          )}
          <span className="text-xs text-ink-dimmer">{s.versus}</span>
          {x.monstres.defense.length ? (
            <Equipe ids={x.monstres.defense} parCom2us={parCom2us} />
          ) : (
            <span className="w-[7.5rem] text-center text-xs italic text-ink-dimmer" title={s.monstresNonVus}>?</span>
          )}
        </div>
      ) : (
        <div className="mt-2 text-xs italic text-ink-dimmer">{s.monstresNonVus}</div>
      )}
      {/* Qui contre qui, chacun suivi du nom de sa guilde à sa couleur. */}
      <div className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-sm text-ink">
        {avecAttaquant ? (
          <>
            <NomJoueur nom={nom(x.attaquant)} guilde={guildeDe(siege, x.guildeAttaquante, guildes)} />
            <span className="text-ink-dim">{s.fleche}</span>
          </>
        ) : (
          <span className="text-ink-dim">{s.contreLibelle}</span>
        )}
        <NomJoueur nom={nom(x.defenseur)} guilde={guildeDe(siege, x.guildeDefense, guildes)} />
      </div>
    </div>
  );
});

// Un joueur et, à côté, le nom de sa guilde à la couleur de sa place sur la
// carte du jeu — seulement pour une AUTRE guilde : la mienne va de soi.
function NomJoueur({ nom, guilde }: { nom: string; guilde: InfoGuilde | null }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-baseline gap-1">
      <span className="truncate">{nom}</span>
      {guilde && !guilde.mienne && <span className={`truncate text-xs font-semibold ${TEXTE_GUILDE[guilde.couleur]}`}>{guilde.nom}</span>}
    </span>
  );
}

// La base d'un combat comme la carte du jeu la montre (`tourDeBase`) :
// l'écusson de la tour — forme et contour du territoire, numéro ou « QG » ; le
// détail et le numéro de base de la carte en infobulle et pour un lecteur
// d'écran. Un rang dont le numéro n'est pas relevé : la couleur du territoire
// et « Base n ». Une base hors des territoires connus : « Base n ». La couleur
// du territoire se lit depuis ma place dans le siège (`mienne`) : le mien est
// toujours bleu.
function Tour({ base, mienne }: { base: number; mienne: number | null }) {
  const s = useTraduction().siegeStats;
  const t = tourDeBase(base);
  const couleur = t && couleurDePosition(t.position, mienne);
  if (!t || !couleur) return <span>{s.base(base)}</span>;
  if (t.numero === null)
    return (
      <span className="inline-flex items-center gap-1" title={s.tourDetail(s.base(base), s.couleursGuilde[couleur], base)}>
        <span className={`h-2 w-2 flex-none rounded-sm ${FOND_GUILDE[couleur]}`} aria-hidden="true" />
        {s.base(base)}
      </span>
    );
  const nom = t.numero === 'QG' ? s.qg : s.tour(t.numero);
  const detail = s.tourDetail(nom, s.couleursGuilde[couleur], base);
  return (
    <span className="inline-flex items-center" title={detail} role="img" aria-label={detail}>
      <EcussonTour couleur={couleur} numero={t.numero === 'QG' ? s.qg : t.numero} />
    </span>
  );
}

// Le contenu encore à l'ancien choix pâlit le temps que le nouveau arrive
// (`useDeferredValue`) ; le délai évite un clignement quand il arrive vite.
const PALIT = (enRetard: boolean) => (enRetard ? 'opacity-60 transition-opacity delay-150' : 'transition-opacity');

function Resultat({ victoire }: { victoire: boolean | null }) {
  const s = useTraduction().siegeStats;
  const [classe, texte] =
    victoire === true ? ['border-good/40 bg-good-soft text-good', s.victoire]
      : victoire === false ? ['border-bad/40 bg-bad-soft text-bad', s.defaite]
        : ['border-border text-ink-dim', s.resultatInconnu];
  return <span className={`flex-none rounded-md border px-2 py-0.5 text-xs font-semibold ${classe}`}>{texte}</span>;
}

// Des défenses, une carte chacune, reconstituées d'après les COMBATS du siège
// (`defensesDuJoueur`…, src/lib/siegeStatistiques.ts) : ses monstres, son
// joueur, les combats gagnés sur les combats subis, son WR. Par pages d'au
// plus `DEFENSES_PAR_PAGE` : cumulées sur tous les sièges, elles se comptent
// par centaines.
function Defenses({
  titre,
  siege,
  defenses: toutes,
  guildes,
  parCom2us,
  filtre,
  avecJoueur = false,
}: {
  titre: string;
  siege: SiegeReleve;
  defenses: DefenseCombats[];
  guildes: Map<number, InfoGuilde>;
  parCom2us: ParCom2us;
  filtre: FiltreSiege;
  avecJoueur?: boolean;
}) {
  const s = useTraduction().siegeStats;
  const defenses = useMemo(() => filtrerDefenses(toutes, filtre), [toutes, filtre]);
  const pages = Math.max(1, Math.ceil(defenses.length / DEFENSES_PAR_PAGE));
  const { page, haut, pager } = usePages(pages);
  const visibles = pageDe(defenses, page, DEFENSES_PAR_PAGE).elements;
  return (
    <section ref={haut} className="scroll-mt-24">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="label text-ink-dim">{titre}</h2>
        <div className="ml-auto">{pager(false)}</div>
      </div>
      <p className="mb-1.5 text-xs text-ink-dim">{s.defensesDepuisCombats}</p>
      {defenses.length === 0 ? (
        <p className="rounded-xl border border-border bg-panel px-4 py-3 text-sm text-ink-dim">{toutes.length > 0 ? s.filtres.aucuneDefense : s.aucuneDefense}</p>
      ) : (
        <>
          <div className={`grid gap-2 ${COLONNES.moyenne}`}>
            {visibles.map((d) => (
              <CarteDefense key={`${d.joueur}-${d.monstres?.join() ?? '?'}`} defense={d} siege={siege} guildes={guildes} parCom2us={parCom2us} avecJoueur={avecJoueur} />
            ))}
          </div>
          {pages > 1 && <div className="mt-4 flex justify-center">{pager(true)}</div>}
        </>
      )}
    </section>
  );
}

// Une défense ; mémorisée comme une carte de combat.
const CarteDefense = memo(function CarteDefense({
  defense: d,
  siege,
  guildes,
  parCom2us,
  avecJoueur,
}: {
  defense: DefenseCombats;
  siege: SiegeReleve;
  guildes: Map<number, InfoGuilde>;
  parCom2us: ParCom2us;
  avecJoueur: boolean;
}) {
  const s = useTraduction().siegeStats;
  const langue = useLangue();
  return (
    <div className={CARTE} title={s.defensesTenues(d.tenus, d.combats)}>
      {d.monstres ? <Equipe ids={d.monstres} parCom2us={parCom2us} /> : <div className="text-xs italic text-ink-dimmer">{s.monstresNonVus}</div>}
      {avecJoueur && (
        <div className="mt-1.5 flex min-w-0 text-sm text-ink">
          <NomJoueur nom={nomDuJoueur(siege, d.joueur) || s.joueurInconnu} guilde={guildeDe(siege, d.guilde, guildes)} />
        </div>
      )}
      <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs tabular-nums text-ink-dim">
        <span>{s.abr.tenues(d.tenus, d.combats)}</span>
        {d.wr !== null && <span className="text-ink">{s.wrValeur(formatNombre(d.wr, langue, { maximumFractionDigits: 0 }))}</span>}
      </div>
    </div>
  );
});

// La surface d'une carte de grille.
const CARTE = 'block w-full min-w-0 rounded-lg border border-border bg-panel px-3 py-2 text-left';

// Les largeurs minimales d'une colonne : autant de colonnes que la place en
// permet — trois à six à la souris, une ou deux au doigt.
const COLONNES = {
  petite: 'grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
  moyenne: 'grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]',
  grande: 'grid-cols-[repeat(auto-fill,minmax(19rem,1fr))]',
} as const;

// Un bloc titré : une grille de cartes, ou la phrase `vide`.
function Grille({
  titre,
  aide,
  largeur,
  vide,
  children,
}: {
  titre: string;
  aide?: string;
  largeur: keyof typeof COLONNES;
  vide?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="label mb-1 text-ink-dim">{titre}</h2>
      {aide && <p className="mb-1.5 text-xs text-ink-dim">{aide}</p>}
      {vide ? (
        <p className="rounded-xl border border-border bg-panel px-4 py-3 text-sm text-ink-dim">{vide}</p>
      ) : (
        <div className={`grid gap-2 ${COLONNES[largeur]}`}>{children}</div>
      )}
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-xl border border-border bg-panel px-4 py-3 text-sm text-ink-dim">{children}</p>;
}
