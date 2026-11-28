// « + Ajouter un counter » : la fenêtre qui propose les trois façons d'ajouter
// un deck à une recommandation — depuis une CAPTURE de l'écran de préparation
// de siège (lue comme par le bot Discord ; collée, déposée ou choisie), depuis
// un de MES DECKS d'offense de siège ou une équipe de MES ÉQUIPES, ou un deck
// VIDE. Le deck ajouté s'ouvre en édition dans sa vue.
// docs/02-app/siege/feat-recommandations/interactions.md, « Ajouter un counter ».
//
// ⚠️ **La capture reste sur l'appareil** : le navigateur la décode, un Web
// Worker la lit (src/lib/capture/lectureNavigateur.ts). Rien n'est envoyé.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ClipboardPaste, FolderOpen, ImageUp, Plus, Search, X } from 'lucide-react';
import type { Monster, RecoCounter, RecoDeck } from '../../types';
import { emptyRecoDeck } from '../../types';
import { deckFromSiegeTeam } from '../../lib/recoFromSiege';
import { cleEquipe } from '../../lib/recoDefenses';
import { lireCapture } from '../../lib/capture/lectureNavigateur';
import { aVerifier, corrigerMonstre, counterDepuisLecture, deckDepuisCounterLu, defenseLue, type CounterLu, type MonstreReconnu } from '../../lib/capture/counterDepuisCapture';
import { useTraduction } from '../../hooks/useLangue';
import { Bouton, BoutonIcone, Champ, Modale, Onglets, Selecteur, ZoneCliquable } from '../../ui';
import MonsterPicker from '../MonsterPicker';
import { MiniMonster, type OffenseChoice } from './RecoCard';

type Onglet = 'capture' | 'equipes';
type EtatCapture =
  | { etat: 'vide' }
  | { etat: 'lecture' }
  | { etat: 'lue'; lu: CounterLu }
  | { etat: 'erreur'; message: string };

// Une équipe de « Mes équipes » proposée comme point de départ : ses trois
// premiers monstres (leader en tête), un résumé pour la recherche, et le deck
// qu'elle donne, construit au clic seulement (recoFromSiege.ts).
export interface EquipeChoix {
  id: string;
  nom: string;
  rangement: string;
  monstres: (Monster | null)[];
  resume: string;
  creer: () => RecoDeck;
}

interface Props {
  // Les recommandations où l'ajouter : une seule (vue Decks, ou une seule
  // recommandation vise la défense), sinon la fenêtre demande laquelle.
  recos: { id: string; nom: string }[];
  // Vue Défenses : la défense regardée, que le deck vise d'office.
  defenseVisee: RecoCounter['monsters'] | null;
  // « Mes decks et équipes » : les decks d'offense de siège, puis les équipes
  // de « Mes équipes ».
  offenseTeams: OffenseChoice[];
  equipes: EquipeChoix[];
  // Les monstres proposés pour corriger une lecture.
  monsters: Monster[];
  monsterById: Map<string, Monster>;
  monsterByCom2us: Map<number, Monster>;
  onAjouter: (recoId: string, deck: RecoDeck) => void;
  onClose: () => void;
}

export default function AjoutCounter({ recos, defenseVisee, offenseTeams, equipes, monsters, monsterById, monsterByCom2us, onAjouter, onClose }: Props) {
  const textes = useTraduction();
  const a = textes.recos.ajoutCounter;
  const cr = textes.carteReco;
  const titreId = useId();
  const [onglet, setOnglet] = useState<Onglet>('capture');
  const [recoId, setRecoId] = useState(recos[0]?.id ?? '');
  const [capture, setCapture] = useState<EtatCapture>({ etat: 'vide' });
  // La défense de la capture n'est pas celle qu'on regarde : on demande.
  const [aTrancher, setATrancher] = useState<{ lu: CounterLu; lue: RecoCounter['monsters'] } | null>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const nom = (id: number) => monsterByCom2us.get(id)?.name ?? '';
  const ajouter = (deck: RecoDeck) => {
    onAjouter(recoId, deck);
    onClose();
  };

  // ── La capture ──────────────────────────────────────────────────────────
  const lire = async (blob: Blob) => {
    setCapture({ etat: 'lecture' });
    const issue = await lireCapture(blob);
    if (issue.type !== 'lue') {
      setCapture({ etat: 'erreur', message: a.erreurs[issue.type] });
      return;
    }
    const lu = counterDepuisLecture(issue.lecture, (id) => monsterByCom2us.has(id));
    setCapture(lu ? { etat: 'lue', lu } : { etat: 'erreur', message: a.erreurs['non-reconnue'] });
  };
  // Une capture collée (Ctrl+V), tant que l'onglet est ouvert.
  useEffect(() => {
    if (onglet !== 'capture') return;
    const coller = (e: ClipboardEvent) => {
      const image = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile();
      if (image) {
        e.preventDefault();
        void lire(image);
      }
    };
    document.addEventListener('paste', coller);
    return () => document.removeEventListener('paste', coller);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet]);
  // Le bouton « Coller » : la même chose que Ctrl+V, au doigt (pas de
  // clavier au téléphone). ⚠️ Le navigateur peut demander l'autorisation ;
  // sans lecture du presse-papiers possible, il reste désactivé et dit
  // d'utiliser Ctrl+V.
  const lecturePossible = typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function';
  const collerDepuisPressePapiers = async () => {
    try {
      for (const element of await navigator.clipboard.read()) {
        const type = element.types.find((t) => t.startsWith('image/'));
        if (type) {
          await lire(await element.getType(type));
          return;
        }
      }
      setCapture({ etat: 'erreur', message: a.pressePapiersVide });
    } catch {
      setCapture({ etat: 'erreur', message: a.pressePapiersRefuse });
    }
  };

  const ajouterCapture = () => {
    if (capture.etat !== 'lue') return;
    const lue = defenseLue(capture.lu, nom);
    if (defenseVisee) {
      // ⚠️ Comparées par la clé de la vue Défenses (chef, puis les autres
      // triés) : le même trio dans un autre ordre est la même défense.
      if (lue && cleEquipe(lue, monsterByCom2us) !== cleEquipe(defenseVisee, monsterByCom2us)) {
        setATrancher({ lu: capture.lu, lue });
        return;
      }
      ajouter(deckDepuisCounterLu(capture.lu, nom, defenseVisee));
    } else {
      ajouter(deckDepuisCounterLu(capture.lu, nom, lue));
    }
  };

  // ── Mes decks et équipes ────────────────────────────────────────────────
  const [recherche, setRecherche] = useState('');
  const q = recherche.trim().toLowerCase();
  const decksTrouves = q ? offenseTeams.filter((t) => t.summary.toLowerCase().includes(q)) : offenseTeams;
  const equipesTrouvees = q ? equipes.filter((e) => e.resume.toLowerCase().includes(q)) : equipes;
  const avecDefense = (deck: RecoDeck): RecoDeck =>
    defenseVisee ? { ...deck, counters: [{ monsters: defenseVisee.map((m) => ({ ...m })), note: '' }] } : deck;

  // ── Corriger la lecture ─────────────────────────────────────────────────
  // Toucher un portrait le sélectionne ; le sélecteur de monstre s'ouvre dans
  // une rangée RÉSERVÉE sous la lecture (un clic ne déplace jamais ce qu'on
  // vient de cliquer : la fenêtre, centrée, ne change pas de hauteur).
  const [place, setPlace] = useState<{ cote: 'offense' | 'defense'; i: number } | null>(null);
  const poser = (cote: 'offense' | 'defense', i: number, com2usId: number | null) => {
    setCapture((c) => (c.etat === 'lue' ? { etat: 'lue', lu: corrigerMonstre(c.lu, cote, i, com2usId) } : c));
    setPlace(null);
  };
  const corriger = (com2usId: number | null) => {
    if (place) poser(place.cote, place.i, com2usId);
  };
  // Une nouvelle lecture ferme la correction en cours.
  useEffect(() => setPlace(null), [capture.etat]);

  const trio = (cote: 'offense' | 'defense', monstres: (MonstreReconnu | null)[], taille: number) => (
    <span className="flex flex-none items-center gap-1">
      {monstres.map((m, i) => {
        const mon = m ? monsterByCom2us.get(m.com2usId) ?? null : null;
        const doute = m?.autre != null ? a.peutEtre(nom(m.autre)) : null;
        const choisie = place?.cote === cote && place.i === i;
        const libelle = `${a.corriger(mon?.name ?? a.inconnu)}${doute ? ` — ${doute}` : ''}`;
        return (
          // La croix est SŒUR du portrait, pas dedans : un bouton dans un
          // bouton n'est pas du HTML valide.
          <span key={i} className="relative flex flex-none">
            <ZoneCliquable
              onClick={() => setPlace(choisie ? null : { cote, i })}
              aria-pressed={choisie}
              aria-label={libelle}
              title={libelle}
              className={`relative flex flex-none items-center rounded-lg border p-0.5 pr-1.5 transition ${
                choisie ? 'border-accent bg-accent/10' : 'border-transparent hoverable:border-border'
              }`}
              data-monstre-lu={doute ? 'doute' : m ? 'sur' : 'inconnu'}
            >
              <MiniMonster monster={mon} size={taille} />
              {doute && (
                <AlertTriangle size={13} className="absolute -left-1 -top-1 rounded-full bg-panel text-warn" aria-hidden />
              )}
            </ZoneCliquable>
            {/* ⚠️ Toujours rendue, désactivée et cachée sur une place vide :
                elle ne naît ni ne disparaît avec le monstre. Posée SUR le
                coin, hors du flux (repère du banc `data-bouton-coin`) — en
                BAS à droite : en haut à droite, l'icône d'élément du
                portrait ; en haut à gauche, le ⚠ d'un monstre à vérifier. */}
            <BoutonIcone
              onClick={() => poser(cote, i, null)}
              disabled={!m}
              taille="serre"
              cadre
              icone={<X size={10} />}
              libelle={a.retirer(mon?.name ?? a.inconnu)}
              data-bouton-coin="retirer-monstre-lu"
              className={`absolute -bottom-1.5 -right-1.5 z-10 ${m ? '' : 'invisible'}`}
            />
          </span>
        );
      })}
    </span>
  );
  // Les monstres déjà dans l'équipe de la place corrigée : le sélecteur ne
  // les propose pas une seconde fois.
  const dejaPris = (lu: CounterLu): Set<string> => {
    if (!place) return new Set();
    const equipe = place.cote === 'offense' ? lu.offense : lu.defense;
    return new Set(equipe.flatMap((m, k) => {
      const local = m && k !== place.i ? monsterByCom2us.get(m.com2usId)?.id : undefined;
      return local != null ? [String(local)] : [];
    }));
  };

  const corpsCapture = (
    <div className="flex flex-col gap-3" data-ajout-capture>
      <input
        ref={fichier}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void lire(f);
        }}
      />
      {capture.etat === 'lue' ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border-soft bg-panel2/50 p-3" data-capture-lue>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="label w-16 flex-none">{a.offense}</span>
            {trio('offense', capture.lu.offense, 40)}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="label w-16 flex-none">{a.defense}</span>
            {/* Vue Defenses sans défense lue : le deck visera celle qu'on
                regarde, rien à corriger. Vue Decks : trois places vides, à
                remplir pour lui donner une défense. */}
            {capture.lu.defense.length > 0 || !defenseVisee
              ? trio('defense', capture.lu.defense.length > 0 ? capture.lu.defense : [null, null, null], 32)
              : <span className="text-xs text-ink-dim">{a.sansDefenseVisee}</span>}
          </div>
          {aVerifier(capture.lu) > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-warn">
              <AlertTriangle size={13} className="mt-0.5 flex-none" /> {a.aVerifier(aVerifier(capture.lu))}
            </p>
          )}
          {/* La rangée de correction, TOUJOURS là (hauteur fixe) : l'aide, ou
              le sélecteur de la place touchée. */}
          <div className="flex h-10 items-center gap-1.5" data-correction>
            {place ? (
              <>
                <div className="min-w-0 flex-1">
                  <MonsterPicker
                    key={`${place.cote}:${place.i}`}
                    monsters={monsters}
                    excludeIds={dejaPris(capture.lu)}
                    placeholder={textes.equipeSiege.choisirMonstre}
                    jetonFocus={1}
                    onPick={(id) => {
                      const mon = monsters.find((x) => String(x.id) === id);
                      // Un monstre perso (`com2usId` nul) n'est pas partageable.
                      if (mon && mon.com2usId != null) corriger(mon.com2usId);
                    }}
                  />
                </div>
                <BoutonIcone onClick={() => setPlace(null)} icone={<X size={14} />} libelle={a.fermerCorrection} />
              </>
            ) : (
              <p className="text-xs text-ink-dim">{a.toucherPourCorriger}</p>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ⚠️ **Coller d'abord** : une capture se prend dans le presse-papiers
              (Win + Maj + S, Impr. écran) bien plus souvent qu'elle ne se
              cherche dans un dossier. Glisser-déposer, avec son repli au
              doigt : toucher la zone ouvre le choix d'un fichier (la galerie,
              au téléphone). */}
          <ZoneCliquable
            onClick={() => fichier.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/')) ?? e.dataTransfer.files[0];
              if (f) void lire(f);
            }}
            disabled={capture.etat === 'lecture'}
            className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-panel2/40 px-4 py-5 text-center hoverable:border-accent"
            data-zone-capture
          >
            <ImageUp size={22} className="text-ink-dim" aria-hidden />
            <span className="text-sm font-semibold text-ink">
              {capture.etat === 'lecture' ? a.lecture : a.collerCapture}
            </span>
            <span className="text-xs text-ink-dim">{a.deposer}</span>
          </ZoneCliquable>
        </>
      )}
      {/* Coller ou choisir, avant comme après une lecture : une capture
          erronée se remplace (Ctrl+V aussi, à tout moment). */}
      <div className="flex flex-wrap items-center gap-2">
        <Bouton
          onClick={() => void collerDepuisPressePapiers()}
          disabled={!lecturePossible || capture.etat === 'lecture'}
          title={lecturePossible ? undefined : a.collerIndisponible}
          taille="sm"
          icone={<ClipboardPaste size={14} />}
          libelle={capture.etat === 'lue' ? a.collerAutre : a.coller}
        />
        <Bouton
          onClick={() => fichier.current?.click()}
          disabled={capture.etat === 'lecture'}
          taille="sm"
          icone={<FolderOpen size={14} />}
          libelle={a.choisirFichier}
        />
        {capture.etat === 'lue' && <span className="text-micro text-ink-dim">{a.ctrlVRemplace}</span>}
      </div>
      {capture.etat === 'erreur' && (
        <p className="flex items-start gap-1.5 text-xs text-bad" role="alert">
          <AlertTriangle size={13} className="mt-0.5 flex-none" /> {capture.message}
        </p>
      )}
      <p className="text-micro text-ink-dim">{a.aide}</p>
    </div>
  );

  // Une ligne de la liste : un clic ajoute le deck.
  const ligneEquipe = (cle: string, titre: string, trioEquipe: (Monster | null)[], tete: ReactNode, deck: () => RecoDeck) => (
    <ZoneCliquable
      key={cle}
      onClick={() => ajouter(avecDefense(deck()))}
      title={titre}
      className="flex items-center gap-2 rounded-lg border border-border bg-panel px-2.5 py-1.5 transition hoverable:border-accent"
    >
      <span className="flex flex-none items-center gap-1">
        {trioEquipe.map((m, i) => (
          <span key={i} className="flex flex-none items-center pr-1"><MiniMonster monster={m} size={30} /></span>
        ))}
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-xs text-ink-dim">{tete}</span>
      <Plus size={13} className="flex-none text-ink-dim" />
    </ZoneCliquable>
  );
  const corpsEquipes = offenseTeams.length === 0 && equipes.length === 0 ? (
    <p className="text-sm text-ink-dim">{a.aucuneSource}</p>
  ) : (
    <div className="flex flex-col gap-1.5" data-ajout-equipes>
      <p className="text-micro text-ink-dim">{a.statsReprises}</p>
      <Champ
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder={cr.filtrerMonstre}
        icone={<Search size={13} />}
        className="py-1 text-xs"
      />
      <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto">
        {offenseTeams.length > 0 && (
          <>
            <p className="label mt-1">{a.decksOffense}</p>
            {decksTrouves.map(({ team, index, summary, monsters: trioEquipe }) =>
              ligneEquipe(`d:${team.id}`, summary, trioEquipe, `#${index + 1}`, () => deckFromSiegeTeam(team, monsterById)))}
            {decksTrouves.length === 0 && <p className="px-1 py-1 text-xs text-ink-dim">{cr.aucuneEquipe}</p>}
          </>
        )}
        {equipes.length > 0 && (
          <div className="contents" data-ajout-mes-equipes>
            <p className="label mt-2">{a.mesEquipes}</p>
            {equipesTrouvees.map((e) =>
              ligneEquipe(`e:${e.id}`, e.resume, e.monstres, (
                <>
                  <b className="font-semibold text-ink">{e.nom}</b> · {e.rangement}
                </>
              ), e.creer))}
            {equipesTrouvees.length === 0 && <p className="px-1 py-1 text-xs text-ink-dim">{cr.aucuneEquipe}</p>}
          </div>
        )}
      </div>
    </div>
  );

  if (aTrancher && defenseVisee) {
    // ⚠️ **Trois issues, aucune qui perde** : garder la défense regardée (le
    // défaut, qui reçoit le focus), prendre celle de la capture, ou annuler.
    const trioDefense = (monstres: RecoCounter['monsters']) => (
      <span className="flex flex-none items-center gap-1">
        {monstres.map((m, i) => (
          <span key={i} className="flex flex-none items-center pr-1">
            <MiniMonster monster={m.com2usId != null ? monsterByCom2us.get(m.com2usId) ?? null : null} fallback={m.name} size={32} />
          </span>
        ))}
      </span>
    );
    return (
      <Modale
        onClose={() => setATrancher(null)}
        labelledBy={titreId}
        titre={a.autreDefense.titre}
        sousTitre={a.autreDefense.message}
        actionsEmpilees
        actions={(
          <>
            <Bouton onClick={() => setATrancher(null)} fond="vide" trait="plein" libelle={textes.commun.annuler} />
            <Bouton
              onClick={() => ajouter(deckDepuisCounterLu(aTrancher.lu, nom, aTrancher.lue))}
              fond="plein"
              libelle={a.autreDefense.changer}
            />
            <Bouton
              onClick={() => ajouter(deckDepuisCounterLu(aTrancher.lu, nom, defenseVisee))}
              autoFocus
              ton="accent"
              fond="doux"
              libelle={a.autreDefense.garder}
            />
          </>
        )}
      >
        <div className="flex flex-col gap-2" data-autre-defense>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="label w-36 flex-none">{a.autreDefense.regardee}</span>
            {trioDefense(defenseVisee)}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="label w-36 flex-none">{a.autreDefense.lue}</span>
            {trioDefense(aTrancher.lue)}
          </div>
        </div>
      </Modale>
    );
  }

  return (
    <Modale
      onClose={onClose}
      labelledBy={titreId}
      titre={a.titre}
      croix
      largeur="max-w-[520px]"
      actions={(
        <>
          <Bouton
            onClick={() => ajouter(avecDefense(emptyRecoDeck()))}
            fond="vide"
            trait="pointille"
            icone={<Plus size={14} />}
            libelle={a.deckVide}
          />
          {/* ⚠️ Toujours là, désactivé tant qu'aucune capture n'est lue : il
              ne disparaît pas d'un onglet à l'autre (« Mes decks » ajoute au
              clic sur une équipe). */}
          <Bouton
            onClick={ajouterCapture}
            disabled={onglet !== 'capture' || capture.etat !== 'lue'}
            title={onglet !== 'capture' || capture.etat !== 'lue' ? a.ajouterAide : undefined}
            ton="accent"
            fond="plein"
            libelle={a.ajouter}
            data-ajouter-capture
          />
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        {recos.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="label">{a.dans}</span>
            <Selecteur value={recoId} onChange={(e) => setRecoId(e.target.value)} aria-label={a.dans}>
              {recos.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </Selecteur>
          </label>
        )}
        <Onglets
          options={[
            { cle: 'capture', libelle: a.onglets.capture },
            { cle: 'equipes', libelle: a.onglets.equipes },
          ]}
          valeur={onglet}
          onChange={setOnglet}
          aria-label={a.titre}
        />
        {/* ⚠️ **Même hauteur pour les deux onglets, et pour la capture lue
            ou non** : la fenêtre est centrée, et un corps plus haut la
            recentrait — ce qu'on venait de toucher bougeait sous le clic. La
            liste de « Mes decks et équipes » défile dans cette place. */}
        <div className="min-h-[340px]">
          {onglet === 'capture' ? corpsCapture : corpsEquipes}
        </div>
      </div>
    </Modale>
  );
}
