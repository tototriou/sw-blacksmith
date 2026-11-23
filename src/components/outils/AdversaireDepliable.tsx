/* eslint-disable swblacksmith/texte-en-dur -- PROTOTYPE jetable : trois propositions à comparer, textes en dur. */
import { useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { DamageSetup } from '../../lib/damage';
import { avecTotalAdversaire, detailAdversaire, saisieAdversaireDe, totalEcrit, type StatAdversaire } from '../../lib/saisieAdversaire';
import type { Monster } from '../../types';
import { NumberField, Segmented, ZoneCliquable } from '../../ui';
import { useTraduction } from '../../hooks/useLangue';
import { nomStatLead } from '../siege/LeadPill';
import MonsterAvatar from '../MonsterAvatar';
import SaisieAdversaire from './SaisieAdversaire';

// PROTOTYPE — trois façons de replier la saisie détaillée de l'adversaire
// derrière les totaux d'avant. Le sélecteur « Proposition » en tête n'existe
// que pour comparer ; il part avec le choix.

type Variante = '1' | '2' | '3';

// Déroulé animé : hauteur 0 → auto. `overflow-hidden` seulement pendant le
// mouvement, pour ne pas rogner l'anneau de focus des champs une fois ouvert.
function Deroulant({ ouvert, children }: { ouvert: boolean; children: ReactNode }) {
  const reduit = useReducedMotion();
  const [enMouvement, setEnMouvement] = useState(false);
  return (
    <motion.div
      initial={false}
      animate={{ height: ouvert ? 'auto' : 0, opacity: ouvert ? 1 : 0 }}
      transition={{ duration: reduit ? 0 : 0.25, ease: [0.2, 0, 0, 1] }}
      onAnimationStart={() => setEnMouvement(true)}
      onAnimationComplete={() => setEnMouvement(false)}
      className={enMouvement || !ouvert ? 'overflow-hidden' : ''}
      aria-hidden={!ouvert}
    >
      {children}
    </motion.div>
  );
}

const Chevron = ({ ouvert, taille = 14 }: { ouvert: boolean; taille?: number }) => (
  <ChevronDown size={taille} className={`flex-none transition-transform duration-200 ${ouvert ? 'rotate-180' : ''}`} aria-hidden />
);

export default function AdversaireDepliable(props: {
  setup: DamageSetup;
  maj: (patch: Partial<DamageSetup>) => void;
  stats: StatAdversaire[];
  etroit: boolean;
  monstres: Monster[];
  libelle: string;
}) {
  const { setup, maj, stats, etroit, monstres, libelle } = props;
  const textes = useTraduction();
  const jeu = textes.jeu;
  const [variante, setVariante] = useState<Variante>('1');
  const [ouvert, setOuvert] = useState(false);

  const saisie = saisieAdversaireDe(setup);
  const detail = detailAdversaire(saisie, setup.summonerSkills, setup.enemyElement ?? null);
  const monstre = saisie.monstreId ? monstres.find((m) => String(m.id) === saisie.monstreId) ?? null : null;
  const aDetail = !!setup.adversaire;

  const champs = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {stats.map((s) => (
        <label key={s} className="flex items-center gap-2">
          <span className={libelle}>{jeu.stats[s]}</span>
          <NumberField
            value={aDetail ? detail[s].total : totalEcrit(setup, s)}
            onChange={(v) => maj(avecTotalAdversaire(setup, s, v ?? 0))}
            step={s === 'hp' ? 1000 : s === 'spd' ? 10 : 50}
            min={s === 'hp' || s === 'spd' ? 1 : 0}
            boxWidth="w-32"
            ariaLabel={`${jeu.stats[s]} de l'adversaire`}
          />
        </label>
      ))}
    </div>
  );

  // Ce que la saisie détaillée apporte, en une ligne : pour le bandeau (3) et
  // le libellé du lien (1).
  const morceaux = [
    monstre?.name,
    saisie.lead ? `Lead ${nomStatLead(jeu, saisie.lead.stat)} ${saisie.lead.pct} %` : null,
    stats.some((s) => saisie.runes[s] > 0) ? 'runes' : null,
  ].filter(Boolean);
  const resume = aDetail && morceaux.length > 0 ? morceaux.join(' · ') : null;

  const detailComplet = (
    <SaisieAdversaire setup={setup} maj={maj} stats={stats} etroit={etroit} monstres={monstres} />
  );

  return (
    <div data-adversaire-depliable={variante}>
      <div className={`mb-3 flex gap-2 rounded-md border border-dashed border-border px-2 py-1.5 ${etroit ? 'flex-col' : 'items-center'}`}>
        <span className="text-micro uppercase tracking-wider text-ink-dim">Proposition</span>
        <Segmented
          value={variante}
          onChange={(v) => setVariante(v as Variante)}
          options={[
            { key: '1', label: '1 · Lien' },
            { key: '2', label: '2 · Bascule' },
            { key: '3', label: '3 · Bandeau' },
          ]}
          size="sm"
        />
      </div>

      {variante === '1' && (
        <>
          {champs}
          <ZoneCliquable
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            className="mt-2 inline-flex items-center gap-1.5 p-0 text-xs text-ink-dim transition hoverable:text-ctx"
          >
            <Chevron ouvert={ouvert} />
            <span>{ouvert ? 'Masquer le détail' : 'Détailler : lead, stats de base, runes'}</span>
            {!ouvert && resume && <span className="text-ctx">({resume})</span>}
          </ZoneCliquable>
          <Deroulant ouvert={ouvert}>
            <div className="mt-2 border-l-2 border-border pl-3">{detailComplet}</div>
          </Deroulant>
        </>
      )}

      {variante === '2' && (
        <>
          {/* Au téléphone, la bascule passe AU-DESSUS : à côté, elle écrase le tableau. */}
          <div className={etroit ? 'flex flex-col-reverse gap-2' : 'flex items-start gap-3'}>
            <div className="min-w-0 flex-1">
              <Deroulant ouvert={!ouvert}>{champs}</Deroulant>
              <Deroulant ouvert={ouvert}>{detailComplet}</Deroulant>
            </div>
            <ZoneCliquable
              onClick={() => setOuvert((o) => !o)}
              aria-expanded={ouvert}
              title={ouvert ? 'Revenir aux totaux' : 'Saisie détaillée'}
              className={`${etroit ? 'self-end' : 'mt-1'} inline-flex flex-none items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition hoverable:text-ctx`}
            >
              <span>{ouvert ? 'Totaux' : 'Détail'}</span>
              <Chevron ouvert={ouvert} />
            </ZoneCliquable>
          </div>
        </>
      )}

      {variante === '3' && (
        <>
          {champs}
          <div className="mt-3 rounded-md border border-border bg-panel2">
            <ZoneCliquable
              onClick={() => setOuvert((o) => !o)}
              aria-expanded={ouvert}
              className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition hoverable:text-ctx"
            >
              {monstre ? (
                <MonsterAvatar monster={monstre} size={26} />
              ) : (
                <span className="h-[26px] w-[26px] flex-none rounded-md border border-dashed border-border" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate text-xs">
                {resume ? (
                  <span className="text-ink">{resume}</span>
                ) : (
                  <span className="text-ink-dim">Importer un monstre, ajouter un lead et des runes…</span>
                )}
              </span>
              <Chevron ouvert={ouvert} taille={16} />
            </ZoneCliquable>
            <Deroulant ouvert={ouvert}>
              <div className="border-t border-border bg-panel px-2.5 pb-2.5 pt-2.5">{detailComplet}</div>
            </Deroulant>
          </div>
        </>
      )}
    </div>
  );
}
