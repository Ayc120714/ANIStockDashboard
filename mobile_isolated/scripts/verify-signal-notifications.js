#!/usr/bin/env node
/**
 * Verifies advisor signal notification copy + digest diff logic (no device required).
 * Run: node scripts/verify-signal-notifications.js
 */

const path = require('path');

function loadModule(relPath) {
  const file = path.join(__dirname, '..', relPath);
  return require(file);
}

const {buildSignalNotificationPayload} = loadModule('src/core/utils/signalNotificationCopy.js');
const {signalsDigest, diffNewSignals} = loadModule('src/core/utils/signalsDigest.js');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const prevRows = [
  {symbol: 'RELIANCE', status: 'watch', entry_price: 2500, updated_at: '2026-06-14T10:00:00Z'},
  {symbol: 'TCS', status: 'entry_ready', entry_price: 3800, updated_at: '2026-06-14T10:05:00Z'},
];

const nextRows = [
  ...prevRows,
  {symbol: 'INFY', status: 'entry_ready', entry_price: 1650, updated_at: '2026-06-14T10:10:00Z'},
  {symbol: 'HDFCBANK', status: 'watch', entry_price: 1720, updated_at: '2026-06-14T10:11:00Z'},
];

console.log('Signal notification verification\n');

const prevDigest = signalsDigest(prevRows);
const fresh = diffNewSignals(prevDigest, nextRows);
assert(fresh.length === 2, 'diff detects exactly 2 new signals');
assert(fresh.some(r => r.symbol === 'INFY'), 'diff includes INFY');
assert(!fresh.some(r => r.symbol === 'TCS'), 'diff excludes unchanged TCS');

const payload = buildSignalNotificationPayload(fresh);
assert(payload != null, 'payload is built for fresh signals');
assert(payload.title.includes('Entry ready'), 'entry-ready signals use entry-ready title');
assert(payload.message.includes('INFY'), 'payload message lists symbols');
assert(payload.entryHint.includes('Tap to open'), 'in-app banner hint is actionable');
assert(payload.navTarget?.type === 'signals', 'signal payload targets Signals tab');

const genericPayload = buildSignalNotificationPayload([
  {symbol: 'SBIN', status: 'watch', entry_price: 800, updated_at: '2026-06-14T11:00:00Z'},
]);
assert(genericPayload.title.includes('New advisor signal'), 'non-entry-ready uses generic title');

assert(buildSignalNotificationPayload([]) === null, 'empty fresh list returns null');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
