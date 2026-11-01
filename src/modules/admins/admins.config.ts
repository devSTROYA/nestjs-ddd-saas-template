import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { parseConfig } from '@common/config';

const adminsSchema = z.object({
  ADMIN_SEED_EMAIL: z.email().optional(),
});

export const adminsConfig = registerAs('admins', () => ({
  seedEmail: parseConfig('admins', adminsSchema).ADMIN_SEED_EMAIL,
}));
