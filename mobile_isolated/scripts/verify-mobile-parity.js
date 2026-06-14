const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const checks = [
  {
    name: 'WebView dependency installed',
    run: () => {
      const pkg = JSON.parse(read('package.json'));
      return Boolean(pkg?.dependencies?.['react-native-webview']);
    },
  },
  {
    name: 'Login stack header hidden (single Login title)',
    run: () => read('src/navigation/AppNavigator.js').includes('screenOptions={{headerShown: false}}'),
  },
  {
    name: 'Admin screen gated by super admin',
    run: () =>
      read('src/navigation/AppNavigator.js').includes('user?.is_super_admin') &&
      read('src/navigation/AppNavigator.js').includes('name="Admin"'),
  },
  {
    name: 'Website admin routes defined for super admin',
    run: () => read('src/navigation/siteSections.js').includes('export const SITE_SECTIONS_ADMIN'),
  },
  {
    name: 'Auth /me payload normalized to inner user object',
    run: () => {
      const content = read('src/core/api/services/authService.js');
      return content.includes('normalizeMePayload') && content.includes("fetchMe: async () => normalizeMePayload(await apiGet('/auth/me'))");
    },
  },
  {
    name: 'Web app base URL configured in env',
    run: () => {
      const content = read('src/core/config/env.js');
      return content.includes('webAppUrl') && content.includes('MOBILE_WEB_APP_URL');
    },
  },
  {
    name: 'MOBILE_WEB_APP_URL present in .env.example',
    run: () => read('.env.example').includes('MOBILE_WEB_APP_URL='),
  },
  {
    name: 'MOBILE_WEB_APP_URL present in .env.production',
    run: () => read('.env.production').includes('MOBILE_WEB_APP_URL='),
  },
  {
    name: 'Site sections include core web routes',
    run: () => {
      const content = read('src/navigation/siteSections.js');
      const required = [
        "/long-term",
        "/short-term",
        "/outlook",
        "/screens",
        "/advisor",
        "/portfolio-manager",
        "/alerts",
        "/profile",
        "/fno",
        "/commodities",
        "/forex",
        "/events",
      ];
      return required.every(route => content.includes(`path: '${route}'`));
    },
  },
  {
    name: 'Web parity parsers module exists',
    run: () => {
      const content = read('src/core/utils/webParity.js');
      return (
        content.includes('parseWatchlistResponse') &&
        content.includes('parseStocksListResponse') &&
        content.includes('parseWeeklyEntriesResponse')
      );
    },
  },
  {
    name: 'Dashboard service unwraps watchlist data array',
    run: () => {
      const content = read('src/core/api/services/dashboardService.js');
      return content.includes('parseWatchlistResponse') && content.includes('parseRatingsResponse');
    },
  },
  {
    name: 'Signals service returns advisor list rows like web',
    run: () => {
      const content = read('src/core/api/services/signalsService.js');
      return content.includes('parseAdvisorListResponse') && content.includes('limit ?? 200');
    },
  },
  {
    name: 'Screens alpha tracker uses 6m long horizon like web',
    run: () => read('src/features/screens/ScreensHubScreen.js').includes("alphaHor === 'long' ? '6m' : '1w'"),
  },
];

let failures = 0;
for (const check of checks) {
  let ok = false;
  try {
    ok = Boolean(check.run());
  } catch (_) {
    ok = false;
  }
  if (ok) {
    console.log(`PASS: ${check.name}`);
  } else {
    failures += 1;
    console.log(`FAIL: ${check.name}`);
  }
}

if (failures > 0) {
  console.log(`\nMobile parity verification failed (${failures} checks).`);
  process.exit(1);
}

console.log(`\nMobile parity verification passed (${checks.length} checks).`);
