import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';

import type { Workspace } from '../entities/workspace.js';
import type { WorkspaceId } from '../value-objects/workspace-id.js';

// INFO: A workspace of another tenant is never found, so its existence does not leak.
export interface WorkspaceRepository {
  findById(tenantId: TenantId, id: WorkspaceId): Promise<Nullable<Workspace>>;
  findByIdForUpdate(tenantId: TenantId, id: WorkspaceId): Promise<Nullable<Workspace>>;
  save(workspace: Workspace): Promise<void>;
}

export const WORKSPACE_REPOSITORY = Symbol('WORKSPACE_REPOSITORY');
