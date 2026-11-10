// La fonction Vercel du service Discord : elle charge le service empaqueté au
// build (scripts/construire-api.mjs). Toutes les routes /api/discord/* y
// arrivent par la réécriture de vercel.json.
// ⚠️ Un gestionnaire par méthode, pas `export default { fetch }` : le serveur
// local de `vercel dev` ne sait pas exécuter le second.
import service from './_paquet/discord.mjs';

export const GET = (requete) => service.fetch(requete);
export const POST = (requete) => service.fetch(requete);
