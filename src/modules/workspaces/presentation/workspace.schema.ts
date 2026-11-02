import { z } from 'zod';

import { WorkspacePermission } from '../domain/value-objects/workspace-permission.js';

const roleIdSchema = z.uuid({ version: 'v7' });
const permissionsSchema = z.array(z.enum(WorkspacePermission));

export const addWorkspaceMemberBodySchema = z.object({
  email: z.string(),
  // INFO: Used only when the email is not a user yet.
  name: z.string(),
  roleId: roleIdSchema,
});

export const changeWorkspaceMemberRoleBodySchema = z.object({ roleId: roleIdSchema });

export const addWorkspaceMemberResponseSchema = z.object({ userId: z.uuid({ version: 'v7' }) });

export const listWorkspaceMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const memberResponseSchema = z.object({
  userId: z.uuid({ version: 'v7' }),
  name: z.string(),
  email: z.string(),
  roleId: roleIdSchema,
  role: z.string(),
});

export const workspaceResponseSchema = z.object({
  id: z.uuid({ version: 'v7' }),
  name: z.string(),
  roleId: roleIdSchema,
  role: z.string(),
  memberCount: z.number().int(),
  members: z.array(memberResponseSchema),
});

export const listWorkspaceMembersResponseSchema = z.object({
  items: z.array(memberResponseSchema),
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
});

export const createWorkspaceRoleBodySchema = z.object({
  key: z.string(),
  name: z.string(),
  permissions: permissionsSchema,
});

export const createWorkspaceRoleResponseSchema = z.object({ id: roleIdSchema });

export const updateWorkspaceRoleBodySchema = z.object({
  name: z.string(),
  permissions: permissionsSchema,
});

export const listWorkspaceRolesResponseSchema = z.array(
  z.object({
    id: roleIdSchema,
    key: z.string(),
    name: z.string(),
    system: z.boolean(),
    permissions: permissionsSchema,
  }),
);

export type CreateWorkspaceRoleBody = z.infer<typeof createWorkspaceRoleBodySchema>;
export type UpdateWorkspaceRoleBody = z.infer<typeof updateWorkspaceRoleBodySchema>;
export type AddWorkspaceMemberBody = z.infer<typeof addWorkspaceMemberBodySchema>;
export type ChangeWorkspaceMemberRoleBody = z.infer<typeof changeWorkspaceMemberRoleBodySchema>;
export type ListWorkspaceMembersQueryParams = z.infer<typeof listWorkspaceMembersQuerySchema>;
