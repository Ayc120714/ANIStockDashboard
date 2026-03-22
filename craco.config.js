/**
 * Force a single copy of react-router packages for Webpack.
 * Fixes: export 'json' / 'defer' / … was not found in 'react-router'
 * when react-router-dom resolves a different hoisted react-router than the app.
 *
 * CRA's ModuleScopePlugin rejects absolute aliases to node_modules; remove it
 * when using these aliases (same pattern as monorepo / shared-package setups).
 */
const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve = webpackConfig.resolve || {};
      webpackConfig.resolve.plugins = (webpackConfig.resolve.plugins || []).filter(
        (plugin) => plugin && plugin.constructor && plugin.constructor.name !== 'ModuleScopePlugin'
      );

      webpackConfig.resolve.alias = {
        ...(webpackConfig.resolve.alias || {}),
        'react-router': path.resolve(__dirname, 'node_modules/react-router'),
        'react-router-dom': path.resolve(__dirname, 'node_modules/react-router-dom'),
        '@remix-run/router': path.resolve(__dirname, 'node_modules/@remix-run/router'),
      };
      return webpackConfig;
    },
  },
};
