jest.unmock('@core/api/services/advisorService');

const mockApiGet = jest.fn();

jest.mock('@core/api/apiClient', () => ({
  apiGet: (...args) => mockApiGet(...args),
  apiRequest: jest.fn(),
}));

const {advisorService} = jest.requireActual('@core/api/services/advisorService');
const {buildBrokerConsensusQuery} = require('@core/utils/brokerConsensusUtils');

describe('advisorService broker consensus', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({items: [], total: 0});
  });

  it('serializes list query params from normalized filters', async () => {
    const query = buildBrokerConsensusQuery({
      search: 'reliance',
      label: 'positive',
      origin: 'domestic',
      confidence: 'high',
      sort: 'symbol_asc',
      page: 2,
      page_size: 200,
    });

    await advisorService.fetchBrokerConsensusList(query);

    expect(mockApiGet).toHaveBeenCalledWith(
      '/advisor/broker-consensus?search=reliance&label=positive&origin=domestic&confidence=high&sort=symbol_asc&page=2&page_size=200',
      expect.objectContaining({timeoutMs: expect.any(Number)}),
    );
  });

  it('encodes symbol in detail path and uppercases it', async () => {
    await advisorService.fetchBrokerConsensusDetail('  reliance ');

    expect(mockApiGet).toHaveBeenCalledWith(
      '/advisor/broker-consensus/RELIANCE',
      expect.objectContaining({timeoutMs: expect.any(Number)}),
    );
  });

  it('percent-encodes special characters in detail symbol', async () => {
    await advisorService.fetchBrokerConsensusDetail('M&M');

    expect(mockApiGet).toHaveBeenCalledWith(
      '/advisor/broker-consensus/M%26M',
      expect.objectContaining({timeoutMs: expect.any(Number)}),
    );
  });
});
