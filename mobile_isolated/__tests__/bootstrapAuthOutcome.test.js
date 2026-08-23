import {resolveBootstrapAuthOutcome} from '@core/auth/bootstrapAuthOutcome';

describe('bootstrapAuthOutcome', () => {
  it('logs out when both /auth/me and refresh fail (stale tokens after APK update)', () => {
    expect(resolveBootstrapAuthOutcome({meOk: false, refreshOk: false})).toBe('logout');
  });

  it('keeps session when me or refresh succeeds', () => {
    expect(resolveBootstrapAuthOutcome({meOk: true, refreshOk: false})).toBe('authenticated');
    expect(resolveBootstrapAuthOutcome({meOk: false, refreshOk: true})).toBe('authenticated');
  });
});
