import { apiGet } from './apiClient';
import { fetchBrokerConsensus, fetchBrokerConsensusDetail } from './advisor';

jest.mock('./apiClient', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiRequest: jest.fn(),
}));

describe('fetchBrokerConsensus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiGet.mockResolvedValue({ items: [], total: 0 });
  });

  test('serializes an already-normalized filter object without rebuilding it', async () => {
    await fetchBrokerConsensus({
      search: 'reliance',
      label: 'positive',
      origin: 'domestic',
      confidence: 'high',
      sort: 'symbol_asc',
      page: 3,
      page_size: 25,
    }, { normalized: true });

    expect(apiGet).toHaveBeenCalledWith(
      '/advisor/broker-consensus?search=reliance&label=positive&origin=domestic&confidence=high&sort=symbol_asc&page=3&page_size=25',
      { cache: 'no-store', skipCache: true },
    );
  });

  test('keeps direct calls safe by normalizing untrusted filter values once', async () => {
    await fetchBrokerConsensus({
      search: '  infy ',
      label: 'POSITIVE',
      origin: 'DOMESTIC',
      confidence: 'HIGH',
      page: 0,
      page_size: 500,
    });

    expect(apiGet).toHaveBeenCalledWith(
      '/advisor/broker-consensus?search=infy&label=positive&origin=domestic&confidence=high&sort=score_desc&page=1&page_size=200',
      { cache: 'no-store', skipCache: true },
    );
  });
});

describe('fetchBrokerConsensusDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiGet.mockResolvedValue({ summary: {}, recommendations: [] });
  });

  test('encodes symbol in the detail path and uppercases it', async () => {
    await fetchBrokerConsensusDetail('  reliance ');
    expect(apiGet).toHaveBeenCalledWith(
      '/advisor/broker-consensus/RELIANCE',
      { cache: 'no-store', skipCache: true },
    );
  });

  test('percent-encodes special characters in symbol', async () => {
    await fetchBrokerConsensusDetail('M&M');
    expect(apiGet).toHaveBeenCalledWith(
      '/advisor/broker-consensus/M%26M',
      { cache: 'no-store', skipCache: true },
    );
  });
});
