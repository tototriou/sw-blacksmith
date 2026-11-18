import { useId, useMemo, useState } from 'react';
import type { Monster } from '../../../types';
import { Bouton, Modale, Option, PiedDeDialogue } from '../../../ui';
import MonsterAvatar from '../../MonsterAvatar';
import MonsterPicker from '../../MonsterPicker';
import { LigneExemplaire } from '../../outils/ExclusionCandidateRow';
import { useTraduction } from '../../../hooks/useLangue';
import { sourcesEquipementEspece, type ContexteSourcesEquipes, type SourceEquipement } from '../../../lib/sourcesEquipesEnregistrees';

interface Props {
  monstres: Monster[];
  ctx: ContexteSourcesEquipes;
  onChoisir: (com2usId: number, source: SourceEquipement) => void;
  onFermer: () => void;
}

// « Ajouter un monstre » : l'espèce, puis l'équipement à copier parmi ce que
// l'app connaît d'elle, chaque choix nommé par sa provenance et montré par la
// rangée du choix d'exemplaire de l'Optimizer (sets, runes, et pour un deck
// ses coéquipiers).
export default function AjoutMonstreModale({ monstres, ctx, onChoisir, onFermer }: Props) {
  const t = useTraduction();
  const a = t.equipes.ajout;
  const id = useId();
  const [espece, setEspece] = useState<Monster | null>(null);
  const candidats = useMemo(() => monstres.filter((m) => m.com2usId != null), [monstres]);
  const sources = espece?.com2usId != null ? sourcesEquipementEspece(espece.com2usId, ctx, t) : [];
  return (
    <Modale onClose={onFermer} labelledBy={id} titre={a.titre} croix largeur="max-w-[560px]"
      actions={espece ? <PiedDeDialogue><Bouton libelle={a.changer} onClick={() => setEspece(null)} /></PiedDeDialogue> : undefined}>
      {!espece ? (
        <MonsterPicker monsters={candidats} placeholder={a.chercher} ariaLabel={a.chercher} jetonFocus={0}
          onPick={(mid) => setEspece(candidats.find((m) => String(m.id) === mid) ?? null)} />
      ) : (
        <ChoixEquipement espece={espece} sources={sources} onChoisir={(src) => onChoisir(espece.com2usId as number, src)} />
      )}
    </Modale>
  );
}

// Les choix d'équipement d'une espèce : un exemplaire de la Box, un deck
// (avec ses coéquipiers), ou « Sans équipement ».
export function ChoixEquipement({ espece, sources, onChoisir }: {
  espece: Monster;
  sources: SourceEquipement[];
  onChoisir: (source: SourceEquipement) => void;
}) {
  const a = useTraduction().equipes.ajout;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <MonsterAvatar monster={espece} size={36} />
        <p className="text-sm font-semibold text-ink">{espece.name}</p>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-dimmer">{a.equipement}</p>
      {sources.map((s, i) => (
        <Option key={s.cle} autoFocus={i === 0} titre={s.libelle} onClick={() => onChoisir(s)}
          description={s.equipement && (
            <span className="flex w-full items-center gap-3 text-ink">
              <LigneExemplaire monster={espece} gear={s.equipement} equipe={s.equipe} />
            </span>
          )} />
      ))}
    </div>
  );
}
