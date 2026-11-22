import { useId, useState } from 'react';
import { Bouton, Champ, Modale, PiedDeDialogue } from '../../../ui';
import { useTraduction } from '../../../hooks/useLangue';

interface Props {
  // « Équipe N », le premier nom libre : le défaut, repris si le champ est vidé.
  nomParDefaut: string;
  onCreer: (nom: string) => void;
  onFermer: () => void;
  // Les textes de la fenêtre : ceux d'une équipe par défaut, ceux d'un groupe
  // depuis le détail.
  textes?: { titre: string; nom: string; action: string };
}

// « Nouvelle équipe » : le nom se donne dès la création, avant le brouillon.
// Sert aussi à nommer un nouveau groupe.
export default function NouvelleEquipeModale({ nomParDefaut, onCreer, onFermer, textes }: Props) {
  const t = useTraduction();
  const n = textes ?? t.equipes.nouvelleFenetre;
  const id = useId();
  const [nom, setNom] = useState(nomParDefaut);
  const creer = () => onCreer(nom.trim() || nomParDefaut);
  return (
    <Modale onClose={onFermer} labelledBy={id} titre={n.titre} croix largeur="max-w-[420px]"
      actions={<PiedDeDialogue>
        <Bouton libelle={t.commun.annuler} onClick={onFermer} />
        <Bouton ton="accent" fond="plein" libelle={n.action} onClick={creer} />
      </PiedDeDialogue>}>
      <form onSubmit={(ev) => { ev.preventDefault(); creer(); }}>
        <label className="flex flex-col gap-1 text-xs text-ink-dim">
          {n.nom}
          <Champ autoFocus value={nom} onChange={(ev) => setNom(ev.target.value)} onBlur={() => setNom((v) => v.trim())} />
        </label>
      </form>
    </Modale>
  );
}
