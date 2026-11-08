import EffetVignette from '../../EffetVignette';
import { LeaderSkillPicker, RappelsEtatMonstre, TitreEtatMonstre } from '../../EtatMonstre';
import { type ComponentProps } from 'react';
import { motifLeadAffiche } from '../../../../lib/equipesOptimizer';
import { ATK_BUFF_ICON, DEF_BUFF_ICON, SPD_BUFF_ICON, type DamageSetup } from '../../../../lib/damage';
import type { MotifLeadOptimizer } from '../../../../lib/equipesOptimizer';
import { useTraduction } from '../../../../hooks/useLangue';

// Le type des rappels vient de la carte : seuls l'écran et la carte importent
// la table des buffs de passif (tests/buffs-de-passif.test.ts).
type RappelsBuffs = ComponentProps<typeof RappelsEtatMonstre>['rappelsBuffs'];

export interface EtatMonstreEssentielsProps {
  setup: DamageSetup;
  maj: (patch: Partial<DamageSetup>) => void;
  equipe?: boolean;
  motifLead?: MotifLeadOptimizer | null;
  etroit: boolean;
  rappelsBuffs: RappelsBuffs;
}

// « État de mon monstre » réduit aux buffs et au lead, section des essentiels
// du bureau, sous les principales. Les sets d'aura des autres monstres vont en
// tête de la colonne « Aura, exclusion, avancés ». Les morceaux sont ceux
// d'`EtatMonstre` (partagé avec le téléphone, inchangé) : titre et aide,
// vignettes, choix du lead, rappels des passifs.
//
// ⚠️ **Le lead d'abord, les trois buffs dessous** (décision de
// l'utilisateur) : le lead sur une rangée (« Lead », l'icône, la liste de la
// stat, puis celle du pourcentage À DROITE, `LeaderSkillPicker`), et les
// buffs sur la leur, ensemble, répartis sur toute la largeur : vignettes de
// 56 px, qui tiennent à trois dans ≈ 175 px. L'aide du titre est celle du
// bureau : sans les sets d'aura ni le paragraphe sur le combat.
export default function EtatMonstreEssentiels({ setup, maj, equipe = false, motifLead, etroit, rappelsBuffs }: EtatMonstreEssentielsProps) {
  const o = useTraduction().optimizer;
  const e = o.etat;
  const motif = motifLeadAffiche(motifLead);
  return (
    <section aria-label={e.titre} className="flex flex-col gap-1.5">
      <TitreEtatMonstre bureau />
      <LeaderSkillPicker setup={setup} maj={maj} />
      <div className="flex justify-between gap-1">
        <EffetVignette icone={ATK_BUFF_ICON} libelle={e.buffs.atk} description={e.descriptionsBuffs.atk}
          onClick={() => maj({ atkBuff: !setup.atkBuff })} actif={setup.atkBuff} etroit={etroit} largeur="w-14" />
        <EffetVignette icone={DEF_BUFF_ICON} libelle={e.buffs.def} description={e.descriptionsBuffs.def}
          onClick={() => maj({ defBuff: !setup.defBuff })} actif={setup.defBuff} etroit={etroit} largeur="w-14" />
        <EffetVignette icone={SPD_BUFF_ICON} libelle={e.buffs.spd} description={e.descriptionsBuffs.spd}
          onClick={() => maj({ spdBuff: !setup.spdBuff })} actif={setup.spdBuff} etroit={etroit} largeur="w-14" />
      </div>
      {/* Le motif d'un lead d'équipe inactif ne se montre que s'il existe, sans
          place réservée (décision de l'utilisateur) : il paraît SOUS le lead
          et les buffs, qui ne bougent donc pas ; seuls les rappels, dessous,
          descendent. */}
      {equipe && motif && (
        <p className="text-xs text-warn">{o.motifsLead[motif]}</p>
      )}
      <RappelsEtatMonstre rappelsBuffs={rappelsBuffs} />
    </section>
  );
}
