import React, { useState } from 'react';
import AiPicksPage from './AiPicksPage';
import IPOsPage from './IPOsPage';
import PriceShockersPage from './PriceShockersPage';
import RelativePerformancePage from './RelativePerformancePage';
import { PageContainer, PageTitle, Tab, TabContainer, TabContent } from './ScreensPage.style';
import TrendingPage from './TrendingPage';
import VolumeShockersPage from './VolumeShockersPage';

function ScreensPage() {
  const [activeTab, setActiveTab] = useState('AI Picks');

  return (
    <PageContainer>
      <PageTitle>Screens</PageTitle>
      <TabContainer>
        <Tab active={activeTab === 'AI Picks'} onClick={() => setActiveTab('AI Picks')}>
          AI Picks
        </Tab>
        <Tab active={activeTab === 'Trending'} onClick={() => setActiveTab('Trending')}>
          Trending
        </Tab>
        <Tab active={activeTab === 'Top Movers'} onClick={() => setActiveTab('Top Movers')}>
          Top Movers
        </Tab>
        <Tab active={activeTab === 'Volume Movers'} onClick={() => setActiveTab('Volume Movers')}>
          Volume Movers
        </Tab>
        <Tab active={activeTab === 'Alpha Tracker'} onClick={() => setActiveTab('Alpha Tracker')}>
          Alpha Tracker
        </Tab>
        <Tab active={activeTab === 'IPOs'} onClick={() => setActiveTab('IPOs')} last>
          IPOs
        </Tab>
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