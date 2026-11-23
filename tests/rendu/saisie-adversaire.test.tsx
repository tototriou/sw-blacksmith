// Tests de rendu — la saisie de l'adversaire en parties de la fenêtre
// « Dégâts réels » (SaisieAdversaire.tsx, dans DamageSetupCard.tsx).
//
// Spec : docs/02-app/optimizer/ecran/objectif-de-recherche.md, « Dégâts
// réels — adversaire ». Le geste (import, saisie) n'est pas simulable au rendu
// serveur : ce qu'il écrit est vérifié par le calcul (saisie-adversaire.test.ts),
// et son branchement dans l'écran sur la source.

import { readFileSync } from 'node:fs';
import DamageSetupCard from '../../src/components/outils/DamageSetupCard';
import { DEFAULT_DAMAGE_SETUP, monsterDamageSkills, resolveDamageSkill, type DamageSetup } from '../../src/lib/damage';
import { avecLeadAdversaire, avecTotauxAdversaire, importerMonstreAdversaire } from '../../src/lib/saisieAdversaire';
import { loadMonsterSkills } from '../../scripts/lib/skillsData';
import { setChoixLangue } from '../../src/hooks/useLangue';
import type { Monster } from '../../src/types';
import { egal, ok, titre } from '../outils';
import { rendre, texteVisible } from './outils-rendu';

const CASSIE = 19315;
const DEVILS_BULLET = 10115; // S3, lit la DEF de la cible
const MONSTRES: Monster[] = JSON.parse(readFileSync('public/data/monsters.json', 'utf8')).monsters;
const CHASUN = MONSTRES.find((m) => m.name === 'Chasun' && m.element === 'wind' && m.obtainable !== false)!;

function carte(etroit: boolean, setup: Partial<DamageSetup> = {}): string {
  const sorts = monsterDamageSkills(loadMonsterSkills(CASSIE));
  const skill = sorts.find((s) => s.skillCom2usId === DEVILS_BULLET) ? DEVILS_BULLET : sorts[sorts.length - 1].skillCom2usId;
  const resolved = resolveDamageSkill(sorts, skill);
  return rendre(
    <DamageSetupCard
      skills={sorts}
      resolved={resolved}
      passifs={[]}
      modificateursVit={[]}
      setup={{ ...DEFAULT_DAMAGE_SETUP, skillCom2usId: skill, ...setup }}
      setSetup={() => {}}
      monstres={MONSTRES}
      chargement={false}
      etroit={etroit}
      critSiPlusRapide={false}
      bonusDegatsSelonVit={null}
      bonusDegatsStack={null}
      critRateSelonVit={null}
      bonusDegatsConditionnel={null}
      bonusParEffetCibleMonstre={null}
      bonusParEffetPropre={null}
      bonusSacrifice={null}
      conditionsCombatMonstre={[]}
      combatStats={[]}
      seuilsPassifEivor={null}
      elementAttaquant={null}
      critInterdit={false}
    />
  );
}

// Chasun importée, runes PV 12 450, lead PV 33 %, comme le setter de l'écran l'écrit.
function avecChasun(): DamageSetup {
  let s = avecTotauxAdversaire({ ...DEFAULT_DAMAGE_SETUP, ...importerMonstreAdversaire(DEFAULT_DAMAGE_SETUP, CHASUN) });
  s = avecTotauxAdversaire({ ...s, adversaire: { ...s.adversaire!, runes: { ...s.adversaire!.runes, hp: 12_450 } } });
  return avecTotauxAdversaire({ ...s, ...avecLeadAdversaire(s, { stat: 'HP', pct: 33 }) });
}

const lignes = (html: string) => [...html.matchAll(/data-stat-adversaire="(\w+)"/g)].map((m) => m[1]);
const total = (html: string, stat: string) => texteVisible(html.match(new RegExp(`aria-label="Total ${stat} de l&#x27;adversaire"[^>]*>([^<]*)<`))?.[1] ?? '');

export function testRenduSaisieAdversaire() {
  titre('rendu · saisie de l’adversaire en parties');
  for (const etroit of [false, true]) {
    const format = etroit ? 'téléphone' : 'ordinateur';
    const vide = carte(etroit);
    egal(lignes(vide), ['hp', 'def'], `${format} : Devil’s Bullet lit la DEF — lignes PV et DEF, ni ATQ ni VIT`);
    ok(vide.includes('aria-label="Type du leader skill adverse"') && vide.includes('aria-label="Importer les stats de base d&#x27;un monstre adverse"'),
      `${format} : le lead et la recherche de monstre`);
    ok(vide.includes('aria-label="PV de base de l&#x27;adversaire"') && vide.includes('aria-label="Bonus de runes en DEF de l&#x27;adversaire"'),
      `${format} : un champ de base et un champ de runes par stat`);
    egal(total(vide, 'PV').replace(/\s/g, ''), '40000', `${format} : sans saisie, le total est l’ancien PV écrit (40 000)`);
    const cols = texteVisible(vide);
    ok(cols.includes('Base') && cols.includes('Runes') && cols.includes('Total'), `${format} : colonnes Base, Runes, Total`);
    ok(cols.includes('Invoc.') !== etroit, `${format} : colonne Invoc. ${etroit ? 'absente' : 'présente'}`);
    ok(texteVisible(vide).includes("Compétences d'invocateur (Contenu normal, comme ton monstre)"), `${format} : la phrase dit les compétences d’invocateur appliquées`);

    const plein = carte(etroit, avecChasun());
    ok(plein.includes('unit_icon_0029_2_3.png'), `${format} : le portrait du monstre importé`);
    ok(texteVisible(plein).includes('Chasun') === !etroit, `${format} : son nom ${etroit ? 'masqué (portrait seul)' : 'affiché'}`);
    egal(total(plein, 'PV').replace(/\s/g, ''), String(Math.round(11_040 * 1.53 + 12_450)), `${format} : total PV = base + runes + lead + invocateur`);
    ok(plein.includes('aria-label="Valeur du leader skill adverse"'), `${format} : le menu de valeur du lead choisi`);
    ok(texteVisible(plein).includes('(élément compris)'), `${format} : l’élément du monstre importé compte pour l’ATQ`);
  }

  // Une condition qui lit l'ATQ ouvre sa ligne : vérifié sur la source (le
  // monstre de rendu n'en a pas), comme pour la VIT.
  const source = readFileSync('src/components/outils/DamageSetupCard.tsx', 'utf8');
  ok(source.includes("...(demandeAtkCible ? (['atk'] as const) : []),") && source.includes("? (['spd'] as const)"),
    'écran : ATQ et VIT selon le sort, comme avant');
}

export function testRenduSaisieAdversaireAnglais() {
  titre('rendu · saisie de l’adversaire — en anglais');
  setChoixLangue('en');
  try {
    const html = carte(false, avecChasun());
    const texte = texteVisible(html);
    ok(texte.includes('Summ.') && texte.includes('Runes') && texte.includes('Monster'), 'les colonnes et libellés en anglais');
    ok(texte.includes('Summoner skills (Normal content, same as your monster)'), 'la phrase des compétences d’invocateur en anglais');
    ok(!/Invoc\.|Compétences d'invocateur|Importer un monstre/.test(texte), 'aucun texte français resté');
  } finally {
    setChoixLangue('auto');
  }
}

export function testSaisieAdversaireBranchement() {
  titre('Saisie de l’adversaire — branchement dans l’écran');
  const section = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
  ok(section.includes('monstres={allMonsters}'), 'la fenêtre reçoit tous les monstres (SWARFARM et perso) pour la recherche');
  const etat = readFileSync('src/hooks/useOptimizerState.ts', 'utf8');
  ok(/setDamageSetup: \(valeur\) => saisie\('damageSetup', setDamageSetup\)\(\(prec\) =>\s*avecTotauxAdversaire\(/.test(etat),
    'le setter de l’écran repasse chaque écriture par avecTotauxAdversaire');
}
