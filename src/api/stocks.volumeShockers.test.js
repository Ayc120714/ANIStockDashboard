import { mapVolumeShockersList } from './stocks';

describe('mapVolumeShockersList', () => {
  const rawRow = {
    symbol: 'KEC',
    sector: 'Industrials',
    subsector: 'Construction',
    market_cap: 'Large',
    volume: 514017,
    avg_volume: 100000,
    price: 812.5,
    day1d: 1.25,
    percent_change_volume_1d: 414.0,
  };

  it('maps raw API fields into display columns', () => {
    const [row] = mapVolumeShockersList([rawRow], 'day');
    expect(row.symbol).toBe('KEC');
    expect(row.subSector).toBe('Construction');
    expect(row.mc).toBe('Large');
    expect(row.avgVolume).not.toBe('—');
    expect(row.cmp).toContain('812');
    expect(row.volJump).toBe('5.1x');
    expect(row.volChgPct).toBe('+414.0%');
    expect(row.chg).toBe('+1.25%');
  });

  it('does not wipe CMP/Avg Vol when remapping already-mapped cache rows (regression)', () => {
    // Bug: prefetch stored mapped rows; VolumeShockersPage mapRows ran again and
    // looked for avg_volume/price → "—" for Sub Sector, MC, Avg Vol, CMP, etc.
    const mappedOnce = mapVolumeShockersList([rawRow], 'day');
    const remapped = mapVolumeShockersList(mappedOnce, 'day');
    expect(remapped[0].subSector).toBe('Construction');
    expect(remapped[0].mc).toBe('Large');
    expect(remapped[0].avgVolume).toBe(mappedOnce[0].avgVolume);
    expect(remapped[0].cmp).toBe(mappedOnce[0].cmp);
    expect(remapped[0].volJump).toBe('5.1x');
    expect(remapped[0].volChgPct).toBe('+414.0%');
    expect(remapped[0].chg).toBe('+1.25%');
  });
});
