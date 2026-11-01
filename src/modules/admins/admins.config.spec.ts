import { adminsConfig } from './admins.config.js';

describe('adminsConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('leaves the seed email unset by default', () => {
    vi.stubEnv('ADMIN_SEED_EMAIL', undefined);

    expect(adminsConfig()).toEqual({ seedEmail: undefined });
  });

  it('accepts an optional ADMIN_SEED_EMAIL and rejects an invalid one', () => {
    vi.stubEnv('ADMIN_SEED_EMAIL', 'root@b.co');
    expect(adminsConfig().seedEmail).toBe('root@b.co');

    vi.stubEnv('ADMIN_SEED_EMAIL', 'nope');
    expect(() => adminsConfig()).toThrow(/ADMIN_SEED_EMAIL/);
  });
});
