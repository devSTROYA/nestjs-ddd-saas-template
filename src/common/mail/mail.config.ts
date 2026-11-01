import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { emptyToUndefined, parseConfig } from '../config/index.js';

const mailSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    MAIL_FROM: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
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

export const mailConfig = registerAs('mail', () => {
  const env = parseConfig('mail', mailSchema);
  return { resendApiKey: env.RESEND_API_KEY, from: env.MAIL_FROM };
});
