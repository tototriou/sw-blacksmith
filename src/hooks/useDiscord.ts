import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Reco, VersionSalon } from '../types';
import type { UseRecoState } from './useSiegeRecos';
import { setDiscordActif, useReglagesDiscord } from './useReglagesDiscord';
import { useTraduction } from './useLangue';
import { useNotifier } from '../ui/Notification';
import { discordBureau, recupererParLeBureau, type IssueCodeDiscord } from '../lib/bureau';
import { encodeRecosJson } from '../lib/recoShare';
import { bilanVide, type SalonDePublication } from '../lib/provenancesRecos';
import type { SalonAccessible } from '../lib/recoDiscord';
import {
  codeBureau, deconnecter as deconnecterService, lireTout, publier as publierService, retourDeConnexion, URL_CONNEXION,
  type Recuperer, type ResultatPublication, type Sources, type Utilisateur,
} from '../lib/discordClient';

// La synchronisation des recommandations avec Discord, côté page
// (docs/02-app/siege/feat-recommandations/synchronisation-discord.md) :
// lecture des salons, publication, connexion et déconnexion.
//
// ⚠️ **Rien ne part sans un geste de l'utilisateur** : tant que le réglage
// « Discord activé » est éteint, ce hook n'appelle jamais le service. Il
// s'allume à la connexion réussie et s'éteint à la déconnexion, à une
// session échue ou à une connexion refusée.
//
// L'application de bureau (docs/02-app/bureau/README.md § « Discord ») appelle
// le service par son processus principal, qui garde la session ; sa connexion
// passe par le navigateur du système, puis par un code que le site affiche et
// que l'utilisateur colle dans l'app (statut `code`). Le site, lui, montre ce
// code (`codeAffiche`) quand il revient d'une connexion demandée par l'app.

export type StatutDiscord = 'inactif' | 'code' | 'lecture' | 'connecte' | 'indisponible';

export interface EtatDiscord {
  statut: StatutDiscord;
  utilisateur: Utilisateur | null;
  sources: Sources | null;
  salons: SalonAccessible[];
  luA: number | null; // dernière lecture réussie, en ms
  // Application de bureau : la session ne peut pas être chiffrée par le
  // système, elle ne survit pas à la fermeture. Toujours vrai sur le site.
  conservable: boolean;
}

export interface UseDiscord {
  etat: EtatDiscord;
  favoris: string[];
  connecter: () => void;
  deconnecter: () => Promise<void>;
  actualiser: () => Promise<void>;
  // Application de bureau : le code collé, et l'abandon de la connexion (la
  // relancer, c'est `connecter` à nouveau : un nouveau secret, l'ancien code
  // ne vaut plus).
  validerCode: (code: string) => Promise<IssueCodeDiscord>;
  annulerCode: () => void;
  // Site : le code à copier dans l'application de bureau, jusqu'à fermeture.
  codeAffiche: string | null;
  fermerCode: () => void;
  // La publication d'une recommandation LIÉE, depuis son bandeau.
  publier: (reco: Reco) => Promise<ResultatPublication['type']>;
  // « Publier dans… » d'une recommandation de cet appareil. Un conflit rend la
  // version que porte le salon : la page demande alors s'il faut la remplacer.
  publierDans: (reco: Reco, salon: SalonDePublication, base: string | null) => Promise<ResultatPublication>;
}

const recupererDuSite: Recuperer = (url, init) => fetch(url, init);
const ETAT_INACTIF: EtatDiscord = { statut: 'inactif', utilisateur: null, sources: null, salons: [], luA: null, conservable: true };

export function useDiscord(recos: UseRecoState, recupererInjecte?: Recuperer): UseDiscord {
  const t = useTraduction().recosDiscord;
  const notifier = useNotifier();
  const { actif, favoris } = useReglagesDiscord();
  const pont = discordBureau();
  const recuperer = useMemo(() => recupererInjecte ?? (pont ? recupererParLeBureau(pont) : recupererDuSite), [recupererInjecte, pont]);
  const [etat, setEtat] = useState<EtatDiscord>(ETAT_INACTIF);
  const [codeAffiche, setCodeAffiche] = useState<string | null>(null);
  const salons = useRef<SalonAccessible[]>([]);

  const finDeSession = useCallback((message: string) => {
    setDiscordActif(false);
    setEtat((e) => ({ ...ETAT_INACTIF, conservable: e.conservable }));
    notifier({ message });
  }, [notifier]);

  const actualiser = useCallback(async () => {
    setEtat((e) => ({ ...e, statut: 'lecture' }));
    const r = await lireTout(recuperer);
    if (!r.ok) {
      if (r.echec === 'non-connecte') finDeSession(t.notif.expiree);
      else {
        setEtat((e) => ({ ...e, statut: 'indisponible' }));
        notifier({ message: r.echec === 'limite' ? t.notif.limite : t.notif.indisponible });
      }
      return;
    }
    salons.current = r.valeur.salons;
    const bilan = recos.synchroniserDiscord(r.valeur.salons, r.valeur.versions);
    setEtat((e) => ({ statut: 'connecte', utilisateur: r.valeur.sources.utilisateur, sources: r.valeur.sources, salons: r.valeur.salons, luA: Date.now(), conservable: e.conservable }));
    // Une seule notification par lecture, rien quand rien n'a changé.
    if (!bilanVide(bilan)) notifier({ message: t.notif.bilan(bilan) });
  }, [recuperer, recos, notifier, finDeSession, t]);

  // À l'ouverture de la page : le retour de l'autorisation Discord (site), puis
  // une lecture des salons si Discord est activé.
  useEffect(() => {
    if (pont) {
      // Ce que le système sait garder, et une connexion déjà en attente de son
      // code (la page a été rechargée entre-temps).
      void pont.etat().then((e) => {
        if (!e) return;
        setEtat((x) => ({ ...x, conservable: e.conservable, statut: e.attente && x.statut === 'inactif' ? 'code' : x.statut }));
      });
    } else {
      const search = window.location.search;
      const retour = retourDeConnexion(search);
      const code = codeBureau(search);
      if (retour || code) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      if (code) setCodeAffiche(code);
      // Une connexion demandée par l'application de bureau : dite ici, sans
      // toucher à celle du site.
      if (retour === 'refus-bureau' || retour === 'erreur-bureau') notifier({ message: retour === 'refus-bureau' ? t.notif.refusBureau : t.notif.erreurBureau });
      else if (retour) {
        finDeSession(retour === 'refus' ? t.notif.refus : t.notif.erreur);
        return;
      }
    }
    if (actif) void actualiser();
    // Une seule fois, à l'arrivée sur la page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connecter = useCallback(() => {
    if (!pont) {
      setDiscordActif(true);
      window.location.assign(URL_CONNEXION);
      return;
    }
    // Bureau : le navigateur du système s'ouvre ; « Discord activé » ne
    // s'allume qu'avec le code accepté.
    void pont.connecter().then((ok) => {
      if (ok) setEtat((e) => ({ ...e, statut: 'code' }));
    });
  }, [pont]);

  const validerCode = useCallback(async (code: string): Promise<IssueCodeDiscord> => {
    if (!pont) return 'sans-demande';
    const issue = (await pont.code(code)) ?? 'indisponible';
    if (issue === 'connecte') {
      setDiscordActif(true);
      await actualiser();
    } else if (issue === 'sans-demande') setEtat((e) => ({ ...e, statut: 'inactif' }));
    return issue;
  }, [pont, actualiser]);

  const annulerCode = useCallback(() => {
    void pont?.annuler();
    setEtat((e) => ({ ...e, statut: 'inactif' }));
  }, [pont]);

  const deconnecter = useCallback(async () => {
    await deconnecterService(recuperer);
    setDiscordActif(false);
    setEtat((e) => ({ ...ETAT_INACTIF, conservable: e.conservable }));
    notifier({ message: t.notif.deconnecte });
  }, [recuperer, notifier, t]);

  const issue = useCallback((type: ResultatPublication['type']) => {
    if (type === 'non-connecte') finDeSession(t.notif.expiree);
    else if (type === 'refuse') notifier({ message: t.notif.refusee });
    else if (type === 'invalide') notifier({ message: t.notif.invalide });
    else if (type === 'indisponible') notifier({ message: t.notif.indisponible });
  }, [finDeSession, notifier, t]);

  const publier = useCallback(async (reco: Reco) => {
    const lien = reco.lien;
    if (!lien) return 'refuse' as const;
    const r = await publierService(recuperer, lien.salonId, lien.base.messageId, encodeRecosJson([reco]));
    if (r.type === 'publie') {
      recos.apresPublicationDiscord(reco.id, r.version);
      notifier({ message: t.notif.publiee(lien.nomSalon) });
    } else if (r.type === 'conflit') {
      recos.apresConflitDiscord(reco.id, r.version);
      notifier({ message: t.notif.conflit });
    } else issue(r.type);
    return r.type;
  }, [recuperer, recos, notifier, issue, t]);

  const publierDans = useCallback(async (reco: Reco, salon: SalonDePublication, base: string | null) => {
    const r = await publierService(recuperer, salon.salonId, base, encodeRecosJson([reco]));
    if (r.type === 'publie') {
      // La version publiée devient tout de suite la recommandation liée du
      // salon, sans attendre une relecture (que le cache de 15 s du service
      // pourrait encore servir à l'ancienne).
      const versions = new Map<string, VersionSalon | null>([[salon.salonId, r.version]]);
      recos.synchroniserDiscord(salons.current, versions);
      notifier({ message: t.notif.publiee(salon.nomSalon) });
    } else if (r.type !== 'conflit') issue(r.type);
    return r;
  }, [recuperer, recos, notifier, issue, t]);

  return {
    etat, favoris, connecter, deconnecter, actualiser, validerCode, annulerCode,
    codeAffiche, fermerCode: () => setCodeAffiche(null), publier, publierDans,
  };
}
