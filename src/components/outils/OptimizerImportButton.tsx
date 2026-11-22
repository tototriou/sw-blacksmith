import { useEffect, useState } from 'react';
import { Check, Download } from 'lucide-react';
import { Bouton } from '../../ui';
import FenetreImport, { type ActionFenetreImport } from '../FenetreImport';
import type { Monster } from '../../types';
import type { ProducteurImportOptimizer, RapportImportOptimizer } from '../../lib/importEquipes';
import type { SourceImportEquipe } from '../../lib/sourcesEquipesEnregistrees';
import type { InventaireCompte } from '../../lib/equipesEnregistrees';
import { producteurChoix, type SelectionImport } from '../../lib/fenetreImport';
import { useTraduction } from '../../hooks/useLangue';

// Ce que la fenêtre d'import montre depuis l'Optimizer : Mes équipes, les
// decks du jeu et les recommandations ; la liste active, pour y ajouter.
export interface ImportFenetreOptimizer {
  sources: SourceImportEquipe[];
  monstreParCom2us: ReadonlyMap<number, Monster>;
  inventaire: InventaireCompte;
  listeActive: { id: string; name: string } | null;
}

export const AUCUN_IMPORT_OPTIMIZER: ImportFenetreOptimizer = {
  sources: [], monstreParCom2us: new Map(), inventaire: { runes: new Map(), artefacts: new Map(), reliques: new Map() }, listeActive: null,
};

interface Props {
  fenetre: ImportFenetreOptimizer;
  // `cible` : la liste active à compléter ; sans elle, une liste se crée.
  onImporter: (produire: ProducteurImportOptimizer, cible?: string) => RapportImportOptimizer;
  rapport: RapportImportOptimizer | null;
  /** Au bout d'une ligne de menus : bouton à sa largeur. */
  enLigne?: boolean;
}

export default function OptimizerImportButton({ fenetre, onImporter, rapport, enLigne = false }: Props) {
  const t = useTraduction();
  const i = t.optimizer.importEquipe;
  const f = t.fenetreImport;
  const [ouvert, setOuvert] = useState(false);
  // Deux secondes de « ✓ Liste créée » ou « ✓ Ajouté à la liste » après un import réussi.
  const [confirme, setConfirme] = useState<'creee' | 'completee' | null>(null);
  useEffect(() => {
    if (!confirme) return;
    const id = setTimeout(() => setConfirme(null), 2000);
    return () => clearTimeout(id);
  }, [confirme]);
  const disponible = fenetre.sources.some((s) => s.raison === null);

  // Réussi, l'import referme la fenêtre (le bouton le confirme) ; un refus
  // reste lisible dans le rapport, fenêtre ouverte.
  const importer = (selection: SelectionImport, cible?: string) => {
    const produire = producteurChoix(fenetre.sources, selection, fenetre.inventaire, 'arene');
    if (!produire) return;
    const r = onImporter(produire, cible);
    if (r.listeCreee || r.listeCompletee) { setOuvert(false); setConfirme(r.listeCreee ? 'creee' : 'completee'); }
  };
  const actions = (selection: SelectionImport): ActionFenetreImport[] => {
    const vide = selection.equipes.length === 0 && selection.monstres.length === 0;
    const active = fenetre.listeActive;
    return [
      { cle: 'ajouter', libelle: active ? f.ajouterA(active.name) : f.ajouterListeActive, disabled: vide || !active,
        title: active ? undefined : f.pasDeListeActive, onClick: (s) => importer(s, active?.id) },
      { cle: 'nouvelle', libelle: f.nouvelleListe, principale: true, disabled: vide, onClick: (s) => importer(s) },
    ];
  };

  return <>
    {/* Les trois libellés occupent la même case : la confirmation ne change
        pas la largeur du bouton, donc rien ne bouge autour de lui. */}
    <Bouton pleineLargeur={!enLigne} aria-label={i.importer} ton={confirme ? 'accent' : undefined}
      icone={confirme ? <Check size={14} /> : <Download size={14} />}
      libelle={<span className="inline-grid">
        <span className={`col-start-1 row-start-1 ${confirme ? 'invisible' : ''}`}>{i.importer}</span>
        <span className={`col-start-1 row-start-1 ${confirme === 'creee' ? '' : 'invisible'}`} role="status">{confirme === 'creee' ? i.creee : ''}</span>
        <span className={`col-start-1 row-start-1 ${confirme === 'completee' ? '' : 'invisible'}`}>{confirme === 'completee' ? i.completee : ''}</span>
      </span>}
      disabled={!disponible} title={disponible ? i.aide : i.aucuneSource}
      aria-expanded={ouvert} onClick={() => setOuvert(true)} />
    {ouvert && (
      <FenetreImport titre={f.titre} sources={fenetre.sources} ordre={['equipes', 'jeu', 'recos']} ongletInitial={null} mode="mixte"
        monstreParCom2us={fenetre.monstreParCom2us} actions={actions} onFermer={() => setOuvert(false)}
        rapport={rapport && <div role="status" aria-label={i.rapport} className="text-ink-dim">
          <p>{rapport.listeCreee ? i.listeCreee(rapport.listeCreee.name, rapport.membresImportes, rapport.equipesCreees)
            : rapport.listeCompletee ? i.listeCompletee(rapport.listeCompletee.name, rapport.membresImportes, rapport.equipesCreees) : i.aucuneListe}</p>
          {rapport.ignores.map((m, n) => <p key={`ignore-${n}`}>{i.ignore(m.libelle, m.raison)}</p>)}
          {rapport.messages.map((m, n) => <p key={`message-${n}`}>{m}</p>)}
        </div>} />
    )}
  </>;
}
