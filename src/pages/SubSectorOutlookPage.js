import React, { useState, useEffect, useMemo } from 'react';
import { CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import {
  Container,
  LeftContent,
  HeaderBar,
  SearchBar,
  Chips,
  Chip,
  Spacer,
  LegendWrapper,
  LegendBar,
  LegendBlockWeak,
  LegendBlockModerate,
  LegendBlockStrong,
  Table,
  TableRow,
  TableCell,
  SectorHeader,
  RightSidebar,
  TopPerformerHeader,
  TopPerformerCard,
  TopPerformerValue,
  TopPerformerTabs,
  BestLabelRow,
  BestLabel,
  BestChip,
  LegendLabelCol,
  LegendRow,
  LegendLabelGroup,
  HeaderRow,
  HeaderCell,
} from './SubSectorOutlook.styles';
import { fetchSubsectorOutlook, fetchStocksForSubsector } from '../api/subsectorOutlook'; 
import { fetchTrending, fetchStocksBySubsector } from '../api/stocks'; 

function getHighlight(val) {
  if (typeof val !== 'number') return undefined;
  if (val > 50) return 'green';
  if (val > 20 && val <= 50) return 'yellow';
  if (val <= 20) return 'red';
  return undefined;
} 

function matchesChip(chip, value) {
  if (chip === 'All') return true;
  if (typeof value !== 'number') return false;

  if (chip === 'Weak') return value >= 0 && value <= 20;
  if (chip === 'Moderate') return value > 20 && value <= 50;
  if (chip === 'Strong') return value > 50;
  return true;
}

function getWeekValues(sub, weekLabels) {
  if (weekLabels && weekLabels.length) {
    return weekLabels.map((lbl) => sub[lbl]);
  }
  return Object.entries(sub)
    .filter(([key]) => /^W\d+$/.test(key))
    .map(([, value]) => value);
}


function matchesChipAnyWeek(chip, sub, weekLabels) {
  if (chip === 'All') return true;

  const weeks = getWeekValues(sub, weekLabels);

  return weeks.some((v) => matchesChip(chip, v));
}


function SubSectorOutlookPage() {
  const [chip, setChip] = useState('All');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('top');
  const [sectorData, setSectorData] = useState({ weekLabels: [], data: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedSubsector, setSelectedSubsector] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStocks, setModalStocks] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'symbol', direction: 'asc' });
  const [allStocks, setAllStocks] = useState([]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);
    let cacheSet = false;
    const cached = sessionStorage.getItem('subsectorOutlookData');
    if (cached) {
      const parsed = JSON.parse(cached);
      setSectorData(parsed?.data ? parsed : { weekLabels: [], data: [] });
      setIsLoading(false);
      cacheSet = true;
    }
    fetchSubsectorOutlook().then((fresh) => {
      sessionStorage.setItem('subsectorOutlookData', JSON.stringify(fresh));
      if (isMounted) {
        setSectorData(fresh?.data ? fresh : { weekLabels: [], data: [] });
        setIsLoading(false);
      }
    }).catch((err) => {
      if (isMounted && !cacheSet) {
        setLoadError(err?.message || 'Failed to load subsector outlook.');
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, []);

  // Preload all stocks for faster modal opening and stock counting
  useEffect(() => {
    let isMounted = true;
    fetchTrending(500).then(stocks => {
      if (isMounted) {
        console.log('Preloaded stocks count:', stocks.length);
        if (stocks.length > 0) {
          console.log('First stock data:', stocks[0]);
          console.log('All unique subsectors:', [...new Set(stocks.map(s => s.subSector).filter(Boolean))]);
        }
        setAllStocks(stocks);
      }
    }).catch(err => {
      console.error('Failed to preload stocks:', err);
    });
    return () => { isMounted = false; };
  }, []);

  const handleSubsectorClick = async (subsectorName, sectorName) => {
    setSelectedSubsector({ name: subsectorName, sector: sectorName });
    setModalOpen(true);
    setModalLoading(true);
    try {
      console.log('=== Fetching stocks ===');
      console.log('Subsector:', subsectorName);
      console.log('Sector:', sectorName);
      
      let stocks = [];
      
      // Try the dedicated subsector stocks endpoint first
      console.log('Trying /subsector-stocks endpoint...');
      stocks = await fetchStocksForSubsector(subsectorName);
      
      if (stocks.length === 0) {
        console.log('Subsector endpoint returned 0, trying /stocks/by-subsector...');
        stocks = await fetchStocksBySubsector(subsectorName, 500);
      }
      
      if (stocks.length === 0) {
        console.log('Still 0, trying cache filter...');
        if (allStocks && allStocks.length > 0) {
          const normalizedSearchName = subsectorName.trim().toLowerCase();
          const uniqueSubsectors = [...new Set(
            allStocks
              .map(s => s.subSector)
              .filter(s => s && s !== '—')
          )];
          console.log('Available subsectors:', uniqueSubsectors);
          console.log('Looking for (normalized):', normalizedSearchName);
          
          stocks = allStocks.filter(stock => {
            if (!stock.subSector || stock.subSector === '—') return false;
            const normalized = stock.subSector.trim().toLowerCase();
            const match = normalized === normalizedSearchName;
            if (match && stocks.length < 3) {
              console.log('Match found:', stock.symbol, stock.subSector);
            }
            return match;
          });
        }
      }
      
      console.log('Total stocks found:', stocks.length);
      if (stocks.length > 0) {
        console.log('First stock:', stocks[0]);
      }
      
      // Remove duplicates
      const seen = new Set();
      const deduplicated = stocks.filter(stock => {
        if (seen.has(stock.symbol)) return false;
        seen.add(stock.symbol);
        return true;
      });
      
      console.log('Final deduped count:', deduplicated.length);
      
      setModalStocks(deduplicated);
      setSortConfig({ key: 'symbol', direction: 'asc' });
    } catch (err) {
      console.error('Error fetching stocks:', err);
      setModalStocks([]);
    }
    setModalLoading(false);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedSubsector(null);
    setModalStocks([]);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedModalStocks = useMemo(() => {
    const sorted = [...modalStocks];
    if (!sortConfig.key) return sorted;

    sorted.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'cmp' || sortConfig.key === 'ema21' || sortConfig.key === 'mc') {
        aVal = parseFloat(aVal?.replace(/[₹,]/g, '') || 0);
        bVal = parseFloat(bVal?.replace(/[₹,]/g, '') || 0);
      } else if (sortConfig.key === 'chg') {
        aVal = parseFloat(aVal?.replace(/[%+]/g, '') || 0);
        bVal = parseFloat(bVal?.replace(/[%+]/g, '') || 0);
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [modalStocks, sortConfig]);

  const weekLabels = sectorData.weekLabels || [];
  const dataList = sectorData.data || [];
  const filtered = dataList.map(sector => ({
    ...sector,
    subsectors: sector.subsectors.filter(sub =>{
      const matchesSearch = sub.name
      .toLowerCase()
      .includes(search.toLowerCase());

      const matchesBand = matchesChipAnyWeek(chip, sub, weekLabels);

    return matchesSearch && matchesBand;
  }),
  })).filter(sector => sector.subsectors.length);

  // Calculate top and under performers from all subsectors
  const allSubsectors = dataList.flatMap(sector => 
    sector.subsectors.map(sub => ({
      name: sub.name,
      sector: sector.sector,
      value: typeof sub.all === 'number' ? sub.all : 0,
      weekValues: weekLabels.map(lbl => sub[lbl]).filter(v => typeof v === 'number')
    }))
  );

  // Sort by 'all' value (or average of recent weeks if 'all' is not available)
  const sortedSubsectors = [...allSubsectors].sort((a, b) => {
    const aVal = a.value || (a.weekValues.length ? a.weekValues.reduce((sum, v) => sum + v, 0) / a.weekValues.length : 0);
    const bVal = b.value || (b.weekValues.length ? b.weekValues.reduce((sum, v) => sum + v, 0) / b.weekValues.length : 0);
    return bVal - aVal;
  });

  const topPerformers = sortedSubsectors.slice(0, 5);
  const underPerformers = sortedSubsectors.slice(-5).reverse();

  // Calculate stock count per subsector
  const subsectorStockCount = useMemo(() => {
    const countMap = {};
    if (allStocks && allStocks.length > 0) {
      // Count unique symbols per subsector (avoid duplicates)
      const subsectorSymbols = {};
      allStocks.forEach(stock => {
        if (stock.symbol && stock.subSector && stock.subSector !== '—') {
          const normalized = stock.subSector.trim().toLowerCase();
          if (!subsectorSymbols[normalized]) {
            subsectorSymbols[normalized] = new Set();
          }
          subsectorSymbols[normalized].add(stock.symbol);
        }
      });
      
      // Convert to counts
      Object.keys(subsectorSymbols).forEach(key => {
        countMap[key] = subsectorSymbols[key].size;
      });
      
      console.log('Stock count map:', countMap);
    }
    return countMap;
  }, [allStocks]); 

  return (
    <Container>
      {loadError && (
        <div style={{ marginBottom: '12px', color: '#dc3545', fontWeight: 600 }}>{loadError}</div>
      )}
      {isLoading && !loadError && (
        <div style={{ marginBottom: '12px', color: '#666', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
          <CircularProgress />
        </div>
      )}
      <LeftContent>
        <HeaderBar>
          <SearchBar
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Chips>
            {['All', 'Strong', 'Moderate', 'Weak'].map(label => (
              <Chip
                key={label}
                active={chip === label}
                onClick={() => setChip(label)}
              >
                {label}
              </Chip>
            ))}
          </Chips>

          <Spacer />

          <LegendWrapper>
  <LegendRow>
    <LegendBar>
      <LegendBlockWeak />
      <LegendBlockModerate />
      <LegendBlockStrong />
    </LegendBar>
  </LegendRow>

  <LegendRow>
    <LegendLabelGroup>
    <LegendLabelCol flex={3}>Weak(0-20)</LegendLabelCol>
<LegendLabelCol flex={3}>Moderate(21-50)</LegendLabelCol>
<LegendLabelCol flex={3}>Strong(51-100)</LegendLabelCol>
    </LegendLabelGroup>
   
    {/* <UpdatedOn>
      Updated On:&nbsp;
      <UpdatedOnDate>2025-11-06</UpdatedOnDate>
    </UpdatedOn> */}
  </LegendRow>
</LegendWrapper>

        </HeaderBar>

        <Table>
          <thead>
          <HeaderRow>
              <HeaderCell>Sub Sector</HeaderCell>
              <HeaderCell>ALL</HeaderCell>
              <HeaderCell>Trend</HeaderCell>
              {weekLabels.map((lbl) => (
                <HeaderCell key={lbl}>{lbl}</HeaderCell>
              ))}
              {weekLabels.length === 0 && (
                <>
                  <HeaderCell>W—</HeaderCell>
                  <HeaderCell>W—</HeaderCell>
                  <HeaderCell>W—</HeaderCell>
                  <HeaderCell>W—</HeaderCell>
                </>
              )}
            </HeaderRow>
          </thead>
          <tbody>
            {filtered.map(sector => (
              <React.Fragment key={sector.sector}>
                <SectorHeader>
                  <TableCell colSpan={3 + Math.max(weekLabels.length, 4)}>{sector.sector}</TableCell>
                </SectorHeader>
                {sector.subsectors.map(sub => (
                  <TableRow key={sub.name}>
                    <TableCell 
                      style={{ cursor: 'pointer', color: '#007bff', textDecoration: 'underline' }}
                      onClick={() => handleSubsectorClick(sub.name, sector.sector)}
                    >
                      {sub.name} 
                      {subsectorStockCount[sub.name.trim().toLowerCase()] > 0 && (
                        <span style={{ fontSize: '12px', color: '#666', marginLeft: '4px' }}>
                          ({subsectorStockCount[sub.name.trim().toLowerCase()]})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{sub.all}</TableCell>
                    <TableCell>{sub.trend}</TableCell>
                    {weekLabels.length ? weekLabels.map((lbl) => {
                      const val = sub[lbl];
                      const display = val != null ? `${val}%` : '—';
                      return (
                        <TableCell key={lbl} highlight={getHighlight(val)}>{display}</TableCell>
                      );
                    }) : (
                      <>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </Table>
      </LeftContent>

      <RightSidebar>
  <TopPerformerTabs>
    <TopPerformerHeader
      active={activeTab === 'top'}
      onClick={() => setActiveTab('top')}
    >
      Top Performers
    </TopPerformerHeader>

    <TopPerformerHeader
      active={activeTab === 'under'}
      onClick={() => setActiveTab('under')}
    >
      Under Performers
    </TopPerformerHeader>
  </TopPerformerTabs>

  {activeTab === 'top' && (
    <div>
      <BestLabelRow>
        <BestLabel>Best Performing SubSectors</BestLabel>
        <BestChip> Leaders</BestChip>
      </BestLabelRow>

      {topPerformers.length > 0 ? (
        topPerformers.map((performer, idx) => (
          <TopPerformerCard key={idx}>
            <span>{performer.name}</span>
            <TopPerformerValue>{performer.value}%</TopPerformerValue>
          </TopPerformerCard>
        ))
      ) : (
        <TopPerformerCard>
          <span>No data available</span>
          <TopPerformerValue>—</TopPerformerValue>
        </TopPerformerCard>
      )}
    </div>
  )}

  {activeTab === 'under' && (
    <div>
      <BestLabelRow>
        <BestLabel under>Under Performing SubSectors</BestLabel>
        <BestChip under> Laggards</BestChip>
      </BestLabelRow>

      {underPerformers.length > 0 ? (
        underPerformers.map((performer, idx) => (
          <TopPerformerCard key={idx}>
            <span>{performer.name}</span>
            <TopPerformerValue>{performer.value}%</TopPerformerValue>
          </TopPerformerCard>
        ))
      ) : (
        <TopPerformerCard>
          <span>No data available</span>
          <TopPerformerValue>—</TopPerformerValue>
        </TopPerformerCard>
      )}
    </div>
  )}
</RightSidebar>

      <Dialog open={modalOpen} onClose={handleModalClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Stocks in {selectedSubsector?.name} ({selectedSubsector?.sector})
        </DialogTitle>
        <DialogContent>
          {modalLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
              <CircularProgress />
            </div>
          ) : (
            <Table style={{ marginTop: '16px' }}>
              <thead>
                <HeaderRow>
                  <HeaderCell style={{ cursor: 'pointer' }}>Sl.No</HeaderCell>
                  <HeaderCell style={{ cursor: 'pointer' }} onClick={() => handleSort('symbol')}>
                    Symbol {sortConfig.key === 'symbol' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </HeaderCell>
                  <HeaderCell style={{ cursor: 'pointer' }} onClick={() => handleSort('mc')}>
                    MC {sortConfig.key === 'mc' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </HeaderCell>
                  <HeaderCell style={{ cursor: 'pointer' }} onClick={() => handleSort('ema21')}>
                    EMA 21 {sortConfig.key === 'ema21' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </HeaderCell>
                  <HeaderCell style={{ cursor: 'pointer' }} onClick={() => handleSort('cmp')}>
                    CMP {sortConfig.key === 'cmp' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </HeaderCell>
                  <HeaderCell style={{ cursor: 'pointer' }} onClick={() => handleSort('chg')}>
                    CHG% {sortConfig.key === 'chg' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </HeaderCell>
                </HeaderRow>
              </thead>
              <tbody>
                {sortedModalStocks.length > 0 ? (
                  sortedModalStocks.map((stock, idx) => (
                    <TableRow key={stock.symbol}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{stock.symbol}</TableCell>
                      <TableCell>{stock.mc}</TableCell>
                      <TableCell>{stock.ema21}</TableCell>
                      <TableCell>{stock.cmp}</TableCell>
                      <TableCell className={stock.chg && stock.chg.startsWith('-') ? 'trend-down' : 'trend-up'}>
                        {stock.chg}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                      No stocks found in this subsector
                    </TableCell>
                  </TableRow>
                )}
              </tbody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleModalClose} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
}

export default SubSectorOutlookPage;
