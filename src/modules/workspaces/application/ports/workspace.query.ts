import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import type { WorkspaceRole } from '../../domain/value-objects/workspace-role.js';

export const WORKSPACE_VIEW_MEMBER_LIMIT = 10;

export type WorkspaceMemberView = {
  userId: UserId;
  name: string;
  email: string;
  role: WorkspaceRole;
};

export type WorkspaceView = {
  id: WorkspaceId;
  name: string;
  role: WorkspaceRole;
  memberCount: number;
  members: WorkspaceMemberView[];
};

type ListWorkspaceMembersParams = {
  tenantId: TenantId;
  workspaceId: WorkspaceId;
  actorId: UserId;
  page: number;
  limit: number;
};

// INFO: Both methods answer null when the workspace is not found for the tenant or the actor is not a member, so a non-member learns nothing.
export interface WorkspaceQuery {
  // INFO: Shows only the newest WORKSPACE_VIEW_MEMBER_LIMIT members; memberCount is the total.
  findViewFor(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    actorId: UserId,
  ): Promise<Nullable<WorkspaceView>>;
  listMembers(
    params: ListWorkspaceMembersParams,
  ): Promise<Nullable<{ items: WorkspaceMemberView[]; total: number }>>;
}

export const WORKSPACE_QUERY = Symbol('WORKSPACE_QUERY');
