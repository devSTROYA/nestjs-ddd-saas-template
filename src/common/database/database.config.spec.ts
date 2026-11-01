import { databaseConfig } from './database.config.js';

const DATABASE_URL = 'postgres://user:pass@localhost:5432/db';

describe('databaseConfig', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);
    vi.stubEnv('DATABASE_POOL_MAX', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('applies the pool default', () => {
    expect(databaseConfig()).toEqual({ url: DATABASE_URL, poolMax: 5 });
  });

  it('coerces the pool size from a string', () => {
    vi.stubEnv('DATABASE_POOL_MAX', '3');

    expect(databaseConfig().poolMax).toBe(3);
  });

  it('fails when DATABASE_URL is missing or not a url', () => {
    vi.stubEnv('DATABASE_URL', undefined);
    expect(() => databaseConfig()).toThrow(/Invalid database config[\s\S]*DATABASE_URL/);

    vi.stubEnv('DATABASE_URL', 'nope');
    expect(() => databaseConfig()).toThrow(/DATABASE_URL/);
  });

  it('fails on a pool smaller than one', () => {
    vi.stubEnv('DATABASE_POOL_MAX', '0');

    expect(() => databaseConfig()).toThrow(/DATABASE_POOL_MAX/);
  });
});
