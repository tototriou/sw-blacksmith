import { Selecteur } from '../../../ui';
import { useTraduction } from '../../../hooks/useLangue';
import { CATEGORIES_EQUIPES, libelleRangement, rangement, SOUS_CATEGORIES_EQUIPES, type OngletEquipes } from '../../../lib/equipesEnregistrees';

// Le rangement d'une équipe : un groupe par onglet, l'onglet seul (sans
// catégorie) puis chacune de ses catégories. Chaque option porte le nom
// complet (« Labyrinthe — Boss ») : le menu fermé ne montre que l'option
// choisie, et deux onglets ont des catégories du même nom.
export default function SelecteurRangement({ valeur, onChange, 'aria-label': ariaLabel }: {
  valeur: OngletEquipes; onChange: (o: OngletEquipes) => void; 'aria-label'?: string;
}) {
  const t = useTraduction();
  return (
    <Selecteur value={valeur} aria-label={ariaLabel} onChange={(ev) => onChange(ev.target.value as OngletEquipes)}>
      {/* Sans la RTA : elle garde des prépas, une équipe n'y va pas (et inversement). */}
      {CATEGORIES_EQUIPES.filter((c) => c !== 'rta').map((c) => (
        <optgroup key={c} label={t.equipes.categories[c]}>
          {[c, ...SOUS_CATEGORIES_EQUIPES[c].map((x) => rangement(c, x))].map((o) => (
            <option key={o} value={o}>{libelleRangement(o, t)}</option>
          ))}
        </optgroup>
      ))}
    </Selecteur>
  );
}
