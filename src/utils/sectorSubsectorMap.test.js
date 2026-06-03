import { resolveSectorSubsectorMapping } from './sectorSubsectorMap';

describe('sectorSubsectorMap', () => {
  test('Nifty Bank maps to Banks - Regional only', () => {
    expect(resolveSectorSubsectorMapping('Nifty Bank')).toEqual(['Banks - Regional']);
    expect(resolveSectorSubsectorMapping('NIFTY BANK')).toEqual(['Banks - Regional']);
  });

  test('bank indices resolve distinctly from broad fin-service', () => {
    const bank = resolveSectorSubsectorMapping('Nifty Bank');
    expect(bank).toEqual(['Banks - Regional']);
    expect(bank).not.toContain('Credit Services');
    expect(resolveSectorSubsectorMapping('NIFTY PVT BANK')).toContain('Credit Services');
    expect(resolveSectorSubsectorMapping('NIFTY FIN SERVICE').length).toBeGreaterThan(3);
  });

  test('unknown sector returns null', () => {
    expect(resolveSectorSubsectorMapping('Nifty 50')).toBeNull();
    expect(resolveSectorSubsectorMapping('')).toBeNull();
  });

  test('Nifty IT resolves with display casing', () => {
    const mapped = resolveSectorSubsectorMapping('Nifty IT');
    expect(mapped).toContain('Information Technology Services');
  });
});
