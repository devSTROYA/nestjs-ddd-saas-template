import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { parseConfig } from '../config/index.js';

const DEFAULT_POLL_INTERVAL_MS = 1000;

const outboxSchema = z.object({
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(1).default(DEFAULT_POLL_INTERVAL_MS),
  OUTBOX_RELAY_ENABLED: z.stringbool().default(true),
});

export const outboxConfig = registerAs('outbox', () => {
  const env = parseConfig('outbox', outboxSchema);
  return { pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS, relayEnabled: env.OUTBOX_RELAY_ENABLED };
});
