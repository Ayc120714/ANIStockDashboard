import React, { useEffect, useState } from 'react';
import { fetchMarketIndices, fetchMarketIndicesTable } from '../api/marketIndices';
import {
  CardContainer,
  Card,
  CardHeader,
  CardValue,
  CardChange,
  CardStats,
  CardChart,
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

  const cashCards = [
    { title: 'FII Cash', subtitle: 'Foreign Institutional Investors', value: '₹383.68 Cr', change: '+78.08%', isPositive: true },
    { title: 'DII Cash', subtitle: 'Domestic Institutional Investors', value: '₹3,091.87 Cr', change: '-39.7%', isPositive: false }
  ];

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
    load();
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

  const getTrendClass = (trend) => {
    if (/bullish|up|↗/i.test(trend)) return 'up';
    if (/bearish|down|↘/i.test(trend)) return 'down';
    return 'sideways';
  };

  const buildSparkline = (data, width = 100, height = 40, padding = 4) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = padding + ((max - v) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const linePoints = points.join(' ');
    const fillPoints = `${points.join(' ')} ${width},${height} 0,${height}`;
    const isUp = data[data.length - 1] >= data[0];
    const color = isUp ? '#28a745' : '#dc3545';
    return { linePoints, fillPoints, color };
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
        {indexCards.map((card, idx) => {
          const spark = buildSparkline(card.perfData);
          return (
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
              <CardChart>
                {spark ? (
                  <svg viewBox="0 0 100 40" preserveAspectRatio="xMidYMid meet">
                    <polyline points={spark.linePoints} fill="none" stroke={spark.color} strokeWidth="1.5" />
                    <polygon points={spark.fillPoints} fill={spark.color} fillOpacity="0.1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 100 40" preserveAspectRatio="xMidYMid meet">
                    <line x1="0" y1="20" x2="100" y2="20" stroke="#ccc" strokeWidth="1" strokeDasharray="4" />
                  </svg>
                )}
              </CardChart>
            </Card>
          );
        })}
      </CardContainer>

      {/* Cash Cards + Smallcap Cards Row 2 */}
      <CashCardContainer>
        {/* FII Cash - Left Column */}
        <CashCard>
          <CashTitle>{cashCards[0].title}</CashTitle>
          <CashSubtitle>{cashCards[0].subtitle}</CashSubtitle>
          <CashValue>{cashCards[0].value}</CashValue>
          <div style={{ marginTop: '16px', fontSize: '14px', color: (cashCards[0].change || '').toString().startsWith('-') ? '#dc3545' : '#28a745', fontWeight: '600' }}>
            {cashCards[0].change}
          </div>
          <BarChart>
            <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
              <rect x="5" y="45" width="6" height="12" fill="#4A90E2" />
              <rect x="13" y="40" width="6" height="17" fill="#4A90E2" />
              <rect x="21" y="50" width="6" height="7" fill="#4A90E2" />
              <rect x="29" y="35" width="6" height="22" fill="#4A90E2" />
              <rect x="37" y="42" width="6" height="15" fill="#4A90E2" />
              <rect x="45" y="38" width="6" height="19" fill="#4A90E2" />
              <rect x="53" y="48" width="6" height="9" fill="#4A90E2" />
              <rect x="61" y="43" width="6" height="14" fill="#4A90E2" />
              <rect x="69" y="40" width="6" height="17" fill="#4A90E2" />
              <rect x="77" y="45" width="6" height="12" fill="#4A90E2" />
            </svg>
          </BarChart>
        </CashCard>

        {/* DII Cash - Right Column */}
        <CashCard>
          <CashTitle>{cashCards[1].title}</CashTitle>
          <CashSubtitle>{cashCards[1].subtitle}</CashSubtitle>
          <CashValue>{cashCards[1].value}</CashValue>
          <div style={{ marginTop: '16px', fontSize: '14px', color: (cashCards[1].change || '').toString().startsWith('-') ? '#dc3545' : '#28a745', fontWeight: '600' }}>
            {cashCards[1].change}
          </div>
          <BarChart>
            <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
              <rect x="5" y="20" width="6" height="37" fill="#28a745" />
              <rect x="13" y="25" width="6" height="32" fill="#28a745" />
              <rect x="21" y="15" width="6" height="42" fill="#28a745" />
              <rect x="29" y="30" width="6" height="27" fill="#28a745" />
              <rect x="37" y="20" width="6" height="37" fill="#28a745" />
              <rect x="45" y="25" width="6" height="32" fill="#28a745" />
              <rect x="53" y="18" width="6" height="39" fill="#28a745" />
              <rect x="61" y="22" width="6" height="35" fill="#28a745" />
              <rect x="69" y="28" width="6" height="29" fill="#28a745" />
              <rect x="77" y="20" width="6" height="37" fill="#28a745" />
            </svg>
          </BarChart>
        </CashCard>

        {/* Smallcap column (right): top = full smallcap; bottom row = microcap + India VIX */}
        <SmallCardContainer>
          {(() => {
            const spark0 = buildSparkline(smallcapCards[0].perfData);
            return (
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
                <CardChart>
                  {spark0 ? (
                    <svg viewBox="0 0 100 40" preserveAspectRatio="xMidYMid meet">
                      <polyline points={spark0.linePoints} fill="none" stroke={spark0.color} strokeWidth="1.5" />
                      <polygon points={spark0.fillPoints} fill={spark0.color} fillOpacity="0.1" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 100 40"><line x1="0" y1="20" x2="100" y2="20" stroke="#ccc" strokeWidth="1" strokeDasharray="4" /></svg>
                  )}
                </CardChart>
              </SmallFull>
            );
          })()}

          {[1, 2].map((i) => {
            const sc = smallcapCards[i];
            const sparkSm = buildSparkline(sc.perfData, 100, 30);
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
                <CardChart>
                  {sparkSm ? (
                    <svg viewBox="0 0 100 30" preserveAspectRatio="xMidYMid meet">
                      <polyline points={sparkSm.linePoints} fill="none" stroke={sparkSm.color} strokeWidth="1" />
                      <polygon points={sparkSm.fillPoints} fill={sparkSm.color} fillOpacity="0.1" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 100 30"><line x1="0" y1="15" x2="100" y2="15" stroke="#ccc" strokeWidth="1" strokeDasharray="4" /></svg>
                  )}
                </CardChart>
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