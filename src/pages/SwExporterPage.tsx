import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { IconeTelecharger } from '../components/IconesAtelier';
import { useDirectSwex } from '../hooks/useCompteDirect';
import { useEtatSwex } from '../hooks/useEtatSwex';
import { useLangue, useTraduction } from '../hooks/useLangue';
import type { Dictionnaire } from '../i18n/fr';
import { formatDateHeure } from '../i18n/format';
import { estBureau, type EtatDirectSwex } from '../lib/bureau';
import { FICHIER_PLUGIN_SWEX, SW_EXPORTER, adressePluginSwex } from '../lib/pluginSwex';
import { NOM_APP } from '../marque';
import { Bouton } from '../ui';

// La page « SW Exporter » (`#/sw-exporter`), sous Ressources : le plugin SWEX
// « SW Blacksmith Live » — ce qu'il fait, son téléchargement, l'installation
// pas à pas. Sur le site ET dans l'app de bureau.
// Voir docs/02-app/sw-exporter/README.md.
//
// ⚠️ **Le bouton ENREGISTRE le fichier** (`telechargement`) : un `.js`, le
// navigateur l'ouvrirait comme du texte à la place de l'app.
// ⚠️ **Au téléphone, sans bouton** : le plugin s'installe à côté de SW
// Exporter, sur un ordinateur (`lg:`, deux formats, deux contenus). Le reste
// de la page — ce qu'il fait, comment l'installer — se lit partout.
// Sur le SITE, une phrase dit qu'il sert avec l'application de bureau, avec
// son lien : un navigateur ne peut pas suivre un dossier de l'ordinateur.

export default function SwExporterPage() {
  const t = useTraduction();
  const s = t.swExporter;
  const bureau = estBureau();
  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="font-display font-black text-[clamp(28px,4vw,42px)] text-ink mb-2">{s.titre}</h1>
      <p className="text-ink-dim text-sm leading-relaxed mb-6">{s.intro(NOM_APP)}</p>

      <h2 className="label mb-2">{s.atoutsTitre}</h2>
      <ul className="mb-8 grid gap-3 sm:grid-cols-3">
        {s.atouts.map((a) => (
          <li key={a.titre} className="rounded-xl border border-border-soft bg-panel px-4 py-3">
            <p className="text-sm font-semibold text-ink">{a.titre}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-dim">{a.texte}</p>
          </li>
        ))}
      </ul>

      {/* À l'ordinateur : le téléchargement. */}
      <div className="hidden lg:block">
        <div className="flex flex-wrap items-center gap-3">
          <Bouton
            ton="accent"
            fond="plein"
            href={adressePluginSwex()}
            telechargement={FICHIER_PLUGIN_SWEX}
            icone={<IconeTelecharger size={15} />}
            libelle={s.telecharger}
          />
          <span className="font-mono text-xs text-ink-dim">{s.fichier(__APP_VERSION__)}</span>
        </div>
      </div>
      {/* Au téléphone : rien à installer ici. */}
      <p className="text-sm text-ink lg:hidden">{s.auTelephone}</p>

      {!bureau && (
        <p className="mt-3 max-w-xl text-xs leading-relaxed text-ink-dim">
          {s.avecBureau}{' '}
          <a href="#/telecharger" className="text-accent hoverable:text-ink transition">
            {s.telechargerApp}
          </a>
        </p>
      )}

      {/* Application de bureau : le plugin installé, la session en direct,
          « Mettre à jour mon compte ». */}
      {bureau && <EtatPlugin />}

      <h2 className="label mt-8 mb-3">{s.tutoTitre}</h2>
      <ol className="flex flex-col gap-3">
        {s.etapes.map((e, i) => (
          <li key={e.titre} className="flex gap-3 rounded-xl border border-border-soft bg-panel px-4 py-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-bold text-accent-lisible">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{e.titre}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-dim">{e.texte}</p>
              {/* La première étape mène à SW Exporter lui-même. */}
              {i === 0 && (
                <a
                  href={SW_EXPORTER}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs text-accent hoverable:text-ink transition"
                >
                  {s.swexSurGithub} <ExternalLink size={12} />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* Le direct et « Mettre à jour » : sur le site aussi, pour savoir ce
          que l'application en fait. */}
      <h2 className="label mt-8 mb-3">{s.utiliserTitre}</h2>
      <ol className="flex flex-col gap-3">
        {s.utilisation.map((e, i) => (
          <li key={e.titre} className="flex gap-3 rounded-xl border border-border-soft bg-panel px-4 py-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-bold text-accent-lisible">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{e.titre}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-dim">{e.texte}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl border border-border-soft bg-panel px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{s.miseAJourTitre}</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-dim">{s.miseAJour}</p>
        </section>
        <section className="rounded-xl border border-border-soft bg-panel px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{s.limitesTitre}</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-dim">{s.limites}</p>
        </section>
      </div>
    </div>
  );
}

// La ligne du plugin installé, selon son statut.
export function lignePlugin(etat: EtatDirectSwex, s: Dictionnaire['swExporter']): string {
  const { installee, app, statut } = etat.plugin;
  if (!installee || statut === 'absent') return s.pluginAbsent;
  if (statut === 'ancien') return s.pluginAncien(installee, app);
  if (statut === 'plus-recent') return s.pluginPlusRecent(installee);
  return s.pluginAJour(installee);
}

// Application de bureau : le plugin installé dans le dossier SWEX suivi,
// comparé à l'application ; la session en direct ; « Mettre à jour mon
// compte », qui reporte la session sur le compte de l'application comme un
// nouvel export (useCompteDirect.ts) — sans notification : le résultat
// s'écrit sous le bouton, à une place réservée.
function EtatPlugin() {
  const t = useTraduction();
  const s = t.swExporter;
  const langue = useLangue();
  const direct = useDirectSwex();
  const { etat: swexEtat } = useEtatSwex();
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);
  // Relu à l'ouverture : un plugin installé depuis le lancement compte.
  const relire = direct?.relire;
  useEffect(() => {
    relire?.();
  }, [relire]);
  const etat = direct?.etat ?? null;
  if (!direct || !etat) return null;
  const heure = (ms: number) => formatDateHeure(ms, langue, { hour: '2-digit', minute: '2-digit' });
  return (
    <CartePlugin
      etat={etat}
      suivi={!!swexEtat?.dossier && !!swexEtat.fichier}
      heure={heure}
      enCours={enCours}
      resultat={resultat}
      onMettreAJour={async () => {
        setEnCours(true);
        const r = await direct.mettreAJour();
        setEnCours(false);
        setResultat(r.ok ? s.misAJour(heure(Date.now())) : s.echecMiseAJour);
      }}
    />
  );
}

// La carte elle-même, sans le processus principal (tests/rendu/).
export function CartePlugin({
  etat,
  suivi,
  heure,
  enCours,
  resultat,
  onMettreAJour,
}: {
  etat: EtatDirectSwex;
  // Un dossier SWEX et un invocateur sont suivis.
  suivi: boolean;
  heure: (ms: number) => string;
  enCours: boolean;
  resultat: string | null;
  onMettreAJour: () => void;
}) {
  const s = useTraduction().swExporter;
  if (!suivi)
    return <p className="mt-6 rounded-xl border border-border-soft bg-panel px-4 py-3 text-xs text-ink-dim">{s.sansDossier}</p>;
  const aJour = etat.plugin.statut === 'a-jour' || etat.plugin.statut === 'plus-recent';
  return (
    <section className="mt-6 rounded-xl border border-border-soft bg-panel px-4 py-3" data-etat-plugin>
      <h2 className="text-sm font-semibold text-ink">{s.etatTitre}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-xs text-ink-dim">{lignePlugin(etat, s)}</p>
        {!aJour && (
          <Bouton
            ton="accent"
            fond="vide"
            taille="sm"
            href={adressePluginSwex()}
            telechargement={FICHIER_PLUGIN_SWEX}
            icone={<IconeTelecharger size={14} />}
            libelle={s.telechargerDernier}
          />
        )}
      </div>
      <p className="mt-2 text-xs text-ink-dim">
        {etat.disponible && etat.maj !== null ? s.session(heure(etat.maj)) : s.sansSession}
      </p>
      <div className="mt-3 flex flex-col items-start gap-1.5">
        <Bouton
          ton="accent"
          fond="plein"
          taille="sm"
          disabled={!etat.disponible || enCours}
          onClick={onMettreAJour}
          icone={<RefreshCw size={14} />}
          libelle={s.mettreAJour}
          data-mettre-a-jour=""
        />
        {/* Place réservée : le message n'écarte rien en apparaissant. */}
        <p className="min-h-[1rem] text-xs text-ink-dim" aria-live="polite">
          {resultat}
        </p>
      </div>
    </section>
  );
}
