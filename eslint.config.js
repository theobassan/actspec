import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'spike/**'],
  },
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/test/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: [
          './packages/*/tsconfig.json',
          './packages/*/tsconfig.test.json',
        ],
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs['recommended'].rules,
      // Ban non-deterministic globals in library code
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Use injected clock instead of Date' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // determinism.ts IS the injected-clock implementation — it must create Date objects.
    // Test files pass Date values to configure the injected clock under test.
    files: ['packages/core/src/determinism.ts', 'packages/*/test/**/*.ts'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
];
