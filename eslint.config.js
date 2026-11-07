'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'docs/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['dynamic-landing.js', 'demo-console.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: { ...globals.browser, module: 'readonly' },
    },
  },
  {
    files: ['tests/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  {
    // page.evaluate() callbacks run in the browser
    files: ['tests/browser.test.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
