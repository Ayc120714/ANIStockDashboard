import React, { useState } from 'react';
import { PageContainer, PageTitle, Tab, TabContainer, TabContent } from './ScreensPage.style';
import TrendingPage from './TrendingPage';
import PriceShockersPage from './PriceShockersPage';
import VolumeShockersPage from './VolumeShockersPage';
import RelativePerformancePage from './RelativePerformancePage';
import IPOsPage from './IPOsPage';
import AiPicksPage from './AiPicksPage';

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
        <Tab active={activeTab === 'Price Shockers'} onClick={() => setActiveTab('Price Shockers')}>
          Price Shockers
        </Tab>
        <Tab active={activeTab === 'Volume Shockers'} onClick={() => setActiveTab('Volume Shockers')}>
          Volume Shockers
        </Tab>
        <Tab active={activeTab === 'Relative Performance'} onClick={() => setActiveTab('Relative Performance')}>
          Relative Performance
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

      <TabContent active={activeTab === 'Price Shockers'}>
        {activeTab === 'Price Shockers' ? <PriceShockersPage /> : null}
      </TabContent>

      <TabContent active={activeTab === 'Volume Shockers'}>
        {activeTab === 'Volume Shockers' ? <VolumeShockersPage /> : null}
      </TabContent>

      <TabContent active={activeTab === 'Relative Performance'}>
        {activeTab === 'Relative Performance' ? <RelativePerformancePage /> : null}
      </TabContent>

      <TabContent active={activeTab === 'IPOs'}>
        {activeTab === 'IPOs' ? <IPOsPage /> : null}
      </TabContent>
    </PageContainer>
  );
}

export default ScreensPage;