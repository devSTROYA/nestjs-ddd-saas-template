import { envFilePaths } from './env-files.js';

describe('envFilePaths', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('puts the environment specific local file before the default .env', () => {
    expect(envFilePaths('development')).toEqual(['.env.development.local', '.env']);
    expect(envFilePaths('test')).toEqual(['.env.test.local', '.env']);
    expect(envFilePaths('production')).toEqual(['.env.production.local', '.env']);
  });

  it('reads NODE_ENV when no environment is given', () => {
    vi.stubEnv('NODE_ENV', 'test');

    expect(envFilePaths()).toEqual(['.env.test.local', '.env']);
  });

  it('falls back to development when NODE_ENV is not set', () => {
    vi.stubEnv('NODE_ENV', undefined);

    expect(envFilePaths()).toEqual(['.env.development.local', '.env']);
  });
});
