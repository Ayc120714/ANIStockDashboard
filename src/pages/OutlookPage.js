import React, { useState } from 'react';
import MarketOutlookPage from './MarketOutlookPage';
import { PageContainer, PageTitle, Tab, TabContainer, TabContent } from './OutlookPage.style';
import SectorOutlookPage from './SectorOutlookPage';
import SubSectorOutlookPage from './SubSectorOutlookPage';

/**
 * Maps Nifty sectoral/thematic indices to exact subsector names from the
 * Sub Sector Outlook API. Each mapping includes every subsector where a
 * constituent stock of that Nifty index could be classified.
 *
 * Source: NSE Nifty Indices constituent lists (niftyindices.com).
 */
const SECTOR_TO_SUBSECTORS = {

  // Maruti, Tata Motors, M&M, Bajaj Auto, TVS, Hero, Eicher (Auto Manufacturers)
  // Motherson, Bosch, Uno Minda, Exide (Auto Parts — includes tyres, EMS, batteries, ancillaries)
  // Bharat Forge (Metal Fabrication), Tube Investments (Specialty Industrial Machinery)
  // Ashok Leyland (Farm & Heavy Construction Machinery — commercial vehicles)
  'NIFTY AUTO': [
    'Auto Manufacturers', 'Auto Parts', 'Auto & Truck Dealerships',
    'Metal Fabrication', 'Specialty Industrial Machinery',
    'Farm & Heavy Construction Machinery',
  ],

  // Autos + FMCG staples + Durables + Retail + Paints + Titan + Airlines + Media
  // Asian Paints, Berger (Specialty Chemicals — paints)
  // Titan (Luxury Goods), Page Industries (Apparel Manufacturing)
  // IndiGo (Airlines), Info Edge (Internet Content), Jubilant (Restaurants)
  'NIFTY CONSUMPTION': [
    'Auto Manufacturers', 'Auto Parts',
    'Packaged Foods', 'Household & Personal Products', 'Tobacco',
    'Beverages - Non-Alcoholic', 'Beverages - Brewers', 'Beverages - Wineries & Distilleries',
    'Confectioners', 'Food Distribution',
    'Furnishings, Fixtures & Appliances', 'Consumer Electronics',
    'Apparel Retail', 'Apparel Manufacturing', 'Footwear & Accessories',
    'Luxury Goods', 'Textile Manufacturing',
    'Discount Stores', 'Specialty Retail', 'Internet Retail', 'Department Stores',
    'Restaurants', 'Lodging', 'Travel Services',
    'Airlines',
    'Specialty Chemicals',
    'Entertainment', 'Broadcasting', 'Internet Content & Information',
    'Medical Care Facilities',
  ],

  // Reliance, ONGC, GAIL (Oil & Gas Integrated)
  // BPCL, IOC, HPCL (Oil & Gas Refining & Marketing)
  // NTPC, Tata Power (Power Producers), Power Grid (Regulated Electric)
  // Coal India (Thermal Coal), Adani Green (Solar, Renewable)
  'NIFTY ENERGY': [
    'Oil & Gas Integrated', 'Oil & Gas Refining & Marketing', 'Oil & Gas Equipment & Services',
    'Thermal Coal',
    'Utilities - Independent Power Producers', 'Utilities - Regulated Electric',
    'Utilities - Regulated Gas', 'Utilities - Renewable',
    'Solar',
  ],

  // HDFC Bank, ICICI, Kotak, Axis, SBI (Banks)
  // Bajaj Finance, Bajaj Finserv (Credit Services, Financial Conglomerates)
  // HDFC Life, SBI Life, ICICI Lombard (Insurance)
  // HDFC AMC, Nippon Life (Asset Management), BSE/CDSL (Exchanges)
  'NIFTY FIN SERVICE': [
    'Banks - Regional', 'Capital Markets',
    'Insurance - Life', 'Insurance - Diversified', 'Insurance - Property & Casualty',
    'Insurance - Reinsurance', 'Insurance Brokers',
    'Asset Management', 'Credit Services', 'Financial Conglomerates',
    'Financial Data & Stock Exchanges', 'Mortgage Finance',
  ],

  // HUL, ITC, Nestlé, Britannia, Dabur, Marico, Godrej Consumer, Colgate
  // United Spirits (Beverages), Tata Consumer (Packaged Foods + Beverages)
  'NIFTY FMCG': [
    'Packaged Foods', 'Household & Personal Products',
    'Beverages - Non-Alcoholic', 'Beverages - Brewers', 'Beverages - Wineries & Distilleries',
    'Tobacco', 'Confectioners', 'Food Distribution',
    'Discount Stores',
  ],

  // L&T (Engineering & Construction + Conglomerates)
  // Adani Ports (Integrated Freight & Logistics), UltraTech (Building Materials)
  // NTPC, Power Grid, Tata Power, Adani Green (Utilities)
  // Bharti Airtel (Telecom), Siemens, ABB (Electrical Equipment)
  // DLF (Real Estate), IRB Infra (Infrastructure Operations)
  'NIFTY INFRA': [
    'Engineering & Construction', 'Building Products & Equipment', 'Building Materials',
    'Infrastructure Operations', 'Conglomerates',
    'Electrical Equipment & Parts', 'Specialty Industrial Machinery',
    'Integrated Freight & Logistics', 'Railroads', 'Marine Shipping',
    'Airports & Air Services',
    'Utilities - Independent Power Producers', 'Utilities - Regulated Electric',
    'Utilities - Renewable', 'Solar',
    'Telecom Services',
    'Real Estate - Development',
  ],

  // TCS, Infosys, Wipro, HCL Tech, Tech Mahindra, LTIMindtree (IT Services)
  // Persistent, Coforge, Mphasis (Software), Oracle FSS (Software)
  'NIFTY IT': [
    'Information Technology Services', 'Software - Application', 'Software - Infrastructure',
    'Computer Hardware', 'Communication Equipment',
    'Electronic Components', 'Electronics & Computer Distribution',
    'Consulting Services',
  ],

  // Zee, Sun TV (Broadcasting), PVR INOX (Entertainment)
  // Nazara Tech (Electronic Gaming), Affle India (Advertising/Internet)
  'NIFTY MEDIA': [
    'Broadcasting', 'Entertainment', 'Electronic Gaming & Multimedia',
    'Advertising Agencies', 'Internet Content & Information',
  ],

  // Tata Steel, JSW Steel, SAIL, Jindal Steel (Steel)
  // Hindalco, NALCO (Aluminum), Vedanta (Diversified metals)
  // NMDC → Other Industrial Metals & Mining (backend override; not Steel)
  // MIDHANI → Aerospace & Defense (backend override)
  // Ratnamani / SARVAMN / BANSALWIRE → see backend symbol_sector_overrides.py
  // Coal India (Thermal Coal), APL Apollo (Steel tubes)
  'NIFTY METAL': [
    'Steel', 'Aluminum', 'Copper',
    'Other Industrial Metals & Mining', 'Other Precious Metals & Mining',
    'Metal Fabrication',
    'Thermal Coal',
    'Aerospace & Defense',
    'Oil & Gas Equipment & Services',
    'Electrical Equipment & Parts',
  ],

  // Sun Pharma, Dr Reddy's, Cipla, Divi's (Drug Manufacturers)
  // Biocon (Biotechnology), Dr Lal PathLabs (Diagnostics)
  // Apollo Hospitals, Max Healthcare (Medical Care Facilities)
  // Gland Pharma, Lupin (Specialty & Generic)
  'NIFTY PHARMA': [
    'Drug Manufacturers - General', 'Drug Manufacturers - Specialty & Generic',
    'Biotechnology', 'Diagnostics & Research',
    'Medical Care Facilities', 'Medical Distribution',
    'Medical Instruments & Supplies', 'Health Information Services',
    'Pharmaceutical Retailers',
  ],

  // SBI, Bank of Baroda, PNB, Canara Bank, Indian Bank, Union Bank
  'NIFTY PSU BANK': [
    'Banks - Regional',
  ],

  // HDFC Bank, ICICI Bank, Kotak, Axis, IndusInd, Federal, Bandhan, IDFC First
  'NIFTY PVT BANK': [
    'Banks - Regional', 'Credit Services',
  ],

  // DLF, Godrej Properties, Oberoi Realty, Prestige, Phoenix Mills, Brigade
  'NIFTY REALTY': [
    'Real Estate - Development', 'Real Estate - Diversified', 'Real Estate Services',
  ],

  // 61% Financial (Banks, Insurance, NBFCs) + 16% IT + 8% Telecom + 5% Power
  // HDFC Bank, ICICI, SBI (Banks), Bajaj Finance (Credit)
  // Infosys, TCS (IT Services), Bharti Airtel (Telecom)
  // NTPC, Power Grid (Utilities)
  'NIFTY SERV SECTOR': [
    'Banks - Regional', 'Capital Markets', 'Credit Services',
    'Insurance - Life', 'Insurance - Diversified', 'Asset Management',
    'Financial Conglomerates', 'Financial Data & Stock Exchanges',
    'Information Technology Services', 'Software - Application', 'Software - Infrastructure',
    'Telecom Services',
    'Utilities - Independent Power Producers', 'Utilities - Regulated Electric',
    'Medical Care Facilities',
  ],
};

function resolveMapping(sectorName) {
  if (!sectorName) return null;
  const key = sectorName.toUpperCase().trim();
  if (SECTOR_TO_SUBSECTORS[key]) return SECTOR_TO_SUBSECTORS[key];
  for (const [k, v] of Object.entries(SECTOR_TO_SUBSECTORS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

function OutlookPage() {
  const [activeTab, setActiveTab] = useState('market');
  const [selectedSector, setSelectedSector] = useState(null);
  const [mappedGroups, setMappedGroups] = useState(null);

  const handleSectorClick = (sectorName) => {
    setSelectedSector(sectorName);
    setMappedGroups(resolveMapping(sectorName));
    setActiveTab('subsector');
  };

  return (
    <PageContainer>
      <PageTitle>Overview</PageTitle>
      <TabContainer>
        <Tab active={activeTab === 'market'} onClick={() => setActiveTab('market')}>Market Insights</Tab>
        <Tab active={activeTab === 'sector'} onClick={() => setActiveTab('sector')}>
          Sector Insights
        </Tab>
        <Tab active={activeTab === 'subsector'} onClick={() => { setSelectedSector(null); setMappedGroups(null); setActiveTab('subsector'); }} last>
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
