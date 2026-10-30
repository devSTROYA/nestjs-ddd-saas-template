import { trustProxy } from './trust-proxy.js';

describe('trustProxy', () => {
  it('trusts nothing when there are no proxy hops', () => {
    expect(trustProxy(0)).toBe(false);
  });

  it('trusts exactly the given number of hops counted from the socket', () => {
    const trust = trustProxy(2);

    expect(typeof trust).toBe('function');
    if (typeof trust === 'function') {
      expect([0, 1, 2, 3].map((hop) => trust('10.0.0.1', hop))).toEqual([true, true, false, false]);
    }
  });
});
