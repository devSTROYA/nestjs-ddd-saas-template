import { appConfig } from './app.config.js';

describe('appConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('applies defaults', () => {
    vi.stubEnv('NODE_ENV', undefined);
    vi.stubEnv('PORT', undefined);
    vi.stubEnv('TRUST_PROXY_HOPS', undefined);

    expect(appConfig()).toEqual({ nodeEnv: 'development', port: 3000, trustProxyHops: 0 });
  });

  it('coerces numeric values from strings', () => {
    vi.stubEnv('PORT', '8080');
    vi.stubEnv('TRUST_PROXY_HOPS', '2');

    expect(appConfig()).toMatchObject({ port: 8080, trustProxyHops: 2 });
  });

  it('fails on an unknown NODE_ENV or an out-of-range PORT, naming the namespace', () => {
    vi.stubEnv('NODE_ENV', 'staging');
    expect(() => appConfig()).toThrow(/Invalid app config[\s\S]*NODE_ENV/);

    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PORT', '70000');
    expect(() => appConfig()).toThrow(/PORT/);
  });
});
