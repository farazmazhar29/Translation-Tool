import query from '@tanstack/eslint-plugin-query'
import js from '@eslint/js'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'src/shared/api/schema.d.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
      ...query.configs['flat/recommended'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      // One function style everywhere: const + arrow functions (classes such as the error boundary are exempt).
      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': 'error',
      // Arrow functions are not hoisted: never use a name above its definition (calls from inside functions are fine).
      '@typescript-eslint/no-use-before-define': [
        'error',
        { functions: true, classes: true, variables: false, typedefs: false },
      ],
      eqeqeq: 'error',
      'no-console': 'error',
    },
  },
  // Module boundaries: a feature is used through its index.ts only; shared code knows nothing about features.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/features/*/*', '!@/features/*/i18n'], message: 'Import a feature through its index.ts.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/features/*', '@/app/*'], message: 'shared/ must not depend on features or the app shell.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/features/*/*', '!@/features/*/i18n'], message: 'Import a feature through its index.ts.' },
            { group: ['@/app/*'], message: 'Features must not depend on the app shell.' },
          ],
        },
      ],
    },
  },
  { files: ['*.config.{js,ts}'], extends: [tseslint.configs.disableTypeChecked] },
)
