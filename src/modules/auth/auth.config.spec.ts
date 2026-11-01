import { authConfig } from './auth.config.js';

describe('authConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the secret', () => {
    vi.stubEnv('JWT_SECRET', 'y'.repeat(32));

    expect(authConfig()).toEqual({ jwtSecret: 'y'.repeat(32) });
  });

  it('fails when JWT_SECRET is missing or shorter than 32 characters', () => {
    vi.stubEnv('JWT_SECRET', undefined);
    expect(() => authConfig()).toThrow(/Invalid auth config[\s\S]*JWT_SECRET/);

    vi.stubEnv('JWT_SECRET', 'short');
    expect(() => authConfig()).toThrow(/JWT_SECRET/);
  });
});
