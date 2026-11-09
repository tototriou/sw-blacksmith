# Local par défaut, connecté sur demande

## Décision

- **SW Blacksmith fonctionne en local par défaut** : sans connexion, l'app lit l'export de compte
  dans la page, garde ses données sur l'appareil (seulement avec l'accord de l'utilisateur) et
  n'envoie rien. C'est vrai sur le site comme dans l'application de bureau.
- **Une seule fonctionnalité passe par le réseau, et seulement sur demande** : la synchronisation
  des recommandations de siège avec Discord. Rien ne part sans un geste de l'utilisateur : se
  connecter à Discord, puis publier. Le modèle de cette synchronisation :
  [un-salon-une-reco.md](un-salon-une-reco.md).
- **Le service qui la porte ne garde rien.** Ce sont des fonctions sans état, hébergées sur Vercel
  dans le même projet que le site (dossier `api` de ce dépôt). Elles relaient chaque requête vers
  l'API REST de Discord avec le jeton du bot, sans base de données ni connexion permanente au
  Gateway. Les recommandations vivent sur l'appareil du membre et dans les salons Discord.
- **La session tient dans un cookie** `HttpOnly` signé et chiffré, sur le site, pour 30 jours. Il
  contient le jeton Discord du membre et son jeton de renouvellement, pour relire ses serveurs à
  chaque requête. Dans l'application de bureau, la session est gardée par `safeStorage` dans le
  processus principal, d'où partent les appels au service.
- **L'app demande le strict nécessaire à Discord** : l'identité du membre (`identify`) et la liste
  de ses serveurs (`guilds`), croisée avec ceux du bot. Les droits du membre sur chaque salon sont
  recalculés par le service à chaque requête, avec un cache en mémoire de 30 secondes au plus.
- **La lecture d'un salon est partagée** : après la vérification des droits de chaque membre, la
  version courante d'un salon se lit par une adresse interne signée, que le CDN de Vercel garde
  15 secondes pour tous les membres. Une publication relit toujours le salon en direct.
- **Le bot ne reçoit aucune permission à l'invitation** : un admin de guilde l'ajoute dans chaque
  salon de recommandations. Un bot de test distinct, sur un serveur de test, sert aux aperçus
  Vercel.

## Raisons

- **Le local est la promesse de l'app** : un joueur qui ne veut pas de Discord garde
  exactement l'app qu'il connaît, sans compte et sans envoi.
- **Partager des recommandations par fichier demande un aller-retour à la main** : exporter,
  envoyer, importer. Un salon Discord, que la guilde utilise déjà, sert de source commune sans
  fichier à échanger.
- **Un service sans état n'a rien à protéger ni à perdre** : aucune donnée de joueur ne s'y
  accumule, et il n'y a aucun serveur à maintenir en plus du site.
- **Le même projet que le site** donne un cookie de même origine (aucun échange entre domaines à
  autoriser) et partage tel quel le validateur des recommandations
  ([recoShare.ts](../../../src/lib/recoShare.ts)), qui sert déjà aux imports de fichiers.
- **Garder le jeton Discord dans le cookie** tient la liste des serveurs toujours à jour : un
  serveur rejoint après la connexion apparaît sans se reconnecter.
- **Discord n'accepte qu'environ 5 lectures par seconde et par salon** : un soir de siège, toute
  la guilde ouvre la page en même temps. Un cache commun à tous les membres tient ce débit ; un
  cache par instance de fonction ne le tiendrait pas, Vercel en lançant plusieurs sous la charge.
- **Un bot sans permission à l'invitation ne voit que les salons où on l'a ajouté** ; un bot de
  test distinct empêche qu'une branche poussée, dont l'aperçu porte les variables d'environnement,
  écrive dans les salons des vraies guildes avec le jeton de production.

## Options écartées

- **Discord au cœur de la page Recommandations** (possibilité écartée) : le local deviendrait le
  mode de repli d'une app qui se veut locale.
- **Discord comme simple canal d'échange de fichiers** (possibilité écartée) : publier un fichier
  et le réimporter à la main garde l'aller-retour qu'on veut supprimer.
- **Un serveur permanent connecté au Gateway** (possibilité écartée) : il permettrait de réagir aux
  messages en direct, au prix d'un hébergement payant à surveiller ; rien de ce qui est prévu ne
  l'exige.
- **Le service dans un dépôt à part** (possibilité écartée) : il faudrait partager le validateur
  entre deux dépôts, et gérer le cookie et les requêtes entre deux origines.
- **Le scope `identify` seul** (possibilité écartée) : le service devrait demander à chaque serveur
  du bot si le membre en fait partie, ce qui ne tient plus dès que le bot sert plusieurs dizaines
  de guildes.
- **Une liste des serveurs signée dans le cookie, jeton jeté** (possibilité écartée) : un serveur
  rejoint ensuite n'apparaîtrait qu'après une reconnexion.
- **Des extensions `.js` dans les imports de `src/` qu'atteint le service** (possibilité
  écartée) : une règle d'import propre à une partie de `src/`, qu'un import ajouté plus tard
  oublierait.
- **Le cache de fonctions de Vercel (Runtime Cache)** (possibilité écartée) : une dépendance de
  plus, propre à Vercel, pour ce que le CDN fait déjà.
- **Réessayer sans cache quand Discord refuse** (possibilité écartée) : la page mettrait plusieurs
  secondes à charger un soir de siège.
- **Les permissions du bot sur tout le serveur** (possibilité écartée) : l'installation tiendrait
  en un clic, mais le bot verrait tous les salons publics.

## Conséquences

- **« 100 % local » se dit « local par défaut »** : rien ne quitte l'appareil sans un geste de
  l'utilisateur. Aucune mesure d'audience, sur le site comme dans l'application de bureau
  ([conventions.md](../../03-developpeur/conventions.md)).
- **Le site a un service** : des secrets (identifiant et secret OAuth, jeton du bot, clé de la
  session) en variables d'environnement Vercel, jamais dans le dépôt, qui est public.
- **Le dépôt gagne un dossier `api`**, couvert par `tsc`, ESLint et les tests comme le reste.
- **Le service est empaqueté au build** : Vercel compile chaque fichier de `api` séparément, et
  dans un projet ESM un import relatif sans extension, comme ceux de `src/`, échoue à l'exécution.
  `npm run build` empaquette donc le service avec esbuild, et la fonction charge le paquet ; `src/`
  garde ses imports. Les fonctions tournent à Paris. Le détail :
  [service-discord.md](../../02-app/siege/feat-recommandations/service-discord.md).
