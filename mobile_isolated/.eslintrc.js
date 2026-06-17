module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['coverage/', 'android/', 'node_modules/'],
  globals: {
    globalThis: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-native/no-inline-styles': 'off',
    'no-bitwise': 'off',
  },
  overrides: [
    {
      files: ['**/__tests__/**/*.js', 'jest.setup.js', 'jest.config.js'],
      env: {jest: true},
    },
  ],
};
