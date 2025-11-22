import React, { useState } from 'react';
import { PageContainer, PageTitle, Tab, TabContainer, TabContent } from './OutlookPage.style';
import MarketOutlookPage from './MarketOutlookPage';

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
        <h2>Sector Outlook</h2>
        <p>Sector outlook content goes here...</p>
      </TabContent>

      <TabContent active={activeTab === 'subsector'}>
        <h2>Sub Sector Outlook</h2>
        <p>Sub sector outlook content goes here...</p>
      </TabContent>
    </PageContainer>
  );
}

export default OutlookPage;
