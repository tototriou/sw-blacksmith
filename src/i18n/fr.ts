// Les textes de l'interface en FRANÇAIS — la langue SOURCE.
// Décision : docs/04-decisions/adr/traductions-par-dictionnaires.md.
//
// ⚠️ **Sa forme fait le type `Dictionnaire`** : chaque autre langue doit avoir
// exactement les mêmes clés (`tsc` refuse une clé absente ou de trop). Un texte
// qui dépend d'une valeur s'écrit comme une fonction, et sa signature est
// imposée aux autres langues de la même façon.
//
// ⚠️ Un texte s'écrit ICI, jamais en dur dans un composant : la règle locale
// d'ESLint `swblacksmith/texte-en-dur` le refuse dans les fichiers migrés.
//
// ⚠️ **Les libellés du jeu sont ceux du jeu dans la langue de l'entrée**, jamais
// une traduction faite par nous.

import { jeuFr } from './jeu/fr';

export const fr = {
  // Le vocabulaire du jeu : src/i18n/jeu/.
  jeu: jeuFr,

  // Les sections de la prépa RTA qui ne sont pas un set.
  sectionsRta: { autre: 'Autre', nonClasse: 'Non classé' },

  langue: {
    titre: 'Langue',
    auto: 'Auto',
    autoNavigateur: 'Suit la langue de ton navigateur',
    autoSysteme: 'Suit la langue de ton système',
  },

  theme: {
    auto: 'Auto',
    autoNavigateur: 'Suit le thème de ton navigateur',
    autoSysteme: 'Suit le thème de ton système',
    clair: 'Clair',
    clairAide: 'Atelier — fond clair, encre chaude',
    sombre: 'Sombre',
    sombreAide: 'Forge — fond profond, accent braise',
  },

  mesure: {
    efficience: 'Efficience',
    efficienceAide: 'Efficience communautaire (principale incluse, /2,8)',
    score: 'Score SW',
    scoreAide: 'Score affiché dans le jeu (stats secondaires uniquement)',
  },

  // Les destinations de la navigation : barre latérale, onglets du bas, panneau
  // mobile, barre du haut, palette. ⚠️ Des CHAÎNES seulement : les constantes de
  // navigation y pointent par leur clé (`texte`).
  navigation: {
    accueil: 'Accueil',
    rta: 'RTA',
    siege: 'Siège',
    arene: 'Arène',
    prepa: 'Ma prépa',
    ami: 'Ami',
    monstres: 'Monstres',
    runes: 'Runes',
    artefacts: 'Artéfacts',
    optimizer: 'Optimizer',
    speedTuning: 'Speed tuning',
    defense: 'Défense',
    offense: 'Offense',
    recommandations: 'Recommandations',
    bestiaire: 'Bestiaire',
    mecaniques: 'Mécaniques',
    nouveautes: 'Nouveautés',
    telecharger: 'Télécharger',
    parametres: 'Paramètres',
    jouer: 'Jouer',
    monCompte: 'Mon compte',
    compte: 'Compte',
    outils: 'Outils',
    ressources: 'Ressources',
    bientot: 'Bientôt',
    // Les vues des inventaires du compte.
    maBox: 'Ma box',
    resume: 'Résumé',
    liste: 'Liste',
    courbes: 'Courbes',
    comparaison: 'Comparaison',
    optimisation: 'Optimisation',
    meules: 'Meules',
    gemmes: 'Gemmes',
  },

  // La mention du volet qui affiche une page, en écran partagé.
  volet: {
    droite: 'à droite',
    gauche: 'à gauche',
    verrouille: 'verrouillé',
  },

  ecranPartage: {
    volet: (actif: boolean, page: string) => `Volet ${actif ? 'actif' : 'inactif'} : ${page}`,
    filAriane: "Fil d'Ariane du volet",
    verrouille: 'Verrouillé',
    options: 'Options',
    optionsAide: 'Les actions de la page, rangées comme au téléphone dans ce volet étroit',
    deverrouiller: 'Déverrouiller ce volet',
    unSeulVerrou: 'Un seul volet verrouillé à la fois',
    verrouiller: 'Verrouiller ce volet : sa page ne changera plus en naviguant',
    inverser: 'Inverser les volets',
    deverrouillerPourFermer: 'Déverrouiller pour fermer',
    fermer: 'Fermer ce volet',
    nouveauVolet: 'Nouveau volet',
    ouvrirPage: 'Ouvrir une page dans ce volet',
    rechercherPage: 'Rechercher une page…',
    rechercherPageAide: "Essaie le nom d'une page : RTA, Siège, Runes…",
  },

  barreHaut: {
    filAriane: "Fil d'Ariane",
    ecranPartage: 'Écran partagé',
    revenirUnePage: 'Revenir à une seule page',
    ouvrirSecondePage: 'Ouvrir une seconde page à côté',
    fenetreEtroite: 'Fenêtre trop étroite pour deux pages : agrandis-la ou replie la barre latérale',
    sauvegarder: 'Sauvegarder',
    sauvegarderDans: (fichier: string) => `Sauvegarder dans ${fichier} (Ctrl+S)`,
    sauvegarderFichier: 'Sauvegarder la session dans un fichier (Ctrl+S)',
    sauvegarderSous: 'Sauvegarder sous…',
    sauvegarderSousAide:
      'Enregistrer la session dans un autre fichier, qui devient la session en cours (l’ancien n’est plus modifié)',
    sauvegarderSession: 'Sauvegarder la session (Ctrl+S)',
    deconnexion: 'Se déconnecter',
    deconnexionAide: 'Effacer mes données de cet appareil',
    rechercher: 'Rechercher',
    rechercherAide: 'Rechercher une page, un monstre, une action',
    parametres: 'Paramètres',
    fermerParametres: 'Fermer les paramètres',
  },

  onglets: {
    navigationPrincipale: 'Navigation principale',
    actionsPage: 'Filtres et actions de la page',
    options: 'Options',
  },

  barreLaterale: {
    ouvrirACote: (page: string) => `Ouvrir « ${page} » à côté`,
    deplier: 'Déplier la navigation',
    replier: 'Replier la navigation',
    rechercherPage: 'Rechercher une page',
    rechercherPageAide: 'Rechercher une page (⌘K)',
    allerA: 'Aller à…',
    raccourci: 'Ctrl K',
  },

  panneauNavigation: {
    vuesDe: (groupe: string) => `Vues de ${groupe}`,
    sectionsDe: (section: string) => `Sections de ${section}`,
  },

  carteCompte: {
    aucunCompte: 'Aucun compte',
    exportDu: (date: string) => `Export du ${date}`,
    monstres: (n: number) => `${n} monstres`,
    importerExport: 'Importer un export SWEX',
    importerCompte: 'Importer un compte',
    importerAide: "Importer un export de compte SWEX (traité localement, rien n'est envoyé)",
    changerCompte: 'Changer de compte',
    importerFichier: 'Importer un fichier…',
  },

  palette: {
    titre: 'Rechercher',
    invite: 'Rechercher une page, un monstre, une action…',
    aide: "Essaie un nom de monstre, de page ou d'action.",
    echap: 'Échap',
    resultats: 'Résultats',
    aucunResultat: (saisie: string) => `Aucun résultat pour « ${saisie} »`,
    pages: 'Pages',
    monstres: 'Monstres',
    actions: 'Actions',
    fiche: 'Fiche',
    speedTuning: (noms: string) => `Speed tuning · ${noms}`,
    equipeDefense: (rang: number) => `Défense · équipe ${rang}`,
    equipeOffense: (rang: number) => `Offense · équipe ${rang}`,
    importerCompte: 'Importer mon compte',
    sauvegarderSession: 'Sauvegarder la session',
    sauvegarderSessionAide: 'Tout l’état de l’app dans un fichier',
    sauvegarderSous: 'Sauvegarder sous…',
    sauvegarderSousAide: 'Un autre fichier, qui devient la session en cours',
    theme: (theme: string) => `Thème ${theme.toLowerCase()}`,
    langue: (langue: string) => `Langue : ${langue}`,
    creerRecommandation: 'Créer une recommandation',
    mesure: (mesure: string) => `Mesure : ${mesure}`,
  },

  parametres: {
    titre: 'Paramètres',
    intro: "Ces réglages valent pour toute l'application et restent sur cet appareil.",
    compteCharge: 'Compte chargé',
    compte: 'Compte',
    aucunCompte: 'Aucun compte chargé',
    blocReglages: 'Réglages',
    blocDonnees: 'Mes données',
    blocApplication: 'Application',
    toutVoir: 'Tout voir',
    theme: 'Thème',
    score: 'Score',
    resultatsOptimizer: "Résultats de l'Optimizer",
    resultatsOptimizerAide:
      "Au bureau seulement. En tableau, l'Optimizer regroupe ses réglages pour lui laisser la place ; trop étroit malgré tout, il affiche les cartes.",
    cartes: 'Cartes',
    tableau: 'Tableau',
    buildsRapides: 'Builds les plus rapides',
    choisir: 'Choisir…',
    buildsRapidesAide: 'Choisir les combinaisons de sets et le nombre de builds',
    resumeBuildsRapides: (combinaisons: number, builds: number) =>
      `${combinaisons} combinaison${combinaisons > 1 ? 's' : ''} · ${builds} build${builds > 1 ? 's' : ''} par combinaison, au Résumé des runes.`,
    overcap: 'Overcap Taux Crit/RES/Précision',
    overcapAide:
      "Ces trois stats sont plafonnées à 100 % dans le jeu. Désactivé, leur TOTAL affiché s'arrête à 100 % même si la somme brute des runes dépasse — la donnée elle-même n'est jamais tronquée, seul l'affichage change.",
    overcapInterrupteur: 'Afficher le total au-delà de 100 % pour Taux Crit, RES et Précision',
    adversaire: 'Adversaire de référence (speed tuning)',
    adversaireAide:
      "À chaque analyse, l'outil pose en face une copie de ton monstre le plus rapide — même lead, même vitesse de runes, même set, même passif. On tune alors contre soi-même : « est-ce que toute mon équipe joue avant un monstre aussi rapide que mon plus rapide ? » Sans ce réglage, il n'est posé que si personne n'est en face.",
    adversaireInterrupteur: 'Toujours ajouter en face mon monstre le plus rapide',
    garder: 'Garder mes données',
    garderAideNavigateur:
      'Recommandé : sans ça, tout est perdu en fermant l’onglet — prépa RTA, équipes de siège, recommandations et compte. Tout reste dans ton navigateur, sur cet appareil : à éviter sur un ordinateur partagé.',
    garderAideBureau:
      'Recommandé : sans ça, tout est perdu en fermant l’application — prépa RTA, équipes de siège, recommandations et compte. Tout reste sur cette machine : à éviter sur un ordinateur partagé.',
    garderIndisponible:
      "Ton navigateur n'autorise pas le stockage (navigation privée ?). L'import reste valable le temps de la session.",
    garderInterrupteur: 'Garder mes données sur cet appareil',
    session: 'Session',
    sessionAide:
      'Tout l’état de l’app dans un fichier, enregistré où tu veux : le compte, ton travail, les réglages et l’état des outils.',
    sauvegarder: 'Sauvegarder',
    sauvegarderAide: 'Sauvegarder la session dans un fichier',
    dossier: 'Dossier SW Blacksmith',
    dossierVide: 'Choisis le dossier de SW Blacksmith : les sessions s’enregistrent dans son sous-dossier « sessions ».',
    retirer: 'Retirer',
    retirerAide: 'Ne plus utiliser ce dossier : la prochaine session le redemandera',
    mesDonnees: 'Mes données',
    toutSupprimer: 'Tout supprimer',
    toutSupprimerAide:
      'Efface la prépa RTA, les équipes de siège, les recommandations, les monstres perso et le compte importé',
  },

  // La date de l'export chargé, sous « Garder mes données ».
  fraicheur: {
    exporteLe: (date: string) => `Compte exporté le ${date}`,
    rappel: 'réexporte ton compte',
    rappelSuite: ' pour des chiffres à jour.',
  },

  accueil: {
    accroche: 'La boîte à outils pour Summoners War.',
    // La phrase coupée autour du lieu du calcul, mis en gras.
    promesse: 'Runes, RTA, siège, analyse de compte. Importe ton export SWEX et tout est calculé ',
    promesseNavigateur: 'dans ton navigateur',
    promesseMachine: 'sur ta machine',
    promesseFin: '.',
    telechargerApplication: "Télécharger l'application",
    existeEnApplication: 'Existe aussi en application pour Windows et Linux.',
    tonEspace: 'Ton espace',
    monstres: (n: number): string => (n > 1 ? 'monstres' : 'monstre'),
    equipes: (n: number): string => (n > 1 ? 'équipes' : 'équipe'),
    recos: (n: number): string => (n > 1 ? 'recos' : 'reco'),
    prepaRta: 'Prépa RTA',
    defenseSiege: 'Défense de siège',
    offenseSiege: 'Offense de siège',
    recommandations: 'Recommandations',
    commentCaMarche: 'Comment ça marche',
    etapeExporter: 'Exporte ton compte',
    etapeExporterTexte: 'Génère un fichier .json de ton compte avec SW Exporter, en lançant le jeu une fois.',
    etapeDeposer: 'Dépose le fichier',
    etapeDeposerNavigateur: "Ici même, en haut de page. Rien n'est envoyé : tout se calcule dans ton navigateur.",
    etapeDeposerMachine: "Ici même, en haut de page. Rien n'est envoyé : tout se calcule sur ta machine.",
    etapePreparer: 'Prépare et optimise',
    etapePreparerTexte: "Runes, prépa RTA, équipes de siège et analyse de compte se remplissent d'un seul coup.",
    fonctionnalites: 'Fonctionnalités',
    bientot: ' · bientôt',
    // Les cartes de fonctionnalité : la rubrique, le titre, une phrase.
    cartes: {
      rta: { rubrique: 'RTA', titre: 'Préparation RTA', texte: "Classe ta box par set en glisser-déposer et lis l'ordre de tour recalculé selon les leads." },
      ami: { rubrique: 'RTA', titre: "Prépa d'un ami", texte: "Ouvre la prépa qu'un ami t'a exportée — ou son export SWEX complet — et regarde son classement, ses vitesses et son ordre de tour." },
      siege: { rubrique: 'Siège', titre: 'Défenses et offenses', texte: 'Compose tes équipes et vérifie tes speed tune sur les ticks 239 et 286.' },
      recos: { rubrique: 'Partage', titre: 'Recommandations', texte: 'Décris tes decks, partage-les en JSON, et vois ce que ton compte peut jouer.' },
      runes: { rubrique: 'Compte', titre: 'Analyse de runes', texte: "Résumé chiffré, efficience ou score SW, courbes, et ce que tes meules et gemmes en réserve permettent d'améliorer dès maintenant." },
      artefacts: { rubrique: 'Compte', titre: "Analyse d'artéfacts", texte: "Le score du jeu et l'efficience de chaque pièce, la distribution de ton stock et le top 10 de chaque propriété." },
      optimizer: { rubrique: 'Outils', titre: 'Optimiseur de runes', texte: 'Cherche, parmi les runes que tu possèdes déjà, la meilleure combinaison de 6 pour un monstre, un set et des minimums donnés.' },
      speedTuning: { rubrique: 'Outils', titre: 'Speed tuning', texte: "Tick par tick, vois quel monstre remplit sa barre d'action en premier — ton équipe et celle d'en face, pour savoir qui joue avant qui." },
      bestiaire: { rubrique: 'Données', titre: 'Bestiaire', texte: 'Recherche et filtres par élément et étoiles naturelles, stats de base à portée de main.' },
      mecaniques: { rubrique: 'Doc', titre: 'Mécaniques', texte: "Vitesse de combat, barre d'action, équation des dégâts et facteur de défense." },
      nouveautes: { rubrique: 'Suivi', titre: 'Nouveautés', texte: 'Ce qui change à chaque version : ajouts, corrections et calculs revus.' },
      arene: { rubrique: 'Arène', titre: 'Arène classique', texte: "Préparation des équipes d'offense et de défense." },
    },
    application: {
      rubrique: 'Application',
      titre: 'Application de bureau',
      texte: (app: string) => `${app} dans sa propre fenêtre, pour Windows et Linux, avec la mise à jour proposée à chaque version.`,
    },
    pretTitre: 'Prêt à préparer tes équipes ?',
    pretTexte: 'Importe ton fichier SWEX et retrouve ta box, tes runes, ta prépa RTA et tes équipes de siège en quelques secondes.',
    importerMonCompte: 'Importer mon compte',
    voirNouveautes: 'Voir les nouveautés',
    deposerIci: 'Dépose ton fichier .json ici',
    cliquerPourParcourir: 'ou clique pour parcourir',
    exportSwex: 'Export SWEX (.json)',
    luDansLaPage: 'lu dans la page, jamais envoyé',
  },

  bestiaire: {
    titre: 'Bestiaire',
    totalBase: (n: string) => `${n} monstres`,
    rechercher: 'Rechercher un monstre par nom…',
    filtrer: 'Filtrer le bestiaire',
    // « 12 monstres », « 12 monstres sur 1 403 ».
    compte: (n: number, total: number | null) =>
      `${n} monstre${n > 1 ? 's' : ''}${total === null ? '' : ` sur ${total}`}`,
    aucun: 'Aucun monstre ne correspond à ces filtres.',
    element: 'Élément',
    etoiles: 'Étoiles',
    formes: 'Formes',
    jouablesSeulement: 'Jouables uniquement',
    formesEveillees: 'Formes éveillées',
    triInterne: 'Tri interne',
    triEtoilesDesc: 'Étoiles ↓ puis nom',
    triEtoilesAsc: 'Étoiles ↑ puis nom',
    triNom: 'Nom (A→Z)',
  },

  // La fiche d'un monstre (bestiaire, box, recherche de la palette).
  ficheMonstre: {
    forme: 'Forme du monstre',
    formeBase: 'Forme de base',
    formeTransformee: 'Forme transformée',
    competencesDe: (base: boolean) => `Compétences de la ${base ? 'forme de base' : 'forme transformée'}`,
    chargement: 'Chargement des compétences…',
    pourMaxer: (n: number) => `${n} amélioration(s) pour maxer ses compétences.`,
    creeALaMain: "Ce monstre a été créé à la main : il n'a pas de fiche de compétences.",
    indisponible: 'Le détail des compétences de ce monstre n’est pas disponible.',
    passif: 'Passif',
    zone: 'Zone',
    coups: (n: number) => `×${n} coups`,
    rechargement: (tours: number) => `Rechargement : ${tours} tours`,
    rechargementReduit: (debut: number, fin: number) =>
      `Rechargement : ${debut} tours, réduit à ${fin} en montant la compétence`,
    tours: 'tours',
    ameliorations: (n: number) => `${n} amélioration(s)`,
  },

  // Créer un monstre absent des données (RTA, siège).
  creerMonstre: {
    nom: 'Nom du monstre',
    vitesseBase: 'Vitesse de base',
    typeLead: 'Type de lead (optionnel)',
    leadAucun: 'Lead : aucun',
    lead: (stat: string) => `Lead ${stat}`,
    valeurLead: 'Valeur du lead en %',
    porteeLead: 'Portée du lead',
    toutesCibles: 'Toutes cibles',
    memeElement: 'Même élément',
    creer: 'Créer',
    mesMonstres: 'Mes monstres perso',
    supprimer: (nom: string) => `Supprimer ${nom}`,
    bouton: 'Créer un monstre',
    boutonAide: "Créer un monstre qui n'existe pas dans les données chargées",
    boutonCourt: 'Monstre',
    titre: 'Nouveau monstre',
    confirmerTitre: (nom: string) => `Supprimer ${nom} ?`,
    confirmerMessage:
      "Ce monstre a été créé à la main : il n'existe pas dans les données du jeu et devra être ressaisi en entier. Les équipes qui l'utilisaient perdent leur emplacement.",
    confirmerAction: 'Supprimer',
  },

  // La pagination des listes (bestiaire, runes, artéfacts).
  pagination: {
    precedente: 'Page précédente',
    allerA: 'Aller à la page',
    suivante: 'Page suivante',
  },

  bientot: {
    titre: 'Bientôt disponible',
    texte: 'Cet outil est en cours de construction.',
  },

  telecharger: {
    titre: 'Télécharger',
    intro: (app: string) =>
      `${app} existe en application de bureau pour Windows et Linux : la même boîte à outils, dans sa propre fenêtre.`,
    atouts: [
      { titre: 'Sa propre fenêtre', texte: "Hors du navigateur, à la taille que tu lui donnes, lancée comme n'importe quel logiciel." },
      { titre: 'La mise à jour proposée', texte: "À chaque nouvelle version, l'application te propose de se mettre à jour. C'est toi qui décides quand." },
      { titre: '100 % local', texte: "Comme le site : rien n'est envoyé, tout reste sur ta machine." },
    ],
    windows: 'Télécharger pour Windows',
    linux: 'Télécharger pour Linux',
    // ⚠️ Les libellés de Windows, dans la langue de Windows : celle de l'interface
    // est la meilleure approximation.
    avertissementWindows:
      'Windows peut afficher « Windows a protégé votre ordinateur » : clique sur « Informations complémentaires », puis sur « Exécuter quand même ».',
    auTelephone: 'À installer depuis un ordinateur Windows ou Linux.',
    versionProposee: (version: string) => `Version proposée : ${version}`,
    toutesLesVersions: 'Toutes les versions sur GitHub',
  },

  nouveautes: {
    titre: 'Nouveautés',
    intro: (app: string) => `Ce qui a changé à chaque version de ${app}. La version en cours est rappelée en bas de chaque page.`,
    voirSurGithub: 'Voir les releases sur GitHub',
    enPreparation: 'En préparation',
    versionActuelle: 'Version actuelle',
    pasPubliee: 'Pas encore publiée',
    releaseSurGithub: (version: string) => `Release v${version} sur GitHub`,
    lienGithub: 'GitHub ↗',
    sortes: { feat: 'Nouveau', fix: 'Correction', docs: 'Doc' },
  },
};

export type Dictionnaire = typeof fr;
