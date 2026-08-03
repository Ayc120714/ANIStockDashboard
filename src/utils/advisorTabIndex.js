/**
 * Map ?advisorTab= query / deep-link keys to Financial Advisor tab index.
 * Keep in sync with MUI <Tabs> order on FinancialAdvisorPage.
 */
export function resolveAdvisorTabIndex(advisorTab) {
  const key = String(advisorTab || '').trim().toLowerCase();
  if (!key) return 0;
  if (key === 'signals' || key === 'sig' || key === 'alerts') return 0;
  if (key === 'renko' || key === 'renko_smart' || key === 'renkosmart') return 1;
  if (key === 'trend' || key === 'reversal' || key === 'trend_reversal') return 2;
  if (key === 'chart' || key === 'fundamental') return 3;
  if (key === 'analysis' || key === 'ai') return 4;
  if (key === 'portfolio') return 5;
  const n = Number(key);
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : 0;
}
