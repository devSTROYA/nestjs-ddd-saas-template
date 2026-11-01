import { z } from 'zod';

import { WorkspaceRole } from '../domain/value-objects/workspace-role.js';

const roleSchema = z.enum([WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);

export const addWorkspaceMemberBodySchema = z.object({
  email: z.string(),
  // INFO: Used only when the email is not a user yet.
  name: z.string(),
  role: roleSchema,
});

export const changeWorkspaceMemberRoleBodySchema = z.object({ role: roleSchema });

export const addWorkspaceMemberResponseSchema = z.object({ userId: z.uuid({ version: 'v7' }) });

export const workspaceResponseSchema = z.object({
  id: z.uuid({ version: 'v7' }),
  name: z.string(),
  role: roleSchema,
  members: z.array(z.object({ userId: z.uuid({ version: 'v7' }), role: roleSchema })),
});

export type AddWorkspaceMemberBody = z.infer<typeof addWorkspaceMemberBodySchema>;
export type ChangeWorkspaceMemberRoleBody = z.infer<typeof changeWorkspaceMemberRoleBodySchema>;
