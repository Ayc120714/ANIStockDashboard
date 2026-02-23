import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdCurrencyExchange } from 'react-icons/md';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';
import { fetchForexRates, fetchForexHistory, fetchCurrencyFutures } from '../api/forex';

const PageWrapper = styled.div`
  padding: 18px 24px 32px;
  max-width: 1440px;
  margin: 0 auto;
  font-family: 'Inter', -apple-system, sans-serif;
`;

const Header = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 12px; margin-bottom: 20px;
`;

const Title = styled.h1`
  font-size: 22px; font-weight: 700; color: #1a3c5e; margin: 0;
  display: flex; align-items: center; gap: 8px;
`;

const RefBtn = styled.button`
  display: flex; align-items: center; gap: 5px;
  padding: 6px 14px; font-size: 12px; font-weight: 600;
  border: 1px solid #d0d7de; border-radius: 6px; background: #fff; color: #4a5568; cursor: pointer;
  &:hover { border-color: #1a3c5e; color: #1a3c5e; }
`;

const CardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px; margin-bottom: 24px;
`;

const PairCard = styled.div`
  background: #fff; border: 1px solid ${p => p.$active ? '#1a3c5e' : '#e0e6ed'};
  border-radius: 10px; padding: 16px; cursor: pointer; transition: all 0.15s;
  box-shadow: ${p => p.$active ? '0 2px 8px rgba(26,60,94,0.12)' : 'none'};
  &:hover { border-color: #1a3c5e; }
  .pair { font-size: 14px; font-weight: 700; color: #1a3c5e; }
  .rate { font-size: 20px; font-weight: 700; color: #334155; margin-top: 6px; }
  .change { font-size: 12px; font-weight: 600; margin-top: 2px; }
`;

const TabBar = styled.div`
  display: flex; gap: 0; border-bottom: 2px solid #e0e6ed; margin-bottom: 16px;
`;

const Tab = styled.button`
  padding: 9px 20px; font-size: 13px; font-weight: 600; border: none; background: transparent;
  color: ${p => p.$active ? '#1a3c5e' : '#8899a6'};
  border-bottom: 2px solid ${p => p.$active ? '#1a3c5e' : 'transparent'};
  margin-bottom: -2px; cursor: pointer;
  &:hover { color: #1a3c5e; }
`;

const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 12px;
  thead {
    background: #1a3c5e;
    th { color: #fff; padding: 8px 10px; font-weight: 600; font-size: 11px; text-align: right; white-space: nowrap;
      &:first-child { text-align: left; }
    }
  }
  tbody tr {
    border-bottom: 1px solid #eef1f5; transition: background 0.12s;
    &:hover { background: #f5f8fc; }
    &:nth-child(even) { background: #fafbfc; }
    &:nth-child(even):hover { background: #f0f4f8; }
  }
  td { padding: 6px 10px; text-align: right; color: #334155;
    &:first-child { text-align: left; font-weight: 600; }
  }
`;

const ChartBox = styled.div`
  background: #fff; border: 1px solid #e0e6ed; border-radius: 8px; padding: 16px; margin-top: 12px;
`;

const SectionTitle = styled.h2`
  font-size: 15px; font-weight: 700; color: #1a3c5e; margin: 24px 0 12px;
`;

const SparkGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px; margin-bottom: 20px;
`;

const SparkCard = styled.div`
  background: #fff; border: 1px solid #e0e6ed; border-radius: 10px; padding: 14px;
  .pair-label { font-size: 13px; font-weight: 700; color: #1a3c5e; margin-bottom: 8px; }
`;

const Empty = styled.div`
  text-align: center; padding: 40px; color: #8899a6; font-size: 14px;
`;

const fmt = (n, dec = 4) => n != null ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: dec, minimumFractionDigits: 2 }) : '—';
const fmtPct = (n) => n != null ? `${n >= 0 ? '+' : ''}${Number(n).toFixed(4)}%` : '—';

export default function ForexPage() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [selectedPair, setSelectedPair] = useState('USD/INR');
  const [history, setHistory] = useState([]);
  const [futures, setFutures] = useState([]);
  const [sparkData, setSparkData] = useState({});

  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetchForexRates();
      setRates(resp.rates || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const loadHistory = useCallback(async (pair) => {
    try {
      const resp = await fetchForexHistory(pair, 30);
      setHistory(resp.history || []);
    } catch { setHistory([]); }
  }, []);

  const loadFutures = useCallback(async () => {
    const syms = ['USDINR', 'EURINR', 'GBPINR', 'JPYINR'];
    const all = {};
    for (const s of syms) {
      try {
        const resp = await fetchCurrencyFutures(s);
        all[s] = resp.futures || [];
      } catch { all[s] = []; }
    }
    setFutures(Object.entries(all).flatMap(([sym, futs]) =>
      futs.map(f => ({ symbol: sym, ...f }))
    ));
  }, []);

  const loadSparklines = useCallback(async () => {
    const pairs = ['USD/INR', 'EUR/INR', 'GBP/INR', 'EUR/USD'];
    const result = {};
    for (const p of pairs) {
      try {
        const resp = await fetchForexHistory(p, 30);
        result[p] = resp.history || [];
      } catch { result[p] = []; }
    }
    setSparkData(result);
  }, []);

  useEffect(() => { loadRates(); }, [loadRates]);
  useEffect(() => { if (tab === 1 && selectedPair) loadHistory(selectedPair); }, [tab, selectedPair, loadHistory]);
  useEffect(() => { if (tab === 2) loadFutures(); }, [tab, loadFutures]);
  useEffect(() => { if (tab === 3) loadSparklines(); }, [tab, loadSparklines]);

  const INR_PAIRS = rates.filter(r => r.quote === 'INR');

  return (
    <PageWrapper>
      <Header>
        <Title><MdCurrencyExchange size={24} /> Forex</Title>
        <RefBtn onClick={loadRates} disabled={loading}><MdRefresh size={14} /> Refresh</RefBtn>
      </Header>

      <CardsGrid>
        {(INR_PAIRS.length ? INR_PAIRS : rates.slice(0, 4)).map(r => (
          <PairCard key={r.pair} $active={selectedPair === r.pair} onClick={() => setSelectedPair(r.pair)}>
            <div className="pair">{r.pair}</div>
            <div className="rate">{fmt(r.rate)}</div>
            <div className="change" style={{ color: r.change >= 0 ? '#2e7d32' : '#c62828' }}>
              {r.change >= 0 ? '+' : ''}{fmt(r.change)} ({fmtPct(r.changePct)})
            </div>
          </PairCard>
        ))}
      </CardsGrid>

      <TabBar>
        <Tab $active={tab === 0} onClick={() => setTab(0)}>Rate Table</Tab>
        <Tab $active={tab === 1} onClick={() => setTab(1)}>Chart</Tab>
        <Tab $active={tab === 2} onClick={() => setTab(2)}>NSE Currency Futures</Tab>
        <Tab $active={tab === 3} onClick={() => setTab(3)}>Sparklines</Tab>
      </TabBar>

      {tab === 0 && (
        <Table>
          <thead>
            <tr><th>Pair</th><th>Rate</th><th>Change</th><th>Change %</th><th>Bid</th><th>Ask</th><th>High</th><th>Low</th></tr>
          </thead>
          <tbody>
            {rates.map(r => (
              <tr key={r.pair} style={{ cursor: 'pointer' }} onClick={() => setSelectedPair(r.pair)}>
                <td>{r.pair}</td>
                <td style={{ fontWeight: 600 }}>{fmt(r.rate)}</td>
                <td style={{ color: r.change >= 0 ? '#2e7d32' : '#c62828' }}>{r.change >= 0 ? '+' : ''}{fmt(r.change)}</td>
                <td style={{ color: r.changePct >= 0 ? '#2e7d32' : '#c62828' }}>{fmtPct(r.changePct)}</td>
                <td>{fmt(r.bid)}</td>
                <td>{fmt(r.ask)}</td>
                <td>{fmt(r.high)}</td>
                <td>{fmt(r.low)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {tab === 1 && (
        <>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#4a5568' }}>Pair:</span>
            <select value={selectedPair} onChange={e => { setSelectedPair(e.target.value); loadHistory(e.target.value); }}
              style={{ padding: '5px 10px', fontSize: 12, border: '1px solid #d0d7de', borderRadius: 6 }}>
              {rates.map(r => <option key={r.pair} value={r.pair}>{r.pair}</option>)}
            </select>
          </div>
          <ChartBox>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={history} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#1a3c5e" strokeWidth={2} dot={false} name={selectedPair} />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </>
      )}

      {tab === 2 && (
        <>
          <SectionTitle>NSE Currency Futures</SectionTitle>
          <Table>
            <thead>
              <tr><th>Symbol</th><th>Expiry</th><th>LTP</th><th>Change</th><th>Change %</th><th>OI</th><th>Volume</th><th>Bid</th><th>Ask</th></tr>
            </thead>
            <tbody>
              {futures.map((f, i) => (
                <tr key={i}>
                  <td>{f.symbol}</td>
                  <td style={{ textAlign: 'right' }}>{f.expiryDate}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(f.lastTradedPrice)}</td>
                  <td style={{ color: f.change >= 0 ? '#2e7d32' : '#c62828' }}>{f.change >= 0 ? '+' : ''}{fmt(f.change)}</td>
                  <td style={{ color: f.changePercent >= 0 ? '#2e7d32' : '#c62828' }}>{fmtPct(f.changePercent)}</td>
                  <td>{Number(f.openInterest || 0).toLocaleString('en-IN')}</td>
                  <td>{Number(f.volume || 0).toLocaleString('en-IN')}</td>
                  <td>{fmt(f.bid)}</td>
                  <td>{fmt(f.ask)}</td>
                </tr>
              ))}
              {!futures.length && <tr><td colSpan={9}><Empty>Loading futures data...</Empty></td></tr>}
            </tbody>
          </Table>
        </>
      )}

      {tab === 3 && (
        <SparkGrid>
          {Object.entries(sparkData).map(([pair, data]) => (
            <SparkCard key={pair}>
              <div className="pair-label">{pair} — 30 Day Trend</div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={data}>
                  <XAxis dataKey="date" tick={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9 }} width={50} />
                  <Tooltip labelFormatter={l => `Date: ${l}`} formatter={v => fmt(v)} />
                  <Line type="monotone" dataKey="rate" stroke="#1a3c5e" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </SparkCard>
          ))}
          {!Object.keys(sparkData).length && <Empty>Loading sparklines...</Empty>}
        </SparkGrid>
      )}
    </PageWrapper>
  );
}
