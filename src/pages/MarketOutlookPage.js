import React, { useEffect, useState } from 'react';
import { fetchMarketIndices } from '../api/marketIndices';
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
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadMarketIndices = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const normalized = await fetchMarketIndices();
        if (!isMounted) return;
        if (normalized.indexCards.length) {
          setIndexCards(normalized.indexCards);
        }
        if (normalized.smallcapCards.length) {
          setSmallcapCards(normalized.smallcapCards);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error?.message || 'Failed to load market indices.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadMarketIndices();
    return () => {
      isMounted = false;
    };
  }, []);

  // 4. Table Data (for market indices table)
  const tableData = React.useMemo(() => [
    { id: '01', name: 'MICROCAP250', trend: '↘', value: '₹23,455.35', percentile: '58%', day1d: '↘ -1.69%', week1w: '↘ -1.73%', month1m: '↗ 0.05%', month3m: '↘ -0.97%', month6m: '↗ 11.99%', year1y: '↘ -3.61%', year3y: '↗ 29.07%' },
    { id: '02', name: 'SMALLCAP100', trend: '↘', value: '₹18,105.00', percentile: '69%', day1d: '↘ -1.39%', week1w: '↘ -1.97%', month1m: '↗ 0.99%', month3m: '↗ 1.18%', month6m: '↗ 10.28%', year1y: '↘ -1.55%', year3y: '↗ 23.31%' },
    { id: '03', name: 'NEXT50', trend: '↗', value: '₹69,299.55', percentile: '75%', day1d: '↘ -1.24%', week1w: '↘ -1.12%', month1m: '↗ 1.03%', month3m: '↗ 3.56%', month6m: '↗ 8.05%', year1y: '↘ -1.38%', year3y: '↗ 18.23%' },
    { id: '04', name: 'MIDCAP100', trend: '↗', value: '₹59,468.60', percentile: '93%', day1d: '↘ -0.95%', week1w: '↘ -1.04%', month1m: '↗ 2.51%', month3m: '↗ 3.55%', month6m: '↗ 9.54%', year1y: '↗ 5.55%', year3y: '↗ 24.27%' }
  ], []);

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
                <span className="trend-badge">{card.trend}</span>
              </div>
            </CardHeader>
            <CardValue>{card.value}</CardValue>
            <CardChange>{card.change}</CardChange>
            <CardStats>
              <span>{card.percentile} Percentile</span>
              <span>|</span>
              <span>{card.pe}</span>
            </CardStats>
            <CardChart>
              <svg viewBox="0 0 100 40" preserveAspectRatio="xMidYMid meet">
                <polyline points="0,30 10,25 20,20 30,18 40,22 50,15 60,18 70,20 80,25 90,22 100,20" fill="none" stroke="#4CAF50" strokeWidth="1.5" />
                <polygon points="0,30 10,25 20,20 30,18 40,22 50,15 60,18 70,20 80,25 90,22 100,20 100,40 0,40" fill="rgba(76, 175, 80, 0.1)" />
              </svg>
            </CardChart>
          </Card>
        ))}
      </CardContainer>

      {/* Cash Cards + Smallcap Cards Row 2 */}
      <CashCardContainer>
        {/* FII Cash - Left Column */}
        <CashCard>
          <CashTitle>{cashCards[0].title}</CashTitle>
          <CashSubtitle>{cashCards[0].subtitle}</CashSubtitle>
          <CashValue>{cashCards[0].value}</CashValue>
          <div style={{ marginTop: '16px', fontSize: '14px', color: '#28a745', fontWeight: '600' }}>
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
          <div style={{ marginTop: '16px', fontSize: '14px', color: '#dc3545', fontWeight: '600' }}>
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
          <SmallFull>
            <CardHeader>
              <div>
                <h3>{smallcapCards[0].title}</h3>
                <span className="trend-badge">{smallcapCards[0].trend}</span>
              </div>
            </CardHeader>
            <CardValue>{smallcapCards[0].value}</CardValue>
            <CardChange>{smallcapCards[0].change}</CardChange>
            <CardStats>
              <span>{smallcapCards[0].percentile} Percentile</span>
              <span>|</span>
              <span>{smallcapCards[0].pe}</span>
            </CardStats>
            <CardChart>
              <svg viewBox="0 0 100 40" preserveAspectRatio="xMidYMid meet">
                <polyline points="0,25 10,22 20,20 30,24 40,18 50,22 60,20 70,23 80,21 90,24 100,22" fill="none" stroke="#4CAF50" strokeWidth="1.5" />
                <polygon points="0,25 10,22 20,20 30,24 40,18 50,22 60,20 70,23 80,21 90,24 100,22 100,40 0,40" fill="rgba(76, 175, 80, 0.1)" />
              </svg>
            </CardChart>
          </SmallFull>

          <SmallHalf>
            <CardHeader>
              <div>
                <h3>{smallcapCards[1].title}</h3>
                <span className="trend-badge">{smallcapCards[1].trend}</span>
              </div>
            </CardHeader>
            <CardValue>{smallcapCards[1].value}</CardValue>
            <CardChange>{smallcapCards[1].change}</CardChange>
            <CardStats>
              <span>{smallcapCards[1].percentile} Percentile</span>
              <span>|</span>
              <span>{smallcapCards[1].pe}</span>
            </CardStats>
            <CardChart>
              <svg viewBox="0 0 100 30" preserveAspectRatio="xMidYMid meet">
                <polyline points="0,18 10,16 20,15 30,16 40,14 50,15 60,15 70,16 80,15 90,17 100,16" fill="none" stroke="#4CAF50" strokeWidth="1" />
              </svg>
            </CardChart>
          </SmallHalf>

          <SmallHalf>
            <CardHeader>
              <div>
                <h3>{smallcapCards[2].title}</h3>
                <span className="trend-badge">{smallcapCards[2].trend}</span>
              </div>
            </CardHeader>
            <CardValue>{smallcapCards[2].value}</CardValue>
            <CardChange>{smallcapCards[2].change}</CardChange>
            <CardStats>
              <span>{smallcapCards[2].percentile} Percentile</span>
              <span>|</span>
              <span>{smallcapCards[2].pe}</span>
            </CardStats>
            <CardChart>
              <svg viewBox="0 0 100 30" preserveAspectRatio="xMidYMid meet">
                <polyline points="0,18 10,16 20,15 30,16 40,14 50,15 60,15 70,16 80,15 90,17 100,16" fill="none" stroke="#4CAF50" strokeWidth="1" />
              </svg>
            </CardChart>
          </SmallHalf>
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
                  <td className={row.trend === '↗' ? 'trend-up' : 'trend-down'}>{row.trend}</td>
                  <td>{row.value}</td>
                  <td><span className="percentage">{row.percentile}</span></td>
                  <td className="trend-down">{row.day1d}</td>
                  <td className="trend-down">{row.week1w}</td>
                  <td className="trend-up">{row.month1m}</td>
                  <td className="trend-up">{row.month3m}</td>
                  <td className="trend-up">{row.month6m}</td>
                  <td className={row.year1y.includes('↗') ? 'trend-up' : 'trend-down'}>{row.year1y}</td>
                  <td className="trend-up">{row.year3y}</td>
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