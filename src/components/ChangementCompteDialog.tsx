import { AlertTriangle } from 'lucide-react';
import Bouton from '../ui/Bouton';
import { Modale } from '../ui/Dialogs';
import { useTraduction } from '../hooks/useLangue';

// Avant un changement de compte (application de bureau : choisir un autre
// invocateur du dossier SW Exporter, ou un dossier, qui peut en désigner un
// d'office) quand le travail a changé depuis la
// dernière sauvegarde. Le compte choisi remplace prépa RTA, siège et
// « Mon compte » : on propose de garder l'actuel dans une session d'abord.
//
// ⚠️ **Le défaut ne perd rien** : « Sauvegarder et changer » est mis en avant
// et reçoit le focus ; « Changer sans sauvegarder », la seule action qui perd,
// porte le ton `danger`. Échap et le clic à côté annulent.
// ⚠️ Pas de croix : « Annuler » est la sortie (voir ConfirmDialog).
export default function ChangementCompteDialog({
  sauvegardeIndisponible,
  onSauvegarder,
  onChanger,
  onAnnuler,
}: {
  // Pourquoi « Sauvegarder et changer » est désactivé, ou `null`.
  sauvegardeIndisponible: string | null;
  onSauvegarder: () => void;
  onChanger: () => void;
  onAnnuler: () => void;
}) {
  const textes = useTraduction();
  const c = textes.changementCompte;
  return (
    <Modale
      onClose={onAnnuler}
      labelledBy="changement-compte-titre"
      titre={c.titre}
      sousTitre={c.texte}
      icone={
        <span className="mt-0.5 flex-none rounded-lg bg-warn/15 p-2 text-warn">
          <AlertTriangle size={18} />
        </span>
      }
      actionsEmpilees
      actions={
        <>
          <Bouton onClick={onChanger} ton="danger" fond="vide" trait="plein" libelle={c.sansSauvegarder} />
          <Bouton onClick={onAnnuler} fond="vide" trait="plein" libelle={textes.commun.annuler} />
          <Bouton
            onClick={onSauvegarder}
            autoFocus
            ton="accent"
            fond="plein"
            libelle={c.sauvegarderEtChanger}
            disabled={sauvegardeIndisponible !== null}
            title={sauvegardeIndisponible ?? undefined}
          />
        </>
      }
    />
  );
}
