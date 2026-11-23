import { LEADER_SKILL_VALEURS, summonerSkillBonus, type DamageSetup, type LeaderSkillStat } from '../../lib/damage';
import {
  STATS_LEAD_ADVERSAIRE,
  avecLeadAdversaire,
  avecValeurAdversaire,
  detailAdversaire,
  importerMonstreAdversaire,
  saisieAdversaireDe,
  type StatAdversaire,
} from '../../lib/saisieAdversaire';
import type { Monster } from '../../types';
import { leadIconUrl, nomStatLead } from '../siege/LeadPill';
import MonsterPicker from '../MonsterPicker';
import MonsterAvatar from '../MonsterAvatar';
import { NumberField, Selecteur } from '../../ui';
import { useTraduction } from '../../hooks/useLangue';
import { formatNombre } from '../../i18n/format';

// Saisie de l'adversaire en parties (fenêtre « Dégâts réels ») : une ligne
// « lead + monstre », puis un tableau stats × Base | Runes | Lead | Invoc. |
// Total. Le calcul est dans saisieAdversaire.ts ; ce composant n'écrit que la
// saisie, les totaux suivent par le setter de l'écran (`avecTotauxAdversaire`).
//
// ⚠️ **Au téléphone, les colonnes Lead et Invoc. disparaissent** — leur part
// reste comptée dans le total, et la phrase sous le tableau dit ce qui est
// appliqué. Cinq colonnes ne tiennent pas dans 360 px avec deux champs
// saisissables ; les champs y perdent aussi leurs boutons − / +.
//
// ⚠️ **Toutes les places sont tenues d'avance** (« un clic ne déplace jamais ce
// qu'on vient de cliquer ») : l'icône du lead, son menu de valeur, le portrait
// et le nom du monstre existent même vides.
export default function SaisieAdversaire({
  setup,
  maj,
  stats,
  etroit,
  monstres,
}: {
  setup: DamageSetup;
  maj: (patch: Partial<DamageSetup>) => void;
  // Les stats que le sort choisi lit — toujours dans l'ordre PV, DEF, ATQ, VIT.
  stats: StatAdversaire[];
  etroit: boolean;
  monstres: Monster[];
}) {
  const textes = useTraduction();
  const jeu = textes.jeu;
  const a = textes.degats.adversaire;
  const saisie = saisieAdversaireDe(setup);
  const element = setup.enemyElement ?? null;
  const detail = detailAdversaire(saisie, setup.summonerSkills, element);
  const invoc = summonerSkillBonus(setup.summonerSkills, element);
  const monstre = saisie.monstreId ? monstres.find((m) => String(m.id) === saisie.monstreId) ?? null : null;
  const lead = saisie.lead;
  const icone = lead ? leadIconUrl({ stat: lead.stat, amount: lead.pct, area: 'General', element: null }) : null;
  const fmt = (n: number) => formatNombre(Math.round(n), textes.codeLangue);
  const part = (n: number) => (n > 0 ? `+${fmt(n)}` : '—');
  const cellule = etroit ? 'px-1 py-1.5' : 'px-2 py-1.5';
  const largeurChamp = etroit ? 'w-[4.25rem]' : 'w-32';

  const choixLead = (
    <div className="flex items-center gap-2">
      <img src={icone ?? undefined} alt="" className={`h-6 w-6 flex-none ${icone ? '' : 'invisible'}`} loading="lazy" aria-hidden />
      <Selecteur
        value={lead?.stat ?? ''}
        onChange={(e) => {
          const stat = e.target.value as LeaderSkillStat | '';
          maj(avecLeadAdversaire(setup, stat ? { stat } : null));
        }}
        taille="sm"
        aria-label={a.leadType}
      >
        <option value="">{a.aucunLead}</option>
        {STATS_LEAD_ADVERSAIRE.map((stat) => (
          <option key={stat} value={stat}>
            {nomStatLead(jeu, stat)}
          </option>
        ))}
      </Selecteur>
      <div className={`w-20 flex-none ${lead ? '' : 'invisible'}`} aria-hidden={!lead}>
        {lead ? (
          // Remonté au changement de type : la liste des paliers change avec lui.
          <Selecteur
            key={lead.stat}
            pleineLargeur
            value={String(lead.pct)}
            onChange={(e) => maj(avecLeadAdversaire(setup, { stat: lead.stat, pct: Number(e.target.value) }))}
            taille="sm"
            aria-label={a.leadValeur}
          >
            {LEADER_SKILL_VALEURS[lead.stat].map((v) => (
              <option key={v} value={v}>
                {v} %
              </option>
            ))}
            {!LEADER_SKILL_VALEURS[lead.stat].includes(lead.pct) && <option value={lead.pct}>{lead.pct} %</option>}
          </Selecteur>
        ) : (
          // Figurant : tient la hauteur tant qu'aucun lead n'est choisi.
          <Selecteur pleineLargeur value="" onChange={() => {}} taille="sm" disabled aria-hidden tabIndex={-1}>
            <option value="">—</option>
          </Selecteur>
        )}
      </div>
    </div>
  );

  return (
    <div data-saisie-adversaire>
      <div className={etroit ? 'flex flex-col gap-2' : 'flex flex-wrap items-center gap-x-6 gap-y-2'}>
        <div className="flex items-center gap-2">
          <span className="w-16 flex-none text-xs text-ink-dim">{a.lead}</span>
          {choixLead}
        </div>
        <div className={`flex min-w-0 items-center gap-2 ${etroit ? '' : 'w-[28rem]'}`}>
          <span className="w-16 flex-none text-xs text-ink-dim">{a.monstre}</span>
          {monstre ? (
            <MonsterAvatar monster={monstre} size={30} />
          ) : (
            <span className="h-[30px] w-[30px] flex-none rounded-md border border-dashed border-border" aria-hidden />
          )}
          {!etroit && <span className="w-28 flex-none truncate text-sm text-ink">{monstre?.name ?? ''}</span>}
          <div className="min-w-0 flex-1">
            <MonsterPicker
              monsters={monstres}
              onPick={(id) => {
                const m = monstres.find((x) => String(x.id) === id);
                if (m) maj(importerMonstreAdversaire(setup, m));
              }}
              placeholder={a.importer}
              ariaLabel={a.importerAria}
            />
          </div>
        </div>
      </div>
      <div className={`mt-3 overflow-hidden rounded-md border border-border ${etroit ? '' : 'w-fit'}`}>
        <table className="w-full text-sm">
          <thead className="bg-panel2 text-micro uppercase tracking-wider text-ink-dim">
            <tr>
              <th className={cellule} />
              <th className={`${cellule} text-left font-semibold`}>{a.colonnes.base}</th>
              <th className={`${cellule} text-left font-semibold`}>{a.colonnes.runes}</th>
              {!etroit && <th className={`${cellule} w-24 text-right font-semibold`}>{a.colonnes.lead}</th>}
              {!etroit && <th className={`${cellule} w-24 text-right font-semibold`}>{a.colonnes.invocateur}</th>}
              <th className={`${cellule} text-right font-semibold ${etroit ? '' : 'w-28'}`}>{a.colonnes.total}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s} className="border-t border-border bg-panel" data-stat-adversaire={s}>
                <th scope="row" className={`${cellule} text-left text-xs font-normal text-ink-dim`}>{jeu.stats[s]}</th>
                <td className={cellule}>
                  <NumberField
                    value={saisie.base[s]}
                    onChange={(v) => maj(avecValeurAdversaire(setup, 'base', s, v ?? 0))}
                    min={0}
                    step={s === 'hp' ? 1000 : 10}
                    boxWidth={largeurChamp}
                    sansBoutons={etroit}
                    ariaLabel={a.baseAria(jeu.stats[s])}
                  />
                </td>
                <td className={cellule}>
                  <NumberField
                    value={saisie.runes[s]}
                    onChange={(v) => maj(avecValeurAdversaire(setup, 'runes', s, v ?? 0))}
                    min={0}
                    step={s === 'hp' ? 1000 : 10}
                    boxWidth={largeurChamp}
                    sansBoutons={etroit}
                    ariaLabel={a.runesAria(jeu.stats[s])}
                  />
                </td>
                {!etroit && <td className={`${cellule} text-right font-mono text-xs text-good`}>{part(detail[s].lead)}</td>}
                {!etroit && <td className={`${cellule} text-right font-mono text-xs text-good`}>{part(detail[s].invocateur)}</td>}
                <td className={`${cellule} text-right font-mono font-semibold text-ink`} aria-label={a.totalAria(jeu.stats[s])}>
                  {fmt(detail[s].total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-micro text-ink-dim">
        {a.invocateur(
          textes.degats.contenusInvocateur[setup.summonerSkills === 'guilde' ? 'guilde' : 'normal'],
          invoc.pct.hp,
          invoc.pct.def,
          invoc.pct.atk,
          invoc.pct.spd,
          !!element
        )}
      </p>
    </div>
  );
}
