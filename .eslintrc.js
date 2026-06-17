/** ESLint config — TypeScript + React Native. Pragmatic / minimal so CI doesn't
 * fail on stylistic preferences in the first iterations. Strict typing is
 * enforced via `tsc --noEmit` in the separate `typecheck` job.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, browser: true, es2022: true, jest: true },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.expo/',
    'exports/',
    'admin-portal/',
    'server/functions/*/node_modules/',
    'web-build/',
    'babel.config.js',
    '.eslintrc.js',
  ],
  rules: {
    // Pragmatic defaults — most of these become warnings, not errors.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-require-imports': 'off', // RN Metro bundler uses `require(...)` for asset modules
    '@typescript-eslint/ban-ts-comment': 'off',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-undef': 'off', // TS handles this
    'no-useless-escape': 'warn',
  },
  overrides: [
    {
      files: ['scripts/**/*.ts', 'server/functions/**/*.{ts,js}'],
      env: { node: true },
    },
  ],
};
