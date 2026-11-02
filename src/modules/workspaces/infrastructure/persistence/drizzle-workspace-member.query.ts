import { and, eq } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type {
  WorkspaceMemberQuery,
  WorkspaceMemberView,
} from '../../application/ports/workspace-member.query.js';
import type { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { findMemberPage } from './workspace-member-page.js';
import { workspaceMembers } from './workspace-member.schema.js';

export class DrizzleWorkspaceMemberQuery implements WorkspaceMemberQuery {
  constructor(private readonly context: DatabaseContext) {}

  async list(params: {
    tenantId: TenantId;
    workspaceId: WorkspaceId;
    actorId: UserId;
    page: number;
    limit: number;
  }): Promise<Nullable<{ items: WorkspaceMemberView[]; total: number }>> {
    const [access] = await this.context.client
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.tenantId, params.tenantId.value),
          eq(workspaceMembers.workspaceId, params.workspaceId.value),
          eq(workspaceMembers.userId, params.actorId.value),
        ),
      );
    if (!access) {
      return null;
    }
    return findMemberPage(
      this.context,
      params.workspaceId,
      params.limit,
      (params.page - 1) * params.limit,
    );
  }
}
