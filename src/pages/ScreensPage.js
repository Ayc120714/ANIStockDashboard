import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useScrollActiveTabIntoView } from '../hooks/useScrollActiveTabIntoView';
import AiPicksPage from './AiPicksPage';
import IPOsPage from './IPOsPage';
import PriceShockersPage from './PriceShockersPage';
import RelativePerformancePage from './RelativePerformancePage';
import { PageContainer, PageTitle, Tab, TabContainer, TabContent } from './ScreensPage.style';
import TrendingPage from './TrendingPage';
import VolumeShockersPage from './VolumeShockersPage';
import { resolveScreenTab, SCREEN_TABS, screenTabToParam } from '../utils/screenTabUtils';

function ScreensPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => resolveScreenTab(searchParams.get('screenTab')));
  const setTabRef = useScrollActiveTabIntoView(activeTab);

  useEffect(() => {
    setActiveTab(resolveScreenTab(searchParams.get('screenTab')));
  }, [searchParams]);

  const updateTab = useCallback((label) => {
    setActiveTab(label);
    const next = new URLSearchParams(searchParams);
    next.set('screenTab', screenTabToParam(label));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <PageContainer>
      <PageTitle>Screens</PageTitle>
      <TabContainer data-page-tabs>
        {SCREEN_TABS.map((label, index) => (
          <Tab
            key={label}
            ref={setTabRef(label)}
            active={activeTab === label}
            onClick={() => updateTab(label)}
            last={index === SCREEN_TABS.length - 1}
          >
            {label}
          </Tab>
        ))}
      </TabContainer>

      <TabContent active={activeTab === 'AI Picks'}>
        {activeTab === 'AI Picks' ? <AiPicksPage /> : null}
      </TabContent>

      <TabContent active={activeTab === 'Trending'}>
        {activeTab === 'Trending' ? <TrendingPage /> : null}
      </TabContent>

      <TabContent active={activeTab === 'Top Movers'}>
        {activeTab === 'Top Movers' ? <PriceShockersPage /> : null}
      </TabContent>

      <TabContent active={activeTab === 'Volume Movers'}>
        {activeTab === 'Volume Movers' ? <VolumeShockersPage /> : null}
      </TabContent>

      <TabContent active={activeTab === 'Alpha Tracker'}>
        {activeTab === 'Alpha Tracker' ? <RelativePerformancePage /> : null}
      </TabContent>

      <TabContent active={activeTab === 'IPOs'}>
        {activeTab === 'IPOs' ? <IPOsPage /> : null}
      </TabContent>
    </PageContainer>
  );
}

export default ScreensPage;
