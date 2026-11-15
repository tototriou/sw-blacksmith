// Déclare la commande slash `/speedtune` auprès de l'application Discord.
// Une fois suffit (ou après un changement de la commande) : Discord la garde.
//
//   DISCORD_CLIENT_ID=… DISCORD_BOT_TOKEN=… node scripts/enregistrer-commande-speedtune.mjs [--serveur <id>] [--retirer]
//
// Sans option : la commande est GLOBALE, elle vaut sur tous les serveurs où le
// bot est installé, présents et à venir (quelques minutes pour apparaître).
// C'est la déclaration normale, pour l'application de prod comme pour celle de
// test. `--serveur` : elle ne vaut que sur ce serveur, et y apparaît aussitôt.
// `--retirer` : retire la commande (globale, ou de ce serveur) au lieu de la
// déclarer — une commande déclarée sur un serveur ET globalement y apparaît
// deux fois. Les deux variables sont celles de l'application visée (Vercel :
// `vercel env pull`), jamais écrites dans le dépôt.

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
    // ⚠️ Discord refuse une description de plus de 100 caractères (HTTP 400).
    description: 'Preparation screen: your three attackers on the left, SPD under each portrait',
    description_localizations: { fr: 'Écran de préparation : tes trois attaquants à gauche, VIT sous chaque portrait' },
    required: true,
  }],
};

const chemin = serveur ? `/applications/${app}/guilds/${serveur}/commands` : `/applications/${app}/commands`;
const ou = serveur ? `sur le serveur ${serveur}` : 'partout';
const entetes = { Authorization: `Bot ${jeton}`, 'Content-Type': 'application/json' };

if (process.argv.includes('--retirer')) {
  const liste = await fetch(API + chemin, { headers: entetes });
  if (!liste.ok) {
    console.error(`Refusé par Discord (HTTP ${liste.status}) :`, await liste.text());
    process.exit(1);
  }
  const existante = (await liste.json()).find((c) => c.name === commande.name);
  if (!existante) {
    console.log(`/speedtune n'était pas déclarée ${ou} : rien à retirer.`);
    process.exit(0);
  }
  const r = await fetch(`${API}${chemin}/${existante.id}`, { method: 'DELETE', headers: entetes });
  if (!r.ok) {
    console.error(`Refusé par Discord (HTTP ${r.status}) :`, await r.text());
    process.exit(1);
  }
  console.log(`/speedtune retirée ${ou}.`);
  process.exit(0);
}

const r = await fetch(API + chemin, { method: 'POST', headers: entetes, body: JSON.stringify(commande) });
const corps = await r.json().catch(() => ({}));
if (!r.ok) {
  console.error(`Refusé par Discord (HTTP ${r.status}) :`, JSON.stringify(corps));
  process.exit(1);
}
console.log(`/speedtune déclarée ${ou} (commande ${corps.id}).`);
