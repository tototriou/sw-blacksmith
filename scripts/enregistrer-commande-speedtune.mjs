// Déclare la commande slash `/speedtune` auprès de l'application Discord.
// Une fois suffit (ou après un changement de la commande) : Discord la garde.
//
//   DISCORD_CLIENT_ID=… DISCORD_BOT_TOKEN=… node scripts/enregistrer-commande-speedtune.mjs [--serveur <id>]
//
// `--serveur` : la commande ne vaut que sur ce serveur, et y apparaît aussitôt
// (pour tester avec l'application de test). Sans lui, elle vaut partout où le
// bot est installé. Les deux variables sont celles de l'application visée
// (Vercel : `vercel env pull`), jamais écrites dans le dépôt.

const API = 'https://discord.com/api/v10';
const { DISCORD_CLIENT_ID: app, DISCORD_BOT_TOKEN: jeton } = process.env;
if (!app || !jeton) {
  console.error('DISCORD_CLIENT_ID et DISCORD_BOT_TOKEN sont requis.');
  process.exit(1);
}
const i = process.argv.indexOf('--serveur');
const serveur = i > 0 ? process.argv[i + 1] : null;
if (serveur !== null && !/^\d{1,20}$/.test(serveur ?? '')) {
  console.error('--serveur attend l\'identifiant d\'un serveur.');
  process.exit(1);
}

const commande = {
  name: 'speedtune',
  description: 'Speed tune of a siege team, read from a screenshot of the battle preparation screen',
  description_localizations: { fr: 'Speed tune d\'une équipe de siège, lu sur une capture de l\'écran de préparation' },
  options: [{
    type: 11, // pièce jointe
    name: 'capture',
    name_localizations: { 'en-US': 'screenshot', 'en-GB': 'screenshot' },
    description: 'Screenshot of the preparation screen: your three attackers on the left, their SPD under each portrait',
    description_localizations: { fr: 'Capture de l\'écran de préparation : tes trois attaquants à gauche, leur VIT sous chaque portrait' },
    required: true,
  }],
};

const chemin = serveur ? `/applications/${app}/guilds/${serveur}/commands` : `/applications/${app}/commands`;
const r = await fetch(API + chemin, {
  method: 'POST',
  headers: { Authorization: `Bot ${jeton}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(commande),
});
const corps = await r.json().catch(() => ({}));
if (!r.ok) {
  console.error(`Refusé par Discord (HTTP ${r.status}) :`, JSON.stringify(corps));
  process.exit(1);
}
console.log(`/speedtune déclarée ${serveur ? `sur le serveur ${serveur}` : 'partout'} (commande ${corps.id}).`);
