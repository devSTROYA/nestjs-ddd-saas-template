import { randomUUID } from 'node:crypto';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { PostgresThrottlerStorage } from './postgres-throttler-storage.js';

const pool = new Pool({ connectionString: inject('databaseUrl') });
const storage = new PostgresThrottlerStorage(drizzle(pool));
const LIMIT = 3;
const WINDOW_MS = 60_000;

const hit = (key: string, ttl = WINDOW_MS) => storage.increment(key, ttl, LIMIT, 0, 'default');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE rate_limits');
});

afterAll(async () => {
  await pool.end();
});

describe('PostgresThrottlerStorage', () => {
  it('counts hits and blocks only after the limit is exceeded', async () => {
    const key = randomUUID();

    const records = [await hit(key), await hit(key), await hit(key), await hit(key)];

    expect(records.map((record) => record.totalHits)).toEqual([1, 2, 3, 4]);
    expect(records.map((record) => record.isBlocked)).toEqual([false, false, false, true]);
  });

  it('reports the seconds left in the window as the time to wait when blocked', async () => {
    const key = randomUUID();
    for (let i = 0; i < LIMIT; i++) {
      await hit(key);
    }

    const blocked = await hit(key);

    expect(blocked.isBlocked).toBe(true);
    expect(blocked.timeToBlockExpire).toBeGreaterThan(0);
    expect(blocked.timeToBlockExpire).toBeLessThanOrEqual(WINDOW_MS / 1000);
    expect(blocked.timeToExpire).toBe(blocked.timeToBlockExpire);
  });

  it('keeps separate counters per key', async () => {
    const [first, second] = [randomUUID(), randomUUID()];
    for (let i = 0; i < LIMIT + 1; i++) {
      await hit(first);
    }

    expect((await hit(second)).totalHits).toBe(1);
  });

  it('starts a new window once the previous one has expired', async () => {
    const key = randomUUID();
    for (let i = 0; i < LIMIT + 1; i++) {
      await hit(key, 300);
    }
    await sleep(400);

    const record = await hit(key, 300);

    expect(record.totalHits).toBe(1);
    expect(record.isBlocked).toBe(false);
  });

  it('counts concurrent hits exactly, without losing updates', async () => {
    const key = randomUUID();

    const records = await Promise.all(Array.from({ length: 25 }, () => hit(key)));

    expect(records.map((record) => record.totalHits).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 1),
    );
  });

  it('peeks at the hits of the live window without counting, and ignores an expired one', async () => {
    const key = randomUUID();
    expect(await storage.peek(key)).toEqual({ hits: 0, secondsLeft: 0 });

    await hit(key);
    await hit(key);

    const peeked = await storage.peek(key);
    expect(peeked.hits).toBe(2);
    expect(peeked.secondsLeft).toBeGreaterThan(0);
    expect((await hit(key)).totalHits).toBe(3);

    const expired = randomUUID();
    await hit(expired, 200);
    await sleep(300);
    expect((await storage.peek(expired)).hits).toBe(0);
  });

  it('allows the request and does not throw when the database is unavailable', async () => {
    const brokenPool = new Pool({ connectionString: 'postgres://x:y@127.0.0.1:1/none' });
    const unavailable = new PostgresThrottlerStorage(drizzle(brokenPool));

    const record = await unavailable.increment(randomUUID(), WINDOW_MS, LIMIT, 0, 'default');

    expect(record.isBlocked).toBe(false);
    expect((await unavailable.peek(randomUUID())).hits).toBe(0);
    await brokenPool.end();
  });
});
