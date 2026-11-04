import { Eye, EyeOff } from 'lucide-react';
import { Modale, Option } from '../../ui';
import { useTraduction } from '../../hooks/useLangue';

// Choix d'export des équipes de siège : avec ou sans les runes.
//
// ⚠️ **Une question, pas une case à cocher enfouie** — la même que l'export de
// la prépa RTA (`ChoixExport`, RtaBackupBar.tsx). Partager ses runes, c'est
// montrer ce qu'on possède : certains le veulent (c'est ce qui rend une équipe
// reçue consultable), d'autres non. Le choix est posé au moment d'exporter,
// avec ce que chaque option donne à voir.
//
// ⚠️ Aucune des deux réponses ne détruit quoi que ce soit : les deux
// téléchargent un fichier. « Avec » vient en premier parce que c'est ce qui
// rend le fichier utile à qui le reçoit.
//
// AVEC la croix et sans « Annuler » : un dialogue de CHOIX dont les options sont
// les actions (docs/03-developpeur/interface/librairie-ui/modales-et-panneaux.md).
export default function ChoixExportSiege({
  avecRunes,
  onChoisir,
  onAnnuler,
}: {
  // Monstres partageables qui portent des runes connues.
  avecRunes: number;
  onChoisir: (avecRunes: boolean) => void;
  onAnnuler: () => void;
}) {
  const c = useTraduction().siege.choixExport;
  return (
    <Modale
      onClose={onAnnuler}
      labelledBy="export-siege-titre"
      largeur="max-w-[460px]"
      croix
      titre={c.titre}
      sousTitre={
        <>
          {c.sousTitre} <b className="text-ink">{c.sousTitreGras}</b>.
        </>
      }
    >
      {avecRunes === 0 && (
        <p className="mb-3 rounded-lg border border-border bg-panel2 px-3 py-2 text-micro leading-relaxed text-ink-dim">
          {c.sansRunes}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Option
          onClick={() => onChoisir(true)}
          autoFocus
          disabled={avecRunes === 0}
          icone={<Eye size={16} />}
          titre={c.completTitre}
          compte={avecRunes || undefined}
          description={c.completDetail}
        />
        <Option
          onClick={() => onChoisir(false)}
          icone={<EyeOff size={16} />}
          titre={c.vitessesTitre}
          description={c.vitessesDetail}
        />
      </div>
    </Modale>
  );
}
