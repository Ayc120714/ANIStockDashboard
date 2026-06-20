import React, { useState } from 'react';
import { useScrollActiveTabIntoView } from '../hooks/useScrollActiveTabIntoView';
import AiPicksPage from './AiPicksPage';
import IPOsPage from './IPOsPage';
import PriceShockersPage from './PriceShockersPage';
import RelativePerformancePage from './RelativePerformancePage';
import { PageContainer, PageTitle, Tab, TabContainer, TabContent } from './ScreensPage.style';
import TrendingPage from './TrendingPage';
import VolumeShockersPage from './VolumeShockersPage';

const SCREEN_TABS = ['AI Picks', 'Trending', 'Top Movers', 'Volume Movers', 'Alpha Tracker', 'IPOs'];

function ScreensPage() {
  const [activeTab, setActiveTab] = useState('AI Picks');
  const setTabRef = useScrollActiveTabIntoView(activeTab);

  return (
    <PageContainer>
      <PageTitle>Screens</PageTitle>
      <TabContainer>
        {SCREEN_TABS.map((label, index) => (
          <Tab
            key={label}
            ref={setTabRef(label)}
            active={activeTab === label}
            onClick={() => setActiveTab(label)}
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
