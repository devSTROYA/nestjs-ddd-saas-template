import { and, count, desc, eq } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import { type UserId, toUserId } from '@modules/users';

import {
  WORKSPACE_VIEW_MEMBER_LIMIT,
  type WorkspaceMemberView,
  type WorkspaceQuery,
  type WorkspaceView,
} from '../../application/ports/workspace.query.js';
import { InvalidWorkspaceRoleError } from '../../domain/errors/domain.error.js';
import { type WorkspaceId, toWorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { type WorkspaceRole, isWorkspaceRole } from '../../domain/value-objects/workspace-role.js';
import { users } from '../../../users/infrastructure/persistence/user.schema.js';
import { workspaceMembers } from './workspace-member.schema.js';
import { workspaces } from './workspace.schema.js';

function toRole(value: string): WorkspaceRole {
  if (!isWorkspaceRole(value)) {
    throw new InvalidWorkspaceRoleError(value);
  }
  return value;
}

export class DrizzleWorkspaceQuery implements WorkspaceQuery {
  constructor(private readonly context: DatabaseContext) {}

  async findViewFor(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    actorId: UserId,
  ): Promise<Nullable<WorkspaceView>> {
    const access = await this.findAccess(tenantId, workspaceId, actorId);
    if (!access) {
      return null;
    }
    const [members, total] = await Promise.all([
      this.members(workspaceId, WORKSPACE_VIEW_MEMBER_LIMIT, 0),
      this.countMembers(workspaceId),
    ]);
    return {
      id: toWorkspaceId(access.id),
      name: access.name,
      role: toRole(access.role),
      memberCount: total,
      members,
    };
  }

  async listMembers(params: {
    tenantId: TenantId;
    workspaceId: WorkspaceId;
    actorId: UserId;
    page: number;
    limit: number;
  }): Promise<Nullable<{ items: WorkspaceMemberView[]; total: number }>> {
    const access = await this.findAccess(params.tenantId, params.workspaceId, params.actorId);
    if (!access) {
      return null;
    }
    const [items, total] = await Promise.all([
      this.members(params.workspaceId, params.limit, (params.page - 1) * params.limit),
      this.countMembers(params.workspaceId),
    ]);
    return { items, total };
  }

  private async findAccess(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    actorId: UserId,
  ): Promise<Nullable<{ id: string; name: string; role: string }>> {
    const [row] = await this.context.client
      .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, actorId)),
      )
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.tenantId, tenantId)));
    return row ?? null;
  }

  private async members(
    workspaceId: WorkspaceId,
    limit: number,
    offset: number,
  ): Promise<WorkspaceMemberView[]> {
    const rows = await this.context.client
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        name: users.name,
        email: users.email,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(desc(workspaceMembers.createdAt), desc(workspaceMembers.userId))
      .limit(limit)
      .offset(offset);
    return rows.map((row) => ({
      userId: toUserId(row.userId),
      name: row.name,
      email: row.email,
      role: toRole(row.role),
    }));
  }

  private async countMembers(workspaceId: WorkspaceId): Promise<number> {
    const [row] = await this.context.client
      .select({ total: count() })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId));
    return row?.total ?? 0;
  }
}
