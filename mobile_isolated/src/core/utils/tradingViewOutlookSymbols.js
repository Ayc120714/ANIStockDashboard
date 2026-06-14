/**
 * Map Market / Sector outlook index labels (API + UI) to TradingView `EXCHANGE:SYMBOL`.
 */

function normSpaced(name) {
  return String(name || '')
    .normalize('NFKC')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normAlnum(name) {
  return normSpaced(name).replace(/[^A-Z0-9]/g, '');
}

/** @type {Map<string, string>} */
const TV_BY_SPACED = new Map([
  ['NIFTY 50', 'NSE:NIFTY'],
  ['NIFTY NEXT 50', 'NSE:NIFTYJR'],
  ['NEXT 50', 'NSE:NIFTYJR'],
  ['NIFTY BANK', 'NSE:BANKNIFTY'],
  ['NIFTY 100', 'NSE:CNX100'],
  ['NIFTY 200', 'NSE:CNX200'],
  ['NIFTY 500', 'NSE:CNX500'],
  ['NIFTY MIDCAP 50', 'NSE:NIFTY_MIDCAP_50'],
  ['NIFTY MIDCAP 100', 'NSE:NIFTY_MIDCAP_100'],
  ['NIFTY MIDCAP 150', 'NSE:NIFTY_MIDCAP_150'],
  ['NIFTY SMALLCAP 100', 'NSE:CNXSMALLCAP'],
  ['NIFTY SMLCAP 100', 'NSE:CNXSMALLCAP'],
  ['NIFTY SMALLCAP 50', 'NSE:NIFTY_SMALLCAP_50'],
  ['NIFTY SMALLCAP 250', 'NSE:NIFTY_SMALLCAP_250'],
  ['NIFTY MICROCAP 250', 'NSE:NIFTY_MICROCAP_250'],
  ['INDIA VIX', 'NSE:INDIAVIX'],
  ['SENSEX', 'BSE:SENSEX'],
  ['NIFTY AUTO', 'NSE:CNXAUTO'],
  ['NIFTY IT', 'NSE:CNXIT'],
  ['NIFTY PHARMA', 'NSE:CNXPHARMA'],
  ['NIFTY FMCG', 'NSE:CNXFMCG'],
  ['NIFTY METAL', 'NSE:CNXMETAL'],
  ['NIFTY REALTY', 'NSE:CNXREALTY'],
  ['NIFTY MEDIA', 'NSE:CNXMEDIA'],
  ['NIFTY INFRA', 'NSE:CNXINFRA'],
  ['NIFTY ENERGY', 'NSE:CNXENERGY'],
  ['NIFTY PSU BANK', 'NSE:CNXPSUBANK'],
  ['NIFTY CONSUMPTION', 'NSE:CNXCONSUMPTION'],
  ['NIFTY FIN SERVICE', 'NSE:NIFTY_FINSERVICE'],
  ['NIFTY PVT BANK', 'NSE:NIFTYPVTBANK'],
  ['NIFTY SERV SECTOR', 'NSE:CNXSERVICE'],
  ['NIFTY HEALTHCARE', 'NSE:NIFTY_HEALTHCARE'],
  ['NIFTY IND TOURISM', 'NSE:NIFTY_IND_TOURISM'],
  ['NIFTY EV', 'NSE:NIFTY_EV'],
  ['NIFTY MOBILITY', 'NSE:NIFTY_MOBILITY'],
  ['NIFTY INTERNET', 'NSE:NIFTY_INTERNET'],
  ['NIFTY HOUSING', 'NSE:NIFTY_HOUSING'],
  ['NIFTY OIL AND GAS', 'NSE:NIFTY_OIL_AND_GAS'],
  ['NIFTY IND DEFENCE', 'NSE:NIFTY_IND_DEFENCE'],
  ['NIFTY CAPITAL MKT', 'NSE:NIFTY_CAPITAL_MK'],
  ['NIFTY CHEMICALS', 'NSE:NIFTY_CHEMICALS'],
]);

const TV_BY_ALNUM = new Map([...TV_BY_SPACED.entries()].map(([k, v]) => [normAlnum(k), v]));

export function getTradingViewChartSymbol(indexDisplayName) {
  const spaced = normSpaced(indexDisplayName);
  if (!spaced) return null;
  if (TV_BY_SPACED.has(spaced)) return TV_BY_SPACED.get(spaced);
  const al = normAlnum(spaced);
  if (al && TV_BY_ALNUM.has(al)) return TV_BY_ALNUM.get(al);
  return null;
}
