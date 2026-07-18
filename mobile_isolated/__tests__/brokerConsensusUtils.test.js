import {
  BROKER_CONSENSUS_DISCLAIMER,
  buildBrokerConsensusQuery,
  canOpenExternalHttpUrl,
  formatBrokerConsensusConfidence,
  formatBrokerConsensusCounts,
  formatBrokerConsensusDate,
  formatBrokerConsensusLabel,
  formatBrokerConsensusTarget,
  hasMoreBrokerConsensusPages,
  isNoCoverageItem,
  isSingleSourceView,
  mergeBrokerConsensusPages,
  openExternalHttpUrl,
  parseBrokerConsensusDetailResponse,
  parseBrokerConsensusListResponse,
} from '@core/utils/brokerConsensusUtils';

describe('brokerConsensusUtils', () => {
  describe('formatBrokerConsensusLabel', () => {
    it('maps known labels including no coverage', () => {
      expect(formatBrokerConsensusLabel('positive')).toBe('Positive');
      expect(formatBrokerConsensusLabel('neutral')).toBe('Neutral');
      expect(formatBrokerConsensusLabel('negative')).toBe('Negative');
      expect(formatBrokerConsensusLabel('no_coverage')).toBe('No coverage');
    });
  });

  describe('formatBrokerConsensusConfidence', () => {
    it('maps single source and no coverage distinctly', () => {
      expect(formatBrokerConsensusConfidence('single_source')).toBe('Single source');
      expect(formatBrokerConsensusConfidence('no_coverage')).toBe('No coverage');
      expect(formatBrokerConsensusConfidence('high')).toBe('High');
    });
  });

  describe('coverage flags', () => {
    it('detects no coverage from label or confidence', () => {
      expect(isNoCoverageItem({label: 'no_coverage', confidence: 'low'})).toBe(true);
      expect(isNoCoverageItem({label: 'positive', confidence: 'no_coverage'})).toBe(true);
      expect(isNoCoverageItem({label: 'positive', confidence: 'high'})).toBe(false);
    });

    it('detects single-source view', () => {
      expect(isSingleSourceView({confidence: 'single_source'})).toBe(true);
      expect(isSingleSourceView({confidence: 'high'})).toBe(false);
    });
  });

  describe('formatBrokerConsensusCounts', () => {
    it('shows vote mix and total', () => {
      expect(formatBrokerConsensusCounts({positive: 3, neutral: 1, negative: 2, total: 6})).toBe(
        '+3 / ~1 / −2 · 6 total',
      );
    });

    it('handles empty counts without inventing neutral votes', () => {
      expect(formatBrokerConsensusCounts({positive: 0, neutral: 0, negative: 0, total: 0})).toBe(
        'No active calls',
      );
    });
  });

  describe('formatBrokerConsensusTarget', () => {
    it('formats mean target and upside', () => {
      expect(formatBrokerConsensusTarget({mean: 3000, implied_upside_pct: 12.4})).toContain('Target ₹');
      expect(formatBrokerConsensusTarget({mean: 3000, implied_upside_pct: 12.4})).toContain('+12.4% upside');
    });

    it('returns unavailable when target fields are absent', () => {
      expect(formatBrokerConsensusTarget({})).toBe('Target unavailable');
    });
  });

  describe('formatBrokerConsensusDate', () => {
    it('returns em dash for missing dates', () => {
      expect(formatBrokerConsensusDate(null)).toBe('—');
      expect(formatBrokerConsensusDate('2026-07-10T12:00:00')).toBe('2026-07-10');
    });
  });

  describe('buildBrokerConsensusQuery', () => {
    it('omits empty filters and applies defaults', () => {
      expect(buildBrokerConsensusQuery({search: '  ', label: '', page: 2})).toEqual({
        sort: 'score_desc',
        page: 2,
        page_size: 20,
      });
    });

    it('passes active filters through', () => {
      expect(
        buildBrokerConsensusQuery({
          search: 'reli',
          label: 'positive',
          origin: 'domestic',
          confidence: 'single_source',
          sort: 'symbol_asc',
          page: 1,
          page_size: 10,
        }),
      ).toEqual({
        search: 'reli',
        label: 'positive',
        origin: 'domestic',
        confidence: 'single_source',
        sort: 'symbol_asc',
        page: 1,
        page_size: 10,
      });
    });

    it('caps page_size at 200 to match backend and web', () => {
      expect(buildBrokerConsensusQuery({page_size: 500})).toEqual({
        sort: 'score_desc',
        page: 1,
        page_size: 200,
      });
    });
  });

  describe('parseBrokerConsensusListResponse', () => {
    it('normalizes list payload shape', () => {
      const parsed = parseBrokerConsensusListResponse({
        items: [{symbol: 'RELIANCE'}],
        total: 1,
        page: 1,
        page_size: 20,
        as_of: '2026-07-18T10:00:00',
      });
      expect(parsed.items).toHaveLength(1);
      expect(parsed.total).toBe(1);
      expect(parsed.as_of).toBe('2026-07-18T10:00:00');
    });
  });

  describe('parseBrokerConsensusDetailResponse', () => {
    it('normalizes detail payload shape', () => {
      const parsed = parseBrokerConsensusDetailResponse({
        summary: {symbol: 'RELIANCE'},
        recommendations: [{institution_name: 'Motilal Oswal'}],
      });
      expect(parsed.summary.symbol).toBe('RELIANCE');
      expect(parsed.recommendations).toHaveLength(1);
    });
  });

  describe('pagination helpers', () => {
    it('detects remaining pages', () => {
      expect(hasMoreBrokerConsensusPages({page: 1, page_size: 20, total: 45})).toBe(true);
      expect(hasMoreBrokerConsensusPages({page: 3, page_size: 20, total: 45})).toBe(false);
    });

    it('merges pages without duplicate symbols', () => {
      const merged = mergeBrokerConsensusPages(
        [{symbol: 'RELIANCE'}, {symbol: 'INFY'}],
        [{symbol: 'INFY'}, {symbol: 'TCS'}],
      );
      expect(merged.map(row => row.symbol)).toEqual(['RELIANCE', 'INFY', 'TCS']);
    });
  });

  describe('external attribution links', () => {
    it('accepts only http/https URLs', () => {
      expect(canOpenExternalHttpUrl('https://example.com/report.pdf')).toBe(true);
      expect(canOpenExternalHttpUrl('http://example.com/report.pdf')).toBe(true);
      expect(canOpenExternalHttpUrl('javascript:alert(1)')).toBe(false);
      expect(canOpenExternalHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(canOpenExternalHttpUrl('/relative/path')).toBe(false);
      expect(canOpenExternalHttpUrl('')).toBe(false);
    });

    it('opens supported http URLs safely', async () => {
      const linking = {
        canOpenURL: jest.fn().mockResolvedValue(true),
        openURL: jest.fn().mockResolvedValue(undefined),
      };
      await expect(openExternalHttpUrl('https://example.com/a.pdf', linking)).resolves.toBe(true);
      expect(linking.canOpenURL).toHaveBeenCalledWith('https://example.com/a.pdf');
      expect(linking.openURL).toHaveBeenCalledWith('https://example.com/a.pdf');
    });

    it('rejects unsupported schemes before opening', async () => {
      const linking = {
        canOpenURL: jest.fn(),
        openURL: jest.fn(),
      };
      await expect(openExternalHttpUrl('ftp://example.com/a.pdf', linking)).resolves.toBe(false);
      expect(linking.canOpenURL).not.toHaveBeenCalled();
    });
  });

  it('includes the third-party disclaimer copy', () => {
    expect(BROKER_CONSENSUS_DISCLAIMER).toMatch(/third-party/i);
    expect(BROKER_CONSENSUS_DISCLAIMER).toMatch(/not an AYC/i);
  });
});
