import {
  aiPicksScreensPayloadUsable,
  buildAiPicksScreensPayload,
  weeklyPicksHasRows,
} from '@core/utils/weeklyPicksScreens';

describe('weeklyPicksScreens', () => {
  it('treats header-only AI picks payload as not usable for cache', () => {
    const empty = buildAiPicksScreensPayload({bullish: [], bearish: []});
    expect(empty.list).toHaveLength(2);
    expect(aiPicksScreensPayloadUsable(empty)).toBe(false);
    expect(weeklyPicksHasRows({bullish: [], bearish: []})).toBe(false);
  });

  it('accepts payload when at least one symbol row exists', () => {
    const payload = buildAiPicksScreensPayload({
      pick_date: '2026-06-21',
      bullish: [{symbol: 'RELIANCE', grade: 'A'}],
      bearish: [],
    });
    expect(aiPicksScreensPayloadUsable(payload)).toBe(true);
    expect(weeklyPicksHasRows({bullish: [{symbol: 'RELIANCE'}], bearish: []})).toBe(true);
  });
});
