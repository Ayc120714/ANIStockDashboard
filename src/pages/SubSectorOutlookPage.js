import React, { useState, useEffect } from 'react';
import { CircularProgress } from '@mui/material';
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
  UpdatedOn,
  UpdatedOnDate,
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
import { fetchSubsectorOutlook } from '../api/subsectorOutlook'; 

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
                    <TableCell>{sub.name}</TableCell>
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

    </Container>
  );
}

export default SubSectorOutlookPage;
