# Recommandations — le service Discord

Ce document décrit le service qui synchronise les recommandations avec les
salons Discord d'une guilde : ses routes, ce qu'il vérifie, ce qu'il garde en
cache et comment il se construit. Les décisions et leurs raisons :
[local-par-defaut.md](../../../04-decisions/adr/local-par-defaut.md) et
[un-salon-une-reco.md](../../../04-decisions/adr/un-salon-une-reco.md).

Fichiers :
- [api/discord.mjs](../../../../api/discord.mjs) — la fonction Vercel ; elle charge le service empaqueté.
- [api/_source/discord.ts](../../../../api/_source/discord.ts) — le point d'entrée : variables d'environnement, routeur créé une fois par instance.
- [routeur.ts](../../../../api/_source/service/routeur.ts) — les routes.
- [droits.ts](../../../../api/_source/service/droits.ts) — les droits d'un membre sur un salon (calcul pur).
- [recoSalon.ts](../../../../api/_source/service/recoSalon.ts) — la version courante d'un salon et le fichier publié (calcul pur).
- [session.ts](../../../../api/_source/service/session.ts) — cookie chiffré, signature des lectures internes.
- [discordApi.ts](../../../../api/_source/service/discordApi.ts) — les appels à l'API de Discord.
- [scripts/construire-api.mjs](../../../../scripts/construire-api.mjs) — l'empaquetage au build.
- [vercel.json](../../../../vercel.json) — région et réécriture des routes.
- Tests : [tests/discord-service.test.ts](../../../../tests/discord-service.test.ts), devant un Discord simulé ([tests/discord-simule.ts](../../../../tests/discord-simule.ts)), qui sert aussi à la preuve de l'application de bureau (`npm run bureau:preuve -- --discord`).

## Routes

Toutes les routes `/api/discord/*` arrivent à la même fonction (réécriture de
`vercel.json`, qui passe le chemin en paramètre `chemin`). Les réponses sont
en JSON, jamais mises en cache par le navigateur ; une erreur se dit par un
code (`erreur`), que la page traduit.

| Route | Rôle |
| --- | --- |
| `GET login` | Renvoie vers l'autorisation Discord (scopes `identify` et `guilds`), avec un état anti-falsification gardé 10 minutes dans un cookie. `?bureau=<défi>` : la connexion est demandée par l'application de bureau (voir « Application de bureau ») ; le défi est gardé avec l'état, et un défi mal formé est refusé (400). |
| `GET callback` | Retour de Discord : vérifie l'état, échange le code contre les jetons, pose la session, renvoie vers `/#/siege/recommandations`. Refus du membre : `/?discord=refus#…` ; état faux ou échange raté : `/?discord=erreur#…`, sans session. Pour l'application de bureau : aucune session sur le site, renvoi vers `/?discord-bureau=<code>#…` (le code à copier), ou `refus-bureau` / `erreur-bureau`. |
| `GET invitation` | Renvoie vers l'invitation du bot sur un serveur (scope `bot`, **aucun droit** : `permissions=0`) ; l'admin l'ajoute ensuite aux salons de recommandations ([guide](installer-le-bot.md)). L'identifiant vient de l'environnement : un aperçu invite le bot de test. Sans session. |
| `POST bureau-echange` | Corps `{ code, secret }` : le code collé dans l'application de bureau, et le secret dont le défi est l'empreinte. Rend `{ session, utilisateur }` — la session scellée, que l'app garde ; 400 si le code est illisible, a plus de 10 minutes, ou si le secret ne correspond pas. |
| `GET session` | `{ connecte, utilisateur }` ; 401 sans session valide. |
| `POST deconnexion` | Révoque le jeton chez Discord et efface le cookie (204). |
| `GET sources` | Les serveurs communs au membre et au bot, et dans chacun les salons `blacksmith-reco…` que le bot et le membre peuvent lire, avec le droit de publier (`ecrire`) ; `botAdmin` signale un bot administrateur, sans bloquer. Un serveur sans tel salon n'est pas renvoyé. |
| `GET tout` | La lecture d'ouverture de la page, en une requête : les sources, puis `versions`, la version courante de chaque salon lisible. Le serveur, le bot et le membre n'y sont lus qu'une fois. |
| `GET salon?id=` | La version courante du salon (`messageId`, `date`, `reco`, ou `null` si le salon n'a jamais été publié) et `ecrire`. 403 si le membre ou le bot ne le lit pas, ou si ce n'est pas un salon de recommandations. |
| `POST publier` | Corps `{ salon, base, contenu }` : `base` est la version sur laquelle le membre a travaillé (`null` s'il n'en connaissait aucune), `contenu` le fichier JSON d'une recommandation. Voir « Publier ». |
| `GET brut?salon=&sig=` | Lecture interne d'un salon, signée, mise en cache par le CDN (voir « Cache »). |
| `GET salons-serveur?serveur=&sig=` | Lecture interne de la liste des salons d'un serveur, signée, mise en cache par le CDN (voir « Cache »). |

Une erreur `429` de Discord au-delà de l'attente tolérée répond `503 { erreur: 'limite' }` :
la page dit de réessayer dans une minute, plutôt qu'une panne.

## Droits

Recalculés à chaque requête, jamais crus de la page, comme Discord les
calcule : rôle `@everyone`, rôles du membre, propriétaire et administrateur,
puis les exceptions du salon (`@everyone`, rôles, membre).

- **Lire** : voir le salon et lire l'historique — pour le membre ET pour le bot.
- **Publier** : le membre lit et peut envoyer des messages ; le bot peut
  envoyer des messages et joindre des fichiers (sinon 503 `bot-sans-droit`).
- Le membre doit être membre du serveur : absent (404 chez Discord), il n'a
  aucun accès.

## Publier

1. Origine de la requête : la page elle-même (403 sinon), en plus du cookie
   `SameSite=Lax`. Une requête de l'application de bureau, qui n'a pas
   d'origine web, porte sa session en `Authorization: Bearer` : aucun cookie,
   donc rien qu'un autre site puisse faire porter à une requête.
2. Droits (403), puis droit du bot de joindre un fichier (503).
3. **Lecture directe du salon, jamais par le cache** : si sa version courante
   n'est pas `base`, réponse 409 `{ conflit, version }` avec la version à
   fusionner, et rien n'est posté. La page fusionne, puis republie avec la
   nouvelle base. Entre cette lecture et l'envoi reste une fenêtre de quelques
   centaines de millisecondes où la dernière publication gagne.
4. Le fichier doit contenir **une seule** recommandation valide
   ([recoShare.ts](src/lib/recoShare.ts)), de 256 Ko au plus (400 sinon).
5. Le service écrit l'**auteur** (celui de la version précédente, sinon le
   publieur), les **contributeurs** (ceux de la version précédente, plus le
   publieur s'il n'y est pas) et la **source** `discord:<serveur>:<salon>`.
   ⚠️ Ces trois champs viennent de la session et du salon, jamais du fichier
   reçu : un membre ne publie pas sous le nom d'un autre. Le nom du publieur
   est son surnom du serveur, à défaut son nom d'affichage.
6. Le bot poste un **nouveau message** qui ne contient que
   `recommandation.json` ; la réponse (201) rend la version publiée.

La version courante d'un salon est le plus récent fichier **valide**, parmi
les 100 derniers messages, qu'il vienne du bot ou d'un membre
([recoSalon.ts](../../../../api/_source/service/recoSalon.ts), `candidats`) :

- ⚠️ **Rien n'est cru avant validation.** Un candidat est une pièce jointe
  `.json` de 256 Ko au plus (taille annoncée par Discord), hébergée sur le
  CDN de Discord ; il est téléchargé, puis passé au validateur complet de
  l'import, et doit contenir exactement une recommandation. Sinon il est
  ignoré et le suivant est essayé, cinq au plus par lecture : un salon rempli
  de faux fichiers ne fait pas télécharger tout l'historique.
- Un fichier déposé à la main garde l'auteur et les contributeurs qu'il
  indique ; publier par-dessus en fait la base, comme une version du bot.
- ⚠️ **Il faut l'intent privilégié « Message Content »** (onglet *Bot* de
  l'application Discord, dans les deux applications) : sans lui, Discord
  rend au bot les messages des membres vides, sans pièce jointe, et seules
  ses propres publications se lisent.

## Session

Un cookie `HttpOnly`, `SameSite=Lax`, `Secure` hors du local, limité à
`/api/discord`, chiffré en AES-GCM avec la clé `CLE_SESSION` ; il porte les
deux jetons Discord du membre et son identité, pour 30 jours. Le jeton d'accès
(7 jours) est renouvelé à la volée à moins d'une minute de son échéance, et le
cookie réécrit. Un cookie illisible, altéré ou d'une autre clé vaut « pas de
session » ; un jeton refusé par Discord aussi, et le cookie est effacé. Un
jeton du **bot** refusé est une erreur de configuration (502), qui ne
déconnecte pas le membre.

La session porte aussi **sa propre fin** (`fin`, 30 jours, repoussée à chaque
renouvellement) : le cookie expire de lui-même, la session gardée par
l'application de bureau non.

## Application de bureau

L'app n'a ni cookie ni origine web
([bureau/README.md](../../bureau/README.md#discord) pour son côté) :

1. « Se connecter » tire un **secret** (32 octets) dans le processus
   principal, et ouvre le navigateur du système sur `login?bureau=<défi>`,
   le défi étant l'empreinte SHA-256 du secret.
2. Au retour de Discord, le service scelle la session avec le défi et une
   échéance de **10 minutes** : c'est le **code**, que le site affiche, à
   copier dans l'app. Il ne pose aucune session sur le site.
3. L'app envoie le code et son secret à `bureau-echange`, qui rend la session
   scellée. ⚠️ Le service ne garde rien : il ne peut pas empêcher qu'un code
   serve deux fois en 10 minutes ; sans le secret, qui n'a jamais quitté
   l'app, le code ne sert à rien. Le code n'est pas une session : présenté
   tel quel, il est refusé.
4. Ensuite, chaque appel porte la session en `Authorization: Bearer` (le
   cookie est alors ignoré). Une session renouvelée revient dans l'en-tête
   `x-session-discord`, jamais en cookie.

## Cache

- **Lecture d'un salon** : Discord n'accepte qu'environ 5 lectures par seconde
  et par salon. La route `salon` vérifie les droits du membre, puis lit la
  version par l'adresse interne `brut`, que le CDN de Vercel garde **15 s**
  (`Vercel-CDN-Cache-Control`), commune à tous les membres. Cette adresse est
  signée (HMAC de la clé `CLE_SESSION`) : sans signature, n'importe qui
  lirait une recommandation par l'identifiant de son salon. Sur un aperçu
  protégé, elle passe la protection avec `VERCEL_AUTOMATION_BYPASS_SECRET` ;
  si elle ne répond pas, la lecture se fait en direct. Un membre peut donc
  voir une version vieille de 15 s au plus ; une publication, elle, relit
  toujours en direct.
- ⚠️ **Liste des salons d'un serveur** : Discord n'en accepte que **10
  lectures par minute et par serveur**, pour tout le bot — un quota partagé
  par toute la guilde (mesuré le 2026-11-09). Elle passe donc par l'adresse
  interne signée `salons-serveur`, que le CDN garde **60 s**, et seule la
  découverte des salons (`tout`, `sources`) la lit. L'accès à un salon précis
  (lecture, publication) lit le salon seul (`/channels/{id}`, limite large),
  jamais cette liste.
- **Droits** : le serveur (rôles, propriétaire), le bot et chaque membre
  restent **30 s** en mémoire de l'instance. Un échec n'est pas gardé.
  L'identifiant du bot se tire de son jeton, sans appel.
- **Autres quotas relevés** : la liste des serveurs (`/users/@me/guilds`)
  1 lecture par seconde ; un membre d'un serveur, 5 par seconde ; les
  messages d'un salon, 5 par seconde.
- Une réponse 429 de Discord avec une attente de 2 s au plus est réessayée
  une fois.

## Construire et configurer

- **Empaqueté au build** : Vercel compile chaque fichier de `api` séparément,
  et dans un projet ESM un import relatif sans extension — ceux de `src/` —
  échoue à l'exécution. `npm run build` lance donc, après Vite,
  `scripts/construire-api.mjs`, qui empaquette chaque point d'entrée de
  `api/_source/` avec esbuild ; la fonction `api/discord.mjs` charge le
  paquet. Un dossier dont le nom commence par `_` ne devient pas une fonction.
- **Région** : Paris (`cdg1`), dans `vercel.json`.
- **Variables d'environnement** (Vercel, jamais dans le dépôt) :
  `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN` et
  `CLE_SESSION` (32 octets aléatoires en base64). Production : l'application
  Discord de production ; Preview et Development : l'application de test.
- **Adresses de retour** déclarées dans l'application Discord :
  `<origine>/api/discord/callback` — la production
  (`https://sw-blacksmith.vercel.app`), l'alias d'aperçu de la branche testée
  et `http://localhost:3000` pour le développement.
- **En local** : `npm run dev:api` empaquette le service puis lance
  `vercel dev` (site et fonctions sur `http://localhost:3000`), avec les
  variables de l'environnement Development du projet. À relancer après une
  modification du service.
