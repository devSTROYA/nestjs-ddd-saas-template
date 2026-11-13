import { TenantId } from '@modules/tenants';

import { WorkspacePermissionList } from '../../domain/entities/workspace-permission-list.js';
import { WorkspaceRole } from '../../domain/entities/workspace-role.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import {
  ALL_WORKSPACE_PERMISSIONS,
  type WorkspacePermission,
} from '../../domain/value-objects/workspace-permission.js';
import { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import { WorkspaceRoleKey } from '../../domain/value-objects/workspace-role-key.js';
import { WorkspaceRoleName } from '../../domain/value-objects/workspace-role-name.js';
import type { WorkspaceRoleNewRow, WorkspaceRoleRow } from './workspace-role.schema.js';

// INFO: A stored permission this version does not know grants nothing.
export function knownPermissions(stored: readonly string[]): WorkspacePermission[] {
  return ALL_WORKSPACE_PERMISSIONS.filter((permission) => stored.includes(permission));
}

export function toDomain(row: WorkspaceRoleRow, permissions: readonly string[]): WorkspaceRole {
  return WorkspaceRole.rehydrate(
    {
      tenantId: row.tenantId ? TenantId.rehydrate(row.tenantId) : null,
      workspaceId: row.workspaceId ? WorkspaceId.rehydrate(row.workspaceId) : null,
      key: WorkspaceRoleKey.rehydrate(row.key),
      name: WorkspaceRoleName.rehydrate(row.name),
      permissions: new WorkspacePermissionList(knownPermissions(permissions)),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    WorkspaceRoleId.rehydrate(row.id),
  );
}

// The permissions live in their own table, so this is the role row only.
export function toPersistence(role: WorkspaceRole): WorkspaceRoleNewRow {
  return {
    id: role.id,
    tenantId: role.tenantId ?? null,
    workspaceId: role.workspaceId ?? null,
    key: role.key.value,
    createdAt: role.createdAt,
    ...toMutableColumns(role),
  };
}

// Columns an upsert may overwrite; id, scope, key and createdAt stay as first written.
export function toMutableColumns(
  role: WorkspaceRole,
): Pick<WorkspaceRoleNewRow, 'name' | 'updatedAt'> {
  return { name: role.name.value, updatedAt: role.updatedAt };
}
