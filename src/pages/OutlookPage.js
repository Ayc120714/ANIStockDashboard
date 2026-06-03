import React, { useState } from 'react';
import MarketOutlookPage from './MarketOutlookPage';
import { PageContainer, PageTitle, Tab, TabContainer, TabContent } from './OutlookPage.style';
import SectorOutlookPage from './SectorOutlookPage';
import SubSectorOutlookPage from './SubSectorOutlookPage';
import { resolveSectorSubsectorMapping } from '../utils/sectorSubsectorMap';

function OutlookPage() {
  const [activeTab, setActiveTab] = useState('market');
  const [selectedSector, setSelectedSector] = useState(null);
  const [mappedGroups, setMappedGroups] = useState(null);

  const handleSectorClick = (sectorName) => {
    setSelectedSector(sectorName);
    const m = resolveSectorSubsectorMapping(sectorName);
    // Empty array = broken mapping; treat as "show all" (avoid "0 mapped" + empty filter)
    setMappedGroups(Array.isArray(m) && m.length ? m : null);
    setActiveTab('subsector');
  };

  return (
    <PageContainer>
      <PageTitle>Overview</PageTitle>
      <TabContainer>
        <Tab active={activeTab === 'market'} onClick={() => setActiveTab('market')}>Market Insights</Tab>
        <Tab active={activeTab === 'sector'} onClick={() => setActiveTab('sector')}>
          Sector Insights
        </Tab>
        <Tab active={activeTab === 'subsector'} onClick={() => { setSelectedSector(null); setMappedGroups(null); setActiveTab('subsector'); }} last>
          SubSector Insights
        </Tab>
      </TabContainer>

      <TabContent active={activeTab === 'market'}>
        <MarketOutlookPage />
      </TabContent>

      <TabContent active={activeTab === 'sector'}>
        <SectorOutlookPage onSectorClick={handleSectorClick} />
      </TabContent>

      <TabContent active={activeTab === 'subsector'}>
        <SubSectorOutlookPage
          selectedSector={selectedSector}
          mappedGroups={mappedGroups}
          onClearSector={() => { setSelectedSector(null); setMappedGroups(null); }}
        />
      </TabContent>
    </PageContainer>
  );
}

export default OutlookPage;
