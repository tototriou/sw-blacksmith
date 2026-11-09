// La fonction Vercel du service Discord : elle charge le service empaqueté au
// build (scripts/construire-api.mjs). Toutes les routes /api/discord/* y
// arrivent par la réécriture de vercel.json.
export { default } from './_paquet/discord.mjs';
