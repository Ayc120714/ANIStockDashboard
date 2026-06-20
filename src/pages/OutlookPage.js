import React, { useState } from 'react';
import { useScrollActiveTabIntoView } from '../hooks/useScrollActiveTabIntoView';
import MarketOutlookPage from './MarketOutlookPage';
import { PageContainer, PageTitle, Tab, TabContainer, TabContent } from './OutlookPage.style';
import SectorOutlookPage from './SectorOutlookPage';
import SubSectorOutlookPage from './SubSectorOutlookPage';
import { resolveSectorSubsectorMapping } from '../utils/sectorSubsectorMap';

function OutlookPage() {
  const [activeTab, setActiveTab] = useState('market');
  const [selectedSector, setSelectedSector] = useState(null);
  const [mappedGroups, setMappedGroups] = useState(null);
  const setTabRef = useScrollActiveTabIntoView(activeTab);

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
        <Tab ref={setTabRef('market')} active={activeTab === 'market'} onClick={() => setActiveTab('market')}>
          Market Insights
        </Tab>
        <Tab ref={setTabRef('sector')} active={activeTab === 'sector'} onClick={() => setActiveTab('sector')}>
          Sector Insights
        </Tab>
        <Tab
          ref={setTabRef('subsector')}
          active={activeTab === 'subsector'}
          onClick={() => { setSelectedSector(null); setMappedGroups(null); setActiveTab('subsector'); }}
          last
        >
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
