/** Matches web FinancialAdvisorPage → AI Analysis setup dropdown. */
export const AI_ANALYSIS_SETUPS = [
  {id: 'earnings', label: 'Earnings'},
  {id: 'deep_review', label: 'Deep Review'},
  {id: 'growth', label: 'Growth Fundamentals'},
  {id: 'equity_report', label: 'Equity Report'},
  {id: 'weekly_research', label: 'Weekly Research'},
];

export function getAnalysisSetupLabel(id) {
  return AI_ANALYSIS_SETUPS.find(s => s.id === id)?.label || String(id || 'Analysis');
}
