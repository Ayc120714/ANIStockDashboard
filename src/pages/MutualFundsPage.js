import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdAccountBalance } from 'react-icons/md';
import {
  fetchMutualFunds,
  fetchMfBuyTierCards,
  fetchMfRsSetup,
} from '../api/mutualFunds';
import { runScreenPayloadFetch } from '../utils/screenPageLoader';

const PageWrapper = styled.div`
  padding: 18px 24px 32px;
  max-width: 1440px;
  margin: 0 auto;
  font-family: 'Inter', -apple-system, sans-serif;
`;

const Header = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 12px; margin-bottom: 16px;
`;

const Title = styled.h1`
  font-size: 22px; font-weight: 700; color: #1a3c5e; margin: 0;
  display: flex; align-items: center; gap: 8px;
`;

const Sub = styled.p`
  margin: 4px 0 0; font-size: 12px; color: #8899a6;
`;

const RefBtn = styled.button`
  display: flex; align-items: center; gap: 5px;
  padding: 6px 14px; font-size: 12px; font-weight: 600;
  border: 1px solid #d0d7de; border-radius: 6px; background: #fff; color: #4a5568; cursor: pointer;
  &:hover { border-color: #1a3c5e; color: #1a3c5e; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const TabBar = styled.div`
  display: flex; gap: 0; border-bottom: 2px solid #e0e6ed; margin-bottom: 16px; flex-wrap: wrap;
`;

const Tab = styled.button`
  padding: 9px 20px; font-size: 13px; font-weight: 600; border: none; background: transparent;
  color: ${(p) => (p.$active ? '#1a3c5e' : '#8899a6')};
  border-bottom: 2px solid ${(p) => (p.$active ? '#1a3c5e' : 'transparent')};
  margin-bottom: -2px; cursor: pointer;
  &:hover { color: #1a3c5e; }
`;

const ChipRow = styled.div`
  display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; align-items: center;
`;

const Chip = styled.button`
  padding: 5px 12px; font-size: 11px; font-weight: 700; border-radius: 16px; cursor: pointer;
  border: 1px solid ${(p) => (p.$active ? p.$color || '#1a3c5e' : '#d0d7de')};
  background: ${(p) => (p.$active ? (p.$bg || '#e8f0f8') : '#fff')};
  color: ${(p) => (p.$active ? (p.$color || '#1a3c5e') : '#556')};
`;

const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 12px;
  thead {
    background: #1a3c5e;
    th {
      color: #fff; padding: 8px 10px; font-weight: 600; font-size: 11px;
      text-align: right; white-space: nowrap; cursor: pointer; user-select: none;
      &:first-child { text-align: left; }
    }
  }
  tbody tr {
    border-bottom: 1px solid #eef1f5;
    &:hover { background: #f5f8fc; }
    &:nth-child(even) { background: #fafbfc; }
  }
  td {
    padding: 6px 10px; text-align: right; color: #334155;
    &:first-child { text-align: left; font-weight: 600; max-width: 280px; }
  }
`;

const TierBadge = styled.span`
  display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 800;
  color: #fff; background: ${(p) => p.$bg || '#546e7a'};
`;

const Empty = styled.div`text-align: center; padding: 40px; color: #8899a6; font-size: 14px;`;

const TIER_COLORS = {
  B1: '#66bb6a', B2: '#43a047', B3: '#1b5e20',
  S1: '#ef5350', S2: '#c62828', S3: '#b71c1c',
};

const TIMEFRAMES = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

const ALL_TIERS = ['B1', 'B2', 'B3', 'S1', 'S2', 'S3'];

const fmt = (n, dec = 2) => (n != null && n !== '' ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: dec }) : '—');
const fmtPct = (n) => (n != null && n !== '' ? `${Number(n) >= 0 ? '+' : ''}${Number(n).toFixed(2)}%` : '—');
const retAnn = (bucket) => (bucket && bucket.annualised != null ? bucket.annualised : null);

const TIER_RANK = { B3: 1, B2: 2, B1: 3, S1: 4, S2: 5, S3: 6 };
const TF_RANK = { daily: 0, weekly: 1, monthly: 2 };

function sortValue(row, col) {
  switch (col) {
    case 'scheme_name':
      return String(row.scheme_name || row.company || row.symbol || '').toLowerCase();
    case 'category':
      return String(row.category || '').toLowerCase();
    case 'action':
      return String(row.action || '').toLowerCase();
    case 'buy_sell_tier':
      return TIER_RANK[String(row.buy_sell_tier || '').toUpperCase()] ?? 99;
    case 'timeframe':
      return TF_RANK[row.timeframe] ?? 99;
    case 'nav':
    case 'nav_close':
      return row.nav_close ?? row.nav ?? row.close;
    case 'nifty_close':
      return row.nifty_close;
    case 'rs_vs_nifty':
      return row.rs_vs_nifty;
    case 'is_fresh':
      return row.is_fresh ? 1 : 0;
    case 'date':
    case 'as_of': {
      const t = row[col] ? Date.parse(String(row[col])) : NaN;
      return Number.isNaN(t) ? null : t;
    }
    case 'rs_daily_123':
      return row.rs_daily_123;
    case 'rs_weekly_52':
      return row.rs_weekly_52;
    case 'rs_monthly_12':
      return row.rs_monthly_12;
    case 'ret_1y':
    case 'ret_3y':
    case 'ret_5y':
    case 'ret_10y':
    case 'expense_ratio':
    case 'pe_ratio':
    case 'aum_cr':
    case 'rating':
      return row[col];
    default:
      return row[col];
  }
}

function sortRows(rows, col, dir) {
  if (!col) return rows;
  const mul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, col);
    const bv = sortValue(b, col);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul;
    return String(av).localeCompare(String(bv)) * mul;
  });
}

function useSortedRows(rows, sort) {
  return useMemo(
    () => sortRows(rows || [], sort.col, sort.dir),
    [rows, sort.col, sort.dir],
  );
}

function SortHeader({ col, label, sort, onSort, align }) {
  const active = sort.col === col;
  const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <th
      style={align === 'left' ? { textAlign: 'left' } : undefined}
      onClick={() => onSort(col)}
    >
      {label}{arrow}
    </th>
  );
}

function FundListTab({ funds, loading, sort, onSort }) {
  const toggle = (col) => onSort(col);
  const arrow = (col) => (sort.col === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');

  const rows = useMemo(() => {
    const mapped = (funds || []).map((f) => ({
      ...f,
      ret_1y: retAnn(f.returns?.['1Y']),
      ret_3y: retAnn(f.returns?.['3Y']),
      ret_5y: retAnn(f.returns?.['5Y']),
      ret_10y: retAnn(f.returns?.['10Y']),
    }));
    return sortRows(mapped, sort.col, sort.dir);
  }, [funds, sort]);

  if (loading) return <Empty>Loading direct funds…</Empty>;
  if (!rows.length) return <Empty>No direct funds found.</Empty>;

  return (
    <Table>
      <thead>
        <tr>
          <th onClick={() => toggle('scheme_name')}>Scheme{arrow('scheme_name')}</th>
          <th onClick={() => toggle('category')}>Category{arrow('category')}</th>
          <th onClick={() => toggle('nav')}>NAV{arrow('nav')}</th>
          <th onClick={() => toggle('expense_ratio')}>Exp Ratio{arrow('expense_ratio')}</th>
          <th onClick={() => toggle('pe_ratio')}>P/E{arrow('pe_ratio')}</th>
          <th onClick={() => toggle('ret_1y')}>1Y Ann%{arrow('ret_1y')}</th>
          <th onClick={() => toggle('ret_3y')}>3Y Ann%{arrow('ret_3y')}</th>
          <th onClick={() => toggle('ret_5y')}>5Y Ann%{arrow('ret_5y')}</th>
          <th onClick={() => toggle('ret_10y')}>10Y Ann%{arrow('ret_10y')}</th>
          <th onClick={() => toggle('aum_cr')}>AUM (Cr){arrow('aum_cr')}</th>
          <th onClick={() => toggle('rating')}>Rating{arrow('rating')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((f) => (
          <tr key={f.isin}>
            <td title={f.isin}>{f.scheme_name}</td>
            <td>{f.category || '—'}</td>
            <td>{fmt(f.nav, 2)}</td>
            <td>{f.expense_ratio != null ? `${fmt(f.expense_ratio, 2)}%` : '—'}</td>
            <td>{f.pe_ratio != null ? fmt(f.pe_ratio, 1) : '—'}</td>
            <td style={{ color: (f.ret_1y || 0) >= 0 ? '#2e7d32' : '#c62828' }}>{fmtPct(f.ret_1y)}</td>
            <td style={{ color: (f.ret_3y || 0) >= 0 ? '#2e7d32' : '#c62828' }}>{fmtPct(f.ret_3y)}</td>
            <td style={{ color: (f.ret_5y || 0) >= 0 ? '#2e7d32' : '#c62828' }}>{fmtPct(f.ret_5y)}</td>
            <td style={{ color: (f.ret_10y || 0) >= 0 ? '#2e7d32' : '#c62828' }}>{fmtPct(f.ret_10y)}</td>
            <td>{fmt(f.aum_cr, 1)}</td>
            <td>{f.rating != null ? f.rating : '—'}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

const ACTION_COLORS = { ENTER: '#2e7d32', EXIT: '#c62828', HOLD: '#757575' };

function ActionBadge({ action }) {
  const a = String(action || 'HOLD').toUpperCase();
  return (
    <TierBadge $bg={ACTION_COLORS[a] || ACTION_COLORS.HOLD}>{a}</TierBadge>
  );
}

function IndicatorTable({ rows, compact, sort, onSort }) {
  const sorted = useSortedRows(rows, sort);
  if (!sorted.length) return null;

  const th = (col, label, align) => (
    <SortHeader key={col} col={col} label={label} sort={sort} onSort={onSort} align={align} />
  );

  return (
    <Table>
      <thead>
        <tr>
          {th('scheme_name', 'Scheme', 'left')}
          {th('category', 'Category')}
          {th('action', 'Action')}
          {th('buy_sell_tier', 'Signal')}
          {th('timeframe', 'TF')}
          {th('nav_close', 'NAV')}
          {th('nifty_close', 'Nifty')}
          {th('rs_vs_nifty', 'RS vs Nifty')}
          {!compact && <th>Hold</th>}
          {!compact && <th>Setup</th>}
          {th('is_fresh', 'Fresh')}
          {th('date', 'Date')}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={`${r.symbol}-${r.timeframe}-${r.date}-${r.buy_sell_tier}`}>
            <td title={r.symbol}>{r.scheme_name || r.company || r.symbol}</td>
            <td>{r.category || '—'}</td>
            <td><ActionBadge action={r.action} /></td>
            <td><TierBadge $bg={TIER_COLORS[r.buy_sell_tier]}>{r.buy_sell_tier}</TierBadge></td>
            <td>{r.timeframe || '—'}</td>
            <td>{fmt(r.nav_close ?? r.nav ?? r.close, 2)}</td>
            <td>{fmt(r.nifty_close, 0)}</td>
            <td style={{ color: (r.rs_vs_nifty || 0) >= 0 ? '#2e7d32' : '#c62828' }}>
              {r.rs_vs_nifty != null ? `${(Number(r.rs_vs_nifty) * 100).toFixed(2)}%` : '—'}
            </td>
            {!compact && <td>{r.hold_months || '—'}</td>}
            {!compact && (
              <td style={{ maxWidth: 220, textAlign: 'left', fontWeight: 400, fontSize: 11 }}>
                {r.action_note || r.reversal_context || '—'}
              </td>
            )}
            <td>{r.is_fresh ? 'Yes' : '—'}</td>
            <td>{r.date || '—'}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function IndicatorsTab({ grid, loading, tf, setTf, tier, setTier, view, setView, sort, onSort }) {
  const items = useMemo(() => {
    if (view === 'enter') return grid?.enter_signals || [];
    if (view === 'exit') return grid?.exit_signals || [];
    return grid?.data?.[tf]?.[tier]?.items || [];
  }, [grid, tf, tier, view]);

  if (loading) return <Empty>Computing enter/exit signals on NAV vs Nifty (may take up to a minute)…</Empty>;

  return (
    <>
      {grid?.nifty_close != null && (
        <Sub style={{ marginBottom: 10 }}>
          Nifty 50 close {fmt(grid.nifty_close, 2)}
          {grid.nifty_as_of ? ` · ${grid.nifty_as_of}` : ''}
          {grid.enter_count != null ? ` · Enter ${grid.enter_count}` : ''}
          {grid.exit_count != null ? ` · Exit ${grid.exit_count}` : ''}
        </Sub>
      )}
      <ChipRow>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#546e7a' }}>View</span>
        <Chip $active={view === 'enter'} $color="#2e7d32" $bg="#e8f5e9" onClick={() => setView('enter')}>
          Enter ({grid?.enter_count ?? 0})
        </Chip>
        <Chip $active={view === 'exit'} $color="#c62828" $bg="#ffebee" onClick={() => setView('exit')}>
          Exit ({grid?.exit_count ?? 0})
        </Chip>
        <Chip $active={view === 'tier'} onClick={() => setView('tier')}>By tier</Chip>
      </ChipRow>
      {view === 'tier' && (
        <>
          <ChipRow>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#546e7a' }}>Timeframe</span>
            {TIMEFRAMES.map((t) => (
              <Chip key={t.id} $active={tf === t.id} onClick={() => setTf(t.id)}>{t.label}</Chip>
            ))}
          </ChipRow>
          <ChipRow>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#546e7a' }}>Tier</span>
            {ALL_TIERS.map((t) => (
              <Chip
                key={t}
                $active={tier === t}
                $color={TIER_COLORS[t]}
                $bg={`${TIER_COLORS[t]}22`}
                onClick={() => setTier(t)}
              >
                {t} ({grid?.data?.[tf]?.[t]?.count ?? 0})
              </Chip>
            ))}
          </ChipRow>
        </>
      )}
      {!items.length ? (
        <Empty>
          {view === 'enter' ? 'No enter candidates (B1–B3) on current scan.' : view === 'exit' ? 'No exit candidates (S1–S3).' : `No funds in ${tier} on ${tf}.`}
        </Empty>
      ) : (
        <IndicatorTable rows={items} compact={view !== 'tier'} sort={sort} onSort={onSort} />
      )}
    </>
  );
}

function RsSetupTab({ rows, loading, setupMode, setSetupMode, sort, onSort }) {
  const sorted = useSortedRows(rows, sort);

  if (loading) return <Empty>Scanning RS D/W/M on fund NAV vs Nifty 50…</Empty>;
  return (
    <>
      <ChipRow>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#546e7a' }}>Mode</span>
        <Chip $active={setupMode === 'or_signal'} onClick={() => setSetupMode('or_signal')}>
          RS &gt; 0 (all TFs)
        </Chip>
        <Chip $active={setupMode === 'strict'} onClick={() => setSetupMode('strict')}>
          Strict (RS cross)
        </Chip>
      </ChipRow>
      {setupMode === 'strict' && (
        <Sub style={{ marginBottom: 8 }}>
          Strict mode needs RS to cross above zero on daily, weekly, and monthly — fewer matches.
        </Sub>
      )}
      {!sorted.length ? (
        <Empty>
          No funds matched RS {setupMode === 'strict' ? 'cross' : '> 0'} setup. Try RS &gt; 0 mode or Refresh.
        </Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <SortHeader col="scheme_name" label="Scheme" sort={sort} onSort={onSort} align="left" />
              <SortHeader col="category" label="Category" sort={sort} onSort={onSort} />
              <SortHeader col="nav_close" label="NAV" sort={sort} onSort={onSort} />
              <SortHeader col="rs_daily_123" label="RS Daily" sort={sort} onSort={onSort} />
              <SortHeader col="rs_weekly_52" label="RS Weekly" sort={sort} onSort={onSort} />
              <SortHeader col="rs_monthly_12" label="RS Monthly" sort={sort} onSort={onSort} />
              <SortHeader col="as_of" label="As of" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.symbol}>
                <td title={r.symbol}>{r.scheme_name || r.symbol}</td>
                <td>{r.category || '—'}</td>
                <td>{fmt(r.nav_close ?? r.nav, 2)}</td>
                <td>{r.rs_daily_123 != null ? fmt(r.rs_daily_123, 3) : '—'}</td>
                <td>{r.rs_weekly_52 != null ? fmt(r.rs_weekly_52, 3) : '—'}</td>
                <td>{r.rs_monthly_12 != null ? fmt(r.rs_monthly_12, 3) : '—'}</td>
                <td>{r.as_of || '—'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

export default function MutualFundsPage() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [funds, setFunds] = useState([]);
  const [meta, setMeta] = useState({});
  const [tierGrid, setTierGrid] = useState(null);
  const [rsRows, setRsRows] = useState([]);
  const [tf, setTf] = useState('daily');
  const [tier, setTier] = useState('B1');
  const [indicatorView, setIndicatorView] = useState('enter');
  const [setupMode, setSetupMode] = useState('or_signal');
  const [tabError, setTabError] = useState(null);
  const [fundSort, setFundSort] = useState({ col: 'ret_3y', dir: 'desc' });
  const [indicatorSort, setIndicatorSort] = useState({ col: 'rs_vs_nifty', dir: 'desc' });
  const [rsSort, setRsSort] = useState({ col: 'rs_daily_123', dir: 'desc' });

  const loadFunds = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const resp = await fetchMutualFunds({ refresh });
      setFunds(resp.funds || []);
      setMeta(resp);
    } catch (e) {
      console.error(e);
      setFunds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTiers = useCallback(async (refresh = false) => {
    setTabError(null);
    await runScreenPayloadFetch({
      cacheKey: 'mf_tier_grid_v3',
      fetcher: () => fetchMfBuyTierCards({ refresh, fund_limit: 100 }),
      applyPayload: (data) => setTierGrid(data ?? null),
      setLoading,
      setError: setTabError,
      forceNetwork: refresh,
      hasUsable: (p) => Boolean(
        p && (Number(p.enter_count) > 0 || Number(p.exit_count) > 0)
      ),
    });
  }, []);

  const loadRs = useCallback(async (refresh = false) => {
    setTabError(null);
    await runScreenPayloadFetch({
      cacheKey: `mf_rs_setup_v3_${setupMode}`,
      fetcher: () => fetchMfRsSetup({ refresh, fund_limit: 100, setup_mode: setupMode }),
      applyPayload: (data) => setRsRows(data?.data || []),
      setLoading,
      setError: setTabError,
      forceNetwork: refresh,
      hasUsable: (p) => Boolean(p && Array.isArray(p.data) && p.data.length > 0),
    });
  }, [setupMode]);

  useEffect(() => { loadFunds(); }, [loadFunds]);
  useEffect(() => {
    if (tab === 1) loadTiers();
  }, [tab, loadTiers]);
  useEffect(() => {
    if (tab === 2) loadRs();
  }, [tab, loadRs]);

  const refresh = () => {
    if (tab === 0) loadFunds(true);
    else if (tab === 1) loadTiers(true);
    else loadRs(true);
  };

  const toggleSort = (setter) => (col) => {
    setter((s) => ({
      col,
      dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  return (
    <PageWrapper>
      <Header>
        <div>
          <Title><MdAccountBalance /> Mutual Funds</Title>
          <Sub>
            Direct MFs
            {meta.updated_date ? ` · Updated ${meta.updated_date}` : ''}
            {meta.count ? ` · ${meta.count} schemes` : ''}
          </Sub>
        </div>
        <RefBtn onClick={refresh} disabled={loading}>
          <MdRefresh /> {loading ? 'Loading…' : 'Refresh'}
        </RefBtn>
      </Header>

      <TabBar>
        <Tab $active={tab === 0} onClick={() => setTab(0)}>Fund List</Tab>
        <Tab $active={tab === 1} onClick={() => setTab(1)}>Enter / Exit (B1–S3)</Tab>
        <Tab $active={tab === 2} onClick={() => setTab(2)}>RS D/W/M Setups</Tab>
      </TabBar>

      {tabError && tab !== 0 ? (
        <Empty style={{ color: '#c62828', padding: '12px 0' }}>{tabError}</Empty>
      ) : null}

      {tab === 0 && (
        <FundListTab funds={funds} loading={loading} sort={fundSort} onSort={toggleSort(setFundSort)} />
      )}
      {tab === 1 && (
        <IndicatorsTab
          grid={tierGrid}
          loading={loading}
          tf={tf}
          setTf={setTf}
          tier={tier}
          setTier={setTier}
          view={indicatorView}
          setView={setIndicatorView}
          sort={indicatorSort}
          onSort={toggleSort(setIndicatorSort)}
        />
      )}
      {tab === 2 && (
        <RsSetupTab
          rows={rsRows}
          loading={loading}
          setupMode={setupMode}
          setSetupMode={setSetupMode}
          sort={rsSort}
          onSort={toggleSort(setRsSort)}
        />
      )}
    </PageWrapper>
  );
}
