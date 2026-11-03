import { Combine, CopyPlus } from 'lucide-react';
import { Modale, Option } from '../../ui';
import type { Reco, RecoPayload } from '../../types';
import { apercuFusion, type BilanFusion } from '../../lib/recoFusion';
import { useTraduction } from '../../hooks/useLangue';
import type { Dictionnaire } from '../../i18n/fr';

// Choix posé à l'import quand le fichier complète une recommandation qu'on a
// déjà : la fusionner, ou l'ajouter à part comme avant. Spec :
// docs/02-app/siege/feat-recommandations/persistance-et-partage.md § Fusion.
//
// ⚠️ **Aucune des deux réponses ne perd rien** : ajouter à part ne touche à
// rien, fusionner n'ajoute que ce qui manque (decks nouveaux, défenses
// nouvelles) sans rien retirer ni réécrire. « Fusionner » vient en premier et
// reçoit le focus : c'est la raison de la question — un fichier republié de
// semaine en semaine accumulerait sinon les doublons.
//
// AVEC la croix et sans « Annuler » : un dialogue de CHOIX dont les options sont
// les actions (docs/03-developpeur/interface/librairie-ui/modales-et-panneaux.md),
// comme ChoixExportSiege. La croix ferme sans rien importer.

type Paire = { entrante: RecoPayload; existante: Reco };

// Le nom cité entre guillemets ; en français, des espaces insécables tiennent
// le guillemet à son nom (`recos.fusion.nomCite`).
const nom = (r: { name: string }, t: Dictionnaire) => t.recos.fusion.nomCite(r.name || t.partage.reco.nomParDefaut);

export function titreChoixFusion(paires: Paire[], t: Dictionnaire): string {
  return paires.length === 1 ? t.recos.fusion.titreUne : t.recos.fusion.titrePlusieurs;
}

// Le sous-titre et les options, rendus à part de la coquille : la `Modale` se
// monte dans `<body>` et ne rend rien côté serveur, ses tests de rendu passent
// par ces deux-là.
export function SousTitreFusion({ paires }: { paires: Paire[] }) {
  const t = useTraduction();
  const f = t.recos.fusion;
  return (
    <>
      {paires.map(({ entrante, existante }, i) => (
        <span key={i} className="block">
          {nom(entrante, t)}{f.prolonge}<b className="text-ink">{nom(existante, t)}</b>{f.point}
        </span>
      ))}
      {/* Dire ce qui n'est PAS touché : sans cette ligne, on ferme par
          précaution un choix qu'on voulait faire. (Pas en `noteFinale` : elle
          se pose sous des boutons d'action, que ce dialogue n'a pas.) */}
      <span className="mt-1.5 block">{f.rienRetire}</span>
    </>
  );
}

export function OptionsFusion({
  une,
  apercu,
  onChoisir,
}: {
  une: boolean;
  apercu: BilanFusion;
  onChoisir: (fusionner: boolean) => void;
}) {
  const t = useTraduction();
  const f = t.recos.fusion;
  return (
    <div className="flex flex-col gap-2">
      <Option
        onClick={() => onChoisir(true)}
        // Repère du banc d'affichage : le nom accessible d'une Option porte
        // toute sa description, chiffres compris.
        data-choix-fusion="fusionner"
        autoFocus
        icone={<Combine size={16} />}
        titre={une ? f.fusionnerUne : f.fusionnerPlusieurs}
        description={f.fusionnerDetail(apercuFusion(apercu, t))}
      />
      <Option
        onClick={() => onChoisir(false)}
        data-choix-fusion="a-part"
        icone={<CopyPlus size={16} />}
        titre={f.aPart}
        description={une ? f.aPartUne : f.aPartPlusieurs}
      />
    </div>
  );
}

export default function ChoixFusionRecos({
  paires,
  apercu,
  onChoisir,
  onAnnuler,
}: {
  // Chaque recommandation du fichier qui en complète une existante.
  paires: Paire[];
  // Ce que ferait la fusion (calculé d'avance, rien n'est encore écrit).
  apercu: BilanFusion;
  onChoisir: (fusionner: boolean) => void;
  onAnnuler: () => void;
}) {
  const t = useTraduction();
  return (
    <Modale
      onClose={onAnnuler}
      labelledBy="fusion-recos-titre"
      largeur="max-w-[480px]"
      croix
      titre={titreChoixFusion(paires, t)}
      sousTitre={<SousTitreFusion paires={paires} />}
    >
      <OptionsFusion une={paires.length === 1} apercu={apercu} onChoisir={onChoisir} />
    </Modale>
  );
}
