import React, { useEffect, useState, useMemo } from 'react';
import { fetchMarketIndices, fetchMarketIndicesTable } from '../api/marketIndices';
import { fetchFiiDiiActivity } from '../api/fiiDii';
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

function MarketOutlookPage() {
  const defaultIndexCards = [
    { title: 'Nifty 50', trend: 'UP TREND', value: '25,879', change: '+0.01%', percentile: '96%', pe: '23 PE' },
    { title: 'Next 50', trend: 'UP TREND', value: '69,852', change: '+0.00%', percentile: '79%', pe: '20 PE' },
    { title: 'Midcap 100', trend: 'UP TREND', value: '60,692', change: '-0.35%', percentile: '98%', pe: '34 PE' }
  ];

  const [fiiDiiData, setFiiDiiData] = useState(null);

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

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
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
      } catch (error) {
        if (isMounted) setLoadError(error?.message || 'Failed to load market data.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const loadFiiDii = async () => {
      try {
        const data = await fetchFiiDiiActivity();
        if (isMounted && data) setFiiDiiData(data);
      } catch (err) {
        console.warn('FII/DII fetch failed:', err?.message || err);
      }
    };

    load();
    loadFiiDii();
    return () => {
      isMounted = false;
    };
  }, []);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

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

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
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
    if (!fiiDiiData) return { value: '—', latestNet: 0, latestDate: '', mtdNet: 0, bars: [] };
    const latest = fiiDiiData.daily[0];
    const mtdNet = fiiDiiData.mtd?.fii?.net ?? 0;
    const bars = [...fiiDiiData.daily].reverse().map(d => d.fii.net);
    return {
      value: latest ? fmtCr(latest.fii.net) : '—',
      latestNet: latest?.fii.net ?? 0,
      latestDate: latest?.date ?? '',
      mtdNet,
      bars,
    };
  }, [fiiDiiData]);

  const diiCard = useMemo(() => {
    if (!fiiDiiData) return { value: '—', latestNet: 0, latestDate: '', mtdNet: 0, bars: [] };
    const latest = fiiDiiData.daily[0];
    const mtdNet = fiiDiiData.mtd?.dii?.net ?? 0;
    const bars = [...fiiDiiData.daily].reverse().map(d => d.dii.net);
    return {
      value: latest ? fmtCr(latest.dii.net) : '—',
      latestNet: latest?.dii.net ?? 0,
      latestDate: latest?.date ?? '',
      mtdNet,
      bars,
    };
  }, [fiiDiiData]);

  const buildBarChart = (values, width = 100, height = 60) => {
    if (!values || values.length < 2) return null;
    const maxAbs = Math.max(...values.map(Math.abs), 1);
    const gap = 1;
    const barW = Math.max(2, (width - gap * (values.length - 1)) / values.length);
    const midY = height / 2;
    const maxH = midY - 2;

    const rects = values.map((val, i) => {
      const x = i * (barW + gap);
      const h = (Math.abs(val) / maxAbs) * maxH;
      const y = val >= 0 ? midY - h : midY;
      const fill = val >= 0 ? '#28a745' : '#dc3545';
      return { x, y, w: barW, h, fill };
    });

    return { rects, midY, width, height };
  };

  const getTrendClass = (trend) => {
    if (/bullish|up|↗/i.test(trend)) return 'up';
    if (/bearish|down|↘/i.test(trend)) return 'down';
    return 'sideways';
  };

  // Sort arrow helper similar to SectorOutlookPage.js
  const getSortArrow = (columnKey) => {
    if (sortConfig.key !== columnKey) return ' ⬍';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <>
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
      {/* Index Cards Row 1 */}
      <CardContainer>
        {indexCards.map((card, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div>
                <h3>{card.title}</h3>
                <span className={`trend-badge ${card.trendDirection || getTrendClass(card.trend)}`}>{card.trend}</span>
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
          const bars = buildBarChart(fiiCard.bars);
          return (
            <CashCard>
              <CashTitle>FII Cash</CashTitle>
              <CashSubtitle>Foreign Institutional Investors</CashSubtitle>
              <CashValue style={{ color: fiiCard.latestNet >= 0 ? '#28a745' : '#dc3545' }}>
                {fiiCard.value}
              </CashValue>
              {fiiCard.latestDate && (
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{fiiCard.latestDate}</div>
              )}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#555' }}>MTD</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: fiiCard.mtdNet >= 0 ? '#28a745' : '#dc3545' }}>
                  {fmtCr(fiiCard.mtdNet)}
                </span>
              </div>
              <BarChart>
                {bars ? (
                  <svg viewBox={`0 0 ${bars.width} ${bars.height}`} preserveAspectRatio="xMidYMid meet">
                    <line x1="0" y1={bars.midY} x2={bars.width} y2={bars.midY} stroke="#ccc" strokeWidth="0.5" />
                    {bars.rects.map((r, i) => (
                      <rect key={i} x={r.x} y={r.y} width={r.w} height={Math.max(r.h, 0.5)} fill={r.fill} rx="1" />
                    ))}
                  </svg>
                ) : (
                  <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
                    <line x1="0" y1="30" x2="100" y2="30" stroke="#ccc" strokeWidth="1" strokeDasharray="4" />
                    <text x="50" y="20" textAnchor="middle" fontSize="8" fill="#bbb">Loading...</text>
                  </svg>
                )}
              </BarChart>
            </CashCard>
          );
        })()}

        {/* DII Cash - Right Column */}
        {(() => {
          const bars = buildBarChart(diiCard.bars);
          return (
            <CashCard>
              <CashTitle>DII Cash</CashTitle>
              <CashSubtitle>Domestic Institutional Investors</CashSubtitle>
              <CashValue style={{ color: diiCard.latestNet >= 0 ? '#28a745' : '#dc3545' }}>
                {diiCard.value}
              </CashValue>
              {diiCard.latestDate && (
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{diiCard.latestDate}</div>
              )}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#555' }}>MTD</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: diiCard.mtdNet >= 0 ? '#28a745' : '#dc3545' }}>
                  {fmtCr(diiCard.mtdNet)}
                </span>
              </div>
              <BarChart>
                {bars ? (
                  <svg viewBox={`0 0 ${bars.width} ${bars.height}`} preserveAspectRatio="xMidYMid meet">
                    <line x1="0" y1={bars.midY} x2={bars.width} y2={bars.midY} stroke="#ccc" strokeWidth="0.5" />
                    {bars.rects.map((r, i) => (
                      <rect key={i} x={r.x} y={r.y} width={r.w} height={Math.max(r.h, 0.5)} fill={r.fill} rx="1" />
                    ))}
                  </svg>
                ) : (
                  <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
                    <line x1="0" y1="30" x2="100" y2="30" stroke="#ccc" strokeWidth="1" strokeDasharray="4" />
                    <text x="50" y="20" textAnchor="middle" fontSize="8" fill="#bbb">Loading...</text>
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
                <span className={`trend-badge ${smallcapCards[0].trendDirection || getTrendClass(smallcapCards[0].trend)}`}>{smallcapCards[0].trend}</span>
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
                    <span className={`trend-badge ${sc.trendDirection || getTrendClass(sc.trend)}`}>{sc.trend}</span>
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
              {sortedTableData.map((row) => (
                <tr key={row.id}>
                  <td className="index">{row.id}</td>
                  <td>{row.name}</td>
                  <td className={row.trendDirection === 'up' ? 'trend-up' : row.trendDirection === 'down' ? 'trend-down' : ''}>{row.trend}</td>
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
        </TableWrapper>
      </TableSection>
    </>
  );
}

export default MarketOutlookPage;