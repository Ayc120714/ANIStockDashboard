import React, { useEffect, useState, useMemo } from 'react';
import { TablePagination } from '@mui/material';
import { fetchMarketIndices, fetchMarketIndicesTable } from '../api/marketIndices';
import { fetchFiiDiiActivity } from '../api/fiiDii';
import { useBootstrapReadyState } from '../context/BootstrapReadyContext';
import {
  CardContainer,
  Card,
  CardHeader,
  CardValue,
  CardChange,
  CardStats,
  CashCard,
  CashTitle,
  CashSubtitle,
  CashValue,
  BarChart,
  CashCardContainer,
  SmallCardContainer,
  SmallFull,
  SmallHalf,
  TableSection,
  TableTitle,
  TableWrapper,
  Table
} from './MarketOutlook.styles';

const MIN_FII_DII_DAYS = 20;
const MARKET_REFRESH_MS = 30000;
const INDICES_TABLE_ROWS_PER_PAGE_OPTIONS = [10, 15, 25, 50];

function MarketOutlookContent({ apiReady, timedOut, bootstrapComplete }) {
  const defaultIndexCards = [
    { title: 'Nifty 50', trend: 'UP TREND', value: '25,879', change: '+0.01%', percentile: '96%', pe: '23 PE' },
    { title: 'Next 50', trend: 'UP TREND', value: '69,852', change: '+0.00%', percentile: '79%', pe: '20 PE' },
    { title: 'Midcap 100', trend: 'UP TREND', value: '60,692', change: '-0.35%', percentile: '98%', pe: '34 PE' }
  ];

  const [fiiDiiData, setFiiDiiData] = useState(null);
  const [fiiDiiLoadState, setFiiDiiLoadState] = useState('idle'); // idle | loading | error | done

  const defaultSmallcapCards = [
    { title: 'Smallcap 100', trend: 'UP TREND', value: '18,184', change: '-0.37%', percentile: '71%', pe: '31 PE' },
    { title: 'Microcap 250', trend: 'SIDEWAYS', value: '23,595', change: '-0.09%', percentile: '60%', pe: '29 PE' },
    { title: 'India VIX', trend: 'SIDEWAYS', value: '12', change: '+0.43%', percentile: '—', pe: '—' }
  ];

  const [indexCards, setIndexCards] = useState(defaultIndexCards);
  const [smallcapCards, setSmallcapCards] = useState(defaultSmallcapCards);
  const [tableData, setTableData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [fiiHoverIdx, setFiiHoverIdx] = useState(null);
  const [diiHoverIdx, setDiiHoverIdx] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const load = async ({ silent = false } = {}) => {
      if (!silent) {
        setIsLoading(true);
        setLoadError(null);
      }
      try {
        const [normalized, tableRows] = await Promise.all([fetchMarketIndices(), fetchMarketIndicesTable()]);
        if (!isMounted) return;
        if (normalized.indexCards?.length) setIndexCards(normalized.indexCards);
        if (normalized.smallcapCards?.length) {
          const cards = normalized.smallcapCards;
          const pad = () => ({ title: '—', trend: 'SIDEWAYS', value: '—', change: '—', percentile: '—', pe: '—' });
          const padded = [...cards.slice(0, 3), ...Array(Math.max(0, 3 - cards.length)).fill(null).map(pad)];
          setSmallcapCards(padded.slice(0, 3));
        }
        setTableData(Array.isArray(tableRows) ? tableRows : []);
        setLastRefreshedAt(new Date());
      } catch (error) {
        if (isMounted && !silent) setLoadError(error?.message || 'Failed to load market data.');
      } finally {
        if (isMounted && !silent) setIsLoading(false);
      }
    };

    const loadFiiDii = async () => {
      setFiiDiiLoadState('loading');
      try {
        const data = await fetchFiiDiiActivity(MIN_FII_DII_DAYS);
        if (isMounted && data) {
          setFiiDiiData(data);
          setFiiDiiLoadState('done');
        } else if (isMounted) {
          setFiiDiiLoadState('error');
        }
      } catch (err) {
        console.warn('FII/DII fetch failed:', err?.message || err);
        if (isMounted) setFiiDiiLoadState('error');
      }
    };

    load();
    loadFiiDii();
    const marketTimer = setInterval(() => {
      load({ silent: true });
    }, MARKET_REFRESH_MS);

    return () => {
      isMounted = false;
      clearInterval(marketTimer);
    };
  }, []);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [tablePage, setTablePage] = useState(0);
  const [tableRowsPerPage, setTableRowsPerPage] = useState(15);

  const sortedTableData = React.useMemo(() => {
    const sortableItems = [...tableData];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Attempt numeric sort, otherwise string sort
        // Remove symbols for numbers and parse
        const numericKeys = [
          'value', 'percentile', 'day1d', 'week1w', 'month1m', 'month3m', 'month6m', 'year1y', 'year3y'
        ];
        if (numericKeys.includes(sortConfig.key)) {
          aValue = parseFloat((aValue || '').replace(/[^\d.-]/g, ''));
          bValue = parseFloat((bValue || '').replace(/[^\d.-]/g, ''));
          aValue = isNaN(aValue) ? -Infinity : aValue;
          bValue = isNaN(bValue) ? -Infinity : bValue;
        }
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [tableData, sortConfig]);

  const paginatedTableRows = useMemo(() => {
    const start = tablePage * tableRowsPerPage;
    return sortedTableData.slice(start, start + tableRowsPerPage);
  }, [sortedTableData, tablePage, tableRowsPerPage]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setTablePage(0);
  };

  // Column configuration for header rendering
  const columnConfig = [
    { key: 'id', label: '#' },
    { key: 'name', label: 'Index' },
    { key: 'trend', label: 'Trend' },
    { key: 'value', label: 'CMP' },
    { key: 'percentile', label: 'Percentile' },
    { key: 'day1d', label: '1D' },
    { key: 'week1w', label: '1W' },
    { key: 'month1m', label: '1M' },
    { key: 'month3m', label: '3M' },
    { key: 'month6m', label: '6M' },
    { key: 'year1y', label: '1Y' },
    { key: 'year3y', label: '3Y' }
  ];

  const fmtCr = (val) => {
    if (val == null || isNaN(val)) return '—';
    const abs = Math.abs(val);
    const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${val < 0 ? '-' : '+'}₹${formatted} Cr`;
  };

  const fiiCard = useMemo(() => {
    if (!fiiDiiData) return { value: '—', latestNet: null, latestDate: '', mtdNet: null, bars: [], series: [] };
    const daily = Array.isArray(fiiDiiData.daily) ? fiiDiiData.daily.slice(0, MIN_FII_DII_DAYS) : [];
    const latest = daily[0];
    const mtdNet = Number(fiiDiiData.mtd?.fii?.net ?? 0) || 0;
    let series = [...daily].reverse().map((d) => ({
      date: d?.date ?? '',
      net: Number(d?.fii?.net ?? 0) || 0,
    }));
    let bars = series.map((d) => d.net);
    // Backend may return empty daily[] but still send MTD — show one bar so the chart isn't blank.
    if (bars.length < 1 && Number.isFinite(mtdNet)) {
      series = [{ date: 'MTD', net: mtdNet }];
      bars = [mtdNet];
    }
    const latestNet = latest != null ? (Number(latest?.fii?.net ?? 0) || 0) : null;
    return {
      value: latest != null ? fmtCr(latestNet) : mtdNet !== 0 ? fmtCr(mtdNet) : '—',
      latestNet: latestNet ?? mtdNet,
      latestDate: latest?.date ?? '',
      mtdNet,
      bars,
      series,
    };
  }, [fiiDiiData]);

  const diiCard = useMemo(() => {
    if (!fiiDiiData) return { value: '—', latestNet: null, latestDate: '', mtdNet: null, bars: [], series: [] };
    const daily = Array.isArray(fiiDiiData.daily) ? fiiDiiData.daily.slice(0, MIN_FII_DII_DAYS) : [];
    const latest = daily[0];
    const mtdNet = Number(fiiDiiData.mtd?.dii?.net ?? 0) || 0;
    let series = [...daily].reverse().map((d) => ({
      date: d?.date ?? '',
      net: Number(d?.dii?.net ?? 0) || 0,
    }));
    let bars = series.map((d) => d.net);
    if (bars.length < 1 && Number.isFinite(mtdNet)) {
      series = [{ date: 'MTD', net: mtdNet }];
      bars = [mtdNet];
    }
    const latestNet = latest != null ? (Number(latest?.dii?.net ?? 0) || 0) : null;
    return {
      value: latest != null ? fmtCr(latestNet) : mtdNet !== 0 ? fmtCr(mtdNet) : '—',
      latestNet: latestNet ?? mtdNet,
      latestDate: latest?.date ?? '',
      mtdNet,
      bars,
      series,
    };
  }, [fiiDiiData]);

  const fiiShownPoint = useMemo(() => {
    if (!fiiCard.series?.length) return { net: fiiCard.latestNet, date: fiiCard.latestDate };
    if (fiiHoverIdx != null && fiiCard.series[fiiHoverIdx]) {
      return fiiCard.series[fiiHoverIdx];
    }
    return fiiCard.series[fiiCard.series.length - 1];
  }, [fiiCard, fiiHoverIdx]);

  const diiShownPoint = useMemo(() => {
    if (!diiCard.series?.length) return { net: diiCard.latestNet, date: diiCard.latestDate };
    if (diiHoverIdx != null && diiCard.series[diiHoverIdx]) {
      return diiCard.series[diiHoverIdx];
    }
    return diiCard.series[diiCard.series.length - 1];
  }, [diiCard, diiHoverIdx]);

  const buildBarChart = (values, activeIndex = null, height = 68) => {
    if (!values || values.length < 1) return null;
    const safeVals = values.map((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    });
    const width = Math.max(160, safeVals.length * 12);
    const maxAbs = Math.max(...safeVals.map(Math.abs), 1);
    const gap = 2;
    const barW = Math.max(4, (width - gap * (values.length - 1)) / values.length);
    const midY = height / 2;
    const maxH = midY - 2;

    const rects = safeVals.map((val, i) => {
      const x = i * (barW + gap);
      const h = (Math.abs(val) / maxAbs) * maxH;
      const y = val >= 0 ? midY - h : midY;
      const fill = val >= 0 ? '#28a745' : '#dc3545';
      const isActive = activeIndex === i;
      return { x, y, w: barW, h, fill, isActive, i };
    });

    return { rects, midY, width, height };
  };

  const getTrendClass = (trend) => {
    if (/bullish|up|↗/i.test(trend)) return 'up';
    if (/bearish|down|↘/i.test(trend)) return 'down';
    return 'sideways';
  };

  const extractSignedNumber = (value) => {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = String(value).trim();
    if (!text) return null;
    const match = text.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const getDailySignClass = (value) => {
    const n = extractSignedNumber(value);
    if (n == null || n === 0) return '';
    return n > 0 ? 'up' : 'down';
  };

  // Sort arrow helper similar to SectorOutlookPage.js
  const getSortArrow = (columnKey) => {
    if (sortConfig.key !== columnKey) return ' ⬍';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <>
      {timedOut && !apiReady && (
        <div style={{ marginBottom: '12px', color: '#b45309', fontWeight: 600, fontSize: 14 }}>
          Could not reach the API within 60s — check that the backend is running on port 8000, then refresh.
        </div>
      )}
      {apiReady && !bootstrapComplete && (
        <div style={{ marginBottom: '12px', color: '#0369a1', fontWeight: 600, fontSize: 13 }}>
          Background data sync is still running — table shows current DB data and refreshes every 30s.
        </div>
      )}
      {loadError && (
        <div style={{ marginBottom: '12px', color: '#dc3545', fontWeight: 600 }}>
          {loadError}
        </div>
      )}
      {isLoading && !loadError && (
        <div style={{ marginBottom: '12px', color: '#666', fontWeight: 600 }}>
          Loading market indices...
        </div>
      )}
      {lastRefreshedAt && (
        <div style={{ marginBottom: '12px', color: '#666', fontSize: 12 }}>
          Live refresh every 30s. Last update: {lastRefreshedAt.toLocaleTimeString()}
        </div>
      )}
      {/* Index Cards Row 1 */}
      <CardContainer>
        {indexCards.map((card, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div>
                <h3>{card.title}</h3>
                <span className={`trend-badge ${getDailySignClass(card.change) || card.trendDirection || getTrendClass(card.trend)}`}>{card.trend}</span>
              </div>
            </CardHeader>
            <CardValue>{card.value}</CardValue>
            <CardChange className={(card.change || '').toString().startsWith('-') ? 'trend-down' : 'trend-up'}>{card.change}</CardChange>
            <CardStats>
              <span>{card.percentile} Percentile</span>
              <span>|</span>
              <span>{card.pe}</span>
            </CardStats>
          </Card>
        ))}
      </CardContainer>

      {/* Cash Cards + Smallcap Cards Row 2 */}
      <CashCardContainer>
        {/* FII Cash - Left Column */}
        {(() => {
          const bars = buildBarChart(fiiCard.bars, fiiHoverIdx);
          return (
            <CashCard>
              <CashTitle>FII Cash</CashTitle>
              <CashSubtitle>Foreign Institutional Investors</CashSubtitle>
              <CashValue style={{ color: (fiiShownPoint.net ?? 0) >= 0 ? '#28a745' : '#dc3545' }}>
                {fmtCr(fiiShownPoint.net)}
              </CashValue>
              {fiiShownPoint.date && (
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{fiiShownPoint.date}</div>
              )}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#555' }}>MTD</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: fiiCard.mtdNet >= 0 ? '#28a745' : '#dc3545' }}>
                  {fmtCr(fiiCard.mtdNet)}
                </span>
              </div>
              <BarChart>
                {bars ? (
                  <svg
                    viewBox={`0 0 ${bars.width} ${bars.height}`}
                    preserveAspectRatio="xMidYMid meet"
                    width={bars.width}
                    onMouseLeave={() => setFiiHoverIdx(null)}
                  >
                    <line x1="0" y1={bars.midY} x2={bars.width} y2={bars.midY} stroke="#ccc" strokeWidth="0.5" />
                    {bars.rects.map((r, i) => (
                      <rect
                        key={i}
                        x={r.x}
                        y={r.y}
                        width={r.w}
                        height={Math.max(r.h, 0.5)}
                        fill={r.fill}
                        rx="1"
                        opacity={r.isActive ? 1 : 0.9}
                        stroke={r.isActive ? '#1a3c5e' : 'none'}
                        strokeWidth={r.isActive ? 0.8 : 0}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setFiiHoverIdx(r.i)}
                      />
                    ))}
                  </svg>
                ) : (
                  <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
                    <line x1="0" y1="30" x2="100" y2="30" stroke="#ccc" strokeWidth="1" strokeDasharray="4" />
                    <text x="50" y="20" textAnchor="middle" fontSize="8" fill="#bbb">
                      {fiiDiiLoadState === 'loading' ? 'Loading…' : 'No chart data'}
                    </text>
                  </svg>
                )}
              </BarChart>
            </CashCard>
          );
        })()}

        {/* DII Cash - Right Column */}
        {(() => {
          const bars = buildBarChart(diiCard.bars, diiHoverIdx);
          return (
            <CashCard>
              <CashTitle>DII Cash</CashTitle>
              <CashSubtitle>Domestic Institutional Investors</CashSubtitle>
              <CashValue style={{ color: (diiShownPoint.net ?? 0) >= 0 ? '#28a745' : '#dc3545' }}>
                {fmtCr(diiShownPoint.net)}
              </CashValue>
              {diiShownPoint.date && (
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{diiShownPoint.date}</div>
              )}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#555' }}>MTD</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: diiCard.mtdNet >= 0 ? '#28a745' : '#dc3545' }}>
                  {fmtCr(diiCard.mtdNet)}
                </span>
              </div>
              <BarChart>
                {bars ? (
                  <svg
                    viewBox={`0 0 ${bars.width} ${bars.height}`}
                    preserveAspectRatio="xMidYMid meet"
                    width={bars.width}
                    onMouseLeave={() => setDiiHoverIdx(null)}
                  >
                    <line x1="0" y1={bars.midY} x2={bars.width} y2={bars.midY} stroke="#ccc" strokeWidth="0.5" />
                    {bars.rects.map((r, i) => (
                      <rect
                        key={i}
                        x={r.x}
                        y={r.y}
                        width={r.w}
                        height={Math.max(r.h, 0.5)}
                        fill={r.fill}
                        rx="1"
                        opacity={r.isActive ? 1 : 0.9}
                        stroke={r.isActive ? '#1a3c5e' : 'none'}
                        strokeWidth={r.isActive ? 0.8 : 0}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setDiiHoverIdx(r.i)}
                      />
                    ))}
                  </svg>
                ) : (
                  <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
                    <line x1="0" y1="30" x2="100" y2="30" stroke="#ccc" strokeWidth="1" strokeDasharray="4" />
                    <text x="50" y="20" textAnchor="middle" fontSize="8" fill="#bbb">
                      {fiiDiiLoadState === 'loading' ? 'Loading…' : 'No chart data'}
                    </text>
                  </svg>
                )}
              </BarChart>
            </CashCard>
          );
        })()}

        {/* Smallcap column (right): top = full smallcap; bottom row = microcap + India VIX */}
        <SmallCardContainer>
          <SmallFull>
            <CardHeader>
              <div>
                <h3>{smallcapCards[0].title}</h3>
                    <span className={`trend-badge ${getDailySignClass(smallcapCards[0].change) || smallcapCards[0].trendDirection || getTrendClass(smallcapCards[0].trend)}`}>{smallcapCards[0].trend}</span>
              </div>
            </CardHeader>
            <CardValue>{smallcapCards[0].value}</CardValue>
            <CardChange className={(smallcapCards[0].change || '').toString().startsWith('-') ? 'trend-down' : 'trend-up'}>{smallcapCards[0].change}</CardChange>
            <CardStats>
              <span>{smallcapCards[0].percentile} Percentile</span>
              <span>|</span>
              <span>{smallcapCards[0].pe}</span>
            </CardStats>
          </SmallFull>

          {[1, 2].map((i) => {
            const sc = smallcapCards[i];
            return (
              <SmallHalf key={i}>
                <CardHeader>
                  <div>
                    <h3>{sc.title}</h3>
                    <span className={`trend-badge ${getDailySignClass(sc.change) || sc.trendDirection || getTrendClass(sc.trend)}`}>{sc.trend}</span>
                  </div>
                </CardHeader>
                <CardValue>{sc.value}</CardValue>
                <CardChange className={(sc.change || '').toString().startsWith('-') ? 'trend-down' : 'trend-up'}>{sc.change}</CardChange>
                <CardStats>
                  <span>{sc.percentile} Percentile</span>
                  <span>|</span>
                  <span>{sc.pe}</span>
                </CardStats>
              </SmallHalf>
            );
          })}
        </SmallCardContainer>
      </CashCardContainer>

      {/* Table Section */}
      <TableSection>
        <TableTitle>Market Indices</TableTitle>
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                {columnConfig.map((col) => (
                  <th key={col.key} onClick={() => requestSort(col.key)} style={{cursor:'pointer'}}>
                    {col.label}{getSortArrow(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedTableRows.map((row) => (
                <tr key={row.id} className={getDailySignClass(row.day1d) === 'up' ? 'row-up' : getDailySignClass(row.day1d) === 'down' ? 'row-down' : ''}>
                  <td className="index">{row.id}</td>
                  <td>{row.name}</td>
                  <td className={getDailySignClass(row.day1d) === 'up' ? 'trend-up' : getDailySignClass(row.day1d) === 'down' ? 'trend-down' : ''}>{row.trend}</td>
                  <td>{row.value}</td>
                  <td><span className="percentage">{row.percentile}</span></td>
                  <td className={(row.day1d || '').toString().includes('-') ? 'trend-down' : 'trend-up'}>{row.day1d}</td>
                  <td className={(row.week1w || '').toString().includes('-') ? 'trend-down' : 'trend-up'}>{row.week1w}</td>
                  <td className={(row.month1m || '').toString().includes('-') ? 'trend-down' : 'trend-up'}>{row.month1m}</td>
                  <td className={(row.month3m || '').toString().includes('-') ? 'trend-down' : 'trend-up'}>{row.month3m}</td>
                  <td className={(row.month6m || '').toString().includes('-') ? 'trend-down' : 'trend-up'}>{row.month6m}</td>
                  <td className={(row.year1y || '').toString().includes('-') ? 'trend-down' : 'trend-up'}>{row.year1y}</td>
                  <td className={(row.year3y || '').toString().includes('-') ? 'trend-down' : 'trend-up'}>{row.year3y}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <TablePagination
            component="div"
            count={sortedTableData.length}
            page={tablePage}
            onPageChange={(_e, p) => setTablePage(p)}
            rowsPerPage={tableRowsPerPage}
            onRowsPerPageChange={(e) => {
              setTableRowsPerPage(parseInt(e.target.value, 10));
              setTablePage(0);
            }}
            rowsPerPageOptions={INDICES_TABLE_ROWS_PER_PAGE_OPTIONS}
            labelRowsPerPage="Rows per page"
          />
        </TableWrapper>
      </TableSection>
    </>
  );
}

function MarketOutlookPage() {
  const { showData, apiReady, timedOut, bootstrapComplete } = useBootstrapReadyState();

  if (!showData) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
        <div style={{ marginBottom: 16, color: '#333', fontWeight: 600, fontSize: 18 }}>
          Connecting to API…
        </div>
        <div style={{ color: '#666', fontSize: 14, lineHeight: 1.5 }}>
          Waiting for <code style={{ fontSize: 13 }}>GET /api/system/status</code> (backend on port 8000).
        </div>
      </div>
    );
  }

  return (
    <MarketOutlookContent
      apiReady={apiReady}
      timedOut={timedOut}
      bootstrapComplete={bootstrapComplete}
    />
  );
}

export default MarketOutlookPage;