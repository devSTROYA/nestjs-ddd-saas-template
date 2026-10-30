import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface.js';

import { RateLimitExceededError } from './rate-limit.error.js';
import {
  type PeekableThrottlerStorage,
  type RateLimitRule,
  StorageRateLimiter,
} from './rate-limiter.js';

const RULE: RateLimitRule = { name: 'test-rule', limit: 2, windowMs: 60_000 };
const SECONDS_LEFT = 60;

class MemoryStorage implements PeekableThrottlerStorage {
  private readonly hits = new Map<string, number>();

  increment(key: string, _ttl: number, limit: number): Promise<ThrottlerStorageRecord> {
    const totalHits = (this.hits.get(key) ?? 0) + 1;
    this.hits.set(key, totalHits);
    const isBlocked = totalHits > limit;
    return Promise.resolve({
      totalHits,
      timeToExpire: SECONDS_LEFT,
      isBlocked,
      timeToBlockExpire: isBlocked ? SECONDS_LEFT : 0,
    });
  }

  peek(key: string): Promise<{ hits: number; secondsLeft: number }> {
    return Promise.resolve({ hits: this.hits.get(key) ?? 0, secondsLeft: SECONDS_LEFT });
  }
}

describe('StorageRateLimiter', () => {
  it('allows up to the limit and then raises RateLimitExceededError with the wait time', async () => {
    const limiter = new StorageRateLimiter(new MemoryStorage());

    await limiter.consume(RULE, 'a@b.co');
    await limiter.consume(RULE, 'a@b.co');

    const failure = await limiter.consume(RULE, 'a@b.co').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(RateLimitExceededError);
    expect((failure as RateLimitExceededError).details?.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('counts each subject and each rule separately', async () => {
    const limiter = new StorageRateLimiter(new MemoryStorage());
    await limiter.consume(RULE, 'a@b.co');
    await limiter.consume(RULE, 'a@b.co');

    await expect(limiter.consume(RULE, 'other@b.co')).resolves.toBeUndefined();
    await expect(limiter.consume({ ...RULE, name: 'another-rule' }, 'a@b.co')).resolves.toBe(
      undefined,
    );
  });

  it('assertBelow fails only once the limit is used up, and never counts a hit', async () => {
    const limiter = new StorageRateLimiter(new MemoryStorage());

    for (let i = 0; i < 5; i++) {
      await limiter.assertBelow(RULE, 'a@b.co');
    }
    await limiter.consume(RULE, 'a@b.co');
    await limiter.assertBelow(RULE, 'a@b.co');
    await limiter.consume(RULE, 'a@b.co');

    const failure = await limiter.assertBelow(RULE, 'a@b.co').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(RateLimitExceededError);
    expect((failure as RateLimitExceededError).details?.retryAfterSeconds).toBe(SECONDS_LEFT);
    await expect(limiter.assertBelow(RULE, 'other@b.co')).resolves.toBeUndefined();
  });
});
