import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: true,
      },
    },
    rules: {
      'no-console': 'off',
      // Allow _-prefixed parameters that are intentionally unused (common in callbacks/overrides)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/agent/generated-tools.ts',
      'src/live/generated-executor.ts',
    ],
  },
);
