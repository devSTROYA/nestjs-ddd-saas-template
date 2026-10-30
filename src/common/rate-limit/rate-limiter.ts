import { createHash } from 'node:crypto';

import type { ThrottlerStorage } from '@nestjs/throttler';

import { RateLimitExceededError } from './rate-limit.error.js';

export interface RateLimitRule {
  name: string;
  limit: number;
  windowMs: number;
}

export interface RateLimiter {
  consume(rule: RateLimitRule, subject: string): Promise<void>;
  // Fails when the subject has already used up the rule, without counting a hit.
  assertBelow(rule: RateLimitRule, subject: string): Promise<void>;
}

export interface PeekableThrottlerStorage extends ThrottlerStorage {
  // The hits in the current window (0 when there is none) and the seconds left in it.
  peek(key: string): Promise<{ hits: number; secondsLeft: number }>;
}

export const RATE_LIMITER = Symbol('RATE_LIMITER');

export class StorageRateLimiter implements RateLimiter {
  constructor(private readonly storage: PeekableThrottlerStorage) {}

  async assertBelow(rule: RateLimitRule, subject: string): Promise<void> {
    const { hits, secondsLeft } = await this.storage.peek(this.keyOf(rule, subject));
    if (hits >= rule.limit) {
      throw new RateLimitExceededError(secondsLeft);
    }
  }

  async consume(rule: RateLimitRule, subject: string): Promise<void> {
    const record = await this.storage.increment(
      this.keyOf(rule, subject),
      rule.windowMs,
      rule.limit,
      0,
      rule.name,
    );
    if (record.isBlocked) {
      throw new RateLimitExceededError(record.timeToBlockExpire);
    }
  }

  private keyOf(rule: RateLimitRule, subject: string): string {
    return createHash('sha256').update(`${rule.name}:${subject}`).digest('hex');
  }
}
