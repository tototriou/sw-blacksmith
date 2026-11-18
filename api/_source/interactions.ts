// Point d'entrée des interactions Discord (`/speedtune`), empaqueté par
// scripts/construire-api.mjs vers api/_paquet/interactions.mjs, que charge la
// fonction api/interactions.mjs. Les secrets viennent des variables
// d'environnement de Vercel, jamais du dépôt.
//
// Les données voyagent dans le paquet (banque de portraits, gabarits de
// chiffres, monstres) ; les fiches de compétences (une par monstre, 16 Mo en
// tout) sont lues sur le site lui-même, trois par capture.

import { waitUntil } from '@vercel/functions';
import type { Monster } from '../../src/types';
import type { DetailMonstre } from '../../src/lib/monsterSkills';
import donneesMonstres from '../../public/data/monsters.json';
import banqueSerialisee from './capture/banque-portraits.json';
import gabarits from './capture/chiffres-gabarits.json';
import { Banque, type BanqueSerialisee } from './capture/portraits';
import type { Gabarits } from './capture/chiffres';
import { creerInteractions, type Ressources } from './speedtune/interactions';
import { creerEmojis } from './speedtune/emojis';

let ressources: Ressources | null = null;
let origine = '';

function obtenirRessources(): Ressources {
  if (!ressources) {
    const parId = new Map((donneesMonstres as unknown as { monsters: Monster[] }).monsters.map((m) => [m.com2usId, m]));
    const fiches = new Map<number, DetailMonstre | null>();
    const contournement = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    ressources = {
      banque: new Banque(banqueSerialisee as BanqueSerialisee),
      gabarits: gabarits as Gabarits,
      monstre: (id) => parId.get(id),
      // Le jeton du bot (celui du service des recos) gère ses émojis ; sans
      // lui, pas d'icônes dans le texte.
      ...(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CLIENT_ID
        ? { emojis: creerEmojis((url, init) => fetch(url, init), process.env.DISCORD_CLIENT_ID.trim(), process.env.DISCORD_BOT_TOKEN.trim()) }
        : {}),
      async detail(id) {
        if (fiches.has(id)) return fiches.get(id) ?? null;
        // Sur un aperçu protégé, le site ne répond qu'avec le secret de
        // contournement (comme la lecture interne du service des recos).
        const r = await fetch(`${origine}/data/skills/${id}.json`, contournement ? { headers: { 'x-vercel-protection-bypass': contournement } } : undefined);
        const fiche = r.ok ? ((await r.json()) as DetailMonstre) : null;
        fiches.set(id, fiche);
        return fiche;
      },
    };
  }
  return ressources;
}

export default {
  async fetch(requete: Request): Promise<Response> {
    try {
      const env = process.env;
      if (!env.DISCORD_PUBLIC_KEY || !env.DISCORD_CLIENT_ID) throw new Error('variables Discord manquantes');
      origine = new URL(requete.url).origin;
      return await creerInteractions({
        // ⚠️ Sans espaces autour : une clé collée avec un espace ou un saut de
        // ligne ne fait plus 64 caractères hexadécimaux, et TOUTE signature
        // était refusée — Discord n'arrivait pas à valider l'adresse.
        clePublique: env.DISCORD_PUBLIC_KEY.trim(),
        applicationId: env.DISCORD_CLIENT_ID.trim(),
        recuperer: (url, init) => fetch(url, init),
        differer: (travail) => waitUntil(travail),
        ressources: async () => obtenirRessources(),
      }).traiter(requete);
    } catch (e) {
      // Le détail reste dans le journal de la fonction, jamais dans la réponse.
      console.error(e);
      return Response.json({ erreur: 'service' }, { status: 500 });
    }
  },
};
