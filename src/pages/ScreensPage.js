import React, { useState } from 'react';
import { PageContainer, PageTitle, Tab, TabContainer, TabContent } from './ScreensPage.style';
import TrendingPage from './TrendingPage';
import PriceShockersPage from './PriceShockersPage';
import VolumeShockersPage from './VolumeShockersPage';
import RelativePerformancePage from './RelativePerformancePage';
import IPOsPage from './IPOsPage';
import AiPicksPage from './AiPicksPage';
import LiveScreenerPage from './LiveScreenerPage';

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
        <Tab active={activeTab === 'Volume movers'} onClick={() => setActiveTab('Volume movers')}>
          Volume movers
        </Tab>
        <Tab active={activeTab === 'Alpha Tracker'} onClick={() => setActiveTab('Alpha Tracker')}>
          Alpha Tracker
        </Tab>
        <Tab active={activeTab === 'Live Screener'} onClick={() => setActiveTab('Live Screener')}>
          Live Screener
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

      <TabContent active={activeTab === 'Volume movers'}>
        {activeTab === 'Volume movers' ? <VolumeShockersPage /> : null}
      </TabContent>

      <TabContent active={activeTab === 'Alpha Tracker'}>
        {activeTab === 'Alpha Tracker' ? <RelativePerformancePage /> : null}
      </TabContent>

      <TabContent active={activeTab === 'Live Screener'}>
        {activeTab === 'Live Screener' ? <LiveScreenerPage /> : null}
      </TabContent>

      <TabContent active={activeTab === 'IPOs'}>
        {activeTab === 'IPOs' ? <IPOsPage /> : null}
      </TabContent>
    </PageContainer>
  );
}

export default ScreensPage;