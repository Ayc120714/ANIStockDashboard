/** Regression: Cursor local agent manifests for context + orchestrator skills. */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

const AGENTS = [
  {
    file: '.cursor/agents/context-engineering-subagents.md',
    name: 'context-engineering-subagents',
    skill: '.cursor/skills/context-engineering-subagents/SKILL.md',
  },
  {
    file: '.cursor/agents/master-agent-orchestrator.md',
    name: 'master-agent-orchestrator',
    skill: '.cursor/skills/master-agent-orchestrator/SKILL.md',
  },
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('cursor local agents manifest', () => {
  it.each(AGENTS)('$name agent file exists with frontmatter and skill', ({ file, name, skill }) => {
    const text = read(file);
    expect(text).toMatch(new RegExp(`^---[\\s\\S]*?name:\\s*${name}`, 'm'));
    expect(text).toMatch(/description:/);
    expect(fs.existsSync(path.join(ROOT, skill))).toBe(true);
  });

  it('context brief template passes 5-layer validator script', () => {
    const template = read('.cursor/skills/context-engineering-subagents/templates/subagent-brief.md');
    const layers = ['identity', 'world', 'task', 'example', 'constraint'];
    for (const layer of layers) {
      expect(template.toLowerCase()).toContain(layer);
    }
  });
});
