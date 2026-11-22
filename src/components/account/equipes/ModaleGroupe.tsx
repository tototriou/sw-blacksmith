import { useId, useState } from 'react';
import { Bouton, Case, Champ, Modale, PiedDeDialogue } from '../../../ui';
import { useTraduction } from '../../../hooks/useLangue';
import type { EquipeEnregistree } from '../../../lib/equipesEnregistrees';

interface Props {
  // Les équipes de l'onglet ouvert, dans l'ordre de la grille.
  equipes: readonly EquipeEnregistree[];
  // Le groupe modifié ; `null` : un nouveau groupe.
  groupe: string | null;
  // « Groupe N », le premier nom libre : le défaut d'un nouveau groupe.
  nomParDefaut: string;
  // Les autres groupes de l'onglet : un nom pris est refusé.
  autresGroupes: readonly string[];
  onValider: (nom: string, ids: ReadonlySet<string>) => void;
  // Supprimer le groupe modifié (ses équipes restent, sans groupe).
  onSupprimer?: () => void;
  onFermer: () => void;
}

// Former ou modifier un groupe depuis la grille : son nom et les équipes de
// l'onglet qui en font partie. Une équipe d'un autre groupe cochée en change.
export default function ModaleGroupe({ equipes, groupe, nomParDefaut, autresGroupes, onValider, onSupprimer, onFermer }: Props) {
  const t = useTraduction();
  const g = t.equipes.groupes;
  const id = useId();
  const [nom, setNom] = useState(groupe ?? nomParDefaut);
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set(equipes.filter((e) => groupe !== null && e.groupe === groupe).map((e) => e.id)));
  const nomFinal = nom.trim() || (groupe ?? nomParDefaut);
  const refus = ids.size === 0 ? g.edition.auMoinsUne : autresGroupes.includes(nomFinal) ? g.edition.nomPris : null;
  const valider = () => { if (!refus) onValider(nomFinal, ids); };
  const basculer = (x: string) => setIds((s) => { const n = new Set(s); if (n.has(x)) n.delete(x); else n.add(x); return n; });
  return (
    <Modale onClose={onFermer} labelledBy={id} titre={groupe === null ? g.fenetre.titre : g.edition.titre} croix largeur="max-w-[460px]"
      actions={<PiedDeDialogue>
        {groupe !== null && onSupprimer && <Bouton ton="danger" fond="vide" libelle={g.supprimer.action} onClick={onSupprimer} />}
        <Bouton libelle={t.commun.annuler} onClick={onFermer} />
        <Bouton ton="accent" fond="plein" libelle={groupe === null ? g.fenetre.action : g.edition.enregistrer}
          disabled={refus !== null} title={refus ?? undefined} onClick={valider} />
      </PiedDeDialogue>}>
      <form className="flex flex-col gap-3" onSubmit={(ev) => { ev.preventDefault(); valider(); }}>
        <p className="text-xs text-ink-dim">{g.aide}</p>
        <label className="flex flex-col gap-1 text-xs text-ink-dim">
          {g.fenetre.nom}
          <Champ autoFocus value={nom} onChange={(ev) => setNom(ev.target.value)} onBlur={() => setNom((v) => v.trim())} />
        </label>
        {refus === g.edition.nomPris && <p className="text-xs text-warn">{refus}</p>}
        <fieldset className="flex min-w-0 flex-col gap-1">
          <legend className="mb-1 text-xs text-ink-dim">{g.edition.equipes}</legend>
          {equipes.length === 0 ? <p className="text-xs text-ink-dim">{g.edition.aucuneEquipe}</p> : (
            <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
              {equipes.map((e) => (
                <Case key={e.id} checked={ids.has(e.id)} onChange={() => basculer(e.id)} className="min-h-[32px]"
                  libelle={<span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate">{e.nom}</span>
                    {e.groupe && e.groupe !== groupe && <span className="flex-none text-xs text-ink-dim">{g.edition.dansGroupe(e.groupe)}</span>}
                  </span>} />
              ))}
            </div>
          )}
        </fieldset>
      </form>
    </Modale>
  );
}
