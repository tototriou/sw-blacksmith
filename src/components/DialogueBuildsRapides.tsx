import { ReactNode, useState } from 'react';
import { runeSetIconFilter } from '../lib/effects';
import {
  BROKEN,
  BUILDS_PAR_COMBO_MAX,
  BUILDS_PAR_COMBO_MIN,
  ComboVitesse,
  SETS_DEUX,
  SETS_QUATRE,
  cleCombo,
} from '../lib/buildsRapides';
import {
  REGLAGE_BUILDS_RAPIDES_DEFAUT,
  ReglageBuildsRapides,
  setReglageBuildsRapides,
  useBuildsRapides,
} from '../hooks/useBuildsRapides';
import { Bouton, BoutonIcone, Jeton, Modale, NumberField } from '../ui';
import RuneIcon from './RuneIcon';
import { nomSet, type LexiqueJeu } from '../i18n/jeu';
import type { Dictionnaire } from '../i18n';
import { useTraduction } from '../hooks/useLangue';
import SymbolesCombo, { nomCombo } from './SymbolesCombo';


// Résumé d'une ligne, sous l'intitulé du réglage.
export function resumeBuildsRapides(r: ReglageBuildsRapides, t: Dictionnaire['parametres']): string {
  return t.resumeBuildsRapides(r.combos.length, r.nombre);
}

// Fenêtre du réglage « Builds les plus rapides » : le nombre de builds par
// combinaison, et les combinaisons affichées. Chaque geste s'applique tout de
// suite, comme les autres réglages : il n'y a rien à valider.
export default function DialogueBuildsRapides({ onClose }: { onClose: () => void }) {
  const textes = useTraduction();
  const jeu: LexiqueJeu = textes.jeu;
  const d = textes.buildsRapides.dialogue;
  const label = (key: string) => nomSet(jeu, key);
  const reglage = useBuildsRapides();
  const [quatre, setQuatre] = useState(SETS_QUATRE[0]);
  const presentes = new Set(reglage.combos.map(cleCombo));
  const parDefaut =
    reglage.nombre === REGLAGE_BUILDS_RAPIDES_DEFAUT.nombre &&
    JSON.stringify(reglage.combos) === JSON.stringify(REGLAGE_BUILDS_RAPIDES_DEFAUT.combos);

  const ecrire = (v: Partial<ReglageBuildsRapides>) => setReglageBuildsRapides({ ...reglage, ...v });
  const ajouter = (deux: string) => ecrire({ combos: [...reglage.combos, { quatre, deux }] });
  const retirer = (c: ComboVitesse) => ecrire({ combos: reglage.combos.filter((x) => cleCombo(x) !== cleCombo(c)) });

  // Un set qu'on peut poser en second : déjà là → désactivé, avec la raison.
  const second = (deux: string, icone: ReactNode, libelle: string) => {
    const deja = presentes.has(cleCombo({ quatre, deux }));
    return (
      <BoutonIcone
        key={deux}
        cadre
        libelle={deja ? d.dejaAffichee(label(quatre), libelle) : d.ajouter(label(quatre), libelle)}
        icone={icone}
        disabled={deja}
        onClick={() => ajouter(deux)}
        // Grille serrée d'icônes de set : même exemption que SetComboPicker.
        data-cible-fine
        className="h-8 w-8"
      />
    );
  };

  return (
    <Modale
      onClose={onClose}
      labelledBy="titre-builds-rapides"
      titre={textes.buildsRapides.titre}
      sousTitre={d.sousTitre}
      croix
      largeur="max-w-[520px]"
      // Chaque geste s'applique tout de suite : la croix est la seule sortie,
      // comme sur un dialogue de choix (docs/03-developpeur/interface/librairie-ui/modales-et-panneaux.md).
      actions={
        <Bouton
          fond="vide"
          libelle={d.retablir}
          disabled={parDefaut}
          title={parDefaut ? d.dejaDefaut : d.defautAide(REGLAGE_BUILDS_RAPIDES_DEFAUT.combos.length, REGLAGE_BUILDS_RAPIDES_DEFAUT.nombre)}
          onClick={() => setReglageBuildsRapides(REGLAGE_BUILDS_RAPIDES_DEFAUT)}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink">{d.parCombinaison}</span>
          <NumberField
            value={reglage.nombre}
            min={BUILDS_PAR_COMBO_MIN}
            max={BUILDS_PAR_COMBO_MAX}
            onChange={(v) => v != null && ecrire({ nombre: v })}
            ariaLabel={d.parCombinaison}
          />
        </div>

        {/* ⚠️ L'ajout AVANT la liste : un jeton ajouté allonge la liste, il ne
            doit pas pousser vers le bas les boutons qu'on vient de cliquer. */}
        <div>
          <p className="label mb-1.5">{d.ajouterCombinaison}</p>
          <div className="grid grid-cols-[auto_1fr] rounded-lg border border-border bg-panel p-2">
            <div className="pr-3">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-dimmer">{d.set4}</p>
              <div className="grid grid-cols-3 gap-1">
                {SETS_QUATRE.map((k) => (
                  <BoutonIcone
                    key={k}
                    cadre
                    actif={k === quatre}
                    aria-pressed={k === quatre}
                    libelle={label(k)}
                    icone={<RuneIcon setKey={k} size={20} filter={runeSetIconFilter(k === quatre)} />}
                    onClick={() => setQuatre(k)}
                    data-cible-fine
                    className="h-8 w-8"
                  />
                ))}
              </div>
            </div>
            <div className="border-l border-border-soft pl-3">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-dimmer">
                {d.avec(label(quatre))}
              </p>
              <div className="flex flex-wrap gap-1">
                {SETS_DEUX.map((k) =>
                  second(k, <RuneIcon setKey={k} size={20} filter={runeSetIconFilter(false)} />, label(k))
                )}
                {/* Broken : pas de symbole de set, le mot. */}
                <Bouton
                  taille="sm"
                  libelle={d.broken}
                  title={
                    presentes.has(cleCombo({ quatre, deux: BROKEN }))
                      ? d.dejaAffichee(label(quatre), d.broken)
                      : d.ajouterBroken(label(quatre))
                  }
                  disabled={presentes.has(cleCombo({ quatre, deux: BROKEN }))}
                  onClick={() => ajouter(BROKEN)}
                  data-cible-fine
                  className="h-8"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="label mb-1.5">{d.affichees(reglage.combos.length)}</p>
          {reglage.combos.length === 0 ? (
            <p className="text-xs text-ink-dim">{d.aucune}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {reglage.combos.map((c) => (
                <Jeton
                  key={cleCombo(c)}
                  icone={<SymbolesCombo combo={c} taille={14} />}
                  libelle={nomCombo(c, jeu)}
                  onRetirer={() => retirer(c)}
                  libelleRetrait={textes.carteRta.retirer(nomCombo(c, jeu))}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modale>
  );
}
