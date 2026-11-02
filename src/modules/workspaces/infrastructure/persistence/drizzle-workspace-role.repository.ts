import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import { type DatabaseContext, isUniqueViolation } from '@common/database';
import { saveAggregate } from '@common/outbox';
import type { Nullable } from '@common/types';
import { TenantId } from '@modules/tenants';

import type { WorkspaceRoleRepository } from '../../application/ports/workspace-role.repository.js';
import { WorkspacePermissionList } from '../../domain/entities/workspace-permission-list.js';
import { WorkspaceRole } from '../../domain/entities/workspace-role.js';
import {
  WorkspaceRoleIdConflictError,
  WorkspaceRoleKeyTakenError,
} from '../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import {
  ALL_WORKSPACE_PERMISSIONS,
  type WorkspacePermission,
} from '../../domain/value-objects/workspace-permission.js';
import { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import {
  type WorkspaceRoleRow,
  workspaceRolePermissions,
  workspaceRoles,
} from './workspace-role.schema.js';

// INFO: A stored permission this version does not know grants nothing.
export function knownPermissions(stored: readonly string[]): WorkspacePermission[] {
  return ALL_WORKSPACE_PERMISSIONS.filter((permission) => stored.includes(permission));
}

function toWorkspaceRole(row: WorkspaceRoleRow, permissions: readonly string[]): WorkspaceRole {
  return WorkspaceRole.restore(
    {
      tenantId: row.tenantId ? TenantId.restore(row.tenantId) : null,
      workspaceId: row.workspaceId ? WorkspaceId.restore(row.workspaceId) : null,
      key: row.key,
      name: row.name,
      permissions: new WorkspacePermissionList(knownPermissions(permissions)),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    WorkspaceRoleId.restore(row.id),
  );
}

export class DrizzleWorkspaceRoleRepository implements WorkspaceRoleRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    id: WorkspaceRoleId,
  ): Promise<Nullable<WorkspaceRole>> {
    const [row] = await this.context.client
      .select()
      .from(workspaceRoles)
      .where(
        and(
          eq(workspaceRoles.id, id.value),
          or(
            and(
              eq(workspaceRoles.workspaceId, workspaceId.value),
              eq(workspaceRoles.tenantId, tenantId.value),
            ),
            isNull(workspaceRoles.workspaceId),
          ),
        ),
      );
    if (!row) {
      return null;
    }
    const permissions = await this.context.client
      .select({ permission: workspaceRolePermissions.permission })
      .from(workspaceRolePermissions)
      .where(eq(workspaceRolePermissions.roleId, row.id));
    return toWorkspaceRole(
      row,
      permissions.map(({ permission }) => permission),
    );
  }

  save(role: WorkspaceRole): Promise<void> {
    return saveAggregate(this.context, role, async () => {
      await this.writeRole(role);
      await this.writePermissions(role);
    });
  }

  delete(role: WorkspaceRole): Promise<void> {
    return saveAggregate(this.context, role, async () => {
      const { tenantId } = role;
      if (!tenantId) {
        return;
      }
      await this.context.client
        .delete(workspaceRoles)
        .where(
          and(eq(workspaceRoles.id, role.id.value), eq(workspaceRoles.tenantId, tenantId.value)),
        );
    });
  }

  // INFO: setWhere matches no system role, whose tenant is null, so a save can never overwrite one.
  private async writeRole(role: WorkspaceRole): Promise<void> {
    const { name, updatedAt } = role;
    const tenantId = role.tenantId?.value ?? null;
    try {
      const written = await this.context.client
        .insert(workspaceRoles)
        .values({
          id: role.id.value,
          tenantId,
          workspaceId: role.workspaceId?.value ?? null,
          key: role.key,
          name,
          createdAt: role.createdAt,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: workspaceRoles.id,
          set: { name, updatedAt },
          setWhere: tenantId ? eq(workspaceRoles.tenantId, tenantId) : isNull(workspaceRoles.id),
        })
        .returning({ id: workspaceRoles.id });
      if (written.length === 0) {
        throw new WorkspaceRoleIdConflictError(role.id.value);
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new WorkspaceRoleKeyTakenError(role.key);
      }
      throw error;
    }
  }

  // INFO: The deltas stay on the aggregate after a save, so both writes must be safe to repeat.
  private async writePermissions(role: WorkspaceRole): Promise<void> {
    const { added, removed } = role.permissionChanges;
    if (removed.length > 0) {
      await this.context.client
        .delete(workspaceRolePermissions)
        .where(
          and(
            eq(workspaceRolePermissions.roleId, role.id.value),
            inArray(workspaceRolePermissions.permission, removed),
          ),
        );
    }
    if (added.length > 0) {
      await this.context.client
        .insert(workspaceRolePermissions)
        .values(added.map((permission) => ({ roleId: role.id.value, permission })))
        .onConflictDoNothing();
    }
  }
}
