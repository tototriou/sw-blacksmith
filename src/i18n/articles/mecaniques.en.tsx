import { F, Fort, K, Liste, type ArticleMecaniques } from '../../components/mecaniques/blocs';
import { NOM_APP } from '../../marque';

// L'article « Mécaniques du jeu » en ANGLAIS, traduit de mecaniques.fr.tsx :
// mêmes sections, même ordre, mêmes `id`. Les mots du jeu sont ses noms
// anglais (SWARFARM) : Swift, CRI Rate, CRI Dmg, Glancing Hit.

export const mecaniquesEn: ArticleMecaniques = {
  titre: 'Game mechanics',
  intro: (
    <>
      The formulas behind Summoners War: speed and turn order, and the full damage equation. These
      are <Fort>community models</Fort> (predictive, not the game’s code) — very accurate but
      indicative.
    </>
  ),
  sommaire: 'Contents',
  sections: [
    {
      id: 'vitesse',
      titre: 'Combat speed',
      contenu: (
        <>
          <p>
            A monster’s effective speed in combat is computed from its base speed, percentage
            bonuses (additive with each other) and flat bonuses:
          </p>
          <F>{'Speed = ⌈ Base × (1 + Σ%speed) + Σflat_speed ⌉ × Slow × SpdBuff'}</F>
          <Liste>
            <li>
              <K>Σ%speed</K> = guild totem (+15%) + leader + other % effects (additive).
            </li>
            <li>
              <K>Σflat_speed</K> = rune speed (+ artifacts / other flat bonuses).
            </li>
            <li>
              <K>SpdBuff</K>: attack speed buff = <K>⌊30 × (1 + effect/100)⌋</K>% (the strength is
              rounded down), applied as <K>× (1 + buff%/100)</K>.
            </li>
            <li>
              <K>Slow</K> = 0.7 if the monster is slowed, otherwise 1.
            </li>
            <li>
              <K>Swift correction</K>: with a Swift set equipped, the fractional part lost when
              rounding <K>Base × 0.25</K> is subtracted from the flat speed bonus (so the gain
              already captured by rounding is not counted twice).
            </li>
          </Liste>
          <F>{'frac = (Base × 0.25) mod 1\ncorrection = frac > 0 ? (1 − frac) : 0   (only with Swift)\neffective Σflat_speed = Σflat_speed − correction'}</F>
          <p className="text-sm">
            Speed depends neither on level nor on stars: it is fixed per monster.
          </p>
        </>
      ),
    },
    {
      id: 'atb',
      titre: 'Attack bar & turn order',
      contenu: (
        <>
          <p>
            On each clock “tick”, every monster’s attack bar (ATB) rises by{' '}
            <Fort>7% of its combat speed</Fort>:
          </p>
          <F>{'ΔATB per tick = Combat_speed × 7 / 100'}</F>
          <Liste>
            <li>The 7% applies everywhere, except in raids (4.5%) and in RTA (1.5%).</li>
            <li>A monster acts as soon as its attack bar reaches 100.</li>
            <li>When bars are tied, the fastest goes first; at equal speed, the order follows the placement sequence.</li>
            <li>
              The higher the speed, the faster the bar fills → that is the whole logic of “speed
              tuning”: reaching a precise <Fort>tick</Fort> to move before/after a target.
            </li>
          </Liste>
        </>
      ),
    },
    {
      id: 'degats',
      titre: 'Final damage equation',
      contenu: (
        <>
          <p>The full calculation order of a hit:</p>
          <F>{'Damage = ( Mult × Crit × DMG% × DefFactor × Variance + Additional ) × Reductions'}</F>
          <Liste aere>
            <li>
              <Fort>Mult</Fort> — base scaling: Σ (stat × skill multiplier) on ATK / DEF / HP / SPD.
              Buffs multiply the stat (ATK ×1.5; DEF ×1.7), with the same rounding as{' '}
              <K>SpdBuff</K> applied to their strength (base 50% ATK / 70% DEF, rounded down
              according to the effect bonus):
              <F>{'buff_effect = ⌊ base% × (1 + effect_bonus/100) ⌋      e.g. +11% effect on ATK (50%) → ⌊55.5⌋ = 55%'}</F>
            </li>
            <li>
              <Fort>Crit</Fort> — critical damage term (see below):
              <F>{'Crit = 1 + skillups + CRIdmg_runes + CRIdmg_arti + bonus − CRIdmg_taken'}</F>
            </li>
            <li>
              <Fort>DMG%</Fort> — multiplicative bonus:
              <F>{'DMG% = 1 + element_damage(arti) + co-op + others'}</F>
            </li>
            <li>
              <Fort>DefFactor</Fort> — mitigation by defense (see the dedicated section).
            </li>
            <li>
              <Fort>Variance</Fort> — per-hit randomness (see the dedicated section).
            </li>
            <li>
              <Fort>Additional</Fort> — flat damage / damage as a % of a stat. Flat damage follows
              DMG% but <Fort>cannot crit nor go through DefFactor</Fort>; <K>add_stat</K> (% of
              final ATK/DEF/HP/SPD) follows neither DMG% nor crit:
              <F>{'Additional = Σ [ stat × flat × (1 + DMG%) + stat × add_stat ]'}</F>
            </li>
            <li>
              <Fort>Reductions</Fort> — at the very end: additive reductions (artifacts, passives,
              − Mirinae/Branding) then multiplicative ones (reflect, Camilla S3…). Reduction passives{' '}
              <Fort>do not stack</Fort> (only the strongest applies).
            </li>
          </Liste>
        </>
      ),
    },
    {
      id: 'defense',
      titre: 'Defense factor',
      contenu: (
        <>
          <p>The target’s defense reduces damage as follows:</p>
          <F>{'DefFactor = 1000 / (1142 + 3.572 × DEF)'}</F>
          <F>{'DEF = Defense × (1 − Ignore%) × Dbreak      Dbreak = 0.3 if defense break, otherwise 1'}</F>
          <Liste>
            <li>Ignore defense lowers effective DEF but does not remove the formula’s floor.</li>
            <li>At DEF = 0, the factor is ~0.876 (not 1.0) — even without defense, a slight mitigation remains.</li>
          </Liste>
        </>
      ),
    },
    {
      id: 'crit',
      titre: 'Critical hits',
      contenu: (
        <>
          <p>
            A critical hit multiplies damage by the <K>Crit</K> term. Crit rate (chance) and crit
            damage (multiplier) are two different things:
          </p>
          <Liste>
            <li><Fort>CRI Rate</Fort>: probability of triggering a crit (base + runes + leader + buffs).</li>
            <li>
              <Fort>CRI Dmg</Fort>: additive sum of every source (skillups, runes, artifacts,
              bonuses) minus the crit damage taken reductions of the target.
            </li>
            <li>A <Fort>glancing</Fort> hit (see element) cannot be critical.</li>
            <li>
              Some artifact lines have a limited reach: “CRI Dmg at good/bad HP” is always active;
              “CRI Dmg [Skill 1/2/3]” only applies to that skill; “CRI Dmg on first attack” only
              applies to the main target (the rest of an AoE still benefits); “CRI Dmg against a
              single target” stays active the whole turn.
            </li>
          </Liste>
        </>
      ),
    },
    {
      id: 'variance',
      titre: 'Variance',
      contenu: (
        <>
          <p>Each hit applies a random factor (triangular distribution), independent per “bucket”:</p>
          <F>{'Scaling on stats: ±2.8%   → [0.972 , 1.028]'}</F>
          <F>{'Scaling on max HP: ±2.35%  → [0.9765 , 1.0235]'}</F>
          <p>
            Drawn from a triangular distribution (two uniform draws combined — more weight in the
            middle than at the edges, unlike a flat uniform law):
          </p>
          <F>{'factor = 1 + (rand() + rand() − 1) × amplitude      amplitude = 0.028 (stats) or 0.0235 (max HP)'}</F>
        </>
      ),
    },
    {
      id: 'specifiques',
      titre: 'Special cases',
      contenu: (
        <>
          <p>Many monsters have their own mechanics tied to speed or defense, for example:</p>
          <Liste>
            <li>Ignore defense depending on a speed gap (Rigna, Birgitta, Tirsa, Agrius…).</li>
            <li>Speed threshold bonuses (Sonia at +50, Leah at +150…).</li>
            <li>Stat stealing based on a base stat and “knowledge” (Herteit S3).</li>
          </Liste>
          <p className="text-sm">
            {`These effects are not modeled in ${NOM_APP} (which focuses on speed, ticks and runes).`}
          </p>
        </>
      ),
    },
  ],
};
