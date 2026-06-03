/**
 * Maps Nifty sectoral/thematic indices to exact subsector names from the
 * Sub Sector Outlook API. Each mapping includes every subsector where a
 * constituent stock of that Nifty index could be classified.
 *
 * Source: NSE Nifty Indices constituent lists (niftyindices.com).
 */
export const SECTOR_TO_SUBSECTORS = {
  'NIFTY AUTO': [
    'Auto Manufacturers', 'Auto Parts', 'Auto & Truck Dealerships',
    'Metal Fabrication', 'Specialty Industrial Machinery',
    'Farm & Heavy Construction Machinery',
  ],
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
  'NIFTY ENERGY': [
    'Oil & Gas Integrated', 'Oil & Gas Refining & Marketing', 'Oil & Gas Equipment & Services',
    'Thermal Coal',
    'Utilities - Independent Power Producers', 'Utilities - Regulated Electric',
    'Utilities - Regulated Gas', 'Utilities - Renewable',
    'Solar',
  ],
  'NIFTY FIN SERVICE': [
    'Banks - Regional', 'Capital Markets',
    'Insurance - Life', 'Insurance - Diversified', 'Insurance - Property & Casualty',
    'Insurance - Reinsurance', 'Insurance Brokers',
    'Asset Management', 'Credit Services', 'Financial Conglomerates',
    'Financial Data & Stock Exchanges', 'Mortgage Finance',
  ],
  'NIFTY FMCG': [
    'Packaged Foods', 'Household & Personal Products',
    'Beverages - Non-Alcoholic', 'Beverages - Brewers', 'Beverages - Wineries & Distilleries',
    'Tobacco', 'Confectioners', 'Food Distribution',
    'Discount Stores',
  ],
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
  'NIFTY IT': [
    'Information Technology Services', 'Software - Application', 'Software - Infrastructure',
    'Computer Hardware', 'Communication Equipment',
    'Electronic Components', 'Electronics & Computer Distribution',
    'Consulting Services',
  ],
  'NIFTY MEDIA': [
    'Broadcasting', 'Entertainment', 'Electronic Gaming & Multimedia',
    'Advertising Agencies', 'Internet Content & Information',
  ],
  'NIFTY METAL': [
    'Steel', 'Aluminum', 'Copper',
    'Other Industrial Metals & Mining', 'Other Precious Metals & Mining',
    'Metal Fabrication',
    'Thermal Coal',
    'Aerospace & Defense',
    'Oil & Gas Equipment & Services',
    'Electrical Equipment & Parts',
  ],
  'NIFTY PHARMA': [
    'Drug Manufacturers - General', 'Drug Manufacturers - Specialty & Generic',
    'Biotechnology', 'Diagnostics & Research',
    'Medical Care Facilities', 'Medical Distribution',
    'Medical Instruments & Supplies', 'Health Information Services',
    'Pharmaceutical Retailers',
  ],
  'NIFTY PSU BANK': ['Banks - Regional'],
  'NIFTY PVT BANK': ['Banks - Regional', 'Credit Services'],
  'NIFTY BANK': ['Banks - Regional'],
  'NIFTY REALTY': [
    'Real Estate - Development', 'Real Estate - Diversified', 'Real Estate Services',
  ],
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

/** Resolve Sector Insights index label → subsector filter list (or null). */
export function resolveSectorSubsectorMapping(sectorName) {
  if (!sectorName || typeof sectorName !== 'string') return null;
  const normalized = sectorName.normalize('NFKC').replace(/\u00A0/g, ' ').trim();
  const keySpaced = normalized.toUpperCase().replace(/\s+/g, ' ').trim();
  if (SECTOR_TO_SUBSECTORS[keySpaced]) return SECTOR_TO_SUBSECTORS[keySpaced];

  const alnum = keySpaced.replace(/[^A-Z0-9]/g, '');
  const mapKeys = Object.keys(SECTOR_TO_SUBSECTORS).sort((a, b) => b.length - a.length);
  for (const mk of mapKeys) {
    const mkAlnum = mk.replace(/[^A-Z0-9]/g, '');
    if (alnum && mkAlnum && alnum === mkAlnum) {
      return SECTOR_TO_SUBSECTORS[mk];
    }
  }
  for (const [k, v] of Object.entries(SECTOR_TO_SUBSECTORS)) {
    if (keySpaced === k || keySpaced.includes(k)) return v;
    if (k.includes(keySpaced)) {
      const re = new RegExp(`(?:^|\\s)${keySpaced.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`);
      if (re.test(k)) return v;
    }
  }
  return null;
}
