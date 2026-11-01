import { outboxConfig } from './outbox.config.js';

describe('outboxConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('applies defaults', () => {
    vi.stubEnv('OUTBOX_POLL_INTERVAL_MS', undefined);
    vi.stubEnv('OUTBOX_RELAY_ENABLED', undefined);

    expect(outboxConfig()).toEqual({ pollIntervalMs: 1000, relayEnabled: true });
  });

  it('reads OUTBOX_RELAY_ENABLED as a real boolean, not as a non-empty string', () => {
    vi.stubEnv('OUTBOX_RELAY_ENABLED', 'false');
    expect(outboxConfig().relayEnabled).toBe(false);

    vi.stubEnv('OUTBOX_RELAY_ENABLED', 'true');
    expect(outboxConfig().relayEnabled).toBe(true);

    vi.stubEnv('OUTBOX_RELAY_ENABLED', 'maybe');
    expect(() => outboxConfig()).toThrow(/OUTBOX_RELAY_ENABLED/);
  });

  it('coerces the poll interval and rejects less than one', () => {
    vi.stubEnv('OUTBOX_POLL_INTERVAL_MS', '250');
    expect(outboxConfig().pollIntervalMs).toBe(250);

    vi.stubEnv('OUTBOX_POLL_INTERVAL_MS', '0');
    expect(() => outboxConfig()).toThrow(/OUTBOX_POLL_INTERVAL_MS/);
  });
});
