import { ExternalLink } from 'lucide-react';
import { LogoLinux, LogoWindows } from '../components/IconesSystemes';
import { RELEASES, libelleVersion } from '../data/releases';
import { useTraduction } from '../hooks/useLangue';
import { DEPOT, TELECHARGEMENTS } from '../lib/bureau';
import { NOM_APP } from '../marque';
import { Bouton } from '../ui';

// La page « Télécharger » (`#/telecharger`) — application de bureau. SITE seulement :
// dans l'app, ni entrée ni route
// (App.tsx).
//
// ⚠️ Un clic télécharge le FICHIER de la dernière version publiée
// (`…/releases/latest/download/…`, noms sans version), pas la
// page de la release, où il faudrait le chercher parmi les fichiers de la
// mise à jour. Pas de signature : la phrase dit comment passer
// l'avertissement de Windows, avec SES libellés.
// ⚠️ **Au téléphone, sans boutons** : ni un `.exe` ni une AppImage ne s'y
// installent (`lg:`, deux formats, deux contenus).

export default function TelechargerPage() {
  const t = useTraduction();
  const tt = t.telecharger;
  // La version que télécharge `releases/latest` : la dernière PUBLIÉE (une
  // version en préparation est en tête du journal sans être en ligne).
  const derniere = RELEASES.find((r) => r.version !== null) ?? RELEASES[0];
  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="font-display font-black text-[clamp(28px,4vw,42px)] text-ink mb-2">{tt.titre}</h1>
      <p className="text-ink-dim text-sm leading-relaxed mb-6">{tt.intro(NOM_APP)}</p>

      <ul className="mb-8 grid gap-3 sm:grid-cols-3">
        {tt.atouts.map((a) => (
          <li key={a.titre} className="rounded-xl border border-border-soft bg-panel px-4 py-3">
            <p className="text-sm font-semibold text-ink">{a.titre}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-dim">{a.texte}</p>
          </li>
        ))}
      </ul>

      {/* À l'ordinateur : les deux téléchargements. */}
      <div className="hidden lg:block">
        <div className="flex flex-wrap gap-3">
          <Bouton
            ton="accent"
            fond="plein"
            href={TELECHARGEMENTS.windows}
            icone={<LogoWindows size={15} />}
            libelle={tt.windows}
          />
          <Bouton
            ton="accent"
            fond="plein"
            href={TELECHARGEMENTS.linux}
            icone={<LogoLinux size={15} />}
            libelle={tt.linux}
          />
        </div>
        <p className="mt-3 max-w-xl text-xs leading-relaxed text-ink-dim">{tt.avertissementWindows}</p>
      </div>

      {/* Au téléphone : rien à installer ici. */}
      <p className="text-sm text-ink lg:hidden">{tt.auTelephone}</p>

      <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-dim">
        <span>{tt.versionProposee(libelleVersion(derniere.version, t.nouveautes.enPreparation))}</span>
        <a
          href={`${DEPOT}/releases`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-accent hoverable:text-ink transition"
        >
          {tt.toutesLesVersions} <ExternalLink size={12} />
        </a>
      </p>
    </div>
  );
}
