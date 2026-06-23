import { pingApiLiveness } from './apiLiveness';

describe('apiLiveness', () => {
  it('prefers GET /health and does not call /system/status when health succeeds', async () => {
    const apiGet = jest.fn(async endpoint => {
      if (endpoint === '/health') return { status: 'healthy' };
      throw new Error('should not reach status');
    });

    await expect(pingApiLiveness(apiGet, { timeoutMs: 1000 })).resolves.toBe(true);
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet).toHaveBeenCalledWith('/health', { skipCache: true });
  });

  it('falls back to GET /system/status when /health fails', async () => {
    const apiGet = jest.fn(async endpoint => {
      if (endpoint === '/health') throw new Error('404');
      if (endpoint === '/system/status') return { status: 'healthy' };
      throw new Error('unexpected');
    });

    await expect(pingApiLiveness(apiGet, { timeoutMs: 1000 })).resolves.toBe(true);
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  it('returns false when both probes time out or fail', async () => {
    const apiGet = jest.fn(() => new Promise(() => {}));

    await expect(pingApiLiveness(apiGet, { timeoutMs: 20 })).resolves.toBe(false);
    expect(apiGet.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
