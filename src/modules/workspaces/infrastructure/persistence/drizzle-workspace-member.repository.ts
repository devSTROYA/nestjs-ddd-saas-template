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
import { SystemRoleId } from '../../domain/value-objects/system-workspace-role.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceMemberId } from '../../domain/value-objects/workspace-member-id.js';
import { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import { type WorkspaceMemberRow, workspaceMembers } from './workspace-member.schema.js';

function toWorkspaceMember(row: WorkspaceMemberRow): WorkspaceMember {
  return WorkspaceMember.restore(
    {
      tenantId: TenantId.restore(row.tenantId),
      workspaceId: WorkspaceId.restore(row.workspaceId),
      userId: UserId.restore(row.userId),
      roleId: WorkspaceRoleId.restore(row.roleId),
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

  countOwners(tenantId: TenantId, workspaceId: WorkspaceId): Promise<number> {
    return this.countWithRole(tenantId, workspaceId, SystemRoleId.OWNER);
  }

  async countWithRole(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    roleId: WorkspaceRoleId,
  ): Promise<number> {
    const [row] = await this.context.client
      .select({ total: count() })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.tenantId, tenantId.value),
          eq(workspaceMembers.workspaceId, workspaceId.value),
          eq(workspaceMembers.roleId, roleId.value),
        ),
      );
    return row?.total ?? 0;
  }

  save(member: WorkspaceMember): Promise<void> {
    return saveAggregate(this.context, member, async () => {
      const { updatedAt } = member;
      const roleId = member.roleId.value;
      try {
        const written = await this.context.client
          .insert(workspaceMembers)
          .values({
            id: member.id.value,
            tenantId: member.tenantId.value,
            workspaceId: member.workspaceId.value,
            userId: member.userId.value,
            roleId,
            createdAt: member.createdAt,
            updatedAt,
          })
          .onConflictDoUpdate({
            target: workspaceMembers.id,
            set: { roleId, updatedAt },
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
