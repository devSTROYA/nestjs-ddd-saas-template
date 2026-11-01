import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { parseConfig } from './parse-config.js';

const MAX_PORT = 65_535;
const DEFAULT_PORT = 3000;

const appSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(DEFAULT_PORT),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
});

export const appConfig = registerAs('app', () => {
  const env = parseConfig('app', appSchema);
  return { nodeEnv: env.NODE_ENV, port: env.PORT, trustProxyHops: env.TRUST_PROXY_HOPS };
});
