import { F, Fort, K, Liste, type ArticleMecaniques } from '../../components/mecaniques/blocs';
import { NOM_APP } from '../../marque';

// L'article « Mécaniques du jeu » en FRANÇAIS — la version source.
// ⚠️ **Un article par langue** (décision de l'utilisateur) : un texte suivi,
// avec ses formules et ses termes mis en avant, se traduit d'un trait. Chaque
// version garde les mêmes sections, dans le même ordre, avec les mêmes `id`
// (test : `testRenduMecaniquesLangues`). Les formules restent celles des
// modèles communautaires (swcalc.cz, swarfarm) : valeurs prédictives, pas le
// code source du jeu.

export const mecaniquesFr: ArticleMecaniques = {
  titre: 'Mécaniques du jeu',
  intro: (
    <>
      Les formules qui régissent Summoners War : vitesse et ordre de tour, et l&apos;équation
      complète des dégâts. Ce sont des <Fort>modèles communautaires</Fort> (prédictifs, pas le
      code du jeu) — très précis mais indicatifs.
    </>
  ),
  sommaire: 'Sommaire',
  sections: [
    {
      id: 'vitesse',
      titre: 'Vitesse de combat',
      contenu: (
        <>
          <p>
            La vitesse effective d&apos;un monstre en combat se calcule à partir de sa vitesse de
            base, des bonus en pourcentage (additifs entre eux) et des bonus plats :
          </p>
          <F>{'Vitesse = ⌈ Base × (1 + Σ%vitesse) + Σvitesse_plate ⌉ × Slow × BuffVit'}</F>
          <Liste>
            <li>
              <K>Σ%vitesse</K> = totem de guilde (+15 %) + lead + autres effets % (additifs).
            </li>
            <li>
              <K>Σvitesse_plate</K> = vitesse des runes (+ artefacts / autres bonus plats).
            </li>
            <li>
              <K>BuffVit</K> : buff de vitesse d&apos;attaque = <K>⌊30 × (1 + effet/100)⌋</K> % (la
              potence est tronquée vers le bas), appliqué en <K>× (1 + buff%/100)</K>.
            </li>
            <li>
              <K>Slow</K> = 0,7 si le monstre est ralenti, sinon 1.
            </li>
            <li>
              <K>Correction Rapide</K> : avec un set Rapide équipé, la part fractionnaire perdue à
              l&apos;arrondi de <K>Base × 0,25</K> est retranchée du bonus plat de vitesse (évite de
              compter deux fois le gain déjà capté par l&apos;arrondi).
            </li>
          </Liste>
          <F>{'frac = (Base × 0,25) mod 1\ncorrection = frac > 0 ? (1 − frac) : 0   (uniquement si Rapide)\nΣvitesse_plate effectif = Σvitesse_plate − correction'}</F>
          <p className="text-sm">
            La vitesse ne dépend pas du niveau ni des étoiles : elle est fixe par monstre.
          </p>
        </>
      ),
    },
    {
      id: 'atb',
      titre: 'Barre d’action & ordre de tour',
      contenu: (
        <>
          <p>
            À chaque « tick » d&apos;horloge, la barre d&apos;action (ATB) de chaque monstre monte
            de <Fort>7 % de sa vitesse de combat</Fort> :
          </p>
          <F>{'ΔATB par tick = Vitesse_combat × 7 / 100'}</F>
          <Liste>
            <li>Les 7 % valent partout, sauf en raid (4,5 %) et en RTA (1,5 %).</li>
            <li>Un monstre agit dès que sa barre d&apos;action atteint 100.</li>
            <li>En cas d&apos;égalité de barre, le plus rapide passe ; à vitesse égale, l&apos;ordre suit la séquence de placement.</li>
            <li>
              Plus la vitesse est haute, plus la barre se remplit vite → c&apos;est toute la logique
              du « speed tuning » : atteindre un <Fort>tick</Fort> précis pour passer avant/après une
              cible.
            </li>
          </Liste>
        </>
      ),
    },
    {
      id: 'degats',
      titre: 'Équation finale des dégâts',
      contenu: (
        <>
          <p>L&apos;ordre de calcul complet d&apos;un coup :</p>
          <F>{'Dégâts = ( Mult × Crit × DMG% × FacteurDéf × Variance + Additionnel ) × Réductions'}</F>
          <Liste aere>
            <li>
              <Fort>Mult</Fort> — mise à l&apos;échelle de base : Σ (stat × coefficient de la
              compétence) sur ATQ / DEF / PV / VIT. Les buffs multiplient la stat (ATQ ×1,5 ; DEF
              ×1,7), avec la même troncature que <K>BuffVit</K> appliquée à leur potence (base 50 %
              ATQ / 70 % DEF, tronquée vers le bas selon le bonus d&apos;effet) :
              <F>{'effet_buff = ⌊ base% × (1 + bonus_effet/100) ⌋      ex. +11 % d’effet sur ATQ (50 %) → ⌊55,5⌋ = 55 %'}</F>
            </li>
            <li>
              <Fort>Crit</Fort> — terme de dégâts critiques (voir plus bas) :
              <F>{'Crit = 1 + skillups + DMGcrit_runes + DMGcrit_arti + bonus − DMGcrit_subie'}</F>
            </li>
            <li>
              <Fort>DMG%</Fort> — bonus multiplicatif :
              <F>{'DMG% = 1 + dégâts_élément(arti) + co-op + autres'}</F>
            </li>
            <li>
              <Fort>FacteurDéf</Fort> — mitigation par la défense (voir section dédiée).
            </li>
            <li>
              <Fort>Variance</Fort> — aléa par coup (voir section dédiée).
            </li>
            <li>
              <Fort>Additionnel</Fort> — dégâts fixes / dégâts en % d&apos;une stat. Les dégâts fixes
              suivent DMG% mais <Fort>ne peuvent pas crit ni passer par FacteurDéf</Fort> ; les{' '}
              <K>add_stat</K> (% d&apos;ATQ/DEF/PV/VIT finaux) ne suivent ni DMG% ni crit :
              <F>{'Additionnel = Σ [ stat × fixe × (1 + DMG%) + stat × add_stat ]'}</F>
            </li>
            <li>
              <Fort>Réductions</Fort> — en toute fin : réductions additives (artefacts, passifs, −
              Mirinae/Branding) puis multiplicatives (reflect, Camilla S3…). Les passifs de réduction{' '}
              <Fort>ne se cumulent pas</Fort> (seul le plus fort s&apos;applique).
            </li>
          </Liste>
        </>
      ),
    },
    {
      id: 'defense',
      titre: 'Facteur de défense',
      contenu: (
        <>
          <p>La défense de la cible réduit les dégâts selon :</p>
          <F>{'FacteurDéf = 1000 / (1142 + 3.572 × DEF)'}</F>
          <F>{'DEF = Défense × (1 − Ignore%) × Dbreak      Dbreak = 0.3 si def break, sinon 1'}</F>
          <Liste>
            <li>L&apos;ignore défense réduit la DEF effective mais n&apos;annule pas le plancher de la formule.</li>
            <li>À DEF = 0, le facteur vaut ~0,876 (pas 1,0) — même sans défense, il reste une légère mitigation.</li>
          </Liste>
        </>
      ),
    },
    {
      id: 'crit',
      titre: 'Coups critiques',
      contenu: (
        <>
          <p>
            Un coup critique multiplie les dégâts par le terme <K>Crit</K>. Le taux de crit (chance)
            et les dégâts crit (multiplicateur) sont deux choses distinctes :
          </p>
          <Liste>
            <li><Fort>Taux crit</Fort> : probabilité de déclencher un crit (base + runes + lead + buffs).</li>
            <li>
              <Fort>Dégâts crit</Fort> : somme additive de toutes les sources (skillups, runes,
              artefacts, bonus) moins les dégâts crit encaissés réduits par la cible.
            </li>
            <li>Un coup <Fort>glancing</Fort> (voir élément) ne peut pas être critique.</li>
            <li>
              Certaines lignes d&apos;artefact ont une portée limitée : « CD santé haute/basse » reste
              toujours actif ; « CD Compétence 1/2/3 » ne s&apos;applique qu&apos;à cette compétence ;
              « CD 1<sup>re</sup> attaque » ne s&apos;applique qu&apos;à la cible principale (le reste
              d&apos;une AoE en bénéficie quand même) ; « CD propre à 1 cible » reste actif tout le tour.
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
          <p>Chaque coup applique un aléa (distribution triangulaire), indépendant par « bucket » :</p>
          <F>{'Mise à l’échelle sur stats : ±2.8 %   → [0.972 , 1.028]'}</F>
          <F>{'Mise à l’échelle sur PV max : ±2.35 %  → [0.9765 , 1.0235]'}</F>
          <p>
            Tirage par distribution triangulaire (deux tirages uniformes combinés — plus de densité
            au centre qu&apos;aux bornes, contrairement à une loi uniforme plate) :
          </p>
          <F>{'facteur = 1 + (rand() + rand() − 1) × amplitude      amplitude = 0,028 (stats) ou 0,0235 (PV max)'}</F>
        </>
      ),
    },
    {
      id: 'specifiques',
      titre: 'Cas particuliers',
      contenu: (
        <>
          <p>
            Beaucoup de monstres ont des mécaniques propres liées à la vitesse ou à la défense, par ex. :
          </p>
          <Liste>
            <li>Ignore défense conditionné à un écart de vitesse (Rigna, Birgitta, Tirsa, Agrius…).</li>
            <li>Bonus paliers de vitesse (Sonia à +50, Leah à +150…).</li>
            <li>Vol de stats basé sur une stat de base et la « knowledge » (Herteit S3).</li>
          </Liste>
          <p className="text-sm">
            {`Ces effets ne sont pas modélisés dans ${NOM_APP} (qui se concentre sur la vitesse, les ticks et les runes).`}
          </p>
        </>
      ),
    },
  ],
};
