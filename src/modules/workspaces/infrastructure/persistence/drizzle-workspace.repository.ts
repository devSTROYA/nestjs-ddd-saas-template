import { and, eq, notInArray } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';
import { saveAggregate } from '@common/outbox';
import type { Nullable } from '@common/types';
import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import type { WorkspaceRepository } from '../../application/ports/workspace.repository.js';
import { Workspace } from '../../domain/entities/workspace.js';
import {
  InvalidWorkspaceRoleError,
  WorkspaceIdConflictError,
} from '../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.js';
import { isWorkspaceRole } from '../../domain/value-objects/workspace-role.js';
import { workspaceMembers, type WorkspaceMemberRow } from './workspace-member.schema.js';
import { workspaces, type WorkspaceRow } from './workspace.schema.js';

function toWorkspace(row: WorkspaceRow, memberRows: readonly WorkspaceMemberRow[]): Workspace {
  return Workspace.restore(
    {
      tenantId: TenantId.restore(row.tenantId),
      name: WorkspaceName.restore(row.name),
      roles: new Map(
        memberRows.map((member) => {
          if (!isWorkspaceRole(member.role)) {
            throw new InvalidWorkspaceRoleError(member.role);
          }
          return [UserId.restore(member.userId).value, member.role];
        }),
      ),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    WorkspaceId.restore(row.id),
  );
}

export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly context: DatabaseContext) {}

  findById(tenantId: TenantId, id: WorkspaceId): Promise<Nullable<Workspace>> {
    return this.find(tenantId, id, false);
  }

  findByIdForUpdate(tenantId: TenantId, id: WorkspaceId): Promise<Nullable<Workspace>> {
    return this.find(tenantId, id, true);
  }

  save(workspace: Workspace): Promise<void> {
    return saveAggregate(this.context, workspace, () => this.write(workspace));
  }

  private async write(workspace: Workspace): Promise<void> {
    const client = this.context.client;
    const name = workspace.name.value;
    const written = await client
      .insert(workspaces)
      .values({
        id: workspace.id.value,
        tenantId: workspace.tenantId.value,
        name,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      })
      .onConflictDoUpdate({
        target: workspaces.id,
        set: { name, updatedAt: workspace.updatedAt },
        setWhere: eq(workspaces.tenantId, workspace.tenantId.value),
      })
      .returning({ id: workspaces.id });
    if (written.length === 0) {
      throw new WorkspaceIdConflictError(workspace.id.value);
    }

    const members = workspace.members;
    await client.delete(workspaceMembers).where(
      and(
        eq(workspaceMembers.workspaceId, workspace.id.value),
        notInArray(
          workspaceMembers.userId,
          members.map((member) => member.userId.value),
        ),
      ),
    );
    for (const member of members) {
      await client
        .insert(workspaceMembers)
        .values({
          workspaceId: workspace.id.value,
          userId: member.userId.value,
          role: member.role,
        })
        .onConflictDoUpdate({
          target: [workspaceMembers.workspaceId, workspaceMembers.userId],
          set: { role: member.role, updatedAt: new Date() },
        });
    }
  }

  private async find(
    tenantId: TenantId,
    id: WorkspaceId,
    lock: boolean,
  ): Promise<Nullable<Workspace>> {
    const query = this.context.client
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.id, id.value), eq(workspaces.tenantId, tenantId.value)));
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
