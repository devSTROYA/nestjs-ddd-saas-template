import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import type { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';

export type WorkspaceMemberListItem = {
  userId: UserId;
  name: string;
  email: string;
  roleId: WorkspaceRoleId;
  role: string;
};

type ListWorkspaceMembersParams = {
  tenantId: TenantId;
  workspaceId: WorkspaceId;
  actorId: UserId;
  page: number;
  limit: number;
};

export interface WorkspaceMemberQuery {
  // INFO: Answers null when the workspace is not found for the tenant or the actor is not a member, so a non-member learns nothing.
  list(
    params: ListWorkspaceMembersParams,
  ): Promise<Nullable<{ items: WorkspaceMemberListItem[]; total: number }>>;
}

export const WORKSPACE_MEMBER_QUERY = Symbol('WORKSPACE_MEMBER_QUERY');
