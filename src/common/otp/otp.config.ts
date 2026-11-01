import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { parseConfig } from '../config/index.js';

const MIN_SECRET_LENGTH = 32;

const otpSchema = z.object({
  OTP_SECRET: z.string().min(MIN_SECRET_LENGTH),
});

export const otpConfig = registerAs('otp', () => ({
  secret: parseConfig('otp', otpSchema).OTP_SECRET,
}));
