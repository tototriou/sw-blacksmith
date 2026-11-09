// Point d'entrée du service Discord, empaqueté par scripts/construire-api.mjs
// vers api/_paquet/discord.mjs, que charge la fonction api/discord.mjs.
// Les secrets viennent des variables d'environnement de Vercel, jamais du dépôt.

import { fr } from '../../src/i18n/fr';
import { creerRouteur } from './service/routeur';
import { lireCle } from './service/session';

// Créé une fois par instance : les caches en mémoire (droits, rôles, salons,
// 30 s) servent aux requêtes suivantes de la même instance.
let routeur: ReturnType<typeof creerRouteur> | null = null;

function obtenirRouteur() {
  if (!routeur) {
    const env = process.env;
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DISCORD_BOT_TOKEN) throw new Error('variables Discord manquantes');
    routeur = creerRouteur({
      env: {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        jetonBot: env.DISCORD_BOT_TOKEN,
        cle: lireCle(env.CLE_SESSION),
        contournement: env.VERCEL_AUTOMATION_BYPASS_SECRET,
      },
      recuperer: (url, init) => fetch(url, init),
      maintenant: () => Date.now(),
      attendre: (ms) => new Promise((r) => setTimeout(r, ms)),
      t: fr,
      lectureEnCache: true,
    });
  }
  return routeur;
}

export default {
  async fetch(requete: Request): Promise<Response> {
    try {
      return await obtenirRouteur().traiter(requete);
    } catch (e) {
      // Le détail reste dans le journal de la fonction, jamais dans la réponse.
      console.error(e);
      return Response.json({ erreur: 'service' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
  },
};
