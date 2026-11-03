import { asc, eq, isNull, or, sql } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type {
  WorkspaceRoleQuery,
  WorkspaceRoleView,
} from '../../application/ports/workspace-role.query.js';
import type { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import { knownPermissions } from './drizzle-workspace-role.repository.js';
import { isMember } from './workspace-member-page.js';
import { workspaceRolePermissions, workspaceRoles } from './workspace-role.schema.js';

export class DrizzleWorkspaceRoleQuery implements WorkspaceRoleQuery {
  constructor(private readonly context: DatabaseContext) {}

  async listFor(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    actorId: UserId,
  ): Promise<Nullable<WorkspaceRoleView[]>> {
    if (!(await isMember(this.context, tenantId, workspaceId, actorId))) {
      return null;
    }
    const visible = or(
      eq(workspaceRoles.workspaceId, workspaceId.value),
      isNull(workspaceRoles.workspaceId),
    );
    const [roles, granted] = await Promise.all([
      this.context.client
        .select()
        .from(workspaceRoles)
        .where(visible)
        .orderBy(sql`${workspaceRoles.workspaceId} nulls first`, asc(workspaceRoles.key)),
      this.context.client
        .select({
          roleId: workspaceRolePermissions.roleId,
          permission: workspaceRolePermissions.permission,
        })
        .from(workspaceRolePermissions)
        .innerJoin(workspaceRoles, eq(workspaceRoles.id, workspaceRolePermissions.roleId))
        .where(visible),
    ]);
    return roles.map((role) => ({
      id: WorkspaceRoleId.restore(role.id),
      key: role.key,
      name: role.name,
      system: role.workspaceId === null,
      permissions: knownPermissions(
        granted.filter(({ roleId }) => roleId === role.id).map(({ permission }) => permission),
      ),
    }));
  }
}
