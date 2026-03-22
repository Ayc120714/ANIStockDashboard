/**
 * Fails fast if react-router / react-router-dom / @remix-run/router are mismatched.
 * Fixes webpack errors like: export 'json' was not found in 'react-router'
 * (usually caused by an older hoisted react-router).
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const WANT = {
  'react-router': '6.30.3',
  'react-router-dom': '6.30.3',
  '@remix-run/router': '1.23.2',
};

function readJson(rel) {
  const p = path.join(ROOT, 'node_modules', rel, 'package.json');
  if (!fs.existsSync(p)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

let failed = false;
for (const [name, want] of Object.entries(WANT)) {
  const pkg = readJson(name);
  if (!pkg) {
    console.error(`[verify-router-deps] Missing package: ${name} (run npm ci)`);
    failed = true;
    continue;
  }
  if (pkg.version !== want) {
    console.error(
      `[verify-router-deps] ${name} is ${pkg.version}, expected ${want}. Delete node_modules and run npm ci.`
    );
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
