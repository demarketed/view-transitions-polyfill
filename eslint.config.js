import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**', 'demos/**'],
    languageOptions: {
      globals: globals.browser,
      sourceType: 'module',
      ecmaVersion: 2020,
    },
  },
  {
    files: ['**/*'],
    languageOptions: { globals: globals.node },
  },
  {
    // Global ignored files
    ignores: ['dist/*', 'test/wpt/*', 'test/dist/*', 'demos/dist/*'],
  },
];
