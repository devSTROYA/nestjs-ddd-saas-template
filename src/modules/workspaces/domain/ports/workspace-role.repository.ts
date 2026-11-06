import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';

import type { WorkspaceRole } from '../entities/workspace-role.js';
import type { WorkspaceId } from '../value-objects/workspace-id.js';
import type { WorkspaceRoleId } from '../value-objects/workspace-role-id.js';

export interface WorkspaceRoleRepository {
  // INFO: Finds a system role or a role of this workspace, never a role of another workspace.
  findById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    id: WorkspaceRoleId,
  ): Promise<Nullable<WorkspaceRole>>;
  save(role: WorkspaceRole): Promise<void>;
  delete(role: WorkspaceRole): Promise<void>;
}

export const WORKSPACE_ROLE_REPOSITORY = Symbol('WORKSPACE_ROLE_REPOSITORY');
