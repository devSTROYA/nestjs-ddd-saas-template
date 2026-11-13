import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import { type DatabaseContext, isUniqueViolation } from '@common/database';
import { saveAggregate } from '@common/outbox';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';

import type { WorkspaceRoleRepository } from '../../domain/ports/workspace-role.repository.js';
import type { WorkspaceRole } from '../../domain/entities/workspace-role.js';
import {
  WorkspaceRoleIdConflictError,
  WorkspaceRoleKeyTakenError,
} from '../../domain/errors/domain.error.js';
import type { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import type { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import { toDomain, toMutableColumns, toPersistence } from './workspace-role.mapper.js';
import { workspaceRolePermissions, workspaceRoles } from './workspace-role.schema.js';

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
          eq(workspaceRoles.id, id),
          or(
            and(eq(workspaceRoles.workspaceId, workspaceId), eq(workspaceRoles.tenantId, tenantId)),
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
    return toDomain(
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
        .where(and(eq(workspaceRoles.id, role.id), eq(workspaceRoles.tenantId, tenantId)));
    });
  }

  // INFO: setWhere matches no system role, whose tenant is null, so a save can never overwrite one.
  private async writeRole(role: WorkspaceRole): Promise<void> {
    const tenantId = role.tenantId ?? null;
    try {
      const written = await this.context.client
        .insert(workspaceRoles)
        .values(toPersistence(role))
        .onConflictDoUpdate({
          target: workspaceRoles.id,
          set: toMutableColumns(role),
          setWhere: tenantId ? eq(workspaceRoles.tenantId, tenantId) : isNull(workspaceRoles.id),
        })
        .returning({ id: workspaceRoles.id });
      if (written.length === 0) {
        throw new WorkspaceRoleIdConflictError(role.id);
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
            eq(workspaceRolePermissions.roleId, role.id),
            inArray(workspaceRolePermissions.permission, removed),
          ),
        );
    }
    if (added.length > 0) {
      await this.context.client
        .insert(workspaceRolePermissions)
        .values(added.map((permission) => ({ roleId: role.id, permission })))
        .onConflictDoNothing();
    }
  }
}
