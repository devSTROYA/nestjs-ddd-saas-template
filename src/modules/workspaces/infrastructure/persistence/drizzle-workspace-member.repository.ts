import { and, count, eq } from 'drizzle-orm';

import { type DatabaseContext, isUniqueViolation } from '@common/database';
import { saveAggregate } from '@common/outbox';
import type { Nullable } from '@common/types';
import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import type { WorkspaceMemberRepository } from '../../application/ports/workspace-member.repository.js';
import { WorkspaceMember } from '../../domain/entities/workspace-member.js';
import {
  WorkspaceMemberAlreadyExistsError,
  WorkspaceMemberIdConflictError,
} from '../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceMemberId } from '../../domain/value-objects/workspace-member-id.js';
import { WorkspaceRole, toWorkspaceRole } from '../../domain/value-objects/workspace-role.js';
import { type WorkspaceMemberRow, workspaceMembers } from './workspace-member.schema.js';

function toWorkspaceMember(row: WorkspaceMemberRow): WorkspaceMember {
  return WorkspaceMember.restore(
    {
      tenantId: TenantId.restore(row.tenantId),
      workspaceId: WorkspaceId.restore(row.workspaceId),
      userId: UserId.restore(row.userId),
      role: toWorkspaceRole(row.role),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    WorkspaceMemberId.restore(row.id),
  );
}

export class DrizzleWorkspaceMemberRepository implements WorkspaceMemberRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findByUser(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<Nullable<WorkspaceMember>> {
    const [row] = await this.context.client
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.tenantId, tenantId.value),
          eq(workspaceMembers.workspaceId, workspaceId.value),
          eq(workspaceMembers.userId, userId.value),
        ),
      );
    return row ? toWorkspaceMember(row) : null;
  }

  async countOwners(tenantId: TenantId, workspaceId: WorkspaceId): Promise<number> {
    const [row] = await this.context.client
      .select({ total: count() })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.tenantId, tenantId.value),
          eq(workspaceMembers.workspaceId, workspaceId.value),
          eq(workspaceMembers.role, WorkspaceRole.OWNER),
        ),
      );
    return row?.total ?? 0;
  }

  save(member: WorkspaceMember): Promise<void> {
    return saveAggregate(this.context, member, async () => {
      const { role, updatedAt } = member;
      try {
        const written = await this.context.client
          .insert(workspaceMembers)
          .values({
            id: member.id.value,
            tenantId: member.tenantId.value,
            workspaceId: member.workspaceId.value,
            userId: member.userId.value,
            role,
            createdAt: member.createdAt,
            updatedAt,
          })
          .onConflictDoUpdate({
            target: workspaceMembers.id,
            set: { role, updatedAt },
            setWhere: eq(workspaceMembers.tenantId, member.tenantId.value),
          })
          .returning({ id: workspaceMembers.id });
        if (written.length === 0) {
          throw new WorkspaceMemberIdConflictError(member.id.value);
        }
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new WorkspaceMemberAlreadyExistsError(member.userId.value);
        }
        throw error;
      }
    });
  }

  delete(member: WorkspaceMember): Promise<void> {
    return saveAggregate(this.context, member, async () => {
      await this.context.client
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.id, member.id.value),
            eq(workspaceMembers.tenantId, member.tenantId.value),
          ),
        );
    });
  }
}
