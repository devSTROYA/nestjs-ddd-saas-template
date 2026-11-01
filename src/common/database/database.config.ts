import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { parseConfig } from '../config/index.js';

const DEFAULT_POOL_MAX = 5;

const databaseSchema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(DEFAULT_POOL_MAX),
});

export const databaseConfig = registerAs('database', () => {
  const env = parseConfig('database', databaseSchema);
  return { url: env.DATABASE_URL, poolMax: env.DATABASE_POOL_MAX };
});
