import { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  ATTAQUE_CONJOINTE_ICON,
  PENDANT_TOUR_ALLIE_ICON,
  BRAND_ICON,
  champsDuCombat,
  BonusDegatsConditionnelProfile,
  BonusDegatsStackableProfile,
  BonusMonstreParEffetProfile,
  BonusMonstreParEffetPropreProfile,
  type SourceEffetCible,
  CombatStatProfile,
  ConditionMonstreProfile,
  BonusSacrificeProfile,
  CIBLES_DEGATS,
  CibleDegats,
  CRIT_MODES,
  CritMode,
  DamageSetup,
  DamageVariable,
  DEFAULT_DAMAGE_SETUP,
  DEBORAH_ICON,
  DEF_BREAK_ICON,
  EULDONG_ICON,
  MIRIAM_ICON,
  MIRINAE_ICON,
  ModificateurVitAffichage,
  PassifOffensifProfile,
  SkillDamageProfile,
  SkillDamageUnsupported,
  SeuilsPassifEivor,
  TRANSMISSION_ICON,
  VELASKA_ICON,
  autresBuffsPropresDepuisTotal,
  bonusConditionnelPropreActif,
  bonusDegatsConditionnelActif,
  cibleDegatsRetenue,
  cibleSecondairePriseEnCharge,
  estPrisEnCharge,
  calculPartielDuSort,
  conditionCritiqueGarantiParReglage,
  interrupteurAttaqueConjointe,
  vignettePendantTourAllie,
  coupsAffichesDuSort,
  coupsEnPlusAncienneRecetteActif,
  coupsEnPlusDeCondition,
  critiqueGarantiParReglage,
  cranIgnoreDefRetenu,
  cransIgnoreDefAPartirDuCoup,
  resumeIgnoreDefRetenu,
  passifCompte,
  passifPeutSuivre,
  resolvedBuffsPropresCount,
  resolvedBuffCiblePresent,
  resolvedEffetsPropresCount,
  resolvedDebuffCiblePresent,
  resolvedDebuffsCibleCount,
  resolvedEffetsCibleCount,
  resolvedHits,
  reglagesDesPoses,
  effetDuTirageAuCoup,
  effetsDuTirageProposables,
  choisirAuCoupDuTirage,
  type EffetEntreCoupsProfile,
  libelleEffetEntreCoups,
  nomEffetEntreCoups,
  coupsAuHasard,
  resolvedBrutParEffetCount,
  resolvedPvActuelsAvantSacrificePctMonstre,
  resolvedStackPct,
  resolvedStackTrigger,
  resumeSequenceDeCoups,
} from '../../lib/damage';
import { formuleLisible } from '../../lib/monsterSkills';
import { clesProseDejaRendue, renduStatsCombat } from '../../lib/proseStatsCombat';
import EffetVignette from './EffetVignette';
import Interrupteur from '../../ui/Interrupteur';
import Jeton from '../../ui/Jeton';
import NumberField from '../../ui/NumberField';
import Option from '../../ui/Option';
import Segmented from '../../ui/Segmented';
import Selecteur from '../../ui/Selecteur';
import { ELEMENTS, type ElementKey } from '../../types';
import HelpPopover from '../HelpPopover';
import { useTraduction } from '../../hooks/useLangue';
import { nomElement } from '../../i18n/jeu';
import type { Dictionnaire } from '../../i18n/fr';

// Réglage de l'objectif « Dégâts réels » — voir docs/02-app/degats-reels/
// pour le modèle de calcul, docs/02-app/optimizer/ pour sa place à l'écran.
//
// ⚠️ **Deux principes portent toute la mise en page de ce panneau :**
//
// 1. **Ce que les données savent n'est jamais redemandé** — il est AFFICHÉ.
//    Le résumé sous chaque sort (« 3 coups · Zone · Ignore la DEF · +30 % »)
//    n'est pas décoratif : c'est ce qui dit à l'utilisateur pourquoi on ne
//    lui pose pas la question.
// 2. **On n'affiche que les réglages que le sort CONSOMME.** Un sort qui
//    ignore la défense ne montre ni la DEF ennemie ni la réduction de
//    défense ; un sort qui ne dépend pas de la VIT ne montre pas le buff de
//    vitesse. Un champ visible mais sans effet est pire qu'un champ absent —
//    il fait croire à une action.
//
// ⚠️ Aucun contrôle dessiné ici : tout vient de `src/ui/` (« rien de
// custom », voir docs/03-developpeur/interface/). Les icônes (sort, effets) sont des
// DONNÉES affichées dedans, pas des contrôles maison — même rendu que la
// fiche de monstre (MonsterDetailDialog.tsx). Les effets se choisissent via
// `Vignette` (la case sélectionnable de la librairie, déjà utilisée pour la
// palette de couleurs de catégorie RTA) : l'icône EST le contrôle, avec le
// même liseré + fond teinté qu'une catégorie choisie — pas une case à cocher
// séparée à côté d'une icône décorative.

interface Props {
  skills: (SkillDamageProfile | SkillDamageUnsupported)[];
  // Le sort réellement retenu (`resolveDamageSkill`) — `null` si aucun n'est
  // calculable pour ce monstre.
  resolved: SkillDamageProfile | null;
  // Passifs offensifs de ce monstre reconnus (`monsterOffensivePassives`,
  // damage.ts) — affichés s'ils peuvent suivre le sort choisi
  // (`passifPeutSuivre`), voir la section dédiée plus bas. Vide = rien à
  // afficher (la plupart des monstres).
  passifs: PassifOffensifProfile[];
  // Modificateurs monstre-wide liés à la VIT SANS formule propre
  // (`monsterModificateursVit`, damage.ts — Ciri Eau, Rigna, Sonia…),
  // affichés dans la MÊME liste que `passifs` — corrige un oubli signalé
  // par l'utilisateur (Sonia/Ciri absentes, contrairement à Feng Yan/Dominic).
  modificateursVit: ModificateurVitAffichage[];
  setup: DamageSetup;
  setSetup: Dispatch<SetStateAction<DamageSetup>>;
  // `true` tant que la fiche du monstre n'est pas arrivée.
  chargement: boolean;
  etroit: boolean;
  // Ce monstre force-t-il le critique quand il est plus rapide que
  // l'adversaire (`monsterCritSiPlusRapide`, damage.ts) ? Indépendant du
  // sort choisi — décide, avec `utilise('Relative SPD')`, si le champ
  // « VIT adversaire » doit apparaître (un sort qui ne lit pas cette
  // variable peut quand même avoir BESOIN de la VIT adverse si ce
  // modificateur existe).
  critSiPlusRapide: boolean;
  // Ce monstre majore-t-il TOUS ses dégâts selon l'écart de VIT (Sonia —
  // `monsterBonusDegatsSelonVit`, damage.ts) ? Même rôle que
  // `critSiPlusRapide` pour l'affichage des champs liés à la VIT — `null` =
  // aucun effet.
  bonusDegatsSelonVit: { ecartMax: number; pctMax: number } | null;
  // Ce monstre porte-t-il un bonus de dégâts ACCUMULABLE en combat (Momo —
  // `monsterBonusDegatsStackable`, damage.ts) ? Le POURCENTAGE actuel, lui,
  // est saisi ici même (`setup.stackPersonnalise`) — `null` = pas ce passif.
  bonusDegatsStack: BonusDegatsStackableProfile | null;
  // Ciri (Feu)/MOS (Feu)/Reyka — Taux Crit selon la VIT
  // (`monsterCritRateSelonVit`, damage.ts). S'affiche via `modificateursVit`
  // (étendu côté damage.ts) — présent ici pour la même raison que
  // `critSiPlusRapide`/`bonusDegatsSelonVit` : décider si le bouton
  // « Buff VIT » doit apparaître même quand le sort choisi ne lit ni {SPD}
  // ni {Relative SPD} (le Taux Crit, lui, en dépend quand même).
  critRateSelonVit: { ptsParVit: number } | null;
  // Bonus conditionnel à bouton (Jin Kazama, Cyborg, Brownie Magician,
  // Astar, Jean, Kyle, Satoru Gojo, Werner, Zenitsu, Qilin Slasher, Panda
  // Warrior, Mi Ying…) — `monsterBonusDegatsConditionnel`, damage.ts.
  // `null` = pas ce genre de passif sur ce monstre.
  bonusDegatsConditionnel: BonusDegatsConditionnelProfile | null;
  // Backup Code (Hacker/570RM) — bonus MONSTRE-WIDE selon un compte d'effets
  // sur la CIBLE, `monsterBonusParEffetCible` (damage.ts). Distinct de
  // `resolved.bonusParEffetCible` (propre à UN sort, type Julie) : celui-ci
  // majore le sort choisi quel qu'il soit. `null` = pas ce passif.
  bonusParEffetCibleMonstre: BonusMonstreParEffetProfile | null;
  // Blessing of Curse (Devil Maiden/Jessica) — même famille, mais compte les
  // débuffs sur les ALLIÉS, soi compris (`monsterBonusParEffetPropre`).
  // `null` = pas ce passif.
  bonusParEffetPropre: BonusMonstreParEffetPropreProfile | null;
  // Calculated Sacrifice (Onimusha, Fuuki) — dégâts fixes selon une saisie
  // de PV actuels avant le sacrifice (`monsterBonusSacrifice`). `null` = pas
  // ce passif.
  bonusSacrifice: BonusSacrificeProfile | null;
  conditionsCombatMonstre: ConditionMonstreProfile[];
  combatStats: CombatStatProfile[];
  seuilsPassifEivor: SeuilsPassifEivor | null;
  elementAttaquant: ElementKey | null;
  critInterdit: boolean;
}

// Ce que le sort — ou le PASSIF (voir plus bas) — nous apprend, en une
// ligne, plutôt qu'un formulaire.
//
// ⚠️ **Le RATIO DE DÉGÂTS en tête** (demande explicite) : c'est le
// coefficient qui décide de tout le reste du calcul, et le repère que le
// joueur retrouve sur les sites de référence. Rendu par `formuleLisible`
// (monsterSkills.ts, déjà utilisée par la fiche de monstre) — qui TRADUIT
// les noms de stats (`{ATK}` → ATQ) sans réécrire la formule, précisément
// pour garder cette correspondance. Réutilisée pour CHAQUE passif offensif
// affiché (demande explicite de l'utilisateur : « affiche bien les ratios
// de dégâts des passifs quand tu as l'information via Swarfarm ») — un
// passif de `PASSIFS_OFFENSIFS_CONNUS` a TOUJOURS une formule analysable
// (`monsterOffensivePassives` l'exige, voir damage.ts), rien à deviner.
//
// ⚠️ `hitsOverride` : un passif `coupsDuSortActif` (Feng Yan, Roid…) suit le
// nombre de coups RÉELLEMENT retenu pour le SORT ACTIF, pas le nombre écrit
// sur sa propre fiche (souvent 0/1, non fiable pour un passif — voir
// `monsterOffensivePassives`) — l'appelant passe alors `resolvedHits(sort
// actif, setup)` plutôt que de laisser cette fonction relire les coups du
// passif lui-même, qui donnerait un chiffre trompeur.
// Libellé FR de `bonusParEffetCible.source`/`monsterBonusParEffetCible(...).source`
// — factorisé, utilisé aux trois emplacements qui affichent ce type d'effet
// (résumé du sort, libellé du champ, infobulle/aria-label).
function libelleSourceEffet(source: SourceEffetCible, t: Dictionnaire): string {
  return t.degats.sourceEffet[source];
}

// Ce que la condition accorde, lu sur l'entrée elle-même — jamais supposé
// d'après son type : une même comparaison sert un ignore DEF (Copper, Guard
// Crush, Triss) ou un critique garanti (Jaara, Varus, Yuji et Rick).
function effetCondition(condition: ConditionMonstreProfile['condition'], t: Dictionnaire): string {
  const c = t.degats.condition;
  if (condition.coupsEnPlus) return c.coupsEnPlus(condition.coupsEnPlus);
  if (condition.critiqueGaranti) return c.critiqueGaranti;
  if (condition.ignoreDefPct != null) {
    return condition.ignoreDefPct >= 100 ? c.ignoreDef : c.ignoreDefPct(condition.ignoreDefPct);
  }
  if (condition.pct) return c.pct(condition.pct);
  return c.active;
}

function resumeCondition(condition: ConditionMonstreProfile['condition'], t: Dictionnaire): string {
  const c = t.degats.condition;
  const op = 'inclusif' in condition && condition.inclusif ? '≤' : '<';
  if (condition.coupsEnPlus && condition.type === 'atkCibleSousAtkPropre') {
    return c.siAtkDepasse(c.coupsEnPlus(condition.coupsEnPlus));
  }
  if (condition.coupsEnPlus && condition.type === 'manuel') {
    return c.avecEffet(condition.libelle, c.coupsEnPlus(condition.coupsEnPlus));
  }
  switch (condition.type) {
    case 'buffCiblePresent':
      return c.buffCible(condition.pct ?? 0);
    case 'aucunBuffCible':
      return c.aucunBuffCible(condition.pct ? c.pct(condition.pct) : c.critiqueGaranti);
    case 'aucunDebuffPropre':
      return c.aucunDebuffPropre(condition.pct ?? 0);
    case 'debuffsPropresMax':
      return c.debuffsPropresMax(condition.pct ?? 0, condition.max);
    case 'elementCible':
      return c.elementCible(condition.pct ?? 0, nomElement(t.jeu, condition.element));
    case 'elementCibleOppose':
      return c.elementOppose(condition.pct ?? 0);
    case 'pvCibleMax':
      return c.pvCibleMax(condition.pct ?? 0, condition.seuilPct);
    case 'pvPropreSous':
      return c.pvPropreSous(condition.seuilPct);
    case 'pvCibleSuperieursPvPropre':
      return c.pvCibleSuperieurs(condition.pct ?? 0, condition.ratio);
    case 'atkCibleSousAtkPropre':
      return c.atkCible(op, condition.ratio);
    case 'atkParTranche':
      return c.atkParTranche(condition.tranchePct, condition.coupsEnPlus ?? 0);
    case 'defCibleSousDefPropre':
      return c.defCibleSousDef(effetCondition(condition, t), op, condition.ratio);
    case 'defCibleSousAtkPropre':
      return c.defCibleSousAtk(effetCondition(condition, t), op, condition.ratio);
    case 'vitPropreSuperieure':
      return c.vitSuperieure;
    case 'aucunPvCibleDetruit':
      return c.aucunPvDetruit(condition.pct ?? 0);
    case 'debuffCiblePresent':
      return c.debuffCible(effetCondition(condition, t));
    case 'defBreakPresent':
      return c.defBreak;
    case 'manuel':
      return condition.libelle;
    case 'ignoreDefParStack':
      return c.ignoreDefParStack(condition.pctParStack, condition.label.toLowerCase());
    case 'compteurMin':
      return c.compteurMin(condition.min, condition.label.toLowerCase());
  }
}

// Le résumé d'un sort (voir le commentaire « Ce que le sort … nous apprend »
// plus haut). ⚠️ Séquence curée (Blade Surge, `p.sequenceDeCoups`) : chaque groupe avec
// SES coups, SA portée et SA formule — `hits`, `aoe` et `formule` du profil ne
// décrivent que la donnée, jamais la séquence (« 2 coups · Cible unique »
// était faux pour Blade Surge ; Head Press compte ses deux phases en `coups`). Ne lit JAMAIS la cible choisie (`cibleDegatsParSort`) : le
// texte au-dessus des deux crans ne change pas quand on bascule, voir
// `champCibleDegats`.
//
// ⚠️ `ignoreDef` n'est PAS une entrée de `reste` : c'est le cran d'ignore DEF
// d'un Blade Dancer, qui change avec le sélecteur posé
// SOUS la liste des sorts. Glissé dans le fil du résumé, une phrase qui
// s'allonge pourrait gagner une ligne et déplacer ce sélecteur à l'instant où
// on vient de s'en servir. Il a donc sa ligne à lui, d'une seule ligne de haut
// quel que soit le cran (voir la liste des sorts).
function resumeSort(
  p: SkillDamageProfile,
  setup: DamageSetup,
  t: Dictionnaire,
  hitsOverride?: number
): { ratio: string | null; reste: string; ignoreDef: string | null } {
  const r = t.degats.resume;
  // Le nombre annoncé vient de la même règle que le calcul (`coupsAffichesDuSort`) ;
  // sans build ici, un coup en plus déduit de l'ATQ du build s'annonce en plage.
  const affiches = coupsAffichesDuSort(p, setup);
  const hits = hitsOverride ?? affiches.hits;
  const sequence = p.sequenceDeCoups;
  const bouts: string[] = sequence
    ? [resumeSequenceDeCoups(sequence, t)]
    : [
        hitsOverride == null && affiches.dependDuBuild
          ? r.coupsSelonAtk(hits, affiches.max)
          : r.coups(hits, !!p.hitsRange && hitsOverride == null),
        p.aoe ? r.zone : r.cibleUnique,
      ];
  if (p.ignoreDef) bouts.push(r.ignoreDef);
  if (p.ignoreDefSelonVit) bouts.push(r.ignoreDefSelonVit(p.ignoreDefSelonVit.ecartMax));
  if (p.fixed) bouts.push(r.degatsFixes);
  if (p.composanteFixeAdditionnelle) bouts.push(r.reserveSacrifice);
  if (p.critiqueGaranti) bouts.push(r.critiqueGaranti);
  if (p.skillupDamagePct > 0) bouts.push(r.skillup(p.skillupDamagePct));
  if (p.bonusParEffetCible) {
    bouts.push(r.parEffetCible(p.bonusParEffetCible.pct, libelleSourceEffet(p.bonusParEffetCible.source, t)));
  }
  if (p.bonusParEffetPropre) {
    bouts.push(p.bonusParEffetPropre.source === 'buffs' ? r.parBuffPropre(p.bonusParEffetPropre.pct) : r.parDebuffPropre(p.bonusParEffetPropre.pct));
  }
  if (p.critRatePoints) bouts.push(r.critRate(p.critRatePoints));
  if (p.critDamagePoints) bouts.push(r.critDamage(p.critDamagePoints));
  for (const condition of p.conditionsCombat ?? []) bouts.push(resumeCondition(condition, t));
  if (p.bonusStackPropre) bouts.push(r.charges(p.bonusStackPropre.pctMax));
  const ratio = sequence
    ? sequence.map((g) => formuleLisible(g.formule, t.jeu)).join(r.puisFormule)
    : p.composanteFixeAdditionnelle
      ? r.fixe(formuleLisible(p.formule, t.jeu) ?? '', formuleLisible(p.composanteFixeAdditionnelle.formule, t.jeu) ?? '')
      : formuleLisible(p.formule, t.jeu);
  return { ratio, reste: bouts.join(' · '), ignoreDef: resumeIgnoreDefRetenu(p, setup, t) };
}

// Un effet de la rangée « Effets actifs ». Sa `description` est la SEULE
// écrite : sa vignette la montre au survol, l'infobulle de la rangée la
// regroupe avec les autres.
interface EffetActif {
  cle: string;
  icone: string;
  libelle: string;
  description: string;
  actif: boolean;
  basculer: () => void;
  // Libellé sur deux lignes au lieu d'être tronqué (« Attaque conjointe »).
  deuxLignes?: boolean;
}

// Champ « nombre de coups » d'un sort/passif à coups VARIABLES en jeu (Sia,
// Okeanos S3…) — absent si `profile.hitsRange` ne l'autorise pas. Partagé
// entre le sort actif et un passif : même mécanisme, même champ.
function champCoupsVariables(
  profile: SkillDamageProfile,
  setup: DamageSetup,
  maj: (patch: Partial<DamageSetup>) => void,
  t: Dictionnaire
) {
  // Un coup en plus qui ne dépend que d'une condition se règle par son
  // interrupteur, jamais par un compteur.
  if (!profile.hitsRange || coupsEnPlusDeCondition(profile)) return null;
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="text-xs text-ink-dim">
        {coupsAuHasard(profile.skillCom2usId)
          ? t.degats.resume.coupsAuHasard(profile.hitsRange.min, profile.hitsRange.max)
          : t.degats.resume.coupsVariables(profile.hitsRange.min, profile.hitsRange.max)}
      </span>
      <NumberField
        value={resolvedHits(profile, setup)}
        onChange={(v) =>
          v != null &&
          maj({ coupsPersonnalises: { ...(setup.coupsPersonnalises ?? {}), [profile.skillCom2usId]: v } })
        }
        min={profile.hitsRange.min}
        max={profile.hitsRange.max}
      />
    </div>
  );
}

// Cible calculée d'un sort dont la séquence curée porte un coup de zone
// (Blade Surge, `cibleSecondairePriseEnCharge`) : deux crans, libellés retenus
// par l'utilisateur. Absent pour tout autre
// sort : la MÊME table de capacité borne la recette (`optimizerRecipe.ts`),
// jamais un cran posé sur un sort qui ne le connaît pas. Les champs de
// l'adversaire décrivent alors l'autre ennemi : aucun champ nouveau.
//
// ⚠️ **Posé sous la liste des sorts, comme le champ des coups variables, et
// rien de ce qui le précède ne lit le cran** (`resumeSort` ne lit pas la
// cible) : choisir Blade Surge le fait apparaître EN DESSOUS de la case
// cliquée, et basculer ne change la hauteur de rien au-dessus de lui — il ne
// bouge jamais sous le pointeur (docs/03-developpeur/interface/, « Un clic ne déplace
// JAMAIS ce qu'on vient de cliquer »).
function champCibleDegats(
  profile: SkillDamageProfile,
  setup: DamageSetup,
  maj: (patch: Partial<DamageSetup>) => void,
  t: Dictionnaire
) {
  if (!cibleSecondairePriseEnCharge(profile.skillCom2usId)) return null;
  return (
    <div className="mt-2">
      <Segmented<CibleDegats>
        options={CIBLES_DEGATS.map((key) => ({ key, label: t.degats.cibles[key] }))}
        value={cibleDegatsRetenue(profile, setup)}
        onChange={(v) => maj({ cibleDegatsParSort: { ...(setup.cibleDegatsParSort ?? {}), [profile.skillCom2usId]: v } })}
        size="lg"
      />
    </div>
  );
}

export default function DamageSetupCard({
  skills,
  resolved,
  passifs,
  modificateursVit,
  setup,
  setSetup,
  chargement,
  etroit,
  critSiPlusRapide,
  bonusDegatsSelonVit,
  bonusDegatsStack,
  critRateSelonVit,
  bonusDegatsConditionnel,
  bonusParEffetCibleMonstre,
  bonusParEffetPropre,
  bonusSacrifice,
  conditionsCombatMonstre,
  combatStats,
  seuilsPassifEivor,
  elementAttaquant,
  critInterdit,
}: Props) {
  const textes = useTraduction();
  const jeu = textes.jeu;
  const d = textes.degats;
  const maj = (patch: Partial<DamageSetup>) => setSetup((prev) => ({ ...prev, ...patch }));
  // Au doigt, les champs de l'adversaire s'empilent : une largeur commune de
  // libellé (celle du plus long, « PV restants ») les aligne.
  const libelleAdversaire = `text-xs text-ink-dim${etroit ? ' w-[4.5rem] flex-none' : ''}`;
  const majBuffsPropres = (skillCom2usId: number, total: number) => {
    const autres = autresBuffsPropresDepuisTotal(total, setup);
    maj({ buffsPropresCount: { ...(setup.buffsPropresCount ?? {}), [skillCom2usId]: autres } });
  };

  if (chargement) {
    return <p className="text-xs text-ink-dim">{d.chargement}</p>;
  }

  // Aucun sort calculable : on le DIT, avec ce qui se passe à la place —
  // plutôt qu'un panneau vide qui laisserait croire à un bug.
  if (!resolved) {
    return (
      <div className="rounded-lg border border-warn/60 bg-warn/10 px-3 py-2.5">
        <p className="text-xs leading-relaxed text-ink-dim">
          <b className="text-ink">{d.aucunSort.gras}</b>{d.aucunSort.texte}
          <b className="text-ink">{d.aucunSort.objectif}</b>{d.aucunSort.fin}
        </p>
      </div>
    );
  }

  // Ce que le sort choisi consomme réellement — pilote l'affichage.
  const utilise = (v: DamageVariable) => resolved.variables.includes(v);
  // Crans d'ignore DEF du sort choisi — `null` hors des six sorts Blade
  // Dancers, et alors aucun sélecteur.
  const cransIgnoreDef = cransIgnoreDefAPartirDuCoup(resolved, textes);
  // ⚠️ Via `champsDuCombat` (damage.ts) et non recalculés ici : la ligne de
  // résumé qui rouvre cette fenêtre doit dire EXACTEMENT ce qu'elle contient.
  // Deux copies de ces prédicats ont déjà divergé — « DEF 1000 » s'affichait
  // dans le résumé sur un sort qui ignore la défense.
  const { defEnnemie: montreDefEnnemie, crit: montreCritProfil } = champsDuCombat(resolved);
  const montreCrit = montreCritProfil && !critInterdit;
  const conditionsSort = resolved.conditionsCombat ?? [];
  const conditionsAvecCle = [
    ...conditionsSort.map((condition) => ({
      condition,
      key: resolved.skillCom2usId,
      nom: resolved.nom,
      icone: resolved.icone,
    })),
    ...conditionsCombatMonstre.map((p) => ({
      condition: p.condition,
      key: p.skillCom2usId,
      nom: p.nom,
      icone: p.icone,
    })),
  ];
  const demandeBuffsCible = conditionsSort.some(
    (c) => c.type === 'buffCiblePresent' || c.type === 'aucunBuffCible'
  );
  const demandeDebuffsPropres = conditionsSort.some(
    (c) => c.type === 'aucunDebuffPropre' || c.type === 'debuffsPropresMax'
  );
  const demandePvCible =
    conditionsSort.some((c) => c.type === 'pvCibleMax') ||
    conditionsCombatMonstre.some((p) => p.condition.type === 'pvCibleMax');
  const demandePvPropres = conditionsAvecCle.some(({ condition }) =>
    condition.type === 'pvPropreSous' || condition.type === 'pvCibleSuperieursPvPropre'
  );
  const demandeAtkCible = conditionsAvecCle.some(({ condition }) => condition.type === 'atkCibleSousAtkPropre');
  const demandeVitCible = conditionsAvecCle.some(({ condition }) => condition.type === 'vitPropreSuperieure');
  const demandePvNonDetruits = conditionsAvecCle.some(({ condition }) => condition.type === 'aucunPvCibleDetruit');
  const conditionsManuelles = conditionsAvecCle.filter(({ condition }) => condition.type === 'manuel');
  const clesToggleDejaAffichees = new Set([
    ...conditionsManuelles.map(({ key }) => key),
    ...(bonusDegatsConditionnel ? [bonusDegatsConditionnel.skillCom2usId] : []),
  ]);
  // Les passifs qui PEUVENT frapper après le sort choisi (`passifPeutSuivre`,
  // la porte de `passifCompte`) — les seuls affichés. Un passif choisi
  // lui-même comme sort (Tempest seul) n'est jamais ajouté à lui-même : son
  // interrupteur est MASQUÉ ; de même pour un passif dont les slots déclencheurs
  // excluent le sort choisi — un bouton sans effet possible n'est jamais
  // montré (principe 2 ci-dessus).
  const passifsSuivants = passifs.filter((p) => passifPeutSuivre(p, resolved));
  // ⚠️ **La prose d'une compétence n'est rendue qu'UNE fois dans la carte**. Les huit blocs ci-dessous, sous « Passifs offensifs »,
  // la rendent déjà pour leurs compétences : « Stats acquises en combat » ne
  // la répète pas, et n'en rend qu'une par passif (`renduStatsCombat`). Un
  // bloc qui se met à rendre une prose rejoint cette liste. Pour les passifs
  // offensifs, c'est ce que leur bloc rend VRAIMENT, `passifsSuivants` : un
  // passif masqué qui porte aussi des stats de combat garde sa prose ici
  // (jusque-là `...passifs` la perdait des deux côtés).
  const renduCombat = renduStatsCombat(
    combatStats,
    clesProseDejaRendue([
      ...conditionsCombatMonstre,
      ...modificateursVit,
      bonusDegatsStack,
      bonusDegatsConditionnel,
      bonusParEffetCibleMonstre,
      bonusParEffetPropre,
      bonusSacrifice,
      ...passifsSuivants,
    ])
  );
  // Le réglage « ce sort pose le def break » ne change QUE ce qui frappe
  // après le sort — inutile d'encombrer l'écran si aucun passif ne peut le
  // suivre, ou si le sort ne pose pas de réduction de défense.
  const montreDefBreakParLeSort = resolved.appliqueDefBreak && passifsSuivants.length > 0;
  const critiqueForceParReglage =
    critiqueGarantiParReglage(resolved, setup, elementAttaquant) ||
    conditionsCombatMonstre.some((p) =>
      conditionCritiqueGarantiParReglage(p.condition, p.skillCom2usId, setup, elementAttaquant)
    );

  // ⚠️ **UNE SEULE SOURCE pour la rangée « Effets actifs » ET son infobulle**
  // (une seule
  // infobulle, pas une par effet). Chaque effet que ce sort affiche porte ici
  // sa description : sa vignette la montre au survol, l'infobulle de la rangée
  // les regroupe toutes — seulement les effets présents. Écrite à la main,
  // l'infobulle avait dérivé : elle citait encore les buffs ATQ/DEF/VIT,
  // partis dans « État de mon monstre ».
  const effetsActifs: EffetActif[] = [];
  if (montreDefEnnemie) {
    effetsActifs.push({
      cle: 'defBreak',
      icone: DEF_BREAK_ICON,
      libelle: montreDefBreakParLeSort ? d.effets.defBreakAvant : d.effets.defBreak,
      description: d.effets.defBreakAide,
      actif: setup.defBreak,
      basculer: () => maj({ defBreak: !setup.defBreak }),
    });
  }
  // ⚠️ N'apparaît QUE si le sort choisi pose lui-même une réduction de défense
  // (effet `Decrease DEF`, lu dans les données) ET que ce monstre a un passif —
  // sinon ce réglage ne changerait rien : la réduction atterrit APRÈS le coup du
  // sort lui-même, elle ne peut profiter qu'à ce qui frappe ensuite. C'est ce qui
  // distingue « Roid attaque une cible déjà réduite » de « Roid réduit puis son
  // passif frappe » — deux passifs différents, deux mitigations différentes.
  if (montreDefBreakParLeSort) {
    effetsActifs.push({
      cle: 'defBreakParLeSort',
      icone: DEF_BREAK_ICON,
      libelle: d.effets.defBreakParLeSort,
      description: d.effets.defBreakParLeSortAide,
      actif: setup.defBreakParLeSort ?? false,
      basculer: () => maj({ defBreakParLeSort: !(setup.defBreakParLeSort ?? false) }),
    });
  }
  effetsActifs.push({
    cle: 'brand',
    icone: BRAND_ICON,
    libelle: d.effets.marque,
    description: d.effets.marqueAide,
    actif: setup.brand,
    basculer: () => maj({ brand: !setup.brand }),
  });
  // Effets portés par un AUTRE monstre que celui optimisé (demande explicite de
  // l'utilisateur) — portrait du monstre en icône plutôt qu'une icône de buff
  // générique, mais le même contrôle « Vignette » que les effets ci-dessus : un
  // monstre dans l'équipe reste un choix de l'utilisateur, pas une donnée
  // déduite du monstre optimisé lui-même. Voir les constantes
  // `EULDONG_CD_POINTS`/`MIRINAE_BONUS_PCT`/`DEBORAH_AMPLIFY`/
  // `MIRIAM_AMPLIFY_PCT` (damage.ts) pour le détail des mécaniques.
  if (montreCrit) {
    effetsActifs.push({
      cle: 'euldong',
      icone: EULDONG_ICON,
      libelle: 'Euldong',
      description: d.effets.euldong,
      actif: setup.euldongActif ?? false,
      basculer: () => maj({ euldongActif: !setup.euldongActif }),
    });
  }
  effetsActifs.push({
    cle: 'mirinae',
    icone: MIRINAE_ICON,
    libelle: 'Mirinae',
    description: d.effets.mirinae,
    actif: setup.mirinaeActif ?? false,
    basculer: () => maj({ mirinaeActif: !setup.mirinaeActif }),
  });
  if (montreDefEnnemie) {
    effetsActifs.push({
      cle: 'deborah',
      icone: DEBORAH_ICON,
      libelle: 'Deborah',
      description: d.effets.deborah,
      actif: setup.deborahActif ?? false,
      basculer: () => maj({ deborahActif: !setup.deborahActif }),
    });
  }
  if (
    utilise('ATK') ||
    utilise('DEF') ||
    utilise('SPD') ||
    utilise('Relative SPD') ||
    critSiPlusRapide ||
    bonusDegatsSelonVit
  ) {
    effetsActifs.push({
      cle: 'miriam',
      icone: MIRIAM_ICON,
      libelle: 'Miriam',
      description: d.effets.miriam,
      actif: setup.miriamActif ?? false,
      basculer: () => maj({ miriamActif: !setup.miriamActif }),
    });
  }
  effetsActifs.push({
    cle: 'transmission',
    icone: TRANSMISSION_ICON,
    libelle: 'Dr. Matteo',
    description: d.effets.matteo,
    actif: setup.transmissionActif ?? false,
    basculer: () => maj({ transmissionActif: !setup.transmissionActif }),
  });
  effetsActifs.push({
    cle: 'velaska',
    icone: VELASKA_ICON,
    libelle: 'Velaska',
    description: d.effets.velaska,
    actif: setup.velaskaActif ?? false,
    basculer: () => maj({ velaskaActif: !setup.velaskaActif }),
  });
  // ⚠️ La condition, l'état et le cas viennent de `interrupteurAttaqueConjointe`
  // (damage.ts), jamais d'une copie de la règle : la vignette n'apparaît que si
  // l'allumer changerait le sort choisi, et son état par défaut (allumée sur
  // une attaque des familles, éteinte sur un S1 ordinaire) est celui que le
  // calcul retient. Ajoutée en dernier : elle ne déplace aucune autre vignette.
  // Les descriptions disent la règle en mots du jeu, sans numéro d'artéfact.
  const interrupteurConjointe = interrupteurAttaqueConjointe(resolved, setup);
  if (interrupteurConjointe) {
    effetsActifs.push({
      cle: 'attaqueConjointe',
      icone: ATTAQUE_CONJOINTE_ICON,
      libelle: d.effets.conjointe,
      description:
        interrupteurConjointe.cas === 'familles-cooperatives' ? d.effets.conjointeFamilles : d.effets.conjointeAppelee,
      actif: interrupteurConjointe.allume,
      basculer: () => maj({ attaqueConjointe: !interrupteurConjointe.allume }),
      deuxLignes: true,
    });
  }
  // Seconde vignette des S1 des familles Chakram Dancer et Boomerang Warrior,
  // juste après « Attaque conjointe » : la condition et l'état viennent de
  // `vignettePendantTourAllie` (damage.ts), qui ne la propose que quand
  // l'interrupteur des familles est allumé. Son icône est propre (S1 de
  // Shaina), pas celle de Team Up. Dernière de la rangée : ni elle ni
  // sa voisine ne déplacent une vignette en apparaissant.
  const pendantTourAllie = vignettePendantTourAllie(resolved, setup);
  if (pendantTourAllie) {
    effetsActifs.push({
      cle: 'pendantTourAllie',
      icone: PENDANT_TOUR_ALLIE_ICON,
      libelle: d.effets.pendantTourAllie,
      description: d.effets.pendantTourAllieAide,
      actif: pendantTourAllie.allume,
      basculer: () => maj({ pendantTourAllie: !pendantTourAllie.allume }),
      deuxLignes: true,
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-panel2 p-3">
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <p className="label">{d.competence.titre}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          {skills.map((s) => {
            const pris = estPrisEnCharge(s);
            const partiel = calculPartielDuSort(s);
            return (
              <Option
                key={s.skillCom2usId}
                actif={pris && s.skillCom2usId === resolved.skillCom2usId}
                disabled={!pris}
                // La prose reste ANNONCÉE au lecteur d'écran, sur le bouton de
                // la case, en plus du « ? » qui l'affiche.
                aria-description={s.description ?? undefined}
                onClick={() => pris && maj({ skillCom2usId: s.skillCom2usId })}
                icone={
                  pris && s.icone ? (
                    <img src={s.icone} alt="" className="h-7 w-7 rounded" loading="lazy" />
                  ) : undefined
                }
                titre={
                  <>
                    <span className="font-mono text-micro text-ink-dim">S{s.slot}</span>
                    {s.nom}
                  </>
                }
                // ⚠️ **La prose du sort au CLIC, pas au survol** : un `title`
                // natif ne s'ouvre jamais au doigt, la prose restait donc
                // invisible sur téléphone. Le « ? » juste à droite du nom ouvre
                // une bulle à la souris et un panneau montant au doigt
                // (`HelpPopover`). Il vit HORS du bouton de la case (axe
                // `actionTitre` d'`Option`) : le toucher ne choisit pas le sort.
                // Un sort sans prose n'a pas de « ? » ; un sort refusé garde le
                // sien.
                // ⚠️ **« Calcul partiel »** : un sort calculé dont le total
                // omet une part connue (`calculPartielDuSort`) porte une
                // étiquette après le « ? » de sa prose, et SON « ? » dit ce qui
                // n'est pas compté. Elle dépend du seul sort, jamais du choix :
                // présente dès le premier rendu, elle ne naît ni ne disparaît
                // au clic — rien ne bouge. Hors du bouton de la case, comme le
                // « ? » de la prose : la toucher ne choisit pas le sort.
                actionTitre={
                  s.description || partiel ? (
                    <div className="flex items-center gap-1.5">
                      {s.description && (
                        <HelpPopover title={s.nom} ariaLabel={d.competence.description(s.nom)}>
                          {s.description}
                        </HelpPopover>
                      )}
                      {partiel && (
                        <>
                          <Jeton libelle={d.competence.partiel} />
                          <HelpPopover title={d.competence.partiel} ariaLabel={d.competence.partielAria(s.nom)}>
                            {partiel}
                          </HelpPopover>
                        </>
                      )}
                    </div>
                  ) : undefined
                }
                // Un sort refusé affiche POURQUOI plutôt que de disparaître :
                // sans ça, l'absence du sort n°2 passerait pour un oubli.
                description={
                  pris ? (
                    (() => {
                      const { ratio, reste, ignoreDef } = resumeSort(s, setup, textes);
                      return (
                        <>
                          {ratio && <span className="font-mono text-ink">{ratio}</span>}
                          {ratio && ' · '}
                          {reste}
                          {/* Une ligne à elle, jamais plus haute qu'une ligne
                              (`truncate`) : le cran peut changer sans que la
                              case grandisse — voir `resumeSort`. */}
                          {ignoreDef && <span className="block truncate">{ignoreDef}</span>}
                        </>
                      );
                    })()
                  ) : (
                    s.raison
                  )
                }
              />
            );
          })}
        </div>
        {champCoupsVariables(resolved, setup, maj, textes)}
        {champCibleDegats(resolved, setup, maj, textes)}
        {/* Crawler/Frankenstein (« Rage Charge ») : le compteur d'attaques
            reçues n'est pas un état que l'app simule — saisi ici, à côté
            du sort dont il modifie directement la formule. */}
        {resolved.bonusCoefficientParCompteur && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-ink-dim">{resolved.bonusCoefficientParCompteur.label}</span>
            <NumberField
              value={setup.compteurPersonnalise?.[resolved.skillCom2usId] ?? 0}
              onChange={(v) =>
                maj({
                  compteurPersonnalise: { ...(setup.compteurPersonnalise ?? {}), [resolved.skillCom2usId]: v ?? 0 },
                })
              }
              min={0}
              max={9999}
              boxWidth="w-24"
              title={d.competence.inconnu}
              ariaLabel={resolved.bonusCoefficientParCompteur.label}
            />
          </div>
        )}
        {resolved.bonusStackPropre && (
          <label className="mt-1 flex items-center gap-2">
            <span className="text-xs text-ink-dim">{resolved.bonusStackPropre.label}</span>
            <NumberField
              value={setup.stackPersonnalise?.[resolved.skillCom2usId] ?? 0}
              onChange={(v) =>
                maj({
                  stackPersonnalise: {
                    ...(setup.stackPersonnalise ?? {}),
                    [resolved.skillCom2usId]: v ?? 0,
                  },
                })
              }
              min={0}
              max={resolved.bonusStackPropre.triggerMax}
              step={resolved.bonusStackPropre.triggerStep}
              suffix={resolved.bonusStackPropre.suffix}
              boxWidth="w-24"
              title={d.competence.zeroParDefaut(resolved.bonusStackPropre.aide)}
              ariaLabel={resolved.bonusStackPropre.label}
            />
          </label>
        )}
        {/* Blade Dancers : la DEF n'y est ignorée qu'une
            fois la jauge d'attaque de la cible à 0, que l'app ne modélise pas
            — le premier coup qui l'ignore est donc un CHOIX. Crans et
            libellés DÉRIVÉS de la règle curée du sort
            (`cransIgnoreDefAPartirDuCoup`, damage.ts), absents pour tout
            autre sort ; la valeur montrée est le cran que le calcul RETIENT,
            jamais la valeur stockée. Le résumé du sort, au-dessus, dit ce
            cran sur une ligne à lui, d'une seule ligne quel que soit le cran :
            en changer ne déplace jamais ce sélecteur. */}
        {cransIgnoreDef && (
          <label className="mt-1 flex items-center gap-2">
            <span className="text-xs text-ink-dim">{d.competence.ignoreDefJauge}</span>
            <Selecteur
              taille="sm"
              pleineLargeur={false}
              value={cranIgnoreDefRetenu(resolved, setup, textes)?.rang ?? ''}
              onChange={(e) =>
                maj({
                  premierCoupIgnoreDefParSort: {
                    ...(setup.premierCoupIgnoreDefParSort ?? {}),
                    [resolved.skillCom2usId]: e.target.value === '' ? null : Number(e.target.value),
                  },
                })
              }
            >
              {cransIgnoreDef.map((c) => (
                <option key={c.rang ?? 'aucun'} value={c.rang ?? ''}>
                  {c.libelle}
                </option>
              ))}
            </Selecteur>
          </label>
        )}
        {/* Fei : chaque coup ignore la DEF par sa propre chance — un
            interrupteur par coup retenu, aucun coché par défaut. Posé sous
            la liste, comme le sélecteur ci-dessus : cocher ne déplace rien. */}
        {resolved.ignoreDefParCoupChoisi && (() => {
          const coches = setup.coupsIgnorantDefParSort?.[resolved.skillCom2usId] ?? [];
          return (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-dim">{d.coupsIgnorantDef.titre}</span>
              {Array.from({ length: resolvedHits(resolved, setup) }, (_, i) => i + 1).map((n) => (
                <Interrupteur
                  key={n}
                  actif={coches.includes(n)}
                  onChange={(actif) =>
                    maj({
                      coupsIgnorantDefParSort: {
                        ...(setup.coupsIgnorantDefParSort ?? {}),
                        [resolved.skillCom2usId]: actif
                          ? Array.from(new Set([...coches, n])).sort((a, b) => a - b)
                          : coches.filter((x) => x !== n),
                      },
                    })
                  }
                  libelle={d.coupsIgnorantDef.coup(n)}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {/* ⚠️ **Presque toujours indépendant du sort choisi ci-dessus** — un
          passif s'applique quel que soit S1/S2/S3 en cours d'optimisation,
          voir docs/02-app/degats-reels/, sauf s'il ne peut pas suivre ce
          sort (`passifsSuivants` : lui-même choisi comme sort, ou slots
          déclencheurs curés qui l'excluent — Tempest). Absent (la grande
          majorité des monstres) : rien ne s'affiche, pas même un « aucun
          passif connu » — un panneau qui parle d'une absence à chaque monstre
          serait plus bruyant qu'utile. */}
      {(passifsSuivants.length > 0 ||
        modificateursVit.length > 0 ||
        bonusDegatsStack ||
        bonusDegatsConditionnel ||
        bonusParEffetCibleMonstre ||
        bonusParEffetPropre ||
        bonusSacrifice ||
        conditionsCombatMonstre.length > 0 ||
        critInterdit) && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <p className="label">{d.passifs.titre}</p>
            <HelpPopover title={d.passifs.titre}>
              {d.passifs.aideUn}<b className="text-ink">{d.passifs.aideBouton}</b>{d.passifs.aideFin}
            </HelpPopover>
          </div>
          <div className="space-y-2">
            {critInterdit && (
              <Jeton libelle={d.passifs.critImpossible} detail={d.passifs.critImpossibleDetail} />
            )}
            {conditionsCombatMonstre.map((p, index) => (
              <div key={`condition-deduite-${p.skillCom2usId}-${index}`}>
                <Jeton
                  icone={p.icone ? <img src={p.icone} alt="" className="h-4 w-4 rounded" loading="lazy" /> : undefined}
                  libelle={p.nom.replace(/\s*\(Passive\)\s*$/i, '')}
                  detail={resumeCondition(p.condition, textes)}
                />
                {p.description && <p className="mt-1 text-xs leading-snug text-ink-dim">{p.description}</p>}
                {(p.condition.type === 'debuffsPropresMax' || p.condition.type === 'aucunDebuffPropre') && (
                  <label className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-ink-dim">{d.passifs.debuffsSurToi}</span>
                    <NumberField
                      value={setup.effetsPropresCount?.[p.skillCom2usId] ?? 0}
                      onChange={(v) =>
                        maj({
                          effetsPropresCount: {
                            ...(setup.effetsPropresCount ?? {}),
                            [p.skillCom2usId]: v ?? 0,
                          },
                        })
                      }
                      min={0}
                      boxWidth="w-24"
                      ariaLabel={d.passifs.debuffsSurToiAria}
                    />
                  </label>
                )}
              </div>
            ))}
            {/* Ciri (Eau)/Rigna/Magic Order Swordsinger (crit garanti si plus
                rapide) et Sonia/Battle Angel (bonus continu selon l'écart de
                VIT) : des MODIFICATEURS, pas des passifs à formule — sans
                bouton (entièrement automatiques dès que la VIT le permet),
                mais affichés ici comme n'importe quel passif « toujours
                actif » (Feng Yan, Dominic…), ce qu'ils n'étaient PAS avant —
                signalé par l'utilisateur. */}
            {modificateursVit.map((m) => (
              <div key={`vit-${m.skillCom2usId}`}>
                <Jeton
                  icone={m.icone ? <img src={m.icone} alt="" className="h-4 w-4 rounded" loading="lazy" /> : undefined}
                  libelle={m.nom.replace(/\s*\(Passive\)\s*$/i, '')}
                  detail={d.passifs.toujoursActif}
                />
                <p className="mt-1 text-xs leading-snug text-ink-dim">{m.detail}</p>
                {m.description && <p className="mt-1 text-xs leading-snug text-ink-dim">{m.description}</p>}
              </div>
            ))}
            {/* Momo/Mage (« Secret Book »), Fermion, Ludo, Martina, Sleep
                Talk, Borgnine/Moogwang, Trevor… : un bonus qui S'ACCUMULE en
                combat — rien que l'app ne simule, donc un champ pour que le
                joueur indique lui-même où il en est, plutôt qu'un bouton ou
                une valeur devinée. ⚠️ Chaque passif compte une chose
                RÉELLEMENT différente (attaques alliées, PV détruits sur la
                cible, PV perdus sur SOI…) — `label`/`aide` (curés dans
                `BONUS_DEGATS_STACKABLE_CONNUS`) évitent un texte unique
                écrit pour Momo qui n'aurait aucun sens pour Trevor,
                incohérence signalée par l'utilisateur.
                ⚠️ **Le DÉCLENCHEUR saisi (`resolvedStackTrigger`, ex. « PV
                cible détruits », 0 à 60 %) et le BONUS DE DÉGÂTS qui en
                résulte (`resolvedStackPct`, ex. 0 à 30 %) sont DEUX NOMBRES
                DIFFÉRENTS** — confondus jusque-là (le champ demandait le
                bonus directement), corrigé après un signalement de
                l'utilisateur : le champ saisit maintenant le déclencheur
                (`triggerMax`/`triggerStep`), le bonus résultant s'affiche à
                côté, jamais l'inverse. */}
            {bonusDegatsStack && (
              <div key={`stack-${bonusDegatsStack.skillCom2usId}`}>
                <Jeton
                  icone={
                    bonusDegatsStack.icone ? (
                      <img src={bonusDegatsStack.icone} alt="" className="h-4 w-4 rounded" loading="lazy" />
                    ) : undefined
                  }
                  libelle={bonusDegatsStack.nom.replace(/\s*\(Passive\)\s*$/i, '')}
                  detail={d.passifs.stack(bonusDegatsStack.ratio, bonusDegatsStack.suffix === '%', bonusDegatsStack.pctMax)}
                />
                {bonusDegatsStack.description && (
                  <p className="mt-1 text-xs leading-snug text-ink-dim">{bonusDegatsStack.description}</p>
                )}
                <label className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-ink-dim">{bonusDegatsStack.label}</span>
                  <NumberField
                    value={resolvedStackTrigger(bonusDegatsStack, setup)}
                    onChange={(v) =>
                      maj({
                        stackPersonnalise: {
                          ...(setup.stackPersonnalise ?? {}),
                          [bonusDegatsStack.skillCom2usId]: v ?? 0,
                        },
                      })
                    }
                    step={bonusDegatsStack.triggerStep}
                    min={0}
                    max={bonusDegatsStack.triggerMax}
                    suffix={bonusDegatsStack.suffix}
                    boxWidth="w-28"
                    title={d.passifs.stackAide(bonusDegatsStack.aide)}
                    ariaLabel={d.passifs.stackAria(bonusDegatsStack.label)}
                  />
                  <span className="text-xs text-ink-dim">{d.passifs.stackResultat(resolvedStackPct(bonusDegatsStack, setup))}</span>
                </label>
              </div>
            )}
            {/* Bonus conditionnel à bouton (Jin Kazama, Cyborg, Brownie
                Magician, Astar, Jean, Kyle, Satoru Gojo, Werner, Zenitsu,
                Qilin Slasher, Panda Warrior, Mi Ying…) — interrupteur
                (`PassifInterrupteur`, voir plus bas), désactivé par défaut,
                même famille que les passifs `bonus`/`conditionnel`
                ci-dessous, mais SANS formule propre : le bouton majore le
                TOTAL du monstre, pas la contribution d'un passif précis. Même
                stockage que `passifsOffensifs` (clé = `skillCom2usId` de CE
                modificateur) — voir `bonusDegatsConditionnelActif`. */}
            {bonusDegatsConditionnel && (
              <div key={`conditionnel-${bonusDegatsConditionnel.skillCom2usId}`}>
                <PassifInterrupteur
                  actif={bonusDegatsConditionnelActif(bonusDegatsConditionnel, setup)}
                  onChange={(v) =>
                    maj({
                      passifsOffensifs: { ...(setup.passifsOffensifs ?? {}), [bonusDegatsConditionnel.skillCom2usId]: v },
                    })
                  }
                  icone={
                    bonusDegatsConditionnel.icone ? (
                      <img src={bonusDegatsConditionnel.icone} alt="" className="h-4 w-4 rounded" loading="lazy" />
                    ) : undefined
                  }
                  libelle={`${bonusDegatsConditionnel.nom.replace(/\s*\(Passive\)\s*$/i, '')} (+${bonusDegatsConditionnel.pct} %)`}
                  title={`${bonusDegatsConditionnel.condition}${d.etat(bonusDegatsConditionnelActif(bonusDegatsConditionnel, setup))}`}
                />
                <p className="mt-1 text-xs leading-snug text-ink-dim">
                  {d.passifs.seDeclencheSi(bonusDegatsConditionnel.condition)}
                </p>
                {bonusDegatsConditionnel.description && (
                  <p className="mt-1 text-xs leading-snug text-ink-dim">{bonusDegatsConditionnel.description}</p>
                )}
              </div>
            )}
            {/* Backup Code (Hacker/570RM) — même compte que
                `resolved.bonusParEffetCible` (Julie…), mais MONSTRE-WIDE :
                majore le sort choisi quel qu'il soit, pas un sort précis.
                Stockage PARTAGÉ (`setup.effetsCibleCount`, clé =
                `skillCom2usId` du PASSIF ici plutôt que du sort actif). */}
            {bonusParEffetCibleMonstre && (
              <div key={`effet-cible-monstre-${bonusParEffetCibleMonstre.skillCom2usId}`}>
                <Jeton
                  icone={
                    bonusParEffetCibleMonstre.icone ? (
                      <img src={bonusParEffetCibleMonstre.icone} alt="" className="h-4 w-4 rounded" loading="lazy" />
                    ) : undefined
                  }
                  libelle={bonusParEffetCibleMonstre.nom.replace(/\s*\(Passive\)\s*$/i, '')}
                  detail={d.passifs.parEffet(bonusParEffetCibleMonstre.pct, libelleSourceEffet(bonusParEffetCibleMonstre.source, textes))}
                />
                {bonusParEffetCibleMonstre.description && (
                  <p className="mt-1 text-xs leading-snug text-ink-dim">{bonusParEffetCibleMonstre.description}</p>
                )}
                {bonusParEffetCibleMonstre.source !== 'buffs' && bonusParEffetCibleMonstre.maxCount === 1 ? (
                  <PassifInterrupteur
                    actif={resolvedDebuffCiblePresent(bonusParEffetCibleMonstre.skillCom2usId, setup)}
                    onChange={(v) => maj({ passifsOffensifs: { ...(setup.passifsOffensifs ?? {}), [bonusParEffetCibleMonstre.skillCom2usId]: v } })}
                    icone={undefined}
                    libelle={d.passifs.nefastesCible}
                    title={setup.defBreak || setup.brand ? d.passifs.autoBriseMarque : d.passifs.conditionBinaire}
                  />
                ) : (
                  <label className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-ink-dim">{d.passifs.effetsCible(libelleSourceEffet(bonusParEffetCibleMonstre.source, textes))}</span>
                    <NumberField
                    value={
                      bonusParEffetCibleMonstre.source === 'buffs'
                        ? setup.effetsCibleCount?.[bonusParEffetCibleMonstre.skillCom2usId] ?? 0
                        : bonusParEffetCibleMonstre.source === 'buffsEtDebuffs'
                          ? (setup.effetsCibleCountAutres === true
                            ? (setup.effetsCibleCount?.[bonusParEffetCibleMonstre.skillCom2usId] ?? 0) + Number(setup.defBreak) + Number(setup.brand)
                            : Math.max(setup.effetsCibleCount?.[bonusParEffetCibleMonstre.skillCom2usId] ?? 0, Number(setup.defBreak) + Number(setup.brand)))
                          : resolvedDebuffsCibleCount(bonusParEffetCibleMonstre.skillCom2usId, setup)
                    }
                    onChange={(v) =>
                      maj({
                        effetsCibleCount: {
                          ...(setup.effetsCibleCount ?? {}),
                          [bonusParEffetCibleMonstre.skillCom2usId]: Math.max(
                            0,
                            (v ?? 0) -
                              (bonusParEffetCibleMonstre.source === 'buffs' || setup.effetsCibleCountAutres !== true
                                ? 0 : Number(setup.defBreak) + Number(setup.brand))
                          ),
                        },
                      })
                    }
                    min={0}
                    max={bonusParEffetCibleMonstre.source !== 'debuffs'
                      ? bonusParEffetCibleMonstre.maxCount
                      : Math.min(10, bonusParEffetCibleMonstre.maxCount ?? 10)}
                    boxWidth="w-24"
                    title={d.passifs.effetsCibleAide}
                    ariaLabel={d.passifs.effetsCibleAria(libelleSourceEffet(bonusParEffetCibleMonstre.source, textes))}
                    />
                  </label>
                )}
              </div>
            )}
            {/* Blessing of Curse (Devil Maiden/Jessica) — même mécanisme,
                mais compte les débuffs sur les ALLIÉS, soi compris, bonus
                plafonné (stockage séparé, `setup.effetsPropresCount`).
                Libellés : « allies (including yourself) » du jeu. */}
            {bonusParEffetPropre && (
              <div key={`effet-propre-${bonusParEffetPropre.skillCom2usId}`}>
                <Jeton
                  icone={
                    bonusParEffetPropre.icone ? (
                      <img src={bonusParEffetPropre.icone} alt="" className="h-4 w-4 rounded" loading="lazy" />
                    ) : undefined
                  }
                  libelle={bonusParEffetPropre.nom.replace(/\s*\(Passive\)\s*$/i, '')}
                  detail={d.passifs.debuffsAllies(bonusParEffetPropre.pct, bonusParEffetPropre.plafondPct)}
                />
                {bonusParEffetPropre.description && (
                  <p className="mt-1 text-xs leading-snug text-ink-dim">{bonusParEffetPropre.description}</p>
                )}
                <label className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-ink-dim">{d.passifs.debuffsAlliesLibelle}</span>
                  <NumberField
                    value={resolvedEffetsPropresCount(bonusParEffetPropre.skillCom2usId, setup)}
                    onChange={(v) =>
                      maj({
                        effetsPropresCount: {
                          ...(setup.effetsPropresCount ?? {}),
                          [bonusParEffetPropre.skillCom2usId]: v ?? 0,
                        },
                      })
                    }
                    min={0}
                    boxWidth="w-24"
                    title={d.passifs.debuffsAlliesAide}
                    ariaLabel={d.passifs.debuffsAlliesAria}
                  />
                </label>
              </div>
            )}
            {/* Calculated Sacrifice (Onimusha, Fuuki) — dégâts fixes selon
                un sacrifice de PV chaque tour ; l'app ne simule pas la
                compression des PV tour après tour, l'utilisateur indique ses
                PV ACTUELS juste avant le déclenchement (défaut 100 % —
                premier tour, seule exception « défaut non nul » de cette
                section, voir `resolvedPvActuelsAvantSacrificePctMonstre`). */}
            {bonusSacrifice && (
              <div key={`sacrifice-${bonusSacrifice.skillCom2usId}`}>
                <Jeton
                  icone={
                    bonusSacrifice.icone ? (
                      <img src={bonusSacrifice.icone} alt="" className="h-4 w-4 rounded" loading="lazy" />
                    ) : undefined
                  }
                  libelle={bonusSacrifice.nom.replace(/\s*\(Passive\)\s*$/i, '')}
                  detail={d.passifs.sacrifice(bonusSacrifice.pctPerte, bonusSacrifice.pctSurPerte)}
                />
                {bonusSacrifice.description && (
                  <p className="mt-1 text-xs leading-snug text-ink-dim">{bonusSacrifice.description}</p>
                )}
                <label className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-ink-dim">{d.passifs.sacrificePv}</span>
                  <NumberField
                    value={resolvedPvActuelsAvantSacrificePctMonstre(bonusSacrifice.skillCom2usId, setup)}
                    onChange={(v) =>
                      maj({
                        pvActuelsAvantSacrificePct: {
                          ...(setup.pvActuelsAvantSacrificePct ?? {}),
                          [bonusSacrifice.skillCom2usId]: v ?? 100,
                        },
                      })
                    }
                    min={0}
                    max={100}
                    suffix="%"
                    boxWidth="w-28"
                    title={d.passifs.sacrificeAide}
                    ariaLabel={d.passifs.sacrificeAria}
                  />
                </label>
              </div>
            )}
            {passifsSuivants.map((p) => {
              const nom = p.nom.replace(/\s*\(Passive\)\s*$/i, '');
              const icone = p.profile.icone ? (
                <img src={p.profile.icone} alt="" className="h-4 w-4 rounded" loading="lazy" />
              ) : undefined;
              const texteJeu = p.description ? (
                <p className="mt-1 text-xs leading-snug text-ink-dim">{p.description}</p>
              ) : null;
              // Voir `resumeSort` : un passif `coupsDuSortActif` suit les coups
              // du SORT ACTIF, jamais les siens propres.
              const { ratio, reste } = resumeSort(
                p.profile,
                setup,
                textes,
                p.coupsDuSortActif && resolved ? resolvedHits(resolved, setup) : undefined
              );
              const resume = (
                <p className="mt-1 text-xs leading-snug text-ink-dim">
                  {ratio && <span className="font-mono text-ink">{ratio}</span>}
                  {ratio && ' · '}
                  {reste}
                </p>
              );

              // Déclenchement ENTIÈREMENT déduit (`defBreak`) ou inconditionnel
              // (`toujours`) : pas de bouton, on montre juste l'état courant et
              // POURQUOI, pour que le joueur puisse le contredire s'il le faut.
              if (p.categorie.type === 'toujours' || p.categorie.type === 'defBreak') {
                // Même porte que le calcul (`passifCompte`, avec le sort choisi).
                const declenche = passifCompte(p, resolved, setup);
                return (
                  <div key={p.skillCom2usId} className={declenche ? '' : 'opacity-50'}>
                    <Jeton
                      icone={icone}
                      libelle={nom}
                      detail={p.categorie.type === 'toujours' ? d.passifs.toujoursActif : declenche ? d.passifs.declenche : d.passifs.nonDeclenche}
                    />
                    {resume}
                    {p.categorie.type === 'defBreak' && (
                      <p className="mt-1 text-xs leading-snug text-ink-dim">
                        {d.passifs.seDeclencheSi(p.categorie.condition)}
                      </p>
                    )}
                    {p.bonusPvCible && (
                      <p className="mt-1 text-xs leading-snug text-ink-dim">
                        {d.passifs.bonusPvCible(p.bonusPvCible.pct, p.bonusPvCible.seuilPct)}
                      </p>
                    )}
                    {texteJeu}
                    {declenche && champCoupsVariables(p.profile, setup, maj, textes)}
                  </div>
                );
              }

              // `bonus` : le bouton ne porte QUE le surplus. `conditionnel` :
              // il porte le passif entier.
              const actif = setup.passifsOffensifs?.[p.skillCom2usId] ?? false;
              const cat = p.categorie;
              // Un passif qui frappe APRÈS certains sorts (`slotsDeclencheurs`
              // curés — Tempest) : l'interrupteur dit lui-même ce que
              // l'utilisateur suppose pour le calcul, « Tempest (S3) se
              // déclenche après ce sort », à la place de la phrase « Se
              // déclenche si … », qui n'en dirait pas plus. ⚠️ **Pas de survol
              // (`title`) sur cet interrupteur-là** : un survol n'existe pas au
              // doigt. La condition du jeu reste lisible dans la prose du
              // passif, sous l'interrupteur et au « ? » de sa case dans
              // « Compétence utilisée ». Les autres interrupteurs de
              // passif gardent le leur.
              const apresSort = cat.type === 'conditionnel' && p.slotsDeclencheurs != null;
              const libelle = apresSort
                ? d.passifs.apresSort(nom, p.profile.slot, !!p.avantLeSort)
                : cat.type === 'bonus'
                  ? `${nom} (+${cat.pct} %)`
                  : nom;
              const condition = `${cat.condition[0].toUpperCase()}${cat.condition.slice(1)}`;
              // ⚠️ `dejaInclus` (Dominic) : le ratio affiché ci-dessus EST déjà
              // le cas majoré — décocher ne l'ajoute pas, il le RETIRE (voir
              // computeTotalDamage, damage.ts). Texte distinct, sinon « Dégâts
              // de base toujours comptés ; +100 % si… » laisserait croire que
              // le ratio, lui, est encore le cas de base.
              const texteCondition =
                cat.type === 'bonus' && cat.dejaInclus
                  ? d.passifs.dejaInclus(cat.condition, ((100 + cat.pct) / 100).toFixed(2).replace(/\.?0+$/, ''))
                  : cat.type === 'bonus'
                    ? d.passifs.bonusSi(cat.pct, cat.condition)
                    : d.passifs.seDeclencheSi(cat.condition);
              return (
                <div key={p.skillCom2usId}>
                  <PassifInterrupteur
                    actif={actif}
                    onChange={(v) => maj({ passifsOffensifs: { ...(setup.passifsOffensifs ?? {}), [p.skillCom2usId]: v } })}
                    icone={icone}
                    libelle={libelle}
                    title={apresSort ? undefined : `${condition}${d.etat(actif)}`}
                  />
                  {resume}
                  {!apresSort && <p className="mt-1 text-xs leading-snug text-ink-dim">{texteCondition}</p>}
                  {texteJeu}
                  {champCoupsVariables(p.profile, setup, maj, textes)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(utilise('Current HP %') || utilise('Current HP') || utilise('Missing HP') || demandePvPropres ||
        utilise('Living Ally %') || utilise('Alive Enemies') || utilise('Sacrifice Reserve %')) && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <p className="label">{d.contexte.titre}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {(utilise('Current HP %') || utilise('Current HP') || utilise('Missing HP') || demandePvPropres) && (
              <label className="flex items-center gap-2">
                <span className="text-xs text-ink-dim">{d.contexte.mesPv}</span>
                <NumberField
                  value={setup.ownHpPct ?? DEFAULT_DAMAGE_SETUP.ownHpPct!}
                  onChange={(v) => maj({ ownHpPct: v ?? 100 })}
                  min={0}
                  max={100}
                  step={5}
                  suffix="%"
                  boxWidth="w-28"
                  ariaLabel={d.contexte.mesPvAria}
                />
              </label>
            )}
            {utilise('Living Ally %') && (
              <label className="flex items-center gap-2">
                <span className="text-xs text-ink-dim">{d.contexte.alliesVivants}</span>
                <NumberField
                  value={setup.livingAlliesPct ?? DEFAULT_DAMAGE_SETUP.livingAlliesPct!}
                  onChange={(v) => maj({ livingAlliesPct: v ?? 100 })}
                  min={0}
                  max={100}
                  step={25}
                  suffix="%"
                  boxWidth="w-28"
                  ariaLabel={d.contexte.alliesVivantsAria}
                />
              </label>
            )}
            {utilise('Alive Enemies') && (
              <label className="flex items-center gap-2">
                <span className="text-xs text-ink-dim">{d.contexte.ennemisVivants}</span>
                <NumberField
                  value={setup.aliveEnemies ?? DEFAULT_DAMAGE_SETUP.aliveEnemies!}
                  onChange={(v) => maj({ aliveEnemies: Math.min(4, Math.max(1, Math.floor(v ?? 1))) })}
                  min={1}
                  max={4}
                  step={1}
                  boxWidth="w-24"
                  ariaLabel={d.contexte.ennemisVivantsAria}
                />
              </label>
            )}
            {utilise('Sacrifice Reserve %') && (
              <label className="flex items-center gap-2">
                <span className="text-xs text-ink-dim">{d.contexte.reserve}</span>
                <NumberField
                  value={setup.sacrificeReservePct ?? DEFAULT_DAMAGE_SETUP.sacrificeReservePct!}
                  onChange={(v) => maj({ sacrificeReservePct: v ?? 0 })}
                  min={0}
                  max={100}
                  step={5}
                  suffix="/100"
                  boxWidth="w-28"
                  ariaLabel={d.contexte.reserveAria}
                />
              </label>
            )}
          </div>
        </div>
      )}

      {combatStats.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <p className="label">{d.statsCombat.titre}</p>
          </div>
          <div className="space-y-2">
            {combatStats.map((profile, index) => {
              const key = `${profile.skillCom2usId}-${profile.source}-${index}`;
              const icone = profile.icone ? (
                <img src={profile.icone} alt="" className="h-4 w-4 rounded" loading="lazy" />
              ) : undefined;
              const nom = profile.nom.replace(/\s*\(Passive\)\s*$/i, '');
              // ⚠️ **La prose du jeu, une fois par passif** :
              // sous ce qui NOMME le passif, avant son réglage — jamais répétée
              // pour le second compteur d'Elsharion ou de Crane, jamais quand un
              // bloc des passifs offensifs la rend déjà (`renduStatsCombat`).
              const { ouvre, prose } = renduCombat[index];
              // Un compteur ou un interrupteur d'état ne nomme pas son passif :
              // l'icône et le nom se posent au-dessus du réglage qui l'ouvre
              // (patron des passifs offensifs).
              const nomDuPassif = ouvre ? <Jeton icone={icone} libelle={nom} /> : null;
              let nomme: ReactNode = null;
              let reglage: ReactNode = null;
              if (profile.source === 'debuffsInverses') {
                nomme = <Jeton icone={icone} libelle={nom} detail={profile.label} />;
                reglage = (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <Interrupteur actif={setup.atkDebuff ?? false} onChange={(v) => maj({ atkDebuff: v })} libelle={d.statsCombat.malusAtq} />
                    <Interrupteur actif={setup.defDebuff ?? false} onChange={(v) => maj({ defDebuff: v })} libelle={d.statsCombat.malusDef} />
                    <Interrupteur actif={setup.spdDebuff ?? false} onChange={(v) => maj({ spdDebuff: v })} libelle={d.statsCombat.malusVit} />
                  </div>
                );
              } else if (profile.source === 'toujours') {
                nomme = <Jeton icone={icone} libelle={nom} detail={d.statsCombat.toujoursActif(profile.label)} />;
              } else if (profile.source === 'toggle') {
                if (profile.togglePartageCondition && clesToggleDejaAffichees.has(profile.skillCom2usId)) {
                  nomme = <Jeton icone={icone} libelle={nom} detail={d.statsCombat.pilote(profile.label)} />;
                } else {
                  nomme = nomDuPassif;
                  reglage = (
                    <div className={nomDuPassif ? 'mt-1' : undefined}>
                      <PassifInterrupteur
                        actif={setup.statsCombatActives?.[profile.skillCom2usId] ?? false}
                        onChange={(v) => maj({ statsCombatActives: { ...(setup.statsCombatActives ?? {}), [profile.skillCom2usId]: v } })}
                        icone={nomDuPassif ? undefined : icone}
                        libelle={profile.label}
                        title={`${profile.label}${d.etat(!!setup.statsCombatActives?.[profile.skillCom2usId])}`}
                      />
                    </div>
                  );
                }
              } else {
                const record = profile.source === 'buffsPropres'
                  ? setup.buffsPropresCount
                  : profile.source === 'buffsAllies'
                    ? setup.buffsAlliesCount
                    : profile.source === 'debuffsPropres'
                      ? setup.effetsPropresCount
                      : setup.stackPersonnalise;
                const patcher = (value: number) => {
                  if (profile.source === 'buffsPropres') {
                    majBuffsPropres(profile.skillCom2usId, value);
                  } else if (profile.source === 'buffsAllies') {
                    maj({ buffsAlliesCount: { ...(setup.buffsAlliesCount ?? {}), [profile.skillCom2usId]: value } });
                  } else if (profile.source === 'debuffsPropres') {
                    maj({ effetsPropresCount: { ...(setup.effetsPropresCount ?? {}), [profile.skillCom2usId]: value } });
                  } else {
                    maj({ stackPersonnalise: { ...(setup.stackPersonnalise ?? {}), [profile.skillCom2usId]: value } });
                  }
                };
                nomme = nomDuPassif;
                reglage = (
                  <label className={`${nomDuPassif ? 'mt-1 ' : ''}flex flex-wrap items-center gap-2`}>
                    <span className="text-xs text-ink-dim">{profile.label}</span>
                    <NumberField
                      value={profile.source === 'buffsPropres'
                        ? Math.min(profile.max ?? 10, resolvedBuffsPropresCount(profile.skillCom2usId, setup))
                        : record?.[profile.skillCom2usId] ?? 0}
                      onChange={(v) => patcher(v ?? 0)}
                      min={0}
                      max={profile.source === 'buffsPropres' ? Math.min(10, profile.max ?? 10) : profile.max}
                      step={1}
                      boxWidth="w-24"
                      ariaLabel={profile.label}
                    />
                  </label>
                );
              }
              return (
                <div key={key}>
                  {nomme}
                  {prose && <p className="mt-1 text-xs leading-snug text-ink-dim">{prose}</p>}
                  {reglage}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {seuilsPassifEivor && (() => {
        const requis = setup.summonerSkills === 'guilde'
          ? seuilsPassifEivor.bonusGuilde
          : seuilsPassifEivor.bonusCombat;
        return (
          <div className="rounded-lg border border-border-soft bg-panel px-3 py-2">
            <p className="text-xs font-semibold text-ink">{d.eivor.titre}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-dim">
              {seuilsPassifEivor.atk} {jeu.stats.atk} (<b className="text-ink">+{requis.atk}</b>) ·{' '}
              {seuilsPassifEivor.def} {jeu.stats.def} (<b className="text-ink">+{requis.def}</b>) ·{' '}
              {seuilsPassifEivor.spd} {jeu.stats.spd} (<b className="text-ink">+{requis.spd}</b>)
            </p>
            <p className="mt-1 text-micro text-ink-dim">
              {d.eivor.valeurs(d.contenusInvocateur[setup.summonerSkills === 'guilde' ? 'guilde' : 'normal'])}
            </p>
          </div>
        );
      })()}

      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <p className="label">{d.adversaire.titre}</p>
          <HelpPopover title={d.adversaire.titre}>{d.adversaire.aide}</HelpPopover>
        </div>
        {/* `flex-wrap` : les deux champs passent l'un sous l'autre au doigt
            plutôt que de comprimer les boutons − / + sous la taille de cible.
            Empilés, leurs libellés prennent une largeur commune
            (`libelleAdversaire`) pour que les champs s'alignent. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2">
            <span className={libelleAdversaire}>{jeu.stats.hp}</span>
            <NumberField
              value={setup.enemyHp}
              onChange={(v) => maj({ enemyHp: v ?? 0 })}
              step={1000}
              min={1}
              boxWidth="w-32"
              ariaLabel={d.adversaire.pvAria}
            />
          </label>
          {montreDefEnnemie && (
            <label className="flex items-center gap-2">
              <span className={libelleAdversaire}>{jeu.stats.def}</span>
              <NumberField
                value={setup.enemyDef}
                onChange={(v) => maj({ enemyDef: v ?? 0 })}
                step={50}
                min={0}
                boxWidth="w-32"
                ariaLabel={d.adversaire.defAria}
              />
            </label>
          )}
          {demandeAtkCible && (
            <label className="flex items-center gap-2">
              <span className={libelleAdversaire}>{d.adversaire.atq}</span>
              <NumberField
                value={setup.enemyAtk ?? DEFAULT_DAMAGE_SETUP.enemyAtk!}
                onChange={(v) => maj({ enemyAtk: v ?? 0 })}
                min={0}
                step={50}
                boxWidth="w-32"
                ariaLabel={d.adversaire.atqAria}
              />
            </label>
          )}
          {/* Pour les sorts dont la formule lit les PV COURANTS de la cible
              (« dégâts proportionnels aux PV perdus ») — mais AUSSI quand un
              passif porte un seuil de PV (Final Strike : +20 % sous 30 %),
              puisque les coups du sort creusent la cible avant qu'il frappe,
              et quand l'ignore DEF du sort dépend des PV perdus (Unlimited
              Power à 3 ennemis ou moins). */}
          {(utilise('Target Current HP %') || passifsSuivants.some((p) => p.bonusPvCible) || demandePvCible ||
            !!resolved.ignoreDefSelonPvCiblePerdus) && (
            <label className="flex items-center gap-2">
              <span className={libelleAdversaire}>{d.adversaire.pvRestants}</span>
              <NumberField
                value={setup.enemyHpPct}
                onChange={(v) => maj({ enemyHpPct: v ?? 0 })}
                step={5}
                min={0}
                max={100}
                suffix="%"
                boxWidth="w-32"
                ariaLabel={d.adversaire.pvRestantsAria}
              />
            </label>
          )}
          {demandePvNonDetruits && (
            <PassifInterrupteur
              actif={setup.enemyHpNotDestroyed ?? false}
              onChange={(v) => maj({ enemyHpNotDestroyed: v })}
              icone={undefined}
              libelle={d.adversaire.pvNonDetruits}
              title={d.adversaire.pvNonDetruitsAide}
            />
          )}
          {/* Élément de la cible — décrit l'ADVERSAIRE, au même titre que ses
              PV et sa DEF, et se pose donc TOUJOURS.
              ⚠️ **Surtout pas conditionné aux artéfacts qui portent une ligne
              300-304.** Deux raisons, la seconde décisive :
              1. la chronologie — on configure l'adversaire AVANT toute
                 recherche, à un moment où rien ne dit encore quels artéfacts
                 seront retenus ;
              2. ce réglage est une ENTRÉE du choix d'artéfact, pas une
                 conséquence. Le masquer tant qu'aucun artéfact équipé ne
                 porte la ligne reviendrait à cacher ce qui décide du choix en
                 attendant que le choix soit fait.
              C'est la différence avec `montreDefEnnemie` ou « PV restants » :
              ceux-là sont pilotés par ce que le SORT consomme, connu d'avance
              et immuable. */}
          {/* Au format étroit, six crans ne tiennent pas à côté du libellé :
              libellé au-dessus, crans en pleine largeur, qui se resserrent. */}
          <label className={etroit ? 'flex w-full flex-col gap-1' : 'flex items-center gap-2'}>
            <span className="text-xs text-ink-dim">{d.adversaire.element}</span>
            {/* ⚠️ « Ignorer » est une OPTION, pas l'absence de choix : le
                cadre montre toujours quel cran est posé. Optimiser « contre
                n'importe qui » est un cas d'usage à part entière, pas un
                repli dégradé — même parti pris que le « Toutes » du filtre
                de stat principale (docs/02-app/compte/). */}
            <Segmented<ElementKey | 'aucun'>
              size={etroit ? 'lg' : undefined}
              value={setup.enemyElement ?? 'aucun'}
              onChange={(v) => maj({ enemyElement: v === 'aucun' ? null : v })}
              options={[
                { key: 'aucun', label: d.adversaire.ignorer },
                ...ELEMENTS.filter((e) => e.key !== 'unknown').map((e) => ({ key: e.key, label: nomElement(jeu, e.key) })),
              ]}
            />
          </label>
          {/* Julie (« Thousand Shots »)/Melissa (« Massacre Dance ») :
              +pct % par effet PRÉSENT sur la cible — l'app ne simule aucun
              effet réel de l'adversaire, saisi par l'utilisateur, 0 par
              défaut. Propre à CE sort (`resolved.bonusParEffetCible`), pas
              à tout le monstre. */}
          {resolved.bonusParEffetCible && (
            resolved.bonusParEffetCible.source !== 'buffs' && resolved.bonusParEffetCible.maxCount === 1 ? (
              <PassifInterrupteur
                actif={resolvedDebuffCiblePresent(resolved.skillCom2usId, setup)}
                onChange={(v) => maj({ passifsOffensifs: { ...(setup.passifsOffensifs ?? {}), [resolved.skillCom2usId]: v } })}
                icone={resolved.icone ? <img src={resolved.icone} alt="" className="h-4 w-4 rounded" loading="lazy" /> : undefined}
                libelle={`${resolved.nom} (+${resolved.bonusParEffetCible.pct} %)`}
                title={setup.defBreak || setup.brand ? d.passifs.autoBriseMarque : d.passifs.nefastesCible}
              />
            ) : (
              <label className="flex items-center gap-2">
                <span className="text-xs text-ink-dim">{d.passifs.effetsCible(libelleSourceEffet(resolved.bonusParEffetCible.source, textes))}</span>
                <NumberField
                value={
                  resolvedEffetsCibleCount(resolved, setup)
                }
                max={resolved.bonusParEffetCible.source !== 'debuffs'
                  ? resolved.bonusParEffetCible.maxCount
                  : Math.min(10, resolved.bonusParEffetCible.maxCount ?? 10)}
                onChange={(v) =>
                  maj({
                    effetsCibleCount: {
                      ...(setup.effetsCibleCount ?? {}),
                      [resolved.skillCom2usId]: Math.max(
                        0,
                        (v ?? 0) -
                          (resolved.bonusParEffetCible?.source === 'buffs' ||
                            resolved.bonusParEffetCible?.source === 'degatsContinus' ||
                            setup.effetsCibleCountAutres !== true
                            ? 0 : Number(setup.defBreak) + Number(setup.brand))
                      ),
                    },
                  })
                }
                min={0}
                boxWidth="w-24"
                title={d.passifs.effetsCibleSourceAide(libelleSourceEffet(resolved.bonusParEffetCible.source, textes))}
                ariaLabel={d.passifs.effetsCibleAria(libelleSourceEffet(resolved.bonusParEffetCible.source, textes))}
              />
              </label>
            )
          )}
          {/* Dégâts bruts selon les effets nocifs de la cible (Havoc, Bullet
              Assassination ; Start of Pain de Kiki, Nano Vision d'Amber sur
              chacun de leurs sorts) : la présence en interrupteur, sinon un
              compteur borné. Saisie sous la clé de la règle (le sort, ou le
              passif pour tout le monstre). */}
          {resolved.brutParEffetCible && (() => {
            const brut = resolved.brutParEffetCible;
            const b = d.brutParEffet;
            const base = b.base[brut.base];
            const dot = brut.source === 'degatsContinus';
            if (brut.maxCount === 1) {
              return (
                <PassifInterrupteur
                  icone={resolved.icone ? <img src={resolved.icone} alt="" className="h-4 w-4 rounded" loading="lazy" /> : undefined}
                  actif={resolvedBrutParEffetCount(brut, setup) > 0}
                  onChange={(v) => maj({ passifsOffensifs: { ...(setup.passifsOffensifs ?? {}), [brut.cle]: v } })}
                  libelle={b.presence(brut.nom, brut.pct, base)}
                  title={setup.defBreak || setup.brand ? d.passifs.autoBriseMarque : d.passifs.nefastesCible}
                />
              );
            }
            const explicites = brut.source === 'debuffs' && setup.effetsCibleCountAutres === true
              ? Number(!!setup.defBreak) + Number(!!setup.brand) : 0;
            return (
              <label className="flex items-center gap-2">
                <span className="text-xs text-ink-dim">{b.compte(brut.nom, dot, brut.maxCount ?? null)}</span>
                <NumberField
                  value={resolvedBrutParEffetCount(brut, setup)}
                  max={brut.maxCount ?? 10}
                  min={0}
                  onChange={(v) =>
                    maj({ effetsCibleCount: { ...(setup.effetsCibleCount ?? {}), [brut.cle]: Math.max(0, (v ?? 0) - explicites) } })
                  }
                  boxWidth="w-24"
                  title={b.compteAide(brut.pct, base, dot)}
                  ariaLabel={b.compteAria(brut.nom, dot)}
                />
              </label>
            );
          })()}
          {resolved.bonusParEffetPropre && (
            <label className="flex items-center gap-2">
              <span className="text-xs text-ink-dim">
                {d.adversaire.surToi(resolved.bonusParEffetPropre.source === 'buffs')}
              </span>
              <NumberField
                value={
                  resolved.bonusParEffetPropre.source === 'buffs'
                    ? resolvedBuffsPropresCount(resolved.skillCom2usId, setup)
                    : setup.effetsPropresCount?.[resolved.skillCom2usId] ?? 0
                }
                onChange={(v) =>
                  resolved.bonusParEffetPropre?.source === 'buffs'
                    ? majBuffsPropres(resolved.skillCom2usId, v ?? 0)
                    : maj({
                        effetsPropresCount: {
                          ...(setup.effetsPropresCount ?? {}),
                          [resolved.skillCom2usId]: v ?? 0,
                        },
                      })
                }
                min={0}
                max={resolved.bonusParEffetPropre.source === 'buffs' ? 10 : undefined}
                boxWidth="w-24"
                ariaLabel={d.adversaire.surToiAria(resolved.bonusParEffetPropre.source === 'buffs')}
              />
            </label>
          )}
          {demandeBuffsCible && (
            <div className="space-y-1">
              <Interrupteur
                actif={resolvedBuffCiblePresent(resolved.skillCom2usId, setup)}
                onChange={(v) => maj({
                  buffsCibleCount: {
                    ...(setup.buffsCibleCount ?? {}),
                    [resolved.skillCom2usId]: v ? 1 : 0,
                  },
                })}
                libelle={d.adversaire.beneficesCible}
                aria-label={d.adversaire.beneficesCible}
              />
              <p className="text-xs text-ink-dim">
                {conditionsSort
                  .filter((condition) => condition.type === 'buffCiblePresent' || condition.type === 'aucunBuffCible')
                  .map((condition) => resumeCondition(condition, textes))
                  .join(' · ')}.
                {conditionsSort.some((condition) => condition.type === 'aucunBuffCible' && condition.critiqueGaranti)
                  ? d.adversaire.buffRetireGarantie
                  : ''}
              </p>
            </div>
          )}
          {demandeDebuffsPropres && !resolved.bonusParEffetPropre && (
            <label className="flex items-center gap-2">
              <span className="text-xs text-ink-dim">{d.passifs.debuffsSurToi}</span>
              <NumberField
                value={setup.effetsPropresCount?.[resolved.skillCom2usId] ?? 0}
                onChange={(v) =>
                  maj({
                    effetsPropresCount: {
                      ...(setup.effetsPropresCount ?? {}),
                      [resolved.skillCom2usId]: v ?? 0,
                    },
                  })
                }
                min={0}
                boxWidth="w-24"
                ariaLabel={d.passifs.debuffsSurToiAria}
              />
            </label>
          )}
          {(() => {
            // Chaque effet avec les coups qui peuvent le poser, ou les effets d'un
            // même tirage, réglés coup par coup (`reglagesDesPoses`).
            const reglages = reglagesDesPoses(resolved, setup);
            if (reglages.length === 0) return null;
            const scenario = setup.scenariosEffetsEntreCoups?.[resolved.skillCom2usId] ?? {};
            const majScenario = (patch: Partial<typeof scenario>) =>
              maj({
                scenariosEffetsEntreCoups: {
                  ...(setup.scenariosEffetsEntreCoups ?? {}),
                  [resolved.skillCom2usId]: { ...scenario, ...patch },
                },
              });
            // Ce que la cible porte déjà de cet effet, au départ.
            const presence = (effet: EffetEntreCoupsProfile) => {
              const presents = scenario.presentsInitialement ?? [];
              const initialDerive =
                effet.effetCombat === 'brand' ? setup.brand : effet.effetCombat === 'defBreak' ? setup.defBreak : false;
              return (
                <>
                  {!effet.cumulable && !effet.effetCombat && (
                    <Interrupteur
                      actif={presents.includes(effet.id)}
                      onChange={(actif) =>
                        majScenario({
                          presentsInitialement: actif
                            ? Array.from(new Set([...presents, effet.id]))
                            : presents.filter((id) => id !== effet.id),
                        })
                      }
                      libelle={d.entreCoups.dejaPresent}
                    />
                  )}
                  {effet.effetCombat && (
                    <span className="text-xs text-ink-dim">
                      {initialDerive ? d.entreCoups.dejaInclus : d.entreCoups.absent}
                    </span>
                  )}
                </>
              );
            };
            return (
              <div className="space-y-2 rounded-lg border border-border-soft bg-panel2 p-2.5">
                <Interrupteur
                  actif={scenario.actif ?? false}
                  onChange={(actif) => majScenario({ actif })}
                  libelle={d.entreCoups.titre}
                />
                {scenario.actif && (
                  <div className="space-y-2 border-t border-border-soft pt-2">
                    {reglages.map((reglage) => {
                      if (reglage.type === 'tirage') {
                        // Un tirage : un seul effet par coup, choisi coup par
                        // coup — aucun, ou l'un de ceux que ce coup peut poser.
                        return (
                          <div key={reglage.cle} className="space-y-1.5">
                            {reglage.effets.map(({ effet }) => (
                              <div key={effet.id} className="flex flex-wrap items-center gap-2">
                                <span className="min-w-40 text-xs text-ink-dim">{libelleEffetEntreCoups(effet, textes)}</span>
                                {presence(effet)}
                              </div>
                            ))}
                            <p className="text-xs text-ink-dim">{d.entreCoups.unSeulParCoup}</p>
                            {reglage.rangs.map((coup) => (
                              <div key={coup} className="flex flex-wrap items-center gap-2">
                                <span className="min-w-40 text-xs text-ink-dim">{d.entreCoups.apresCoup(coup)}</span>
                                <Selecteur
                                  taille="sm"
                                  pleineLargeur={false}
                                  value={effetDuTirageAuCoup(scenario, reglage.effets, coup) ?? ''}
                                  onChange={(e) =>
                                    majScenario({
                                      apresCoup: choisirAuCoupDuTirage(scenario, reglage.effets, coup, e.target.value === '' ? null : e.target.value),
                                    })
                                  }
                                  aria-label={d.entreCoups.effetApresCoupAria(coup)}
                                >
                                  <option value="">{d.entreCoups.aucunEffet}</option>
                                  {effetsDuTirageProposables(scenario, reglage.effets, coup).map((effet) => (
                                    <option key={effet.id} value={effet.id}>{nomEffetEntreCoups(effet, textes)}</option>
                                  ))}
                                </Selecteur>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      const { effet, rangs } = reglage.propose;
                      const choisi = scenario.apresCoup?.[effet.id];
                      const poserApres = (coup: number | null) =>
                        majScenario({ apresCoup: { ...(scenario.apresCoup ?? {}), [effet.id]: coup } });
                      return (
                        <div key={effet.id} className="flex flex-wrap items-center gap-2">
                          <span className="min-w-40 text-xs text-ink-dim">{libelleEffetEntreCoups(effet, textes)}</span>
                          {presence(effet)}
                          {rangs.length === 1 ? (
                            // Un seul coup pose l'effet (prose ou note) : posé ou non.
                            <Interrupteur
                              actif={choisi === rangs[0]}
                              onChange={(actif) => poserApres(actif ? rangs[0] : null)}
                              libelle={d.entreCoups.poseAuCoup(rangs[0])}
                            />
                          ) : (
                            <Selecteur
                              taille="sm"
                              pleineLargeur={false}
                              value={choisi != null && rangs.includes(choisi) ? choisi : ''}
                              onChange={(e) => poserApres(e.target.value === '' ? null : Number(e.target.value))}
                              aria-label={d.entreCoups.momentAria(nomEffetEntreCoups(effet, textes))}
                            >
                              <option value="">{d.entreCoups.aucuneReussite}</option>
                              {rangs.map((hit) => (
                                <option key={hit} value={hit}>{d.entreCoups.apresCoup(hit)}</option>
                              ))}
                            </Selecteur>
                          )}
                          {/* Critical Link : la bête convertit chaque effet
                              bénéfique de la cible en un dégât continu — le
                              joueur dit combien, 0 par défaut. */}
                          {effet.nombreChoisi && (
                            <label className="flex items-center gap-2">
                              <span className="text-xs text-ink-dim">{d.entreCoups.convertis}</span>
                              <NumberField
                                value={scenario.nombres?.[effet.id] ?? 0}
                                onChange={(v) => majScenario({ nombres: { ...(scenario.nombres ?? {}), [effet.id]: Math.max(0, v ?? 0) } })}
                                min={0}
                                max={10}
                                boxWidth="w-16"
                                ariaLabel={d.entreCoups.convertisAria(nomEffetEntreCoups(effet, textes))}
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                    <p className="text-xs text-ink-dim">
                      {d.entreCoups.aide}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
          {conditionsAvecCle
            .filter(({ condition }) => condition.type === 'debuffCiblePresent')
            .map(({ condition, key, nom, icone }) => {
              if (condition.type !== 'debuffCiblePresent') return null;
              const actif = resolvedDebuffCiblePresent(key, setup) ||
                (!!condition.coupsEnPlus && coupsEnPlusAncienneRecetteActif(resolved, setup));
              return (
                <PassifInterrupteur
                  key={`condition-debuff-cible-${key}`}
                  actif={actif}
                  onChange={(v) => maj({ passifsOffensifs: { ...(setup.passifsOffensifs ?? {}), [key]: v } })}
                  icone={icone ? <img src={icone} alt="" className="h-4 w-4 rounded" loading="lazy" /> : undefined}
                  libelle={condition.coupsEnPlus
                    ? d.condition.effetNocif(d.condition.coupsEnPlus(condition.coupsEnPlus))
                    : `${nom}${condition.critiqueGaranti ? d.condition.suffixeCritique : condition.pct ? d.condition.suffixePct(condition.pct) : condition.ignoreDefPct ? d.condition.suffixeIgnoreDef(condition.ignoreDefPct) : ''}`}
                  title={actif && (setup.defBreak || setup.brand) ? d.passifs.autoBriseMarque : d.passifs.nefastesCible}
                />
              );
            })}
          {conditionsAvecCle
            .filter(({ condition }) => condition.type === 'manuel')
            .map(({ condition, key, nom, icone }) => {
              if (condition.type !== 'manuel') return null;
              const actif = (setup.passifsOffensifs?.[key] ?? false) ||
                (!!condition.coupsEnPlus && coupsEnPlusAncienneRecetteActif(resolved, setup));
              const effet = condition.coupsEnPlus
                ? d.condition.coupsEnPlus(condition.coupsEnPlus)
                : condition.critiqueGaranti
                ? d.condition.critiqueGaranti
                : condition.ignoreDefPct
                  ? d.condition.ignoreDefPct(condition.ignoreDefPct)
                  : condition.pct
                    ? d.condition.pctDegats(condition.pct)
                    : d.condition.active;
              const compteChance = condition.chanceParBuffPropre
                ? resolvedBuffsPropresCount(key, setup)
                : condition.chanceParDebuffCible
                  ? resolvedDebuffsCibleCount(key, setup)
                  : 0;
              const chance = Math.min(
                condition.chanceMax ?? 100,
                (condition.chanceBase ?? 0) +
                  (condition.chanceParBuffPropre ?? condition.chanceParDebuffCible ?? 0) * compteChance
              );
              return (
                <div key={`condition-manuelle-${key}-${condition.libelle}`} className="space-y-1.5">
                  <PassifInterrupteur
                    actif={actif}
                    onChange={(v) => maj({ passifsOffensifs: { ...(setup.passifsOffensifs ?? {}), [key]: v } })}
                    icone={icone ? <img src={icone} alt="" className="h-4 w-4 rounded" loading="lazy" /> : undefined}
                    libelle={condition.coupsEnPlus ? `${condition.libelle} (${effet})` : `${nom} (${effet})`}
                    title={`${condition.libelle}${d.etat(actif)}`}
                  />
                  {(condition.chanceParBuffPropre || condition.chanceParDebuffCible) && (
                    <label className="flex flex-wrap items-center gap-2 pl-2">
                      <span className="text-xs text-ink-dim">
                        {d.condition.chance(!!condition.chanceParBuffPropre, chance)}
                      </span>
                      <NumberField
                        value={compteChance}
                        onChange={(v) => condition.chanceParBuffPropre
                          ? majBuffsPropres(key, v ?? 0)
                          : maj({ effetsCibleCount: { ...(setup.effetsCibleCount ?? {}), [key]: Math.max(0, (v ?? 0) - (setup.effetsCibleCountAutres === true ? Number(setup.defBreak) + Number(setup.brand) : 0)) } })}
                        min={0}
                        max={10}
                        step={1}
                        boxWidth="w-24"
                        ariaLabel={d.condition.chanceAria(!!condition.chanceParBuffPropre)}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          {conditionsAvecCle
            .filter(({ condition }) => condition.type === 'ignoreDefParStack' || condition.type === 'compteurMin')
            .map(({ condition, key }) => {
              if (condition.type !== 'ignoreDefParStack' && condition.type !== 'compteurMin') return null;
              return <label key={`condition-compteur-${key}-${condition.type}`} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-dim">{resumeCondition(condition, textes)}</span>
                <NumberField
                  value={condition.type === 'ignoreDefParStack'
                    ? setup.stackPersonnalise?.[key] ?? 0
                    : setup.compteurPersonnalise?.[key] ?? 0}
                  onChange={(v) => condition.type === 'ignoreDefParStack'
                    ? maj({ stackPersonnalise: { ...(setup.stackPersonnalise ?? {}), [key]: v ?? 0 } })
                    : maj({ compteurPersonnalise: { ...(setup.compteurPersonnalise ?? {}), [key]: v ?? 0 } })}
                  min={0}
                  max={condition.max}
                  step={1}
                  boxWidth="w-24"
                  ariaLabel={condition.label}
                />
              </label>;
            })}
          {/* Emergency Drive (Cynthia/Arcane Weapon) — bonus à bouton
              RESTREINT à CE SORT (« Rending Claw »), contrairement à
              `bonusDegatsConditionnel` qui majore le TOTAL quel que soit le
              sort choisi — voir `SkillDamageProfile.bonusConditionnelPropre`. */}
          {resolved.bonusConditionnelPropre && (
            <PassifInterrupteur
              actif={bonusConditionnelPropreActif(resolved, setup)}
              onChange={(v) => maj({ passifsOffensifs: { ...(setup.passifsOffensifs ?? {}), [resolved.skillCom2usId]: v } })}
              icone={resolved.icone ? <img src={resolved.icone} alt="" className="h-4 w-4 rounded" loading="lazy" /> : undefined}
              libelle={`${resolved.nom} (+${resolved.bonusConditionnelPropre.pct} %)`}
              title={`${resolved.bonusConditionnelPropre.condition}${d.etat(bonusConditionnelPropreActif(resolved, setup))}`}
            />
          )}
          {/* Pour un sort dont la formule lit `{Relative SPD}` (« Ta VIT −
              VIT cible / VIT cible ») — OU quand ce monstre force le
              critique s'il est plus rapide (`critSiPlusRapide`) OU majore
              tous ses dégâts selon l'écart de VIT (`bonusDegatsSelonVit`,
              Sonia), même si le sort CHOISI ne lit pas cette variable
              (ex. Rigna S1, ou n'importe quel sort de Sonia). */}
          {(utilise('Relative SPD') || utilise('Target SPD') || critSiPlusRapide || bonusDegatsSelonVit || demandeVitCible) && (
            <>
              <label className="flex items-center gap-2">
                <span className="text-xs text-ink-dim">{d.adversaire.vit}</span>
                <NumberField
                  value={setup.enemySpd ?? DEFAULT_DAMAGE_SETUP.enemySpd!}
                  onChange={(v) => maj({ enemySpd: v ?? 0 })}
                  step={10}
                  min={1}
                  boxWidth="w-32"
                  ariaLabel={d.adversaire.vitAria}
                />
              </label>
              {/* ⚠️ Pas de champ « Leader skill VIT » ici : généralisé au
                  contrôle unique de « Effets actifs » (`LeaderSkillPicker`,
                  demande explicite de l'utilisateur), qui couvre les 6
                  stats — PV/ATQ/DEF/VIT/Taux Crit/Dégâts Crit — plutôt qu'un
                  champ dédié à la seule VIT ici.
                  Pas de rappel de `critSiPlusRapide`/`bonusDegatsSelonVit`
                  non plus : ces deux modificateurs apparaissent maintenant
                  dans « Passifs offensifs » ci-dessus (icône + description),
                  plus complet qu'une ligne de texte — les dupliquer ferait
                  redite. */}
            </>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <p className="label">{d.effets.titre}</p>
          {/* ⚠️ Construite à partir de `effetsActifs`, la liste qui rend les
              vignettes juste en dessous : mêmes effets, mêmes descriptions,
              seulement ceux que ce sort affiche. Jamais un texte écrit à côté
              (voir `effetsActifs`). */}
          <HelpPopover title={d.effets.titre}>
            <p>{d.effets.aide}</p>
            <ul className="mt-1.5 space-y-1">
              {effetsActifs.map((e) => (
                <li key={e.cle}>
                  <b className="text-ink">{e.libelle}</b> — {e.description}
                </li>
              ))}
            </ul>
          </HelpPopover>
        </div>
        {/* ⚠️ L'ICÔNE est le contrôle — pas une icône décorative à côté
            d'une case à cocher. `choisi` porte le liseré + fond teinté de
            `Vignette`, complété d'une COCHE en médaillon (comme la palette
            de couleurs RTA) : sur des icônes déjà très colorées, le
            liseré/fond seuls se voient mal — la coche est le signal qui
            reste net quelle que soit la couleur dessous. */}
        {/* ⚠️ **Les buffs ATQ/DEF/VIT ne sont PAS ici** — ils sont dans
            « État de mon monstre » (EtatMonstre.tsx), toujours visible dans la
            carte Artéfacts. Raison : ils changent les statistiques du monstre,
            donc les dégâts supplémentaires bruts des artéfacts (218-221),
            affichés quel que soit l'objectif de recherche — alors que cette
            fenêtre-ci ne s'ouvre que pour « Dégâts réels ». Un joueur
            optimisant l'efficience les subissait sans pouvoir les régler.
            ⚠️ Ils étaient rendus SOUS CONDITION (`utilise('ATK')`, ou pour la
            VIT `utilise('SPD') || utilise('Relative SPD') || critSiPlusRapide
            || bonusDegatsSelonVit || critRateSelonVit`) : la bonne question
            tant qu'ils décrivaient un coup. Elle ne l'est plus — un buff
            change les stats du monstre même sans sort du tout — d'où un rendu
            inconditionnel à leur nouvelle place.
            ⚠️ Ce qui RESTE dans cette rangée ne touche pas aux dégâts bruts :
            Réduction de DEF et Marque décrivent la CIBLE, les six effets
            d'alliés sont des multiplicateurs de dégâts (voir 7798557 et
            e26118c). La coupe se vérifie donc, elle ne s'interprète pas. */}
        {/* `items-start` : la vignette au libellé sur deux lignes est plus
            haute que les autres, qui gardent la leur au lieu de s'étirer. */}
        <div className={`flex flex-wrap items-start ${etroit ? 'gap-1' : 'gap-1.5'}`}>
          {effetsActifs.map((e) => (
            <EffetVignette
              key={e.cle}
              icone={e.icone}
              libelle={e.libelle}
              description={e.description}
              onClick={e.basculer}
              actif={e.actif}
              etroit={etroit}
              deuxLignes={e.deuxLignes}
            />
          ))}
        </div>
        {/* Velaska (« Price of Pain ») a besoin d'une VALEUR en plus du
            toggle — l'app ne simule pas les PV réellement perdus par le
            monstre optimisé, contrairement aux quatre autres effets
            d'équipe (un simple oui/non suffit). Même discipline que le
            stack de Momo : un champ à part, 0 % par défaut. */}
        {/* ⚠️ **La place est RÉSERVÉE D'AVANCE, le champ n'apparaît pas.**
            Rendu sous condition, il poussait toute la rangée de vignettes vers
            le bas au moment même où on cliquait Velaska — un clic qui déplace
            ce qu'on vient de cliquer, interdit par docs/03-developpeur/interface/.
            Signalé à l'usage.
            La rangée existe donc en permanence et garde sa hauteur ; seul son
            CONTENU apparaît. `invisible` plutôt que `hidden` : l'élément
            occupe sa place mais sort de l'ordre de tabulation et des lecteurs
            d'écran (`aria-hidden`), sinon on tabulerait dans un champ qu'on ne
            voit pas. */}
        <div
          className={`mt-2 flex items-center gap-2 ${setup.velaskaActif ? '' : 'invisible'}`}
          aria-hidden={!setup.velaskaActif}
        >
          <span className="text-xs text-ink-dim">{d.effets.velaskaPv}</span>
          <NumberField
            value={setup.velaskaPvPerduPct ?? 0}
            onChange={(v) => maj({ velaskaPvPerduPct: v ?? 0 })}
            min={0}
            max={100}
            suffix="%"
            boxWidth="w-24"
            disabled={!setup.velaskaActif}
            title={d.effets.velaskaPvAide}
            ariaLabel={d.effets.velaskaPvAria}
          />
        </div>
        {/* ⚠️ Le choix du leader skill est parti dans « État de mon monstre »
            (EtatMonstre.tsx) avec les buffs, et pour la même raison : il
            modifie une statistique du monstre. */}
      </div>

      {/* ⚠️ « Compétences d'invocateur » est partie ENTIÈRE dans « État de mon
          monstre » (EtatMonstre.tsx) : elle majore les statistiques de base du
          monstre, elle ne décrit pas le combat. Elle valait `'normal'` par
          défaut — donc le calcul des dégâts d'artéfact la supposait déjà, sans
          que rien ne le dise à qui n'ouvrait jamais cette carte. */}

      {montreCrit && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <p className="label">{d.critique.titre}</p>
          </div>
          <Segmented<CritMode>
            options={CRIT_MODES.map((key) => ({
              key,
              label: d.critModes[key],
              disabled: critiqueForceParReglage && key !== 'crit',
            }))}
            value={critiqueForceParReglage ? 'crit' : setup.critMode}
            onChange={(v) => maj({ critMode: v })}
            size="lg"
          />
          {critiqueForceParReglage && (
            <p className="mt-1.5 text-xs text-ink-dim">
              {d.critique.force}
            </p>
          )}
          {/* L'ancien mode « Moyenne » et son avertissement « purement
              théorique » sont supprimés : une recette
              qui le porte est convertie en « Critique » à l'import, et le
              message d'import le dit. */}
        </div>
      )}
      {critInterdit && (
        <p className="text-xs text-ink-dim">
          {d.critique.interdit}
        </p>
      )}
    </div>
  );
}

// Un effet de combat = une icône de jeu cliquable, choisie/non choisie.
//
// ⚠️ **La seule PRÉSENCE d'une icône ne dit rien de son état** — signalé par
// l'utilisateur sur capture d'écran : avant tout clic, rien ne distingue
// « ce buff est actif » de « voici les buffs qu'on peut activer ». Le liseré
// + fond teinté de `Vignette` ne suffit pas non plus sur une icône déjà très
// colorée (le PNG du jeu, pas un aplat neutre comme un portrait). Deux
// signaux cumulés, tous deux DÉJÀ établis ailleurs dans l'app plutôt
// qu'inventés ici :
//  - **L'icône elle-même change d'apparence** — grisée (`grayscale`) au
//    repos, en couleurs pleines une fois activée. Même patron qu'un
//    emplacement d'artéfact vide (`ArtifactSlots.tsx`, icône grisée +
//    pictogramme « interdit ») : l'état se lit sur l'icône, pas seulement
//    sur un cadre autour.
//  - **Coche en médaillon** une fois activée, même patron que la palette de
//    couleurs de catégorie RTA (`CategoryBar.tsx`) : un signal net,
//    indépendant de la couleur de l'icône en dessous. Sans `teinte` propre à
//    l'effet (contrairement à une catégorie) : le médaillon reprend
//    directement l'accent de l'app (`bg-accent`).
// Résultat : à l'ouverture du panneau, TOUT est grisé — on voit d'un coup
// d'œil qu'aucun effet n'est encore choisi, sans avoir à cliquer pour
// comprendre la légende.
// Le bouton d'un passif `bonus`/`conditionnel` (Dominic, Ezio, Evan…) ou
// d'un modificateur conditionnel sans formule propre (Jin Kazama, Cyborg,
// Astar, Jean…) — un INTERRUPTEUR (`Interrupteur`, même composant que
// « Stats de base exclues », Critères de recherche), pas une `Pastille`.
//
// ⚠️ **Signalé par l'utilisateur : cliquer sur la DESCRIPTION du passif ne
// faisait rien** — la `Pastille` précédente (une pilule cliquable) portait
// l'icône ET le libellé comme SEULE cible de clic, sans lien visuel évident
// avec le paragraphe de condition juste en dessous. `Interrupteur` porte sa
// propre glissière (état visible sans avoir à cliquer pour le découvrir,
// `role="switch"`/`aria-checked`) — plus proche, dans l'esprit du composant
// lui-même (voir Interrupteur.tsx), d'un réglage SEUL avec une phrase à
// côté que d'une rangée de pastilles de filtre.
function PassifInterrupteur({
  icone,
  libelle,
  actif,
  onChange,
  title,
}: {
  icone: ReactNode;
  libelle: string;
  actif: boolean;
  onChange: (actif: boolean) => void;
  title?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icone}
      <Interrupteur actif={actif} onChange={onChange} libelle={libelle} title={title} aria-label={libelle} />
    </div>
  );
}
