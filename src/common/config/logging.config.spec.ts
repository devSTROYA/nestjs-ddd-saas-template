import { loggingConfig } from './logging.config.js';

describe('loggingConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to info and accepts a pino level', () => {
    vi.stubEnv('LOG_LEVEL', undefined);
    expect(loggingConfig()).toEqual({ level: 'info' });

    vi.stubEnv('LOG_LEVEL', 'silent');
    expect(loggingConfig().level).toBe('silent');
  });

  it('rejects an unknown level', () => {
    vi.stubEnv('LOG_LEVEL', 'loud');

    expect(() => loggingConfig()).toThrow(/LOG_LEVEL/);
  });
});
