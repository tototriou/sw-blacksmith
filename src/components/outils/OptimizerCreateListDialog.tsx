import { useState } from 'react';
import { Bouton, Champ, Modale, Selecteur } from '../../ui';
import type { ContenuListeOptimizer } from '../../lib/optimizerMemberStorage';
import type { OptimizerList } from '../../lib/optimizerExclusion';
import { nomNouvelleListeOptimizer } from '../../lib/optimizerListNames';
import { useTraduction } from '../../hooks/useLangue';

// L'ordre des contenus proposés ; leurs noms sont sous `optimizer.contenus`.
export const CONTENUS_LISTE_OPTIMIZER: readonly ContenuListeOptimizer[] = ['guilde', 'donjon', 'arene'];

export function ContenuListePicker({ contenu, onChange, creation = false }: {
  creation?: boolean;
  contenu: ContenuListeOptimizer | undefined;
  onChange: (contenu: ContenuListeOptimizer) => void;
}) {
  const o = useTraduction().optimizer;
  const menu = <Selecteur aria-label={o.listes.contenuListe} taille="sm"
      ton={creation && !contenu ? 'accent' : 'neutre'} className={creation && contenu ? 'focus:!border-border' : undefined}
      aria-describedby={creation ? 'contenu-liste-aide' : undefined}
      value={contenu ?? ''}
      onChange={e => onChange(e.target.value as ContenuListeOptimizer)}>
      {!contenu && <option value="" disabled>{creation ? o.listes.choisirContenu : o.listes.sansContenu}</option>}
      {CONTENUS_LISTE_OPTIMIZER.map((cle) => <option key={cle} value={cle}>{o.contenus[cle]}</option>)}
    </Selecteur>;
  return <label className={`${creation ? 'flex flex-col gap-1' : 'flex items-center gap-2'} text-xs text-ink-dim`}>{o.listes.contenu}{menu}</label>;
}

export default function OptimizerCreateListDialog({ listes, edition, libelleAction, onValider, onCancel }: {
  listes: OptimizerList[];
  edition?: { nom: string; contenu: ContenuListeOptimizer | undefined };
  libelleAction?: string;
  onValider: (nom: string, contenu: ContenuListeOptimizer) => void;
  onCancel: () => void;
}) {
  const textes = useTraduction();
  const l = textes.optimizer.listes;
  const [nom, setNom] = useState(edition?.nom ?? '');
  const [contenu, setContenu] = useState<ContenuListeOptimizer | undefined>(edition?.contenu);
  const valide = !!contenu && (!edition || !!nom.trim());
  return <Modale titre={edition ? l.editer : l.nouvelle} labelledBy="creer-liste-optimizer" croix onClose={onCancel}
    actions={<>
      <Bouton libelle={textes.commun.annuler} fond="plein" onClick={onCancel} />
      <Bouton type="submit" form="creer-liste-optimizer-form" ton="accent" fond="doux" libelle={libelleAction ?? (edition ? l.enregistrer : textes.commun.creer)} disabled={!valide}
        title={!edition && !contenu ? l.contenuDabord : undefined} />
    </>}>
    <form id="creer-liste-optimizer-form" className="space-y-3" onSubmit={e => { e.preventDefault(); if (valide && contenu) onValider(nom.trim(), contenu); }}>
      <Champ aria-label={l.nom} placeholder={nomNouvelleListeOptimizer(listes, l.nomParDefaut)} value={nom} onChange={e => setNom(e.target.value)} autoFocus />
      <ContenuListePicker contenu={contenu} onChange={setContenu} creation={!edition} />
      {!edition && <p id="contenu-liste-aide" className="text-xs text-ink-dim">{l.contenuObligatoire}</p>}
    </form>
  </Modale>;
}
