// La vérification quotidienne de la mise à jour (bureau/miseAJour.ts) : ce
// que fait chaque contrôle périodique, selon l'état de la mise à jour et
// l'heure de la dernière recherche.
//
// Ce module est PUR (aucun import d'Electron ni de Node) :
// `tests/bureau-mise-a-jour.test.ts` le parcourt phase par phase.
//
// ⚠️ **Le même mécanisme que le lancement** : une recherche silencieuse, puis
// la même notification si une version est trouvée. Rien ne se télécharge sans
// « Mettre à jour ».

/** Au-delà de ce délai depuis la dernière recherche, le contrôle en relance une. */
export const DELAI_VERIFICATION_MS = 24 * 60 * 60 * 1000;

/**
 * Le pas du contrôle : une app restée ouverte est vérifiée au plus tard
 * 25 h après la recherche précédente. Le réveil de la machine contrôle aussi.
 */
export const PAS_CONTROLE_MS = 60 * 60 * 1000;

// Les phases de bureau/miseAJour.ts, recopiées pour rester pur.
export type PhaseVerifiee =
  | 'aucune'
  | 'recherche'
  | 'a-jour'
  | 'injoignable'
  | 'disponible'
  | 'telechargement'
  | 'prete'
  | 'echec';

/**
 * `chercher` : une nouvelle recherche, comme celle du lancement.
 * `rappeler` : une version est déjà proposée (la notification a pu être
 * fermée par la croix) : la même notification revient, SANS nouvelle
 * recherche — une recherche qui échouerait hors ligne effacerait l'offre.
 * `rien` : trop tôt, ou quelque chose est en cours (recherche,
 * téléchargement, mise à jour prête à installer).
 */
export type ActionPeriodique = 'chercher' | 'rappeler' | 'rien';

/**
 * Ce que fait le contrôle à `maintenant`, la dernière recherche (ou le
 * dernier rappel) datant de `derniere` (ms). Une horloge qui recule
 * (changement d'heure manuel) compte comme un délai écoulé : sinon, plus rien
 * ne se vérifierait avant que l'heure rattrape l'ancienne.
 */
export function actionPeriodique(phase: PhaseVerifiee | null, derniere: number, maintenant: number): ActionPeriodique {
  const ecoule = maintenant - derniere;
  if (ecoule >= 0 && ecoule < DELAI_VERIFICATION_MS) return 'rien';
  switch (phase) {
    case null:
    case 'aucune':
    case 'a-jour':
    case 'injoignable':
      return 'chercher';
    case 'disponible':
    case 'echec':
      return 'rappeler';
    case 'recherche':
    case 'telechargement':
    case 'prete':
      return 'rien';
  }
}
