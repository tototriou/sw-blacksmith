import { ReactNode } from 'react';
import type { GearSet, Monster } from '../../types';
import MonsterAvatar from '../MonsterAvatar';
import SetsPortes from '../SetsPortes';
import { activeSets } from '../../lib/effects';
import { ExclusionCandidate } from '../../lib/optimizerExclusion';
import { useTraduction } from '../../hooks/useLangue';

interface Props {
  candidate: ExclusionCandidate;
  // « déjà exclu » (RuneExclusionPicker) — rien pour un picker à sélection
  // unique (MonsterSourcePicker).
  suffixe?: ReactNode;
}

// Contenu d'une ligne de résultat « monstre + équipement » — portrait, nom,
// compte de runes, et pour le siège l'équipe complète (un même monstre peut
// apparaître dans plusieurs équipes, indiscernables par le seul nom : le
// vrai repère est le NUMÉRO d'équipe et SES COÉQUIPIERS). Remonté ici à son
// second usage — RuneExclusionPicker (exclure) ET MonsterSourcePicker
// (choisir le monstre à optimiser) affichent EXACTEMENT la même
// rangée, par cohérence entre les deux écrans. « Ajouter un monstre » de
// Mes équipes la reprend aussi, par `LigneExemplaire`.
export default function ExclusionCandidateRow({ candidate: c, suffixe }: Props) {
  const k = useTraduction().optimizer.candidat;
  return (
    <LigneExemplaire monster={c.monster} gear={c.gear} suffixe={suffixe}
      equipe={c.teamContext && {
        libelle: k.equipe(c.teamContext.teamNumber), membres: c.teamContext.slots,
        position: 'slotIndex' in c.selector ? c.selector.slotIndex : -1,
      }} />
  );
}

// La même rangée hors de l'Optimizer : un exemplaire, son équipement et, s'il
// sort d'un deck, le nom du deck et ses coéquipiers (la place du monstre en
// gras). Sans deck, `legende` dit d'où vient l'équipement.
export function LigneExemplaire({ monster, gear, equipe, legende, suffixe }: {
  monster: Monster;
  gear: GearSet | null;
  // Sans `libelle` : le deck est déjà nommé à côté (le titre d'une `Option`).
  equipe?: { libelle?: string; membres: (Monster | null)[]; position: number };
  legende?: string;
  suffixe?: ReactNode;
}) {
  // ⚠️ `activeSets`, PAS un simple `Set` des `rune.set` présents — SEULE
  // source de vérité pour « quels sets sont actifs » (voir son en-tête,
  // effects.ts) : un set 4 pièces à 3 runes n'est pas actif, une rune
  // Intangible peut compléter le set incomplet le plus proche. Recompter à
  // côté (ex. `swiftCount >= 4`) diverge de l'affichage sur un cas réel —
  // voir `swiftActive` dans importAccount.ts. Même
  // fonction que `RtaEntry.sets` (calculée à l'import) et que les icônes de
  // `RtaCard.tsx`, ici recalculée à la volée : ces candidats (n'importe quel
  // monstre du compte, pas seulement les favoris RTA) n'ont pas cette valeur
  // déjà posée quelque part.
  const runes = gear?.runes ?? [];
  const sets = activeSets(runes.map((r) => r.set));
  const k = useTraduction().optimizer.candidat;
  return (
    <>
      <MonsterAvatar monster={monster} size={equipe ? 46 : 28} className="flex-none" />
      <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-medium truncate flex-1">{monster.name}</span>
          <SetsPortes sets={sets} taille={14} espacement="gap-1" className="flex-none" />
          <span className="text-[11px] tabular-nums text-ink-dim flex-none">
            {k.runes(runes.length)}
          </span>
          {suffixe}
        </div>
        {!equipe && legende && <span className="truncate text-[11px] text-ink-dim">{legende}</span>}
        {equipe && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-dim">
            {equipe.libelle && <span className="flex-none">{equipe.libelle}</span>}
            <span className="flex flex-wrap items-center gap-2.5 min-w-0">
              {equipe.membres.map((m, slotIdx) => {
                const estSlotCourant = equipe.position === slotIdx;
                return (
                  <span key={slotIdx} className="flex items-center gap-1.5 flex-none">
                    <MonsterAvatar monster={m} element={false} size={34} className="flex-none" />
                    <span className={`whitespace-nowrap ${estSlotCourant ? 'text-ink font-medium' : ''}`}>{m?.name ?? '—'}</span>
                  </span>
                );
              })}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
