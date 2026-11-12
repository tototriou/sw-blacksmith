// La fonction Vercel des interactions Discord (`/speedtune`) : elle charge le
// service empaqueté au build (scripts/construire-api.mjs). Adresse à déclarer
// dans l'application Discord : <origine>/api/interactions.
// ⚠️ Un gestionnaire par méthode, pas `export default { fetch }` : le serveur
// local de `vercel dev` ne sait pas exécuter le second.
import service from './_paquet/interactions.mjs';

export const POST = (requete) => service.fetch(requete);
