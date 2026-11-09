import { useCallback, useEffect, useRef, useState } from 'react';
import type { Reco, VersionSalon } from '../types';
import type { UseRecoState } from './useSiegeRecos';
import { setDiscordActif, useReglagesDiscord } from './useReglagesDiscord';
import { useTraduction } from './useLangue';
import { useNotifier } from '../ui/Notification';
import { estBureau } from '../lib/bureau';
import { encodeRecosJson } from '../lib/recoShare';
import { bilanVide, type SalonDePublication } from '../lib/provenancesRecos';
import type { SalonAccessible } from '../lib/recoDiscord';
import {
  deconnecter as deconnecterService, lireTout, publier as publierService, retourDeConnexion, URL_CONNEXION,
  type Recuperer, type ResultatPublication, type Sources, type Utilisateur,
} from '../lib/discordClient';

// La synchronisation des recommandations avec Discord, côté page
// (docs/02-app/siege/feat-recommandations/synchronisation-discord.md) :
// lecture des salons, publication, connexion et déconnexion.
//
// ⚠️ **Rien ne part sans un geste de l'utilisateur** : tant que le réglage
// « Discord activé » est éteint, ce hook n'appelle jamais le service. Il
// s'allume au clic sur « Se connecter à Discord » et s'éteint à la
// déconnexion, à une session échue ou à une connexion refusée.
//
// ⚠️ L'application de bureau n'a pas encore de session Discord : le statut y
// est `bureau`, et la connexion reste désactivée.

export type StatutDiscord = 'inactif' | 'bureau' | 'lecture' | 'connecte' | 'indisponible';

export interface EtatDiscord {
  statut: StatutDiscord;
  utilisateur: Utilisateur | null;
  sources: Sources | null;
  salons: SalonAccessible[];
  luA: number | null; // dernière lecture réussie, en ms
}

export interface UseDiscord {
  etat: EtatDiscord;
  favoris: string[];
  connecter: () => void;
  deconnecter: () => Promise<void>;
  actualiser: () => Promise<void>;
  // La publication d'une recommandation LIÉE, depuis son bandeau.
  publier: (reco: Reco) => Promise<ResultatPublication['type']>;
  // « Publier dans… » d'une recommandation de cet appareil. Un conflit rend la
  // version que porte le salon : la page demande alors s'il faut la remplacer.
  publierDans: (reco: Reco, salon: SalonDePublication, base: string | null) => Promise<ResultatPublication>;
}

const recupererParDefaut: Recuperer = (url, init) => fetch(url, init);
const ETAT_INACTIF: EtatDiscord = { statut: 'inactif', utilisateur: null, sources: null, salons: [], luA: null };

export function useDiscord(recos: UseRecoState, recuperer: Recuperer = recupererParDefaut): UseDiscord {
  const t = useTraduction().recosDiscord;
  const notifier = useNotifier();
  const { actif, favoris } = useReglagesDiscord();
  const bureau = estBureau();
  const [etat, setEtat] = useState<EtatDiscord>(bureau ? { ...ETAT_INACTIF, statut: 'bureau' } : ETAT_INACTIF);
  const salons = useRef<SalonAccessible[]>([]);

  const finDeSession = useCallback((message: string) => {
    setDiscordActif(false);
    setEtat(ETAT_INACTIF);
    notifier({ message });
  }, [notifier]);

  const actualiser = useCallback(async () => {
    if (bureau) return;
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
    setEtat({ statut: 'connecte', utilisateur: r.valeur.sources.utilisateur, sources: r.valeur.sources, salons: r.valeur.salons, luA: Date.now() });
    // Une seule notification par lecture, rien quand rien n'a changé.
    if (!bilanVide(bilan)) notifier({ message: t.notif.bilan(bilan) });
  }, [bureau, recuperer, recos, notifier, finDeSession, t]);

  // À l'ouverture de la page : le retour de l'autorisation Discord, puis une
  // lecture des salons si Discord est activé.
  useEffect(() => {
    if (bureau) return;
    const retour = retourDeConnexion(window.location.search);
    if (retour) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      finDeSession(retour === 'refus' ? t.notif.refus : t.notif.erreur);
      return;
    }
    if (actif) void actualiser();
    // Une seule fois, à l'arrivée sur la page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connecter = useCallback(() => {
    if (bureau) return;
    setDiscordActif(true);
    window.location.assign(URL_CONNEXION);
  }, [bureau]);

  const deconnecter = useCallback(async () => {
    await deconnecterService(recuperer);
    setDiscordActif(false);
    setEtat(ETAT_INACTIF);
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

  return { etat, favoris, connecter, deconnecter, actualiser, publier, publierDans };
}
