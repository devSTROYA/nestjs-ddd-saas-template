import { z } from 'zod';

import { OTP_DIGITS } from '@common/otp';

export const acceptInvitationBodySchema = z.object({
  otp: z.string().regex(new RegExp(`^\\d{${OTP_DIGITS}}$`)),
  tenantName: z.string(),
  userName: z.string(),
});

export type AcceptInvitationBody = z.infer<typeof acceptInvitationBodySchema>;

export const acceptInvitationResponseSchema = z.object({
  tenantId: z.uuid({ version: 'v7' }),
  userId: z.uuid({ version: 'v7' }),
  workspaceId: z.uuid({ version: 'v7' }),
});
