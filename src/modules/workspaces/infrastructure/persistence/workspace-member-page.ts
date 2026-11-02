import { count, desc, eq } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';
import { UserId } from '@modules/users';

import type { WorkspaceMemberView } from '../../application/ports/workspace-member.query.js';
import type { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { toWorkspaceRole } from '../../domain/value-objects/workspace-role.js';
import { users } from '../../../users/infrastructure/persistence/user.schema.js';
import { workspaceMembers } from './workspace-member.schema.js';

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
        role: workspaceMembers.role,
        name: users.name,
        email: users.email,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
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
      role: toWorkspaceRole(row.role),
    })),
    total: counted[0]?.total ?? 0,
  };
}
