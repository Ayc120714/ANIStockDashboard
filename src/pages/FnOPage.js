import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  AreaChart, Area, ResponsiveContainer,
} from 'recharts';
import { MdRefresh } from 'react-icons/md';
import { SiTradingview } from 'react-icons/si';
import {
  fetchFnOSymbols, fetchOptionChain, fetchOptionsSummary, fetchTopMovers,
  fetchExpiryDates, calculatePayoff,
} from '../api/fno';
import {
  PageWrapper, PageHeader, Title, ControlRow, TabBar, Tab,
  SummaryCards, SummaryCard, ExpiryBar, ExpiryPill,
  ChainTable, StrikeCell, CeCell, PeCell,
  MoverRow, StrategySection, DirectionTabs, DirectionTab,
  StrategyGrid, StrategyCardEl, LegBuilder, LegRow,
  ChartWrapper, GreeksRow, RefreshBtn, EmptyState,
} from './FnOPage.styles';

const TABS = ['Options Summary', 'Open Interest', 'Options Chain', 'Movers', 'Strategy Simulator'];

const STRATEGIES = {
  Bullish: [
    { name: 'Long Call', legs: [{ action: 'buy', optionType: 'CE', offset: 0 }] },
    { name: 'Short Put', legs: [{ action: 'sell', optionType: 'PE', offset: 0 }] },
    { name: 'Bull Call Spread', legs: [{ action: 'buy', optionType: 'CE', offset: -1 }, { action: 'sell', optionType: 'CE', offset: 2 }] },
    { name: 'Bull Put Spread', legs: [{ action: 'sell', optionType: 'PE', offset: 1 }, { action: 'buy', optionType: 'PE', offset: -2 }] },
    { name: 'Long Synthetic', legs: [{ action: 'buy', optionType: 'CE', offset: 0 }, { action: 'sell', optionType: 'PE', offset: 0 }] },
  ],
  Bearish: [
    { name: 'Long Put', legs: [{ action: 'buy', optionType: 'PE', offset: 0 }] },
    { name: 'Short Call', legs: [{ action: 'sell', optionType: 'CE', offset: 0 }] },
    { name: 'Bear Call Spread', legs: [{ action: 'sell', optionType: 'CE', offset: -1 }, { action: 'buy', optionType: 'CE', offset: 2 }] },
    { name: 'Bear Put Spread', legs: [{ action: 'buy', optionType: 'PE', offset: 1 }, { action: 'sell', optionType: 'PE', offset: -2 }] },
    { name: 'Short Synthetic', legs: [{ action: 'sell', optionType: 'CE', offset: 0 }, { action: 'buy', optionType: 'PE', offset: 0 }] },
  ],
  Neutral: [
    { name: 'Long Straddle', legs: [{ action: 'buy', optionType: 'CE', offset: 0 }, { action: 'buy', optionType: 'PE', offset: 0 }] },
    { name: 'Short Straddle', legs: [{ action: 'sell', optionType: 'CE', offset: 0 }, { action: 'sell', optionType: 'PE', offset: 0 }] },
    { name: 'Long Strangle', legs: [{ action: 'buy', optionType: 'CE', offset: 2 }, { action: 'buy', optionType: 'PE', offset: -2 }] },
    { name: 'Short Strangle', legs: [{ action: 'sell', optionType: 'CE', offset: 2 }, { action: 'sell', optionType: 'PE', offset: -2 }] },
    { name: 'Iron Butterfly', legs: [{ action: 'sell', optionType: 'CE', offset: 0 }, { action: 'sell', optionType: 'PE', offset: 0 }, { action: 'buy', optionType: 'CE', offset: 3 }, { action: 'buy', optionType: 'PE', offset: -3 }] },
    { name: 'Iron Condor', legs: [{ action: 'sell', optionType: 'CE', offset: 2 }, { action: 'sell', optionType: 'PE', offset: -2 }, { action: 'buy', optionType: 'CE', offset: 4 }, { action: 'buy', optionType: 'PE', offset: -4 }] },
  ],
};

const fmt = (n, dec = 0) => n != null ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: dec }) : '—';
const fmtPct = (n) => n != null ? `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%` : '—';

const tvOptionUrl = (sym, strike, type, expiry) => {
  if (!expiry) return '#';
  const d = new Date(expiry + 'T00:00:00');
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const optChar = type === 'CE' ? 'C' : 'P';
  const ticker = `${sym}${yy}${mm}${dd}${optChar}${strike}`;
  return `https://www.tradingview.com/chart/?symbol=NSE%3A${ticker}`;
};


export default function FnOPage() {
  const [tab, setTab] = useState(0);
  const [symbol, setSymbol] = useState('NIFTY');
  const [expiry, setExpiry] = useState('');
  const [expiryDates, setExpiryDates] = useState([]);
  const [fnoSymbols, setFnoSymbols] = useState([]);
  const [fnoDetails, setFnoDetails] = useState([]);
  const [chainData, setChainData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [movers, setMovers] = useState([]);
  const [moversFilter, setMoversFilter] = useState('volume');
  const [loading, setLoading] = useState(false);
  const [moverSort, setMoverSort] = useState({ col: null, dir: 'desc' });

  const [direction, setDirection] = useState('Bullish');
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [legs, setLegs] = useState([]);
  const [payoffResult, setPayoffResult] = useState(null);

  useEffect(() => {
    fetchFnOSymbols()
      .then(resp => {
        setFnoSymbols(resp.symbols || []);
        setFnoDetails(resp.details || []);
      })
      .catch(() => setFnoSymbols(['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY']));
  }, []);

  const loadExpiries = useCallback(async (sym) => {
    try {
      const resp = await fetchExpiryDates(sym);
      const dates = resp.expiryDates || [];
      setExpiryDates(dates);
      setExpiry(prev => (dates.length && !dates.includes(prev)) ? dates[0] : prev || dates[0] || '');
    } catch { setExpiryDates([]); }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ocResp, sumResp] = await Promise.all([
        fetchOptionChain(symbol, expiry),
        fetchOptionsSummary(symbol, expiry),
      ]);
      setChainData(ocResp);
      setSummary(sumResp);
    } catch (e) {
      console.error('FnO data load failed:', e);
    } finally { setLoading(false); }
  }, [symbol, expiry]);

  const loadMovers = useCallback(async () => {
    try {
      const resp = await fetchTopMovers(symbol, expiry, moversFilter);
      setMovers(resp.movers || []);
    } catch { setMovers([]); }
  }, [symbol, expiry, moversFilter]);

  useEffect(() => { loadExpiries(symbol); }, [symbol, loadExpiries]);
  useEffect(() => { if (expiry) loadData(); }, [expiry, loadData]);
  useEffect(() => { if (tab === 3) loadMovers(); }, [tab, loadMovers]);
  useEffect(() => {
    if (!expiry) return undefined;
    const id = setInterval(() => {
      loadData();
      if (tab === 3) loadMovers();
    }, 300000); // refresh every 5 minutes
    return () => clearInterval(id);
  }, [expiry, tab, loadData, loadMovers]);

  const chain = useMemo(() => chainData?.chain || [], [chainData]);
  const spot = chainData?.spotPrice || summary?.spotPrice || 0;
  const atmStrike = useMemo(() => {
    if (!chain.length || !spot) return 0;
    return chain.reduce((prev, curr) =>
      Math.abs(curr.strikePrice - spot) < Math.abs(prev.strikePrice - spot) ? curr : prev
    ).strikePrice;
  }, [chain, spot]);

  const strikes = useMemo(() => chain.map(r => r.strikePrice), [chain]);

  const visibleChain = useMemo(() => {
    if (!chain.length || !atmStrike) return chain;
    const atmIdx = chain.findIndex(r => r.strikePrice === atmStrike);
    if (atmIdx < 0) return chain;
    const lo = Math.max(0, atmIdx - 15);
    const hi = Math.min(chain.length, atmIdx + 16);
    return chain.slice(lo, hi);
  }, [chain, atmStrike]);

  const applyStrategy = useCallback((strat) => {
    setSelectedStrategy(strat.name);
    const atmIdx = chain.findIndex(r => r.strikePrice === atmStrike);
    const newLegs = strat.legs.map(l => {
      const idx = Math.max(0, Math.min(chain.length - 1, atmIdx + l.offset));
      const row = chain[idx] || {};
      const strike = row.strikePrice || atmStrike;
      const premium = l.optionType === 'CE' ? (row.ce_ltp || 0) : (row.pe_ltp || 0);
      return { action: l.action, optionType: l.optionType, strike, lots: 1, premium, expiry };
    });
    setLegs(newLegs);
    setPayoffResult(null);
  }, [chain, atmStrike, expiry]);

  const computePayoff = useCallback(async () => {
    if (!legs.length) return;
    try {
      const result = await calculatePayoff({
        symbol, legs, spotPrice: spot, lotSize: chainData?.lotSize || 50,
      });
      setPayoffResult(result);
    } catch (e) { console.error('Payoff calc failed:', e); }
  }, [legs, symbol, spot, chainData]);

  useEffect(() => { if (legs.length) computePayoff(); }, [legs, computePayoff]);

  const updateLeg = (idx, field, value) => {
    setLegs(prev => prev.map((l, i) => i === idx ? { ...l, [field]: field === 'lots' ? parseInt(value) || 1 : field === 'premium' || field === 'strike' ? parseFloat(value) || 0 : value } : l));
  };
  const addLeg = () => setLegs(prev => [...prev, { action: 'buy', optionType: 'CE', strike: atmStrike, lots: 1, premium: 0 }]);
  const removeLeg = (idx) => setLegs(prev => prev.filter((_, i) => i !== idx));

  const oiChartData = useMemo(() =>
    chain.map(r => ({
      strike: r.strikePrice,
      'Call OI': r.ce_oi || 0,
      'Put OI': r.pe_oi || 0,
    }))
  , [chain]);

  const renderSummaryTab = () => (
    <>
      <ExpiryBar>
        {expiryDates.slice(0, 8).map(d => (
          <ExpiryPill key={d} $active={d === expiry} onClick={() => setExpiry(d)}>
            {d}
          </ExpiryPill>
        ))}
      </ExpiryBar>
      {summary && (
        <>
          <SummaryCards>
            <SummaryCard>
              <div className="label">Spot Price</div>
              <div className="value">{fmt(summary.spotPrice, 2)}</div>
            </SummaryCard>
            <SummaryCard>
              <div className="label">Futures Price</div>
              <div className="value">{fmt(summary.futuresPrice, 2)}</div>
            </SummaryCard>
            <SummaryCard>
              <div className="label">Lot Size</div>
              <div className="value">{fmt(summary.lotSize)}</div>
            </SummaryCard>
            <SummaryCard>
              <div className="label">ATM IV</div>
              <div className="value">{summary.atmIV}%</div>
              <div className="sub">Change: {fmtPct(summary.ivChange)}</div>
            </SummaryCard>
            <SummaryCard>
              <div className="label">PCR (OI)</div>
              <div className="value">{summary.pcr}</div>
            </SummaryCard>
            <SummaryCard>
              <div className="label">Max Pain</div>
              <div className="value">{fmt(summary.maxPain)}</div>
            </SummaryCard>
          </SummaryCards>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <h4 style={{ color: '#1a3c5e', fontSize: 13, marginBottom: 8 }}>Call OI Breakdown</h4>
              <ChainTable>
                <thead><tr><th>Metric</th><th>ITM</th><th>OTM</th><th>Total</th></tr></thead>
                <tbody>
                  <tr><td>OI</td><td>{fmt(summary.itmCeOI)}</td><td>{fmt(summary.otmCeOI)}</td><td>{fmt(summary.totalCeOI)}</td></tr>
                  <tr><td>Volume</td><td colSpan={2}>—</td><td>{fmt(summary.totalCeVolume)}</td></tr>
                  <tr><td>OI Change</td><td colSpan={2}>—</td><td>{fmt(summary.totalCeOIChange)}</td></tr>
                </tbody>
              </ChainTable>
            </div>
            <div>
              <h4 style={{ color: '#1a3c5e', fontSize: 13, marginBottom: 8 }}>Put OI Breakdown</h4>
              <ChainTable>
                <thead><tr><th>Metric</th><th>ITM</th><th>OTM</th><th>Total</th></tr></thead>
                <tbody>
                  <tr><td>OI</td><td>{fmt(summary.itmPeOI)}</td><td>{fmt(summary.otmPeOI)}</td><td>{fmt(summary.totalPeOI)}</td></tr>
                  <tr><td>Volume</td><td colSpan={2}>—</td><td>{fmt(summary.totalPeVolume)}</td></tr>
                  <tr><td>OI Change</td><td colSpan={2}>—</td><td>{fmt(summary.totalPeOIChange)}</td></tr>
                </tbody>
              </ChainTable>
            </div>
          </div>
        </>
      )}
    </>
  );

  const renderOITab = () => (
    <>
      <ExpiryBar>
        {expiryDates.slice(0, 8).map(d => (
          <ExpiryPill key={d} $active={d === expiry} onClick={() => setExpiry(d)}>{d}</ExpiryPill>
        ))}
      </ExpiryBar>
      <ChartWrapper>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={oiChartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
            <XAxis dataKey="strike" tick={{ fontSize: 10 }} interval={2} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Call OI" fill="#ff9800" radius={[2,2,0,0]} />
            <Bar dataKey="Put OI" fill="#7c4dff" radius={[2,2,0,0]} />
            {spot > 0 && <ReferenceLine x={atmStrike} stroke="#c62828" strokeDasharray="4 4" label={{ value: 'Spot', fill: '#c62828', fontSize: 10 }} />}
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
      {summary && (
        <SummaryCards style={{ marginTop: 16 }}>
          <SummaryCard><div className="label">Max Call OI</div><div className="value">{fmt(summary.maxCeOIStrike)}</div></SummaryCard>
          <SummaryCard><div className="label">Max Put OI</div><div className="value">{fmt(summary.maxPeOIStrike)}</div></SummaryCard>
          <SummaryCard><div className="label">PCR</div><div className="value">{summary.pcr}</div></SummaryCard>
          <SummaryCard><div className="label">Total CE OI</div><div className="value">{fmt(summary.totalCeOI)}</div></SummaryCard>
          <SummaryCard><div className="label">Total PE OI</div><div className="value">{fmt(summary.totalPeOI)}</div></SummaryCard>
        </SummaryCards>
      )}
    </>
  );

  const renderChainTab = () => (
    <>
      <ExpiryBar>
        {expiryDates.slice(0, 8).map(d => (
          <ExpiryPill key={d} $active={d === expiry} onClick={() => setExpiry(d)}>{d}</ExpiryPill>
        ))}
      </ExpiryBar>
      <div style={{ fontSize: 11, color: '#8899a6', marginBottom: 8 }}>
        Showing 15 strikes above & below ATM ({fmt(atmStrike)}) · Spot: {fmt(spot, 2)} · Lot: {chainData?.lotSize || '—'}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <ChainTable>
          <thead>
            <tr>
              <th colSpan={6} style={{ textAlign: 'center', borderRight: '2px solid #2a5280', background: '#1a3c5e', letterSpacing: 0.5 }}>
                CALLS (CE)
              </th>
              <th style={{ textAlign: 'center', background: '#0f2b45' }}>STRIKE</th>
              <th colSpan={6} style={{ textAlign: 'center', borderLeft: '2px solid #2a5280', background: '#1a3c5e', letterSpacing: 0.5 }}>
                PUTS (PE)
              </th>
            </tr>
            <tr>
              <th>OI</th><th>OI Chg</th><th>Vol</th><th>IV</th><th>LTP</th><th>Chart</th>
              <th style={{ textAlign: 'center', background: '#0f2b45' }}></th>
              <th>Chart</th><th>LTP</th><th>IV</th><th>Vol</th><th>OI Chg</th><th>OI</th>
            </tr>
          </thead>
          <tbody>
            {visibleChain.map(row => {
              const isATM = row.strikePrice === atmStrike;
              const ceITM = row.strikePrice < spot;
              const peITM = row.strikePrice > spot;
              const ceUrl = tvOptionUrl(symbol, row.strikePrice, 'CE', expiry);
              const peUrl = tvOptionUrl(symbol, row.strikePrice, 'PE', expiry);
              return (
                <tr key={row.strikePrice} style={isATM ? { background: '#e3eaf2', fontWeight: 600, borderTop: '2px solid #1a3c5e', borderBottom: '2px solid #1a3c5e' } : undefined}>
                  <CeCell $itm={ceITM}>{fmt(row.ce_oi)}</CeCell>
                  <CeCell $itm={ceITM} style={{ color: (row.ce_oi_change || 0) >= 0 ? '#2e7d32' : '#c62828' }}>{fmt(row.ce_oi_change)}</CeCell>
                  <CeCell $itm={ceITM}>{fmt(row.ce_volume)}</CeCell>
                  <CeCell $itm={ceITM}>{row.ce_iv?.toFixed(1) || '—'}</CeCell>
                  <CeCell $itm={ceITM} style={{ fontWeight: 700 }}>{fmt(row.ce_ltp, 2)}</CeCell>
                  <CeCell $itm={ceITM} style={{ textAlign: 'center', padding: '2px 4px' }}>
                    <a href={ceUrl} target="_blank" rel="noopener noreferrer" title={`${symbol} ${row.strikePrice} CE`}
                      style={{ color: '#1a3c5e', opacity: 0.65 }}>
                      <SiTradingview size={12} />
                    </a>
                  </CeCell>
                  <StrikeCell $atm={isATM} style={{ borderLeft: '2px solid #d0d7de', borderRight: '2px solid #d0d7de', fontSize: 13 }}>
                    {fmt(row.strikePrice)}
                  </StrikeCell>
                  <PeCell $itm={peITM} style={{ textAlign: 'center', padding: '2px 4px' }}>
                    <a href={peUrl} target="_blank" rel="noopener noreferrer" title={`${symbol} ${row.strikePrice} PE`}
                      style={{ color: '#1a3c5e', opacity: 0.65 }}>
                      <SiTradingview size={12} />
                    </a>
                  </PeCell>
                  <PeCell $itm={peITM} style={{ fontWeight: 700 }}>{fmt(row.pe_ltp, 2)}</PeCell>
                  <PeCell $itm={peITM}>{row.pe_iv?.toFixed(1) || '—'}</PeCell>
                  <PeCell $itm={peITM}>{fmt(row.pe_volume)}</PeCell>
                  <PeCell $itm={peITM} style={{ color: (row.pe_oi_change || 0) >= 0 ? '#2e7d32' : '#c62828' }}>{fmt(row.pe_oi_change)}</PeCell>
                  <PeCell $itm={peITM}>{fmt(row.pe_oi)}</PeCell>
                </tr>
              );
            })}
            {!visibleChain.length && (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: 20, color: '#8899a6' }}>No chain data available</td></tr>
            )}
          </tbody>
        </ChainTable>
      </div>
    </>
  );

  const toggleMoverSort = (col) => {
    setMoverSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
  };
  const sortedMovers = useMemo(() => {
    if (!moverSort.col) return movers;
    const sorted = [...movers].sort((a, b) => {
      const va = a[moverSort.col] ?? 0, vb = b[moverSort.col] ?? 0;
      return moverSort.dir === 'asc' ? va - vb : vb - va;
    });
    return sorted;
  }, [movers, moverSort]);

  const moverSortIcon = (col) => moverSort.col === col ? (moverSort.dir === 'asc' ? ' ▲' : ' ▼') : '';

  const renderMoversTab = () => (
    <>
      <ControlRow style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#4a5568' }}>Show by:</span>
        {[['volume', 'Top Traded'], ['oi_gainers', 'OI Gainers'], ['oi_losers', 'OI Losers'], ['iv', 'IV Movers']].map(([k, label]) => (
          <ExpiryPill key={k} $active={moversFilter === k} onClick={() => setMoversFilter(k)}>{label}</ExpiryPill>
        ))}
      </ControlRow>
      <ChainTable>
        <thead>
          <tr>
            <th style={{textAlign:'left'}}>Contract</th>
            <th style={{cursor:'pointer'}} onClick={() => toggleMoverSort('ltp')}>LTP{moverSortIcon('ltp')}</th>
            <th style={{cursor:'pointer'}} onClick={() => toggleMoverSort('changePct')}>Change %{moverSortIcon('changePct')}</th>
            <th style={{cursor:'pointer'}} onClick={() => toggleMoverSort('volume')}>Volume{moverSortIcon('volume')}</th>
            <th style={{cursor:'pointer'}} onClick={() => toggleMoverSort('oi')}>OI{moverSortIcon('oi')}</th>
            <th style={{cursor:'pointer'}} onClick={() => toggleMoverSort('oiChangePct')}>OI Chg %{moverSortIcon('oiChangePct')}</th>
            <th style={{cursor:'pointer'}} onClick={() => toggleMoverSort('iv')}>IV{moverSortIcon('iv')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedMovers.map((m, i) => (
            <MoverRow key={i}>
              <td style={{ textAlign: 'left', fontWeight: 600 }}>{m.contract}</td>
              <td>{fmt(m.ltp, 2)}</td>
              <td style={{ color: m.changePct >= 0 ? '#2e7d32' : '#c62828' }}>{fmtPct(m.changePct)}</td>
              <td>{fmt(m.volume)}</td>
              <td>{fmt(m.oi)}</td>
              <td style={{ color: m.oiChangePct >= 0 ? '#2e7d32' : '#c62828' }}>{fmtPct(m.oiChangePct)}</td>
              <td>{m.iv?.toFixed(1) || '—'}</td>
            </MoverRow>
          ))}
          {!sortedMovers.length && <tr><td colSpan={7}><EmptyState>No movers data</EmptyState></td></tr>}
        </tbody>
      </ChainTable>
    </>
  );

  const renderStrategyTab = () => (
    <StrategySection>
      <DirectionTabs>
        {Object.keys(STRATEGIES).map(d => (
          <DirectionTab key={d} $active={direction === d} onClick={() => { setDirection(d); setSelectedStrategy(null); setLegs([]); setPayoffResult(null); }}>
            {d}
          </DirectionTab>
        ))}
      </DirectionTabs>

      <StrategyGrid>
        {(STRATEGIES[direction] || []).map(s => (
          <StrategyCardEl key={s.name} $active={selectedStrategy === s.name} onClick={() => applyStrategy(s)}>
            <div className="name">{s.name}</div>
            <div className="desc">{s.legs.map(l => `${l.action} ${l.optionType}`).join(' + ')}</div>
          </StrategyCardEl>
        ))}
      </StrategyGrid>

      <LegBuilder>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a3c5e' }}>Position Builder</span>
          <button onClick={addLeg} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, border: '1px solid #1a3c5e', borderRadius: 4, background: '#fff', color: '#1a3c5e', cursor: 'pointer' }}>+ Add Leg</button>
        </div>
        {legs.map((leg, idx) => (
          <LegRow key={idx}>
            <select value={leg.action} onChange={e => updateLeg(idx, 'action', e.target.value)}>
              <option value="buy">Buy</option><option value="sell">Sell</option>
            </select>
            <select value={leg.optionType} onChange={e => updateLeg(idx, 'optionType', e.target.value)}>
              <option value="CE">Call (CE)</option><option value="PE">Put (PE)</option><option value="FUT">Futures</option>
            </select>
            <select value={leg.strike} onChange={e => updateLeg(idx, 'strike', e.target.value)}>
              {strikes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="number" value={leg.lots} min={1} onChange={e => updateLeg(idx, 'lots', e.target.value)} placeholder="Lots" />
            <input type="number" value={leg.premium} step={0.1} onChange={e => updateLeg(idx, 'premium', e.target.value)} placeholder="Premium" />
            <button onClick={() => removeLeg(idx)} style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #c62828', borderRadius: 4, background: '#fff', color: '#c62828', cursor: 'pointer' }}>X</button>
          </LegRow>
        ))}
        {!legs.length && <EmptyState>Select a strategy above or add legs manually</EmptyState>}
      </LegBuilder>

      {payoffResult && (
        <>
          <SummaryCards>
            <SummaryCard><div className="label">Max Profit</div><div className="value" style={{ color: '#2e7d32' }}>{fmt(payoffResult.maxProfit, 2)}</div></SummaryCard>
            <SummaryCard><div className="label">Max Loss</div><div className="value" style={{ color: '#c62828' }}>{fmt(payoffResult.maxLoss, 2)}</div></SummaryCard>
            <SummaryCard><div className="label">Breakeven</div><div className="value">{payoffResult.breakevens?.map(b => fmt(b, 2)).join(', ') || '—'}</div></SummaryCard>
            <SummaryCard><div className="label">Net Premium</div><div className="value">{fmt(payoffResult.netPremium, 2)}</div></SummaryCard>
          </SummaryCards>

          <ChartWrapper>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={payoffResult.payoff} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2e7d32" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
                <XAxis dataKey="price" tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
                <Tooltip formatter={v => fmt(v, 2)} labelFormatter={l => `Price: ${fmt(l, 2)}`} />
                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                {spot > 0 && <ReferenceLine x={spot} stroke="#c62828" strokeDasharray="4 4" label={{ value: 'Spot', fill: '#c62828', fontSize: 10 }} />}
                <Area type="monotone" dataKey="pnl" stroke="#1a3c5e" fill="url(#profitGrad)" strokeWidth={2} name="P&L" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartWrapper>

          {payoffResult.greeks && (
            <GreeksRow>
              {['delta', 'gamma', 'theta', 'vega'].map(g => (
                <div className="greek" key={g}>
                  <div className="label">{g}</div>
                  <div className="val">{payoffResult.greeks[g]}</div>
                </div>
              ))}
            </GreeksRow>
          )}
        </>
      )}
    </StrategySection>
  );

  const tabContent = [renderSummaryTab, renderOITab, renderChainTab, renderMoversTab, renderStrategyTab];

  return (
    <PageWrapper>
      <PageHeader>
        <Title>Futures & Options</Title>
        <ControlRow>
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #d0d7de', borderRadius: 6, background: '#fff', maxWidth: 340 }}
          >
            {fnoDetails.length > 0
              ? fnoDetails.map(d => (
                  <option key={d.symbol} value={d.symbol}>
                    {d.symbol} — {d.name} (Lot: {d.lotSize})
                  </option>
                ))
              : fnoSymbols.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))
            }
          </select>
          <RefreshBtn onClick={loadData} disabled={loading}>
            <MdRefresh size={14} className={loading ? 'spin' : ''} /> Refresh
          </RefreshBtn>
        </ControlRow>
      </PageHeader>

      <TabBar>
        {TABS.map((t, i) => (
          <Tab key={t} $active={tab === i} onClick={() => setTab(i)}>{t}</Tab>
        ))}
      </TabBar>

      {loading && <EmptyState>Loading data...</EmptyState>}
      {!loading && tabContent[tab]?.()}
    </PageWrapper>
  );
}
