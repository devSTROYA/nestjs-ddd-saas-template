import { z } from 'zod';

export const inviteTenantBodySchema = z.object({ email: z.string() });

export const inviteTenantResponseSchema = z.object({ invitationId: z.uuid({ version: 'v7' }) });

export type InviteTenantBody = z.infer<typeof inviteTenantBodySchema>;
export type InviteTenantResponse = z.infer<typeof inviteTenantResponseSchema>;
