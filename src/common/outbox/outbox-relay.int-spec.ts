import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';
import { newUuidV7 } from '@common/primitives';

import {
  MAX_OUTBOX_ATTEMPTS,
  MAX_OUTBOX_BATCHES_PER_RUN,
  OUTBOX_BATCH_SIZE,
} from './outbox.constants.js';
import { OutboxRelay } from './outbox-relay.js';
import type { OutboxConsumer, StoredEvent } from './outbox-consumer.js';

const POLL_INTERVAL_MS = 10;
const QUIET_PERIOD_MS = 150;

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const processedAt = new Date('2026-01-01T00:00:00.000Z');
const clock = { now: () => processedAt };

const relayFor = (consumers: OutboxConsumer[], relayEnabled = true): OutboxRelay =>
  new OutboxRelay(context, consumers, clock, { relayEnabled, pollIntervalMs: POLL_INTERVAL_MS });

const delivering = (delivered: string[] = []): OutboxConsumer => ({
  handle: (event: StoredEvent) => {
    delivered.push(event.id);
    return Promise.resolve();
  },
});

const failing = (): OutboxConsumer => ({
  handle: () => Promise.reject(new Error('consumer down')),
});

async function insertEvent(attempts = 0): Promise<string> {
  const id = newUuidV7();
  await pool.query(
    `INSERT INTO outbox (id, name, aggregate_id, payload, occurred_at, attempts)
     VALUES ($1, 'test.happened', $2, '{}', now(), $3)`,
    [id, newUuidV7(), attempts],
  );
  return id;
}

type OutboxState = {
  processed_at: Date | null;
  attempts: number;
  last_error: string | null;
};

async function rowOf(id: string): Promise<OutboxState> {
  const { rows } = await pool.query<OutboxState>(
    'SELECT processed_at, attempts, last_error FROM outbox WHERE id = $1',
    [id],
  );
  const [row] = rows;
  if (!row) {
    throw new Error(`No outbox row ${id}`);
  }
  return row;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE outbox');
});

afterAll(async () => {
  await pool.end();
});

describe('OutboxRelay.drain', () => {
  it('delivers pending events in id order and marks them processed', async () => {
    const first = await insertEvent();
    const second = await insertEvent();
    const delivered: string[] = [];
    const relay = relayFor([delivering(delivered)]);

    expect(await relay.drain()).toEqual({ delivered: 2, failed: 0 });

    expect(delivered).toEqual([first, second]);
    expect((await rowOf(first)).processed_at).toEqual(processedAt);
    expect((await rowOf(second)).processed_at).toEqual(processedAt);
    expect(await relay.drain()).toEqual({ delivered: 0, failed: 0 });
  });

  it('keeps a failed event pending, records the error and retries it later', async () => {
    const id = await insertEvent();
    let fail = true;
    const relay = relayFor([
      { handle: () => (fail ? Promise.reject(new Error('consumer down')) : Promise.resolve()) },
    ]);

    expect(await relay.drain()).toEqual({ delivered: 0, failed: 1 });
    expect(await rowOf(id)).toMatchObject({
      processed_at: null,
      attempts: 1,
      last_error: 'consumer down',
    });

    fail = false;
    await relay.drain();
    expect((await rowOf(id)).processed_at).toEqual(processedAt);
  });

  it('stops retrying an event after the maximum number of attempts', async () => {
    const id = await insertEvent(MAX_OUTBOX_ATTEMPTS);
    const handle = vi.fn(() => Promise.resolve());
    const relay = relayFor([{ handle }]);

    expect(await relay.drain()).toEqual({ delivered: 0, failed: 0 });

    expect(handle).not.toHaveBeenCalled();
    expect((await rowOf(id)).processed_at).toBeNull();
  });

  it('does not deliver the same event twice when two relays run at once', async () => {
    await insertEvent();
    const handle = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
    const consumer = { handle };

    await Promise.all([relayFor([consumer]).drain(), relayFor([consumer]).drain()]);

    expect(handle).toHaveBeenCalledTimes(1);
  });
});

describe('OutboxRelay.drainAll', () => {
  it('keeps going past one batch until the table is empty', async () => {
    const ids: string[] = [];
    for (let index = 0; index <= OUTBOX_BATCH_SIZE; index += 1) {
      ids.push(await insertEvent());
    }
    const delivered: string[] = [];

    await relayFor([delivering(delivered)]).drainAll();

    expect(delivered).toEqual(ids);
    expect((await rowOf(ids[OUTBOX_BATCH_SIZE] ?? '')).processed_at).toEqual(processedAt);
  });

  it('stops after a bounded number of batches so one HTTP-triggered run stays short', async () => {
    const total = OUTBOX_BATCH_SIZE * MAX_OUTBOX_BATCHES_PER_RUN + 1;
    await pool.query(
      `INSERT INTO outbox (id, name, aggregate_id, payload, occurred_at)
       SELECT gen_random_uuid(), 'test.happened', gen_random_uuid(), '{}', now()
       FROM generate_series(1, $1::int)`,
      [total],
    );

    await relayFor([delivering()]).drainAll();

    const { rows } = await pool.query<{ pending: string }>(
      'SELECT count(*) AS pending FROM outbox WHERE processed_at IS NULL',
    );
    expect(rows[0]?.pending).toBe('1');
  });

  it('tries a failing event once per run so the schedule sets the retry pace', async () => {
    const first = await insertEvent();
    const second = await insertEvent();

    await relayFor([failing()]).drainAll();

    expect((await rowOf(first)).attempts).toBe(1);
    expect((await rowOf(second)).attempts).toBe(1);
  });

  it('does nothing once shutdown has started', async () => {
    const id = await insertEvent();
    const relay = relayFor([delivering()]);

    await relay.beforeApplicationShutdown();
    await relay.drainAll();

    expect((await rowOf(id)).processed_at).toBeNull();
  });
});

describe('OutboxRelay polling loop', () => {
  it('delivers in the background when enabled and stops cleanly on shutdown', async () => {
    const id = await insertEvent();
    const relay = relayFor([delivering()]);

    relay.onApplicationBootstrap();
    await vi.waitFor(async () => {
      expect((await rowOf(id)).processed_at).toEqual(processedAt);
    });
    await relay.beforeApplicationShutdown();

    const later = await insertEvent();
    await sleep(QUIET_PERIOD_MS);
    expect((await rowOf(later)).processed_at).toBeNull();
  });

  it('does not poll when OUTBOX_RELAY_ENABLED is false, so web instances stay idle', async () => {
    const id = await insertEvent();
    const relay = relayFor([delivering()], false);

    relay.onApplicationBootstrap();
    await sleep(QUIET_PERIOD_MS);
    await relay.beforeApplicationShutdown();

    expect((await rowOf(id)).processed_at).toBeNull();
  });

  it('starts only once however many times start is called', async () => {
    const id = await insertEvent();
    const handle = vi.fn(() => Promise.resolve());
    const relay = relayFor([{ handle }], false);

    relay.start();
    relay.start();
    await vi.waitFor(async () => {
      expect((await rowOf(id)).processed_at).toEqual(processedAt);
    });
    await relay.beforeApplicationShutdown();

    expect(handle).toHaveBeenCalledTimes(1);
  });
});
