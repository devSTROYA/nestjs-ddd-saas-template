import { and, count, desc, eq } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';
import type { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import type { WorkspaceMemberView } from '../../application/ports/workspace-member.query.js';
import type { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import { users } from '../../../users/infrastructure/persistence/user.schema.js';
import { workspaceMembers } from './workspace-member.schema.js';
import { workspaceRoles } from './workspace-role.schema.js';

// INFO: Who may see a workspace, its members and its roles: only its members.
export async function isMember(
  context: DatabaseContext,
  tenantId: TenantId,
  workspaceId: WorkspaceId,
  userId: UserId,
): Promise<boolean> {
  const [row] = await context.client
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.tenantId, tenantId.value),
        eq(workspaceMembers.workspaceId, workspaceId.value),
        eq(workspaceMembers.userId, userId.value),
      ),
    );
  return row !== undefined;
}

// INFO: Newest first; callers check first that the actor may see this workspace.
export async function findMemberPage(
  context: DatabaseContext,
  workspaceId: WorkspaceId,
  limit: number,
  offset: number,
): Promise<{ items: WorkspaceMemberView[]; total: number }> {
  const [rows, counted] = await Promise.all([
    context.client
      .select({
        userId: workspaceMembers.userId,
        roleId: workspaceMembers.roleId,
        role: workspaceRoles.key,
        name: users.name,
        email: users.email,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .innerJoin(workspaceRoles, eq(workspaceRoles.id, workspaceMembers.roleId))
      .where(eq(workspaceMembers.workspaceId, workspaceId.value))
      .orderBy(desc(workspaceMembers.createdAt), desc(workspaceMembers.userId))
      .limit(limit)
      .offset(offset),
    context.client
      .select({ total: count() })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId.value)),
  ]);
  return {
    items: rows.map((row) => ({
      userId: UserId.restore(row.userId),
      name: row.name,
      email: row.email,
      roleId: WorkspaceRoleId.restore(row.roleId),
      role: row.role,
    })),
    total: counted[0]?.total ?? 0,
  };
}
