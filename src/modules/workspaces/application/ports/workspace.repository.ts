import type { TenantId } from '@modules/tenants';

import type { Workspace } from '../../domain/entities/workspace.js';

// A tenant has exactly one workspace for now, so it is looked up by tenant.
export interface WorkspaceRepository {
  findByTenantId(tenantId: TenantId): Promise<Workspace | null>;
  findByTenantIdForUpdate(tenantId: TenantId): Promise<Workspace | null>;
  save(workspace: Workspace): Promise<void>;
}

export const WORKSPACE_REPOSITORY = Symbol('WORKSPACE_REPOSITORY');
