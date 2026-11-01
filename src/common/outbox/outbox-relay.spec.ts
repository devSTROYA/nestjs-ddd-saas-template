import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '@common/config';
import type { DatabaseContext } from '@common/database';

import { MAX_OUTBOX_BACKOFF_MS } from './outbox.constants.js';
import { OutboxRelay } from './outbox-relay.js';

const BASE_MS = 10_000;

describe('OutboxRelay backoff', () => {
  let down = true;
  const run = vi.fn((): Promise<{ delivered: number; failed: number }> => {
    return down
      ? Promise.reject(new Error('connection refused'))
      : Promise.resolve({ delivered: 0, failed: 0 });
  });
  let relay: OutboxRelay;
  let error: ReturnType<typeof vi.spyOn>;
  let debug: ReturnType<typeof vi.spyOn>;
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    down = true;
    run.mockClear();
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    relay = new OutboxRelay(
      { run } as unknown as DatabaseContext,
      [],
      { now: () => new Date() },
      new ConfigService<Env, true>({ OUTBOX_POLL_INTERVAL_MS: BASE_MS }),
    );
  });

  afterEach(async () => {
    await relay.beforeApplicationShutdown();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('backs off to the cap, logs one error per streak and one recovery', async () => {
    relay.start();

    // INFO: waits are base * 2^failures: 10s, 20s, 30s (capped from 40s), 30s
    const waits = [BASE_MS, BASE_MS * 2, MAX_OUTBOX_BACKOFF_MS, MAX_OUTBOX_BACKOFF_MS];
    for (const [index, wait] of waits.entries()) {
      await vi.advanceTimersByTimeAsync(wait - 1);
      expect(run).toHaveBeenCalledTimes(index);
      await vi.advanceTimersByTimeAsync(1);
      expect(run).toHaveBeenCalledTimes(index + 1);
    }

    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain('connection refused');
    expect(debug).toHaveBeenCalledTimes(waits.length - 1);

    down = false;
    await vi.advanceTimersByTimeAsync(MAX_OUTBOX_BACKOFF_MS);
    expect(log).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);

    const calls = run.mock.calls.length;
    await vi.advanceTimersByTimeAsync(BASE_MS - 1);
    expect(run).toHaveBeenCalledTimes(calls);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(calls + 1);
    expect(log).toHaveBeenCalledTimes(1);
  });
});
