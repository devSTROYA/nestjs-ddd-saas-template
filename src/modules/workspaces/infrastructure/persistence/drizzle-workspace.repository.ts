import { and, eq, notInArray } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';
import { type TenantId, toTenantId } from '@modules/tenants';
import { toUserId } from '@modules/users';

import type { WorkspaceRepository } from '../../application/ports/workspace.repository.js';
import { Workspace } from '../../domain/entities/workspace.js';
import {
  InvalidWorkspaceRoleError,
  WorkspaceIdConflictError,
} from '../../domain/errors/domain.error.js';
import { toWorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.js';
import { isWorkspaceRole } from '../../domain/value-objects/workspace-role.js';
import { workspaceMembers, type WorkspaceMemberRow } from './workspace-member.schema.js';
import { workspaces, type WorkspaceRow } from './workspace.schema.js';

function toWorkspace(row: WorkspaceRow, memberRows: readonly WorkspaceMemberRow[]): Workspace {
  return Workspace.restore({
    id: toWorkspaceId(row.id),
    tenantId: toTenantId(row.tenantId),
    name: WorkspaceName.restore(row.name),
    members: memberRows.map((member) => {
      if (!isWorkspaceRole(member.role)) {
        throw new InvalidWorkspaceRoleError(member.role);
      }
      return { userId: toUserId(member.userId), role: member.role };
    }),
    createdAt: row.createdAt,
  });
}

export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly context: DatabaseContext) {}

  findByTenantId(tenantId: TenantId): Promise<Workspace | null> {
    return this.find(tenantId, false);
  }

  findByTenantIdForUpdate(tenantId: TenantId): Promise<Workspace | null> {
    return this.find(tenantId, true);
  }

  // Members are part of the aggregate: the stored set is made equal to the in-memory one.
  async save(workspace: Workspace): Promise<void> {
    const client = this.context.client;
    const name = workspace.name.value;
    const written = await client
      .insert(workspaces)
      .values({
        id: workspace.id,
        tenantId: workspace.tenantId,
        name,
        createdAt: workspace.createdAt,
      })
      .onConflictDoUpdate({
        target: workspaces.id,
        set: { name, updatedAt: new Date() },
        setWhere: eq(workspaces.tenantId, workspace.tenantId),
      })
      .returning({ id: workspaces.id });
    if (written.length === 0) {
      throw new WorkspaceIdConflictError(workspace.id);
    }

    const members = workspace.members;
    await client.delete(workspaceMembers).where(
      and(
        eq(workspaceMembers.workspaceId, workspace.id),
        notInArray(
          workspaceMembers.userId,
          members.map((member) => member.userId),
        ),
      ),
    );
    for (const member of members) {
      await client
        .insert(workspaceMembers)
        .values({ workspaceId: workspace.id, userId: member.userId, role: member.role })
        .onConflictDoUpdate({
          target: [workspaceMembers.workspaceId, workspaceMembers.userId],
          set: { role: member.role, updatedAt: new Date() },
        });
    }
  }

  private async find(tenantId: TenantId, lock: boolean): Promise<Workspace | null> {
    const query = this.context.client
      .select()
      .from(workspaces)
      .where(eq(workspaces.tenantId, tenantId));
    const [row] = await (lock ? query.for('update') : query);
    if (!row) {
      return null;
    }
    const memberRows = await this.context.client
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, row.id));
    return toWorkspace(row, memberRows);
  }
}
