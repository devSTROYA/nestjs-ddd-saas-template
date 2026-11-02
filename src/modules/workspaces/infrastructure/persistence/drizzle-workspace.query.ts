import { and, eq } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import {
  WORKSPACE_VIEW_MEMBER_LIMIT,
  type WorkspaceQuery,
  type WorkspaceView,
} from '../../application/ports/workspace.query.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { toWorkspaceRole } from '../../domain/value-objects/workspace-role.js';
import { findMemberPage } from './workspace-member-page.js';
import { workspaceMembers } from './workspace-member.schema.js';
import { workspaces } from './workspace.schema.js';

export class DrizzleWorkspaceQuery implements WorkspaceQuery {
  constructor(private readonly context: DatabaseContext) {}

  async findViewFor(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    actorId: UserId,
  ): Promise<Nullable<WorkspaceView>> {
    const [access] = await this.context.client
      .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        and(
          eq(workspaceMembers.workspaceId, workspaces.id),
          eq(workspaceMembers.userId, actorId.value),
        ),
      )
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
      role: toWorkspaceRole(access.role),
      memberCount: total,
      members: items,
    };
  }
}
