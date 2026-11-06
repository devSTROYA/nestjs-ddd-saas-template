import type { Pool } from 'pg';

import { WorkspacePermissionList } from '../domain/entities/workspace-permission-list.js';
import { WorkspaceRole } from '../domain/entities/workspace-role.js';
import { SystemRoleId } from '../domain/value-objects/system-workspace-role.js';
import {
  ALL_WORKSPACE_PERMISSIONS,
  WorkspacePermission,
} from '../domain/value-objects/workspace-permission.js';

const SEEDED_AT = new Date('2026-01-01T00:00:00Z');

// INFO: The rows migration 0013 seeds; a migration test keeps the two equal.
export const SYSTEM_ROLES = [
  {
    id: SystemRoleId.OWNER,
    key: 'owner',
    name: 'Owner',
    permissions: ALL_WORKSPACE_PERMISSIONS,
  },
  {
    id: SystemRoleId.ADMIN,
    key: 'admin',
    name: 'Admin',
    permissions: [
      WorkspacePermission.MEMBER_ADD,
      WorkspacePermission.MEMBER_CHANGE_ROLE,
      WorkspacePermission.MEMBER_REMOVE,
    ],
  },
  { id: SystemRoleId.MEMBER, key: 'member', name: 'Member', permissions: [] },
] as const;

export function systemRoles(): WorkspaceRole[] {
  return SYSTEM_ROLES.map(({ id, key, name, permissions }) =>
    WorkspaceRole.rehydrate(
      {
        tenantId: null,
        workspaceId: null,
        key,
        name,
        permissions: new WorkspacePermissionList(permissions),
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      },
      id,
    ),
  );
}

// INFO: TRUNCATE ... CASCADE on tenants or workspaces also empties workspace_roles, migration rows included.
export async function restoreSystemRoles(pool: Pool): Promise<void> {
  for (const { id, key, name, permissions } of SYSTEM_ROLES) {
    await pool.query(
      'INSERT INTO workspace_roles (id, key, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [id, key, name],
    );
    for (const permission of permissions) {
      await pool.query(
        'INSERT INTO workspace_role_permissions (role_id, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, permission],
      );
    }
  }
}
