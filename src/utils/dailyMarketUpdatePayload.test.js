import {
  formatInrPrice,
  formatInrVolume,
  formatIndexValue,
  formatPctDelta,
  normalizeDailyMarketUpdatePayload,
  splitBoldSegments,
} from './dailyMarketUpdatePayload';

describe('dailyMarketUpdatePayload', () => {
  it('normalizes API payload and formats deltas for the Daily Update report', () => {
    const n = normalizeDailyMarketUpdatePayload({
      ok: true,
      as_of_label: 'Thursday, 13 August 2026',
      last_updated_ist: '13 Aug 2026, 8:00 PM IST',
      breadth: {
        advances: 574,
        declines: 393,
        unchanged: 33,
        total: 1000,
        advances_pct: 57.4,
        declines_pct: 39.3,
        unchanged_pct: 3.3,
        advance_decline_ratio: 1.46,
      },
      sector_pulse: {
        top_gainers: [{ code: 'CNXDEFENCE', value: 9810.8, pct: 1.55 }],
        top_losers: [{ code: 'CNXMETAL', value: 13033.75, pct: -1.05 }],
        lead: { code: 'CNXDEFENCE', pct: 1.55 },
        drag: { code: 'CNXMETAL', pct: -1.05 },
      },
      index_cards: [{ code: 'CNXDEFENCE', value: 9810.8, pct: 1.55 }],
      volume_leaders: [{ symbol: 'idea', volume: 547253456, price: 13.51 }],
      fresh_signals: { B1: 95, B2: 160, B3: 61, S1: 134, S2: 148, S3: 43 },
      narratives: {
        headline: 'Defence leads',
        executive_summary: '**CNXDEFENCE** led while **CNXMETAL** lagged.',
      },
    });
    expect(n.breadth.advanceDeclineRatio).toBe(1.46);
    expect(n.sectorPulse.topGainers[0].code).toBe('CNXDEFENCE');
    expect(n.volumeLeaders[0].symbol).toBe('IDEA');
    expect(n.freshSignals.B1).toBe(95);
    expect(formatInrVolume(547253456).replace(/,/g, '')).toBe('547253456');
    expect(formatInrPrice(13.51)).toContain('13.51');
    expect(formatIndexValue(9810.8).replace(/,/g, '')).toContain('9810');
    expect(formatPctDelta(1.55).positive).toBe(true);
    expect(formatPctDelta(-1.05).positive).toBe(false);
    expect(splitBoldSegments(n.narratives.executiveSummary).some((p) => p.bold && p.text === 'CNXDEFENCE')).toBe(
      true,
    );
  });
});
