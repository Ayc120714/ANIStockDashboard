import React, { useState } from 'react';
import { PageContainer, PageTitle, Tab, TabContainer, TabContent } from './ScreensPage.style';
import TrendingPage from './TrendingPage';
import PriceShockersPage from './PriceShockersPage';
import VolumeShockersPage from './VolumeShockersPage';
import RelativePerformancePage from './RelativePerformancePage';
import IPOsPage from './IPOsPage';

function ScreensPage() {
  const [activeTab, setActiveTab] = useState('Trending');

  return (
    <PageContainer>
      <PageTitle>Screens</PageTitle>
      <TabContainer>
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

      <TabContent active={activeTab === 'Trending'}>
          <TrendingPage />
      </TabContent>

      <TabContent active={activeTab === 'Price Shockers'}>
        <PriceShockersPage />
      </TabContent>

      <TabContent active={activeTab === 'Volume Shockers'}>
        <VolumeShockersPage />
      </TabContent>

      <TabContent active={activeTab === 'Relative Performance'}>
        <RelativePerformancePage />
      </TabContent>

      <TabContent active={activeTab === 'IPOs'}>
        <IPOsPage />
      </TabContent>
    </PageContainer>
  );
}

export default ScreensPage;