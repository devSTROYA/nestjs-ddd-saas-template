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

export const listWorkspaceMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const memberResponseSchema = z.object({
  userId: z.uuid({ version: 'v7' }),
  name: z.string(),
  email: z.string(),
  role: roleSchema,
});

export const workspaceResponseSchema = z.object({
  id: z.uuid({ version: 'v7' }),
  name: z.string(),
  role: roleSchema,
  memberCount: z.number().int(),
  members: z.array(memberResponseSchema),
});

export const listWorkspaceMembersResponseSchema = z.object({
  items: z.array(memberResponseSchema),
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
});

export type AddWorkspaceMemberBody = z.infer<typeof addWorkspaceMemberBodySchema>;
export type ChangeWorkspaceMemberRoleBody = z.infer<typeof changeWorkspaceMemberRoleBodySchema>;
export type ListWorkspaceMembersQueryParams = z.infer<typeof listWorkspaceMembersQuerySchema>;
