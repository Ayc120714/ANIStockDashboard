/**
 * Local read-only smoke run: master orchestrator reports fleet health summary.
 * Requires CURSOR_API_KEY. Skips gracefully when unset.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');

const apiKey = process.env.CURSOR_API_KEY;
if (!apiKey) {
  console.log('SKIP: CURSOR_API_KEY not set — shell verify-only mode');
  process.exit(0);
}

let healthOut = '';
try {
  healthOut = execSync(
    join(REPO_ROOT, '.cursor/skills/master-agent-orchestrator/scripts/check-fleet-health.sh'),
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 },
  );
} catch (e) {
  healthOut = String(e.stdout || e.message || 'health check failed');
}

const { Agent } = await import('@cursor/sdk');

const prompt = `You are the master-agent-orchestrator verification smoke test.

Given this fleet health output, reply with ONLY "ORCHESTRATOR_OK" if the backend API status check succeeded (contains "[OK] system/status"). Otherwise ORCHESTRATOR_FAIL and one reason.

Health output:
${healthOut.slice(0, 6000)}
`;

const result = await Agent.prompt(prompt, {
  apiKey,
  model: { id: 'composer-2.5-fast' },
  local: { cwd: REPO_ROOT, settingSources: [] },
});

const text = String(result.result || result.text || '');
if (!/ORCHESTRATOR_OK/i.test(text)) {
  console.error('FAIL: orchestrator smoke test:', text.slice(0, 500));
  process.exit(2);
}
console.log('PASS: master-agent-orchestrator local SDK smoke test');
