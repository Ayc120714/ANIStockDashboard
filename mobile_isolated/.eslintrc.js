module.exports = {
  root: true,
  extends: '@react-native',
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
};
