import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { parseConfig } from './parse-config.js';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const loggingSchema = z.object({
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export const loggingConfig = registerAs('logging', () => ({
  level: parseConfig('logging', loggingSchema).LOG_LEVEL,
}));
