import React from 'react';
import { render, screen } from '@testing-library/react';
import BrokerConsensusTab from './BrokerConsensusTab';
import { fetchBrokerConsensus } from '../api/advisor';

jest.mock('../api/advisor', () => ({
  fetchBrokerConsensus: jest.fn(),
  fetchBrokerConsensusDetail: jest.fn(),
}));

test('renders a populated consensus row without crashing the advisor page', async () => {
  fetchBrokerConsensus.mockResolvedValue({
    items: [{
      symbol: 'TECHM',
      company_name: null,
      label: 'positive',
      score: 0.283,
      confidence: 'low',
      counts: { positive: 4, neutral: 3, negative: 1, total: 8 },
      target: { mean: 1623.62, median: 1617, implied_upside_pct: 3.41 },
      newest_call_date: '2026-07-17',
      domestic_count: 3,
      foreign_count: 5,
    }],
    total: 1,
    page: 1,
    page_size: 50,
    as_of: '2026-07-18T16:00:52',
  });

  render(<BrokerConsensusTab />);

  expect(await screen.findByText('TECHM')).toBeInTheDocument();
  expect(screen.getByText(/4 positive \/ 3 neutral \/ 1 negative/)).toBeInTheDocument();
});
