import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { fetchDcHalfChecker } from '../api/advisor';
import DcHalfCheckerPage from './DcHalfCheckerPage';

jest.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    bootstrapping: false,
    outlookPremium: true,
    user: { id: 1 },
  }),
}));

jest.mock('../api/advisor', () => ({
  fetchDcHalfChecker: jest.fn(),
}));

jest.mock('../components/TradingViewLink', () => ({
  SymbolWithTradingView: ({ symbol }) => <span>{symbol}</span>,
  symbolCellTdStyle: (base, maxWidth) => ({ ...(base || {}), maxWidth: maxWidth || 140 }),
  buildTradingViewSymbolsCsv: (symbols) =>
    (symbols || [])
      .map((s) => String(s || '').trim().toUpperCase())
      .filter(Boolean)
      .map((s) => `NSE:${s}`)
      .join(','),
}));

describe('DcHalfCheckerPage', () => {
  beforeEach(() => {
    fetchDcHalfChecker.mockResolvedValue({
      data: [
        {
          symbol: 'TEST',
          sector: 'Tech',
          subsector: 'Software',
          market_cap: '5000 Cr',
          market_cap_cr: 5000,
          close: 100,
          dc_half: 90,
          dc_upper: 110,
          dc_lower: 80,
          ema21: 95,
          ema100: 92,
          ema200: 88,
          phase: 'cross_up',
          pct_vs_dc_half: 11.1,
          bars_since_cross: 0,
          crossed_bar_time: '2026-09-19T00:00:00',
          psar_confirm: true,
          volume_expanding: true,
          volume_ratio_prev: 1.0,
          volume_ratio: 1.5,
          confirm_flags: {psar_cross: true, close_up: true, prior_dip: true, rvol_rising: true},
        },
      ],
      as_of: '2026-09-19T10:00:00+05:30',
    });
  });

  it('renders page chrome and loaded rows without React style crash (regression)', async () => {
    // Bug: style={symbolCellTdStyle} passed a function → React #62 blank page once rows arrived.
    render(
      <MemoryRouter>
        <DcHalfCheckerPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('DC Half Checker')).toBeInTheDocument();
    await waitFor(() => expect(fetchDcHalfChecker).toHaveBeenCalled());
    expect(await screen.findByText('TEST')).toBeInTheDocument();
    expect(screen.getByText('Cross up')).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.getAllByText('Vol↑').length).toBeGreaterThanOrEqual(1);
  });

  it('offers Copy CSV for filtered symbols in TradingView NSE:SYM format', async () => {
    render(
      <MemoryRouter>
        <DcHalfCheckerPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: /Copy CSV \(1\)/i })).toBeInTheDocument();
  });
});
