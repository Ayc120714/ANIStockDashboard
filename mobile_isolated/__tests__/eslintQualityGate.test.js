const path = require('path');
const {ESLint} = require('eslint');

const MOBILE_ROOT = path.join(__dirname, '..');

function formatLintMessages(results) {
  return results.flatMap(result =>
    result.messages
      .filter(message => message.severity === 2)
      .map(message => `${result.filePath}:${message.line}:${message.column} ${message.ruleId} — ${message.message}`),
  );
}

describe('eslint quality gate', () => {
  it('has zero ESLint errors in mobile src/ and __tests__', async () => {
    const eslint = new ESLint({cwd: MOBILE_ROOT});
    const results = await eslint.lintFiles(['src/**/*.js', '__tests__/**/*.js']);
    const errors = formatLintMessages(results);

    expect(errors).toEqual([]);
  });

  it('has zero react-hooks/exhaustive-deps violations in src/hooks', async () => {
    const eslint = new ESLint({cwd: MOBILE_ROOT});
    const results = await eslint.lintFiles(['src/hooks/**/*.js']);
    const hookErrors = results.flatMap(result =>
      result.messages
        .filter(message => message.severity === 2 && message.ruleId === 'react-hooks/exhaustive-deps')
        .map(message => `${result.filePath}:${message.line}:${message.column} — ${message.message}`),
    );

    expect(hookErrors).toEqual([]);
  });
});
