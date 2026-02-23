import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MdRefresh, MdDiamond } from 'react-icons/md';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchCommodityQuotes, fetchCommodityOptionChain } from '../api/commodities';

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

const CommodityCard = styled.div`
  background: #fff; border: 1px solid ${p => p.$active ? '#1a3c5e' : '#e0e6ed'};
  border-radius: 10px; padding: 16px; cursor: pointer;
  transition: all 0.15s;
  box-shadow: ${p => p.$active ? '0 2px 8px rgba(26,60,94,0.12)' : 'none'};
  &:hover { border-color: #1a3c5e; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
  .name { font-size: 13px; font-weight: 700; color: #1a3c5e; }
  .symbol { font-size: 10px; color: #8899a6; margin-top: 1px; }
  .price { font-size: 20px; font-weight: 700; color: #334155; margin-top: 8px; }
  .change { font-size: 12px; font-weight: 600; margin-top: 2px; }
`;

const SectionTitle = styled.h2`
  font-size: 15px; font-weight: 700; color: #1a3c5e; margin: 24px 0 12px;
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

const ChartBox = styled.div`
  background: #fff; border: 1px solid #e0e6ed; border-radius: 8px; padding: 16px; margin-top: 12px;
`;

const Empty = styled.div`
  text-align: center; padding: 40px; color: #8899a6; font-size: 14px;
`;

const fmt = (n, dec = 2) => n != null ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: dec }) : '—';
const fmtPct = (n) => n != null ? `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%` : '—';

export default function CommoditiesPage() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [selectedSym, setSelectedSym] = useState('GOLDM');
  const [ocData, setOcData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetchCommodityQuotes();
      setQuotes(resp.quotes || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const loadOC = useCallback(async (sym) => {
    try {
      const resp = await fetchCommodityOptionChain(sym);
      setOcData(resp);
    } catch { setOcData(null); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 1 && selectedSym) loadOC(selectedSym); }, [tab, selectedSym, loadOC]);

  const topFour = quotes.slice(0, 4);
  const oiData = (ocData?.chain || []).map(r => ({
    strike: r.strikePrice,
    'Call OI': r.ce_oi || 0,
    'Put OI': r.pe_oi || 0,
  }));

  return (
    <PageWrapper>
      <Header>
        <Title><MdDiamond size={24} /> MCX Commodities</Title>
        <RefBtn onClick={load} disabled={loading}><MdRefresh size={14} /> Refresh</RefBtn>
      </Header>

      <CardsGrid>
        {(topFour.length ? topFour : quotes.slice(0, 4)).map(q => (
          <CommodityCard key={q.symbol} $active={selectedSym === q.symbol} onClick={() => setSelectedSym(q.symbol)}>
            <div className="name">{q.name}</div>
            <div className="symbol">{q.symbol} · {q.unit}</div>
            <div className="price">₹{fmt(q.price)}</div>
            <div className="change" style={{ color: q.change >= 0 ? '#2e7d32' : '#c62828' }}>
              {q.change >= 0 ? '+' : ''}{fmt(q.change)} ({fmtPct(q.changePct)})
            </div>
          </CommodityCard>
        ))}
      </CardsGrid>

      <TabBar>
        <Tab $active={tab === 0} onClick={() => setTab(0)}>Price Table</Tab>
        <Tab $active={tab === 1} onClick={() => setTab(1)}>Option Chain</Tab>
      </TabBar>

      {tab === 0 && (
        <>
          {loading && <Empty>Loading...</Empty>}
          {!loading && (
            <Table>
              <thead>
                <tr><th>Commodity</th><th>Symbol</th><th>Unit</th><th>Price (₹)</th><th>Change</th><th>Change %</th><th>Open</th><th>High</th><th>Low</th></tr>
              </thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.symbol} onClick={() => setSelectedSym(q.symbol)} style={{ cursor: 'pointer' }}>
                    <td>{q.name}</td>
                    <td style={{ textAlign: 'right' }}>{q.symbol}</td>
                    <td style={{ textAlign: 'right' }}>{q.unit}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(q.price)}</td>
                    <td style={{ color: q.change >= 0 ? '#2e7d32' : '#c62828' }}>{q.change >= 0 ? '+' : ''}{fmt(q.change)}</td>
                    <td style={{ color: q.changePct >= 0 ? '#2e7d32' : '#c62828' }}>{fmtPct(q.changePct)}</td>
                    <td>{fmt(q.open)}</td>
                    <td>{fmt(q.high)}</td>
                    <td>{fmt(q.low)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}

      {tab === 1 && (
        <>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#4a5568' }}>Commodity:</span>
            <select value={selectedSym} onChange={e => setSelectedSym(e.target.value)}
              style={{ padding: '5px 10px', fontSize: 12, border: '1px solid #d0d7de', borderRadius: 6 }}>
              {quotes.map(q => <option key={q.symbol} value={q.symbol}>{q.name} ({q.symbol})</option>)}
            </select>
          </div>

          {oiData.length > 0 && (
            <ChartBox>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={oiData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
                  <XAxis dataKey="strike" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Call OI" fill="#ff9800" radius={[2,2,0,0]} />
                  <Bar dataKey="Put OI" fill="#7c4dff" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          )}

          <SectionTitle>Option Chain — {selectedSym}</SectionTitle>
          <Table>
            <thead>
              <tr><th>CE OI</th><th>CE Vol</th><th>CE LTP</th><th>CE IV</th><th style={{textAlign:'center'}}>Strike</th><th>PE IV</th><th>PE LTP</th><th>PE Vol</th><th>PE OI</th></tr>
            </thead>
            <tbody>
              {(ocData?.chain || []).map(r => (
                <tr key={r.strikePrice}>
                  <td>{fmt(r.ce_oi, 0)}</td>
                  <td>{fmt(r.ce_volume, 0)}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(r.ce_ltp)}</td>
                  <td>{r.ce_iv?.toFixed(1) || '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#1a3c5e' }}>{fmt(r.strikePrice, 0)}</td>
                  <td>{r.pe_iv?.toFixed(1) || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(r.pe_ltp)}</td>
                  <td>{fmt(r.pe_volume, 0)}</td>
                  <td>{fmt(r.pe_oi, 0)}</td>
                </tr>
              ))}
              {!(ocData?.chain?.length) && <tr><td colSpan={9}><Empty>No option chain data</Empty></td></tr>}
            </tbody>
          </Table>
        </>
      )}
    </PageWrapper>
  );
}
