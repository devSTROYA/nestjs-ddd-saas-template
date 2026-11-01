import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { parseConfig } from '@common/config';

const MIN_SECRET_LENGTH = 32;

const authSchema = z.object({
  JWT_SECRET: z.string().min(MIN_SECRET_LENGTH),
});

export const authConfig = registerAs('auth', () => ({
  jwtSecret: parseConfig('auth', authSchema).JWT_SECRET,
}));
