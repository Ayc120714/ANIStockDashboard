/**
 * Local read-only smoke run: context-engineering subagent validates template.
 * Requires CURSOR_API_KEY. Skips gracefully when unset.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');

const apiKey = process.env.CURSOR_API_KEY;
if (!apiKey) {
  console.log('SKIP: CURSOR_API_KEY not set — shell verify-only mode');
  process.exit(0);
}

const { Agent } = await import('@cursor/sdk');

const template = readFileSync(
  join(REPO_ROOT, '.cursor/skills/context-engineering-subagents/templates/subagent-brief.md'),
  'utf8',
);

const prompt = `You are running a local verification smoke test.

Read the subagent brief template below. Reply with ONLY "VALIDATION_OK" if it contains all 5 layers (Identity, World, Task, Example, Constraint). Otherwise reply VALIDATION_FAIL and list missing layers.

Template:
${template.slice(0, 4000)}
`;

const result = await Agent.prompt(prompt, {
  apiKey,
  model: { id: 'composer-2.5-fast' },
  local: { cwd: REPO_ROOT, settingSources: [] },
});

const text = String(result.result || result.text || '');
if (!/VALIDATION_OK/i.test(text)) {
  console.error('FAIL: context agent smoke test:', text.slice(0, 500));
  process.exit(2);
}
console.log('PASS: context-engineering local SDK smoke test');
