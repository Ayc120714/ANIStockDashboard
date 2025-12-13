import React, { useState } from 'react';
import { PageContainer, PageTitle, Tab, TabContainer, TabContent } from './OutlookPage.style';
import MarketOutlookPage from './MarketOutlookPage';
import SectorOutlookPage from './SectorOutlookPage';
import SubSectorOutlookPage from './SubSectorOutlookPage';

function OutlookPage() {
   const [activeTab, setActiveTab] = useState('market');
  return (
    <PageContainer>
      <PageTitle>Outlook</PageTitle>
      <TabContainer>
        <Tab active={activeTab === 'market'} onClick={() =>setActiveTab('market')}>Market Outlook</Tab>
        <Tab active={activeTab === 'sector'} onClick={() => setActiveTab('sector')}>
          Sector Outlook
        </Tab>
        <Tab active={activeTab === 'subsector'} onClick={() => setActiveTab('subsector')} last>
          Sub Sector Outlook
        </Tab>
      </TabContainer>

      <TabContent active={activeTab === 'market'}>
        <MarketOutlookPage />
      </TabContent>

      <TabContent active={activeTab === 'sector'}>
        <SectorOutlookPage />
      </TabContent>

      <TabContent active={activeTab === 'subsector'}>
        <SubSectorOutlookPage />
      </TabContent>
    </PageContainer>
  );
}

export default OutlookPage;
