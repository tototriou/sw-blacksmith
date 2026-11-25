import { useMemo, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { RuneDetail } from '../../types';
import { choixEffetRune } from '../../lib/effects';
import { useTraduction } from '../../hooks/useLangue';
import { Bouton, Modale, Selecteur } from '../../ui';
import SetFilter from './SetFilter';
import SlotFilter from './SlotFilter';
import AncientFilter, { AncientFilter as AncientFilterValue, keepAncient } from './AncientFilter';
import { CarteRune } from './RunesList';

const SLOTS = [1, 2, 3, 4, 5, 6];
// Valeur des listes « Stat principale » / « Propriété secondaire » sans filtre.
const TOUTES = 0;

// Les runes exclues de l'Optimisation, pour les rejuger et les remettre.
//
// ⚠️ **Quasi plein écran, la carte complète de la Liste** (`CarteRune`) :
// remettre une rune, c'est la rejuger — substats, meules, gemme. Un résumé
// (principale, set, valeur) ne le permettait pas, et à deux cartes par ligne
// une longue liste d'exclues se parcourait mal.
//
// ⚠️ **Des filtres pour retrouver une rune** : sets, slot, antiques, stat
// principale, propriété secondaire. Les deux derniers sont des listes
// déroulantes, pas la barre de recherche de la Liste (`SubSearchBar`) : elle
// ouvre sa propre modale, et une modale dans une modale se ferme en entier à
// Échap (chacune écoute la touche). L'état est LOCAL : il repart de zéro à
// chaque ouverture, les filtres de la page restent ceux de la page.
//
// ⚠️ **Deux formats** : à la souris, les filtres restent en haut et seule la
// grille défile ; au doigt, ils défilent avec elle — fixés, ils prendraient
// la moitié de l'écran avant la première carte.
export default function FenetreRunesExclues({
  runes,
  onRemettre,
  onToutRemettre,
  onFermer,
}: {
  // Les exclues PRÉSENTES dans l'inventaire.
  runes: RuneDetail[];
  onRemettre: (runeId: number) => void;
  onToutRemettre: () => void;
  onFermer: () => void;
}) {
  const textes = useTraduction();
  const o = textes.optimRunes;
  const f = o.filtresExclues;
  const jeu = textes.jeu;
  const setsPresents = useMemo(() => new Set(runes.map((r) => r.set)), [runes]);
  const [sets, setSets] = useState<Set<string>>(setsPresents);
  const [slots, setSlots] = useState<Set<number>>(new Set(SLOTS));
  const [ancient, setAncient] = useState<AncientFilterValue>('all');
  const [principale, setPrincipale] = useState(TOUTES);
  const [propriete, setPropriete] = useState(TOUTES);

  // Seules les stats que portent les exclues : une entrée qui ne garderait
  // rien ne sert à rien.
  const codesPrincipales = useMemo(
    () => [...new Set(runes.map((r) => r.main.code))].sort((a, b) => a - b),
    [runes]
  );
  const codesProprietes = useMemo(
    () => [...new Set(runes.flatMap((r) => r.subs.map((s) => s.code)))].sort((a, b) => a - b),
    [runes]
  );

  // Un set qui n'était pas là à l'ouverture n'existe pas ici (on ne peut pas
  // exclure depuis la fenêtre) : `sets` couvre donc toujours les présents.
  const visibles = runes.filter(
    (r) =>
      sets.has(r.set) &&
      slots.has(r.slot) &&
      keepAncient(r, ancient) &&
      (principale === TOUTES || r.main.code === principale) &&
      (propriete === TOUTES || r.subs.some((s) => s.code === propriete))
  );
  const filtre =
    sets.size !== setsPresents.size ||
    slots.size !== SLOTS.length ||
    ancient !== 'all' ||
    principale !== TOUTES ||
    propriete !== TOUTES;
  const effacer = () => {
    setSets(new Set(setsPresents));
    setSlots(new Set(SLOTS));
    setAncient('all');
    setPrincipale(TOUTES);
    setPropriete(TOUTES);
  };

  const liste = (
    valeur: number,
    choisir: (v: number) => void,
    libelle: string,
    codes: number[]
  ) => (
    <label className="flex items-center gap-2">
      <span className="label">{libelle}</span>
      <Selecteur
        value={valeur}
        onChange={(e) => choisir(Number(e.target.value))}
        pleineLargeur={false}
        taille="sm"
        aria-label={libelle}
      >
        <option value={TOUTES}>{f.toutes}</option>
        {codes.map((c) => (
          <option key={c} value={c}>
            {choixEffetRune(c, jeu)}
          </option>
        ))}
      </Selecteur>
    </label>
  );

  return (
    <Modale
      onClose={onFermer}
      labelledBy="optim-runes-exclues-titre"
      titre={o.exclusesTitre}
      sousTitre={o.exclusesSousTitre}
      croix
      largeur="max-w-[1400px] h-[90dvh]"
      actions={
        <>
          <Bouton onClick={onToutRemettre} icone={<Undo2 size={14} />} libelle={o.toutRemettre} />
          <Bouton onClick={onFermer} autoFocus ton="accent" fond="doux" libelle={textes.commun.fermer} />
        </>
      }
    >
      <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
        <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2">
          <SetFilter runes={runes} value={sets} onChange={setSets} />
          <SlotFilter value={slots} onChange={setSlots} />
          <div className="flex items-center gap-1">
            <span className="label mr-1">{textes.filtresRunes.runes}</span>
            <AncientFilter value={ancient} onChange={setAncient} />
          </div>
          {liste(principale, setPrincipale, f.principale, codesPrincipales)}
          {liste(propriete, setPropriete, f.propriete, codesProprietes)}
          <Bouton
            onClick={effacer}
            disabled={!filtre}
            taille="sm"
            title={filtre ? undefined : f.aucunFiltre}
            libelle={f.effacer}
          />
        </div>

        <p className="flex-none font-mono text-xs text-ink-dim">{f.compte(visibles.length, runes.length)}</p>

        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {visibles.length === 0 ? (
            <p className="text-sm text-ink-dim">{f.aucune}</p>
          ) : (
            // Même grille que la Liste à la souris (`auto-fill` à 215 px) ;
            // une colonne au téléphone, où la carte garde sa pleine largeur.
            <ul className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(215px,100%),1fr))]">
              {visibles.map((r) => (
                <li key={r.id} className="flex flex-col gap-1.5">
                  <CarteRune rune={r} etroit={false} />
                  <div className="flex justify-end">
                    <Bouton
                      onClick={() => onRemettre(r.id)}
                      taille="sm"
                      title={o.remettreAide}
                      icone={<Undo2 size={14} />}
                      libelle={o.remettre}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modale>
  );
}
