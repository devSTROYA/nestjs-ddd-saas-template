import { otpConfig } from './otp.config.js';

describe('otpConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the secret', () => {
    vi.stubEnv('OTP_SECRET', 'x'.repeat(32));

    expect(otpConfig()).toEqual({ secret: 'x'.repeat(32) });
  });

  it('fails when OTP_SECRET is missing or shorter than 32 characters', () => {
    vi.stubEnv('OTP_SECRET', undefined);
    expect(() => otpConfig()).toThrow(/Invalid otp config[\s\S]*OTP_SECRET/);

    vi.stubEnv('OTP_SECRET', 'short');
    expect(() => otpConfig()).toThrow(/OTP_SECRET/);
  });
});
