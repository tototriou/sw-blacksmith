import { useMemo, useState } from 'react';
import { Copy, ExternalLink, Hash } from 'lucide-react';
import { Bouton, Champ, Modale, Option, useNotifier } from '../../../ui';
import { discordBureau, type IssueCodeDiscord } from '../../../lib/bureau';
import { URL_INVITATION } from '../../../lib/discordClient';
import Segmented from '../../../ui/Segmented';
import { useLangue, useTraduction } from '../../../hooks/useLangue';
import { formatDateHeure } from '../../../i18n/format';
import { RECO_STATS, type Monster, type Reco, type RecoDeck } from '../../../types';
import type { SalonDePublication } from '../../../lib/provenancesRecos';
import { aChoisir, type ChoixDeck, type ChoixFusion, type ElementDeck, type Fusion } from '../../../lib/recoDiscord';
import { deckLabel } from '../RecoCard';

// Les dialogues de la synchronisation Discord : se connecter, installer le bot,
// « Publier dans… », et la fusion d'une version arrivée sur une copie modifiée
// (docs/02-app/siege/feat-recommandations/rendu-de-la-page.md, « Discord »).
// Grammaire des modales de l'app : titre en haut à gauche, croix en haut à
// droite, actions en bas à droite, la secondaire d'abord.

const LIEN_DISCORD_APP = 'https://discord.gg/R2Fe4GJZET';

export function DialogueConnexion({ onContinuer, onFermer }: { onContinuer: () => void; onFermer: () => void }) {
  const t = useTraduction().recosDiscord.connexion;
  const c = useTraduction().commun;
  return (
    <Modale onClose={onFermer} labelledBy="discord-connexion-titre" croix largeur="max-w-[440px]" titre={t.dialogueTitre}
      sousTitre={t.dialogueTexte}
      actions={<>
        <Bouton onClick={onFermer} libelle={c.annuler} />
        <Bouton onClick={onContinuer} fond="plein" ton="accent" autoFocus libelle={t.continuer} />
      </>}
    >
      <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn" data-avertissement-acces>{t.avertissement}</p>
    </Modale>
  );
}

// Application de bureau : la connexion s'est ouverte dans le navigateur du
// système ; le site y affiche un code, collé ici. Fermer le dialogue abandonne
// la connexion ; « Relancer » rouvre le navigateur (un nouveau code).
export function DialogueCodeBureau({ onValider, onRelancer, onFermer }: {
  onValider: (code: string) => Promise<IssueCodeDiscord>;
  onRelancer: () => void;
  onFermer: () => void;
}) {
  const t = useTraduction().recosDiscord.codeBureau;
  const c = useTraduction().commun;
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<IssueCodeDiscord | null>(null);
  const [enCours, setEnCours] = useState(false);
  const valider = async () => {
    setEnCours(true);
    const issue = await onValider(code.trim());
    setEnCours(false);
    if (issue !== 'connecte') setErreur(issue);
  };
  return (
    <Modale onClose={onFermer} labelledBy="discord-code-titre" croix largeur="max-w-[460px]" titre={t.titre}
      actions={<>
        <Bouton onClick={onFermer} libelle={c.annuler} />
        <Bouton onClick={() => void valider()} disabled={!code.trim() || enCours} fond="plein" ton="accent" libelle={t.valider} />
      </>}
    >
      <CorpsCodeBureau code={code} erreur={erreur} onCode={(v) => { setCode(v); setErreur(null); }} onRelancer={() => { setCode(''); setErreur(null); onRelancer(); }} />
    </Modale>
  );
}

// Le corps, rendu seul dans les tests (la coquille passe par un portail).
export function CorpsCodeBureau({ code, erreur, onCode, onRelancer }: {
  code: string; erreur: IssueCodeDiscord | null; onCode: (v: string) => void; onRelancer: () => void;
}) {
  const t = useTraduction().recosDiscord.codeBureau;
  const message = erreur === 'invalide' ? t.invalide : erreur === 'sans-demande' ? t.sansDemande : erreur === 'indisponible' ? t.indisponible : null;
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink-dim">
        {t.etapes.map((e, i) => <li key={i}>{e}</li>)}
      </ol>
      <Champ
        value={code}
        onChange={(e) => onCode(e.target.value)}
        onBlur={(e) => onCode(e.target.value.trim())}
        aria-label={t.champ}
        placeholder={t.champ}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
      />
      {/* Hauteur réservée : l'erreur n'écarte pas les actions. */}
      <p role="alert" className="min-h-10 text-sm text-bad">{message}</p>
      <Bouton onClick={onRelancer} fond="vide" trait="aucun" taille="sm" icone={<ExternalLink size={13} />} libelle={t.relancer} className="self-start" />
    </div>
  );
}

// Site : le code à copier dans l'application de bureau, au retour d'une
// connexion qu'elle a demandée.
export function DialogueCodeSite({ code, onFermer }: { code: string; onFermer: () => void }) {
  const t = useTraduction().recosDiscord.codeSite;
  return (
    <Modale onClose={onFermer} labelledBy="discord-code-site-titre" croix largeur="max-w-[460px]" titre={t.titre}
      actions={<Bouton onClick={onFermer} libelle={useTraduction().commun.fermer} />}
    >
      <CorpsCodeSite code={code} />
    </Modale>
  );
}

export function CorpsCodeSite({ code }: { code: string }) {
  const t = useTraduction().recosDiscord.codeSite;
  const notifier = useNotifier();
  const copier = () => void navigator.clipboard.writeText(code).then(() => notifier({ message: t.copie }), () => {});
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-dim">{t.texte}</p>
      {/* Le code ouvre la connexion Discord du membre à qui détient
          l'application qui l'a demandé : qu'on le lui fasse recopier, et
          c'est sa connexion qui part. */}
      <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn" data-avertissement-code>{t.avertissement}</p>
      <Champ value={code} readOnly aria-label={t.champ} onFocus={(e) => e.target.select()} className="font-mono" data-code-bureau />
      <Bouton onClick={copier} fond="plein" ton="accent" icone={<Copy size={14} />} libelle={t.copier} className="self-start" autoFocus />
    </div>
  );
}

// L'invitation passe par le service, qui connaît l'identifiant du bot de son
// environnement. Dans l'application de bureau, la page ne connaît pas
// l'adresse du service : le processus principal ouvre le navigateur.
function inviterLeBot() {
  const pont = discordBureau();
  if (pont) void pont.inviter();
  else window.open(URL_INVITATION, '_blank', 'noopener');
}

export function DialogueInstallation({ onFermer }: { onFermer: () => void }) {
  const t = useTraduction().recosDiscord.installation;
  return (
    <Modale onClose={onFermer} labelledBy="discord-installation-titre" croix largeur="max-w-[480px]" titre={t.titre}
      actions={<Bouton onClick={onFermer} libelle={useTraduction().commun.fermer} />}
    >
      <CorpsInstallation onInviter={inviterLeBot} />
    </Modale>
  );
}

// Le corps, rendu seul dans les tests (la coquille passe par un portail).
export function CorpsInstallation({ onInviter }: { onInviter: () => void }) {
  const t = useTraduction().recosDiscord.installation;
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink-dim">
        {t.etapes.map((e, i) => <li key={i}>{e}</li>)}
      </ol>
      <Bouton onClick={onInviter} fond="plein" ton="accent" icone={<ExternalLink size={14} />} libelle={t.inviter} className="self-start" data-inviter-bot />
      <a href={LIEN_DISCORD_APP} target="_blank" rel="noreferrer" className="text-sm text-accent-lisible underline">
        {t.question}
      </a>
    </div>
  );
}

// « Publier dans… » : les salons que le membre peut lire, avec ce que chacun
// porte déjà ; ceux où il ne peut pas écrire sont visibles, désactivés.
export function DialoguePublierDans({ reco, salons, enCours, onPublier, onFermer }: {
  reco: Reco;
  salons: SalonDePublication[];
  enCours: boolean;
  onPublier: (salon: SalonDePublication) => void;
  onFermer: () => void;
}) {
  const t = useTraduction().recosDiscord;
  const c = useTraduction().commun;
  const [choisi, setChoisi] = useState<string | null>(() => salons.find((s) => s.ecrire && !s.porte)?.salonId ?? salons.find((s) => s.ecrire)?.salonId ?? null);
  const salon = salons.find((s) => s.salonId === choisi) ?? null;
  return (
    <Modale onClose={onFermer} labelledBy="discord-publier-titre" croix largeur="max-w-[480px]"
      titre={t.publierDansDialogue.titre(reco.name || t.appareil)} sousTitre={t.publierDansDialogue.texte}
      actions={<>
        <Bouton onClick={onFermer} libelle={c.annuler} />
        <Bouton onClick={() => salon && onPublier(salon)} disabled={!salon || enCours} fond="plein" ton="accent" libelle={t.publier} />
      </>}
    >
      <ListeSalonsPublication salons={salons} choisi={choisi} onChoisir={setChoisi} />
    </Modale>
  );
}

// Le corps de « Publier dans… », rendu seul dans les tests (la coquille passe
// par un portail).
export function ListeSalonsPublication({ salons, choisi, onChoisir }: {
  salons: SalonDePublication[]; choisi: string | null; onChoisir: (salonId: string) => void;
}) {
  const t = useTraduction().recosDiscord.publierDansDialogue;
  if (salons.length === 0) return <p className="text-sm text-ink-dim">{t.aucun}</p>;
  return (
    <div className="flex flex-col gap-1.5" role="radiogroup">
      {salons.map((s) => (
        <Option
          key={s.salonId}
          onClick={() => onChoisir(s.salonId)}
          actif={choisi === s.salonId}
          disabled={!s.ecrire}
          role="radio"
          aria-checked={choisi === s.salonId}
          icone={<Hash size={15} />}
          titre={s.nomSalon}
          description={`${s.nomServeur} · ${!s.ecrire ? t.lectureSeule : s.porte ? t.porte(s.porte) : t.vide}`}
        />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Fusion
 * ----------------------------------------------------------------------- */

const egaux = (a: RecoDeck | null, b: RecoDeck | null) => a === b;

// Ce qui a passé seul, dit en une ligne par deck : de quel côté vient ce qui
// reste. Un deck identique des deux côtés n'est pas cité.
function ligneAuto(d: ElementDeck, t: ReturnType<typeof useTraduction>['recosDiscord']['fusion']): string | null {
  if (d.resolu === undefined || egaux(d.mien, d.leur) || JSON.stringify(d.mien) === JSON.stringify(d.leur)) return null;
  if (d.resolu === null) return d.mien ? t.retireAuSalon : t.retireParToi;
  return d.resolu === d.leur ? t.versionSalon : t.taVersion;
}

export function DialogueFusion({ reco, fusion, monsterByCom2us, onAppliquer, onFermer }: {
  reco: Reco;
  fusion: Fusion;
  monsterByCom2us: Map<number, Monster>;
  onAppliquer: (choix: ChoixFusion) => void;
  onFermer: () => void;
}) {
  const t = useTraduction().recosDiscord;
  const langue = useLangue();
  const f = t.fusion;
  const reste = useMemo(() => aChoisir(fusion), [fusion]);
  const [choix, setChoix] = useState<ChoixFusion>({ decks: {} });
  const complet = (!reste.nom || choix.nom) && (!reste.consignes || choix.consignes) && reste.decks.every((k) => choix.decks[k]);
  const attente = reco.lien?.enAttente;
  return (
    <Modale onClose={onFermer} labelledBy="discord-fusion-titre" croix largeur="max-w-[760px]" titre={f.titre}
      sousTitre={attente ? f.sousTitre(formatDateHeure(new Date(attente.date), langue, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : undefined}
      actions={<>
        <Bouton onClick={onFermer} libelle={f.plusTard} />
        <Bouton onClick={() => onAppliquer(choix)} disabled={!complet} title={complet ? undefined : f.manque} fond="plein" ton="accent" libelle={f.appliquer} />
      </>}
    >
      <CorpsFusion fusion={fusion} choix={choix} onChoix={setChoix} monsterByCom2us={monsterByCom2us} />
    </Modale>
  );
}

// Le corps de la fusion : ce qui a passé seul, puis chaque élément à choisir,
// les deux versions côte à côte (l'une sous l'autre au téléphone). Rendu seul
// dans les tests.
export function CorpsFusion({ fusion, choix, onChoix, monsterByCom2us }: {
  fusion: Fusion;
  choix: ChoixFusion;
  onChoix: (c: (avant: ChoixFusion) => ChoixFusion) => void;
  monsterByCom2us: Map<number, Monster>;
}) {
  const f = useTraduction().recosDiscord.fusion;
  const reste = aChoisir(fusion);
  const setChoix = onChoix;
  const auto = fusion.decks.flatMap((d) => {
    const quoi = ligneAuto(d, f);
    const deck = d.resolu ?? d.mien ?? d.leur;
    return quoi && deck ? [`${deckLabel(deck, monsterByCom2us, 0)} : ${quoi}`] : [];
  });
  const nbChoix = (reste.nom ? 1 : 0) + (reste.consignes ? 1 : 0) + reste.decks.length;
  const optionsTexte = [{ key: 'mien' as const, label: f.mien }, { key: 'leur' as const, label: f.leur }];
  const optionsDeck = [{ key: 'mien' as ChoixDeck, label: f.mien }, { key: 'leur' as ChoixDeck, label: f.leur }, { key: 'les-deux' as ChoixDeck, label: f.lesDeux }];

  const texte = (titre: string, e: { mien: string; leur: string }, cle: 'nom' | 'consignes') => (
    <div className="flex flex-col gap-2 rounded-lg border border-border-soft bg-panel2 p-2.5" data-choix-fusion={cle}>
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-sm text-ink">{titre}</b>
        <span className="flex-1" />
        <Segmented value={choix[cle] ?? null} onChange={(v) => setChoix((c) => ({ ...c, [cle]: v as 'mien' | 'leur' }))} options={optionsTexte} />
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        <Version titre={f.mien} texte={e.mien || f.vide} />
        <Version titre={f.leur} texte={e.leur || f.vide} />
      </div>
    </div>
  );

  return (
      <div className="flex flex-col gap-3 text-sm" data-dialogue-fusion>
        {auto.length > 0 && (
          <div>
            <b className="text-ink">{f.auto(auto.length)}</b>
            <ul className="mt-1 list-disc pl-5 text-ink-dim">{auto.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>
        )}
        {nbChoix === 0 ? <p className="text-ink-dim">{f.rien}</p> : <b className="text-ink">{f.aChoisir(nbChoix)}</b>}
        {reste.nom && texte(f.nom, fusion.nom, 'nom')}
        {reste.consignes && texte(f.consignes, fusion.consignes, 'consignes')}
        {fusion.decks.filter((d) => d.resolu === undefined).map((d) => (
          <div key={d.cle} className="flex flex-col gap-2 rounded-lg border border-border-soft bg-panel2 p-2.5" data-choix-fusion={d.cle}>
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-sm text-ink">{deckLabel((d.mien ?? d.leur)!, monsterByCom2us, 0)}</b>
              <span className="flex-1" />
              <Segmented value={choix.decks[d.cle] ?? null} onChange={(v) => setChoix((c) => ({ ...c, decks: { ...c.decks, [d.cle]: v as ChoixDeck } }))}
                options={optionsDeck} />
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              <Version titre={f.mien} deck={d.mien} monsterByCom2us={monsterByCom2us} absent={f.absent} />
              <Version titre={f.leur} deck={d.leur} monsterByCom2us={monsterByCom2us} absent={f.absent} />
            </div>
          </div>
        ))}
      </div>
  );
}

// Une version d'un élément : un texte, ou le résumé d'un deck (monstres,
// stats visées, consignes).
function Version({ titre, texte, deck, monsterByCom2us, absent }: {
  titre: string; texte?: string; deck?: RecoDeck | null; monsterByCom2us?: Map<number, Monster>; absent?: string;
}) {
  const jeu = useTraduction().jeu;
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border-soft bg-panel px-2.5 py-2 text-xs text-ink">
      <span className="label">{titre}</span>
      {texte !== undefined ? <span className="whitespace-pre-wrap">{texte}</span>
        : !deck ? <span className="text-ink-dim">{absent}</span>
        : (
          <>
            {deck.slots.filter((s) => s.com2usId != null).map((s, i) => {
              // Les stats sous leur nom du jeu, dans l'ordre de la carte.
              const stats = RECO_STATS.filter((st) => (s.stats[st.key] ?? 0) > 0)
                .map((st) => `${jeu.stats[st.key]} ≥ ${s.stats[st.key]}${st.suffix}`).join(', ');
              return <span key={i}>{monsterByCom2us?.get(s.com2usId!)?.name ?? s.name}{stats ? ` : ${stats}` : ''}</span>;
            })}
            {deck.note && <span className="text-ink-dim">« {deck.note} »</span>}
          </>
        )}
    </div>
  );
}
