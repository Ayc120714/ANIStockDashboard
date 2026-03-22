#!/usr/bin/env node
/**
 * Remove local build & tool caches for this repo (faster disk, cleaner builds).
 * Does NOT delete node_modules unless --all-deps is passed.
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const DEFAULT_REMOVE = [
  'build',
  'coverage',
  '.eslintcache',
  'node_modules/.cache',
  'node_modules/.cache-loader',
];

function rmrf(rel) {
  const target = path.join(root, rel);
  if (!fs.existsSync(target)) return false;
  fs.rmSync(target, { recursive: true, force: true });
  return true;
}

const args = process.argv.slice(2);
const allDeps = args.includes('--all-deps');

console.log('Cleaning caches under:', root);

let removed = 0;
for (const rel of DEFAULT_REMOVE) {
  if (rmrf(rel)) {
    console.log('  removed:', rel);
    removed += 1;
  }
}

if (allDeps) {
  if (rmrf('node_modules')) {
    console.log('  removed: node_modules (run npm install after)');
    removed += 1;
  }
}

console.log(removed ? `Done (${removed} path(s)).` : 'Nothing to remove (already clean).');
