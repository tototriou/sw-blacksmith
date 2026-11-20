import type { ReactNode } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { LogoDiscord } from '../components/IconesSystemes';
import { inviterLeBot } from '../components/siege/discord/DialoguesDiscord';
import { useLangue, useTraduction } from '../hooks/useLangue';
import {
  CAPTURES_BOT,
  COMMANDES_BOT,
  DROITS_DU_BOT,
  ETAPES_ADMIN,
  ETAPES_INSTALLATION,
  ETAPES_MEMBRES,
  ONGLETS_BOT,
  cheminCapture,
  type NomCapture,
  type OngletBot,
} from '../lib/botDiscord';
import { LIEN_DISCORD, NOM_APP } from '../marque';
import { Bouton, Onglets } from '../ui';

// La page « Bot Discord » (`#/bot-discord/<onglet>`), sous Ressources : trois
// onglets — installer le bot, la synchronisation des recommandations, ses
// commandes. Sur le site ET dans l'app de bureau (les deux se connectent à
// Discord). Voir docs/02-app/bot-discord/README.md.
//
// ⚠️ **L'onglet est dans l'adresse**, comme les sous-sections du siège : un
// onglet se partage par un lien, et en écran partagé chaque volet garde le
// sien (App.tsx le lit dans SA navigation, pas dans `window.location`).
// ⚠️ **Au téléphone, ses propres captures** : celles de l'app y sont prises
// dans la disposition du téléphone (`<picture>`, sous 1024 px) — une capture
// d'ordinateur réduite à 360 px ne se lirait plus.

export default function BotDiscordPage({ onglet }: { onglet: OngletBot }) {
  const t = useTraduction().botDiscord;
  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="font-display font-black text-[clamp(28px,4vw,42px)] text-ink mb-2">{t.titre}</h1>
      <p className="text-ink-dim text-sm leading-relaxed mb-5">{t.intro(NOM_APP)}</p>

      <Onglets
        aria-label={t.ongletsAria}
        options={ONGLETS_BOT.map((cle) => ({ cle, libelle: t.onglets[cle] }))}
        valeur={onglet}
        onChange={(cle) => {
          window.location.hash = `#/bot-discord/${cle}`;
        }}
      />
      <div role="tabpanel" aria-label={t.onglets[onglet]} className="pt-5" data-onglet-bot={onglet}>
        {onglet === 'installation' ? <Installation /> : onglet === 'recommandations' ? <Recommandations /> : <Commandes />}
      </div>

      <Bouton href={LIEN_DISCORD} nouvelOnglet icone={<LogoDiscord size={15} />} libelle={t.question} className="mt-8" />
    </div>
  );
}

function Installation() {
  const t = useTraduction().botDiscord;
  const i = t.installation;
  return (
    <>
      <Atouts titre={t.atoutsTitre} atouts={i.atouts} />
      <p className="mb-3 text-xs text-ink-dim">{i.intro}</p>
      <Bouton ton="accent" fond="plein" onClick={inviterLeBot} icone={<ExternalLink size={14} />} libelle={i.inviter} data-inviter-bot />
      <ol className="mt-4 flex flex-col gap-3">
        {ETAPES_INSTALLATION.map(({ cle, capture }, n) => (
          <Etape key={cle} n={n + 1} titre={i.etapes[cle].titre} texte={i.etapes[cle].texte} capture={capture} />
        ))}
      </ol>
      <Depannage titre={t.depannageTitre} items={i.depannage} />
    </>
  );
}

function Recommandations() {
  const t = useTraduction().botDiscord;
  return (
    <>
      <p className="mb-4 text-sm leading-relaxed text-ink-dim">{t.recos.intro}</p>
      <Atouts titre={t.atoutsTitre} atouts={t.recos.atouts} />

      <section data-section-bot="admin">
        <h2 className="label mb-1">{t.recos.adminTitre}</h2>
        <p className="mb-3 text-xs text-ink-dim">{t.recos.adminIntro}</p>
        <ol className="flex flex-col gap-3">
          {ETAPES_ADMIN.map(({ cle, capture }, n) => (
            <Etape key={cle} n={n + 1} titre={t.etapesAdmin[cle].titre} texte={t.etapesAdmin[cle].texte} capture={capture}>
              {cle === 'droits' && (
                <ul className="mt-2 flex flex-col gap-1" data-droits-bot>
                  {DROITS_DU_BOT.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-xs text-ink">
                      <Check size={14} className="flex-none text-good" aria-hidden />
                      {t.droits[d]}
                    </li>
                  ))}
                </ul>
              )}
            </Etape>
          ))}
        </ol>
      </section>

      <section className="mt-8" data-section-bot="membres">
        <h2 className="label mb-1">{t.membresTitre}</h2>
        <p className="mb-3 text-xs text-ink-dim">{t.membresIntro}</p>
        <ol className="flex flex-col gap-3">
          {ETAPES_MEMBRES.map(({ cle, capture }, n) => (
            <Etape key={cle} n={n + 1} titre={t.etapesMembres[cle].titre} texte={t.etapesMembres[cle].texte} capture={capture} />
          ))}
        </ol>
      </section>

      <Depannage titre={t.depannageTitre} items={t.depannageRecos} />
    </>
  );
}

function Commandes() {
  const c = useTraduction().botDiscord.commandes;
  return (
    <>
      <p className="mb-5 text-sm leading-relaxed text-ink-dim">{c.intro}</p>
      <div className="flex flex-col gap-8">
        {COMMANDES_BOT.map((cmd) => {
          const textes = c.liste[cmd.cle];
          return (
            <section key={cmd.cle} data-commande-bot={cmd.cle}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="font-mono text-md font-semibold text-ink">{textes.nom}</h2>
                {cmd.enEssai && (
                  <span className="rounded-full bg-warn-soft px-2 py-0.5 text-micro font-semibold text-warn">{c.enEssai}</span>
                )}
              </div>
              <p className="mb-3 text-xs leading-relaxed text-ink-dim">{textes.resume}</p>
              <ol className="flex flex-col gap-3">
                {textes.etapes.map((e, n) => (
                  <Etape key={e.titre} n={n + 1} titre={e.titre} texte={e.texte} capture={cmd.captures[n + 1]} />
                ))}
              </ol>
              <p className="mt-3 text-xs leading-relaxed text-ink-dim">{textes.note}</p>
            </section>
          );
        })}
      </div>
    </>
  );
}

function Atouts({ titre, atouts }: { titre: string; atouts: readonly { titre: string; texte: string }[] }) {
  return (
    <>
      <h2 className="label mb-2">{titre}</h2>
      <ul className={`mb-8 grid gap-3 ${atouts.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {atouts.map((a) => (
          <li key={a.titre} className="rounded-xl border border-border-soft bg-panel px-4 py-3">
            <p className="text-sm font-semibold text-ink">{a.titre}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-dim">{a.texte}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

function Depannage({ titre, items }: { titre: string; items: readonly { probleme: string; remede: string }[] }) {
  return (
    <section className="mt-8" data-section-bot="depannage">
      <h2 className="label mb-3">{titre}</h2>
      <dl className="flex flex-col gap-3">
        {items.map((d) => (
          <div key={d.probleme} className="rounded-xl border border-border-soft bg-panel px-4 py-3">
            <dt className="text-sm font-semibold text-ink">{d.probleme}</dt>
            <dd className="mt-1 text-xs leading-relaxed text-ink-dim">{d.remede}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Une étape numérotée, comme celles de la page SW Exporter ; sa capture,
// facultative, sous le texte.
function Etape({ n, titre, texte, capture, children }: { n: number; titre: string; texte: string; capture?: NomCapture; children?: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-xl border border-border-soft bg-panel px-4 py-3">
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-bold text-accent-lisible">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{titre}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">{texte}</p>
        {children}
        {capture && <CaptureBot nom={capture} />}
      </div>
    </li>
  );
}

// Une capture, à sa place réservée (largeur et hauteur écrites) : la page ne
// saute pas quand elle arrive. Celles de Discord, prises une fois en anglais,
// le disent dans une autre langue.
export function CaptureBot({ nom }: { nom: NomCapture }) {
  const t = useTraduction().botDiscord;
  const langue = useLangue();
  const c = CAPTURES_BOT[nom];
  const base = import.meta.env.BASE_URL;
  const cadre = 'h-auto max-w-full rounded-lg border border-border-soft';
  if (c.sorte !== 'app')
    return (
      <figure className="mt-3" data-capture={nom}>
        <img src={base + cheminCapture(nom, langue)} width={c.taille.largeur} height={c.taille.hauteur} alt={t.captures[nom]} loading="lazy" decoding="async" className={cadre} />
        {c.sorte === 'discord' && langue !== 'en' && <figcaption className="mt-1 text-micro text-ink-dim">{t.capturesEnAnglais}</figcaption>}
      </figure>
    );
  return (
    <figure className="mt-3" data-capture={nom}>
      <picture>
        <source media="(max-width: 1023px)" srcSet={base + cheminCapture(nom, langue, 'telephone')} width={c.telephone.largeur} height={c.telephone.hauteur} />
        <img src={base + cheminCapture(nom, langue)} width={c.ordinateur.largeur} height={c.ordinateur.hauteur} alt={t.captures[nom]} loading="lazy" decoding="async" className={`w-full ${cadre}`} />
      </picture>
    </figure>
  );
}
