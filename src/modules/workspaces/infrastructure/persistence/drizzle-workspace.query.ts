import { and, eq } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import {
  WORKSPACE_VIEW_MEMBER_LIMIT,
  type WorkspaceQuery,
  type WorkspaceDetail,
} from '../../application/ports/workspace.query.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import { findMemberPage } from './workspace-member-page.js';
import { workspaceMembers } from './workspace-member.schema.js';
import { workspaceRoles } from './workspace-role.schema.js';
import { workspaces } from './workspace.schema.js';

export class DrizzleWorkspaceQuery implements WorkspaceQuery {
  constructor(private readonly context: DatabaseContext) {}

  async findDetailFor(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    actorId: UserId,
  ): Promise<Nullable<WorkspaceDetail>> {
    const [access] = await this.context.client
      .select({
        id: workspaces.id,
        name: workspaces.name,
        roleId: workspaceMembers.roleId,
        role: workspaceRoles.key,
      })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        and(
          eq(workspaceMembers.workspaceId, workspaces.id),
          eq(workspaceMembers.userId, actorId.value),
        ),
      )
      .innerJoin(workspaceRoles, eq(workspaceRoles.id, workspaceMembers.roleId))
      .where(and(eq(workspaces.id, workspaceId.value), eq(workspaces.tenantId, tenantId.value)));
    if (!access) {
      return null;
    }
    const { items, total } = await findMemberPage(
      this.context,
      workspaceId,
      WORKSPACE_VIEW_MEMBER_LIMIT,
      0,
    );
    return {
      id: WorkspaceId.restore(access.id),
      name: access.name,
      roleId: WorkspaceRoleId.restore(access.roleId),
      role: access.role,
      memberCount: total,
      members: items,
    };
  }
}
