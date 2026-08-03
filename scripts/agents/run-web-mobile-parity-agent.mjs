/**
 * Pre-submit web/mobile parity gate for ANI Stock.
 *
 * 1. Shell phase (no API key): flags obvious one-sided advisor/API/UI changes.
 * 2. SDK phase (CURSOR_API_KEY): agent reads the git diff and reports parity gaps.
 *
 * Usage:
 *   npm run run:parity
 *   npm run run:parity -- --staged
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');

const staged = process.argv.includes('--staged');
const diffArgs = staged ? ['diff', '--staged'] : ['diff', 'HEAD'];

function git(args) {
  return execSync(['git', ...args].join(' '), {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  }).trim();
}

function changedFiles() {
  const names = git([...diffArgs, '--name-only']);
  return names ? names.split('\n').filter(Boolean) : [];
}

function isWebPath(p) {
  return (
    p.startsWith('src/') &&
    !p.startsWith('src/test') &&
    (p.includes('/api/') || p.includes('/pages/') || p.includes('/components/'))
  );
}

function isMobilePath(p) {
  return p.startsWith('mobile_isolated/src/');
}

function extractFeatureTokens(files, diffText) {
  const tokens = new Set();
  const fromDiff = [
    ...diffText.matchAll(/^\+.*(?:export\s+(?:const|function)\s+)?(fetch[A-Z][A-Za-z0-9]+)/gm),
    ...diffText.matchAll(/^\+.*(?:export\s+(?:default\s+)?function\s+)?([A-Z][A-Za-z0-9]+(?:Table|Tab|Section))/gm),
    ...diffText.matchAll(/rs[-_]?rvol[-_]?ema5m/gi),
  ];
  for (const m of fromDiff) {
    const raw = String(m[1] || m[0]);
    tokens.add(raw.replace(/^fetch/, '').toLowerCase());
  }
  return [...tokens].filter((t) => t.length > 4);
}

function shellParityChecks(files, diffText) {
  const issues = [];
  const web = files.filter(isWebPath);
  const mobile = files.filter(isMobilePath);

  if (web.length && !mobile.length) {
    issues.push(`Web UI/API changed (${web.length} files) but no mobile_isolated/src changes.`);
  }
  if (mobile.length && !web.length) {
    issues.push(`Mobile changed (${mobile.length} files) but no matching web src/ changes.`);
  }

  const apiAdds = [...diffText.matchAll(/^\+.*(?:export\s+(?:const|function)\s+)?(fetch[A-Z][A-Za-z0-9]+)/gm)].map(
    (m) => m[1],
  );
  const uniqueApiAdds = [...new Set(apiAdds)];
  for (const fn of uniqueApiAdds) {
    const inWeb = diffText.includes(`src/api/`) && diffText.includes(fn);
    const inMobile =
      diffText.includes('mobile_isolated/src/core/api/') &&
      diffText.includes(fn.replace(/^fetch/, 'fetch'));
    const mobileFn = fn.replace(/^fetch/, 'fetch');
    const webHas = diffText.includes(`+export const ${fn}`) || diffText.includes(`+export function ${fn}`);
    const mobileHas =
      diffText.includes(`${mobileFn}:`) || diffText.includes(`${mobileFn} =`) || diffText.includes(`${mobileFn}(`);
    if (webHas && !mobileHas) {
      issues.push(`API helper ${fn} added on web but not mirrored in mobile advisorService.`);
    }
    if (mobileHas && !webHas) {
      issues.push(`API helper ${mobileFn} added on mobile but not mirrored in web advisor.js.`);
    }
    void inWeb;
    void inMobile;
  }

  const featureTokens = extractFeatureTokens(files, diffText);
  for (const token of featureTokens) {
    const needle = token.replace(/[^a-z0-9]/gi, '');
    const webHit = web.some((f) => f.toLowerCase().replace(/[^a-z0-9]/gi, '').includes(needle));
    const mobileHit = mobile.some((f) => f.toLowerCase().replace(/[^a-z0-9]/gi, '').includes(needle));
    if (webHit && !mobileHit && mobile.length > 0) {
      issues.push(`Feature "${token}" added on web but no matching mobile component/section.`);
    }
    if (mobileHit && !webHit && web.length > 0) {
      issues.push(`Feature "${token}" added on mobile but no matching web component/table.`);
    }
  }

  const featureCodeTouched = /\+.*(?:fetchRsRvol|RsRvolEma5m|export (?:const|function|default))/m.test(diffText);
  if (featureCodeTouched) {
    const hasTestChange = files.some((f) => f.includes('__tests__') || f.includes('.test.'));
    if (!hasTestChange && (web.length || mobile.length)) {
      issues.push('Feature code changed without a regression/unit test update (workspace rule).');
    }
  }

  return issues;
}

const files = changedFiles();
if (!files.length) {
  console.log('PASS: no local changes — web/mobile parity gate skipped');
  process.exit(0);
}

const diffText = git([...diffArgs, '--', ...files]);
const shellIssues = shellParityChecks(files, diffText);

console.log('=== Web/mobile parity gate ===');
console.log(`Changed files: ${files.length} (${files.filter(isWebPath).length} web, ${files.filter(isMobilePath).length} mobile)`);

if (shellIssues.length) {
  console.error('\nShell parity findings:');
  for (const issue of shellIssues) console.error(`  - ${issue}`);
}

const apiKey = process.env.CURSOR_API_KEY;
if (!apiKey) {
  if (shellIssues.length) {
    console.error('\nFAIL: shell parity checks (set CURSOR_API_KEY for agent deep-audit)');
    process.exit(2);
  }
  console.log('\nSKIP: CURSOR_API_KEY not set — shell checks passed; SDK deep-audit unavailable');
  process.exit(0);
}

const { Agent, CursorAgentError } = await import('@cursor/sdk');

const prompt = `You are the ANI Stock web/mobile parity auditor.

Workspace rule: end-user features must stay in sync between web (stockdashboard/src/) and mobile (stockdashboard/mobile_isolated/src/). API params, visible columns, and placement should match unless mobile UX intentionally differs.

Review ONLY the git diff below. Reply with:
- First line: PARITY_OK or PARITY_FAIL
- If PARITY_FAIL: up to 5 bullet lines naming concrete gaps (missing mobile mirror, API param mismatch, missing regression test, etc.)
- If PARITY_OK: one line summarizing what was checked.

Do not suggest unrelated refactors.

Changed files:
${files.join('\n')}

Diff (truncated):
${diffText.slice(0, 12000)}
`;

let result;
try {
  result = await Agent.prompt(prompt, {
    apiKey,
    model: { id: 'composer-2.5-fast' },
    local: { cwd: REPO_ROOT, settingSources: [] },
  });
} catch (err) {
  if (err instanceof CursorAgentError) {
    console.error(`FAIL: SDK startup — ${err.message} (retryable=${err.isRetryable})`);
    process.exit(1);
  }
  throw err;
}

if (result.status === 'error') {
  console.error(`FAIL: agent run errored (run id: ${result.id || 'unknown'})`);
  process.exit(2);
}

const text = String(result.result || result.text || '');
console.log('\nAgent audit:\n' + text.slice(0, 2000));

const agentFail = /PARITY_FAIL/i.test(text);
if (agentFail || shellIssues.length) {
  console.error('\nFAIL: web/mobile parity gate');
  process.exit(2);
}

console.log('\nPASS: web/mobile parity gate (shell + SDK)');
