import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import type { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import type { WorkspaceMemberListItem } from './workspace-member.query.js';

export const WORKSPACE_VIEW_MEMBER_LIMIT = 10;

export type WorkspaceDetail = {
  id: WorkspaceId;
  name: string;
  roleId: WorkspaceRoleId;
  role: string;
  memberCount: number;
  members: WorkspaceMemberListItem[];
};

export interface WorkspaceQuery {
  // INFO: Answers null when the workspace is not found for the tenant or the actor is not a member, so a non-member learns nothing.
  // Shows only the newest WORKSPACE_VIEW_MEMBER_LIMIT members; memberCount is the total.
  findDetailFor(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    actorId: UserId,
  ): Promise<Nullable<WorkspaceDetail>>;
}

export const WORKSPACE_QUERY = Symbol('WORKSPACE_QUERY');
