// Lint du dépôt — `npm run lint`. Contrat : docs/03-developpeur/ (qualité du code).
//
// ⚠️ Une ERREUR bloque le commit (hook `pre-commit`) et la CI ; un
// AVERTISSEMENT s'affiche sans bloquer. Le code actuel passe sans erreur :
// une règle n'est en erreur que si le dépôt la respecte déjà.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import { pluginSwblacksmith } from './scripts/lib/regleTexteEnDur.mjs';

// Les fichiers dont les textes viennent du dictionnaire (src/i18n/) : la règle
// `swblacksmith/texte-en-dur` y refuse tout texte écrit en dur. ⚠️ La liste
// grandit à mesure que les écrans sont traduits, jusqu'à couvrir `src/` entier
// (docs/02-app/transverse/feat-langues.md).
const FICHIERS_TRADUITS = [
  'src/components/AccountFreshness.tsx',
  'src/components/DrapeauLangue.tsx',
  'src/components/MobileNavSheet.tsx',
  'src/components/MobileTabs.tsx',
  'src/components/Palette.tsx',
  'src/components/SettingsMenu.tsx',
  'src/components/Sidebar.tsx',
  'src/components/SidebarCompte.tsx',
  'src/components/SidebarSearch.tsx',
  'src/components/TopBar.tsx',
  'src/components/VoletEcran.tsx',
  'src/pages/SettingsPage.tsx',
  // Lot 3 : les pages ouvertes à tous et le bestiaire. Les articles de
  // src/i18n/articles/ n'y sont pas : ils SONT le texte d'une langue.
  'src/components/CreateMonster.tsx',
  'src/components/FilterBar.tsx',
  'src/components/MonsterDetailDialog.tsx',
  'src/components/MonsterGrid.tsx',
  'src/components/SearchBar.tsx',
  'src/components/account/Pager.tsx',
  'src/pages/BestiaryPage.tsx',
  'src/pages/ComingSoon.tsx',
  'src/pages/HomePage.tsx',
  'src/pages/MechanicsPage.tsx',
  'src/pages/ReleasesPage.tsx',
  'src/pages/TelechargerPage.tsx',
  // Lot 4 : la RTA et le Siège.
  'src/components/rta/*.tsx',
  'src/components/siege/*.tsx',
  'src/components/siege/pastilleStatut.ts',
  'src/pages/RtaPage.tsx',
  'src/pages/SiegePage.tsx',
  // Lot 5 : le Compte, l'import et les données ; App.tsx en entier.
  'src/App.tsx',
  'src/components/AccountImportControl.tsx',
  'src/components/ChangementCompteDialog.tsx',
  'src/components/DialogueBuildsRapides.tsx',
  'src/components/InventaireIcon.tsx',
  'src/components/account/*.tsx',
  'src/pages/AccountPage.tsx',
  'src/ui/Dialogs.tsx',
  // Lot 6a : l'Optimizer, l'écran des critères (listes, équipes, état du
  // monstre, set, conditions, artéfacts, relique, réglages avancés). La vue de
  // développement des gabarits reste en français.
  'src/pages/OutilsPage.tsx',
  'src/components/outils/ArtifactLinesEditor.tsx',
  'src/components/outils/EtatMonstre.tsx',
  'src/components/outils/ExclusionCandidateRow.tsx',
  'src/components/outils/MonsterSourcePicker.tsx',
  'src/components/outils/OptimizerCreateListDialog.tsx',
  'src/components/outils/OptimizerEquipeDialog.tsx',
  'src/components/outils/OptimizerLeadInactif.tsx',
  'src/components/outils/OptimizerListPicker.tsx',
  'src/components/outils/OptimizerSection.tsx',
  'src/components/outils/RuneExclusionPicker.tsx',
  'src/components/outils/SetComboPicker.tsx',
  'src/components/outils/optimizer/ArtefactsEtReliques.tsx',
  'src/components/outils/optimizer/BandeauBuildValide.tsx',
  'src/components/outils/optimizer/BoutonValiderBuild.tsx',
  'src/components/outils/optimizer/CarteEtatMonstre.tsx',
  'src/components/outils/optimizer/ChoixExemplaire.tsx',
  'src/components/outils/optimizer/Conditions.tsx',
  'src/components/outils/optimizer/ConfirmationsLiberation.tsx',
  'src/components/outils/optimizer/CriteresRecherche.tsx',
  'src/components/outils/optimizer/EstimationPool.tsx',
  'src/components/outils/optimizer/ExclusionMonstrePrecis.tsx',
  'src/components/outils/optimizer/ExclusionRunesContenu.tsx',
  'src/components/outils/optimizer/ExemplaireEtFiche.tsx',
  'src/components/outils/optimizer/MeilleursArtefacts.tsx',
  'src/components/outils/optimizer/MonstreEquipement.tsx',
  'src/components/outils/optimizer/MonstreEquipementTelephone.tsx',
  'src/components/outils/optimizer/MonstresDeLaListe.tsx',
  'src/components/outils/optimizer/ObjectifEtActions.tsx',
  'src/components/outils/optimizer/OptionsRechercheTelephone.tsx',
  'src/components/outils/optimizer/ReglagesAvancesContenu.tsx',
  'src/components/outils/optimizer/Relique.tsx',
  'src/components/outils/optimizer/RunesDejaUtilisees.tsx',
  'src/components/outils/optimizer/RunesImposees.tsx',
  'src/components/outils/optimizer/SelecteurListes.tsx',
  'src/components/outils/optimizer/SetDeRunes.tsx',
  'src/components/outils/optimizer/StatPrincipaleImposee.tsx',
  'src/components/outils/optimizer/TitreExclusionRunes.tsx',
  'src/components/outils/optimizer/TitreReglagesAvances.tsx',
  'src/components/outils/optimizer/bureau/ArtefactsEtReliqueBureau.tsx',
  'src/components/outils/optimizer/bureau/ConditionsBureau.tsx',
  'src/components/outils/optimizer/bureau/EtatMonstreEssentiels.tsx',
  'src/components/outils/optimizer/bureau/ExclusionRunesBureau.tsx',
  'src/components/outils/optimizer/bureau/ExemplaireBureau.tsx',
  'src/components/outils/optimizer/bureau/ListeDeTravailBureau.tsx',
  'src/components/outils/optimizer/bureau/MeilleursArtefactsBureau.tsx',
  'src/components/outils/optimizer/bureau/ObjectifEtRechercherBureau.tsx',
  'src/components/outils/optimizer/bureau/PageBureau.tsx',
  'src/components/outils/optimizer/bureau/PrincipalesImposeesBureau.tsx',
  'src/components/outils/optimizer/bureau/ReglagesAvancesBureau.tsx',
  'src/components/outils/optimizer/bureau/SetDeRunesCompact.tsx',
  'src/components/outils/optimizer/bureau/SetsAuraBureau.tsx',
];

export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-bureau/**', 'paquets/**', 'public/**', 'node_modules/**', '.history/**', 'coverage/**'],
  },
  {
    // Les `eslint-disable` existants documentent des dépendances d'effet
    // exclues volontairement, chacun avec sa raison au-dessus : on les garde
    // même quand la version actuelle du plugin ne signale plus rien.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Avertissement tant que le code mort existant n'est pas retiré ; repasse
      // en erreur une fois le dépôt propre. `_` en tête = inutilisé assumé.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-useless-assignment': 'warn',
      // Signalé, pas bloquant : un `any` se remplace au fil des modifications.
      '@typescript-eslint/no-explicit-any': 'warn',
      // `ensemble.has(x) ? ensemble.delete(x) : ensemble.add(x)` est l'idiome
      // de bascule de l'interface.
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true, allowShortCircuit: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    // Les deux règles historiques seulement. Les autres règles de la v7
    // (`refs`, `set-state-in-effect`, `immutability`…) servent le React
    // Compiler, que l'app n'utilise pas.
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Conventions d'AGENTS.md que le texte du code suffit à vérifier.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'confirm', message: 'Aucune boîte native : une confirmation passe par src/ui/Dialogs.tsx.' },
        { name: 'prompt', message: 'Aucune boîte native : une saisie passe par src/ui/Dialogs.tsx.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='window'][callee.property.name=/^(confirm|prompt)$/]",
          message: 'Aucune boîte native : une confirmation ou une saisie passe par src/ui/Dialogs.tsx.',
        },
        {
          selector: "JSXAttribute[name.name='type'][value.value='number']",
          message: 'Un champ numérique est un NumberField (src/ui/), jamais un type="number".',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'localStorage',
          property: 'setItem',
          message: 'Une donnée s\'écrit par saveLocal (src/hooks/usePersistence.ts) : un refus de conservation vaut pour toute l\'app.',
        },
      ],
    },
  },
  {
    // `saveLocal` lui-même, et les clés de réglage, conservées même sans
    // l'accord de conservation (docs/02-app/transverse/feat-import-compte/persistance.md).
    files: [
      'src/hooks/usePersistence.ts',
      'src/hooks/useTheme.ts',
      'src/hooks/useLangue.ts',
      'src/hooks/useOvercapDisplay.ts',
      'src/hooks/useRuneMetric.ts',
      'src/hooks/useAdversaireReference.ts',
      'src/hooks/useBuildsRapides.ts',
      'src/hooks/useFormeResultats.ts',
    ],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: FICHIERS_TRADUITS,
    plugins: { swblacksmith: pluginSwblacksmith },
    rules: { 'swblacksmith/texte-en-dur': 'error' },
  },
  {
    files: ['bureau/**/*.ts', 'scripts/**/*.{ts,mjs,js}', 'tests/**/*.{ts,tsx,mjs}', '.claude/**/*.mjs', '*.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Pilotes Playwright : une partie de leur code s'exécute DANS la page.
    files: ['.claude/skills/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // Les tests comparent du texte source avec des expressions régulières
    // littérales (espaces typographiques, échappements recopiés tels quels)
    // et manipulent des objets partiels.
    files: ['tests/**/*.{ts,tsx,mjs}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      // `tests/rendu/outils-rendu.tsx` modifie l'objet module CommonJS de React.
      '@typescript-eslint/no-require-imports': 'off',
      'no-regex-spaces': 'off',
      'no-control-regex': 'off',
      'no-irregular-whitespace': 'off',
      'no-useless-escape': 'off',
    },
  },
);
