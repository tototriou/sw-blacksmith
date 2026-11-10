import { Hash, HelpCircle, LayoutList, LogOut, RefreshCw, Smartphone, Star, AlertTriangle } from 'lucide-react';
import { Bouton, BoutonIcone, ZoneCliquable } from '../../../ui';
import { useTraduction } from '../../../hooks/useLangue';
import { memeProvenance, type EtatAffiche, type GroupeServeur, type Provenance } from '../../../lib/provenancesRecos';
import type { EtatDiscord } from '../../../hooks/useDiscord';

// Les provenances de la page Recommandations : « Toutes les recommandations »,
// « Sur cet appareil », puis un groupe par serveur Discord et ses salons, et le
// compte Discord en pied. À l'ordinateur, une COLONNE à gauche du contenu ; au
// téléphone, le même bloc en tête de la page, à plat
// (docs/02-app/siege/feat-recommandations/rendu-de-la-page.md).

// Mêmes jetons que les pastilles de statut des decks (`PASTILLE_STATUT`,
// RecoCard.tsx) : fond doux du ton, texte du ton, sans contour.
const TON_ETAT: Record<EtatAffiche, string> = {
  'a-jour': 'bg-good-soft text-good',
  modifiee: 'bg-warn-soft text-warn',
  conflit: 'bg-bad-soft text-bad',
  'lecture-seule': 'bg-panel2 text-ink-dim',
};
const POINT_ETAT: Record<EtatAffiche, string> = { 'a-jour': 'bg-good', modifiee: 'bg-warn', conflit: 'bg-bad', 'lecture-seule': 'hidden' };

export function PastilleEtat({ etat }: { etat: EtatAffiche }) {
  const t = useTraduction().recosDiscord;
  return (
    <span data-etat-salon={etat} className={`inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-micro font-semibold ${TON_ETAT[etat]}`}>
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${POINT_ETAT[etat]}`} aria-hidden />
      {t.etats[etat]}
    </span>
  );
}

export interface PropsProvenances {
  groupes: GroupeServeur[];
  compteToutes: number;
  compteAppareil: number;
  provenance: Provenance;
  onChoisir: (p: Provenance) => void;
  discord: EtatDiscord;
  // Application de bureau : les étoiles de favoris.
  favoris: boolean;
  onFavori: (salonId: string) => void;
  onConnecter: () => void;
  onActualiser: () => void;
  onDeconnecter: () => void;
  onAideInstallation: () => void;
  // Au doigt : lignes de 40 px.
  auDoigt?: boolean;
}

function Ligne({ choisie, onClick, icone, nom, fin, auDoigt, favori }: {
  choisie: boolean; onClick: () => void; icone: React.ReactNode; nom: string; fin?: React.ReactNode; auDoigt?: boolean; favori?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-1 rounded-lg ${choisie ? 'bg-accent-soft' : 'hoverable:bg-panel2'}`}>
      {favori}
      <ZoneCliquable
        onClick={onClick}
        aria-current={choisie || undefined}
        className={`flex min-w-0 flex-1 items-center gap-2 px-2 text-left text-sm ${auDoigt ? 'min-h-10' : 'min-h-8'} ${
          choisie ? 'font-semibold text-accent-lisible' : 'text-ink'
        }`}
      >
        <span className="flex-none text-ink-dim" aria-hidden>{icone}</span>
        <span className="min-w-0 flex-1 truncate">{nom}</span>
        {fin}
      </ZoneCliquable>
    </div>
  );
}

const Compteur = ({ n }: { n: number }) => (
  <span className="flex-none rounded-full border border-border-soft px-1.5 font-mono text-micro text-ink-dim">{n}</span>
);

// La liste elle-même : commune à la colonne et à la feuille du téléphone.
export function ListeProvenances(p: PropsProvenances) {
  const t = useTraduction().recosDiscord;
  return (
    <div className="flex flex-col gap-0.5" role="list" aria-label={t.provenances}>
      <Ligne auDoigt={p.auDoigt} choisie={p.provenance.type === 'toutes'} onClick={() => p.onChoisir({ type: 'toutes' })}
        icone={<LayoutList size={14} />} nom={t.toutes} fin={<Compteur n={p.compteToutes} />} />
      <Ligne auDoigt={p.auDoigt} choisie={p.provenance.type === 'appareil'} onClick={() => p.onChoisir({ type: 'appareil' })}
        icone={<Smartphone size={14} />} nom={t.appareil} fin={<Compteur n={p.compteAppareil} />} />
      {p.groupes.map((g) => (
        <div key={g.serveurId} className="mt-2 flex flex-col gap-0.5" data-serveur={g.serveurId}>
          <div className="flex items-center gap-1.5 px-2 pb-0.5 label">
            <span className="min-w-0 truncate">{g.nom}</span>
            {g.botAdmin && (
              <span title={t.botAdmin} aria-label={t.botAdmin} className="flex-none text-warn"><AlertTriangle size={12} /></span>
            )}
          </div>
          {g.salons.map((l) => {
            const salon: Provenance = { type: 'salon', salonId: l.salonId };
            return (
              <Ligne
                key={l.salonId}
                auDoigt={p.auDoigt}
                choisie={memeProvenance(p.provenance, salon)}
                onClick={() => p.onChoisir(salon)}
                icone={<Hash size={14} />}
                nom={l.nom}
                fin={<PastilleEtat etat={l.etat} />}
                favori={p.favoris ? (
                  <BoutonIcone
                    onClick={() => p.onFavori(l.salonId)}
                    taille="serre"
                    icone={<Star size={13} className={l.favori ? 'fill-accent text-accent' : ''} />}
                    libelle={l.favori ? t.retirerFavori : t.favori}
                    aria-pressed={l.favori}
                    className="ml-1 flex-none"
                  />
                ) : undefined}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Le compte Discord, en pied : connecté (qui, Actualiser, Se déconnecter), ou
// l'encart de connexion.
export function CompteDiscord(p: PropsProvenances) {
  const t = useTraduction().recosDiscord;
  const d = p.discord;
  const connecte = d.statut === 'connecte' || (d.statut === 'lecture' && d.utilisateur) || (d.statut === 'indisponible' && d.utilisateur);
  if (connecte && d.utilisateur) {
    const minutes = d.luA ? Math.floor((Date.now() - d.luA) / 60000) : null;
    return (
      <div className="flex flex-col gap-1 px-1" data-compte-discord="connecte">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent-soft text-micro font-bold text-accent-lisible" aria-hidden>
            {d.utilisateur.nom.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{d.utilisateur.nom}</span>
          {/* Connecté aussi, un admin peut vouloir installer le bot ailleurs. */}
          <BoutonIcone onClick={p.onAideInstallation} taille="serre" icone={<HelpCircle size={13} />} libelle={t.connexion.installer} />
          <BoutonIcone onClick={p.onActualiser} disabled={d.statut === 'lecture'} taille="serre"
            icone={<RefreshCw size={13} className={d.statut === 'lecture' ? 'animate-spin motion-reduce:animate-none' : ''} />}
            libelle={t.compte.actualiserAide} />
          <BoutonIcone onClick={p.onDeconnecter} taille="serre" icone={<LogOut size={13} />} libelle={t.compte.deconnecter} />
        </div>
        <span className="text-micro text-ink-dim">
          {d.statut === 'lecture' ? t.compte.lecture : minutes != null ? t.compte.lusIlYa(minutes) : ''}
        </span>
        {/* Application de bureau sans chiffrement sûr (Linux sans trousseau). */}
        {!d.conservable && <span className="text-micro text-warn" data-connexion-non-gardee>{t.compte.nonGardee}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-panel2 p-2.5 text-xs text-ink-dim" data-compte-discord="deconnecte">
      <b className="text-sm text-ink">{t.connexion.titre}</b>
      <span>{t.connexion.texte}</span>
      <Bouton onClick={p.onConnecter} fond="plein" ton="accent" taille={p.auDoigt ? 'md' : 'sm'} pleineLargeur libelle={t.connexion.bouton} />
      <Bouton onClick={p.onAideInstallation} fond="vide" trait="aucun" taille="sm" icone={<HelpCircle size={13} />} libelle={t.connexion.installer} />
    </div>
  );
}

// À l'ordinateur : la colonne, à gauche du contenu.
export function ColonneProvenances(p: PropsProvenances) {
  return (
    <aside className="flex flex-col gap-2 rounded-xl border border-border-soft bg-panel p-2" data-colonne-provenances>
      <ListeProvenances {...p} />
      <div className="mt-1 border-t border-border-soft pt-2">
        <CompteDiscord {...p} />
      </div>
    </aside>
  );
}

// Au téléphone : la même liste et le même compte, EN TÊTE de la page et à
// plat — aucun sélecteur à dérouler (choix du mainteneur, 2026-11-10) : la
// provenance choisie et les autres se voient d'un coup d'œil.
export function ProvenancesTelephone(p: PropsProvenances) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border-soft bg-panel p-2" data-provenances-telephone>
      <ListeProvenances {...p} auDoigt />
      <div className="mt-1 border-t border-border-soft pt-2">
        <CompteDiscord {...p} auDoigt />
      </div>
    </section>
  );
}
