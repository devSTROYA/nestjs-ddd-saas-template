import { z } from 'zod';

import { OTP_DIGITS } from '@common/otp';

export const requestAdminLoginBodySchema = z.object({ email: z.string() });

export const verifyAdminLoginBodySchema = z.object({
  email: z.string(),
  otp: z.string().regex(new RegExp(`^\\d{${OTP_DIGITS}}$`)),
});

export const requestUserLoginBodySchema = requestAdminLoginBodySchema;

export const verifyUserLoginBodySchema = verifyAdminLoginBodySchema;

export const refreshBodySchema = z.object({ refreshToken: z.string().min(1) });

export const tokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int(),
});

export type RequestAdminLoginBody = z.infer<typeof requestAdminLoginBodySchema>;
export type VerifyAdminLoginBody = z.infer<typeof verifyAdminLoginBodySchema>;
export type RequestUserLoginBody = z.infer<typeof requestUserLoginBodySchema>;
export type VerifyUserLoginBody = z.infer<typeof verifyUserLoginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type TokenResponse = z.infer<typeof tokenResponseSchema>;
