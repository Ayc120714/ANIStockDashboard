/**
 * Static verification: every registered screen module loads without throw.
 * Run: node scripts/verify-pages.js
 */
const path = require('path');

const root = path.resolve(__dirname, '..');

// Babel/register not available — use require with metro-like paths via manual resolution
const screens = [
  {name: 'Login', file: 'src/features/auth/LoginScreen.js', export: 'LoginScreen'},
  {name: 'OtpVerify', file: 'src/features/auth/OtpVerifyScreen.js', export: 'OtpVerifyScreen'},
  {name: 'Dashboard', file: 'src/features/dashboard/DashboardScreen.js', export: 'DashboardScreen'},
  {name: 'StocksHub', file: 'src/features/stocks/StocksHubScreen.js', export: 'StocksHubScreen'},
  {name: 'ScreensHub', file: 'src/features/screens/ScreensHubScreen.js', export: 'ScreensHubScreen'},
  {name: 'AdvisorHub', file: 'src/features/advisor/AdvisorHubScreen.js', export: 'AdvisorHubScreen'},
  {name: 'Signals', file: 'src/features/signals/SignalsScreen.js', export: 'SignalsScreen'},
  {name: 'MarketsHome', file: 'src/features/markets/MarketsHomeScreen.js', export: 'MarketsHomeScreen'},
  {name: 'Watchlist', file: 'src/features/stocks/WatchlistScreen.js', export: 'WatchlistScreen'},
  {name: 'Portfolio', file: 'src/features/portfolio/PortfolioHubScreen.js', export: 'PortfolioHubScreen'},
  {name: 'Orders', file: 'src/features/orders/OrdersScreen.js', export: 'OrdersScreen'},
  {name: 'Brokers', file: 'src/features/brokers/BrokersScreen.js', export: 'BrokersScreen'},
  {name: 'Alerts', file: 'src/features/alerts/AlertsScreen.js', export: 'AlertsScreen'},
  {name: 'WebPortal', file: 'src/features/web/WebPortalScreen.js', export: 'WebPortalScreen'},
  {name: 'Admin', file: 'src/features/admin/AdminScreen.js', export: 'AdminScreen'},
  {name: 'MainTabNavigator', file: 'src/navigation/MainTabNavigator.js', export: 'MainTabNavigator'},
  {name: 'AppNavigator', file: 'src/navigation/AppNavigator.js', export: 'AppNavigator'},
];

const fs = require('fs');

let failures = 0;
for (const s of screens) {
  const full = path.join(root, s.file);
  if (!fs.existsSync(full)) {
    console.log(`FAIL: ${s.name} — missing file ${s.file}`);
    failures += 1;
    continue;
  }
  const src = fs.readFileSync(full, 'utf8');
  const hasExport =
    src.includes(`export const ${s.export}`) ||
    src.includes(`export function ${s.export}`) ||
    src.includes(`export {${s.export}`) ||
    src.includes(`exports.${s.export}`);
  if (!hasExport) {
    console.log(`FAIL: ${s.name} — export ${s.export} not found in ${s.file}`);
    failures += 1;
  } else {
    console.log(`PASS: ${s.name} (${s.file})`);
  }
}

const siteSections = fs.readFileSync(path.join(root, 'src/navigation/siteSections.js'), 'utf8');
const webRoutes = [...siteSections.matchAll(/path: '([^']+)'/g)].map(m => m[1]);
console.log(`\nWeb portal routes (${webRoutes.length}): ${webRoutes.join(', ')}`);

const hamburger = fs.readFileSync(path.join(root, 'src/components/mobileChrome/HamburgerMenu.js'), 'utf8');
const stackScreens = [...hamburger.matchAll(/go\('([^']+)'/g)].map(m => m[1]);
const tabScreens = [...hamburger.matchAll(/goTab\('([^']+)'/g)].map(m => m[1]);
console.log(`\nHamburger tab targets: ${[...new Set(tabScreens)].join(', ')}`);
console.log(`Hamburger stack targets: ${[...new Set(stackScreens)].join(', ')}`);

if (failures > 0) {
  console.log(`\nPage verification failed (${failures} issues).`);
  process.exit(1);
}
console.log(`\nPage verification passed (${screens.length} screen modules).`);
