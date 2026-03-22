import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button, Pagination, TablePagination } from '@mui/material';
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
  TableScroll,
} from './SubSectorOutlook.styles';
import { fetchSubsectorOutlook, fetchStocksForSubsector } from '../api/subsectorOutlook'; 
import { fetchStocksBySubsector } from '../api/stocks'; 
const SUBSECTOR_REFRESH_MS = 30000;
const SUBSECTOR_MAIN_ROWS_OPTIONS = [15, 25, 50, 100];

function getHighlight(val) {
  if (typeof val !== 'number') return null;
  if (val >= -2 && val <= 2) return 'hsl(48, 100%, 50%)';

  const absVal = Math.abs(val);
  const hue = val > 0 ? 138 : 5;
  const lightness = val > 0 ? 50 : 47.6;

  let alpha;
  if (absVal >= 15) {
    alpha = Math.min(0.95 + (absVal - 15) / 35 * 0.05, 1.0);
  } else if (absVal >= 10) {
    alpha = 0.86 + (absVal - 10) / 5 * 0.08;
  } else if (absVal >= 5) {
    alpha = 0.75 + (absVal - 5) / 5 * 0.10;
  } else {
    alpha = 0.55 + (absVal - 2) / 3 * 0.19;
  }

  return `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
} 

function matchesChip(chip, sub, weekLabels) {
  if (chip === 'All') return true;
  const latestLabel = weekLabels && weekLabels.length ? weekLabels[0] : null;
  const val = latestLabel ? sub[latestLabel] : null;
  if (typeof val !== 'number') return true;

  if (chip === 'Weak') return val < -2;
  if (chip === 'Moderate') return val >= -2 && val <= 2;
  if (chip === 'Strong') return val > 2;
  return true;
}


function SubSectorOutlookPage({ selectedSector, mappedGroups, onClearSector }) {
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
  const [modalPage, setModalPage] = useState(1);
  const [modalTotal, setModalTotal] = useState(0);
  const modalPageSize = 25;
  const [sortConfig, setSortConfig] = useState({ key: 'symbol', direction: 'asc' });
  const [tableSort, setTableSort] = useState({ key: null, direction: 'asc' });
  const [mainListPage, setMainListPage] = useState(0);
  const [mainListRowsPerPage, setMainListRowsPerPage] = useState(25);

  const loadSubsectorData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }
    setLoadError(null);
    let cacheSet = false;
    const cached = sessionStorage.getItem('subsectorOutlookData');
    if (!silent && cached) {
      const parsed = JSON.parse(cached);
      setSectorData(parsed?.data ? parsed : { weekLabels: [], data: [] });
      setIsLoading(false);
      cacheSet = true;
    }
    try {
      const fresh = await fetchSubsectorOutlook();
      sessionStorage.setItem('subsectorOutlookData', JSON.stringify(fresh));
      setSectorData(fresh?.data ? fresh : { weekLabels: [], data: [] });
      if (!silent) {
        setIsLoading(false);
      }
    } catch (err) {
      if (!silent && !cacheSet) {
        setLoadError(err?.message || 'Failed to load subsector outlook.');
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadSubsectorData({ silent: false });
    const timer = setInterval(() => {
      if (isMounted) {
        loadSubsectorData({ silent: true });
      }
    }, SUBSECTOR_REFRESH_MS);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [loadSubsectorData]);

  useEffect(() => {
    setMainListPage(0);
  }, [search, chip, selectedSector]);

  const loadModalStocks = useCallback(async (subsectorName, page = 1) => {
    setModalLoading(true);
    try {
      const paged = await fetchStocksForSubsector(subsectorName, page, modalPageSize);
      let stocks = paged.data;
      let total = paged.total;

      // Backward-compatible fallback for older API responses.
      if (!Array.isArray(stocks) || stocks.length === 0) {
        const fallback = await fetchStocksBySubsector(subsectorName, 500);
        stocks = Array.isArray(fallback) ? fallback : [];
        total = stocks.length;
      }

      // Remove duplicates
      const seen = new Set();
      const deduplicated = stocks.filter(stock => {
        if (seen.has(stock.symbol)) return false;
        seen.add(stock.symbol);
        return true;
      });

      setModalStocks(deduplicated);
      setModalTotal(Number(total || deduplicated.length));
      setModalPage(page);
      setSortConfig({ key: 'symbol', direction: 'asc' });
    } catch (err) {
      setModalStocks([]);
      setModalTotal(0);
    }
    setModalLoading(false);
  }, []);

  const handleSubsectorClick = async (subsectorName, sectorName) => {
    setSelectedSubsector({ name: subsectorName, sector: sectorName });
    setModalOpen(true);
    setModalPage(1);
    await loadModalStocks(subsectorName, 1);
  };

  const handleModalPageChange = async (_event, value) => {
    if (!selectedSubsector?.name || value === modalPage) return;
    await loadModalStocks(selectedSubsector.name, value);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedSubsector(null);
    setModalStocks([]);
    setModalTotal(0);
    setModalPage(1);
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

    const toNum = (val) => {
      if (val == null) return 0;
      if (typeof val === 'number') return val;
      return parseFloat(String(val).replace(/[₹,%+\s]/g, '')) || 0;
    };

    sorted.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (['cmp', 'ema21', 'mc', 'chg'].includes(sortConfig.key)) {
        aVal = toNum(aVal);
        bVal = toNum(bVal);
      } else {
        aVal = aVal ?? '';
        bVal = bVal ?? '';
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [modalStocks, sortConfig]);

  const weekLabels = sectorData.weekLabels || [];
  const dataList = sectorData.data || [];
  const handleTableSort = (key) => {
    setTableSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getTableSortArrow = (key) => {
    if (tableSort.key !== key) return ' ⬍';
    return tableSort.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const sortSubsectors = (subsectors) => {
    if (!tableSort.key) return subsectors;
    const sorted = [...subsectors];
    sorted.sort((a, b) => {
      let aVal, bVal;
      if (tableSort.key === 'name') {
        aVal = (a.name || '').toLowerCase();
        bVal = (b.name || '').toLowerCase();
      } else if (tableSort.key === 'all' || tableSort.key === 'trend') {
        aVal = typeof a[tableSort.key] === 'number' ? a[tableSort.key] : parseFloat(a[tableSort.key]) || 0;
        bVal = typeof b[tableSort.key] === 'number' ? b[tableSort.key] : parseFloat(b[tableSort.key]) || 0;
      } else {
        aVal = typeof a[tableSort.key] === 'number' ? a[tableSort.key] : parseFloat(a[tableSort.key]) || 0;
        bVal = typeof b[tableSort.key] === 'number' ? b[tableSort.key] : parseFloat(b[tableSort.key]) || 0;
      }
      if (aVal < bVal) return tableSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return tableSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  };

  const normLabel = (s) =>
    (s || '')
      .normalize('NFKC')
      .replace(/\u00A0/g, ' ')
      .replace(/\u2013/g, '-')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  const mappedSet = mappedGroups && mappedGroups.length
    ? new Set(mappedGroups.map((n) => normLabel(n)))
    : null;

  const filtered = dataList.map(sector => ({
    ...sector,
    subsectors: sortSubsectors(sector.subsectors.filter(sub =>{
      if (mappedSet && !mappedSet.has(normLabel(sub.name))) return false;

      const matchesSearch = sub.name
      .toLowerCase()
      .includes(search.toLowerCase());

      const matchesBand = matchesChip(chip, sub, weekLabels);

    return matchesSearch && matchesBand;
  })),
  })).filter(sector => sector.subsectors.length);

  /** Flat list for pagination (full filtered dataset from DB-backed API). */
  const flatSubsectorRows = useMemo(
    () =>
      filtered.flatMap((sector) =>
        sector.subsectors.map((sub) => ({
          sector: sector.sector,
          sub,
        }))
      ),
    [filtered]
  );

  const pagedFlatRows = useMemo(() => {
    const start = mainListPage * mainListRowsPerPage;
    return flatSubsectorRows.slice(start, start + mainListRowsPerPage);
  }, [flatSubsectorRows, mainListPage, mainListRowsPerPage]);

  // Top / under performers from current filtered set (same scope as the table)
  const allSubsectors = flatSubsectorRows.map(({ sector, sub }) => ({
    name: sub.name,
    sector,
    value: typeof sub.all === 'number' ? sub.all : 0,
    weekValues: weekLabels.map((lbl) => sub[lbl]).filter((v) => typeof v === 'number'),
  }));

  // Sort by 'all' value (or average of recent weeks if 'all' is not available)
  const sortedSubsectors = [...allSubsectors].sort((a, b) => {
    const aVal = a.value || (a.weekValues.length ? a.weekValues.reduce((sum, v) => sum + v, 0) / a.weekValues.length : 0);
    const bVal = b.value || (b.weekValues.length ? b.weekValues.reduce((sum, v) => sum + v, 0) / b.weekValues.length : 0);
    return bVal - aVal;
  });

  const topPerformers = sortedSubsectors.slice(0, 5);
  const underPerformers = sortedSubsectors.slice(-5).reverse();

  return (
    <Container>
      <LeftContent>
        {loadError && (
          <div style={{ marginBottom: '12px', color: '#dc3545', fontWeight: 600, textAlign: 'left' }}>{loadError}</div>
        )}
        {isLoading && !loadError && (
          <div style={{ marginBottom: '12px', color: '#666', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
            <CircularProgress />
          </div>
        )}
        {selectedSector && mappedGroups && (
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: '#555' }}>
              Subsectors for <strong style={{ color: '#0b3d91' }}>{selectedSector}</strong>
              <span style={{ marginLeft: 6, fontSize: 12, color: '#888' }}>
                ({mappedGroups.length} mapped)
              </span>
            </span>
            <button
              onClick={onClearSector}
              style={{
                background: '#f0f0f0', border: '1px solid #ccc', borderRadius: 14,
                padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#555',
              }}
            >
              Show All Sectors
            </button>
          </div>
        )}
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
    <LegendLabelCol flex={3}>Weak(&lt; -2%)</LegendLabelCol>
<LegendLabelCol flex={3}>Moderate(-2% to +2%)</LegendLabelCol>
<LegendLabelCol flex={3}>Strong(&gt; +2%)</LegendLabelCol>
    </LegendLabelGroup>
   
    {/* <UpdatedOn>
      Updated On:&nbsp;
      <UpdatedOnDate>2025-11-06</UpdatedOnDate>
    </UpdatedOn> */}
  </LegendRow>
</LegendWrapper>

        </HeaderBar>

        <TableScroll>
          <Table>
            <thead>
              <HeaderRow>
                <HeaderCell style={{ cursor: 'pointer' }} onClick={() => handleTableSort('name')}>
                  Sub Sector{getTableSortArrow('name')}
                </HeaderCell>
                <HeaderCell style={{ cursor: 'pointer' }} onClick={() => handleTableSort('all')}>
                  ALL{getTableSortArrow('all')}
                </HeaderCell>
                <HeaderCell style={{ cursor: 'pointer' }} onClick={() => handleTableSort('trend')}>
                  Trend{getTableSortArrow('trend')}
                </HeaderCell>
                {(weekLabels.length ? weekLabels : [1,2,3,4]).map((lbl, idx) => (
                  <HeaderCell
                    key={lbl || idx}
                    style={{ cursor: 'pointer' }}
                    onClick={() => typeof lbl === 'string' && handleTableSort(lbl)}
                  >
                    {typeof lbl === 'string' ? lbl : 'W—'}{typeof lbl === 'string' ? getTableSortArrow(lbl) : ''}
                  </HeaderCell>
                ))}
              </HeaderRow>
            </thead>
            <tbody>
              {flatSubsectorRows.length === 0 && !isLoading && !loadError && (
                <TableRow>
                  <TableCell colSpan={3 + Math.max(weekLabels.length, 4)} style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                    No subsector data available.
                  </TableCell>
                </TableRow>
              )}
              {(() => {
                let prevSector = null;
                return pagedFlatRows.map(({ sector, sub }) => {
                  const showHeader = sector !== prevSector;
                  prevSector = sector;
                  const countVal =
                    sub.stock_count != null && sub.stock_count !== ''
                      ? sub.stock_count
                      : null;
                  return (
                    <React.Fragment key={`${sector}::${sub.name}`}>
                      {showHeader && (
                        <SectorHeader>
                          <TableCell colSpan={3 + Math.max(weekLabels.length, 4)}>{sector}</TableCell>
                        </SectorHeader>
                      )}
                      <TableRow>
                        <TableCell
                          style={{ cursor: 'pointer', color: '#007bff', textDecoration: 'underline' }}
                          onClick={() => handleSubsectorClick(sub.name, sector)}
                        >
                          {sub.name}
                          {countVal != null && Number(countVal) > 0 && (
                            <span style={{ fontSize: '12px', color: '#666', marginLeft: '4px' }}>({countVal})</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {sub.all == null || sub.all === ''
                            ? '—'
                            : typeof sub.all === 'string' && String(sub.all).includes('%')
                              ? sub.all
                              : `${sub.all}%`}
                        </TableCell>
                        <TableCell>{sub.trend ?? '—'}</TableCell>
                        {(weekLabels.length ? weekLabels : [1, 2, 3, 4]).map((lbl, idx) => {
                          const val = weekLabels.length ? sub[lbl] : null;
                          const display = val != null ? `${val}%` : '—';
                          return (
                            <TableCell key={lbl || idx} highlight={getHighlight(val)}>
                              {display}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </React.Fragment>
                  );
                });
              })()}
            </tbody>
          </Table>
          <TablePagination
            component="div"
            count={flatSubsectorRows.length}
            page={mainListPage}
            onPageChange={(_e, p) => setMainListPage(p)}
            rowsPerPage={mainListRowsPerPage}
            onRowsPerPageChange={(e) => {
              setMainListRowsPerPage(parseInt(e.target.value, 10));
              setMainListPage(0);
            }}
            rowsPerPageOptions={SUBSECTOR_MAIN_ROWS_OPTIONS}
            labelRowsPerPage="Subsectors per page"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`}
          />
        </TableScroll>
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
                    <TableRow key={stock.symbol} className={stock.chg && stock.chg.startsWith('-') ? 'row-down' : 'row-up'}>
                      <TableCell>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {(modalPage - 1) * modalPageSize + idx + 1}
                          <a
                            href={`https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(stock.symbol)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`View ${stock.symbol} on TradingView`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: '#131722',
                              textDecoration: 'none',
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 36 28" fill="none">
                              <path d="M14 22H7V11h7v11zm11 0h-7V6h7v16zm11 0h-7V0h7v22z" fill="#2962FF"/>
                              <rect y="25" width="36" height="3" rx="1.5" fill="#2962FF"/>
                            </svg>
                          </a>
                        </span>
                      </TableCell>
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
          {!modalLoading && modalTotal > modalPageSize && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <Pagination
                page={modalPage}
                count={Math.max(1, Math.ceil(modalTotal / modalPageSize))}
                onChange={handleModalPageChange}
                color="primary"
                shape="rounded"
                size="small"
              />
            </div>
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