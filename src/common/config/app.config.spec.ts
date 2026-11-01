import { validateEnv } from './app.config.js';

const DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
const OTP_SECRET = 'x'.repeat(32);
const JWT_SECRET = 'y'.repeat(32);
const BASE = { DATABASE_URL, OTP_SECRET, JWT_SECRET };
const MAIL = { RESEND_API_KEY: 're_123', MAIL_FROM: 'App <no-reply@example.com>' };

describe('validateEnv', () => {
  it('applies defaults', () => {
    expect(validateEnv(BASE)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
      DATABASE_POOL_MAX: 5,
      TRUST_PROXY_HOPS: 0,
      LOG_LEVEL: 'info',
      OUTBOX_POLL_INTERVAL_MS: 1000,
      OUTBOX_RELAY_ENABLED: true,
      OTP_SECRET,
      JWT_SECRET,
      DOCS_ACCENT: 'lavender',
      DOCS_COLOR_MODE: 'toggle',
    });
  });

  it('reads OUTBOX_RELAY_ENABLED as a real boolean, not as a non-empty string', () => {
    expect(validateEnv({ ...BASE, OUTBOX_RELAY_ENABLED: 'false' }).OUTBOX_RELAY_ENABLED).toBe(
      false,
    );
    expect(validateEnv({ ...BASE, OUTBOX_RELAY_ENABLED: 'true' }).OUTBOX_RELAY_ENABLED).toBe(true);
    expect(() => validateEnv({ ...BASE, OUTBOX_RELAY_ENABLED: 'maybe' })).toThrow(
      /OUTBOX_RELAY_ENABLED/,
    );
  });

  it('accepts a Catppuccin accent for the docs, treats empty as the default and rejects others', () => {
    expect(validateEnv({ ...BASE, DOCS_ACCENT: 'mauve' }).DOCS_ACCENT).toBe('mauve');
    expect(validateEnv({ ...BASE, DOCS_ACCENT: '' }).DOCS_ACCENT).toBe('lavender');
    expect(() => validateEnv({ ...BASE, DOCS_ACCENT: 'banana' })).toThrow(/DOCS_ACCENT/);
    expect(() => validateEnv({ ...BASE, DOCS_ACCENT: 'surface0' })).toThrow(/DOCS_ACCENT/);
  });

  it('accepts a color mode for the docs, treats empty as toggle and rejects others', () => {
    expect(validateEnv({ ...BASE, DOCS_COLOR_MODE: 'system' }).DOCS_COLOR_MODE).toBe('system');
    expect(validateEnv({ ...BASE, DOCS_COLOR_MODE: 'toggle' }).DOCS_COLOR_MODE).toBe('toggle');
    expect(validateEnv({ ...BASE, DOCS_COLOR_MODE: '' }).DOCS_COLOR_MODE).toBe('toggle');
    expect(() => validateEnv({ ...BASE, DOCS_COLOR_MODE: 'dark' })).toThrow(/DOCS_COLOR_MODE/);
  });

  it('coerces numeric values from strings', () => {
    const env = validateEnv({
      ...BASE,
      PORT: '8080',
      DATABASE_POOL_MAX: '3',
      TRUST_PROXY_HOPS: '2',
    });

    expect([env.PORT, env.DATABASE_POOL_MAX, env.TRUST_PROXY_HOPS]).toEqual([8080, 3, 2]);
  });

  it('accepts an optional ADMIN_SEED_EMAIL and rejects an invalid one', () => {
    expect(validateEnv({ ...BASE, ADMIN_SEED_EMAIL: 'root@b.co' }).ADMIN_SEED_EMAIL).toBe(
      'root@b.co',
    );
    expect(() => validateEnv({ ...BASE, ADMIN_SEED_EMAIL: 'nope' })).toThrow(/ADMIN_SEED_EMAIL/);
  });

  it('fails when DATABASE_URL is missing or not a url', () => {
    expect(() => validateEnv({ OTP_SECRET, JWT_SECRET })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ ...BASE, DATABASE_URL: 'nope' })).toThrow(/DATABASE_URL/);
  });

  it.each(['OTP_SECRET', 'JWT_SECRET'])(
    'fails when %s is missing or shorter than 32 characters',
    (name) => {
      const { [name]: _omitted, ...withoutSecret } = BASE as Record<string, string>;

      expect(() => validateEnv(withoutSecret)).toThrow(new RegExp(name));
      expect(() => validateEnv({ ...BASE, [name]: 'short' })).toThrow(new RegExp(name));
    },
  );

  it('fails on an unknown NODE_ENV, an out-of-range PORT or a pool smaller than one', () => {
    expect(() => validateEnv({ ...BASE, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
    expect(() => validateEnv({ ...BASE, PORT: '70000' })).toThrow(/PORT/);
    expect(() => validateEnv({ ...BASE, DATABASE_POOL_MAX: '0' })).toThrow(/DATABASE_POOL_MAX/);
  });

  describe('email through Resend', () => {
    it('is optional outside production and treats empty values as unset', () => {
      expect(
        validateEnv({ ...BASE, RESEND_API_KEY: '', MAIL_FROM: '' }).RESEND_API_KEY,
      ).toBeUndefined();
    });

    it('requires both RESEND_API_KEY and MAIL_FROM in production', () => {
      expect(() => validateEnv({ ...BASE, NODE_ENV: 'production' })).toThrow(/RESEND_API_KEY/);
      expect(() =>
        validateEnv({ ...BASE, NODE_ENV: 'production', RESEND_API_KEY: 're_123' }),
      ).toThrow(/MAIL_FROM/);
      expect(validateEnv({ ...BASE, NODE_ENV: 'production', ...MAIL }).MAIL_FROM).toBe(
        MAIL.MAIL_FROM,
      );
    });

    it('requires MAIL_FROM as soon as a key is set', () => {
      expect(() => validateEnv({ ...BASE, RESEND_API_KEY: 're_123' })).toThrow(/MAIL_FROM/);
      expect(validateEnv({ ...BASE, ...MAIL }).RESEND_API_KEY).toBe('re_123');
    });
  });
});
