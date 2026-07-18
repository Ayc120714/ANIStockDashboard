import {
  BROKER_CONSENSUS_DISCLAIMER,
  CONFIDENCE_FILTER_OPTIONS,
  LABEL_FILTER_OPTIONS,
  ORIGIN_FILTER_OPTIONS,
  SORT_OPTIONS,
  buildBrokerConsensusQueryParams,
  buildBrokerConsensusRecommendationRowKey,
  buildVoteCountsSummary,
  canOpenExternalHttpUrl,
  consensusConfidenceDisplay,
  consensusLabelDisplay,
  formatConsensusSummaryLine,
  isNoCoverage,
  isSingleSourceView,
  normalizedRatingDisplay,
} from './brokerConsensusDisplay';

describe('brokerConsensusDisplay', () => {
  test('filter option metadata includes no coverage and single-source labels', () => {
    expect(LABEL_FILTER_OPTIONS.some((o) => o.value === 'no_coverage' && o.label === 'No coverage')).toBe(true);
    expect(CONFIDENCE_FILTER_OPTIONS.some((o) => o.value === 'single_source' && o.label === 'Single-source view')).toBe(true);
    expect(ORIGIN_FILTER_OPTIONS.map((o) => o.value)).toEqual(['', 'domestic', 'foreign']);
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual([
      'score_desc',
      'score_asc',
      'symbol_asc',
      'newest_call_desc',
    ]);
  });

  test('consensusLabelDisplay never maps missing data to Neutral', () => {
    expect(consensusLabelDisplay('positive')).toBe('Positive');
    expect(consensusLabelDisplay('neutral')).toBe('Neutral');
    expect(consensusLabelDisplay('negative')).toBe('Negative');
    expect(consensusLabelDisplay('no_coverage')).toBe('No coverage');
    expect(consensusLabelDisplay(null)).toBe('—');
  });

  test('consensusConfidenceDisplay labels single-source and no coverage clearly', () => {
    expect(consensusConfidenceDisplay('medium')).toBe('Medium confidence');
    expect(consensusConfidenceDisplay('single_source')).toBe('Single-source view');
    expect(consensusConfidenceDisplay('no_coverage')).toBe('No coverage');
  });

  test('formatConsensusSummaryLine includes label, vote counts, and confidence', () => {
    const line = formatConsensusSummaryLine({
      label: 'positive',
      confidence: 'medium',
      counts: { positive: 3, neutral: 1, negative: 0, total: 4 },
    });
    expect(line).toBe('Positive · 3 positive / 1 neutral / 0 negative · Medium confidence');
    expect(buildVoteCountsSummary({ positive: 3, neutral: 1, negative: 0 })).toBe('3 positive / 1 neutral / 0 negative');
  });

  test('isSingleSourceView and isNoCoverage helpers', () => {
    expect(isSingleSourceView({ confidence: 'single_source' })).toBe(true);
    expect(isSingleSourceView({ confidence: 'medium' })).toBe(false);
    expect(isNoCoverage({ label: 'no_coverage' })).toBe(true);
    expect(isNoCoverage({ confidence: 'no_coverage' })).toBe(true);
    expect(isNoCoverage({ label: 'positive', confidence: 'high' })).toBe(false);
  });

  test('buildBrokerConsensusQueryParams omits empty filters and clamps pagination', () => {
    expect(buildBrokerConsensusQueryParams({
      search: '  reliance ',
      label: 'positive',
      origin: 'domestic',
      confidence: 'high',
      sort: 'symbol_asc',
      page: 0,
      page_size: 500,
    })).toEqual({
      search: 'reliance',
      label: 'positive',
      origin: 'domestic',
      confidence: 'high',
      sort: 'symbol_asc',
      page: 1,
      page_size: 200,
    });
    expect(buildBrokerConsensusQueryParams({})).toEqual({
      sort: 'score_desc',
      page: 1,
      page_size: 50,
    });
  });

  test('normalizedRatingDisplay maps backend polarity values', () => {
    expect(normalizedRatingDisplay('positive')).toBe('Positive');
    expect(normalizedRatingDisplay('neutral')).toBe('Neutral');
    expect(normalizedRatingDisplay('negative')).toBe('Negative');
  });

  test('disclaimer states third-party aggregation and not AYC recommendation', () => {
    expect(BROKER_CONSENSUS_DISCLAIMER).toMatch(/third-party/i);
    expect(BROKER_CONSENSUS_DISCLAIMER).toMatch(/not an AYC/i);
  });

  test('canOpenExternalHttpUrl accepts only http and https URLs', () => {
    expect(canOpenExternalHttpUrl('https://example.com/report.pdf')).toBe(true);
    expect(canOpenExternalHttpUrl('http://example.com/report.pdf')).toBe(true);
    expect(canOpenExternalHttpUrl('javascript:alert(1)')).toBe(false);
    expect(canOpenExternalHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(canOpenExternalHttpUrl('/relative/path')).toBe(false);
    expect(canOpenExternalHttpUrl('')).toBe(false);
  });

  test('buildBrokerConsensusRecommendationRowKey avoids institution-date collisions', () => {
    const shared = {
      institution_name: 'Motilal Oswal',
      recommendation_date: '2026-07-10',
    };
    const keyA = buildBrokerConsensusRecommendationRowKey({
      ...shared,
      normalized_rating: 'positive',
      target_price: 3000,
    });
    const keyB = buildBrokerConsensusRecommendationRowKey({
      ...shared,
      normalized_rating: 'neutral',
      target_price: 2800,
    });
    expect(keyA).not.toBe(keyB);
    expect(buildBrokerConsensusRecommendationRowKey({}, 2)).toBe('rec-2');
  });
});
