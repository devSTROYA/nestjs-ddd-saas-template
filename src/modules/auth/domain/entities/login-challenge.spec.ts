import { Email } from '@common/primitives';

import { newLoginChallengeId } from '../value-objects/ids.js';
import { LoginChallengeStatus } from '../value-objects/login-challenge-status.js';
import { LoginChallenge, MAX_LOGIN_ATTEMPTS } from './login-challenge.js';

const NOW = new Date('2026-01-01T00:00:00Z');
const IN_15_MIN = new Date(NOW.getTime() + 15 * 60_000);

const newChallenge = (): LoginChallenge =>
  LoginChallenge.create(
    {
      id: newLoginChallengeId(),
      tenantId: null,
      email: Email.create('root@b.co'),
      otpHash: 'hash',
      expiresAt: IN_15_MIN,
    },
    NOW,
  );

describe('LoginChallenge', () => {
  it('starts pending with zero attempts', () => {
    const challenge = newChallenge();
    expect(challenge.status).toBe(LoginChallengeStatus.PENDING);
    expect(challenge.attempts).toBe(0);
  });

  it('is consumed by a matching otp and cannot be used twice', () => {
    const challenge = newChallenge();

    expect(challenge.verify(true, NOW)).toBe(true);
    expect(challenge.status).toBe(LoginChallengeStatus.CONSUMED);
    expect(challenge.verify(true, NOW)).toBe(false);
  });

  it('counts a wrong otp as an attempt and stays pending', () => {
    const challenge = newChallenge();

    expect(challenge.verify(false, NOW)).toBe(false);
    expect(challenge.attempts).toBe(1);
    expect(challenge.status).toBe(LoginChallengeStatus.PENDING);
  });

  it('locks after the maximum number of wrong attempts, even for the right otp', () => {
    const challenge = newChallenge();
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      challenge.verify(false, NOW);
    }

    expect(challenge.verify(true, NOW)).toBe(false);
    expect(challenge.attempts).toBe(MAX_LOGIN_ATTEMPTS);
  });

  it('rejects an expired challenge without counting an attempt', () => {
    const challenge = newChallenge();

    expect(challenge.verify(true, IN_15_MIN)).toBe(false);
    expect(challenge.verify(false, IN_15_MIN)).toBe(false);
    expect(challenge.attempts).toBe(0);
  });

  it('regenerate swaps the hash, extends expiry and resets attempts', () => {
    const challenge = newChallenge();
    challenge.verify(false, NOW);
    const later = new Date(IN_15_MIN.getTime() + 60_000);

    challenge.regenerate('hash2', later);

    expect(challenge.otpHash).toBe('hash2');
    expect(challenge.expiresAt).toBe(later);
    expect(challenge.attempts).toBe(0);
  });
});
