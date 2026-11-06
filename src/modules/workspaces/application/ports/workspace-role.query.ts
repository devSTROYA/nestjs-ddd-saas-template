import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import type { WorkspacePermission } from '../../domain/value-objects/workspace-permission.js';
import type { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';

export type WorkspaceRoleListItem = {
  id: WorkspaceRoleId;
  key: string;
  name: string;
  system: boolean;
  permissions: readonly WorkspacePermission[];
};

export interface WorkspaceRoleQuery {
  // INFO: System roles first. Answers null when the workspace is not found for the tenant or the actor is not a member, so a non-member learns nothing.
  listFor(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    actorId: UserId,
  ): Promise<Nullable<WorkspaceRoleListItem[]>>;
}

export const WORKSPACE_ROLE_QUERY = Symbol('WORKSPACE_ROLE_QUERY');
