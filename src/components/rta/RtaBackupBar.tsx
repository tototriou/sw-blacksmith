import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  RotateCcw,
  Upload,
  Download,
  Eye,
  EyeOff,
  Gauge,
  History,
} from 'lucide-react';
import { ElementKey, Monster, RtaState } from '../../types';
import { CustomLead } from '../../hooks/useCustomMonsters';
import { UseRtaState } from '../../hooks/useRtaState';
import { UseRtaCategories } from '../../hooks/useRtaCategories';
import { UseRtaBackup } from '../../hooks/useRtaBackup';
import {
  appliquer,
  comptePartageable,
  encodeSnapshot,
  ImportReport,
  NiveauPartage,
  RtaSnapshot,
  toSnapshot,
  validateRtaImport,
} from '../../lib/rtaShare';
import RtaValidationReport from './RtaValidationReport';
import { ConfirmDialog, Modale } from '../../ui/Dialogs';
import { BarreActions, Bouton, Option } from '../../ui';
import { PREFIXE_FICHIER } from '../../marque';
import { selonSupport } from '../../lib/bureau';
import { jourLocal, telechargerTexte } from '../../lib/telechargement';
import type { ElementMenu } from '../../ui';
import { useLangue, useTraduction } from '../../hooks/useLangue';
import type { Dictionnaire } from '../../i18n/fr';
import type { Langue } from '../../i18n/langue';
import { formatDate } from '../../i18n/format';

/* --------------------------------------------------------------------------
 * Sauvegarder · Reprendre · Réinitialiser · Exporter · Importer
 * -----------------------------------------------------------------------
 *
 * ⚠️ **« Sauvegarder » n'est PAS de l'enregistrement.** La prépa est déjà écrite
 * à chaque changement : on la retrouve intacte à la session suivante sans rien
 * cliquer. Ce bouton pose un **point de retour** — il sert à essayer un autre
 * classement sans risquer celui qui marchait. Le libellé et l'infobulle le
 * disent, sinon on croit que sans lui tout est perdu, ce qui est faux.
 *
 * ⚠️ **Consulter n'est pas importer, et ce n'est plus ici.** Ouvrir la prépa
 * d'un ami a désormais son propre écran (`#/rta/ami`, RtaAmiSection.tsx) : elle
 * ne remplace rien et n'entre jamais dans l'état local, là où « Importer »
 * ci-dessous REMPLACE la prépa courante. Les deux boutons lisaient le même
 * format de fichier côte à côte, et il fallait deviner lequel touchait à quoi.
 *
 * ⚠️ **Trois points de retour, trois portées différentes** :
 *
 *   | Bouton | Ramène à | Posé par |
 *   |--------|----------|----------|
 *   | Reprendre | le point qu'on a figé soi-même | « Sauvegarder » |
 *   | Réinitialiser | la prépa **telle que l'import l'a produite** | automatiquement, à chaque import de compte |
 *   | Importer | une prépa d'un fichier | l'utilisateur |
 *
 * ⚠️ **Tout geste qui modifie la prépa confirme**, et jamais avec un OK
 * destructeur — « Annuler » est le défaut, l'action portée en couleur d'alerte.
 * Voir ../Dialogs.tsx.
 */

interface Props {
  rta: UseRtaState;
  cats: UseRtaCategories;
  backup: UseRtaBackup;
  monsters: Monster[];
  /** Recrée un monstre perso à la reprise d'une prépa. */
  onCreateMonster: (
    name: string,
    element: ElementKey,
    speed: number,
    lead?: CustomLead | null
  ) => Monster;
  // ⚠️ **Deux dispositions, une seule logique**. `barre` (défaut) : les cinq boutons en
  // rangées — c'est celle
  // du panneau d'actions MOBILE, inchangée. `menu` : l'en-tête BUREAU —
  // « Exporter » visible, le reste dans un menu « ⋯ ». Les dialogues, les
  // messages et le fichier sont les MÊMES : seule la façon de déclencher change.
  disposition?: 'barre' | 'menu';
  // En disposition `menu` : les entrées que la PAGE ajoute au menu — les gestes
  // de construction (« Créer un monstre ») avec les autres, les destructeurs
  // (« Tout effacer ») séparés en bas, avec « Réinitialiser ».
  entreesEnPlus?: ElementMenu[];
}

// « il y a 3 minutes », « hier à 14:32 » — repère plus parlant qu'une date ISO
// pour dire de quand date le point de retour.
function depuis(iso: string, t: Dictionnaire, langue: Langue): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const s = t.sauvegardeRta;
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return s.instant;
  if (min < 60) return s.minutes(min);
  const h = Math.floor(min / 60);
  if (h < 24) return s.heures(h);
  const j = Math.floor(h / 24);
  if (j === 1) return s.hier;
  if (j < 30) return s.jours(j);
  return formatDate(d, langue, { day: 'numeric', month: 'long', year: 'numeric' });
}

// Réglages communs aux cinq actions de cette barre.
//
// ⚠️ Un PRÉRÉGLAGE, pas un style : ce sont les axes de
// [Bouton](../../ui/Bouton.tsx) fixés une fois pour six boutons qui doivent
// rester indiscernables les uns des autres. Aucune classe n'est écrite ici — si
// le bouton de la librairie change, ces six-là changent avec lui.
//
// ⚠️ **L'ICÔNE SEULE au doigt** (`nuAuDoigt` + `libelleAuDoigt: false`) : six
// actions à libellé complet, chacune portée à 40 px par la règle tactile,
// remplissaient l'écran d'un téléphone — trois rangées de boutons avant
// d'atteindre la prépa. Ni cadre ni fond non plus : six boutons encadrés font
// six carrés dans une barre qu'on cherche à compacter, et le cadre n'apprend
// rien. Rien n'est perdu : l'intitulé reste au survol, au lecteur d'écran, et
// revient en toutes lettres dans le panneau d'actions.
//
// ⚠️ **Le même gabarit que `CreateMonster`** (`taille="md"`) : les sept boutons
// se retrouvent côte à côte dans le panneau mobile, où « Monstre » paraissait
// plus grand que ses six voisins. Les deux doivent rester alignés.
const ACTION = {
  nuAuDoigt: true,
  libelleAuDoigt: false,
  fond: 'doux',
  taille: 'md',
} as const;

export default function RtaBackupBar({
  rta,
  cats,
  backup,
  monsters,
  onCreateMonster,
  disposition = 'barre',
  entreesEnPlus = [],
}: Props) {
  const enMenu = disposition === 'menu';
  const textes = useTraduction();
  const langue = useLangue();
  const s = textes.sauvegardeRta;
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  // Rapport de validation : NON éphémère, il y a quelque chose à lire.
  const [report, setReport] = useState<ImportReport | null>(null);
  const [reprendreAConfirmer, setReprendreAConfirmer] = useState(false);
  const [ecraserAConfirmer, setEcraserAConfirmer] = useState(false);
  const [resetAConfirmer, setResetAConfirmer] = useState(false);
  // Choix « avec / sans équipement », posé au moment d'exporter.
  const [exportAChoisir, setExportAChoisir] = useState(false);
  // Import en attente de confirmation : l'appliquer écraserait la prépa en cours.
  const [aConfirmer, setAConfirmer] = useState<{
    snapshot: RtaSnapshot;
    resume: string;
    perso: number; // monstres perso qui seront recréés
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Message éphémère (même convention que l'import de compte).
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.error ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [msg]);

  const monsterById = useMemo(() => {
    const m = new Map<string, Monster>();
    for (const mon of monsters) m.set(String(mon.id), mon);
    return m;
  }, [monsters]);

  const monsterByCom2us = useMemo(() => {
    const m = new Map<number, Monster>();
    for (const mon of monsters) if (mon.com2usId != null) m.set(mon.com2usId, mon);
    return m;
  }, [monsters]);

  const nbMonstres = Object.keys(rta.state.entries).length;
  const vide = nbMonstres === 0;

  function sauvegarder() {
    backup.sauvegarder(rta.state, cats.categories);
    setMsg({ text: s.posee });
  }

  function reprendre() {
    if (!backup.backup) return;
    rta.replaceAll(backup.backup.state);
    // Les catégories sont restaurées avec la prépa : elles en font partie.
    cats.replaceAll(
      backup.backup.categories.map((c) => ({ label: c.label, color: c.color, members: c.members }))
    );
    setMsg({ text: s.restauree });
  }

  // Retour à la prépa **telle que l'import de compte l'a produite**.
  //
  // ⚠️ C'est le geste le plus destructeur de la barre : il efface d'un coup tout
  // le classement fait à la main depuis l'import. D'où une confirmation qui
  // l'énonce, et qui rappelle qu'un export est la seule façon d'en garder trace.
  function reinitialiser() {
    if (!backup.importe) return;
    rta.replaceAll(backup.importe.state);
    cats.replaceAll(
      backup.importe.categories.map((c) => ({ label: c.label, color: c.color, members: c.members }))
    );
    setMsg({ text: s.reinitialisee });
  }

  // Combien de monstres emporteraient réellement leur équipement ? Sert à ne pas
  // proposer « avec mes runes » à quelqu'un qui n'a pas importé de compte.
  const avecRunes = useMemo(
    () => Object.values(rta.state.entries).filter((e) => e.gear && e.gear.runes.length > 0).length,
    [rta.state.entries]
  );

  function exporter(niveau: NiveauPartage) {
    const { partageables, perso } = comptePartageable(rta.state, monsterById);
    if (partageables === 0) {
      setMsg({ text: s.rienAExporter, error: true });
      return;
    }
    const snap = toSnapshot(rta.state, cats.categories, monsterById, { niveau });
    // ⚠️ **Le nom du fichier dit ce qu'il contient.** C'est le seul repère
    // avant de l'ouvrir — et quand on en a plusieurs dans son dossier de
    // téléchargements, ou qu'on en reçoit un d'un ami, « swblacksmith-prepa-rta.json »
    // ne permet pas de savoir si les runes y sont.
    const suffixe: Record<NiveauPartage, string> = {
      complet: 'complet',
      vitesses: 'ordre-et-sets',
      ordre: 'ordre-seul',
    };
    const fichier = `${PREFIXE_FICHIER}-prepa-rta-${suffixe[niveau]}-${jourLocal()}.json`;
    telechargerTexte(fichier, encodeSnapshot(snap));
    // ⚠️ Le nom du fichier est REPRIS dans le message : c'est lui qu'on ira
    // chercher dans ses téléchargements. Les monstres perso PARTENT désormais
    // (décrits en entier), mais on le dit : ils s'afficheront sans portrait chez
    // le lecteur, qui ne les a pas dans ses données.
    setMsg({
      text: s.exporte(partageables, s.niveaux[niveau], fichier) + (perso > 0 ? s.dontPerso(perso) : ''),
    });
  }

  // Lecture d'un fichier de prépa à REPRENDRE. ⚠️ La lecture d'une prépa d'ami
  // n'est plus ici : elle a son écran (RtaAmiSection.tsx). Le validateur, lui,
  // reste commun aux deux — c'est le même format.
  function lireFichier(text: string) {
    const rep = validateRtaImport(text, textes);
    setReport(rep);
    if (!rep.snapshot) return; // erreurs bloquantes : rien à faire

    // ⚠️ Compté SANS `creerPerso` : appeler `appliquer` ici puis à la
    // confirmation créerait chaque monstre perso deux fois. La création est
    // différée au moment où l'utilisateur valide.
    const { inconnus } = appliquer(rep.snapshot, monsterByCom2us, rta.state);
    if (inconnus.length > 0) {
      rep.warnings.push(
        s.absents(inconnus.length, `${inconnus.slice(0, 5).join(', ')}${inconnus.length > 5 ? '…' : ''}`)
      );
      setReport({ ...rep });
    }

    // Reprise d'une prépa : elle REMPLACE la sienne (il n'y en a qu'une), donc
    // elle passe par une confirmation qui énonce ce qu'on perd.
    // ⚠️ On garde l'INSTANTANÉ, pas l'état calculé : recréer les monstres perso
    // n'a lieu qu'à la validation, sinon annuler laisserait derrière soi des
    // monstres créés pour rien.
    const { state } = appliquer(rep.snapshot, monsterByCom2us, rta.state);
    const perso = rep.snapshot.entries.filter((e) => e.com2usId == null && e.perso).length;
    const retenus = Object.keys(state.entries).length + perso;
    if (retenus === 0) {
      setMsg({ text: s.aucunConnu, error: true });
      return;
    }
    setAConfirmer({
      snapshot: rep.snapshot,
      resume: s.monstres(retenus),
      perso,
    });
  }

  function ouvrirFichier() {
    fileRef.current?.click();
  }

  const dateBackup = backup.backup ? depuis(backup.backup.date, textes, langue) : '';
  const dateImport = backup.importe ? depuis(backup.importe.date, textes, langue) : '';
  const aideImporter = selonSupport(s.importerAideNavigateur, s.importerAideAppareil);

  return (
    // ⚠️ `data-passe-grille` : dans le panneau mobile, ce conteneur et celui
    // des deux rangées s'effacent pour que les six boutons deviennent les
    // enfants directs de la grille commune (voir index.css).
    // ⚠️ En disposition `menu`, la racine s'EFFACE (`contents`) : ses enfants
    // deviennent ceux de l'en-tête de page, une rangée qui passe à la ligne. Les
    // lignes d'état (point de sauvegarde, message, rapport) y prennent toute la
    // largeur (`basis-full`), sous le titre et les boutons.
    <div data-passe-grille className={enMenu ? 'contents' : 'mt-4'}>
      {enMenu ? (
        // ⚠️ `BarreActions` : toutes les actions en boutons S'IL Y A LA PLACE
        // sur la ligne de l'en-tête (mesurée), sinon « Exporter » + « ⋯ » —
        // demandé par le mainteneur : sur PC, ne pas cacher derrière un clic ce que
        // l'écran peut montrer.
        // Les entrées reprennent les boutons de la barre MOT POUR MOT —
        // libellés, désactivations, infobulles — à une précision près :
        // « Importer » devient « Importer une prépa », voisin d'autres gestes.
        <BarreActions
          libelleMenu={s.plusActions}
          toujours={[
            {
              cle: 'exporter',
              libelle: textes.commun.exporter,
              'aria-label': textes.commun.exporter,
              icone: <Upload size={14} />,
              onClick: () => setExportAChoisir(true),
              disabled: vide,
              title: s.exporterAide,
            },
          ]}
          autres={[
              {
                cle: 'sauvegarder',
                libelle: s.sauvegarder,
                icone: <Save size={14} />,
                onClick: () => (backup.backup ? setEcraserAConfirmer(true) : sauvegarder()),
                disabled: vide,
                title: vide ? s.sauvegarderVide : s.sauvegarderAide,
              },
              {
                cle: 'reprendre',
                libelle: s.reprendre,
                icone: <RotateCcw size={14} />,
                onClick: () => setReprendreAConfirmer(true),
                disabled: !backup.backup,
                title: backup.backup ? s.reprendreAide(dateBackup) : s.reprendreSans,
              },
              {
                cle: 'importer',
                libelle: s.importerPrepa,
                icone: <Download size={14} />,
                onClick: ouvrirFichier,
                // Dans l'app de bureau, la prépa vient d'un autre APPAREIL.
                title: aideImporter,
              },
              ...entreesEnPlus.filter((e) => !e.danger),
              // ⚠️ N'apparaît QUE si un compte a été importé — comme dans la barre.
              ...(backup.importe
                ? [
                    {
                      cle: 'reinitialiser',
                      libelle: s.reinitialiser,
                      icone: <History size={14} />,
                      onClick: () => setResetAConfirmer(true),
                      title: s.reinitialiserAide(dateImport),
                      danger: true,
                    },
                  ]
                : []),
              ...entreesEnPlus.filter((e) => e.danger),
            ]}
          />
      ) : (
      <>
      {/* ⚠️ **Une rangée par TYPE d'action**, et non une seule file de six
          boutons. Les trois premiers agissent sur l'état COURANT de la prépa
          (le figer, y revenir) ; les trois suivants échangent un FICHIER avec
          l'extérieur. Alignés d'affilée, « Réinitialiser » et « Exporter » se
          lisaient comme voisins alors qu'ils n'ont rien à voir — et le
          séparateur vertical qui les distinguait passait inaperçu dès que la
          rangée se repliait, ce qu'elle fait sur tout écran étroit. */}
      {/* ⚠️ `data-grille-actions` : dans le panneau mobile, les DEUX rangées
          fusionnent en une seule grille de six cellules égales (voir
          index.css). Chacune y formait sinon sa propre grille de trois
          colonnes, et celle qui perdait « Réinitialiser » — absent tant qu'aucun
          compte n'a été importé — étirait sa dernière cellule. */}
      {/* ⚠️ **Une seule ligne au-dessus de `lg`, deux en dessous.** Sur un écran
          large, les six boutons tiennent côte à côte : les empiler en deux
          rangées y laissait une colonne de vide à droite et faisait descendre la
          prépa d'une ligne pour rien.
          ⚠️ Les deux GROUPES survivent au passage en ligne, séparés par un
          FILET vertical. C'est ce qui continue de dire que « Réinitialiser » et
          « Exporter » n'ont rien à voir : les trois premiers agissent sur l'état
          courant de la prépa, les trois suivants échangent un fichier avec
          l'extérieur. Sur une seule ligne, un simple écart ne suffisait plus à
          les distinguer — six boutons régulièrement espacés se lisent comme six
          actions équivalentes.
          ⚠️ `lg:` et non `compact:` : c'est une question de PLACE, pas de
          pointeur — et sous `lg`, les rangées sont de toute façon reprises par
          la grille du panneau (voir index.css). */}
      <div
        data-grille-actions
        data-passe-grille
        className="flex flex-col gap-1.5 lg:flex-row lg:flex-wrap lg:items-stretch lg:gap-4"
      >
      {/* ⚠️ Écart PLUS LARGE sous `sm`, où les boutons sont des icônes nues :
          sans cadre pour les délimiter, six icônes à 8 px d'intervalle se lisent
          comme une frise continue, et l'on ne sait plus où finit l'une et où
          commence la suivante. C'est l'espace qui remplace le trait. */}
      <div data-rangee-actions className="flex flex-wrap items-center gap-2 compact:gap-4">
        <Bouton
          {...ACTION}
          onClick={() => (backup.backup ? setEcraserAConfirmer(true) : sauvegarder())}
          disabled={vide}
          aria-label={s.sauvegarder}
          icone={<Save size={14} />}
          libelle={s.sauvegarder}
          title={vide ? s.sauvegarderVide : s.sauvegarderAide}
        />

        <Bouton
          {...ACTION}
          onClick={() => setReprendreAConfirmer(true)}
          disabled={!backup.backup}
          aria-label={s.reprendre}
          icone={<RotateCcw size={14} />}
          libelle={s.reprendre}
          title={backup.backup ? s.reprendreAide(dateBackup) : s.reprendreSans}
        />

        {/* ⚠️ N'apparaît QUE si un compte a été importé : sans point d'import,
            le bouton n'aurait aucun état où revenir. Le griser en permanence
            aurait ajouté une promesse à celui qui n'importe jamais de compte. */}
        {backup.importe && (
          <Bouton
            {...ACTION}
            onClick={() => setResetAConfirmer(true)}
            aria-label={s.reinitialiser}
            icone={<History size={14} />}
            libelle={s.reinitialiser}
            title={s.reinitialiserAide(dateImport)}
          />
        )}

      </div>

      {/* ⚠️ **Filet visible au-dessus de `lg` seulement.** Sous cette largeur les
          deux groupes sont l'un SOUS l'autre, et un trait vertical entre deux
          lignes empilées ne sépare rien ; dans le panneau mobile, il deviendrait
          en plus une cellule de la grille des actions.
          ⚠️ `self-stretch` : sa hauteur est celle de la rangée, pas une valeur
          écrite en dur qui se désaccorderait au premier changement de taille de
          bouton. */}
      <div aria-hidden className="hidden w-px self-stretch bg-border lg:block" />

      <div data-rangee-actions className="flex flex-wrap items-center gap-2 compact:gap-4">
        <Bouton
          {...ACTION}
          onClick={() => setExportAChoisir(true)}
          disabled={vide}
          aria-label={textes.commun.exporter}
          icone={<Upload size={14} />}
          libelle={textes.commun.exporter}
          title={s.exporterAide}
        />

        {/* ⚠️ DEUX boutons pour un même format de fichier, parce que ce sont
            deux intentions : reprendre une prépa à soi (elle remplace), ou
            regarder celle d'un ami (elle ne touche à rien). Un seul bouton
            obligerait à demander « et maintenant, j'en fais quoi ? » après coup,
            alors que l'utilisateur le sait déjà en cliquant. */}
        <Bouton
          {...ACTION}
          onClick={ouvrirFichier}
          aria-label={textes.commun.importer}
          icone={<Download size={14} />}
          libelle={textes.commun.importer}
          title={aideImporter}
        />
      </div>
      </div>
      </>
      )}

      {/* Le point de sauvegarde est ANNONCÉ : sans repère visible, on ne sait
          pas s'il existe ni de quand il date — donc on n'ose pas expérimenter. */}
      {backup.backup && (
        /* ⚠️ Dans le panneau mobile, cette ligne devient une CELLULE de la
           grille des actions : la racine de la barre y est effacée
           (`display: contents`), donc tous ses enfants remontent en cellules.
           Elle traverse les trois colonnes par une règle d'index.css — une
           largeur en `w-full` ne suffisait pas, elle remplit la cellule, qui
           fait un tiers. */
        <p className={`mt-1.5 font-mono text-micro text-ink-dim ${enMenu ? 'basis-full' : ''}`}>
          {/* ⚠️ Le NOMBRE de monstres a disparu de cette ligne. Il ne servait
              à rien qu'on vienne y chercher : ce qu'on veut savoir, c'est
              QUAND le point a été posé, pour décider si l'on peut y revenir
              sans perdre le travail de la session. Le compte, lui, se lit sur
              la prépa elle-même, juste en dessous. */}
          {s.pointDeSauvegarde(dateBackup)}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // permet de recharger le même fichier
          if (!f) return;
          f.text().then(lireFichier);
        }}
      />

      {msg && (
        <p className={`mt-2 text-xs ${enMenu ? 'basis-full' : ''} ${msg.error ? 'text-bad' : 'text-good'}`} role="status">
          {msg.text}
        </p>
      )}

      {report && (report.errors.length > 0 || report.warnings.length > 0) && (
        enMenu ? (
          <div className="basis-full">
            <RtaValidationReport report={report} onClose={() => setReport(null)} />
          </div>
        ) : (
          <RtaValidationReport report={report} onClose={() => setReport(null)} />
        )
      )}

      {/* Écraser un point existant : c'est une perte, donc on confirme. */}
      {ecraserAConfirmer && (
        <ConfirmDialog
          titre={s.ecraserTitre}
          message={
            <>
              {s.ecraserAvant} <b className="text-ink">{dateBackup}</b>{' '}
              {s.ecraserApres(Object.keys(backup.backup?.state.entries ?? {}).length, nbMonstres)}
            </>
          }
          libelleAction={s.remplacer}
          destructif
          onCancel={() => setEcraserAConfirmer(false)}
          onConfirm={() => {
            setEcraserAConfirmer(false);
            sauvegarder();
          }}
        />
      )}

      {reprendreAConfirmer && backup.backup && (
        <ConfirmDialog
          titre={s.reprendreTitre}
          message={
            <>
              {s.reprendreAvant(nbMonstres)}{' '}
              <b className="text-ink">{dateBackup}</b>{' '}
              {s.reprendreApres(Object.keys(backup.backup.state.entries).length)}
            </>
          }
          libelleAction={s.reprendre}
          destructif
          onCancel={() => setReprendreAConfirmer(false)}
          onConfirm={() => {
            setReprendreAConfirmer(false);
            reprendre();
          }}
        />
      )}

      {/* ⚠️ La confirmation la plus bavarde de la barre, et elle le mérite : ce
          geste efface tout le classement fait depuis l'import, ET le point de
          sauvegarde manuel devient une référence vers un état qu'on quitte. On
          dit donc les deux, et on rappelle qu'un export est la seule façon de
          garder ce travail. */}
      {resetAConfirmer && backup.importe && (
        <ConfirmDialog
          titre={s.resetTitre}
          message={
            <>
              {s.resetAvant(nbMonstres)}{' '}
              <b className="text-ink">{dateImport}</b>{' '}
              {s.resetApres(Object.keys(backup.importe.state.entries).length)}{' '}
              <b className="text-ink">{s.resetPerte}</b>{' '}
              {s.resetPerteDetail}
              {backup.backup && (
                <>
                  {' '}
                  {s.resetSauvegardeAvant} <b className="text-ink">{dateBackup}</b> {s.resetSauvegardeApres}
                </>
              )}
              <br />
              <span className="text-ink-dim">{s.resetConseil}</span>
            </>
          }
          libelleAction={s.reinitialiser}
          destructif
          onCancel={() => setResetAConfirmer(false)}
          onConfirm={() => {
            setResetAConfirmer(false);
            reinitialiser();
          }}
        />
      )}

      {aConfirmer && (
        <ConfirmDialog
          titre={s.importTitre}
          message={
            <>
              {s.importRemplace(aConfirmer.resume, nbMonstres)}{' '}
              {backup.backup ? (
                s.importSauvegardeIntacte
              ) : (
                <>
                  <b className="text-ink">{s.importSansSauvegarde}</b> {s.importConseil}
                </>
              )}{' '}
              {s.importRunes}
              {aConfirmer.perso > 0 && (
                <>
                  {' '}
                  {s.importPersoAvant(aConfirmer.perso)} <b className="text-ink">{s.importPersoGras}</b>{' '}
                  {s.importPersoApres}
                </>
              )}
              {/* Si l'intention était de regarder la prépa d'un ami, ce dialogue
                  est le dernier endroit où le dire — après, c'est remplacé. */}
              <br />
              <span className="text-ink-dim">{s.importConsulter}</span>
            </>
          }
          libelleAction={s.remplacerMaPrepa}
          destructif
          onCancel={() => setAConfirmer(null)}
          onConfirm={() => {
            // ⚠️ C'est ICI que les monstres perso sont recréés — pas avant :
            // annuler ne doit rien laisser derrière soi.
            const { state, categories } = appliquer(
              aConfirmer.snapshot,
              monsterByCom2us,
              rta.state,
              (p) =>
                onCreateMonster(
                  p.nom,
                  p.element,
                  p.vitesse,
                  p.lead
                    ? {
                        stat: p.lead.stat,
                        amount: p.lead.amount,
                        area: p.lead.area === 'Element' ? 'Element' : 'General',
                      }
                    : null
                )
            );
            rta.replaceAll(state);
            cats.replaceAll(categories);
            setMsg({ text: s.reprise(aConfirmer.resume) });
            setAConfirmer(null);
          }}
        />
      )}

      {exportAChoisir && (
        <ChoixExport
          avecRunes={avecRunes}
          onAnnuler={() => setExportAChoisir(false)}
          onChoisir={(niveau) => {
            setExportAChoisir(false);
            exporter(niveau);
          }}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Choix d'export : avec ou sans l'équipement
 * -----------------------------------------------------------------------
 *
 * ⚠️ **Une question, pas une case à cocher enfouie.** Ce que le fichier contient
 * n'est pas un détail : partager ses runes, c'est montrer ce qu'on possède.
 * Certains le veulent (c'est tout l'intérêt de consulter la prépa d'un ami),
 * d'autres non. Le choix est donc posé à voix haute, au moment d'exporter, avec
 * ce que chaque option donne à voir.
 *
 * ⚠️ Aucune des deux réponses ne détruit quoi que ce soit : les deux
 * téléchargent un fichier. « Avec » est mis en avant parce que c'est ce qui rend
 * la consultation utile, pas parce que l'autre serait un mauvais choix.
 */
function ChoixExport({
  avecRunes,
  onChoisir,
  onAnnuler,
}: {
  avecRunes: number;
  onChoisir: (niveau: NiveauPartage) => void;
  onAnnuler: () => void;
}) {
  const c = useTraduction().sauvegardeRta.choix;
  const options: {
    cle: NiveauPartage;
    icone: typeof Eye;
    titre: string;
    detail: string;
    compte?: number;
    desactive?: boolean;
  }[] = [
    {
      cle: 'complet',
      icone: Eye,
      titre: c.completTitre,
      detail: c.completDetail,
      compte: avecRunes,
      desactive: avecRunes === 0,
    },
    {
      cle: 'vitesses',
      icone: Gauge,
      titre: c.vitessesTitre,
      detail: c.vitessesDetail,
    },
    {
      cle: 'ordre',
      icone: EyeOff,
      titre: c.ordreTitre,
      detail: c.ordreDetail,
    },
  ];

  // ⚠️ La coquille `Modale` et non un voile recopié : ce dialogue en réécrivait
  // un, et perdait donc EN SILENCE le piège à focus, le retour du focus à
  // l'ouvreur, la fermeture à Échap et le blocage du défilement de la page
  // derrière. Rien ne le signalait à l'écran — c'est exactement ce qu'une
  // coquille partagée existe pour empêcher.
  return (
    // ⚠️ AVEC la croix, contrairement aux confirmations : ce dialogue est un
    // CHOIX dont les options sont elles-mêmes les actions. Il n'a pas de bouton
    // « Annuler » qui ferait office de sortie — la croix est donc la seule porte
    // visible, et c'est précisément le cas où elle est nécessaire.
    <Modale
      onClose={onAnnuler}
      labelledBy="export-rta-titre"
      largeur="max-w-[460px]"
      croix
      titre={c.titre}
      sousTitre={
        <>
          {c.sousTitre} <b className="text-ink">{c.sousTitreGras}</b>.
        </>
      }
    >
        {avecRunes === 0 && (
          <p className="mb-3 rounded-lg border border-border bg-panel2 px-3 py-2 text-micro leading-relaxed text-ink-dim">
            {c.sansRunes}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {options.map((o, i) => {
            const Icone = o.icone;
            return (
              <Option
                key={o.cle}
                onClick={() => onChoisir(o.cle)}
                autoFocus={i === 0}
                disabled={o.desactive}
                icone={<Icone size={16} />}
                titre={o.titre}
                compte={o.compte || undefined}
                description={o.detail}
              />
            );
          })}
        </div>

        {/* ⚠️ Explique POURQUOI chaque palier retire ce qu'il retire. Sans ces
            phrases, les restrictions passent pour arbitraires alors que chacune
            ferme une fuite réelle. */}
        {/* ⚠️ Plus de bouton « Annuler » en pied : la croix de l'en-tête ferme
            désormais, et un dialogue de CHOIX n'a pas d'action à valider — on
            sort en choisissant, ou en refermant. Deux sorties pour la même
            chose obligeaient à se demander laquelle valait quoi. */}
        <p className="mt-3 text-micro leading-relaxed text-ink-dim">
          {c.noteAvant} <b className="text-ink">{c.noteGras}</b> {c.noteApres}
        </p>
    </Modale>
  );
}

