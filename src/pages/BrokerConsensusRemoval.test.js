import fs from 'fs';
import path from 'path';

test('broker consensus is absent from web and mobile advisor navigation and clients', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const files = [
    'src/pages/FinancialAdvisorPage.js',
    'src/api/advisor.js',
    'mobile_isolated/src/features/advisor/AdvisorHubScreen.js',
    'mobile_isolated/src/core/api/services/advisorService.js',
  ];

  files.forEach((relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    expect(source).not.toMatch(/broker[-_ ]consensus|BrokerConsensus/i);
  });
});
