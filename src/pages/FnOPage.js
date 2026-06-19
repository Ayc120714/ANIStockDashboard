import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  AreaChart, Area, ResponsiveContainer,
} from 'recharts';
import { MdRefresh } from 'react-icons/md';
import { SiTradingview } from 'react-icons/si';
import TradingViewLink from '../components/TradingViewLink';
import {
  fetchFnOSymbols, fetchOptionChain, fetchTopMovers,
  fetchExpiryDates, calculatePayoff, fetchNseEquitySymbols,
} from '../api/fno';
import {
  fnoCacheHasChain,
  fnoMoversCacheMatches,
  readFnoChainCache,
  readFnoPageCache,
  shouldRefreshFnoPage,
  writeFnoChainCache,
  writeFnoPageCache,
} from '../utils/fnoPageCache';
import {
  PageWrapper, PageHeader, Title, ControlRow, TabBar, Tab,
  SummaryCards, SummaryCard, ExpiryBar, ExpiryPill, SpotHeaderBar,
  ChainTable, ChainScroll, StrikeCell, PcrCell, CeCell, PeCell, TvChartCell,
  OIBarWrap, OIBarTrack, OIBar, OIRankBadge,
  OISectionTitle, OISummaryTable,
  MoverRow, StrategySection, DirectionTabs, DirectionTab,
  StrategyGrid, StrategyCardEl, LegBuilder, LegRow,
  ChartWrapper, GreeksRow, RefreshBtn, EmptyState,
} from './FnOPage.styles';

const TABS = ['Options Chain', 'Open Interest', 'Options Summary', 'Movers', 'Strategy Simulator', 'NSE cash (non-F&O)'];

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
const fmtCr = (n) => {
  if (n == null) return '—';
  const v = Number(n);
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr.`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L.`;
  return fmt(v);
};

const fmtExpiryShort = (d) => {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** TradingView NSE option ticker prefix (yymmdd + C/P + strike). */
const TV_OPT_UNDERLYING = {
  NIFTY: 'NIFTY',
  BANKNIFTY: 'BANKNIFTY',
  FINNIFTY: 'FINNIFTY',
  MIDCPNIFTY: 'MIDCPNIFTY',
  NIFTYNXT50: 'NIFTYNXT50',
};

const formatTvOptionSymbol = (sym, strike, type, expiry) => {
  if (!expiry || !sym || !type) return '';
  const underlying = TV_OPT_UNDERLYING[String(sym).toUpperCase()] || String(sym).toUpperCase();
  const dt = new Date(`${expiry}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return '';
  const yy = String(dt.getFullYear()).slice(2);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const optChar = type === 'CE' ? 'C' : 'P';
  const strikeInt = Math.round(Number(strike));
  if (!strikeInt) return '';
  return `NSE:${underlying}${yy}${mm}${dd}${optChar}${strikeInt}`;
};

const formatOptionContractLabel = (sym, strike, type, expiry) => {
  if (!expiry) return `${sym} ${strike} ${type}`;
  const dt = new Date(`${expiry}T00:00:00`);
  const expLabel = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${sym} ${expLabel} ${Math.round(Number(strike))} ${type}`;
};

function OptionTvLink({ symbol, strike, type, expiry, itm, side }) {
  const chartSymbol = formatTvOptionSymbol(symbol, strike, type, expiry);
  if (!chartSymbol) return <TvChartCell $side={side} $itm={itm}>—</TvChartCell>;
  const label = formatOptionContractLabel(symbol, strike, type, expiry);
  return (
    <TvChartCell $side={side} $itm={itm} title={`${label} → ${chartSymbol}`}>
      <TradingViewLink chartSymbol={chartSymbol} />
    </TvChartCell>
  );
}

const pctColor = (n) => (n >= 0 ? '#2e7d32' : '#c62828');

const hydrateFnoPage = () => readFnoPageCache();

function OIBarCell({ value, maxVal, type, rank }) {
  const pct = maxVal > 0 ? Math.min(100, (value / maxVal) * 100) : 0;
  return (
    <OIBarWrap>
      <OIBarTrack>
        <OIBar $type={type} style={{ width: `${pct}%` }} />
      </OIBarTrack>
      <span>{fmt(value)}</span>
      {rank ? <OIRankBadge $rank={rank}>OI {rank}</OIRankBadge> : null}
    </OIBarWrap>
  );
}

export default function FnOPage() {
  const cachedPage = useMemo(() => hydrateFnoPage(), []);

  const [tab, setTab] = useState(() => cachedPage?.tab ?? 0);
  const [symbol, setSymbol] = useState(() => cachedPage?.symbol || 'NIFTY');
  const [expiry, setExpiry] = useState(() => cachedPage?.expiry || '');
  const [expiryDates, setExpiryDates] = useState(() => cachedPage?.expiryDates || []);
  const [fnoSymbols, setFnoSymbols] = useState(() => cachedPage?.fnoSymbols || []);
  const [fnoDetails, setFnoDetails] = useState(() => cachedPage?.fnoDetails || []);
  const [chainData, setChainData] = useState(() => cachedPage?.chainData || null);
  const [summary, setSummary] = useState(() => cachedPage?.summary || null);
  const [movers, setMovers] = useState(() => cachedPage?.movers || []);
  const [moversFilter, setMoversFilter] = useState(() => cachedPage?.moversFilter || 'volume');
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(() => !fnoCacheHasChain(cachedPage));
  const [moverSort, setMoverSort] = useState({ col: null, dir: 'desc' });

  const [equityPayload, setEquityPayload] = useState(null);
  const [equityLoading, setEquityLoading] = useState(false);
  const [equityError, setEquityError] = useState('');
  const [equityFilter, setEquityFilter] = useState('');
  const [equityLoaded, setEquityLoaded] = useState(false);

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
    const pageCached = readFnoPageCache();
    if (pageCached?.symbol === sym && pageCached?.expiryDates?.length) {
      setExpiryDates(pageCached.expiryDates);
      setExpiry((prev) => {
        if (prev && pageCached.expiryDates.includes(prev)) return prev;
        if (pageCached.expiry && pageCached.expiryDates.includes(pageCached.expiry)) {
          return pageCached.expiry;
        }
        return pageCached.expiryDates[0];
      });
    }
    try {
      const resp = await fetchExpiryDates(sym);
      const dates = resp.expiryDates || [];
      setExpiryDates(dates);
      setExpiry(prev => (dates.length && prev && dates.includes(prev)) ? prev : (dates[0] || ''));
    } catch {
      if (!pageCached?.expiryDates?.length) setExpiryDates([]);
    }
  }, []);

  const applyChainPayload = useCallback((ocResp) => {
    setChainData(ocResp);
    setSummary(ocResp.summary || null);
    writeFnoChainCache(symbol, expiry, ocResp);
  }, [symbol, expiry]);

  const loadData = useCallback(async ({ background = false } = {}) => {
    if (!expiry) return;
    if (!background) setLoading(true);
    try {
      const ocResp = await fetchOptionChain(symbol, expiry);
      applyChainPayload(ocResp);
    } catch (e) {
      console.error('FnO data load failed:', e);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [symbol, expiry, applyChainPayload]);

  const restoreChainFromCache = useCallback((sym, exp) => {
    const perChain = readFnoChainCache(sym, exp);
    if (perChain?.chain?.length) {
      setChainData(perChain);
      setSummary(perChain.summary || null);
      setInitialLoad(false);
      return perChain;
    }
    const page = readFnoPageCache();
    if (page?.symbol === sym && page?.expiry === exp && page?.chainData?.chain?.length) {
      setChainData(page.chainData);
      setSummary(page.summary || null);
      setInitialLoad(false);
      return { updatedAt: page.updatedAt, ...page.chainData };
    }
    return null;
  }, []);

  useEffect(() => {
    if (!expiry) return undefined;
    let cancelled = false;

    (async () => {
      const chainHit = restoreChainFromCache(symbol, expiry);
      const updatedAt = chainHit?.updatedAt || readFnoPageCache()?.updatedAt || 0;
      const needsNetwork = await shouldRefreshFnoPage(updatedAt, Boolean(chainHit));

      if (cancelled) return;
      if (chainHit && !needsNetwork) return;

      if (chainHit) {
        loadData({ background: true });
      } else {
        loadData({ background: false });
      }
    })();

    return () => { cancelled = true; };
  }, [symbol, expiry, loadData, restoreChainFromCache]);

  const loadMovers = useCallback(async ({ background = false } = {}) => {
    if (!expiry) return;
    const pageCached = readFnoPageCache();
    if (
      !background
      && fnoMoversCacheMatches(pageCached, { symbol, expiry, moversFilter })
    ) {
      setMovers(pageCached.movers);
      return;
    }
    try {
      const resp = await fetchTopMovers(symbol, expiry, moversFilter);
      setMovers(resp.movers || []);
    } catch {
      if (!background) setMovers([]);
    }
  }, [symbol, expiry, moversFilter]);

  const chain = useMemo(() => chainData?.chain || [], [chainData]);
  const spot = chainData?.spotPrice || summary?.spotPrice || 0;
  const liveFeed = chainData?.liveFeed;

  const derivedSummary = useMemo(() => {
    if (summary) return summary;
    if (!chain.length) return null;
    const totalCeOI = chain.reduce((s, r) => s + (r.ce_oi || 0), 0);
    const totalPeOI = chain.reduce((s, r) => s + (r.pe_oi || 0), 0);
    const atmStrike = chain.reduce((prev, curr) =>
      Math.abs(curr.strikePrice - spot) < Math.abs(prev.strikePrice - spot) ? curr : prev
    ).strikePrice;
    const atmRow = chain.find(r => r.strikePrice === atmStrike) || {};
    const atmIV = ((atmRow.ce_iv || 0) + (atmRow.pe_iv || 0)) / 2;
    return {
      spotPrice: spot,
      lotSize: chainData?.lotSize,
      daysToExpiry: 0,
      atmIV: Number(atmIV.toFixed(2)),
      pcr: totalCeOI > 0 ? Number((totalPeOI / totalCeOI).toFixed(2)) : 0,
      maxPain: atmStrike,
      totalCeOI,
      totalPeOI,
    };
  }, [summary, chain, spot, chainData?.lotSize]);

  const summaryForUi = summary || derivedSummary;
  const refreshMs = useMemo(() => {
    if (liveFeed?.active && liveFeed?.refreshSec) return liveFeed.refreshSec * 1000;
    return 300000;
  }, [liveFeed?.active, liveFeed?.refreshSec]);

  useEffect(() => { loadExpiries(symbol); }, [symbol, loadExpiries]);

  useEffect(() => {
    if (tab !== 1 && tab !== 3) return;
    const pageCached = readFnoPageCache();
    if (fnoMoversCacheMatches(pageCached, { symbol, expiry, moversFilter })) {
      setMovers(pageCached.movers);
      loadMovers({ background: true });
    } else {
      loadMovers({ background: false });
    }
  }, [tab, symbol, expiry, moversFilter, loadMovers]);

  useEffect(() => {
    if (!expiry) return undefined;
    const id = setInterval(() => {
      loadData({ background: true });
      if (tab === 1 || tab === 3) loadMovers({ background: true });
    }, refreshMs);
    return () => clearInterval(id);
  }, [expiry, tab, loadData, loadMovers, refreshMs]);

  useEffect(() => {
    if (!chainData?.chain?.length && !movers.length && !expiryDates.length) return;
    writeFnoPageCache({
      tab,
      symbol,
      expiry,
      expiryDates,
      fnoSymbols,
      fnoDetails,
      chainData,
      summary,
      movers,
      moversFilter,
    });
  }, [
    tab, symbol, expiry, expiryDates, fnoSymbols, fnoDetails,
    chainData, summary, movers, moversFilter,
  ]);

  useEffect(() => {
    if (tab !== 5 || equityLoaded) return undefined;
    let cancelled = false;
    setEquityLoading(true);
    setEquityError('');
    fetchNseEquitySymbols({ exclude_fno: true, limit: 8000 })
      .then((resp) => {
        if (cancelled) return;
        setEquityPayload(resp);
        setEquityLoaded(true);
      })
      .catch((e) => {
        if (!cancelled) setEquityError(e?.message || 'Failed to load NSE equity list');
      })
      .finally(() => {
        if (!cancelled) setEquityLoading(false);
      });
    return () => { cancelled = true; };
  }, [tab, equityLoaded]);

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

  const maxCeOi = useMemo(() => Math.max(0, ...chain.map(r => r.ce_oi || 0)), [chain]);
  const maxPeOi = useMemo(() => Math.max(0, ...chain.map(r => r.pe_oi || 0)), [chain]);

  const ceOiRanks = useMemo(() => {
    const sorted = [...chain].sort((a, b) => (b.ce_oi || 0) - (a.ce_oi || 0));
    const map = {};
    sorted.slice(0, 3).forEach((r, i) => { map[r.strikePrice] = i + 1; });
    return map;
  }, [chain]);

  const peOiRanks = useMemo(() => {
    const sorted = [...chain].sort((a, b) => (b.pe_oi || 0) - (a.pe_oi || 0));
    const map = {};
    sorted.slice(0, 3).forEach((r, i) => { map[r.strikePrice] = i + 1; });
    return map;
  }, [chain]);

  const oiBreakdown = useMemo(() => {
    let itmOi = 0;
    let otmOi = 0;
    let itmOiChg = 0;
    let otmOiChg = 0;
    let itmVol = 0;
    let otmVol = 0;
    let prevItmOi = 0;
    let prevOtmOi = 0;
    for (const r of chain) {
      const s = r.strikePrice;
      const ceOi = r.ce_oi || 0;
      const peOi = r.pe_oi || 0;
      const ceChg = r.ce_oi_change || 0;
      const peChg = r.pe_oi_change || 0;
      const ceVol = r.ce_volume || 0;
      const peVol = r.pe_volume || 0;
      if (s < spot) {
        itmOi += ceOi;
        itmOiChg += ceChg;
        itmVol += ceVol;
        prevItmOi += ceOi - ceChg;
        otmOi += peOi;
        otmOiChg += peChg;
        otmVol += peVol;
        prevOtmOi += peOi - peChg;
      } else if (s > spot) {
        itmOi += peOi;
        itmOiChg += peChg;
        itmVol += peVol;
        prevItmOi += peOi - peChg;
        otmOi += ceOi;
        otmOiChg += ceChg;
        otmVol += ceVol;
        prevOtmOi += ceOi - ceChg;
      } else {
        otmOi += ceOi + peOi;
        otmOiChg += ceChg + peChg;
        otmVol += ceVol + peVol;
        prevOtmOi += (ceOi - ceChg) + (peOi - peChg);
      }
    }
    const itmOiChgPct = prevItmOi > 0 ? (itmOiChg / prevItmOi) * 100 : 0;
    const otmOiChgPct = prevOtmOi > 0 ? (otmOiChg / prevOtmOi) * 100 : 0;
    return { itmOi, otmOi, itmOiChg, otmOiChg, itmVol, otmVol, itmOiChgPct, otmOiChgPct };
  }, [chain, spot]);

  const oiChartData = useMemo(() =>
    chain.map(r => ({
      strike: r.strikePrice,
      'Call OI': r.ce_oi || 0,
      'Put OI': r.pe_oi || 0,
    }))
  , [chain]);

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

  const renderExpiryBar = () => (
    <ExpiryBar>
      {expiryDates.slice(0, 8).map(d => (
        <ExpiryPill key={d} $active={d === expiry} onClick={() => setExpiry(d)}>
          {fmtExpiryShort(d)}
        </ExpiryPill>
      ))}
    </ExpiryBar>
  );

  const renderSpotHeader = () => {
    if (!summaryForUi && !chainData) return null;
    const pcr = summaryForUi?.pcr ?? chainData?.pcr;
    const lot = summaryForUi?.lotSize ?? chainData?.lotSize;
    const atmIv = summaryForUi?.atmIV;
    const days = summaryForUi?.daysToExpiry ?? 0;
    const spotChg = chain.length ? (chain[0]?.spot_change ?? 0) : 0;
    const spotChgPct = chain.length ? (chain[0]?.spot_changePct ?? 0) : 0;
    return (
      <SpotHeaderBar>
        <div>
          <span className="spot-main">{symbol}</span>
          <span className="spot-main" style={{ marginLeft: 12 }}>{fmt(spot, 2)}</span>
          {(spotChg || spotChgPct) ? (
            <span className="spot-chg" style={{ color: pctColor(spotChgPct) }}>
              {spotChg >= 0 ? '+' : ''}{fmt(spotChg, 2)} ({fmtPct(spotChgPct)})
            </span>
          ) : null}
        </div>
        <div className="metric">ATM IV<span className="val">{atmIv != null ? `${atmIv}%` : '—'}</span></div>
        <div className="metric">Days for Expiry<span className="val">{days}</span></div>
        <div className="metric">Market Lot<span className="val">{fmt(lot)}</span></div>
        <div className="metric">PCR<span className="val">{pcr ?? '—'}</span></div>
        {liveFeed?.active && (
          <div className="metric" style={{ color: '#0d9488' }}>
            Live Feed<span className="val" style={{ color: '#0d9488' }}>● {liveFeed.contracts || 0} legs</span>
          </div>
        )}
      </SpotHeaderBar>
    );
  };

  const renderChainTab = () => (
    <>
      {renderExpiryBar()}
      {renderSpotHeader()}
      <ChainScroll>
        <ChainTable>
          <thead>
            <tr>
              <th colSpan={9} style={{ textAlign: 'center', borderRight: '2px solid #2a5280' }}>CALLS (CE)</th>
              <th style={{ textAlign: 'center' }}>STRIKE</th>
              <th style={{ textAlign: 'center' }}>PCR</th>
              <th colSpan={9} style={{ textAlign: 'center', borderLeft: '2px solid #2a5280' }}>PUTS (PE)</th>
            </tr>
            <tr>
              <th>Theta</th><th>Delta</th><th>IV</th><th>Volume</th><th>OI chg (%)</th><th>OI</th><th>LTP chg (%)</th><th>LTP</th><th>Chart</th>
              <th style={{ textAlign: 'center' }}></th>
              <th style={{ textAlign: 'center' }}></th>
              <th>Chart</th><th>LTP</th><th>LTP chg (%)</th><th>OI</th><th>OI chg (%)</th><th>Volume</th><th>IV</th><th>Delta</th><th>Theta</th>
            </tr>
          </thead>
          <tbody>
            {visibleChain.map(row => {
              const isATM = row.strikePrice === atmStrike;
              const ceITM = row.strikePrice < spot;
              const peITM = row.strikePrice > spot;
              const ceLabel = formatOptionContractLabel(symbol, row.strikePrice, 'CE', expiry);
              const peLabel = formatOptionContractLabel(symbol, row.strikePrice, 'PE', expiry);
              return (
                <tr key={row.strikePrice}>
                  <CeCell $itm={ceITM}>{row.ce_theta ?? '—'}</CeCell>
                  <CeCell $itm={ceITM}>{row.ce_delta ?? '—'}</CeCell>
                  <CeCell $itm={ceITM}>{row.ce_iv?.toFixed(2) ?? '—'}</CeCell>
                  <CeCell $itm={ceITM}>{fmt(row.ce_volume)}</CeCell>
                  <CeCell $itm={ceITM} style={{ color: pctColor(row.ce_oi_changePct ?? 0) }}>
                    {fmtPct(row.ce_oi_changePct ?? row.ce_oi_change_pct)}
                  </CeCell>
                  <CeCell $itm={ceITM}>
                    <OIBarCell value={row.ce_oi || 0} maxVal={maxCeOi} type="ce" rank={ceOiRanks[row.strikePrice]} />
                  </CeCell>
                  <CeCell $itm={ceITM} style={{ color: pctColor(row.ce_changePct ?? 0) }}>{fmtPct(row.ce_changePct)}</CeCell>
                  <CeCell $itm={ceITM} style={{ fontWeight: 700, ...(row.ce_live ? { color: '#0d9488' } : {}) }} title={ceLabel}>
                    {fmt(row.ce_ltp, 2)}{row.ce_live ? ' ●' : ''}
                  </CeCell>
                  <OptionTvLink symbol={symbol} strike={row.strikePrice} type="CE" expiry={expiry} itm={ceITM} side="ce" />
                  <StrikeCell $atm={isATM}>{fmt(row.strikePrice)}</StrikeCell>
                  <PcrCell>{row.strike_pcr ?? '—'}</PcrCell>
                  <OptionTvLink symbol={symbol} strike={row.strikePrice} type="PE" expiry={expiry} itm={peITM} side="pe" />
                  <PeCell $itm={peITM} style={{ fontWeight: 700, ...(row.pe_live ? { color: '#0d9488' } : {}) }} title={peLabel}>
                    {fmt(row.pe_ltp, 2)}{row.pe_live ? ' ●' : ''}
                  </PeCell>
                  <PeCell $itm={peITM} style={{ color: pctColor(row.pe_changePct ?? 0) }}>{fmtPct(row.pe_changePct)}</PeCell>
                  <PeCell $itm={peITM}>
                    <OIBarCell value={row.pe_oi || 0} maxVal={maxPeOi} type="pe" rank={peOiRanks[row.strikePrice]} />
                  </PeCell>
                  <PeCell $itm={peITM} style={{ color: pctColor(row.pe_oi_changePct ?? 0) }}>
                    {fmtPct(row.pe_oi_changePct ?? row.pe_oi_change_pct)}
                  </PeCell>
                  <PeCell $itm={peITM}>{fmt(row.pe_volume)}</PeCell>
                  <PeCell $itm={peITM}>{row.pe_iv?.toFixed(2) ?? '—'}</PeCell>
                  <PeCell $itm={peITM}>{row.pe_delta ?? '—'}</PeCell>
                  <PeCell $itm={peITM}>{row.pe_theta ?? '—'}</PeCell>
                </tr>
              );
            })}
            {!visibleChain.length && (
              <tr><td colSpan={21} style={{ textAlign: 'center', padding: 20, color: '#8899a6' }}>No chain data available</td></tr>
            )}
          </tbody>
        </ChainTable>
      </ChainScroll>
    </>
  );

  const renderOITab = () => (
      <>
        {renderExpiryBar()}
        <SpotHeaderBar>
          <div>
            <span className="spot-main">{symbol}</span>
            <span className="spot-main" style={{ marginLeft: 12 }}>{fmt(spot, 2)}</span>
          </div>
          <div className="metric">Total Call OI<span className="val">{fmtCr(summaryForUi?.totalCeOI)}</span></div>
          <div className="metric">Total Put OI<span className="val">{fmtCr(summaryForUi?.totalPeOI)}</span></div>
          <div className="metric">PCR<span className="val">{summaryForUi?.pcr ?? '—'}</span></div>
        </SpotHeaderBar>

        <ChartWrapper>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={oiChartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
              <XAxis dataKey="strike" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(oiChartData.length / 20))} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Call OI" fill="#ff9800" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Put OI" fill="#7c4dff" radius={[2, 2, 0, 0]} />
              {spot > 0 && (
                <ReferenceLine
                  x={atmStrike}
                  stroke="#64748b"
                  strokeWidth={2}
                  label={{ value: `LTP ${fmt(spot, 2)}`, fill: '#64748b', fontSize: 10, position: 'top' }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </ChartWrapper>

        {summaryForUi && (
          <>
            <OISectionTitle>Options Summary — {fmtExpiryShort(expiry)}</OISectionTitle>
            <SummaryCards>
              <SummaryCard><div className="label">At the Money IV</div><div className="value">{summaryForUi.atmIV}%</div><div className="sub">{fmtPct(summaryForUi.ivChange)}</div></SummaryCard>
              <SummaryCard><div className="label">Market Lot</div><div className="value">{fmt(summaryForUi.lotSize)}</div></SummaryCard>
              <SummaryCard><div className="label">Max Pain</div><div className="value">{fmt(summaryForUi.maxPain)}</div></SummaryCard>
              <SummaryCard><div className="label">PCR</div><div className="value">{summaryForUi.pcr}</div></SummaryCard>
            </SummaryCards>

            <OISummaryTable>
              <thead>
                <tr>
                  <th></th>
                  <th>Open Interest (OI)</th>
                  <th>OI Change</th>
                  <th>OI Change %</th>
                  <th>Trade Volume</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>In The Money (ITM)</strong></td>
                  <td>{fmt(oiBreakdown.itmOi)}</td>
                  <td style={{ color: pctColor(oiBreakdown.itmOiChg) }}>{fmt(oiBreakdown.itmOiChg)}</td>
                  <td style={{ color: pctColor(oiBreakdown.itmOiChgPct) }}>{fmtPct(oiBreakdown.itmOiChgPct)}</td>
                  <td>{fmt(oiBreakdown.itmVol)}</td>
                </tr>
                <tr>
                  <td><strong>Out The Money (OTM)</strong></td>
                  <td>{fmt(oiBreakdown.otmOi)}</td>
                  <td style={{ color: pctColor(oiBreakdown.otmOiChg) }}>{fmt(oiBreakdown.otmOiChg)}</td>
                  <td style={{ color: pctColor(oiBreakdown.otmOiChgPct) }}>{fmtPct(oiBreakdown.otmOiChgPct)}</td>
                  <td>{fmt(oiBreakdown.otmVol)}</td>
                </tr>
              </tbody>
            </OISummaryTable>

            <OISectionTitle>Option Contracts — Top Traded</OISectionTitle>
            <ChainTable>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Scrips</th>
                  <th style={{ textAlign: 'center' }}>Chart</th>
                  <th>LTP</th>
                  <th>Change</th>
                  <th>Change %</th>
                  <th>Volume</th>
                  <th>Open Interest</th>
                  <th>OI Change %</th>
                </tr>
              </thead>
              <tbody>
                {movers.slice(0, 10).map((m, i) => (
                  <MoverRow key={i}>
                    <td style={{ textAlign: 'left', fontWeight: 600 }}>{m.contract}</td>
                    <td style={{ textAlign: 'center' }}>
                      {formatTvOptionSymbol(symbol, m.strike, m.type, expiry) ? (
                        <TradingViewLink chartSymbol={formatTvOptionSymbol(symbol, m.strike, m.type, expiry)} />
                      ) : '—'}
                    </td>
                    <td>{fmt(m.ltp, 2)}</td>
                    <td style={{ color: pctColor(m.change ?? m.changePct) }}>{m.change != null ? fmt(m.change, 2) : '—'}</td>
                    <td style={{ color: pctColor(m.changePct) }}>{fmtPct(m.changePct)}</td>
                    <td>{fmt(m.volume)}</td>
                    <td>{fmt(m.oi)}</td>
                    <td style={{ color: pctColor(m.oiChangePct) }}>{fmtPct(m.oiChangePct)}</td>
                  </MoverRow>
                ))}
                {!movers.length && <tr><td colSpan={8}><EmptyState>No top traded contracts</EmptyState></td></tr>}
              </tbody>
            </ChainTable>
          </>
        )}
      </>
    );

  const renderSummaryTab = () => (
    <>
      {renderExpiryBar()}
      {summaryForUi && (
        <>
          <SummaryCards>
            <SummaryCard><div className="label">Spot Price</div><div className="value">{fmt(summaryForUi.spotPrice, 2)}</div></SummaryCard>
            <SummaryCard><div className="label">Futures Price</div><div className="value">{fmt(summaryForUi.futuresPrice, 2)}</div></SummaryCard>
            <SummaryCard><div className="label">Lot Size</div><div className="value">{fmt(summaryForUi.lotSize)}</div></SummaryCard>
            <SummaryCard><div className="label">ATM IV</div><div className="value">{summaryForUi.atmIV}%</div><div className="sub">Change: {fmtPct(summaryForUi.ivChange)}</div></SummaryCard>
            <SummaryCard><div className="label">PCR (OI)</div><div className="value">{summaryForUi.pcr}</div></SummaryCard>
            <SummaryCard><div className="label">Max Pain</div><div className="value">{fmt(summaryForUi.maxPain)}</div></SummaryCard>
          </SummaryCards>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <h4 style={{ color: '#1a3c5e', fontSize: 13, marginBottom: 8 }}>Call OI Breakdown</h4>
              <ChainTable>
                <thead><tr><th>Metric</th><th>ITM</th><th>OTM</th><th>Total</th></tr></thead>
                <tbody>
                  <tr><td>OI</td><td>{fmt(summaryForUi.itmCeOI)}</td><td>{fmt(summaryForUi.otmCeOI)}</td><td>{fmt(summaryForUi.totalCeOI)}</td></tr>
                  <tr><td>Volume</td><td>{fmt(summaryForUi.itmCeVolume)}</td><td>{fmt(summaryForUi.otmCeVolume)}</td><td>{fmt(summaryForUi.totalCeVolume)}</td></tr>
                  <tr><td>OI Change</td><td colSpan={2}>—</td><td>{fmt(summaryForUi.totalCeOIChange)}</td></tr>
                </tbody>
              </ChainTable>
            </div>
            <div>
              <h4 style={{ color: '#1a3c5e', fontSize: 13, marginBottom: 8 }}>Put OI Breakdown</h4>
              <ChainTable>
                <thead><tr><th>Metric</th><th>ITM</th><th>OTM</th><th>Total</th></tr></thead>
                <tbody>
                  <tr><td>OI</td><td>{fmt(summaryForUi.itmPeOI)}</td><td>{fmt(summaryForUi.otmPeOI)}</td><td>{fmt(summaryForUi.totalPeOI)}</td></tr>
                  <tr><td>Volume</td><td>{fmt(summaryForUi.itmPeVolume)}</td><td>{fmt(summaryForUi.otmPeVolume)}</td><td>{fmt(summaryForUi.totalPeVolume)}</td></tr>
                  <tr><td>OI Change</td><td colSpan={2}>—</td><td>{fmt(summaryForUi.totalPeOIChange)}</td></tr>
                </tbody>
              </ChainTable>
            </div>
          </div>
        </>
      )}
    </>
  );

  const toggleMoverSort = (col) => {
    setMoverSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
  };
  const sortedMovers = useMemo(() => {
    if (!moverSort.col) return movers;
    return [...movers].sort((a, b) => {
      const va = a[moverSort.col] ?? 0;
      const vb = b[moverSort.col] ?? 0;
      return moverSort.dir === 'asc' ? va - vb : vb - va;
    });
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
            <th style={{ textAlign: 'left' }}>Contract</th>
            <th style={{ textAlign: 'center' }}>Chart</th>
            <th style={{ cursor: 'pointer' }} onClick={() => toggleMoverSort('ltp')}>LTP{moverSortIcon('ltp')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => toggleMoverSort('changePct')}>Change %{moverSortIcon('changePct')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => toggleMoverSort('volume')}>Volume{moverSortIcon('volume')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => toggleMoverSort('oi')}>OI{moverSortIcon('oi')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => toggleMoverSort('oiChangePct')}>OI Chg %{moverSortIcon('oiChangePct')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => toggleMoverSort('iv')}>IV{moverSortIcon('iv')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedMovers.map((m, i) => (
            <MoverRow key={i}>
              <td style={{ textAlign: 'left', fontWeight: 600 }}>{m.contract}</td>
              <td style={{ textAlign: 'center' }}>
                {formatTvOptionSymbol(symbol, m.strike, m.type, expiry) ? (
                  <TradingViewLink chartSymbol={formatTvOptionSymbol(symbol, m.strike, m.type, expiry)} />
                ) : '—'}
              </td>
              <td>{fmt(m.ltp, 2)}</td>
              <td style={{ color: pctColor(m.changePct) }}>{fmtPct(m.changePct)}</td>
              <td>{fmt(m.volume)}</td>
              <td>{fmt(m.oi)}</td>
              <td style={{ color: pctColor(m.oiChangePct) }}>{fmtPct(m.oiChangePct)}</td>
              <td>{m.iv?.toFixed(1) || '—'}</td>
            </MoverRow>
          ))}
          {!sortedMovers.length && <tr><td colSpan={8}><EmptyState>No movers data</EmptyState></td></tr>}
        </tbody>
      </ChainTable>
    </>
  );

  const filteredEquityRows = useMemo(() => {
    const rows = Array.isArray(equityPayload?.data) ? equityPayload.data : [];
    const q = String(equityFilter || '').trim().toUpperCase();
    if (!q) return rows;
    return rows.filter((r) => String(r.symbol || '').toUpperCase().includes(q) || String(r.name || '').toUpperCase().includes(q));
  }, [equityPayload, equityFilter]);

  const renderEquityCashTab = () => (
    <div style={{ padding: '4px 0' }}>
      <p style={{ fontSize: 12, color: '#475569', margin: '0 0 12px' }}>
        NSE series <strong>EQ</strong> from Dhan scrip master, excluding symbols that appear as F&amp;O underlyings in this app.
      </p>
      {equityPayload && equityPayload.ok !== false && (
        <div style={{ fontSize: 12, color: '#334155', marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <span>Dhan EQ total: <strong>{equityPayload.dhan_nse_eq_total ?? '—'}</strong></span>
          <span>Non-F&amp;O EQ: <strong>{equityPayload.dhan_eq_not_in_fno_total ?? '—'}</strong></span>
          <span>Loaded rows: <strong>{(equityPayload.data || []).length}</strong></span>
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <input
          type="text"
          placeholder="Filter by symbol or company name…"
          value={equityFilter}
          onChange={(e) => setEquityFilter(e.target.value)}
          style={{ width: '100%', maxWidth: 420, padding: '8px 10px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6 }}
        />
      </div>
      {equityLoading && <EmptyState>Loading Dhan NSE equity list…</EmptyState>}
      {equityError && <div style={{ color: '#b91c1c', padding: 12 }}>{equityError}</div>}
      {!equityLoading && !equityError && equityPayload?.ok === false && (
        <EmptyState>Dhan scrip master unavailable — check network or try again later.</EmptyState>
      )}
      {!equityLoading && !equityError && equityPayload?.ok !== false && (
        <div style={{ maxHeight: 480, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
          <ChainTable>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Symbol</th>
                <th style={{ textAlign: 'left' }}>Company</th>
                <th style={{ textAlign: 'left' }}>Dhan security_id</th>
                <th style={{ textAlign: 'center' }}>TV</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquityRows.slice(0, 1500).map((r) => (
                <MoverRow key={r.symbol}>
                  <td style={{ fontWeight: 700 }}>{r.symbol}</td>
                  <td style={{ fontSize: 12 }}>{r.name}</td>
                  <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{r.security_id}</td>
                  <td style={{ textAlign: 'center' }}>
                    <a href={`https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(r.symbol)}`} target="_blank" rel="noreferrer" title="Open in TradingView">
                      <SiTradingview size={14} />
                    </a>
                  </td>
                </MoverRow>
              ))}
              {!filteredEquityRows.length && (
                <tr><td colSpan={4}><EmptyState>No rows match the filter.</EmptyState></td></tr>
              )}
            </tbody>
          </ChainTable>
        </div>
      )}
    </div>
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

  const tabContent = [renderChainTab, renderOITab, renderSummaryTab, renderMoversTab, renderStrategyTab, renderEquityCashTab];

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
          {liveFeed?.active && (
            <span
              title={liveFeed.dhanWsConnected ? 'Dhan WS connected' : 'Dhan WS reconnecting'}
              style={{
                fontSize: 11, fontWeight: 700,
                color: liveFeed.dhanWsConnected ? '#0d9488' : '#b45309',
                padding: '4px 8px', borderRadius: 6,
                background: liveFeed.dhanWsConnected ? '#ecfdf5' : '#fffbeb',
                border: `1px solid ${liveFeed.dhanWsConnected ? '#99f6e4' : '#fde68a'}`,
              }}
            >
              ● LIVE
            </span>
          )}
          {chainData?.dataSource && (
            <span style={{ fontSize: 10, color: '#8899a6' }}>
              {chainData.dataSource}{chainData.stale ? ' (cached)' : ''}
            </span>
          )}
        </ControlRow>
      </PageHeader>

      <TabBar>
        {TABS.map((t, i) => (
          <Tab key={t} $active={tab === i} onClick={() => setTab(i)}>{t}</Tab>
        ))}
      </TabBar>

      {loading && initialLoad && tab !== 5 && <EmptyState>Loading data...</EmptyState>}
      {(!loading || !initialLoad) && tabContent[tab]?.()}
    </PageWrapper>
  );
}
