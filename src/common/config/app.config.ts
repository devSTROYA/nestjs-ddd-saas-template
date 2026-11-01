import { z } from 'zod';

import {
  ACCENT_COLORS,
  type AccentColor,
  DEFAULT_ACCENT,
  isAccentColor,
} from '../docs-theme/index.js';

const MAX_PORT = 65_535;
const DEFAULT_PORT = 3000;
const MIN_SECRET_LENGTH = 32;
const DEFAULT_POOL_MAX = 5;
const DEFAULT_OUTBOX_POLL_INTERVAL_MS = 1000;

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(DEFAULT_PORT),
    DATABASE_URL: z.url(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(DEFAULT_POOL_MAX),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    OUTBOX_POLL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1)
      .default(DEFAULT_OUTBOX_POLL_INTERVAL_MS),
    OUTBOX_RELAY_ENABLED: z.stringbool().default(true),
    OTP_SECRET: z.string().min(MIN_SECRET_LENGTH),
    JWT_SECRET: z.string().min(MIN_SECRET_LENGTH),
    RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    MAIL_FROM: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    ADMIN_SEED_EMAIL: z.email().optional(),
    DOCS_ACCENT: z.preprocess(
      emptyToUndefined,
      z
        .custom<AccentColor>((value) => typeof value === 'string' && isAccentColor(value), {
          message: `must be one of: ${ACCENT_COLORS.join(', ')}`,
        })
        .default(DEFAULT_ACCENT),
    ),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production' && env.RESEND_API_KEY === undefined) {
      return;
    }
    for (const key of ['RESEND_API_KEY', 'MAIL_FROM'] as const) {
      if (env[key] === undefined) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required in production and whenever email is sent through Resend`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
