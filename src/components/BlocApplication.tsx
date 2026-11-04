import { ReactNode, useEffect, useState } from 'react';
import {
  EtatMiseAJour,
  EtatSwex,
  rechercherMiseAJour,
  redemarrerPourMettreAJour,
  suivreMiseAJour,
  telechargerMiseAJour,
} from '../lib/bureau';
import { useEtatSwex } from '../hooks/useEtatSwex';
import { useTraduction } from '../hooks/useLangue';
import type { Dictionnaire } from '../i18n/fr';
import { formatDateHeure } from '../i18n/format';
import Bouton from '../ui/Bouton';
import Selecteur from '../ui/Selecteur';

// Le bloc « Application » des Réglages — application de bureau seulement.
// ⚠️ **La mise à jour reste à portée** : remise à plus
// tard (la croix de la notification), elle se fait ici quand il veut. UN
// bouton, toujours affiché, qui suit la phase (bureau/miseAJour.ts) —
// désactivé quand il n'y a rien à faire, jamais retiré.

export interface PresentationMiseAJour {
  libelle: string;
  // Absente : bouton désactivé.
  action?: () => void;
  // La ligne sous la version — toujours une : le bloc ne change pas de
  // hauteur d'une phase à l'autre.
  texte: string;
}

// Pure : ce que le bloc montre pour un état (`null` : la page n'a encore rien
// reçu, comme « aucune »).
export function presentationMiseAJour(etat: EtatMiseAJour | null, t: Dictionnaire): PresentationMiseAJour {
  const a = t.application;
  switch (etat?.phase ?? 'aucune') {
    case 'aucune':
      return { libelle: a.rechercher, action: rechercherMiseAJour, texte: a.aucune };
    case 'recherche':
      return { libelle: a.recherche, texte: a.enRecherche };
    case 'a-jour':
      return { libelle: a.rechercher, action: rechercherMiseAJour, texte: a.aJour };
    case 'injoignable':
      return { libelle: a.rechercher, action: rechercherMiseAJour, texte: a.injoignable };
    case 'disponible':
      return { libelle: a.mettreAJour, action: telechargerMiseAJour, texte: a.disponible(etat!.version) };
    case 'telechargement':
      return { libelle: a.telechargement, texte: a.enTelechargement(etat!.version) };
    case 'prete':
      return { libelle: a.redemarrer, action: redemarrerPourMettreAJour, texte: a.prete(etat!.version) };
    case 'echec':
      return { libelle: a.reessayer, action: telechargerMiseAJour, texte: a.echec };
  }
}

export default function BlocApplication({ classeCarte, intitule }: { classeCarte: string; intitule?: ReactNode }) {
  const textes = useTraduction();
  const [etat, setEtat] = useState<EtatMiseAJour | null>(null);
  useEffect(() => suivreMiseAJour(setEtat), []);
  const p = presentationMiseAJour(etat, textes);
  return (
    // `data-bloc-application` : repère du mode preuve (bureau/preuve.ts).
    <section data-bloc-application>
      {intitule}
      <div className={classeCarte}>
        <div className="py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">{textes.application.version(__APP_VERSION__)}</span>
            {/* ⚠️ Largeur réservée : « Rechercher » → « Recherche… » ne
                déplace pas le bouton qu'on vient de cliquer. */}
            <Bouton
              taille="sm"
              libelle={p.libelle}
              onClick={p.action}
              disabled={!p.action}
              className="flex-none min-w-[8.5rem]"
            />
          </div>
          <p className="mt-1 text-micro text-ink-dim leading-snug">{p.texte}</p>
        </div>
        <ReglageSwex />
      </div>
    </section>
  );
}

// ── Le dossier SW Exporter ─────────────────────────────

const date = (ms: number, t: Dictionnaire) =>
  formatDateHeure(ms, t.codeLangue, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export interface PresentationSwex {
  // La ligne sous « Dossier SW Exporter ».
  dossier: string;
  // Les choix d'invocateur (vide : sélecteur désactivé).
  options: { valeur: string; libelle: string }[];
  // La ligne sous « Invocateur ».
  invocateur: string;
}

// Pure : ce que montrent les deux lignes pour un état (`null` : rien reçu).
// Toujours une ligne sous chacune (hauteur constante).
export function presentationSwex(etat: EtatSwex | null, t: Dictionnaire): PresentationSwex {
  const a = t.application;
  if (!etat?.dossier) {
    return { dossier: a.swexSansDossier, options: [], invocateur: a.swexAucunDossier };
  }
  if (etat.introuvable) {
    return { dossier: etat.dossier, options: [], invocateur: a.swexIntrouvable };
  }
  // Deux invocateurs du même nom (deux serveurs) : l'identifiant les sépare.
  const homonymes = new Set(etat.exports.filter((e, i, t) => t.findIndex((x) => x.nom === e.nom) !== i).map((e) => e.nom));
  const options = etat.exports.map((e) => ({ valeur: e.fichier, libelle: homonymes.has(e.nom) ? `${e.nom} (${e.id})` : e.nom }));
  if (options.length === 0) {
    return { dossier: etat.dossier, options, invocateur: a.swexAucunExport };
  }
  const suivi = etat.exports.find((e) => e.fichier === etat.fichier);
  if (!suivi) return { dossier: etat.dossier, options, invocateur: a.swexChoisirInvocateur };
  const invocateur =
    etat.dernierLu !== null && etat.dernierLu >= suivi.modifie
      ? a.swexLu(date(suivi.modifie, t))
      : a.swexEnLecture(date(suivi.modifie, t));
  return { dossier: etat.dossier, options, invocateur };
}

// Le choix de l'invocateur se fait AUSSI depuis la carte du compte, en tête de
// la barre latérale (SidebarCompte) : un seul réglage, deux accès.
function ReglageSwex() {
  const { etat, agir, choisirInvocateur, choisirDossier } = useEtatSwex();
  const textes = useTraduction();
  const a = textes.application;
  const p = presentationSwex(etat, textes);
  return (
    // `data-reglage-swex` : repère du mode preuve (bureau/preuve.ts).
    <div data-reglage-swex className="border-t border-border/60">
      <div className="py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink">{a.dossierSwex}</span>
          <div className="flex flex-none gap-2">
            {/* Toujours affiché, désactivé sans dossier : il ne disparaît pas
                selon l'état. */}
            <Bouton
              taille="sm"
              fond="vide"
              trait="aucun"
              libelle={textes.commun.retirer}
              title={a.retirerSwex}
              disabled={!etat?.dossier}
              onClick={() => void agir((s) => s.oublier())}
            />
            <Bouton taille="sm" libelle={a.choisir} onClick={choisirDossier} />
          </div>
        </div>
        <p className="mt-1 break-all text-micro leading-snug text-ink-dim">{p.dossier}</p>
      </div>
      <div className="border-t border-border/60 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink">{a.invocateur}</span>
          <Selecteur
            taille="sm"
            pleineLargeur={false}
            aria-label={a.invocateurAria}
            value={etat?.fichier ?? ''}
            disabled={p.options.length === 0}
            onChange={(e) => {
              const fichier = e.target.value;
              if (fichier) choisirInvocateur(fichier);
            }}
            className="min-w-[10rem]"
          >
            <option value="" disabled>
              {p.options.length === 0 ? '—' : a.choisir}
            </option>
            {p.options.map((o) => (
              <option key={o.valeur} value={o.valeur}>
                {o.libelle}
              </option>
            ))}
          </Selecteur>
        </div>
        <p className="mt-1 text-micro leading-snug text-ink-dim">{p.invocateur}</p>
      </div>
    </div>
  );
}
