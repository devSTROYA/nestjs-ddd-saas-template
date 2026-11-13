import { TenantId } from '@modules/tenants';

import { Workspace } from '../../domain/entities/workspace.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.js';
import type { WorkspaceNewRow, WorkspaceRow } from './workspace.schema.js';

export function toDomain(row: WorkspaceRow): Workspace {
  return Workspace.rehydrate(
    {
      tenantId: TenantId.rehydrate(row.tenantId),
      name: WorkspaceName.rehydrate(row.name),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    WorkspaceId.rehydrate(row.id),
  );
}

export function toPersistence(workspace: Workspace): WorkspaceNewRow {
  return {
    id: workspace.id,
    tenantId: workspace.tenantId,
    createdAt: workspace.createdAt,
    ...toMutableColumns(workspace),
  };
}

// Columns an upsert may overwrite; id, tenant and createdAt stay as first written.
export function toMutableColumns(
  workspace: Workspace,
): Pick<WorkspaceNewRow, 'name' | 'updatedAt'> {
  return { name: workspace.name.value, updatedAt: workspace.updatedAt };
}
