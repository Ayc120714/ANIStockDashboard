import React, { useState } from 'react';
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
} from './SubSectorOutlook.styles'; 

const SECTOR_DATA = [
  {
    sector: 'AUTO',
    subsectors: [
      { name: 'Auto Components', all: 70, trend: 21, w45: 30, w44: 33, w43: 31, w42: 21 },
      { name: 'Automobiles', all: 25, trend: 10, w45: 40, w44: 40, w43: 32, w42: 44 },
      { name: 'Automotive - OEM', all: 15, trend: 5, w45: 33, w44: 33, w43: 27, w42: 13 },
      { name: 'Tyres', all: 12, trend: 5, w45: 42, w44: 42, w43: 50, w42: 50 },
    ],
  },
  {
    sector: 'CAPITAL MARKETS',
    subsectors: [
      { name: 'Asset Mgmt & Broking', all: 41, trend: 15, w45: 12, w44: 22, w43: 37, w42: 41 },
    ],
  },
]; 

function getHighlight(val) {
  if (typeof val !== 'number') return undefined;
  if (val > 50) return 'green';
  if(val>20 && val<=50) return 'yellow';
  if (val <=20) return 'red';
  return undefined;
} 

function SubSectorOutlookPage() {
  const [chip, setChip] = useState('All');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('top'); // add with other state


  const filtered = SECTOR_DATA.map(sector => ({
    ...sector,
    subsectors: sector.subsectors.filter(sub =>
      sub.name.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(sector => sector.subsectors.length); 

  return (
    <Container>
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
<LegendLabelCol flex={3}>Moderate(21-49)</LegendLabelCol>
<LegendLabelCol flex={3}>Strong(50-100)</LegendLabelCol>
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
            <TableRow>
              <TableCell>Sub Sector</TableCell>
              <TableCell>ALL</TableCell>
              <TableCell>Trend</TableCell>
              <TableCell>W45</TableCell>
              <TableCell>W44</TableCell>
              <TableCell>W43</TableCell>
              <TableCell>W42</TableCell>
            </TableRow>
          </thead>
          <tbody>
            {filtered.map(sector => (
              <React.Fragment key={sector.sector}>
                <SectorHeader>
                  <TableCell colSpan={7}>{sector.sector}</TableCell>
                </SectorHeader>
                {sector.subsectors.map(sub => (
                  <TableRow key={sub.name}>
                    <TableCell>{sub.name}</TableCell>
                    <TableCell>{sub.all}</TableCell>
                    <TableCell>{sub.trend}</TableCell>
                    <TableCell highlight={getHighlight(sub.w45)}>{sub.w45}%</TableCell>
                    <TableCell highlight={getHighlight(sub.w44)}>{sub.w44}%</TableCell>
                    <TableCell highlight={getHighlight(sub.w43)}>{sub.w43}%</TableCell>
                    <TableCell highlight={getHighlight(sub.w42)}>{sub.w42}%</TableCell>
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

      <TopPerformerCard>
        <span>XYZ_UP Sector</span>
        <TopPerformerValue>58%</TopPerformerValue>
      </TopPerformerCard>
    </div>
  )}

  {activeTab === 'under' && (
    <div>
      <BestLabelRow>
        <BestLabel under>Under Performing SubSectors</BestLabel>
        <BestChip under> Laggards</BestChip>
      </BestLabelRow>

      <TopPerformerCard>
        <span> XYZ_DN Sector</span>
        <TopPerformerValue>35%</TopPerformerValue>
      </TopPerformerCard>
    </div>
  )}
</RightSidebar>

    </Container>
  );
}

export default SubSectorOutlookPage;
