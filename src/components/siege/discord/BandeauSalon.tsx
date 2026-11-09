import { GitMerge, Send } from 'lucide-react';
import { Bouton } from '../../../ui';
import { useLangue, useTraduction } from '../../../hooks/useLangue';
import { formatDateHeure } from '../../../i18n/format';
import { etatAffiche, raisonPublier } from '../../../lib/provenancesRecos';
import type { Reco } from '../../../types';
import { PastilleEtat } from './Provenances';

// Le bandeau d'un salon, au-dessus de la carte de sa recommandation : serveur ›
// salon, état, date de la version reçue et ce que l'état veut dire, puis
// « Publier » — ou « Fusionner » en conflit. ⚠️ « Publier » est TOUJOURS
// affiché, désactivé avec sa raison (à jour, lecture seule, hors connexion).
// Au téléphone, le bouton passe sous le texte, pleine largeur.
export default function BandeauSalon({ reco, connecte, enCours, onPublier, onFusionner }: {
  reco: Reco;
  connecte: boolean;
  enCours: boolean;
  onPublier: () => void;
  onFusionner: () => void;
}) {
  const t = useTraduction().recosDiscord;
  const langue = useLangue();
  const lien = reco.lien;
  const etat = etatAffiche(reco);
  if (!lien || !etat) return null;
  const conflit = etat === 'conflit';
  const raison = conflit ? null : raisonPublier(reco, connecte);
  const date = formatDateHeure(new Date(lien.base.date), langue, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div
      data-bandeau-salon={lien.salonId}
      className={`flex flex-col gap-2 rounded-t-xl border border-b-0 border-border-soft px-3 py-2 text-xs lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-3 ${
        conflit ? 'bg-warn-soft' : 'bg-panel2'
      }`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 lg:flex-1">
        <span className="min-w-0 truncate text-ink-dim">{lien.nomServeur} ›</span>
        <span className="font-semibold text-ink">#{lien.nomSalon}</span>
        <PastilleEtat etat={etat} />
        <span className="text-ink-dim">{t.versionDu(date)} · {t.etatsPhrase[etat]}</span>
      </div>
      {conflit ? (
        <Bouton onClick={onFusionner} disabled={enCours} fond="plein" ton="accent" taille="sm" icone={<GitMerge size={13} />}
          libelle={t.fusionner} className="max-lg:w-full max-lg:justify-center" />
      ) : (
        <Bouton onClick={onPublier} disabled={!!raison || enCours} title={raison ? t.raisonsPublier[raison] : undefined}
          fond="plein" ton="accent" taille="sm" icone={<Send size={13} />} libelle={t.publier} className="max-lg:w-full max-lg:justify-center" />
      )}
    </div>
  );
}
