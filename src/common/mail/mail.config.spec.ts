import { mailConfig } from './mail.config.js';

const KEY = 're_123';
const FROM = 'App <no-reply@example.com>';

describe('mailConfig', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('RESEND_API_KEY', undefined);
    vi.stubEnv('MAIL_FROM', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is optional outside production and treats empty values as unset', () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('MAIL_FROM', '');

    expect(mailConfig()).toEqual({ resendApiKey: undefined, from: undefined });
  });

  it('requires both RESEND_API_KEY and MAIL_FROM in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => mailConfig()).toThrow(/Invalid mail config[\s\S]*RESEND_API_KEY/);

    vi.stubEnv('RESEND_API_KEY', KEY);
    expect(() => mailConfig()).toThrow(/MAIL_FROM/);

    vi.stubEnv('MAIL_FROM', FROM);
    expect(mailConfig().from).toBe(FROM);
  });

  it('requires MAIL_FROM as soon as a key is set', () => {
    vi.stubEnv('RESEND_API_KEY', KEY);
    expect(() => mailConfig()).toThrow(/MAIL_FROM/);

    vi.stubEnv('MAIL_FROM', FROM);
    expect(mailConfig().resendApiKey).toBe(KEY);
  });
});
