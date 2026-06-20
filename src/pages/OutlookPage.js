import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useScrollActiveTabIntoView } from '../hooks/useScrollActiveTabIntoView';
import MarketOutlookPage from './MarketOutlookPage';
import { PageContainer, PageTitle, Tab, TabContainer, TabContent } from './OutlookPage.style';
import SectorOutlookPage from './SectorOutlookPage';
import SubSectorOutlookPage from './SubSectorOutlookPage';
import { resolveSectorSubsectorMapping } from '../utils/sectorSubsectorMap';
import { buildOutlookSearchParams, resolveOutlookTab } from '../utils/outlookTabUtils';

function OutlookPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => resolveOutlookTab(searchParams.get('outlookTab')));
  const [selectedSector, setSelectedSector] = useState(() => searchParams.get('sector') || null);
  const [mappedGroups, setMappedGroups] = useState(null);
  const setTabRef = useScrollActiveTabIntoView(activeTab);

  useEffect(() => {
    setActiveTab(resolveOutlookTab(searchParams.get('outlookTab')));
    const sectorFromUrl = searchParams.get('sector');
    if (sectorFromUrl) {
      setSelectedSector(sectorFromUrl);
      const m = resolveSectorSubsectorMapping(sectorFromUrl);
      setMappedGroups(Array.isArray(m) && m.length ? m : null);
    } else {
      setSelectedSector(null);
      setMappedGroups(null);
    }
  }, [searchParams]);

  const updateTab = useCallback((tab, { sector = null, clearSector = false } = {}) => {
    setActiveTab(tab);
    if (clearSector) {
      setSelectedSector(null);
      setMappedGroups(null);
    } else if (sector) {
      setSelectedSector(sector);
      const m = resolveSectorSubsectorMapping(sector);
      setMappedGroups(Array.isArray(m) && m.length ? m : null);
    }
    setSearchParams(
      buildOutlookSearchParams(searchParams, { tab, sector: clearSector ? null : sector, clearSector }),
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const handleSectorClick = (sectorName) => {
    updateTab('subsector', { sector: sectorName });
  };

  const handleClearSector = () => {
    updateTab('subsector', { clearSector: true });
  };

  return (
    <PageContainer>
      <PageTitle>Overview</PageTitle>
      <TabContainer data-page-tabs>
        <Tab ref={setTabRef('market')} active={activeTab === 'market'} onClick={() => updateTab('market', { clearSector: true })}>
          Market Insights
        </Tab>
        <Tab ref={setTabRef('sector')} active={activeTab === 'sector'} onClick={() => updateTab('sector', { clearSector: true })}>
          Sector Insights
        </Tab>
        <Tab
          ref={setTabRef('subsector')}
          active={activeTab === 'subsector'}
          onClick={() => updateTab('subsector', { clearSector: true })}
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
          onClearSector={handleClearSector}
        />
      </TabContent>
    </PageContainer>
  );
}

export default OutlookPage;
