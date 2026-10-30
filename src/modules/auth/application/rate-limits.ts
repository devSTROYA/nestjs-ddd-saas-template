import type { RateLimiter, RateLimitRule } from '@common/rate-limit';

const HOUR_MS = 60 * 60 * 1000;

export const LOGIN_CODE_PER_EMAIL: RateLimitRule = {
  name: 'login-code-email',
  limit: 5,
  windowMs: HOUR_MS,
};

// Requesting a new code resets the per-challenge attempt lock, so wrong codes are also capped per
// email. Only failures count, and the tight rule is per email and IP: a stranger exhausts their own
// budget, not the owner's. The ceiling per email alone bounds a distributed guesser.
export const LOGIN_VERIFY_FAILURES_PER_EMAIL_IP: RateLimitRule = {
  name: 'login-verify-failures-email-ip',
  limit: 10,
  windowMs: HOUR_MS,
};

export const LOGIN_VERIFY_FAILURES_PER_EMAIL: RateLimitRule = {
  name: 'login-verify-failures-email',
  limit: 30,
  windowMs: 24 * HOUR_MS,
};

export async function assertVerifyAllowed(
  limiter: RateLimiter,
  email: string,
  ip: string,
): Promise<void> {
  await limiter.assertBelow(LOGIN_VERIFY_FAILURES_PER_EMAIL, email);
  await limiter.assertBelow(LOGIN_VERIFY_FAILURES_PER_EMAIL_IP, `${email}|${ip}`);
}

export async function recordVerifyFailure(
  limiter: RateLimiter,
  email: string,
  ip: string,
): Promise<void> {
  await limiter.consume(LOGIN_VERIFY_FAILURES_PER_EMAIL, email);
  await limiter.consume(LOGIN_VERIFY_FAILURES_PER_EMAIL_IP, `${email}|${ip}`);
}
